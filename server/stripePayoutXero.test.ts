import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeXeroPost, xeroEquals, type XeroAccounting, type XeroPostMemory } from "./stripePayoutXero.ts";
import { planXeroPost, type PostableLine } from "../shared/stripePayouts.ts";

function line(partial: Partial<PostableLine> & Pick<PostableLine, "lineId" | "kind" | "amount">): PostableLine {
  return {
    fee: 0,
    net: partial.amount,
    matched: true,
    xeroInvoiceId: "inv-xero",
    xeroStatus: "AUTHORISED",
    amountDue: partial.amount,
    xeroPaymentId: null,
    xeroRefundPaymentId: null,
    jobNumber: "4128",
    invoiceNumber: "INV-1",
    stripeSourceId: "ch_1",
    balanceTransactionId: `txn_${partial.lineId}`,
    ...partial,
  };
}

describe("xero where filters", () => {
  it("strips quotes so a reference cannot break out of the filter", () => {
    assert.equal(xeroEquals("Reference", "Stripe fees po_1"), 'Reference=="Stripe fees po_1"');
    assert.equal(xeroEquals("Reference", "a\"b\\c"), 'Reference=="abc"');
    assert.throws(() => xeroEquals("Reference\"; drop", "a"), /Unsupported Xero filter/);
  });
});

describe("executeXeroPost", () => {
  it("posts a payment and a fee once, then skips them on the next run", async () => {
    const created: string[] = [];
    const accounting: XeroAccounting = {
      findPaymentByReference: async () => null,
      createInvoicePayment: async (input) => {
        created.push(`pay:${input.reference}`);
        return "xpay";
      },
      findCreditNoteByReference: async () => null,
      createCreditNote: async () => "cn",
      createCreditNotePayment: async () => "cpay",
      invoiceContact: async () => ({ contactId: "c", accountCode: "200", taxType: "OUTPUT2" }),
      findFeeSpend: async () => null,
      findFeeJournal: async () => null,
      createFeeSpend: async (input) => {
        created.push(`fee:${input.reference}`);
        return "xfee";
      },
      createFeeJournal: async () => "journal",
    };
    const saved: string[] = [];
    const memory: XeroPostMemory = {
      payment: async (lineId, xeroPaymentId) => { saved.push(`${lineId}:${xeroPaymentId}`); },
      refund: async () => {},
      fee: async (xeroId) => { saved.push(`fee:${xeroId}`); },
      lineMessage: async () => {},
    };
    const plan = planXeroPost({
      stripePayoutId: "po_1",
      payoutDollars: 111.5,
      currency: "nzd",
      feeAlreadyPosted: false,
      lines: [
        line({ lineId: "l1", kind: "charge", amount: 115, fee: 3.5, net: 111.5, stripeSourceId: "ch_1" }),
      ],
    });
    const first = await executeXeroPost({
      accounting,
      plan,
      date: "2026-10-20",
      clearingAccountCode: "640",
      feesAccountCode: "404",
      salesAccountCode: "200",
      salesTaxType: "OUTPUT2",
      clearingIsBank: true,
      memory,
    });
    assert.equal(first.filter((row) => row.status === "posted").length, 2);
    assert.deepEqual(created, ["pay:Stripe ch_1 payout po_1", "fee:Stripe fees po_1"]);
    assert.deepEqual(saved, ["l1:xpay", "fee:xfee"]);

    const again = planXeroPost({
      stripePayoutId: "po_1",
      payoutDollars: 111.5,
      currency: "nzd",
      feeAlreadyPosted: true,
      lines: [
        line({
          lineId: "l1",
          kind: "charge",
          amount: 115,
          fee: 3.5,
          net: 111.5,
          stripeSourceId: "ch_1",
          xeroPaymentId: "xpay",
          xeroStatus: "PAID",
          amountDue: 0,
        }),
      ],
    });
    const second = await executeXeroPost({
      accounting,
      plan: again,
      date: "2026-10-20",
      clearingAccountCode: "640",
      feesAccountCode: "404",
      salesAccountCode: "200",
      salesTaxType: "OUTPUT2",
      clearingIsBank: true,
      memory,
    });
    assert.equal(second.some((row) => row.status === "posted"), false);
    assert.equal(created.length, 2);
  });

  it("uses an existing Xero payment with the same reference instead of creating one", async () => {
    let created = 0;
    const accounting: XeroAccounting = {
      findPaymentByReference: async () => "already",
      createInvoicePayment: async () => { created += 1; return "new"; },
      findCreditNoteByReference: async () => null,
      createCreditNote: async () => "cn",
      createCreditNotePayment: async () => "cpay",
      invoiceContact: async () => ({ contactId: null, accountCode: null, taxType: null }),
      findFeeSpend: async () => null,
      findFeeJournal: async () => null,
      createFeeSpend: async () => "fee",
      createFeeJournal: async () => "journal",
    };
    const plan = planXeroPost({
      stripePayoutId: "po_2",
      payoutDollars: 50,
      currency: "nzd",
      feeAlreadyPosted: true,
      lines: [line({ lineId: "l2", kind: "charge", amount: 50, net: 50, fee: 0, stripeSourceId: "ch_2" })],
    });
    const results = await executeXeroPost({
      accounting,
      plan,
      date: "2026-10-21",
      clearingAccountCode: "640",
      feesAccountCode: "404",
      salesAccountCode: "200",
      salesTaxType: "OUTPUT2",
      clearingIsBank: true,
      memory: { payment: async () => {}, refund: async () => {}, fee: async () => {}, lineMessage: async () => {} },
    });
    assert.equal(created, 0);
    assert.equal(results[0]?.status, "skipped");
    assert.equal(results[0]?.xeroId, "already");
  });
});
