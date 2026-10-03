import { createInterpreterConfig } from "./config.js";
import { glossaryPrompt } from "./glossary.js";

export function createInterpreterSession(input = {}) {
  const config = createInterpreterConfig(input.config);
  return {
    id: input.id || crypto.randomUUID(),
    status: "ready",
    createdAt: new Date().toISOString(),
    config,
    glossary: glossaryPrompt(input.extraTerms),
    disclosure: input.disclosure || "I use AI-assisted live interpretation so we can each speak naturally in our preferred language.",
    metrics: { turns: 0, errors: 0, fallbackUses: 0, latencyMs: [] },
  };
}

export function qualityGate({ latencyMs, confidence = 1, hasAudio = true }) {
  if (!hasAudio) return { ok: false, action: "caption_only", reason: "no_audio" };
  if (confidence < 0.82) return { ok: false, action: "clarify", reason: "low_confidence" };
  if (latencyMs > 2500) return { ok: false, action: "fallback", reason: "high_latency" };
  return { ok: true, action: "speak", reason: "quality_pass" };
}
