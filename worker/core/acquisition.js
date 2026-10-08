// Control operativo de adquisición: demanda activa primero, partners después y
// outbound frío como complemento. Cuenta hechos confirmados, no candidatos.
const DAY = 86400000

export const acquisitionPlan = Object.freeze({
  outboundDailyCap: 60,
  applicationsDailyCap: null,
  
  
  
})

async function ensure(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS acquisition_actions (
    id TEXT PRIMARY KEY, source TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL,
    provider_id TEXT, external_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`).run().catch(() => {})
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_acquisition_actions_day ON acquisition_actions(created_at,source,status)').run().catch(() => {})
}

export async function acquisitionSnapshot(env, now = Date.now()) {
  await ensure(env)
  const since = now - DAY
  const out = { plan: acquisitionPlan, windowStart: since, confirmed: { applications: 0, partners: 0, intent: 0, coldOutbound: 0 }, funnel: {} }
  const rows = (await env.DB.prepare(`SELECT kind, COUNT(*) n FROM acquisition_actions
    WHERE created_at>=? AND status IN ('SUBMITTED_CONFIRMED','SENT_CONFIRMED','HUMAN_ACTION_REQUIRED') GROUP BY kind`).bind(since).all().catch(() => ({ results: [] }))).results || []
  for (const row of rows) if (row.kind in out.confirmed) out.confirmed[row.kind] = Number(row.n || 0)
  const stages = ['SUBMITTED_CONFIRMED','SENT_CONFIRMED','DELIVERED','RESPONSE','POSITIVE_RESPONSE','MEETING','CONTRACT']
  for (const stage of stages) out.funnel[stage] = Number((await env.DB.prepare('SELECT COUNT(*) n FROM acquisition_actions WHERE created_at>=? AND status=?').bind(since, stage).first().catch(() => ({ n: 0 })))?.n || 0)
  out.outboundCap = 60
  out.outboundSentToday = out.confirmed.coldOutbound + out.confirmed.partners
  out.applicationsQualifiedToday = out.confirmed.applications
  out.applicationsAttemptedToday = out.confirmed.applications
  out.submittedConfirmedToday = out.funnel.SUBMITTED_CONFIRMED || 0
  out.humanActionRequired = out.funnel.HUMAN_ACTION_REQUIRED || 0
  out.responses = out.funnel.RESPONSE || 0
  out.meetings = out.funnel.MEETING || 0
  out.contracts = out.funnel.CONTRACT || 0
  out.usdRevenue = 0
  out.total = Object.values(out.confirmed).reduce((a, n) => a + n, 0)
  return out
}

export async function recordAcquisitionAction(env, action) {
  await ensure(env)
  const now = action.created_at || Date.now()
  await env.DB.prepare(`INSERT OR REPLACE INTO acquisition_actions
    (id,source,kind,status,provider_id,external_id,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)`).bind(
      action.id, action.source, action.kind, action.status,
      action.provider_id || null, action.external_id || null, now, Date.now()
    ).run()
}
