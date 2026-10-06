// Métricas por canal (embudo completo + costo de IA) y Revenue Capacity Allocator por INGRESO ESPERADO.
// Carolina aprende de resultados (respuestas, reuniones, contratos, revenue), no de cuántas cosas envía.
import { channelLimited, autoSubmitAllowed } from './channels.js'

const DAY = 86400000
const n = r => Number(r?.n || 0)
const q = (env, sql, ...b) => env.DB.prepare(sql).bind(...b).first().catch(() => ({ n: 0 }))

export const CHANNEL_LABELS = {
  direct_outbound: 'Outbound directo a empresas', partnerships: 'Partners / agencias', job_applications: 'Postulaciones (empleos/contratos)',
  project_bids: 'Bids en marketplaces', intent_signals: 'Señales de intención (foros/posts)', warm_network: 'Red caliente / referidos',
}

// Priors conservadores (se diluyen con datos reales): tasa de reunión por acción, cierre por reunión, ticket USD.
const PRIORS = {
  direct_outbound: { meet: 0.02, win: 0.2, deal: 1500 },
  partnerships: { meet: 0.04, win: 0.25, deal: 2500 },
  job_applications: { meet: 0.03, win: 0.15, deal: 2500 },
  project_bids: { meet: 0.01, win: 0.3, deal: 400 },
  intent_signals: { meet: 0.03, win: 0.25, deal: 1200 },
  warm_network: { meet: 0.15, win: 0.3, deal: 1500 },
}
const PRIOR_ACTIONS = 50, PRIOR_MEETINGS = 5

async function ensureDeals(env) {
  // Contratos ganados: única fuente de verdad de revenue (se registran al cerrar).
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS deals (id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT NOT NULL, ref TEXT, client TEXT, amount_usd REAL NOT NULL, won_at INTEGER NOT NULL)').run()
}

