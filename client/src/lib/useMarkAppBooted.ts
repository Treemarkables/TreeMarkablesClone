import { useEffect } from "react";
import { markAppBooted } from "@/lib/nativeBootRecovery";

/**
 * Lift #inflow-boot as soon as this page commits.
 *
 * The text detector waits for non-empty `<main>` innerText. Public customer
 * pages can commit with only a video, an image, a canvas, or a spinner
 * (job-card watch links, a slow fetch, a photo timeline). Call this on mount
 * so those states are visible instead of sitting under the boot overlay.
 */
export function useMarkAppBooted(): void {
  useEffect(() => {
    markAppBooted();
  }, []);
}
