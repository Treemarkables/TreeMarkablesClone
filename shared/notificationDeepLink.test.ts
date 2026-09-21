import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  flattenNotificationPayload,
  jobIdFromNotificationPath,
  parseStoredNotificationNav,
  resolveNotificationPath,
  serializeStoredNotificationNav,
  tabFromNotificationPath,
} from "./notificationDeepLink.ts";

describe("resolveNotificationPath — payload → route", () => {
  it("uses clickAction when it already points at a job card", () => {
    assert.equal(
      resolveNotificationPath({
        clickAction: "/dispatch?job=abc-123&tab=diary",
        type: "email_reply",
      }),
      "/dispatch?job=abc-123&tab=diary",
    );
  });

  it("upgrades a bare /dispatch clickAction when jobId is present", () => {
    assert.equal(
      resolveNotificationPath({
        clickAction: "/dispatch",
        type: "job_assignment",
        jobId: "job-9",
      }),
      "/dispatch?job=job-9",
    );
  });

  it("does not invent a job link for non-job notifications", () => {
    assert.equal(
      resolveNotificationPath({
        clickAction: "/inbox",
        type: "new_conversation",
        conversationId: "conv-1",
      }),
      "/inbox",
    );
    assert.equal(
      resolveNotificationPath({
        type: "invoice_payment",
      }),
      "/invoices",
    );
    assert.equal(
      resolveNotificationPath({
        type: "quote_accepted",
      }),
      "/quotes",
    );
  });

  it("builds a job-card path from type + jobId when clickAction is missing", () => {
    assert.equal(
      resolveNotificationPath({ type: "job_assignment", jobId: "j1" }),
      "/dispatch?job=j1",
    );
    assert.equal(
      resolveNotificationPath({ type: "schedule_change", jobId: "j2" }),
      "/dispatch?job=j2",
    );
    assert.equal(
      resolveNotificationPath({ type: "email_reply", jobId: "j3" }),
      "/dispatch?job=j3&tab=diary",
    );
  });

  it("opens the conversation, not dispatch, for conversation-only payloads", () => {
    assert.equal(
      resolveNotificationPath({
        type: "conversation_reply",
        conversationId: "c-88",
      }),
      "/conversation/c-88",
    );
  });

  it("reads nested FCM envelopes (data / FCM_MSG.data)", () => {
    assert.equal(
      resolveNotificationPath({
        FCM_MSG: {
          data: {
            clickAction: "/dispatch?job=nested",
            type: "sms_reply",
            jobId: "nested",
          },
        },
      }),
      "/dispatch?job=nested",
    );
    assert.equal(
      resolveNotificationPath({
        data: { type: "job_assignment", jobId: "from-data" },
      }),
      "/dispatch?job=from-data",
    );
  });

  it("accepts clickUrl from the PWA service worker envelope", () => {
    assert.equal(
      resolveNotificationPath({ clickUrl: "/dispatch?job=sw-1" }),
      "/dispatch?job=sw-1",
    );
  });

  it("extracts an in-app path from an absolute app URL", () => {
    assert.equal(
      resolveNotificationPath({
        clickAction: "https://app.inflowapp.co.nz/dispatch?job=abs",
      }),
      "/dispatch?job=abs",
    );
  });

  it("returns null for an unknown payload so the caller can open the app without forcing dispatch", () => {
    assert.equal(resolveNotificationPath({ type: "system_alert" }), null);
    assert.equal(resolveNotificationPath({}), null);
  });

  it("falls back to /dispatch only for job types that lost their id", () => {
    assert.equal(resolveNotificationPath({ type: "job_assignment" }), "/dispatch");
  });
});

describe("flatten + path helpers", () => {
  it("lets top-level keys win over nested copies", () => {
    const flat = flattenNotificationPayload({
      clickAction: "/dispatch?job=top",
      data: { clickAction: "/dispatch?job=nested" },
    });
    assert.equal(flat.clickAction, "/dispatch?job=top");
  });

  it("parses job / tab from a dispatch deep link", () => {
    assert.equal(jobIdFromNotificationPath("/dispatch?job=abc&tab=diary"), "abc");
    assert.equal(tabFromNotificationPath("/dispatch?job=abc&tab=diary"), "diary");
    assert.equal(jobIdFromNotificationPath("/jobs/xyz"), "xyz");
  });

  it("rejects stale persisted nav after the TTL", () => {
    const raw = serializeStoredNotificationNav("/dispatch?job=late", 1_000);
    assert.equal(parseStoredNotificationNav(raw, 1_000 + 10_000), "/dispatch?job=late");
    assert.equal(parseStoredNotificationNav(raw, 1_000 + 61_000), null);
  });
});
