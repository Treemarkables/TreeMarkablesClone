import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRequoteDraft,
  collapseFollowUpSources,
  customerFacingQuoteNumber,
  DEFAULT_NUDGE_DAYS,
  draftCheckInMessage,
  draftRequoteMessage,
  EXPIRY_NUDGE_STEP,
  isCustomerDiaryReply,
  parseNudgeDays,
  planQuoteFollowUps,
  planUntouchedDraftRefresh,
  previewRequote,
  proposalFollowUpStatus,
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

function follow(signals: QuoteSignal[], existing: ExistingFollowUp[] = []) {
  return plan({ quotes: collapseFollowUpSources(signals), existing });
}

describe("proposals and presented jobs", () => {
  it("follows a sent proposal", () => {
    const plans = creates(follow([
      quote({ id: "prop-1", sourceType: "proposal", quoteNumber: "Q-100", status: "sent" }),
    ]));
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.quoteId, "prop-1");
  });

  it("follows a job that was presented with no proposal", () => {
    const plans = creates(follow([
      quote({ id: "job-1", jobId: "job-1", sourceType: "job", quoteNumber: "4048", status: "sent", jobStatus: "quote" }),
    ]));
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.quoteId, "job-1");
  });

  it("keeps one item when the job has a proposal and a presented date", () => {
    const plans = creates(follow([
      quote({ id: "prop-1", sourceType: "proposal", quoteNumber: "Q-100" }),
      quote({ id: "job-1", jobId: "job-1", sourceType: "job", quoteNumber: "4048", jobStatus: "quote" }),
    ]));
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.quoteId, "prop-1");
  });

  it("prefers the proposal over a quotes-table row on the same job", () => {
    const plans = creates(follow([
      quote({ id: "q-table", sourceType: "quote", quoteNumber: "1042" }),
      quote({ id: "prop-1", sourceType: "proposal", quoteNumber: "Q-100" }),
    ]));
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.quoteId, "prop-1");
  });

  it("stops when the proposal is accepted or waiting on a deposit", () => {
    for (const status of ["accepted", "accepted_pending_deposit"]) {
      const plans = follow([
        quote({ id: "prop-1", sourceType: "proposal", status, jobStatus: "quote" }),
        quote({ id: "job-1", jobId: "job-1", sourceType: "job", jobStatus: "quote" }),
      ], [{ businessId: "biz-a", quoteId: "prop-1", nudgeStep: 3, status: "draft" }]);
      assert.equal(creates(plans).length, 0, status);
      assert.ok(plans.some((item) => item.action === "cancel"), status);
    }
  });

  it("stops when the job is booked or lost", () => {
    for (const jobStatus of ["work_order", "completed", "unsuccessful", "archived"]) {
      const plans = creates(follow([
        quote({ id: "prop-1", sourceType: "proposal", status: "sent", jobStatus }),
      ]));
      assert.equal(plans.length, 0, jobStatus);
    }
  });

  it("still follows a quotes-table row when that is all the job has", () => {
    const plans = creates(follow([quote({ sourceType: "quote" })]));
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.quoteId, "q1");
  });

  it("treats an SMS diary send as sent even when the proposal is still draft", () => {
    const tracked = proposalFollowUpStatus({
      status: "draft",
      sentDate: null,
      diarySentAt: new Date(NOW - 4 * DAY).toISOString(),
    });
    assert.equal(tracked?.status, "sent");
    assert.ok(tracked?.sentDate);
    assert.equal(proposalFollowUpStatus({ status: "draft", sentDate: null }), null);
  });

  it("does not put a new quote number on the re-quote until approval", () => {
    const plans = creates(plan({
      quotes: [quote({
        sourceType: "proposal",
        validUntil: new Date(NOW - DAY).toISOString(),
        status: "sent",
      })],
    }));
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.kind, "requote");
    if (plans[0]?.action !== "create") return;
    assert.match(plans[0].message, /the new quote/);
    const preview = previewRequote(quote().lineItems, [{ id: "svc-1", name: "Tree removal", basePrice: 275 }]);
    assert.equal(preview.lines[0]?.rate, 275);
    assert.equal("quoteNumber" in preview, false);
  });
});

