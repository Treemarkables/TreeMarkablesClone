import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { useTwilioVoice, CallEvent } from "@/hooks/useTwilioVoice";
import { Phone, PhoneOff, PhoneMissed } from "lucide-react";

export type CallState =
  | "idle"
  | "incoming"
  | "connecting"
  | "active"
  | "ended";

interface CallInfo {
  from?: string;
  callSid?: string;
}

interface TwilioCallContextValue {
  callState: CallState;
  callInfo: CallInfo | null;
  isMuted: boolean;
  answer: () => void;
  reject: () => void;
  hangup: () => void;
  toggleMute: () => void;
  isNative: boolean;
}

const TwilioCallContext = createContext<TwilioCallContextValue>({
  callState: "idle",
  callInfo: null,
  isMuted: false,
  answer: () => {},
  reject: () => {},
  hangup: () => {},
  toggleMute: () => {},
  isNative: false,
});

export function TwilioCallProvider({ children }: { children: ReactNode }) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const queryClient = useQueryClient();

  // Invalidate /api/calls after a call ends so Communications page refreshes.
  const refreshCallHistory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
  }, [queryClient]);

  const handleIncomingCall = useCallback((data: CallEvent) => {
    setCallInfo({ from: data.from, callSid: data.callSid });
    setCallState("incoming");
  }, []);

  const handleCallAnswered = useCallback(() => {
    setCallState("connecting");
  }, []);

  const handleCallConnected = useCallback(() => {
    setCallState("active");
  }, []);

  const handleCallEnded = useCallback(() => {
    setCallState("ended");
    refreshCallHistory();
    setTimeout(() => {
      setCallState("idle");
      setCallInfo(null);
      setIsMuted(false);
    }, 2000);
  }, [refreshCallHistory]);

  const handleCallDisconnected = useCallback(() => {
    setCallState("ended");
    refreshCallHistory();
    setTimeout(() => {
      setCallState("idle");
      setCallInfo(null);
      setIsMuted(false);
    }, 2000);
  }, [refreshCallHistory]);

  const handleCallCancelled = useCallback(() => {
    setCallState("idle");
    setCallInfo(null);
    refreshCallHistory();
  }, [refreshCallHistory]);

  const handleCallFailed = useCallback(() => {
    setCallState("idle");
    setCallInfo(null);
  }, []);

  const { isNative, answer, reject, hangup, mute } = useTwilioVoice({
    onIncomingCall: handleIncomingCall,
    onCallAnswered: handleCallAnswered,
    onCallConnected: handleCallConnected,
    onCallEnded: handleCallEnded,
    onCallDisconnected: handleCallDisconnected,
    onCallCancelled: handleCallCancelled,
    onCallFailed: handleCallFailed,
  });

  const handleAnswer = useCallback(() => {
    answer();
    setCallState("connecting");
  }, [answer]);

  const handleReject = useCallback(() => {
    reject();
    setCallState("idle");
    setCallInfo(null);
  }, [reject]);

  const handleHangup = useCallback(() => {
    hangup();
    setCallState("ended");
  }, [hangup]);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    mute(newMuted);
    setIsMuted(newMuted);
  }, [isMuted, mute]);

  return (
    <TwilioCallContext.Provider
      value={{
        callState,
        callInfo,
        isMuted,
        answer: handleAnswer,
        reject: handleReject,
        hangup: handleHangup,
        toggleMute,
        isNative,
      }}
    >
      {children}
      {isNative && callState !== "idle" && (
        <IncomingCallOverlay
          callState={callState}
          callInfo={callInfo}
          isMuted={isMuted}
          onAnswer={handleAnswer}
          onReject={handleReject}
          onHangup={handleHangup}
          onToggleMute={toggleMute}
        />
      )}
    </TwilioCallContext.Provider>
  );
}

function IncomingCallOverlay({
  callState,
  callInfo,
  isMuted,
  onAnswer,
  onReject,
  onHangup,
  onToggleMute,
}: {
  callState: CallState;
  callInfo: CallInfo | null;
  isMuted: boolean;
  onAnswer: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
}) {
  if (callState === "idle" || callState === "ended") return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[9999] flex flex-col items-center justify-center gap-8">
      <div className="text-center text-white">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Phone className="w-10 h-10" />
        </div>
        {callState === "incoming" && (
          <p className="text-sm text-white/70 mb-1 uppercase tracking-widest">
            Incoming Call
          </p>
        )}
        {callState === "connecting" && (
          <p className="text-sm text-white/70 mb-1 uppercase tracking-widest">
            Connecting...
          </p>
        )}
        {callState === "active" && (
          <p className="text-sm text-white/70 mb-1 uppercase tracking-widest">
            On Call
          </p>
        )}
        <p className="text-2xl font-semibold">
          {callInfo?.from ?? "Unknown Caller"}
        </p>
        <p className="text-white/50 text-sm mt-1">Treemarkables</p>
      </div>

      {callState === "incoming" && (
        <div className="flex gap-12">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onReject}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center active:opacity-70"
            >
              <PhoneMissed className="w-7 h-7 text-white" />
            </button>
            <span className="text-white/70 text-sm">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAnswer}
              className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center active:opacity-70"
            >
              <Phone className="w-7 h-7 text-white" />
            </button>
            <span className="text-white/70 text-sm">Answer</span>
          </div>
        </div>
      )}

      {(callState === "connecting" || callState === "active") && (
        <div className="flex gap-8">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center active:opacity-70 ${isMuted ? "bg-white/30" : "bg-white/10"}`}
            >
              <Phone className="w-6 h-6 text-white" />
            </button>
            <span className="text-white/70 text-sm">
              {isMuted ? "Unmute" : "Mute"}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onHangup}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center active:opacity-70"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <span className="text-white/70 text-sm">End Call</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function useTwilioCall() {
  return useContext(TwilioCallContext);
}
