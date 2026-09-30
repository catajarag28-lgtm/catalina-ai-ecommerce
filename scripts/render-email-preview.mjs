import { writeFileSync } from 'node:fs'
import { brandedProposal } from '../worker/outreach.js'

const subject='¿Qué sabe su asesor antes de mostrar Brickell?'
const html=brandedProposal('AWA Realty',{
  subject,
  preview:'Una idea para que preferencias y dudas lleguen ordenadas al asesor.',
  offer:'ventas',
  hook:'Un comprador en Madrid. Una visita en Brickell. Un asesor con contexto.',
  observation:'AWA Realty presenta desarrollos de preconstrucción en Miami para inversionistas internacionales.',
  sourceUrl:'https://www.awa-realty.com/',
  hypothesis:'Si llegan consultas desde otras zonas horarias, podría ser útil conocer preferencias y preguntas clave antes de la conversación con el asesor. Habría que revisar el proceso actual.',
  example:'Una persona consulta por un desarrollo en Brickell. Un asistente basado en información aprobada recoge uso previsto, rango y plazo; el asesor recibe el contexto y decide el siguiente paso.',
  solution:'Validar un recorrido de respuesta y calificación con el equipo. La información de inmuebles, inventario y CRM se revisaría antes de definir cualquier integración.'
},'https://soycatalinajaramillo.com/#carolina')
const output=html.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>').replace('<body style=','<body data-preview="muestra-interna" style=').replace('<table role="presentation" width="100%"','<div style="background:#5d4224;color:white;text-align:center;padding:10px;font:12px Arial">MUESTRA INTERNA · DISEÑO DE CORREO · NO ENVIADA A LA EMPRESA</div><table role="presentation" width="100%"')
writeFileSync(new URL('../public/muestra-correo-carolina.html',import.meta.url),output)
