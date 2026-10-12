import { useEffect, useCallback, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  VOICE_TOKEN_TTL_SECONDS,
  clampVoiceTokenTtl,
  voiceTokenIsDue,
  voiceTokenRefreshDelayMs,
} from "@shared/voiceToken";

export interface TwilioVoicePluginInterface {
  register(options: { token: string }): Promise<void>;
  unregister(): Promise<void>;
  answer(): Promise<void>;
  reject(): Promise<void>;
  hangup(): Promise<void>;
  mute(options: { muted: boolean }): Promise<void>;
  setSpeaker(options: { on: boolean }): Promise<void>;
  sendDigits(options: { digits: string }): Promise<void>;
  showAudioRoutePicker(): Promise<void>;
  addListener(
    event: string,
    handler: (data: Record<string, string>) => void,
  ): Promise<{ remove: () => void }>;
  removeAllListeners(): Promise<void>;
}

const TwilioVoice = registerPlugin<TwilioVoicePluginInterface>("TwilioVoice");

export interface CallEvent {
  from?: string;
  to?: string;
  callSid?: string;
  callerName?: string;
  sid?: string;
  error?: string;
  // Twilio error code as a string ("31005"). The native plugin adds this;
  // older TestFlight builds only send `error` (the localized description).
  errorCode?: string;
  errorDomain?: string;
  deviceToken?: string;
  message?: string;
  // "true" when the app was in the foreground as the call arrived (captured
  // natively before CallKit is presented). TwilioCallContext shows the in-app
  // call screen when this is true OR the webview is currently visible — the
  // foreground flag is the reliable signal for app-open calls, while visibility
  // covers answering a backgrounded/locked call then opening the app.
  foreground?: string;
  // "audioRoute" event payload — the native side's ground truth for where iOS
  // is actually playing call audio. `outputs` is the live route (e.g. "Speaker",
  // "Receiver"), `onSpeaker` whether that route is the built-in speaker, and
  // `speakerSelected` what the user asked for; a sustained mismatch is the
  // speaker bug. Device logs are unreadable on the owner's setup, so the
  // in-app call screen displaying these IS the diagnostic channel.
  context?: string;
  outputs?: string;
  onSpeaker?: string;
  speakerSelected?: string;
  category?: string;
  mode?: string;
  options?: string;
  // Native app version "1.0(37)" — the webview loads from the production
  // server, so the UI version and the installed native build can differ;
  // this disambiguates which native code produced an event.
  nativeBuild?: string;
  // "callConnected" timing (incoming calls only): ms from the CallKit answer
  // action to media connected / to audio-session activation. Splits the
  // "silence after answering" wait into app-side vs network-side time.
  answerToConnectMs?: string;
  answerToActivateMs?: string;
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
  onAudioRoute?: (data: CallEvent) => void;
}

