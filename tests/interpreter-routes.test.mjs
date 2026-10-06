import test from 'node:test'
import assert from 'node:assert/strict'
import { translationClientSecretRequest, TRANSLATION_CLIENT_SECRETS_URL } from '../worker/interpreter/provider.js'
import { handleInterpreter, createInterpreterLink } from '../worker/interpreter/routes.js'

// D1 mínimo en memoria: app_settings + registro de inserts.
function fakeEnv(extra = {}) {
  const settings = new Map(), inserts = []
  const DB = { prepare: sql => ({ bind: (...b) => ({
    run: async () => { if (/INSERT INTO app_settings/.test(sql)) settings.set(b[0], b[1]); else inserts.push({ sql, b }); return { meta: { changes: 1 } } },
    first: async () => (/FROM app_settings/.test(sql) && settings.has(b[0]) ? { value: settings.get(b[0]) } : null),
  }) }) }
  return { env: { DB, ...extra }, inserts }
}
const deps = { rateLimit: async () => true, notifyCatalina: async () => {} }
const post = (path, body) => new Request('https://soycatalinajaramillo.com' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

test('interpreter: official translation contract (one session per output language)', () => {
  assert.equal(TRANSLATION_CLIENT_SECRETS_URL, 'https://api.openai.com/v1/realtime/translations/client_secrets')
  assert.deepEqual(translationClientSecretRequest('en-US'), { session: { model: 'gpt-realtime-translate', audio: { output: { language: 'en' } } } })
  assert.throws(() => translationClientSecretRequest(''))
})

test('interpreter: page and sessions require a valid personal link', async () => {
  const { env } = fakeEnv({ OPENAI_API_KEY: 'k' })
  const page = await handleInterpreter(new Request('https://soycatalinajaramillo.com/interprete'), env, new URL('https://soycatalinajaramillo.com/interprete'), deps)
  assert.match(await page.text(), /Necesitas tu enlace personal/)
  const r = await handleInterpreter(post('/interprete/session', { t: 'f'.repeat(32), direction: 'listen' }), env, new URL('https://x/interprete/session'), deps)
  assert.equal(r.status, 401)
})

test('interpreter: listen → Spanish, speak → guest language, key never sent to the browser', async () => {
  const { env } = fakeEnv({ OPENAI_API_KEY: 'sk-secret' })
  const link = await createInterpreterLink(env, { guestLanguage: 'en', company: 'Acme' })
  const t = new URL(link).searchParams.get('t')
  const seen = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => { seen.push({ url, body: JSON.parse(init.body), auth: init.headers.authorization }); return Response.json({ value: 'ek_short_lived', expires_at: 123 }) }
  try {
    const listen = await (await handleInterpreter(post('/interprete/session', { t, direction: 'listen' }), env, new URL('https://x/interprete/session'), deps)).json()
    const speak = await (await handleInterpreter(post('/interprete/session', { t, direction: 'speak', guestLanguage: 'pt' }), env, new URL('https://x/interprete/session'), deps)).json()
    assert.equal(seen[0].body.session.audio.output.language, 'es')
    assert.equal(seen[1].body.session.audio.output.language, 'pt')
    assert.equal(seen[0].auth, 'Bearer sk-secret')
    assert.equal(listen.clientSecret, 'ek_short_lived')
    assert.ok(!JSON.stringify([listen, speak]).includes('sk-secret'))
  } finally { globalThis.fetch = realFetch }
})

test('interpreter: missing OpenAI key is explicit, and ending saves cost and transcript', async () => {
  const { env, inserts } = fakeEnv()
  const t = new URL(await createInterpreterLink(env, {})).searchParams.get('t')
  const r = await handleInterpreter(post('/interprete/session', { t, direction: 'listen' }), env, new URL('https://x/interprete/session'), deps)
  assert.equal(r.status, 503)
  const end = await (await handleInterpreter(post('/interprete/end', { t, minutes: { listen: 10, speak: 5 }, transcripts: { listen: 'Hola, gracias por la llamada.' } }), env, new URL('https://x/interprete/end'), deps)).json()
  assert.equal(end.minutes, 15)
  assert.equal(end.cost, 0.51)
  assert.ok(inserts.some(i => /ai_calls/.test(i.sql) && i.b[7] === 0.51))
  assert.ok(inserts.some(i => /meeting_notes/.test(i.sql)))
})
