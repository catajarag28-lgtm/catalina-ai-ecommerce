import { notifyCatalina } from '../core/notify.js'
import { acquisitionConstitution, acquisitionStrategyContext } from '../core/acquisitionStrategy.js'

const FL_BASE='https://www.freelancer.com'
const FL_QUERIES=[
  'AI automation',
  'AI agent',
  'AI WhatsApp chatbot',
  'WhatsApp automation',
  'CRM automation',
  'lead qualification AI',
  'appointment booking automation',
  'real estate automation',
  'Shopify automation',
  'Shopify customer service AI',
  'n8n OpenAI automation',
  'n8n WhatsApp',
  'Make.com automation',
  'OpenAI integration',
  'sales automation',
  'customer service AI',
]

const safe=v=>String(v??'').trim()
const num=v=>Number.isFinite(Number(v))?Number(v):null

export function freelancerReady(env={}) {
  return env.MARKETPLACE_AUTOSUBMIT_ENABLED==='true' &&
    env.FREELANCER_BID_SCOPE_VERIFIED==='true' &&
    !!env.FREELANCER_OAUTH_TOKEN
}
export function freelancerBidAllowance(env={},hasVerifiedSubmission=false) {
  // A real provider_id stored in D1 is stronger evidence than a manual flag.
  // Until the first verified submission exists, allow attempts until one succeeds.
  if(env.FREELANCER_FIRST_BID_VERIFIED!=='true' && !hasVerifiedSubmission) return 1
  return Math.max(1,Math.min(15,Number(env.FREELANCER_DAILY_BID_LIMIT||8)))
}
export function upworkReady(env={}) {
  // La API de Upwork sí permite enviar propuestas, pero Carolina solo se marca lista
  // cuando el adaptador y el permiso Submit Proposal estén efectivamente validados.
  return env.MARKETPLACE_AUTOSUBMIT_ENABLED==='true' &&
    env.UPWORK_ADAPTER_READY==='true' &&
    env.UPWORK_SUBMIT_PROPOSAL_ENABLED==='true' &&
    !!env.UPWORK_ACCESS_TOKEN
}

async function ensureTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS marketplace_submissions (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    external_id TEXT NOT NULL,
    url TEXT,
    title TEXT,
    amount REAL,
    currency TEXT,
    proposal TEXT,
    status TEXT NOT NULL,
    provider_id TEXT,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_marketplace_submissions_platform_status ON marketplace_submissions(platform,status,created_at)').run().catch(()=>{})
}

async function fl(path,{method='GET',body=null,params=null}={},env) {
  const url=new URL(path,FL_BASE)
  if(params) for(const [k,v] of Object.entries(params)) if(v!==undefined&&v!==null&&v!=='') {
    if(Array.isArray(v)) for(const x of v) url.searchParams.append(k,String(x)); else url.searchParams.set(k,String(v))
  }
  const res=await fetch(url.toString(),{
    method,
    headers:{'Freelancer-OAuth-V1':env.FREELANCER_OAUTH_TOKEN,'User-Agent':'Carolina-Acquisition/1.0','content-type':'application/json'},
    body:body?JSON.stringify(body):undefined,
    signal:AbortSignal.timeout(20000),
  }).catch(()=>null)
  const data=await res?.json().catch(()=>({}))
  if(!res?.ok) return {ok:false,status:res?.status||0,data}
  return {ok:true,status:res.status,data}
}

async function freelancerSelf(env) {
  const r=await fl('/api/users/0.1/self/',{},env)
  return r.ok ? r.data?.result?.id || null : null
}

