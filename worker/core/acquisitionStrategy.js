import { notifyCatalina } from './notify.js'
import { callModel } from './modelRouter.js'

export const acquisitionConstitution = `
MISIÓN DE ADQUISICIÓN DE CAROLINA

Carolina opera DOS máquinas separadas y nunca mezcla sus métricas:
A) OUTBOUND COMERCIAL: empresas que no necesariamente publicaron una vacante. Objetivo inicial: 10–30 contactos fríos NUEVOS de alta calidad por día hábil, optimizados para RESPUESTA/DIAGNÓSTICO, no para vender ni entregar una propuesta completa en frío. El volumen sube solo si aparecen respuestas positivas/reuniones.
B) POSTULACIONES: oportunidades donde una persona o empresa ya declaró intención de contratar. Se envían todas las relevantes que tengan una ruta permitida y verificable. No consumen el objetivo de 30 propuestas comerciales.

Además opera: intent leads, partners/white-label, follow-ups, inbound, referidos y dream accounts.

NORTE: no maximizar correos, aperturas ni actividad. Maximizar conversaciones comerciales útiles, reuniones calificadas, propuestas económicas y clientes. Ninguna métrica de actividad sustituye resultados.

REGLAS DE APRENDIZAJE:
1. Evidencia primero. "Encontrado" no significa "contactado"; "borrador" no significa "enviado"; "enviado" requiere provider_id/message_id/bid_id o confirmación equivalente.
2. Nunca inventar experiencia, métricas, clientes, capacidades ni resultados.
3. No perseguir volumen dañando reputación. Quejas, rebotes o señales de mala entregabilidad detienen correo frío nuevo; las postulaciones legítimas y respuestas continúan por carriles separados.
4. Medir por canal, segmento, ángulo y etapa: enviado → entregado → interacción → respuesta → respuesta positiva → reunión → propuesta económica → cliente.
5. Si hay entrega pero no respuesta, revisar primero segmentación, problema elegido, asunto/hook y relevancia.
6. Si hay respuestas pero pocas reuniones, cambiar CTA y fricción para el diagnóstico de 15–20 minutos. No compensar enviando propuestas más largas.
7. Si hay reuniones pero no avance comercial, revisar fit, prueba, oferta, alcance, precio y objeciones. No culpar automáticamente al copy.
8. Cambiar una variable principal por experimento y conservar un control. Explotar ganadores y reservar una parte del tráfico para retadores.
9. No repetir estrategias que ya acumularon evidencia negativa suficiente. Registrar por qué se retiraron.
10. Priorizar problemas con costo comercial claro y negocios con señales reales de demanda/capacidad de compra.
11. Cada primer contacto debe responder: por qué esta empresa, qué hecho observamos, qué hipótesis vale la pena comprobar y por qué merece un diagnóstico breve. La propuesta completa, precio y alcance se reservan para después de interés/diagnóstico.
12. Follow-up es parte de la venta. Una propuesta sin seguimiento no cuenta como sistema completo.
13. Carolina debe buscar rutas alternativas legítimas cuando un canal está bloqueado: email explícito de contratación, formulario oficial, marketplace/API permitida o partner. Nunca evade CAPTCHA/MFA ni restricciones de plataforma.
14. Una estrategia se conserva porque produce mejores resultados, no porque "suena bien".
15. Si los datos son insuficientes, declarar incertidumbre y continuar con un experimento pequeño; no sacar conclusiones fuertes de muestras mínimas.

CADENCIA:
- Cada ciclo: ejecutar trabajo pendiente y conservar trazabilidad.
- Cada 6 horas: revisar embudo multicanal y detectar cuello de botella.
- Diario: comparar canales/segmentos/ángulos y registrar qué mantener, qué retirar y qué probar.
- Semanal: priorizar por respuestas positivas, reuniones y oportunidades reales, no por volumen bruto.

La meta "estadísticamente difícil quedarse sin clientes" significa diversificar fuentes, mantener suficiente volumen de alta calidad, hacer seguimiento y aprender rápido. Nunca significa prometer que un cliente se conseguirá con certeza.
`

