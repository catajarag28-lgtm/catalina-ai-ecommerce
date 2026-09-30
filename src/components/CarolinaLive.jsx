import React,{useEffect,useRef,useState} from 'react'
import {ArrowUpRight,Send,ShieldCheck,RotateCcw,X} from 'lucide-react'
import {API,track} from '../api.js'

// Carolina en la primera pantalla: tarjeta compacta sobre el 3D → chat tipo mensajería.
// Ficha de contacto antes de la asesoría; el chat conserva la sesión consentida.
const avatar=`${import.meta.env.BASE_URL}carolina-avatar.webp`
const storageKey='carolina-live-v4'
const restore=()=>{try{const v=JSON.parse(localStorage.getItem(storageKey)||'null');if(v?.id&&Array.isArray(v.messages)&&Date.now()-v.savedAt<30*86400000)return v}catch{}return null}
const links=(text,k)=>text.split(/(https?:\/\/[^\s)]+)/g).map((part,i)=>/^https?:\/\//.test(part)?<a key={k+'-'+i} href={part} target="_blank" rel="noopener" className="chatLink">{/calendar|cal\.com|calendly|appointments|agenda/i.test(part)?'Elegir horario con Catalina':part} <ArrowUpRight size={13}/></a>:part)
const rich=text=>text.split(/\*\*([^*]+)\*\*/g).map((part,i)=>i%2?<b key={i}>{links(part,i)}</b>:links(part,i))

export default function CarolinaLive(){
 const saved=useRef(restore()).current
 const ref=useRef((()=>{try{const v=new URLSearchParams(window.location.search).get('p')||'';return /^[a-z0-9-]{20,90}$/i.test(v)?v:''}catch{return ''}})()).current
 const [open,setOpen]=useState(!!saved)
 const [stage,setStage]=useState(saved?'chat':'intake')
 const [profile,setProfile]=useState({}),[consent,setConsent]=useState(false)
 const [session,setSession]=useState(saved?.id||''),[messages,setMessages]=useState(saved?.messages||[])
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const list=useRef(null),field=useRef(null)
 useEffect(()=>{list.current?.scrollTo({top:list.current.scrollHeight,behavior:'smooth'})},[messages,busy])
 useEffect(()=>{try{if(session)localStorage.setItem(storageKey,JSON.stringify({id:session,messages:messages.slice(-40),savedAt:Date.now()}))}catch{}},[session,messages])
 useEffect(()=>{if(open)setTimeout(()=>field.current?.focus(),250)},[open,stage])

 function begin(){setOpen(true);track('diagnosis_started')}
 useEffect(()=>{
  const onClick=e=>{if(e.target.closest?.('a[href$="#carolina"]'))begin()}
  document.addEventListener('click',onClick)
  if(window.location.hash==='#carolina')begin()
  return()=>document.removeEventListener('click',onClick)
 },[])

 async function ask(id,text){
  setMessages(m=>[...m,{role:'user',text}]);setBusy(true);setError('')
  try{
   const res=await fetch(`${API}/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({conversationId:id,message:text}),signal:AbortSignal.timeout(45000)})
   const data=await res.json();if(!res.ok)throw new Error(data.error||'Carolina no pudo responder ahora.')
   setMessages(m=>[...m,{role:'assistant',text:data.reply}])
  }catch(e){setError(e.name==='TimeoutError'?'La respuesta tardó demasiado. Escribe de nuevo, por favor.':e.message)}
  finally{setBusy(false)}
 }

 async function startSession(p){
  setBusy(true);setError('')
  try{
   const site=/^(no tengo|ninguna?|n\/a)$/i.test((p.website||'').trim())?'':(p.website||'').trim(),isSite=!!site
   const res=await fetch(`${API}/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({consent:true,ref:ref||undefined,profile:{name:p.name,company:p.company,email:p.email,phone:p.phone,country:p.country,website:site||undefined,social:p.social||undefined}})})
   const data=await res.json();if(!res.ok)throw new Error(data.error||'No pude iniciar la conversación.')
   setSession(data.conversationId);setStage('chat');track('conversation_started',data.conversationId)
   const opener=`Hola Carolina, soy ${p.name} de ${p.company}.${site?` ${isSite?'Nuestra web es':'Nos encuentras en'} ${site}; te autorizo a revisarla.`:''} ${ref?' Vi el recorrido que nos preparó y quiero entender cómo funcionaría en nuestro caso.':' Quiero saber qué podemos mejorar en la empresa.'}`
   setBusy(false);await ask(data.conversationId,opener)
  }catch(e){setBusy(false);setError(e.message)}
 }

 function submit(e){e?.preventDefault();if(busy)return;const t=input.trim();if(!t)return;setInput('');ask(session,t)}
 function submitProfile(e){e.preventDefault();if(!consent||busy)return;startSession(profile)}
 function reset(){try{localStorage.removeItem(storageKey)}catch{};setSession('');setMessages([]);setProfile({});setConsent(false);setStage('intake');setOpen(false)}

 const formFields=[['name','Nombre','text','name'],['company','Empresa','text','organization'],['website','Dirección web (si tienes)','text','url'],['email','Correo electrónico','email','email'],['social','Redes sociales (si tienes)','text','off'],['phone','Teléfono con indicativo','tel','tel'],['country','País','text','country-name']]

 if(!open)return <div className="carolinaCard idle">
  <div className="carolinaHalo"><img src={avatar} alt="Carolina, agente de IA de Catalina"/><i/><i/></div>
  <div className="idleText"><span className="liveDot"><i/>EN LÍNEA · AGENTE DE IA</span><b>Carolina</b><p>Te ayudo a identificar posibles pérdidas y oportunidades en tu empresa, qué te convendría construir y en qué rango de inversión estaríamos.</p></div>
  <button className="diagStart" onClick={begin}>Hablar con Carolina <ArrowUpRight size={18}/></button>
  <small className="idleNote">Asesora preliminar de Catalina Jaramillo · en español</small>
 </div>

 return <div className="carolinaCard opened" aria-live="polite">
  <div className="phoneHead"><div className="carolinaHalo mini"><img src={avatar} alt=""/><i/></div><div><b>Carolina</b><span>{busy?(stage==='chat'&&messages.filter(m=>m.role==='assistant').length<2?'revisando tu empresa…':'escribiendo…'):'Agente de IA · asesora de Catalina'}</span></div><button className="phoneClose" aria-label="Minimizar" onClick={()=>setOpen(false)}><X size={16}/></button></div>
  {stage==='intake'?<form className="intakeForm" onSubmit={submitProfile}>
   <h3>Conozcamos tu empresa</h3><p>Deja tus datos para que Carolina revise tu negocio y la asesoría tenga contexto.</p>
   <div className="intakeGrid">{formFields.map(([key,label,type,auto])=><label key={key}>{label}<input name={key} type={type} autoComplete={auto} maxLength={200} required={!['website','social'].includes(key)} value={profile[key]||''} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))}/></label>)}</div>
   <label className="privacy"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Acepto guardar esta conversación hasta 30 días, la revisión de información pública de mi empresa y recibir el resumen y una propuesta preliminar por correo. Catalina recibirá el contexto. <a href="#privacidad">Privacidad</a></span></label>
   {error&&<p className="chatError" role="alert">{error}</p>}
   <button className="diagStart" disabled={!consent||busy}>{busy?'Preparando tu asesoría…':'Empezar la asesoría'}</button>
  </form>:<>
   <div className="phoneBody" ref={list}>{messages.map((m,i)=><div className={`bubble2 ${m.role}`} key={i}>{m.role==='assistant'?rich(m.text):m.text}</div>)}{busy&&<div className="bubble2 assistant typing"><i/><i/><i/></div>}</div>
   {error&&<p className="chatError" role="alert">{error}</p>}
   <form className="phoneComposer" onSubmit={submit}><input ref={field} value={input} onChange={e=>setInput(e.target.value)} placeholder="Escríbele a Carolina…" maxLength={3000}/><button disabled={busy||!input.trim()} aria-label="Enviar"><Send size={18}/></button></form>
  </>}
  <div className="phoneFoot"><ShieldCheck size={13}/> Privado · precio final lo confirma Catalina{session&&<button className="linkBtn" onClick={reset}><RotateCcw size={12}/> Nueva</button>}</div>
 </div>
}
