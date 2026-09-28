import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRequoteDraft,
  DEFAULT_NUDGE_DAYS,
  EXPIRY_NUDGE_STEP,
  isCustomerDiaryReply,
  parseNudgeDays,
  planQuoteFollowUps,
  quietDaysSince,
  repriceLineItems,
  type DiaryReplySignal,
  type ExistingFollowUp,
  type FollowUpPlan,
  type QuoteSignal,
} from "./quoteFollowUps.ts";

const NOW = Date.parse("2026-09-28T01:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function quote(overrides: Partial<QuoteSignal> = {}): QuoteSignal {
  return {
    id: "q1",
    businessId: "biz-a",
    jobId: "job-1",
    customerId: "cust-1",
    quoteNumber: "1042",
    description: "Fell the gum",
    terms: "30 days",
    amount: "500.00",
    lineItems: [
      { id: "li1", description: "Tree removal", quantity: 2, unitPrice: 200, total: 400, itemCode: "svc-1" },
      { id: "li2", description: "Tip fee", quantity: 1, unitPrice: 100, total: 100 },
    ],
    status: "sent",
    sentDate: new Date(NOW - 3 * DAY).toISOString(),
    updatedAt: new Date(NOW - 3 * DAY).toISOString(),
    validUntil: new Date(NOW + 10 * DAY).toISOString(),
    responseDate: null,
    customerName: "Ngata, Sam",
    phone: "021000000",
    email: "sam@example.co.nz",
    ...overrides,
  };
}

function plan(overrides: {
  quotes?: QuoteSignal[];
  replies?: DiaryReplySignal[];
  existing?: ExistingFollowUp[];
  enabled?: boolean;
  nudgeDays?: number[];
  businessId?: string;
  channel?: "sms" | "email";
  lookbackDays?: number;
} = {}): FollowUpPlan[] {
  return planQuoteFollowUps({
    now: NOW,
    businessId: overrides.businessId ?? "biz-a",
    settings: {
      enabled: overrides.enabled ?? true,
      nudgeDays: overrides.nudgeDays ?? [...DEFAULT_NUDGE_DAYS],
      channel: overrides.channel ?? "sms",
      businessName: "Kauri Tree Care",
      lookbackDays: overrides.lookbackDays,
    },
    quotes: overrides.quotes ?? [quote()],
    replies: overrides.replies ?? [],
    existing: overrides.existing ?? [],
  });
}

function creates(plans: FollowUpPlan[]) {
  return plans.filter((item) => item.action === "create");
}

describe("quote follow-up day thresholds", () => {
  it("does not nudge before the first day", () => {
    const plans = plan({
      quotes: [quote({ sentDate: new Date(NOW - 2 * DAY).toISOString(), updatedAt: new Date(NOW - 2 * DAY).toISOString() })],
    });
    assert.deepEqual(plans, []);
  });

  it("drafts the 3 day check-in once the quote has sat quiet", () => {
    const plans = creates(plan());
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.action, "create");
    if (plans[0]?.action !== "create") return;
    assert.equal(plans[0].kind, "check_in");
    assert.equal(plans[0].nudgeStep, 3);
    assert.match(plans[0].message, /just checking where you're at/);
    assert.match(plans[0].message, /Sam/);
  });

  it("uses the tenant's own days", () => {
    const plans = creates(plan({
      nudgeDays: [5, 12],
      quotes: [quote({ sentDate: new Date(NOW - 6 * DAY).toISOString(), updatedAt: new Date(NOW - 6 * DAY).toISOString() })],
    }));
    assert.equal(plans.length, 1);
    if (plans[0]?.action !== "create") return;
    assert.equal(plans[0].nudgeStep, 5);
  });

  it("resets the clock when the quote changed after it was sent", () => {
    const plans = plan({
      quotes: [quote({
        sentDate: new Date(NOW - 10 * DAY).toISOString(),
        updatedAt: new Date(NOW - 1 * DAY).toISOString(),
      })],
    });
    assert.deepEqual(plans, []);
    assert.equal(quietDaysSince(new Date(NOW - 10 * DAY).toISOString(), new Date(NOW - 1 * DAY).toISOString(), NOW), 1);
  });

  it("catches up to the latest due step and records the earlier ones as skipped", () => {
    const plans = plan({
      quotes: [quote({ sentDate: new Date(NOW - 10 * DAY).toISOString(), updatedAt: new Date(NOW - 10 * DAY).toISOString() })],
    });
    const skipped = plans.filter((item) => item.action === "skip").map((item) => item.nudgeStep);
    const drafted = creates(plans);
    assert.deepEqual(skipped, [3]);
    assert.equal(drafted.length, 1);
    if (drafted[0]?.action !== "create") return;
    assert.equal(drafted[0].nudgeStep, 7);
  });

  it("drafts the next step after an earlier one was sent", () => {
    const plans = creates(plan({
      quotes: [quote({ sentDate: new Date(NOW - 8 * DAY).toISOString(), updatedAt: new Date(NOW - 8 * DAY).toISOString() })],
      existing: [{ businessId: "biz-a", quoteId: "q1", nudgeStep: 3, status: "sent" }],
    }));
    assert.equal(plans.length, 1);
    if (plans[0]?.action !== "create") return;
    assert.equal(plans[0].nudgeStep, 7);
  });

  it("does not draft again for the same quote and step", () => {
    const first = plan();
    const existing: ExistingFollowUp[] = first
      .filter((item) => item.action === "create" || item.action === "skip")
      .map((item) => ({
        businessId: "biz-a",
        quoteId: item.quoteId,
        nudgeStep: item.nudgeStep,
        status: item.action === "create" ? "draft" : "skipped",
      }));
    assert.deepEqual(plan({ existing }), []);
  });

  it("does not add a second open draft while one is still waiting", () => {
    const plans = plan({
      quotes: [quote({ sentDate: new Date(NOW - 8 * DAY).toISOString(), updatedAt: new Date(NOW - 8 * DAY).toISOString() })],
      existing: [{ businessId: "biz-a", quoteId: "q1", nudgeStep: 3, status: "draft" }],
    });
    assert.deepEqual(creates(plans), []);
  });
});

