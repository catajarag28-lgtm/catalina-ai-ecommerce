#!/usr/bin/env node
/**
 * Carolina Contact Enrichment Plan
 * Creates concrete search tasks to find verified public contacts before Gmail/Resend outreach.
 * It does not scrape private data and does not guess emails.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ROOT = process.env.CAROLINA_LOCAL_ROOT || path.join(os.homedir(), 'CarolinaLocalRunner')
const OUT = path.join(ROOT, 'data', 'gmail')
const BIZ = path.join(ROOT, 'data', 'business', 'business-prospects.json')
const LEGACY_BIZ = path.join(ROOT, 'business-outreach', 'business-prospects.json')
function readJson(...files){ for (const f of files) { try { if(fs.existsSync(f)) return JSON.parse(fs.readFileSync(f,'utf8')) } catch{} } return {} }
function q(s){ return String(s||'').replace(/\s+/g,' ').trim() }
fs.mkdirSync(OUT,{recursive:true})
const prospects = readJson(BIZ, LEGACY_BIZ).prospects || []
const tasks=[]
const markets = prospects.length ? prospects : [
  {market:'USA', segment:'Shopify / DTC ecommerce', pain:'manual support, abandoned follow-up and retention leaks', language:'en'},
  {market:'USA', segment:'medspas / aesthetic clinics', pain:'lead follow-up and appointment conversion', language:'en'},
  {market:'Mexico', segment:'WhatsApp-first businesses', pain:'ventas por WhatsApp sin seguimiento', language:'es'},
  {market:'Spain', segment:'ecommerce and agencies', pain:'manual operations and reporting', language:'en'},
  {market:'Colombia / LatAm', segment:'beauty brands and service businesses', pain:'ventas manuales y baja recompra', language:'es'}
]
for(const p of markets){
  const lang=p.language || 'en'
  const base = `${p.segment} ${p.market}`
  const queries = lang==='es'
    ? [
        `${base} contacto email`,
        `${base} WhatsApp ventas CRM ecommerce contacto`,
        `${base} agencia belleza ecommerce contacto`,
        `${base} "contáctanos" email`
      ]
    : [
        `${base} contact email`,
        `${base} AI automation CRM follow up contact`,
        `${base} "contact us" email`,
        `${base} operations automation agency contact`
      ]
  tasks.push({
    ts:new Date().toISOString(),
    market:p.market,
    segment:p.segment,
    language:lang,
    pain:p.pain,
    status:'NEEDS_PUBLIC_CONTACT_RESEARCH',
    rule:'Only use emails published on the company website/contact page or explicit application email. Do not guess patterns.',
    queries
  })
}
const md=tasks.map((t,i)=>`## ${i+1}. ${t.market} — ${t.segment}\n\nPain: ${t.pain}\nStatus: ${t.status}\nRule: ${t.rule}\n\nSearch queries:\n${t.queries.map(x=>'- '+x).join('\n')}\n`).join('\n---\n')
const csv=['ts,market,segment,language,pain,status,query'].concat(tasks.flatMap(t=>t.queries.map(x=>[t.ts,t.market,t.segment,t.language,t.pain,t.status,x].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')))).join('\n')+'\n'
fs.writeFileSync(path.join(OUT,'contact-enrichment-tasks.json'), JSON.stringify({ts:new Date().toISOString(), total:tasks.length, tasks}, null, 2))
fs.writeFileSync(path.join(OUT,'contact-enrichment-tasks.md'), md)
fs.writeFileSync(path.join(OUT,'contact-enrichment-tasks.csv'), csv)
console.log(JSON.stringify({type:'contact_enrichment_plan_completed', total:tasks.length, out:OUT}, null, 2))
