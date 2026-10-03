export const INTERPRETER_VERSION = "0.1.0";

export const DEFAULT_INTERPRETER_CONFIG = Object.freeze({
  sourceLanguage: "es-CO",
  targetLanguage: "en-US",
  mode: "meeting",
  preserveMeaning: true,
  preserveTone: true,
  preserveEmotion: true,
  preservePauses: true,
  technicalGlossary: true,
  captions: true,
  transcript: true,
  maxTargetLatencyMs: 2000,
  disclosureRequired: true,
});

export const SUPPORTED_MODES = Object.freeze([
  "meeting",
  "phone",
  "whatsapp_text",
  "whatsapp_voice",
  "in_person",
]);

export function createInterpreterConfig(overrides = {}) {
  const config = { ...DEFAULT_INTERPRETER_CONFIG, ...overrides };
  if (!SUPPORTED_MODES.includes(config.mode)) throw new Error("Unsupported interpreter mode");
  if (!config.sourceLanguage || !config.targetLanguage) throw new Error("Both languages are required");
  return config;
}
