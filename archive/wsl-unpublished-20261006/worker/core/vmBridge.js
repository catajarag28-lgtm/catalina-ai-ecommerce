import { manualApplicationQueue } from './revenueOS.js'

const safe = v => String(v ?? '').trim()
const allowedResultStatuses = new Set([
  'SUBMITTED_CONFIRMED','ALREADY_SUBMITTED','WAITING_HUMAN_FORM','WAITING_HUMAN_CHANNEL',
  'WAITING_HUMAN_CHALLENGE','WAITING_HUMAN_COST','LOGIN_REQUIRED',
  'SUBMIT_CLICKED_UNCONFIRMED','CLOSED','ERROR','UNSUPPORTED',
])

export function normalizeVmApplicationStatus(value) {
  const raw = safe(value).toUpperCase()
  return allowedResultStatuses.has(raw) ? raw : 'ERROR'
}

export async function vmApplicationQueue(env, { limit = 40 } = {}) {
  const rows = await manualApplicationQueue(env)
  const max = Math.max(1, Math.min(60, Number(limit) || 40))
  const out = []
  const now = Date.now()
  for (const row of rows) {
    if (out.length >= max) break
    const prior = await env.DB.prepare('SELECT next_attempt_at,terminal,status FROM direct_applications WHERE source_url=?')
      .bind(row.url).first().catch(() => null)
    if (Number(prior?.terminal || 0) === 1) continue
    if (Number(prior?.next_attempt_at || 0) > now) continue
    out.push({ ...row, previousApplicationStatus: prior?.status || null })
  }
  return {
    at: new Date(now).toISOString(),
    count: out.length,
    profile: {
      name: 'Catalina Jaramillo',
      email: safe(env.CATALINA_EMAIL),
      phone: safe(env.CATALINA_WHATSAPP),
      linkedin: safe(env.CATALINA_LINKEDIN_URL),
      portfolio: 'https://portfolio-nine-lovat-18.vercel.app',
    },
    rows: out,
  }
}

function mapping(status) {
  if (status === 'SUBMITTED_CONFIRMED' || status === 'ALREADY_SUBMITTED') return { intent:'submitted', application:'sent', terminal:1, delay:0 }
  if (status === 'CLOSED') return { intent:'not_hiring', application:'not_hiring', terminal:1, delay:0 }
  if (status === 'WAITING_HUMAN_FORM') return { intent:'waiting_human_form', application:'waiting_human_form', terminal:0, delay:12*3600000 }
  if (status === 'WAITING_HUMAN_CHANNEL' || status === 'LOGIN_REQUIRED' || status === 'WAITING_HUMAN_CHALLENGE') return { intent:'waiting_human_channel', application:'waiting_human_channel', terminal:0, delay:6*3600000 }
  if (status === 'WAITING_HUMAN_COST' || status === 'SUBMIT_CLICKED_UNCONFIRMED') return { intent:'waiting_human_submit', application:'waiting_human_submit', terminal:0, delay:24*3600000 }
  if (status === 'UNSUPPORTED') return { intent:'waiting_human_channel', application:'waiting_human_channel', terminal:0, delay:24*3600000 }
  return { intent:'waiting_human_submit', application:'waiting_human_submit', terminal:0, delay:3600000 }
}

export async function recordVmApplicationResult(env, payload, now = Date.now()) {
  const url = safe(payload?.url)
  if (!/^https:\/\//i.test(url) || url.length > 1800) throw new Error('invalid_url')
  const status = normalizeVmApplicationStatus(payload?.status)
  const platform = safe(payload?.platform).slice(0,80)
  const reason = safe(payload?.reason || payload?.action || payload?.error).slice(0,700)
  const providerId = safe(payload?.providerId).slice(0,180)
  const result = mapping(status)
  const nextAttempt = result.terminal ? null : now + result.delay
  const route = ('vm_browser_' + (platform || 'web').toLowerCase().replace(/[^a-z0-9]+/g,'_')).slice(0,120)

  const exists = await env.DB.prepare('SELECT url FROM intent_leads WHERE url=?').bind(url).first().catch(() => null)
  if (!exists?.url) throw new Error('unknown_opportunity')

  await env.DB.prepare(`INSERT INTO direct_applications(
    source_url,platform,route,status,provider_id,error,blocker,attempt_count,last_attempt_at,next_attempt_at,terminal,created_at,updated_at,sent_at
  ) VALUES (?,?,?,?,?,?,?,1,?,?,?,?,?,?)
  ON CONFLICT(source_url) DO UPDATE SET
    platform=excluded.platform,route=excluded.route,status=excluded.status,
    provider_id=CASE WHEN excluded.provider_id<>'' THEN excluded.provider_id ELSE direct_applications.provider_id END,
    error=excluded.error,blocker=excluded.blocker,
    attempt_count=coalesce(direct_applications.attempt_count,0)+1,
    last_attempt_at=excluded.last_attempt_at,next_attempt_at=excluded.next_attempt_at,
    terminal=excluded.terminal,updated_at=excluded.updated_at,
    sent_at=CASE WHEN excluded.status='sent' THEN excluded.sent_at ELSE direct_applications.sent_at END
  `).bind(url,platform,route,result.application,providerId,reason,reason,now,nextAttempt,result.terminal,now,now,result.application==='sent'?now:null).run()

  await env.DB.prepare('UPDATE intent_leads SET status=? WHERE url=?').bind(result.intent,url).run().catch(()=>{})
  if (result.application === 'sent') {
    const id = providerId || ('vm:' + (platform || 'web') + ':' + now)
    await env.DB.prepare('UPDATE direct_applications SET provider_id=? WHERE source_url=?').bind(id,url).run().catch(()=>{})
  }
  return { ok:true,url,platform,status,intentStatus:result.intent,applicationStatus:result.application,terminal:!!result.terminal,nextAttemptAt:nextAttempt?new Date(nextAttempt).toISOString():null }
}
