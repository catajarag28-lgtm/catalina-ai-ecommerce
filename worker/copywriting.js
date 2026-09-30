// Skill de copywriting de Carolina para correo en frío B2B y páginas de propuesta.
// Destilado de prácticas de cold email (asunto, vista previa, primera línea, CTA único, P. D.)
// y de copy persuasivo ético: especificidad, curiosidad honesta, escena concreta y reciprocidad.

export const copywritingSkill = `SKILL · COPYWRITER SENIOR DE EMAIL B2B (Carolina)
Objetivo del primer correo: que el dueño lo abra, lo lea en 20 segundos y haga clic para ver su recorrido. NO vender, NO cotizar. Una sola acción.

1. ASUNTO (decide la apertura)
- Específico de ESE negocio: nombra un servicio, producto, lugar o paso real que aparezca en su web. Si podría enviarse a otra empresa, está mal.
- Genera curiosidad con un bucle abierto honesto: una pregunta, una escena o algo preparado para ellos. Nunca clickbait ni falsas respuestas ("Re:", "Fwd:").
- 3 a 9 palabras, máx. 60 caracteres. Sin mayúsculas sostenidas, sin signos de exclamación, sin emojis, sin "propuesta", "IA", "oferta", "gratis", "urgente", "oportunidad", "descuento".
- Debe parecer escrito por una persona para una persona, no por un boletín.

2. VISTA PREVIA (preheader)
- Completa o tensiona el asunto; nunca lo repite. 60-110 caracteres. Debe hacer que el asunto "valga la pena".

3. HOOK (titular dentro del correo)
- Visual: se puede imaginar en 1 segundo (un momento, un lugar, una persona, una hora).
- Habla del cliente de ellos y del momento de decisión, no de tecnología.

4. CUERPO
- Primera línea = prueba de que se investigó ESE negocio (dato concreto de su web). Nada de "espero que esté bien" ni presentaciones largas.
- Tú > yo: al menos el doble de referencias a ellos/sus clientes que a nosotros.
- Una observación con fuente, una pregunta/hipótesis condicional ("si…, podría…"), una escena. Frases de menos de 20 palabras. Nivel de lectura sencillo.
- Beneficio antes que función: qué vive su cliente y qué recibe su equipo, no "chatbot con LLM".
- Reciprocidad: el recorrido ya está preparado para ellos; mirarlo no les cuesta nada.
- Credibilidad sin inflar: experiencia real de Catalina (15+ años en ventas y operación). Nada de testimonios, cifras de resultados o clientes inventados.

5. ESCENA (la simulación que se ve en el correo)
- Canal que ellos usan (según señales detectadas: WhatsApp, web, Instagram, reservas). Hora concreta y verosímil.
- Mensaje del cliente: una pregunta real que haría un cliente de ESE negocio sobre un servicio que publican.
- Respuesta del agente: SOLO con datos públicos de su web (servicios, horarios, ubicación, forma de reservar). Si no hay dato, el agente ofrece pasar con el equipo. Nunca inventes precios, disponibilidad ni promociones.
- Traspaso: qué recibe su equipo (nombre, servicio de interés, fecha deseada, dudas).

6. CTA
- Uno solo, en primera persona o beneficio: "Ver el recorrido de [Empresa]". Debajo, alternativa suave: responder el correo.
- Reducir fricción: "son 2 minutos", "sin llamadas si no le interesa".

7. P. D.
- Es de lo más leído. Úsala para un segundo bucle de curiosidad ligado a la página (qué más verán) o un dato concreto adicional. Máx. 25 palabras.

8. PROHIBIDO
- Afirmar que pierden ventas, que no responden, que carecen de algo o que "necesitan" algo. La ausencia de una señal en su web no prueba nada: formula hipótesis.
- Miedo, escasez o urgencia inventadas, halagos vacíos ("increíble negocio"), jerga técnica, promesas de resultados, precios.

9. PÁGINA DE PROPUESTA (después del clic)
- Continúa exactamente la promesa del correo (misma escena, mismo lenguaje) y la amplía: tres momentos del cliente (antes, durante, después), qué cambiaría para el equipo, cómo se explora (fases con supervisión humana), quién está detrás, y CTA para hablar con Carolina.
- El precio no aparece. Se habla de inversión solo cuando el prospecto muestra interés y Carolina entendió su caso.`

