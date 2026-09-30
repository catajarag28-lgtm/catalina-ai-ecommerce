// Fuentes de negocios reales para la prospección de Carolina.
// 1) Google Places (Maps): negocios operativos con web, calificación y número de reseñas (señal de demanda existente).
// 2) OpenStreetMap / Overpass (datos abiertos): negocios etiquetados por tipo con su web.
// Ninguna fuente entrega correos: Carolina abre la web oficial y solo usa el correo publicado por el propio negocio.

const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' } }

export async function placesSearch(env, query, { minReviews = 20 } = {}) {
  if (!env.GOOGLE_PLACES_KEY) return { ok: false, reason: 'places_key_missing', items: [] }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'places.displayName,places.websiteUri,places.businessStatus,places.rating,places.userRatingCount,places.formattedAddress,places.types' },
    body: JSON.stringify({ textQuery: query, languageCode: 'es', pageSize: 20 }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null)
  if (!res?.ok) return { ok: false, reason: 'places_http_' + (res?.status || 'network'), items: [] }
  const data = await res.json().catch(() => ({}))
  const items = (data.places || [])
    .filter(p => p.businessStatus === 'OPERATIONAL' && p.websiteUri && (p.userRatingCount || 0) >= minReviews)
    .map(p => ({ website: 'https://' + hostOf(p.websiteUri) + '/', company: p.displayName?.text || null, score: Math.min(1000, p.userRatingCount || 0), meta: { fuente: 'Google Maps', reseñas: p.userRatingCount, calificación: p.rating, dirección: p.formattedAddress } }))
    .filter(x => hostOf(x.website))
  return { ok: true, items }
}

// Etiquetas de OpenStreetMap por sector.
const osmTags = {
  spa: ['["shop"="beauty"]', '["leisure"="spa"]', '["amenity"="clinic"]["healthcare:speciality"~"dermatology|cosmetic"]'],
  'salud-admin': ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  inmobiliaria: ['["office"="estate_agent"]'],
  servicios: ['["office"="lawyer"]', '["office"="insurance"]', '["office"="accountant"]', '["office"="tax_advisor"]'],
}
export async function osmSearch(area, sector, limit = 60) {
  const tags = osmTags[sector]
  if (!area || !tags) return { ok: false, reason: 'osm_not_applicable', items: [] }
  const q = `[out:json][timeout:25];area["name"="${area.replace(/"/g, '')}"]["boundary"="administrative"]->.a;(${tags.map(t => `nwr${t}["website"](area.a);`).join('')});out tags ${limit};`
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'CarolinaResearch/1.1 (+https://soycatalinajaramillo.com)' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(30000) }).catch(() => null)
  if (!res?.ok) return { ok: false, reason: 'osm_http_' + (res?.status || 'network'), items: [] }
  const data = await res.json().catch(() => ({}))
  const items = (data.elements || []).map(e => e.tags || {}).filter(t => t.website || t['contact:website'])
    .map(t => ({ website: 'https://' + hostOf(t.website || t['contact:website']) + '/', company: t.name || null, score: 10, meta: { fuente: 'OpenStreetMap', dirección: [t['addr:street'], t['addr:city']].filter(Boolean).join(', ') } }))
    .filter(x => x.website !== 'https:///')
  return { ok: true, items }
}
