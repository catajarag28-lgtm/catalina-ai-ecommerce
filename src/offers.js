// Catálogo comercial único: lo usan la página, /precios, el diagnóstico guiado y el Worker de Carolina.
// Cambiar un precio aquí lo cambia en todas partes.

export const CONTACT = {
  // Número en formato internacional sin "+" ni espacios, p. ej. '573001234567'. Vacío = los botones usan email.
  whatsapp: '',
  email: 'hola@soycatalinajaramillo.com',
  bookingUrl: '',
}

export const launchBonus = 'Primeros 10 clientes: primer mes de mantenimiento incluido y diagnóstico sin costo al contratar la implementación.'

export const catalog = [
  { id: 'valoracion', name: 'Valoración con Carolina', price: 'Sin costo', fromUSD: 0, monthlyFromUSD: null,
    gets: 'Identificación del problema, solución recomendada y rango de inversión orientativo en unos 3 minutos.',
    excludes: 'Cotización final (la confirma Catalina).' },
  { id: 'diagnostico', name: 'Diagnóstico estratégico con Catalina', price: 'USD 490', fromUSD: 490, monthlyFromUSD: null,
    gets: 'Sesión de revisión de procesos y herramientas, prioridades y plan de implementación escrito con alcance y presupuesto.',
    excludes: 'Construcción del agente.', note: 'Se descuenta al 100 % si contratas la implementación dentro de 30 días.' },
  { id: 'esencial', name: 'Agente esencial', price: 'Desde USD 2.200', fromUSD: 2200, toUSD: 3200, monthlyFromUSD: 290,
    gets: 'Un canal (WhatsApp, web o Instagram), un objetivo definido, conocimiento de tu negocio, tono de tu marca, captura de datos y paso a una persona.',
    excludes: 'Integraciones con CRM, agenda o tienda.' },
  { id: 'ventas', name: 'Agente de ventas con agenda y CRM', price: 'Desde USD 3.800', fromUSD: 3800, toUSD: 5500, monthlyFromUSD: 490,
    gets: 'Todo lo del agente esencial + calificación de prospectos, reserva de citas, registro en tu CRM y seguimiento a quien no respondió.',
    excludes: 'Campañas de pauta y creación de contenido.' },
  { id: 'ecommerce', name: 'Sistema de e-commerce y postventa', price: 'Desde USD 5.500', fromUSD: 5500, toUSD: 8000, monthlyFromUSD: 490,
    gets: 'Ventas por chat, estado de pedidos, cambios y devoluciones, recuperación de carritos y recompra, conectado con tu tienda.',
    excludes: 'Rediseño de la tienda y logística física.' },
  { id: 'multiagente', name: 'Sistema con varios agentes', price: 'Desde USD 9.000', fromUSD: 9000, toUSD: 15000, monthlyFromUSD: null,
    gets: 'Ventas, atención y operación coordinadas, con permisos, información compartida y supervisión humana.',
    excludes: 'Alcance cerrado sin diagnóstico previo.' },
  { id: 'acompanamiento', name: 'Acompañamiento estratégico', price: 'USD 1.200 – 2.500 / mes', fromUSD: 1200, monthlyFromUSD: 1200,
    gets: 'Revisión de métricas, prioridades y mejoras continuas con dedicación acordada.',
    excludes: 'Nuevos desarrollos grandes se cotizan aparte.' },
]

export const maintenance = {
  esencial: 290,
  avanzado: 490,
  includes: 'Monitoreo, corrección de errores y hasta 2 ajustes de contenido o reglas al mes.',
  excludes: 'Nuevas funciones o plataformas, consumo de IA, mensajes de WhatsApp (Meta) y licencias: los paga el cliente directamente, sin recargo.',
}

