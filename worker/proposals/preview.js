// Vista previa para Catalina antes del envío automático: copia exacta de una propuesta real + estructura,
// muestra de postulación, plan diario y mezcla por vertical. Solo se envía a CATALINA_EMAIL.
import { segments } from '../prospecting/discovery.js'

const SITE = 'https://soycatalinajaramillo.com'
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const VERTICAL = { ecommerce: 'Ecommerce / DTC', inmobiliaria: 'Inmobiliarias / real estate', spa: 'Spa, estética y belleza', agencia: 'Agencias (white-label)', servicios: 'Servicios profesionales, SaaS y otros', 'salud-admin': 'Dental y salud (administrativo)' }
export const DAILY_MIX = [['Ecommerce / DTC', 20], ['Inmobiliarias / real estate', 15], ['Spa, estética y belleza', 15], ['Agencias (white-label)', 15], ['SaaS / B2B', 10], ['Servicios profesionales', 10], ['Hospitality', 5], ['Home services', 5], ['Otros por intención', 5]]

async function resend(env, { subject, html, text }) {
  const to = env.CATALINA_EMAIL || env.NOTIFY_TO
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, text }), signal: AbortSignal.timeout(15000) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, id: data.id || null, to }
}

export async function verticalQueue(env) {
  const sector = Object.fromEntries(segments.map(s => [s.id, s.sector]))
  const rows = (await env.DB.prepare("SELECT segment, status, COUNT(*) n FROM outreach WHERE id NOT LIKE 'test-%' GROUP BY 1,2").all()).results || []
  const out = {}
  for (const r of rows) {
    const v = VERTICAL[sector[r.segment]] || (/aliados/.test(r.segment) ? VERTICAL.agencia : /inmobili|realestate/.test(r.segment) ? VERTICAL.inmobiliaria : /spa|estetic|clinic/.test(r.segment) ? VERTICAL.spa : 'Otros')
    out[v] = out[v] || { pending: 0, sent: 0, replied: 0 }
    if (r.status === 'pending') out[v].pending += r.n
    if (r.status === 'sent' || r.status === 'replied') out[v].sent += r.n
    if (r.status === 'replied') out[v].replied += r.n
  }
  return out
}

