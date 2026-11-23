import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// Global "Report a problem" entry point. Any component calls `useBugReport().open()`;
// the modal itself is lazy so the recorder/upload code stays out of the main bundle.
//
// The provider also keeps a small ring buffer of recent runtime errors so a report
// can carry what blew up just before the user hit "Report" — the single most
// useful repro clue and the one users can never tell us themselves.

const BugReportModal = lazy(() => import("@/components/BugReportModal"));

export interface RecentError {
  at: string;
  message: string;
}

interface BugReportContextValue {
  open: () => void;
  recentErrors: () => RecentError[];
}

const BugReportContext = createContext<BugReportContextValue>({
  open: () => undefined,
  recentErrors: () => [],
});

const MAX_RECENT_ERRORS = 10;

export function BugReportProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const errorsRef = useRef<RecentError[]>([]);

  useEffect(() => {
    const push = (message: string) => {
      const buf = errorsRef.current;
      buf.push({ at: new Date().toISOString(), message: message.slice(0, 500) });
      if (buf.length > MAX_RECENT_ERRORS) buf.splice(0, buf.length - MAX_RECENT_ERRORS);
    };
    const onError = (e: ErrorEvent) => push(e.message || String(e.error ?? "Unknown error"));
    const onRejection = (e: PromiseRejectionEvent) => {
      const r: unknown = e.reason;
      push(r instanceof Error ? `${r.name}: ${r.message}` : `Unhandled rejection: ${String(r)}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const recentErrors = useCallback(() => [...errorsRef.current], []);
  const value = useMemo(() => ({ open, recentErrors }), [open, recentErrors]);

  return (
    <BugReportContext.Provider value={value}>
      {children}
      {isOpen && (
        <Suspense fallback={null}>
          <BugReportModal open={isOpen} onClose={() => setIsOpen(false)} />
        </Suspense>
      )}
    </BugReportContext.Provider>
  );
}

export function useBugReport(): BugReportContextValue {
  return useContext(BugReportContext);
}