export const offers = [
  { id: 'ventas', tag: 'VENTAS Y AGENDA', pain: 'Te escriben, nadie responde a tiempo y el cliente se enfría.',
    delivers: ['Responde en segundos, 24/7', 'Califica y agenda la cita', 'Retoma a quien no contestó', 'Te pasa el caso cuando hace falta'], from: 'Desde USD 2.200' },
  { id: 'atencion', tag: 'ATENCIÓN Y POSTVENTA', pain: 'Las mismas preguntas todo el día y un equipo que no da abasto.',
    delivers: ['Responde con tu información real', 'Sigue pedidos y solicitudes', 'Gestiona cambios y devoluciones', 'Escala a una persona con el contexto'], from: 'Desde USD 2.200' },
  { id: 'operacion', tag: 'E-COMMERCE Y OPERACIÓN', pain: 'Tu tienda, WhatsApp y hojas de cálculo no se hablan entre sí.',
    delivers: ['Conecta tienda, CRM, WhatsApp y correo', 'Recupera carritos y activa recompra', 'Reportes sin copiar y pegar', 'Todo con reglas y supervisión'], from: 'Desde USD 5.500' },
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

// Recomendación determinística: nunca inventa precios fuera del catálogo.
export function recommend(a) {
  const tools = a.tools || []
  const ecommerce = a.business === 'Tienda online / e-commerce' || tools.includes('Shopify u otra tienda')
  const connected = tools.includes('CRM') || tools.includes('Agenda (Calendly, Google)')
  let id = 'esencial', first
  if (a.goal === 'Todo: quiero un sistema completo') { id = 'multiagente'; first = 'Empezaría por un diagnóstico para priorizar: un sistema completo funciona mejor cuando se construye por etapas, empezando por donde hoy se pierde más dinero.' }
  else if (a.goal === 'Agendar citas sin perseguir a nadie') { id = 'ventas'; first = 'Empezaría con un agente que responda, califique y deje la cita reservada en tu agenda, con recordatorio.' }
  else if (a.goal === 'Dejar de copiar y pegar entre herramientas') { id = ecommerce ? 'ecommerce' : 'ventas'; first = 'Empezaría conectando tus herramientas para que la información pase sola del mensaje al registro y al reporte.' }
  else if (a.goal === 'Atención y postventa') { id = ecommerce ? 'ecommerce' : 'esencial'; first = ecommerce ? 'Empezaría con atención y postventa conectadas a tu tienda: estado del pedido, cambios y recompra.' : 'Empezaría con un agente que responda con tu información real y pase a tu equipo lo que requiere una persona.' }
  else { id = connected || ecommerce ? (ecommerce ? 'ecommerce' : 'ventas') : 'esencial'; first = 'Empezaría con un agente de ventas que responda al instante, haga las preguntas correctas y retome a quien no contestó.' }

  const item = byId(id)
  let low = item.fromUSD, high = item.toUSD
  const channels = tools.filter(t => ['WhatsApp', 'Instagram / Facebook', 'Web o formulario'].includes(t)).length
  if (channels >= 2 && id !== 'multiagente') high = round(high * 1.15)
  if (a.volume === 'Más de 2.000') { low = round(low * 1.1); high = round(high * 1.2) }
  const diagnosisFirst = id === 'multiagente' || a.timing === 'Estoy explorando'
  return {
    id, name: item.name, first, includes: item.gets,
    range: `${usd(low)} – ${usd(high)}`, low, high,
    monthly: item.monthlyFromUSD ? `desde ${usd(item.monthlyFromUSD)}/mes` : 'según alcance',
    diagnosisFirst,
    next: diagnosisFirst ? `Si prefieres ir paso a paso, el diagnóstico estratégico (USD 490) te deja un plan escrito y se descuenta si contratas.` : 'El siguiente paso es una conversación de 30 minutos con Catalina para validar herramientas y alcance.',
  }
}

export function summaryText(a, r) {
  return [
    'Hola Catalina, hice el diagnóstico con Carolina en tu página.',
    `Negocio: ${a.business}`,
    `Quiero mejorar: ${a.goal}`,
    `Uso hoy: ${(a.tools || []).join(', ') || 'no indiqué'}`,
    `Volumen: ${a.volume} al mes`,
    `Empezar: ${a.timing}`,
    a.note ? `Detalle: ${a.note}` : null,
    `Recomendación: ${r.name} (${r.range})`,
    'Me gustaría agendar una conversación.',
  ].filter(Boolean).join('\n')
}

export function contactLink(text, subject = 'Quiero hablar contigo') {
  if (CONTACT.whatsapp) return { href: `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`, channel: 'WhatsApp' }
  return { href: `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, channel: 'correo' }
}