describe("nudge day parsing", () => {
  it("falls back to 3, 7 and 14", () => {
    assert.deepEqual(parseNudgeDays(undefined), [3, 7, 14]);
    assert.deepEqual(parseNudgeDays([14, 3, 3, 7]), [3, 7, 14]);
    assert.deepEqual(parseNudgeDays([0, 99, "nope"]), [3, 7, 14]);
  });
});

const PROP = "PROP-1790575789755";
const JOB = "4248";
const ADDRESS = "14 Rimu Road, Nelson";
const UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

describe("customer-facing quote number", () => {
  it("keeps a short quote number", () => {
    assert.equal(customerFacingQuoteNumber({
      documentNumber: "1042",
      jobNumber: JOB,
      jobAddress: ADDRESS,
    }), "1042");
  });

  it("uses the job number when the document number is a PROP- id", () => {
    assert.equal(customerFacingQuoteNumber({
      documentNumber: PROP,
      jobNumber: JOB,
      jobAddress: ADDRESS,
    }), JOB);
  });

  it("uses the job number when there is no document number", () => {
    assert.equal(customerFacingQuoteNumber({
      documentNumber: "",
      jobNumber: JOB,
      jobAddress: ADDRESS,
    }), JOB);
  });

  it("uses the job address when there is no short number", () => {
    assert.equal(customerFacingQuoteNumber({
      documentNumber: PROP,
      jobNumber: "",
      jobAddress: ADDRESS,
    }), ADDRESS);
    assert.equal(customerFacingQuoteNumber({
      documentNumber: UUID,
      jobNumber: null,
      jobAddress: "Address not specified",
    }), "your quote");
  });

  it("never returns a PROP- id or a UUID", () => {
    const shown = customerFacingQuoteNumber({
      documentNumber: PROP,
      jobNumber: UUID,
      jobAddress: ADDRESS,
    });
    assert.equal(shown, ADDRESS);
    assert.doesNotMatch(shown, /PROP-/);
    assert.notEqual(shown, UUID);
    assert.equal(customerFacingQuoteNumber({
      documentNumber: `Q-DRAFT-${Date.parse("2026-09-28T00:00:00Z")}`,
      jobNumber: JOB,
    }), JOB);
  });
});

describe("follow-up template text", () => {
  const shown = customerFacingQuoteNumber({ documentNumber: PROP, jobNumber: JOB, jobAddress: ADDRESS });

  it("check-in SMS, email, and re-quote use the short number on every nudge day", () => {
    const sms = draftCheckInMessage({ firstName: "Bruce", quoteNumber: shown, businessName: "Treemarkables", channel: "sms" });
    assert.equal(sms.subject, null);
    assert.equal(sms.message, "Hi Bruce, just checking where you're at with quote 4248. Happy to answer any questions. Cheers, Treemarkables");
    assert.doesNotMatch(sms.message, /PROP-|DRAFT-|[0-9a-f]{8}-/);

    const email = draftCheckInMessage({ firstName: "Bruce", quoteNumber: shown, businessName: "Treemarkables", channel: "email" });
    assert.equal(email.subject, "Quote 4248 — just checking in");
    assert.match(email.message, /quote 4248/);

    const requote = draftRequoteMessage({
      firstName: "Bruce",
      quoteNumber: shown,
      newQuoteNumber: "the new quote",
      businessName: "Treemarkables",
      channel: "sms",
    });
    assert.match(requote.message, /quote 4248/);
    assert.doesNotMatch(requote.message, /PROP-/);

    for (const day of [3, 7, 14]) {
      const plans = creates(plan({
        quotes: [quote({
          quoteNumber: shown,
          customerName: "Bruce Thompson",
          sentDate: new Date(NOW - day * DAY).toISOString(),
          updatedAt: new Date(NOW - day * DAY).toISOString(),
          validUntil: new Date(NOW + 30 * DAY).toISOString(),
        })],
      }));
      const draft = plans.find((item) => item.nudgeStep === day);
      assert.equal(draft?.kind, "check_in");
      if (draft?.action !== "create") continue;
      assert.match(draft.message, /quote 4248/);
      assert.doesNotMatch(draft.message, /PROP-/);
    }

    const expired = creates(plan({
      quotes: [quote({
        quoteNumber: shown,
        customerName: "Bruce Thompson",
        sentDate: new Date(NOW - 20 * DAY).toISOString(),
        updatedAt: new Date(NOW - 20 * DAY).toISOString(),
        validUntil: new Date(NOW - DAY).toISOString(),
      })],
    }));
    assert.equal(expired[0]?.kind, "requote");
    if (expired[0]?.action === "create") {
      assert.match(expired[0].message, /quote 4248/);
      assert.doesNotMatch(expired[0].message, /PROP-/);
    }
  });
});

