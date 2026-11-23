import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getNZDateString } from "./dateUtils.ts";
import {
  checklistCompletionClearsRiskDue,
  doneIdsIncludingLinkedJha,
  EMPTY_JOB_RISK,
  jhaAssessmentHref,
  jhaCompletionRequiresJob,
  normalizeJhaJobId,
  RISK_ASSESSMENT_CHECKLIST_ITEM_ID,
  riskAssessmentForJobDay,
  riskAssessmentsByJobForDay,
  riskLinkClearedByChecklist,
  type JhaRiskSnapshot,
} from "./jhaJobRisk.ts";

const JOB = "job-1";
const OTHER = "job-2";
// Day keys must match getNZDateString — the same helper Today uses to decide
// which jobs are "today". Instants are chosen so the helper puts them on
// different calendar days whether or not the process timezone is Auckland.
const MORNING = "2026-09-22T01:00:00.000Z";
const LATER = "2026-09-22T03:00:00.000Z";
const PREVIOUS_EVENING = "2026-09-20T19:00:00.000Z";
const TODAY = getNZDateString(MORNING);
const PREVIOUS_DAY = getNZDateString(PREVIOUS_EVENING);

function row(partial: Partial<JhaRiskSnapshot> & Pick<JhaRiskSnapshot, "id" | "status">): JhaRiskSnapshot {
  return {
    jobId: JOB,
    date: MORNING,
    completedAt: null,
    ...partial,
  };
}

