// Estado por canal de adquisición. Un canal limitado (pago, membresía, examen, login, CAPTCHA)
// queda marcado CHANNEL_LIMITED y el resto de Carolina sigue operando: nunca se espera por él.
export const CHANNELS = ['job_applications', 'project_bids', 'direct_outbound', 'partnerships', 'intent_signals', 'warm_network', 'freelancer', 'linkedin', 'workana', 'upwork']

export async function setChannelStatus(env, channel, status, reason = '', untilMs = null, now = Date.now()) {
  const value = JSON.stringify({ status, reason: String(reason).slice(0, 300), at: new Date(now).toISOString(), until: untilMs ? new Date(untilMs).toISOString() : null })
  await env.DB.prepare("INSERT INTO app_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind('channel:' + channel, value, now).run().catch(e => console.error('channel_status_write', e?.message))
}

export async function channelLimited(env, channel, now = Date.now()) {
  const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key=?').bind('channel:' + channel).first().catch(() => null)
  try {
    const s = JSON.parse(row?.value || '{}')
    if (s.status !== 'CHANNEL_LIMITED') return null
    if (s.until && Date.parse(s.until) <= now) return null
    return s
  } catch { return null }
}

export async function channelSnapshot(env) {
  const rows = await env.DB.prepare("SELECT key,value FROM app_settings WHERE key LIKE 'channel:%'").all().catch(() => ({ results: [] }))
  return Object.fromEntries((rows.results || []).map(r => { try { return [r.key.slice(8), JSON.parse(r.value)] } catch { return [r.key.slice(8), null] } }))
}

// Candado global de envíos automáticos (postulaciones por navegador, por email y bids).
// Hasta que Catalina valide la calidad, todo se PREPARA y queda listo para revisión: AUTO_SUBMIT=off.
export const autoSubmitAllowed = env => String(env.AUTO_SUBMIT || 'off').toLowerCase() === 'on'
