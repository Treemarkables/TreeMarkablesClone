/**
 * Bell Send must use the diary approve route, and a second claim must not send.
 *
 * Run: node --experimental-strip-types --test shared/holdingMessageApproval.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createHoldingSendLock,
  holdingMessageSendSteps,
  isAwaitingApprovalMessageNotification,
  matchPendingMessageForNotification,
  pendingMessageApprovePath,
  runPendingMessageApproval,
  sendHoldingMessageFromNotification,
} from "./holdingMessageApproval.ts";

const holding = {
  type: "holding_message_pending",
  title: "Holding message awaiting approval",
  message: "A holding message to Demo Customer is ready to send — tap to review and approve.",
  jobId: "job-1",
  metadata: { pendingMessageId: "msg-1" },
};

describe("which notifications get inline send", () => {
  it("includes a holding message linked by pendingMessageId", () => {
    assert.equal(isAwaitingApprovalMessageNotification(holding), true);
  });

  it("includes the holding-message type even when the id is only on the job", () => {
    assert.equal(
      isAwaitingApprovalMessageNotification({ ...holding, metadata: null }),
      true,
    );
  });

  it("includes another awaiting-approval message that uses the same draft id", () => {
    assert.equal(
      isAwaitingApprovalMessageNotification({
        type: "lane_nudge_pending",
        title: "Follow-up message awaiting approval",
        message: "A message to Demo Customer is ready to send.",
        jobId: "job-9",
        metadata: { pendingMessageId: "msg-9" },
      }),
      true,
    );
  });

  it("leaves ordinary notifications alone", () => {
    assert.equal(
      isAwaitingApprovalMessageNotification({
        type: "quote_accepted",
        title: "Quote Accepted!",
        message: "Demo Customer has accepted quote #12.",
        jobId: "job-1",
      }),
      false,
    );
  });
});

describe("matching the draft", () => {
  const messages = [
    { id: "older", jobId: "job-1", status: "pending", createdAt: "2026-10-01T00:00:00Z" },
    { id: "newer", jobId: "job-1", status: "pending", createdAt: "2026-10-02T00:00:00Z" },
    { id: "msg-1", jobId: "job-1", status: "pending", createdAt: "2026-09-01T00:00:00Z" },
    { id: "sent", jobId: "job-2", status: "sent", createdAt: "2026-10-03T00:00:00Z" },
  ];

  it("uses the id stored on the notification", () => {
    assert.equal(matchPendingMessageForNotification(holding, messages)?.id, "msg-1");
  });

  it("uses the newest pending draft on the job when the id is missing", () => {
    const match = matchPendingMessageForNotification(
      { ...holding, metadata: {}, jobId: "job-1" },
      messages,
    );
    assert.equal(match?.id, "newer");
  });
});

describe("send steps", () => {
  it("posts only to the diary approve route when the text is unchanged", () => {
    const planned = holdingMessageSendSteps({
      pendingMessageId: "msg-1",
      savedMessage: "Hello there",
      draftMessage: "  Hello there  ",
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.deepEqual(planned.steps, [
      { method: "POST", path: pendingMessageApprovePath("msg-1"), body: {} },
    ]);
  });

  it("saves an edit with the diary PATCH, then approves", () => {
    const planned = holdingMessageSendSteps({
      pendingMessageId: "msg-1",
      savedMessage: "Hello there",
      draftMessage: "Hello there, see you Thursday.",
    });
    assert.equal(planned.ok, true);
    if (!planned.ok) return;
    assert.equal(planned.steps[0]?.method, "PATCH");
    assert.equal(planned.steps[0]?.path, "/api/pending-messages/msg-1");
    assert.equal(planned.steps[1]?.method, "POST");
    assert.equal(planned.steps[1]?.path, "/api/pending-messages/msg-1/approve");
  });

  it("does not send a blank message", () => {
    const planned = holdingMessageSendSteps({
      pendingMessageId: "msg-1",
      savedMessage: "Hello",
      draftMessage: "   ",
    });
    assert.equal(planned.ok, false);
  });
});

describe("bell send", () => {
  it("marks the notification read after the approve route succeeds", async () => {
    const calls: string[] = [];
    const result = await sendHoldingMessageFromNotification(
      {
        notificationId: "note-1",
        pendingMessageId: "msg-1",
        savedMessage: "Hello",
        draftMessage: "Hello",
      },
      {
        request: async (step) => {
          calls.push(`${step.method} ${step.path}`);
        },
        markRead: async () => {
          calls.push("read");
        },
      },
      createHoldingSendLock(),
    );
    assert.deepEqual(result, { ok: true, outcome: "sent" });
    assert.deepEqual(calls, ["POST /api/pending-messages/msg-1/approve", "read"]);
  });

  it("does not call the approve route a second time while the first send is in flight", async () => {
    let started = 0;
    let releaseFirst: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const lock = createHoldingSendLock();
    const input = {
      notificationId: "note-1",
      pendingMessageId: "msg-1",
      savedMessage: "Hello",
      draftMessage: "Hello",
    };
    const io = {
      request: async () => {
        started += 1;
        await gate;
      },
      markRead: async () => undefined,
    };
    const first = sendHoldingMessageFromNotification(input, io, lock);
    const second = await sendHoldingMessageFromNotification(input, io, lock);
    assert.deepEqual(second, { ok: false, skipped: true });
    assert.equal(started, 1);
    releaseFirst();
    assert.deepEqual(await first, { ok: true, outcome: "sent" });
  });

  it("treats 'not pending' as already handled and does not surface it as a new failure", async () => {
    let read = 0;
    const result = await sendHoldingMessageFromNotification(
      {
        notificationId: "note-1",
        pendingMessageId: "msg-1",
        savedMessage: "Hello",
        draftMessage: "Hello again",
      },
      {
        request: async (step) => {
          if (step.method === "POST") {
            const error = new Error("Message is not pending");
            (error as Error & { status: number }).status = 400;
            throw error;
          }
        },
        markRead: async () => {
          read += 1;
        },
      },
      createHoldingSendLock(),
    );
    assert.deepEqual(result, { ok: true, outcome: "already_handled" });
    assert.equal(read, 1);
  });
});

describe("approve claim", () => {
  function memoryStore(status: string) {
    const row = { id: "msg-1", status, message: "Hello" };
    let sends = 0;
    return {
      sends: () => sends,
      row: () => row.status,
      deps: {
        claim: async (id: string) => {
          if (row.id !== id || row.status !== "pending") return null;
          row.status = "sending";
          return { ...row };
        },
        lookup: async () => ({ ...row }),
        send: async () => {
          sends += 1;
          return { sent: true };
        },
        markSent: async () => {
          row.status = "sent";
        },
        release: async () => {
          if (row.status === "sending") row.status = "pending";
        },
      },
    };
  }

  it("sends once when two approvals race", async () => {
    const store = memoryStore("pending");
    const [a, b] = await Promise.all([
      runPendingMessageApproval("msg-1", store.deps),
      runPendingMessageApproval("msg-1", store.deps),
    ]);
    const oks = [a, b].filter((result) => result.ok);
    const skips = [a, b].filter((result) => !result.ok);
    assert.equal(oks.length, 1);
    assert.equal(skips.length, 1);
    if (skips[0]?.ok) return;
    assert.equal(skips[0]?.status, 400);
    assert.equal(store.sends(), 1);
    assert.equal(store.row(), "sent");
  });

  it("does not send a message that is already sent", async () => {
    const store = memoryStore("sent");
    const result = await runPendingMessageApproval("msg-1", store.deps);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 400);
    assert.equal(store.sends(), 0);
  });

  it("releases the claim when nothing could be delivered", async () => {
    const store = memoryStore("pending");
    const result = await runPendingMessageApproval("msg-1", {
      ...store.deps,
      send: async () => ({ sent: false }),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 422);
    assert.equal(store.row(), "pending");
  });
});

describe("the bell and the diary share one approve route", () => {
  const bell = readFileSync(
    new URL("../client/src/components/HoldingMessageNotificationActions.tsx", import.meta.url),
    "utf8",
  );
  const route = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");

  it("the notification send helper posts to /api/pending-messages/:id/approve", () => {
    assert.match(bell, /sendHoldingMessageFromNotification/);
    assert.match(bell, /disabled=\{sending/);
  });

  it("the approve route still requires an admin and claims a pending row before sending", () => {
    assert.match(
      route,
      /app\.post\('\/api\/pending-messages\/:id\/approve', requireAdmin/,
    );
    assert.match(route, /runPendingMessageApproval/);
    assert.match(route, /claimPendingOutboundMessage/);
  });
});
