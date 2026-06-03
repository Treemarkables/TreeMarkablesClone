import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTwilioVoice, CallEvent } from "@/hooks/useTwilioVoice";
import { Mic, MicOff, Volume2, Phone } from "lucide-react";

// Inbound calls use the native iOS CallKit UI whenever iOS will present it —
// i.e. when the call is answered from the lock screen or with the app in the
// background. In those cases iOS owns the whole screen and we render nothing.
//
// When the app is already in the FOREGROUND, iOS deliberately does NOT take
// over the screen after you answer — it tucks the call into the Dynamic Island.
// There's no API to force the native full-screen call UI in that case, so to
// keep the experience consistent we draw our own call screen styled to match
// iOS. It is shown ONLY for calls that arrived in the foreground (the native
// `foreground` flag on the incomingCall event), so it never competes with the
// real native UI in the lock-screen case.

type CallState = "idle" | "connecting" | "active" | "ended";

interface CallInfo {
  from?: string;
  callerName?: string;
  foreground: boolean;
}

export function TwilioCallProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
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

  const { isNative, hangup, mute, setSpeaker } = useTwilioVoice({
    onIncomingCall: handleIncomingCall,
    onCallAnswered: handleCallAnswered,
    onCallConnected: handleCallConnected,
    onCallEnded: handleCallEnded,
    onCallDisconnected: handleCallEnded,
    onCallCancelled: reset,
    onCallFailed: reset,
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

  // Only our own call screen for foreground calls that have been answered.
  const showOverlay =
    isNative &&
    !!callInfo?.foreground &&
    (callState === "connecting" || callState === "active");

  return (
    <>
      {children}
      {showOverlay && callInfo && (
        <CallScreen
          callState={callState}
          callInfo={callInfo}
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
