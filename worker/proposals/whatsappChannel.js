// Canal WhatsApp: empresas que no publican correo pero sí WhatsApp.
// Carolina investiga y prepara SOLO un first-touch corto para validar el problema; no manda la propuesta completa en frío.
// El primer mensaje lo envía Catalina desde su WhatsApp con un toque: no se automatiza contra las reglas de la plataforma.
import { researchBusiness, automationVisible } from '../core/integrations.js'
import { prepareFirstTouch, renderFirstTouchHtml } from './outreach.js'

const SITE = 'https://soycatalinajaramillo.com'
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstSentence = (t, max = 170) => { const s = String(t || '').split(/(?<=[.!?])\s+/)[0] || ''; return s.length > max ? s.slice(0, max).replace(/\s+\S*$/, '') + '…' : s }

// Mensaje corto y humano: primero valida el problema; no manda propuesta ni precio en frío.
export function whatsappOpener(row, p = {}) {
  const ft = p.firstTouch || p
  const who = ft.contactName ? ft.contactName.split(/\s+/)[0] : ''
  const obs = firstSentence(ft.observation)
  const ask = firstSentence(ft.hypothesis, 190)
  return [
    who ? `Hola, ${who}. ¿Cómo estás?` : `Hola, ¿hablo con ${row.company}?`,
    `Soy Catalina Jaramillo. ${obs}`,
    ask,
    'Si te sirve, te muestro en 15 minutos cómo comprobar ese punto en el flujo actual y qué parte tendría sentido automatizar.',
    '¿Te lo muestro?',
  ].filter(Boolean).join('\n\n')
}

// LinkedIn: conexión breve y follow-up de diagnóstico. Nada de propuesta completa en frío.
export function linkedinNote(row, p = {}) {
  const ft = p.firstTouch || p
  const who = ft.contactName ? ft.contactName.split(/\s+/)[0] : ''
  const obs = firstSentence(ft.observation, 125)
  const ask = firstSentence(ft.hypothesis, 180)
  let note = `Hola${who ? ' ' + who : ''}, soy Catalina Jaramillo. Vi que ${obs.replace(/^vi que\s+/i, '')} Trabajo en automatización de atención y ventas. ¿Te parece conectar para compartir una idea concreta?`
  if (note.length > 300) note = `Hola${who ? ' ' + who : ''}, soy Catalina Jaramillo. Vi el sitio de ${row.company}. Trabajo en automatización de atención y ventas. ¿Te parece conectar?`
  const followup = `Gracias por conectar${who ? ', ' + who : ''}. En ${row.company} vi esto: ${obs}

Quería preguntarte: ${ask}

Si es una prioridad ahora, puedo mostrarte en 15 minutos un esquema concreto para comprobarlo y decidir si conviene automatizarlo. ¿Te interesaría verlo?`
  const search = 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(row.company + ' (fundador OR CEO OR gerente OR director OR dueño)')
  return { note: note.slice(0, 300), followup, search }
}
export async function runWhatsappProposals(env, { limit = 1, now = Date.now() } = {}) {
  const cap = Number(env.WHATSAPP_DAILY_PREP || 25)
  const done = (await env.DB.prepare("SELECT COUNT(*) n FROM outreach WHERE kind='whatsapp' AND status IN ('wa_ready','wa_listed') AND updated_at>?").bind(now - 86400000).first())?.n || 0
  if (done >= cap) return { reason: 'daily_cap', done }
  const rows = (await env.DB.prepare("SELECT * FROM outreach WHERE kind='whatsapp' AND status='wa_pending' ORDER BY (json_extract(dossier,'$.sector')='ecommerce') DESC, (segment LIKE 'senal-%') DESC, created_at LIMIT ?").bind(limit).all()).results || []
  const out = []
  for (const row of rows) {
    const claimed = await env.DB.prepare("UPDATE outreach SET status='wa_researching',updated_at=? WHERE id=? AND status='wa_pending'").bind(Date.now(), row.id).run()
    if (!claimed.meta.changes) continue
    try {
      const research = await researchBusiness(row.website, env)
      if (!research.ok || research.publicText.length < 300) throw new Error('website_unavailable')
      if (automationVisible(research.signals)) throw new Error('low_fit: ya tiene automatización visible')
      const firstTouch = await prepareFirstTouch(env, row, research)
      let dossier = {}; try { dossier = JSON.parse(row.dossier || '{}') } catch {}
      firstTouch.contactName = typeof dossier.decisionMaker === 'string' ? dossier.decisionMaker.trim().slice(0, 120) : ''
      firstTouch.contactRole = typeof dossier.role === 'string' ? dossier.role.trim().slice(0, 120) : ''
      const subject = String(firstTouch.subject).replace(/[\r\n]/g, ' ').trim().slice(0, 62)
      const html = renderFirstTouchHtml(row, firstTouch, env.SENDER_POSTAL_ADDRESS || '')
      await env.DB.prepare("UPDATE outreach SET research=?,subject=?,html=?,angle='diagnosis-first',status='wa_ready',error=NULL,updated_at=? WHERE id=?")
        .bind(JSON.stringify({ source: research.source, signals: research.signals, pages: research.pages, phones: research.publicPhones || [], socialLinks: research.socialLinks || [], logo: research.logo || '', publicText: String(research.publicText || '').slice(0, 7000), firstTouch }), subject, html, Date.now(), row.id).run()
      out.push({ id: row.id, company: row.company, ready: true, mode: 'first_touch' })
    } catch (e) {
      const skip = /^low_fit/.test(e.message)
      await env.DB.prepare('UPDATE outreach SET status=?,error=?,updated_at=? WHERE id=?').bind(skip ? 'skipped' : 'wa_review', e.message.slice(0, 400), Date.now(), row.id).run()
      out.push({ id: row.id, company: row.company, ready: false, reason: e.message.slice(0, 120) })
    }
  }
  return { prepared: out }
}

