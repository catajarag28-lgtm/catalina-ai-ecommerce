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
  await import('../proposals/meetingBrief.js').then(m => m.sendMeetingBrief(env, { email, name, start: proposed.toISOString(), summary })).catch(() => {})
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

const privateHost = host => !/^[a-z\d.-]+\.[a-z]{2,}$/i.test(host) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host)
const socialHosts = /facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok|workana|upwork|pinterest|wa\.me|whatsapp/i
const junkEmail = /\.(png|jpe?g|gif|webp|svg|css|js)$|@(example|sentry|wixpress|domain|email|yourdomain|sentry-next)\.|^(u00|noreply|no-reply)/i
export const validPublicEmail = value => {
  const e=String(value||'').trim().toLowerCase()
  if(!/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,24}$/i.test(e)) return false
  const domain=e.split('@')[1]||''
  if(!domain || domain.includes('..') || /(?:https?|www)$/i.test(domain) || /(?:https?|www)[.:/]/i.test(domain)) return false
  return !junkEmail.test(e)
}

// Respuesta JSON de OpenRouter tolerante a ```json, texto alrededor y razonamiento visible.
// Devuelve null y registra el motivo: un fallo silencioso dejó 129 bids en judge_unavailable.
export function parseModelJson(data, label = 'model') {
  const choice = data?.choices?.[0]
  const raw = String(choice?.message?.content || '')
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}')
  if (a >= 0 && b > a) { try { return JSON.parse(raw.slice(a, b + 1)) } catch {} }
  console.error(label + '_unparseable', JSON.stringify({ finish: choice?.finish_reason || null, error: data?.error?.message || null, chars: raw.length }))
  return null
}

export async function emailDomainReachable(value) {
  const email=String(value||'').trim().toLowerCase()
  if(!validPublicEmail(email)) return false
  const domain=email.split('@')[1]
  try {
    const res=await fetch('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(domain)+'&type=MX',{
      headers:{accept:'application/dns-json'},
      signal:AbortSignal.timeout(5000)
    })
    if(!res.ok) return true // DNS verifier outage must not create false negatives.
    const data=await res.json().catch(()=>({}))
    if(Number(data.Status)!==0) return false
    const answers=Array.isArray(data.Answer)?data.Answer:[]
    // RFC 7505 null-MX (".") explicitly means the domain accepts no email.
    const mx=answers.filter(a=>Number(a.type)===15).map(a=>String(a.data||'').trim())
    if(mx.some(x=>/\s\.$/.test(x))) return false
    if(mx.length) return true
    // Legacy fallback: domains without MX may receive mail on an A/AAAA record.
    const a=await fetch('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(domain)+'&type=A',{
      headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(5000)
    }).then(r=>r.ok?r.json():null).catch(()=>null)
    return !!(a && Number(a.Status)===0 && Array.isArray(a.Answer) && a.Answer.length)
  } catch {
    return true
  }
}