function projectUrl(p) {
  if(/^https:\/\//i.test(safe(p?.url))) return p.url
  if(p?.seo_url) return FL_BASE+'/projects/'+String(p.seo_url).replace(/^\/+|\/+$/g,'')
  return p?.id ? FL_BASE+'/projects/'+p.id : FL_BASE
}

function normalizeProject(p) {
  const budget=p?.budget||{}
  const currency=p?.currency||{}
  return {
    id:safe(p?.id),
    title:safe(p?.title).slice(0,240),
    description:safe(p?.description||p?.full_description).slice(0,7000),
    type:safe(p?.type||'FIXED'),
    budgetMin:num(budget.minimum),
    budgetMax:num(budget.maximum),
    currency:safe(currency.code||currency.sign||''),
    jobs:Array.isArray(p?.jobs)?p.jobs.map(j=>safe(j?.name||j?.seo_url)).filter(Boolean).slice(0,20):[],
    url:projectUrl(p),
  }
}

async function searchFreelancer(env,query) {
  const r=await fl('/api/projects/0.1/projects/active/',{params:{
    query,limit:12,offset:0,sort_field:'time_updated',or_search_query:'true',
    full_description:'true',job_details:'true'
  }},env)
  if(!r.ok) return []
  const raw=r.data?.result?.projects || r.data?.result || []
  return (Array.isArray(raw)?raw:[]).map(normalizeProject).filter(p=>p.id&&p.title&&p.description)
}

function freelancerRelevance(p) {
  const text=[p.title,p.description,...(p.jobs||[])].join(' ').toLowerCase()
  const patterns=[
    /\bn8n\b/, /whatsapp/, /ai agent|agente de ia|agente ia/, /automation|automatiz/,
    /crm/, /shopify|e-?commerce/, /openai|gpt|llm/, /lead qualif|calific.*lead/,
    /appointment|booking|agenda|cita/, /real estate|realtor|inmobili/,
    /customer service|atenci[oó]n al cliente/, /sales automation|automatiz.*venta/
  ]
  const hits=patterns.reduce((n,re)=>n+(re.test(text)?1:0),0)
  const budget=(p.budgetMax||0)
  return hits*1000 + Math.min(budget,10000)/10
}

async function judgeFreelancer(env,p) {
  const acquisitionStrategy=await acquisitionStrategyContext(env).catch(()=> '')
  const budgetText=[p.currency,p.budgetMin!=null?p.budgetMin:'',p.budgetMax!=null?'– '+p.budgetMax:''].filter(x=>x!=='').join(' ')
  const system=`${acquisitionConstitution}\n\n${acquisitionStrategy ? 'ESTRATEGIA ACTUAL DEL DIRECTOR DE ADQUISICIÓN:\n'+acquisitionStrategy+'\n\n' : ''}Eres Carolina, directora de desarrollo comercial de Catalina Jaramillo. Evalúas proyectos REALES de Freelancer.com para decidir si Catalina debe postularse.
Catalina diseña e implementa agentes de IA, automatizaciones, CRM, WhatsApp, Shopify/ecommerce, workflows, software personalizado y sistemas multiagente.
Solo fit=alto cuando el proyecto encaja claramente con esas capacidades, el comprador parece buscar implementación real y el alcance puede generar una relación comercial valiosa.
La propuesta debe ser MUY específica al texto del proyecto, profesional y comercial, 110-190 palabras. Debe:
1) abrir diciendo claramente que Catalina puede encargarse del proyecto;
2) demostrar en 1-2 frases que entendió la necesidad concreta;
3) proponer cómo lo implementaría;
4) nombrar 2-4 entregables iniciales concretos;
5) cerrar con UNA pregunta inteligente que facilite respuesta.
NO escribas «te sugiero buscar proveedores», «mi consejo es» ni un tutorial neutral. Catalina está postulándose para GANAR el proyecto.
No uses teléfono, WhatsApp, email, redes ni enlaces externos. No prometas resultados inventados. No digas que ya construiste algo que no existe.
Credibilidad permitida sin exagerar: Catalina es founder-operator de ecommerce y ha diseñado sistemas propios de IA y automatización para ventas, atención, ecommerce, seguimiento y operaciones. Puede mencionar LAURA, Carolina y automatización de pedidos/postventa solo cuando sean relevantes y sin atribuir resultados no demostrados a la IA. No inventes años de experiencia, clientes externos, herramientas dominadas ni resultados.
Para precio: respeta el presupuesto publicado. Si no hay datos suficientes o el presupuesto es incompatible, fit=bajo.
Devuelve SOLO JSON:
{"fit":"alto|medio|bajo","reason":"...","proposal":"...","amount":numero,"periodDays":numero}
amount debe estar dentro del presupuesto cuando exista; periodDays entre 2 y 30.`
  const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',
    headers:{authorization:'Bearer '+env.OPENROUTER_API_KEY,'content-type':'application/json','X-Title':'Carolina Marketplace'},
    body:JSON.stringify({model:env.OPENROUTER_MODEL||env.OPENROUTER_EXTRACT_MODEL,temperature:0.25,max_tokens:1000,response_format:{type:'json_object'},messages:[
      {role:'system',content:system},
      {role:'user',content:JSON.stringify({title:p.title,description:p.description,type:p.type,budget:budgetText,jobs:p.jobs})}
    ]}),
    signal:AbortSignal.timeout(30000)
  }).catch(()=>null)
  if(!res?.ok) return null
  const data=await res.json().catch(()=>({}))
  try{return JSON.parse(data.choices?.[0]?.message?.content||'{}')}catch{return null}
}

