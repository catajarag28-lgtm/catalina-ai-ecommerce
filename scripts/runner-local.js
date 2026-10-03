#!/usr/bin/env node
/**
 * Carolina Local Runner
 *
 * Runs on Catalina's Windows PC using local Chrome profiles, not Cloudflare Browser Run.
 * It does not read, print, export or upload cookies/passwords. It opens a dedicated
 * Chrome profile per platform and records evidence to a local journal so Carolina can
 * report what happened.
 *
 * Commands:
 *   node scripts/runner-local.js connect linkedin
 *   node scripts/runner-local.js connect-all
 *   node scripts/runner-local.js audit
 *   node scripts/runner-local.js run
 *
 * Required env for cloud status/report actions:
 *   CAROLINA_BASE_URL=https://soycatalinajaramillo.com
 *   BROWSER_ADMIN_TOKEN=<Cloudflare worker BROWSER_ADMIN_TOKEN>
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const BASE_URL = process.env.CAROLINA_BASE_URL || 'https://soycatalinajaramillo.com'
const ADMIN_TOKEN = process.env.BROWSER_ADMIN_TOKEN || ''
const ROOT = process.env.CAROLINA_LOCAL_ROOT || join(homedir(), 'CarolinaLocalRunner')
const JOURNAL = join(ROOT, 'carolina-local-journal.jsonl')
const STATE = join(ROOT, 'state.json')
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const platforms = {
  linkedin: { label: 'LinkedIn', home: 'https://www.linkedin.com/feed/', login: /\/login|checkpoint|authwall|signin/i, url: 'https://www.linkedin.com/jobs/search/?keywords=AI%20Automation%20Ecommerce%20Operations&f_WT=2' },
  upwork: { label: 'Upwork', home: 'https://www.upwork.com/nx/find-work/', login: /login|account-security/i, url: 'https://www.upwork.com/nx/search/jobs/?q=ai%20automation%20ecommerce' },
  workana: { label: 'Workana', home: 'https://www.workana.com/jobs?query=automatizacion%20ia', login: /login|signin/i, url: 'https://www.workana.com/jobs?query=automatizacion%20ia' },
  n8n: { label: 'n8n Community', home: 'https://community.n8n.io/latest', login: /\/login/i, url: 'https://community.n8n.io/search?q=automation%20ecommerce%20AI' },
  make: { label: 'Make Community', home: 'https://community.make.com/latest', login: /\/login/i, url: 'https://community.make.com/search?q=automation%20ecommerce%20AI' },
  contra: { label: 'Contra', home: 'https://contra.com/opportunities', login: /login|sign-in/i, url: 'https://contra.com/opportunities' },
  wellfound: { label: 'Wellfound', home: 'https://wellfound.com/jobs', login: /login/i, url: 'https://wellfound.com/jobs' },
  twine: { label: 'Twine', home: 'https://www.twine.net/jobs', login: /signin|login/i, url: 'https://www.twine.net/jobs' },
  guru: { label: 'Guru', home: 'https://www.guru.com/d/jobs/', login: /login/i, url: 'https://www.guru.com/d/jobs/' },
  malt: { label: 'Malt', home: 'https://www.malt.com/', login: /login/i, url: 'https://www.malt.com/' },
  peopleperhour: { label: 'PeoplePerHour', home: 'https://www.peopleperhour.com/freelance-jobs', login: /login/i, url: 'https://www.peopleperhour.com/freelance-jobs' },
}

function ensureRoot(){
  mkdirSync(ROOT, { recursive: true })
  mkdirSync(join(ROOT, 'profiles'), { recursive: true })
}
function log(event){
  ensureRoot()
  const row = { ts: new Date().toISOString(), ...event }
  appendFileSync(JOURNAL, JSON.stringify(row) + '\n')
  console.log(JSON.stringify(row, null, 2))
}
function readState(){
  try { return JSON.parse(readFileSync(STATE, 'utf8')) } catch { return {} }
}
function saveState(patch){
  ensureRoot()
  writeFileSync(STATE, JSON.stringify({ ...readState(), ...patch }, null, 2))
}
function chromeArgs(platform, url){
  const profile = join(ROOT, 'profiles', platform)
  mkdirSync(profile, { recursive: true })
  return [
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--disable-default-apps',
    '--disable-popup-blocking',
    '--start-maximized',
    url,
  ]
}
function openPlatform(platform, target='home'){
  const cfg = platforms[platform]
  if(!cfg) throw new Error(`unsupported_platform:${platform}`)
  if(!existsSync(CHROME)) throw new Error(`chrome_not_found:${CHROME}`)
  const url = target === 'search' ? cfg.url : cfg.home
  spawn(CHROME, chromeArgs(platform, url), { detached: true, stdio: 'ignore' }).unref()
  log({ type: 'opened_platform', platform, url, mode: target, next: 'complete_login_if_requested_then_leave_window_open' })
}
async function cloud(path, options={}){
  const headers = { ...(options.headers || {}) }
  if(ADMIN_TOKEN) headers.authorization = `Bearer ${ADMIN_TOKEN}`
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = { text } }
  if(!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(body).slice(0,500)}`)
  return body
}
async function auditCloud(){
  const health = await fetch(`${BASE_URL}/health`).then(r=>r.json())
  let browser = null
  if(ADMIN_TOKEN) browser = await cloud('/ops/browser/status').catch(e=>({ error: String(e.message||e) }))
  const state = { lastAuditAt: new Date().toISOString(), health, browser }
  saveState(state)
  log({ type: 'audit', health: { status: health.status, browserAutomation: health.browserAutomation }, browser })
  return state
}
async function runLocalCycle(){
  const max = Number(process.env.CAROLINA_LOCAL_MAX_PLATFORMS || 5)
  const enabled = (process.env.CAROLINA_LOCAL_PLATFORMS || 'linkedin,upwork,workana,n8n,make').split(',').map(x=>x.trim()).filter(Boolean)
  const selected = enabled.slice(0, max)
  log({ type: 'cycle_started', selected })
  for(const p of selected){
    openPlatform(p, 'search')
    log({ type: 'waiting_human_or_platform_action', platform: p, rule: 'submit only if no cost/captcha/mfa; otherwise mark WAITING_HUMAN in CRM' })
  }
  await auditCloud().catch(e=>log({ type: 'audit_failed', error: String(e.message||e) }))
  log({ type: 'cycle_completed', selected, journal: JOURNAL })
}
async function main(){
  ensureRoot()
  const [cmd, arg] = process.argv.slice(2)
  if(cmd === 'connect') return openPlatform(arg || 'linkedin', 'home')
  if(cmd === 'connect-all') { for(const p of Object.keys(platforms)) openPlatform(p, 'home'); return }
  if(cmd === 'audit') { await auditCloud(); return }
  if(cmd === 'run' || !cmd) { await runLocalCycle(); return }
  if(cmd === 'help') { console.log(Object.keys(platforms).join('\n')); return }
  throw new Error(`unknown_command:${cmd}`)
}
main().catch(err => { log({ type: 'runner_error', error: String(err.message||err) }); process.exit(1) })
