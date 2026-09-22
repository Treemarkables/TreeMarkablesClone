import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  jobDayCount,
  jobQuoteExGst,
  jobRevenue,
  scheduledRevenueExGstForNzDate,
} from "./dispatchRevenue.ts";

const mondayUtc = "2026-09-21T02:00:00.000Z";
const tuesdayUtc = "2026-09-22T02:00:00.000Z";

describe("Despatch exc-GST revenue", () => {
  it("uses line items when subtotal was never rolled up", () => {
    const quote = jobQuoteExGst({
      lineItems: [{ totalExGst: 250 }, { priceExGst: 100, quantity: 2, total: 999 }],
      subtotal: "0",
    });
    assert.equal(quote, 450);
  });

  it("falls back to subtotal, then GST-inclusive totals divided by 1.15", () => {
    assert.equal(jobQuoteExGst({ subtotal: "1250.50" }), 1250.5);
    assert.equal(jobQuoteExGst({ subtotal: "0", totalIncludingGst: "115" }), 100);
    assert.equal(jobQuoteExGst({ subtotal: "0", totalAmount: "230" }), 200);
  });

  it("splits a multi-day job across the days Despatch actually draws", () => {
    const job = {
      scheduledDate: mondayUtc,
      scheduledEndDate: tuesdayUtc,
      scheduledDates: ["2026-09-21", "2026-09-23"],
      subtotal: "1000",
    };
    assert.equal(jobDayCount(job), 2);
    assert.equal(jobRevenue(job), 500);
    assert.equal(jobQuoteExGst(job), 1000);
  });

  it("sums the same unique jobs the Despatch day bar uses", () => {
    const booked = {
      id: "booked",
      status: "work_order",
      scheduledDate: mondayUtc,
      scheduledDates: null,
      subtotal: "800",
    };
    const quote = {
      id: "quote",
      status: "quote",
      scheduledDate: mondayUtc,
      scheduledDates: null,
      subtotal: "5000",
    };
    const assignmentOnly = {
      id: "assign",
      status: "work_order",
      scheduledDate: null,
      scheduledDates: null,
      subtotal: "300",
    };
    const twoDay = {
      id: "span",
      status: "completed",
      scheduledDate: mondayUtc,
      scheduledEndDate: tuesdayUtc,
      scheduledDates: null,
      subtotal: "1000",
    };
    const jobs = [booked, quote, assignmentOnly, twoDay];
    // 02:00Z keeps the calendar day stable in getNZDateString (same anchor the
    // Despatch partition tests use). Two assignments for one job count once.
    const assignments = [
      { jobId: "booked", startTime: mondayUtc },
      { jobId: "booked", startTime: mondayUtc },
      { jobId: "assign", startTime: mondayUtc },
    ];

    assert.equal(scheduledRevenueExGstForNzDate(jobs, assignments, "2026-09-21"), 1600);
    assert.equal(scheduledRevenueExGstForNzDate(jobs, assignments, "2026-09-22"), 500);
  });
});
