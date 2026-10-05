// Ejecuta postulaciones directas a oportunidades públicas con una vía explícita de aplicación.
// No sustituye APIs de marketplaces. Solo envía email cuando la publicación/empresa indica
// explícitamente que acepta aplicaciones por email y la dirección queda verificada.
import { notifyCatalina } from '../core/notify.js'
import { validPublicEmail, emailDomainReachable } from '../core/integrations.js'
import { callModel } from '../core/modelRouter.js'
import { queueIntentForDirectOutbound } from './intent.js'
import { acquisitionConstitution, acquisitionStrategyContext } from '../core/acquisitionStrategy.js'

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
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER,
    next_attempt_at INTEGER,
    blocker TEXT,
    terminal INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    sent_at INTEGER
  )`).run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_direct_applications_status ON direct_applications(status,updated_at)').run().catch(()=>{})
}

const hostOf=url=>{try{return new URL(url).hostname.replace(/^www\./,'').toLowerCase()}catch{return ''}}
const sameHost=(a,b)=>{const x=hostOf(a),y=hostOf(b);return !!x&&!!y&&(x===y||x.endsWith('.'+y)||y.endsWith('.'+x))}
const allowedPlatform=p=>!/freelancer|upwork|workana|contra|peopleperhour|people per hour|guru|malt|twine|wellfound/i.test(safe(p))

// Aplicaciones enviadas manualmente desde Gmail el 2026-10-02 mientras Codex/Cloudflare estaba bloqueado.
// Se registran aquí para que Carolina no duplique candidaturas cuando vuelva a procesar el backfill.
const MANUAL_APPLICATIONS_SENT=new Set([
  'https://www.linkedin.com/posts/martin-xavier-udoh-930a52191_hiring-n8n-automation-activity-7505025442404487168-q03w',
  'https://www.linkedin.com/posts/robert-thomas-18661b218_seeking-ai-automation-crm-integration-activity-7469162704017170432-auO1',
  'https://www.linkedin.com/posts/rashibali873_n8n-automation-freelance-activity-7475879601269825537-Y4ez',
  'https://www.linkedin.com/posts/samiya-islam-0a61a02ba_hiring-automationengineer-n8n-activity-7490638742702137344-m8Cq',
  'https://www.linkedin.com/posts/josephmagdy_hiring-ai-n8n-activity-7493402270659809280-XgGf',
  'https://community.make.com/t/looking-for-a-freelancer-whatsapp-api-ai-automation-expert/109983',
  'https://community.make.com/t/were-hiring-make-com-expert-for-full-funnel-automation-zoho-one-integration-agentic-ai/87945',
  'https://community.openai.com/t/looking-for-a-developer-who-can-integrate-with-gohighlevel/215650'
])

const MANUAL_APPLICATION_RECIPIENTS_SENT=new Set([
  'automationai068@gmail.com',
  'josephmagdy.work@gmail.com',
  'samiya.islam@vservit.com',
  'abhinav@fastenerworldindia.com',
  'ceo@religiate.com',
  'employment@iconichomesolutions.com',
  'info@avenuebillingservices.com',
  'rthomas6@farmersagent.com',
  'martoudoh1@gmail.com'
])
const MANUAL_APPLICATION_RECIPIENTS_BOUNCED=new Set([
  'sales@infiwebinfotech.com'
])

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
  const r=await callModel(env,{task:'application.route',json:true,temperature:0,maxTokens:1200,timeoutMs:45000,
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
      ]})
  if(!r.ok) return null
  const msg=r.message||{}
  let out=r.data||{}
  const cited=(msg.annotations||[]).filter(a=>a.type==='url_citation').map(a=>a.url_citation?.url).filter(Boolean)
  if(out.confidence!=='alta' || out.activeNow===false) return {...out,verified:false}
  if(out.route==='email'){
    const email=safe(out.email).toLowerCase()
    if(!validPublicEmail(email) || !safe(out.evidence).toLowerCase().includes(email)) return {...out,verified:false}
    if(!(await emailDomainReachable(email))) return {...out,verified:false,reason:'application_email_domain_unreachable'}
    const sourceSeen=await sourceContainsEmail(row.url,email)
    const citationSeen=cited.some(u=>sameHost(u,row.url) || (out.contactUrl&&sameHost(u,out.contactUrl)))
    if(!sourceSeen && !citationSeen) return {...out,verified:false}
    out.email=email
  }
  return {...out,verified:true}
}

async function applicationLearning(env){
  const sent=await env.DB.prepare("SELECT COUNT(*) n FROM direct_applications WHERE status IN ('sent','replied')").first().catch(()=>({n:0}))
  const replied=await env.DB.prepare(`SELECT COUNT(DISTINCT d.source_url) n
    FROM direct_applications d
    JOIN emails m ON lower(m.thread_key)=lower(d.recipient)
    WHERE d.status IN ('sent','replied') AND m.direction='in'`).first().catch(()=>({n:0}))
  const recent=(await env.DB.prepare("SELECT subject FROM direct_applications WHERE status IN ('sent','replied') AND subject<>'' ORDER BY sent_at DESC LIMIT 8").all().catch(()=>({results:[]}))).results||[]
  const replyExamples=(await env.DB.prepare(`SELECT substr(m.body,1,360) body
    FROM direct_applications d JOIN emails m ON lower(m.thread_key)=lower(d.recipient)
    WHERE d.status='sent' AND m.direction='in'
    ORDER BY m.id DESC LIMIT 5`).all().catch(()=>({results:[]}))).results||[]
  const n=Number(sent?.n||0), r=Number(replied?.n||0)
  const variant=['proof-first','problem-first','paid-pilot-first'][n%3]
  return {sent:n,replied:r,replyRate:r/Math.max(1,n),variant,recentSubjects:recent.map(x=>x.subject),replyExamples:replyExamples.map(x=>x.body)}
}

async function writeApplication(env,row,route){
  const learning=await applicationLearning(env)
  const acquisitionStrategy=await acquisitionStrategyContext(env).catch(()=> '')
  const profileEs=safe(env.PROFILE_ES_URL)
  const profileEn=safe(env.PROFILE_EN_URL)
  const r=await callModel(env,{task:'application.write',json:true,temperature:0.38,maxTokens:2600,timeoutMs:40000,
      validate:d=>(typeof d?.send==='boolean')||'send_missing',
      messages:[
        {role:'system',content:`${acquisitionConstitution}\n\n${acquisitionStrategy ? 'ESTRATEGIA ACTUAL DEL DIRECTOR DE ADQUISICIÓN:\n'+acquisitionStrategy+'\n\n' : ''}Escribes candidaturas en nombre de Catalina Jaramillo para oportunidades REALES. Tu trabajo no es sonar impresionante: es hacer que el receptor piense "esta persona entiende mi problema, ya ha construido sistemas cercanos y quiero hablar con ella".

