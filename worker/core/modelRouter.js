// Router central de modelos. TODO el sistema pide IA por aquí: ningún módulo elige modelo por su cuenta.
// Principio: lo que resuelve código no gasta tokens (tier 0); lo masivo va a modelos gratuitos con
// respaldo barato; el razonamiento diario a DeepSeek; la escritura que decide un cliente a Gemini;
// Claude solo cuando el valor del contrato y la baja confianza lo justifican.

export const TIER_MODELS = {
  // Gratuitos con salida JSON. Pueden tener rate limit: nunca son punto único de falla.
  1: ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'deepseek/deepseek-v4-flash-0731'],
  2: ['deepseek/deepseek-v4.1-flash', 'qwen/qwen3.8-flash'],
  3: ['google/gemini-3.8-flash'],
  4: ['anthropic/claude-sonnet-4.6'],
}

// Techo de precio por proveedor (USD por millón de tokens) para que el routing por precio no
// termine en un proveedor caro del mismo modelo.
const MAX_PRICE = { 1: { prompt: 0.1, completion: 1.5 }, 2: { prompt: 0.5, completion: 2 }, 3: { prompt: 1, completion: 5 }, 4: { prompt: 4, completion: 20 } }

// Tier base por tarea. El tier sube por complejidad, riesgo o confianza baja, nunca por defecto.
export const TASK_TIERS = {
  'intent.search': 1,          // descubrimiento web masivo
  'discovery.search': 1,
  'business.resolve': 1,       // encontrar sitio oficial
  'angle.invent': 2,           // estrategia de copy: pocas llamadas, calidad importa
  'freelancer.judge': 2,       // calificación + bid
  'application.route': 2,
  'acquisition.director': 2,
  'discovery.verify': 2,
  'meeting.analyze': 3,       // informe y follow-up tras una reunión real
  'intent.qualify': 2,         // ¿es comprador real y encaja?
  'outreach.critique': 2,      // rúbrica de calidad sobre el borrador
  'outreach.evidence': 2,      // cita literal que respalda la observación
  'outreach.first_touch': 2,   // primer contacto frío: breve y barato; busca respuesta/diagnóstico
  'intent.proposal': 2,        // texto final que lee el comprador
  'application.write': 3,
  'outreach.proposal': 3,
  'inbox.reply': 3,            // cada respuesta humana entrante es un posible cliente; volumen bajo
  'instagram.dm': 3,
  'browser.reply': 3,
  'demo.chat': 3,
  'site.chat': 3,
  'site.extract': 2,           // resumen de datos del lead tras el chat
}

const tierOf = task => TASK_TIERS[task] ?? 2

// Valor esperado → cuánto razonamiento vale la pena comprar.
export function valueCeiling(dealValue = 0) {
  // Claude queda reservado para oportunidades realmente high-ticket; la mayoría se resuelve con DeepSeek/Gemini.
  if (dealValue >= 5000) return 4
  if (dealValue >= 1200) return 3
  return 2
}

export function selectModel(taskType, { complexity = 'normal', dealValue = 0, confidence = null, risk = 'normal' } = {}) {
  let tier = tierOf(taskType)
  if (complexity === 'high') tier = Math.max(tier, 3)
  if (risk === 'high' && dealValue >= 1500) tier = Math.max(tier, 3)
  const ceiling = Math.max(tier, valueCeiling(dealValue))
  // Confianza baja de un intento previo: un tier más, dentro del techo de valor.
  if (typeof confidence === 'number' && confidence < 0.65) tier = Math.min(ceiling, tier + 1)
  return { tier, ceiling, models: TIER_MODELS[tier] || TIER_MODELS[2] }
}

let tableReady = false
async function ensureTable(env) {
  if (tableReady || !env.DB) return
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ai_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, task TEXT NOT NULL, tier INTEGER NOT NULL, model TEXT NOT NULL, ok INTEGER NOT NULL, input_tokens INTEGER, output_tokens INTEGER, cost REAL NOT NULL DEFAULT 0, opportunity_id TEXT, outcome TEXT, latency_ms INTEGER)').run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_calls_at ON ai_calls(at)').run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ai_calls_task ON ai_calls(task,at)').run()
  tableReady = true
}

const bogotaMidnight = now => Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now) + 'T00:00:00-05:00')

