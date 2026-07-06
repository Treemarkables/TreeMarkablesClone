import {
  QueryClient,
  QueryFunction,
  dehydrate,
  hydrate,
  keepPreviousData,
} from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;

    let parsed: unknown = null;
    let message = `${res.status}: ${text}`;
    try {
      parsed = JSON.parse(text);
      const errorData = parsed as { message?: string; errors?: Array<{ message?: string; path?: string[] }> };
      if (errorData?.message) {
        message = errorData.message;
      } else if (errorData?.errors && Array.isArray(errorData.errors)) {
        const errorMessages = errorData.errors
          .map((e) => e.message || (e.path?.join('.') + ': ' + (e.message ?? '')))
          .join(', ');
        message = errorMessages || text;
      }
    } catch {
      // Non-JSON body — keep raw text message
    }

    throw new ApiError(message, res.status, parsed);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // No background polling by default. Freshness comes from (1) SSE
      // invalidations (useSSE), (2) mutation onSuccess invalidations, and
      // (3) refetch-on-focus below. Screens that genuinely need a live tick
      // (Dispatch, Calendar, Staff Schedule, notifications…) opt in with an
      // explicit per-query refetchInterval. The old global 30s interval kept
      // every cached query polling forever — battery + bandwidth drain in the
      // iOS webview and constant background load for no freshness gain.
      refetchInterval: false,
      // Refetch stale queries when the app regains focus (tab switch, iOS
      // webview resume) so returning users see fresh data without polling.
      refetchOnWindowFocus: true,
      // Treat data as fresh for a minute so navigating back to an
      // already-loaded screen renders instantly instead of re-flashing a
      // skeleton (this also throttles focus refetches to once a minute).
      staleTime: 60_000,
      // During a background refetch (e.g. switching customers/jobs), keep the
      // previously rendered data on screen instead of dropping to an empty
      // loading state. Eliminates the "blank then fill in" flicker.
      placeholderData: keepPreviousData,
      retry: (failureCount, error) => {
        if (failureCount >= 3) return false;
        const msg = (error as Error)?.message || '';
        if (msg.includes('503') || msg.includes('temporarily unavailable') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      gcTime: Infinity,
      networkMode: 'online',
    },
    mutations: {
      retry: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Offline cache persistence (stale-while-revalidate across app restarts)
//
// On a cold start (e.g. the iOS TestFlight webview booting) the in-memory query
// cache is empty, so every screen mounts with isLoading=true and shows a
// skeleton/spinner until the network responds. By snapshotting the cache to
// localStorage and rehydrating it *synchronously* before the first render, the
// app paints the last data the user saw instantly, then quietly revalidates in
// the background — no visible "fetching" flash on open.
//
// Implemented with react-query's built-in dehydrate/hydrate so it needs no
// extra dependency. Logout already calls localStorage.clear(), so persisted
// data does not survive sign-out.
// ---------------------------------------------------------------------------
const PERSIST_KEY = "tm-query-cache-v1";
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24; // discard snapshots older than 24h
const PERSIST_MAX_BYTES = 4 * 1024 * 1024; // stay well under the ~5MB quota

function hydratePersistedQueryCache() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const snapshot = JSON.parse(raw) as { savedAt?: number; state?: unknown };
    if (!snapshot?.savedAt || Date.now() - snapshot.savedAt > PERSIST_MAX_AGE) {
      localStorage.removeItem(PERSIST_KEY);
      return;
    }
    hydrate(queryClient, snapshot.state);
  } catch {
    // Corrupt/incompatible snapshot — drop it and start clean.
    try {
      localStorage.removeItem(PERSIST_KEY);
    } catch {
      /* ignore */
    }
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const state = dehydrate(queryClient, {
        // Only persist settled, successful queries.
        shouldDehydrateQuery: (query) => query.state.status === "success",
      });
      const payload = JSON.stringify({ savedAt: Date.now(), state });
      if (payload.length > PERSIST_MAX_BYTES) return; // too big — skip this write
      localStorage.setItem(PERSIST_KEY, payload);
    } catch {
      // Quota exceeded or serialization failure — drop the snapshot so a
      // half-written/oversized value never blocks the app.
      try {
        localStorage.removeItem(PERSIST_KEY);
      } catch {
        /* ignore */
      }
    }
  }, 1000);
}

if (typeof window !== "undefined") {
  hydratePersistedQueryCache();
  queryClient.getQueryCache().subscribe(schedulePersist);
}
