import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { commitApprovedBillingAction } from "./jobsNotBilledApproval.ts";

describe("not billed approval gate", () => {
  it("does not create or send when confirm is missing, false, or a string", async () => {
    for (const confirm of [undefined, false, "true", 1, null]) {
      let called = 0;
      const result = await commitApprovedBillingAction(
        { confirm, status: "draft", step: "create_invoice" },
        async () => {
          called += 1;
          return { ok: true, message: "created" };
        },
      );
      assert.equal(called, 0, `action ran for confirm=${String(confirm)}`);
      assert.equal(result.ok, false);
    }
  });

  it("creates a draft invoice only after confirm is true", async () => {
    let called = 0;
    const result = await commitApprovedBillingAction(
      { confirm: true, status: "draft", step: "create_invoice" },
      async () => {
        called += 1;
        return { ok: true, message: "Draft invoice created." };
      },
    );
    assert.equal(called, 1);
    assert.equal(result.ok, true);
  });

  it("sends only after confirm is true", async () => {
    let called = 0;
    const result = await commitApprovedBillingAction(
      { confirm: true, status: "snoozed", step: "send_invoice" },
      async () => {
        called += 1;
        return { ok: true, message: "Invoice sent." };
      },
    );
    assert.equal(called, 1);
    assert.equal(result.ok, true);
  });

  it("does not act on a row that is already done or dismissed", async () => {
    let called = 0;
    const result = await commitApprovedBillingAction(
      { confirm: true, status: "done", step: "send_invoice" },
      async () => {
        called += 1;
        return { ok: true, message: "sent" };
      },
    );
    assert.equal(called, 0);
    assert.equal(result.ok, false);
  });

  it("does not create an invoice when the preview has no price", async () => {
    let called = 0;
    const result = await commitApprovedBillingAction(
      { confirm: true, status: "draft", step: "create_invoice", blockingReason: "Add a price on the accepted quote or the job before creating the invoice." },
      async () => {
        called += 1;
        return { ok: true, message: "created" };
      },
    );
    assert.equal(called, 0);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 422);
  });

  it("does not treat a Xero sync as an action on this queue", async () => {
    let called = 0;
    const result = await commitApprovedBillingAction(
      { confirm: true, status: "draft", step: "sync_xero" },
      async () => {
        called += 1;
        return { ok: true, message: "synced" };
      },
    );
    assert.equal(called, 0);
    assert.equal(result.ok, false);
  });

  it("does not mark a failed send as done", async () => {
    const result = await commitApprovedBillingAction(
      { confirm: true, status: "draft", step: "send_invoice" },
      async () => ({ ok: false, message: "SMS didn't send." }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 502);
    assert.match(result.message, /SMS/);
  });
});
