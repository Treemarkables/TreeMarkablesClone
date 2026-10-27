import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STRIPE_CLEARING_ACCOUNT,
  choosePlatformBusinessId,
  classifyBalanceTransaction,
  clearingAccountProblem,
  feeDollars,
  matchLineToPayment,
  netDollars,
  planXeroPost,
  resolvePayoutStripeAccount,
  type PostableLine,
} from "./stripePayouts.ts";

function line(partial: Partial<PostableLine> & Pick<PostableLine, "lineId" | "kind">): PostableLine {
  return {
    amount: 0,
    fee: 0,
    net: 0,
    matched: false,
    xeroInvoiceId: null,
    xeroStatus: "AUTHORISED",
    amountDue: null,
    xeroPaymentId: null,
    xeroRefundPaymentId: null,
    jobNumber: null,
    invoiceNumber: null,
    stripeSourceId: null,
    balanceTransactionId: partial.lineId,
    ...partial,
  };
}

describe("stripe payout lines", () => {
  it("matches a charge to the payment intent stored on the payments row", () => {
    const charge = classifyBalanceTransaction({
      id: "txn_1",
      type: "charge",
      amount: 11500,
      fee: 350,
      net: 11150,
      currency: "nzd",
      source: { id: "ch_123", object: "charge", payment_intent: "pi_123" },
    });
    assert.equal(charge.kind, "charge");
    assert.equal(charge.amount, 115);
    assert.equal(charge.fee, 3.5);
    assert.equal(charge.stripePaymentId, "pi_123");
    assert.equal(charge.stripeChargeId, "ch_123");
    const payment = matchLineToPayment(charge, [
      { id: "pay", providerPaymentId: "pi_123", providerSessionId: "cs_1", jobId: "job", invoiceId: "inv", customerId: "cus" },
    ]);
    assert.equal(payment?.id, "pay");
  });

  it("matches a refund through the original payment intent", () => {
    const refund = classifyBalanceTransaction({
      id: "txn_r",
      type: "refund",
      amount: -11500,
      fee: -350,
      net: -11150,
      source: { id: "re_1", payment_intent: "pi_123", charge: "ch_123" },
    });
    assert.equal(refund.kind, "refund");
    assert.equal(refund.amount, -115);
    const payment = matchLineToPayment(refund, [
      { id: "pay", providerPaymentId: "pi_123", providerSessionId: null, jobId: "job", invoiceId: "inv", customerId: null },
    ]);
    assert.equal(payment?.invoiceId, "inv");
  });

  it("nets a charge and its fee to the payout", () => {
    const charge = classifyBalanceTransaction({
      id: "txn_1",
      type: "charge",
      amount: 11500,
      fee: 350,
      net: 11150,
      source: { id: "ch_1", payment_intent: "pi_1" },
    });
    assert.equal(feeDollars([charge]), 3.5);
    assert.equal(netDollars([charge]), 111.5);
    const plan = planXeroPost({
      stripePayoutId: "po_1",
      payoutDollars: 111.5,
      currency: "nzd",
      feeAlreadyPosted: false,
      lines: [line({
        lineId: "l1",
        kind: "charge",
        amount: charge.amount,
        fee: charge.fee,
        net: charge.net,
        matched: true,
        xeroInvoiceId: "xinv",
        xeroStatus: "AUTHORISED",
        amountDue: 115,
        jobNumber: "4128",
        invoiceNumber: "4128",
        stripeSourceId: "ch_1",
      })],
    });
    assert.equal(plan.payments.length, 1);
    assert.equal(plan.payments[0].amount, 115);
    assert.equal(plan.payments[0].reference.includes("ch_1"), true);
    assert.equal(plan.fee?.amount, 3.5);
    assert.equal(plan.clearing.netsToPayout, true);
    assert.equal(plan.clearing.gapDollars, 0);
    assert.equal(STRIPE_CLEARING_ACCOUNT, "640");
  });

  it("includes a refund and a returned fee so 640 still nets to the payout", () => {
    const lines = [
      line({
        lineId: "c",
        kind: "charge",
        amount: 115,
        fee: 3.5,
        net: 111.5,
        matched: true,
        xeroInvoiceId: "xinv",
        amountDue: 115,
        stripeSourceId: "ch_1",
      }),
      line({
        lineId: "r",
        kind: "refund",
        amount: -115,
        fee: -3.5,
        net: -111.5,
        matched: true,
        xeroInvoiceId: "xinv",
        stripeSourceId: "re_1",
      }),
    ];
    const plan = planXeroPost({
      stripePayoutId: "po_2",
      payoutDollars: 0,
      currency: "NZD",
      feeAlreadyPosted: false,
      lines,
    });
    assert.equal(plan.payments[0].amount, 115);
    assert.equal(plan.refunds[0].amount, 115);
    assert.equal(plan.fee, null);
    assert.equal(plan.clearing.netsToPayout, true);
  });

  it("skips an invoice that is already paid in Xero and does not post it again", () => {
    const plan = planXeroPost({
      stripePayoutId: "po_3",
      payoutDollars: 111.5,
      currency: "nzd",
      feeAlreadyPosted: false,
      lines: [line({
        lineId: "l",
        kind: "charge",
        amount: 115,
        fee: 3.5,
        net: 111.5,
        matched: true,
        xeroInvoiceId: "xinv",
        xeroStatus: "PAID",
        amountDue: 0,
        xeroPaymentId: null,
      })],
    });
    assert.equal(plan.payments.length, 0);
    assert.equal(plan.skips[0].reason, "already_paid");
    assert.equal(plan.clearing.netsToPayout, false);
  });

  it("treats a saved Xero payment id as already posted", () => {
    const plan = planXeroPost({
      stripePayoutId: "po_4",
      payoutDollars: 111.5,
      currency: "nzd",
      feeAlreadyPosted: true,
      lines: [line({
        lineId: "l",
        kind: "charge",
        amount: 115,
        fee: 3.5,
        net: 111.5,
        matched: true,
        xeroInvoiceId: "xinv",
        xeroStatus: "PAID",
        xeroPaymentId: "xpay",
      })],
    });
    assert.equal(plan.payments[0].alreadyPosted, true);
    assert.equal(plan.payments[0].xeroPaymentId, "xpay");
    assert.equal(plan.fee?.alreadyPosted, true);
    assert.equal(plan.clearing.netsToPayout, true);
  });

  it("leaves unmatched charges out of the post", () => {
    const plan = planXeroPost({
      stripePayoutId: "po_5",
      payoutDollars: 50,
      currency: "nzd",
      feeAlreadyPosted: false,
      lines: [line({ lineId: "u", kind: "charge", amount: 50, fee: 0, net: 50, matched: false })],
    });
    assert.equal(plan.payments.length, 0);
    assert.equal(plan.skips[0].reason, "unmatched");
    assert.equal(plan.clearing.gapDollars, 50);
  });

  it("refuses a non-NZD payout", () => {
    const plan = planXeroPost({
      stripePayoutId: "po_6",
      payoutDollars: 10,
      currency: "usd",
      feeAlreadyPosted: false,
      lines: [],
    });
    assert.match(plan.currencyBlocked ?? "", /NZD/);
    assert.equal(plan.payments.length, 0);
  });

  it("requires Enable payments on a non-bank clearing account", () => {
    assert.equal(clearingAccountProblem("640", { type: "CURRENT", enablePaymentsToAccount: false })?.includes("Enable payments"), true);
    assert.equal(clearingAccountProblem("640", { type: "CURRENT", enablePaymentsToAccount: true }), null);
    assert.equal(clearingAccountProblem("640", { type: "BANK", enablePaymentsToAccount: false }), null);
    assert.match(clearingAccountProblem("640", null) ?? "", /not found/);
  });

  it("uses a connected account when the business has one, otherwise the platform account", () => {
    assert.deepEqual(resolvePayoutStripeAccount({ stripeConnectAccountId: "acct_123", ownsPlatformAccount: false }), {
      stripeAccountId: "acct_123",
    });
    assert.deepEqual(resolvePayoutStripeAccount({ stripeConnectAccountId: "", ownsPlatformAccount: true }), {
      stripeAccountId: null,
    });
    assert.equal("error" in resolvePayoutStripeAccount({ stripeConnectAccountId: "", ownsPlatformAccount: false }), true);
  });

  it("picks the preferred platform business when more than one id is present", () => {
    assert.equal(choosePlatformBusinessId(["dev", "prod"], ["prod", "dev"]), "prod");
    assert.equal(choosePlatformBusinessId(["only"], ["prod"]), "only");
    assert.equal(choosePlatformBusinessId([], ["prod"]), null);
  });
});
