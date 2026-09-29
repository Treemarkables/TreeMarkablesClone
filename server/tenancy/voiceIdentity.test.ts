import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  businessIdFromVoiceClient,
  inboundVoiceIdentity,
  isBusinessId,
  voiceIdentityForEmployee,
} from "./voiceIdentity.ts";

const TREEMARKABLES = "a985f349-b6aa-4ef9-a6f9-70aa00e1dcb2";
const SUSTAINABLE = "11111111-2222-4333-8444-555555555555";
const NIGEL = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("voice client identities", () => {
  it("gives each business its own inbound identity", () => {
    const tm = voiceIdentityForEmployee(TREEMARKABLES, "owner-1", true);
    const ss = voiceIdentityForEmployee(SUSTAINABLE, NIGEL, true);
    assert.equal(tm, inboundVoiceIdentity(TREEMARKABLES));
    assert.equal(ss, inboundVoiceIdentity(SUSTAINABLE));
    assert.notEqual(tm, ss);
    assert.equal(tm.includes("treemarkables-owner"), false);
    assert.equal(ss.includes(TREEMARKABLES), false);
  });

  it("does not put a non-admin on the inbound identity", () => {
    const admin = voiceIdentityForEmployee(SUSTAINABLE, NIGEL, true);
    const crew = voiceIdentityForEmployee(SUSTAINABLE, NIGEL, false);
    assert.notEqual(admin, crew);
    assert.equal(crew, `inflow-${SUSTAINABLE}-${NIGEL}`);
  });

  it("reads the business id back off an outbound client From header", () => {
    const adminFrom = `client:${voiceIdentityForEmployee(SUSTAINABLE, NIGEL, true)}`;
    const crewFrom = `client:${voiceIdentityForEmployee(SUSTAINABLE, NIGEL, false)}`;
    assert.equal(businessIdFromVoiceClient(adminFrom), SUSTAINABLE);
    assert.equal(businessIdFromVoiceClient(crewFrom), SUSTAINABLE);
    assert.equal(businessIdFromVoiceClient("client:treemarkables-owner"), undefined);
    assert.equal(isBusinessId(SUSTAINABLE), true);
    assert.equal(isBusinessId("treemarkables-owner"), false);
  });
});