describe("quote follow-up expiry", () => {
  it("flags an open quote past its valid date as a re-quote, not another check-in", () => {
    const plans = creates(plan({
      quotes: [quote({
        sentDate: new Date(NOW - 20 * DAY).toISOString(),
        updatedAt: new Date(NOW - 20 * DAY).toISOString(),
        validUntil: new Date(NOW - 1 * DAY).toISOString(),
      })],
    }));
    assert.equal(plans.length, 1);
    if (plans[0]?.action !== "create") return;
    assert.equal(plans[0].kind, "requote");
    assert.equal(plans[0].nudgeStep, EXPIRY_NUDGE_STEP);
    assert.match(plans[0].message, /passed its valid date/);
  });

  it("does not re-quote a quote that is still inside its valid date", () => {
    const plans = creates(plan());
    assert.equal(plans[0] && plans[0].action === "create" ? plans[0].kind : "", "check_in");
  });

  it("re-quotes once", () => {
    const plans = plan({
      quotes: [quote({ validUntil: new Date(NOW - 1 * DAY).toISOString(), status: "viewed" })],
      existing: [{ businessId: "biz-a", quoteId: "q1", nudgeStep: EXPIRY_NUDGE_STEP, status: "draft" }],
    });
    assert.deepEqual(plans, []);
  });
});

