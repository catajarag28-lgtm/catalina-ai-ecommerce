#!/usr/bin/env node
/**
 * Carolina Business Prospecting Engine
 * Generates a clean B2B outreach queue by market and industry.
 * This script prepares proposals; sending must happen through the approved Gmail/cloud flow.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ROOT = process.env.CAROLINA_LOCAL_ROOT || path.join(os.homedir(), 'CarolinaLocalRunner')
const OUT = path.join(ROOT, 'data', 'business')
const LEGACY_OUT = path.join(ROOT, 'business-outreach')
const MARKETS = [
  { market:'USA', segment:'Shopify / DTC ecommerce', language:'en', pain:'manual support, abandoned follow-up, weak retention and disconnected order operations' },
  { market:'USA', segment:'medspas / aesthetic clinics', language:'en', pain:'lead follow-up, appointment conversion, client education and post-visit retention' },
  { market:'Spain', segment:'ecommerce and agencies', language:'en', pain:'manual operations, client reporting, acquisition workflows and automation delivery' },
  { market:'Mexico', segment:'WhatsApp-first businesses', language:'es', pain:'ventas por WhatsApp sin seguimiento, CRM débil y pérdida de prospectos' },
  { market:'Colombia / LatAm', segment:'beauty brands and service businesses', language:'es', pain:'ventas manuales, pauta sin trazabilidad y baja recompra' },
  { market:'Global', segment:'AI automation agencies', language:'en', pain:'need for client-ready systems, QA, CRM logic and commercial workflows' }
]
function esc(v){ return '"' + String(v ?? '').replaceAll('"','""').replaceAll('\n',' ').slice(0,4000) + '"' }
function proposal(x){
  if(x.language === 'es') return `Hola, soy Catalina Jaramillo. Diseño sistemas comerciales con IA para negocios que venden por WhatsApp, ecommerce, CRM, pauta y seguimiento. En negocios como ${x.segment}, normalmente el dinero se pierde por ${x.pain}. Puedo ayudarte a convertir eso en un flujo medible: diagnóstico, mapa del proceso, agente/CRM, seguimiento, métricas y optimización. Si tiene sentido, te puedo enviar una propuesta corta con una primera implementación práctica.`
  return `Hi, I’m Catalina Jaramillo. I design AI-powered commercial systems for ecommerce and service businesses: sales, CRM, WhatsApp, follow-up, content, paid media and operations. For ${x.segment}, the usual leakage is ${x.pain}. I can help turn that into a measurable workflow: diagnosis, process map, agent/CRM logic, follow-up, metrics and optimization. If useful, I can send a short proposal with a practical first implementation path.`
}
fs.mkdirSync(OUT, { recursive:true })
fs.mkdirSync(LEGACY_OUT, { recursive:true })
const rows = MARKETS.map((x,i)=>({
  id:`B2B-${String(i+1).padStart(3,'0')}`,
  ts:new Date().toISOString(),
  market:x.market,
  segment:x.segment,
  language:x.language,
  pain:x.pain,
  status:'PROPOSAL_DRAFTED',
  next_action:'Find 10 qualified businesses with public contact details, personalize, then send through approved Gmail flow.',
  proposal:proposal(x)
}))
const header=['id','ts','market','segment','language','pain','status','next_action','proposal']
const csv = [header.join(','), ...rows.map(r=>header.map(h=>esc(r[h])).join(','))].join('\n')+'\n'
const md = rows.map(r=>`## ${r.id} — ${r.market} — ${r.segment}\n\nStatus: ${r.status}\nNext: ${r.next_action}\n\n${r.proposal}\n`).join('\n---\n')
for (const dir of [OUT, LEGACY_OUT]) {
  fs.writeFileSync(path.join(dir,'business-prospects.csv'), csv)
  fs.writeFileSync(path.join(dir,'business-proposal-drafts.md'), md)
  fs.writeFileSync(path.join(dir,'business-prospects.json'), JSON.stringify({ts:new Date().toISOString(), prospects:rows}, null, 2))
}
console.log(JSON.stringify({type:'business_prospecting_completed', prospects:rows.length, out:OUT}))
