// Estados de sesión cloud. CONNECTED exige: estado cifrado en KV, descifrable y un probe autenticado
// en un Browser Run nuevo dentro de las últimas 26 h. Ver un Chrome abierto en el PC no cuenta.
export const SESSION_STATES = ['CONNECTED', 'REFRESH_REQUIRED', 'HUMAN_LOGIN_REQUIRED', 'MISSING', 'PLATFORM_BLOCKED']
export const PROBE_FRESH_MS = 26 * 3600000

export function sessionStateFrom({ stored, probe, lastSuccess, expiresAt }, now = Date.now()) {
  if (stored === 'missing') return { state: 'MISSING', failure: 'no_stored_session' }
  if (stored === 'undecryptable') return { state: 'HUMAN_LOGIN_REQUIRED', failure: 'stored_session_undecryptable' }
  if (probe?.status === 'human_required') return { state: 'PLATFORM_BLOCKED', failure: 'captcha_or_security_check' }
  if (probe?.status === 'expired') return { state: 'HUMAN_LOGIN_REQUIRED', failure: probe.reason || 'redirected_to_login' }
  if (probe?.status === 'error') return { state: 'REFRESH_REQUIRED', failure: 'probe_error' }
  if (probe?.status === 'ready') {
    if (expiresAt && expiresAt - now < 48 * 3600000) return { state: 'REFRESH_REQUIRED', failure: 'auth_cookie_expires_soon' }
    return { state: 'CONNECTED', failure: null }
  }
  if (lastSuccess && now - lastSuccess < PROBE_FRESH_MS) return { state: 'CONNECTED', failure: null }
  return { state: 'REFRESH_REQUIRED', failure: 'not_probed_recently' }
}
