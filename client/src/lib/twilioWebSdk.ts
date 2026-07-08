// Loader + minimal typings for the vendored Twilio Voice JS SDK browser
// bundle (client/public/vendor/twilio-voice-sdk-2.18.3.min.js — the
// @twilio/voice-sdk dist build, which exposes window.Twilio.Device).
// Vendored instead of npm so the web dialer adds no package.json dependency,
// and script-injected on demand so the ~300KB bundle is only fetched when a
// call is actually placed.

export interface TwilioWebCall {
  on(event: "accept" | "disconnect" | "cancel" | "reject", handler: () => void): void;
  on(event: "error", handler: (error: { message?: string }) => void): void;
  disconnect(): void;
  mute(shouldMute: boolean): void;
  isMuted(): boolean;
  sendDigits(digits: string): void;
}

export interface TwilioWebDevice {
  connect(options: { params: Record<string, string> }): Promise<TwilioWebCall>;
  updateToken(token: string): void;
  destroy(): void;
  on(event: "error", handler: (error: { message?: string }) => void): void;
  on(event: "tokenWillExpire", handler: () => void): void;
}

export interface TwilioGlobal {
  Device: new (
    token: string,
    options?: { edge?: string },
  ) => TwilioWebDevice;
}

const SDK_URL = "/vendor/twilio-voice-sdk-2.18.3.min.js";

let loadPromise: Promise<TwilioGlobal> | null = null;

function getTwilioGlobal(): TwilioGlobal | undefined {
  return (window as Window & { Twilio?: TwilioGlobal }).Twilio;
}

export function loadTwilioVoiceSdk(): Promise<TwilioGlobal> {
  const existing = getTwilioGlobal();
  if (existing?.Device) return Promise.resolve(existing);
  if (!loadPromise) {
    loadPromise = new Promise<TwilioGlobal>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => {
        const loaded = getTwilioGlobal();
        if (loaded?.Device) resolve(loaded);
        else reject(new Error("Twilio Voice SDK loaded but Device is missing"));
      };
      script.onerror = () => {
        // Allow a retry on the next call attempt after a transient fetch failure.
        loadPromise = null;
        reject(new Error("Failed to load the Twilio Voice SDK"));
      };
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}
