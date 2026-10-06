// Carolina Live Interpreter en producción: página /interprete + sesiones de traducción en tiempo real.
// Acceso: enlace temporal que solo recibe Catalina por correo (o el que Carolina adjunta al confirmar una cita).
// La clave de OpenAI nunca sale del Worker: el navegador recibe un client secret de vida corta por dirección.
import { prepareInterpretedMeeting } from './meeting.js'
import { PRIMARY_LANGUAGES } from './languages.js'
import { createInterpreterSession } from './session.js'
import { translationClientSecretRequest, TRANSLATION_CLIENT_SECRETS_URL, TRANSLATION_CALLS_URL, TRANSLATION_USD_PER_MINUTE } from './provider.js'
import { interpreterPage } from './page.js'

const SITE = 'https://soycatalinajaramillo.com'
const KEY = n => 'interpreter_access:' + n

export async function createInterpreterLink(env, { meetingId = null, guestLanguage = 'en', company = null, hours = 12, expiresAt = null } = {}) {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const exp = expiresAt || Date.now() + hours * 3600000
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(KEY(nonce), JSON.stringify({ meetingId, guestLanguage, company, expiresAt: exp }), Date.now()).run()
  return SITE + '/interprete?t=' + nonce
}

async function access(env, nonce) {
  if (!/^[a-f0-9]{32}$/.test(String(nonce || ''))) return null
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key=?').bind(KEY(nonce)).first().catch(() => null)
  try { const a = JSON.parse(row?.value || 'null'); return a && a.expiresAt > Date.now() ? a : null } catch { return null }
}

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const html = (b, s = 200) => new Response(b, { status: s, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex,nofollow', 'permissions-policy': 'microphone=(self), display-capture=(self), speaker-selection=(self)' } })

export async function handleInterpreter(request, env, url, { rateLimit, notifyCatalina }) {
  const path = url.pathname
  if (path === '/interprete' && request.method === 'GET') {
    const a = await access(env, url.searchParams.get('t'))
    return html(interpreterPage({ token: a ? url.searchParams.get('t') : null, access: a, ready: !!env.OPENAI_API_KEY, languages: PRIMARY_LANGUAGES }))
  }
  if (path === '/interprete/request' && request.method === 'POST') {
    if (!(await rateLimit(env, request, 'interpreter-request', 4))) return json({ error: 'rate_limited' }, 429)
    const link = await createInterpreterLink(env, { hours: 12 })
    await notifyCatalina(env, '🎧 Tu enlace del intérprete de Carolina', ['Enlace personal del intérprete en tiempo real (válido 12 horas):', link, '', 'Úsalo en Chrome junto a tu reunión de Meet, Zoom o Teams. No lo compartas.'].join('\n')).catch(() => {})
    return json({ ok: true })
  }
  if (path === '/interprete/session' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const a = await access(env, body.t)
    if (!a) return json({ error: 'enlace vencido o inválido' }, 401)
    if (!env.OPENAI_API_KEY) return json({ error: 'Falta configurar OPENAI_API_KEY en Cloudflare' }, 503)
    if (!(await rateLimit(env, request, 'interpreter-session', 30))) return json({ error: 'rate_limited' }, 429)
    const guest = String(body.guestLanguage || a.guestLanguage || 'en').slice(0, 2)
    // Valida idiomas y arma el contexto con el módulo existente (host español, invitado en su idioma).
    const meeting = prepareInterpretedMeeting({ meetingId: a.meetingId, guestLanguage: guest, context: { company: a.company } })
    const direction = body.direction === 'speak' ? 'speak' : 'listen'
    const target = direction === 'listen' ? 'es' : guest
    const res = await fetch(TRANSLATION_CLIENT_SECRETS_URL, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, 'content-type': 'application/json', 'OpenAI-Safety-Identifier': 'carolina-catalina' },
      body: JSON.stringify(translationClientSecretRequest(target)),
    }).catch(e => ({ ok: false, status: 0, text: async () => e.message }))
    if (!res.ok) { const detail = (await res.text().catch(() => '')).slice(0, 300); console.error('interpreter_secret_failed', res.status, detail); return json({ error: 'No se pudo abrir la sesión de traducción (' + res.status + ')', detail }, 502) }
    const data = await res.json()
    const secret = data.value || data.client_secret?.value
    return json({ clientSecret: secret, expiresAt: data.expires_at || null, callsUrl: TRANSLATION_CALLS_URL, direction, target, guest, disclosure: meeting.session.disclosure })
  }
  if (path === '/interprete/end' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const a = await access(env, body.t)
    if (!a) return json({ error: 'enlace vencido o inválido' }, 401)
    const minutes = Math.max(0, Math.min(600, Number(body.minutes?.listen || 0))) + Math.max(0, Math.min(600, Number(body.minutes?.speak || 0)))
    const cost = +(minutes * TRANSLATION_USD_PER_MINUTE).toFixed(4)
    await env.DB.prepare('INSERT INTO ai_calls(at,task,tier,model,ok,input_tokens,output_tokens,cost,opportunity_id,outcome,latency_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(Date.now(), 'interpreter.session', 0, 'gpt-realtime-translate', 1, null, null, cost, a.meetingId, 'minutes=' + minutes.toFixed(1), null).run().catch(() => {})
    const transcript = { listen: String(body.transcripts?.listen || '').slice(0, 30000), speak: String(body.transcripts?.speak || '').slice(0, 30000), source: { listen: String(body.transcripts?.listenSource || '').slice(0, 30000), speak: String(body.transcripts?.speakSource || '').slice(0, 30000) } }
    if (transcript.listen || transcript.speak) {
      const session = createInterpreterSession({ id: a.meetingId ? 'interpreter-' + a.meetingId : undefined })
      await env.DB.prepare('INSERT OR REPLACE INTO meeting_notes(id,outreach_id,company,source,analysis,created_at) VALUES (?,?,?,?,?,?)')
        .bind(session.id, null, a.company || null, 'interpreter', JSON.stringify({ type: 'interpreted_meeting', guestLanguage: body.guestLanguage || a.guestLanguage, minutes, cost, transcript }).slice(0, 60000), Date.now()).run().catch(e => console.error('interpreter_notes_failed', e?.message))
    }
    return json({ ok: true, minutes, cost })
  }
  return null
}
