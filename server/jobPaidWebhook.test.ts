import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routes = fs.readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
const script = fs.readFileSync(new URL("../scripts/backfillJobPaidFromPayments.ts", import.meta.url), "utf8");

describe("invoice payment webhook updates the job from the ledger", () => {
  const invoiceStart = routes.indexOf("Invoice payment (kind='payment')");
  const jobStart = routes.indexOf("Job payment (kind='payment' + jobId)");
  const depositStart = routes.indexOf("if (kind !== 'deposit'");
  const invoiceBlock = routes.slice(invoiceStart, jobStart);
  const jobBlock = routes.slice(jobStart, depositStart);

  it("reconciles the job on the invoice path, including a retried webhook", () => {
    assert.ok(invoiceStart > 0 && jobStart > invoiceStart);
    assert.match(invoiceBlock, /reconcileJobPaidFromPayments/);
    assert.equal(invoiceBlock.includes("duplicate: true"), false);
  });

  it("reconciles the job-card path instead of adding the payment on top", () => {
    assert.ok(depositStart > jobStart);
    assert.match(jobBlock, /reconcileJobPaidFromPayments/);
    assert.equal(jobBlock.includes("prevPaid + amountPaid"), false);
  });

  it("accepts payout webhook events", () => {
    assert.match(routes, /event\.type\.startsWith\("payout\."\)/);
    assert.match(routes, /ingestStripePayoutWebhook/);
  });
});

describe("paid-amount backfill script", () => {
  it("is a dry run unless APPLY=1 and refuses production", () => {
    assert.match(script, /APPLY/);
    assert.match(script, /NODE_ENV === "production"/);
    assert.match(script, /Refusing to run/);
    assert.equal(script.includes("customer_name"), false);
    assert.equal(script.includes("FROM customers"), false);
  });
});
