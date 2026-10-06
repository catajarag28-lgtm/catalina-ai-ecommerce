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

test('filter: real buyers that never say "hiring" are kept (false negatives of 5-oct)', async () => {
  const buyers = [
    { url: 'https://jobs.lever.co/cscgeneration-2/40715594-0edc-4909-967c-71d252215c51', evidence: 'Sur La Table needs AI-powered automations and tooling', need: 'AI Solutions Engineer' },
    { url: 'https://jobs.ashbyhq.com/cas/b0d87b0a-be44-41ed-80eb-c9416f13f5f7', evidence: 'Full-Time Independent Contractor', need: 'automatizaciones con IA' },
    { url: 'https://jobs.ashbyhq.com/workhero/2b76354a', evidence: "We're growing the team that turns messy workflows into AI-powered automations", need: 'agentes de IA' },
    { url: 'https://jobs.stardex.com/job-postings/constant-hire/senior-shopify-developer-eiPE7-', evidence: 'Build reliable automations using AI, APIs, and tools like Make, Zapier, or n8n', need: 'Shopify + IA' },
  ]
  for (const p of buyers) assert.equal((await classifyDemand(p, offline)).ok, true, p.url)
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

test('session health: only a fresh authenticated probe is CONNECTED', async () => {
  const { sessionStateFrom } = await import('../worker/core/sessionHealth.js')
  const now = Date.parse('2026-10-06T00:00:00Z')
  assert.equal(sessionStateFrom({ stored: 'missing' }, now).state, 'MISSING')
  // n8n/make: payload en KV pero cifrado con otra llave → no es "guardada", requiere login humano.
  assert.equal(sessionStateFrom({ stored: 'undecryptable' }, now).state, 'HUMAN_LOGIN_REQUIRED')
  // Workana: el probe en un navegador nuevo cae en /login.
  assert.equal(sessionStateFrom({ stored: 'present', probe: { status: 'expired' } }, now).state, 'HUMAN_LOGIN_REQUIRED')
  assert.equal(sessionStateFrom({ stored: 'present', probe: { status: 'human_required' } }, now).state, 'PLATFORM_BLOCKED')
  assert.equal(sessionStateFrom({ stored: 'present', probe: { status: 'ready' } }, now).state, 'CONNECTED')
  assert.equal(sessionStateFrom({ stored: 'present', probe: { status: 'ready' }, expiresAt: now + 3600000 }, now).state, 'REFRESH_REQUIRED')
  // Guardada pero sin probe reciente: nunca CONNECTED por suposición.
  assert.equal(sessionStateFrom({ stored: 'present', lastSuccess: now - 30 * 3600000 }, now).state, 'REFRESH_REQUIRED')
})

test('opportunity score: target roles grade high, SEO PM and off-profile roles are rejected', async () => {
  const { scoreOpportunity, proposalQuality } = await import('../worker/prospecting/opportunities.js')
  const seo = scoreOpportunity({ title: 'SEO Project Manager (Remote, Cali)', company: 'Acme', description: 'Manage SEO projects, keyword research, backlinks and content calendars.' })
  assert.equal(seo.grade, 'C')
  const good = scoreOpportunity({ title: 'AI Automation Specialist - Ecommerce Operations', company: 'Spreetail', location: 'Remote', description: 'Build AI agents and workflow automation with n8n, Shopify and CRM for ecommerce operations. Long-term contract, remote, LATAM welcome.' })
  assert.ok(good.grade === 'A' || good.grade === 'B', JSON.stringify(good))
  const dev = scoreOpportunity({ title: 'Senior Backend Engineer (Golang, Kubernetes)', company: 'X', description: 'AI platform' })
  assert.equal(dev.grade, 'C')
  assert.equal(scoreOpportunity({ title: 'Video Editor for AI ads', description: 'edit videos' }).grade, 'C')
  const o = { title: 'AI Automation Specialist', company: 'Spreetail', description: 'Build AI agents workflow automation shopify operations fulfillment' }
  assert.equal(proposalQuality('Hi, I saw your offer and I am very passionate. ' + 'word '.repeat(150), o), 'company_not_mentioned')
})

test('dry-run 6-oct regressions: on-site events, spoken-English sales roles and false claims are blocked', async () => {
  const { scoreOpportunity, proposalQuality } = await import('../worker/prospecting/opportunities.js')
  assert.equal(scoreOpportunity({ title: 'Maisa Career Day MADRID: AI Automation Consultant', company: 'Maisa', description: 'AI automation digital workers. Join us in person at our Career Day in Madrid.' }).grade, 'C')
  assert.equal(scoreOpportunity({ title: 'Sales & Partnerships Specialist', company: 'MoveWise', description: 'Close inbound leads on consultative calls. Fluent English required. CRM automation, WhatsApp.' }).grade, 'C')
  const o = { title: 'AI Automation Consultant', company: 'Maisa', description: 'digital workers automation consultant maisa studio connectors production deployment testing' }
  const base = 'En Maisa los digital workers necesitan pruebas en produccion. Diseñé LAURA, un sistema multiagente, y CAROLINA. Propongo auditar connectors, testing y deployment en Maisa Studio para production con documentation y runbooks. ' + 'Detalle operativo concreto del despliegue y medición del resultado. '.repeat(14) + ' https://soycatalinajaramillo.com'
  assert.equal(proposalQuality(base, o), true)
  assert.equal(proposalQuality(base + ' I have working professional English.', o), 'language_claim')
  assert.equal(proposalQuality(base + ' Tengo disponibilidad para viajar a Alicante.', o), 'invented_availability')
  assert.equal(proposalQuality(base + ' LAURA handles thousands of live interactions.', o), 'unverified_volume')
  assert.equal(proposalQuality(base + ' En mis primeros 30 días con el equipo de Laura.', o), 'laura_as_person')
})

test('brief veto: on-site or spoken-English-critical roles found in the brief are not prepared', async () => {
  const { briefVeto } = await import('../worker/prospecting/opportunities.js')
  assert.equal(briefVeto({ risk: 'Hybrid work in Portugal / language barrier' }), 'onsite')
  assert.equal(briefVeto({ risk: "Exigencia de 'excellent spoken English' para llamadas activas" }), 'spoken_english_critical')
  assert.equal(briefVeto({ risk: 'Requires fluent English client presentations' }), 'spoken_english_critical')
  assert.equal(briefVeto({ risk: 'Language constraint for live calls' }), 'spoken_english_critical')
  assert.equal(briefVeto({ risk: 'Idioma portugués / ubicación en Brasil' }), 'language_not_spanish_or_english')
  assert.equal(briefVeto({ risk: 'El cliente es de EE. UU.; comunicación escrita asíncrona' }), null)
})

test('allocator: targets follow expected revenue and blocked channels get zero', async () => {
  const { targetsFromAllocation } = await import('../worker/core/revenueMetrics.js')
  const t = targetsFromAllocation({ channels: [{ channel: 'direct_outbound', actions: 0 }, { channel: 'job_applications', actions: 15 }, { channel: 'project_bids', actions: 0 }, { channel: 'intent_signals', actions: 12 }, { channel: 'partnerships', actions: 0 }] })
  assert.equal(t.outbound, 0); assert.equal(t.marketplaces, 0); assert.equal(t.directApplications, 15); assert.equal(t.intent, 12)
})

test('language truth: unverified interpretation claims are replaced before any automatic send', async () => {
  const { enforceLanguageTruth } = await import('../worker/interpreter/disclosure.js')
  const es = 'Diseñé LAURA. Mi idioma nativo es español y mi inglés oral es básico; en reuniones uso interpretación con IA en tiempo real y escribo con asistencia de IA. ¿Hablamos?'
  const out = enforceLanguageTruth(es, {}, 'es')
  assert.ok(!/interpretaci/i.test(out)); assert.match(out, /comunicación escrita es fluida/); assert.match(out, /Diseñé LAURA/)
  assert.equal(enforceLanguageTruth(es, { OPENAI_API_KEY: 'k', INTERPRETER_VERIFIED: 'true' }, 'es'), es)
  const en = "I built LAURA. I'm a native Spanish speaker; for live meetings I use a real-time AI interpretation agent. Let's talk."
  assert.ok(!/interpretation/i.test(enforceLanguageTruth(en, {}, 'en')))
})

test('opportunity routing: only public ATS links are auto-submittable', async () => {
  const { atsApplyUrl } = await import('../worker/prospecting/opportunities.js')
  assert.ok(atsApplyUrl('https://jobs.lever.co/acme/123'))
  assert.ok(atsApplyUrl('https://jobs.ashbyhq.com/acme/abc'))
  assert.equal(atsApplyUrl('https://www.linkedin.com/jobs/view/1'), null)
  assert.equal(atsApplyUrl('http://jobs.lever.co/acme'), null)
})
