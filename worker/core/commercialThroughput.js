// Objetivo de volumen comercial verificable. Ninguna preparación, búsqueda o clic cuenta como envío.
const DAY = 86_400_000
const DEFAULT_DAILY = 150
const DEFAULT_WEEKLY = 750
const CHANNELS = ['directApplications', 'marketplaceBids', 'enterpriseOutreach', 'agencyPartners']
const number = x => Math.max(0, Number(x?.n ?? x ?? 0) || 0)
const sum = o => CHANNELS.reduce((n, k) => n + number(o?.[k]), 0)
const query = async (env, sql, ...values) =>
  number(await env.DB.prepare(sql).bind(...values).first().catch(() => ({ n: 0 })))

export function bogotaBusinessWindow(now = Date.now()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(p => [p.type, p.value]))
  const date = `${values.year}-${values.month}-${values.day}`
  const dayStart = Date.parse(date + 'T05:00:00Z')
  const dayOfWeek = new Date(dayStart).getUTCDay()
  const daysSinceMonday = (dayOfWeek + 6) % 7
  return {
    dayStart, weekStart: dayStart - daysSinceMonday * DAY,
    businessDay: dayOfWeek >= 1 && dayOfWeek <= 5,
    remainingBusinessDays: dayOfWeek >= 1 && dayOfWeek <= 5 ? 6 - dayOfWeek : 0,
  }
}

export function evaluateCommercialThroughput({
  daily = {}, weekly = {}, pending = {}, paused = true, spent = 0, budget = 2,
  now = Date.now(), dailyTarget = DEFAULT_DAILY, weeklyTarget = DEFAULT_WEEKLY,
} = {}) {
  const window = bogotaBusinessWindow(now)
  const safeDailyTarget = Math.max(1, Math.min(200, Math.floor(Number(dailyTarget) || DEFAULT_DAILY)))
  const safeWeeklyTarget = Math.max(1, Math.min(1000, Math.floor(Number(weeklyTarget) || DEFAULT_WEEKLY)))
  const dayConfirmed = sum(daily)
  const weekConfirmed = sum(weekly)
  const remainingWeek = Math.max(0, safeWeeklyTarget - weekConfirmed)
  const boundedBudget = Math.max(0, Number(budget) || 0)
  const dailySpent = Math.max(0, Number(spent) || 0)
  const dailyGoal = window.businessDay ? safeDailyTarget : 0
  const executable = number(pending.directPublicRoutes)
  const prepared = number(pending.marketplacePrepared) + number(pending.enterprisesUnverified)
  return {
    kind: 'verified_commercial_actions',
    definition: 'Provider-confirmed submissions or sends only; NOT discovery, drafts, opens, or clicked buttons.',
    goals: { businessDays: 5, daily: dailyGoal, weekly: safeWeeklyTarget, discoveryScreened: 500, deepQualified: 200 },
    actual: {
      daily: Object.fromEntries(CHANNELS.map(k => [k, number(daily[k])])),
      weekly: Object.fromEntries(CHANNELS.map(k => [k, number(weekly[k])])),
      dailyConfirmed: dayConfirmed, weeklyConfirmed: weekConfirmed,
    },
    gap: {
      daily: Math.max(0, dailyGoal - dayConfirmed),
      weekly: remainingWeek,
      requiredPerRemainingBusinessDay: window.remainingBusinessDays
        ? Math.ceil(remainingWeek / window.remainingBusinessDays) : null,
      onPace: window.remainingBusinessDays
        ? Math.ceil(remainingWeek / window.remainingBusinessDays) <= safeDailyTarget : remainingWeek === 0,
    },
    readiness: {
      directPublicRoutes: executable,
      marketplacePreparedNotSubmitted: number(pending.marketplacePrepared),
      enterprisesUnverifiedNotSent: number(pending.enterprisesUnverified),
      researchOrPreparationIsNotSubmission: true,
      immediatelyExposableConfirmedActions: Math.min(executable, Math.max(0, dailyGoal - dayConfirmed)),
      unverifiedDraftsExcluded: prepared,
    },
    safeguards: {
      coldEmailPaused: Boolean(paused),
      aiBudgetUsd: boundedBudget,
      aiSpentTodayUsd: +dailySpent.toFixed(5),
      aiRemainingTodayUsd: +Math.max(0, boundedBudget - dailySpent).toFixed(5),
      aiBudgetExhausted: dailySpent >= boundedBudget,
      dailyTargetDoesNotAuthorizeSending: true,
      channelLimitsAndPlatformRulesStillApply: true,
    },
    guidance: paused
      ? 'Prioritize explicit-demand public ATS and permitted partner/marketplace routes; keep cold email paused.'
      : 'Prioritize explicit demand, verified destinations and provider-confirmed submissions over raw volume.',
    generatedAt: new Date(now).toISOString(),
  }
}

