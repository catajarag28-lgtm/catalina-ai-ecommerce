import { notifyCatalina } from './notify.js'
import { webhookSecret } from './creative.js'

const allowedEvents = new Set(['email.sent','email.delivered','email.delivery_delayed','email.opened','email.clicked','email.bounced','email.complained','email.failed','email.suppressed'])

function decodeBase64(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}
function equalBytes(a,b) {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i=0;i<a.length;i++) difference |= a[i] ^ b[i]
  return difference === 0
}
export async function verifyResendSignature(body, headers, secret, now=Date.now()) {
  const id = headers.get('svix-id') || ''
  const timestamp = headers.get('svix-timestamp') || ''
  const signatures = (headers.get('svix-signature') || '').split(' ')
  const seconds = Number(timestamp)
  if (!id || !Number.isInteger(seconds) || Math.abs(now - seconds*1000) > 300000 || !secret?.startsWith('whsec_')) return false
  try {
    const key = await crypto.subtle.importKey('raw',decodeBase64(secret.slice(6)),{name:'HMAC',hash:'SHA-256'},false,['sign'])
    const signed = new TextEncoder().encode(id+'.'+timestamp+'.'+body)
    const expected = new Uint8Array(await crypto.subtle.sign('HMAC',key,signed))
    return signatures.some(item => item.startsWith('v1,') && equalBytes(expected,decodeBase64(item.slice(3))))
  } catch { return false }
}
export async function receiveResendEvent(request, env) {
  const secret = await webhookSecret(env)
  if (!secret) return new Response('Webhook no configurado',{status:503})
  const body = await request.text()
  if (body.length > 100000 || !(await verifyResendSignature(body,request.headers,secret))) return new Response('Firma inválida',{status:401})
  let event
  try { event=JSON.parse(body) } catch { return new Response('JSON inválido',{status:400}) }
  if (!allowedEvents.has(event.type) || !event.data?.email_id) return new Response('Ignorado',{status:200})
  const row = await env.DB.prepare('SELECT id,email,status FROM outreach WHERE provider_id=?').bind(event.data.email_id).first()
  if (!row) return new Response('Sin propuesta asociada',{status:200})
  const stamp = Date.parse(event.created_at)
  const occurred = Number.isFinite(stamp) ? stamp : Date.now()
  const id = request.headers.get('svix-id')
  const inserted = await env.DB.prepare('INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)').bind(id,row.id,event.type,occurred).run()
  if (!inserted.meta.changes) return new Response('Duplicado',{status:200})
  if (['email.bounced','email.complained','email.failed','email.suppressed'].includes(event.type)) {
    const status = event.type.slice(6)
    await env.DB.prepare("UPDATE outreach SET status=?,updated_at=? WHERE id=? AND status NOT IN ('replied','suppressed')").bind(status,Date.now(),row.id).run()
    if (event.type !== 'email.failed') await env.DB.prepare('INSERT OR REPLACE INTO suppression(email,reason,created_at) VALUES (?,?,?)').bind(row.email.toLowerCase(),status,Date.now()).run()
    if (event.type === 'email.complained') {
      await pauseOutreach(env,'Queja de spam recibida')
      await notifyCatalina(env,'Prospección pausada: queja de spam','Carolina detuvo nuevos envíos. Revisa el origen, el contenido y la autorización antes de reanudar.').catch(()=>{})
    }
  }
  return new Response('OK',{status:200})
}
export async function pauseOutreach(env,reason) {
  await env.DB.prepare('UPDATE outreach_control SET paused=1,reason=?,updated_at=? WHERE id=1').bind(reason,Date.now()).run()
}
export async function outreachSnapshot(env, since=Date.now()-30*86400000) {
  const sends=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach WHERE sent_at IS NOT NULL AND id NOT LIKE 'test-%' AND sent_at>=?").bind(since).first()
  const events=await env.DB.prepare("SELECT type,COUNT(DISTINCT outreach_id) AS n FROM outreach_events JOIN outreach ON outreach.id=outreach_events.outreach_id WHERE outreach.id NOT LIKE 'test-%' AND occurred_at>=? GROUP BY type").bind(since).all()
  const replies=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach WHERE status='replied' AND id NOT LIKE 'test-%' AND updated_at>=?").bind(since).first()
  const visits=await env.DB.prepare("SELECT COUNT(DISTINCT outreach_id) AS n FROM outreach_events JOIN outreach ON outreach.id=outreach_events.outreach_id WHERE outreach.id NOT LIKE 'test-%' AND type='page.viewed' AND occurred_at>=?").bind(since).first()
  return {sent:sends?.n||0,delivered:0,opened:0,clicked:0,visited:visits?.n||0,replied:replies?.n||0,bounced:0,complained:0,...Object.fromEntries((events.results||[]).map(row=>[row.type.slice(6),row.n]))}
}
export async function checkOutreachHealth(env, now=Date.now()) {
  const control=await env.DB.prepare('SELECT paused,reason FROM outreach_control WHERE id=1').first()
  if (control?.paused) return {paused:true,reason:control.reason}
  const sent=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach WHERE sent_at IS NOT NULL AND id NOT LIKE 'test-%' AND sent_at>=?").bind(now-14*86400000).first()
  const complaints=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach_events JOIN outreach ON outreach.id=outreach_events.outreach_id WHERE outreach.id NOT LIKE 'test-%' AND type='email.complained' AND occurred_at>=?").bind(now-14*86400000).first()
  const bounces=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach_events JOIN outreach ON outreach.id=outreach_events.outreach_id WHERE outreach.id NOT LIKE 'test-%' AND type='email.bounced' AND occurred_at>=?").bind(now-14*86400000).first()
  if ((complaints?.n||0)>0 || ((sent?.n||0)>=20 && (bounces?.n||0)*100/(sent.n)>=5)) {
    await pauseOutreach(env,'Quejas o rebotes por encima del umbral')
    return {paused:true,reason:'delivery'}
  }
  const mature=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach_events JOIN outreach ON outreach.id=outreach_events.outreach_id WHERE outreach.id NOT LIKE 'test-%' AND type='email.delivered' AND occurred_at BETWEEN ? AND ?").bind(now-21*86400000,now-7*86400000).first()
  if ((mature?.n||0)>=50) {
    const interested=await env.DB.prepare("SELECT COUNT(DISTINCT outreach_id) AS n FROM outreach_events JOIN outreach ON outreach.id=outreach_events.outreach_id WHERE outreach.id NOT LIKE 'test-%' AND type IN ('email.clicked','page.viewed','cta.clicked') AND occurred_at>=?").bind(now-21*86400000).first()
    const replied=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach WHERE status='replied' AND id NOT LIKE 'test-%' AND updated_at>=?").bind(now-21*86400000).first()
    if (!(interested?.n||0) && !(replied?.n||0)) {
      await pauseOutreach(env,'50 entregados maduros sin clics ni respuestas; revisar asunto, segmentación y propuesta')
      await notifyCatalina(env,'Prospección pausada: sin interés medible','50 propuestas entregadas llevan al menos 7 días sin clics ni respuestas registrados. Revisar fuentes, asunto y propuesta antes de reanudar.').catch(()=>{})
      return {paused:true,reason:'no_engagement'}
    }
  }
  return {paused:false}
}

