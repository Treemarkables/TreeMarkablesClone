import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;

    // Try to parse JSON error response for a human-readable message
    try {
      const errorData = JSON.parse(text);
      if (errorData.message) {
        throw new Error(errorData.message);
      }
      if (errorData.errors && Array.isArray(errorData.errors)) {
        const errorMessages = errorData.errors
          .map((e: any) => e.message || (e.path?.join('.') + ': ' + e.message))
          .join(', ');
        throw new Error(errorMessages || text);
      }
    } catch (parseError) {
      // Only fall back to raw text if the error came from JSON.parse itself
      if (parseError instanceof SyntaxError) {
        throw new Error(`${res.status}: ${text}`);
      }
      // Otherwise re-throw the human-readable error we constructed above
      throw parseError;
    }

    throw new Error(`${res.status}: ${text}`);
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
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
      staleTime: 5000,
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