async function confirmedActionCounts(env, since) {
  // Reconciliación anti-duplicados: una oportunidad de ATS y la misma aplicación directa suman UNA vez.
  const [directApplications, marketplaceBids, enterpriseOutreach, agencyPartners] = await Promise.all([
    query(env, `SELECT COUNT(*) n FROM (
      SELECT source_url ref FROM direct_applications
      WHERE sent_at>=? AND provider_id IS NOT NULL AND provider_id<>''
        AND status IN ('sent','external_email_sent','delivered','replied')
      UNION
      SELECT url ref FROM opportunities
      WHERE submitted_at>=? AND status='submitted'
        AND CASE WHEN json_valid(evidence) THEN json_extract(evidence,'$.providerId') ELSE NULL END IS NOT NULL
    )`, since, since),
    query(env, "SELECT COUNT(*) n FROM marketplace_submissions WHERE status='submitted' AND provider_id IS NOT NULL AND provider_id<>'' AND updated_at>=?", since),
    query(env, "SELECT COUNT(*) n FROM outreach WHERE kind NOT IN ('partner','inbound') AND id NOT LIKE 'test-%' AND provider_id IS NOT NULL AND provider_id<>'' AND sent_at>=?", since),
    query(env, "SELECT COUNT(*) n FROM outreach WHERE kind='partner' AND id NOT LIKE 'test-%' AND provider_id IS NOT NULL AND provider_id<>'' AND sent_at>=?", since),
  ])
  return { directApplications, marketplaceBids, enterpriseOutreach, agencyPartners }
}

export async function commercialThroughputSnapshot(env, now = Date.now()) {
  const window = bogotaBusinessWindow(now)
  const [daily, weekly, control, directPublicRoutes, marketplacePrepared, enterprisesUnverified, spent] = await Promise.all([
    confirmedActionCounts(env, window.dayStart),
    confirmedActionCounts(env, window.weekStart),
    env.DB.prepare('SELECT paused FROM outreach_control WHERE id=1').first().catch(() => ({ paused: 1 })),
    query(env, "SELECT COUNT(*) n FROM execution_queue WHERE channel IN ('direct_email','public_ats') AND state='APPLICATION_PREPARED'"),
    query(env, "SELECT COUNT(*) n FROM marketplace_submissions WHERE status='ready_for_submission'"),
    query(env, "SELECT COUNT(*) n FROM outreach WHERE status='pending' AND kind!='inbound'"),
    query(env, 'SELECT COALESCE(SUM(cost),0) n FROM ai_calls WHERE at>=?', window.dayStart),
  ])
  return evaluateCommercialThroughput({
    daily, weekly,
    pending: { directPublicRoutes, marketplacePrepared, enterprisesUnverified },
    paused: control?.paused !== 0,
    spent, budget: env.AI_DAILY_BUDGET_USD ?? 2, now,
    dailyTarget: env.COMMERCIAL_ACTIONS_DAILY_TARGET ?? DEFAULT_DAILY,
    weeklyTarget: env.COMMERCIAL_ACTIONS_WEEKLY_TARGET ?? DEFAULT_WEEKLY,
  })
}
