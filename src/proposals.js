// Propuestas por sector: alimentan la página /propuesta/<sector> y el correo con marca (worker/emailTemplates.js).
// Reglas de Catalina: profesional, certero, sin promesas de resultados ni cifras inventadas. Precios solo del catálogo.

export const proposals = [
  {
    slug: 'spa', sector: 'Spa, estética y med spa',
    hook: '¿Quién contesta tu WhatsApp a las 10 de la noche?',
    pain: 'Tus clientas escriben cuando tienen tiempo: de noche, en fin de semana, entre reuniones. Preguntan precios, disponibilidad y si el tratamiento es para ellas. Si nadie responde en minutos, reservan con otro spa.',
    scene: [['21:47', 'Una clienta pregunta por un facial y si hay cita el sábado.'], ['21:47', 'El agente responde con el tratamiento indicado, el precio y dos horarios disponibles.'], ['21:49', 'La cita queda reservada y le llega la confirmación con las indicaciones previas.'], ['Viernes', 'Recibe el recordatorio. Si cancela, el agente ofrece el cupo a la lista de espera.']],
    agent: ['Responde al instante por WhatsApp e Instagram, las 24 horas, con tu tono de marca', 'Recomienda el tratamiento adecuado y resuelve dudas frecuentes', 'Agenda en tu calendario, confirma y envía recordatorios', 'Hace seguimiento después del tratamiento y activa la siguiente visita', 'Pasa a tu equipo, con el contexto, lo que requiere una persona'],
    measure: ['Tiempo de primera respuesta', 'Consultas que terminan en cita', 'Inasistencias y cancelaciones', 'Clientas que vuelven'],
    tier: 'ventas',
  },
  {
    slug: 'odontologia', sector: 'Odontología y clínicas',
    hook: '¿Cuántos presupuestos se quedan esperando una llamada?',
    pain: 'Un paciente pide valoración, recibe un plan de tratamiento y luego nadie lo vuelve a llamar. Las llamadas se pierden en horas pico y la recepción no alcanza a hacer seguimiento a cada presupuesto.',
    scene: [['08:12', 'Un paciente escribe por dolor y pide cita urgente.'], ['08:13', 'El agente identifica la urgencia, ofrece el primer cupo y avisa a recepción.'], ['Día 3', 'A quien recibió un presupuesto y no respondió, el agente le escribe con sus dudas resueltas y opciones de pago.'], ['Día 180', 'Recordatorio de control y limpieza, con agenda directa.']],
    agent: ['Atiende WhatsApp y web con información real de tratamientos', 'Prioriza urgencias y agenda valoraciones', 'Hace seguimiento a presupuestos pendientes', 'Confirma citas y reduce inasistencias', 'Activa controles periódicos de pacientes'],
    measure: ['Presupuestos aceptados', 'Inasistencias', 'Tiempo de respuesta', 'Pacientes que regresan a control'],
    tier: 'ventas',
  },
  {
    slug: 'ecommerce', sector: 'Tiendas online y e-commerce',
    hook: '¿Cuántas ventas se quedan en un "déjame pensarlo"?',
    pain: 'Recibes visitas y mensajes, pero muchas conversaciones mueren en una objeción, un carrito abandonado o una pregunta sobre el envío. Y después de la compra, las preguntas de "¿dónde está mi pedido?" consumen al equipo.',
    scene: [['14:05', 'Una clienta pregunta si el producto sirve para su caso y cuánto tarda el envío.'], ['14:06', 'El agente recomienda la opción adecuada, resuelve la objeción y comparte el enlace de compra.'], ['Día 1', 'Si no compró, recibe un seguimiento personal sobre la duda que tenía.'], ['Día 30', 'Cuando el producto se está terminando, el agente le propone la recompra.']],
    agent: ['Asesora y vende por chat con el catálogo real', 'Recupera carritos y conversaciones abandonadas', 'Informa estado de pedidos, cambios y devoluciones', 'Activa venta cruzada y recompra en el momento adecuado', 'Escala reclamos a una persona con todo el historial'],
    measure: ['Conversaciones que terminan en compra', 'Carritos recuperados', 'Tickets de soporte por pedido', 'Tasa de recompra'],
    tier: 'ecommerce',
  },
  {
    slug: 'inmobiliaria', sector: 'Inmobiliarias y bienes raíces',
    hook: '¿Tus asesores atienden curiosos o compradores?',
    pain: 'Los portales y la pauta traen muchos contactos, pero pocos están listos para comprar o arrendar. Los asesores pierden horas filtrando y los interesados reales esperan demasiado por una respuesta.',
    scene: [['19:30', 'Un contacto pregunta por un apartamento publicado.'], ['19:31', 'El agente responde con los detalles y pregunta presupuesto, zona y tiempos.'], ['19:34', 'Si califica, agenda la visita en la agenda del asesor asignado.'], ['Semana 2', 'A quien no calificó todavía, le envía opciones nuevas que coinciden con lo que busca.']],
    agent: ['Responde al instante los contactos de portales, web y redes', 'Califica presupuesto, zona, tiempos y forma de pago', 'Agenda visitas con el asesor correcto', 'Nutre a los interesados que aún no están listos', 'Registra todo en tu CRM'],
    measure: ['Tiempo de respuesta', 'Contactos calificados', 'Visitas agendadas', 'Cierres por asesor'],
    tier: 'ventas',
  },
  {
    slug: 'servicios', sector: 'Servicios profesionales y consultorías',
    hook: '¿Tu agenda depende de que tú contestes cada mensaje?',
    pain: 'Los potenciales clientes llegan por recomendación, redes o tu web, pero el primer contacto, las preguntas repetidas y la coordinación de reuniones dependen de ti. Cuando estás atendiendo clientes, los nuevos esperan.',
    scene: [['07:50', 'Un potencial cliente escribe desde tu web con una consulta.'], ['07:51', 'El agente entiende su caso, explica cómo trabajas y los rangos de inversión.'], ['07:55', 'Si hay encaje, agenda una llamada contigo y te envía el resumen del caso.'], ['Antes de la llamada', 'Tú llegas sabiendo quién es, qué necesita y cuánto está dispuesto a invertir.']],
    agent: ['Atiende el primer contacto con criterio y en tu tono', 'Filtra por encaje y presupuesto antes de tu agenda', 'Agenda reuniones y envía recordatorios', 'Te entrega un resumen de cada caso', 'Hace seguimiento a propuestas enviadas'],
    measure: ['Reuniones calificadas por semana', 'Tiempo que recuperas', 'Propuestas aceptadas', 'Tiempo de respuesta'],
    tier: 'esencial',
  },
]

export const findProposal = slug => proposals.find(p => p.slug === slug)

// Fases estándar del plan de trabajo (iguales al proceso de la página principal).
export const proposalPlan = [
  ['Semana 1', 'Diagnóstico', 'Revisamos tu operación, tus canales y tus herramientas. Definimos por escrito qué hará el agente y cómo mediremos.'],
  ['Semanas 2–3', 'Construcción', 'Entrenamos el agente con tu información real, tu tono y tus reglas. Lo probamos con casos de tu negocio.'],
  ['Semana 4', 'Lanzamiento', 'Lo activamos en tus canales, capacitamos a tu equipo y lo ajustamos con conversaciones reales durante 30 días.'],
]
