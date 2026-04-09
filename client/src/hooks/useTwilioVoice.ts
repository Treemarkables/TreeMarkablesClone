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
    if (!isNative) return;
    try {
      const res = await fetch("/api/twilio/token", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
      const { token } = await res.json();
      await TwilioVoice.register({ token });
    } catch (err) {
      console.error("[TwilioVoice] Registration failed:", err);
    }
  }, [isNative]);

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
    ];

    const setup = async () => {
      try {
        for (const [event, handlerKey] of eventMap) {
          const handle = await TwilioVoice.addListener(event, (data) => {
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
