// Motor creativo de Carolina: enfoques (ángulos) de asunto + formato que compiten entre sí.
// Se elige con muestreo de Thompson según interés real medido; los perdedores se retiran y
// Carolina propone nuevos enfoques aprendiendo de lo que funcionó y lo que no.
import { notifyCatalina } from './notify.js'
import { skill } from './carolinaSkills.js'
import { outreachDailyLimit } from './salesStrategy.js'

export const seedAngles = [
  { id: 'pregunta-momento', name: 'Pregunta sobre el momento decisivo', format: 'visual',
    brief: 'ASUNTO: pregunta de 5-9 palabras sobre el momento comercial decisivo, nombrando un servicio, producto o lugar real de su web (ej. «¿Qué sabe su equipo antes del primer HydraFacial?»). HOOK: visualiza ese momento. ESCENA: llega la consulta y el equipo recibe contexto.' },
  { id: 'escena-hora', name: 'Escena con hora concreta', format: 'visual',
    brief: 'ASUNTO: escena concreta con hora o día y un servicio real (ej. «Domingo, 9:40 p. m.: alguien pregunta por el head spa»). Intriga por lo que pasa después. HOOK: continúa la escena. ESCENA: esa misma consulta respondida solo con información pública.' },
  { id: 'hecho-para-ustedes', name: 'Algo ya preparado para ustedes', format: 'visual',
    brief: 'ASUNTO: anuncia con sobriedad que ya hay algo preparado para ellos (ej. «Así respondería Ava a una novia que pregunta por su head spa»). Reciprocidad: el recorrido está hecho, solo tienen que mirarlo. HOOK: «Esto es lo que vería su cliente».' },
  { id: 'carta-directa', name: 'Carta personal breve', format: 'carta',
    brief: 'Formato carta personal, sin estética de boletín. ASUNTO: 2-5 palabras en minúscula, como lo escribiría un colega (ej. «pregunta sobre sus reservas de masajes»). Cuerpo: observación concreta, una pregunta, escena de dos líneas, enlace al recorrido. Máx. 110 palabras.' },
  { id: 'voz-del-cliente', name: 'La pregunta de su cliente', format: 'carta',
    brief: 'ASUNTO: una pregunta típica que haría un cliente de ese negocio, entre comillas, sobre un servicio real (ej. «“¿Tienen cita el sábado para limpieza facial?”»). Cuerpo: qué recibe hoy su equipo cuando llega esa pregunta (como hipótesis) y cómo podría verse con un agente supervisado. Aclara que es un ejemplo.' },
]

export async function ensureSeedAngles(env) {
  const stmt = env.DB.prepare("INSERT OR IGNORE INTO outreach_angles(id,name,format,brief,status,generation,created_at) VALUES (?,?,?,?,'active',0,?)")
  await env.DB.batch(seedAngles.map(a => stmt.bind(a.id, a.name, a.format, a.brief, Date.now())))
}

// Puntuación por correo enviado. Aperturas pesan poco (Apple y los antivirus las inflan).
export function engagementScore(row) {
  if (row.meeting) return 1
  if (row.replied && row.positive) return 1
  if (row.replied) return 0.3
  if (row.cta || row.demo) return 0.8
  if (row.visited || row.clicked) return 0.5
  if (row.opened) return 0.2
  return 0
}

const MATURE_MS = 48 * 3600000
export async function angleStats(env, now = Date.now()) {
  const rows = await env.DB.prepare(`SELECT o.id, o.angle, o.subject, o.status,
      MAX(CASE WHEN e.type='email.opened' THEN 1 ELSE 0 END) AS opened,
      MAX(CASE WHEN e.type='email.clicked' THEN 1 ELSE 0 END) AS clicked,
      MAX(CASE WHEN e.type='page.viewed' THEN 1 ELSE 0 END) AS visited,
      MAX(CASE WHEN e.type='cta.clicked' THEN 1 ELSE 0 END) AS cta,
      MAX(CASE WHEN e.type='demo.used' THEN 1 ELSE 0 END) AS demo,
      MAX(CASE WHEN e.type='email.delivered' THEN 1 ELSE 0 END) AS delivered,
      (SELECT COUNT(*) FROM emails m WHERE m.direction='in' AND m.thread_key=lower(o.email) AND m.category IN ('prospect','meeting','question','needs_catalina')) AS positive,
      (SELECT COUNT(*) FROM meetings mt WHERE lower(mt.email)=lower(o.email)) AS meeting
    FROM outreach o LEFT JOIN outreach_events e ON e.outreach_id=o.id
    WHERE o.sent_at IS NOT NULL AND o.sent_at < ? AND o.id NOT LIKE 'test-%' AND o.angle <> ''
    GROUP BY o.id`).bind(now - MATURE_MS).all()
  const byAngle = {}
  for (const r of rows.results || []) {
    r.replied = r.status === 'replied' ? 1 : 0
    const a = byAngle[r.angle] ||= { angle: r.angle, n: 0, score: 0, opened: 0, engaged: 0, replied: 0, subjects: [] }
    const s = engagementScore(r)
    a.n++; a.score += s; a.opened += r.opened; a.engaged += (r.cta || r.demo || r.visited || r.clicked || r.replied) ? 1 : 0; a.replied += r.replied; a.positive = (a.positive || 0) + (r.positive ? 1 : 0)
    a.subjects.push({ subject: r.subject, score: s })
  }
  return byAngle
}

