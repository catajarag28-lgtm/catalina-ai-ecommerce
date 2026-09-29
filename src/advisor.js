export const advisorQuestions = [
 {key:"goal",text:"¿Qué quieres conseguir primero?",options:["Crecer / vender más","Organizar mejor la empresa","Ahorrar tiempo y trabajo manual","Atender mejor a clientes","Dar autonomía al equipo","Tener más control e información","Crear un producto o sistema digital","Explorar qué puede hacer la IA"]},
 {key:"area",text:"¿Dónde sientes hoy la mayor fricción?",options:["Marketing / Growth","Ventas","Clientes / servicio","Operaciones","Equipo / conocimiento","Información / dirección","Procesos entre herramientas","No sé dónde está"]},
 {key:"friction",text:"¿Cuál se parece más a lo que está pasando?",options:["Todo termina dependiendo de mí","Hay tareas repetitivas todos los días","Se pierden oportunidades o seguimiento","El equipo pregunta siempre lo mismo","Las herramientas no trabajan juntas","No tengo visibilidad de lo que pasa","Quiero crecer sin multiplicar estructura","Quiero construir algo nuevo"]},
 {key:"scale",text:"Si mañana tu volumen de trabajo creciera 2×, ¿qué pasaría?",options:["Lo soportamos bien","Habría mucha presión","Tendría que contratar","Algún proceso se rompería","No lo sé"]},
 {key:"readiness",text:"¿Qué tan cerca estás de hacer un cambio?",options:["Estoy explorando","Quiero resolverlo pronto","Ya estoy comparando soluciones","Tengo una necesidad concreta"]}
];
export function preliminaryResult(a){
 let stage="Estrategia",solution="Diagnóstico de negocio y oportunidades";
 const f=(a.friction||"")+" "+(a.area||"");
 if(/repetitivas|herramientas|Procesos/.test(f)){stage="Procesos y operación";solution="Flujos, automatización e integraciones"}
 if(/oportunidades|Ventas/.test(f)){stage="Ventas";solution="Sistema comercial, CRM, seguimiento o agente IA"}
 if(/pregunta|Equipo/.test(f)){stage="Equipo";solution="Knowledge system, SOP y asistente interno"}
 if(/visibilidad|Información/.test(f)){stage="Dirección";solution="Reporting, dashboards e inteligencia ejecutiva"}
 if(/Clientes/.test(f)){stage="Experiencia del cliente";solution="CX, atención, recepción o agente personalizado"}
 if(/Marketing|Growth/.test(f)){stage="Growth";solution="Estrategia, adquisición, oferta y optimización"}
 if(/construir algo nuevo/.test(f)){stage="Producto";solution="Product strategy y sistema digital personalizado"}
 return {stage,solution}
}
export function capacityModel({volume,minutes,share,hourly,implementation}){
 const hours=Math.round(volume*minutes*(share/100)/60);
 const value=Math.round(hours*hourly);
 return {hours,value,payback:value?implementation/value:null}
}