import {
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTwilioVoice, CallEvent } from "@/hooks/useTwilioVoice";
import { useToast } from "@/hooks/use-toast";
import { Grip, Mic, MicOff, Volume2, Phone } from "lucide-react";

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

/// Ground truth from the native side about where iOS is actually playing call
/// audio — drives the "Audio: Speaker/Receiver" line on the call screen. The
/// full native payload (errors, session config, emitting event) still lands in
/// the console via handleAudioRoute for Web-Inspector debugging.
interface AudioRouteInfo {
  outputs: string;
}

export function TwilioCallProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [callState, setCallState] = useState<CallState>("idle");
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [audioRoute, setAudioRoute] = useState<AudioRouteInfo | null>(null);

  const refreshCallHistory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
  }, [queryClient]);

  const reset = useCallback(() => {
    setCallState("idle");
    setCallInfo(null);
    setIsMuted(false);
    setIsSpeaker(false);
    setAudioRoute(null);
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

  const handleCallEnded = useCallback(
    (data?: CallEvent) => {
      // A call that ends WITH an error is the SDK dropping it (media error,
      // signaling failure) — not the user or the far end hanging up. Owner
      // hit exactly this on build 37 ("answered then hung itself up") with
      // no visible reason anywhere. Put the reason in their face.
      if (data?.error) {
        toast({
          variant: "destructive",
          title: "Call dropped",
          description: data.error,
        });
      }
      setCallState("ended");
      refreshCallHistory();
      setTimeout(reset, 800);
    },
    [refreshCallHistory, reset, toast],
  );

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

  // The native side emits "audioRoute" on every route event (setSpeaker,
  // didActivate, routeChange, callDidConnect) with what iOS ACTUALLY routed
  // to. Mirror the output into state so the call screen can display it — the
  // console line is the Web-Inspector trace of the whole route history
  // (errors, session config, emitting event) and the permanent safety net.
  const handleAudioRoute = useCallback((data: CallEvent) => {
    console.log("[TwilioCall] audioRoute", data);
    setAudioRoute({ outputs: data.outputs || "" });
  }, []);

  const { isNative, hangup, mute, setSpeaker, sendDigits, showAudioRoutePicker } = useTwilioVoice({
    onIncomingCall: handleIncomingCall,
    onCallAnswered: handleCallAnswered,
    onCallConnected: handleCallConnected,
    onCallEnded: handleCallEnded,
    onCallDisconnected: handleCallEnded,
    onCallCancelled: reset,
    // Failed-to-connect carries an error too — same visibility treatment.
    onCallFailed: handleCallEnded,
    onRegistered: handleRegistered,
    onRegistrationError: handleRegistrationError,
    onAudioRoute: handleAudioRoute,
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

  // The hook methods rethrow after console.warn-ing (the permanent trace for
  // bridge-level failures like the stale .m method list) — catch here so a
  // rejection doesn't become an unhandled-promise error.
  const onToggleSpeaker = useCallback(() => {
    setIsSpeaker((s) => {
      const next = !s;
      setSpeaker(next).catch(() => {});
      return next;
    });
  }, [setSpeaker]);

  const onSendDigit = useCallback(
    (digit: string) => {
      sendDigits(digit).catch(() => {});
    },
    [sendDigits],
  );

  const onShowRoutePicker = useCallback(() => {
    showAudioRoutePicker().catch(() => {});
  }, [showAudioRoutePicker]);

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
          audioRoute={audioRoute}
          onHangup={onHangup}
          onToggleMute={onToggleMute}
          onToggleSpeaker={onToggleSpeaker}
          onSendDigit={onSendDigit}
          onShowRoutePicker={onShowRoutePicker}
        />
      )}
    </>
  );
}

// Standard telephone keypad, letters included like the native dialer.
const KEYPAD_KEYS: Array<{ digit: string; letters: string }> = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
];

