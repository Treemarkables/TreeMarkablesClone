import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TREEMARKABLES_BUSINESS_IDS } from "../shared/roleChecklistAccess.ts";
import {
  businessOwnsStripeAccount,
  invoiceCardCheckoutDisabled,
  invoiceOnlinePaymentEnabled,
  TREEMARKABLES_PROD_INVOICE_CARD_OFF_BUSINESS_ID,
} from "./stripe.ts";
import { invoiceBankTransferNote, renderInvoiceEmail } from "./emailTemplates.ts";

const PROD = "a985f349-b6aa-4ef9-a6f9-70aa00e1dcb2";
const OTHER = "11111111-1111-1111-1111-111111111111";

describe("Treemarkables production invoice card checkout", () => {
  it("turns card checkout off only for the production business", () => {
    assert.equal(TREEMARKABLES_PROD_INVOICE_CARD_OFF_BUSINESS_ID, PROD);
    assert.equal(invoiceCardCheckoutDisabled(PROD), true);
    assert.equal(invoiceCardCheckoutDisabled(OTHER), false);
    assert.equal(invoiceCardCheckoutDisabled(null), false);
    assert.equal(invoiceCardCheckoutDisabled(undefined), false);
    assert.equal(invoiceCardCheckoutDisabled(""), false);
  });

  it("keeps the platform account for deposits and job-card payments", () => {
    assert.equal(businessOwnsStripeAccount(PROD), true);
    for (const id of TREEMARKABLES_BUSINESS_IDS) {
      assert.equal(businessOwnsStripeAccount(id), true);
      if (id === PROD) {
        assert.equal(invoiceCardCheckoutDisabled(id), true);
      } else {
        assert.equal(invoiceCardCheckoutDisabled(id), false);
      }
    }
  });

  it("hides Pay now for a production invoice even if Connect charges are on", () => {
    assert.equal(invoiceOnlinePaymentEnabled({
      businessId: PROD,
      ownsPlatformAccount: true,
      connectChargesEnabled: false,
    }), false);
    assert.equal(invoiceOnlinePaymentEnabled({
      businessId: PROD,
      ownsPlatformAccount: true,
      connectChargesEnabled: true,
    }), false);
  });

  it("leaves other businesses on their existing card rule", () => {
    assert.equal(invoiceOnlinePaymentEnabled({
      businessId: OTHER,
      ownsPlatformAccount: false,
      connectChargesEnabled: true,
    }), true);
    assert.equal(invoiceOnlinePaymentEnabled({
      businessId: OTHER,
      ownsPlatformAccount: false,
      connectChargesEnabled: false,
    }), false);
    const devId = TREEMARKABLES_BUSINESS_IDS.find((id) => id !== PROD);
    assert.ok(devId);
    assert.equal(invoiceOnlinePaymentEnabled({
      businessId: devId,
      ownsPlatformAccount: true,
      connectChargesEnabled: false,
    }), true);
  });
});

describe("invoice email when card checkout is off", () => {
  const base = {
    customerName: "Alex",
    invoiceLabel: "Invoice #3975",
    lineItems: [{ description: "Tree work", quantity: 1, price: 500 }],
    subtotal: 500,
    gst: 75,
    total: 575,
    paidAmount: 0,
    balanceDue: 575,
    ctaUrl: "https://app.example/invoice/1/view",
    ctaText: "View & pay invoice online",
    bank: {
      accountName: "Treemarkables Ltd",
      accountNumber: "00-0000-0000000-00",
      reference: "Invoice 3975",
    },
  };

  it("shows bank details and a view link, not a pay button", () => {
    const html = renderInvoiceEmail({ ...base, offerCardPayment: false });
    assert.match(html, /View invoice/);
    assert.match(html, /Treemarkables Ltd/);
    assert.match(html, /00-0000-0000000-00/);
    assert.match(html, /Invoice 3975/);
    assert.equal(html.includes("View & pay"), false);
    assert.equal(html.includes("Pay now"), false);
  });

  it("keeps the pay label for every other invoice", () => {
    const html = renderInvoiceEmail(base);
    assert.match(html, /View &amp; pay invoice online/);
  });

  it("refuses invoice checkout before a session, and leaves the other checkouts alone", () => {
    const src = fs.readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    const invoiceStart = src.indexOf("app.post('/api/invoices/:id/payment-checkout'");
    const invoiceCreate = src.indexOf("createInvoiceCheckoutSession(", invoiceStart);
    const invoiceGuard = src.indexOf("invoiceCardCheckoutDisabled(invoice.businessId)", invoiceStart);
    assert.ok(invoiceStart > 0 && invoiceGuard > invoiceStart && invoiceGuard < invoiceCreate);

    const jobStart = src.indexOf("app.post('/api/jobs/:id/payment-checkout'");
    const jobCreate = src.indexOf("createJobCheckoutSession(", jobStart);
    assert.equal(src.slice(jobStart, jobCreate).includes("invoiceCardCheckoutDisabled"), false);

    const depositStart = src.indexOf("app.post('/api/proposals/:id/deposit-checkout'");
    const depositCreate = src.indexOf("createDepositCheckoutSession(", depositStart);
    assert.equal(src.slice(depositStart, depositCreate).includes("invoiceCardCheckoutDisabled"), false);

    let subFrom = 0;
    while (true) {
      const subCall = src.indexOf("await createSubscriptionCheckoutSession(", subFrom);
      if (subCall < 0) break;
      assert.equal(src.slice(Math.max(0, subCall - 1200), subCall).includes("invoiceCardCheckoutDisabled"), false);
      subFrom = subCall + 1;
    }
  });

  it("writes a bank-transfer note only when an account is set", () => {
    assert.equal(invoiceBankTransferNote({
      accountName: "Treemarkables Ltd",
      accountNumber: "00-0000-0000000-00",
      reference: "Invoice 3975",
    }), "Pay by bank transfer. Account name: Treemarkables Ltd. Account number: 00-0000-0000000-00. Reference: Invoice 3975.");
    assert.equal(invoiceBankTransferNote({ accountName: "  ", accountNumber: "" }), null);
  });
});