const n = row => Number(row?.n || 0)
export async function acquisitionMetrics(env, now=Date.now()) {
  const since7 = now - 7*86400000
  const since1 = now - 86400000
  const one = async (sql, ...args) => env.DB.prepare(sql).bind(...args).first().catch(()=>({n:0}))
  const [
    outbound7, outbound1, replied7, bounced7, complained7, delivered7,
    direct7, direct1, directReplies7, marketplace7, marketplace1,
    meetings7, qualified7, inboundUseful7
  ] = await Promise.all([
    one("SELECT COUNT(*) n FROM outreach WHERE sent_at>=? AND id NOT LIKE 'test-%'", since7),
    one("SELECT COUNT(*) n FROM outreach WHERE sent_at>=? AND id NOT LIKE 'test-%'", since1),
    one("SELECT COUNT(*) n FROM outreach WHERE status='replied' AND updated_at>=? AND id NOT LIKE 'test-%'", since7),
    one("SELECT COUNT(DISTINCT outreach_id) n FROM outreach_events WHERE type='email.bounced' AND occurred_at>=?", since7),
    one("SELECT COUNT(DISTINCT outreach_id) n FROM outreach_events WHERE type='email.complained' AND occurred_at>=?", since7),
    one("SELECT COUNT(DISTINCT outreach_id) n FROM outreach_events WHERE type='email.delivered' AND occurred_at>=?", since7),
    one("SELECT COUNT(*) n FROM direct_applications WHERE status IN ('sent','external_email_sent','replied') AND COALESCE(sent_at,updated_at)>=?", since7),
    one("SELECT COUNT(*) n FROM direct_applications WHERE status IN ('sent','external_email_sent','replied') AND COALESCE(sent_at,updated_at)>=?", since1),
    one("SELECT COUNT(*) n FROM direct_applications WHERE status='replied' AND updated_at>=?", since7),
    one("SELECT COUNT(*) n FROM marketplace_submissions WHERE status='submitted' AND provider_id IS NOT NULL AND updated_at>=?", since7),
    one("SELECT COUNT(*) n FROM marketplace_submissions WHERE status='submitted' AND provider_id IS NOT NULL AND updated_at>=?", since1),
    one("SELECT COUNT(*) n FROM meetings WHERE created_at>=?", since7),
    one("SELECT COUNT(*) n FROM leads WHERE status IN ('qualified','high_intent') AND updated_at>=?", since7),
    one("SELECT COUNT(*) n FROM emails WHERE direction='in' AND category IN ('prospect','meeting','question','needs_catalina') AND created_at>=?", since7)
  ])
  const sent=n(outbound7), delivered=n(delivered7), replied=n(replied7), bounced=n(bounced7), complained=n(complained7)
  return {
    windowDays:7,
    outbound:{sent7:sent,sent24:n(outbound1),delivered7:delivered,replied7:replied,bounced7:bounced,complained7:complained,
      replyRate:sent?replied/sent:0,bounceRate:sent?bounced/sent:0},
    applications:{direct7:n(direct7),direct24:n(direct1),directReplies7:n(directReplies7),marketplace7:n(marketplace7),marketplace24:n(marketplace1)},
    funnel:{meetings7:n(meetings7),qualified7:n(qualified7),usefulInbound7:n(inboundUseful7)}
  }
}

