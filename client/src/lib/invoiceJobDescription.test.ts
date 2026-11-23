/**
 * Job description → invoice, including a click that happens before blur-save.
 *
 * Run: node --experimental-strip-types --test client/src/lib/invoiceJobDescription.test.ts
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  invoiceDescriptionFromSources,
  invoiceJobDescription,
  invoiceJobDescriptionFromDraft,
} from "./invoiceJobDescription.ts";
import {
  clearJobDescriptionDraft,
  publishJobDescriptionDraft,
  readJobDescriptionDraft,
} from "./jobDescriptionDraft.ts";

const FULL = "Fell the gum at the fence.\n\nChip all brush and leave the site tidy.";
const FIRST_LINE = "Fell the gum at the fence.";
const JOB_ID = "job-synthetic-invoice-desc";

function oldFormSnapshot(formDescription: string | null | undefined, saved: string | null | undefined) {
  // What GlobalJobCard passed before this fix. `??` keeps "".
  return formDescription ?? saved ?? "";
}

afterEach(() => {
  clearJobDescriptionDraft(JOB_ID);
});

describe("invoice description carry-over", () => {
  it("carries the full multiline description on an immediate invoice click", () => {
    // New work order: form is still the initial "" and nothing is saved yet.
    assert.equal(oldFormSnapshot("", ""), "");

    publishJobDescriptionDraft(JOB_ID, FULL);
    const carried = invoiceJobDescriptionFromDraft(readJobDescriptionDraft(JOB_ID), "", "");
    assert.equal(carried, FULL);
    assert.equal(carried.includes("\n\n"), true);
  });

  it("carries text typed after an earlier save, not just the saved prefix", () => {
    // First paragraph was saved and synced into the form. The second was not.
    assert.equal(oldFormSnapshot(FIRST_LINE, FIRST_LINE), FIRST_LINE);
    assert.notEqual(oldFormSnapshot(FIRST_LINE, FIRST_LINE), FULL);

    const carried = invoiceJobDescription({
      hasLiveDraft: true,
      liveDraft: FULL,
      formDescription: FIRST_LINE,
      savedDescription: FIRST_LINE,
    });
    assert.equal(carried, FULL);
  });

  it("keeps a saved multiline description when the field is not mounted", () => {
    const carried = invoiceJobDescription({
      hasLiveDraft: false,
      formDescription: "",
      savedDescription: FULL,
    });
    assert.equal(carried, FULL);
  });

  it("keeps a saved description that the form has already caught up to", () => {
    const carried = invoiceJobDescription({
      hasLiveDraft: true,
      liveDraft: FULL,
      formDescription: FULL,
      savedDescription: FULL,
    });
    assert.equal(carried, FULL);
  });

  it("uses an unsaved draft over the last saved value", () => {
    const unsaved = `${FULL}\nStack the logs on the drive.`;
    const carried = invoiceJobDescription({
      hasLiveDraft: true,
      liveDraft: unsaved,
      formDescription: FULL,
      savedDescription: FULL,
    });
    assert.equal(carried, unsaved);
  });

  it("keeps an intentional clear instead of restoring the saved description", () => {
    const carried = invoiceJobDescription({
      hasLiveDraft: true,
      liveDraft: "",
      formDescription: "",
      savedDescription: FULL,
    });
    assert.equal(carried, "");
  });
});

describe("invoice description from proposal, quote, and existing invoice", () => {
  it("uses the full job description when there is no proposal or quote", () => {
    assert.equal(
      invoiceDescriptionFromSources({
        hasProposal: false,
        hasQuote: false,
        jobDescription: FULL,
      }),
      FULL,
    );
  });

  it("keeps a non-empty invoice description so a reopen does not create a second copy", () => {
    assert.equal(
      invoiceDescriptionFromSources({
        existingInvoiceDescription: "Already on the invoice.",
        hasProposal: true,
        proposalIntroduction: "Short intro",
        hasQuote: false,
        jobDescription: FULL,
      }),
      "Already on the invoice.",
    );
  });

  it("fills an empty saved invoice description from the full job description", () => {
    assert.equal(
      invoiceDescriptionFromSources({
        existingInvoiceDescription: "",
        hasProposal: false,
        hasQuote: false,
        jobDescription: FULL,
      }),
      FULL,
    );
  });

  it("still prefers a proposal introduction when the job description is only the fallback", () => {
    assert.equal(
      invoiceDescriptionFromSources({
        hasProposal: true,
        proposalIntroduction: "Proposal intro",
        hasQuote: true,
        quoteDescription: "Quote text",
        jobDescription: FULL,
      }),
      "Proposal intro",
    );
  });
});

describe("invoice wiring", () => {
  const builder = readFileSync(new URL("../components/InvoiceBuilder.tsx", import.meta.url), "utf8");
  const card = readFileSync(new URL("../components/GlobalJobCard.tsx", import.meta.url), "utf8");
  const details = readFileSync(new URL("../components/JobDetailsPanel.tsx", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../../../server/routes.ts", import.meta.url), "utf8");

  it("reads the live draft into the invoice and still passes line items and totals", () => {
    assert.match(card, /invoiceJobDescriptionFromDraft/);
    assert.match(card, /readJobDescriptionDraft/);
    assert.match(card, /lineItems:/);
    assert.match(card, /totalAmount:/);
    assert.match(details, /publishJobDescriptionDraft/);
    assert.match(details, /e\.target\.value/);
    assert.match(builder, /invoiceDescriptionFromSources/);
    // Prices stay ex-GST at save. Description text is not turned into a line.
    assert.match(builder, /toStoredExGst/);
    assert.match(builder, /No final fallback/);
  });

  it("does not create a second invoice when one already exists", () => {
    assert.match(builder, /isCreatingRef/);
    assert.match(builder, /Existing invoice detected, updating instead of creating new/);
    assert.match(routes, /Invoice already exists for this job/);
    assert.match(routes, /res\.status\(409\)/);
  });
});
