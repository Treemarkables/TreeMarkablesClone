import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  balanceDueForTotal,
  invoiceShouldMarkPaid,
  jobPaidUpdate,
  netSucceededPaid,
  planPaidBackfill,
  type BackfillRow,
} from "./jobPaidFromPayments.ts";

function row(partial: Partial<BackfillRow> & Pick<BackfillRow, "paymentId">): BackfillRow {
  return {
    paymentJobId: "job-1",
    invoiceId: "inv-1",
    invoiceJobId: "job-1",
    invoiceStatus: "pending",
    invoiceNumber: "4128",
    invoiceBusinessId: "biz",
    amount: "575.00",
    status: "succeeded",
    kind: "payment",
    paidAt: "2026-10-01T00:00:00.000Z",
    jobId: "job-1",
    jobBusinessId: "biz",
    jobNumber: "4128",
    totalAmount: "575.00",
    paidAmount: "0.00",
    balanceDue: "575.00",
    ...partial,
  };
}

describe("job paid amount from payments", () => {
  it("sums succeeded payments and ignores failed ones", () => {
    assert.equal(netSucceededPaid([
      { id: "a", amount: "100.00", status: "succeeded", kind: "deposit" },
      { id: "b", amount: "475.50", status: "succeeded", kind: "payment" },
      { id: "c", amount: "20.00", status: "failed", kind: "payment" },
      { id: "d", amount: "15.00", status: "succeeded", kind: "refund" },
    ]), 560.5);
  });

  it("counts a duplicated payment id once", () => {
    assert.equal(netSucceededPaid([
      { id: "a", amount: "575.00", status: "succeeded", kind: "payment" },
      { id: "a", amount: "575.00", status: "succeeded", kind: "payment" },
    ]), 575);
  });

  it("sets balance from the job total and reports no change when it already matches", () => {
    const first = jobPaidUpdate(
      { totalAmount: "575.00", paidAmount: "0.00", balanceDue: "575.00" },
      [{ id: "a", amount: "575.00", status: "succeeded", kind: "payment" }],
    );
    assert.deepEqual(first, { paidAmount: "575.00", balanceDue: "0.00", changed: true });
    const second = jobPaidUpdate(
      { totalAmount: "575.00", paidAmount: first.paidAmount, balanceDue: first.balanceDue },
      [{ id: "a", amount: "575.00", status: "succeeded", kind: "payment" }],
    );
    assert.equal(second.changed, false);
  });

  it("does not let the balance go below zero", () => {
    assert.equal(balanceDueForTotal("100.00", 150), 0);
  });

  it("marks an invoice paid only for a succeeded invoice payment", () => {
    assert.equal(invoiceShouldMarkPaid("pending", [
      { invoiceId: "inv", amount: "50", status: "succeeded", kind: "deposit" },
    ]), false);
    assert.equal(invoiceShouldMarkPaid("pending", [
      { invoiceId: "inv", amount: "575", status: "succeeded", kind: "payment" },
    ]), true);
    assert.equal(invoiceShouldMarkPaid("paid", [
      { invoiceId: "inv", amount: "575", status: "succeeded", kind: "payment" },
    ]), false);
    assert.equal(invoiceShouldMarkPaid("cancelled", [
      { invoiceId: "inv", amount: "575", status: "succeeded", kind: "payment" },
    ]), false);
  });

  it("plans a backfill that is a no-op the second time", () => {
    const first = planPaidBackfill([row({ paymentId: "pay-1", paymentJobId: null })]);
    assert.equal(first.jobs.length, 1);
    assert.equal(first.jobs[0].paidAmount, "575.00");
    assert.equal(first.jobs[0].balanceDue, "0.00");
    assert.equal(first.jobs[0].jobNumber, "4128");
    assert.equal(first.invoices.length, 1);
    assert.equal(first.invoices[0].invoiceNumber, "4128");
    assert.equal(first.paymentJobLinks.length, 1);
    assert.equal(first.paymentJobLinks[0].jobId, "job-1");

    const second = planPaidBackfill([row({
      paymentId: "pay-1",
      paidAmount: "575.00",
      balanceDue: "0.00",
      invoiceStatus: "paid",
    })]);
    assert.deepEqual(second.jobs, []);
    assert.deepEqual(second.invoices, []);
    assert.deepEqual(second.paymentJobLinks, []);
    assert.equal(second.unchangedJobs, 1);
  });

  it("leaves a payment with no job out of the plan", () => {
    const plan = planPaidBackfill([row({ paymentId: "pay-2", jobId: null, invoiceJobId: null })]);
    assert.equal(plan.jobs.length, 0);
    assert.equal(plan.skippedPayments, 1);
  });
});
