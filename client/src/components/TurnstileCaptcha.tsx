import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface CaptchaConfig {
  provider: "turnstile" | null;
  siteKey?: string;
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve();
      return;
    }
    const existing = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("Failed to load the Turnstile script")),
    );
    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

/**
 * Whether the captcha is active. The server enables it only when both
 * Turnstile keys are configured, so an unconfigured deploy keeps the
 * contact forms working exactly as before (no widget, no server check).
 */
export function useCaptchaConfig(): { enabled: boolean; siteKey?: string } {
  const { data } = useQuery<CaptchaConfig>({
    queryKey: ["/api/captcha/config"],
    queryFn: async () => {
      const res = await fetch("/api/captcha/config");
      if (!res.ok) return { provider: null };
      return res.json();
    },
    staleTime: Infinity,
    retry: false,
  });
  const enabled = data?.provider === "turnstile" && !!data.siteKey;
  return { enabled, siteKey: enabled ? data?.siteKey : undefined };
}

interface TurnstileCaptchaProps {
  onToken: (token: string | null) => void;
  /** Increment to force a widget reset (tokens are single-use — reset after a failed submit). */
  resetSignal?: number;
}

export default function TurnstileCaptcha({
  onToken,
  resetSignal = 0,
}: TurnstileCaptchaProps) {
  const { enabled, siteKey } = useCaptchaConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!siteKey || !containerRef.current || widgetIdRef.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (
          cancelled ||
          !window.turnstile ||
          !containerRef.current ||
          widgetIdRef.current
        )
          return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
          theme: "light",
        });
      })
      .catch((err) => console.error("Turnstile failed to load:", err));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onTokenRef.current(null);
    }
  }, [resetSignal]);

  if (!enabled) return null;
  return <div ref={containerRef} data-testid="turnstile-captcha" />;
}