export const critiqueRubric = `Evalúa el borrador como director creativo exigente de email B2B. Puntúa de 1 a 10:
- especificidad: ¿solo podría enviarse a este negocio?
- curiosidad: ¿el asunto + vista previa crean ganas reales de abrir sin engañar?
- claridad: ¿se entiende en 10 segundos qué se propone explorar?
- credibilidad: ¿todo está respaldado por la web o es hipótesis explícita? ¿cero inventos?
- deseo: ¿la escena hace que el dueño imagine a su cliente mejor atendido?
- cta: ¿una sola acción clara y de baja fricción?
Devuelve JSON {"scores":{...},"issues":["problema concreto"],"rewrite":true|false}. rewrite=true si alguna puntuación < 7 o hay cualquier dato inventado.`

// Chequeos deterministas que no dependen del modelo.
const bannedSubject = /propuesta|inteligencia artificial|\bIA\b|\bAI\b|oferta|gratis|urgente|oportunidad|descuento|ventas perdidas|!|^re:|^fwd:/i
export function lintCopy(p, company) {
  const issues = []
  const subject = String(p.subject || '')
  if (subject.length < 12 || subject.length > 62) issues.push('asunto fuera de 12-62 caracteres')
  if (bannedSubject.test(subject)) issues.push('asunto con palabra prohibida o formato engañoso')
  if (/\p{Extended_Pictographic}/u.test(subject)) issues.push('asunto con emoji')
  if (subject === subject.toUpperCase() && /[A-ZÁÉÍÓÚ]{4}/.test(subject)) issues.push('asunto en mayúsculas')
  const preview = String(p.preview || '')
  if (preview.length < 40 || preview.length > 140) issues.push('vista previa fuera de 40-140 caracteres')
  if (preview && subject && preview.toLowerCase().includes(subject.toLowerCase().slice(0, 20))) issues.push('la vista previa repite el asunto')
  if (/usd|\$\s?\d|precio|cuesta|inversión de/i.test([p.subject, p.preview, p.hook, p.subhook, p.ps, p.scene?.agent].join(' '))) issues.push('menciona precio')
  if (/pierde[ns]? (ventas|clientes)|no responden|no tienen|carecen|necesitan urgentemente/i.test([p.hook, p.subhook, p.observation, p.hypothesis].join(' '))) issues.push('afirma una carencia no verificada')
  if (!p.scene || !['customer', 'agent', 'handoff'].every(k => typeof p.scene[k] === 'string' && p.scene[k].trim().length >= 8)) issues.push('escena incompleta')
  if (!Array.isArray(p.moments) || p.moments.length !== 3) issues.push('faltan los tres momentos')
  const wc = v => String(v || '').split(/\s+/).filter(Boolean).length
  if (p.scene && (wc(p.scene.customer) > 30 || wc(p.scene.agent) > 55 || wc(p.scene.handoff) > 24)) issues.push('burbujas de la escena demasiado largas')
  if (/esto es lo que vería su cliente|qué sabe su equipo antes del primer|así respondería ava/i.test([p.subject, p.hook].join(' '))) issues.push('copia literal de un ejemplo de la guía')
  const words = [p.hook, p.subhook, p.observation, p.hypothesis, p.scene?.customer, p.scene?.agent, p.scene?.handoff, p.ps].join(' ').split(/\s+/).length
  if (words > 230) issues.push('correo demasiado largo')
  if (company && subject.toLowerCase() === String(company).toLowerCase()) issues.push('asunto genérico')
  return issues
}
