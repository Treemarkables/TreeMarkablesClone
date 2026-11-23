import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_ACTIONS,
  recordAuthEvent,
  requestAuditContext,
  sanitizeAuditMetadata,
  setAuditLogWriterForTests,
  writeAuditLog,
  type AuditLogInput,
} from "./auditLog.ts";

describe("audit_log helpers", { concurrency: 1 }, () => {
  const captured: AuditLogInput[] = [];

  beforeEach(() => {
    captured.length = 0;
    setAuditLogWriterForTests(async (entry) => {
      captured.push(entry);
    });
  });

  it("exposes the Wave 3 auth actions sales/security asked for", () => {
    assert.equal(AUDIT_ACTIONS.LOGIN_SUCCESS, "login.success");
    assert.equal(AUDIT_ACTIONS.LOGIN_FAILURE, "login.failure");
    assert.equal(AUDIT_ACTIONS.PASSWORD_CHANGE, "password.change");
    assert.equal(AUDIT_ACTIONS.ROLE_CHANGE, "role.change");
    assert.equal(AUDIT_ACTIONS.PERMISSION_CHANGE, "permission.change");
  });

  it("pulls IP and user-agent from the request", () => {
    const ctx = requestAuditContext({
      ip: "203.0.113.9",
      headers: { "user-agent": "CrewApp/1.0" },
    });
    assert.equal(ctx.ip, "203.0.113.9");
    assert.equal(ctx.userAgent, "CrewApp/1.0");
  });

  it("strips passwords and authenticator secrets from metadata", () => {
    const clean = sanitizeAuditMetadata({
      reason: "bad_password",
      identifier: "crew@example.com",
      password: "hunter2",
      newPassword: "hunter3",
      code: "123456",
      totpSecret: "JBSWY3DPEHPK3PXP",
    });
    assert.deepEqual(clean, {
      reason: "bad_password",
      identifier: "crew@example.com",
    });
  });

  it("records login success and failure without throwing", async () => {
    await writeAuditLog({
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      success: false,
      ip: "198.51.100.2",
      userAgent: "test",
      metadata: { reason: "bad_password", password: "should-not-land" },
    });
    recordAuthEvent(
      { ip: "198.51.100.2", headers: { "user-agent": "test" } },
      {
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        success: true,
        businessId: "biz-1",
        actorEmployeeId: "emp-1",
        targetEmployeeId: "emp-1",
      },
    );
    await writeAuditLog({
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      actorEmployeeId: "emp-1",
      targetEmployeeId: "emp-2",
    });
    await new Promise((r) => setImmediate(r));
    const actions = captured.map((e) => e.action);
    assert.ok(actions.includes(AUDIT_ACTIONS.LOGIN_FAILURE));
    assert.ok(actions.includes(AUDIT_ACTIONS.LOGIN_SUCCESS));
    assert.ok(actions.includes(AUDIT_ACTIONS.PASSWORD_CHANGE));
  });

  it("fail-open: a broken writer cannot throw out of writeAuditLog", async () => {
    setAuditLogWriterForTests(async () => {
      throw new Error("relation audit_log does not exist");
    });
    await writeAuditLog({
      action: AUDIT_ACTIONS.ROLE_CHANGE,
      actorEmployeeId: "emp-1",
      targetEmployeeId: "emp-9",
    });
  });
});
