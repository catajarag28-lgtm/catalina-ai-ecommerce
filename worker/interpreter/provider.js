export const REALTIME_TRANSLATION_MODEL = "gpt-realtime-translate";
export const REALTIME_TRANSLATION_ENDPOINT = "/v1/realtime/translations";
// Contrato oficial (developers.openai.com/api/docs/guides/realtime-translation, verificado 6-oct-2026):
// el servidor crea un client secret de vida corta; el navegador envía su oferta SDP a /calls con ese secret.
export const TRANSLATION_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/translations/client_secrets";
export const TRANSLATION_CALLS_URL = "https://api.openai.com/v1/realtime/translations/calls";
export const TRANSLATION_USD_PER_MINUTE = 0.034;

// Una sesión por idioma de salida: la API detecta sola el idioma de entrada.
export function translationClientSecretRequest(targetLanguage) {
  const lang = String(targetLanguage || "").toLowerCase().slice(0, 2);
  if (!/^[a-z]{2}$/.test(lang)) throw new Error("targetLanguage is required");
  return { session: { model: REALTIME_TRANSLATION_MODEL, audio: { output: { language: lang } } } };
}

export function buildTranslationSession({ targetLanguage, voice = "marin", context = "", glossary = "" }) {
  if (!targetLanguage) throw new Error("targetLanguage is required");
  return {
    model: REALTIME_TRANSLATION_MODEL,
    target_language: targetLanguage,
    voice,
    instructions: [
      "Act only as a faithful professional interpreter.",
      "Preserve meaning, intent, warmth, emphasis, politeness, humor and emotional tone.",
      "Never add facts, advice, answers or claims the speaker did not make.",
      "Keep names, brands, numbers, dates, currencies, URLs and technical terms exact.",
      "When confidence is insufficient, do not guess; surface a clarification state.",
      context ? `Meeting context: ${context}` : "",
      glossary ? `Preferred terminology: ${glossary}` : "",
    ].filter(Boolean).join("\n"),
  };
}

export function translationDirections({ hostLanguage = "es", guestLanguage }) {
  if (!guestLanguage || guestLanguage === hostLanguage) throw new Error("Distinct host and guest languages are required");
  return [
    { speaker: "host", source: hostLanguage, target: guestLanguage },
    { speaker: "guest", source: guestLanguage, target: hostLanguage },
  ];
}
