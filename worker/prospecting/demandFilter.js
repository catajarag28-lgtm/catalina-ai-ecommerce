// Filtro de demanda TIER 0 (sin LLM): descarta antes de gastar tokens lo que no es un comprador real.
// Reglas observadas en la auditoría del 5-oct: freelancers ofreciéndose ("for hire", "DM me",
// "I build..."), posts de hace meses, enlaces de menú (Premium, Build your resume, Payroll),
// competidores y hilos cerrados aparecían como "prioridad alta".

const SELLER = [
  /\[?\s*for\s*hire\s*\]?/i, /\bavailable\s+for\s+(hire|work|projects|new\s+clients|freelance)\b/i,
  /\bopen\s+to\s+(work|new\s+projects|freelance|opportunities)\b/i, /\bhire\s+me\b/i,
  /\bdm\s+(me\s+)?(for|if\s+you\s+need)\b/i, /\bi\s+(build|create|help|automate|design|develop)\s/i,
  /\bwe\s+(build|help|automate)\s/i, /\bmy\s+services\b/i, /\bi\s+offer\b/i, /\bfree\s+(workflow\s+)?(audit|consultation|demo)\b/i,
  /\blooking\s+to\s+partner\s+with\s+(marketing\s+)?agencies\b/i, /\bwhite[-\s]?label\s+(partner|automation)\s+for\s+agencies\b/i,
  /\bofrezco\s+(mis\s+)?servicios\b/i, /\bdisponible\s+para\s+(proyectos|trabajar)\b/i,
]
const BUYER = [
  /\bhiring\b/i, /\bwe'?re\s+hiring\b/i, /\blooking\s+for\s+(an?\s+)?(freelancer|expert|developer|specialist|consultant|contractor|builder|agency|partner|someone)\b/i,
  /\bseeking\b/i, /\bneed(ed)?\s+(an?\s+)?(freelancer|expert|developer|help|someone)\b/i, /\bpaid\s+(project|gig|work)\b/i, /\bbudget\b/i,
  /\bbusco\b/i, /\bbuscamos\b/i, /\bnecesito\b/i, /\bnecesitamos\b/i, /\bse\s+busca\b/i, /\bcontratar\b/i, /\bvacante\b/i,
  /\bapply\b/i, /\bjob\b/i, /\bposition\b/i, /\brole\b/i, /\bproject\b/i, /\bproyecto\b/i,
  // Falsos negativos del 5-oct: avisos reales que no dicen "hiring" (Sur La Table, CAS, WorkHero, Stardex).
  /\bneeds?\b/i, /\bcontractor\b/i, /\bgrowing\s+the\s+team\b/i, /\brequirements?\b/i, /\bpartnership\b/i, /\bsocios?\b/i, /\bresponsibilities\b/i,
]
// Un aviso en un ATS o job board ES demanda por definición; la calificación decide si encaja.
const JOB_BOARD = /lever\.co|greenhouse\.io|ashbyhq\.com|workable\.com|linkedin\.com\/jobs|wellfound\.com|remoteok\.com|weworkremotely\.com|builtin\.com\/job|getonbrd\.com|stardex\.com|onlinejobs\.ph|smartrecruiters\.com|bamboohr\.com\/careers|teamtailor\.com/i
// Enlaces de navegación y upsells que los scrapers confundían con oportunidades.
const NAV = [
  /probar\s+premium|try\s+premium|premium\s+por\s+0/i, /build\s+your\s+resume/i, /global\s+payroll/i,
  /\/(premium|login|signup|register|pricing|resume-builder|payroll|help|about|blog)(\/|$|\?)/i,
  /^(ai\s+services|email\s+marketing|automation|services)$/i,
]
// Ofertas cuyo núcleo está fuera de lo que Catalina puede afirmar.
const OFF_SCOPE = /\b(children'?s\s+book|geo(graphic)?\s+marketing\s+manager|partnerships\s*&\s*events|python\s*\+\s*aws\s+bedrock|mobile\s+product\s+delivery|payroll\s+specialist)\b/i

const DISCOURSE = /^(community\.n8n\.io|community\.make\.com|community\.zapier\.com|community\.openai\.com|discourse\.webflow\.com|community\.shopify\.com)$/i

export const MAX_AGE_DAYS = { post: 21, job: 45 }

// Fecha a partir del ID (LinkedIn usa IDs tipo snowflake: los 41 bits altos son ms desde epoch).
export function linkedinPostDate(url) {
  const m = /activity[-:](\d{18,20})/.exec(String(url || ''))
  if (!m) return null
  try { const ms = Number(BigInt(m[1]) >> 22n); return ms > 1.3e12 && ms < 2.2e12 ? ms : null } catch { return null }
}

function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' } }

// Discourse expone fecha, estado y título del tema en JSON público; cuesta una petición, no tokens.
async function discourseTopic(url, fetcher = fetch) {
  const host = hostOf(url)
  if (!DISCOURSE.test(host)) return null
  const id = /\/t\/(?:[^/]+\/)?(\d+)/.exec(new URL(url).pathname)?.[1]
  if (!id) return null
  const r = await fetcher(`https://${host}/t/${id}.json`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) }).catch(() => null)
  if (!r?.ok) return null
  const t = await r.json().catch(() => null)
  return t ? { createdAt: Date.parse(t.created_at), closed: !!(t.closed || t.archived), title: String(t.title || ''), tags: (t.tags || []).map(x => String(x?.name || x)).join(' ') } : null
}

