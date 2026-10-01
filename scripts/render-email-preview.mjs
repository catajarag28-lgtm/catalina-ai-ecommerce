import { writeFileSync } from 'node:fs'
import { brandedProposal } from '../worker/proposals/outreach.js'
import { renderProposalPage } from '../worker/proposals/proposalPage.js'

// Muestra pública con un negocio FICTICIO (no se usa ningún prospecto real).
const company = 'Lumière Med Spa (ejemplo)'
const p = {
  offer: 'esencial', format: 'visual',
  subject: 'Un agente de IA para atender y agendar por WhatsApp',
  preview: 'Catalina propone un agente de IA para responder consultas y preparar reservas con información aprobada.',
  hook: 'Le propongo un agente de IA para atender y agendar por WhatsApp',
  subhook: 'Una propuesta concreta para Lumière Med Spa, basada en sus servicios publicados.',
  offerPitch: 'Diseñar e implementar un agente de IA para WhatsApp que responda consultas sobre servicios publicados, recoja los datos necesarios para reservar y entregue cada caso a su equipo.',
  observation: 'Su web muestra HydraFacial y depilación láser en Brickell, con reservas en línea y atención en español.',
  sourceUrl: 'https://ejemplo.com/servicios',
  hypothesis: 'Si parte de las consultas llega por WhatsApp fuera de horario, una primera respuesta con su información podría dejar la cita lista para confirmar el lunes.',
  scene: { channel: 'WhatsApp', time: 'Domingo · 9:40 p. m.', customer: 'Hola, me caso en tres semanas. ¿Tienen HydraFacial el sábado en la mañana?', agent: 'Sí, ofrecemos HydraFacial en Brickell y abrimos los sábados de 9 a 2. Puede reservar aquí o le paso con el equipo para confirmar.', handoff: 'nombre, fecha de la boda, servicio y horario preferido' },
  moments: [{ title: 'Antes', text: 'La consulta llega de noche o el fin de semana, cuando nadie está en recepción.' }, { title: 'Durante', text: 'Recibe una respuesta con su información aprobada y el enlace para reservar.' }, { title: 'Después', text: 'Su equipo empieza el lunes con la solicitud ordenada, lista para confirmar.' }],
  solution: 'Probaríamos un agente para WhatsApp entrenado solo con su información aprobada, con su equipo revisando las respuestas antes de ampliar.',
  ps: 'En el recorrido verá qué recibe su recepción el lunes a primera hora.',
}
const banner = '<div style="background:#5d4224;color:#fff;text-align:center;padding:10px;font:12px Arial">MUESTRA · NEGOCIO FICTICIO · ASÍ SE VE EL CORREO DE CAROLINA</div>'
const mark = html => html.replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>').replace(/(<body[^>]*>)/, '$1' + banner)
writeFileSync(new URL('../public/muestra-correo-carolina.html', import.meta.url), mark(brandedProposal(company, p, 'https://soycatalinajaramillo.com/muestra-propuesta-carolina.html')))
writeFileSync(new URL('../public/muestra-correo-carta.html', import.meta.url), mark(brandedProposal(company, { ...p, format: 'carta', subject: 'hydrafacial antes de una boda' }, 'https://soycatalinajaramillo.com/muestra-propuesta-carolina.html')))
writeFileSync(new URL('../public/muestra-propuesta-carolina.html', import.meta.url), mark(renderProposalPage({ id: 'muestra', company, proposal: p, subject: p.subject })))