export async function channelMetrics(env, days = 30, now = Date.now()) {
  await ensureDeals(env)
  const since = now - days * DAY
  const ch = {}
  // Outbound directo y partners (tabla outreach; kind separa partners).
  for (const [key, kind] of [['direct_outbound', "kind!='partner'"], ['partnerships', "kind='partner'"]]) {
    const base = `FROM outreach WHERE ${kind} AND id NOT LIKE 'test-%' AND created_at>=?`
    const ev = t => q(env, `SELECT COUNT(DISTINCT e.outreach_id) n FROM outreach_events e JOIN outreach o ON o.id=e.outreach_id WHERE o.${kind} AND o.id NOT LIKE 'test-%' AND e.type=? AND e.occurred_at>=?`, t, since)
    const [disc, qual, prep, sub, del, open, rep, dec, meet] = await Promise.all([
      q(env, `SELECT COUNT(*) n ${base}`, since),
      q(env, `SELECT COUNT(*) n ${base} AND status NOT IN ('skipped','review')`, since),
      q(env, `SELECT COUNT(*) n ${base} AND (html IS NOT NULL OR sent_at IS NOT NULL)`, since),
      q(env, `SELECT COUNT(*) n ${base} AND sent_at IS NOT NULL`, since),
      ev('email.delivered'), ev('email.opened'),
      q(env, `SELECT COUNT(*) n ${base} AND status='replied'`, since),
      ev('reply.declined'),
      q(env, `SELECT COUNT(DISTINCT m.id) n FROM meetings m JOIN outreach o ON lower(o.email)=lower(m.email) WHERE o.${kind} AND m.created_at>=?`, since),
    ])
    ch[key] = { discovered: n(disc), qualified: n(qual), prepared: n(prep), submitted: n(sub), delivered: n(del), opened: n(open), reply: n(rep), positive_reply: Math.max(0, n(rep) - n(dec)), meeting: n(meet) }
  }
  // Postulaciones: intent (no marketplace) + cola de oportunidades + aplicaciones directas.
  const [iDisc, iQual, oDisc, oQual, oPrep, aPrep, aSub, aRep] = await Promise.all([
    q(env, "SELECT COUNT(*) n FROM intent_leads WHERE found_at>=? AND lower(platform) NOT LIKE '%freelancer%'", since),
    q(env, "SELECT COUNT(*) n FROM intent_leads WHERE found_at>=? AND fit IN ('alto','medio') AND status NOT LIKE 'filtered%'", since),
    q(env, 'SELECT COUNT(*) n FROM opportunities WHERE created_at>=?', since),
    q(env, "SELECT COUNT(*) n FROM opportunities WHERE created_at>=? AND grade IN ('A','B')", since),
    q(env, "SELECT COUNT(*) n FROM opportunities WHERE created_at>=? AND status='prepared'", since),
    q(env, "SELECT COUNT(*) n FROM direct_applications WHERE updated_at>=? AND status='ready_for_submission'", since),
    q(env, "SELECT COUNT(*) n FROM direct_applications WHERE COALESCE(sent_at,updated_at)>=? AND status IN ('sent','external_email_sent','replied')", since),
    q(env, "SELECT COUNT(*) n FROM direct_applications WHERE updated_at>=? AND status='replied'", since),
  ])
  ch.job_applications = { discovered: n(iDisc) + n(oDisc), qualified: n(iQual) + n(oQual), prepared: n(oPrep) + n(aPrep), submitted: n(aSub), delivered: n(aSub), opened: null, reply: n(aRep), positive_reply: n(aRep), meeting: 0 }
  const [bDisc, bQual, bPrep, bSub] = await Promise.all([
    q(env, "SELECT COUNT(*) n FROM marketplace_submissions WHERE created_at>=?", since),
    q(env, "SELECT COUNT(*) n FROM marketplace_submissions WHERE created_at>=? AND status NOT IN ('skipped')", since),
    q(env, "SELECT COUNT(*) n FROM marketplace_submissions WHERE created_at>=? AND status='ready_for_submission'", since),
    q(env, "SELECT COUNT(*) n FROM marketplace_submissions WHERE created_at>=? AND status='submitted'", since),
  ])
  ch.project_bids = { discovered: n(bDisc), qualified: n(bQual), prepared: n(bPrep), submitted: n(bSub), delivered: n(bSub), opened: null, reply: 0, positive_reply: 0, meeting: 0 }
  ch.intent_signals = { discovered: n(iDisc), qualified: n(iQual), prepared: 0, submitted: 0, delivered: 0, opened: null, reply: 0, positive_reply: 0, meeting: 0 }
  ch.warm_network = { discovered: 0, qualified: 0, prepared: 0, submitted: 0, delivered: 0, opened: null, reply: 0, positive_reply: 0, meeting: 0 }
  // Revenue real (deals) y costo de IA atribuido por tarea.
  const deals = (await env.DB.prepare('SELECT channel, COUNT(*) won, SUM(amount_usd) revenue FROM deals WHERE won_at>=? GROUP BY channel').bind(since).all().catch(() => ({ results: [] }))).results || []
  const costs = (await env.DB.prepare('SELECT task, SUM(cost) c FROM ai_calls WHERE at>=? GROUP BY task').bind(since).all().catch(() => ({ results: [] }))).results || []
  const taskChannel = t => /^outreach\.|^discovery\.|^angle\./.test(t) ? 'direct_outbound' : /^freelancer\./.test(t) ? 'project_bids' : /^intent\.search|^business\./.test(t) ? 'intent_signals' : /^intent\.|^application\.|^browser\./.test(t) ? 'job_applications' : null
  for (const k of Object.keys(ch)) { ch[k].proposal_requested = 0; ch[k].won = 0; ch[k].revenue = 0; ch[k].ai_cost = 0 }
  for (const d of deals) if (ch[d.channel]) { ch[d.channel].won = Number(d.won || 0); ch[d.channel].revenue = Number(d.revenue || 0) }
  for (const c of costs) { const k = taskChannel(c.task); if (k) ch[k].ai_cost = +(ch[k].ai_cost + Number(c.c || 0)).toFixed(5) }
  const pct = (a, b) => b ? +(a / b).toFixed(4) : null
  for (const [k, m] of Object.entries(ch)) {
    m.label = CHANNEL_LABELS[k]
    m.reply_rate = pct(m.reply, m.submitted); m.positive_reply_rate = pct(m.positive_reply, m.submitted)
    m.meeting_rate = pct(m.meeting, m.submitted); m.win_rate = pct(m.won, m.submitted)
    m.revenue_per_100_outreach = m.submitted ? +(m.revenue * 100 / m.submitted).toFixed(2) : null
    m.cost_per_meeting = m.meeting ? +(m.ai_cost / m.meeting).toFixed(4) : null
    m.cost_per_client = m.won ? +(m.ai_cost / m.won).toFixed(4) : null
  }
  return { windowDays: days, channels: ch }
}

