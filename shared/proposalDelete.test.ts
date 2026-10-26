/**
 * Run: node --experimental-strip-types --test shared/proposalDelete.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isQuoteDocument,
  proposalDeletionDecision,
  proposalOwnedByBusiness,
} from "./proposalDelete.ts";

describe("proposalDeletionDecision", () => {
  it("allows a draft, a sent proposal, a viewed proposal, and a rejection", () => {
    for (const status of ["draft", "sent", "viewed", "rejected", "declined", ""]) {
      assert.deepEqual(proposalDeletionDecision({ status }), { allowed: true });
    }
  });

  it("blocks an accepted proposal and one waiting on a deposit", () => {
    assert.equal(proposalDeletionDecision({ status: "accepted" }).allowed, false);
    assert.equal(
      proposalDeletionDecision({ status: "accepted_pending_deposit" }).allowed,
      false,
    );
    assert.equal(
      proposalDeletionDecision({ status: "Accepted" }).allowed,
      false,
    );
  });

  it("blocks when a deposit or a payment ledger row exists", () => {
    assert.equal(
      proposalDeletionDecision({ status: "sent", depositPaidAt: "2026-10-01" }).allowed,
      false,
    );
    assert.equal(
      proposalDeletionDecision({ status: "draft", depositAmountPaid: "50.00" }).allowed,
      false,
    );
    assert.equal(
      proposalDeletionDecision({ status: "draft", paymentCount: 1 }).allowed,
      false,
    );
    assert.equal(
      proposalDeletionDecision({ status: "draft", depositAmountPaid: "0", paymentCount: 0 }).allowed,
      true,
    );
  });
});

describe("proposalOwnedByBusiness", () => {
  it("matches the proposal's company and refuses another company", () => {
    assert.equal(
      proposalOwnedByBusiness({
        proposalBusinessId: "biz-a",
        actorBusinessId: "biz-a",
      }),
      true,
    );
    assert.equal(
      proposalOwnedByBusiness({
        proposalBusinessId: "biz-b",
        jobBusinessId: "biz-a",
        actorBusinessId: "biz-a",
      }),
      false,
    );
  });

  it("allows a legacy blank proposal only when the job is in this company", () => {
    assert.equal(
      proposalOwnedByBusiness({
        proposalBusinessId: null,
        jobBusinessId: "biz-a",
        actorBusinessId: "biz-a",
      }),
      true,
    );
    assert.equal(
      proposalOwnedByBusiness({
        proposalBusinessId: null,
        jobBusinessId: "biz-b",
        actorBusinessId: "biz-a",
      }),
      false,
    );
    assert.equal(
      proposalOwnedByBusiness({
        proposalBusinessId: null,
        jobBusinessId: null,
        actorBusinessId: "biz-a",
      }),
      false,
    );
    assert.equal(
      proposalOwnedByBusiness({
        proposalBusinessId: "biz-a",
        actorBusinessId: null,
      }),
      false,
    );
  });
});

describe("isQuoteDocument", () => {
  it("treats only the quote template as a quote", () => {
    assert.equal(isQuoteDocument("quote"), true);
    assert.equal(isQuoteDocument("proposal"), false);
    assert.equal(isQuoteDocument(null), false);
  });
});