export function sellerScore(text) { return SELLER.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0) }
export function buyerScore(text) { return BUYER.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0) }

/**
 * Clasifica sin LLM. p: { url, platform, need, evidence, title, date, kind }.
 * Devuelve { ok, reason, publishedAt, signals }.
 */
export async function classifyDemand(p, { now = Date.now(), fetcher = fetch, remote = true } = {}) {
  const url = String(p.url || '')
  const text = [p.title, p.evidence, p.need].filter(Boolean).join(' \n ')
  const slug = decodeURIComponent((url.split('?')[0].split('/').filter(Boolean).slice(-2).join(' ') || '')).replace(/[-_]+/g, ' ')
  if (!/^https:\/\//.test(url)) return { ok: false, reason: 'invalid_url' }
  if (NAV.some(re => re.test(url) || re.test(String(p.title || '')))) return { ok: false, reason: 'navigation_link' }
  let topic = null
  if (remote) topic = await discourseTopic(url, fetcher)
  const fullText = [text, slug, topic?.title, topic?.tags].filter(Boolean).join(' \n ')
  const seller = sellerScore(fullText), buyer = buyerScore(fullText)
  // Vendedor: señales de oferta propia sin una sola señal fuerte de contratación.
  if (seller >= 1 && !/\b(hiring|we'?re\s+hiring|looking\s+for\s+(an?\s+)?(freelancer|expert|developer|builder|contractor)|busco|buscamos|necesitamos|paid\s+project)\b/i.test(fullText)) return { ok: false, reason: 'seller_not_buyer', signals: { seller, buyer } }
  if (OFF_SCOPE.test(fullText)) return { ok: false, reason: 'off_scope' }
  if (topic?.closed) return { ok: false, reason: 'closed_thread' }
  const published = topic?.createdAt || linkedinPostDate(url) || (p.date && Date.parse(p.date)) || null
  const isJob = JOB_BOARD.test(url)
  const maxAge = (isJob ? MAX_AGE_DAYS.job : MAX_AGE_DAYS.post) * 86400000
  if (published && Number.isFinite(published) && now - published > maxAge) return { ok: false, reason: 'stale', publishedAt: published }
  if (buyer === 0 && !isJob) return { ok: false, reason: 'no_active_demand', signals: { seller, buyer } }
  return { ok: true, publishedAt: Number.isFinite(published) ? published : null, signals: { seller, buyer } }
}

// Ruido por fuente (últimos 14 días): una fuente que trae basura pierde turnos de búsqueda.
export async function sourceNoise(env, now = Date.now()) {
  const rows = await env.DB.prepare("SELECT lower(platform) platform, SUM(CASE WHEN status LIKE 'filtered%' THEN 1 ELSE 0 END) noise, COUNT(*) n FROM intent_leads WHERE found_at>=? GROUP BY lower(platform)").bind(now - 14 * 86400000).all().catch(() => ({ results: [] }))
  return Object.fromEntries((rows.results || []).filter(r => r.platform).map(r => [r.platform, { noise: r.noise, n: r.n, rate: r.n ? r.noise / r.n : 0 }]))
}

export function queryPlatform(q) {
  const site = /site:([a-z0-9.-]+)/i.exec(q)?.[1] || ''
  if (/linkedin/.test(site)) return 'linkedin'
  if (/reddit/.test(site)) return 'reddit'
  if (/n8n/.test(site)) return 'n8n community'
  if (/make\.com/.test(site)) return 'make community'
  if (/twine/.test(site)) return 'twine'
  if (/peopleperhour/.test(site)) return 'peopleperhour'
  if (/guru/.test(site)) return 'guru'
  return site
}