export async function sendDailyOutreachReport(env, now=Date.now()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(part=>[part.type,part.value]))
  if (Number(parts.hour)!==18 || new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',weekday:'short'}).format(now)!=='Mon') return {due:false}
  const day=parts.year+'-'+parts.month+'-'+parts.day
  const sent=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach WHERE sent_at IS NOT NULL AND id NOT LIKE 'test-%' AND sent_at>=?").bind(now-7*86400000).first()
  if (!(sent?.n||0)) return {due:false}
  const result=await env.DB.prepare("INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)").bind('report-'+day,'system','report.sent',now).run()
  if (!result.meta.changes) return {due:false}
  const stats=await outreachSnapshot(env,now-7*86400000)
  const tracked=!!(await webhookSecret(env))
  const cta=await env.DB.prepare("SELECT COUNT(DISTINCT outreach_id) AS n FROM outreach_events WHERE type='cta.clicked' AND outreach_id NOT LIKE 'test-%' AND occurred_at>=?").bind(now-7*86400000).first()
  const angles=(await env.DB.prepare("SELECT id,name,status FROM outreach_angles ORDER BY status,created_at").all()).results||[]
  const control=await env.DB.prepare('SELECT paused,reason FROM outreach_control WHERE id=1').first()
  const byAngle=await env.DB.prepare("SELECT angle,COUNT(*) AS n,SUM(CASE WHEN status='replied' THEN 1 ELSE 0 END) AS replies FROM outreach WHERE sent_at IS NOT NULL AND id NOT LIKE 'test-%' AND sent_at>=? GROUP BY angle").bind(now-7*86400000).all()
  const lines=[
    'Semana hasta '+day,
    'Enviados: '+stats.sent,
    'Entregados confirmados: '+stats.delivered,
    'Aperturas registradas: '+(tracked?stats.opened:'sin webhook verificado'),
    'Clics registrados: '+(tracked?stats.clicked:'sin webhook verificado'),
    'Visitas a propuesta: '+stats.visited,
    'Quieren hablar con Carolina (clic en el botón): '+(cta?.n||0),
    'Respuestas: '+stats.replied,
    'Rebotes: '+stats.bounced+' · Quejas: '+stats.complained,
    'Estado: '+(control?.paused?'PAUSADO · '+control.reason:(env.OUTREACH_ENABLED==='true'?'activo':'envíos desactivados')),
    'Asuntos por enfoque: '+(byAngle.results||[]).map(x=>x.angle+': '+x.n+' enviados, '+x.replies+' respuestas').join('; '),
    'Enfoques activos: '+angles.filter(a=>a.status==='active').map(a=>a.name).join(', '),
    '',
    'Apertura significa descarga de imagen, no lectura. Visita y clic pueden incluir escáneres. Evalúa principalmente respuestas y reuniones verificadas.'
  ]
  await notifyCatalina(env,'Informe semanal de Carolina · '+day,lines.join('\n'))
  return {sent:true}
}

