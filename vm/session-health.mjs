// CloudSessionHealth — corre en la VM de Google Cloud dentro de la imagen carolina-cloud-runner.
// Fuente de verdad PRIMARIA de sesiones: el perfil persistente real /data/browser-profile.
// Una plataforma es CONNECTED solo si abre autenticada, se cierra el navegador y al reabrir el
// MISMO user-data-dir sigue autenticada. Nunca imprime ni envía valores de cookies.
import { chromium } from 'playwright'
import fs from 'fs'

const PROFILE = process.env.CAROLINA_AUTH_PROFILE || '/data/browser-profile'
const OUT = (process.env.CAROLINA_DATA || '/data') + '/session-health.json'
const REPORT_URL = process.env.CAROLINA_HEALTH_URL || 'https://soycatalinajaramillo.com/ops/vm-session-health'
const MIN_INTERVAL_MS = Number(process.env.SESSION_HEALTH_INTERVAL_MS || 55 * 60000)

const PLATFORMS = {
  google:   { url: 'https://myaccount.google.com/', domain: 'google.com', auth: ['SID', '__Secure-1PSID'], login: /accounts\.google\.com\/.*(signin|identifier|ServiceLogin)/i },
  linkedin: { url: 'https://www.linkedin.com/feed/', domain: 'linkedin.com', auth: ['li_at'], login: /\/login|\/uas\/login|authwall|signup/i, challenge: /checkpoint|challenge/i },
  workana:  { url: 'https://www.workana.com/dashboard', domain: 'workana.com', auth: [], login: /\/login|\/signin/i },
  upwork:   { url: 'https://www.upwork.com/nx/find-work/', domain: 'upwork.com', auth: [], login: /account-security\/login|\/login/i },
  n8n:      { url: 'https://community.n8n.io/', domain: 'community.n8n.io', auth: ['_t'], discourse: true },
  make:     { url: 'https://community.make.com/', domain: 'community.make.com', auth: ['_t'], discourse: true },
  twine:    { url: 'https://www.twine.net/dashboard', domain: 'twine.net', auth: [], login: /signin|login/i },
  guru:     { url: 'https://www.guru.com/d/jobs/', domain: 'guru.com', auth: [], login: /login/i },
  peopleperhour: { url: 'https://www.peopleperhour.com/dashboard', domain: 'peopleperhour.com', auth: [], login: /login/i },
}
const CHALLENGE = /captcha|verify you are human|just a moment|security check|unusual activity|are you a robot/i
const BLOCKED = /account (has been )?(restricted|suspended)|access denied|error 1020|temporarily blocked/i

async function check(ctx, name) {
  const p = PLATFORMS[name]
  const page = await ctx.newPage()
  try {
    await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(4000)
    const url = page.url(), title = await page.title().catch(() => '')
    const body = (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).slice(0, 3000)
    const cookies = (await ctx.cookies().catch(() => [])).filter(c => c.domain.replace(/^\./, '').endsWith(p.domain))
    const authNames = p.auth.filter(n => cookies.some(c => c.name === n))
    let verdict, evidence
    if (p.discourse) {
      const r = await page.evaluate(async () => { const x = await fetch('/session/current.json', { credentials: 'include' }); let ok = false; try { ok = !!(await x.json())?.current_user?.id } catch {} return { status: x.status, ok } }).catch(() => ({ status: 0, ok: false }))
      verdict = r.ok ? 'CONNECTED' : 'LOGIN_REQUIRED'; evidence = 'session/current.json=' + r.status
    } else if (BLOCKED.test(body + ' ' + title)) { verdict = 'BLOCKED'; evidence = 'blocked_text' }
    else if ((p.challenge && p.challenge.test(url)) || CHALLENGE.test(title + ' ' + body.slice(0, 600))) { verdict = 'CHALLENGE_REQUIRED'; evidence = 'challenge_page' }
    else if (p.login && p.login.test(url)) { verdict = 'LOGIN_REQUIRED'; evidence = 'redirect_to_login' }
    else if (await page.locator('input[type="password"]:visible').count().catch(() => 0)) { verdict = 'LOGIN_REQUIRED'; evidence = 'password_field' }
    else if (p.auth.length && !authNames.length) { verdict = 'LOGIN_REQUIRED'; evidence = 'auth_cookie_absent' }
    else if (!cookies.length) { verdict = 'LOGIN_REQUIRED'; evidence = 'no_platform_cookies' }
    else { verdict = 'CONNECTED'; evidence = 'authenticated_page' }
    return { verdict, evidence, url: url.split('?')[0].slice(0, 120), title: title.slice(0, 80), platformCookies: cookies.length, authCookieNames: authNames }
  } finally { await page.close().catch(() => {}) }
}

const launch = () => chromium.launchPersistentContext(PROFILE, {
  headless: process.env.HEADED !== '1', viewport: { width: 1365, height: 900 },
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

async function main() {
  if (!process.env.FORCE && fs.existsSync(OUT) && Date.now() - fs.statSync(OUT).mtimeMs < MIN_INTERVAL_MS) { console.log('session-health: skipped (fresh)'); return }
  if (!fs.existsSync(PROFILE)) { report({ at: new Date().toISOString(), profile: PROFILE, results: Object.keys(PLATFORMS).map(platform => ({ platform, verdict: 'PROFILE_MISSING' })) }); return }
  const names = (process.env.PLATFORMS || Object.keys(PLATFORMS).join(',')).split(',')
  const results = []
  let ctx = await launch()
  for (const n of names) results.push({ platform: n, ...(await check(ctx, n).catch(e => ({ verdict: 'ERROR', evidence: String(e.message).slice(0, 120) }))) })
  await ctx.close().catch(() => {})
  // Persistencia: navegador cerrado y reabierto sobre el MISMO perfil.
  ctx = await launch()
  for (const r of results.filter(r => r.verdict === 'CONNECTED')) {
    const again = await check(ctx, r.platform).catch(() => ({ verdict: 'ERROR' }))
    r.afterRestart = again.verdict
    if (again.verdict !== 'CONNECTED') { r.verdict = 'LOGIN_REQUIRED'; r.evidence = 'lost_after_restart' }
  }
  await ctx.close().catch(() => {})
  await report({ at: new Date().toISOString(), host: 'gcp-vm-laura', profile: PROFILE, mode: process.env.HEADED === '1' ? 'headed-xvfb' : 'headless', results })
}

async function report(payload) {
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
  for (const r of payload.results) console.log('session-health', JSON.stringify({ platform: r.platform, verdict: r.verdict, evidence: r.evidence, afterRestart: r.afterRestart || null }))
  const token = process.env.CAROLINA_VM_TOKEN
  if (!token) { console.log('session-health: no token, report kept local'); return }
  const res = await fetch(REPORT_URL, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(e => ({ ok: false, status: e.message }))
  console.log('session-health: reported', res.status)
}

main().catch(e => { console.error('session-health failed', e.message); process.exit(1) })
