import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  jobAlreadySentToXero,
  jobShowsPaidBadge,
  paidAmountsWhenXeroReportsPaid,
  shouldSyncXeroPaymentStatus,
  xeroReportedInvoiceTotal,
} from "./jobPaymentDisplay.ts";

describe("job paid badge", () => {
  it("shows when the first invoice is paid", () => {
    assert.equal(jobShowsPaidBadge({ invoiceStatuses: ["paid"] }), true);
    assert.equal(jobShowsPaidBadge({ invoiceStatuses: ["sent", "paid"] }), true);
  });

  it("shows when the job Xero status is paid", () => {
    assert.equal(jobShowsPaidBadge({ xeroStatus: "paid", invoiceStatuses: ["sent"] }), true);
    assert.equal(jobShowsPaidBadge({ xeroStatus: "PAID" }), true);
  });

  it("shows when the paid amount covers the inc-GST total", () => {
    assert.equal(jobShowsPaidBadge({
      paidAmount: "115.00",
      totalIncludingGst: "115.00",
    }), true);
    assert.equal(jobShowsPaidBadge({
      paidAmount: "114.99",
      totalAmount: "115.00",
    }), false);
  });

  it("grosses an ex-GST value up before comparing", () => {
    assert.equal(jobShowsPaidBadge({
      paidAmount: "115.00",
      exGstValue: "100.00",
    }), true);
    assert.equal(jobShowsPaidBadge({
      paidAmount: "100.00",
      exGstValue: "100.00",
    }), false);
  });

  it("stays hidden when nothing is paid", () => {
    assert.equal(jobShowsPaidBadge({
      invoiceStatuses: ["sent"],
      xeroStatus: "sent",
      paidAmount: "0.00",
      totalAmount: "115.00",
    }), false);
  });
});

describe("already sent to Xero", () => {
  it("treats sent and paid as already sent", () => {
    assert.equal(jobAlreadySentToXero("sent"), true);
    assert.equal(jobAlreadySentToXero("paid"), true);
    assert.equal(jobAlreadySentToXero("PAID"), true);
  });

  it("treats other in-Xero statuses as already sent", () => {
    assert.equal(jobAlreadySentToXero("authorised"), true);
    assert.equal(jobAlreadySentToXero("submitted"), true);
    assert.equal(jobAlreadySentToXero("posted"), true);
    assert.equal(jobAlreadySentToXero("voided"), true);
  });

  it("allows a retry when the send failed and no invoice id was stored", () => {
    assert.equal(jobAlreadySentToXero("error"), false);
    assert.equal(jobAlreadySentToXero("failed"), false);
    assert.equal(jobAlreadySentToXero(null), false);
    assert.equal(jobAlreadySentToXero("pending"), false);
  });

  it("refuses a resend once a Xero invoice id exists, even after an error", () => {
    assert.equal(jobAlreadySentToXero("error", "inv-1"), true);
    assert.equal(jobAlreadySentToXero("paid", "inv-1"), true);
    assert.equal(jobAlreadySentToXero("pending", "inv-1"), true);
    assert.equal(jobAlreadySentToXero("", "inv-1"), true);
  });
});

describe("Xero paid amounts", () => {
  it("sets the paid amount to the Xero invoice total and clears the balance", () => {
    assert.deepEqual(paidAmountsWhenXeroReportsPaid({
      currentPaidAmount: "0.00",
      xeroInvoiceTotal: "575.00",
      invoiceAmounts: ["500.00"],
    }), { paidAmount: "575.00", balanceDue: "0.00" });
  });

  it("does not reduce an existing higher paid amount", () => {
    assert.deepEqual(paidAmountsWhenXeroReportsPaid({
      currentPaidAmount: "600.00",
      xeroInvoiceTotal: "575.00",
    }), { paidAmount: "600.00", balanceDue: "0.00" });
  });

  it("raises a partial payment up to the invoice total", () => {
    assert.deepEqual(paidAmountsWhenXeroReportsPaid({
      currentPaidAmount: "100.00",
      xeroInvoiceTotal: "575.00",
    }), { paidAmount: "575.00", balanceDue: "0.00" });
  });

  it("reads the Xero total, then subtotal plus tax", () => {
    assert.equal(xeroReportedInvoiceTotal({ total: 575 }), 575);
    assert.equal(xeroReportedInvoiceTotal({ subTotal: 500, totalTax: 75 }), 575);
    assert.equal(xeroReportedInvoiceTotal({ total: 0, subTotal: "500.00", totalTax: "75.00" }), 575);
  });

  it("falls back to local invoice amounts, then the job total", () => {
    assert.deepEqual(paidAmountsWhenXeroReportsPaid({
      currentPaidAmount: "0",
      invoiceAmounts: ["200.00", "50.00"],
    }), { paidAmount: "250.00", balanceDue: "0.00" });
    assert.deepEqual(paidAmountsWhenXeroReportsPaid({
      currentPaidAmount: "0",
      jobTotalIncludingGst: "115.00",
    }), { paidAmount: "115.00", balanceDue: "0.00" });
  });

  it("re-syncs a paid job whose amount or balance was left blank", () => {
    assert.equal(shouldSyncXeroPaymentStatus({
      xeroInvoiceId: "x",
      xeroStatus: "sent",
    }), true);
    assert.equal(shouldSyncXeroPaymentStatus({
      xeroInvoiceId: "x",
      xeroStatus: "paid",
      paidAmount: "0.00",
      balanceDue: "0.00",
    }), true);
    assert.equal(shouldSyncXeroPaymentStatus({
      xeroInvoiceId: "x",
      xeroStatus: "paid",
      paidAmount: "575.00",
      balanceDue: "20.00",
    }), true);
    assert.equal(shouldSyncXeroPaymentStatus({
      xeroInvoiceId: "x",
      xeroStatus: "paid",
      paidAmount: "575.00",
      balanceDue: "0.00",
    }), false);
    assert.equal(shouldSyncXeroPaymentStatus({
      xeroStatus: "sent",
    }), false);
  });
});