function validBid(p,j) {
  if(!j) return null
  const mediumBootstrap=j.fit==='medio' &&
    p.currency==='USD' &&
    p.budgetMax!=null && p.budgetMax>=Number(250) &&
    freelancerRelevance(p)>=4000
  if(j.fit!=='alto' && !mediumBootstrap) return null
  let amount=num(j.amount), period=Math.round(num(j.periodDays)||7)
  if(amount==null||amount<=0) return null
  if(p.budgetMin!=null) amount=Math.max(amount,p.budgetMin)
  if(p.budgetMax!=null) amount=Math.min(amount,p.budgetMax)
  period=Math.max(2,Math.min(30,period))
  const proposal=safe(j.proposal)
  if(proposal.length<120||proposal.length>1800) return null
  if(/\+?\d[\d\s().-]{7,}|wa\.me|@gmail|@outlook|linkedin\.com|instagram\.com|soycatalinajaramillo\.com/i.test(proposal)) return null
  return {amount,period,proposal}
}

async function placeFreelancerBid(env,p,bid,bidderId) {
  const body={
    project_id:Number(p.id),
    bidder_id:Number(bidderId),
    description:bid.proposal,
    amount:bid.amount,
    period:bid.period,
    milestone_percentage:100,
  }
  return fl('/api/projects/0.1/bids/',{method:'POST',body},env)
}

const bogotaDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)

const normalizePath=url=>{try{return new URL(url).pathname.replace(/\/+$/,'').toLowerCase()}catch{return ''}}
const words=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(x=>x.length>3)
function intentQuery(row){
  const path=normalizePath(row.url)
  const slug=decodeURIComponent(path.split('/').filter(Boolean).slice(-1)[0]||'').replace(/[-_]+/g,' ')
  const base=(slug+' '+safe(row.need)).trim()
  return words(base).slice(0,8).join(' ') || 'AI automation'
}
function intentMatchScore(row,p){
  const a=normalizePath(row.url), b=normalizePath(p.url)
  if(a && b && (a===b || a.endsWith(b) || b.endsWith(a))) return 1000
  const wanted=new Set(words((row.url||'')+' '+(row.need||'')))
  const got=new Set(words((p.title||'')+' '+(p.description||'')))
  let hits=0
  for(const w of wanted) if(got.has(w)) hits++
  return hits
}
async function prioritizedFreelancerIntent(env){
  const rows=await env.DB.prepare("SELECT url,need,fit,status,found_at FROM intent_leads WHERE lower(platform) LIKE '%freelancer%' AND fit='alto' AND status IN ('new','official_api_pending','application_ready') ORDER BY found_at DESC LIMIT 8").all().catch(()=>({results:[]}))
  const out=[]
  const used=new Set()
  for(const row of rows.results||[]){
    const q=intentQuery(row)
    let found=await searchFreelancer(env,q)
    if(!found.length && row.need) found=await searchFreelancer(env,words(row.need).slice(0,5).join(' '))
    found.sort((a,b)=>intentMatchScore(row,b)-intentMatchScore(row,a))
    const best=found[0]
    if(best && intentMatchScore(row,best)>=2 && !used.has(best.id)){
      used.add(best.id)
      out.push({...best,intentUrl:row.url})
      await env.DB.prepare("UPDATE intent_leads SET status='official_api_matched' WHERE url=?").bind(row.url).run().catch(()=>{})
    }
  }
  return out
}

