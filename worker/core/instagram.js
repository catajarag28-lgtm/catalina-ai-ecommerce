import { salesStrategy, meetingNextStep } from '../skills/salesStrategy.js'
import { constitution, knowledge } from './knowledge.js'
import { notifyCatalina } from './notify.js'

const PORTFOLIO='https://portfolio-nine-lovat-18.vercel.app/'
const SITE='https://soycatalinajaramillo.com'

const hex = bytes => [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')
const safe = v => String(v ?? '').trim()

export function instagramReady(env={}) {
  return env.INSTAGRAM_ENABLED === 'true' &&
    !!env.INSTAGRAM_ACCESS_TOKEN &&
    !!env.INSTAGRAM_USER_ID &&
    !!env.INSTAGRAM_VERIFY_TOKEN &&
    !!env.INSTAGRAM_APP_SECRET
}

export async function verifyInstagramSignature(body, headers, secret) {
  const value=headers.get('x-hub-signature-256') || ''
  if(!secret || !/^sha256=[a-f0-9]{64}$/i.test(value)) return false
  try{
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
    const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)))
    return 'sha256='+hex(sig)===value.toLowerCase()
  }catch{return false}
}

export function verifyInstagramChallenge(url, env={}) {
  const mode=url.searchParams.get('hub.mode')
  const token=url.searchParams.get('hub.verify_token')
  const challenge=url.searchParams.get('hub.challenge')
  if(mode==='subscribe' && token && env.INSTAGRAM_VERIFY_TOKEN && token===env.INSTAGRAM_VERIFY_TOKEN && challenge) {
    return new Response(challenge,{status:200,headers:{'content-type':'text/plain'}})
  }
  return new Response('Verification failed',{status:403})
}

export function parseInstagramEvents(payload, ownId='') {
  const out=[]
  for(const entry of payload?.entry || []) {
    for(const m of entry?.messaging || []) {
      const sender=safe(m?.sender?.id), recipient=safe(m?.recipient?.id)
      if(!sender || sender===ownId || (ownId && recipient && recipient!==ownId)) continue
      if(m?.message?.is_echo) continue
      const text=safe(m?.message?.text || m?.postback?.title || m?.postback?.payload)
      if(!text) continue
      out.push({type:'message',senderId:sender,recipientId:recipient,messageId:safe(m?.message?.mid || m?.postback?.mid),timestamp:Number(m?.timestamp)||Date.now(),text:text.slice(0,4000)})
    }
    for(const ch of entry?.changes || []) {
      if(ch?.field!=='comments') continue
      const v=ch.value || {}
      const text=safe(v.text)
      const fromId=safe(v.from?.id || v.from_id)
      if(!text || !fromId || fromId===ownId) continue
      out.push({type:'comment',senderId:fromId,username:safe(v.from?.username || v.username),commentId:safe(v.id || v.comment_id),mediaId:safe(v.media?.id || v.media_id),timestamp:Date.now(),text:text.slice(0,2000)})
    }
  }
  return out
}

export async function sendInstagramText(env, recipientId, text) {
  if(!instagramReady(env)) return {ok:false,reason:'instagram_not_configured'}
  if(!recipientId || !safe(text)) return {ok:false,reason:'missing_recipient_or_text'}
  const version=safe(env.INSTAGRAM_API_VERSION || 'v22.0').replace(/^\/+|\/+$/g,'')
  const endpoint=`https://graph.instagram.com/${version}/${encodeURIComponent(env.INSTAGRAM_USER_ID)}/messages`
  const res=await fetch(endpoint,{
    method:'POST',
    headers:{authorization:'Bearer '+env.INSTAGRAM_ACCESS_TOKEN,'content-type':'application/json'},
    body:JSON.stringify({recipient:{id:String(recipientId)},message:{text:safe(text).slice(0,1000)}}),
    signal:AbortSignal.timeout(12000),
  }).catch(()=>null)
  const data=await res?.json().catch(()=>({}))
  return {ok:!!res?.ok && !!data?.message_id,id:data?.message_id||null,reason:res?.ok?undefined:'instagram_send_failed'}
}

