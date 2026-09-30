import test from 'node:test'
import assert from 'node:assert/strict'
import { pricing, constitution } from '../worker/knowledge.js'

test('Carolina only quotes the approved starting point', () => {
  assert.deepEqual(pricing.map(item => item.setupFromUSD).filter(Number.isFinite), [2800])
  assert.ok(pricing.every(item => item.monthlyFromUSD == null))
  assert.match(constitution, /no hay mensualidad aprobada/i)
})
