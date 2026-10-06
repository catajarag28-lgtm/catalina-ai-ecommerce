#!/usr/bin/env node
/**
 * Carolina Daily Report
 *
 * Sends a daily operational report to WhatsApp through 2Chat when configured,
 * and writes the same report to a local file for audit.
 *
 * Required env for WhatsApp:
 *   TWOCHAT_API_KEY
 *   TWOCHAT_FROM_NUMBER
 *   CATALINA_WHATSAPP_TO
 *
 * Optional env:
 *   CAROLINA_BASE_URL=https://soycatalinajaramillo.com
 *   BROWSER_ADMIN_TOKEN=<admin token>
 */
import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const BASE_URL = process.env.CAROLINA_BASE_URL || 'https://soycatalinajaramillo.com'
const ADMIN_TOKEN = process.env.BROWSER_ADMIN_TOKEN || ''
const TWOCHAT_API_KEY = process.env.TWOCHAT_API_KEY || process.env['2CHAT_API_KEY'] || ''
const TWOCHAT_FROM_NUMBER = process.env.TWOCHAT_FROM_NUMBER || process.env['2CHAT_FROM_NUMBER'] || ''
const TO = process.env.CATALINA_WHATSAPP_TO || process.env.CATALINA_WHATSAPP || '+17869299442'
const ROOT = process.env.CAROLINA_LOCAL_ROOT || join(homedir(), 'CarolinaLocalRunner')
const JOURNAL = join(ROOT, 'carolina-local-journal.jsonl')
const REPORTS = join(ROOT, 'reports.jsonl')

function ensure(){ mkdirSync(ROOT, { recursive: true }) }
function readJournal(){
  if(!existsSync(JOURNAL)) return []
  return readFileSync(JOURNAL,'utf8').split('\n').filter(Boolean).map(x=>{ try{return JSON.parse(x)}catch{return null} }).filter(Boolean)
}
async function getJson(path, admin=false){
  const headers = admin && ADMIN_TOKEN ? { authorization: `Bearer ${ADMIN_TOKEN}` } : {}
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  const text = await res.text()
  let data; try { data=JSON.parse(text) } catch { data={ text } }
  if(!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(data).slice(0,300)}`)
  return data
}
function countToday(rows, type){
  const day = new Date().toISOString().slice(0,10)
  return rows.filter(r => String(r.ts||'').startsWith(day) && (!type || r.type===type)).length
}
async function buildReport(){
  const journal = readJournal()
  const todayOpened = countToday(journal, 'opened_platform')
  const todayCycles = countToday(journal, 'cycle_started')
  const todayErrors = countToday(journal, 'runner_error')
  const todayHuman = countToday(journal, 'waiting_human_or_platform_action')
  let health = null, browser = null
  try { health = await getJson('/health') } catch(e) { health = { error: String(e.message||e) } }
  if(ADMIN_TOKEN) {
    try { browser = await getJson('/ops/browser/status', true) } catch(e) { browser = { error: String(e.message||e) } }
  }
  const sessions = browser?.sessions || []
  const ready = sessions.filter(s => s.saved || s.status === 'saved').map(s=>s.platform)
  const pending = sessions.filter(s => !(s.saved || s.status === 'saved')).map(s=>`${s.platform}:${s.status}`)
  const lines = [
    'REPORTE CAROLINA — ' + new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    '',
    `Cloud: ${health?.status || health?.error || 'sin dato'}`,
    `Browser automation: ${health?.browserAutomation?.enabled ? 'ON' : 'sin confirmar'}`,
    `Runner ciclos hoy: ${todayCycles}`,
    `Plataformas abiertas hoy: ${todayOpened}`,
    `Pendientes humanos detectados: ${todayHuman}`,
    `Errores runner hoy: ${todayErrors}`,
    '',
    `Sesiones listas: ${ready.length ? ready.join(', ') : 'ninguna confirmada'}`,
    `Sesiones pendientes: ${pending.length ? pending.join(', ') : 'ninguna'}`,
    '',
    'CRM: https://docs.google.com/spreadsheets/d/1lo_DiuxlymTTqu42OPau_MNaYWE751cA_lATGUne0t8/edit',
    '',
    'Acción siguiente: revisar WAITING_HUMAN, aprobar costos/Connects si aplica y completar login donde falte.'
  ]
  return { ts: new Date().toISOString(), text: lines.join('\n'), health, browser, local: { todayOpened, todayCycles, todayErrors, todayHuman } }
}
async function send2Chat(text){
  if(!TWOCHAT_API_KEY || !TWOCHAT_FROM_NUMBER || !TO) return { ok:false, reason:'2chat_not_configured' }
  const endpoints = [
    'https://api.p.2chat.io/open/whatsapp/send-message',
    'https://api.2chat.io/open/whatsapp/send-message'
  ]
  let last
  for(const url of endpoints){
    try{
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'content-type':'application/json', 'X-User-API-Key': TWOCHAT_API_KEY },
        body: JSON.stringify({ from_number: TWOCHAT_FROM_NUMBER, to_number: TO, text })
      })
      const body = await res.text()
      if(res.ok) return { ok:true, endpoint:url, body }
      last = { status:res.status, body }
    }catch(e){ last = { error:String(e.message||e) } }
  }
  return { ok:false, reason:'2chat_send_failed', last }
}
async function main(){
  ensure()
  const report = await buildReport()
  const sent = await send2Chat(report.text)
  const row = { ...report, whatsapp: sent }
  appendFileSync(REPORTS, JSON.stringify(row)+'\n')
  console.log(report.text)
  console.log('\nWhatsApp:', JSON.stringify(sent, null, 2))
  if(process.argv.includes('--require-whatsapp') && !sent.ok) process.exit(2)
}
main().catch(err => { console.error(err); process.exit(1) })
