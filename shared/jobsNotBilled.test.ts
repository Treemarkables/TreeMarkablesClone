import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planInvoiceXeroFollowUps, type InvoiceXeroSignal } from "./invoiceXeroFollowUps.ts";
import {
  billingGap,
  buildDraftInvoice,
  planJobsNotBilled,
  type NotBilledJob,
} from "./jobsNotBilled.ts";

const NOW = Date.parse("2026-09-28T01:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function job(overrides: Partial<NotBilledJob> = {}): NotBilledJob {
  return {
    id: "job-1",
    businessId: "biz-a",
    status: "completed",
    completedDate: new Date(NOW - 2 * DAY).toISOString(),
    customerId: "cust-1",
    invoices: [],
    xeroInvoiceId: null,
    xeroStatus: null,
    ...overrides,
  };
}

function plan(overrides: Partial<NotBilledJob> = {}, existing: { businessId: string; jobId: string; status: string; step: string }[] = []) {
  return planJobsNotBilled({
    now: NOW,
    businessId: "biz-a",
    jobs: [job(overrides)],
    existing,
  });
}

describe("completed jobs not billed", () => {
  it("flags a completed job with no invoice as create invoice", () => {
    assert.equal(billingGap(job()), "create_invoice");
    const plans = plan();
    assert.equal(plans[0]?.action, "create");
    if (plans[0]?.action !== "create") return;
    assert.equal(plans[0].step, "create_invoice");
  });

  it("flags an unsent invoice as send to client", () => {
    const plans = plan({
      invoices: [{ id: "inv-1", status: "pending", sentDate: null, invoiceNumber: "4048" }],
    });
    assert.equal(billingGap(job({
      invoices: [{ id: "inv-1", status: "draft", sentDate: null }],
    })), "send_invoice");
    assert.equal(plans[0]?.action, "create");
    if (plans[0]?.action !== "create") return;
    assert.equal(plans[0].step, "send_invoice");
    assert.equal(plans[0].invoiceId, "inv-1");
  });

  it("does not queue a sent invoice that still needs Xero", () => {
    const sent = { id: "inv-1", status: "sent", sentDate: new Date(NOW - DAY).toISOString(), xeroInvoiceId: null, invoiceNumber: "4048" };
    assert.equal(billingGap(job({ invoices: [sent] })), "sync_xero");
    assert.deepEqual(plan({ invoices: [sent] }), []);
  });

  it("ignores a job that is not completed", () => {
    assert.deepEqual(plan({ status: "work_order" }), []);
  });

  it("treats a job Xero id with no invoice row as already billed", () => {
    assert.equal(billingGap(job({ invoices: [], xeroInvoiceId: "xero-1", xeroStatus: "sent" })), "billed");
    assert.equal(billingGap(job({ invoices: [], xeroInvoiceId: "xero-1", xeroStatus: null })), "billed");
    assert.equal(billingGap(job({ invoices: [], xeroInvoiceId: "xero-1", xeroStatus: "error" })), "create_invoice");
    assert.deepEqual(plan({ invoices: [], xeroInvoiceId: "xero-1", xeroStatus: "sent" }), []);
  });

  it("ignores a completed job that is already in Xero", () => {
    const sent = { id: "inv-1", status: "sent", sentDate: new Date(NOW - DAY).toISOString(), xeroInvoiceId: "xero-1" };
    assert.equal(billingGap(job({ invoices: [sent], xeroStatus: "sent" })), "billed");
    assert.deepEqual(plan({ invoices: [sent], xeroStatus: "sent" }), []);
  });

  it("does not create a second row for the same job", () => {
    assert.deepEqual(plan({}, [{ businessId: "biz-a", jobId: "job-1", status: "draft", step: "create_invoice" }]), []);
  });

  it("moves a waiting row from create to send once an invoice exists", () => {
    const plans = plan(
      { invoices: [{ id: "inv-1", status: "pending", sentDate: null }] },
      [{ businessId: "biz-a", jobId: "job-1", status: "draft", step: "create_invoice" }],
    );
    assert.equal(plans[0]?.action, "advance");
    if (plans[0]?.action !== "advance") return;
    assert.equal(plans[0].step, "send_invoice");
  });

  it("does not bring back a dismissed job", () => {
    assert.deepEqual(plan({}, [{ businessId: "biz-a", jobId: "job-1", status: "dismissed", step: "create_invoice" }]), []);
  });
});