APRENDIZAJE REAL DE POSTULACIONES:
- Postulaciones enviadas registradas: ${learning.sent}
- Respuestas registradas: ${learning.replied}
- Tasa de respuesta observada: ${(learning.replyRate*100).toFixed(1)}%
- Variante obligatoria para esta candidatura: ${learning.variant}
- Asuntos recientes que NO debes copiar: ${learning.recentSubjects.join(' | ') || 'sin historial suficiente'}
- Respuestas reales previas, si existen: ${learning.replyExamples.join(' || ') || 'ninguna todavía'}
Si hay 20+ postulaciones y la tasa de respuesta es <5%, cambia de forma material el enfoque respecto a los asuntos recientes. Si hay 50+ y la tasa sigue <3%, reduce introducción, muestra prueba relevante antes y usa un CTA de paid test/piloto acotado cuando encaje. No esperes a 100 para aprender.
VARIANTES:
- proof-first: abre con el sistema/caso propio más parecido y luego conecta con el problema.
- problem-first: abre con el fallo operativo concreto del anuncio y cómo lo estabilizarías.
- paid-pilot-first: abre proponiendo una primera prueba pagada y acotada, sin regalar trabajo ni inventar precio si el anuncio no lo pide.

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

IDIOMA Y COLABORACIÓN INTERNACIONAL:
- Catalina es hablante nativa de español y su inglés oral es básico. NUNCA digas fluent, advanced, C1/C2 ni native English.
- Tiene un agente propio de interpretación IA en tiempo real para reuniones y usa asistencia de IA para comunicación escrita.
- Si la publicación menciona inglés, reuniones, llamadas o colaboración con equipos angloparlantes, incluye UNA sola frase breve y positiva cerca del cierre:
  EN: "I’m a native Spanish speaker with basic spoken English. For live meetings I use a real-time AI interpretation agent and AI-assisted written communication, which keeps language from becoming a delivery bottleneck while staying transparent about my spoken level."
  ES: "Mi idioma nativo es español y mi inglés oral es básico. Para reuniones uso un agente de interpretación IA en tiempo real y asistencia de IA para comunicación escrita, evitando que el idioma se convierta en un cuello de botella para la ejecución sin fingir un nivel que no tengo."
