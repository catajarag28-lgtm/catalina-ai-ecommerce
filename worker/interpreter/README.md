# Carolina Live Interpreter

Isolated subsystem for multilingual conversations. It does not modify Carolina acquisition, outreach, proposals, CRM, or deployment behavior.

## Product contract
- Human remains the speaker and decision maker.
- AI translates/interprets; it does not impersonate Catalina.
- Use is disclosed to meeting participants.
- Preserve meaning before style.
- Preserve tone, pauses, emotion and professional terminology when the selected provider supports it.
- Captions remain available as a safety fallback.
- Low-confidence audio must request clarification instead of inventing.
- Provider adapters are replaceable so Carolina is not locked to one vendor.

## Planned adapters
1. Realtime high-quality speech-to-speech provider.
2. Local/open-source provider for low-cost operation.
3. Virtual audio device bridge for Meet/Zoom/Teams.
4. Telephony/SIP bridge.
5. WhatsApp text and voice-note bridge.

## Isolation
This module is feature-flagged and lives under worker/interpreter. Do not route production traffic here until audio integration tests and human listening tests pass.
