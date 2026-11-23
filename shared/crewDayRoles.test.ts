import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateRoleSnapshots,
  joinRoleLabels,
  outstandingForRoles,
  parseClockInRoles,
  planDayRoleChanges,
  primaryDayRole,
  readRoleList,
  resolveDesiredDayRoles,
  rolesFromDayRolePayload,
  selectRolesForDate,
  toggleRole,
} from "./crewDayRoles.ts";

describe("toggleRole", () => {
  it("adds a second role without clearing the first", () => {
    assert.deepEqual(toggleRole(["C"], "A"), ["C", "A"]);
  });

  it("adds a third role and keeps checklist order", () => {
    assert.deepEqual(toggleRole(["A", "B"], "C"), ["C", "A", "B"]);
  });

  it("adds Risk assessment beside a role they already hold", () => {
    assert.deepEqual(toggleRole(["A"], "R"), ["A", "R"]);
    assert.deepEqual(toggleRole(["C", "A"], "R"), ["C", "A", "R"]);
  });

  it("removes only the role that was tapped", () => {
    assert.deepEqual(toggleRole(["C", "A"], "C"), ["A"]);
  });

  it("clears the last role", () => {
    assert.deepEqual(toggleRole(["B"], "B"), []);
  });
});

describe("planDayRoleChanges", () => {
  it("leaves a one-role assignment untouched when that role is saved again", () => {
    assert.deepEqual(planDayRoleChanges(["A"], ["A"]), { insert: [], remove: [] });
  });

  it("still replaces a one-role assignment when a different single role is saved", () => {
    assert.deepEqual(planDayRoleChanges(["A"], ["B"]), { insert: ["B"], remove: ["A"] });
  });

  it("inserts the extra role and does not remove the one they already hold", () => {
    assert.deepEqual(planDayRoleChanges(["C"], ["C", "A"]), { insert: ["A"], remove: [] });
  });

  it("removes every role when the set is cleared", () => {
    assert.deepEqual(planDayRoleChanges(["C", "B"], []), { insert: [], remove: ["C", "B"] });
  });
});

describe("resolveDesiredDayRoles", () => {
  it("stores both roles from the job-card chip set", () => {
    const resolved = resolveDesiredDayRoles({ dayRoles: ["A", "C"] });
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.deepEqual(resolved.roles, ["C", "A"]);
  });

  it("keeps a one-role save as a one-role set", () => {
    const resolved = resolveDesiredDayRoles({ dayRole: "B" });
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.deepEqual(resolved.roles, ["B"]);
  });

  it("clears every role when dayRole is null", () => {
    const resolved = resolveDesiredDayRoles({ dayRole: null, existing: ["C", "A"] });
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.deepEqual(resolved.roles, []);
  });

  it("adds a role from Add crew without dropping one already held today", () => {
    const resolved = resolveDesiredDayRoles({ addRoles: ["A"], existing: ["C"] });
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.deepEqual(resolved.roles, ["C", "A"]);
  });

  it("stores Risk assessment together with another role", () => {
    const resolved = resolveDesiredDayRoles({ dayRoles: ["R", "A"] });
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.deepEqual(resolved.roles, ["A", "R"]);
  });

  it("keeps a one-role Risk assessment assignment as a one-role set", () => {
    const resolved = resolveDesiredDayRoles({ dayRole: "R" });
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.deepEqual(resolved.roles, ["R"]);
  });

  it("rejects a role that is not a checklist role", () => {
    const resolved = resolveDesiredDayRoles({ dayRoles: ["C", "lead"] });
    assert.equal(resolved.ok, false);
  });

  it("treats an empty dayRoles array as a clear", () => {
    const resolved = resolveDesiredDayRoles({ dayRoles: [] });
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.deepEqual(resolved.roles, []);
  });
});

describe("parseClockInRoles", () => {
  it("accepts the full chip set from Start", () => {
    assert.deepEqual(parseClockInRoles(["B", "C"]), ["C", "B"]);
  });

  it("accepts a single role from an older client", () => {
    assert.deepEqual(parseClockInRoles("A"), ["A"]);
  });

  it("leaves existing roles alone when no chip is set", () => {
    assert.equal(parseClockInRoles(undefined), null);
    assert.equal(parseClockInRoles([]), null);
    assert.equal(parseClockInRoles(null), null);
  });
});

describe("rolesFromDayRolePayload", () => {
  it("reads every role after reload", () => {
    assert.deepEqual(rolesFromDayRolePayload({ dayRoles: ["A", "C"], dayRole: "C" }), ["C", "A"]);
  });

  it("reads a historical one-role payload that has no dayRoles array", () => {
    assert.deepEqual(rolesFromDayRolePayload({ dayRole: "B" }), ["B"]);
  });

  it("does not invent a role from dayRole when dayRoles is an empty list", () => {
    assert.deepEqual(rolesFromDayRolePayload({ dayRoles: [], dayRole: "C" }), []);
  });
});

