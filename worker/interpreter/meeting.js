import { createInterpreterSession } from "./session.js";
import { resolveLanguage } from "./languages.js";
import { translationDirections } from "./provider.js";

export function prepareInterpretedMeeting({
  meetingId,
  provider = "google_meet",
  meetingUrl = null,
  guestLanguage = "en",
  context = {},
  extraTerms = [],
}) {
  const guest = resolveLanguage(guestLanguage);
  if (!guest) throw new Error("Unsupported primary guest language");

  const session = createInterpreterSession({
    id: meetingId ? `interpreter-${meetingId}` : undefined,
    extraTerms,
    config: { sourceLanguage: "es-CO", targetLanguage: guest.locale, mode: "meeting" },
  });

  return {
    meetingId: meetingId || null,
    provider,
    meetingUrl,
    hostLanguage: "es",
    guestLanguage,
    guestLocale: guest.locale,
    directions: translationDirections({ hostLanguage: "es", guestLanguage }),
    session,
    context: {
      contact: context.contact || null,
      company: context.company || null,
      opportunity: context.opportunity || null,
      agenda: context.agenda || null,
    },
    controls: {
      originalAudio: true,
      translatedAudio: true,
      sourceCaptions: true,
      translatedCaptions: true,
      allowInterruptions: true,
      reconnect: true,
    },
    state: "prepared",
  };
}
