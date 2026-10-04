#!/usr/bin/env node
/**
 * Carolina Opportunity Engine
 *
 * Creates opportunity records and high-quality proposal drafts from current platform/business queues.
 * This repository version is filesystem-safe and does not click, spend money or bypass security.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createWinningProposal } from './carolina-proposal-intelligence.js'

const ROOT = process.env.CAROLINA_LOCAL_ROOT || path.join(os.homedir(), 'CarolinaLocalRunner')
const DATA = path.join(ROOT, 'data')
const OUT = path.join(DATA, 'applications')
const LEGACY = path.join(ROOT, 'outreach')
const BUSINESS_JSON = path.join(DATA, 'business', 'business-prospects.json')
const LATEST = path.join(OUT, 'latest-opportunities.json')
const LEGACY_LATEST = path.join(LEGACY, 'latest-opportunities.json')
const PROPOSALS = path.join(OUT, 'proposal-drafts.md')
const CSV = path.join(OUT, 'carolina-opportunities.csv')

const SEED_OPPORTUNITIES = [
  { platform:'linkedin', title:'AI Automation / Ecommerce Operations roles — remote USA/Spain/Mexico', url:'https://www.linkedin.com/jobs/search/?keywords=AI%20Automation%20Ecommerce%20Operations', language:'en', segment:'AI ecommerce operations', visibleSignal:'companies are hiring for AI/ecommerce operators who can connect automation with business outcomes' },
  { platform:'workana', title:'Automatización IA, CRM, WhatsApp y ecommerce — LatAm', url:'https://www.workana.com/jobs?query=automatizacion%20ia', language:'es', segment:'automatización IA y ventas por WhatsApp', visibleSignal:'clientes buscan automatizar procesos comerciales pero suelen pedir solo la herramienta, no el sistema completo' },
  { platform:'twine', title:'Remote AI / automation projects', url:'https://www.twine.net/jobs', language:'en', segment:'AI automation freelance projects', visibleSignal:'clients are looking for implementation help and practical automation delivery' },
  { platform:'guru', title:'CRM / workflow / automation projects', url:'https://www.guru.com/d/jobs/', language:'en', segment:'CRM workflow automation', visibleSignal:'projects need structured workflows, follow-up and implementation clarity' },
  { platform:'peopleperhour', title:'Freelance AI automation and ecommerce jobs', url:'https://www.peopleperhour.com/freelance-jobs', language:'en', segment:'AI automation and ecommerce', visibleSignal:'small businesses need automation help but proposals must be concrete and outcome-driven' }
]

function ensure(){ fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(LEGACY,{recursive:true}) }
function esc(v){ return '"' + String(v ?? '').replaceAll('"','""').replaceAll('\n',' ').slice(0,4000) + '"' }
function loadBusinessProspects(){
  try { return JSON.parse(fs.readFileSync(BUSINESS_JSON,'utf8')).prospects || [] } catch { return [] }
}
function normalizeBusiness(b){
  return {
    platform:'b2b',
    title:`${b.market || 'Market'} — ${b.segment || 'Business prospecting'}`,
    company:b.segment,
    url:'https://soycatalinajaramillo.com',
    language:b.language || 'en',
    segment:b.segment,
    visibleSignal:b.pain || 'there is likely revenue leakage in follow-up, CRM or automation',
    source:'business-prospecting-engine'
  }
}
function cvFor(lang){ return lang === 'es' ? 'Catalina_Jaramillo_AI_Commerce_CV_ES_PHOTO_FULL.pdf' : 'Catalina_Jaramillo_AI_Commerce_CV_EN_PHOTO_FULL.pdf' }
function statusFor(op){
  if(op.platform === 'upwork') return 'WAITING_HUMAN_CONNECTS'
  if(/checkout|membership|connects|billing|captcha|mfa|verify/i.test(`${op.title} ${op.visibleSignal}`)) return 'WAITING_HUMAN'
  if(op.platform === 'b2b') return 'READY_FOR_PERSONALIZED_OUTREACH'
  return 'READY_FOR_FREE_AUTO_APPLY_REVIEW'
}
ensure()
const opportunities = [...SEED_OPPORTUNITIES, ...loadBusinessProspects().map(normalizeBusiness)]
const rows = opportunities.map((op, i)=>{
  const intel = createWinningProposal(op)
  return {
    id:`OPP-${String(i+1).padStart(4,'0')}`,
    ts:new Date().toISOString(),
    platform:op.platform,
    title:op.title,
    url:op.url,
    language:op.language || 'en',
    industry:intel.industry,
    offer:intel.offer.label,
    ticket:`USD ${intel.offer.min}-${intel.offer.max}`,
    status:statusFor(op),
    cv:cvFor(op.language),
    proposal:intel.proposal,
    qa_flags:intel.qa.flags.join('|'),
    next_action: op.platform === 'b2b' ? 'Find a verified decision-maker/contact, personalize with evidence, then send via approved Gmail flow.' : 'Open opportunity and submit only if free, unambiguous and no security/cost barrier.'
  }
})
const header = ['id','ts','platform','title','url','language','industry','offer','ticket','status','cv','qa_flags','next_action','proposal']
const csv = [header.join(','), ...rows.map(r=>header.map(h=>esc(r[h])).join(','))].join('\n')+'\n'
const md = rows.map(r=>`## ${r.id} — ${r.platform} — ${r.title}\n\nStatus: ${r.status}\nOffer: ${r.offer} (${r.ticket})\nCV: ${r.cv}\nQA flags: ${r.qa_flags || 'OK'}\nURL: ${r.url}\nNext: ${r.next_action}\n\n${r.proposal}\n`).join('\n---\n')
const payload = {ts:new Date().toISOString(), total:rows.length, opportunities:rows}
fs.writeFileSync(CSV,csv)
fs.writeFileSync(PROPOSALS,md)
fs.writeFileSync(LATEST,JSON.stringify(payload,null,2))
fs.writeFileSync(path.join(LEGACY,'carolina-opportunities.csv'),csv)
fs.writeFileSync(path.join(LEGACY,'proposal-drafts.md'),md)
fs.writeFileSync(LEGACY_LATEST,JSON.stringify(payload,null,2))
console.log(JSON.stringify({type:'opportunity_engine_completed', total:rows.length, latest:LATEST}))
