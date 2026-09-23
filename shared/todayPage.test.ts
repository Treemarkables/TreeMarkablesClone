import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TODAY_COPY,
  NO_CREW_ID,
  NO_CREW_NAME,
  applyTodayView,
  assignJobsToCrews,
  formatBookedAmount,
  formatClock,
  formatTimeRange,
  formatTodayHeading,
  jobBookedAmount,
  jobsCountLabel,
  kitLabels,
  notesCountLabel,
  parsePickerValue,
  pickerValue,
  uniqueIds,
  type TodayOverviewData,
} from "./todayPage.ts";

describe("today-05 copy has no hyphens", () => {
  it("keeps locked UI strings hyphen free", () => {
    for (const [key, value] of Object.entries(TODAY_COPY)) {
      assert.equal(value.includes("-"), false, `${key} contains a hyphen: ${value}`);
    }
    assert.equal(NO_CREW_NAME.includes("-"), false);
    assert.equal(notesCountLabel(1).includes("-"), false);
    assert.equal(notesCountLabel(2).includes("-"), false);
    assert.equal(jobsCountLabel(1).includes("-"), false);
    assert.equal(jobsCountLabel(3).includes("-"), false);
    assert.equal(formatTimeRange("09:00", "11:00").includes("-"), false);
    assert.equal(formatTodayHeading("2026-09-21").includes("-"), false);
  });
});

describe("time and money", () => {
  it("formats clocks without a leading zero", () => {
    assert.equal(formatClock("09:00"), "9 AM");
    assert.equal(formatClock("11:00"), "11 AM");
    assert.equal(formatClock("13:00"), "1 PM");
    assert.equal(formatClock("10:30"), "10:30 AM");
  });

  it("joins a range with to", () => {
    assert.equal(formatTimeRange("09:00", "11:00"), "9 AM to 11 AM");
    assert.equal(formatTimeRange("13:00", "15:00"), "1 PM to 3 PM");
    assert.equal(formatTimeRange("10:00", null), "10 AM");
  });

  it("formats booked amounts like the mockup", () => {
    assert.equal(formatBookedAmount(6300), "$6.3k");
    assert.equal(formatBookedAmount(1400), "$1.4k");
    assert.equal(formatBookedAmount(2000), "$2k");
    assert.equal(formatBookedAmount(890), "$890");
    assert.equal(formatBookedAmount(0), "$0");
  });

  it("labels the NZ date without commas", () => {
    assert.equal(formatTodayHeading("2026-09-21"), "Mon 21 September 2026");
  });

  it("prefers line item ex GST for booked amount", () => {
    assert.equal(
      jobBookedAmount({
        lineItems: [{ totalExGst: 1400, total: 1610, quantity: 1 }],
        totalAmount: "9999",
      }),
      1400,
    );
  });
});

describe("crew grouping", () => {
  it("hides empty crews and leftover jobs land in No crew", () => {
    const groups = assignJobsToCrews(
      [
        { id: "j1", peopleIds: ["josh", "dan"], startMinutes: 9 * 60 },
        { id: "j2", peopleIds: ["zane"], startMinutes: 13 * 60 },
        { id: "j3", peopleIds: ["solo"], startMinutes: 15 * 60 },
      ],
      [
        { id: "chipper", name: "Chipper crew", memberIds: ["josh", "dan", "jack"] },
        { id: "climb", name: "Climb crew", memberIds: ["jullian", "zane"] },
        { id: "idle", name: "Idle crew", memberIds: ["nobody"] },
      ],
    );
    assert.deepEqual(
      groups.map((g) => g.crewId),
      ["chipper", "climb", NO_CREW_ID],
    );
    assert.deepEqual(groups[0].jobIds, ["j1"]);
    assert.deepEqual(groups[1].jobIds, ["j2"]);
    assert.deepEqual(groups[2].jobIds, ["j3"]);
  });

  it("assigns a mixed job to the crew with more overlap", () => {
    const groups = assignJobsToCrews(
      [{ id: "j1", peopleIds: ["josh", "dan", "zane"], startMinutes: 9 * 60 }],
      [
        { id: "chipper", name: "Chipper crew", memberIds: ["josh", "dan", "jack"] },
        { id: "climb", name: "Climb crew", memberIds: ["jullian", "zane"] },
      ],
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0].crewId, "chipper");
  });
});

