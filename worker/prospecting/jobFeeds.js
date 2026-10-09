// Fuentes de vacantes remotas con API pública y gratuita (Remotive, Himalayas, Jobicy, RemoteOK).
// Cada vacante entra al mismo embudo de oportunidades: puntaje → estudio de la oferta → propuesta única → envío
// por el formulario oficial cuando existe. Se consultan dos veces al día (Remotive pide no más de 4 llamadas diarias).
import { ingestOpportunities } from './opportunities.js'

const UA = { 'user-agent': 'CarolinaResearch/1.1 (+https://soycatalinajaramillo.com)', accept: 'application/json' }
// Encaje con el perfil real de Catalina: automatización/IA aplicada, e-commerce, CRM, operaciones, growth, CX, español.
export const PROFILE_FIT = /automat|\bai\b|\bia\b|inteligencia artificial|n8n|zapier|make\.com|no-?code|low-?code|crm|hubspot|gohighlevel|e-?commerce|shopify|growth|marketing ops|revops|revenue op|operations|operaciones|customer (success|experience)|\bcx\b|chatbot|conversational|prompt|llm|\bagents?\b|sales ops|community|whatsapp|spanish|español|latam|latin america|bilingual|biling[uü]e|implementation|consultant|consultor/i
export const PROFILE_REJECT = /software engineer|back-?end|front-?end|full-?stack|devops|data engineer|machine learning engineer|\bml engineer|ios|android|java\b|golang|rust\b|kubernetes|nurse|driver|accountant|attorney|lawyer|physician|therapist|teacher|warehouse|intern\b|principal engineer|staff engineer|security engineer|sre\b/i
// Catalina no es ingeniera de software: un puesto de "engineer/developer" solo entra si es de automatización o implementación.
export const profileFit = t => PROFILE_FIT.test(t) && !PROFILE_REJECT.test(t) && (!/engineer|developer|scientist|evaluator|reviewer|annotat|tutor/i.test(t) || /automation|automatizaci|n8n|zapier|no-?code|implementation|solutions/i.test(t))
const strip = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&amp;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim()

async function getJson(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) }).catch(() => null)
  return r?.ok ? r.json().catch(() => null) : null
}

export async function fetchJobFeeds() {
  const items = []
  const push = j => { if (j.url && j.title && profileFit(j.title)) items.push(j) }
  for (const q of ['automation', 'ecommerce', 'customer success', 'operations', 'crm']) {
    const d = await getJson('https://remotive.com/api/remote-jobs?limit=40&search=' + encodeURIComponent(q))
    for (const j of d?.jobs || []) push({ platform: 'remotive', url: j.url, title: j.title, company: j.company_name, location: j.candidate_required_location, description: strip(j.description).slice(0, 6000), tags: (j.tags || []).join(' ') })
  }
  const h = await getJson('https://himalayas.app/jobs/api?limit=100')
  for (const j of h?.jobs || []) push({ platform: 'himalayas', url: j.guid || j.applicationLink, title: j.title, company: j.companyName, location: (j.locationRestrictions || []).join(', ') || 'Remote', description: strip(j.description).slice(0, 6000), applyUrl: j.applicationLink, tags: (j.categories || []).join(' ') })
  for (const tag of ['automation', 'ecommerce', 'marketing', 'customer-success']) {
    const d = await getJson('https://jobicy.com/api/v2/remote-jobs?count=50&tag=' + tag)
    for (const j of d?.jobs || []) push({ platform: 'jobicy', url: j.url, title: j.jobTitle, company: j.companyName, location: j.jobGeo, description: strip(j.jobDescription).slice(0, 6000), tags: [].concat(j.jobIndustry || []).join(' ') })
  }
  const ro = await getJson('https://remoteok.com/api')
  for (const j of (Array.isArray(ro) ? ro.slice(1) : [])) push({ platform: 'remoteok', url: j.url, title: j.position, company: j.company, location: j.location || 'Remote', description: strip(j.description).slice(0, 6000), applyUrl: j.apply_url, tags: (j.tags || []).join(' ') })
  const seen = new Set()
  return items.filter(j => { const k = String(j.url).split('?')[0]; if (!/^https:\/\//.test(k) || seen.has(k)) return false; seen.add(k); return true })
}

// Dos barridos al día (7 a. m. y 1 p. m. hora Colombia). Solo las A/B gastan IA (tope por barrido).
export async function runJobFeeds(env, now = Date.now(), { force = false, fetcher = fetchJobFeeds, ingest = ingestOpportunities } = {}) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]))
  const hour = Number(parts.hour)
  if (!force && ![7, 13].includes(hour)) return { due: false }
  const key = 'jobfeeds_' + parts.year + parts.month + parts.day + '_' + hour
  const mark = await env.DB.prepare('INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES (?,?,?)').bind(key, 'running', now).run().catch(() => null)
  if (!force && !mark?.meta?.changes) {
    const retry = await env.DB.prepare("UPDATE app_settings SET value='running',updated_at=? WHERE key=? AND (value LIKE 'error:%' OR (value='running' AND updated_at<?))")
      .bind(now,key,now-20*60000).run().catch(() => null)
    if (!retry?.meta?.changes) return { due: false }
  }
  try {
    const items = await fetcher()
    const result = await ingest(env, 'jobfeeds', items, { limit: Number(env.JOBFEED_BRIEF_LIMIT || 20) })
    const summary = { fetched: items.length, received: result.received, A: result.A, B: result.B, C: result.C, prepared: result.prepared, duplicates: result.duplicates }
    await env.DB.prepare('UPDATE app_settings SET value=?,updated_at=? WHERE key=?').bind(JSON.stringify(summary), Date.now(), key).run()
    return summary
  } catch (e) {
    const reason=String(e?.message||e).slice(0,180)
    await env.DB.prepare('UPDATE app_settings SET value=?,updated_at=? WHERE key=?').bind('error:'+reason,Date.now(),key).run().catch(()=>{})
    return { due:true,error:reason }
  }
}
