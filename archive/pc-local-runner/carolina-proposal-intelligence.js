#!/usr/bin/env node
/**
 * Carolina Proposal Intelligence
 *
 * Purpose:
 * - Make Carolina sound like a strategic commercial operator, not a generic AI bot.
 * - Personalize proposals by business type, visible opportunity, likely leakage and offer ladder.
 * - Create learning records so hooks/angles can be improved from replies, calls and wins.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ROOT = process.env.CAROLINA_LOCAL_ROOT || path.join(os.homedir(), 'CarolinaLocalRunner')
const DATA = path.join(ROOT, 'data')
const INTEL = path.join(DATA, 'intelligence')
const LEARNING_FILE = path.join(INTEL, 'proposal-learning-ledger.jsonl')
const PORTFOLIO_URL = process.env.CAROLINA_PORTFOLIO_URL || 'https://soycatalinajaramillo.com'

export const OFFER_LADDER = [
  { id:'quick-win', min:500, max:900, label:'AI Automation Quick Win', fit:'simple automation, audit, CRM cleanup, proposal automation, lead routing' },
  { id:'sales-agent', min:900, max:1800, label:'WhatsApp / CRM Sales Agent Starter', fit:'late replies, lost leads, weak follow-up, WhatsApp-heavy sales' },
  { id:'ecommerce-os', min:1800, max:4000, label:'Ecommerce Growth Operations System', fit:'Shopify/DTC, order confirmation, post-sale, retention, Meta Ads learning loop' },
  { id:'multi-agent-os', min:4000, max:10000, label:'Multi-Agent Commercial OS', fit:'several agents for sales, acquisition, content, CX, operations and executive reporting' },
  { id:'retainer', min:1000, max:4000, label:'Monthly Growth Automation Retainer', fit:'ongoing optimization, monitoring, CRM, reporting and experiments' }
]

export const INDUSTRY_PLAYBOOKS = {
  medspa: {
    labels:['medspa','clinic','aesthetic','esthetic','dermatology','medical spa','clínica estética','medicina estética'],
    leakage:['leads ask about treatments but do not book','slow follow-up after Instagram/ads','no post-visit retention sequence','no reactivation for past clients'],
    angle:'turn treatment interest into booked appointments and repeat visits',
    proof:'I have operated sales, customer experience, follow-up and beauty/ecommerce journeys, so I understand both the commercial and customer-trust side.'
  },
  real_estate: {
    labels:['real estate','realtor','inmobiliaria','broker','property','properties'],
    leakage:['leads ask once and disappear','manual qualification wastes time','no automated follow-up by budget/location','no CRM stage discipline'],
    angle:'qualify buyers/sellers faster and keep follow-up alive until a showing or call',
    proof:'My strength is turning conversations into structured pipelines with clear next actions.'
  },
  ecommerce: {
    labels:['shopify','ecommerce','e-commerce','dtc','woocommerce','brand','store','tienda online'],
    leakage:['abandoned carts and WhatsApp chats are not followed up','orders/support/content/ads are disconnected','Meta Ads learnings do not become CRM or content actions','post-sale retention is weak'],
    angle:'connect acquisition, WhatsApp, CRM, post-sale and reporting into one commercial system',
    proof:'I have run ecommerce, Shopify, Meta Ads, COD/order workflows, customer support and retention from the operator seat.'
  },
  agency: {
    labels:['agency','agencia','studio','consultancy','consultora','marketing agency','automation agency'],
    leakage:['client delivery depends on manual work','proposals and follow-up are inconsistent','reporting takes too long','no reusable client-ready automation system'],
    angle:'create reusable client delivery systems and proposal/follow-up workflows',
    proof:'I can bridge strategy, client psychology, automation logic and execution.'
  },
  whatsapp_business: {
    labels:['whatsapp','ventas por whatsapp','chat','dm','instagram dm','messenger'],
    leakage:['messages are answered late','leads are not qualified','no structured follow-up','hot conversations die without a next step'],
    angle:'turn WhatsApp/DM conversations into a measurable sales pipeline',
    proof:'I have built WhatsApp sales, confirmation, post-sale and CRM logic for real commerce operations.'
  },
  local_service: {
    labels:['service business','servicios','academy','academia','salon','spa','clinic','repair','local business'],
    leakage:['inquiries do not become scheduled calls','manual scheduling and follow-up wastes owner time','no reactivation or referral sequence'],
    angle:'capture inquiries, qualify them and move them to booking/payment/follow-up',
    proof:'I design practical systems for real businesses, not just demos.'
  }
}

export function detectIndustry(input={}){
  const text = `${input.title||''} ${input.company||''} ${input.segment||''} ${input.description||''} ${input.url||''}`.toLowerCase()
  for(const [key, playbook] of Object.entries(INDUSTRY_PLAYBOOKS)){
    if(playbook.labels.some(label=>text.includes(label.toLowerCase()))) return key
  }
  return 'ecommerce'
}

export function selectOffer(input={}){
  const text = `${input.title||''} ${input.description||''} ${input.segment||''}`.toLowerCase()
  if(/multi.agent|operating system|os|department|scale|multiple|end.to.end|crm.*ads|sales.*content.*operations/i.test(text)) return OFFER_LADDER[3]
  if(/shopify|ecommerce|order|post.sale|retention|meta ads|content|creative|growth operations/i.test(text)) return OFFER_LADDER[2]
  if(/whatsapp|crm|lead|follow.up|qualification|sales agent|chatbot|dm/i.test(text)) return OFFER_LADDER[1]
  if(/ongoing|retainer|monthly|maintenance|optimi[sz]ation|monitoring/i.test(text)) return OFFER_LADDER[4]
  return OFFER_LADDER[0]
}

export function antiGenericChecklist(proposal){
  const text = String(proposal || '')
  const flags = []
  if(text.length < 650) flags.push('too_short')
  if(!/because|porque|veo|noticed|detect|pérdida|leakage|oportunidad/i.test(text)) flags.push('no_observation')
  if(!/first|primero|empezaría|start|diagnóstico|diagnosis/i.test(text)) flags.push('no_first_step')
  if(!/metric|métrica|pipeline|seguimiento|follow-up|tracking/i.test(text)) flags.push('no_measurement')
  if(!/soycatalinajaramillo\.com/i.test(text)) flags.push('missing_portfolio_link')
  if(/I can help with this|Puedo ayudarte con esta necesidad/i.test(text)) flags.push('generic_opening')
  return { ok: flags.length === 0, flags }
}

export function createWinningProposal(input={}){
  const lang = input.language === 'es' ? 'es' : 'en'
  const industryKey = input.industry || detectIndustry(input)
  const playbook = INDUSTRY_PLAYBOOKS[industryKey] || INDUSTRY_PLAYBOOKS.ecommerce
  const offer = selectOffer(input)
  const businessName = input.company || input.business || input.title || (lang === 'es' ? 'tu negocio' : 'your business')
  const visibleSignal = input.visibleSignal || input.observation || input.title || input.segment || ''
  const leakage = input.leakage || playbook.leakage[0]

  if(lang === 'es'){
    const proposal = `Hola, soy Catalina Jaramillo. Revisando ${businessName}, veo una oportunidad concreta: ${visibleSignal || playbook.angle}. En negocios de este tipo normalmente se pierde dinero cuando ${leakage}; no por falta de interés, sino porque la conversación, el seguimiento y la medición no están conectados.\n\nLo que propondría no es “poner un bot”, sino construir un sistema comercial simple y medible: 1) mapear dónde se pierden prospectos, 2) ordenar las etapas del CRM/conversación, 3) crear un agente o flujo de seguimiento que responda con contexto, 4) dejar métricas de oportunidades, citas y ventas, y 5) optimizar los mensajes según lo que realmente responda la gente.\n\nPara empezar, lo más sensato sería un ${offer.label} entre USD ${offer.min}-${offer.max}, con una primera versión útil y clara antes de crecer a algo más grande. Aquí puedes ver mi perfil y enfoque: ${PORTFOLIO_URL}.\n\nSi te parece, te puedo enviar una propuesta corta con el flujo recomendado y una primera implementación práctica.`
    return { proposal, industry:industryKey, offer, qa:antiGenericChecklist(proposal) }
  }

  const proposal = `Hi, I’m Catalina Jaramillo. Looking at ${businessName}, I see a concrete opportunity: ${visibleSignal || playbook.angle}. In businesses like this, revenue is often lost when ${leakage}; not because demand is missing, but because conversations, follow-up and tracking are not connected.\n\nI would not approach this as “adding a bot.” I would build a simple commercial system: 1) map where leads or customers are leaking, 2) define the CRM/conversation stages, 3) create an AI-assisted follow-up or sales workflow with context, 4) track opportunities, calls and revenue, and 5) improve the messaging based on real replies.\n\nA practical starting point would be a ${offer.label} in the USD ${offer.min}-${offer.max} range, with a useful first version before expanding into a larger system. You can see my profile and approach here: ${PORTFOLIO_URL}.\n\nIf useful, I can send a short proposal with the recommended workflow and a first implementation path.`
  return { proposal, industry:industryKey, offer, qa:antiGenericChecklist(proposal) }
}

export function recordLearning(event={}){
  fs.mkdirSync(INTEL,{recursive:true})
  fs.appendFileSync(LEARNING_FILE, JSON.stringify({ts:new Date().toISOString(), ...event})+'\n')
}

if(import.meta.url === `file://${process.argv[1]}`){
  fs.mkdirSync(INTEL,{recursive:true})
  const sample = createWinningProposal({language:'es', company:'negocio ejemplo', segment:'ventas por WhatsApp', visibleSignal:'tienen demanda por mensajes pero no se ve un sistema de seguimiento'})
  fs.writeFileSync(path.join(INTEL,'proposal-intelligence-sample.json'), JSON.stringify(sample,null,2))
  console.log(JSON.stringify({type:'proposal_intelligence_ready', sample:path.join(INTEL,'proposal-intelligence-sample.json')}))
}
