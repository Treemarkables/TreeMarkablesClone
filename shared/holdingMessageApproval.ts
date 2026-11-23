/**
 * Inline "awaiting approval" sends from the notification bell.
 *
 * The bell must not grow a second sender. Send is: optional save of an edit
 * (PATCH /api/pending-messages/:id) then the diary's approve route
 * (POST /api/pending-messages/:id/approve). That route claims the row so a
 * second tap, or a tap on the job card at the same time, cannot send twice.
 */

export type ApprovalNotification = {
  type?: string | null;
  title?: string | null;
  message?: string | null;
  jobId?: string | null;
  metadata?: unknown;
};

const HOLDING_MESSAGE_TYPE = "holding_message_pending";

export function pendingMessageApprovePath(pendingMessageId: string): string {
  return `/api/pending-messages/${pendingMessageId}/approve`;
}

export function pendingMessageEditPath(pendingMessageId: string): string {
  return `/api/pending-messages/${pendingMessageId}`;
}

export function pendingMessageIdFromNotification(
  notification: ApprovalNotification | null | undefined,
): string | null {
  const metadata = notification?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const id = (metadata as { pendingMessageId?: unknown }).pendingMessageId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function approvalCopy(notification: ApprovalNotification): string {
  return `${notification.title || ""} ${notification.message || ""}`.toLowerCase();
}

/**
 * True when the bell should offer inline review + Send.
 * The link is metadata.pendingMessageId (the same field every holding-message
 * notification stores). The holding-message type, and any other customer-message
 * notification whose copy says it is awaiting approval, use the same panel and
 * resolve the draft by that id or by the job.
 */
export function isAwaitingApprovalMessageNotification(
  notification: ApprovalNotification | null | undefined,
): boolean {
  if (!notification) return false;
  if (pendingMessageIdFromNotification(notification)) return true;
  const type = (notification.type || "").trim();
  if (type === HOLDING_MESSAGE_TYPE) return true;
  const copy = approvalCopy(notification);
  if (!copy.includes("awaiting approval")) return false;
  const looksLikeCustomerMessage =
    type.includes("message") ||
    type.includes("sms") ||
    type.includes("email") ||
    type.includes("holding") ||
    copy.includes("holding message") ||
    copy.includes("message to");
  return looksLikeCustomerMessage;
}

export type PendingMessageMatch = {
  id: string;
  jobId?: string | null;
  status: string;
  createdAt?: string | Date | null;
};

/** Prefer the id stored on the notification. Otherwise the newest pending draft on the job. */
export function matchPendingMessageForNotification<T extends PendingMessageMatch>(
  notification: ApprovalNotification,
  messages: T[],
): T | null {
  const id = pendingMessageIdFromNotification(notification);
  if (id) return messages.find((message) => message.id === id) ?? null;
  const jobId = (notification.jobId || "").trim();
  if (!jobId) return null;
  const pending = messages.filter(
    (message) => message.jobId === jobId && message.status === "pending",
  );
  pending.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
  return pending[0] ?? null;
}

export type HoldingSendStep =
  | { method: "PATCH"; path: string; body: { message: string } }
  | { method: "POST"; path: string; body: Record<string, never> };

/**
 * Unchanged text goes straight to approve (the diary button). An edit is saved
 * first, through the same PATCH the diary uses, then approved.
 */
export function holdingMessageSendSteps(input: {
  pendingMessageId: string;
  savedMessage: string;
  draftMessage: string;
}): { ok: true; steps: HoldingSendStep[] } | { ok: false; message: string } {
  const id = input.pendingMessageId.trim();
  if (!id) {
    return { ok: false, message: "This notification is not linked to a draft message." };
  }
  const draft = input.draftMessage.trim();
  if (!draft) return { ok: false, message: "Message cannot be blank" };
  const steps: HoldingSendStep[] = [];
  if (draft !== input.savedMessage.trim()) {
    steps.push({
      method: "PATCH",
      path: pendingMessageEditPath(id),
      body: { message: draft },
    });
  }
  steps.push({
    method: "POST",
    path: pendingMessageApprovePath(id),
    body: {},
  });
  return { ok: true, steps };
}

export function isAlreadyHandledApproveError(
  status: number | undefined,
  message: string,
): boolean {
  return status === 400 && /not pending/i.test(message);
}

export type HoldingSendResult =
  | { ok: true; outcome: "sent" | "already_handled" }
  | { ok: false; skipped: true }
  | { ok: false; message: string };

export type HoldingSendLock = {
  tryAcquire: (id: string) => boolean;
  release: (id: string) => void;
};

export function createHoldingSendLock(): HoldingSendLock {
  const inflight = new Set<string>();
  return {
    tryAcquire(id: string) {
      if (inflight.has(id)) return false;
      inflight.add(id);
      return true;
    },
    release(id: string) {
      inflight.delete(id);
    },
  };
}

export async function sendHoldingMessageFromNotification(
  input: {
    notificationId: string;
    pendingMessageId: string;
    savedMessage: string;
    draftMessage: string;
  },
  io: {
    request: (step: HoldingSendStep) => Promise<void>;
    markRead: () => Promise<void>;
  },
  lock: HoldingSendLock,
): Promise<HoldingSendResult> {
  const key = input.pendingMessageId || input.notificationId;
  if (!lock.tryAcquire(key)) return { ok: false, skipped: true };
  try {
    const planned = holdingMessageSendSteps(input);
    if (!planned.ok) return { ok: false, message: planned.message };
    try {
      for (const step of planned.steps) {
        await io.request(step);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send";
      const status =
        err && typeof err === "object" && "status" in err && typeof err.status === "number"
          ? err.status
          : undefined;
      if (isAlreadyHandledApproveError(status, message)) {
        await io.markRead();
        return { ok: true, outcome: "already_handled" };
      }
      return { ok: false, message };
    }
    await io.markRead();
    return { ok: true, outcome: "sent" };
  } finally {
    lock.release(key);
  }
}

export type PendingApproveResult =
  | { ok: true }
  | { ok: false; status: 404 | 400 | 422; message: string };

/**
 * Claim, send, then mark sent. A second caller finds the row no longer pending
 * and does not send. A failed transport releases the claim so the diary button
 * can try again. A successful transport is never released back to pending.
 */
export async function runPendingMessageApproval<T extends { id: string }>(
  id: string,
  deps: {
    claim: (id: string) => Promise<T | null>;
    lookup: (id: string) => Promise<T | null | undefined>;
    send: (msg: T) => Promise<{ sent: boolean; failureMessage?: string }>;
    markSent: (msg: T) => Promise<void>;
    release: (msg: T) => Promise<void>;
    afterSent?: (msg: T) => Promise<void>;
  },
): Promise<PendingApproveResult> {
  const claimed = await deps.claim(id);
  if (!claimed) {
    const existing = await deps.lookup(id);
    if (!existing) return { ok: false, status: 404, message: "Message not found" };
    return { ok: false, status: 400, message: "Message is not pending" };
  }

  let sent = false;
  let failureMessage =
    "No deliverable channel: message has no phone number or email address. Please edit the message details and try again.";
  try {
    const result = await deps.send(claimed);
    sent = result.sent;
    if (result.failureMessage) failureMessage = result.failureMessage;
  } catch (err) {
    await deps.release(claimed).catch(() => undefined);
    throw err;
  }

  if (!sent) {
    await deps.release(claimed).catch(() => undefined);
    return { ok: false, status: 422, message: failureMessage };
  }

  await deps.markSent(claimed);
  if (deps.afterSent) {
    try {
      await deps.afterSent(claimed);
    } catch (err) {
      console.error("Post-send follow-up failed after pending message was sent:", err);
    }
  }
  return { ok: true };
}
