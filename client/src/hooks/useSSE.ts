import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

const BASE_DELAY = 1_000;
const MAX_DELAY = 30_000;

export function useSSE() {
  const esRef = useRef<EventSource | null>(null);
  const delayRef = useRef(BASE_DELAY);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      const es = new EventSource("/api/sse");
      esRef.current = es;

      es.onopen = () => {
        delayRef.current = BASE_DELAY;
      };

      es.onmessage = (event: MessageEvent) => {
        try {
          const { queries } = JSON.parse(event.data) as { queries: string[] };
          for (const key of queries) {
            queryClient.invalidateQueries({ queryKey: [key] });
          }
        } catch {
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!mountedRef.current) return;
        timerRef.current = setTimeout(() => {
          delayRef.current = Math.min(delayRef.current * 2, MAX_DELAY);
          connect();
        }, delayRef.current);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);
}
