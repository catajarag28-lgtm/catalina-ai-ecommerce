// Correo-propuesta con la marca de Catalina (HTML de tablas + estilos en línea: Gmail, Outlook, Apple Mail).
// Sin JS ni animaciones (los clientes de correo las bloquean): el botón lleva a la propuesta web animada.
import { findProposal, proposals } from '../src/proposals.js'
import { catalog } from '../src/offers.js'

const SITE = 'https://soycatalinajaramillo.com'
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const usd = n => 'USD ' + n.toLocaleString('es-CO')

export function renderProposalEmail({ slug, company = '', contactName = '', note = '' } = {}) {
  const p = findProposal(slug) || proposals[0]
  const tier = catalog.find(c => c.id === p.tier)
  const url = `${SITE}/sectores/${p.slug}${company ? `?empresa=${encodeURIComponent(company)}` : ''}`
  const hello = contactName ? `Hola ${esc(contactName.split(' ')[0])},` : 'Hola,'
  const subject = company ? `${company}: ${p.hook}` : p.hook
  const bullets = p.agent.slice(0, 4).map(a => `<tr><td style="padding:6px 0;vertical-align:top;width:22px;color:#c8aa7c;font-size:15px;">&#10003;</td><td style="padding:6px 0;color:#3f3931;font-size:15px;line-height:1.5;">${esc(a)}</td></tr>`).join('')
  const scene = p.scene.slice(0, 3).map(([t, s]) => `<tr><td style="padding:8px 12px 8px 0;vertical-align:top;width:70px;color:#c8aa7c;font:700 13px Arial,sans-serif;">${esc(t)}</td><td style="padding:8px 0;color:#e3d9ca;font-size:14px;line-height:1.5;">${esc(s)}</td></tr>`).join('')

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ede7de;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(p.pain.slice(0, 120))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ede7de;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fbf8f3;border-radius:18px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
 <tr><td style="background:#131311;padding:30px 36px 34px;">
  <div style="font:700 12px Arial,sans-serif;letter-spacing:3px;color:#ede7de;">CATALINA <span style="font-weight:400;">JARAMILLO</span></div>
  <div style="margin-top:26px;font:700 11px Arial,sans-serif;letter-spacing:2px;color:#c8aa7c;">PROPUESTA · ${esc(p.sector.toUpperCase())}</div>
  <h1 style="margin:12px 0 0;font:600 30px/1.15 Arial,sans-serif;color:#f3eadc;letter-spacing:-0.5px;">${company ? esc(company) + ',<br>' : ''}<span style="color:#d7bd95;">${esc(p.hook)}</span></h1>
 </td></tr>
 <tr><td style="padding:30px 36px 8px;color:#2b241b;font-size:16px;line-height:1.6;">
  <p style="margin:0 0 14px;">${hello}</p>
  <p style="margin:0 0 14px;">${esc(p.pain)}</p>
  ${note ? `<p style="margin:0 0 14px;">${esc(note)}</p>` : ''}
  <p style="margin:0 0 6px;font-weight:700;">Lo que un agente de IA diseñado para tu negocio haría:</p>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${bullets}</table>
 </td></tr>
 <tr><td style="padding:18px 36px 6px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1b1916;border-radius:14px;"><tr><td style="padding:18px 20px;">
   <div style="font:700 11px Arial,sans-serif;letter-spacing:2px;color:#c8aa7c;margin-bottom:6px;">ASÍ SE VERÍA EN TU NEGOCIO</div>
   <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${scene}</table>
  </td></tr></table>
 </td></tr>
 <tr><td style="padding:22px 36px 4px;color:#2b241b;font-size:15px;line-height:1.6;">
  <p style="margin:0;">Empezamos con un <b>diagnóstico estratégico de USD 490</b> (se descuenta si implementas) o directamente con <b>${esc(tier.name.toLowerCase())}</b>, desde ${usd(tier.fromUSD)}. Sin promesas mágicas: medimos contigo ${esc(p.measure.slice(0, 2).join(' y ').toLowerCase())}.</p>
 </td></tr>
 <tr><td align="center" style="padding:26px 36px 8px;">
  <a href="${url}" style="display:inline-block;background:#d7bd95;color:#221a11;text-decoration:none;font:700 15px Arial,sans-serif;padding:15px 28px;border-radius:999px;">Ver la propuesta completa</a>
  <div style="margin-top:12px;font-size:13px;color:#7a6f62;">O habla con Carolina, mi asesora de IA, en <a href="${SITE}/#carolina" style="color:#8d6c40;">soycatalinajaramillo.com</a></div>
 </td></tr>
 <tr><td style="padding:26px 36px 30px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #ddd2c2;"><tr><td style="padding-top:18px;color:#2b241b;font-size:14px;line-height:1.55;">
   <b>Catalina Jaramillo</b><br>
   <span style="color:#6b6258;">Estrategia, operación e inteligencia artificial · 15+ años en ventas y operación · Diseñó y dirige LAURA, sistema multiagente con más de 9.000 pedidos.</span><br>
   <span style="color:#6b6258;">Reuniones en español · EE. UU. y Latinoamérica</span>
  </td></tr></table>
 </td></tr>
</table>
</td></tr></table></body></html>`

  const text = `${hello}\n\n${p.pain}\n\n${note ? note + '\n\n' : ''}Lo que un agente de IA diseñado para tu negocio haría:\n- ${p.agent.slice(0, 4).join('\n- ')}\n\nEmpezamos con un diagnóstico estratégico de USD 490 (se descuenta si implementas) o con ${tier.name.toLowerCase()}, desde ${usd(tier.fromUSD)}.\n\nPropuesta completa: ${url}\n\nCatalina Jaramillo\nsoycatalinajaramillo.com`
  return { subject, html, text, url }
}

