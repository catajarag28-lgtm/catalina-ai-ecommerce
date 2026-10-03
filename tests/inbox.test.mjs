import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldSkip, isUnsubscribe, parseDecision, obviousInboundCategory } from '../worker/core/inbox.js'

test('Carolina never answers automated mail, lists or her own domain', () => {
  assert.equal(shouldSkip({ from: 'ana@clinica.com' }), null)
  assert.equal(shouldSkip({ from: 'noreply@stripe.com' }), 'automated_sender')
  assert.equal(shouldSkip({ from: 'carolina@soycatalinajaramillo.com' }), 'own_domain')
  assert.equal(shouldSkip({ from: 'ana@clinica.com', headers: { 'Auto-Submitted': 'auto-replied' } }), 'auto_submitted')
  assert.equal(shouldSkip({ from: 'news@tienda.com', headers: { 'List-Unsubscribe': '<mailto:x>' } }), 'mailing_list')
  assert.equal(shouldSkip({ from: 'not-an-email' }), 'invalid_sender')
})

test('unsubscribe requests are detected', () => {
  assert.ok(isUnsubscribe('BAJA', ''))
  assert.ok(isUnsubscribe('Re: propuesta', 'Baja por favor'))
  assert.ok(!isUnsubscribe('Re: propuesta', 'Me interesa, ¿cuándo hablamos?'))
})

test('obvious inbound commercial intent is detected before giving up as other', () => {
  assert.equal(obviousInboundCategory('Consulta', 'Tenemos prospectos sin seguimiento y quiero saber si Catalina puede ayudarnos a automatizar WhatsApp. ¿Cuál sería el siguiente paso?'), 'prospect')
  assert.equal(obviousInboundCategory('Reunión', '¿Podemos agendar una videollamada para el martes?'), 'meeting')
  assert.equal(obviousInboundCategory('Información', '¿Cuánto cuesta y qué incluye el servicio?'), 'question')
  assert.equal(obviousInboundCategory('Hola', 'Gracias por compartir el artículo.'), null)
})

test('model decisions are sanitized: no reply for spam or vendors', () => {
  const ok = parseDecision('```json\n{"category":"prospect","reply":"Hola Ana, gracias por escribir. Te propongo una reunión de 30 minutos.","summary":"Clínica interesada","hot":true}\n```')
  assert.equal(ok.category, 'prospect'); assert.ok(ok.reply); assert.equal(ok.hot, true)
  assert.equal(parseDecision('{"category":"vendor","reply":"Gracias por su oferta, la revisaremos con calma."}').reply, null)
  assert.equal(parseDecision('no json').category, 'other')
})
