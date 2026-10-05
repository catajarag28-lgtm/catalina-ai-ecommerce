import test from 'node:test'
import assert from 'node:assert/strict'
import { selectModel, valueCeiling, confidenceOf, extractJson, TIER_MODELS, callModel } from '../worker/core/modelRouter.js'
import { classifyDemand, linkedinPostDate, queryPlatform } from '../worker/prospecting/demandFilter.js'
import { proposalGate } from '../worker/prospecting/intent.js'

const NOW = Date.parse('2026-10-05T18:00:00Z')
const offline = { now: NOW, remote: false }

test('router: bulk work starts free, commercial writing on Gemini, Claude never by default', () => {
  assert.equal(selectModel('intent.search').tier, 1)
  assert.ok(TIER_MODELS[1][0].endsWith(':free'))
  assert.equal(selectModel('intent.qualify').tier, 2)
  assert.equal(selectModel('intent.proposal').tier, 3)
  for (const task of ['intent.search', 'intent.qualify', 'intent.proposal', 'inbox.reply', 'freelancer.judge'])
    assert.notEqual(selectModel(task).tier, 4)
})

test('router: escalation ceiling follows expected deal value', () => {
  assert.equal(valueCeiling(100), 2)
  assert.equal(valueCeiling(800), 3)
  assert.equal(valueCeiling(5000), 4)
  // Low confidence on a USD 100 lead never buys premium reasoning.
  assert.equal(selectModel('intent.qualify', { dealValue: 100, confidence: 0.2 }).tier, 2)
  // Low confidence on a USD 5.000 opportunity may climb one tier.
  assert.equal(selectModel('intent.proposal', { dealValue: 5000, confidence: 0.2 }).tier, 4)
})

test('router: confidence and JSON parsing are tolerant', () => {
  assert.equal(confidenceOf({ confidence: 'alta' }), 0.9)
  assert.equal(confidenceOf({ confidence: 72 }), 0.72)
  assert.deepEqual(extractJson('```json\n{"fit":"alto"}\n```'), { fit: 'alto' })
  assert.equal(extractJson('sin json'), null)
})

