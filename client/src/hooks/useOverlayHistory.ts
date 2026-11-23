import { useEffect, useRef } from "react";
import { bindOverlayHistory } from "@/lib/overlayHistory";

/** While `open`, Android/browser back calls `onBack` instead of leaving the page. */
export function useOverlayHistory(open: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => bindOverlayHistory(open, () => onBackRef.current()), [open]);
}
