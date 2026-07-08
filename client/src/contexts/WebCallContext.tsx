import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, MicOff, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  loadTwilioVoiceSdk,
  TwilioWebCall,
  TwilioWebDevice,
} from "@/lib/twilioWebSdk";

// Outgoing calls from a desktop browser via the Twilio Voice JS SDK. The
// native (Capacitor) build keeps its CallKit/tel: paths — this provider is a
// no-op there. Calls route: device.connect({ To }) → TwiML App voice URL →
// POST /api/webhooks/twilio-outgoing → <Dial> the customer with the business
// line as caller ID (recorded + logged like inbound calls).

type WebCallState = "idle" | "preparing" | "ringing" | "active";

interface CallInfo {
  number: string;
  displayName?: string;
}

interface WebCallContextValue {
  /** True when in-browser calling is possible (desktop web, not the native app). */
  webCallAvailable: boolean;
  callState: WebCallState;
  startCall: (number: string, displayName?: string) => void;
}

const WebCallContext = createContext<WebCallContextValue>({
  webCallAvailable: false,
  callState: "idle",
  startCall: () => {},
});

export function useWebCall() {
  return useContext(WebCallContext);
}

export function WebCallProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Native builds use CallKit / the OS dialer; the web dialer is for
  // browsers, where tel: links mostly go nowhere on desktop.
  const webCallAvailable = !Capacitor.isNativePlatform();
  const [callState, setCallState] = useState<WebCallState>("idle");
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const deviceRef = useRef<TwilioWebDevice | null>(null);
  const callRef = useRef<TwilioWebCall | null>(null);

  const fetchToken = useCallback(async (): Promise<{
    token: string;
    outgoingEnabled: boolean;
  }> => {
    const res = await fetch("/api/twilio/token", {
      method: "POST",
      credentials: "include",
    });
    const body = (await res.json().catch(() => null)) as {
      token?: string;
      outgoingEnabled?: boolean;
      message?: string;
    } | null;
    if (!res.ok || !body?.token) {
      throw new Error(
        body?.message || `Couldn't authorise calling (${res.status})`,
      );
    }
    return { token: body.token, outgoingEnabled: !!body.outgoingEnabled };
  }, []);

  const endCall = useCallback(() => {
    callRef.current = null;
    setCallState("idle");
    setCallInfo(null);
    setIsMuted(false);
    // Surface the just-finished call on the Calls page.
    queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
  }, [queryClient]);

  const startCall = useCallback(
    async (rawNumber: string, displayName?: string) => {
      if (!webCallAvailable) return;
      if (callRef.current) {
        toast({
          variant: "destructive",
          title: "Already on a call",
          description: "Hang up the current call before starting another.",
        });
        return;
      }
      const number = rawNumber.replace(/[^\d+]/g, "");
      if (!number) {
        toast({
          variant: "destructive",
          title: "No phone number",
          description: "That contact has no dialable number.",
        });
        return;
      }
      setCallState("preparing");
      setCallInfo({ number: rawNumber.trim(), displayName });
      try {
        const [sdk, auth] = await Promise.all([
          loadTwilioVoiceSdk(),
          fetchToken(),
        ]);
        if (!auth.outgoingEnabled) {
          throw new Error(
            "Outgoing calling isn't configured on the server (TWILIO_TWIML_APP_SID).",
          );
        }
        let device = deviceRef.current;
        if (!device) {
          // Same edge pin as the iOS app — the default "roaming" edge can
          // route NZ users through a US region with multi-second audio delays.
          device = new sdk.Device(auth.token, { edge: "sydney" });
          device.on("error", (err) => {
            console.error("[WebCall] device error:", err);
          });
          device.on("tokenWillExpire", async () => {
            try {
              const next = await fetchToken();
              deviceRef.current?.updateToken(next.token);
            } catch (err) {
              console.error("[WebCall] token refresh failed:", err);
            }
          });
          deviceRef.current = device;
        } else {
          device.updateToken(auth.token);
        }
        const call = await device.connect({ params: { To: number } });
        callRef.current = call;
        setCallState("ringing");
        call.on("accept", () => setCallState("active"));
        call.on("disconnect", endCall);
        call.on("cancel", endCall);
        call.on("reject", endCall);
        call.on("error", (err) => {
          console.error("[WebCall] call error:", err);
          toast({
            variant: "destructive",
            title: "Call failed",
            description: err?.message || "The call could not be completed.",
          });
          endCall();
        });
      } catch (err) {
        console.error("[WebCall] startCall failed:", err);
        toast({
          variant: "destructive",
          title: "Couldn't start the call",
          description: err instanceof Error ? err.message : String(err),
        });
        endCall();
      }
    },
    [webCallAvailable, fetchToken, toast, endCall],
  );

  const onHangup = useCallback(() => {
    callRef.current?.disconnect();
    endCall();
  }, [endCall]);

  const onToggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      callRef.current?.mute(next);
      return next;
    });
  }, []);

  return (
    <WebCallContext.Provider value={{ webCallAvailable, callState, startCall }}>
      {children}
      {callState !== "idle" && (
        <WebCallBar
          callState={callState}
          callInfo={callInfo}
          isMuted={isMuted}
          onHangup={onHangup}
          onToggleMute={onToggleMute}
        />
      )}
    </WebCallContext.Provider>
  );
}

// Compact floating in-call bar (bottom-right) — the desktop analogue of the
// mobile full-screen CallScreen in TwilioCallContext. Raw round buttons match
// that component's in-call control styling.
function WebCallBar({
  callState,
  callInfo,
  isMuted,
  onHangup,
  onToggleMute,
}: {
  callState: WebCallState;
  callInfo: CallInfo | null;
  isMuted: boolean;
  onHangup: () => void;
  onToggleMute: () => void;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (callState !== "active") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [callState]);

  const status =
    callState === "active"
      ? `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`
      : callState === "ringing"
        ? "Calling…"
        : "Connecting…";

  const displayName = callInfo?.displayName || callInfo?.number || "Unknown";

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex items-center gap-4 rounded-xl bg-neutral-900 text-white shadow-2xl px-5 py-4 min-w-[280px]"
      data-testid="web-call-bar"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{displayName}</p>
        {callInfo?.displayName && (
          <p className="text-white/60 text-sm truncate">{callInfo.number}</p>
        )}
        <p className="text-white/60 text-sm tabular-nums">{status}</p>
      </div>
      <button
        onClick={onToggleMute}
        className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          isMuted ? "bg-white text-neutral-900" : "bg-white/15 text-white"
        }`}
        data-testid="web-call-mute"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
      <button
        onClick={onHangup}
        className="w-11 h-11 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 active:opacity-80"
        data-testid="web-call-end"
        aria-label="End call"
      >
        <Phone className="w-5 h-5 rotate-[135deg]" />
      </button>
    </div>
  );
}
