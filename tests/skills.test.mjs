import test from 'node:test'
import assert from 'node:assert/strict'
import { selectSkills, skillContext } from '../worker/skills/chatSkills.js'

test('Carolina selects ecommerce and post-sale skills from a real pain', () => {
  const ids = selectSkills('Tenemos carritos abandonados, devoluciones y queremos venta cruzada en Shopify').map(skill => skill.id)
  assert.ok(ids.includes('atencion-y-postventa'))
  assert.ok(ids.includes('ecommerce-growth'))
})

test('Carolina adapts examples to a profession', () => {
  assert.match(skillContext('Soy odontóloga y necesito agendar pacientes'), /PROFESIONES/)
})
