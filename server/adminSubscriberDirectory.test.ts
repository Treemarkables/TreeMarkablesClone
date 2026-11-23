import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checklistProgressOrEmpty,
  compareSubscribersNewestFirst,
  pickOwnerContact,
} from "./adminSubscriberDirectory.ts";

describe("pickOwnerContact", () => {
  it("uses the earliest admin email so a signup is findable by the address they typed", () => {
    const contact = pickOwnerContact({
      settings: { ownerName: "", businessEmail: "" },
      admins: [
        { email: "later@example.com", firstName: "Later", lastName: "Hire", createdAt: "2026-09-20T00:00:00.000Z" },
        { email: "tester@example.com", firstName: "Beta", lastName: "Tester", createdAt: "2026-09-19T00:00:00.000Z" },
      ],
    });
    assert.equal(contact.ownerEmail, "tester@example.com");
    assert.equal(contact.ownerName, "Beta Tester");
  });

  it("prefers a saved owner name but still exposes the signup email", () => {
    const contact = pickOwnerContact({
      settings: { ownerName: "Jules", businessEmail: "office@trees.co.nz" },
      admins: [
        { email: "tester@example.com", firstName: "Beta", lastName: "Tester", createdAt: "2026-09-19T00:00:00.000Z" },
      ],
    });
    assert.equal(contact.ownerName, "Jules");
    assert.equal(contact.ownerEmail, "tester@example.com");
  });

  it("falls back to business email when no admin row exists", () => {
    const contact = pickOwnerContact({
      settings: { ownerName: "Solo", businessEmail: "hello@solo.co.nz" },
      admins: [],
    });
    assert.equal(contact.ownerName, "Solo");
    assert.equal(contact.ownerEmail, "hello@solo.co.nz");
  });
});

describe("compareSubscribersNewestFirst", () => {
  it("puts the newest signup first", () => {
    const rows = [
      { createdAt: "2026-01-01T00:00:00.000Z" },
      { createdAt: "2026-09-21T00:00:00.000Z" },
    ].sort(compareSubscribersNewestFirst);
    assert.equal(rows[0].createdAt, "2026-09-21T00:00:00.000Z");
  });
});

describe("checklistProgressOrEmpty", () => {
  it("does not drop a subscriber when checklist loading throws", async () => {
    const progress = await checklistProgressOrEmpty(async () => {
      throw new Error("tenant scoped read failed");
    });
    assert.deepEqual(progress, { requiredDone: 0, requiredTotal: 0 });
  });

  it("returns real progress when the checklist loads", async () => {
    const progress = await checklistProgressOrEmpty(async () => ({
      requiredDone: 2,
      requiredTotal: 7,
    }));
    assert.deepEqual(progress, { requiredDone: 2, requiredTotal: 7 });
  });
});
