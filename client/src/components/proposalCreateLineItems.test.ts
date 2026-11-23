/**
 * A new proposal with no job lines opens one blank row. The row must not
 * take its description from the job title: that column is often the
 * customer's name (conversation → job stores the person in jobs.title).
 *
 * Run: node --experimental-strip-types --test client/src/components/proposalCreateLineItems.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lineItemsForNewProposal } from "./proposalCreateLineItems.ts";

const builderSrc = readFileSync(new URL("./ProposalBuilderV2.tsx", import.meta.url), "utf8");

describe("lineItemsForNewProposal", () => {
  it("opens a blank row when the job title is the customer name and there are no lines", () => {
    // Job 4223: title and customer are both "Christopher Picken", line_items [].
    const seeded = lineItemsForNewProposal([], 4223);
    assert.equal(seeded.starterId, "item-starter-4223");
    assert.equal(seeded.items.length, 1);
    const row = seeded.items[0];
    assert.equal(row.description, "");
    assert.equal(row.description.includes("Christopher"), false);
    assert.equal(row.quantity, 1);
    assert.equal(row.unitPrice, 0);
    assert.equal(row.totalPrice, 0);
    assert.equal(row.costPrice, 0);
    assert.equal(row.markupPct, 0);
    assert.equal(row.category, "");
  });

  it("stays blank even if a caller would previously have passed service type or title", () => {
    const seeded = lineItemsForNewProposal(null, 1);
    assert.equal(seeded.items[0].description, "");
    assert.equal(seeded.starterId, "item-starter-1");
  });

  it("copies real job lines through and does not invent a starter row", () => {
    const seeded = lineItemsForNewProposal([
      {
        id: "saved-1",
        description: "Crown lift elm",
        quantity: 2,
        unitPrice: 400,
        costPrice: 200,
        markupPct: 100,
        itemCode: "ELM",
      },
    ]);
    assert.equal(seeded.starterId, null);
    assert.equal(seeded.items.length, 1);
    assert.equal(seeded.items[0].id, "saved-1");
    assert.equal(seeded.items[0].description, "Crown lift elm");
    assert.equal(seeded.items[0].quantity, 2);
    assert.equal(seeded.items[0].unitPrice, 400);
    assert.equal(seeded.items[0].category, "ELM");
    assert.equal(seeded.items[0].costPrice, 200);
    assert.equal(seeded.items[0].markupPct, 100);
  });

  it("the builder seeds new line items from the helper, not from the job title", () => {
    assert.match(builderSrc, /lineItemsForNewProposal\(rawItems\)/);
    assert.doesNotMatch(
      builderSrc,
      /description:\s*\n\s*\(job as \{ serviceType\?: string \}/,
    );
  });

  it("does not rewrite a description that was already saved on the job", () => {
    const seeded = lineItemsForNewProposal([
      { description: "Christopher Picken", quantity: 1, unitPrice: 50 },
    ]);
    assert.equal(seeded.starterId, null);
    assert.equal(seeded.items[0].description, "Christopher Picken");
    assert.equal(seeded.items[0].unitPrice, 50);
  });
});
