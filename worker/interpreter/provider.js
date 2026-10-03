export const REALTIME_TRANSLATION_MODEL = "gpt-realtime-translate";
export const REALTIME_TRANSLATION_ENDPOINT = "/v1/realtime/translations";

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
