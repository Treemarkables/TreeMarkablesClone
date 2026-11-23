import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { commitApprovedSend, type ApprovalSendRequest } from "./quoteFollowUpApproval.ts";

const waiting = {
  status: "draft",
  channel: "sms",
  message: "Hi Sam, just checking where you're at with quote 1042.",
  subject: null,
  phone: "021000000",
  email: "sam@example.co.nz",
};

describe("quote follow-up approval gate", () => {
  it("does not send when confirm is missing", async () => {
    let called = 0;
    const result = await commitApprovedSend({ ...waiting, confirm: undefined }, async () => {
      called += 1;
      return true;
    });
    assert.equal(called, 0);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 400);
  });

  it("does not send when confirm is false or a string", async () => {
    for (const confirm of [false, "true", 1, null]) {
      let called = 0;
      const result = await commitApprovedSend({ ...waiting, confirm }, async () => {
        called += 1;
        return true;
      });
      assert.equal(called, 0, `sender ran for confirm=${String(confirm)}`);
      assert.equal(result.ok, false);
    }
  });

  it("sends only after confirm is true", async () => {
    const seen: ApprovalSendRequest[] = [];
    const result = await commitApprovedSend({ ...waiting, confirm: true }, async (request) => {
      seen.push(request);
      return true;
    });
    assert.equal(result.ok, true);
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.to, "021000000");
    assert.equal(seen[0]?.channel, "sms");
  });

  it("does not send a follow-up that is already sent or dismissed", async () => {
    let called = 0;
    const result = await commitApprovedSend(
      { ...waiting, confirm: true, status: "sent" },
      async () => {
        called += 1;
        return true;
      },
    );
    assert.equal(called, 0);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 409);
  });

  it("does not mark a failed send as sent", async () => {
    const result = await commitApprovedSend({ ...waiting, confirm: true }, async () => false);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 502);
  });
});
