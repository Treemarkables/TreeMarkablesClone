import { queryClient } from "./queryClient";

/**
 * Dispatch board's jobs list. The key is the full request URL, so invalidating
 * `['/api/jobs']` (SSE, most mutations) does not refresh this cache.
 */
export const DISPATCH_JOBS_QUERY_KEY =
  "/api/jobs?limit=500&offset=0&excludeCompleted=true&excludeArchived=true";

type JobsListCache = {
  data?: Array<Record<string, unknown> & { id?: string }>;
};

/**
 * Apply a schedule patch to the dispatch jobs list immediately, and drop any
 * in-flight refetch that would paint the pre-booking row back over it.
 */
export async function patchDispatchJobInCache(
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey: [DISPATCH_JOBS_QUERY_KEY] });
  queryClient.setQueryData(
    [DISPATCH_JOBS_QUERY_KEY],
    (prev: JobsListCache | undefined) => {
      if (!prev?.data) return prev;
      return {
        ...prev,
        data: prev.data.map((job) =>
          job.id === jobId ? { ...job, ...patch } : job,
        ),
      };
    },
  );
}
