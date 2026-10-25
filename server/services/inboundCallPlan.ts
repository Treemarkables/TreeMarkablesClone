// Who an inbound call should ring, and what to do when that dial ends.
//
// The iOS app and the owner's mobile normally ring together. Two cases must
// not end the call there:
//   1. No device is registered for the Voice identity. Dialling that <Client>
//      in the same <Dial> as the mobile can fail the whole verb before the
//      mobile rings. Ring the app on its own first, then the mobile. Skipping
//      the app entirely is what sent callers straight to voicemail on
//      26 Oct 2026 once the one-hour presence row had expired.
//   2. The app connects and then drops (Twilio 31005 "Connection error",
//      seen 12 Oct 2026 on call CA19d6cefc551084fcf62ba33e7eb8dfb3: answered
//      for 1 second, transcript "You"). Twilio reports that as DialCallStatus
//      completed, and the old handler hung up instead of falling through.

export type VoicePresence = "registered" | "unregistered" | "unknown";
export type DialLeg = "both" | "client" | "phone" | "none";

export const SHORT_BRIDGE_SECONDS = 3;

export function planInboundRing(input: {
  clientConfigured: boolean;
  presence: VoicePresence;
  hasOwnerPhone: boolean;
}): { dialClient: boolean; dialPhone: boolean; leg: DialLeg } {
  // Unknown presence fails open and still dials the app beside the mobile.
  // A missing heartbeat (first boot, presence table unread) must not send
  // every call to the mobile.
  // A definite "unregistered" still dials the app — that is the only thing
  // that can ring the iPhone — but not in the same <Dial> as the mobile, so a
  // dead identity cannot cancel the mobile. The follow-up rings the mobile
  // if the app leg does not connect. Leaving the app out, with no mobile
  // configured, is an immediate redirect to voicemail.
  const dialClient = input.clientConfigured;
  const dialPhone = input.hasOwnerPhone && input.presence !== "unregistered";
  const leg: DialLeg = dialClient && dialPhone
    ? "both"
    : dialClient
      ? "client"
      : dialPhone
        ? "phone"
        : "none";
  return { dialClient, dialPhone, leg };
}

export function parseDialLeg(value: unknown): DialLeg {
  if (value === "client" || value === "phone" || value === "none" || value === "both") {
    return value;
  }
  return "both";
}

export function parseDialCallDuration(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function isVoiceClientParty(to: string): boolean {
  const value = to.trim().toLowerCase();
  return value.startsWith("client:") || value.startsWith("inflow-");
}

export function isPhoneParty(to: string): boolean {
  const value = to.trim();
  return value.startsWith("+") || /^\d/.test(value);
}

export type DialFollowup =
  | { action: "hangup" }
  | { action: "voicemail" }
  | { action: "dial-phone" }
  | { action: "lookup" };

export function decideInboundDialFollowup(input: {
  leg: DialLeg;
  dialStatus: string;
  dialCallDuration: number | null;
  hasOwnerPhone: boolean;
  /**
   * Omit on the first pass when the answered party is not known yet.
   * null means a lookup was attempted and Twilio didn't say who answered.
   */
  answeredTo?: string | null;
}): DialFollowup {
  const status = input.dialStatus.trim().toLowerCase();
  const connected = status === "completed" || status === "answered";
  // Missing duration is not treated as a drop — Twilio omits it for some
  // conference legs, and forwarding those would ring the mobile after a
  // real conversation. A measured bridge of a few seconds is the drop.
  const short = input.dialCallDuration != null && input.dialCallDuration <= SHORT_BRIDGE_SECONDS;

  if (input.leg === "none") {
    return { action: "voicemail" };
  }

  // The mobile was the only thing we dialled. A short answer is a real
  // pickup (they hung up), not an app crash. Don't ring them again.
  if (input.leg === "phone") {
    if (connected) return { action: "hangup" };
    return { action: "voicemail" };
  }

  if (connected && !short) return { action: "hangup" };

  if (connected && short) {
    if (input.answeredTo === undefined) return { action: "lookup" };
    const to = input.answeredTo ?? "";
    if (isPhoneParty(to) && !isVoiceClientParty(to)) return { action: "hangup" };
    if (!input.hasOwnerPhone) return { action: "voicemail" };
    // App leg, or we couldn't tell. The caller already got cut off — ring the mobile.
    return { action: "dial-phone" };
  }

  // failed/canceled: an unregistered <Client> in a simultaneous <Dial> can
  // end the verb before the <Number> rings. Try the mobile on its own.
  if (status === "failed" || status === "canceled" || status === "cancelled") {
    return input.hasOwnerPhone ? { action: "dial-phone" } : { action: "voicemail" };
  }

  // The app was dialled on its own because we didn't trust it to share a
  // <Dial> with the mobile. It never connected — give the mobile its own
  // chance before voicemail. A simultaneous "both" no-answer already let the
  // mobile ring for the timeout, so that still goes to voicemail.
  if ((status === "no-answer" || status === "busy") && input.leg === "client") {
    return input.hasOwnerPhone ? { action: "dial-phone" } : { action: "voicemail" };
  }

  return { action: "voicemail" };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const HANGUP_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';

export function recoveryPhoneDialTwiml(input: {
  ownerPhone: string;
  actionUrl: string;
  recordingCallbackUrl: string;
}): string {
  const action = escapeXml(input.actionUrl);
  const recording = escapeXml(input.recordingCallbackUrl);
  const phone = escapeXml(input.ownerPhone);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial
    record="record-from-answer"
    answerOnBridge="true"
    recordingStatusCallback="${recording}"
    recordingStatusCallbackEvent="completed"
    timeout="20"
    action="${action}"
  >
    <Number>${phone}</Number>
  </Dial>
</Response>`;
}
