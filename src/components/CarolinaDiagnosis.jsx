import React,{useState} from 'react'
import {ArrowLeft,ArrowUpRight,Check,MessageCircle} from 'lucide-react'
import {diagnosisQuestions,recommend,launchBonus} from '../offers.js'
import {track} from '../api.js'
import CarolinaChat from './CarolinaExperience.jsx'
import LeadForm from './LeadForm.jsx'

const avatar=`${import.meta.env.BASE_URL}carolina-avatar.webp`

export default function CarolinaDiagnosis(){
 const [step,setStep]=useState(-1),[answers,setAnswers]=useState({tools:[]}),[note,setNote]=useState(''),[mode,setMode]=useState('guided')
 const q=diagnosisQuestions[step],done=step>=diagnosisQuestions.length
 const result=done?recommend(answers):null
 const start=()=>{setStep(0);track('diagnosis_started')}
 const pick=option=>{
  if(q.multi){setAnswers(a=>({...a,tools:a.tools.includes(option)?a.tools.filter(t=>t!==option):[...a.tools,option]}));return}
  setAnswers(a=>({...a,[q.key]:option}))
  if(step===diagnosisQuestions.length-1)track('diagnosis_completed')
  setStep(step+1)
 }
 if(mode==='chat')return <div className="diagnosis chatMode"><button className="diagBack" onClick={()=>setMode('guided')}><ArrowLeft size={15}/> Volver al diagnóstico guiado</button><CarolinaChat/></div>
 return <div className="diagnosis" aria-live="polite">
  <div className="diagHead"><img src={avatar} alt="Carolina, asesora digital de Catalina"/><div><b>CAROLINA</b><span>Agente de IA · asesora de Catalina</span></div>{step>=0&&!done&&<span className="diagCount">{step+1} / {diagnosisQuestions.length}</span>}</div>
  {step>=0&&!done&&<div className="diagProgress"><i style={{width:`${(step/diagnosisQuestions.length)*100}%`}}/></div>}

  {step===-1&&<div className="diagBody">
   <p className="diagSay">Hola, soy Carolina. Te hago 5 preguntas rápidas sobre tu negocio y te digo <b>qué te conviene construir primero y cuánto costaría</b>. Si hay un buen encaje, te agendo una reunión con Catalina.</p>
   <ol className="diagSteps"><li><span>1</span>Respondes 5 preguntas</li><li><span>2</span>Recibes recomendación y precio orientativo</li><li><span>3</span>Si hay encaje, te agendo con Catalina</li></ol>
   <button className="diagStart" onClick={start}>Empezar · toma 2 minutos <ArrowUpRight size={18}/></button>
   <button className="diagAlt" onClick={()=>setMode('chat')}><MessageCircle size={14}/> Prefiero contarle con mis palabras</button>
  </div>}

  {q&&<div className="diagBody">
   <p className="diagSay">{q.text}</p>
   <div className={`diagOptions ${q.multi?'multi':''}`}>{q.options.map(o=>{const on=q.multi?answers.tools.includes(o):answers[q.key]===o;return <button key={o} className={on?'on':''} aria-pressed={on} onClick={()=>pick(o)}>{q.multi&&<i>{on&&<Check size={12}/>}</i>}{o}</button>})}</div>
   <div className="diagNav">{step>0&&<button className="diagBack" onClick={()=>setStep(step-1)}><ArrowLeft size={15}/> Atrás</button>}{q.multi&&<button className="diagNext" disabled={!answers.tools.length} onClick={()=>setStep(step+1)}>Continuar <ArrowUpRight size={15}/></button>}</div>
  </div>}

  {result&&<div className="diagBody">
   <p className="diagSay">Por lo que me cuentas, {result.first.charAt(0).toLowerCase()+result.first.slice(1)}</p>
   <div className="resultCard">
    <span className="label">MI RECOMENDACIÓN</span>
    <h3>{result.name}</h3>
    <div className="resultPrice"><b>{result.range}</b><small>inversión orientativa de implementación · mantenimiento {result.monthly}</small></div>
    <p>{result.includes}</p>
    <p className="resultNext">{result.next}</p>
    <p className="resultBonus">{launchBonus}</p>
   </div>
   <p className="diagSay small"><b>¿Quieres que Catalina lo revise contigo?</b> Déjame tus datos y le paso este resumen. El precio final lo confirma ella después de revisar tus herramientas y el alcance.</p>
   <label className="diagNote">¿Algo más que Catalina deba saber? <small>(opcional)</small><textarea rows={2} maxLength={400} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ej.: tengo 3 sedes y el equipo responde hasta las 6 p. m."/></label>
   <LeadForm compact source="diagnosis" submitLabel="Enviar mi resumen a Catalina" extra={{business:answers.business,goal:answers.goal,tools:answers.tools,volume:answers.volume,timing:answers.timing,recommendation:`${result.name} (${result.range})`,note:note||undefined}}/>
   <div className="diagNav"><button className="diagBack" onClick={()=>{setStep(0);setAnswers({tools:[]})}}><ArrowLeft size={15}/> Repetir</button><button className="diagAlt" onClick={()=>setMode('chat')}><MessageCircle size={14}/> Resolver dudas con Carolina</button></div>
  </div>}
 </div>
}
