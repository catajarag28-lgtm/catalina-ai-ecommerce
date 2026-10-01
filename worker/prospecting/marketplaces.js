import { notifyCatalina } from '../core/notify.js'

const FL_BASE='https://www.freelancer.com'
const FL_QUERIES=[
  'AI automation',
  'AI agent',
  'WhatsApp automation',
  'CRM automation',
  'Shopify automation',
  'n8n automation',
  'Make.com automation',
  'OpenAI integration',
  'sales automation',
  'customer service AI',
]

const safe=v=>String(v??'').trim()
const num=v=>Number.isFinite(Number(v))?Number(v):null

export function freelancerReady(env={}) {
  return env.MARKETPLACE_AUTOSUBMIT_ENABLED==='true' && !!env.FREELANCER_OAUTH_TOKEN
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

async function judgeFreelancer(env,p) {
  const budgetText=[p.currency,p.budgetMin!=null?p.budgetMin:'',p.budgetMax!=null?'– '+p.budgetMax:''].filter(x=>x!=='').join(' ')
  const system=`Eres Carolina, directora de desarrollo comercial de Catalina Jaramillo. Evalúas proyectos REALES de Freelancer.com para decidir si Catalina debe postularse.
Catalina diseña e implementa agentes de IA, automatizaciones, CRM, WhatsApp, Shopify/ecommerce, workflows, software personalizado y sistemas multiagente.
Solo fit=alto cuando el proyecto encaja claramente con esas capacidades, el comprador parece buscar implementación real y el alcance puede generar una relación comercial valiosa.
La propuesta debe ser MUY específica al texto del proyecto, profesional, 100-180 palabras, explicar comprensión, enfoque, entregables iniciales y una pregunta inteligente. No uses teléfono, WhatsApp, email, redes ni enlaces externos. No prometas resultados inventados. No digas que ya construiste algo que no existe.
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
  if(!j||j.fit!=='alto') return null
  let amount=num(j.amount), period=Math.round(num(j.periodDays)||7)
  if(amount==null||amount<=0) return null
  if(p.budgetMin!=null) amount=Math.max(amount,p.budgetMin)
  if(p.budgetMax!=null) amount=Math.min(amount,p.budgetMax)
  period=Math.max(2,Math.min(30,period))
  const proposal=safe(j.proposal)
  if(proposal.length<120||proposal.length>1800) return null
  if(/\+?\d[\d\s().-]{7,}|wa\.me|whatsapp|@gmail|@outlook|linkedin\.com|instagram\.com|soycatalinajaramillo\.com/i.test(proposal)) return null
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

export async function runMarketplaceAcquisition(env,now=Date.now()) {
  await ensureTable(env)
  const out={
    freelancer:{ready:freelancerReady(env),submitted:0,reviewed:0},
    upwork:{ready:upworkReady(env),submitted:0,reason:upworkReady(env)?'ready':'official_api_adapter_or_submit_permission_missing'},
    workana:{ready:false,submitted:0,reason:'no_official_submission_api; automated robots and off-platform contact are not used'},
  }
  if(!freelancerReady(env)||!env.OPENROUTER_API_KEY) return out

  const limit=Math.max(1,Math.min(15,Number(env.FREELANCER_DAILY_BID_LIMIT||8)))
  const since=Date.parse(bogotaDay(now)+'T00:00:00-05:00')
  const count=await env.DB.prepare("SELECT COUNT(*) n FROM marketplace_submissions WHERE platform='freelancer' AND status='submitted' AND created_at>=?").bind(since).first()
  if((count?.n||0)>=limit){out.freelancer.reason='daily_cap';return out}

  const bidderId=await freelancerSelf(env)
  if(!bidderId){out.freelancer.reason='oauth_invalid_or_self_lookup_failed';return out}

  const rotation=Math.floor(now/(15*60*1000))%FL_QUERIES.length
  const queries=[FL_QUERIES[rotation],FL_QUERIES[(rotation+3)%FL_QUERIES.length]]
  const seen=new Set()
  const candidates=[]
  for(const q of queries) for(const p of await searchFreelancer(env,q)) if(!seen.has(p.id)){seen.add(p.id);candidates.push(p)}
  candidates.sort((a,b)=>(b.budgetMax||0)-(a.budgetMax||0))

  for(const p of candidates.slice(0,12)) {
    if((count?.n||0)+out.freelancer.submitted>=limit) break
    const prior=await env.DB.prepare("SELECT status FROM marketplace_submissions WHERE id=?").bind('freelancer:'+p.id).first()
    if(prior) continue
    // Para USD, evita microproyectos incompatibles con una implementación profesional.
    if(p.currency==='USD' && p.budgetMax!=null && p.budgetMax<Number(env.MARKETPLACE_MIN_USD||750)) {
      await env.DB.prepare("INSERT OR IGNORE INTO marketplace_submissions(id,platform,external_id,url,title,status,error,created_at,updated_at) VALUES (?,?,?,?,?,'skipped','budget_below_floor',?,?)")
        .bind('freelancer:'+p.id,'freelancer',p.id,p.url,p.title,now,now).run()
      continue
    }
    const j=await judgeFreelancer(env,p)
    out.freelancer.reviewed++
    const bid=validBid(p,j)
    if(!bid){
      await env.DB.prepare("INSERT OR IGNORE INTO marketplace_submissions(id,platform,external_id,url,title,status,error,created_at,updated_at) VALUES (?,?,?,?,?,'skipped',?,?,?)")
        .bind('freelancer:'+p.id,'freelancer',p.id,p.url,p.title,safe(j?.reason||'low_fit').slice(0,500),now,now).run()
      continue
    }

    // Claim antes de enviar para evitar doble bid en crons concurrentes.
    const claim=await env.DB.prepare("INSERT OR IGNORE INTO marketplace_submissions(id,platform,external_id,url,title,amount,currency,proposal,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?, 'submitting',?,?)")
      .bind('freelancer:'+p.id,'freelancer',p.id,p.url,p.title,bid.amount,p.currency,bid.proposal,now,now).run()
    if(!claim.meta.changes) continue

    const sent=await placeFreelancerBid(env,p,bid,bidderId)
    if(sent.ok && sent.data?.result?.id){
      await env.DB.prepare("UPDATE marketplace_submissions SET status='submitted',provider_id=?,updated_at=? WHERE id=?")
        .bind(String(sent.data.result.id),Date.now(),'freelancer:'+p.id).run()
      out.freelancer.submitted++
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
      await env.DB.prepare("UPDATE marketplace_submissions SET status='failed',error=?,updated_at=? WHERE id=?")
        .bind(err,Date.now(),'freelancer:'+p.id).run()
    }
  }
  return out
}

export async function marketplaceSnapshot(env) {
  await ensureTable(env)
  const rows=await env.DB.prepare("SELECT platform,status,COUNT(*) n FROM marketplace_submissions GROUP BY platform,status").all()
  return {freelancerReady:freelancerReady(env),upworkReady:upworkReady(env),stats:rows.results||[]}
}