function parseDecision(raw) {
  try{
    const t=String(raw||'')
    const a=t.indexOf('{'), b=t.lastIndexOf('}')
    const d=JSON.parse(t.slice(a,b+1))
    const lead=d.lead && typeof d.lead==='object'?d.lead:{}
    return {
      reply:safe(d.reply).slice(0,1200),
      hot:d.hot===true,
      summary:safe(d.summary).slice(0,500),
      lead:{
        name:safe(lead.name).slice(0,120),
        company:safe(lead.company).slice(0,160),
        website:safe(lead.website).slice(0,240),
        problem:safe(lead.problem).slice(0,500),
        budget:safe(lead.budget).slice(0,120),
        timing:safe(lead.timing).slice(0,120),
      }
    }
  }catch{return {reply:'',hot:false,summary:'No se pudo interpretar la respuesta.',lead:{}}}
}

async function decideDm(env, senderId, history, text) {
  const booking=meetingNextStep(env)
  const system=`${salesStrategy}

${constitution}

${knowledge}

CANAL: Instagram DM entrante. Esta persona inició la conversación; puedes responder por la API oficial. Nunca inicies DMs fríos desde esta función.
Tu objetivo es entender el negocio, aportar criterio y detectar si existe una oportunidad real. Responde primero a lo que la persona escribió y haz como máximo UNA pregunta. No empieces vendiendo ni pegando el portafolio.
Si pide prueba, experiencia o ejemplos, puedes compartir ${PORTFOLIO} y ${SITE}.
Si muestra intención clara, presupuesto compatible o pide reunión, hot=true y puedes proponer este siguiente paso:
${booking}
No inventes datos, precios, disponibilidad, resultados ni información sobre su empresa. Si no conoces el negocio, pregunta nombre/web o qué quiere resolver.
Devuelve SOLO JSON:
{"reply":"60-180 palabras, natural y profesional","hot":true|false,"summary":"1 frase para Catalina","lead":{"name":"","company":"","website":"","problem":"","budget":"","timing":""}}`
  const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',
    headers:{authorization:'Bearer '+env.OPENROUTER_API_KEY,'content-type':'application/json','X-Title':'Carolina - Instagram'},
    body:JSON.stringify({model:env.OPENROUTER_MODEL||env.OPENROUTER_EXTRACT_MODEL,temperature:0.35,max_tokens:900,response_format:{type:'json_object'},messages:[
      {role:'system',content:system},
      {role:'user',content:`Instagram sender id: ${senderId}\nHistorial reciente:\n${history||'(primer mensaje)'}\n\nMENSAJE NUEVO:\n${text}`}
    ]}),
    signal:AbortSignal.timeout(30000)
  }).catch(()=>null)
  if(!res?.ok) return {reply:'',hot:false,summary:'No se pudo procesar el DM.',lead:{}}
  const data=await res.json().catch(()=>({}))
  return parseDecision(data.choices?.[0]?.message?.content)
}

async function saveLead(env, conversationId, decision) {
  const values=Object.fromEntries(Object.entries(decision.lead||{}).filter(([,v])=>safe(v)))
  if(!Object.keys(values).length && !decision.hot) return
  const existing=await env.DB.prepare('SELECT data,status FROM leads WHERE conversation_id=?').bind(conversationId).first().catch(()=>null)
  let data={}
  try{data=JSON.parse(existing?.data||'{}')}catch{}
  data={...data,...values,source:'instagram',summary:decision.summary||data.summary}
  const status=decision.hot?'high_intent':(existing?.status||'identified')
  await env.DB.prepare(`INSERT INTO leads(conversation_id,data,updated_at,status) VALUES (?,?,?,?)
    ON CONFLICT(conversation_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,status=excluded.status`)
    .bind(conversationId,JSON.stringify(data),Date.now(),status).run()
}

