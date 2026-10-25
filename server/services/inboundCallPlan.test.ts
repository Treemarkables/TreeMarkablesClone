import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decideInboundDialFollowup,
  parseDialCallDuration,
  parseDialLeg,
  planInboundRing,
  recoveryPhoneDialTwiml,
} from "./inboundCallPlan.ts";

const TREEMARKABLES = "a985f349-b6aa-4ef9-a6f9-70aa00e1dcb2";

describe("inbound ring plan", () => {
  it("rings the app and the mobile when a device is registered", () => {
    const plan = planInboundRing({
      clientConfigured: true,
      presence: "registered",
      hasOwnerPhone: true,
    });
    assert.deepEqual(plan, { dialClient: true, dialPhone: true, leg: "both" });
  });

  it("fails open when presence is unknown", () => {
    const plan = planInboundRing({
      clientConfigured: true,
      presence: "unknown",
      hasOwnerPhone: true,
    });
    assert.equal(plan.dialClient, true);
    assert.equal(plan.leg, "both");
  });

  it("rings an expired app on its own, then the mobile from the follow-up", () => {
    const plan = planInboundRing({
      clientConfigured: true,
      presence: "unregistered",
      hasOwnerPhone: true,
    });
    assert.deepEqual(plan, { dialClient: true, dialPhone: false, leg: "client" });
  });

  it("still dials the app when registration has expired and there is no mobile", () => {
    const plan = planInboundRing({
      clientConfigured: true,
      presence: "unregistered",
      hasOwnerPhone: false,
    });
    assert.deepEqual(plan, { dialClient: true, dialPhone: false, leg: "client" });
  });

  it("goes straight to voicemail when nothing can ring", () => {
    const plan = planInboundRing({
      clientConfigured: false,
      presence: "unregistered",
      hasOwnerPhone: false,
    });
    assert.equal(plan.leg, "none");
  });
});

describe("dial follow-up", () => {
  it("hangs up after a real conversation", () => {
    const decision = decideInboundDialFollowup({
      leg: "both",
      dialStatus: "completed",
      dialCallDuration: 64,
      hasOwnerPhone: true,
    });
    assert.deepEqual(decision, { action: "hangup" });
  });

  it("forwards the 12 Oct one-second app drop to the mobile", () => {
    const lookedUp = decideInboundDialFollowup({
      leg: "both",
      dialStatus: "completed",
      dialCallDuration: 1,
      hasOwnerPhone: true,
      answeredTo: `client:inflow-${TREEMARKABLES}`,
    });
    assert.deepEqual(lookedUp, { action: "dial-phone" });
  });

  it("does not forward a completed call that didn't report a duration", () => {
    const decision = decideInboundDialFollowup({
      leg: "both",
      dialStatus: "completed",
      dialCallDuration: null,
      hasOwnerPhone: true,
    });
    assert.deepEqual(decision, { action: "hangup" });
  });

  it("asks who answered before forwarding a short connect", () => {
    const decision = decideInboundDialFollowup({
      leg: "both",
      dialStatus: "completed",
      dialCallDuration: 1,
      hasOwnerPhone: true,
    });
    assert.deepEqual(decision, { action: "lookup" });
  });

  it("does not re-ring the mobile when the mobile itself answered briefly", () => {
    const decision = decideInboundDialFollowup({
      leg: "both",
      dialStatus: "completed",
      dialCallDuration: 1,
      hasOwnerPhone: true,
      answeredTo: "+64210000000",
    });
    assert.deepEqual(decision, { action: "hangup" });
  });

  it("dials the mobile when an unregistered client fails the simultaneous dial", () => {
    const decision = decideInboundDialFollowup({
      leg: "both",
      dialStatus: "failed",
      dialCallDuration: 0,
      hasOwnerPhone: true,
    });
    assert.deepEqual(decision, { action: "dial-phone" });
  });

  it("rings the mobile after the app-only leg is not answered", () => {
    const missed = decideInboundDialFollowup({
      leg: "client",
      dialStatus: "no-answer",
      dialCallDuration: 0,
      hasOwnerPhone: true,
    });
    assert.deepEqual(missed, { action: "dial-phone" });
    const noMobile = decideInboundDialFollowup({
      leg: "client",
      dialStatus: "busy",
      dialCallDuration: null,
      hasOwnerPhone: false,
    });
    assert.deepEqual(noMobile, { action: "voicemail" });
  });

  it("takes voicemail when app and mobile already rang together", () => {
    const missed = decideInboundDialFollowup({
      leg: "both",
      dialStatus: "no-answer",
      dialCallDuration: null,
      hasOwnerPhone: true,
    });
    assert.deepEqual(missed, { action: "voicemail" });
  });

  it("takes voicemail when the mobile-only leg is not answered", () => {
    const missed = decideInboundDialFollowup({
      leg: "phone",
      dialStatus: "no-answer",
      dialCallDuration: null,
      hasOwnerPhone: true,
    });
    assert.deepEqual(missed, { action: "voicemail" });
    const hungUp = decideInboundDialFollowup({
      leg: "phone",
      dialStatus: "completed",
      dialCallDuration: 2,
      hasOwnerPhone: true,
    });
    assert.deepEqual(hungUp, { action: "hangup" });
  });

  it("does not loop a second mobile attempt into another dial", () => {
    const decision = decideInboundDialFollowup({
      leg: "phone",
      dialStatus: "failed",
      dialCallDuration: 0,
      hasOwnerPhone: true,
    });
    assert.deepEqual(decision, { action: "voicemail" });
  });

  it("parses the leg and duration Twilio posts back", () => {
    assert.equal(parseDialLeg("phone"), "phone");
    assert.equal(parseDialLeg("nope"), "both");
    assert.equal(parseDialCallDuration("1"), 1);
    assert.equal(parseDialCallDuration(""), null);
  });

  it("escapes the recovery dial so the action URL stays valid TwiML", () => {
    const xml = recoveryPhoneDialTwiml({
      ownerPhone: "+64210000000",
      actionUrl: "https://app.inflowapp.co.nz/api/webhooks/twilio-no-answer?leg=phone",
      recordingCallbackUrl: "https://app.inflowapp.co.nz/api/webhooks/twilio-voice?callerFrom=%2B64&calledTo=%2B64",
    });
    assert.equal(xml.includes("leg=phone"), true);
    assert.equal(xml.includes("&amp;"), true);
    assert.equal(xml.includes("<Number>+64210000000</Number>"), true);
    assert.equal(xml.includes("leg=both"), false);
  });
});
