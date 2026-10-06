// Descubrimiento en LinkedIn con el perfil PERSISTENTE autenticado de la VM (solo lectura, ritmo humano).
// Envía las vacantes a la cola inteligente del Worker (/ops/vm-opportunities): score → brief → propuesta única.
// NO postula: AUTO_SUBMIT sigue OFF y LinkedIn queda HUMAN_SUBMIT_REQUIRED.
import { chromium } from 'playwright'

const PROFILE = process.env.CAROLINA_AUTH_PROFILE || '/data/browser-profile'
const API = process.env.CAROLINA_OPPS_URL || 'https://soycatalinajaramillo.com/ops/vm-opportunities'
const MAX_JOBS = Number(process.env.MAX_JOBS || 70)
const TARGET_PREPARED = Number(process.env.TARGET_PREPARED || 25)
const QUERIES = (process.env.QUERIES || 'AI Automation Specialist|Automatización con IA LATAM|Ecommerce Operations Manager remote|Operaciones ecommerce remoto|AI Operations|AI Agents|Ecommerce Operations|CRM Automation|Automatización IA|Shopify Automation|Customer Experience Automation|Growth Operations|WhatsApp Automation').split('|')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const jitter = (a, b) => a + Math.floor(Math.random() * (b - a))

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1365, height: 900 }, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] })
const page = ctx.pages()[0] || await ctx.newPage()
const ids = new Map()
try {
  for (const q of QUERIES) {
    if (ids.size >= MAX_JOBS) break
    const url = 'https://www.linkedin.com/jobs/search/?keywords=' + encodeURIComponent(q) + '&f_WT=2&f_TPR=r604800&f_AL=true&sortBy=R&geoId=92000000'
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
    await sleep(jitter(3500, 5500))
    if (/\/login|authwall|checkpoint/i.test(page.url())) { console.log('linkedin: session lost', page.url()); process.exit(3) }
    const found = await page.$$eval('a[href*="/jobs/view/"]', as => [...new Set(as.map(a => (a.href.match(/\/jobs\/view\/(\d+)/) || [])[1]).filter(Boolean))]).catch(() => [])
    let n = 0
    for (const id of found) { if (!ids.has(id) && n < 6) { ids.set(id, q); n++ } }
    console.log('search', JSON.stringify({ q, found: found.length, added: n }))
  }
  const items = []
  for (const [id, q] of ids) {
    const url = 'https://www.linkedin.com/jobs/view/' + id + '/'
    // Página pública del aviso: trae descripción completa, empresa y aplicantes de forma estable
    // (en la vista autenticada la descripción se carga perezosamente y llegaba vacía).
    await page.goto('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/' + id, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
    await sleep(jitter(2000, 3500))
    const data = await page.evaluate(() => {
      const t = s => (document.querySelector(s)?.innerText || '').trim()
      return {
        title: t('.top-card-layout__title') || t('h2') || t('h1'),
        company: t('.topcard__org-name-link') || t('.topcard__flavor'),
        location: t('.topcard__flavor--bullet'),
        applicants: t('.num-applicants__caption') || t('.topcard__flavor--metadata'),
        description: (t('.show-more-less-html__markup') || t('.description__text')).slice(0, 7000),
        criteria: t('.description__job-criteria-list').slice(0, 600),
        easyApply: /easy apply|solicitud sencilla/i.test(document.body.innerText || ''),
      }
    }).catch(() => null)
    if (!data?.title || (data.description || '').length < 200) { console.log('skip_no_description', id); continue }
    items.push({ platform: 'linkedin', url, title: data.title.slice(0, 200), company: data.company.slice(0, 120), location: data.location.slice(0, 120), applicants: data.applicants.slice(0, 60), easyApply: data.easyApply, description: data.description + (data.criteria ? '\n\n' + data.criteria : ''), query: q })
  }
  console.log('collected', items.length)
  // Lotes pequeños: cada lote se puntúa completo; solo A/B consumen IA. Para al llegar a la meta preparada.
  let prepared = 0
  const summary = { received: 0, A: 0, B: 0, C: 0, prepared: 0, rejected: [], results: [] }
  for (let i = 0; i < items.length && prepared < TARGET_PREPARED; i += 6) {
    const chunk = items.slice(i, i + 6)
    const res = await fetch(API, { method: 'POST', headers: { authorization: 'Bearer ' + process.env.CAROLINA_VM_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify({ source: 'linkedin-vm', items: chunk, limit: Math.min(6, TARGET_PREPARED - prepared) }), signal: AbortSignal.timeout(280000) }).then(r => r.json()).catch(e => ({ error: e.message }))
    if (res.error) { console.log('batch error', res.error); continue }
    for (const k of ['received', 'A', 'B', 'C', 'prepared']) summary[k] += res[k] || 0
    summary.rejected.push(...(res.rejected || [])); summary.results.push(...(res.results || []))
    prepared = summary.prepared
    console.log('batch', JSON.stringify({ i, A: res.A, B: res.B, C: res.C, prepared: res.prepared }))
  }
  console.log('SUMMARY ' + JSON.stringify(summary))
} finally { await ctx.close().catch(() => {}) }
