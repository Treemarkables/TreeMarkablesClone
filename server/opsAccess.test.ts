import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { hashOpsApiKey, resolveOpsAccess, type OpsApiKey, type OpsEmployee } from "./opsAccess.ts";

const admin: OpsEmployee = { id: "emp-admin", role: "admin", businessId: "biz-a" };
const crew: OpsEmployee = { id: "emp-crew", role: "crew", businessId: "biz-a" };
const key: OpsApiKey = { id: "key-1", businessId: "biz-a", isActive: true };
const otherKey: OpsApiKey = { id: "key-2", businessId: "biz-b", isActive: true };

function lookups(employees: OpsEmployee[], keys: OpsApiKey[]) {
  return {
    lookupEmployee: async (id: string) => employees.find((employee) => employee.id === id),
    lookupApiKey: async (keyHash: string) => keys.find((row) => row.id === keyHash),
  };
}

describe("ops access", () => {
  it("hashes API keys with sha256", () => {
    const raw = "ops-secret";
    assert.equal(hashOpsApiKey(raw), createHash("sha256").update(raw).digest("hex"));
  });

  it("scopes a session to the employee business and lets only admins write", async () => {
    const adminAccess = await resolveOpsAccess({
      sessionEmployeeId: admin.id,
      sessionBusinessId: "biz-a",
      ...lookups([admin], []),
    });
    assert.equal(adminAccess.ok, true);
    if (adminAccess.ok) {
      assert.equal(adminAccess.businessId, "biz-a");
      assert.equal(adminAccess.canSetDailyRevenueTarget, true);
    }

    const crewAccess = await resolveOpsAccess({
      sessionEmployeeId: crew.id,
      sessionBusinessId: "biz-a",
      ...lookups([crew], []),
    });
    assert.equal(crewAccess.ok, true);
    if (crewAccess.ok) assert.equal(crewAccess.canSetDailyRevenueTarget, false);
  });

  it("rejects a session whose business does not match the employee", async () => {
    const access = await resolveOpsAccess({
      sessionEmployeeId: admin.id,
      sessionBusinessId: "biz-b",
      ...lookups([admin], []),
    });
    assert.deepEqual(access, {
      ok: false,
      status: 403,
      message: "Session is not scoped to this business",
    });
  });

  it("accepts a business-scoped API key and rejects an unscoped one", async () => {
    const hashed = hashOpsApiKey("ops-secret");
    const stored = { ...key, id: hashed };
    const access = await resolveOpsAccess({
      authorizationHeader: "Bearer ops-secret",
      lookupEmployee: async () => undefined,
      lookupApiKey: async (keyHash) => (keyHash === hashed ? stored : undefined),
    });
    assert.equal(access.ok, true);
    if (access.ok) {
      assert.equal(access.businessId, "biz-a");
      assert.equal(access.canSetDailyRevenueTarget, true);
      assert.equal(access.via, "apiKey");
    }

    const unscoped = await resolveOpsAccess({
      authorizationHeader: "Bearer ops-secret",
      lookupEmployee: async () => undefined,
      lookupApiKey: async () => ({ id: "k", businessId: null, isActive: true }),
    });
    assert.equal(unscoped.ok, false);
    if (!unscoped.ok) assert.equal(unscoped.status, 401);
  });

  it("refuses a key for a different business than the signed-in employee", async () => {
    const access = await resolveOpsAccess({
      sessionEmployeeId: admin.id,
      sessionBusinessId: "biz-a",
      authorizationHeader: "Bearer other",
      lookupEmployee: async () => admin,
      lookupApiKey: async () => otherKey,
    });
    assert.equal(access.ok, false);
    if (!access.ok) assert.equal(access.status, 403);
  });

  it("requires some credential", async () => {
    const access = await resolveOpsAccess({
      lookupEmployee: async () => undefined,
      lookupApiKey: async () => undefined,
    });
    assert.deepEqual(access, { ok: false, status: 401, message: "Authentication required" });
  });
});
