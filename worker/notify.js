// Aviso a Catalina mediante Cloudflare Email Routing (binding send_email "NOTIFY").
// El destino está fijado en wrangler.jsonc y debe ser una dirección verificada en Email Routing.

const b64 = text => { const bytes = new TextEncoder().encode(text); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin) }
const encodedWord = text => `=?UTF-8?B?${b64(text)}?=`

export function buildMime({ from, to, subject, text, replyTo }) {
  const headers = [
    `From: ${encodedWord('Carolina · Leads')} <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodedWord(subject)}`,
    `Message-ID: <${crypto.randomUUID()}@${from.split('@')[1]}>`,
    `Date: ${new Date().toUTCString()}`,
    replyTo ? `Reply-To: <${replyTo}>` : null,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean)
  return headers.join('\r\n') + '\r\n\r\n' + b64(text).replace(/.{76}/g, '$&\r\n')
}

export async function notifyCatalina(env, subject, text, replyTo) {
  if (!env.NOTIFY || !env.NOTIFY_FROM || !env.NOTIFY_TO) return { ok: false, reason: 'notify_unavailable' }
  try {
    const { EmailMessage } = await import('cloudflare:email')
    const safeReplyTo = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(replyTo || '') ? replyTo : undefined
    const raw = buildMime({ from: env.NOTIFY_FROM, to: env.NOTIFY_TO, subject, text, replyTo: safeReplyTo })
    await env.NOTIFY.send(new EmailMessage(env.NOTIFY_FROM, env.NOTIFY_TO, raw))
    return { ok: true }
  } catch (error) {
    console.error('notify_failure', error instanceof Error ? error.message : 'unknown')
    return { ok: false, reason: 'notify_error' }
  }
}

const labels = { name: 'Nombre', company: 'Empresa', email: 'Email', phone: 'Teléfono / WhatsApp', website: 'Web', social: 'Redes sociales', country: 'País', business: 'Negocio', goal: 'Quiere mejorar', problem: 'Problema', tools: 'Herramientas', volume: 'Volumen mensual', timing: 'Cuándo empezar', budget: 'Presupuesto', recommendation: 'Recomendación de Carolina', note: 'Nota' }

export function leadEmail(lead) {
  const lines = Object.entries(labels).filter(([key]) => lead[key]).map(([key, label]) => `${label}: ${Array.isArray(lead[key]) ? lead[key].join(', ') : lead[key]}`)
  const who = lead.company || lead.name || 'sin nombre'
  const origin = lead.source === 'diagnosis' ? 'Diagnóstico de Carolina' : 'Formulario de contacto'
  return {
    subject: `Nuevo contacto: ${who} (${origin})`,
    text: `${origin} en soycatalinajaramillo.com\n\n${lines.join('\n')}\n\nResponde a este correo para escribirle directamente${lead.email ? '' : ' (no dejó email: usa el teléfono)'}.\nIdealmente, contáctale en menos de 1 hora.`,
  }
}
