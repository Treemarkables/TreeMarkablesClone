import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareByRecentActivity, recentJobActivityMs } from "./dispatchJobOrder.ts";

/**
 * Production shape that put #3926, #9080, and #4111 at the top of Unscheduled:
 * the board sorted by work_order_at ascending. Activity on those jobs is newer
 * than the acceptance stamp, and newer jobs have been touched since.
 */
const vicki = {
  jobNumber: "3926",
  workOrderAt: "2026-04-25T01:31:32.207Z",
  updatedAt: "2026-07-20T23:28:14.313Z",
  lastActivityAt: "2026-07-20T23:28:14.313Z",
  latestDiaryAt: "2026-07-20T23:28:14.310Z",
  createdAt: "2026-04-20T00:00:00.000Z",
};
const council = {
  jobNumber: "9080",
  workOrderAt: "2026-07-10T23:39:08.749Z",
  updatedAt: "2026-09-28T17:01:47.640Z",
  lastActivityAt: "2026-07-10T23:38:23.088Z",
  createdAt: "2026-07-01T00:00:00.000Z",
};
const landem = {
  jobNumber: "4111",
  workOrderAt: "2026-08-04T21:41:27.731Z",
  updatedAt: "2026-09-30T01:17:00.659Z",
  lastActivityAt: "2026-08-04T21:41:27.730Z",
  createdAt: "2026-08-01T00:00:00.000Z",
};
const judy = {
  jobNumber: "4274",
  workOrderAt: "2026-10-08T17:21:37.423Z",
  updatedAt: "2026-10-10T17:50:03.343Z",
  lastActivityAt: "2026-10-10T17:50:03.343Z",
  latestDiaryAt: "2026-10-10T17:50:03.326Z",
  createdAt: "2026-10-08T17:21:37.423Z",
};

describe("Unscheduled recent-activity order", () => {
  it("puts the most recently active job first, not the oldest work order", () => {
    const ordered = [vicki, council, landem, judy]
      .slice()
      .sort(compareByRecentActivity)
      .map((job) => job.jobNumber);
    assert.deepEqual(ordered, ["4274", "4111", "9080", "3926"]);
  });

  it("uses a diary note newer than updated_at", () => {
    const quiet = { updatedAt: "2026-01-01T00:00:00.000Z", createdAt: "2025-01-01T00:00:00.000Z" };
    const noted = {
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
      latestDiaryAt: "2026-10-01T00:00:00.000Z",
    };
    assert.ok(compareByRecentActivity(noted, quiet) < 0);
    assert.equal(recentJobActivityMs(noted), new Date("2026-10-01T00:00:00.000Z").getTime());
  });

  it("uses a proposal send or acceptance newer than the job row", () => {
    const sent = {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      proposalSentDate: "2026-06-01T00:00:00.000Z",
    };
    const accepted = {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      latestProposalAt: "2026-08-01T00:00:00.000Z",
    };
    const older = {
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
    };
    assert.ok(compareByRecentActivity(accepted, sent) < 0);
    assert.ok(compareByRecentActivity(sent, older) < 0);
  });

  it("treats quote presented and work-order acceptance as activity", () => {
    const presented = {
      createdAt: "2026-01-01T00:00:00.000Z",
      quotePresentedDate: "2026-09-01T00:00:00.000Z",
    };
    const accepted = {
      createdAt: "2026-02-01T00:00:00.000Z",
      workOrderAt: "2026-10-01T00:00:00.000Z",
    };
    assert.ok(compareByRecentActivity(accepted, presented) < 0);
  });

  it("falls back to created_at descending when nothing else is set", () => {
    const older = { createdAt: "2025-01-01T00:00:00.000Z" };
    const newer = { createdAt: "2026-05-01T00:00:00.000Z" };
    const ordered = [older, newer].sort(compareByRecentActivity);
    assert.equal(ordered[0], newer);
  });

  it("ignores null and unparseable stamps instead of treating them as ancient", () => {
    const job = {
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: null,
      lastActivityAt: "not-a-date",
      latestDiaryAt: "",
    };
    assert.equal(recentJobActivityMs(job), new Date("2026-04-01T00:00:00.000Z").getTime());
  });

  it("lets a fresher local stamp beat a stale server recentActivityAt", () => {
    const job = {
      recentActivityAt: "2026-07-01T00:00:00.000Z",
      lastActivityAt: "2026-10-09T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    assert.equal(recentJobActivityMs(job), new Date("2026-10-09T00:00:00.000Z").getTime());
  });

  it("breaks equal activity by created_at descending", () => {
    const shared = "2026-10-01T12:00:00.000Z";
    const older = { recentActivityAt: shared, createdAt: "2026-01-01T00:00:00.000Z" };
    const newer = { recentActivityAt: shared, createdAt: "2026-06-01T00:00:00.000Z" };
    assert.ok(compareByRecentActivity(newer, older) < 0);
  });
});
