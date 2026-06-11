import {
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTwilioVoice, CallEvent } from "@/hooks/useTwilioVoice";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Volume2, Phone } from "lucide-react";

// Inbound calls use the native iOS CallKit UI whenever iOS will present it —
// full-screen on the lock screen, the compact banner/Dynamic Island when the
// app is open. That split is an OS decision with no API to override.
//
// After answering with the app open, iOS hands the screen back to the app, so
// the in-call controls (mute/speaker/end) have to be ours. We render our call
// screen UNCONDITIONALLY for the whole connecting/active window: when the
// phone is locked or the app is backgrounded the webview isn't on screen, so
// the overlay simply can't compete with the native UI — and the moment the
// user opens the app mid-call it's already there. Earlier versions gated this
// on a foreground flag + webview visibility; both signals proved flaky
// (WKWebView visibility can stick "hidden" after returning from CallKit),
// which intermittently dumped users onto the app with the call hidden in the
// Dynamic Island and no controls.

type CallState = "idle" | "connecting" | "active" | "ended";

interface CallInfo {
  from?: string;
  callerName?: string;
  foreground: boolean;
}

export function TwilioCallProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [callState, setCallState] = useState<CallState>("idle");
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  const refreshCallHistory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
  }, [queryClient]);

  const reset = useCallback(() => {
    setCallState("idle");
    setCallInfo(null);
    setIsMuted(false);
    setIsSpeaker(false);
  }, []);

  const handleIncomingCall = useCallback((data: CallEvent) => {
    // Diagnostic: confirms the event reached the webview and what the native
    // side reported for foreground (visible in Safari Web Inspector).
    console.log("[TwilioCall] incomingCall", {
      foreground: data.foreground,
      from: data.from,
    });
    // Remember who's calling and whether iOS will hand us the in-app case.
    setCallInfo({
      from: data.from,
      callerName: data.callerName,
      foreground: data.foreground === "true",
    });
    // Don't show our screen yet — iOS shows its native ringing UI. We only take
    // over (for foreground calls) once the call is answered.
  }, []);

  const handleCallAnswered = useCallback(() => setCallState("connecting"), []);
  const handleCallConnected = useCallback(() => setCallState("active"), []);

  const handleCallEnded = useCallback(() => {
    setCallState("ended");
    refreshCallHistory();
    setTimeout(reset, 800);
  }, [refreshCallHistory, reset]);

  // Registration is the make-or-break for inbound ringing: if this device
  // isn't bound to the Twilio identity, calls go straight to voicemail with
  // no visible symptom. Log success and shout on failure.
  const handleRegistered = useCallback((data: CallEvent) => {
    console.log(
      "[TwilioCall] voice registration OK — this device will ring for inbound calls",
      { deviceToken: data.deviceToken?.slice(0, 8) },
    );
  }, []);

  const handleRegistrationError = useCallback(
    (data: CallEvent) => {
      console.error("[TwilioCall] voice registration FAILED — inbound calls will NOT ring on this device", data);
      toast({
        variant: "destructive",
        title: "Incoming calls won't ring",
        description:
          data.message ||
          "This device couldn't register for incoming calls. Close and re-open the app; if it persists, log out and back in.",
      });
    },
    [toast],
  );

  const { isNative, hangup, mute, setSpeaker } = useTwilioVoice({
    onIncomingCall: handleIncomingCall,
    onCallAnswered: handleCallAnswered,
    onCallConnected: handleCallConnected,
    onCallEnded: handleCallEnded,
    onCallDisconnected: handleCallEnded,
    onCallCancelled: reset,
    onCallFailed: reset,
    onRegistered: handleRegistered,
    onRegistrationError: handleRegistrationError,
  });

  const onHangup = useCallback(() => {
    hangup();
    setCallState("ended");
  }, [hangup]);

  const onToggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      mute(next);
      return next;
    });
  }, [mute]);

  const onToggleSpeaker = useCallback(() => {
    setIsSpeaker((s) => {
      const next = !s;
      setSpeaker(next);
      return next;
    });
  }, [setSpeaker]);

  // Render the overlay for the entire connecting/active window — no foreground
  // or visibility gating (see the header comment for why those signals failed).
  // callInfo can be null if the webview reloaded mid-call (e.g. the
  // new-build-on-foreground reload) and the retained incomingCall event was
  // already consumed; show the screen anyway with a generic caller label so
  // the user always has mute/speaker/hang-up controls.
  const showOverlay =
    isNative && (callState === "connecting" || callState === "active");

  // Diagnostic: surfaces in Safari Web Inspector why the overlay did/didn't show
  // during a live call. Gated on callState so it doesn't spam on idle renders.
  if (callState !== "idle") {
    console.log("[TwilioCall] overlay gate", {
      showOverlay,
      isNative,
      foreground: callInfo?.foreground,
      callState,
    });
  }

  return (
    <>
      {children}
      {showOverlay && (
        <CallScreen
          callState={callState}
          callInfo={callInfo ?? { foreground: false }}
          isMuted={isMuted}
          isSpeaker={isSpeaker}
          onHangup={onHangup}
          onToggleMute={onToggleMute}
          onToggleSpeaker={onToggleSpeaker}
        />
      )}
    </>
  );
}

