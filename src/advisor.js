export const advisorQuestions = [
 {key:"goal",text:"¿Qué te gustaría conseguir en tu negocio en los próximos 90 días?",options:["Vender más","Atender más sin ampliar equipo","Reducir trabajo manual","Mejorar experiencia","Explorar IA"]},
 {key:"model",text:"¿Qué tipo de negocio operas?",options:["Ecommerce","Servicios","Medspa / belleza","Educación / digital","Otro"]},
 {key:"channel",text:"¿Dónde ocurre hoy la mayor parte de tus conversaciones o ventas?",options:["Web / ecommerce","WhatsApp","Teléfono","Instagram / DM","Varios canales"]},
 {key:"volume",text:"¿Qué volumen mensual aproximado maneja ese proceso?",options:["Menos de 100","100–500","500–2.000","Más de 2.000","No lo sé"]},
 {key:"friction",text:"¿Qué te está costando más capacidad ahora?",options:["Responder a tiempo","Seguimiento","Tareas repetitivas","Errores / reproceso","No tengo visibilidad"]},
 {key:"scale",text:"Si el volumen creciera 2× mañana, ¿tu operación actual lo soportaría?",options:["Sí, sin problema","Sí, con presión","Tendría que contratar","Se saturaría","No lo sé"]}
];
export function preliminaryResult(a){
 let stage="Inteligencia",solution="AI Commerce Sprint";
 if((a.friction||"").includes("Responder")){stage="Conversión";solution="AI Sales / Reception Agent"}
 else if((a.friction||"").includes("Seguimiento")){stage="Retención";solution="AI Follow-up & Reactivation"}
 else if((a.friction||"").includes("Tareas")){stage="Operación";solution="Automation + AI Operations"}
 else if((a.friction||"").includes("Errores")){stage="Operación";solution="Workflow redesign + guardrails"}
 if((a.goal||"").includes("Explorar"))solution="AI Readiness Diagnostic";
 return {stage,solution}
}
export function capacityModel({volume,minutes,share,hourly,implementation}){
 const hours=Math.round(volume*minutes*(share/100)/60);
 const value=Math.round(hours*hourly);
 return {hours,value,payback:value?implementation/value:null}
}