// Canal WhatsApp: empresas que no publican correo pero sí WhatsApp (la mayoría de pymes que atienden a mano).
// Carolina investiga y prepara la propuesta completa (misma calidad y página que el correo); el primer mensaje
// lo envía Catalina desde su WhatsApp con un toque: no se automatiza contra las reglas de la plataforma.
import { researchBusiness, automationVisible } from '../core/integrations.js'
import { pickAngle } from './creative.js'
import { prepare } from './outreach.js'
import { brandedProposal } from './proposalPage.js'
import { schedulingUrl } from '../skills/salesStrategy.js'

const SITE = 'https://soycatalinajaramillo.com'
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const firstSentence = (t, max = 170) => { const s = String(t || '').split(/(?<=[.!?])\s+/)[0] || ''; return s.length > max ? s.slice(0, max).replace(/\s+\S*$/, '') + '…' : s }

// Mensaje corto y humano: saludo, una observación concreta, la pregunta comercial y el enlace. Sin jerga de IA.
export function whatsappOpener(row, p = {}) {
  const who = p.contactName ? p.contactName.split(/\s+/)[0] : ''
  const obs = firstSentence(p.observation)
  const ask = firstSentence(p.hypothesis, 190)
  return [
    who ? `Hola, ${who}. ¿Cómo estás?` : `Hola, ¿hablo con ${row.company}?`,
    `Soy Catalina Jaramillo. ${obs}`,
    ask,
    `Les preparé una idea concreta solo para ${row.company}, aquí la pueden ver: ${SITE}/propuesta/${row.id}`,
    '¿Con quién del equipo lo puedo conversar?',
  ].filter(Boolean).join('\n\n')
}

export async function runWhatsappProposals(env, { limit = 1, now = Date.now() } = {}) {
  const cap = Number(env.WHATSAPP_DAILY_PREP || 25)
  const done = (await env.DB.prepare("SELECT COUNT(*) n FROM outreach WHERE kind='whatsapp' AND status IN ('wa_ready','wa_listed') AND updated_at>?").bind(now - 86400000).first())?.n || 0
  if (done >= cap) return { reason: 'daily_cap', done }
  const rows = (await env.DB.prepare("SELECT * FROM outreach WHERE kind='whatsapp' AND status='wa_pending' ORDER BY (segment LIKE 'senal-%') DESC, created_at LIMIT ?").bind(limit).all()).results || []
  const out = []
  for (const row of rows) {
    const claimed = await env.DB.prepare("UPDATE outreach SET status='wa_researching',updated_at=? WHERE id=? AND status='wa_pending'").bind(Date.now(), row.id).run()
    if (!claimed.meta.changes) continue
    try {
      const research = await researchBusiness(row.website, env)
      if (!research.ok || research.publicText.length < 300) throw new Error('website_unavailable')
      if (automationVisible(research.signals)) throw new Error('low_fit: ya tiene automatización visible')
      const angle = await pickAngle(env)
      const proposal = await prepare(env, row, research, angle)
      let dossier = {}; try { dossier = JSON.parse(row.dossier || '{}') } catch {}
      proposal.contactName = typeof dossier.decisionMaker === 'string' ? dossier.decisionMaker.trim().slice(0, 120) : ''
      proposal.contactRole = typeof dossier.role === 'string' ? dossier.role.trim().slice(0, 120) : ''
      proposal.sourceUrl = research.pages?.[0] || research.source
      const subject = String(proposal.subject).replace(/[\r\n]/g, ' ').trim().slice(0, 62)
      const html = brandedProposal(row.company, proposal, `${SITE}/propuesta/${row.id}`, schedulingUrl(env), { postal: env.SENDER_POSTAL_ADDRESS })
      await env.DB.prepare("UPDATE outreach SET research=?,subject=?,html=?,angle=?,status='wa_ready',error=NULL,updated_at=? WHERE id=?")
        .bind(JSON.stringify({ source: research.source, signals: research.signals, pages: research.pages, phones: research.publicPhones || [], socialLinks: research.socialLinks || [], logo: research.logo || '', publicText: String(research.publicText || '').slice(0, 7000), ...proposal }), subject, html, angle.id, Date.now(), row.id).run()
      out.push({ id: row.id, company: row.company, ready: true })
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
  const rows = (await env.DB.prepare("SELECT * FROM outreach WHERE kind='whatsapp' AND status='wa_ready' ORDER BY (segment LIKE 'senal-%') DESC, updated_at LIMIT 15").all()).results || []
  if (!rows.length) return { due: true, sent: false }
  const key = 'walist-' + parts.year + parts.month + parts.day + '-' + hour
  const mark = await env.DB.prepare('INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)').bind(key, 'system', 'walist.sent', now).run()
  if (!mark.meta.changes) return { due: false }
  const cards = rows.map((r, i) => {
    let p = {}; try { p = JSON.parse(r.research || '{}') } catch {}
    const phone = String(r.email).replace(/^wa:/, '').replace(/\D/g, '')
    const msg = whatsappOpener(r, p)
    const vacante = /"vacante"/.test(r.dossier || '') ? (() => { try { return JSON.parse(r.dossier).directorio?.vacante } catch { return '' } })() : ''
    return `<div style="border:1px solid #e2ddd6;border-radius:10px;padding:14px;margin:0 0 14px">
<p style="margin:0 0 4px;font-weight:bold">${i + 1}. ${esc(r.company)}</p>
<p style="margin:0 0 8px;font-size:13px;color:#68625b">${esc(r.website)}${vacante ? ' · 🔥 Está contratando: ' + esc(vacante) : ''}</p>
<div style="white-space:pre-wrap;background:#f5f4f2;border-radius:8px;padding:10px;font-size:14px">${esc(msg)}</div>
<p style="margin:10px 0 0"><a href="https://wa.me/${phone}?text=${encodeURIComponent(msg)}" style="background:#1f7a4d;color:#fff;text-decoration:none;padding:9px 14px;border-radius:8px;font-weight:bold">Abrir WhatsApp con el mensaje</a>
&nbsp; <a href="${SITE}/propuesta/${esc(r.id)}" style="color:#7a4f34">Ver su propuesta</a></p></div>`
  }).join('')
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1c1a18;line-height:1.5">
<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7a4f34;margin:0 0 4px">Carolina · Lista de WhatsApp</p>
<h1 style="font-size:20px;margin:0 0 8px">${rows.length} empresas listas para escribirles hoy</h1>
<p style="margin:0 0 16px">No publican correo, solo WhatsApp. Cada una ya tiene su propuesta personalizada. Toca el botón, revisa el mensaje y envíalo. Si te responden, pásales el enlace de su propuesta y Carolina sigue la conversación.</p>
${cards}</div>`
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.EMAIL_FROM, to: [env.CATALINA_EMAIL || env.NOTIFY_TO], subject: `WhatsApp de hoy: ${rows.length} empresas listas (${rows.slice(0, 3).map(r => r.company).join(', ')}…)`.slice(0, 180), html }), signal: AbortSignal.timeout(15000) })
  if (!res.ok) return { due: true, sent: false, reason: 'email_failed' }
  for (const r of rows) {
    await env.DB.prepare("UPDATE outreach SET status='wa_listed',updated_at=? WHERE id=? AND status='wa_ready'").bind(now, r.id).run()
    await env.DB.prepare('INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)').bind('walisted-' + r.id, r.id, 'wa.listed', now).run()
  }
  return { due: true, sent: true, count: rows.length }
}
