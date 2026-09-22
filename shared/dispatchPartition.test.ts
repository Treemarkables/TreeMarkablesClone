import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasUpcomingBookingNZ } from "./dateUtils.ts";

// The Active Jobs rail partitions work_orders with hasUpcomingBookingNZ.
// Status stays work_order. A single-day Despatch drop must clear scheduledDates:
// a non-empty day set wins over scheduledDate, so a rained-off day list would
// keep the newly booked job in Unscheduled.
//
// Timestamps are 02:00Z so the calendar day is the same in UTC and in
// Pacific/Auckland (UTC+12/+13). getNZDateString formats in the runtime zone.
const todayNZ = "2026-09-22";
const bookedToday = "2026-09-22T02:00:00.000Z";

describe("despatch Unscheduled/Scheduled partition", () => {
  it("treats a single-day booking with scheduledDates cleared as upcoming", () => {
    assert.equal(
      hasUpcomingBookingNZ(
        {
          scheduledDate: bookedToday,
          scheduledEndDate: null,
          scheduledDates: null,
        },
        todayNZ,
      ),
      true,
    );
  });

  it("lets a stale past scheduledDates set hide the new scheduledDate", () => {
    assert.equal(
      hasUpcomingBookingNZ(
        {
          scheduledDate: bookedToday,
          scheduledEndDate: null,
          scheduledDates: ["2026-08-01"],
        },
        todayNZ,
      ),
      false,
    );
  });

  it("treats a booking that is entirely in the past as not upcoming", () => {
    const past = "2026-08-01T02:00:00.000Z";
    assert.equal(
      hasUpcomingBookingNZ(
        {
          scheduledDate: past,
          scheduledEndDate: null,
          scheduledDates: null,
        },
        todayNZ,
      ),
      false,
    );
  });
});
