import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderBrandedEmail } from "./emailTemplates.ts";

const base = {
  customerName: "Sam",
  intro: "Here is the proposal.",
  documentLabel: "Proposal #1",
  totalAmount: 115,
  ctaText: "View Proposal",
  ctaUrl: "https://app.example.com/proposal/1",
};

describe("branded email yard address", () => {
  it("uses 26 Cochrane Street when the email has no company address", () => {
    const html = renderBrandedEmail(base);
    assert.match(html, /26 Cochrane Street, Gisborne/);
    assert.doesNotMatch(html, /Stanley/);
    assert.doesNotMatch(html, /Awapuni/);
    assert.doesNotMatch(html, /4010/);
  });

  it("does not put the Treemarkables yard on another business with a blank address", () => {
    const html = renderBrandedEmail({
      ...base,
      company: { name: "Cut Right", address: "", phone: "021 000 0000" },
    });
    assert.doesNotMatch(html, /Cochrane/);
    assert.doesNotMatch(html, /Stanley/);
    assert.match(html, /021 000 0000/);
  });

  it("prints a stored address unchanged", () => {
    const html = renderBrandedEmail({
      ...base,
      company: { name: "Treemarkables", address: "213 Stanley road, Gisborne" },
    });
    assert.match(html, /213 Stanley road, Gisborne/);
    assert.doesNotMatch(html, /Cochrane/);
  });
});
