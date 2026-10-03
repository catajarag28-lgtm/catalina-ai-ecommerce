import test from "node:test";
import assert from "node:assert/strict";
import { PRIMARY_LANGUAGES } from "../worker/interpreter/languages.js";
import { prepareInterpretedMeeting } from "../worker/interpreter/meeting.js";
import { buildTranslationSession, translationDirections } from "../worker/interpreter/provider.js";

test("primary commercial languages are configured", () => {
  for (const code of ["es","en","pt","fr","de","it","nl","ar","zh","ja","ko","hi"]) assert.ok(PRIMARY_LANGUAGES[code]);
});

test("meeting prepares two independent translation directions", () => {
  const meeting = prepareInterpretedMeeting({ meetingId: "abc", guestLanguage: "de", context: { company: "Acme" } });
  assert.equal(meeting.state, "prepared");
  assert.equal(meeting.directions.length, 2);
  assert.deepEqual(meeting.directions[0], { speaker: "host", source: "es", target: "de" });
  assert.deepEqual(meeting.directions[1], { speaker: "guest", source: "de", target: "es" });
  assert.equal(meeting.context.company, "Acme");
});

test("provider session is interpretation-only and context aware", () => {
  const payload = buildTranslationSession({ targetLanguage: "English", context: "Shopify sales call", glossary: "n8n, COD" });
  assert.equal(payload.model, "gpt-realtime-translate");
  assert.match(payload.instructions, /Never add facts/);
  assert.match(payload.instructions, /Shopify/);
});

test("same-language direction is rejected", () => {
  assert.throws(() => translationDirections({ hostLanguage: "es", guestLanguage: "es" }));
});
