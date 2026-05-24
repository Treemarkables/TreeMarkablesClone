/**
 * useJobActions — shared job-lifecycle mutations + handlers for the card UIs.
 *
 * Both JobCardDesktop and JobCardMobile expose the same set of actions in
 * their More / Actions menus: Mark Complete, Duplicate, Delete, Queue / Unqueue.
 * Each of those is backed by the same REST call, the same React Query
 * invalidations, and the same confirm-then-fire wrapper. This hook collapses
 * the ~140 lines that used to live in both cards (PR #43 and earlier) into
 * one source of truth — if a third surface ever needs them, point it here.
 *
 * Composer-modal state (Photo / SMS / Email) and viewport-specific bits
 * (mobile's onOpenFull, mobile's phoneForCall) stay in each card on purpose;
 * they differ enough that a shared abstraction would muddy the call sites.
 *
 * Cache notes
 * ───────────
 * The hook runs its own `useQuery` on `/api/jobs/:id` only to read derived
 * state (`jobInQueue`, `isJobEmpty`). Both cards already query the same key
 * with the same staleTime, so React Query dedupes — no extra request.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface UseJobActionsOptions {
  /** Called on programmatic close paths (after a successful delete, after
   *  duplicate when no onDuplicated handler is supplied, after the user
   *  declines the empty-draft delete prompt). Required because the hook
   *  drives some close paths itself. */
  onClose: () => void;
  /** Called after a successful Duplicate Job with the new job's id. Parent
   *  typically swaps the open card over to the duplicate. When omitted the
   *  hook falls back to `onClose()` so the user can find the duplicate in
   *  the jobs list manually. */
  onDuplicated?: (newJobId: string) => void;
}

export function useJobActions(jobId: string, opts: UseJobActionsOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { onClose, onDuplicated } = opts;

  // Job query is shared with the calling card via the same React Query key.
  // The hook only needs job for derived values (jobInQueue, isJobEmpty);
  // the card itself does the bigger reads from the same cache entry.
  const { data: jobResp } = useQuery<{ success?: boolean; data?: Record<string, unknown> }>({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
    staleTime: 30_000,
  });
  const job = jobResp?.data;

  // ── Mutations ──────────────────────────────────────────────────────────
  const markComplete = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/jobs/${jobId}`, { status: "completed" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't mark complete", description: err.message, variant: "destructive" });
    },
  });

  const deleteJob = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/jobs/bulk-delete", { jobIds: [jobId] });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't delete job", description: err.message, variant: "destructive" });
    },
  });

  // POST /api/jobs/:id/duplicate copies scoping (customer, address, line
  // items, contacts, checklists) into a fresh quote-status job with a new
  // jobNumber. Scheduling, assignments, completion state, payments, and
  // Xero IDs all reset — see server/routes.ts for the field whitelist.
  const duplicateJob = useMutation<
    { success?: boolean; data?: { id?: string; jobNumber?: string } },
    Error
  >({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/duplicate`, {});
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message ?? `Duplicate failed (HTTP ${res.status})`);
      }
      return json;
    },
    onSuccess: (json) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      const newId = json?.data?.id;
      if (newId && onDuplicated) {
        onDuplicated(newId);
      } else {
        onClose();
      }
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't duplicate job", description: err.message, variant: "destructive" });
    },
  });

  // Dispatch Queue toggle — parks a job in the queue with a reason
  // (Weather Hold, Awaiting Permit, …) or pulls it back out. Reads /
  // writes the same `inQueue` / `queueReason` columns DispatchBoard uses,
  // so queuing here surfaces on the dispatch board immediately.
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [queueReasonInput, setQueueReasonInput] = useState("");
  const queueJob = useMutation<
    { success?: boolean },
    Error,
    { inQueue: boolean; queueReason: string | null }
  >({
    mutationFn: async ({ inQueue, queueReason }) => {
      const res = await apiRequest("PUT", `/api/jobs/${jobId}`, { inQueue, queueReason });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message ?? `Queue update failed (HTTP ${res.status})`);
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowQueueDialog(false);
      setQueueReasonInput("");
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't update queue", description: err.message, variant: "destructive" });
    },
  });

  // ── Derived ────────────────────────────────────────────────────────────
  const jobInQueue = (job?.inQueue as boolean | undefined) ?? false;

  // Empty-draft detection for the close-prompt guard. Kept tight on purpose:
  // customerId AND description AND title all blank. A user mid-fill (picked
  // a customer but hasn't typed anything else) doesn't get the prompt. The
  // auto-save data-loss history says err on the side of less-prompt-more-
  // explicit; a stricter heuristic would risk a "where did my job go?"
  // moment.
  const isJobEmpty =
    !((job?.customerId as string | undefined) ?? "") &&
    !(((job?.description as string | undefined) ?? "").trim()) &&
    !(((job?.title as string | undefined) ?? "").trim());

  // ── Confirm-wrapped handlers ───────────────────────────────────────────
  const onMarkComplete = () => markComplete.mutate();

  const onDuplicate = () => {
    if (
      window.confirm(
        "Create a copy of this job? The duplicate starts as a fresh quote — no scheduling, no payments, new job number.",
      )
    ) {
      duplicateJob.mutate();
    }
  };

  const onDelete = () => {
    if (window.confirm("Delete this job? This can't be undone.")) {
      deleteJob.mutate();
    }
  };

  // Queue menu / tile click: if already queued, one-tap unqueue (with a
  // confirm so an accidental click doesn't pull a job back into the live
  // board); otherwise open the reason picker dialog the caller renders.
  const onQueueMenuClick = () => {
    if (jobInQueue) {
      if (window.confirm("Remove this job from the dispatch queue?")) {
        queueJob.mutate({ inQueue: false, queueReason: null });
      }
    } else {
      setQueueReasonInput("");
      setShowQueueDialog(true);
    }
  };

  // Close-with-empty-draft guard. The "+ New Job" flow pre-creates a draft,
  // so a user who closes without picking a customer / writing anything
  // leaves an empty row in /all-jobs. Prompt to delete catches it. Callers
  // route their close-button onClick through this; programmatic onClose()
  // calls (mark-complete success, duplicate success, deleteJob.onSuccess)
  // bypass it on purpose — those are explicit user actions.
  const handleClose = () => {
    if (isJobEmpty) {
      if (
        window.confirm(
          "This job is empty (no customer, description, or title). Delete it?",
        )
      ) {
        deleteJob.mutate(); // onSuccess calls onClose() itself
        return;
      }
    }
    onClose();
  };

  return {
    // Mutations — exposed so callers can read .isPending for button labels
    markComplete,
    deleteJob,
    duplicateJob,
    queueJob,
    // Queue-dialog state
    showQueueDialog,
    setShowQueueDialog,
    queueReasonInput,
    setQueueReasonInput,
    // Derived
    jobInQueue,
    isJobEmpty,
    // Handlers
    onMarkComplete,
    onDuplicate,
    onDelete,
    onQueueMenuClick,
    handleClose,
  };
}
