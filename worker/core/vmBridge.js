// Bridge canónico Worker <-> navegador persistente de la VM.
// La VM descubre; el Worker califica/redacta; la VM solo ejecuta la propuesta ya aprobada por quality gate.
const safe = v => String(v ?? '').trim()

export const VM_RESULT_STATUSES = new Set([
  'SUBMITTED_CONFIRMED','ALREADY_APPLIED_OR_CONFIRMED','READY_TO_SUBMIT_DRY_RUN',
  'WAITING_HUMAN_BLOCKER','WAITING_HUMAN_LOGIN','WAITING_HUMAN_FIELDS',
  'WAITING_HUMAN_COMMUNITY_REPLY','WAITING_HUMAN_NO_APPLY_ROUTE',
  'PREPARED_NO_FINAL_BUTTON','WAITING_HUMAN_MULTISTEP',
  'SUBMIT_CLICKED_UNCONFIRMED','DIRECT_CONTACT_FOUND','ERROR',
])

export function normalizeVmResult(value) {
  const s = safe(value).toUpperCase()
  return VM_RESULT_STATUSES.has(s) ? s : 'ERROR'
}

export function verifiedVmStatus(value, providerId) {
  const status=normalizeVmResult(value)
  if (['SUBMITTED_CONFIRMED','ALREADY_APPLIED_OR_CONFIRMED'].includes(status) && !safe(providerId))
    return 'SUBMIT_CLICKED_UNCONFIRMED'
  return status
}

export function mapVmResult(value) {
  const status = normalizeVmResult(value)
  if (status === 'SUBMITTED_CONFIRMED' || status === 'ALREADY_APPLIED_OR_CONFIRMED')
    return { application:'sent', intent:'submitted', opportunity:'submitted', terminal:1, delay:0 }
  if (status === 'READY_TO_SUBMIT_DRY_RUN')
    return { application:'ready_for_submission', intent:'waiting_human_submit', opportunity:'prepared', terminal:0, delay:0 }
  if (status === 'SUBMIT_CLICKED_UNCONFIRMED')
    return { application:'waiting_human_submit', intent:'waiting_human_submit', opportunity:'prepared', terminal:0, delay:24*3600000 }
  if (status === 'WAITING_HUMAN_LOGIN' || status === 'WAITING_HUMAN_BLOCKER')
    return { application:'waiting_human_channel', intent:'waiting_human_channel', opportunity:'prepared', terminal:0, delay:6*3600000 }
  if (status === 'WAITING_HUMAN_FIELDS')
    return { application:'waiting_human_form', intent:'waiting_human_form', opportunity:'prepared', terminal:0, delay:12*3600000 }
  if (status === 'DIRECT_CONTACT_FOUND')
    return { application:'needs_review', intent:'needs_application_review', opportunity:'prepared', terminal:0, delay:0 }
  if (status === 'WAITING_HUMAN_COMMUNITY_REPLY' || status === 'WAITING_HUMAN_NO_APPLY_ROUTE' || status === 'PREPARED_NO_FINAL_BUTTON' || status === 'WAITING_HUMAN_MULTISTEP')
    return { application:'waiting_human_channel', intent:'waiting_human_channel', opportunity:'prepared', terminal:0, delay:24*3600000 }
  return { application:'needs_review', intent:'needs_application_review', opportunity:'prepared', terminal:0, delay:3600000 }
}

const parse = s => { try { return JSON.parse(s || '{}') } catch { return {} } }