// Cost guard: presupuesto diario + circuit breaker por tarea. Se consulta antes de cada llamada.
export async function guardState(env, task, now = Date.now()) {
  await ensureTable(env)
  const budget = Number(env.AI_DAILY_BUDGET_USD || 2)
  const maxPerWindow = Number(env.AI_TASK_MAX_CALLS_15M || 40)
  const day = bogotaMidnight(now)
  const row = await env.DB.prepare('SELECT (SELECT COALESCE(SUM(cost),0) FROM ai_calls WHERE at>=?) spent, (SELECT COUNT(*) FROM ai_calls WHERE task=? AND at>=?) recent, (SELECT COUNT(*) FROM ai_calls WHERE tier=4 AND at>=?) premium').bind(day, task, now - 15 * 60000, day).first().catch(() => ({ spent: 0, recent: 0, premium: 0 }))
  const spent = Number(row?.spent || 0)
  const premiumCap = Math.max(0, Math.min(20, Number(env.PREMIUM_REVIEW_DAILY_TARGET || 8) || 8))
  const budgetTier = spent >= budget ? 1 : spent >= budget * 0.8 ? 2 : 4
  return {
    spent, budget,
    circuitOpen: Number(row?.recent || 0) >= maxPerWindow,
    // Al 80% del presupuesto solo DeepSeek; al 100% solo gratis. Claude además tiene cupo diario independiente.
    maxTier: Number(row?.premium || 0) >= premiumCap ? Math.min(3, budgetTier) : budgetTier,
    freeOnly: spent >= budget,
    premiumUsed: Number(row?.premium || 0),
    premiumCap,
  }
}

async function logCall(env, rec) {
  await env.DB.prepare('INSERT INTO ai_calls(at,task,tier,model,ok,input_tokens,output_tokens,cost,opportunity_id,outcome,latency_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind(rec.at, rec.task, rec.tier, rec.model, rec.ok ? 1 : 0, rec.input ?? null, rec.output ?? null, rec.cost || 0, rec.opportunityId || null, String(rec.outcome || '').slice(0, 120), rec.latency ?? null).run().catch(() => {})
}

export function extractJson(raw) {
  const s = String(raw || '')
  const a = s.indexOf('{'), b = s.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try { return JSON.parse(s.slice(a, b + 1)) } catch { return null }
}

// Normaliza la confianza que devuelve el modelo: 0-1, porcentaje o alta/media/baja.
export function confidenceOf(data) {
  const c = data?.confidence
  if (typeof c === 'number') return c > 1 ? c / 100 : c
  if (typeof c === 'string') return { alta: 0.9, high: 0.9, media: 0.65, medium: 0.65, baja: 0.35, low: 0.35 }[c.toLowerCase()] ?? null
  return null
}

// Anthropic necesita cache_control explícito; Gemini y DeepSeek cachean prefijos de forma implícita.
function withCache(model, messages) {
  if (!model.startsWith('anthropic/')) return messages
  return messages.map((m, i) => i === 0 && m.role === 'system' && typeof m.content === 'string' && m.content.length > 4000
    ? { ...m, content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] }
    : m)
}

/**
 * Llama al modelo adecuado para la tarea con fallbacks y escalación.
 * opts: task, messages, json, maxTokens, temperature, plugins, tools, toolChoice, dealValue, risk, complexity,
 *       minConfidence (escala si el JSON trae confidence menor), validate(data, content) → true|motivo,
 *       opportunityId, timeoutMs, title.
 * Devuelve { ok, content, data, message, finish, model, tier, cost, attempts, error }.
 */
export async function callModel(env, opts) {
  const task = opts.task
  if (!env.OPENROUTER_API_KEY) return { ok: false, error: 'openrouter_key_missing', attempts: [] }
  const sel = selectModel(task, opts)
  const guard = await guardState(env, task)
  if (guard.circuitOpen) {
    console.error('ai_circuit_open', task)
    return { ok: false, error: 'circuit_open', attempts: [] }
  }
  const ceiling = Math.min(sel.ceiling, guard.maxTier)
  const start = Math.min(sel.tier, Math.max(1, ceiling))
  const attempts = []
  let best = null, totalCost = 0
  const maxAttempts = Number(opts.maxAttempts || 5)

  for (let tier = start; tier <= ceiling && attempts.length < maxAttempts; tier++) {
    const models = (TIER_MODELS[tier] || []).filter(m => !guard.freeOnly || m.endsWith(':free'))
    let tierSucceeded = false
    for (const model of models) {
      if (attempts.length >= maxAttempts) break
      const t0 = Date.now()
      // Medido en producción (5-oct): DeepSeek/Qwen con razonamiento consumían los 2.000 tokens pensando y
      // devolvían JSON truncado. Clasificar/calificar no necesita pensamiento extendido: se apaga en tiers 1-2.
      const reasoning = tier >= 4 ? { effort: 'medium', exclude: true } : tier === 3 ? { effort: 'low', exclude: true } : { enabled: false }
      const body = {
        model, messages: withCache(model, opts.messages),
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens || 1500,
        usage: { include: true },
        provider: { sort: 'price', allow_fallbacks: true, max_price: MAX_PRICE[tier] },
        ...(model.endsWith(':free') ? {} : { reasoning }),
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        ...(opts.plugins ? { plugins: opts.plugins } : {}),
        ...(opts.tools ? { tools: opts.tools, tool_choice: opts.toolChoice || 'auto' } : {}),
      }
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'content-type': 'application/json', 'X-Title': opts.title || ('Carolina · ' + task) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs || 45000),
      }).catch(e => ({ ok: false, status: 0, _err: e?.message }))
      const data = res.ok ? await res.json().catch(() => ({})) : null
      const choice = data?.choices?.[0]
      const usage = data?.usage || {}
      const cost = Number(usage.cost || 0)
      totalCost += cost
      let outcome = 'ok', parsed = null
      if (!res.ok) outcome = 'http_' + (res.status || 'timeout')
      else if (data?.error) outcome = 'api_error'
      else if (!choice?.message) outcome = 'empty'
      else if (choice.finish_reason === 'length' && opts.json) outcome = 'truncated'
      else if (opts.json) {
        parsed = extractJson(choice.message.content)
        if (!parsed) outcome = 'not_json'
      }
      if (outcome === 'ok' && opts.validate) {
        const v = opts.validate(parsed, choice.message.content || '')
        if (v !== true) outcome = 'invalid:' + (v || 'validation')
      }
      await logCall(env, { at: t0, task, tier, model, ok: outcome === 'ok', input: usage.prompt_tokens, output: usage.completion_tokens, cost, opportunityId: opts.opportunityId, outcome, latency: Date.now() - t0 })
      attempts.push({ tier, model, outcome, cost })
      if (outcome !== 'ok') continue
      const result = { ok: true, content: choice.message.content || '', data: parsed, message: choice.message, finish: choice.finish_reason, usage, model, tier }
      const conf = confidenceOf(parsed)
      // Escalación por confianza: solo si el techo de valor lo permite.
      if (opts.minConfidence && conf != null && conf < opts.minConfidence && tier < ceiling) {
        best = best || result
        tierSucceeded = true
        break
      }
      return { ...result, cost: totalCost, attempts }
    }
    if (tierSucceeded) continue
  }
  if (best) return { ...best, cost: totalCost, attempts, escalationExhausted: true }
  console.error('ai_all_models_failed', task, JSON.stringify(attempts))
  return { ok: false, error: attempts.at(-1)?.outcome || 'no_model_available', cost: totalCost, attempts }
}