// Crea (una sola vez) el webhook de Resend desde el servidor y guarda la clave de firma en D1:
// la clave nunca pasa por una pantalla, consola ni repositorio. Elimina webhooks previos al mismo endpoint.
export async function setupResendWebhook(env, endpoint='https://soycatalinajaramillo.com/webhooks/resend') {
  if (!env.RESEND_API_KEY) return {ok:false,reason:'resend_key_missing'}
  if (await webhookSecret(env)) return {ok:true,already:true}
  const auth={authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'}
  const list=await fetch('https://api.resend.com/webhooks',{headers:auth}).catch(()=>null)
  if (!list?.ok) return {ok:false,reason:'resend_list_failed_'+(list?.status||'network')}
  const existing=((await list.json()).data||[]).filter(w=>w.endpoint===endpoint)
  let removed=0
  for (const w of existing) { const d=await fetch('https://api.resend.com/webhooks/'+encodeURIComponent(w.id),{method:'DELETE',headers:auth}).catch(()=>null); if (d?.ok) removed++ }
  const res=await fetch('https://api.resend.com/webhooks',{method:'POST',headers:auth,body:JSON.stringify({endpoint,events:[...allowedEvents]})}).catch(()=>null)
  if (!res?.ok) return {ok:false,reason:'resend_create_failed_'+(res?.status||'network'),removed}
  const created=await res.json()
  if (!created.signing_secret?.startsWith('whsec_')) return {ok:false,reason:'no_signing_secret',removed}
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES ('resend_webhook_secret',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(created.signing_secret,Date.now()).run()
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES ('resend_webhook_id',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(String(created.id),Date.now()).run()
  return {ok:true,webhookId:created.id,removed}
}

// Lista diaria de contacto directo (lun-vie, 8 a. m. Bogotá): negocios que ya recibieron propuesta, ordenados por interés,
// con su teléfono/WhatsApp publicado y un enlace wa.me con el mensaje listo. Catalina revisa y envía cada uno personalmente.
export function whatsappMessage(row) {
  const link = 'https://soycatalinajaramillo.com/propuesta/' + row.id
  return `Hola, equipo de ${row.company}. Soy Catalina Jaramillo. Les escribí por correo con una idea para su atención por WhatsApp y les preparé una demo con sus propios servicios, que pueden probar aquí: ${link}\n¿Les parece si lo conversamos 15 minutos esta semana?`
}
export async function sendDailyContactList(env, now = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]))
  if (['Sat', 'Sun'].includes(parts.weekday) || Number(parts.hour) !== 8) return { due: false }
  const day = parts.year + '-' + parts.month + '-' + parts.day
  const rows = (await env.DB.prepare(`SELECT o.id,o.company,o.subject,o.research,o.dossier,o.sent_at,
      MAX(CASE WHEN e.type IN ('demo.used','cta.clicked','chat.started') THEN 3 WHEN e.type IN ('page.viewed','email.clicked') THEN 2 WHEN e.type='email.opened' THEN 1 ELSE 0 END) AS heat
    FROM outreach o LEFT JOIN outreach_events e ON e.outreach_id=o.id
    WHERE o.status='sent' AND o.id NOT LIKE 'test-%' AND o.sent_at>? GROUP BY o.id ORDER BY heat DESC, o.sent_at DESC LIMIT 40`).bind(now - 10 * 86400000).all()).results || []
  const list = []
  for (const r of rows) {
    let d = {}; try { d = JSON.parse(r.research || '{}') } catch {}
    const phone = (d.phones || [])[0]
    if (!phone) continue
    const contacted = await env.DB.prepare("SELECT 1 FROM outreach_events WHERE outreach_id=? AND type='contact.listed'").bind(r.id).first()
    if (contacted && r.heat < 3) continue
    list.push({ ...r, phone })
    if (list.length >= 15) break
  }
  if (!list.length) return { due: true, sent: false }
  const mark = await env.DB.prepare("INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)").bind('contactlist-' + day, 'system', 'contactlist.sent', now).run()
  if (!mark.meta.changes) return { due: false }
  const heatLabel = ['recibió el correo', 'abrió el correo', 'vio su propuesta', '🔥 probó la demo o pidió hablar']
  const lines = list.map((r, i) => {
    const wa = 'https://wa.me/' + r.phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(whatsappMessage(r))
    return `${i + 1}. ${r.company} — ${heatLabel[r.heat]}\n   Teléfono: ${r.phone}\n   Abrir WhatsApp con el mensaje listo: ${wa}\n   Su propuesta: https://soycatalinajaramillo.com/propuesta/${r.id}`
  })
  for (const r of list) await env.DB.prepare("INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,'contact.listed',?)").bind('listed-' + r.id, r.id, now).run()
  await notifyCatalina(env, `Tu lista de contacto directo de hoy · ${list.length} negocios`, [
    'Negocios que ya recibieron su propuesta de Carolina, ordenados de más a menos interés. Escríbeles tú, uno por uno, desde tu WhatsApp: el enlace abre el chat con el mensaje listo para que lo revises y envíes.',
    'Prioriza los 🔥. Si alguien responde, pásalo al chat de Carolina o agenda directamente.', '', ...lines, '',
    'Consejo: un mensaje personal por negocio, nunca en masa. Si alguien dice que no, respeta y no insistas.'
  ].join('\n'))
  return { due: true, sent: true, count: list.length }
}