/** Única cola que puede consumir el navegador de la VM. Solo A/B + quality=passed + propuesta real. */
export async function vmApplicationQueue(env, { limit = 50 } = {}) {
  const max = Math.max(1, Math.min(500, Number(limit) || 500))
  const rows = (await env.DB.prepare(`SELECT
      o.url,o.platform,o.title,o.company,o.score,o.grade,o.easy_apply,o.brief,o.proposal,o.quality,o.action,o.updated_at,
      d.status AS application_status,d.terminal,d.next_attempt_at
    FROM opportunities o
    LEFT JOIN direct_applications d ON d.source_url=o.url
    WHERE o.status='prepared'
      AND o.grade IN ('A','B')
      AND o.quality='passed'
      AND o.action IN ('HUMAN_SUBMIT_REQUIRED','READY_FOR_REVIEW','AUTO_SUBMIT')
      AND coalesce(d.terminal,0)=0
      AND coalesce(d.status,'') NOT IN ('sent','external_email_sent','replied','not_hiring','skipped')
    ORDER BY CASE o.grade WHEN 'A' THEN 0 ELSE 1 END, o.score DESC, o.updated_at DESC
    LIMIT ?`).bind(max * 2).all()).results || []
  const now = Date.now()
  const items = rows
    .filter(r => !Number(r.next_attempt_at || 0) || Number(r.next_attempt_at) <= now)
    .filter(r => safe(r.proposal).split(/\s+/).length >= 80)
    .slice(0, max)
    .map(r => ({
      platform: safe(r.platform),
      title: safe(r.title),
      company: safe(r.company),
      url: safe(r.url),
      score: Number(r.score || 0),
      grade: r.grade,
      status: r.grade === 'A' ? 'ENVIABLE_PRIORIDAD_ALTA' : 'ENVIABLE_PRIORIDAD_MEDIA',
      action: r.action,
      quality: r.quality,
      easyApply: Number(r.easy_apply||0)===1,
      brief: parse(r.brief),
      proposal: safe(r.proposal),
      applicationStatus: r.application_status || null,
    }))
  return { at:new Date(now).toISOString(), source:'worker_canonical_opportunities', count:items.length, items }
}

/** Registra la verdad de lo que hizo el navegador. Idempotente por source_url. */
export async function recordVmApplicationResult(env, payload, now = Date.now()) {
  const url = safe(payload?.url)
  if (!/^https:\/\//i.test(url) || url.length > 1800) throw new Error('invalid_url')
  const exists = await env.DB.prepare('SELECT url FROM opportunities WHERE url=?').bind(url).first().catch(() => null)
  if (!exists?.url) throw new Error('unknown_opportunity')
  const providerId = safe(payload?.providerId).slice(0,180)
  const rawStatus = verifiedVmStatus(payload?.status,providerId)
  const m = mapVmResult(rawStatus)
  const platform = safe(payload?.platform).slice(0,80)
  const reason = safe(payload?.reason || payload?.error || payload?.action).slice(0,700)
  const fields=Array.isArray(payload?.fields)?payload.fields.slice(0,8).map(f=>({name:safe(f.name).slice(0,80),type:safe(f.type).slice(0,40),label:safe(f.label).slice(0,180)})):[]
  const detail = JSON.stringify({status:rawStatus,reason,currentUrl:safe(payload?.currentUrl),fields,visibleActions:Array.isArray(payload?.visibleActions)?payload.visibleActions.slice(0,8):[]})
  const nextAttempt = m.terminal || !m.delay ? null : now + m.delay
  const route = ('vm_browser_' + (platform || 'web').toLowerCase().replace(/[^a-z0-9]+/g,'_')).slice(0,120)
  const sentAt = m.application === 'sent' ? now : null

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
      sent_at=CASE WHEN excluded.sent_at IS NOT NULL THEN excluded.sent_at ELSE direct_applications.sent_at END`)
    .bind(url,platform,route,m.application,providerId,reason,detail,now,nextAttempt,m.terminal,now,now,sentAt).run()

  await env.DB.prepare('UPDATE opportunities SET status=?,updated_at=? WHERE url=?').bind(m.opportunity,now,url).run()
  await env.DB.prepare('UPDATE intent_leads SET status=? WHERE url=?').bind(m.intent,url).run().catch(()=>{})
  return { ok:true,url,platform,vmStatus:rawStatus,applicationStatus:m.application,intentStatus:m.intent,terminal:!!m.terminal,nextAttemptAt:nextAttempt }
}