async function processDm(env, event) {
  const messageKey=event.messageId || `${event.senderId}-${event.timestamp}-${event.text.slice(0,80)}`
  const dedupe=await env.DB.prepare("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES (?,?,?)")
    .bind('igmsg:'+messageKey,'1',Date.now()).run()
  if(!dedupe.meta.changes) return {duplicate:true}

  const conversationId='ig-'+event.senderId
  const now=Date.now()
  await env.DB.prepare("INSERT OR IGNORE INTO conversations(id,created_at,updated_at,summary,turn_count,consent) VALUES (?,?,?,'Instagram DM iniciado por el prospecto.',0,1)")
    .bind(conversationId,now,now).run()
  const past=await env.DB.prepare('SELECT role,content FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT 8').bind(conversationId).all()
  const history=(past.results||[]).reverse().map(m=>`${m.role==='user'?'PROSPECTO':'CAROLINA'}: ${m.content}`).join('\n')
  const decision=await decideDm(env,event.senderId,history,event.text)
  if(!decision.reply) {
    await notifyCatalina(env,'Instagram DM pendiente de revisión',`Carolina recibió un DM pero no pudo generar respuesta automática.\n\n${event.text}`).catch(()=>{})
    return {replied:false,reason:'model_failed'}
  }
  const sent=await sendInstagramText(env,event.senderId,decision.reply)
  await env.DB.prepare('INSERT INTO messages(conversation_id,role,content,created_at) VALUES (?,?,?,?)').bind(conversationId,'user',event.text,now).run()
  if(sent.ok) await env.DB.prepare('INSERT INTO messages(conversation_id,role,content,created_at) VALUES (?,?,?,?)').bind(conversationId,'assistant',decision.reply,Date.now()).run()
  await env.DB.prepare('UPDATE conversations SET updated_at=?,turn_count=turn_count+1 WHERE id=?').bind(Date.now(),conversationId).run()
  await saveLead(env,conversationId,decision).catch(()=>{})

  if(decision.hot || !sent.ok) {
    await notifyCatalina(env,
      decision.hot?'🔥 Instagram · prospecto con intención':'Instagram · revisar respuesta',
      `Resumen: ${decision.summary||'sin resumen'}\nSender ID: ${event.senderId}\nMensaje: ${event.text}\n\n${sent.ok?'Carolina respondió:\n'+decision.reply:'El envío automático falló; revisar manualmente.'}`
    ).catch(()=>{})
  }
  return {replied:sent.ok,hot:decision.hot}
}

async function processComment(env,event) {
  const id=event.commentId || `${event.senderId}-${event.timestamp}`
  const mark=await env.DB.prepare("INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES (?,?,?)")
    .bind('igcomment:'+id,'1',Date.now()).run()
  if(!mark.meta.changes) return {duplicate:true}
  await notifyCatalina(env,'Instagram · comentario para revisar',[
    event.username?'Usuario: @'+event.username:'Usuario ID: '+event.senderId,
    'Comentario: '+event.text,
    '',
    'Carolina no envió un DM frío automáticamente. Si esta persona inicia conversación o Meta habilita el flujo correspondiente con los permisos aprobados, Carolina puede continuar por DM.'
  ].join('\n')).catch(()=>{})
  return {notified:true}
}

export async function receiveInstagramWebhook(request,env) {
  if(env.INSTAGRAM_ENABLED!=='true') return new Response('Disabled',{status:503})
  const body=await request.text()
  if(body.length>250000) return new Response('Too large',{status:413})
  if(!(await verifyInstagramSignature(body,request.headers,env.INSTAGRAM_APP_SECRET))) return new Response('Invalid signature',{status:401})
  let payload
  try{payload=JSON.parse(body)}catch{return new Response('Invalid JSON',{status:400})}
  const events=parseInstagramEvents(payload,String(env.INSTAGRAM_USER_ID||''))
  const results=[]
  for(const event of events.slice(0,20)) {
    try{results.push(event.type==='message'?await processDm(env,event):await processComment(env,event))}
    catch(error){results.push({error:error?.message||'instagram_processing_failed'})}
  }
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES ('last_instagram_event',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(JSON.stringify({at:new Date().toISOString(),events:events.length,results}).slice(0,3000),Date.now()).run().catch(()=>{})
  return new Response('EVENT_RECEIVED',{status:200})
}
