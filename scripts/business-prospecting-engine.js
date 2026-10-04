#!/usr/bin/env node
/**
 * Carolina Business Prospecting Engine
 *
 * Generates a B2B outreach queue by market and industry.
 * Proposals are created through the Proposal Intelligence layer so they are specific,
 * commercial, measurable and not generic AI-sounding templates.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createWinningProposal } from './carolina-proposal-intelligence.js'

const ROOT = process.env.CAROLINA_LOCAL_ROOT || path.join(os.homedir(), 'CarolinaLocalRunner')
const OUT = path.join(ROOT, 'data', 'business')
const LEGACY_OUT = path.join(ROOT, 'business-outreach')
const MARKETS = [
  { market:'USA', segment:'Shopify / DTC ecommerce', language:'en', company:'Shopify/DTC brand', visibleSignal:'they likely depend on paid traffic, support, abandoned follow-up and retention without one connected commercial system' },
  { market:'USA', segment:'medspas / aesthetic clinics', language:'en', company:'aesthetic clinic or medspa', visibleSignal:'they may receive leads from ads/Instagram but lose bookings when follow-up is manual or slow' },
  { market:'Spain', segment:'ecommerce and agencies', language:'en', company:'ecommerce brand or agency', visibleSignal:'their delivery/reporting and client follow-up can be systematized with AI + CRM workflows' },
  { market:'Mexico', segment:'WhatsApp-first businesses', language:'es', company:'negocio que vende por WhatsApp', visibleSignal:'tienen demanda por mensajes pero pierden oportunidades por falta de calificación, seguimiento y CRM' },
  { market:'Colombia / LatAm', segment:'beauty brands and service businesses', language:'es', company:'marca de belleza o negocio de servicios', visibleSignal:'pueden tener pauta, mensajes y clientes anteriores sin un sistema de recompra y seguimiento' },
  { market:'Global', segment:'AI automation agencies', language:'en', company:'AI automation agency', visibleSignal:'they can scale delivery with reusable client-ready agents, QA, proposal and reporting systems' }
]
function esc(v){ return '"' + String(v ?? '').replaceAll('"','""').replaceAll('\n',' ').slice(0,5000) + '"' }
fs.mkdirSync(OUT, { recursive:true })
fs.mkdirSync(LEGACY_OUT, { recursive:true })
const rows = MARKETS.map((x,i)=>{
  const intel = createWinningProposal(x)
  return {
    id:`B2B-${String(i+1).padStart(3,'0')}`,
    ts:new Date().toISOString(),
    market:x.market,
    segment:x.segment,
    language:x.language,
    visible_signal:x.visibleSignal,
    industry:intel.industry,
    offer:intel.offer.label,
    ticket:`USD ${intel.offer.min}-${intel.offer.max}`,
    status:intel.qa.ok ? 'PROPOSAL_DRAFTED_READY_TO_PERSONALIZE' : 'PROPOSAL_NEEDS_REVIEW',
    qa_flags:intel.qa.flags.join('|'),
    next_action:'Find 10 qualified businesses with public contact details, add one real observation from their website/social profile, then send through approved Gmail flow.',
    proposal:intel.proposal
  }
})
const header=['id','ts','market','segment','language','visible_signal','industry','offer','ticket','status','qa_flags','next_action','proposal']
const csv = [header.join(','), ...rows.map(r=>header.map(h=>esc(r[h])).join(','))].join('\n')+'\n'
const md = rows.map(r=>`## ${r.id} — ${r.market} — ${r.segment}\n\nStatus: ${r.status}\nOffer: ${r.offer} (${r.ticket})\nQA flags: ${r.qa_flags || 'OK'}\nNext: ${r.next_action}\n\n${r.proposal}\n`).join('\n---\n')
for (const dir of [OUT, LEGACY_OUT]) {
  fs.writeFileSync(path.join(dir,'business-prospects.csv'), csv)
  fs.writeFileSync(path.join(dir,'business-proposal-drafts.md'), md)
  fs.writeFileSync(path.join(dir,'business-prospects.json'), JSON.stringify({ts:new Date().toISOString(), prospects:rows}, null, 2))
}
console.log(JSON.stringify({type:'business_prospecting_completed', prospects:rows.length, out:OUT}))
