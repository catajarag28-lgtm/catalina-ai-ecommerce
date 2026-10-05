import { notifyCatalina } from './notify.js'

const DAY=86400000
const PROFILE='https://soycatalinajaramillo.com/perfil-catalina.html'
const PROFILE_EN='https://soycatalinajaramillo.com/catalina-profile.html'
const PORTFOLIO='https://portfolio-nine-lovat-18.vercel.app'
const CV_ES='https://soycatalinajaramillo.com/Catalina_Jaramillo_AI_Automation_Resume_2026.pdf'
const CV_EN='https://soycatalinajaramillo.com/Catalina_Jaramillo_AI_Automation_Resume_2026_EN.pdf'

function detectLanguage(text=''){
  const s=' '+String(text).toLowerCase().replace(/[^a-zÃ¡Ã©Ã­Ã³ÃºÃ±Ã¼\s]/g,' ')+' '
  const en=(s.match(/\b(the|and|with|for|your|you|we|our|role|project|automation|experience|team|work|looking|hiring)\b/g)||[]).length
  const es=(s.match(/\b(el|la|los|las|y|con|para|tu|usted|equipo|proyecto|automatizaciÃ³n|experiencia|trabajo|busca|buscando|contratar)\b/g)||[]).length
  if(en===es)return null
  return en>es?'en':'es'
}

const n = x => Number(x?.n || 0)
const one = async (env,sql,...args) => env.DB.prepare(sql).bind(...args).first().catch(()=>({n:0}))

export function revenueTargets(paused){
  return paused
    ? {outbound:0,directApplications:20,marketplaces:15,intent:13,partners:12,abm:6,followups:9}
    : {outbound:20,directApplications:15,marketplaces:10,intent:10,partners:8,abm:4,followups:8}
}

