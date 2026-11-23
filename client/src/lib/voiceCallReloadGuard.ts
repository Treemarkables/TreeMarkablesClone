// A page reload mid-call tears down the WKWebView audio session and the
// Twilio signaling socket. Chunk-error recovery and the boot script both
// reload on a missing asset; they must wait while a call is up.

declare global {
  interface Window {
    __INFLOW_CALL_ACTIVE?: boolean;
  }
}

let voiceCallActive = false;

export function setVoiceCallActive(active: boolean): void {
  voiceCallActive = active;
  if (typeof window !== "undefined") {
    window.__INFLOW_CALL_ACTIVE = active;
  }
}

export function isVoiceCallActive(): boolean {
  return voiceCallActive || (typeof window !== "undefined" && window.__INFLOW_CALL_ACTIVE === true);
}