// Muestreo de Thompson con prior realista (media 10 %).
function gammaSample(k) {
  if (k < 1) return gammaSample(k + 1) * Math.pow(Math.random(), 1 / k)
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x, v
    do { const u1 = Math.random(), u2 = Math.random(); x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); v = 1 + c * x } while (v <= 0)
    v = v * v * v; const u = Math.random()
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}
export const betaSample = (a, b) => { const x = gammaSample(a); return x / (x + gammaSample(b)) }

export function chooseAngle(angles, stats) {
  let best = null, bestDraw = -1
  for (const a of angles) {
    const s = stats[a.id] || { n: 0, score: 0 }
    const draw = betaSample(0.5 + s.score, 4.5 + s.n - s.score)
    if (draw > bestDraw) { bestDraw = draw; best = a }
  }
  return best
}

export async function pickAngle(env) {
  await ensureSeedAngles(env)
  const active = (await env.DB.prepare("SELECT * FROM outreach_angles WHERE status='active'").all()).results || []
  const stats = await angleStats(env)
  return chooseAngle(active.length ? active : seedAngles, stats)
}

// Ejemplos reales para que cada nuevo correo aprenda de los anteriores.
export async function learningExamples(env) {
  const stats = await angleStats(env)
  const all = Object.values(stats).flatMap(a => a.subjects)
  const good = all.filter(s => s.score >= 0.5).slice(-6).map(s => s.subject)
  const bad = all.filter(s => s.score === 0).slice(-6).map(s => s.subject)
  // Lo que respondieron los prospectos: objeciones e intereses reales para la próxima propuesta.
  const replies = ((await env.DB.prepare(`SELECT m.category, substr(m.body,1,260) AS body FROM emails m JOIN outreach o ON lower(o.email)=m.thread_key
    WHERE m.direction='in' AND o.id NOT LIKE 'test-%' ORDER BY m.id DESC LIMIT 8`).all().catch(() => ({ results: [] }))).results || [])
    .map(r => `[${r.category || 'sin clasificar'}] ${String(r.body || '').replace(/\s+/g, ' ').trim()}`)
  return { good, bad, replies }
}

// Evolución diaria: retira enfoques con bajo rendimiento y crea retadores nuevos.
export async function evolveAngles(env, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10)
  const mark = await env.DB.prepare("INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)").bind('evolve-' + day, 'system', 'angles.evolved', now).run()
  if (!mark.meta.changes) return { due: false }
  await ensureSeedAngles(env)
  const active = (await env.DB.prepare("SELECT * FROM outreach_angles WHERE status='active'").all()).results || []
  const stats = await angleStats(env, now)
  const tracked = !!(await webhookSecret(env))
  const rate = a => (stats[a.id]?.score || 0) / Math.max(1, stats[a.id]?.n || 0)
  const mature = active.filter(a => (stats[a.id]?.n || 0) >= 25)
  const best = mature.reduce((m, a) => Math.max(m, rate(a)), 0)
  const changes = []
  for (const a of mature.sort((x, y) => rate(x) - rate(y))) {
    if (active.length - changes.length <= 2) break
    const s = stats[a.id]
    const lowOpen = tracked && s.opened / s.n < 0.12
    if (rate(a) < best * 0.5 || lowOpen || (s.engaged === 0 && s.n >= 30)) {
      const reason = `${s.n} envíos · interés ${Math.round(100 * s.engaged / s.n)} %${tracked ? ' · aperturas ' + Math.round(100 * s.opened / s.n) + ' %' : ''} · respuestas ${s.replied}`
      await env.DB.prepare("UPDATE outreach_angles SET status='retired',retired_at=?,retired_reason=? WHERE id=?").bind(now, reason, a.id).run()
      changes.push(`Retirado «${a.name}»: ${reason}`)
    }
  }
  const remaining = active.length - changes.length
  if (remaining < 4 && env.OPENROUTER_API_KEY) {
    const created = await inventAngle(env, active, stats).catch(() => null)
    if (created) changes.push(`Nuevo enfoque en prueba «${created.name}» (${created.format}): ${created.brief}`)
  }
  if (changes.length) await notifyCatalina(env, 'Carolina ajustó sus enfoques de correo', changes.join('\n\n') + '\n\nCarolina elige cada día el enfoque según respuestas, clics a la propuesta y conversaciones iniciadas; las aperturas pesan poco porque no prueban lectura.').catch(() => {})
  return { due: true, changes }
}

