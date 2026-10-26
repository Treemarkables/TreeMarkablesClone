// xero-node calls for payout posting. Lookups are by reference so a retry
// finds the row that was already created.

import {
  Account,
  BankTransaction,
  BankTransactions,
  Contact,
  CreditNote,
  CreditNotes,
  LineAmountTypes,
  ManualJournal,
  ManualJournals,
  Payment,
  type XeroClient,
} from "xero-node";
import { NO_GST_TAX } from "../shared/stripePayouts.ts";
import { xeroEquals, type XeroAccounting } from "./stripePayoutXero.ts";

export interface XeroAccountInfo {
  code: string;
  type: string;
  enablePaymentsToAccount: boolean;
}

export interface XeroInvoiceInfo {
  status: string | null;
  amountDue: number | null;
  contactId: string | null;
  accountCode: string | null;
  taxType: string | null;
}

function textEnum(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function requiredId(id: string | undefined): string {
  if (!id) throw new Error("Xero did not return an id");
  return id;
}

function idem(kind: string, reference: string): string {
  return `${kind}:${reference}`.replace(/[^A-Za-z0-9:_ .-]/g, "").slice(0, 128);
}

export async function readXeroAccount(
  client: XeroClient,
  tenantId: string,
  code: string,
): Promise<XeroAccountInfo | null> {
  const res = await client.accountingApi.getAccounts(tenantId, undefined, xeroEquals("Code", code));
  const account = (res.body.accounts ?? []).find((row) => row.code === code);
  if (!account) return null;
  return {
    code,
    type: textEnum(account.type),
    enablePaymentsToAccount: account.enablePaymentsToAccount === true,
  };
}

export async function readXeroInvoice(
  client: XeroClient,
  tenantId: string,
  invoiceId: string,
): Promise<XeroInvoiceInfo> {
  const res = await client.accountingApi.getInvoice(tenantId, invoiceId);
  const invoice = res.body.invoices?.[0];
  const line = invoice?.lineItems?.[0];
  const amountDue = typeof invoice?.amountDue === "number" ? invoice.amountDue : null;
  return {
    status: textEnum(invoice?.status) || null,
    amountDue,
    contactId: invoice?.contact?.contactID ?? null,
    accountCode: line?.accountCode ?? null,
    taxType: line?.taxType ?? null,
  };
}

export function xeroAccounting(client: XeroClient, tenantId: string): XeroAccounting {
  const api = client.accountingApi;
  return {
    async findPaymentByReference(reference) {
      const res = await api.getPayments(tenantId, undefined, xeroEquals("Reference", reference), undefined, 1, 10);
      return res.body.payments?.[0]?.paymentID ?? null;
    },
    async createInvoicePayment(input) {
      const payment = new Payment();
      payment.invoice = { invoiceID: input.xeroInvoiceId };
      payment.account = { code: input.accountCode };
      payment.amount = input.amount;
      payment.date = input.date;
      payment.reference = input.reference;
      const res = await api.createPayment(tenantId, payment, idem("pay", input.reference));
      return requiredId(res.body.payments?.[0]?.paymentID);
    },
    async findCreditNoteByReference(reference) {
      const res = await api.getCreditNotes(tenantId, undefined, xeroEquals("Reference", reference), undefined, 1, undefined, 10);
      return res.body.creditNotes?.[0]?.creditNoteID ?? null;
    },
    async createCreditNote(input) {
      const contact = new Contact();
      contact.contactID = input.contactId;
      const note = new CreditNote();
      note.type = CreditNote.TypeEnum.ACCRECCREDIT;
      note.contact = contact;
      note.date = input.date;
      note.status = CreditNote.StatusEnum.AUTHORISED;
      note.lineAmountTypes = LineAmountTypes.Inclusive;
      note.reference = input.reference;
      note.lineItems = [{
        description: input.description.slice(0, 4000) || "Stripe refund",
        quantity: 1,
        unitAmount: input.amount,
        accountCode: input.accountCode,
        taxType: input.taxType,
      }];
      const wrapper = new CreditNotes();
      wrapper.creditNotes = [note];
      const res = await api.createCreditNotes(tenantId, wrapper, true, 2, idem("cn", input.reference));
      return requiredId(res.body.creditNotes?.[0]?.creditNoteID);
    },
    async createCreditNotePayment(input) {
      const payment = new Payment();
      payment.creditNote = { creditNoteID: input.creditNoteId };
      payment.account = { code: input.accountCode };
      payment.amount = input.amount;
      payment.date = input.date;
      payment.reference = input.reference;
      const res = await api.createPayment(tenantId, payment, idem("cnpay", input.reference));
      return requiredId(res.body.payments?.[0]?.paymentID);
    },
    async invoiceContact(xeroInvoiceId) {
      const info = await readXeroInvoice(client, tenantId, xeroInvoiceId);
      return { contactId: info.contactId, accountCode: info.accountCode, taxType: info.taxType };
    },
    async findFeeSpend(reference) {
      const res = await api.getBankTransactions(tenantId, undefined, xeroEquals("Reference", reference), undefined, 1, undefined, 10);
      return res.body.bankTransactions?.[0]?.bankTransactionID ?? null;
    },
    async findFeeJournal(narration) {
      const res = await api.getManualJournals(tenantId, undefined, xeroEquals("Narration", narration), undefined, 1, 10);
      return res.body.manualJournals?.[0]?.manualJournalID ?? null;
    },
    async createFeeSpend(input) {
      const contact = new Contact();
      contact.name = "Stripe";
      const bank = new Account();
      bank.code = input.clearingAccountCode;
      const txn = new BankTransaction();
      txn.type = input.spend ? BankTransaction.TypeEnum.SPEND : BankTransaction.TypeEnum.RECEIVE;
      txn.contact = contact;
      txn.bankAccount = bank;
      txn.date = input.date;
      txn.reference = input.reference;
      txn.status = BankTransaction.StatusEnum.AUTHORISED;
      txn.lineAmountTypes = LineAmountTypes.NoTax;
      txn.lineItems = [{
        description: input.description.slice(0, 4000),
        quantity: 1,
        unitAmount: input.amount,
        accountCode: input.feesAccountCode,
        taxType: NO_GST_TAX,
      }];
      const wrapper = new BankTransactions();
      wrapper.bankTransactions = [txn];
      const res = await api.createBankTransactions(tenantId, wrapper, true, 2, idem("fee", input.reference));
      return requiredId(res.body.bankTransactions?.[0]?.bankTransactionID);
    },
    async createFeeJournal(input) {
      const journal = new ManualJournal();
      journal.narration = input.narration;
      journal.date = input.date;
      journal.status = ManualJournal.StatusEnum.POSTED;
      journal.lineAmountTypes = LineAmountTypes.NoTax;
      journal.journalLines = [
        {
          description: input.description.slice(0, 4000),
          lineAmount: input.amount,
          accountCode: input.feesAccountCode,
          taxType: NO_GST_TAX,
        },
        {
          description: input.description.slice(0, 4000),
          lineAmount: -input.amount,
          accountCode: input.clearingAccountCode,
          taxType: NO_GST_TAX,
        },
      ];
      const wrapper = new ManualJournals();
      wrapper.manualJournals = [journal];
      const res = await api.createManualJournals(tenantId, wrapper, true, idem("journal", input.narration));
      return requiredId(res.body.manualJournals?.[0]?.manualJournalID);
    },
  };
}