export async function buildRevenuePlan(env, now=Date.now()){
  const since=now-DAY
  const [control,outbound,direct,market,intent,partners,abm,followups,meetings]=await Promise.all([
    env.DB.prepare('SELECT paused,reason,daily_cap FROM outreach_control WHERE id=1').first().catch(()=>({paused:0,reason:''})),
    one(env,"SELECT COUNT(*) n FROM outreach WHERE kind!='partner' AND sent_at>=?",since),
    one(env,"SELECT COUNT(*) n FROM direct_applications WHERE status IN ('sent','external_email_sent','replied') AND COALESCE(sent_at,updated_at)>=?",since),
    one(env,"SELECT COUNT(*) n FROM marketplace_submissions WHERE status='submitted' AND provider_id IS NOT NULL AND updated_at>=?",since),
    one(env,"SELECT COUNT(*) n FROM intent_leads WHERE found_at>=?",since),
    one(env,"SELECT COUNT(*) n FROM outreach WHERE kind='partner' AND sent_at>=?",since),
    one(env,"SELECT COUNT(*) n FROM outreach_events WHERE type='contact.listed' AND occurred_at>=?",since),
    one(env,"SELECT COUNT(*) n FROM outreach_events WHERE type IN ('followup.sent','hot.followup') AND occurred_at>=?",since),
    one(env,"SELECT COUNT(*) n FROM meetings WHERE created_at>=?",since)
  ])
  const paused=!!control?.paused
  // Capacidad comercial total objetivo. No es cuota ciega: son carriles a llenar con acciones legÃ­timas.
  const targets=revenueTargets(paused)
  const actual={
    outbound:n(outbound),directApplications:n(direct),marketplaces:n(market),intent:n(intent),
    partners:n(partners),abm:n(abm),followups:n(followups),meetings:n(meetings)
  }
  const deficits=Object.fromEntries(Object.entries(targets).map(([k,v])=>[k,Math.max(0,v-(actual[k]||0))]))
  const plan={
    at:new Date(now).toISOString(),
    coldOutreachPaused:paused,
    pauseReason:control?.reason||'',
    targetQualifiedActions:Object.values(targets).reduce((a,b)=>a+b,0),
    targets,actual,deficits,
    boostIntent:paused || deficits.intent>=3,
    boostMarketplaces:paused || deficits.marketplaces>=3,
    boostApplications:paused || deficits.directApplications>=3,
    boostPartners:paused || deficits.partners>=3,
    boostABM:deficits.abm>=2,
    boostFollowups:deficits.followups>=2
  }
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES ('revenue_plan',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(JSON.stringify(plan).slice(0,8000),now).run()
  return plan
}

function hash(text){
  let h=2166136261
  for(let i=0;i<text.length;i++){ h^=text.charCodeAt(i); h=Math.imul(h,16777619) }
  return (h>>>0).toString(16)
}

export async function manualApplicationQueue(env, now=Date.now()){
  const rows=(await env.DB.prepare(`SELECT
      i.url,i.platform,i.who,i.need,i.fit,i.reply,i.application_route,i.language,i.evidence,i.status AS intent_status,i.found_at,
      d.status AS application_status,d.blocker,d.body,d.subject,d.recipient
    FROM intent_leads i
    LEFT JOIN direct_applications d ON d.source_url=i.url
    WHERE i.fit IN ('alto','medio')
      AND (coalesce(i.explicit_demand,0)=1 OR i.status IN ('application_ready','waiting_human_submit','waiting_human_form','waiting_human_channel','official_api_pending','official_api_matched','direct_application_pending','needs_application_review'))
      AND coalesce(i.active_now,1)=1
      AND (
        i.status IN ('application_ready','waiting_human_submit','waiting_human_form','waiting_human_channel','needs_application_review')
        OR d.status IN ('waiting_human_submit','waiting_human_form','waiting_human_channel','needs_review')
      )
      AND coalesce(d.status,'') NOT IN ('sent','external_email_sent','replied','not_hiring')
      AND i.status NOT IN ('submitted','external_email_sent','direct_email_sent','not_hiring')
      AND lower(i.platform) IN ('linkedin','upwork','workana','contra','peopleperhour','people per hour','guru','malt','twine','wellfound')
    ORDER BY CASE i.fit WHEN 'alto' THEN 0 ELSE 1 END, i.found_at DESC
    LIMIT 60`).all()).results||[]
  return rows.map(r=>{
    const foundAt=Number(r.found_at||now)
    const ageHours=Math.max(0,(now-foundAt)/3600000)
    const dueAt=foundAt+2*3600000
    const overdue=ageHours>=2
    const proposal=String(r.body||r.reply||'').slice(0,2200)
    const detectedLanguage=detectLanguage([r.evidence,proposal,r.need,r.who].filter(Boolean).join(' '))
    const language=detectedLanguage||(r.language==='en'||r.language==='es'?r.language:'es')
    return {
    platform:String(r.platform||'').trim(),
    project:String(r.who||r.need||'Oportunidad').slice(0,180),
    url:r.url,
    fit:r.fit||'alto',
    need:String(r.need||'').slice(0,500),
    route:r.application_route||'unknown',
    status:r.application_status||r.intent_status||'WAITING_HUMAN',
    blocker:String(r.blocker||'La plataforma requiere acciÃ³n humana/autenticada.').slice(0,400),
    proposal,
    language,
    cv:language==='en'?(env.CV_EN_URL||CV_EN):(env.CV_ES_URL||CV_ES),
    visualProfile:language==='en'?(env.PROFILE_EN_URL||PROFILE_EN):(env.PROFILE_ES_URL||PROFILE),
    englishProfile:env.PROFILE_EN_URL||PROFILE_EN,
    spanishProfile:env.PROFILE_ES_URL||PROFILE,
    portfolio:PORTFOLIO,
    foundAt,
    ageHours:Number(ageHours.toFixed(1)),
    dueAt:new Date(dueAt).toISOString(),
    overdue,
    nextAction:'Abrir la plataforma autenticada, revisar preguntas obligatorias y enviar. Si aparece CAPTCHA/MFA o una pregunta no verificable, escalar a Catalina sin inventar.'
  }})
}

export async function sendManualApplicationQueue(env, now=Date.now(), force=false){
  const rows=await manualApplicationQueue(env,now)
  if(!rows.length) return {sent:false,count:0}
  const signature=hash(rows.map(r=>r.platform+'|'+r.url+'|'+r.status).join('\n'))
  const prior=await env.DB.prepare("SELECT value FROM app_settings WHERE key='manual_queue_signature'").first().catch(()=>null)
  const lastDay=await env.DB.prepare("SELECT value FROM app_settings WHERE key='manual_queue_last_day'").first().catch(()=>null)
  const lastAlert=await env.DB.prepare("SELECT value FROM app_settings WHERE key='manual_queue_last_alert_at'").first().catch(()=>null)
  const overdueCount=rows.filter(r=>r.overdue).length
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]))
  const hour=Number(parts.hour||0)
  const day=parts.year+'-'+parts.month+'-'+parts.day
  if(!force && prior?.value===signature){
    const lastAlertAt=Number(lastAlert?.value||0)
    const overdueReminder=overdueCount>0 && now-lastAlertAt>=4*3600000
    const morningDigest=hour===8 && lastDay?.value!==day
    if(!overdueReminder && !morningDigest) return {sent:false,count:rows.length,overdueCount,unchanged:true}
  }
  const lines=[
    'Estas oportunidades YA fueron calificadas, pero requieren una acciÃ³n humana dentro de la plataforma.',
    'No estÃ¡n contadas como SUBMITTED. Catalina solo debe abrir, revisar y pulsar/enviar.',
    '',
    ...rows.slice(0,20).flatMap((r,i)=>[
      `${i+1}. [${r.platform}] ${r.project}`,
      `   FIT: ${r.fit} Â· ESTADO: ${r.status} Â· RUTA: ${r.route}`,
      `   QuÃ© pide: ${r.need}`,
      `   Link: ${r.url}`,
      `   Bloqueo: ${r.blocker}`,
      `   SLA: ${r.overdue?'VENCIDA Â· '+r.ageHours+'h esperando':'vence '+r.dueAt}`,
      `   Siguiente acciÃ³n: ${r.nextAction}`,
      `   CV: ${r.cv}`,
      `   Perfil visual: ${r.visualProfile}`,
      `   Portafolio: ${r.portfolio}`,
      r.proposal ? '   PROPUESTA LISTA:\n   '+r.proposal.replace(/\n/g,'\n   ') : '   PROPUESTA: requiere redacciÃ³n final dentro de la plataforma.',
      '   QUÃ‰ HACES TÃš: abre el link, sube el CV si lo pide, revisa preguntas obligatorias y pulsa enviar. Si aparece una pregunta nueva, no inventes experiencia.',
      ''
    ])
  ]
  await notifyCatalina(env,`ðŸ–±ï¸ POSTULACIONES MANUALES PENDIENTES Â· ${rows.length}`,lines.join('\n')).catch(()=>{})
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES ('manual_queue_signature',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(signature,now).run()
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES ('manual_queue_last_day',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(day,now).run()
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES ('manual_queue_last_alert_at',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(String(now),now).run()
  return {sent:true,count:rows.length,overdueCount}
}

export async function revenueSnapshot(env,now=Date.now()){
  const plan=await buildRevenuePlan(env,now)
  const manual=await manualApplicationQueue(env,now)
  return {plan,manualCount:manual.length,manualOverdue:manual.filter(x=>x.overdue).length,manual:manual.slice(0,12)}
}

