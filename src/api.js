// En soycatalinajaramillo.com la web y la API viven en el mismo Worker (mismo origen).
// En GitHub Pages se usa la URL workers.dev; en desarrollo, wrangler dev.
const WORKER = 'https://carolina-portfolio-api.catajaragpyg.workers.dev'
export const API = import.meta.env.VITE_CAROLINA_API
  || (import.meta.env.DEV ? 'http://localhost:8787' : (typeof location !== 'undefined' && location.hostname.endsWith('soycatalinajaramillo.com') ? '' : WORKER))

export const track = (name, conversationId) => fetch(`${API}/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, conversationId }) }).catch(() => {})

export async function sendLead(payload) {
  const res = await fetch(`${API}/lead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No pudimos enviar tus datos.')
  return data
}
