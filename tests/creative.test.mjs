import test from 'node:test'
import assert from 'node:assert/strict'
import { brandedProposal, inBusinessHours } from '../worker/proposals/outreach.js'
import { renderProposalPage } from '../worker/proposals/proposalPage.js'
import { lintCopy } from '../worker/skills/copywriting.js'
import { chooseAngle, engagementScore, seedAngles } from '../worker/proposals/creative.js'
import { detectSignals, pickBusinessEmail } from '../worker/core/integrations.js'
import { excludedHosts, segments } from '../worker/prospecting/discovery.js'

const good = {
  offer: 'esencial', subject: '¿Qué ve una novia antes de reservar su head spa?', preview: 'Preparé cómo podría sentirse esa primera consulta en Ava, con lo que ya publican en su web.',
  hook: 'Que una consulta de head spa llegue al equipo lista para confirmar.', subhook: 'La escena muestra cómo podría verse ese primer contacto fuera de horario.',
  offerPitch: 'Desarrollar para Ava un agente personalizado que atienda consultas iniciales, recoja contexto y entregue al equipo cada solicitud lista para continuar.',
  observation: 'Ava ofrece head spa y reserva por Booksy.', evidence: 'head spa', hypothesis: 'Si muchas consultas llegan por WhatsApp fuera de horario, podría ayudar una primera respuesta con contexto.',
  scene: { channel: 'WhatsApp', time: 'Domingo · 9:40 p. m.', customer: '¿Tienen head spa para una novia el sábado?', agent: 'Sí, ofrecemos head spa. Puede reservar en Booksy o le paso con el equipo.', handoff: 'nombre, fecha deseada y servicio' },
  moments: [{ title: 'Antes', text: 'a' }, { title: 'Durante', text: 'b' }, { title: 'Después', text: 'c' }],
  solution: 'Probar un agente supervisado con su equipo.', ps: 'En la página verá qué pasa el lunes a primera hora.',
}

test('Visual and letter emails render the scene, one CTA and no price', () => {
  for (const format of ['visual', 'carta']) {
    const html = brandedProposal('Ava <Spa>', { ...good, format }, 'https://soycatalinajaramillo.com/propuesta/abc', null, { postal: '123 Calle, Miami FL' })
    assert.ok(html.includes('Tienen head spa'))
    assert.ok(html.includes('Soy Catalina Jaramillo'))
    assert.ok(html.includes('quiero proponerle algo concreto'))
    assert.ok(html.includes('Ver la propuesta para'))
    assert.ok(html.includes('+1 786 929 9442'))
    assert.ok(html.includes('Solo WhatsApp, no llamadas'))
    assert.ok(html.includes('BAJA') && html.includes('123 Calle'))
    assert.ok(!/USD|\$\d|3\.800|2\.200/.test(html))
    assert.ok(!html.includes('Ava <Spa>'))
    assert.ok(html.length < 60000)
  }
})

test('Proposal page escapes content, links to Carolina and never shows price', () => {
  const page = renderProposalPage({ id: 'abcdefghijklmnopqrstu', company: '<script>x</script>', proposal: good, subject: 's' })
  assert.ok(!page.includes('<script>x'))
  assert.ok(page.includes('/propuesta/abcdefghijklmnopqrstu/hablar'))
  assert.ok(!/USD|precio:/i.test(page))
})

test('Copy linter blocks weak, deceptive or priced copy', () => {
  assert.deepEqual(lintCopy(good, 'Ava'), [])
  assert.ok(lintCopy({ ...good, subject: 'Propuesta de IA para ustedes!' }).length > 0)
  assert.ok(lintCopy({ ...good, hook: 'Ustedes pierden ventas cada noche' }).some(x => x.includes('carencia')))
  assert.ok(lintCopy({ ...good, ps: 'Desde USD 2.200' }).some(x => x.includes('precio')))
  assert.ok(lintCopy({ ...good, scene: null }).some(x => x.includes('escena')))
  assert.ok(lintCopy({ ...good, offerPitch: '' }).some(x => x.includes('oferta explícita')))
  assert.ok(lintCopy({ ...good, hook: 'Domingo, 9:40 p. m. Una novia pregunta por su head spa.' }).some(x => x.includes('titular narrativo')))
})

