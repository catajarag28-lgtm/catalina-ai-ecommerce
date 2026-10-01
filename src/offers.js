// Catálogo comercial único: lo usan la página, /precios, el diagnóstico guiado y el Worker de Carolina.
// Cambiar un precio aquí lo cambia en todas partes.

export const launchBonus = 'Primeros 10 clientes del nuevo Revenue Agent Sprint: 30 días de optimización incluidos. Herramientas, consumo de IA y mensajería se pagan directamente por el cliente.'

export const catalog = [
  { id: 'valoracion', name: 'Valoración con Carolina', price: 'Sin costo', fromUSD: 0, monthlyFromUSD: null,
    gets: 'Diagnóstico preliminar del problema, oportunidad prioritaria y solución probable en pocos minutos.',
    excludes: 'Cotización final y diseño técnico detallado.' },
  { id: 'diagnostico', name: 'Diagnóstico estratégico con Catalina', price: 'USD 490', fromUSD: 490, monthlyFromUSD: null,
    gets: 'Sesión de revisión de procesos, herramientas, prioridades y plan de implementación escrito con alcance y presupuesto.',
    excludes: 'Construcción o desarrollo.', note: 'Se descuenta al 100 % si contratas una implementación dentro de 30 días.' },
  { id: 'esencial', name: 'Revenue Agent Sprint', price: 'USD 2.000', fromUSD: 2000, toUSD: 2000, monthlyFromUSD: 350,
    gets: 'Un canal principal (WhatsApp o web), agente entrenado con el negocio, captación y calificación, handoff humano, seguimiento inicial, una integración útil (agenda, CRM sencillo o Shopify según el caso), tablero básico y 30 días de optimización.',
    excludes: 'Integraciones complejas, múltiples canales, rediseño de procesos completos y campañas de pauta.' },
  { id: 'ventas', name: 'Sistema de ventas + agenda + CRM', price: 'USD 3.000 – 4.500', fromUSD: 3000, toUSD: 4500, monthlyFromUSD: 500,
    gets: 'Agente de ventas, calificación, agenda, CRM, seguimiento de leads, continuidad de formularios o Meta Ads y handoff al equipo con contexto.',
    excludes: 'Gestión de pauta, creación de contenido y desarrollos de software grandes.' },
  { id: 'ecommerce', name: 'E-commerce / Shopify + postventa', price: 'USD 4.500 – 7.500', fromUSD: 4500, toUSD: 7500, monthlyFromUSD: 500,
    gets: 'Ventas por chat, Shopify o tienda, estado de pedidos, postventa, recuperación de carritos, recompra, venta cruzada e integraciones acordadas.',
    excludes: 'Rediseño completo de tienda, logística física y pauta.' },
  { id: 'operaciones', name: 'Automatización operacional / workflows', price: 'USD 4.000 – 8.000', fromUSD: 4000, toUSD: 8000, monthlyFromUSD: 500,
    gets: 'Automatización de varios procesos entre CRM, formularios, WhatsApp, email, agenda, hojas, reportes o sistemas internos; alertas y trazabilidad.',
    excludes: 'Software empresarial completo desde cero o alcance multiárea sin diagnóstico.' },
  { id: 'software', name: 'Software personalizado', price: 'Desde USD 5.000', fromUSD: 5000, toUSD: null, monthlyFromUSD: null,
    gets: 'Diseño funcional y construcción de software interno o de cara al cliente, integraciones y automatizaciones según alcance validado.',
    excludes: 'Precio cerrado sin diagnóstico; infraestructura y licencias de terceros.' },
  { id: 'multiagente', name: 'Sistema multiagente / AI Business OS', price: 'USD 8.000 – 15.000+', fromUSD: 8000, toUSD: 15000, monthlyFromUSD: null,
    gets: 'Ventas, atención, postventa y operación coordinadas, con conocimiento compartido, permisos, integraciones, supervisión humana y métricas.',
    excludes: 'Alcance final sin diagnóstico previo.' },
  { id: 'acompanamiento', name: 'Optimización y crecimiento continuo', price: 'USD 750 – 1.500+ / mes', fromUSD: 750, toUSD: 1500, monthlyFromUSD: 750,
    gets: 'Revisión de métricas, oportunidades, funnels, continuidad de leads, Meta Ads desde la perspectiva comercial, automatizaciones y mejoras priorizadas.',
    excludes: 'Media spend, producción creativa intensiva y nuevos desarrollos grandes.' },
]

export const maintenance = {
  esencial: 350,
  avanzado: 500,
  includes: 'Monitoreo, corrección de errores y ajustes menores de contenido, reglas o prompts dentro del alcance contratado.',
  excludes: 'Nuevas funciones o plataformas, consumo de IA, mensajes de WhatsApp (Meta), licencias e infraestructura: los paga el cliente directamente, sin recargo.',
}

