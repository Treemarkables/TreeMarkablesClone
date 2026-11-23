/**
 * Live Roster date keys must survive a round trip in Pacific/Auckland,
 * including daylight saving (UTC+13) where UTC midnight and noon sit on
 * different NZ calendar days.
 *
 * Run: node --experimental-strip-types --test client/src/pages/staffScheduleDate.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatRosterDateLong,
  isRosterDateKey,
  nzTodayKey,
  rosterDateFromSearch,
  rosterDateKeyRoundTrip,
  rosterDaySwipe,
  rosterSearchWithDate,
  shiftDateKey,
  startOfIsoWeekKey,
} from "./staffScheduleDate.ts";

describe("roster date key round trip", () => {
  const keys = [
    "2026-01-15", // NZDT
    "2026-04-04", // day before the 2026 DST end
    "2026-04-05", // DST ends (first Sunday in April) — 25-hour NZ day
    "2026-07-15", // NZST, UTC+12
    "2026-09-26", // day before the 2026 DST start
    "2026-09-27", // DST starts (last Sunday in September) — 23-hour NZ day
    "2026-10-10", // NZDT, UTC+13
    "2024-02-29", // leap day
  ];

  for (const key of keys) {
    it(`keeps ${key} on the same calendar day`, () => {
      assert.equal(isRosterDateKey(key), true);
      assert.equal(rosterDateKeyRoundTrip(key), key);
      assert.equal(shiftDateKey(shiftDateKey(key, 1), -1), key);
    });
  }

  it("rejects dates that are not real calendar days", () => {
    assert.equal(isRosterDateKey("2026-02-31"), false);
    assert.equal(isRosterDateKey("2026-02-29"), false);
    assert.equal(isRosterDateKey("10-10-2026"), false);
    assert.equal(isRosterDateKey(""), false);
    assert.equal(isRosterDateKey(null), false);
  });
});

describe("Pacific/Auckland vs UTC", () => {
  it("uses the NZ calendar date just after NZ midnight, not the UTC date", () => {
    // 2026-10-10 00:30 NZDT = 2026-10-09 11:30 UTC. toISOString().slice(0, 10)
    // would report the previous day.
    const justAfterNzMidnight = new Date("2026-10-09T11:30:00Z");
    assert.equal(justAfterNzMidnight.toISOString().slice(0, 10), "2026-10-09");
    assert.equal(nzTodayKey(justAfterNzMidnight), "2026-10-10");
  });

  it("rolls to the next NZ day at 00:00 NZDT, which is 11:00 UTC", () => {
    assert.equal(nzTodayKey(new Date("2026-10-10T10:59:00Z")), "2026-10-10");
    assert.equal(nzTodayKey(new Date("2026-10-10T11:00:00Z")), "2026-10-11");
  });

  it("does not treat noon UTC as the same Auckland day during daylight saving", () => {
    // 2026-10-10 12:00 UTC is 2026-10-11 01:00 in Pacific/Auckland (UTC+13).
    // Formatting a noon-UTC anchor in Auckland yields the next day.
    const noonUtc = new Date("2026-10-10T12:00:00Z");
    assert.equal(nzTodayKey(noonUtc), "2026-10-11");
    assert.equal(rosterDateKeyRoundTrip("2026-10-10"), "2026-10-10");
    assert.equal(formatRosterDateLong("2026-10-10"), "Saturday 10 October 2026");
  });

  it("crosses NZST midnight at 12:00 UTC (UTC+12), not at noon Auckland", () => {
    assert.equal(nzTodayKey(new Date("2026-07-15T11:59:00Z")), "2026-07-15");
    assert.equal(nzTodayKey(new Date("2026-07-15T12:00:00Z")), "2026-07-16");
  });

  it("does not parse a date-only string as a local Date", () => {
    // `new Date('YYYY-MM-DD')` is UTC midnight. West of UTC that is still
    // the previous evening. The roster keeps the key as the key.
    const utcMidnight = new Date("2026-10-10T00:00:00.000Z");
    const losAngeles = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(utcMidnight);
    assert.equal(losAngeles, "2026-10-09");
    assert.equal(rosterDateFromSearch("?date=2026-10-10"), "2026-10-10");
    assert.equal(formatRosterDateLong("2026-10-10").includes("10 October"), true);
  });

  it("shows how a second Auckland conversion of an already-zoned clock lands on the next day", () => {
    // 15:00 on 10 Oct is the NZ wall clock for 2026-10-10T02:00:00Z.
    // Treating that wall clock as a UTC instant and converting to Auckland
    // again (toZonedTime, then formatInTimeZone) produces 11 Oct.
    assert.equal(nzTodayKey(new Date("2026-10-10T02:00:00Z")), "2026-10-10");
    const wallClockAsUtc = new Date(Date.UTC(2026, 9, 10, 15, 0, 0));
    assert.equal(nzTodayKey(wallClockAsUtc), "2026-10-11");
  });
});

describe("shifting across daylight saving", () => {
  it("moves one calendar day when NZ springs forward and falls back", () => {
    assert.equal(shiftDateKey("2026-09-26", 1), "2026-09-27");
    assert.equal(shiftDateKey("2026-09-27", 1), "2026-09-28");
    assert.equal(shiftDateKey("2026-04-04", 1), "2026-04-05");
    assert.equal(shiftDateKey("2026-04-05", 1), "2026-04-06");
    assert.equal(shiftDateKey("2026-10-10", 1), "2026-10-11");
    assert.equal(shiftDateKey("2026-10-10", -1), "2026-10-09");
  });

  it("finds the Monday of the week without using the host timezone", () => {
    // 10 Oct 2026 is a Saturday; 11 Oct is a Sunday; 12 Oct is a Monday.
    assert.equal(startOfIsoWeekKey("2026-10-10"), "2026-10-05");
    assert.equal(startOfIsoWeekKey("2026-10-11"), "2026-10-05");
    assert.equal(startOfIsoWeekKey("2026-10-12"), "2026-10-12");
  });
});

describe("date query param", () => {
  it("reads a valid date and ignores anything else", () => {
    assert.equal(rosterDateFromSearch("?date=2026-10-08"), "2026-10-08");
    assert.equal(rosterDateFromSearch("date=2026-10-08"), "2026-10-08");
    assert.equal(rosterDateFromSearch("?foo=1&date=2026-10-08"), "2026-10-08");
    assert.equal(rosterDateFromSearch("?date=2026-02-31"), null);
    assert.equal(rosterDateFromSearch("?date=tomorrow"), null);
    assert.equal(rosterDateFromSearch(""), null);
  });

  it("writes the date without dropping other params", () => {
    assert.equal(rosterSearchWithDate("", "2026-10-10"), "?date=2026-10-10");
    assert.equal(rosterSearchWithDate("?foo=1", "2026-10-10"), "?foo=1&date=2026-10-10");
    assert.equal(
      rosterSearchWithDate("?date=2026-10-08&foo=1", "2026-10-10"),
      "?date=2026-10-10&foo=1",
    );
  });
});

describe("day swipe while a job is open", () => {
  it("moves a day for a horizontal swipe on the roster", () => {
    assert.equal(rosterDaySwipe({
      startX: 200, startY: 100, endX: 100, endY: 110, scrollDelta: 0, fromJobCard: false,
    }), 1);
    assert.equal(rosterDaySwipe({
      startX: 40, startY: 100, endX: 160, endY: 110, scrollDelta: 0, fromJobCard: false,
    }), -1);
  });

  it("does not change the day when the gesture is the open job card", () => {
    // Leftward move is what used to call navigate(+1) and show the next day
    // after the job was closed.
    assert.equal(rosterDaySwipe({
      startX: 300, startY: 80, endX: 40, endY: 90, scrollDelta: 0, fromJobCard: true,
    }), 0);
    assert.equal(rosterDaySwipe({
      startX: 20, startY: 200, endX: 180, endY: 210, scrollDelta: 0, fromJobCard: true,
    }), 0);
  });

  it("ignores a timeline scroll and a tap", () => {
    assert.equal(rosterDaySwipe({
      startX: 200, startY: 100, endX: 80, endY: 100, scrollDelta: 40, fromJobCard: false,
    }), 0);
    assert.equal(rosterDaySwipe({
      startX: 200, startY: 100, endX: 210, endY: 108, scrollDelta: 0, fromJobCard: false,
    }), 0);
    assert.equal(rosterDaySwipe({
      startX: null, startY: null, endX: 10, endY: 10, scrollDelta: 0, fromJobCard: false,
    }), 0);
  });
});
