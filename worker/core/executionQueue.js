// Cola comercial: sólo confirma envíos con evidencia externa o confirmación visible del ATS.
const DAY=86400000
const safe=v=>String(v||'').slice(0,500)

export async function refreshExecutionQueue(env, now=Date.now()) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS execution_queue (
    source_url TEXT PRIMARY KEY, company TEXT, opportunity TEXT, platform TEXT, channel TEXT,
    fit TEXT, apply_url TEXT, priority INTEGER NOT NULL, state TEXT NOT NULL,
    blocker TEXT, provider_id TEXT, found_at INTEGER, attempted_at INTEGER,
    confirmed_at INTEGER, updated_at INTEGER NOT NULL
  )`).run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_execution_queue_priority ON execution_queue(state,priority,found_at)').run()
  await env.DB.prepare(`INSERT INTO execution_queue(source_url,company,opportunity,platform,channel,fit,apply_url,priority,state,blocker,provider_id,found_at,attempted_at,confirmed_at,updated_at)
    SELECT i.url,i.who,i.need,i.platform,
      CASE WHEN d.route='email' OR i.application_route='email' THEN 'direct_email'
           WHEN d.route='official_form' OR i.application_route='official_form' THEN 'public_ats'
           ELSE 'authenticated_platform' END,
      i.fit,CASE WHEN d.route='official_form' THEN d.blocker ELSE i.url END,
      CASE WHEN i.fit='alto' THEN 100 ELSE 65 END + CASE WHEN i.application_route='email' THEN 25 WHEN i.application_route='official_form' THEN 15 ELSE 0 END,
      CASE WHEN d.provider_id IS NOT NULL AND d.provider_id<>'' AND d.status IN ('sent','external_email_sent','replied','delivered') THEN 'SUBMITTED_CONFIRMED'
           WHEN d.status IN ('bounced','failed','suppressed','complained') THEN 'DELIVERY_FAILED'
           WHEN d.status IN ('sending','direct_email_failed') THEN 'SUBMISSION_ATTEMPTED'
           WHEN d.status LIKE 'waiting_human%' OR i.status LIKE 'waiting_human%' THEN 'HUMAN_ACTION_REQUIRED'
           ELSE 'APPLICATION_PREPARED' END,
      d.blocker,d.provider_id,i.found_at,d.last_attempt_at,d.sent_at,?
    FROM intent_leads i LEFT JOIN direct_applications d ON d.source_url=i.url
    WHERE i.fit IN ('alto','medio') AND coalesce(i.active_now,1)=1
      AND (coalesce(i.explicit_demand,0)=1 OR i.status IN ('application_ready','waiting_human_submit','waiting_human_form','waiting_human_channel','direct_application_pending','needs_application_review'))
    ON CONFLICT(source_url) DO UPDATE SET company=excluded.company,opportunity=excluded.opportunity,
      platform=excluded.platform,channel=excluded.channel,fit=excluded.fit,apply_url=excluded.apply_url,
      priority=excluded.priority,state=excluded.state,blocker=excluded.blocker,provider_id=excluded.provider_id,
      attempted_at=excluded.attempted_at,confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at`).bind(now).run()
  await env.DB.prepare(`INSERT INTO execution_queue(source_url,company,opportunity,platform,channel,fit,apply_url,priority,state,blocker,provider_id,found_at,attempted_at,confirmed_at,updated_at)
    SELECT url,company,title,platform,'public_ats',grade,apply_url,
      CASE grade WHEN 'A' THEN 120 ELSE 80 END,
      CASE WHEN status='submitted' AND CASE WHEN json_valid(evidence) THEN json_extract(evidence,'$.providerId') ELSE NULL END IS NOT NULL THEN 'SUBMITTED_CONFIRMED'
           WHEN coalesce(attempts,0)>0 AND status='human_action' THEN 'HUMAN_ACTION_REQUIRED'
           WHEN coalesce(attempts,0)>0 THEN 'SUBMISSION_ATTEMPTED'
           ELSE 'APPLICATION_PREPARED' END,
      CASE WHEN status='human_action' THEN evidence ELSE NULL END,
      CASE WHEN json_valid(evidence) THEN json_extract(evidence,'$.providerId') ELSE NULL END,created_at,
      CASE WHEN coalesce(attempts,0)>0 THEN updated_at ELSE NULL END,
      submitted_at,?
    FROM opportunities WHERE grade IN ('A','B') AND action IN ('SUBMIT_ATS_FORM','HUMAN_ACTION_REQUIRED','SUBMITTED_CONFIRMED')
    ON CONFLICT(source_url) DO UPDATE SET state=excluded.state,blocker=excluded.blocker,
      provider_id=excluded.provider_id,attempted_at=excluded.attempted_at,
      confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at`).bind(now).run().catch(()=>{})
  await env.DB.prepare(`INSERT INTO execution_queue(source_url,company,opportunity,platform,channel,fit,apply_url,priority,state,blocker,provider_id,found_at,attempted_at,confirmed_at,updated_at)
    SELECT 'marketplace:'||id,platform,title,platform,'authenticated_marketplace','A',url,85,
      CASE WHEN status='submitted' AND provider_id IS NOT NULL AND provider_id<>'' THEN 'SUBMITTED_CONFIRMED'
           WHEN status='ready_for_submission' THEN 'APPLICATION_PREPARED'
           WHEN status LIKE 'waiting_human%' THEN 'HUMAN_ACTION_REQUIRED'
           ELSE 'SUBMISSION_ATTEMPTED' END,
      error,provider_id,created_at,
      CASE WHEN status IN ('submitted','failed') THEN updated_at ELSE NULL END,
      CASE WHEN status='submitted' AND provider_id IS NOT NULL THEN updated_at ELSE NULL END,?
    FROM marketplace_submissions WHERE status NOT IN ('skipped','not_hiring')
    ON CONFLICT(source_url) DO UPDATE SET state=excluded.state,blocker=excluded.blocker,
      provider_id=excluded.provider_id,attempted_at=excluded.attempted_at,
      confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at`).bind(now).run().catch(()=>{})
  return env.DB.prepare(`SELECT state,COUNT(*) n FROM execution_queue GROUP BY state`).all()
}

export async function runExecutionBacklog(env,{quick=false}={}) {
  await refreshExecutionQueue(env)
  const direct=await import('../prospecting/applications.js')
  const opportunities=await import('../prospecting/opportunities.js')
  const browser=await import('./browserSessions.js')
  const run=async fn=>{try{return await fn()}catch(e){return {error:String(e?.message||e).slice(0,300)}}}
  const results={direct:await run(()=>direct.runDirectApplications(env)),ats:await run(()=>opportunities.runOpportunitySubmissions(env,{limit:quick?3:10})),browser:await run(()=>browser.runBrowserApplicationQueue(env,{limit:quick?3:10}))}
  results.queue=await refreshExecutionQueue(env)
  return results
}

export async function executionDashboard(env, now=Date.now()) {
  await refreshExecutionQueue(env,now)
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
  const start=Date.parse(day+'T00:00:00-05:00')
  const q=async(sql,...args)=>Number((await env.DB.prepare(sql).bind(...args).first().catch(()=>({n:0})))?.n||0)
  const [found,qualified,applicable,attempted,confirmed,emailSent,delivered,bounced,failed,complained,replied,meetings,contracts,revenue,aiCost]=await Promise.all([
    q('SELECT COUNT(*) n FROM execution_queue WHERE found_at>=?',start),
    q("SELECT COUNT(*) n FROM execution_queue WHERE found_at>=? AND fit IN ('alto','medio','A','B')",start),
    q("SELECT COUNT(*) n FROM execution_queue WHERE found_at>=? AND channel IN ('direct_email','public_ats') AND state IN ('APPLICATION_PREPARED','SUBMISSION_ATTEMPTED')",start),
    q('SELECT COUNT(*) n FROM execution_queue WHERE attempted_at>=?',start),
    q("SELECT COUNT(*) n FROM execution_queue WHERE confirmed_at>=? AND provider_id IS NOT NULL",start),
    q("SELECT COUNT(*) n FROM direct_applications WHERE sent_at>=? AND provider_id IS NOT NULL AND status IN ('sent','external_email_sent','replied','delivered','bounced','failed','suppressed','complained')",start),
    q("SELECT COUNT(DISTINCT source_url) n FROM direct_application_events WHERE type='email.delivered' AND occurred_at>=?",start),
    q("SELECT COUNT(DISTINCT source_url) n FROM direct_application_events WHERE type='email.bounced' AND occurred_at>=?",start),
    q("SELECT COUNT(DISTINCT source_url) n FROM direct_application_events WHERE type='email.failed' AND occurred_at>=?",start),
    q("SELECT COUNT(DISTINCT source_url) n FROM direct_application_events WHERE type='email.complained' AND occurred_at>=?",start),
    q("SELECT COUNT(*) n FROM direct_applications WHERE status='replied' AND updated_at>=?",start),
    q('SELECT COUNT(*) n FROM meetings WHERE created_at>=?',start),
    q('SELECT COUNT(*) n FROM deals WHERE won_at>=?',start),
    q('SELECT coalesce(SUM(amount_usd),0) n FROM deals WHERE won_at>=?',start),
    q('SELECT coalesce(SUM(cost),0) n FROM ai_calls WHERE at>=?',start)
  ])
  const actions=(await env.DB.prepare('SELECT source_url,company,opportunity,platform,channel,state,blocker,provider_id,updated_at,apply_url FROM execution_queue ORDER BY updated_at DESC LIMIT 20').all()).results||[]
  const human=actions.filter(x=>x.state==='HUMAN_ACTION_REQUIRED').slice(0,5)
  const blocked={captcha:0,login:0,personalQuestion:0,payment:0,unsupported:0}
  for(const x of (await env.DB.prepare("SELECT blocker FROM execution_queue WHERE state='HUMAN_ACTION_REQUIRED'").all()).results||[]){
    const b=safe(x.blocker).toLowerCase()
    if(/captcha|hcaptcha|recaptcha/.test(b))blocked.captcha++
    else if(/session|login|auth|mfa/.test(b))blocked.login++
    else if(/question|pregunta|salary|phone/.test(b))blocked.personalQuestion++
    else if(/payment|connects|credit/.test(b))blocked.payment++
    else blocked.unsupported++
  }
  return {today:{found,qualified,applicable,attempted,submittedConfirmed:confirmed,emailSent,delivered,bounced,failed,complained,replied,positiveResponses:null,meetings,proposals:null,contracts,revenue,aiCost},blocked,actions,human}
}