describe("kit labels", () => {
  it("maps the job card equipment list onto the locked plant catalogue", () => {
    const labels = kitLabels(["eq-1", "big_truck", "bucket-truck", "Trailer"]);
    assert.deepEqual(labels, ["bucket truck", "big truck"]);
    for (const label of labels) {
      assert.equal(label.includes("-"), false, label);
    }
  });

  it("does not invent kit chips when the job has no equipment saved", () => {
    assert.deepEqual(kitLabels([]), []);
    assert.deepEqual(kitLabels(null), []);
    assert.deepEqual(kitLabels(undefined), []);
  });
});

describe("Just me filter", () => {
  const person = (id: string, name: string) => ({
    id,
    firstName: name,
    lastName: "",
    displayName: name,
    initials: name.charAt(0),
    color: "#000",
  });

  const data: TodayOverviewData = {
    date: "2026-09-21",
    dateLabel: "Mon 21 September 2026",
    businessName: "Treemarkables Gisborne",
    currentEmployeeId: "josh",
    counts: {
      jobsToday: 2,
      crewsLive: 2,
      peopleOut: 3,
      bookedLabel: "$3.4k",
      extraNotes: 3,
    },
    notes: [
      { id: "n1", scope: "person", targetId: "josh", targetName: "Josh", note: "rope", color: "#f97316" },
      { id: "n2", scope: "crew", targetId: "chipper", targetName: "Chipper crew", note: "diesel", color: "#2563eb" },
      { id: "n3", scope: "person", targetId: "zane", targetName: "Zane", note: "chains", color: "#eab308" },
    ],
    crews: [
      {
        id: "chipper",
        name: "Chipper crew",
        color: "#2563eb",
        members: [person("josh", "Josh"), person("dan", "Dan")],
        notesCount: 2,
        jobs: [
          {
            id: "j1",
            title: "Hedge",
            address: "12 Rata Street",
            timeLabel: "9 AM to 11 AM",
            people: [person("josh", "Josh")],
            kit: ["chipper"],
            bookedLabel: "$1.4k",
            bookedAmount: 1400,
            riskAssessmentStatus: "completed",
            riskAssessmentId: "jha-1",
          },
        ],
      },
      {
        id: "climb",
        name: "Climb crew",
        color: "#7c3aed",
        members: [person("zane", "Zane")],
        notesCount: 1,
        jobs: [
          {
            id: "j2",
            title: "Crown lift",
            address: "30 Bright Street",
            timeLabel: "1 PM to 3 PM",
            people: [person("zane", "Zane")],
            kit: ["orchard ladder"],
            bookedLabel: "$2k",
            bookedAmount: 2000,
            riskAssessmentStatus: "none",
            riskAssessmentId: null,
          },
        ],
      },
    ],
    peopleOptions: [person("josh", "Josh"), person("zane", "Zane")],
    crewOptions: [{ id: "chipper", name: "Chipper crew" }],
  };

  it("keeps only my jobs, my crews, and notes that apply to me", () => {
    const mine = applyTodayView(data, "me", "josh");
    assert.equal(mine.crews.length, 1);
    assert.equal(mine.crews[0].id, "chipper");
    assert.equal(mine.counts.jobsToday, 1);
    assert.equal(mine.counts.crewsLive, 1);
    assert.equal(mine.counts.peopleOut, 1);
    assert.equal(mine.counts.bookedLabel, "$1.4k");
    assert.deepEqual(
      mine.notes.map((n) => n.id),
      ["n1", "n2"],
    );
    assert.equal(mine.counts.extraNotes, 2);
  });

  it("leaves All crews unchanged", () => {
    const all = applyTodayView(data, "all", "josh");
    assert.equal(all.crews.length, 2);
    assert.equal(all.notes.length, 3);
  });
});

describe("picker values", () => {
  it("round trips person and crew keys", () => {
    assert.deepEqual(parsePickerValue(pickerValue("person", "abc")), { scope: "person", id: "abc" });
    assert.deepEqual(parsePickerValue(pickerValue("crew", "chipper")), { scope: "crew", id: "chipper" });
    assert.equal(parsePickerValue("nope"), null);
  });
});

describe("unique ids", () => {
  it("drops blanks and duplicates while keeping order", () => {
    assert.deepEqual(uniqueIds(["josh", "dan"], ["josh", ""], ["zane"]), ["josh", "dan", "zane"]);
  });
});
