import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkOutreachHealth } from '../worker/proposals/engagement.js'

const NOW = Date.parse('2026-10-10T02:00:00Z')
const DAY = 86_400_000

test('a paused domain never resumes automatically after 72 hours', async () => {
  const writes = []
  const env = { DB: { prepare(sql) { return {
    bind(...args) { this.args = args; return this },
    async first() {
      if (sql.includes('SELECT paused,reason,updated_at')) return {
        paused: 1, reason: 'Quejas o rebotes por encima del umbral seguro',
        updated_at: NOW - 15 * DAY,
      }
      if (sql.includes("type='email.complained'")) return { n: 0 }
      throw new Error('Must not query sends while paused: ' + sql)
    },
    async run() { writes.push(sql); return { success: true } },
  } } } }
  const result = await checkOutreachHealth(env, NOW)
  assert.deepEqual(result, { paused: true, reason: 'Quejas o rebotes por encima del umbral seguro' })
  assert.equal(writes.length, 0, 'no automatic unpause or write may occur')
})

test('email health does not hide six bounces by resetting the window', async () => {
  const writes = [], reads = []
  const env = { DB: { prepare(sql) { return {
    bind(...args) { this.args = args; return this },
    async first() {
      reads.push({ sql, args: this.args || [] })
      if (sql.includes('SELECT paused,reason,updated_at')) return { paused: 0, reason: 'manually resumed', updated_at: NOW }
      if (sql.includes("type='email.complained'")) return { n: 0 }
      if (sql.includes('FROM outreach WHERE sent_at')) return { n: 58 }
      if (sql.includes("type='email.bounced'")) return { n: this.args?.[0] === NOW - DAY ? 2 : 6 }
      throw new Error('Unexpected read: ' + sql)
    },
    async run() { writes.push({ sql, args: this.args || [] }); return { success: true } },
  } } } }
  const result = await checkOutreachHealth(env, NOW)
  assert.deepEqual(result, { paused: true, reason: 'delivery' })
  assert.ok(reads.some(r => r.sql.includes("type='email.bounced'") && r.args[0] === NOW - 7 * DAY))
  assert.ok(reads.some(r => r.sql.includes("type='email.bounced'") && r.args[0] === NOW - DAY))
  assert.ok(writes.some(w => w.sql.includes('SET paused=1')))
  assert.ok(!writes.some(w => w.sql.includes('paused=0')))
  assert.ok(!reads.some(r => r.sql.includes('bounce_reset_at')))
})

test('historical reopen shell utility is diagnostic-only', () => {
  const shell = readFileSync(new URL('../scripts/reanudar-envio.sh', import.meta.url), 'utf8')
  assert.doesNotMatch(shell, /SET paused\s*=\s*0/i)
  assert.doesNotMatch(shell, /SET bounce_reset_at/i)
  assert.match(shell, /SOLO LECTURA/)
})