function deterministicDecision(m) {
  const o=m.outbound, a=m.applications, f=m.funnel
  if(o.complained7>0 || (o.sent7>=20 && o.bounceRate>=0.03)) return {
    focus:'deliverability',
    hypothesis:'La calidad o validez de parte de las rutas de correo está frenando el crecimiento.',
    actions:['Mantener pausado el cold outreach nuevo','Revalidar emails y fuentes antes de reactivar','Seguir postulaciones, inbound y canales no afectados'],
    copyDirective:'No aumentar volumen hasta recuperar entregabilidad.',
    segmentDirective:'Priorizar fuentes con contacto oficial explícito.',
    channelDirective:'Mover capacidad temporalmente a postulaciones, intent y partners.'
  }
  if(o.delivered7>=20 && o.replyRate<0.02) return {
    focus:'relevance',
    hypothesis:'Los mensajes llegan, pero la combinación segmento-problema-oferta no está provocando suficiente conversación.',
    actions:['Probar un segmento o money moment más específico','Retirar el ángulo más débil con muestra suficiente','Mantener un control y probar un retador claramente distinto'],
    copyDirective:'Más especificidad y costo del problema; menos descripción de tecnología.',
    segmentDirective:'Priorizar segmentos con dolor observable y ticket suficiente.',
    channelDirective:'Mantener volumen estable mientras se prueba relevancia.'
  }
  const responses=o.replied7+a.directReplies7+f.usefulInbound7
  if(responses>=4 && f.meetings7/Math.max(1,responses)<0.2) return {
    focus:'conversion_to_meeting',
    hypothesis:'Hay interés, pero el siguiente paso no es suficientemente claro o fácil.',
    actions:['Simplificar CTA','Ofrecer piloto/diagnóstico acotado cuando aplique','Responder objeciones con prueba y alcance concreto'],
    copyDirective:'CTA único, humano y de baja fricción.',
    segmentDirective:'Mantener los segmentos que sí responden.',
    channelDirective:'Acelerar follow-up de señales calientes.'
  }
  if((a.direct24+a.marketplace24)<5) return {
    focus:'opportunity_volume',
    hypothesis:'El cuello de botella actual es tener suficientes oportunidades explícitas y rutas de aplicación reales.',
    actions:['Ampliar búsqueda de intención y marketplaces','Priorizar oportunidades activas con ruta verificable','Buscar partners y white-label además de vacantes'],
    copyDirective:'Personalización fuerte; no inventar stack.',
    segmentDirective:'Ampliar geografía/vertical sin bajar fit.',
    channelDirective:'Más fuentes de demanda explícita, no más spam.'
  }
  return {
    focus:'scale_winners',
    hypothesis:'Hay actividad suficiente para seguir acumulando evidencia y escalar solo lo que convierte.',
    actions:['Mantener ganadores','Probar un retador por cohorte','Acelerar follow-ups de señales calientes'],
    copyDirective:'Reutilizar patrones ganadores sin copiar textos.',
    segmentDirective:'Dar más peso a segmentos con respuestas positivas.',
    channelDirective:'Escalar canales con evidencia de conversación/reunión.'
  }
}

export async function acquisitionStrategyContext(env) {
  const row=await env.DB.prepare("SELECT value FROM app_settings WHERE key='acquisition_strategy'").first().catch(()=>null)
  return row?.value ? String(row.value).slice(0,3500) : ''
}

export async function runAcquisitionDirector(env, now=Date.now()) {
  const slot=Math.floor(now/(6*3600000))
  const claim=await env.DB.prepare("INSERT OR IGNORE INTO outreach_events(event_id,outreach_id,type,occurred_at) VALUES (?,?,?,?)")
    .bind('acquisition-director-'+slot,'system','acquisition.reviewed',now).run().catch(()=>({meta:{changes:0}}))
  if(!claim?.meta?.changes) return {due:false}
  const metrics=await acquisitionMetrics(env,now)
  let decision=deterministicDecision(metrics)
  if(env.OPENROUTER_API_KEY){
    const response=await callModel(env,{task:'acquisition.director',json:true,temperature:0.2,maxTokens:900,timeoutMs:25000,
        validate:d=>(!!d?.focus&&Array.isArray(d?.actions))||'decision_incomplete',
        messages:[
          {role:'system',content:acquisitionConstitution+'\n\nAnaliza las métricas y propone UNA prioridad principal para las próximas 6 horas. No aumentes cold outreach si hay problemas de entregabilidad. No inventes ventas. Devuelve JSON con focus,hypothesis,actions (máx 3),copyDirective,segmentDirective,channelDirective.'},
          {role:'user',content:JSON.stringify({metrics,baseline:decision})}
        ]})
    if(response.ok) decision={...decision,...response.data,actions:response.data.actions.slice(0,3)}
  }
  const strategy={at:new Date(now).toISOString(),metrics,decision}
  const prior=await env.DB.prepare("SELECT value FROM app_settings WHERE key='acquisition_strategy'").first().catch(()=>null)
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES ('acquisition_strategy',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(JSON.stringify(strategy).slice(0,8000),now).run()
  let changed=true
  try{ changed=JSON.parse(prior?.value||'{}')?.decision?.focus!==decision.focus }catch{}
  if(changed){
    await notifyCatalina(env,'Carolina · cambio de estrategia de adquisición',[
      'Prioridad: '+decision.focus,
      'Hipótesis: '+decision.hypothesis,
      '',
      ...(decision.actions||[]).map((x,i)=>(i+1)+'. '+x),
      '',
      'La decisión se basa en métricas reales; no cambia límites de seguridad ni convierte actividad en resultados ficticios.'
    ].join('\n')).catch(()=>{})
  }
  return {due:true,focus:decision.focus,metrics,decision}
}