function CallScreen({
  callState,
  callInfo,
  isMuted,
  isSpeaker,
  onHangup,
  onToggleMute,
  onToggleSpeaker,
}: {
  callState: CallState;
  callInfo: CallInfo;
  isMuted: boolean;
  isSpeaker: boolean;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
}) {
  const [seconds, setSeconds] = useState(0);

  // Count up once the call is actually connected, like the native screen.
  useEffect(() => {
    if (callState !== "active") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [callState]);

  const status =
    callState === "active"
      ? `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`
      : "Connecting…";

  const displayName = callInfo.callerName || callInfo.from || "Unknown Caller";
  const initial = (displayName.trim()[0] || "?").toUpperCase();

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-gradient-to-b from-neutral-800 to-neutral-950 text-white px-8 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      {/* Caller identity */}
      <div className="flex flex-col items-center text-center mt-6">
        <div className="w-28 h-28 rounded-full bg-white/15 flex items-center justify-center mb-6">
          <span className="text-5xl font-light">{initial}</span>
        </div>
        <p className="text-3xl font-semibold leading-tight">{displayName}</p>
        {callInfo.callerName && callInfo.from && (
          <p className="text-white/60 text-base mt-1">{callInfo.from}</p>
        )}
        <p className="text-white/60 text-lg mt-3 tabular-nums">{status}</p>
      </div>

      {/* Controls */}
      <div className="w-full max-w-xs flex flex-col items-center gap-10">
        <div className="flex justify-center gap-16">
          <button
            onClick={onToggleMute}
            className="flex flex-col items-center gap-2"
            data-testid="call-mute"
          >
            <span
              className={`w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center transition-colors ${
                isMuted ? "bg-white text-neutral-900" : "bg-white/15 text-white"
              }`}
            >
              {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </span>
            <span className="text-sm text-white/80">{isMuted ? "Unmute" : "Mute"}</span>
          </button>

          <button
            onClick={onToggleSpeaker}
            className="flex flex-col items-center gap-2"
            data-testid="call-speaker"
          >
            <span
              className={`w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center transition-colors ${
                isSpeaker ? "bg-white text-neutral-900" : "bg-white/15 text-white"
              }`}
            >
              <Volume2 className="w-7 h-7" />
            </span>
            <span className="text-sm text-white/80">Speaker</span>
          </button>
        </div>

        <button
          onClick={onHangup}
          className="w-[4.5rem] h-[4.5rem] rounded-full bg-red-600 flex items-center justify-center active:opacity-80"
          data-testid="call-end"
          aria-label="End call"
        >
          <Phone className="w-7 h-7 rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}
