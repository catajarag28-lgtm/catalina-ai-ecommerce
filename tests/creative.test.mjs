import test from 'node:test'
import assert from 'node:assert/strict'
import { brandedProposal, inBusinessHours } from '../worker/outreach.js'
import { renderProposalPage } from '../worker/proposalPage.js'
import { lintCopy } from '../worker/copywriting.js'
import { chooseAngle, engagementScore, seedAngles } from '../worker/creative.js'
import { detectSignals, pickBusinessEmail } from '../worker/integrations.js'
import { excludedHosts, segments } from '../worker/discovery.js'

const good = {
  offer: 'esencial', subject: '¿Qué ve una novia antes de reservar su head spa?', preview: 'Preparé cómo podría sentirse esa primera consulta en Ava, con lo que ya publican en su web.',
  hook: 'Domingo, 9:40 p. m. Una novia pregunta por su head spa.', subhook: 'Así podría continuar esa conversación.',
  observation: 'Ava ofrece head spa y reserva por Booksy.', evidence: 'head spa', hypothesis: 'Si muchas consultas llegan por WhatsApp fuera de horario, podría ayudar una primera respuesta con contexto.',
  scene: { channel: 'WhatsApp', time: 'Domingo · 9:40 p. m.', customer: '¿Tienen head spa para una novia el sábado?', agent: 'Sí, ofrecemos head spa. Puede reservar en Booksy o le paso con el equipo.', handoff: 'nombre, fecha deseada y servicio' },
  moments: [{ title: 'Antes', text: 'a' }, { title: 'Durante', text: 'b' }, { title: 'Después', text: 'c' }],
  solution: 'Probar un agente supervisado con su equipo.', ps: 'En la página verá qué pasa el lunes a primera hora.',
}

test('Visual and letter emails render the scene, one CTA and no price', () => {
  for (const format of ['visual', 'carta']) {
    const html = brandedProposal('Ava <Spa>', { ...good, format }, 'https://soycatalinajaramillo.com/propuesta/abc', null, { postal: '123 Calle, Miami FL' })
    assert.ok(html.includes('Tienen head spa'))
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
})

test('Angle selection favours what earns interest but keeps exploring', () => {
  const angles = seedAngles.slice(0, 2)
  const stats = { [angles[0].id]: { n: 60, score: 18 }, [angles[1].id]: { n: 60, score: 0 } }
  let wins = 0
  for (let i = 0; i < 400; i++) if (chooseAngle(angles, stats).id === angles[0].id) wins++
  assert.ok(wins > 360)
  assert.equal(engagementScore({ replied: 1 }), 1)
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
