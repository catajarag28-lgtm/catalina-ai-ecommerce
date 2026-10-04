#!/usr/bin/env node
/**
 * Carolina Safe Auto Apply
 * Applies only when a flow is free and unambiguous.
 * This engine is intentionally conservative: no Connects, no checkout, no CAPTCHA/MFA,
 * no paid membership, no sensitive forms, no guessing.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const ROOT = process.env.CAROLINA_LOCAL_ROOT || path.join(os.homedir(), 'CarolinaLocalRunner')
const OUT = path.join(ROOT, 'data', 'applications')
const LEGACY_OUT = path.join(ROOT, 'outreach')
const SOURCE = path.join(LEGACY_OUT, 'latest-opportunities.json')
const LOG = path.join(OUT, 'safe-auto-apply-log.jsonl')
const RESULTS = path.join(OUT, 'safe-auto-apply-results.json')
const LIMIT = Number(process.env.CAROLINA_SAFE_APPLY_LIMIT || 3)
const ALLOWED_PLATFORMS = (process.env.CAROLINA_SAFE_APPLY_PLATFORMS || 'linkedin,workana,twine,guru,peopleperhour')
  .split(',').map(x=>x.trim()).filter(Boolean)
const BLOCKED_PLATFORMS = new Set(['upwork'])
const COST_WORDS = /connects|checkout|billing|membership|paid plan|payment required|upgrade|required to pay|captcha|mfa|verify your email|verification required/i

function ensure(){ fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(LEGACY_OUT,{recursive:true}) }
function log(row){ ensure(); fs.appendFileSync(LOG, JSON.stringify({ts:new Date().toISOString(), ...row})+'\n') }
function loadOpportunities(){
  try {
    const parsed = JSON.parse(fs.readFileSync(SOURCE,'utf8'))
    return parsed.opportunities || []
  } catch {
    return []
  }
}
function classify(op){
  if(!ALLOWED_PLATFORMS.includes(op.platform)) return {status:'SKIPPED_PLATFORM', reason:'platform not enabled for safe auto apply'}
  if(BLOCKED_PLATFORMS.has(op.platform)) return {status:'WAITING_HUMAN', reason:'platform may require Connects or paid credits'}
  const text = `${op.title} ${op.url} ${op.next_action} ${op.proposal}`
  if(COST_WORDS.test(text)) return {status:'WAITING_HUMAN', reason:'possible cost, verification, CAPTCHA/MFA, or paid membership signal'}
  if(!op.url || !/^https?:\/\//.test(op.url)) return {status:'PREPARED_NO_URL', reason:'missing valid URL'}
  return {status:'READY_FOR_FREE_AUTO_APPLY', reason:'eligible for free auto apply review'}
}

ensure()
const opportunities = loadOpportunities()
const results = []
let applied = 0
for(const op of opportunities){
  if(applied >= LIMIT) break
  const decision = classify(op)
  if(decision.status === 'READY_FOR_FREE_AUTO_APPLY') {
    // The actual browser click is performed by the local PC engine when available.
    // Repository version records the decision and keeps a safe handoff artifact.
    const row = {...op, status:'READY_FOR_BROWSER_SUBMIT', reason:decision.reason}
    results.push(row); log({type:'ready_for_browser_submit', platform:op.platform, title:op.title, url:op.url})
    applied++
  } else {
    const row = {...op, status:decision.status, reason:decision.reason}
    results.push(row); log({type:'skipped_or_waiting', platform:op.platform, title:op.title, status:decision.status, reason:decision.reason})
  }
}
const payload = {ts:new Date().toISOString(), limit:LIMIT, results}
fs.writeFileSync(RESULTS, JSON.stringify(payload, null, 2))
fs.writeFileSync(path.join(LEGACY_OUT, 'safe-auto-apply-results.json'), JSON.stringify(payload, null, 2))
console.log(JSON.stringify({type:'safe_auto_apply_completed', ready:results.filter(r=>r.status==='READY_FOR_BROWSER_SUBMIT').length, total:results.length, results:RESULTS}))
