import React,{useState} from 'react'
import {ArrowRight,Sparkles,MessageCircleMore} from 'lucide-react'
import {advisorQuestions,preliminaryResult} from '../advisor'

export default function CarolinaExperience(){
 const [step,setStep]=useState(0),[answers,setAnswers]=useState({})
 const q=advisorQuestions[step], done=step>=advisorQuestions.length
 const choose=(v)=>{setAnswers({...answers,[q.key]:v});setStep(step+1)}
 const reset=()=>{setStep(0);setAnswers({})}
 const result=done?preliminaryResult(answers):null
 return <div className="advisorShell">
  <div className="advisorTop"><div><Sparkles size={15}/> CAROLINA · Asesora digital de Catalina</div><span>{done?'PRIMER MAPA':(step+1)+' / '+advisorQuestions.length}</span></div>
  {step===0&&<div className="carolinaIntro"><div className="carolinaAvatar"><MessageCircleMore/></div><div><h3>Cuéntame qué quieres conseguir.</h3><p>No tienes que saber si necesitas IA, un flujo, un agente o una estrategia. Primero entiendo tu negocio; después te muestro qué tendría sentido explorar.</p></div></div>}
  {!done&&<><p className="advisorText">{q.text}</p><div className="quickReplies">{q.options.map(v=><button key={v} onClick={()=>choose(v)}>{v}</button>)}</div></>}
  {done&&<div className="diagnosis"><span className="prelim">LECTURA PRELIMINAR · NO ES UN DIAGNÓSTICO FINAL</span><h3>Veo una oportunidad inicial en {result.stage}.</h3><p>Llegaste hablando de <b>{answers.friction}</b>. Antes de asumir que necesitas IA, exploraría <b>{result.solution}</b> y validaría contigo impacto, proceso actual, datos y restricciones.</p><div className="diagGrid"><div><small>QUIERES</small><b>{answers.goal}</b></div><div><small>ÁREA</small><b>{answers.area}</b></div><div><small>FRICCIÓN</small><b>{answers.friction}</b></div><div><small>CRECIMIENTO 2X</small><b>{answers.scale}</b></div></div><div className="routeHint"><a href="#servicios">Ver soluciones y precios <ArrowRight size={14}/></a><a href="#proyeccion">Modelar un escenario <ArrowRight size={14}/></a><button onClick={reset}>Empezar de nuevo</button></div></div>}
  <div className="memoryBar"><b>Cómo trabaja Carolina:</b> escucha → descubre → cuestiona → entiende → cuantifica → recomienda. Si no necesitas IA, te lo dice.</div>
 </div>
}