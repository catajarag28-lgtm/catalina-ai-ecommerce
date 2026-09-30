import React,{useState} from 'react'
import {Send,Sparkles} from 'lucide-react'

const opening={role:'assistant',text:'Hola, soy Carolina, la asesora digital de Catalina. Cuéntame con tus palabras qué está pasando en tu empresa o qué te gustaría mejorar. No necesitas saber si necesitas IA, automatización o estrategia.'}

function replyTo(text){
 const t=text.toLowerCase()
 if(/venta|cliente|lead|whatsapp|cita/.test(t)) return 'Entiendo. Antes de pensar en una herramienta, quiero ubicar dónde se está perdiendo la oportunidad. ¿Qué ocurre hoy desde que llega un cliente o contacto hasta que alguien de tu equipo lo atiende?'
 if(/equipo|manual|tiempo|repet|operaci|proceso/.test(t)) return 'Eso puede ser un problema de proceso antes que de IA. Cuéntame qué tarea se repite, quién la hace hoy y qué pasa cuando no se hace a tiempo.'
 if(/ia|agente|bot|automat/.test(t)) return 'Podemos explorar eso, pero no quiero recomendarte un agente solo porque suene avanzado. ¿Qué quieres que ese sistema consiga o haga por tu empresa que hoy no está ocurriendo?'
 if(/marketing|publicidad|meta|growth|crecer/.test(t)) return 'Perfecto. Para entender el cuello de botella: ¿hoy el problema principal es atraer oportunidades, convertirlas, hacer seguimiento o lograr que los clientes vuelvan?'
 return 'Te sigo. Cuéntame un poco más: ¿qué parte de eso te está costando más tiempo, dinero u oportunidades hoy?'
}

export default function CarolinaExperience(){
 const [messages,setMessages]=useState([opening])
 const [input,setInput]=useState('')
 const send=()=>{
  const value=input.trim(); if(!value)return
  setMessages(m=>[...m,{role:'user',text:value},{role:'assistant',text:replyTo(value)}])
  setInput('')
 }
 return <div className="advisorShell chatAdvisor">
  <div className="advisorTop"><div><Sparkles size={15}/> CAROLINA · Asesora digital de Catalina</div><span>EN LÍNEA</span></div>
  <div className="chatMessages">{messages.map((m,i)=><div key={i} className={'chatBubble '+m.role}>{m.text}</div>)}</div>
  <div className="chatComposer"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Escribe como hablarías con una persona…"/><button onClick={send} aria-label="Enviar"><Send size={18}/></button></div>
  <div className="memoryBar"><b>Habla libremente.</b> Carolina conversa contigo para entender el problema antes de recomendar una solución.</div>
 </div>
}