describe("dedupe with Not in Xero", () => {
  it("leaves the sent-but-not-synced job to the Xero queue only", () => {
    const sent = { id: "inv-1", status: "sent", sentDate: new Date(NOW - DAY).toISOString(), xeroInvoiceId: null, invoiceNumber: "4048" };
    const notBilled = plan(
      { invoices: [sent] },
      [{ businessId: "biz-a", jobId: "job-1", status: "draft", step: "send_invoice" }],
    );
    assert.equal(notBilled[0]?.action, "cancel");

    const signal: InvoiceXeroSignal = {
      id: "inv-1",
      businessId: "biz-a",
      jobId: "job-1",
      customerId: "cust-1",
      invoiceNumber: "4048",
      status: "sent",
      sentDate: new Date(NOW - DAY).toISOString(),
      xeroInvoiceId: null,
      jobXeroInvoiceId: null,
      xeroStatus: null,
      customerName: "Sam Ngata",
    };
    const xero = planInvoiceXeroFollowUps({
      now: NOW,
      businessId: "biz-a",
      invoices: [signal],
      existing: [],
    });
    assert.equal(xero.length, 1);
    assert.equal(xero[0]?.action, "create");
  });

  it("does not treat a pending or failed Xero sync as a second not-billed item", () => {
    for (const xeroStatus of ["pending", "failed", "error"]) {
      const sent = { id: "inv-1", status: "sent", sentDate: new Date(NOW - DAY).toISOString(), xeroInvoiceId: "xero-1" };
      assert.equal(billingGap(job({ invoices: [sent], xeroStatus })), "sync_xero", xeroStatus);
      assert.deepEqual(plan({ invoices: [sent], xeroStatus }), []);
    }
  });
});

describe("tenant isolation", () => {
  it("does not plan another tenant's job", () => {
    const plans = planJobsNotBilled({
      now: NOW,
      businessId: "biz-a",
      jobs: [job({ id: "job-b", businessId: "biz-b" })],
      existing: [],
    });
    assert.deepEqual(plans, []);
  });

  it("does not let another tenant's row suppress this tenant", () => {
    const plans = plan({}, [{ businessId: "biz-b", jobId: "job-1", status: "done", step: "create_invoice" }]);
    assert.equal(plans[0]?.action, "create");
    if (plans[0]?.action !== "create") return;
    assert.equal(plans[0].businessId, "biz-a");
  });
});

describe("draft invoice", () => {
  it("uses the accepted quote and leaves the quote lines unchanged", () => {
    const lineItems = [{ description: "Fell the gum", quantity: 1, unitPrice: 500, total: 500 }];
    const original = JSON.parse(JSON.stringify(lineItems));
    const preview = buildDraftInvoice({
      jobNumber: "4048",
      jobTitle: "Fell the gum",
      quotes: [{ id: "q1", status: "accepted", description: "Fell the gum", amount: "500", lineItems }],
      jobLineItems: [{ description: "Should not be used", quantity: 1, unitPrice: 10, total: 10 }],
    });
    assert.equal(preview.source, "quote");
    assert.equal(preview.quoteId, "q1");
    assert.equal(preview.lines[0]?.amount, 500);
    assert.equal(preview.subtotal, 500);
    assert.equal(preview.gst, 75);
    assert.equal(preview.total, 575);
    assert.equal(preview.blockingReason, null);
    assert.deepEqual(lineItems, original);
  });

  it("falls back to job lines when there is no accepted quote", () => {
    const preview = buildDraftInvoice({
      jobNumber: "4048",
      quotes: [{ id: "q1", status: "sent", lineItems: [{ description: "Old", quantity: 1, unitPrice: 9, total: 9 }] }],
      jobLineItems: [{ description: "Chip", quantity: 2, rate: 40, amount: 80 }],
    });
    assert.equal(preview.source, "job");
    assert.equal(preview.quoteId, null);
    assert.equal(preview.subtotal, 80);
  });

  it("blocks a draft when there is no price", () => {
    const preview = buildDraftInvoice({ jobNumber: "4048", quotes: [], jobLineItems: [] });
    assert.match(preview.blockingReason ?? "", /price/);
  });
});