// Lista diaria (8 a. m. y 2 p. m. hora Colombia, días hábiles) a Catalina: cada fila trae el botón que abre
// WhatsApp con el mensaje listo. Ella solo revisa y toca enviar.
export async function sendWhatsappList(env, now = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]))
  const hour = Number(parts.hour)
  if (['Sat', 'Sun'].includes(parts.weekday) || ![8, 14].includes(hour)) return { due: false }
  const rows = (await env.DB.prepare("SELECT * FROM outreach o WHERE kind='whatsapp' AND status='wa_ready' AND email LIKE 'wa:%' AND EXISTS (SELECT 1 FROM outreach_events e WHERE e.outreach_id=o.id AND e.type='form.unavailable') ORDER BY (json_extract(dossier,'$.sector')='ecommerce') DESC, (segment LIKE 'senal-%') DESC, updated_at LIMIT 15").all()).results || []
  if (!rows.length) return { due: true, sent: false }
  const key = 'walist-' + parts.year + parts.month + parts.day + '-' + hour
  const mark = await env.DB.prepare('INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)').bind(key, 'system', 'walist.sent', now).run()
  if (!mark.meta.changes) return { due: false }
  const cards = rows.map((r, i) => {
    let p = {}; try { p = JSON.parse(r.research || '{}') } catch {}
    const phone = String(r.email).replace(/^wa:/, '').replace(/\D/g, '')
    const msg = whatsappOpener(r, p)
    const li = linkedinNote(r, p)
    const vacante = /"vacante"/.test(r.dossier || '') ? (() => { try { return JSON.parse(r.dossier).directorio?.vacante } catch { return '' } })() : ''
    return `<div style="border:1px solid #e2ddd6;border-radius:10px;padding:14px;margin:0 0 14px">
<p style="margin:0 0 4px;font-weight:bold">${i + 1}. ${esc(r.company)}</p>
<p style="margin:0 0 8px;font-size:13px;color:#68625b">${esc(r.website)}${vacante ? ' · 🔥 Está contratando: ' + esc(vacante) : ''}</p>
<div style="white-space:pre-wrap;background:#f5f4f2;border-radius:8px;padding:10px;font-size:14px">${esc(msg)}</div>
<p style="margin:10px 0 0"><a href="https://wa.me/${phone}?text=${encodeURIComponent(msg)}" style="background:#1f7a4d;color:#fff;text-decoration:none;padding:9px 14px;border-radius:8px;font-weight:bold">Abrir WhatsApp con el mensaje</a></p>
<details style="margin-top:10px"><summary style="cursor:pointer;color:#0a66c2;font-weight:bold">También por LinkedIn</summary><p style="margin:8px 0 4px;font-size:13px"><a href="${li.search}" style="color:#0a66c2">Buscar al dueño o gerente en LinkedIn</a> · Nota de conexión:</p><div style="white-space:pre-wrap;background:#eef3f8;border-radius:8px;padding:8px;font-size:13px">${esc(li.note)}</div><p style="margin:8px 0 4px;font-size:13px">Cuando acepte:</p><div style="white-space:pre-wrap;background:#eef3f8;border-radius:8px;padding:8px;font-size:13px">${esc(li.followup)}</div></details></div>`
  }).join('')
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1c1a18;line-height:1.5">
<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7a4f34;margin:0 0 4px">Carolina · Lista de WhatsApp</p>
<h1 style="font-size:20px;margin:0 0 8px">${rows.length} empresas listas para escribirles hoy</h1>
<p style="margin:0 0 16px">No publican correo, solo WhatsApp. Cada una ya tiene un primer contacto personalizado para validar una fricción real. Toca el botón, revisa el mensaje y envíalo. Si responden con interés, Carolina continúa el diagnóstico antes de preparar una propuesta.</p>
${cards}</div>`
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.EMAIL_FROM, to: [env.CATALINA_EMAIL || env.NOTIFY_TO], subject: `WhatsApp de hoy: ${rows.length} empresas listas (${rows.slice(0, 3).map(r => r.company).join(', ')}…)`.slice(0, 180), html }), signal: AbortSignal.timeout(15000) })
  if (!res.ok) return { due: true, sent: false, reason: 'email_failed' }
  for (const r of rows) {
    await env.DB.prepare("UPDATE outreach SET status='wa_listed',updated_at=? WHERE id=? AND status='wa_ready'").bind(now, r.id).run()
    await env.DB.prepare('INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)').bind('walisted-' + r.id, r.id, 'wa.listed', now).run()
  }
  return { due: true, sent: true, count: rows.length }
}

// Envío automático por el formulario de contacto de su web, firmado por Catalina (las respuestas llegan a clientes@
// y a su WhatsApp). Si el formulario no se puede usar (CAPTCHA, campos desconocidos), la empresa queda para WhatsApp.
export function contactFormMessage(row, p = {}) {
  const ft = p.firstTouch || p
  const who = ft.contactName ? 'Hola, ' + ft.contactName.split(/\s+/)[0] + ':' : `Hola, equipo de ${row.company}:`
  return [who, firstSentence(ft.observation, 220), firstSentence(ft.hypothesis, 220),
    'Si les sirve, en 15 minutos puedo mostrarles cómo comprobar ese punto en su flujo actual y qué parte tendría sentido automatizar.',
    '¿Les sirve verlo?',
    'Catalina Jaramillo\nAI Automation & Commerce Systems\nsoycatalinajaramillo.com'].filter(Boolean).join('\n\n')
}

export async function runContactForms(env, { limit = 2, now = Date.now() } = {}) {
  const cap = Number(env.CONTACT_FORM_DAILY_LIMIT || 30)
  const done = (await env.DB.prepare("SELECT COUNT(*) n FROM outreach_events WHERE type='form.sent' AND occurred_at>?").bind(now - 86400000).first())?.n || 0
  if (done >= cap) return { reason: 'daily_cap', done }
  const rows = (await env.DB.prepare(`SELECT o.* FROM outreach o WHERE o.kind='whatsapp' AND o.status='wa_ready'
    AND NOT EXISTS (SELECT 1 FROM outreach_events e WHERE e.outreach_id=o.id AND e.type IN ('form.sent','form.unavailable'))
    ORDER BY (json_extract(o.dossier,'$.sector')='ecommerce') DESC, (o.segment LIKE 'senal-%') DESC, o.updated_at LIMIT ?`).bind(limit).all()).results || []
  const { submitContactForm } = await import('../core/browserSessions.js')
  const out = []
  for (const row of rows) {
    let p = {}; try { p = JSON.parse(row.research || '{}') } catch {}
    const pages = Array.isArray(p.pages) ? p.pages : []
    const url = pages.find(u => /contact|contacto/i.test(u)) || p.source || row.website
    const r = await submitContactForm(env, { url, name: 'Catalina Jaramillo', email: 'clientes@soycatalinajaramillo.com', phone: env.CATALINA_WHATSAPP || '', company: row.company, subject: `Una idea para ${row.company}`, message: contactFormMessage(row, p) })
    const sent = r.status === 'submitted'
    await env.DB.prepare('INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)').bind((sent ? 'formsent-' : 'formna-') + row.id, row.id, sent ? 'form.sent' : 'form.unavailable', Date.now()).run()
    if (sent) await env.DB.prepare("UPDATE outreach SET status='form_sent',error=NULL,updated_at=? WHERE id=?").bind(Date.now(), row.id).run()
    else await env.DB.prepare('UPDATE outreach SET error=?,updated_at=? WHERE id=?').bind(('contact_form: ' + r.status + (r.fields ? ' ' + r.fields.join('|') : '')).slice(0, 300), Date.now(), row.id).run()
    out.push({ company: row.company, status: r.status })
  }
  return { tried: out.length, results: out }
}
