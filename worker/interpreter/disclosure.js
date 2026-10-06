// Veracidad del idioma: las propuestas solo pueden prometer interpretación en tiempo real cuando el intérprete
// tiene clave de OpenAI Y pasó la prueba real de escucha (INTERPRETER_VERIFIED=true). Antes, se dice solo lo verificable.
export const interpreterLive = env => !!env?.OPENAI_API_KEY && String(env?.INTERPRETER_VERIFIED || '') === 'true'

export function languageSentence(env, lang = 'es') {
  const live = interpreterLive(env)
  if (lang === 'en') return live
    ? "I'm a native Spanish speaker with basic spoken English; in meetings I use real-time AI interpretation and I write with AI assistance."
    : "I'm a native Spanish speaker with basic spoken English; my written communication is fluent with AI assistance."
  return live
    ? 'Mi idioma nativo es español y mi inglés oral es básico; en reuniones uso interpretación con IA en tiempo real y escribo con asistencia de IA.'
    : 'Mi idioma nativo es español y mi inglés oral es básico; mi comunicación escrita es fluida con asistencia de IA.'
}

// Guardia final antes de cualquier envío automático: reemplaza frases sobre interpretación no verificada.
export function enforceLanguageTruth(text, env, lang) {
  const t = String(text || '')
  if (!t || interpreterLive(env)) return t
  const claim = /interpret(aci[oó]n|ation|er|ing)|int[eé]rprete/i
  if (!claim.test(t)) return t
  const language = lang || (/\b(the|and|with|your|meetings)\b/i.test(t) ? 'en' : 'es')
  let replaced = false
  const out = t.split(/(?<=[.!?])\s+|\n/).map(s => {
    if (!claim.test(s)) return s
    if (replaced) return ''
    replaced = true
    return languageSentence(env, language)
  }).filter(s => s !== '')
  return out.join(t.includes('\n') ? '\n' : ' ').replace(/\n{3,}/g, '\n\n')
}