/** Ingreso esperado por acción y reparto de capacidad diaria. Canales bloqueados reciben 0. */
export async function allocateCapacity(env, { dailyActions = null, now = Date.now() } = {}) {
  dailyActions = Math.max(20, Math.min(120, Number(dailyActions ?? env.PROPOSAL_PREP_DAILY_TARGET ?? 40) || 40))
  const { channels } = await channelMetrics(env, 30, now)
  const control = await env.DB.prepare('SELECT paused FROM outreach_control WHERE id=1').first().catch(() => ({ paused: 0 }))
  const blocked = {
    direct_outbound: control?.paused ? 'correo frío en pausa por entregabilidad' : null,
    partnerships: control?.paused ? 'correo frío en pausa por entregabilidad' : null,
    project_bids: (await channelLimited(env, 'freelancer', now)) ? 'Freelancer CHANNEL_LIMITED' : null,
    warm_network: 'requiere a Catalina (contactos personales): Carolina prepara la lista, no envía',
    job_applications: null, intent_signals: null,
  }
  const rows = Object.entries(PRIORS).map(([k, p]) => {
    const m = channels[k] || {}
    const acts = m.submitted || 0
    // Suavizado bayesiano: con pocos datos manda el prior; con datos reales manda el canal.
    const meetRate = ((m.meeting || 0) + p.meet * PRIOR_ACTIONS) / (acts + PRIOR_ACTIONS)
    const winRate = ((m.won || 0) + p.win * PRIOR_MEETINGS) / ((m.meeting || 0) + PRIOR_MEETINGS)
    const deal = m.won ? m.revenue / m.won : p.deal
    return { channel: k, label: CHANNEL_LABELS[k], evidence: acts, meetRate: +meetRate.toFixed(4), winRate: +winRate.toFixed(3), avgDeal: Math.round(deal), evPerAction: +(meetRate * winRate * deal).toFixed(2), blocked: blocked[k] }
  })
  const open = rows.filter(r => !r.blocked)
  const total = open.reduce((a, r) => a + r.evPerAction, 0) || 1
  // 10% de exploración repartida para no abandonar un canal antes de tener datos.
  const explore = Math.round(dailyActions * 0.1)
  for (const r of rows) r.actions = r.blocked ? 0 : Math.max(1, Math.round((dailyActions - explore) * r.evPerAction / total + explore / Math.max(1, open.length)))
  const appTarget = Math.max(1, Math.min(100, Number(env.APPLICATION_SUBMIT_DAILY_TARGET || 50) || 50))
  const apps = rows.find(r => r.channel === 'job_applications')
  // Con auto-submit encendido, Carolina debe mantener una capacidad mínima real de postulaciones.
  if (autoSubmitAllowed(env)) { if (apps) { apps.actions = Math.max(apps.actions, Math.min(appTarget, dailyActions)); apps.note = `AUTO_SUBMIT on: prioridad hasta ${Math.min(appTarget,dailyActions)} postulaciones/día, sujeto a quality gate y bloqueos reales` } }
  else if (apps) { apps.actions = Math.min(apps.actions, 15); apps.note = 'AUTO_SUBMIT off: preparadas para revisión humana' }

  // El allocator no puede prometer más trabajo del presupuesto diario: si un mínimo (p. ej. postulaciones)
  // crea overflow, recorta primero canales de menor EV. Conserva una pequeña exploración de intención.
  let overflow = Math.max(0, rows.reduce((sum, r) => sum + Number(r.actions || 0), 0) - dailyActions)
  for (const r of rows.filter(r => !r.blocked && r !== apps).sort((a, b) => a.evPerAction - b.evPerAction)) {
    if (overflow <= 0) break
    const floor = r.channel === 'intent_signals' ? Math.min(3, r.actions) : 0
    const cut = Math.min(overflow, Math.max(0, r.actions - floor))
    r.actions -= cut; overflow -= cut
  }
  if (overflow > 0 && apps) { const cut = Math.min(overflow, Math.max(0, apps.actions - 1)); apps.actions -= cut; overflow -= cut }
  rows.sort((a, b) => b.evPerAction - a.evPerAction)
  const allocation = { at: new Date(now).toISOString(), dailyActions, expectedRevenuePerDay: +rows.reduce((a, r) => a + r.actions * r.evPerAction, 0).toFixed(2), channels: rows }
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES ('capacity_allocation',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify(allocation), now).run().catch(() => {})
  return allocation
}

// Traduce la asignación a los carriles del plan de ingresos existente (reemplaza cuotas fijas).
export function targetsFromAllocation(a) {
  const get = k => a?.channels?.find(r => r.channel === k)?.actions ?? 0
  return { outbound: get('direct_outbound'), directApplications: get('job_applications'), marketplaces: get('project_bids'), intent: get('intent_signals'), partners: get('partnerships'), abm: 0, followups: Math.max(6, Math.round((get('direct_outbound') + get('partnerships')) * 0.4)) }
}