- Si la publicación NO menciona idioma ni comunicación oral, no introduzcas esta objeción por iniciativa propia.
- Si "fluent English", "C1/C2", "native English" o alta fluidez oral es un requisito duro y central del rol, no lo ocultes. Si el trabajo puede ejecutarse de forma técnica/asíncrona con interpretación, puede aplicar transparentemente; si la función depende de llamadas continuas de ventas/soporte en inglés, devuelve send=false con reason="language_hard_requirement".
- Nunca digas que la traducción es perfecta; di real-time AI interpretation.

ASUNTO:
Específico al problema/proyecto, no genérico "Application". Si la publicación obliga un subject, respétalo exactamente.

LONGITUD:
- Email directo: 120-220 palabras; si el anuncio exige respuestas detalladas, puede ser más largo solo para cubrir lo obligatorio.
- Si la oportunidad pide CV/portfolio, menciona portfolio y perfil visual si la URL está configurada; nunca digas "adjunto" si no hay archivo realmente adjunto.
- Si pide rate y no existe rate obligatorio definido, di que prefieres cotizar por alcance tras ver el workflow o paid test; no inventes una tarifa.
- WhatsApp solo si la publicación lo pide explícitamente; no conviertas el email en un mensaje de WhatsApp.

Devuelve SOLO JSON:
{"send":true|false,"reason":"...","missingRequired":["..."],"language":"es|en","selectedSystems":["..."],"subject":"...","body":"..."}`},
        {role:'user',content:JSON.stringify({sourceUrl:row.url,platform:row.platform,who:row.who,need:row.need,route,priorDraft:row.reply})}
      ]})
  return r.ok?r.data:null
}
async function sendApplication(env,row,route,draft,now){
  const from=env.APPLICATION_EMAIL_FROM||env.EMAIL_FROM
  const replyTo=env.APPLICATION_REPLY_TO||'clientes@soycatalinajaramillo.com'
  const profileUrl=draft.language==='en'?safe(env.PROFILE_EN_URL):safe(env.PROFILE_ES_URL)
  const links=[
    'Portfolio: '+PORTFOLIO,
    'Website: '+SITE,
    profileUrl?((draft.language==='en'?'Profile: ':'Perfil: ')+profileUrl):null
  ].filter(Boolean).join('\n')
  const fullText=safe(draft.body)+'\n\n'+links
  const systemCopy={
    'LAURA':draft.language==='en'?'WhatsApp sales, support, follow-up and human handoff.':'Ventas, atención, seguimiento y handoff humano en WhatsApp.',
    'CAROLINA':draft.language==='en'?'Opportunity discovery, research, proposals, follow-up and pipeline.':'Búsqueda de oportunidades, investigación, propuestas, seguimiento y pipeline.',
    'Ecommerce Operations':draft.language==='en'?'Shopify, COD, logistics, confirmation and post-sale workflows.':'Shopify, COD, logística, confirmación y postventa.',
    'Meta Growth Intelligence':draft.language==='en'?'Creative-performance reading, hooks, angles, testing and scaling signals.':'Lectura creativa, hooks, ángulos, testing y señales de escalado.',
    'Creative Intelligence':draft.language==='en'?'Creative forensics, viral signals, hooks and market/competitor reading.':'Forense creativo, señales virales, hooks y lectura de mercado/competencia.',
    'Content Studio':draft.language==='en'?'UGC concepts, scripts, hooks and content workflows.':'Conceptos UGC, guiones, hooks y workflows de contenido.',
    'Executive / CEO Orchestration':draft.language==='en'?'Cross-functional summaries, alerts, prioritization and routing.':'Resúmenes cruzados, alertas, priorización y routing.',
    'Finance & Performance Ops':draft.language==='en'?'Channel tracking, finance/performance logic and operational metrics.':'Tracking por canal, lógica financiera y métricas operativas.',
    'Monitoring & Diagnostics':draft.language==='en'?'Monitoring, incident logic, diagnostics and operational safeguards.':'Monitoreo, incidentes, diagnóstico y salvaguardas operativas.'
  }
  const selected=(Array.isArray(draft.selectedSystems)?draft.selectedSystems:[]).slice(0,3)
  const selectedHtml=selected.length
    ? '<div style="margin:26px 0 8px"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8b7258;font-weight:800;margin-bottom:10px">'+(draft.language==='en'?'Relevant systems I have built':'Sistemas míos relevantes para este proyecto')+'</div>'
      +selected.map(name=>'<div style="border:1px solid #e6d9cd;border-radius:12px;padding:12px 14px;margin:8px 0;background:#fbf7f3"><div style="font-weight:800;color:#1b1816;font-size:13px">'+escapeHtml(name)+'</div><div style="color:#726961;font-size:12px;line-height:1.45;margin-top:3px">'+escapeHtml(systemCopy[name]||'')+'</div></div>').join('')
      +'</div>'
    : ''
  const bodyHtml=escapeHtml(safe(draft.body)).split(/\n\s*\n/).map(p=>'<p style="margin:0 0 14px">'+p.replace(/\n/g,'<br>')+'</p>').join('')
  const htmlBody='<!doctype html><html><body style="margin:0;background:#f4efe9;padding:22px 10px">'
    +'<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 34px rgba(55,42,33,.08);color:#201a17">'
    +'<div style="background:#171513;padding:26px 28px;display:flex;align-items:center">'
    +'<div style="flex:1"><div style="width:42px;height:3px;background:#b59667;margin-bottom:14px"></div><div style="font-size:24px;line-height:1.05;font-weight:800;color:#fff">Catalina Jaramillo</div><div style="font-size:13px;color:#d9c9b8;margin-top:7px">AI Commerce & Automation Systems · Founder-Operator</div></div>'
    +'<img src="'+SITE+'/catalina.jpg" alt="Catalina Jaramillo" width="92" height="92" style="display:block;width:92px;height:92px;object-fit:cover;object-position:center 25%;border-radius:50%;border:3px solid #b59667;margin-left:18px">'
    +'</div>'
    +'<div style="padding:28px 30px">'
    +'<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8b7258;font-weight:800;margin-bottom:8px">'+(draft.language==='en'?'Tailored application':'Postulación personalizada')+'</div>'
    +'<div style="font-size:22px;line-height:1.2;font-weight:800;color:#1b1816;margin-bottom:20px">'+escapeHtml(safe(draft.subject))+'</div>'
    +'<div style="font-size:15px;line-height:1.68;color:#342e2a">'+bodyHtml+'</div>'
    +selectedHtml
    +'<div style="margin:24px 0 0;padding:16px;border-radius:14px;background:#171513;color:white"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#d8c1a4;font-weight:800">'+(draft.language==='en'?'Operator perspective':'Perspectiva de operación')+'</div><div style="font-size:13px;line-height:1.55;margin-top:7px">'+(draft.language==='en'?'I have operated the business side myself: thousands of Shopify orders, customer operations, sales, post-sale and the systems around them. I build automation with adoption and day-to-day reality in mind.':'He operado el negocio del otro lado: miles de pedidos Shopify, atención, ventas, postventa y los sistemas alrededor. Diseño automatización pensando también en adopción y operación diaria.')+'</div></div>'
    +'<div style="margin-top:24px;display:flex;flex-wrap:wrap;gap:9px">'
    +'<a href="'+PORTFOLIO+'" style="display:inline-block;background:#6b5548;color:#fff;text-decoration:none;padding:11px 15px;border-radius:10px;font-size:13px;font-weight:800">'+(draft.language==='en'?'View portfolio':'Ver portafolio')+'</a>'
    +(profileUrl?'<a href="'+profileUrl+'" style="display:inline-block;background:#f7f2ec;color:#2c241f;text-decoration:none;padding:11px 15px;border-radius:10px;border:1px solid #e2d5c9;font-size:13px;font-weight:800">'+(draft.language==='en'?'Visual profile':'Perfil visual')+'</a>':'')
    +'<a href="'+SITE+'" style="display:inline-block;color:#6b5548;text-decoration:none;padding:11px 4px;font-size:13px;font-weight:800">soycatalinajaramillo.com</a>'
    +'</div>'
    +'<div style="margin-top:26px;padding-top:16px;border-top:1px solid #eadfd5;font-size:11.5px;line-height:1.5;color:#81776f">Catalina Jaramillo · '+escapeHtml(replyTo)+' · WhatsApp +1 786 929 9442<br>'+(draft.language==='en'?'Business track record is from Professional Glam / Piel y Glamour and is not attributed to AI.':'La trayectoria de negocio corresponde a Professional Glam / Piel y Glamour y no se atribuye a la IA.')+'</div>'
    +'</div></div></body></html>'
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
  await env.DB.prepare("UPDATE direct_applications SET status='sent',provider_id=?,sent_at=?,terminal=1,blocker=NULL,next_attempt_at=NULL,last_attempt_at=?,updated_at=? WHERE source_url=?").bind(String(data.id),now,now,now,row.url).run()
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

const retryDelayMs=attempt=>{
  if(attempt<=1) return 6*3600000
  if(attempt===2) return 24*3600000
  if(attempt===3) return 72*3600000
  return 7*86400000
}

async function scheduleRetry(env,url,{status,route='none',error='',blocker='',terminal=0,now=Date.now(),recipient=null}={}){
  const prior=await env.DB.prepare('SELECT attempt_count FROM direct_applications WHERE source_url=?').bind(url).first().catch(()=>null)
  const attempt=Number(prior?.attempt_count||0)+1
  const next=terminal?null:now+retryDelayMs(attempt)
  await env.DB.prepare(`INSERT INTO direct_applications(source_url,platform,recipient,route,status,error,blocker,attempt_count,last_attempt_at,next_attempt_at,terminal,created_at,updated_at)
    SELECT url,platform,?, ?,?,?,?,?,?,?,?, ?,? FROM intent_leads WHERE url=?
    ON CONFLICT(source_url) DO UPDATE SET
      recipient=coalesce(excluded.recipient,direct_applications.recipient),
      route=excluded.route,status=excluded.status,error=excluded.error,blocker=excluded.blocker,
      attempt_count=excluded.attempt_count,last_attempt_at=excluded.last_attempt_at,next_attempt_at=excluded.next_attempt_at,
      terminal=excluded.terminal,updated_at=excluded.updated_at`)
    .bind(recipient,route,status,error,blocker,attempt,now,next,terminal,now,now,url).run()
  return {attempt,next}
}

export async function runDirectApplications(env,now=Date.now()){
  await ensureTable(env)
  const enabled=env.DIRECT_APPLICATIONS_ENABLED==='true'
  const out={enabled,reviewed:0,sent:0,waitingHuman:0,skipped:0}
  if(!enabled) return out
  if(!env.OPENROUTER_API_KEY||!env.RESEND_API_KEY) return {...out,reason:'connections_missing'}
  const limit=Math.max(1,Math.min(30,Number(env.DIRECT_APPLICATION_DAILY_LIMIT||20)))
  const count=await env.DB.prepare("SELECT COUNT(*) n FROM direct_applications WHERE status IN ('sent','external_email_sent','replied') AND coalesce(sent_at,updated_at)>=?").bind(bogotaStart(now)).first()
  if((count?.n||0)>=limit) return {...out,reason:'daily_cap',limit}

  const rows=(await env.DB.prepare(`SELECT i.* FROM intent_leads i
    LEFT JOIN direct_applications d ON d.source_url=i.url
    WHERE i.fit IN ('alto','medio')
      AND (coalesce(i.explicit_demand,0)=1 OR i.status IN ('application_ready','waiting_human_submit','waiting_human_form','waiting_human_channel','official_api_pending','official_api_matched','direct_application_pending','needs_application_review'))
      AND coalesce(i.active_now,1)=1
      AND coalesce(d.terminal,0)=0
      AND i.status IN (
        'new','needs_verified_identity','direct_application_pending','application_ready','queued_outbound',
        'waiting_human_submit','waiting_human_form','waiting_human_channel','needs_application_review',
        'route_unverified','direct_email_failed'
      )
      AND (d.next_attempt_at IS NULL OR d.next_attempt_at<=?)
    ORDER BY
      CASE i.fit WHEN 'alto' THEN 0 ELSE 1 END,
      CASE coalesce(i.application_route,'unknown')
        WHEN 'email' THEN 0
        WHEN 'official_form' THEN 1
        WHEN 'community' THEN 2
        ELSE 3
      END,
      coalesce(d.updated_at,0) ASC,
      i.found_at DESC
    LIMIT 60`).bind(now).all()).results||[]

  for(const row of rows){
    if((count?.n||0)+out.sent>=limit) break
    if(MANUAL_APPLICATIONS_SENT.has(row.url)){
      await env.DB.prepare("UPDATE intent_leads SET status='external_email_sent' WHERE url=?").bind(row.url).run().catch(()=>{})
      await env.DB.prepare("INSERT INTO direct_applications(source_url,platform,route,status,error,terminal,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?) ON CONFLICT(source_url) DO UPDATE SET status='external_email_sent',route='email',error='sent manually from authorized Gmail account on 2026-10-02',terminal=1,next_attempt_at=NULL,updated_at=excluded.updated_at")
        .bind(row.url,safe(row.platform),'email','external_email_sent','sent manually from authorized Gmail account on 2026-10-02',now,now).run().catch(()=>{})
      continue
    }
    const platform=safe(row.platform)
    if(!allowedPlatform(platform)){
      // Freelancer/Upwork/Workana/etc. se resuelven por sus propios ejecutores/autorizaciones.
      continue
    }
    const prior=await env.DB.prepare('SELECT status,terminal,attempt_count FROM direct_applications WHERE source_url=?').bind(row.url).first()
    if(prior?.terminal || ['sent','replied','external_email_sent'].includes(prior?.status)) continue

    out.reviewed++
    const route=await resolveApplicationRoute(env,row)
    if(!route?.verified || !route.realOpportunity){
      const status=route?.realOpportunity===false?'not_hiring':'waiting_human_submit'
      const reason=safe(route?.reason||'application route not verified').slice(0,600)
      await scheduleRetry(env,row.url,{
        status,
        route:safe(route?.route||'none'),
        error:reason,
        blocker:reason,
        terminal:route?.realOpportunity===false?1:0,
        now
      })
      if(route?.realOpportunity===false){
        await env.DB.prepare("UPDATE intent_leads SET status='not_hiring' WHERE url=?").bind(row.url).run().catch(()=>{})
        out.skipped++
      }else{
        // A cold-outbound fallback may run independently, but the CONTRACT application remains unresolved.
        await queueIntentForDirectOutbound(env,row,now).catch(()=>({queued:false}))
        await env.DB.prepare("UPDATE intent_leads SET status='waiting_human_submit' WHERE url=?").bind(row.url).run().catch(()=>{})
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
      const status=route.route==='official_form'?'waiting_human_form':route.route==='community'?'waiting_human_channel':'waiting_human_submit'
      const blocker=safe(route.contactUrl||route.reason||'No authorized automatic application route').slice(0,600)
      await scheduleRetry(env,row.url,{status,route:safe(route.route),error:blocker,blocker,terminal:0,now})
      await env.DB.prepare("UPDATE intent_leads SET status=? WHERE url=?").bind(status,row.url).run().catch(()=>{})
      out.waitingHuman++
      continue
    }

    if(MANUAL_APPLICATION_RECIPIENTS_SENT.has(safe(route.email).toLowerCase())){
      await env.DB.prepare("UPDATE intent_leads SET status='external_email_sent' WHERE url=?").bind(row.url).run().catch(()=>{})
      await env.DB.prepare("INSERT INTO direct_applications(source_url,platform,recipient,route,status,error,terminal,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?) ON CONFLICT(source_url) DO UPDATE SET recipient=excluded.recipient,route='email',status='external_email_sent',error='manual_recipient_already_sent',terminal=1,next_attempt_at=NULL,updated_at=excluded.updated_at")
        .bind(row.url,platform,route.email,'email','external_email_sent','manual_recipient_already_sent',now,now).run().catch(()=>{})
      continue
    }
    if(MANUAL_APPLICATION_RECIPIENTS_BOUNCED.has(safe(route.email).toLowerCase())){
      const reason='manual_recipient_bounced_do_not_resend_same_address'
      await scheduleRetry(env,row.url,{status:'waiting_human_submit',route:'email',recipient:route.email,error:reason,blocker:reason,terminal:0,now})
      await env.DB.prepare("UPDATE direct_applications SET next_attempt_at=? WHERE source_url=?").bind(now+7*86400000,row.url).run().catch(()=>{})
      await env.DB.prepare("UPDATE intent_leads SET status='waiting_human_submit' WHERE url=?").bind(row.url).run().catch(()=>{})
      out.waitingHuman++
      continue
    }

    const draft=await writeApplication(env,row,route)
    if(!draft?.send || !safe(draft.subject) || safe(draft.body).length<200){
      const missing=Array.isArray(draft?.missingRequired)?draft.missingRequired.join(', '):''
      const reason=safe(draft?.reason||missing||'application_not_safe_to_send').slice(0,700)
      await scheduleRetry(env,row.url,{status:'needs_review',route:'email',recipient:route.email,error:reason,blocker:reason,terminal:0,now})
      await env.DB.prepare("UPDATE intent_leads SET status='needs_application_review' WHERE url=?").bind(row.url).run().catch(()=>{})
      out.waitingHuman++
      continue
    }

    await env.DB.prepare("INSERT INTO direct_applications(source_url,platform,recipient,subject,body,route,status,created_at,updated_at) VALUES (?,?,?,?,?,'email','sending',?,?) ON CONFLICT(source_url) DO UPDATE SET recipient=excluded.recipient,subject=excluded.subject,body=excluded.body,route='email',status='sending',error=NULL,blocker=NULL,last_attempt_at=excluded.updated_at,next_attempt_at=NULL,terminal=0,updated_at=excluded.updated_at")
      .bind(row.url,platform,route.email,safe(draft.subject).slice(0,180),safe(draft.body),now,now).run()
    const sent=await sendApplication(env,row,route,draft,now)
    if(sent.ok){
      out.sent++
    }else{
      const reason=safe(sent.error).slice(0,700)
      await scheduleRetry(env,row.url,{status:'direct_email_failed',route:'email',recipient:route.email,error:reason,blocker:reason,terminal:0,now})
      await env.DB.prepare("UPDATE intent_leads SET status='direct_email_failed' WHERE url=?").bind(row.url).run().catch(()=>{})
    }
  }
  return out
}

export async function applicationCoverageAudit(env,now=Date.now(),notify=true){
  await ensureTable(env)
  const rows=(await env.DB.prepare(`SELECT
      i.url,i.platform,i.who,i.need,i.status AS intent_status,i.application_route,i.evidence,i.found_at,
      d.status AS application_status,d.provider_id,d.blocker,d.attempt_count,d.next_attempt_at,d.terminal
    FROM intent_leads i
    LEFT JOIN direct_applications d ON d.source_url=i.url
    WHERE i.fit IN ('alto','medio')
      AND (coalesce(i.explicit_demand,0)=1 OR i.status IN ('application_ready','waiting_human_submit','waiting_human_form','waiting_human_channel','official_api_pending','official_api_matched','direct_application_pending','needs_application_review'))
      AND coalesce(i.active_now,1)=1
    ORDER BY i.found_at DESC
    LIMIT 300`).all()).results||[]

  const intentTerminal=new Set(['direct_email_sent','external_email_sent','submitted','not_hiring','skipped_budget','skipped_after_review'])
  const appTerminal=new Set(['sent','replied','external_email_sent','not_hiring'])
  const pending=[]
  let sent=0,marketplacePending=0,directPending=0,orphaned=0
  for(const row of rows){
    const done=Number(row.terminal||0)===1 || appTerminal.has(row.application_status) || intentTerminal.has(row.intent_status)
    if(done){sent++;continue}
    const marketplace=!allowedPlatform(row.platform)
    if(marketplace) marketplacePending++; else directPending++
    if(!marketplace && !row.application_status) orphaned++
    pending.push({...row,marketplace})
  }
  const stale=pending.filter(r=>Number(r.found_at||0) < now-2*3600000)
  if(notify && stale.length){
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
    const key='application_backlog_alert:'+day
    const once=await env.DB.prepare("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES (?,?,?)").bind(key,String(stale.length),now).run().catch(()=>({meta:{changes:0}}))
    if(once?.meta?.changes){
      const top=stale.slice(0,20).map((r,i)=>[
        `${i+1}. ${safe(r.platform)||'web'} · ${safe(r.who)||safe(r.need).slice(0,80)}`,
        `   intent=${r.intent_status||'new'} · application=${r.application_status||'sin registro'} · route=${r.application_route||'unknown'}`,
        r.blocker?`   bloqueo: ${safe(r.blocker).slice(0,180)}`:'',
        `   ${r.url}`
      ].filter(Boolean).join('\n')).join('\n')
      await notifyCatalina(env,`⚠️ ${stale.length} contratos todavía sin postulación confirmada`,[
        'Este aviso NO cuenta encontrados como postulados. Son oportunidades explícitas activas sin provider_id/bid_id/confirmación final.',
        `Directos pendientes: ${directPending} · marketplaces pendientes: ${marketplacePending} · huérfanos sin registro de aplicación: ${orphaned}`,
        '',
        top
      ].join('\n')).catch(()=>{})
    }
  }
  return {
    explicitActive:rows.length,
    resolved:sent,
    pending:pending.length,
    directPending,
    marketplacePending,
    orphaned,
    stale:stale.length,
    topPending:pending.slice(0,12).map(r=>({url:r.url,platform:r.platform,status:r.intent_status,applicationStatus:r.application_status||null,route:r.application_route||null,blocker:r.blocker||null}))
  }
}

export async function directApplicationSnapshot(env){
  await ensureTable(env)
  const rows=await env.DB.prepare('SELECT status,COUNT(*) n FROM direct_applications GROUP BY status').all()
  const coverage=await applicationCoverageAudit(env,Date.now(),false).catch(()=>null)
  return {enabled:env.DIRECT_APPLICATIONS_ENABLED==='true',stats:rows.results||[],coverage}
}
