import React,{useEffect,useRef,useState} from 'react'
import {ArrowUpRight,Send,ShieldCheck,RotateCcw} from 'lucide-react'
import {API,track} from '../api.js'

// Puerta de entrada: ficha corta → conversación con Carolina (asesora senior preliminar).
// Carolina investiga la web autorizada, muestra el panorama, valida presupuesto, precierra y agenda con Catalina.
const avatar=`${import.meta.env.BASE_URL}carolina-avatar.webp`
const storageKey='carolina-live-v2'
const restore=()=>{try{const v=JSON.parse(localStorage.getItem(storageKey)||'null');if(v?.id&&Array.isArray(v.messages)&&Date.now()-v.savedAt<30*86400000)return v}catch{}return null}
// Enlaces clicables en las respuestas (p. ej. la agenda de Catalina).
const links=(text,k)=>text.split(/(https?:\/\/[^\s)]+)/g).map((part,i)=>/^https?:\/\//.test(part)?<a key={k+'-'+i} href={part} target="_blank" rel="noopener" className="chatLink">{/calendar|cal\.com|calendly|appointments|agenda/i.test(part)?'Elegir horario con Catalina':part} <ArrowUpRight size={13}/></a>:part)
// **negrita** del modelo se muestra como negrita en lugar de asteriscos.
const linkify=text=>text.split(/\*\*([^*]+)\*\*/g).map((part,i)=>i%2?<b key={i}>{links(part,i)}</b>:links(part,i))

export default function CarolinaLive(){
 const saved=useRef(restore()).current
 const [stage,setStage]=useState(saved?'chat':'intro')
 const [form,setForm]=useState({name:'',company:'',email:'',phone:'',website:''}),[consent,setConsent]=useState(false)
 const [session,setSession]=useState(saved?.id||''),[messages,setMessages]=useState(saved?.messages||[])
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const list=useRef(null)
 useEffect(()=>{list.current?.scrollTo({top:list.current.scrollHeight,behavior:'smooth'})},[messages,busy])
 useEffect(()=>{try{if(session)localStorage.setItem(storageKey,JSON.stringify({id:session,messages:messages.slice(-40),savedAt:Date.now()}))}catch{}},[session,messages])
 const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}))

 async function ask(id,text){
  setMessages(m=>[...m,{role:'user',text}]);setBusy(true);setError('')
  try{
   const res=await fetch(`${API}/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({conversationId:id,message:text}),signal:AbortSignal.timeout(45000)})
   const data=await res.json();if(!res.ok)throw new Error(data.error||'Carolina no pudo responder ahora.')
   setMessages(m=>[...m,{role:'assistant',text:data.reply}])
  }catch(e){setError(e.name==='TimeoutError'?'La respuesta tardó demasiado. Escribe de nuevo, por favor.':e.message)}
  finally{setBusy(false)}
 }

 async function start(e){
  e.preventDefault();setError('')
  if(!form.name.trim()||!form.company.trim()||!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(form.email.trim())){setError('Escribe tu nombre, tu empresa y un email válido.');return}
  if(!consent){setError('Para continuar, acepta el aviso de privacidad.');return}
  setBusy(true)
  try{
   const site=form.website.trim(),isSite=/\./.test(site)&&!/^@/.test(site)
   const profile={name:form.name,company:form.company,email:form.email,phone:form.phone,[isSite?'website':'social']:site||undefined}
   const res=await fetch(`${API}/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({consent:true,profile})})
   const data=await res.json();if(!res.ok)throw new Error(data.error||'No pude iniciar la conversación.')
   setSession(data.conversationId);setStage('chat');track('conversation_started',data.conversationId)
   const opener=`Hola Carolina, soy ${form.name.trim()} de ${form.company.trim()}.${site?` ${isSite?'Nuestra web es':'Nos encuentras en'} ${site}; te autorizo a revisarla.`:''} Quiero saber qué podemos mejorar en la empresa.`
   setBusy(false);await ask(data.conversationId,opener)
  }catch(err){setBusy(false);setError(err.message)}
 }

 function send(e){e?.preventDefault();const text=input.trim();if(!text||busy)return;setInput('');ask(session,text)}
 function reset(){try{localStorage.removeItem(storageKey)}catch{};setSession('');setMessages([]);setStage('intro')}

 return <div className="diagnosis live" aria-live="polite">
  <div className="diagHead"><img src={avatar} alt="Carolina, agente de IA de Catalina"/><div><b>CAROLINA</b><span>Agente de IA · asesora de Catalina</span></div><span className="liveDot"><i/>EN LÍNEA</span></div>

  {stage==='intro'&&<form className="diagBody" onSubmit={start} noValidate>
   <p className="diagSay">Hola, soy Carolina, la asesora de IA de Catalina. Cuéntame de tu empresa: reviso tu web, te digo <b>dónde estás perdiendo dinero o clientes, qué te conviene construir y cuánto costaría</b>. Si tiene sentido, te agendo una reunión con Catalina.</p>
   <div className="leadForm compact">
    <div className="leadRow"><label>Nombre<input value={form.name} onChange={set('name')} autoComplete="name" required/></label><label>Empresa<input value={form.company} onChange={set('company')} autoComplete="organization" required/></label></div>
    <div className="leadRow"><label>Email<input value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" required/></label><label>WhatsApp <small>Opcional</small><input value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" placeholder="+1 305…"/></label></div>
    <label>Web o Instagram de tu empresa <small>Opcional, recomendado</small><input value={form.website} onChange={set('website')} placeholder="tuempresa.com o @tuempresa"/></label>
    <label className="privacy"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Acepto que esta conversación se guarde hasta 30 días, que Carolina revise la información pública de mi empresa y que Catalina reciba el resumen para contactarme. <a href="#privacidad">Privacidad</a></span></label>
    {error&&<p className="leadError" role="alert">{error}</p>}
    <button className="diagStart" disabled={busy}>{busy?'Conectando con Carolina…':<>Hablar con Carolina <ArrowUpRight size={18}/></>}</button>
   </div>
  </form>}

  {stage==='chat'&&<>
   <div className="chatMessages liveMessages" ref={list}>{messages.map((m,i)=><div className={`message ${m.role}`} key={i}><span>{m.role==='assistant'?'CAROLINA':'TÚ'}</span><p>{m.role==='assistant'?linkify(m.text):m.text}</p></div>)}{busy&&<div className="message assistant"><span>CAROLINA</span><p className="typing">{messages.length<=1?'Revisando tu empresa':'Pensando'} <i/><i/><i/></p></div>}</div>
   {error&&<p className="chatError" role="alert">{error}</p>}
   <form className="chatComposer" onSubmit={send}><textarea aria-label="Tu mensaje para Carolina" value={input} maxLength={3000} rows={2} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Escríbele a Carolina…"/><button disabled={busy||!input.trim()} aria-label="Enviar"><Send size={19}/></button></form>
   <div className="chatFoot"><ShieldCheck size={15}/> Conversación privada · Precio final lo confirma Catalina <button className="linkBtn" onClick={reset}><RotateCcw size={12}/> Nueva conversación</button></div>
  </>}
 </div>
}
