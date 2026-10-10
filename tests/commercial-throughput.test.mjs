import test from 'node:test'
import assert from 'node:assert/strict'
import { bogotaBusinessWindow, evaluateCommercialThroughput, commercialThroughputSnapshot } from '../worker/core/commercialThroughput.js'
import { verifyMailbox } from '../worker/core/integrations.js'

const FRIDAY = Date.parse('2026-10-10T00:00:00Z') // 7 p. m. del viernes en Bogota

test('la semana de negocios en Colombia comienza lunes y cierra viernes', () => {
  const w = bogotaBusinessWindow(FRIDAY)
  assert.equal(new Date(w.dayStart).toISOString(), '2026-10-09T05:00:00.000Z')
  assert.equal(new Date(w.weekStart).toISOString(), '2026-10-05T05:00:00.000Z')
  assert.equal(w.remainingBusinessDays, 1)
  assert.equal(w.businessDay, true)
  const weekend = bogotaBusinessWindow(Date.parse('2026-10-10T13:00:00Z'))
  assert.equal(weekend.businessDay, false)
  assert.equal(weekend.remainingBusinessDays, 0)
})

test('750 es capacidad semanal, no envios inventados', () => {
  const p = evaluateCommercialThroughput({ now: FRIDAY, paused: true })
  assert.equal(p.goals.weekly, 750)
  assert.equal(p.goals.daily, 150)
  assert.equal(p.actual.weeklyConfirmed, 0)
  assert.equal(p.actual.dailyConfirmed, 0)
  assert.equal(p.gap.weekly, 750)
  assert.equal(p.gap.onPace, false)
  assert.equal(p.safeguards.coldEmailPaused, true)
  assert.equal(p.safeguards.dailyTargetDoesNotAuthorizeSending, true)
})

test('solo acciones externas confirmadas cuentan y se separan de drafts', () => {
  const p = evaluateCommercialThroughput({
    now: FRIDAY,
    daily: { directApplications: 2, marketplaceBids: 1, enterpriseOutreach: 0, agencyPartners: 2 },
    weekly: { directApplications: 5, marketplaceBids: 4, enterpriseOutreach: 0, agencyPartners: 3 },
    pending: { directPublicRoutes: 20, marketplacePrepared: 70, enterprisesUnverified: 90 },
    paused: true, spent: 1.25, budget: 2,
  })
  assert.equal(p.actual.dailyConfirmed, 5)
  assert.equal(p.actual.weeklyConfirmed, 12)
  assert.equal(p.gap.daily, 145)
  assert.equal(p.gap.weekly, 738)
  assert.equal(p.readiness.marketplacePreparedNotSubmitted, 70)
  assert.equal(p.readiness.unverifiedDraftsExcluded, 160)
  assert.equal(p.readiness.immediatelyExposableConfirmedActions, 20)
  assert.equal(p.safeguards.aiRemainingTodayUsd, 0.75)
})

test('presupuesto agotado no se sustituye por una promesa de volumen', () => {
  const p = evaluateCommercialThroughput({ now: FRIDAY, spent: 2.8, budget: 2,
    weekly: { directApplications: 4 } })
  assert.equal(p.safeguards.aiBudgetExhausted, true)
  assert.equal(p.safeguards.aiRemainingTodayUsd, 0)
  assert.equal(p.actual.weeklyConfirmed, 4)
})

test('cero meta diaria los fines de semana y sin permision de enviar', () => {
  const p = evaluateCommercialThroughput({ now: Date.parse('2026-10-10T13:00:00Z') })
  assert.equal(p.goals.daily, 0)
  assert.equal(p.safeguards.dailyTargetDoesNotAuthorizeSending, true)
})

test('el medidor D1 exige provider IDs y no suma registros prepared', async () => {
  const sqlSeen = []
  const env = {
    AI_DAILY_BUDGET_USD: '2',
    COMMERCIAL_ACTIONS_DAILY_TARGET: '150',
    COMMERCIAL_ACTIONS_WEEKLY_TARGET: '750',
    DB: {
      prepare(sql) {
        sqlSeen.push(sql)
        return {
          bind() { return this },
          async first() {
            if (sql.includes('SELECT paused FROM outreach_control')) return { paused: 1 }
            if (sql.includes('ai_calls')) return { n: 1.2 }
            if (sql.includes('execution_queue')) return { n: 15 }
            if (sql.includes("status='ready_for_submission'")) return { n: 11 }
            if (sql.includes("status='pending'")) return { n: 78 }
            if (sql.includes('UNION')) return { n: 2 }
            if (sql.includes("status='submitted' AND provider_id")) return { n: 1 }
            if (sql.includes("kind NOT IN")) return { n: 0 }
            if (sql.includes("kind='partner'")) return { n: 0 }
            throw new Error('SQL not accounted for')
          },
        }
      },
    },
  }
  const result = await commercialThroughputSnapshot(env, FRIDAY)
  assert.equal(result.actual.dailyConfirmed, 3)
  assert.equal(result.actual.weeklyConfirmed, 3)
  assert.equal(result.readiness.marketplacePreparedNotSubmitted, 11)
  assert.ok(sqlSeen.some(s => s.includes('UNION') && s.includes('provider_id') && s.includes('$.providerId')))
  assert.ok(sqlSeen.some(s => s.includes("status='submitted' AND provider_id")))
})

test('el validador de correo falla cerrado cuando no hay proveedor', async () => {
  const r = await verifyMailbox({}, 'persona@empresa.com')
  assert.equal(r.checked, false)
  assert.equal(r.sendable, false)
})

test('el validador de correo solo acepta el resultado ok', async () => {
  const orig = globalThis.fetch
  try {
    for (const [result, sendable] of [['ok', true], ['catch_all', false], ['invalid', false], ['unknown', false]]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ result }), { status: 200 })
      const r = await verifyMailbox({ MILLIONVERIFIER_API_KEY: 'testing-token' }, 'persona@empresa.com')
      assert.equal(r.sendable, sendable, result)
    }
    globalThis.fetch = async () => { throw new Error('provider down') }
    assert.equal((await verifyMailbox({ MILLIONVERIFIER_API_KEY: 'testing-token' }, 'persona@empresa.com')).sendable, false)
  } finally { globalThis.fetch = orig }
})
