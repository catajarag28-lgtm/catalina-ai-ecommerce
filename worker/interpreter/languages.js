export const PRIMARY_LANGUAGES = Object.freeze({
  "es": { label: "Español", locale: "es-CO" },
  "en": { label: "English", locale: "en-US" },
  "pt": { label: "Português", locale: "pt-BR" },
  "fr": { label: "Français", locale: "fr-FR" },
  "de": { label: "Deutsch", locale: "de-DE" },
  "it": { label: "Italiano", locale: "it-IT" },
  "nl": { label: "Nederlands", locale: "nl-NL" },
  "ar": { label: "العربية", locale: "ar-AE" },
  "zh": { label: "中文", locale: "zh-CN" },
  "ja": { label: "日本語", locale: "ja-JP" },
  "ko": { label: "한국어", locale: "ko-KR" },
  "hi": { label: "हिन्दी", locale: "hi-IN" },
  "tr": { label: "Türkçe", locale: "tr-TR" },
});

export function resolveLanguage(code) {
  return PRIMARY_LANGUAGES[code] || null;
}