describe("replies and decisions stop follow-ups", () => {
  it("stops when the customer replies in the diary after the quote was sent", () => {
    const plans = plan({
      replies: [{
        jobId: "job-1",
        createdAt: new Date(NOW - 1 * DAY).toISOString(),
        authorRole: "customer",
        direction: "inbound",
        tags: ["customer-reply"],
      }],
    });
    assert.deepEqual(creates(plans), []);
  });

  it("cancels a waiting draft when a reply arrives", () => {
    const plans = plan({
      replies: [{
        jobId: "job-1",
        createdAt: new Date(NOW - 1 * DAY).toISOString(),
        direction: "incoming",
      }],
      existing: [{ businessId: "biz-a", quoteId: "q1", nudgeStep: 3, status: "draft" }],
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.action, "cancel");
    if (plans[0]?.action !== "cancel") return;
    assert.equal(plans[0].reason, "customer_reply");
  });

  it("ignores a reply that arrived before the quote was sent", () => {
    const plans = creates(plan({
      replies: [{
        jobId: "job-1",
        createdAt: new Date(NOW - 10 * DAY).toISOString(),
        authorRole: "customer",
      }],
    }));
    assert.equal(plans.length, 1);
  });

  it("ignores an outbound diary send", () => {
    assert.equal(isCustomerDiaryReply({
      jobId: "job-1",
      createdAt: new Date(NOW - 1 * DAY).toISOString(),
      authorRole: "system",
      direction: "outbound",
      entryType: "sms",
    }, NOW - 3 * DAY), false);
    assert.equal(creates(plan({
      replies: [{
        jobId: "job-1",
        createdAt: new Date(NOW - 1 * DAY).toISOString(),
        authorRole: "system",
        direction: "outbound",
        entryType: "sms",
      }],
    })).length, 1);
  });

  it("stops on accept", () => {
    const plans = plan({
      quotes: [quote({ status: "accepted", responseDate: new Date(NOW - DAY).toISOString() })],
      existing: [{ businessId: "biz-a", quoteId: "q1", nudgeStep: 3, status: "snoozed" }],
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.action, "cancel");
    if (plans[0]?.action !== "cancel") return;
    assert.equal(plans[0].reason, "accepted");
  });

  it("stops on decline", () => {
    const plans = plan({
      quotes: [quote({ status: "rejected" })],
      existing: [{ businessId: "biz-a", quoteId: "q1", nudgeStep: 3, status: "draft" }],
    });
    assert.equal(plans[0]?.action, "cancel");
    if (plans[0]?.action !== "cancel") return;
    assert.equal(plans[0].reason, "declined");
    assert.deepEqual(creates(plan({ quotes: [quote({ status: "rejected" })] })), []);
  });
});

describe("tenant isolation", () => {
  it("does not plan another tenant's quote", () => {
    const plans = plan({
      quotes: [quote({ id: "q-b", businessId: "biz-b", jobId: "job-b" })],
    });
    assert.deepEqual(plans, []);
  });

  it("does not let another tenant's row suppress this tenant's draft", () => {
    const plans = creates(plan({
      existing: [{ businessId: "biz-b", quoteId: "q1", nudgeStep: 3, status: "sent" }],
    }));
    assert.equal(plans.length, 1);
    if (plans[0]?.action !== "create") return;
    assert.equal(plans[0].businessId, "biz-a");
  });

  it("keeps two tenants' plans apart when scanned separately", () => {
    const shared = [
      quote(),
      quote({ id: "q-b", businessId: "biz-b", jobId: "job-b", quoteNumber: "88" }),
    ];
    const a = creates(plan({ quotes: shared, businessId: "biz-a" }));
    const b = creates(plan({ quotes: shared, businessId: "biz-b" }));
    assert.deepEqual(a.map((item) => item.quoteId), ["q1"]);
    assert.deepEqual(b.map((item) => item.quoteId), ["q-b"]);
  });
});

describe("re-quote pricing", () => {
  it("clones onto the current rate card and leaves the original alone", () => {
    const source = quote();
    const originalItems = JSON.parse(JSON.stringify(source.lineItems));
    const draft = buildRequoteDraft(source, [
      { id: "svc-1", name: "Tree removal", basePrice: 275 },
    ], "1100", new Date(NOW + 30 * DAY));
    assert.equal(draft.status, "draft");
    assert.equal(draft.quoteNumber, "1100");
    assert.equal(draft.revisedFromQuoteId, "q1");
    assert.equal(draft.sentDate, null);
    assert.equal(draft.lineItems[0]?.unitPrice, 275);
    assert.equal(draft.lineItems[0]?.total, 550);
    assert.equal(draft.lineItems[1]?.unitPrice, 100);
    assert.equal(draft.amount, "650.00");
    assert.equal(source.amount, "500.00");
    assert.deepEqual(source.lineItems, originalItems);
    assert.notEqual(draft.lineItems, source.lineItems);
  });

  it("does not mutate line items while repricing", () => {
    const items = [{ id: "li1", description: "Mulch", quantity: 3, unitPrice: 40, total: 120 }];
    const priced = repriceLineItems(items, [{ id: "m", name: "Mulch", basePrice: 55 }]);
    assert.equal(items[0]?.unitPrice, 40);
    assert.equal(priced.lineItems[0]?.unitPrice, 55);
    assert.equal(priced.amount, 165);
  });
});

describe("nudge day parsing", () => {
  it("falls back to 3, 7 and 14", () => {
    assert.deepEqual(parseNudgeDays(undefined), [3, 7, 14]);
    assert.deepEqual(parseNudgeDays([14, 3, 3, 7]), [3, 7, 14]);
    assert.deepEqual(parseNudgeDays([0, 99, "nope"]), [3, 7, 14]);
  });
});
