import React,{useEffect,useRef,useState} from 'react'
import {ArrowUpRight,Send,ShieldCheck,RotateCcw,X} from 'lucide-react'
import {API,track} from '../api.js'

// Carolina en la primera pantalla: tarjeta compacta sobre el 3D → chat tipo mensajería.
// Los datos se piden conversando (uno por uno); luego sigue la asesoría con el modelo.
const avatar=`${import.meta.env.BASE_URL}carolina-avatar.webp`
const storageKey='carolina-live-v3'
const restore=()=>{try{const v=JSON.parse(localStorage.getItem(storageKey)||'null');if(v?.id&&Array.isArray(v.messages)&&Date.now()-v.savedAt<30*86400000)return v}catch{}return null}
const links=(text,k)=>text.split(/(https?:\/\/[^\s)]+)/g).map((part,i)=>/^https?:\/\//.test(part)?<a key={k+'-'+i} href={part} target="_blank" rel="noopener" className="chatLink">{/calendar|cal\.com|calendly|appointments|agenda/i.test(part)?'Elegir horario con Catalina':part} <ArrowUpRight size={13}/></a>:part)
const rich=text=>text.split(/\*\*([^*]+)\*\*/g).map((part,i)=>i%2?<b key={i}>{links(part,i)}</b>:links(part,i))
const EMAIL=/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

// Guion de la ficha conversacional: clave, pregunta de Carolina, opcional, validación.
const STEPS=[
 {key:'name',ask:()=>'Para empezar, ¿cómo te llamas?',check:v=>v.length>1||'¿Me repites tu nombre?'},
 {key:'company',ask:p=>`Mucho gusto, ${p.name.split(' ')[0]}. ¿Cómo se llama tu empresa?`,check:v=>v.length>1||'¿Cuál es el nombre de tu empresa?'},
 {key:'email',ask:()=>'¿A qué correo te envío el resumen de lo que conversemos?',check:v=>EMAIL.test(v)||'Ese correo no parece válido. ¿Me lo escribes de nuevo?'},
 {key:'website',ask:()=>'¿Tienes web o Instagram de la empresa? Si me lo compartes, lo reviso para darte observaciones concretas.',optional:'No tengo'},
 {key:'phone',ask:()=>'Última: ¿un WhatsApp por si prefieres que Catalina te escriba ahí?',optional:'Prefiero correo'},
]

export default function CarolinaLive(){
 const saved=useRef(restore()).current
 const [open,setOpen]=useState(!!saved)
 const [stage,setStage]=useState(saved?'chat':'intake')
 const [profile,setProfile]=useState({}),[step,setStep]=useState(0),[consent,setConsent]=useState(false)
 const [session,setSession]=useState(saved?.id||''),[messages,setMessages]=useState(saved?.messages||[])
 const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const list=useRef(null),field=useRef(null)
 useEffect(()=>{list.current?.scrollTo({top:list.current.scrollHeight,behavior:'smooth'})},[messages,busy,step])
 useEffect(()=>{try{if(session)localStorage.setItem(storageKey,JSON.stringify({id:session,messages:messages.slice(-40),savedAt:Date.now()}))}catch{}},[session,messages])
 useEffect(()=>{if(open)setTimeout(()=>field.current?.focus(),250)},[open,step,stage])
 // Cualquier enlace "Hablar con Carolina" (#carolina) abre la conversación directamente, también al llegar desde otra página.
 useEffect(()=>{
  const onClick=e=>{const a=e.target.closest?.('a[href$="#carolina"]');if(a&&!a.closest('.carolinaCard'))setTimeout(begin,350)}
  document.addEventListener('click',onClick)
  if(window.location.hash==='#carolina')setTimeout(begin,500)
  return()=>document.removeEventListener('click',onClick)
 },[])

 function begin(){setOpen(true);track('diagnosis_started');setMessages(m=>m.length?m:[{role:'assistant',text:'Hola, soy Carolina, la asesora de IA de Catalina. Te ayudo a identificar posibles pérdidas y oportunidades en tu empresa, qué te convendría construir y en qué rango de inversión estaríamos.'},{role:'assistant',text:STEPS[0].ask({})}])}

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
   const site=(p.website||'').trim(),isSite=/\./.test(site)&&!/^@/.test(site)
   const res=await fetch(`${API}/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({consent:true,profile:{name:p.name,company:p.company,email:p.email,phone:p.phone,[isSite?'website':'social']:site||undefined}})})
   const data=await res.json();if(!res.ok)throw new Error(data.error||'No pude iniciar la conversación.')
   setSession(data.conversationId);setStage('chat');track('conversation_started',data.conversationId)
   const opener=`Hola Carolina, soy ${p.name} de ${p.company}.${site?` ${isSite?'Nuestra web es':'Nos encuentras en'} ${site}; te autorizo a revisarla.`:''} Quiero saber qué podemos mejorar en la empresa.`
   setBusy(false);await ask(data.conversationId,opener)
  }catch(e){setBusy(false);setError(e.message)}
 }

 function answerIntake(value){
  const s=STEPS[step],v=(value??input).trim();setInput('')
  if(!v&&!s.optional)return
  const shown=v||s.optional
  const ok=v?(s.check?s.check(v):true):true
  if(ok!==true){setMessages(m=>[...m,{role:'user',text:shown},{role:'assistant',text:ok}]);return}
  const next={...profile,[s.key]:v};setProfile(next)
  const n=step+1
  if(n<STEPS.length){setMessages(m=>[...m,{role:'user',text:shown},{role:'assistant',text:STEPS[n].ask(next)}]);setStep(n)}
  else{setMessages(m=>[...m,{role:'user',text:shown},{role:'assistant',text:'Perfecto. Antes de seguir, confírmame que estás de acuerdo con cómo cuidamos tu información.'}]);setStep(n)}
 }

 function submit(e){e?.preventDefault();if(busy)return;if(stage==='chat'){const t=input.trim();if(!t)return;setInput('');ask(session,t)}else answerIntake()}
 function reset(){try{localStorage.removeItem(storageKey)}catch{};setSession('');setMessages([]);setProfile({});setStep(0);setConsent(false);setStage('intake');setOpen(false)}

 const current=STEPS[step],needsConsent=stage==='intake'&&step>=STEPS.length

 if(!open)return <div className="carolinaCard idle">
  <div className="carolinaHalo"><img src={avatar} alt="Carolina, agente de IA de Catalina"/><i/><i/></div>
  <div className="idleText"><span className="liveDot"><i/>EN LÍNEA · AGENTE DE IA</span><b>Carolina</b><p>Te ayudo a identificar posibles pérdidas y oportunidades en tu empresa, qué te convendría construir y en qué rango de inversión estaríamos.</p></div>
  <button className="diagStart" onClick={begin}>Hablar con Carolina <ArrowUpRight size={18}/></button>
  <small className="idleNote">Asesora preliminar de Catalina Jaramillo · en español</small>
 </div>

 return <div className="carolinaCard opened" aria-live="polite">
  <div className="phoneHead"><div className="carolinaHalo mini"><img src={avatar} alt=""/><i/></div><div><b>Carolina</b><span>{busy?(stage==='chat'&&messages.filter(m=>m.role==='assistant').length<=STEPS.length+1?'revisando tu empresa…':'escribiendo…'):'Agente de IA · asesora de Catalina'}</span></div><button className="phoneClose" aria-label="Minimizar" onClick={()=>setOpen(false)}><X size={16}/></button></div>
  <div className="phoneBody" ref={list}>{messages.map((m,i)=><div className={`bubble2 ${m.role}`} key={i}>{m.role==='assistant'?rich(m.text):m.text}</div>)}{busy&&<div className="bubble2 assistant typing"><i/><i/><i/></div>}</div>
  {error&&<p className="chatError" role="alert">{error}</p>}
  {needsConsent?<div className="consentBox"><label className="privacy"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Acepto que esta conversación se guarde hasta 30 días, que Carolina revise la información pública de mi empresa y que Catalina reciba el resumen. <a href="#privacidad">Privacidad</a></span></label><button className="diagStart" disabled={!consent||busy} onClick={()=>startSession(profile)}>{busy?'Conectando…':<>Empezar la asesoría <ArrowUpRight size={17}/></>}</button></div>
  :<>{stage==='intake'&&current?.optional&&<div className="chips"><button onClick={()=>answerIntake('')}>{current.optional}</button></div>}
   <form className="phoneComposer" onSubmit={submit}><input ref={field} value={input} onChange={e=>setInput(e.target.value)} placeholder={stage==='chat'?'Escríbele a Carolina…':current?.key==='email'?'tu@empresa.com':current?.key==='website'?'tuempresa.com o @tuempresa':current?.key==='phone'?'+1 305…':'Escribe aquí…'} inputMode={current?.key==='email'?'email':current?.key==='phone'?'tel':'text'} autoComplete={stage==='chat'?'off':current?.key==='name'?'name':current?.key==='company'?'organization':current?.key==='email'?'email':current?.key==='phone'?'tel':'url'} maxLength={stage==='chat'?3000:200}/><button disabled={busy||(!input.trim()&&stage==='chat')} aria-label="Enviar"><Send size={18}/></button></form></>}
  <div className="phoneFoot"><ShieldCheck size={13}/> Privado · precio final lo confirma Catalina{session&&<button className="linkBtn" onClick={reset}><RotateCcw size={12}/> Nueva</button>}</div>
 </div>
}