export function useTwilioVoice(options: TwilioVoiceOptions = {}) {
  const isNative = Capacitor.isNativePlatform();
  const listenersRef = useRef<Array<{ remove: () => void }>>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const issuedAtRef = useRef(0);
  const ttlRef = useRef(VOICE_TOKEN_TTL_SECONDS);
  const refreshTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const fetchRef = useRef<() => Promise<void>>(async () => {});

  const armRefresh = useCallback((delayMs: number) => {
    if (refreshTimerRef.current != null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      void fetchRef.current();
    }, delayMs);
  }, []);

  const fetchTokenAndRegister = useCallback(async () => {
    if (!isNative) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const hadLiveToken =
      issuedAtRef.current > 0 &&
      !voiceTokenIsDue(issuedAtRef.current, ttlRef.current, Date.now());
    try {
      // Tell the server which platform we are so it can pick the right Twilio
      // push credential (APNs for iOS, FCM for Android).
      const res = await fetch("/api/twilio/token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: Capacitor.getPlatform() }),
      });
      const bodyText = await res.text();
      if (!res.ok) {
        // Surface the server's actual message (e.g. 401 not-authenticated, or
        // 503 "Twilio API Key not configured") — logging the bare Error object
        // serialises to "{}" in the iOS webview console and hides the cause.
        console.error(
          `[TwilioVoice] token endpoint returned ${res.status}: ${bodyText}`,
        );
        // A failed token fetch means this device never (re)binds with Twilio,
        // so inbound calls silently stop ringing here. Route it through the
        // registrationError handler so the UI can tell the user instead of
        // only whispering into the webview console.
        if (!hadLiveToken) {
          optionsRef.current.onRegistrationError?.({
            message: `Couldn't authorise this device for incoming calls (${res.status}). Try logging in again.`,
          });
        }
        armRefresh(60_000);
        return;
      }
      const data = JSON.parse(bodyText) as {
        token?: string;
        pushEnabled?: boolean;
        ttl?: number;
      };
      if (!data.token) {
        console.error("[TwilioVoice] token endpoint returned no token:", bodyText);
        if (!hadLiveToken) {
          optionsRef.current.onRegistrationError?.({
            message: "Couldn't authorise this device for incoming calls (no token).",
          });
        }
        armRefresh(60_000);
        return;
      }
      if (data.pushEnabled === false) {
        console.warn(
          "[TwilioVoice] token issued but VoIP push is DISABLED (TWILIO_PUSH_CREDENTIAL_SID not set) — the app cannot receive inbound calls.",
        );
      }
      ttlRef.current = clampVoiceTokenTtl(data.ttl ?? VOICE_TOKEN_TTL_SECONDS);
      await TwilioVoice.register({ token: data.token });
      issuedAtRef.current = Date.now();
      armRefresh(voiceTokenRefreshDelayMs(ttlRef.current));
      console.log("[TwilioVoice] register() ok — requested VoIP registration");
    } catch (err) {
      console.error(
        "[TwilioVoice] Registration failed:",
        err instanceof Error ? err.message : String(err),
      );
      if (!hadLiveToken) {
        optionsRef.current.onRegistrationError?.({
          message: err instanceof Error ? err.message : String(err),
        });
      }
      armRefresh(60_000);
    } finally {
      inFlightRef.current = false;
    }
  }, [isNative, armRefresh]);
  fetchRef.current = fetchTokenAndRegister;

  useEffect(() => {
    if (!isNative) return;

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
      ["audioRoute", "onAudioRoute"],
    ];

    const setup = async () => {
      try {
        for (const [event, handlerKey] of eventMap) {
          const handle = await TwilioVoice.addListener(event, (data) => {
            if (event === "registered") {
              // Heartbeat the server so an inbound call can skip <Client>
              // once this token has expired and no refresh has landed.
              void fetch("/api/twilio/presence", {
                method: "POST",
                credentials: "include",
              }).catch((err) => {
                console.warn("[TwilioVoice] presence heartbeat failed:", err);
              });
            }
            const handler = optionsRef.current[handlerKey] as
              | ((d: CallEvent) => void)
              | undefined;
            handler?.(data as CallEvent);
          });
          listenersRef.current.push(handle);
        }
        await fetchTokenAndRegister();
      } catch (err) {
        console.warn("[TwilioVoice] Native plugin not available:", err);
      }
    };

    setup();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // iOS suspends timers while the webview is backgrounded, so the
      // scheduled refresh may have been skipped. Catch up on foreground.
      if (voiceTokenIsDue(issuedAtRef.current, ttlRef.current, Date.now())) {
        void fetchRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimerRef.current != null) window.clearTimeout(refreshTimerRef.current);
      listenersRef.current.forEach((l) => l.remove());
      listenersRef.current = [];
    };
  }, [isNative, fetchTokenAndRegister]);

  const answer = useCallback(async () => {
    if (!isNative) return;
    try {
      await TwilioVoice.answer();
    } catch (err) {
      console.warn("[TwilioVoice] answer failed:", err);
    }
  }, [isNative]);

  const reject = useCallback(async () => {
    if (!isNative) return;
    try {
      await TwilioVoice.reject();
    } catch (err) {
      console.warn("[TwilioVoice] reject failed:", err);
    }
  }, [isNative]);

  const hangup = useCallback(async () => {
    if (!isNative) return;
    try {
      await TwilioVoice.hangup();
    } catch (err) {
      console.warn("[TwilioVoice] hangup failed:", err);
    }
  }, [isNative]);

  const mute = useCallback(
    async (muted: boolean) => {
      if (!isNative) return;
      try {
        await TwilioVoice.mute({ muted });
      } catch (err) {
        console.warn("[TwilioVoice] mute failed:", err);
      }
    },
    [isNative],
  );

  // These three RETHROW after logging (unlike mute/hangup): a bridge-level
  // rejection ("method not implemented") was silently swallowed here for
  // months while the stale .m CAP_PLUGIN method list dropped setSpeaker —
  // callers must be able to surface the failure on screen.
  const setSpeaker = useCallback(
    async (on: boolean) => {
      if (!isNative) return;
      try {
        await TwilioVoice.setSpeaker({ on });
      } catch (err) {
        console.warn("[TwilioVoice] setSpeaker failed:", err);
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [isNative],
  );

  const sendDigits = useCallback(
    async (digits: string) => {
      if (!isNative) return;
      try {
        await TwilioVoice.sendDigits({ digits });
      } catch (err) {
        console.warn("[TwilioVoice] sendDigits failed:", err);
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    [isNative],
  );

  const showAudioRoutePicker = useCallback(async () => {
    if (!isNative) return;
    try {
      await TwilioVoice.showAudioRoutePicker();
    } catch (err) {
      console.warn("[TwilioVoice] showAudioRoutePicker failed:", err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }, [isNative]);

  return {
    isNative,
    answer,
    reject,
    hangup,
    mute,
    setSpeaker,
    sendDigits,
    showAudioRoutePicker,
    refetchToken: fetchTokenAndRegister,
  };
}
