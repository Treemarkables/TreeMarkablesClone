/**
 * Run: node --experimental-strip-types --test shared/scheduleCrew.test.ts
 *
 * Adding someone to a job that is already booked must keep the current crew
 * ticked and save one row per person — not a second copy, and not only the
 * person whose start time matched within a minute.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getNZDateString, nzTimeToUTC } from "./dateUtils.ts";
import {
  buildCrewAssignmentRows,
  crewIdsAfterSave,
  crewIdsForScheduleEdit,
  newlyAddedCrewIds,
  snapScheduleDuration,
} from "./scheduleCrew.ts";

/** Same NZ calendar key the schedule form uses for a wall-clock booking. */
function bookedDay(day: string, time = "08:00"): string {
  return getNZDateString(nzTimeToUTC(day, time));
}

describe("reopening a scheduled job", () => {
  it("ticks everyone on the booked day, even when start times differ", () => {
    const day = bookedDay("2026-11-18", "08:00");
    assert.equal(bookedDay("2026-11-18", "10:00"), day);
    const crew = crewIdsForScheduleEdit({
      // The latest dispatch drop overwrites assignedTeam with only that person.
      assignedTo: [],
      assignedTeam: ["staff-b"],
      assignments: [
        { employeeId: "staff-a", startTime: nzTimeToUTC("2026-11-18", "08:00").toISOString() },
        { employeeId: "staff-b", startTime: nzTimeToUTC("2026-11-18", "10:00").toISOString() },
        // Leftover from a previous booking — not this day.
        { employeeId: "staff-old", startTime: nzTimeToUTC("2026-11-01", "08:00").toISOString() },
      ],
      days: [day],
    });

    assert.deepEqual(crew, ["staff-a", "staff-b"]);
  });

  it("keeps a person stored on the job when they have no assignment row", () => {
    const day = bookedDay("2026-11-18");
    const crew = crewIdsForScheduleEdit({
      assignedTo: ["staff-a", "staff-d"],
      assignments: [
        { employeeId: "staff-a", startTime: nzTimeToUTC("2026-11-18", "08:00").toISOString() },
      ],
      days: [day],
    });
    assert.deepEqual(crew, ["staff-a", "staff-d"]);
  });

  it("adds another staff member once, without duplicating the existing crew", () => {
    const day = bookedDay("2026-11-18");
    const booked = crewIdsForScheduleEdit({
      assignedTo: ["staff-a"],
      assignments: [
        { employeeId: "staff-a", startTime: nzTimeToUTC("2026-11-18", "08:00").toISOString() },
      ],
      days: [day],
    });
    const withNewcomer = [...booked, "staff-c"];
    const rows = buildCrewAssignmentRows({
      employeeIds: withNewcomer,
      days: ["2026-11-18"],
      startTime: "08:00",
      durationMinutes: 120,
      notes: "gate",
    });

    assert.deepEqual(
      rows.map((row) => row.employeeId),
      ["staff-a", "staff-c"],
    );
    const keys = rows.map((row) => `${row.employeeId}|${row.startTime}`);
    assert.equal(new Set(keys).size, rows.length);
    assert.equal(rows.length, 2);

    const saved = crewIdsAfterSave({
      addOnly: false,
      existing: [
        { id: "row-a", employeeId: "staff-a" },
      ],
      removedAssignmentIds: ["row-a"],
      submittedEmployeeIds: withNewcomer,
    });
    assert.deepEqual(saved, ["staff-a", "staff-c"]);
    assert.deepEqual(newlyAddedCrewIds(["staff-a"], saved), ["staff-c"]);
  });

  it("on two days, adding one person books them each day and keeps the others", () => {
    const wallDays = ["2026-11-18", "2026-11-20"];
    const days = wallDays.map((d) => bookedDay(d, "07:30"));
    const booked = crewIdsForScheduleEdit({
      assignments: wallDays.flatMap((d) => [
        { employeeId: "staff-a", startTime: nzTimeToUTC(d, "07:30").toISOString() },
        { employeeId: "staff-b", startTime: nzTimeToUTC(d, "07:30").toISOString() },
      ]),
      days,
    });
    const rows = buildCrewAssignmentRows({
      employeeIds: [...booked, "staff-c"],
      days: wallDays,
      startTime: "07:30",
      durationMinutes: 480,
      notes: "",
    });
    assert.equal(rows.length, 6);
    assert.deepEqual(
      [...new Set(rows.map((row) => row.employeeId))],
      ["staff-a", "staff-b", "staff-c"],
    );
    for (const id of ["staff-a", "staff-b", "staff-c"]) {
      assert.equal(rows.filter((row) => row.employeeId === id).length, 2);
    }
  });

  it("snaps a duration the dropdown does not list", () => {
    assert.equal(snapScheduleDuration(120), "120");
    assert.equal(snapScheduleDuration(130), "135");
    assert.equal(snapScheduleDuration(Number.NaN), "");
  });
});