export async function sendStructurePreview(env) {
  const sample = await env.DB.prepare("SELECT id, company, subject, html FROM outreach WHERE sent_at IS NOT NULL AND html IS NOT NULL AND length(html)>500 AND id NOT LIKE 'test-%' ORDER BY sent_at DESC LIMIT 1").first()
  const app = await env.DB.prepare("SELECT title, company, url, apply_url, score, grade, brief, proposal FROM opportunities WHERE status='prepared' AND grade='A' AND proposal<>'' ORDER BY (apply_url IS NOT NULL) DESC, score DESC LIMIT 1").first()
  const queue = await verticalQueue(env)
  const results = []
  // 1) Copia exacta de una propuesta enviada a una empresa real.
  if (sample) results.push({ type: 'exact_proposal', ...(await resend(env, { subject: '[MUESTRA REAL · así la recibió ' + sample.company + '] ' + sample.subject, html: sample.html, text: 'Copia exacta de la propuesta enviada a ' + sample.company + '. Página web de la propuesta: ' + SITE + '/propuesta/' + sample.id })) })
  // 2) Estructura, muestra de postulación, plan y mezcla por vertical.
  const b = app ? JSON.parse(app.brief || '{}') : {}
  const mixRows = DAILY_MIX.map(([v, n]) => { const q = queue[v === 'SaaS / B2B' || v === 'Servicios profesionales' || v === 'Hospitality' || v === 'Home services' ? 'Servicios profesionales, SaaS y otros' : v] || { pending: 0, sent: 0 }; return `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(v)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${n}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${q.pending}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${q.sent}</td></tr>` }).join('')
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1c1a18;line-height:1.55">
<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7a4f34;margin:0 0 4px">Catalina Jaramillo · AI Automation &amp; Commerce Systems</p>
<h1 style="font-size:22px;margin:0 0 12px">Así trabajará Carolina con el envío automático</h1>
<p>Antes de encender el envío automático, esta es la estructura exacta. En el correo anterior tienes la copia de una propuesta real, tal como la recibió ${esc(sample?.company || 'la empresa')}.</p>
<h2 style="font-size:17px;margin:22px 0 8px">1. Propuesta a empresas (outbound)</h2>
<ol style="padding-left:20px;margin:0"><li><b>Investigación de su web:</b> servicios, canales, herramientas visibles, cómo reciben y atienden clientes. Solo evidencia pública; una cita literal respalda cada observación.</li>
<li><b>Diagnóstico:</b> oportunidades como hipótesis (no se inventan problemas), solución adecuada y el caso real más relevante (Professional Glam, LAURA o CAROLINA).</li>
<li><b>Correo de 80–180 palabras con tu marca:</b> asunto corto (se generan varios y se elige uno), primera frase con una observación de su negocio, idea concreta, micro-prueba y un CTA pequeño ("¿te muestro en 15 minutos cómo lo estructuraría?"). Sin precios.</li>
<li><b>Página web personalizada</b> (${SITE}/propuesta/…): situación, oportunidades, escena de cómo funcionaría, hoja de ruta por etapas, quién es Catalina y una demo en vivo del agente con la información de su negocio.</li>
<li><b>Seguimientos</b> a los 2–3, 4–6 y 7–10 días, cada uno con algo nuevo. Se detienen si responden, dicen no, piden baja, rebota o se cierra la oportunidad.</li>
<li><b>Control de calidad</b> antes de enviar: crítica automática, reescritura si es genérico, verificación de evidencia, idioma y supresión de contactos.</li></ol>
${sample ? `<p><a href="${SITE}/propuesta/${esc(sample.id)}" style="color:#7a4f34">Ver la página web de la propuesta de ${esc(sample.company)}</a></p>` : ''}
<h2 style="font-size:17px;margin:22px 0 8px">2. Postulación a vacantes y proyectos</h2>
${app ? `<p style="margin:0 0 6px"><b>${esc(app.title)}</b> — ${esc(app.company)} · score ${app.score} (${app.grade})${app.apply_url ? ' · se envía por su formulario oficial' : ' · Easy Apply / revisión'}</p>
<p style="margin:0 0 6px;color:#68625b;font-size:14px"><b>Qué buscan:</b> ${esc(b.realNeed || '')}<br><b>Ángulo:</b> ${esc(b.angle || '')}</p>
<div style="white-space:pre-wrap;background:#f5f4f2;border:1px solid #e2ddd6;border-radius:8px;padding:12px;font-size:14px">${esc(app.proposal)}</div>
<p style="font-size:13px;color:#68625b">Se adjunta tu CV en el idioma del aviso. Las preguntas que no se pueden responder con verdad (salario esperado, permisos de trabajo, etc.) no se inventan: esa postulación pasa a tu cola.</p>` : '<p>Aún no hay una postulación A preparada.</p>'}
<h2 style="font-size:17px;margin:22px 0 8px">3. Plan diario y mezcla por industria</h2>
<p style="margin:0 0 8px">Meta: <b>100 propuestas personalizadas al día + postulaciones</b>, repartidas por canal (correo, formularios, LinkedIn, agencias) para no quemar tu dominio. La mezcla se ajusta sola según respuestas, reuniones y contratos.</p>
<table style="border-collapse:collapse;width:100%;font-size:14px"><tr style="text-align:left;color:#68625b"><th style="padding:6px 10px">Industria</th><th style="padding:6px 10px;text-align:right">Meta/día</th><th style="padding:6px 10px;text-align:right">En cola hoy</th><th style="padding:6px 10px;text-align:right">Enviadas</th></tr>${mixRows}</table>
<h2 style="font-size:17px;margin:22px 0 8px">4. Frenos de seguridad que siguen activos</h2>
<ul style="padding-left:20px;margin:0"><li>Freno de entregabilidad: si rebotan más del 5% en 7 días o hay una queja de spam, el correo frío se pausa solo.</li><li>Nunca se paga, ni se resuelven CAPTCHAs o verificaciones por ti: esos casos quedan como "acción humana".</li><li>Solo oportunidades A/B consumen IA y se envían; las C se descartan.</li><li>El intérprete en vivo no se menciona hasta que tenga su clave y pase la prueba real.</li></ul>
<p style="margin-top:22px">Si quieres cambiar algo de la estructura, respóndeme por el chat de Claude.</p>
<p style="font-size:13px;color:#68625b;margin-top:18px">Carolina · Agente de IA de Catalina Jaramillo · <a href="${SITE}" style="color:#7a4f34">soycatalinajaramillo.com</a></p></div>`
  const text = 'Así trabajará Carolina con el envío automático: investigación → diagnóstico → correo con marca de 80–180 palabras → página web personalizada → 3 seguimientos → control de calidad. Muestra de postulación: ' + (app ? app.title + ' — ' + app.company : 'n/d') + '. Meta: 100 propuestas al día más postulaciones.'
  results.push({ type: 'structure', ...(await resend(env, { subject: 'Carolina · Así se verán tus propuestas y postulaciones antes del envío automático', html, text })) })
  return { results, queue }
}
