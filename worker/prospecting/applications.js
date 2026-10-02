// Ejecuta postulaciones directas a oportunidades públicas con una vía explícita de aplicación.
// No sustituye APIs de marketplaces. Solo envía email cuando la publicación/empresa indica
// explícitamente que acepta aplicaciones por email y la dirección queda verificada.
import { notifyCatalina } from '../core/notify.js'
import { validPublicEmail } from '../core/integrations.js'
import { queueIntentForDirectOutbound } from './intent.js'

const SITE='https://soycatalinajaramillo.com'
const PORTFOLIO='https://portfolio-nine-lovat-18.vercel.app/'
const safe=v=>String(v??'').trim()

async function ensureTable(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS direct_applications (
    source_url TEXT PRIMARY KEY,
    platform TEXT,
    recipient TEXT,
    subject TEXT,
    body TEXT,
    route TEXT,
    status TEXT NOT NULL,
    provider_id TEXT,
    error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    sent_at INTEGER
  )`).run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_direct_applications_status ON direct_applications(status,updated_at)').run().catch(()=>{})
}

const hostOf=url=>{try{return new URL(url).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}}
const sameHost=(a,b)=>{const x=hostOf(a),y=hostOf(b);return !!x&&!!y&&(x===y||x.endsWith('.'+y)||y.endsWith('.'+x))}
const allowedPlatform=p=>!/freelancer|upwork|workana|contra|peopleperhour|people per hour|guru|malt|twine|wellfound/i.test(safe(p))

async function sourceContainsEmail(url,email){
  try{
    const res=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; CarolinaApplications/1.0; +https://soycatalinajaramillo.com)','accept-language':'en,es;q=0.9'},redirect:'follow',signal:AbortSignal.timeout(10000)})
    if(!res.ok) return false
    const ct=res.headers.get('content-type')||''
    if(!ct.includes('text/html')) return false
    const html=(await res.text()).slice(0,500000).toLowerCase()
    return html.includes(email.toLowerCase())
  }catch{return false}
}

async function resolveApplicationRoute(env,row){
  const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',
    headers:{authorization:'Bearer '+env.OPENROUTER_API_KEY,'content-type':'application/json','X-Title':'Carolina Direct Applications'},
    body:JSON.stringify({
      model:env.OPENROUTER_EXTRACT_MODEL,
      temperature:0,
      max_tokens:1200,
      response_format:{type:'json_object'},
      plugins:[{id:'web',engine:'exa',max_results:6,search_prompt:'Abre la publicación exacta y, si hace falta, el sitio oficial de la empresa para verificar cómo aplicar.'}],
      messages:[
        {role:'system',content:`Eres un verificador de rutas de aplicación laboral/freelance. Debes decidir si una publicación pública es una solicitud REAL de contratación o proyecto y cómo pide recibir candidaturas.

Devuelve SOLO JSON:
{"realOpportunity":true|false,"activeNow":true|false,"publishedDate":"YYYY-MM-DD|","route":"email|official_form|community|none","email":"","contactUrl":"","evidence":"","company":"","opportunityType":"freelance_project|contract|job|community_request|content","asksCv":true|false,"asksRate":true|false,"asksAvailability":true|false,"hardRequirements":["..."],"confidence":"alta|media|baja","reason":"..."}

REGLAS:
- route=email SOLO si la publicación o una página oficial vinculada dice explícitamente que se puede aplicar/escribir por email.
- Copia el email literalmente; no lo infieras por patrón.
- evidence debe ser una cita breve que contenga la instrucción de aplicar/contactar y, para route=email, el email literal.
- route=official_form si existe formulario oficial de aplicación.
- route=community si pide DM, comentario o respuesta dentro de la comunidad/red.
- realOpportunity=false para tutoriales, discusiones, proveedores promocionándose, feedback de producto, artículos o gente que NO está contratando.
- activeNow=false si la oportunidad está cerrada/cancelada o es antigua (más de ~180 días) sin una señal reciente de que siga aceptando candidaturas. No revivas ofertas viejas solo porque la página siga indexada.
- No conviertas un correo genérico encontrado al azar en "application email".
- No inventes requisitos, contactos ni empresas.`},
        {role:'user',content:JSON.stringify({sourceUrl:row.url,platform:row.platform,who:row.who,need:row.need})}
      ]
    }),
    signal:AbortSignal.timeout(45000)
  }).catch(()=>null)
  if(!res?.ok) return null
  const data=await res.json().catch(()=>({}))
  const msg=data.choices?.[0]?.message||{}
  let out={};try{out=JSON.parse(msg.content||'{}')}catch{return null}
  const cited=(msg.annotations||[]).filter(a=>a.type==='url_citation').map(a=>a.url_citation?.url).filter(Boolean)
  if(out.confidence!=='alta' || out.activeNow===false) return {...out,verified:false}
  if(out.route==='email'){
    const email=safe(out.email).toLowerCase()
    if(!validPublicEmail(email) || !safe(out.evidence).toLowerCase().includes(email)) return {...out,verified:false}
    const sourceSeen=await sourceContainsEmail(row.url,email)
    const citationSeen=cited.some(u=>sameHost(u,row.url) || (out.contactUrl&&sameHost(u,out.contactUrl)))
    if(!sourceSeen && !citationSeen) return {...out,verified:false}
    out.email=email
  }
  return {...out,verified:true}
}

async function writeApplication(env,row,route){
  const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',
    headers:{authorization:'Bearer '+env.OPENROUTER_API_KEY,'content-type':'application/json','X-Title':'Carolina Application Writer'},
    body:JSON.stringify({
      model:env.OPENROUTER_MODEL||env.OPENROUTER_EXTRACT_MODEL,
      temperature:0.25,
      max_tokens:1800,
      response_format:{type:'json_object'},
      messages:[
        {role:'system',content:`Escribes una candidatura directa en nombre de Catalina Jaramillo para una oportunidad REAL.

HECHOS QUE SÍ PUEDES USAR:
- Catalina es founder-operator de ecommerce y Creative Strategist DTC.
- Diseña sistemas de IA y automatización para ventas, atención, seguimiento, ecommerce y operaciones.
- LAURA: sistema propio para ventas/atención/seguimiento y handoff humano en WhatsApp.
- Ha trabajado en automatización operativa ecommerce conectando Shopify, pedidos COD, logística y postventa.
- CAROLINA: agente propio de desarrollo comercial que investiga oportunidades, prepara propuestas, hace seguimiento y gestiona pipeline/agenda.
- Tiene experiencia trabajando con APIs, webhooks y workflows. Puede trabajar con n8n, pero NO la describas como experta avanzada ni inventes años/proyectos específicos.
- Español nativo. Inglés funcional para lectura, escritura preparada y trabajo asincrónico con apoyo de herramientas.
- Web: ${SITE}
- Portfolio: ${PORTFOLIO}

PROHIBIDO:
- Inventar experiencia con Azure/Microsoft Graph, Airtable, PostgreSQL, GoHighLevel, HubSpot, Retell, Vapi, Dify, LangFlow, Make, Zapier, TimelinesAI, Zoho u otra herramienta si no está en los hechos.
- Inventar clientes externos, resultados, años de experiencia, certificaciones, ratings o proyectos.
- Afirmar que ya se hizo exactamente el sistema pedido si no está en los hechos.
- Sonar como un bot. Debe leerse como un email breve escrito por Catalina.

Evalúa primero si los requisitos obligatorios son compatibles. Si la oportunidad exige como requisito central experiencia profunda demostrable en una tecnología no verificada, devuelve send=false.
Si faltan datos obligatorios que la publicación exige (por ejemplo salario actual/esperado o disponibilidad exacta) y no se pueden responder honestamente, devuelve send=false y missingRequired con esos datos.

Devuelve SOLO JSON:
{"send":true|false,"reason":"...","missingRequired":["..."],"subject":"...","body":"..."}

Si send=true:
- idioma de la publicación;
- 160-320 palabras;
- mencionar 2-3 sistemas/casos reales relevantes, no una lista genérica;
- responder al problema específico;
- incluir ${PORTFOLIO} y ${SITE};
- cerrar con una pregunta o disponibilidad para un paid test/scoped first project;
- si pide rate pero no da formato obligatorio, di que prefieres cotizar por alcance tras revisar el workflow, sin inventar tarifa;
- si pide CV y no hay URL de CV configurada, el cuerpo puede funcionar como candidatura resumida y enlazar portfolio, pero NO digas "adjunto CV".`},
        {role:'user',content:JSON.stringify({sourceUrl:row.url,platform:row.platform,who:row.who,need:row.need,route,priorDraft:row.reply})}
      ]
    }),
    signal:AbortSignal.timeout(40000)
  }).catch(()=>null)
  if(!res?.ok) return null
  const data=await res.json().catch(()=>({}))
  try{return JSON.parse(data.choices?.[0]?.message?.content||'{}')}catch{return null}
}

async function sendApplication(env,row,route,draft,now){
  const from=env.APPLICATION_EMAIL_FROM||env.EMAIL_FROM
  const replyTo=env.CATALINA_EMAIL||'catalinajaramillogirldo28@gmail.com'
  const payload={
    from,
    to:[route.email],
    reply_to:replyTo,
    subject:safe(draft.subject).replace(/[\r\n]/g,' ').slice(0,180),
    text:safe(draft.body),
    headers:{'X-Carolina-Source':row.url.slice(0,900)},
    tags:[{name:'type',value:'direct_application'}]
  }
  const res=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json','Idempotency-Key':'direct-application-'+await digest(row.url)},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(12000)
  }).catch(()=>null)
  const data=await res?.json().catch(()=>({}))
  if(!res?.ok||!data?.id) return {ok:false,error:JSON.stringify(data||{}).slice(0,700)}
  await env.DB.prepare("UPDATE direct_applications SET status='sent',provider_id=?,sent_at=?,updated_at=? WHERE source_url=?").bind(String(data.id),now,now,row.url).run()
  await env.DB.prepare("UPDATE intent_leads SET status='direct_email_sent' WHERE url=?").bind(row.url).run().catch(()=>{})
  await env.DB.prepare('INSERT INTO emails(thread_key,direction,from_addr,to_addr,subject,body,message_id,category,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(route.email,'out',from,route.email,payload.subject,payload.text,String(data.id),'direct_application',now).run().catch(()=>{})
  await notifyCatalina(env,`🎯 POSTULACIÓN REAL ENVIADA · ${route.company||row.who||row.platform}`,[
    'Carolina encontró la oportunidad, verificó una vía explícita de aplicación por email y envió la candidatura.',
    `Fuente: ${row.url}`,
    `Destino: ${route.email}`,
    `Asunto: ${payload.subject}`,
    `Provider ID: ${data.id}`,
    '',
    'Texto enviado:',
    payload.text
  ].join('\n')).catch(()=>{})
  return {ok:true,providerId:String(data.id)}
}

async function digest(value){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,32)
}

const bogotaStart=now=>{
  const d=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
  return Date.parse(d+'T00:00:00-05:00')
}

export async function runDirectApplications(env,now=Date.now()){
  await ensureTable(env)
  const enabled=env.DIRECT_APPLICATIONS_ENABLED==='true'
  const out={enabled,reviewed:0,sent:0,waitingHuman:0,skipped:0}
  if(!enabled) return out
  if(!env.OPENROUTER_API_KEY||!env.RESEND_API_KEY) return {...out,reason:'connections_missing'}
  const limit=Math.max(1,Math.min(30,Number(env.DIRECT_APPLICATION_DAILY_LIMIT||20)))
  const count=await env.DB.prepare("SELECT COUNT(*) n FROM direct_applications WHERE status='sent' AND sent_at>=?").bind(bogotaStart(now)).first()
  if((count?.n||0)>=limit) return {...out,reason:'daily_cap',limit}

  const rows=(await env.DB.prepare(`SELECT * FROM intent_leads
    WHERE fit='alto'
      AND status IN ('new','needs_verified_identity','direct_application_pending','application_ready','queued_outbound')
    ORDER BY found_at DESC LIMIT 40`).all()).results||[]

  for(const row of rows){
    if((count?.n||0)+out.sent>=limit) break
    const platform=safe(row.platform)
    if(!allowedPlatform(platform)){
      // Freelancer/Upwork/Workana/etc. se resuelven por sus propios ejecutores/autorizaciones.
      continue
    }
    const prior=await env.DB.prepare('SELECT status FROM direct_applications WHERE source_url=?').bind(row.url).first()
    if(prior?.status==='sent') continue

    out.reviewed++
    const route=await resolveApplicationRoute(env,row)
    if(!route?.verified || !route.realOpportunity){
      const status=route?.realOpportunity===false?'not_hiring':'route_unverified'
      await env.DB.prepare("INSERT INTO direct_applications(source_url,platform,route,status,error,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(source_url) DO UPDATE SET route=excluded.route,status=excluded.status,error=excluded.error,updated_at=excluded.updated_at")
        .bind(row.url,platform,safe(route?.route||'none'),status,safe(route?.reason||'application route not verified').slice(0,600),now,now).run()
      if(route?.realOpportunity===false){
        await env.DB.prepare("UPDATE intent_leads SET status='not_hiring' WHERE url=?").bind(row.url).run().catch(()=>{})
        out.skipped++
      }else{
        const fallback=await queueIntentForDirectOutbound(env,row,now).catch(()=>({queued:false}))
        await env.DB.prepare("UPDATE intent_leads SET status=? WHERE url=?").bind(fallback.queued?'queued_outbound':'waiting_human_submit',row.url).run().catch(()=>{})
        out.waitingHuman++
      }
      continue
    }

    if(route.route!=='email'){
      // Si la publicación solo permite DM/comentario, Carolina intenta primero identificar
      // de forma independiente la empresa y un correo empresarial público mediante el
      // pipeline normal. No usa ni deriva datos privados de la comunidad.
      let fallback={queued:false}
      if(route.route==='community' && route.company){
        fallback=await queueIntentForDirectOutbound(env,{...row,company:route.company},now).catch(()=>({queued:false}))
      }
      const status=fallback.queued?'queued_outbound':'waiting_human_submit'
      await env.DB.prepare("INSERT INTO direct_applications(source_url,platform,route,status,error,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(source_url) DO UPDATE SET route=excluded.route,status=excluded.status,error=excluded.error,updated_at=excluded.updated_at")
        .bind(row.url,platform,safe(route.route),status,safe(route.contactUrl||route.reason||'No authorized email route').slice(0,600),now,now).run()
      await env.DB.prepare("UPDATE intent_leads SET status=? WHERE url=?").bind(status,row.url).run().catch(()=>{})
      out.waitingHuman+=fallback.queued?0:1
      continue
    }

    const draft=await writeApplication(env,row,route)
    if(!draft?.send || !safe(draft.subject) || safe(draft.body).length<200){
      const missing=Array.isArray(draft?.missingRequired)?draft.missingRequired.join(', '):''
      const reason=safe(draft?.reason||missing||'application_not_safe_to_send').slice(0,700)
      await env.DB.prepare("INSERT INTO direct_applications(source_url,platform,recipient,route,status,error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(source_url) DO UPDATE SET recipient=excluded.recipient,route=excluded.route,status=excluded.status,error=excluded.error,updated_at=excluded.updated_at")
        .bind(row.url,platform,route.email,'email','needs_review',reason,now,now).run()
      await env.DB.prepare("UPDATE intent_leads SET status='needs_application_review' WHERE url=?").bind(row.url).run().catch(()=>{})
      out.waitingHuman++
      continue
    }

    await env.DB.prepare("INSERT INTO direct_applications(source_url,platform,recipient,subject,body,route,status,created_at,updated_at) VALUES (?,?,?,?,?,'email','sending',?,?) ON CONFLICT(source_url) DO UPDATE SET recipient=excluded.recipient,subject=excluded.subject,body=excluded.body,route='email',status='sending',error=NULL,updated_at=excluded.updated_at")
      .bind(row.url,platform,route.email,safe(draft.subject).slice(0,180),safe(draft.body),now,now).run()
    const sent=await sendApplication(env,row,route,draft,now)
    if(sent.ok){
      out.sent++
    }else{
      await env.DB.prepare("UPDATE direct_applications SET status='failed',error=?,updated_at=? WHERE source_url=?").bind(safe(sent.error).slice(0,700),now,row.url).run()
      await env.DB.prepare("UPDATE intent_leads SET status='direct_email_failed' WHERE url=?").bind(row.url).run().catch(()=>{})
    }
  }
  return out
}

export async function directApplicationSnapshot(env){
  await ensureTable(env)
  const rows=await env.DB.prepare('SELECT status,COUNT(*) n FROM direct_applications GROUP BY status').all()
  return {enabled:env.DIRECT_APPLICATIONS_ENABLED==='true',stats:rows.results||[]}
}