test('Angle selection favours what earns interest but keeps exploring', () => {
  const angles = seedAngles.slice(0, 2)
  const stats = { [angles[0].id]: { n: 60, score: 18 }, [angles[1].id]: { n: 60, score: 0 } }
  let wins = 0
  for (let i = 0; i < 400; i++) if (chooseAngle(angles, stats).id === angles[0].id) wins++
  assert.ok(wins > 360)
  assert.equal(engagementScore({ replied: 1, positive: 1 }), 1)
  assert.equal(engagementScore({ replied: 1 }), 0.3)
  assert.equal(engagementScore({ meeting: 1 }), 1)
  assert.equal(engagementScore({ opened: 1 }), 0.2)
})

test('Business hours respect the recipient market', () => {
  const mondayNoonNY = Date.parse('2026-10-05T16:00:00Z')
  const sundayNY = Date.parse('2026-10-04T16:00:00Z')
  assert.equal(inBusinessHours('EE. UU.', mondayNoonNY), true)
  assert.equal(inBusinessHours('EE. UU.', sundayNY), false)
  assert.equal(inBusinessHours('EE. UU.', Date.parse('2026-10-05T03:00:00Z')), false)
})

test('Research detects tools, prefers the business mailbox and skips directories', () => {
  const s = detectSignals('<a href="https://booksy.com/x">Reservar</a><a href="https://wa.me/1305">WA</a><form></form>', [])
  assert.equal(s.reservas, 'booksy'); assert.ok(s.whatsapp); assert.equal(s.formularios, 1)
  assert.equal(pickBusinessEmail(['owner@gmail.com', 'info@avaspa.com'], 'avaspa.com'), 'info@avaspa.com')
  assert.equal(pickBusinessEmail(['avaspa@gmail.com'], 'avaspa.com'), 'avaspa@gmail.com')
  assert.equal(pickBusinessEmail([], 'x.com'), null)
  for (const h of ['yelp.com', 'www.doctoralia.com.mx', 'zillow.com', 'booksy.com']) assert.ok(excludedHosts.test(h), h)
  assert.ok(!excludedHosts.test('avaluxuryspa.com'))
  assert.ok(!segments.some(s => s.region === 'España'))
})

