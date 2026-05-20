import { useEffect, useCallback, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

export interface TwilioVoicePluginInterface {
  register(options: { token: string }): Promise<void>;
  unregister(): Promise<void>;
  answer(): Promise<void>;
  reject(): Promise<void>;
  hangup(): Promise<void>;
  mute(options: { muted: boolean }): Promise<void>;
  addListener(
    event: string,
    handler: (data: Record<string, string>) => void,
  ): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

const TwilioVoice = registerPlugin<TwilioVoicePluginInterface>("TwilioVoice");

// Temporary debug instrumentation — fire-and-forget POSTs to server so we can
// trace the hook's lifecycle from DO runtime logs. Drop this once Twilio Voice
// registration is confirmed working in TestFlight builds.
function debugPing(stage: string, extra: Record<string, unknown> = {}) {
  try {
    fetch("/api/_debug/client-log", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "useTwilioVoice",
        stage,
        ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
        hasCapacitor: typeof window !== "undefined" && typeof (window as any).Capacitor !== "undefined",
        ...extra,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

export interface CallEvent {
  from?: string;
  to?: string;
  callSid?: string;
  sid?: string;
  error?: string;
  deviceToken?: string;
  message?: string;
}

export interface TwilioVoiceOptions {
  onIncomingCall?: (data: CallEvent) => void;
  onCallAnswered?: (data: CallEvent) => void;
  onCallConnected?: (data: CallEvent) => void;
  onCallEnded?: (data: CallEvent) => void;
  onCallDisconnected?: (data: CallEvent) => void;
  onCallCancelled?: (data: CallEvent) => void;
  onCallFailed?: (data: CallEvent) => void;
  onRegistered?: (data: CallEvent) => void;
  onRegistrationError?: (data: CallEvent) => void;
}

export function useTwilioVoice(options: TwilioVoiceOptions = {}) {
  const isNative = Capacitor.isNativePlatform();
  const listenersRef = useRef<Array<{ remove: () => void }>>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fetchTokenAndRegister = useCallback(async () => {
    debugPing("fetchTokenAndRegister:start", { isNative });
    if (!isNative) {
      debugPing("fetchTokenAndRegister:skipped-not-native");
      return;
    }
    try {
      const res = await fetch("/api/twilio/token", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        debugPing("fetchTokenAndRegister:token-fetch-failed", { status: res.status });
        throw new Error(`Token fetch failed: ${res.status}`);
      }
      const { token } = await res.json();
      debugPing("fetchTokenAndRegister:calling-register", { tokenLen: typeof token === "string" ? token.length : 0 });
      await TwilioVoice.register({ token });
      debugPing("fetchTokenAndRegister:register-resolved");
    } catch (err) {
      debugPing("fetchTokenAndRegister:catch", { error: err instanceof Error ? err.message : String(err) });
      console.error("[TwilioVoice] Registration failed:", err);
    }
  }, [isNative]);

  useEffect(() => {
    debugPing("effect:mount", { isNative });
    if (!isNative) {
      debugPing("effect:skipped-not-native");
      return;
    }

    const eventMap: Array<[string, keyof TwilioVoiceOptions]> = [
      ["incomingCall", "onIncomingCall"],
      ["callAnswered", "onCallAnswered"],
      ["callConnected", "onCallConnected"],
      ["callEnded", "onCallEnded"],
      ["callDisconnected", "onCallDisconnected"],
      ["callCancelled", "onCallCancelled"],
      ["callFailed", "onCallFailed"],
      ["registered", "onRegistered"],
      ["registrationError", "onRegistrationError"],
    ];

    const setup = async () => {
      try {
        debugPing("setup:adding-listeners");
        for (const [event, handlerKey] of eventMap) {
          const handle = await TwilioVoice.addListener(event, (data) => {
            const handler = optionsRef.current[handlerKey] as
              | ((d: CallEvent) => void)
              | undefined;
            handler?.(data as CallEvent);
          });
          listenersRef.current.push(handle);
        }
        debugPing("setup:listeners-added");
        await fetchTokenAndRegister();
      } catch (err) {
        debugPing("setup:catch", { error: err instanceof Error ? err.message : String(err) });
        console.warn("[TwilioVoice] Native plugin not available:", err);
      }
    };

    setup();

    return () => {
      listenersRef.current.forEach((l) => l.remove());
      listenersRef.current = [];
    };
  }, [isNative, fetchTokenAndRegister]);

  const answer = useCallback(async () => {
    if (!isNative) return;
    await TwilioVoice.answer();
  }, [isNative]);

  const reject = useCallback(async () => {
    if (!isNative) return;
    await TwilioVoice.reject();
  }, [isNative]);

  const hangup = useCallback(async () => {
    if (!isNative) return;
    await TwilioVoice.hangup();
  }, [isNative]);

  const mute = useCallback(
    async (muted: boolean) => {
      if (!isNative) return;
      await TwilioVoice.mute({ muted });
    },
    [isNative],
  );

  return {
    isNative,
    answer,
    reject,
    hangup,
    mute,
    refetchToken: fetchTokenAndRegister,
  };
}