describe("selectRolesForDate", () => {
  it("snapshots only the role held on the close date for a one-role job", () => {
    assert.deepEqual(
      selectRolesForDate(
        [
          { nzDate: "2026-09-22", roleKey: "A" },
          { nzDate: "2026-09-23", roleKey: "C" },
        ],
        "2026-09-23",
      ),
      ["C"],
    );
  });

  it("snapshots every role held on the close date", () => {
    assert.deepEqual(
      selectRolesForDate(
        [
          { nzDate: "2026-09-23", roleKey: "A" },
          { nzDate: "2026-09-23", roleKey: "C" },
          { nzDate: "2026-09-22", roleKey: "B" },
        ],
        "2026-09-23",
      ),
      ["C", "A"],
    );
  });

  it("falls back to every role on the latest day the job ran", () => {
    assert.deepEqual(
      selectRolesForDate(
        [
          { nzDate: "2026-09-20", roleKey: "B" },
          { nzDate: "2026-09-22", roleKey: "C" },
          { nzDate: "2026-09-22", roleKey: "A" },
        ],
        "2026-09-24",
      ),
      ["C", "A"],
    );
  });
});

describe("outstandingForRoles", () => {
  const tasks = [
    { itemId: "time-tracking", label: "Time tracking", roleKey: "C", isEnabled: true },
    { itemId: "risk-assessment", label: "Risk assessment", roleKey: "A", isEnabled: true },
    { itemId: "signs-out", label: "Signs out", roleKey: "B", isEnabled: true },
    { itemId: "disabled", label: "Hidden", roleKey: "C", isEnabled: false },
  ];

  it("includes unticked tasks from each role they hold", () => {
    const items = outstandingForRoles(["C", "A"], tasks, new Set(["time-tracking"]));
    assert.deepEqual(items.map((item) => item.itemId), ["risk-assessment"]);
  });

  it("ignores roles they do not hold", () => {
    const items = outstandingForRoles(["B"], tasks, new Set());
    assert.deepEqual(items.map((item) => item.itemId), ["signs-out"]);
  });

  it("treats Risk assessment as its own role, not as part of Kaiwhangai", () => {
    const withRiskRole = [
      { itemId: "content-creation", label: "Content creation", roleKey: "A", isEnabled: true },
      { itemId: "risk-assessment", label: "Risk assessment", roleKey: "R", isEnabled: true },
    ];
    assert.deepEqual(
      outstandingForRoles(["A"], withRiskRole, new Set()).map((item) => item.itemId),
      ["content-creation"],
    );
    assert.deepEqual(
      outstandingForRoles(["A", "R"], withRiskRole, new Set()).map((item) => item.itemId),
      ["content-creation", "risk-assessment"],
    );
    assert.deepEqual(
      outstandingForRoles(["R"], withRiskRole, new Set(["risk-assessment"])),
      [],
    );
  });
});

describe("aggregateRoleSnapshots", () => {
  it("counts a one-role history as one job per snapshot row", () => {
    const aggs = aggregateRoleSnapshots([
      { employeeId: "e1", jobId: "j1", roleKey: "C", itemsDone: 2, itemsExpected: 2 },
      { employeeId: "e1", jobId: "j2", roleKey: "A", itemsDone: 1, itemsExpected: 2 },
    ]);
    const row = aggs.get("e1");
    assert.equal(row?.jobsCounted, 2);
    assert.equal(row?.jobsFullyComplete, 1);
    assert.equal(row?.itemsDone, 3);
    assert.equal(row?.itemsExpected, 4);
    assert.deepEqual(row?.roleKeys, ["C", "A"]);
  });

  it("counts two roles on one job as one job, finished only when both lists are", () => {
    const aggs = aggregateRoleSnapshots([
      { employeeId: "e1", jobId: "j1", roleKey: "C", itemsDone: 2, itemsExpected: 2 },
      { employeeId: "e1", jobId: "j1", roleKey: "A", itemsDone: 1, itemsExpected: 2 },
    ]);
    const row = aggs.get("e1");
    assert.equal(row?.jobsCounted, 1);
    assert.equal(row?.jobsFullyComplete, 0);
    assert.equal(row?.itemsDone, 3);
    assert.equal(row?.itemsExpected, 4);
    assert.deepEqual(row?.roleKeys, ["C", "A"]);
  });
});

describe("labels and the legacy mirror", () => {
  it("names a single role the way the chips do", () => {
    assert.equal(joinRoleLabels(["C"]), "Kaitiaki");
  });

  it("names every role they hold", () => {
    assert.equal(joinRoleLabels(["A", "C", "B"]), "Kaitiaki, Kaiwhangai and Kaitirotiro");
  });

  it("mirrors Kaitiaki when they also hold another role", () => {
    assert.equal(primaryDayRole(["A", "C"]), "C");
  });

  it("mirrors the only role on a one-role assignment", () => {
    assert.equal(primaryDayRole(["B"]), "B");
    assert.equal(primaryDayRole([]), null);
  });

  it("keeps the crew role as the legacy mirror when they also hold Risk assessment", () => {
    assert.equal(primaryDayRole(["R", "C"]), "C");
    assert.equal(primaryDayRole(["A", "R"]), "A");
    assert.equal(primaryDayRole(["R"]), "R");
  });

  it("names Risk assessment with the other roles they hold", () => {
    assert.equal(joinRoleLabels(["R"]), "Risk assessment");
    assert.equal(joinRoleLabels(["R", "A"]), "Kaiwhangai and Risk assessment");
  });
});

describe("readRoleList", () => {
  it("collapses duplicates", () => {
    assert.deepEqual(readRoleList(["A", "A", "C"]), ["C", "A"]);
  });
});
