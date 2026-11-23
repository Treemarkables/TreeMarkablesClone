import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { commitApprovedXeroSync } from "./invoiceXeroApproval.ts";
import { buildXeroSyncPreview, type InvoiceXeroSignal } from "./invoiceXeroFollowUps.ts";

const invoice: InvoiceXeroSignal = {
  id: "inv-1",
  businessId: "biz-a",
  jobId: "job-1",
  customerId: "cust-1",
  invoiceNumber: "4048",
  status: "sent",
  sentDate: "2026-09-26T00:00:00.000Z",
  amount: "100.00",
  address: "12 Gladstone Road, Gisborne",
  items: [{ description: "Tree removal", quantity: 1, rate: 100, total: 100 }],
  customerName: "Sam Ngata",
  jobNumber: "4048",
};

const preview = buildXeroSyncPreview({ invoice });

describe("invoice Xero approval gate", () => {
  it("does not sync when confirm is missing, false, or a string", async () => {
    for (const confirm of [undefined, false, "true", 1, null]) {
      let called = 0;
      const result = await commitApprovedXeroSync(
        { confirm, status: "draft", preview },
        async () => {
          called += 1;
          return { ok: true, message: "synced" };
        },
      );
      assert.equal(called, 0, `sync ran for confirm=${String(confirm)}`);
      assert.equal(result.ok, false);
    }
  });

  it("syncs only after confirm is true", async () => {
    let called = 0;
    const result = await commitApprovedXeroSync(
      { confirm: true, status: "draft", preview },
      async () => {
        called += 1;
        return { ok: true, message: "Invoice synced to Xero." };
      },
    );
    assert.equal(called, 1);
    assert.equal(result.ok, true);
  });

  it("does not sync a row that is already synced or dismissed", async () => {
    let called = 0;
    const result = await commitApprovedXeroSync(
      { confirm: true, status: "synced", preview },
      async () => {
        called += 1;
        return { ok: true, message: "synced" };
      },
    );
    assert.equal(called, 0);
    assert.equal(result.ok, false);
  });

  it("does not call Xero when the preview is blocked", async () => {
    let called = 0;
    const blocked = buildXeroSyncPreview({ invoice: { ...invoice, address: "" } });
    const result = await commitApprovedXeroSync(
      { confirm: true, status: "draft", preview: blocked },
      async () => {
        called += 1;
        return { ok: true, message: "synced" };
      },
    );
    assert.equal(called, 0);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 422);
  });

  it("does not mark a failed sync as synced", async () => {
    const result = await commitApprovedXeroSync(
      { confirm: true, status: "snoozed", preview },
      async () => ({ ok: false, message: "Xero rejected the invoice: account code" }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 502);
    assert.match(result.message, /account code/);
  });
});