async function inventAngle(env, active, stats) {
  const history = (await env.DB.prepare('SELECT id,name,format,brief,status,retired_reason FROM outreach_angles ORDER BY created_at DESC LIMIT 20').all()).results || []
  const table = history.map(a => ({ ...a, envios: stats[a.id]?.n || 0, interes: stats[a.id] ? Math.round(100 * stats[a.id].engaged / stats[a.id].n) + '%' : 'sin datos', mejores: (stats[a.id]?.subjects || []).filter(s => s.score >= 0.5).slice(-3).map(s => s.subject) }))
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { authorization: 'Bearer ' + env.OPENROUTER_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ model: env.OPENROUTER_MODEL || env.OPENROUTER_EXTRACT_MODEL, temperature: 0.8, max_tokens: 600, messages: [
    { role: 'system', content: skill('copywriting-email') + '\n\nEres el estratega de copy de Carolina. Con los resultados reales, diseña UN enfoque nuevo de asunto + hook + escena, distinto de los activos y de los retirados, que tenga más probabilidad de conseguir clics y respuestas de dueños de spas, clínicas, inmobiliarias, servicios profesionales y tiendas online hispanohablantes. Aprende de los que funcionaron; no repitas patrones de los retirados. Devuelve JSON {"id":"kebab-case","name":"nombre corto","format":"visual|carta","brief":"instrucción de 1-3 frases con un ejemplo de asunto"}.' },
    { role: 'user', content: JSON.stringify({ enfoques: table }) },
  ] }), signal: AbortSignal.timeout(25000) })
  if (!res.ok) return null
  const out = JSON.parse((await res.json()).choices[0].message.content.replace(/^```(?:json)?\s*|\s*```$/g, ''))
  const id = String(out.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40)
  if (!id || !out.name || !out.brief || out.brief.length > 600 || !['visual', 'carta'].includes(out.format)) return null
  const gen = 1 + Math.max(0, ...history.map(a => a.generation || 0))
  const r = await env.DB.prepare("INSERT OR IGNORE INTO outreach_angles(id,name,format,brief,status,generation,created_at) VALUES (?,?,?,?,'active',?,?)").bind(id, String(out.name).slice(0, 80), out.format, out.brief, gen, Date.now()).run()
  return r.meta.changes ? { id, name: out.name, format: out.format, brief: out.brief } : null
}

// Volumen: sube solo con buena entrega e interés medido, nunca por calendario. Techo = OUTREACH_DAILY_LIMIT (máx. 50).
export async function adjustDailyCap(env, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10)
  const mark = await env.DB.prepare("INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)").bind('ramp-' + day, 'system', 'cap.reviewed', now).run()
  if (!mark.meta.changes) return { due: false }
  const control = await env.DB.prepare('SELECT daily_cap FROM outreach_control WHERE id=1').first()
  const cap = control?.daily_cap || 5, ceiling = outreachDailyLimit(env)
  const since = now - 7 * 86400000
  const sent = (await env.DB.prepare("SELECT COUNT(*) n FROM outreach WHERE sent_at>=? AND id NOT LIKE 'test-%'").bind(since).first())?.n || 0
  const ev = type => env.DB.prepare("SELECT COUNT(DISTINCT outreach_id) n FROM outreach_events e JOIN outreach o ON o.id=e.outreach_id WHERE o.id NOT LIKE 'test-%' AND e.type=? AND e.occurred_at>=?").bind(type, since).first().then(r => r?.n || 0)
  const bounced = await ev('email.bounced'), complained = await ev('email.complained')
  const engaged = (await env.DB.prepare("SELECT COUNT(DISTINCT outreach_id) n FROM outreach_events e JOIN outreach o ON o.id=e.outreach_id WHERE o.id NOT LIKE 'test-%' AND e.type IN ('email.clicked','page.viewed','cta.clicked') AND e.occurred_at>=?").bind(since).first())?.n || 0
  const replied = (await env.DB.prepare("SELECT COUNT(*) n FROM outreach WHERE status='replied' AND updated_at>=? AND id NOT LIKE 'test-%'").bind(since).first())?.n || 0
  let next = cap
  if (sent >= cap * 2 && complained === 0 && bounced / Math.max(1, sent) < 0.03 && (engaged / Math.max(1, sent) >= 0.03 || replied > 0)) next = Math.min(ceiling, cap + 5)
  if (next > ceiling) next = ceiling
  if (next !== cap) {
    await env.DB.prepare('UPDATE outreach_control SET daily_cap=?,updated_at=? WHERE id=1').bind(next, now).run()
    await notifyCatalina(env, `Carolina sube el volumen a ${next} correos por día hábil`, `Últimos 7 días: ${sent} enviados, ${bounced} rebotes, ${complained} quejas, ${engaged} con interés (clic o visita), ${replied} respuestas.\nTecho configurado: ${ceiling}.`).catch(() => {})
  }
  return { due: true, cap: next, sent, bounced, engaged, replied }
}

export async function currentDailyCap(env) {
  const control = await env.DB.prepare('SELECT daily_cap FROM outreach_control WHERE id=1').first().catch(() => null)
  return Math.min(outreachDailyLimit(env), control?.daily_cap || 5)
}

export async function webhookSecret(env) {
  if (env.RESEND_WEBHOOK_SECRET) return env.RESEND_WEBHOOK_SECRET
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key='resend_webhook_secret'").first().catch(() => null)
  return row?.value || null
}
