import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildUnscheduledList,
  buildWeekRevenue,
  collectAssignedTeamIds,
  isUnscheduledWorkOrder,
  lastPastBookingNzDate,
  nzWeekContaining,
  readDailyRevenueTargetInput,
  textSnippet,
} from "./opsSchedule.ts";

const today = "2026-09-22";
const links = {
  dispatch: "https://app.example/dispatch",
  settingsPreferences: "https://app.example/settings/preferences",
};

describe("Despatch unscheduled rule", () => {
  it("keeps a work order with no booking", () => {
    assert.equal(
      isUnscheduledWorkOrder({ status: "work_order", scheduledDate: null, scheduledDates: null }, today),
      true,
    );
  });

  it("drops a work order whose last NZ day is today or later", () => {
    assert.equal(
      isUnscheduledWorkOrder(
        { status: "work_order", scheduledDate: "2026-09-22T02:00:00.000Z", scheduledDates: null },
        today,
      ),
      false,
    );
  });

  it("treats a stale scheduledDates set as unscheduled even when scheduledDate is today", () => {
    const job = {
      status: "work_order",
      scheduledDate: "2026-09-22T02:00:00.000Z",
      scheduledEndDate: null,
      scheduledDates: ["2026-08-01"],
    };
    assert.equal(isUnscheduledWorkOrder(job, today), true);
    assert.equal(lastPastBookingNzDate(job, today), "2026-08-01");
  });

  it("does not treat quotes or leads as unscheduled work orders", () => {
    assert.equal(
      isUnscheduledWorkOrder({ status: "quote", scheduledDate: null, scheduledDates: null }, today),
      false,
    );
  });
});

describe("unscheduled payload", () => {
  it("returns the full exc-GST quote, gear notes, and team names", () => {
    const names = new Map([["emp-1", "Sam Crew"]]);
    const [job] = buildUnscheduledList(
      [
        {
          id: "job-1",
          jobNumber: "1042",
          status: "work_order",
          title: "Hedge reduction",
          description: "Front boundary",
          address: "12 Gladstone Road",
          subtotal: "0",
          lineItems: [{ totalExGst: 1800 }],
          equipment: ["Chipper", " "],
          internalNotes: "Take the big chipper. Sam on the saw.",
          estimatedManHours: "6.5",
          assignedTeam: ["emp-1", "emp-1"],
          assignedTo: ["emp-2"],
          customerConfirmed: false,
          scheduledDate: "2026-08-01T02:00:00.000Z",
          scheduledDates: null,
          workOrderAt: "2026-08-02T00:00:00.000Z",
        },
      ],
      names,
      today,
      (id) => `https://app.example/dispatch?job=${id}`,
    );

    assert.equal(job.quoteExGst, 1800);
    assert.deepEqual(job.equipment, ["Chipper"]);
    assert.equal(job.internalNotes, "Take the big chipper. Sam on the saw.");
    assert.equal(job.estimatedManHours, 6.5);
    assert.deepEqual(job.assignedTeam, [
      { id: "emp-1", name: "Sam Crew" },
      { id: "emp-2", name: null },
    ]);
    assert.equal(job.lastBookingNzDate, "2026-08-01");
    assert.equal(job.customerConfirmed, false);
    assert.equal(job.links.job, "https://app.example/dispatch?job=job-1");
  });

  it("sorts by acceptance time, drops booked work orders, and dedupes team ids", () => {
    assert.deepEqual(collectAssignedTeamIds({ assignedTeam: ["a", " a "], assignedStaffIds: ["a", "b"] }), ["a", "b"]);
    const rows = buildUnscheduledList(
      [
        {
          id: "later",
          jobNumber: "20",
          status: "work_order",
          scheduledDate: null,
          scheduledDates: null,
          workOrderAt: "2026-09-10T00:00:00.000Z",
        },
        {
          id: "booked",
          jobNumber: "1",
          status: "work_order",
          scheduledDate: "2026-09-22T02:00:00.000Z",
          scheduledDates: null,
          workOrderAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "earlier",
          jobNumber: "3",
          status: "work_order",
          scheduledDate: null,
          scheduledDates: null,
          workOrderAt: "2026-09-02T00:00:00.000Z",
        },
      ],
      new Map(),
      today,
      (id) => id,
    );
    assert.deepEqual(rows.map((job) => job.id), ["earlier", "later"]);
  });

  it("caps long notes", () => {
    const snippet = textSnippet("word ".repeat(200), 40);
    assert.equal(snippet.truncated, true);
    assert.ok(snippet.text && snippet.text.endsWith("..."));
    assert.ok(snippet.text.length <= 40);
  });
});

describe("NZ week versus daily target", () => {
  it("uses the Monday-Sunday week containing the anchor", () => {
    const week = nzWeekContaining("2026-09-22");
    assert.ok(week);
    assert.equal(week.weekStart, "2026-09-21");
    assert.equal(week.weekEnd, "2026-09-27");
    assert.equal(week.dates.length, 7);
    assert.equal(nzWeekContaining("2026-02-31"), null);
  });

  it("reports the stored target and the gap, without inventing 3500 or 4000", () => {
    const week = buildWeekRevenue({
      anchor: "2026-09-22",
      dailyRevenueTarget: null,
      links,
      assignments: [],
      jobs: [
        {
          id: "j",
          status: "work_order",
          scheduledDate: "2026-09-22T02:00:00.000Z",
          scheduledDates: null,
          subtotal: "1500",
        },
      ],
    });
    assert.ok(week);
    assert.equal(week.dailyRevenueTarget, null);
    assert.equal(week.days.find((day) => day.date === "2026-09-22")?.scheduledRevenueExGst, 1500);
    assert.equal(week.days[0].gapToTarget, null);
    assert.equal(week.weekGapToTarget, null);
  });

  it("gaps each day against the stored target", () => {
    const week = buildWeekRevenue({
      anchor: "2026-09-22",
      dailyRevenueTarget: "4000.00",
      links,
      assignments: [],
      jobs: [
        {
          id: "j",
          status: "work_order",
          scheduledDate: "2026-09-22T02:00:00.000Z",
          scheduledDates: null,
          subtotal: "1500",
        },
      ],
    });
    assert.ok(week);
    assert.equal(week.dailyRevenueTarget, 4000);
    const tuesday = week.days.find((day) => day.date === "2026-09-22");
    assert.equal(tuesday?.gapToTarget, 2500);
    assert.equal(week.weekTarget, 28000);
    assert.equal(week.weekScheduledRevenueExGst, 1500);
    assert.equal(week.weekGapToTarget, 26500);
    assert.equal(week.gstLabel, "exc. GST");
  });
});

describe("daily revenue target input", () => {
  it("accepts a positive amount and rejects empty or invented fallbacks", () => {
    assert.equal(readDailyRevenueTargetInput(4500), 4500);
    assert.equal(readDailyRevenueTargetInput("1250.5"), 1250.5);
    assert.equal(readDailyRevenueTargetInput(0), null);
    assert.equal(readDailyRevenueTargetInput(""), null);
    assert.equal(readDailyRevenueTargetInput(null), null);
    assert.equal(readDailyRevenueTargetInput(undefined), null);
  });
});