// Métricas de costo para /health y el reporte diario.
export async function aiCostSnapshot(env, now = Date.now()) {
  await ensureTable(env)
  const day = bogotaMidnight(now), month = now - 30 * 86400000
  const totals = await env.DB.prepare('SELECT (SELECT COALESCE(SUM(cost),0) FROM ai_calls WHERE at>=?) today, (SELECT COALESCE(SUM(cost),0) FROM ai_calls WHERE at>=?) month, (SELECT COUNT(*) FROM ai_calls WHERE at>=?) calls_today').bind(day, month, day).first()
  const byTier = await env.DB.prepare('SELECT tier, COUNT(*) calls, SUM(ok) ok, ROUND(SUM(cost),5) cost FROM ai_calls WHERE at>=? GROUP BY tier ORDER BY tier').bind(day).all()
  const byTask = await env.DB.prepare('SELECT task, COUNT(*) calls, ROUND(SUM(cost),5) cost FROM ai_calls WHERE at>=? GROUP BY task ORDER BY cost DESC LIMIT 12').bind(day).all()
  const q = async (sql, ...b) => Number((await env.DB.prepare(sql).bind(...b).first().catch(() => null))?.n || 0)
  const qualified = await q("SELECT COUNT(*) n FROM intent_leads WHERE fit IN ('alto','medio') AND status NOT LIKE 'filtered%' AND found_at>=?", month)
  const submissions = await q("SELECT (SELECT COUNT(*) FROM marketplace_submissions WHERE status='submitted' AND updated_at>=?)+(SELECT COUNT(*) FROM direct_applications WHERE status IN ('sent','external_email_sent','replied') AND updated_at>=?)+(SELECT COUNT(*) FROM outreach WHERE sent_at>=? AND id NOT LIKE 'test-%') n", month, month, month)
  const replies = await q("SELECT COUNT(*) n FROM emails WHERE direction='in' AND created_at>=? AND lower(from_addr) NOT LIKE '%catajarag%' AND lower(from_addr) NOT LIKE '%catalinajaramillo%'", month)
  const meetings = await q('SELECT COUNT(*) n FROM meetings')
  const won = await q("SELECT COUNT(*) n FROM outreach_events WHERE type='deal.won' AND occurred_at>=?", month)
  const m = Number(totals?.month || 0)
  const per = n => n ? +(m / n).toFixed(4) : null
  return {
    ai_cost_today: +Number(totals?.today || 0).toFixed(5),
    ai_cost_month: +m.toFixed(5),
    ai_calls_today: totals?.calls_today || 0,
    ai_cost_per_qualified_lead: per(qualified),
    ai_cost_per_submission: per(submissions),
    ai_cost_per_reply: per(replies),
    ai_cost_per_meeting: per(meetings),
    ai_cost_per_won_client: per(won),
    daily_budget_usd: Number(env.AI_DAILY_BUDGET_USD || 2),
    byTier: byTier.results || [],
    byTask: byTask.results || [],
  }
}
