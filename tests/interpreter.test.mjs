import test from "node:test";
import assert from "node:assert/strict";
import { createInterpreterConfig } from "../worker/interpreter/config.js";
import { createInterpreterSession, qualityGate } from "../worker/interpreter/session.js";

test("interpreter defaults to Colombian Spanish and US English", () => {
  const config = createInterpreterConfig();
  assert.equal(config.sourceLanguage, "es-CO");
  assert.equal(config.targetLanguage, "en-US");
  assert.equal(config.disclosureRequired, true);
});

test("interpreter is isolated and supports meeting mode", () => {
  const session = createInterpreterSession({ id: "test-session" });
  assert.equal(session.status, "ready");
  assert.match(session.glossary, /n8n/);
  assert.match(session.glossary, /Shopify/);
});

test("quality gate refuses uncertain speech", () => {
  assert.equal(qualityGate({ latencyMs: 500, confidence: 0.5 }).action, "clarify");
});

test("quality gate falls back on excessive latency", () => {
  assert.equal(qualityGate({ latencyMs: 3000, confidence: 0.99 }).action, "fallback");
});

test("quality gate allows high-quality low-latency speech", () => {
  assert.equal(qualityGate({ latencyMs: 900, confidence: 0.98 }).action, "speak");
});
