/**
 * Reopening a proposal must not copy the job lines on top of the saved ones.
 *
 * Run: node --experimental-strip-types --test client/src/components/proposalEditLineItems.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  mergeJobLinesIntoProposalBlocks,
  sumLineTotals,
} from "./proposalEditLineItems.ts";
import { tryAcquireSend } from "../../../shared/proposalSend.ts";

const builderSrc = readFileSync(new URL("./ProposalBuilderV2.tsx", import.meta.url), "utf8");

const saved = { description: "Fell pine", totalPrice: 850 };
const jobCopy = { description: "Fell pine", totalPrice: 850 };

describe("mergeJobLinesIntoProposalBlocks", () => {
  it("does not add the job lines when the proposal already has the same lines", () => {
    const blocks = [
      { type: "description", title: "Services", lineItems: [] as typeof saved[] },
      { type: "lineItems", title: "Line Items", lineItems: [saved] },
    ];
    const merged = mergeJobLinesIntoProposalBlocks(blocks, [jobCopy]);
    assert.equal(merged[1].lineItems.length, 1);
    assert.equal(merged[0].lineItems.length, 0);
    assert.equal(sumLineTotals(merged), 850);
  });

  it("fills only the first empty pricing block, so two blocks do not double the total", () => {
    const blocks = [
      { type: "description", title: "Quote", lineItems: [] as typeof saved[] },
      { type: "lineItems", title: "Line Items", lineItems: [] as typeof saved[] },
    ];
    const merged = mergeJobLinesIntoProposalBlocks(blocks, [jobCopy]);
    assert.equal(sumLineTotals(merged), 850);
    assert.equal(merged[0].lineItems.length + merged[1].lineItems.length, 1);
  });

  it("leaves a proposal with no job lines untouched", () => {
    const blocks = [{ type: "lineItems", title: "Line Items", lineItems: [saved] }];
    const merged = mergeJobLinesIntoProposalBlocks(blocks, []);
    assert.equal(merged, blocks);
    assert.equal(sumLineTotals(merged), 850);
  });
});

describe("one tap sends once", () => {
  it("a second acquire while the first send is in flight does nothing", () => {
    const busy = { current: false };
    assert.equal(tryAcquireSend(busy), true);
    assert.equal(tryAcquireSend(busy), false);
    busy.current = false;
    assert.equal(tryAcquireSend(busy), true);
  });

  it("the proposal builder takes the send lock before awaiting the save", () => {
    const emailFn = builderSrc.slice(
      builderSrc.indexOf("const handleSendEmail"),
      builderSrc.indexOf("const handleSendSms"),
    );
    const smsFn = builderSrc.slice(
      builderSrc.indexOf("const handleSendSms"),
      builderSrc.indexOf("const handleClose"),
    );
    assert.match(emailFn, /tryAcquireSend\(emailSendBusy\)/);
    assert.match(smsFn, /tryAcquireSend\(smsSendBusy\)/);
    assert.ok(emailFn.indexOf("tryAcquireSend") < emailFn.indexOf("await"));
    assert.ok(smsFn.indexOf("tryAcquireSend") < smsFn.indexOf("await"));
  });
});