describe("untouched draft refresh", () => {
  const base = {
    status: "draft",
    kind: "check_in",
    channel: "sms",
    recipientName: "Bruce Thompson",
    businessName: "Treemarkables",
    documentNumber: PROP,
    jobNumber: JOB,
    jobAddress: ADDRESS,
    subject: null as string | null,
  };

  it("rewrites an untouched draft and leaves an edited one", () => {
    const stored = draftCheckInMessage({ firstName: "Bruce", quoteNumber: PROP, businessName: "Treemarkables", channel: "sms" });
    const plan = planUntouchedDraftRefresh({ ...base, message: stored.message, subject: stored.subject });
    assert.equal(plan.action, "rewrite");
    if (plan.action !== "rewrite") return;
    assert.match(plan.message, /quote 4248/);
    assert.doesNotMatch(plan.message, /PROP-/);

    const again = planUntouchedDraftRefresh({ ...base, message: plan.message, subject: plan.subject, documentNumber: PROP });
    assert.equal(again.action, "keep");

    const edited = planUntouchedDraftRefresh({
      ...base,
      message: "Hi Bruce, parking is tight on quote PROP-1790575789755. Cheers, Jules",
    });
    assert.equal(edited.action, "mark_edited");
    const leftAlone = planUntouchedDraftRefresh({
      ...base,
      draftEditedAt: "2026-09-28T00:00:00.000Z",
      message: stored.message,
    });
    assert.equal(leftAlone.action, "keep");
  });

  it("does not rewrite sent or snoozed-edited rows, and does rewrite an untouched re-quote", () => {
    const stored = draftCheckInMessage({ firstName: "Bruce", quoteNumber: PROP, businessName: "Treemarkables", channel: "sms" });
    assert.equal(planUntouchedDraftRefresh({ ...base, status: "sent", message: stored.message }).action, "keep");
    assert.equal(planUntouchedDraftRefresh({ ...base, status: "sending", message: stored.message }).action, "keep");
    assert.equal(planUntouchedDraftRefresh({ ...base, status: "dismissed", message: stored.message }).action, "keep");

    const requote = draftRequoteMessage({
      firstName: "Bruce",
      quoteNumber: PROP,
      newQuoteNumber: "the new quote",
      businessName: "Treemarkables",
      channel: "email",
    });
    const refreshed = planUntouchedDraftRefresh({
      ...base,
      status: "snoozed",
      kind: "requote",
      channel: "email",
      message: requote.message,
      subject: requote.subject,
    });
    assert.equal(refreshed.action, "rewrite");
    if (refreshed.action !== "rewrite") return;
    assert.match(refreshed.message, /Quote 4248/);
    assert.equal(refreshed.subject, "Fresh quote the new quote");
    assert.doesNotMatch(`${refreshed.subject}\n${refreshed.message}`, /PROP-/);
    assert.equal(planUntouchedDraftRefresh({
      ...base,
      status: "snoozed",
      kind: "requote",
      channel: "email",
      message: refreshed.message,
      subject: refreshed.subject,
    }).action, "keep");
  });
});