function CallScreen({
  callState,
  callInfo,
  isMuted,
  isSpeaker,
  audioRoute,
  onHangup,
  onToggleMute,
  onToggleSpeaker,
  onSendDigit,
  onShowRoutePicker,
}: {
  callState: CallState;
  callInfo: CallInfo;
  isMuted: boolean;
  isSpeaker: boolean;
  audioRoute: AudioRouteInfo | null;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onSendDigit: (digit: string) => void;
  onShowRoutePicker: () => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  // Digits already sent this call, echoed above the keypad like the native
  // dialer so the user can follow along with an IVR menu.
  const [dialedDigits, setDialedDigits] = useState("");

  const pressKey = (digit: string) => {
    setDialedDigits((d) => (d + digit).slice(-24));
    onSendDigit(digit);
  };

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
    // pointer-events-auto: a Radix modal (Dialog/AlertDialog/Sheet) sets
    // pointer-events:none on <body> while open, which this overlay inherits —
    // it sits ABOVE the modal (z-9999 vs z-50) so the modal is invisible, yet
    // every call control silently stops responding. Hit in the field when the
    // job-video "Generate quote description?" prompt auto-opened mid-call as
    // an upload finished: speaker + hang-up dead with no visible cause.
    <div className="pointer-events-auto fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-gradient-to-b from-neutral-800 to-neutral-950 text-white px-8 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      {/* Caller identity — collapses to a compact header while the keypad is
          open so the grid fits without scrolling, like the native dialer. */}
      {showKeypad ? (
        <div className="flex flex-col items-center text-center">
          <p className="text-xl font-semibold leading-tight">{displayName}</p>
          <p className="text-white/60 text-sm mt-1 tabular-nums">{status}</p>
          {/* Digits sent so far — feedback that each key press went through. */}
          <p className="text-2xl font-light tracking-[0.2em] tabular-nums mt-4 h-8 break-all">
            {dialedDigits}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center mt-6">
          <div className="w-28 h-28 rounded-full bg-white/15 flex items-center justify-center mb-6">
            <span className="text-5xl font-light">{initial}</span>
          </div>
          <p className="text-3xl font-semibold leading-tight">{displayName}</p>
          {callInfo.callerName && callInfo.from && (
            <p className="text-white/60 text-base mt-1">{callInfo.from}</p>
          )}
          <p className="text-white/60 text-lg mt-3 tabular-nums">{status}</p>
          {/* Ground truth from AVAudioSession: what iOS is ACTUALLY playing
              through. When the speaker button is lit but this still says
              "Receiver", the override isn't holding. */}
          {audioRoute && (
            <p
              className="text-white/40 text-xs mt-2 max-w-[85vw] break-words"
              data-testid="call-audio-route"
            >
              Audio: {audioRoute.outputs || "unknown"}
            </p>
          )}
        </div>
      )}

      {/* DTMF keypad */}
      {showKeypad && (
        <div className="grid grid-cols-3 gap-x-8 gap-y-4">
          {KEYPAD_KEYS.map(({ digit, letters }) => (
            <button
              key={digit}
              onClick={() => pressKey(digit)}
              className="w-16 h-16 rounded-full bg-white/15 active:bg-white/30 flex flex-col items-center justify-center"
              data-testid={`keypad-${digit === "*" ? "star" : digit === "#" ? "hash" : digit}`}
            >
              <span className="text-2xl font-light leading-none">{digit}</span>
              {letters && (
                <span className="text-[0.55rem] tracking-[0.15em] text-white/60 mt-0.5">
                  {letters}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="w-full max-w-xs flex flex-col items-center gap-10">
        <div className="flex justify-center gap-8">
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
            onClick={() => setShowKeypad((k) => !k)}
            className="flex flex-col items-center gap-2"
            data-testid="call-keypad"
          >
            <span
              className={`w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center transition-colors ${
                showKeypad ? "bg-white text-neutral-900" : "bg-white/15 text-white"
              }`}
            >
              <Grip className="w-7 h-7" />
            </span>
            <span className="text-sm text-white/80">Keypad</span>
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

        {/* System audio-output picker — the same control the native call UI
            uses. A route picked there is user-selected at the OS level, which
            outranks anything the app can request; the fallback when the
            Speaker toggle's programmatic route change is ignored. */}
        <button
          onClick={onShowRoutePicker}
          className="text-white/60 text-sm underline underline-offset-4 -mt-4"
          data-testid="call-route-picker"
        >
          Audio output…
        </button>

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
