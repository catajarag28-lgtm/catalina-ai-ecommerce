// Ejecuta postulaciones directas a oportunidades públicas con una vía explícita de aplicación.
// No sustituye APIs de marketplaces. Solo envía email cuando la publicación/empresa indica
// explícitamente que acepta aplicaciones por email y la dirección queda verificada.
import { notifyCatalina } from '../core/notify.js'
import { validPublicEmail } from '../core/integrations.js'
import { queueIntentForDirectOutbound } from './intent.js'

const SITE='https://soycatalinajaramillo.com'
const PORTFOLIO='https://portfolio-nine-lovat-18.vercel.app/'
const safe=v=>String(v??'').trim()
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))

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
  const profileEs=safe(env.PROFILE_ES_URL)
  const profileEn=safe(env.PROFILE_EN_URL)
  const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',
    headers:{authorization:'Bearer '+env.OPENROUTER_API_KEY,'content-type':'application/json','X-Title':'Carolina Application Writer'},
    body:JSON.stringify({
      model:env.OPENROUTER_MODEL||env.OPENROUTER_EXTRACT_MODEL,
      temperature:0.38,
      max_tokens:2200,
      response_format:{type:'json_object'},
      messages:[
        {role:'system',content:`Escribes candidaturas en nombre de Catalina Jaramillo para oportunidades REALES. Tu trabajo no es sonar impresionante: es hacer que el receptor piense "esta persona entiende mi problema, ya ha construido sistemas cercanos y quiero hablar con ella".

IDENTIDAD PROFESIONAL REAL:
Catalina es founder-operator, diseñadora de sistemas IA y automatización aplicada a negocio. Su ventaja es conectar estrategia comercial, customer experience, ecommerce y lógica técnica. No la presentes como senior software engineer, ML engineer ni especialista certificada en una herramienta.

PRUEBA DE OPERACIÓN REAL:
- Professional Glam / Piel y Glamour: ecommerce real operado por Catalina.
- 9.296 pedidos digitales documentados.
- COP 1.016B+ en ventas Shopify registradas.
- 3 sedes físicas operadas.
Estas métricas prueban experiencia operando negocio; NUNCA afirmes que fueron causadas por IA.

SISTEMAS Y AGENTES QUE PUEDE PRESENTAR COMO DISEÑADOS / DESARROLLADOS:
1. LAURA - comercio conversacional y CX: ventas por WhatsApp, soporte, seguimiento, continuidad de pedido, confirmación, postventa y handoff humano.
2. CAROLINA - desarrollo comercial: búsqueda pública de oportunidades, investigación de prospectos, fit scoring, propuestas personalizadas, tracking, follow-up y agenda.
3. Ecommerce Operations - Shopify + COD + logística/Dropi + confirmación + postventa + continuidad operativa.
4. Meta Growth Intelligence - análisis read-only de campañas, fatiga creativa, hooks/ángulos, testing, scaling intelligence y reporte ejecutivo.
5. Creative Intelligence - forense creativo, señales virales, hook intelligence, angle discovery y lectura estructurada de mercado/competencia.
6. Content Studio - hooks, guiones, conceptos UGC, captions y workflows de contenido preservando voz de marca.
7. Executive / CEO Orchestration - resúmenes cruzados, alertas, priorización, routing de casos y soporte estructurado a decisiones.
8. Finance & Performance Ops - tracking de ventas por canal, lógica de reportes financieros/margen y métricas operativas.
9. Monitoring & Diagnostics - monitoreo, lógica de incidentes, diagnóstico y salvaguardas para sistemas operativos.
No digas que estos fueron para clientes externos si no está demostrado. Puedes decir "he diseñado/desarrollado" o "entre los sistemas que he construido/diseñado".

CAPACIDADES VERIFICADAS:
- Ecommerce, Shopify, WhatsApp, atención, seguimiento, customer journey y postventa.
- APIs, webhooks, workflows e integraciones.
- n8n: nivel de trabajo / working proficiency. No "experta avanzada".
- Product ownership, arquitectura funcional, pruebas, QA e iteración con herramientas técnicas.
- Español nativo.
- Inglés funcional para lectura, escritura preparada y trabajo asincrónico apoyado en herramientas.
- Portfolio: ${PORTFOLIO}
- Web: ${SITE}
- Perfil visual ES (si existe): ${profileEs||'no configurado'}
- Visual profile EN (if available): ${profileEn||'not configured'}

NO PUEDES INVENTAR:
Azure/Microsoft Graph, Airtable, PostgreSQL, GoHighLevel, HubSpot, Retell, Vapi, Dify, LangFlow, Make, Zapier, TimelinesAI, Zoho, certificaciones, años concretos, clientes externos, resultados de clientes o herramientas no verificadas.
Si una de esas herramientas aparece en la vacante, habla de cómo abordarías la integración y de capacidades transferibles, no de experiencia previa ficticia.

FILTRO DE FIT:
Antes de escribir, decide si Catalina tiene una posibilidad razonable de competir.
- Si el requisito central es experiencia profunda demostrable en una tecnología no verificada y no es transferible, send=false.
- Si falta un dato obligatorio imposible de responder honestamente (salario exacto, disponibilidad obligatoria, permiso legal, etc.), send=false y explica missingRequired.
- Si el requisito puede aprenderse/implementarse desde APIs, workflows o arquitectura y NO exige experiencia previa demostrable, sí puede competir con transparencia.

MARCO FIJO DE CONVERSIÓN - PERSONALIZA SIEMPRE:
A. Apertura de relevancia (1-2 frases): nombra SU problema, no digas "vi tu publicación y puedo encargarme".
B. Prueba selectiva (2 sistemas máximo): elige los 1-2 sistemas de Catalina más parecidos. Explica qué parte es transferible a SU necesidad.
C. Plan concreto (2-4 frases): cómo empezaría, qué protegería y cuál sería el primer resultado verificable. Sin regalar una consultoría completa.
D. Razón para confiar (1 frase): founder-operator + negocio real + piensa en adopción/operación, no solo en conectar herramientas. Usa métricas solo si ayudan.
E. CTA humano (1 pregunta): conversación de 15-20 min, revisión del workflow o paid test/piloto acotado.

VOZ:
- Debe sonar como Catalina: directa, cálida, comercial, práctica, cero humo.
- Natural, no perfecta ni grandilocuente.
- Evita lenguaje típico de IA: "he revisado los requerimientos", "mi enfoque se centra", "mis entregables iniciales serían", "llevarlo al siguiente nivel", "solución robusta y escalable", "puedo encargarme de esto" repetido.
- No listes 8 capacidades. Selecciona.
- Nada de párrafos gigantes ni manifiestos.
- No abuses de bullets. Máximo 3 si realmente ayudan.
- No uses emojis salvo que la publicación sea claramente informal.
- No escribas como agencia si la contratación es individual. Habla en primera persona.
- No afirmes un dominio técnico que no existe.
- Mantén una pequeña variación de ritmo para que las propuestas no parezcan generadas por plantilla.
- Español natural si la publicación está en español. Inglés profesional pero simple y claro si está en inglés.

ASUNTO:
Específico al problema/proyecto, no genérico "Application". Si la publicación obliga un subject, respétalo exactamente.

LONGITUD:
- Email directo: 150-260 palabras.
- Si la oportunidad pide CV/portfolio, menciona portfolio y perfil visual si la URL está configurada; nunca digas "adjunto" si no hay archivo realmente adjunto.
- Si pide rate y no existe rate obligatorio definido, di que prefieres cotizar por alcance tras ver el workflow o paid test; no inventes una tarifa.
- WhatsApp solo si la publicación lo pide explícitamente; no conviertas el email en un mensaje de WhatsApp.

Devuelve SOLO JSON:
{"send":true|false,"reason":"...","missingRequired":["..."],"language":"es|en","selectedSystems":["..."],"subject":"...","body":"..."}`},
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
  const profileUrl=draft.language==='en'?safe(env.PROFILE_EN_URL):safe(env.PROFILE_ES_URL)
  const links=[
    'Portfolio: '+PORTFOLIO,
    'Website: '+SITE,
    profileUrl?((draft.language==='en'?'Profile: ':'Perfil: ')+profileUrl):null
  ].filter(Boolean).join('\n')
  const fullText=safe(draft.body)+'\n\n'+links
  const htmlBody='<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:auto;color:#201a17;line-height:1.58">'
    +'<div style="border-left:4px solid #b89a67;padding-left:16px;margin-bottom:22px"><div style="font-size:18px;font-weight:700">Catalina Jaramillo</div><div style="font-size:13px;color:#6b625d">AI Systems & Automation · Founder-Operator</div></div>'
    +'<div style="font-size:15px;white-space:pre-line">'+escapeHtml(safe(draft.body))+'</div>'
    +'<div style="margin-top:24px;padding-top:16px;border-top:1px solid #ded3ca;font-size:13px;color:#6b625d">'
    +'<a href="'+PORTFOLIO+'" style="color:#6d553f">Portfolio</a> &nbsp;·&nbsp; <a href="'+SITE+'" style="color:#6d553f">Website</a>'
    +(profileUrl?' &nbsp;·&nbsp; <a href="'+profileUrl+'" style="color:#6d553f">'+(draft.language==='en'?'Visual profile':'Perfil visual')+'</a>':'')
    +'</div></div>'
  const payload={
    from,
    to:[route.email],
    reply_to:replyTo,
    subject:safe(draft.subject).replace(/[\r\n]/g,' ').slice(0,180),
    text:fullText,
    html:htmlBody,
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
