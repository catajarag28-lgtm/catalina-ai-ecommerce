// Lotes de plataformas cada 2 horas: Carolina reparte entre Workana, Upwork, Freelancer, LinkedIn, comunidades, etc.
// los proyectos que ya estudió, con su propuesta única lista para pegar. Catalina abre el proyecto y envía desde
// su propia cuenta: esas plataformas cierran cuentas que publican con robots, y su perfil es el activo que trae contratos.
import { manualApplicationQueue } from '../core/revenueOS.js'

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const SLOTS = [8, 10, 12, 14, 16]

// Reparte por plataforma (round-robin) para no concentrar todo en una sola.
export function spreadByPlatform(items, max) {
  const by = new Map()
  for (const it of items) { const k = String(it.platform || 'otra').toLowerCase(); if (!by.has(k)) by.set(k, []); by.get(k).push(it) }
  const out = []
  while (out.length < max && [...by.values()].some(a => a.length)) for (const a of by.values()) { if (a.length && out.length < max) out.push(a.shift()) }
  return out
}

export async function sendPlatformBatch(env, now = Date.now(), { force = false } = {}) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]))
  const hour = Number(parts.hour)
  if (!force && (['Sun'].includes(parts.weekday) || !SLOTS.includes(hour))) return { due: false }
  const key = 'platbatch-' + parts.year + parts.month + parts.day + '-' + hour
  const listed = async url => !!(await env.DB.prepare("SELECT 1 FROM outreach_events WHERE event_id=?").bind('platlisted-' + url).first())
  const pool = []
  for (const r of await manualApplicationQueue(env, now).catch(() => [])) {
    const text = r.body || r.reply
    if (r.url && text && !(await listed(r.url))) pool.push({ platform: r.platform, url: r.url, title: r.need || r.subject || '', who: r.who || '', text })
  }
  const opps = (await env.DB.prepare("SELECT url,platform,title,company,proposal,score FROM opportunities WHERE status='prepared' AND action IN ('HUMAN_SUBMIT_REQUIRED','READY_FOR_REVIEW') AND grade IN ('A','B') AND proposal<>'' ORDER BY score DESC LIMIT 40").all().catch(() => ({ results: [] }))).results || []
  for (const o of opps) if (!(await listed(o.url))) pool.push({ platform: o.platform, url: o.url, title: o.title, who: o.company, text: o.proposal })
  const batch = spreadByPlatform(pool, Number(env.PLATFORM_BATCH_SIZE || 8))
  if (!batch.length) return { due: true, sent: false, pool: 0 }
  const mark = await env.DB.prepare('INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)').bind(key, 'system', 'platbatch.sent', now).run()
  if (!force && !mark.meta.changes) return { due: false }
  const cards = batch.map((b, i) => `<div style="border:1px solid #e2ddd6;border-radius:10px;padding:14px;margin:0 0 14px">
<p style="margin:0 0 4px;font-weight:bold">${i + 1}. ${esc(String(b.platform).toUpperCase())} · ${esc(b.title).slice(0, 140)}</p>
<p style="margin:0 0 8px;font-size:13px;color:#68625b">${esc(b.who)}</p>
<div style="white-space:pre-wrap;background:#f5f4f2;border-radius:8px;padding:10px;font-size:14px">${esc(b.text)}</div>
<p style="margin:10px 0 0"><a href="${esc(b.url)}" style="background:#7a4f34;color:#fff;text-decoration:none;padding:9px 14px;border-radius:8px;font-weight:bold">Abrir el proyecto y pegar la propuesta</a></p></div>`).join('')
  const plats = [...new Set(batch.map(b => b.platform))].join(', ')
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1c1a18;line-height:1.5">
<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7a4f34;margin:0 0 4px">Carolina · Lote de las ${hour}:00</p>
<h1 style="font-size:20px;margin:0 0 8px">${batch.length} postulaciones listas (${esc(plats)})</h1>
<p style="margin:0 0 16px">Cada una ya está estudiada y tiene su propuesta única. Abre el proyecto, pega el texto y envía desde tu cuenta. Unos 5 minutos en total.</p>${cards}</div>`
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.EMAIL_FROM, to: [env.CATALINA_EMAIL || env.NOTIFY_TO], subject: `Lote ${hour}:00 · ${batch.length} postulaciones listas en ${plats}`.slice(0, 180), html }), signal: AbortSignal.timeout(15000) })
  if (!res.ok) return { due: true, sent: false, reason: 'email_failed' }
  for (const b of batch) await env.DB.prepare('INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)').bind('platlisted-' + b.url, b.url.slice(0, 200), 'platform.listed', now).run()
  return { due: true, sent: true, count: batch.length, platforms: plats }
}
