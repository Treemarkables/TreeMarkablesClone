import { ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTwilioVoice } from "@/hooks/useTwilioVoice";

// Inbound calls use the native iOS CallKit UI end-to-end: iOS shows the
// incoming-call screen, and once answered the standard controls (mute /
// speaker / end call) live in the system UI — full-screen from the lock
// screen, or via the green call pill at the top when the app is foregrounded.
//
// This provider deliberately renders NO web overlay. The previous custom
// in-app call screen was removed in favour of the native UI (it looked
// inconsistent and only appeared in some answer paths). The provider's sole
// remaining job is to keep the device registered for Twilio VoIP push so
// inbound calls ring at all — see useTwilioVoice, which fetches the access
// token and registers on mount.
export function TwilioCallProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Refresh the call list (Communications page) once a call wraps up.
  const refreshCallHistory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
  }, [queryClient]);

  useTwilioVoice({
    onCallEnded: refreshCallHistory,
    onCallDisconnected: refreshCallHistory,
  });

  return <>{children}</>;
}