describe("NZ day used for morning JHA", () => {
  it("uses the same day key as Today, and keeps a later same-day instant on that day", () => {
    assert.match(TODAY, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(getNZDateString(LATER), TODAY);
    assert.notEqual(PREVIOUS_DAY, TODAY);
  });
});

describe("riskAssessmentForJobDay", () => {
  it("is none when nothing is linked to the job that day", () => {
    assert.deepEqual(riskAssessmentForJobDay([], JOB, TODAY), EMPTY_JOB_RISK);
    assert.deepEqual(
      riskAssessmentForJobDay(
        [row({ id: "a", status: "completed", jobId: OTHER })],
        JOB,
        TODAY,
      ),
      EMPTY_JOB_RISK,
    );
  });

  it("ignores a completed assessment from another NZ day", () => {
    assert.deepEqual(
      riskAssessmentForJobDay(
        [row({ id: "yesterday", status: "completed", date: PREVIOUS_EVENING, completedAt: PREVIOUS_EVENING })],
        JOB,
        TODAY,
      ),
      EMPTY_JOB_RISK,
    );
  });

  it("returns draft when the only same-day assessment is a draft", () => {
    assert.deepEqual(
      riskAssessmentForJobDay([row({ id: "draft-1", status: "draft" })], JOB, TODAY),
      { riskAssessmentStatus: "draft", riskAssessmentId: "draft-1" },
    );
  });

  it("returns completed for a same-day completed JHA and keeps that over a later draft", () => {
    const result = riskAssessmentForJobDay(
      [
        row({
          id: "draft-later",
          status: "draft",
          date: LATER,
        }),
        row({
          id: "done",
          status: "completed",
          date: MORNING,
          completedAt: MORNING,
        }),
      ],
      JOB,
      TODAY,
    );
    assert.deepEqual(result, { riskAssessmentStatus: "completed", riskAssessmentId: "done" });
  });

  it("picks the latest completed assessment when several exist the same day", () => {
    const result = riskAssessmentForJobDay(
      [
        row({ id: "early", status: "completed", completedAt: MORNING }),
        row({
          id: "later",
          status: "completed",
          date: LATER,
          completedAt: LATER,
        }),
      ],
      JOB,
      TODAY,
    );
    assert.equal(result.riskAssessmentStatus, "completed");
    assert.equal(result.riskAssessmentId, "later");
  });

  it("ignores archived rows and rows with no job", () => {
    assert.deepEqual(
      riskAssessmentForJobDay(
        [
          row({ id: "arch", status: "archived" }),
          row({ id: "loose", status: "completed", jobId: null }),
        ],
        JOB,
        TODAY,
      ),
      EMPTY_JOB_RISK,
    );
  });

  it("returns none for a blank job id or a bad day", () => {
    assert.deepEqual(
      riskAssessmentForJobDay([row({ id: "done", status: "completed" })], "", TODAY),
      EMPTY_JOB_RISK,
    );
    assert.deepEqual(
      riskAssessmentForJobDay([row({ id: "done", status: "completed" })], JOB, "today"),
      EMPTY_JOB_RISK,
    );
  });
});

describe("riskAssessmentsByJobForDay", () => {
  it("fills every requested job, including ones with no assessment", () => {
    const map = riskAssessmentsByJobForDay(
      [row({ id: "done", status: "completed" })],
      [JOB, OTHER],
      TODAY,
    );
    assert.equal(map.get(JOB)?.riskAssessmentStatus, "completed");
    assert.equal(map.get(JOB)?.riskAssessmentId, "done");
    assert.deepEqual(map.get(OTHER), EMPTY_JOB_RISK);
  });
});

describe("checklist role and the due state", () => {
  const none = { riskAssessmentStatus: "none" as const, riskAssessmentId: null };
  const draft = { riskAssessmentStatus: "draft" as const, riskAssessmentId: "draft-1" };
  const done = { riskAssessmentStatus: "completed" as const, riskAssessmentId: "done" };

  it("leaves a completed JHA in place when the checklist item is still open", () => {
    assert.deepEqual(riskLinkClearedByChecklist(done, false), done);
  });

  it("clears due when the Risk assessment role is ticked and no JHA is completed", () => {
    assert.deepEqual(riskLinkClearedByChecklist(none, true), {
      riskAssessmentStatus: "completed",
      riskAssessmentId: null,
    });
  });

  it("clears a draft nag when the role is ticked and keeps the draft id", () => {
    assert.deepEqual(riskLinkClearedByChecklist(draft, true), {
      riskAssessmentStatus: "completed",
      riskAssessmentId: "draft-1",
    });
  });

  it("does not clear due for an open role with no completed JHA", () => {
    assert.deepEqual(riskLinkClearedByChecklist(draft, false), draft);
    assert.deepEqual(riskLinkClearedByChecklist(none, false), none);
  });

  it("counts a linked completed JHA as the checklist item being done", () => {
    const ids = doneIdsIncludingLinkedJha([{ itemId: "signs-out" }], done, TODAY);
    assert.equal(ids.has(RISK_ASSESSMENT_CHECKLIST_ITEM_ID), true);
    assert.equal(ids.has("signs-out"), true);
  });

  it("counts a checklist tick only on the NZ day it was recorded", () => {
    assert.equal(
      checklistCompletionClearsRiskDue(MORNING, TODAY),
      true,
    );
    assert.equal(
      checklistCompletionClearsRiskDue(PREVIOUS_EVENING, TODAY),
      false,
    );
    const todayTick = doneIdsIncludingLinkedJha(
      [{ itemId: RISK_ASSESSMENT_CHECKLIST_ITEM_ID, completedAt: MORNING }],
      none,
      TODAY,
    );
    assert.equal(todayTick.has(RISK_ASSESSMENT_CHECKLIST_ITEM_ID), true);
    const staleTick = doneIdsIncludingLinkedJha(
      [{ itemId: RISK_ASSESSMENT_CHECKLIST_ITEM_ID, completedAt: PREVIOUS_EVENING }],
      none,
      TODAY,
    );
    assert.equal(staleTick.has(RISK_ASSESSMENT_CHECKLIST_ITEM_ID), false);
  });

  it("does not mark the checklist item done for a draft or a missing JHA", () => {
    assert.equal(doneIdsIncludingLinkedJha([], draft, TODAY).has(RISK_ASSESSMENT_CHECKLIST_ITEM_ID), false);
    assert.equal(doneIdsIncludingLinkedJha([], none, TODAY).has(RISK_ASSESSMENT_CHECKLIST_ITEM_ID), false);
    assert.equal(doneIdsIncludingLinkedJha([], undefined, TODAY).has(RISK_ASSESSMENT_CHECKLIST_ITEM_ID), false);
  });
});

describe("job link helpers", () => {
  it("normalises a job id and drops empty sentinels", () => {
    assert.equal(normalizeJhaJobId("  job-1  "), "job-1");
    assert.equal(normalizeJhaJobId(42), "42");
    assert.equal(normalizeJhaJobId(null), null);
    assert.equal(normalizeJhaJobId(""), null);
    assert.equal(normalizeJhaJobId("null"), null);
    assert.equal(normalizeJhaJobId("undefined"), null);
  });

  it("requires a job only when the assessment is completed", () => {
    assert.equal(jhaCompletionRequiresJob("completed"), true);
    assert.equal(jhaCompletionRequiresJob("draft"), false);
    assert.equal(jhaCompletionRequiresJob(null), false);
  });

  it("builds the job card deep link and reopens a draft", () => {
    assert.equal(jhaAssessmentHref("job-1"), "/jha-assessment?jobId=job-1");
    assert.equal(
      jhaAssessmentHref("job-1", { riskAssessmentStatus: "completed", riskAssessmentId: "done" }),
      "/jha-assessment?jobId=job-1",
    );
    assert.equal(
      jhaAssessmentHref("job-1", { riskAssessmentStatus: "draft", riskAssessmentId: "draft-1" }),
      "/jha-assessment?id=draft-1&jobId=job-1",
    );
  });
});
