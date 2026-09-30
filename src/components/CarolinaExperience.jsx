import React,{useEffect,useRef,useState} from 'react'
import {ArrowUpRight,Send,ShieldCheck} from 'lucide-react'

import {API} from '../api.js'
const opening={role:'assistant',text:'Cuéntame con tus palabras qué pasa en tu negocio. Te digo qué construiría primero, cuánto costaría y, si quieres, le paso tu caso a Catalina.'}
const suggestions=['Se pierden ventas','Mi equipo está saturado','Quiero un agente para mi negocio']
const contexts=[['odont','Odontología'],['clínic','Salud'],['dental','Odontología'],['veterin','Veterinaria'],['mascot','Veterinaria'],['belleza','Belleza'],['salón','Belleza'],['estética','Belleza'],['shopify','Ecommerce'],['tienda','Ecommerce'],['marketing','Marketing'],['ads','Marketing'],['inmobili','Inmobiliario']]
const detectContext=messages=>{const text=messages.map(item=>item.text).join(' ').toLowerCase();return contexts.find(([key])=>text.includes(key))?.[1]||'Estrategia y sistemas'}
const track=(name,conversationId)=>fetch(`${API}/event`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,conversationId})}).catch(()=>{})

const storageKey='carolina-conversation-v1'
function restored(){try{const value=JSON.parse(localStorage.getItem(storageKey)||'null');if(value?.id&&Array.isArray(value.messages)&&Date.now()-value.savedAt<30*86400000)return value}catch{}return null}

export default function CarolinaChat(){
 const [saved]=useState(restored)
 const [messages,setMessages]=useState(saved?.messages||[opening]),[input,setInput]=useState(''),[consent,setConsent]=useState(!!saved),[session,setSession]=useState(saved?.id||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[available,setAvailable]=useState(null)
 const context=detectContext(messages)
 const list=useRef(null)
 useEffect(()=>{fetch(`${API}/health`).then(r=>r.json()).then(data=>setAvailable(data.modelReady===true)).catch(()=>setAvailable(false))},[])
 useEffect(()=>{list.current?.scrollTo({top:list.current.scrollHeight,behavior:'smooth'})},[messages,busy])
 useEffect(()=>{try{if(session&&consent)localStorage.setItem(storageKey,JSON.stringify({id:session,messages:messages.slice(-30),savedAt:Date.now()}));else localStorage.removeItem(storageKey)}catch{}},[session,messages,consent])
 async function send(suggestion){
  const value=(suggestion||input).trim();if(!value||busy||available===false)return
  if(!consent){setError('Para conversar, acepta el aviso de privacidad bajo el chat.');return}
  setError('');setBusy(true);setInput('')
  let id=session
  try{
   if(!id){const res=await fetch(`${API}/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({consent:true})});const data=await res.json();if(!res.ok)throw new Error(data.error||'No pude iniciar la conversación.');id=data.conversationId;setSession(id);track('conversation_started',id)}
   setMessages(m=>[...m,{role:'user',text:value}])
   const res=await fetch(`${API}/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({conversationId:id,message:value}),signal:AbortSignal.timeout(35000)})
   const data=await res.json();if(!res.ok)throw new Error(data.error||'Carolina no pudo responder ahora.')
   setMessages(m=>[...m,{role:'assistant',text:data.reply}]);if(messages.length>=3)track('meaningful_conversation',id)
  }catch(cause){setError(cause.name==='TimeoutError'?'La respuesta tardó demasiado. Inténtalo otra vez.':cause.message||'No hay conexión con Carolina en este momento.')}
  finally{setBusy(false)}
 }
 return <div className="chatShell"><div className="chatHeader"><div className="carolinaIdentity"><img className="carolinaMiniAvatar" src={`${import.meta.env.BASE_URL}carolina-avatar.webp`} alt="Avatar de Carolina"/><div><b>CAROLINA</b><span>Asesora digital · {context}</span></div></div><span className="chatBadge"><i/> {available===false?'INTEGRACIÓN PENDIENTE':context}</span></div>
 {available===false&&<p className="chatError">Carolina estará disponible cuando se conecte su motor de IA. Estamos preparando la experiencia.</p>}
 <div className="chatMessages" ref={list} aria-live="polite">{messages.map((message,i)=><div className={`message ${message.role}`} key={i}><span>{message.role==='assistant'?'CAROLINA':'TÚ'}</span><p>{message.text}</p></div>)}{busy&&<div className="message assistant"><span>CAROLINA</span><p className="typing">Pensando contigo <i/><i/><i/></p></div>}</div>
 {messages.length===1&&<div className="chatSuggestions">{suggestions.map(x=><button key={x} onClick={()=>send(x)}>{x} <ArrowUpRight size={14}/></button>)}</div>}
 {error&&<p className="chatError" role="alert">{error}</p>}
 <div className="chatComposer"><textarea aria-label="Tu mensaje para Carolina" value={input} maxLength={3000} rows={2} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Cuéntame qué está pasando en tu empresa…"/><button onClick={()=>send()} disabled={busy||available===false||!input.trim()} aria-label="Enviar mensaje"><Send size={19}/></button></div>
 <label className="privacy"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Acepto que esta conversación se guarde de forma segura hasta 30 días y que Catalina la lea para responderme. No compartas información sensible.</span></label><div className="chatFoot"><ShieldCheck size={15}/> Si dejas tus datos, Catalina recibe el resumen y te contacta · Precios finales se validan con ella.</div></div>
}
