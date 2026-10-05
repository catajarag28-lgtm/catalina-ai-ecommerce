import { notifyCatalina } from '../core/notify.js'
import { buildRevenuePlan, manualApplicationQueue } from '../core/revenueOS.js'
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
  const control=await env.DB.prepare('SELECT paused,reason,updated_at FROM outreach_control WHERE id=1').first()
  const complaints=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach_events JOIN outreach ON outreach.id=outreach_events.outreach_id WHERE outreach.id NOT LIKE 'test-%' AND type='email.complained' AND occurred_at>=?").bind(now-14*86400000).first()
  if (control?.paused) {
    // Una pausa por rebotes no puede quedar eterna sin aviso: tras 72 h sin quejas se reanuda sola.
    // Las quejas de spam y las pausas por falta de interés siguen requiriendo revisión humana.
    const bouncePause=/^Quejas o rebotes/.test(control.reason||'')
    if (!bouncePause || (complaints?.n||0)>0 || now-Number(control.updated_at||now)<72*3600000) return {paused:true,reason:control.reason}
    await env.DB.prepare('UPDATE outreach_control SET paused=0,reason=?,updated_at=? WHERE id=1').bind('Reanudada tras 72 h sin quejas',now).run()
    await notifyCatalina(env,'Prospección reanudada','La pausa por rebotes cumplió 72 h sin quejas de spam. Carolina reanuda los correos nuevos; los rebotados quedaron suprimidos y la regla vigila 7 días móviles.').catch(()=>{})
  }
  // Ventana de 7 días y muestra mínima: con 20 envíos, un solo rebote (5%) no debe detener la máquina.
  const sent=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach WHERE sent_at IS NOT NULL AND id NOT LIKE 'test-%' AND sent_at>=?").bind(now-7*86400000).first()
  const bounces=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach_events JOIN outreach ON outreach.id=outreach_events.outreach_id WHERE outreach.id NOT LIKE 'test-%' AND type='email.bounced' AND occurred_at>=?").bind(now-7*86400000).first()
  const bounces24=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach_events JOIN outreach ON outreach.id=outreach_events.outreach_id WHERE outreach.id NOT LIKE 'test-%' AND type='email.bounced' AND occurred_at>=?").bind(now-86400000).first()
  if ((complaints?.n||0)>0 || (bounces24?.n||0)>=3 || ((sent?.n||0)>=30 && (bounces?.n||0)*100/(sent.n)>=5)) {
    await pauseOutreach(env,'Quejas o rebotes por encima del umbral seguro (5% en 7 días o 3 en 24 h)')
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
  if (Number(parts.hour)!==18) return {due:false}
  const day=parts.year+'-'+parts.month+'-'+parts.day
  const start=new Date(day+'T00:00:00-05:00').getTime()
  const result=await env.DB.prepare("INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)").bind('daily-report-'+day,'system','report.sent',now).run()
  if (!result.meta.changes) return {due:false}

  const stats=await outreachSnapshot(env,start)
  const tracked=!!(await webhookSecret(env))
  const cta=await env.DB.prepare("SELECT COUNT(DISTINCT outreach_id) AS n FROM outreach_events WHERE type='cta.clicked' AND outreach_id NOT LIKE 'test-%' AND occurred_at>=?").bind(start).first()
  const chats=await env.DB.prepare("SELECT COUNT(DISTINCT outreach_id) AS n FROM outreach_events WHERE type='chat.started' AND outreach_id NOT LIKE 'test-%' AND occurred_at>=?").bind(start).first()
  const bookings=await env.DB.prepare("SELECT COUNT(DISTINCT outreach_id) AS n FROM outreach_events WHERE type='booking.opened' AND outreach_id NOT LIKE 'test-%' AND occurred_at>=?").bind(start).first()
  const meetings=await env.DB.prepare("SELECT COUNT(*) AS n FROM meetings WHERE created_at>=?").bind(start).first().catch(()=>({n:0}))
  const control=await env.DB.prepare('SELECT paused,reason FROM outreach_control WHERE id=1').first()
  const revenuePlan=await buildRevenuePlan(env,now).catch(()=>null)
  const manualQueue=await manualApplicationQueue(env,now).catch(()=>[])
  const partnerSent=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach WHERE kind='partner' AND sent_at>=?").bind(start).first().catch(()=>({n:0}))
  const followups=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach_events WHERE type IN ('followup.sent','hot.followup') AND occurred_at>=?").bind(start).first().catch(()=>({n:0}))
  const partnerPending=await env.DB.prepare("SELECT COUNT(*) AS n FROM outreach WHERE kind='partner' AND status='pending'").first().catch(()=>({n:0}))

  const sentRows=(await env.DB.prepare("SELECT id,company,email,subject,status,sent_at FROM outreach WHERE sent_at>=? AND id NOT LIKE 'test-%' ORDER BY sent_at DESC LIMIT 40").bind(start).all()).results||[]
  const proposals=sentRows.map((x,i)=>[
    `${i+1}. ${x.company}`,
    `   Estado: ${x.status}`,
    `   Email: ${x.email}`,
    `   Asunto: ${x.subject}`,
    `   Propuesta: https://soycatalinajaramillo.com/propuesta/${x.id}`,
  ].join('\n'))

  let intent=[]
  try { intent=(await env.DB.prepare("SELECT platform,who,need,fit,status,url,reply FROM intent_leads WHERE found_at>=? ORDER BY found_at DESC LIMIT 30").bind(start).all()).results||[] } catch {}
  let market=[]
  try { market=(await env.DB.prepare("SELECT platform,title,status,amount,currency,url,proposal,provider_id,error FROM marketplace_submissions WHERE created_at>=? ORDER BY created_at DESC LIMIT 30").bind(start).all()).results||[] } catch {}
  let directApps=[]
  try { directApps=(await env.DB.prepare("SELECT platform,recipient,subject,status,provider_id,source_url,error FROM direct_applications WHERE created_at>=? ORDER BY created_at DESC LIMIT 40").bind(start).all()).results||[] } catch {}

  const directSent=directApps.filter(x=>['sent','external_email_sent'].includes(x.status)&&x.provider_id).length
  const marketplaceSubmitted=market.filter(x=>x.status==='submitted'&&x.provider_id).length
  const directLines=directApps.length?directApps.map((x,i)=>[
    `${i+1}. ${String(x.platform||'WEB').toUpperCase()} · ${x.subject||x.source_url||''}`,
    `   Estado REAL: ${x.status}${x.provider_id?' · ID confirmado: '+x.provider_id:''}`,
    x.recipient?`   Destino: ${x.recipient}`:null,
    x.source_url?`   Fuente: ${x.source_url}`:null,
    x.error?`   Nota: ${String(x.error).slice(0,300)}`:null,
  ].filter(Boolean).join('\n')):['Ninguna aplicación directa registrada hoy.']

  const marketplaceLines=market.length?market.map((x,i)=>[
    `${i+1}. ${String(x.platform||'').toUpperCase()} · ${x.title||''}`,
    `   Estado REAL: ${x.status}${x.provider_id?' · ID confirmado: '+x.provider_id:''}`,
    x.amount?`   Oferta: ${x.currency||''} ${x.amount}`:null,
    x.url?`   Enlace: ${x.url}`:null,
    x.proposal?`   Texto enviado/borrador: ${String(x.proposal).slice(0,1200)}`:null,
    x.error?`   Nota: ${String(x.error).slice(0,300)}`:null,
  ].filter(Boolean).join('\n')):['Ninguna postulación de marketplace registrada hoy.']

  const intentLines=intent.length?intent.map((x,i)=>[
    `${i+1}. ${String(x.platform||'').toUpperCase()} · ${x.fit||''} · estado ${x.status||'new'}`,
    `   Quién: ${x.who||'s/d'}`,
    `   Busca: ${x.need||''}`,
    `   Enlace: ${x.url||''}`,
    `   Borrador: ${String(x.reply||'').slice(0,900)}`,
  ].join('\n')):['Ninguna oportunidad por intención encontrada hoy.']

  const manualLines=manualQueue.length?manualQueue.slice(0,15).map((x,i)=>[
    `${i+1}. ${String(x.platform||'').toUpperCase()} · ${x.project||''}`,
    `   Estado: ${x.status} · ruta ${x.route}`,
    `   Link: ${x.url}`,
    `   CV: ${x.cv}`,
    `   Perfil: ${x.visualProfile}`,
    x.proposal?`   Propuesta lista: ${String(x.proposal).slice(0,850)}`:null,
  ].filter(Boolean).join('\n')):['No hay postulaciones manuales pendientes.']

  const revenueLines=revenuePlan?[
    `Meta de acciones calificadas: ${revenuePlan.targetQualifiedActions}`,
    `Cold outreach pausado: ${revenuePlan.coldOutreachPaused?'SÍ':'NO'}${revenuePlan.pauseReason?' · '+revenuePlan.pauseReason:''}`,
    `Objetivos actuales: outbound ${revenuePlan.targets.outbound} · directas ${revenuePlan.targets.directApplications} · marketplaces ${revenuePlan.targets.marketplaces} · intent ${revenuePlan.targets.intent} · partners ${revenuePlan.targets.partners} · ABM ${revenuePlan.targets.abm} · follow-ups ${revenuePlan.targets.followups}`,
    `Ejecutado 24h: outbound ${revenuePlan.actual.outbound} · directas ${revenuePlan.actual.directApplications} · marketplaces ${revenuePlan.actual.marketplaces} · intent ${revenuePlan.actual.intent} · partners ${revenuePlan.actual.partners} · follow-ups ${revenuePlan.actual.followups}`,
  ]:['Plan de redistribución no disponible.']

  const lines=[
    'CAROLINA · REPORTE DIARIO DE ADQUISICIÓN · '+day,
    '',
    'EMAIL OUTBOUND · COLD OUTREACH',
    'Correos fríos nuevos enviados: '+stats.sent,
    'Entregadas confirmadas: '+stats.delivered,
    'Aperturas registradas: '+(tracked?stats.opened:'sin webhook verificado'),
    'Clics registrados: '+(tracked?stats.clicked:'sin webhook verificado'),
    'Visitas a propuesta: '+stats.visited,
    'Clic en Hablar con Carolina: '+(cta?.n||0),
    'Conversaciones iniciadas con Carolina: '+(chats?.n||0),
    'Abrieron página de agenda (NO es cita): '+(bookings?.n||0),
    'Citas reales confirmadas en calendario: '+(meetings?.n||0),
    'Respuestas por email: '+stats.replied,
    'Rebotes: '+stats.bounced+' · Quejas: '+stats.complained,
    'Estado outreach: '+(control?.paused?'PAUSADO · '+control.reason:(env.OUTREACH_ENABLED==='true'?'ACTIVO':'DESACTIVADO')),
    '',
    'REVENUE BALANCER · REDISTRIBUCIÓN DE CAPACIDAD',
    ...revenueLines,
    '',
    'PARTNERS / WHITE-LABEL',
    'Partners enviados hoy: '+(partnerSent?.n||0),
    'Partners preparados en cola: '+(partnerPending?.n||0),
    '',
    'FOLLOW-UPS',
    'Seguimientos enviados hoy: '+(followups?.n||0),
    '',
    'COLD OUTREACH · PROPUESTAS COMERCIALES',
    ...(proposals.length?proposals:['Ninguna propuesta comercial fría nueva enviada hoy.']),
    '',
    'DIRECT APPLICATIONS · POSTULACIONES POR EMAIL',
    'Enviadas reales con provider_id: '+directSent,
    ...directLines,
    '',
    'MARKETPLACES · POSTULACIONES REALES',
    'Enviadas reales con provider_id: '+marketplaceSubmitted,
    ...marketplaceLines,
    '',
    'POSTULACIONES MANUALES PENDIENTES',
    'Requieren acción humana dentro de plataforma: '+manualQueue.length,
    ...manualLines,
    '',
    'OPORTUNIDADES ENCONTRADAS · TODAVÍA NO EQUIVALEN A POSTULACIÓN',
    ...intentLines,
    '',
    'Regla: found/new = solo encontrada; submitted + provider_id = realmente enviada por API; replied = respuesta recibida.',
  ]
  await notifyCatalina(env,'Carolina · reporte diario de adquisición · '+day,lines.join('\n'))
  return {sent:true,emailSent:stats.sent,marketplace:market.length,intent:intent.length}
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

// Dream Accounts diarios: Carolina elige hasta 10 cuentas que ya recibieron una propuesta,
// prepara contacto multicanal y, para las 5 primeras, un guion de video personalizado.
// Los DMs fríos y WhatsApp se dejan listos para revisión/envío humano; no se automatizan contra reglas de plataforma.
export function whatsappMessage(row, d={}) {
  const link = 'https://soycatalinajaramillo.com/propuesta/' + row.id
  const who = d.contactName ? d.contactName.split(/\s+/)[0] : 'equipo de ' + row.company
  const idea = d.hypothesis || d.observation || 'preparé una idea específica después de revisar su negocio'
  return `Hola ${who}. Soy Catalina Jaramillo. Les envié una propuesta porque ${idea.charAt(0).toLowerCase()+idea.slice(1)}. Preparé una demostración específica para ${row.company}: ${link}\nSi esto sí ocurre en su operación, con gusto lo conversamos 15 minutos.`
}
export function instagramDmDraft(row, d={}) {
  const who = d.contactName ? d.contactName.split(/\s+/)[0] : ''
  const opening = who ? `Hola ${who},` : `Hola, equipo de ${row.company},`
  const observed = String(d.observation || '').replace(/\s+/g,' ').trim()
  return [opening, observed ? `vi que ${observed.charAt(0).toLowerCase()+observed.slice(1)}` : 'estuve revisando su negocio y preparé algo específico para ustedes.', 'Me quedó una pregunta sobre un punto del recorrido de sus clientes y armé una simulación para mostrar cómo podría resolverse.', '¿Te la puedo compartir?'].join(' ')
}
export function videoScript(row, d={}) {
  const observed = String(d.observation || 'revisé cómo funciona hoy una parte de su recorrido comercial').replace(/\s+/g,' ').trim()
  const hypothesis = String(d.hypothesis || 'hay un punto que podría ganar continuidad sin cargar más al equipo').replace(/\s+/g,' ').trim()
  const link = 'https://soycatalinajaramillo.com/propuesta/' + row.id
  return `Hola, soy Catalina. Estuve revisando ${row.company}. ${observed} Me quedó esta pregunta: ${hypothesis} Por eso preparé una demostración usando únicamente información pública de su negocio para que puedan ver la idea antes de hablar conmigo. No es una presentación genérica. Pueden verla aquí: ${link}. Si la situación sí ocurre en su operación, Carolina les ayuda a validar en pocos minutos si vale la pena implementarlo.`
}

export async function sendDailyContactList(env, now = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]))
  if (['Sat', 'Sun'].includes(parts.weekday) || Number(parts.hour) !== 8) return { due: false }
  const day = parts.year + '-' + parts.month + '-' + parts.day
  const rows = (await env.DB.prepare(`SELECT o.id,o.company,o.email,o.website,o.subject,o.research,o.dossier,o.sent_at,
      MAX(CASE WHEN e.type IN ('demo.used','cta.clicked','chat.started','booking.opened') THEN 4 WHEN e.type IN ('page.viewed','email.clicked') THEN 3 WHEN e.type='email.opened' THEN 1 ELSE 0 END) AS heat
    FROM outreach o LEFT JOIN outreach_events e ON e.outreach_id=o.id
    WHERE o.status='sent' AND o.id NOT LIKE 'test-%' AND o.sent_at>? GROUP BY o.id ORDER BY heat DESC, o.sent_at DESC LIMIT 50`).bind(now - 10 * 86400000).all()).results || []
  const list = []
  for (const r of rows) {
    let d = {}; try { d = JSON.parse(r.research || '{}') } catch {}
    const contacted = await env.DB.prepare("SELECT 1 FROM outreach_events WHERE outreach_id=? AND type='contact.listed'").bind(r.id).first()
    if (contacted && Number(r.heat||0) < 3) continue
    const socials = Array.isArray(d.socialLinks) ? d.socialLinks : []
    const instagram = socials.find(x => /instagram\.com/i.test(x)) || ''
    const linkedin = socials.find(x => /linkedin\.com/i.test(x)) || ''
    const phone = (d.phones || [])[0] || ''
    list.push({ ...r, d, phone, instagram, linkedin })
    if (list.length >= 10) break
  }
  if (!list.length) return { due: true, sent: false }
  const mark = await env.DB.prepare("INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)").bind('contactlist-' + day, 'system', 'contactlist.sent', now).run()
  if (!mark.meta.changes) return { due: false }

  const heatLabel = ['propuesta enviada', 'abrió el correo', 'interacción leve', 'visitó propuesta', 'señal de interés registrada']
  const lines = list.map((r, i) => {
    const wa = ''
    const dm = ''
    const video = ''
    return [
      `${i + 1}. ${r.company} — ${heatLabel[Math.min(4,Number(r.heat||0))]}`,
      r.d.contactName ? `   Decisor público: ${r.d.contactName}${r.d.contactRole ? ' · '+r.d.contactRole : ''}` : '   Decisor público: no identificado',
      `   Email: ${r.email}`,
      r.phone ? `   Teléfono/WhatsApp: ${r.phone}` : null,
      r.instagram ? `   Instagram: ${r.instagram}` : null,
      r.linkedin ? `   LinkedIn: ${r.linkedin}` : null,
      null,
      `   Propuesta: https://soycatalinajaramillo.com/propuesta/${r.id}`,
      null,
      null,
    ].filter(Boolean).join('\n')
  })

  for (const r of list) await env.DB.prepare("INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?, 'contact.listed',?)").bind('listed-' + r.id, r.id, now).run()
  await notifyCatalina(env, `🔥 Dream Accounts de hoy · ${list.length} cuentas`, [
    'Carolina ya gestionó estas cuentas por email y muestra la señal exacta registrada.',
    'No hay videos, DMs ni tareas manuales en este reporte. El siguiente paso es automático por email.',
    'Si responden por Instagram y la API oficial está conectada, Carolina puede continuar automáticamente después de que ellos hayan iniciado/resuelto la conversación.', '', ...lines,
  ].join('\n')).catch(() => {})
  return { due: true, sent: true, count: list.length, videos: 0 }
}