// Lee una página pública siguiendo hasta 3 redirecciones https, sin salir a hosts privados.
export async function researchWebsite(url) {
  try {
    let target = new URL(url), res
    for (let hop = 0; hop < 4; hop++) {
      if (target.protocol !== 'https:' || privateHost(target.hostname)) return { ok: false, reason: 'invalid_public_url' }
      const opts = { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; CarolinaResearch/1.1; +https://soycatalinajaramillo.com)', 'accept-language': 'es,en;q=0.8' } }
      // Un reintento con más tiempo: webs lentas de pymes se perdían por un solo timeout de 8 s.
      res = await fetch(target.toString(), { ...opts, signal: AbortSignal.timeout(8000) }).catch(() => fetch(target.toString(), { ...opts, signal: AbortSignal.timeout(14000) }))
      if (res.status < 300 || res.status >= 400) break
      const next = res.headers.get('location'); if (!next) break
      target = new URL(next, target)
    }
    if (!res.ok || (res.headers.get('content-type') || '').indexOf('text/html') < 0) return { ok: false, reason: 'site_unavailable' }
    return pageFromHtml((await res.text()).slice(0, 250000), target)
  } catch { return { ok: false, reason: 'site_unavailable' } }
}

// Extrae texto, contactos, enlaces y señales de un HTML (servido o renderizado por el navegador en la nube).
export const decodeCfEmail = hex => { try { const k = parseInt(hex.slice(0, 2), 16); let out = ''; for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k); return out } catch { return '' } }
export const GENERIC_MAILBOX = /^(info|hola|hello|contacto|contact|contactanos|citas|reservas|ventas|sales|admin|office|oficina|recepcion|front|frontdesk|booking|appointments|support|soporte|help|ayuda|atencion|servicio|mail|correo|team|equipo|general|consultas|inquiries|enquiries)@/i
export function pageFromHtml(html, target) {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 3500)
  const mailtoEmails=[...html.matchAll(/href=["']mailto:([^"'?\s<>]+)/gi)].map(m=>m[1])
  const textEmails=html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,24}/g) || []
  // Correos públicos disfrazados: Cloudflare Email Protection y "nombre [arroba] dominio . com".
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]{8,})["']/gi)) textEmails.push(decodeCfEmail(m[1]))
  for (const m of html.replace(/<[^>]*>/g, ' ').matchAll(/([a-z0-9._%+-]{2,40})\s*(?:\[\s*(?:at|arroba)\s*\]|\(\s*(?:at|arroba)\s*\)|\s(?:arroba)\s)\s*([a-z0-9-]{2,40})\s*(?:\[\s*(?:dot|punto)\s*\]|\(\s*(?:dot|punto)\s*\)|\.)\s*([a-z]{2,10}(?:\.[a-z]{2})?)/gi)) textEmails.push(m[1] + '@' + m[2] + '.' + m[3])
  const publicEmails = [...new Set([...mailtoEmails,...textEmails].map(e => e.toLowerCase()).filter(validPublicEmail))]
  const links = [...html.matchAll(/href=["']([^"'<>\s]+)["']/gi)].map(m => { try { return new URL(m[1].replace(/&amp;/g, '&'), target).toString().split('#')[0] } catch { return '' } })
  const publicLinks = [...new Set(links.filter(u => { try { const h = new URL(u); return h.protocol === 'https:' && !socialHosts.test(h.hostname) } catch { return false } }))].slice(0, 60)
  const socialLinks = [...new Set(links.filter(u => { try { const h = new URL(u); return h.protocol === 'https:' && socialHosts.test(h.hostname) } catch { return false } }))].slice(0, 20)
  const publicPhones = [...new Set([...html.matchAll(/href=["'](?:tel:|https:\/\/wa\.me\/|https:\/\/api\.whatsapp\.com\/send\?phone=)\+?([\d\s().-]{7,20})/gi)].map(m => '+' + m[1].replace(/\D/g, '')).filter(x => x.length >= 9))].slice(0, 4)
  // Logo del negocio (para personalizar la propuesta): logo explícito, ícono de alta resolución o imagen social.
  const abs = u => { try { const x = new URL(u.replace(/&amp;/g, '&'), target); return x.protocol === 'https:' ? x.toString() : '' } catch { return '' } }
  const logo = abs((html.match(/<img[^>]+src=["']([^"']*logo[^"']*\.(?:png|svg|webp|jpe?g)[^"']*)["']/i) || html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i) || [])[1] || '')
  const years = [...html.replace(/<[^>]*>/g, ' ').matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map(m => Number(m[1]))
  return { ok: true, source: target.toString(), publicText: text, publicEmails, publicLinks, socialLinks, publicPhones, logo, signals: detectSignals(html, links), copyrightYear: years.length ? Math.max(...years) : null }
}

// Señales verificables en el HTML. La ausencia de una señal NO demuestra que el negocio carezca de esa herramienta.
const SIGNALS = {
  reservas: /vagaro|mindbody|fresha|joinblvd|boulevard|squareup\.com\/appointments|square\.site|calendly|acuityscheduling|setmore|zenoti|booksy|treatwell|glofox|simplybook|timely|doctoralia|zocdoc|nexhealth|localmed|jane\.app|agendapro|reservio|goldie|glossgenius|schedulicity/i,
  whatsapp: /wa\.me\/|api\.whatsapp\.com|web\.whatsapp\.com/i,
  chat: /intercom|tidio|driftt|crisp\.chat|livechatinc|tawk\.to|zdassets|zopim|hs-scripts|manychat|chatbase|botpress|landbot|freshchat|olark|smartsupp|elfsight.*chat|getbutton|podium|wati\.io|respond\.io|botmaker|callbell|leadsales|treble\.ai|b2chat|gupshup|yalo\.ai|yalochat|sirena\.app|chatwoot|trengo\.com|kommo|aisensy|interakt\.(?:ai|shop)|whatsform|joinchat-bot|voiceflow|tidiochat/i,
  tienda: /cdn\.shopify|myshopify|woocommerce|tiendanube|vtex|bigcommerce|wixstatic.*ecom|magento|prestashop|squarespace-commerce/i,
  email_marketing: /klaviyo|mailchimp|list-manage|activecampaign|convertkit|brevo|sendinblue/i,
  crm: /hubspot|salesforce|zoho|gohighlevel|leadconnector|pipedrive|kommo/i,
  instagram: /instagram\.com\//i,
  tiktok: /tiktok\.com\/@/i,
}
// Automatización ya visible en su web (chat/bot o CRM con automatizaciones). Esos negocios no son el objetivo:
// Carolina busca empresas que todavía atienden a mano.
export const automationVisible = (signals = {}) => !!(signals.chat || /gohighlevel|leadconnector|kommo/i.test(String(signals.crm || '')))
export function detectSignals(html, links = []) {
  const all = html + ' ' + links.join(' ')
  const found = {}
  for (const [key, pattern] of Object.entries(SIGNALS)) { const m = all.match(pattern); if (m) found[key] = m[0].toLowerCase().slice(0, 40) }
  found.formularios = (html.match(/<form\b/gi) || []).length
  found.telefono = /href=["']tel:/i.test(html)
  found.idiomas = [...new Set([...html.matchAll(/hreflang=["']([a-z]{2})/gi)].map(m => m[1].toLowerCase()))].concat((html.match(/<html[^>]*lang=["']([a-z]{2})/i) || [])[1] || []).filter((v, i, a) => a.indexOf(v) === i)
  return found
}

// Investigación de negocio: portada + hasta 3 páginas clave del mismo dominio (servicios, contacto, reservas, nosotros).
export async function researchBusiness(url, env = null) {
  let home = await researchWebsite(url)
  if (!home.ok) return home
  if (home.publicText.length < 400 && env?.BROWSER) {
    const r = await import('./browserSessions.js').then(m => m.renderHtml(env, home.source)).catch(() => null)
    if (r?.html) { const t = new URL(r.finalUrl || home.source); if (t.protocol === 'https:' && t.hostname.replace(/^www./, '') === new URL(home.source).hostname.replace(/^www./, '')) home = { ...pageFromHtml(r.html, t), rendered: true } }
  }
  const host = new URL(home.source).hostname.replace(/^www\./, '')
  const key = /contact|contacto|servicio|service|tratamiento|treatment|reserv|book|cita|appointment|nosotros|about|sobre|precio|pricing|menu|productos|shop|tienda/i
  const pages = home.publicLinks.filter(u => { try { const h = new URL(u); return h.hostname.replace(/^www\./, '') === host && key.test(h.pathname) && !/\.(pdf|jpe?g|png|webp|zip)$/i.test(h.pathname) } catch { return false } })
  const pick = []
  for (const group of [/contact|contacto/i, /servicio|service|tratamiento|treatment|menu|productos|shop|tienda/i, /reserv|book|cita|appointment|about|nosotros|sobre/i]) { const u = pages.find(x => group.test(x) && !pick.includes(x)); if (u) pick.push(u) }
  const extra = []
  for (const u of pick) { const r = await researchWebsite(u); if (r.ok) extra.push(r) }
  // Si solo hay correos genéricos, se buscan personas: equipo, nosotros, aviso legal y privacidad (responsable del tratamiento).
  const onlyGeneric = () => { const e = [home, ...extra].flatMap(r => r.publicEmails || []); return !e.some(x => !GENERIC_MAILBOX.test(x)) }
  if (onlyGeneric()) {
    const people = home.publicLinks.filter(u => { try { const h = new URL(u); return h.hostname.replace(/^www\./, '') === host && /equipo|team|nosotros|about|quienes|staff|doctor|abogad|agentes|asesores|aviso-legal|legal|privacidad|privacy|terminos/i.test(h.pathname) && !pick.includes(u) } catch { return false } }).slice(0, 3)
    for (const u of people) { const r = await researchWebsite(u); if (r.ok) extra.push(r); if (!onlyGeneric()) break }
  }
  // Muchas webs no enlazan su página de contacto en la portada: si aún no hay correo, se prueban rutas habituales.
  if (![home, ...extra].some(r => r.publicEmails?.length)) {
    const origin = new URL(home.source).origin
    for (const path of ['/contacto', '/contact', '/contactanos', '/contact-us', '/contactenos']) {
      const u = origin + path
      if (pick.includes(u)) continue
      const r = await researchWebsite(u)
      if (r.ok && new URL(r.source).hostname.replace(/^www\./, '') === host) { extra.push(r); if (r.publicEmails.length) break }
    }
  }
  const all = [home, ...extra]
  const signals = {}
  for (const r of all) for (const [k, v] of Object.entries(r.signals || {})) if (v && (!signals[k] || (Array.isArray(v) && v.length))) signals[k] = v
  const emailPages = {}
  for (const r of all) for (const e of r.publicEmails) emailPages[e] ||= r.source
  return {
    ok: true, source: home.source, host,
    publicText: all.map(r => `[${new URL(r.source).pathname}] ${r.publicText}`).join('\n').slice(0, 9000),
    publicEmails: Object.keys(emailPages), emailPages, pages: all.map(r => r.source), signals,
    publicPhones: [...new Set(all.flatMap(r => r.publicPhones || []))].slice(0, 4),
    copyrightYear: Math.max(0, ...all.map(r => r.copyrightYear || 0)) || null,
    socialLinks: [...new Set(all.flatMap(r => r.socialLinks || []))].slice(0, 20),
    logo: home.logo || '',
    publicLinks: home.publicLinks,
  }
}

// El correo debe estar publicado en la web del negocio; se prefiere el del propio dominio.
export function pickBusinessEmail(emails, host) {
  const clean=(emails||[]).filter(validPublicEmail)
  const own = clean.filter(e => !/(%22|%3c|%3e|data-style|support-contact)/i.test(e) && e.split('@')[1].replace(/^www\./, '').endsWith(host))
  // Public named mailboxes usually reach a decision-maker more directly than info@.
  // Never infer addresses: this only ranks emails literally published by the business.
  const named = own.find(e => !/^(info|hola|hello|contacto|contact|citas|reservas|ventas|sales|admin|office|recepcion|front|booking|appointments|support|help|careers|jobs|billing|accounts?)@/i.test(e))
  if (named) return named
  const preferred = own.find(e => /^(sales|ventas|contacto|contact|hola|hello|citas|reservas|booking|appointments|office|recepcion|front|info|admin)@/i.test(e)) || own[0]
  if (preferred) return preferred
  return clean.find(e => /@(gmail|hotmail|outlook|yahoo|icloud)\./i.test(e)) || null
}


// Verificación de buzón con MillionVerifier antes de cada correo frío: las pymes publican direcciones viejas
// (21% de rebote el 6-oct). Solo se envía a 'ok' y 'catch_all'; 'invalid'/'disposable' se suprimen.
// Sin clave configurada, no bloquea (se mantiene el comportamiento anterior).
export async function verifyMailbox(env, email) {
  if (!env.MILLIONVERIFIER_API_KEY) return { checked: false, sendable: true }
  try {
    const r = await fetch('https://api.millionverifier.com/api/v3/?api=' + encodeURIComponent(env.MILLIONVERIFIER_API_KEY) + '&email=' + encodeURIComponent(email) + '&timeout=10', { signal: AbortSignal.timeout(15000) })
    const d = await r.json().catch(() => ({}))
    const result = String(d.result || 'unknown').toLowerCase()
    if (d.error) return { checked: false, sendable: false, result: 'error', error: String(d.error).slice(0, 80) }
    return { checked: true, result, sendable: ['ok', 'catch_all'].includes(result) }
  } catch { return { checked: false, sendable: false, result: 'error' } }
}