import { demoPrompt, handleDemo } from '../worker/proposals/demo.js'
test('Live demo is grounded in public text, blocks clinical advice and unknown proposals', async () => {
  const prompt = demoPrompt('Ava Spa', { publicText: 'Head spa y masajes. Sábados 9 a 2.', diagnosis: { services: ['Head spa'] } })
  assert.ok(prompt.includes('Ava Spa') && prompt.includes('Sábados 9 a 2') && /Nunca recomiendes tratamientos/.test(prompt))
  const env = { DB: { prepare: () => ({ bind: () => ({ first: async () => null }) }) } }
  const res = await handleDemo(new Request('https://x/propuesta/abcdefghijklmnopqrstu/demo', { method: 'POST', body: '{}' }), env, 'abcdefghijklmnopqrstu')
  assert.equal(res.status, 404)
})
test('Proposal page ships the demo script only with its nonce', () => {
  const page = renderProposalPage({ id: 'abcdefghijklmnopqrstu', company: 'Ava', proposal: good, subject: 's', nonce: 'abc123' })
  assert.ok(page.includes('<script nonce="abc123">'))
  assert.equal((page.match(/<script/g) || []).length, 1)
  assert.ok(page.includes("fetch('/propuesta/abcdefghijklmnopqrstu/demo'"))
})
import { evidenceFound } from '../worker/proposals/outreach.js'
test('Evidence must be on the site, tolerant only to accents, quotes and case', () => {
  const text = 'Te respondo yo, no un robot. Atendemos en Adriana Plaza de lunes a sábado.'
  assert.ok(evidenceFound(text, '“Te respondo YO, no un robót”'))
  assert.ok(evidenceFound(text, 'Te respondo yo… Atendemos en Adriana Plaza'))
  assert.ok(!evidenceFound(text, 'Tenemos 20 años de experiencia'))
  assert.ok(!evidenceFound(text, 'yo'))
})
import { blockedRegions } from '../worker/proposals/outreach.js'
test('Spain is excluded from cold outreach', () => { assert.ok(blockedRegions.has('España')) })
test('Headline cannot promise unverified outcomes', () => {
  assert.ok(lintCopy({ ...good, subhook: 'Aclarar la dinámica evita reservas abandonadas.' }).some(x => x.includes('resultado no verificado')))
  assert.deepEqual(lintCopy(good, 'Ava'), [])
})
import { whatsappMessage } from '../worker/proposals/engagement.js'
test('Direct WhatsApp message is personal, links the proposal and has no price', () => {
  const m = whatsappMessage({ id: 'abc', company: 'Ava Spa' })
  assert.ok(m.includes('Ava Spa') && m.includes('/propuesta/abc') && !/USD|\$/.test(m))
})
import { hotFollowupText } from '../worker/proposals/outreach.js'
test('Hot follow-up invites to a meeting, never claims a booking, offers BAJA', () => {
  const t = hotFollowupText({ SENDER_POSTAL_ADDRESS: '14818 SW 180th Terrace' }, { company: 'Ava Spa' }, 'demo')
  assert.ok(t.includes('Ava Spa') && t.includes('20 minutos') && t.includes('BAJA') && t.includes('14818'))
  assert.ok(!/agendad[ao] (para|el)/i.test(t) && !/USD|\$/.test(t))
})
import { partnerPlaybook } from '../worker/skills/proposalPlaybook.js'
test('Partner proposals never fix a commission and partner pages skip the demo', () => {
  assert.ok(/NUNCA des porcentajes/.test(partnerPlaybook))
  assert.ok(segments.some(s => s.kind === 'partner'))
  const page = renderProposalPage({ id: 'abcdefghijklmnopqrstu', company: 'Agencia', proposal: good, subject: 's', nonce: 'n', demo: false })
  assert.ok(!page.includes('<script'))
  const t = hotFollowupText({}, { company: 'Agencia X', kind: 'partner' }, 'view')
  assert.ok(t.includes('alianza') && !/%/.test(t))
})
import { pickSegment } from '../worker/prospecting/discovery.js'
test('Segments that earn interest get searched more often', () => {
  const boosted = segments.find(s => s.id === 'fl-dental')
  let hits = 0
  for (let i = 0; i < 2000; i++) if (pickSegment({ 'fl-dental': 3 }).id === 'fl-dental') hits++
  let base = 0
  for (let i = 0; i < 2000; i++) if (pickSegment({}).id === 'fl-dental') base++
  assert.ok(boosted && hits > base * 1.8)
})
import { carolinaSkills, skillsPrompt, skill } from '../worker/skills/registry.js'
test('Carolina has one organized skill registry used by chat and proposals', () => {
  const ids = carolinaSkills.map(s => s.id)
  for (const id of ['mision-y-principios', 'posicionamiento-senior', 'prospeccion', 'investigacion-de-negocio', 'copywriting-email', 'propuesta-senior', 'seguimiento-y-cierre', 'agenda', 'aliados', 'intencion-en-foros', 'aprendizaje-continuo', 'mapa-de-oportunidades']) assert.ok(ids.includes(id), id)
  assert.ok(skill('posicionamiento-senior').includes('multiagente') && !/hace chatbots"?\s*\./.test(skillsPrompt(['posicionamiento-senior']).replace('"hace chatbots"', '')))
  assert.ok(/primer correo no lleva precio/.test(skill('mision-y-principios')))
  assert.ok(/mapa de oportunidades|Mapa de oportunidades/i.test(skill('mapa-de-oportunidades')))
})
test('Scenes adapt to the solution: workflow and dashboard render without chat demo or invented numbers', () => {
  const flow = { ...good, scene: { type: 'flujo', title: 'Recuperación de cancelaciones', steps: [{ when: 'Cancelación', what: 'Se detecta en la agenda' }, { what: 'Se ofrece un nuevo horario' }, { what: 'El equipo recibe el caso' }] } }
  assert.deepEqual(lintCopy(flow, 'Ava'), [])
  const mail = brandedProposal('Ava', flow, 'https://soycatalinajaramillo.com/propuesta/abc')
  assert.ok(mail.includes('Recuperación de cancelaciones') && !mail.includes('Incluye una demo'))
  const page = renderProposalPage({ id: 'abcdefghijklmnopqrstu', company: 'Ava', proposal: { ...flow, logo: 'https://ava.example/logo.png' }, subject: 's', nonce: 'n' })
  assert.ok(page.includes('class="flow"') && !page.includes('<script') && page.includes('https://ava.example/logo.png'))
  const board = { ...good, scene: { type: 'tablero', title: 'Sedes', tiles: ['Facturación por sede', 'Citas perdidas', 'Pagos pendientes'], alert: 'Una sede sin cierre de caja' } }
  assert.deepEqual(lintCopy(board, 'Ava'), [])
  assert.ok(lintCopy({ ...board, scene: { ...board.scene, tiles: ['Ventas 45%', 'x', 'y'] } }).some(x => x.includes('cifras')))
})



test('Copy length no longer rejects a researched email merely for exceeding 110 words', () => {
  const filler = Array(55).fill('contexto').join(' ')
  const issues = lintCopy({ ...good, ps: filler }, 'Ava')
  assert.ok(!issues.some(x => x.includes('110 palabras')))
  assert.ok(!issues.some(x => x.includes('180 palabras')))
})

test('Personalized proposal renders a phased sector roadmap', () => {
  const proposal = { ...good, roadmap: [
    { level: 'Base', title: 'Calificación inicial', items: ['WhatsApp', 'Calificación', 'Handoff'] },
    { level: 'Crecimiento', title: 'CRM y visitas', items: ['Inventario', 'Agenda', 'Seguimiento'] },
    { level: 'Sistema integral', title: 'Operación comercial', items: ['Routing', 'Dashboard', 'Alertas'] },
  ] }
  const page = renderProposalPage({ id: 'abcdefghijklmnopqrstu', company: 'Inmobiliaria Demo', proposal, subject: 's', nonce: 'n', demo: false })
  assert.ok(page.includes('De un piloto útil a un sistema completo'))
  assert.ok(page.includes('Calificación inicial') && page.includes('CRM y visitas') && page.includes('Operación comercial'))
})

test('Carolina includes a real-estate sector playbook and prioritized real-estate segments', () => {
  assert.ok(skill('playbook-inmobiliario').includes('inventario real'))
  assert.ok(skill('playbook-inmobiliario').includes('agenda'))
  assert.ok(skill('playbook-inmobiliario').includes('arrendamientos'))
  for (const id of ['miami-realestate','tx-realestate','pr-realestate','pa-realestate','mx-realestate','do-realestate']) {
    assert.ok(segments.some(s => s.id === id), id)
  }
})


import { revenueTargets } from '../worker/core/revenueOS.js'

test('Revenue OS redistributes capacity when cold outreach is paused', () => {
  const paused = revenueTargets(true)
  const active = revenueTargets(false)
  assert.equal(paused.outbound, 0)
  assert.ok(paused.directApplications > active.directApplications)
  assert.ok(paused.marketplaces > active.marketplaces)
  assert.ok(paused.intent > active.intent)
  assert.ok(paused.partners > active.partners)
  assert.equal(Object.values(paused).reduce((a,b)=>a+b,0), 50)
})

test('Partner discovery can select only partner segments', () => {
  for (let i=0;i<50;i++) {
    const selected = pickSegment({}, Math.random(), s => s.kind === 'partner')
    assert.equal(selected.kind, 'partner')
  }
})