export async function runMarketplaceAcquisition(env,now=Date.now()) {
  await ensureTable(env)
  const out={
    freelancer:{ready:freelancerReady(env),submitted:0,reviewed:0},
    upwork:{ready:upworkReady(env),submitted:0,reason:upworkReady(env)?'ready':'official_api_adapter_or_submit_permission_missing'},
    workana:{ready:false,submitted:0,reason:'no_official_submission_api; automated robots and off-platform contact are not used'},
  }
  if(!env.FREELANCER_OAUTH_TOKEN) { out.freelancer.reason='oauth_token_missing'; return out }
  if(env.FREELANCER_BID_SCOPE_VERIFIED!=='true') { out.freelancer.reason='bid_management_scope_not_verified'; return out }
  if(!freelancerReady(env)||!env.OPENROUTER_API_KEY) return out

  const firstSubmission=await env.DB.prepare("SELECT provider_id FROM marketplace_submissions WHERE platform='freelancer' AND status='submitted' AND provider_id IS NOT NULL AND provider_id<>'' LIMIT 1").first()
  const limit=freelancerBidAllowance(env,!!firstSubmission?.provider_id)
  if(!limit){out.freelancer.reason='first_bid_pending_verification';return out}
  const since=Date.parse(bogotaDay(now)+'T00:00:00-05:00')
  const count=await env.DB.prepare("SELECT COUNT(*) n FROM marketplace_submissions WHERE platform='freelancer' AND status='submitted' AND created_at>=?").bind(since).first()
  if((count?.n||0)>=limit){out.freelancer.reason='daily_cap';return out}

  const bidderId=await freelancerSelf(env)
  if(!bidderId){out.freelancer.reason='oauth_invalid_or_self_lookup_failed';return out}

  const rotation=Math.floor(now/(15*60*1000))%FL_QUERIES.length
  const queries=[0,2,4,6,8,10,12,14].map(offset=>FL_QUERIES[(rotation+offset)%FL_QUERIES.length])
  const seen=new Set()
  const intentCandidates=await prioritizedFreelancerIntent(env)
  const candidates=[]
  for(const p of intentCandidates) if(!seen.has(p.id)){seen.add(p.id);candidates.push(p)}
  for(const q of queries) for(const p of await searchFreelancer(env,q)) if(!seen.has(p.id)){seen.add(p.id);candidates.push(p)}
  candidates.sort((a,b)=>{
    const ai=a.intentUrl?1:0, bi=b.intentUrl?1:0
    if(ai!==bi) return bi-ai
    return freelancerRelevance(b)-freelancerRelevance(a)
  })

  for(const p of candidates.slice(0,20)) {
    if((count?.n||0)+out.freelancer.submitted>=limit) break
    const prior=await env.DB.prepare("SELECT status,error,updated_at FROM marketplace_submissions WHERE id=?").bind('freelancer:'+p.id).first()
    const floor=Number(env.MARKETPLACE_MIN_USD||750)
    const belowFloor=p.currency==='USD' && p.budgetMax!=null && p.budgetMax<floor
    if(prior){
      if(['submitted','submitting','blocked_account_requirement'].includes(prior.status)) continue
      if(prior.status==='skipped' && !(prior.error==='budget_below_floor' && !belowFloor)) continue
      if(prior.status==='failed' && Number(prior.updated_at||0)>now-6*60*60*1000) continue
      if(!['failed','skipped'].includes(prior.status)) continue
    }
    // Para USD, evita microproyectos incompatibles con una implementación profesional.
    if(belowFloor) {
      if(prior){
        await env.DB.prepare("UPDATE marketplace_submissions SET status='skipped',error='budget_below_floor',updated_at=? WHERE id=?")
          .bind(now,'freelancer:'+p.id).run()
      }else{
        await env.DB.prepare("INSERT OR IGNORE INTO marketplace_submissions(id,platform,external_id,url,title,status,error,created_at,updated_at) VALUES (?,?,?,?,?,'skipped','budget_below_floor',?,?)")
          .bind('freelancer:'+p.id,'freelancer',p.id,p.url,p.title,now,now).run()
      }
      if(p.intentUrl) await env.DB.prepare("UPDATE intent_leads SET status='skipped_budget' WHERE url=?").bind(p.intentUrl).run().catch(()=>{})
      continue
    }
    const j=await judgeFreelancer(env,p)
    out.freelancer.reviewed++
    if(!j){
      if(prior){
        await env.DB.prepare("UPDATE marketplace_submissions SET status='failed',error='judge_unavailable',updated_at=? WHERE id=?")
          .bind(now,'freelancer:'+p.id).run()
      }else{
        await env.DB.prepare("INSERT OR IGNORE INTO marketplace_submissions(id,platform,external_id,url,title,status,error,created_at,updated_at) VALUES (?,?,?,?,?,'failed','judge_unavailable',?,?)")
          .bind('freelancer:'+p.id,'freelancer',p.id,p.url,p.title,now,now).run()
      }
      continue
    }
    const bid=validBid(p,j)
    if(!bid){
      const reason=safe(j.reason||('fit_'+safe(j.fit||'unknown'))).slice(0,500)
      if(prior){
        await env.DB.prepare("UPDATE marketplace_submissions SET status='skipped',error=?,updated_at=? WHERE id=?")
          .bind(reason,now,'freelancer:'+p.id).run()
      }else{
        await env.DB.prepare("INSERT OR IGNORE INTO marketplace_submissions(id,platform,external_id,url,title,status,error,created_at,updated_at) VALUES (?,?,?,?,?,'skipped',?,?,?)")
          .bind('freelancer:'+p.id,'freelancer',p.id,p.url,p.title,reason,now,now).run()
      }
      if(p.intentUrl) await env.DB.prepare("UPDATE intent_leads SET status='skipped_after_review' WHERE url=?").bind(p.intentUrl).run().catch(()=>{})
      continue
    }

    // Claim antes de enviar para evitar doble bid en crons concurrentes.
    const claim=prior
      ? await env.DB.prepare("UPDATE marketplace_submissions SET amount=?,currency=?,proposal=?,status='submitting',error=NULL,updated_at=? WHERE id=? AND status IN ('failed','skipped')")
          .bind(bid.amount,p.currency,bid.proposal,now,'freelancer:'+p.id).run()
      : await env.DB.prepare("INSERT OR IGNORE INTO marketplace_submissions(id,platform,external_id,url,title,amount,currency,proposal,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?, 'submitting',?,?)")
          .bind('freelancer:'+p.id,'freelancer',p.id,p.url,p.title,bid.amount,p.currency,bid.proposal,now,now).run()
    if(!claim.meta.changes) continue

    const sent=await placeFreelancerBid(env,p,bid,bidderId)
    if(sent.ok && sent.data?.result?.id){
      await env.DB.prepare("UPDATE marketplace_submissions SET status='submitted',provider_id=?,updated_at=? WHERE id=?")
        .bind(String(sent.data.result.id),Date.now(),'freelancer:'+p.id).run()
      out.freelancer.submitted++
      if(p.intentUrl) await env.DB.prepare("UPDATE intent_leads SET status='submitted' WHERE url=?").bind(p.intentUrl).run().catch(()=>{})
      await notifyCatalina(env,`🎯 Carolina postuló en Freelancer · ${p.title}`,[
        'Carolina encontró el proyecto, lo evaluó y presentó el bid desde tu cuenta mediante la API oficial de Freelancer.',
        `Proyecto: ${p.url}`,
        `Oferta: ${p.currency||''} ${bid.amount} · ${bid.period} días`,
        '',
        'Propuesta enviada:',
        bid.proposal,
        '',
        'La conversación debe continuar dentro de Freelancer hasta que las reglas de la plataforma permitan otra cosa.'
      ].join('\n')).catch(()=>{})
    } else {
      const err=JSON.stringify(sent.data||{}).slice(0,700)
      const accountBlocked=/RESTRICTED_FROM_BIDDING_PREMIUM|BID_MINIMUM_REQUIREMENT_NOT_MET|PROFILE_INCOMPLETE|at least 5 reviews|Plus, Professional or Premier|Verified by Freelancer|complete the profile|account balance/i.test(err)
      const blockedStatus=accountBlocked?'blocked_account_requirement':'failed'
      await env.DB.prepare("UPDATE marketplace_submissions SET status=?,error=?,updated_at=? WHERE id=?")
        .bind(blockedStatus,err,Date.now(),'freelancer:'+p.id).run()
      if(p.intentUrl) await env.DB.prepare("UPDATE intent_leads SET status=? WHERE url=?")
        .bind(accountBlocked?'blocked_account_requirement':'submit_failed',p.intentUrl).run().catch(()=>{})
    }
  }
  return out
}

export async function marketplaceSnapshot(env) {
  await ensureTable(env)
  const rows=await env.DB.prepare("SELECT platform,status,COUNT(*) n FROM marketplace_submissions GROUP BY platform,status").all()
  return {
    freelancerReady:freelancerReady(env),
    freelancerBidScopeVerified:env.FREELANCER_BID_SCOPE_VERIFIED==='true',
    upworkReady:upworkReady(env),
    stats:rows.results||[]
  }
}
