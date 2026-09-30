import React,{useEffect,useRef,useState} from 'react'
import {ArrowUpRight,Send,ShieldCheck} from 'lucide-react'

const API=import.meta.env.VITE_CAROLINA_API||(import.meta.env.DEV ? 'http://localhost:8787' : 'https://carolina-portfolio-api.catajaragpyg.workers.dev')
const opening={role:'assistant',text:'Hola, soy Carolina. Cuéntame qué te gustaría mejorar en tu empresa o qué te está quitando capacidad hoy.'}
const suggestions=['Se pierden ventas','Mi equipo está saturado','Quiero un agente para mi negocio']
const track=(name,conversationId)=>fetch(`${API}/event`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,conversationId})}).catch(()=>{})

const storageKey='carolina-conversation-v1'
function restored(){try{const value=JSON.parse(localStorage.getItem(storageKey)||'null');if(value?.id&&Array.isArray(value.messages)&&Date.now()-value.savedAt<30*86400000)return value}catch{}return null}

export default function CarolinaChat(){
 const [saved]=useState(restored)
 const [messages,setMessages]=useState(saved?.messages||[opening]),[input,setInput]=useState(''),[consent,setConsent]=useState(!!saved),[session,setSession]=useState(saved?.id||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[available,setAvailable]=useState(null)
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
 return <div className="chatShell"><div className="chatHeader"><div className="carolinaIdentity"><div className="carolinaMark">C</div><div><b>CAROLINA</b><span>Asesora digital de Catalina</span></div></div><span className="chatBadge"><i/> {available===false?'INTEGRACIÓN PENDIENTE':'CONVERSACIÓN ABIERTA'}</span></div>
 {available===false&&<p className="chatError">Carolina estará disponible cuando se conecte su motor de IA. Estamos preparando la experiencia.</p>}
 <div className="chatMessages" ref={list} aria-live="polite">{messages.map((message,i)=><div className={`message ${message.role}`} key={i}><span>{message.role==='assistant'?'CAROLINA':'TÚ'}</span><p>{message.text}</p></div>)}{busy&&<div className="message assistant"><span>CAROLINA</span><p className="typing">Pensando contigo <i/><i/><i/></p></div>}</div>
 {messages.length===1&&<div className="chatSuggestions">{suggestions.map(x=><button key={x} onClick={()=>send(x)}>{x} <ArrowUpRight size={14}/></button>)}</div>}
 {error&&<p className="chatError" role="alert">{error}</p>}
 <div className="chatComposer"><textarea aria-label="Tu mensaje para Carolina" value={input} maxLength={3000} rows={2} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Cuéntame qué está pasando en tu empresa…"/><button onClick={()=>send()} disabled={busy||available===false||!input.trim()} aria-label="Enviar mensaje"><Send size={19}/></button></div>
 <label className="privacy"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Acepto que mi conversación y los datos que comparta se guarden hasta 30 días para recibir esta asesoría y preparar un posible contacto con Catalina. No compartas información sensible.</span></label><div className="chatFoot"><ShieldCheck size={15}/> Conversación guardada en este navegador · Los alcances y precios finales se validan con Catalina.</div></div>
}