test('router: falls back to the next model and logs every call with cost', async () => {
  const calls = []
  const db = { prepare: sql => ({ bind: (...b) => ({ run: async () => { if (/INSERT INTO ai_calls/.test(sql)) calls.push(b); return { meta: {} } }, first: async () => ({ spent: 0, recent: 0 }), all: async () => ({ results: [] }) }), run: async () => ({}) }) }
  const seen = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    seen.push(body.model)
    if (body.model.endsWith(':free')) return new Response('rate limited', { status: 429 })
    return Response.json({ choices: [{ message: { content: '{"fit":"alto","confidence":0.9}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.00002 } })
  }
  try {
    const r = await callModel({ OPENROUTER_API_KEY: 'k', DB: db }, { task: 'intent.search', json: true, messages: [{ role: 'user', content: 'x' }] })
    assert.equal(r.ok, true)
    assert.equal(r.data.fit, 'alto')
    assert.equal(seen[0], TIER_MODELS[1][0])
    assert.ok(!r.model.endsWith(':free'))
    assert.equal(calls.length, seen.length)
    assert.ok(calls.some(b => b[7] === 0.00002))
  } finally { globalThis.fetch = realFetch }
})

test('router: spent budget forces free-only models', async () => {
  const db = { prepare: () => ({ bind: () => ({ run: async () => ({ meta: {} }), first: async () => ({ spent: 5, recent: 0 }), all: async () => ({ results: [] }) }), run: async () => ({}) }) }
  const seen = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => { seen.push(JSON.parse(init.body).model); return new Response('x', { status: 503 }) }
  try {
    const r = await callModel({ OPENROUTER_API_KEY: 'k', DB: db, AI_DAILY_BUDGET_USD: '2' }, { task: 'intent.proposal', json: true, messages: [] })
    assert.equal(r.ok, false)
    assert.ok(seen.length > 0 && seen.every(m => m.endsWith(':free')))
  } finally { globalThis.fetch = realFetch }
})

test('filter: LinkedIn activity ids carry the publication date', () => {
  assert.equal(new Date(linkedinPostDate('https://www.linkedin.com/posts/x_activity-7491554079496925184-saOD')).toISOString().slice(0, 10), '2026-08-07')
  assert.equal(queryPlatform('site:linkedin.com/posts "hiring" n8n'), 'linkedin')
})

test('filter: rejects the real noise found in the 5-oct audit without any LLM', async () => {
  const noise = [
    // Freelancer ofreciéndose a agencias (era "alto" en la cola).
    { url: 'https://www.linkedin.com/posts/vizitbanger_gohighlevel-n8n-automationagency-activity-7491554079496925184-saOD', evidence: 'Looking to partner with marketing agencies. I work white-label behind agencies', need: 'Busca agencias que necesiten delegar la ejecución técnica' },
    { url: 'https://community.n8n.io/t/for-hire-ai-automation-n8n-specialist-available-for-projects/1', title: '[FOR HIRE] AI Automation / n8n Specialist – Available for Projects & Freelance Work', evidence: 'Available for projects', need: 'n8n' },
    { url: 'https://www.linkedin.com/premium/products/', title: 'Probar Premium por 0 COP', evidence: 'Probar Premium por 0 COP', need: 'premium' },
    { url: 'https://www.peopleperhour.com/resume-builder', title: 'BUILD YOUR RESUME', evidence: 'build your resume', need: 'resume' },
    { url: 'https://www.twine.net/projects/x-childrens-book-marketing', title: "Children's Book Marketing and Website", evidence: 'we are hiring a marketer', need: 'marketing de un libro infantil' },
    // Post de contratación, pero de hace más de 2 meses.
    { url: 'https://www.linkedin.com/posts/adnan-rasheed_hiring-aiautomation-activity-7488178022198718464-dl3P', evidence: "We're Hiring: Remote AI Automation Expert", need: 'agentes IA, RAG, CRM y WhatsApp' },
  ]
  const reasons = []
  for (const p of noise) { const r = await classifyDemand(p, offline); assert.equal(r.ok, false, p.url); reasons.push(r.reason) }
  assert.deepEqual(reasons, ['seller_not_buyer', 'seller_not_buyer', 'navigation_link', 'navigation_link', 'off_scope', 'stale'])
})

test('filter: keeps a fresh, explicit buyer request', async () => {
  const r = await classifyDemand({ url: 'https://jobs.lever.co/spreetail/f9f06e90', evidence: "We're hiring an RPA & AI Automation Engineer to build AI agents", need: 'AI agents for fulfillment operations' }, offline)
  assert.equal(r.ok, true)
})

test('quality gate: blocks generic, priced or contact-leaking proposals', () => {
  const p = { platform: 'LinkedIn', need: 'automatizar seguimiento de leads de WhatsApp con CRM para clínica estética' }
  assert.equal(proposalGate('Hola, puedo ayudar.', p), 'too_short')
  const generic = 'Hello, I can help you with this project. ' + 'I am very experienced and motivated to deliver quality work on time for you. '.repeat(6)
  assert.notEqual(proposalGate(generic, p), true)
  const good = 'Hola, puedo encargarme de esto. Veo que la clínica recibe leads por WhatsApp y el seguimiento depende de que alguien recuerde escribir. Propongo conectar WhatsApp con el CRM para que cada lead quede registrado con su origen, recibir una primera respuesta inmediata con horarios y servicios, y crear tareas de seguimiento a las 24 y 72 horas para el equipo. Entregables iniciales: mapa del flujo actual, integración WhatsApp-CRM, plantillas de seguimiento y un tablero de leads sin respuesta. ¿Hoy cuántos leads entran por semana y quién los atiende? Catalina Jaramillo'
  assert.equal(proposalGate(good, p), true)
  assert.equal(proposalGate(good.replace('Catalina Jaramillo', 'Desde USD 900. Catalina Jaramillo'), p), 'price_in_message')
  assert.equal(proposalGate(good + ' https://soycatalinajaramillo.com', { ...p, platform: 'Freelancer' }), 'contact_in_marketplace')
})
