// Navegador remoto de Carolina sobre el perfil PERSISTENTE PRIMARIO de la VM (/data/browser-profile).
// Catalina lo ve por noVNC, inicia sesión o completa un challenge, cierra; la sesión queda en el perfil.
import { chromium } from 'playwright'

const PROFILE = process.env.CAROLINA_AUTH_PROFILE || '/data/browser-profile'
const URLS = {
  google: 'https://myaccount.google.com/', linkedin: 'https://www.linkedin.com/feed/', workana: 'https://www.workana.com/dashboard',
  upwork: 'https://www.upwork.com/nx/find-work/', n8n: 'https://community.n8n.io/login', make: 'https://community.make.com/login',
  twine: 'https://www.twine.net/signin', guru: 'https://www.guru.com/login.aspx', peopleperhour: 'https://www.peopleperhour.com/site/login',
  contra: 'https://contra.com/login', wellfound: 'https://wellfound.com/login', malt: 'https://www.malt.com/signin',
}
const platforms = (process.env.PLATFORM || 'workana').split(',').filter(p => URLS[p])
const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false, viewport: { width: 1365, height: 860 },
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--start-maximized'],
})
for (const [i, p] of platforms.entries()) {
  const page = i === 0 ? (context.pages()[0] || await context.newPage()) : await context.newPage()
  await page.goto(URLS[p], { waitUntil: 'domcontentloaded' }).catch(() => {})
}
console.log('carolina-browser ready profile=' + PROFILE + ' tabs=' + platforms.join(','))
const stop = async () => { await context.close().catch(() => {}); process.exit(0) }
process.on('SIGTERM', stop); process.on('SIGINT', stop)
setInterval(() => {}, 60000)
