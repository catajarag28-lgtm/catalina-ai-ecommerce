// Hoja de seguimiento de Catalina: cada propuesta y postulación con su estado real (entregado, abierto, clic,
// visita, respuesta). Se sirve como CSV con enlace secreto para conectarlo a Google Sheets con =IMPORTDATA(),
// que se actualiza solo. Los datos salen de los eventos firmados de Resend y del registro de envíos.
const SITE = 'https://soycatalinajaramillo.com'

export async function trackerToken(env) {
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key='tracker_token'").first().catch(() => null)
  if (row?.value) return row.value
  const token = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('')
  await env.DB.prepare("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES ('tracker_token',?,?)").bind(token, Date.now()).run()
  return (await env.DB.prepare("SELECT value FROM app_settings WHERE key='tracker_token'").first()).value
}

const day = ms => ms ? new Date(Number(ms)).toLocaleString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
const yes = n => (Number(n) > 0 ? 'Sí' : 'No')
const STATUS = { sent: 'Enviada', replied: 'Respondió', bounced: 'Rebotó', complained: 'Queja', suppressed: 'Baja', wa_ready: 'WhatsApp listo para enviar', wa_listed: 'WhatsApp enviado a tu lista', form_sent: 'Enviada por su formulario de contacto', external_email_sent: 'Postulación enviada', submitted: 'Postulación enviada (formulario)' }

export async function trackerRows(env) {
  const out = (await env.DB.prepare(`SELECT o.id,o.company,o.email,o.kind,o.segment,o.subject,o.status,o.sent_at,o.updated_at,
      SUM(e.type='email.delivered') delivered, SUM(e.type='email.opened') opened, SUM(e.type='email.clicked') clicked,
      SUM(e.type='page.viewed') viewed, SUM(e.type IN ('chat.started','demo.used','cta.clicked','booking.opened','whatsapp.opened')) engaged,
      SUM(e.type IN ('followup.sent','hot.followup')) followups
    FROM outreach o LEFT JOIN outreach_events e ON e.outreach_id=o.id
    WHERE o.id NOT LIKE 'test-%' AND (o.sent_at IS NOT NULL OR o.status IN ('wa_ready','wa_listed','form_sent'))
    GROUP BY o.id ORDER BY coalesce(o.sent_at,o.updated_at) DESC LIMIT 3000`).all()).results || []
  const rows = out.map(r => ({
    fecha: day(r.sent_at || r.updated_at), tipo: r.status === 'form_sent' ? 'Propuesta formulario web' : r.kind === 'whatsapp' ? 'Propuesta WhatsApp' : r.kind === 'partner' ? 'Propuesta aliado' : 'Propuesta correo',
    empresa: r.company, segmento: r.segment || '', contacto: String(r.email).replace(/^wa:/, 'WhatsApp ').replace(/^form:/, 'Formulario de '), asunto: r.subject || '',
    estado: STATUS[r.status] || r.status, entregado: r.kind === 'whatsapp' ? '' : yes(r.delivered), abrio: r.kind === 'whatsapp' ? '' : yes(r.opened), vecesAbierto: Number(r.opened || 0),
    clic: yes(r.clicked), vioPropuesta: yes(r.viewed), hablóConCarolina: yes(r.engaged), respondio: r.status === 'replied' ? 'Sí' : 'No', seguimientos: Number(r.followups || 0),
    enlace: SITE + '/propuesta/' + r.id,
  }))
  const apps = (await env.DB.prepare(`SELECT source_url,platform,recipient,subject,status,sent_at,updated_at FROM direct_applications
    WHERE status IN ('sent','external_email_sent','replied') ORDER BY coalesce(sent_at,updated_at) DESC LIMIT 2000`).all().catch(() => ({ results: [] }))).results || []
  for (const a of apps) rows.push({ fecha: day(a.sent_at || a.updated_at), tipo: 'Postulación', empresa: a.platform || '', segmento: '', contacto: a.recipient || '', asunto: a.subject || '', estado: STATUS[a.status] || a.status, entregado: '', abrio: '', vecesAbierto: '', clic: '', vioPropuesta: '', hablóConCarolina: '', respondio: a.status === 'replied' ? 'Sí' : 'No', seguimientos: '', enlace: a.source_url })
  const opps = (await env.DB.prepare(`SELECT url,title,company,platform,submitted_at,updated_at FROM opportunities WHERE status='submitted' ORDER BY submitted_at DESC LIMIT 2000`).all().catch(() => ({ results: [] }))).results || []
  for (const o of opps) rows.push({ fecha: day(o.submitted_at || o.updated_at), tipo: 'Postulación', empresa: o.company || '', segmento: o.platform || '', contacto: 'Formulario oficial', asunto: o.title || '', estado: 'Postulación enviada (formulario)', entregado: '', abrio: '', vecesAbierto: '', clic: '', vioPropuesta: '', hablóConCarolina: '', respondio: '', seguimientos: '', enlace: o.url })
  return rows
}

const HEAD = ['Fecha', 'Tipo', 'Empresa', 'Segmento', 'Contacto', 'Asunto / puesto', 'Estado', 'Entregado', 'Abrió', 'Veces abierto', 'Clic', 'Vio propuesta', 'Habló con Carolina', 'Respondió', 'Seguimientos', 'Enlace']
const cell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
export function toCsv(rows) {
  return [HEAD.join(','), ...rows.map(r => Object.values(r).map(cell).join(','))].join('\n')
}

export async function sendTrackerLink(env) {
  const token = await trackerToken(env)
  const csv = `${SITE}/seguimiento.csv?k=${token}`
  const rows = await trackerRows(env)
  const opened = rows.filter(r => r.abrio === 'Sí').length
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#1c1a18;line-height:1.55">
<h1 style="font-size:20px">Tu hoja de seguimiento de Carolina</h1>
<p>Hoy tiene <b>${rows.length}</b> filas (${opened} correos abiertos). Se actualiza sola.</p>
<p><b>Conectarla a Google Sheets (una sola vez):</b></p>
<ol><li>Abre <a href="https://sheets.new">sheets.new</a> (hoja nueva).</li><li>En la celda A1 pega exactamente esto:<br><code style="background:#f5f4f2;padding:6px;display:block;word-break:break-all">=IMPORTDATA("${csv}")</code></li><li>Enter. Google la refresca cada hora.</li></ol>
<p>También puedes <a href="${csv}">descargarla como archivo</a> para Excel.</p>
<p style="font-size:13px;color:#68625b">Este enlace es privado: no lo compartas.</p></div>`
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.EMAIL_FROM, to: [env.CATALINA_EMAIL || env.NOTIFY_TO], subject: 'Carolina · Tu hoja de seguimiento (empresa, contacto, si abrió, si respondió)', html }), signal: AbortSignal.timeout(15000) })
  return { ok: res.ok, rows: rows.length, opened }
}
