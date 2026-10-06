#!/usr/bin/env node
/**
 * Carolina Gmail/Resend Outreach Bridge
 * Connects local Carolina pipeline to safe email actions.
 * It does not send cold email blindly. It creates:
 * - SENDABLE_DIRECT_APPLICATION: explicit email route from an opportunity.
 * - DRAFT_REVIEW: personalized B2B/cold outreach draft needing review or reputation-safe sender.
 * - WAITING_HUMAN: missing contact, paid channel, captcha/MFA, form-only or ambiguous route.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ROOT = process.env.CAROLINA_LOCAL_ROOT || path.join(os.homedir(), 'CarolinaLocalRunner')
const OUT = path.join(ROOT, 'data', 'gmail')
const APP = path.join(ROOT, 'data', 'applications', 'latest-opportunities.json')
const LEGACY_APP = path.join(ROOT, 'outreach', 'latest-opportunities.json')
const BIZ = path.join(ROOT, 'data', 'business', 'business-prospects.json')
const LEGACY_BIZ = path.join(ROOT, 'business-outreach', 'business-prospects.json')
const PORTFOLIO = 'https://soycatalinajaramillo.com'
const CONTACT = 'clientes@soycatalinajaramillo.com'

function readJson(...files){
  for (const f of files) {
    try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f,'utf8')) } catch {}
  }
  return {}
}
function csv(v){ return '"'+String(v??'').replaceAll('"','""').replaceAll('\n',' ').slice(0,5000)+'"' }
function emailFromText(x){
  const s = JSON.stringify(x || {})
  const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return m ? m[0].toLowerCase() : ''
}
function langOf(x){ return x.language === 'es' || /automatizaci|ventas|whatsapp|colombia|latam/i.test(`${x.title} ${x.segment} ${x.market}`) ? 'es' : 'en' }
function subject(x, lang){
  const company = x.company || x.segment || x.title || 'tu operación'
  if (lang === 'es') return `Idea concreta para mejorar seguimiento y ventas en ${String(company).slice(0,55)}`
  return `Practical AI workflow idea for ${String(company).slice(0,55)}`
}
function body(x, lang){
  const title = x.title || x.segment || x.company || 'your business'
  const pain = x.pain || x.visibleSignal || x.need || x.proposal || 'manual follow-up, weak CRM visibility or missed sales opportunities'
  if (lang === 'es') return `Hola, soy Catalina Jaramillo.\n\nRevisando negocios/proyectos como ${title}, veo una oportunidad concreta: muchas ventas se pierden por ${pain}.\n\nMi propuesta no es “poner un chatbot”. Es mapear el proceso comercial, detectar dónde se fugan prospectos y montar un primer sistema medible: captura, calificación, seguimiento, CRM y reporte.\n\nPodría empezar con una implementación rápida desde USD 500-900 si es algo puntual, o escalar a un sistema de WhatsApp/CRM/ecommerce si el flujo lo justifica.\n\nTe dejo mi perfil y ejemplos de enfoque aquí: ${PORTFOLIO}\n\n¿Tiene sentido que te mande una propuesta corta de 3 pasos para tu caso?\n\nCatalina Jaramillo\nAI Commerce Systems & Multi-Agent Operations\n${CONTACT}`
  return `Hi, I’m Catalina Jaramillo.\n\nLooking at opportunities/businesses like ${title}, I see a practical gap: many teams lose revenue through ${pain}.\n\nMy approach is not “just a chatbot”. I map the commercial process, identify where leads or follow-ups are leaking, and build a measurable first workflow: capture, qualification, CRM, follow-up and reporting.\n\nA focused quick win can start around USD 500-900, and larger WhatsApp/CRM/ecommerce systems can scale from there when justified.\n\nProfile and work direction: ${PORTFOLIO}\n\nWould it make sense for me to send a short 3-step proposal for your case?\n\nCatalina Jaramillo\nAI Commerce Systems & Multi-Agent Operations\n${CONTACT}`
}
function classify(x){
  const email = emailFromText(x)
  const text = JSON.stringify(x||{}).toLowerCase()
  if (/captcha|mfa|checkout|billing|connects|membership|verification|paid/.test(text)) return {status:'WAITING_HUMAN', reason:'cost/security/platform blocker', email}
  if (email && /apply|application|contact|email|send|hiring|contrat|project|job/i.test(text)) return {status:'SENDABLE_DIRECT_APPLICATION', reason:'explicit or visible email route candidate', email}
  if (x.platform === 'b2b' || x.source === 'business-prospecting-engine' || x.segment || x.market) return {status:'DRAFT_REVIEW', reason:'B2B/cold prospecting draft; needs verified contact or reputation-safe sender', email}
  return {status:'WAITING_HUMAN', reason:'missing verified contact or ambiguous route', email}
}
fs.mkdirSync(OUT,{recursive:true})
const apps = readJson(APP, LEGACY_APP).opportunities || []
const biz = readJson(BIZ, LEGACY_BIZ).prospects || []
const rows=[]
for (const x of [...apps, ...biz]) {
  const lang = langOf(x)
  const c = classify(x)
  const row = {
    ts:new Date().toISOString(),
    status:c.status,
    reason:c.reason,
    email:c.email,
    platform:x.platform || 'b2b',
    title:x.title || x.segment || x.company || '',
    url:x.url || x.website || PORTFOLIO,
    language:lang,
    subject:subject(x,lang),
    body:body(x,lang),
    followup_day_1: lang==='es' ? 'Te escribo para no dejar perder esta idea. ¿Quieres que te mande el mapa de 3 pasos?' : 'Following up so this does not get lost. Should I send the 3-step map?',
    followup_day_3: lang==='es' ? 'Cierro el ciclo por ahora. Si ventas/seguimiento/CRM es prioridad, puedo enviarte una propuesta corta.' : 'Closing the loop for now. If sales/follow-up/CRM is a priority, I can send a short proposal.'
  }
  rows.push(row)
}
const header=['ts','status','reason','email','platform','title','url','language','subject','body','followup_day_1','followup_day_3']
const csvText=[header.join(','), ...rows.map(r=>header.map(h=>csv(r[h])).join(','))].join('\n')+'\n'
const md=rows.map((r,i)=>`## ${i+1}. ${r.status} — ${r.platform} — ${r.title}\n\nEmail: ${r.email || 'MISSING'}\nReason: ${r.reason}\nURL: ${r.url}\nSubject: ${r.subject}\n\n${r.body}\n\nFollow-up D1: ${r.followup_day_1}\nFollow-up D3: ${r.followup_day_3}\n`).join('\n---\n')
fs.writeFileSync(path.join(OUT,'gmail-outreach-queue.csv'), csvText)
fs.writeFileSync(path.join(OUT,'gmail-drafts.md'), md)
fs.writeFileSync(path.join(OUT,'gmail-outreach-queue.json'), JSON.stringify({ts:new Date().toISOString(), total:rows.length, rows}, null, 2))
const counts = rows.reduce((a,r)=>{ a[r.status]=(a[r.status]||0)+1; return a }, {})
console.log(JSON.stringify({type:'gmail_outreach_bridge_completed', total:rows.length, counts, out:OUT}, null, 2))
