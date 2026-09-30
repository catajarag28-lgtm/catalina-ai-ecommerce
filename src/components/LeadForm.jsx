import React,{useState} from 'react'
import {Send,CheckCircle2} from 'lucide-react'
import {sendLead} from '../api.js'

// Formulario corto al final del diagnóstico de Carolina; llega a Catalina por email (Worker /lead).
export default function LeadForm({source='contact',extra={},compact=false,submitLabel='Enviar a Catalina'}){
 const [form,setForm]=useState({name:'',company:'',contact:'',problem:'',budget:''}),[state,setState]=useState('idle'),[error,setError]=useState('')
 const set=key=>e=>setForm(f=>({...f,[key]:e.target.value}))
 async function submit(e){
  e.preventDefault();setError('')
  const contact=form.contact.trim(),isEmail=contact.includes('@')
  if(!form.name.trim()||!contact){setError('Escribe tu nombre y un email o WhatsApp.');return}
  setState('sending')
  try{await sendLead({source,...extra,name:form.name,company:form.company,[isEmail?'email':'phone']:contact,problem:form.problem||undefined,budget:form.budget||undefined});setState('sent')}
  catch(cause){setState('idle');setError(cause.message)}
 }
 if(state==='sent')return <div className="leadDone" role="status"><CheckCircle2 size={22}/><div><b>Listo, {form.name.split(' ')[0]}. Catalina ya recibió tu información.</b><p>Te escribe personalmente en menos de 24 horas hábiles, en español.</p></div></div>
 return <form className={`leadForm ${compact?'compact':''}`} onSubmit={submit} noValidate>
  <div className="leadRow"><label>Nombre<input value={form.name} onChange={set('name')} autoComplete="name" required/></label><label>Empresa<input value={form.company} onChange={set('company')} autoComplete="organization"/></label></div>
  <label>Email o WhatsApp (con indicativo)<input value={form.contact} onChange={set('contact')} autoComplete="email" inputMode="email" required placeholder="tu@empresa.com o +1 305…"/></label>
  {!compact&&<><label>¿Qué quieres resolver? <small>Opcional</small><textarea rows={3} value={form.problem} onChange={set('problem')} maxLength={1000} placeholder="Ej.: nos escriben por WhatsApp y no alcanzamos a responder a tiempo. Usamos Shopify y Calendly."/></label>
  <label>Presupuesto aproximado <small>Opcional</small><select value={form.budget} onChange={set('budget')}><option value="">Prefiero no decir</option><option>Menos de USD 2.000</option><option>USD 2.000 – 4.000</option><option>USD 4.000 – 8.000</option><option>Más de USD 8.000</option></select></label></>}
  {error&&<p className="leadError" role="alert">{error}</p>}
  <button className="diagStart" disabled={state==='sending'}><Send size={16}/> {state==='sending'?'Enviando…':submitLabel}</button>
  <p className="diagFine">Tus datos solo los recibe Catalina, junto con el resumen de Carolina, para preparar tu reunión. No se comparten ni se usan para publicidad.</p>
 </form>
}
