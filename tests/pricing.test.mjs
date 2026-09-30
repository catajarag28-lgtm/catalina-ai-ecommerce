import test from 'node:test'
import assert from 'node:assert/strict'
import { pricing, constitution, knowledge } from '../worker/core/knowledge.js'
import { recommend, catalog } from '../src/offers.js'
import { cleanLead } from '../worker/index.js'
import { buildMime, leadEmail } from '../worker/core/notify.js'

test('Carolina cites only catalog prices', () => {
  assert.deepEqual(pricing.map(item => item.fromUSD), catalog.map(item => item.fromUSD))
  assert.doesNotMatch(constitution, /2\.800/)
  assert.match(knowledge, /PRICING_RULES=/)
})

test('recommendation ranges stay inside the catalog tier', () => {
  const cases = [
    { business: 'Salud, estética o bienestar', goal: 'Agendar citas sin perseguir a nadie', tools: ['WhatsApp'], volume: '100 a 500', timing: 'Este mes' },
    { business: 'Tienda online / e-commerce', goal: 'Atención y postventa', tools: ['WhatsApp', 'Instagram / Facebook', 'Shopify u otra tienda'], volume: 'Más de 2.000', timing: 'Este mes' },
    { business: 'Otro', goal: 'Responder y vender más', tools: ['Excel o nada'], volume: 'Menos de 100', timing: 'Estoy explorando' },
    { business: 'Servicios profesionales', goal: 'Todo: quiero un sistema completo', tools: ['CRM'], volume: '500 a 2.000', timing: 'En 1 a 3 meses' },
  ]
  const expected = ['ventas', 'ecommerce', 'esencial', 'multiagente']
  cases.forEach((answers, i) => {
    const r = recommend(answers)
    const tier = catalog.find(item => item.id === r.id)
    assert.equal(r.id, expected[i])
    assert.ok(r.low >= tier.fromUSD && r.high >= r.low)
  })
  assert.ok(recommend(cases[2]).diagnosisFirst)
})

test('lead payload is sanitized and requires source whitelist', () => {
  const lead = cleanLead({ source: 'evil', name: ' Ana ', email: 'ana@clinica.com', tools: ['WhatsApp', 3], extra: 'x' })
  assert.equal(lead.source, 'contact')
  assert.equal(lead.name, 'Ana')
  assert.deepEqual(lead.tools, ['WhatsApp'])
  assert.equal(lead.extra, undefined)
})

test('notification email is valid UTF-8 MIME', () => {
  const mail = leadEmail({ source: 'diagnosis', company: 'Clínica Sonrisa', email: 'ana@clinica.com', tools: ['WhatsApp'] })
  assert.match(mail.subject, /Clínica Sonrisa/)
  const raw = buildMime({ from: 'carolina@soycatalinajaramillo.com', to: 'x@gmail.com', subject: mail.subject, text: mail.text, replyTo: 'ana@clinica.com' })
  assert.match(raw, /Subject: =\?UTF-8\?B\?/)
  assert.match(raw, /Reply-To: <ana@clinica.com>/)
  const body = raw.split('\r\n\r\n')[1].replace(/\r\n/g, '')
  assert.match(new TextDecoder().decode(Uint8Array.from(atob(body), c => c.charCodeAt(0))), /Clínica Sonrisa/)
})
