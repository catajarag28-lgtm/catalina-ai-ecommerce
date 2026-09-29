import React,{useState} from 'react'
import {ArrowRight,Sparkles} from 'lucide-react'
import {advisorQuestions,preliminaryResult} from '../advisor'

export default function CarolinaExperience(){
 const [step,setStep]=useState(0),[answers,setAnswers]=useState({})
 const q=advisorQuestions[step], done=step>=advisorQuestions.length
 const choose=(v)=>{const next={...answers,[q.key]:v};setAnswers(next);setStep(step+1)}
 const result=done?preliminaryResult(answers):null
 return <div className="advisorShell">
  <div className="advisorTop"><div><Sparkles size={15}/> CAROLINA · Asesora digital de Catalina</div><span>{done?'MAPA PRELIMINAR':(step+1)+' / '+advisorQuestions.length}</span></div>
  {step===0&&<><h3 className="advisorText">Hola, soy Carolina.</h3><p className="microInsight">Quiero entender qué quieres conseguir y qué está haciendo que hoy te cueste más tiempo, capacidad o crecimiento. No necesitas saber qué IA necesitas.</p></>}
  {!done&&<><p className="advisorText">{q.text}</p><div className="quickReplies">{q.options.map(v=><button key={v} onClick={()=>choose(v)}>{v}</button>)}</div></>}
  {done&&<div className="diagnosis"><span className="prelim">LO QUE ENTENDÍ · PRELIMINAR</span><h3>Tu oportunidad parece estar en {result.stage}.</h3><p>Por lo que me contaste, exploraría <b>{result.solution}</b>. Antes de recomendar una implementación, Catalina validaría contigo los datos y el alcance.</p><div className="diagGrid"><div><small>OBJETIVO</small><b>{answers.goal}</b></div><div><small>CANAL</small><b>{answers.channel}</b></div><div><small>FRICCIÓN</small><b>{answers.friction}</b></div><div><small>ESCALA 2X</small><b>{answers.scale}</b></div></div><div className="routeHint">¿Quieres ver cómo podría cambiar este escenario? <a href="#proyeccion">Ver mi Future Business Twin <ArrowRight size={14}/></a></div></div>}
  <div className="memoryBar"><b>Carolina escucha entre líneas:</b> objetivo → fricción → impacto → capacidad → futuro deseado → solución.</div>
 </div>
}