export const offers = [
  { id: 'ventas', tag: 'VENTAS Y AGENDA', pain: 'Tus leads llegan, pero responder, calificar y hacer seguimiento depende demasiado del equipo.',
    delivers: ['Atiende y califica 24/7', 'Agenda y registra contexto', 'Retoma leads que no avanzaron', 'Conecta una herramienta crítica desde el Sprint'], from: 'Revenue Agent Sprint USD 2.000 · sistema con agenda y CRM USD 3.000–4.500' },
  { id: 'atencion', tag: 'ATENCIÓN Y POSTVENTA', pain: 'Tu equipo repite respuestas y pierde tiempo moviendo información entre conversaciones y sistemas.',
    delivers: ['Responde con información aprobada', 'Escala con contexto', 'Automatiza seguimiento', 'Conecta soporte con operación'], from: 'Revenue Agent Sprint USD 2.000 · automatizaciones desde USD 4.000' },
  { id: 'operacion', tag: 'E-COMMERCE Y OPERACIÓN', pain: 'Shopify, WhatsApp, CRM, hojas y reportes no trabajan como un solo sistema.',
    delivers: ['Conecta tienda, CRM, WhatsApp y correo', 'Recupera carritos y activa recompra', 'Automatiza reportes y alertas', 'Orquesta procesos con supervisión'], from: 'E-commerce desde USD 4.500 · automatización operacional desde USD 4.000' },
]

export const diagnosisQuestions = [
  { key: 'business', text: '¿Qué tipo de negocio tienes?', options: ['Salud, estética o bienestar', 'Servicios profesionales', 'Tienda online / e-commerce', 'Negocio local (restaurante, turismo…)', 'Otro'] },
  { key: 'goal', text: '¿Qué quieres mejorar primero?', options: ['Responder y vender más', 'Agendar citas sin perseguir a nadie', 'Atención y postventa', 'Dejar de copiar y pegar entre herramientas', 'Todo: quiero un sistema completo'] },
  { key: 'tools', text: '¿Qué usas hoy? Elige todas las que apliquen.', multi: true, options: ['WhatsApp', 'Instagram / Facebook', 'Web o formulario', 'Shopify u otra tienda', 'CRM', 'Agenda (Calendly, Google)', 'Excel o nada'] },
  { key: 'volume', text: '¿Cuántas consultas o pedidos recibes al mes?', options: ['Menos de 100', '100 a 500', '500 a 2.000', 'Más de 2.000'] },
  { key: 'timing', text: '¿Cuándo te gustaría empezar?', options: ['Este mes', 'En 1 a 3 meses', 'Estoy explorando'] },
]

const byId = id => catalog.find(item => item.id === id)
const round = n => Math.round(n / 100) * 100
const usd = n => 'USD ' + n.toLocaleString('es-CO')

export function recommend(a) {
  const tools = a.tools || []
  const ecommerce = a.business === 'Tienda online / e-commerce' || tools.includes('Shopify u otra tienda')
  const connected = tools.includes('CRM') || tools.includes('Agenda (Calendly, Google)')
  let id = 'esencial', first
  if (a.goal === 'Todo: quiero un sistema completo') {
    id = 'multiagente'
    first = 'Empezaría por un diagnóstico para priorizar qué área debe producir el primer retorno antes de conectar toda la operación.'
  } else if (a.goal === 'Agendar citas sin perseguir a nadie') {
    id = 'ventas'
    first = 'Empezaría con un sistema que responda, califique, registre el lead y deje la cita lista o reservada según su proceso.'
  } else if (a.goal === 'Dejar de copiar y pegar entre herramientas') {
    id = ecommerce ? 'ecommerce' : 'operaciones'
    first = ecommerce ? 'Empezaría conectando tienda, conversaciones y postventa.' : 'Empezaría automatizando el flujo que hoy mueve más información manual entre herramientas.'
  } else if (a.goal === 'Atención y postventa') {
    id = ecommerce ? 'ecommerce' : 'esencial'
    first = ecommerce ? 'Empezaría con atención y postventa conectadas a la tienda.' : 'Empezaría con un Revenue Agent Sprint para resolver atención, captura de contexto y handoff.'
  } else {
    id = connected ? 'ventas' : 'esencial'
    first = connected ? 'Empezaría aprovechando las herramientas que ya tienes y conectando la primera atención con ventas.' : 'Empezaría con el Revenue Agent Sprint: una intervención acotada que podamos poner a producir y medir.'
  }

  const item = byId(id)
  let low = item.fromUSD, high = item.toUSD || item.fromUSD
  const channels = tools.filter(t => ['WhatsApp', 'Instagram / Facebook', 'Web o formulario'].includes(t)).length
  if (channels >= 2 && !['esencial', 'multiagente'].includes(id)) high = round(high * 1.15)
  if (a.volume === 'Más de 2.000' && !['esencial', 'multiagente'].includes(id)) { low = round(low * 1.1); high = round(high * 1.2) }
  const diagnosisFirst = id === 'multiagente' || a.timing === 'Estoy explorando'
  return {
    id, name: item.name, first, includes: item.gets,
    range: low === high ? usd(low) : `${usd(low)} – ${usd(high)}`, low, high,
    monthly: item.monthlyFromUSD ? `desde ${usd(item.monthlyFromUSD)}/mes` : 'según alcance',
    diagnosisFirst,
    next: diagnosisFirst ? 'El diagnóstico estratégico (USD 490) deja un plan escrito y se descuenta si contratas implementación.' : 'El siguiente paso es una conversación de 30 minutos con Catalina para validar herramientas, alcance y prioridad.',
  }
}
