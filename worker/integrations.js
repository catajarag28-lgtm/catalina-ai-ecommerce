const googleToken = async env => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) return null
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(10000) })
  if (!res.ok) return null
  return (await res.json()).access_token
}

export async function availability(env, date) {
  const token = await googleToken(env)
  if (!token) return { ok: false, reason: 'calendar_unavailable' }
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const timeMin = new Date(`${day}T00:00:00-05:00`)
  const timeMax = new Date(timeMin.getTime() + 86400000)
  if (timeMin.getTime() < Date.now() - 86400000 || timeMin.getTime() > Date.now() + 30 * 86400000) return { ok: false, reason: 'date_out_of_range' }
  const calendarId = env.GOOGLE_CALENDAR_ID || 'primary'
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: calendarId }] }), signal: AbortSignal.timeout(10000) })
  if (!res.ok) return { ok: false, reason: 'calendar_error' }
  const data = await res.json()
  if (!data.calendars?.[calendarId] || data.calendars[calendarId].errors?.length) return { ok: false, reason: 'calendar_error' }
  const busy = data.calendars[calendarId].busy || []
  const slots = [9, 10, 11, 14, 15, 16].map(hour => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00-05:00`)).filter(start => start.getTime() > Date.now() + 2 * 3600000 && !busy.some(b => start.getTime() < new Date(b.end).getTime() && start.getTime() + 30 * 60000 > new Date(b.start).getTime())).map(start => start.toISOString())
  return { ok: true, timezone: env.CALENDAR_TIMEZONE || 'America/Bogota', slots }
}

export async function book(env, { start, email, name, summary }, conversationId) {
  if (!/^\S+@\S+\.\S+$/.test(email || '') || !name || !start) return { ok: false, reason: 'missing_contact_or_slot' }
  const proposed = new Date(start)
  if (!Number.isFinite(proposed.getTime()) || proposed.getTime() < Date.now() + 2 * 3600000 || proposed.getTime() > Date.now() + 30 * 86400000) return { ok: false, reason: 'invalid_slot' }
  const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(proposed)
  const slots = await availability(env, localDay)
  if (!slots.ok || !slots.slots.includes(proposed.toISOString())) return { ok: false, reason: slots.reason || 'slot_unavailable' }
  const token = await googleToken(env)
  const end = new Date(proposed.getTime() + 30 * 60000).toISOString()
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID || 'primary')}/events?conferenceDataVersion=1&sendUpdates=all`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ summary: `Diagnóstico con Catalina · ${name}`, description: (summary || 'Conversación inicial con Carolina').slice(0, 1500), start: { dateTime: proposed.toISOString(), timeZone: 'America/Bogota' }, end: { dateTime: end, timeZone: 'America/Bogota' }, attendees: [{ email }], conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } }), signal: AbortSignal.timeout(12000) })
  if (!res.ok) return { ok: false, reason: 'calendar_create_failed' }
  const event = await res.json()
  if (!event.id || event.status === 'cancelled') return { ok: false, reason: 'calendar_unconfirmed' }
  let recorded = true
  try { await env.DB.prepare('INSERT INTO meetings (id,conversation_id,email,starts_at,ends_at,calendar_event_id,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), conversationId, email, proposed.toISOString(), end, event.id, Date.now()).run() } catch { recorded = false }
  const confirmation = await sendEmail(env, email, 'Tu reunión con Catalina', `Hola ${name},\n\nTu reunión está programada para ${proposed.toLocaleString('es-CO', { timeZone: 'America/Bogota' })} (hora Colombia). Revisa y acepta la invitación de Google Calendar.\n\n${event.hangoutLink || event.htmlLink || ''}`).catch(() => ({ ok: false }))
  return { ok: true, recorded, start: proposed.toISOString(), timezone: 'America/Bogota', calendarEventId: event.id, invitationSentByCalendar: true, confirmationEmailSent: confirmation.ok }
}

export async function sendEmail(env, to, subject, body) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { ok: false, reason: 'email_unavailable' }
  const replyTo = (env.EMAIL_FROM.match(/<([^>]+)>/) || [])[1] || env.EMAIL_FROM
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], reply_to: replyTo, subject, text: body }), signal: AbortSignal.timeout(10000) })
  return { ok: res.ok, reason: res.ok ? undefined : 'email_provider_error' }
}

// Envío con cabeceras (respuestas en hilo). Devuelve el id de Resend para trazabilidad.
export async function sendThreadedEmail(env, { to, subject, text, inReplyTo, references }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { ok: false, reason: 'email_unavailable' }
  const replyTo = (env.EMAIL_FROM.match(/<([^>]+)>/) || [])[1] || env.EMAIL_FROM
  const headers = {}
  if (inReplyTo) { headers['In-Reply-To'] = inReplyTo; headers.References = references || inReplyTo }
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], reply_to: replyTo, subject, text, headers }), signal: AbortSignal.timeout(10000) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, id: data.id, reason: res.ok ? undefined : 'email_provider_error' }
}

export async function researchWebsite(url) {
  try {
    const target = new URL(url)
    if (target.protocol !== 'https:' || !/^[a-z\d.-]+\.[a-z]{2,}$/i.test(target.hostname) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(target.hostname)) return { ok: false, reason: 'invalid_public_url' }
    const res = await fetch(target.toString(), { redirect: 'manual', headers: { 'user-agent': 'CarolinaResearch/1.0' }, signal: AbortSignal.timeout(7000) })
    if (!res.ok || (res.headers.get('content-type') || '').indexOf('text/html') < 0) return { ok: false, reason: 'site_unavailable' }
    const html = (await res.text()).slice(0, 60000)
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 3500)
    const publicEmails = [...new Set((html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).map(e => e.toLowerCase()))]
    return { ok: true, source: target.toString(), publicText: text, publicEmails, publicLinks: [...new Set([...html.matchAll(/href=["'](https:\/\/[^"'<>]+)["']/gi)].map(m => m[1].replace(/&amp;/g,'&')).filter(u => {try{return !/facebook|instagram|linkedin|twitter|youtube|workana|upwork/i.test(new URL(u).hostname)}catch{return false}}))].slice(0,30) }
  } catch { return { ok: false, reason: 'site_unavailable' } }
}
