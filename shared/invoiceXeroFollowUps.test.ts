import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildXeroSyncPreview,
  invoiceNeedsXeroSync,
  planInvoiceXeroFollowUps,
  wasSentToClient,
  type InvoiceXeroSignal,
} from "./invoiceXeroFollowUps.ts";

const NOW = Date.parse("2026-09-28T01:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function invoice(overrides: Partial<InvoiceXeroSignal> = {}): InvoiceXeroSignal {
  return {
    id: "inv-1",
    businessId: "biz-a",
    jobId: "job-1",
    customerId: "cust-1",
    invoiceNumber: "4048",
    status: "sent",
    sentDate: new Date(NOW - 2 * DAY).toISOString(),
    updatedAt: new Date(NOW - 2 * DAY).toISOString(),
    amount: "575.00",
    description: "Fell the gum",
    dueDate: new Date(NOW + 7 * DAY).toISOString(),
    address: "12 Gladstone Road, Gisborne",
    items: [
      { description: "Tree removal", quantity: 2, rate: 200, total: 400 },
      { description: "Tip fee", quantity: 1, unitPrice: 100, total: 100 },
    ],
    xeroInvoiceId: null,
    jobXeroInvoiceId: null,
    xeroStatus: null,
    customerName: "Ngata, Sam",
    customerEmail: "sam@example.co.nz",
    customerPhone: "021000000",
    jobNumber: "4048",
    jobTitle: "Fell the gum",
    ...overrides,
  };
}

function plan(overrides: Partial<InvoiceXeroSignal> = {}, existing: { businessId: string; invoiceId: string; status: string }[] = []) {
  return planInvoiceXeroFollowUps({
    now: NOW,
    businessId: "biz-a",
    invoices: [invoice(overrides)],
    existing,
  });
}

describe("invoices not in Xero detection", () => {
  it("does not flag an invoice that has not been sent", () => {
    assert.equal(wasSentToClient({ status: "pending", sentDate: null }), false);
    assert.deepEqual(plan({ status: "pending", sentDate: null }), []);
  });

  it("flags a sent invoice with no Xero id", () => {
    const plans = plan();
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.action, "create");
    assert.equal(invoiceNeedsXeroSync({ xeroInvoiceId: null, xeroStatus: null }), true);
  });

  it("flags an email or SMS send that only stamped sentDate", () => {
    const plans = plan({ status: "paid", sentDate: new Date(NOW - DAY).toISOString() });
    assert.equal(plans[0]?.action, "create");
  });

  it("does not flag an invoice already in Xero", () => {
    assert.equal(invoiceNeedsXeroSync({ xeroInvoiceId: "xero-1", xeroStatus: "sent" }), false);
    assert.deepEqual(plan({ xeroInvoiceId: "xero-1", xeroStatus: "sent" }), []);
    assert.deepEqual(plan({ jobXeroInvoiceId: "xero-1", xeroStatus: null }), []);
  });

  it("flags pending, failed, and error sync status even when an id is present", () => {
    for (const xeroStatus of ["pending", "failed", "error"]) {
      const plans = plan({ xeroInvoiceId: "xero-1", xeroStatus });
      assert.equal(plans[0]?.action, "create", xeroStatus);
    }
  });

  it("does not create a second row for the same invoice", () => {
    assert.deepEqual(plan({}, [{ businessId: "biz-a", invoiceId: "inv-1", status: "draft" }]), []);
  });

  it("cancels a waiting row once the invoice is in Xero", () => {
    const plans = plan(
      { xeroInvoiceId: "xero-1", xeroStatus: "sent" },
      [{ businessId: "biz-a", invoiceId: "inv-1", status: "draft" }],
    );
    assert.equal(plans[0]?.action, "cancel");
  });

  it("does not bring back a dismissed invoice", () => {
    assert.deepEqual(plan({}, [{ businessId: "biz-a", invoiceId: "inv-1", status: "dismissed" }]), []);
  });

  it("reopens a synced row if Xero was reset", () => {
    const plans = plan({}, [{ businessId: "biz-a", invoiceId: "inv-1", status: "synced" }]);
    assert.equal(plans[0]?.action, "reopen");
  });
});

describe("tenant isolation", () => {
  it("does not plan another tenant's invoice", () => {
    const plans = planInvoiceXeroFollowUps({
      now: NOW,
      businessId: "biz-a",
      invoices: [invoice({ id: "inv-b", businessId: "biz-b" })],
      existing: [],
    });
    assert.deepEqual(plans, []);
  });

  it("does not let another tenant's row suppress this tenant", () => {
    const plans = plan({}, [{ businessId: "biz-b", invoiceId: "inv-1", status: "synced" }]);
    assert.equal(plans[0]?.action, "create");
    if (plans[0]?.action !== "create") return;
    assert.equal(plans[0].businessId, "biz-a");
  });
});

describe("Xero preview", () => {
  it("shows contact, lines, GST, and account code without changing the invoice", () => {
    const source = invoice();
    const original = JSON.parse(JSON.stringify(source.items));
    const preview = buildXeroSyncPreview({ invoice: source, accountCode: "200", taxType: "OUTPUT2" });
    assert.equal(preview.currency, "NZD");
    assert.equal(preview.contact.name, "Ngata, Sam");
    assert.equal(preview.accountCode, "200");
    assert.equal(preview.taxType, "OUTPUT2");
    assert.equal(preview.gstRate, 0.15);
    assert.equal(preview.lineItems[0]?.lineTotal, 400);
    assert.equal(preview.subtotal, 500);
    assert.equal(preview.gst, 75);
    assert.equal(preview.total, 575);
    assert.equal(preview.blockingReason, null);
    assert.deepEqual(source.items, original);
  });

  it("blocks a sync when the address is missing", () => {
    const preview = buildXeroSyncPreview({ invoice: invoice({ address: "" }) });
    assert.match(preview.blockingReason ?? "", /address/);
  });
});
