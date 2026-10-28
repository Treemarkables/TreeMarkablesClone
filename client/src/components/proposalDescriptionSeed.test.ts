/**
 * A proposal can show the job description in the builder while the saved
 * section is still empty. Email must persist that text before send-email.
 *
 * Run: node --experimental-strip-types --test client/src/components/proposalDescriptionSeed.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  descriptionForLoadedSection,
  draftNeedsSaveBeforeSend,
  shouldTakeSilentEditBaseline,
} from "./proposalDescriptionSeed.ts";

const builderSrc = readFileSync(new URL("./ProposalBuilderV2.tsx", import.meta.url), "utf8");
const routesSrc = readFileSync(new URL("../../../server/routes.ts", import.meta.url), "utf8");

const jobText = "Remove the leaning pine and chip the brush.";

describe("description seeded from the job", () => {
  it("fills an empty description block from the job and does not take the silent baseline", () => {
    const loaded = descriptionForLoadedSection("", "description", jobText);
    assert.equal(loaded.seededFromJob, true);
    assert.equal(loaded.description, jobText);
    assert.equal(shouldTakeSilentEditBaseline(loaded.seededFromJob), false);
  });

  it("still needs a save when the on-screen snapshot already matches that seeded text", () => {
    // The old baseline copied the filled block into lastSnapshot without a PUT.
    // Send then thought nothing had changed and posted send-email against an empty section.
    const snap = JSON.stringify({ description: jobText });
    assert.equal(
      draftNeedsSaveBeforeSend({
        hasDraftId: true,
        snapshot: snap,
        lastSavedSnapshot: snap,
        descriptionSeededFromJobUnsaved: true,
      }),
      true,
    );
  });

  it("keeps a saved description and the silent baseline so a reopen does not rewrite lines", () => {
    const loaded = descriptionForLoadedSection("Crown reduce the oak", "description", jobText);
    assert.equal(loaded.seededFromJob, false);
    assert.equal(loaded.description, "Crown reduce the oak");
    assert.equal(shouldTakeSilentEditBaseline(false), true);
    assert.equal(
      draftNeedsSaveBeforeSend({
        hasDraftId: true,
        snapshot: "same",
        lastSavedSnapshot: "same",
        descriptionSeededFromJobUnsaved: false,
      }),
      false,
    );
  });

  it("does not seed photos or line-item blocks, or a blank job description", () => {
    assert.deepEqual(descriptionForLoadedSection("", "photos", jobText), {
      description: "",
      seededFromJob: false,
    });
    assert.deepEqual(descriptionForLoadedSection("", "lineItems", jobText), {
      description: "",
      seededFromJob: false,
    });
    assert.deepEqual(descriptionForLoadedSection("", "description", "   "), {
      description: "",
      seededFromJob: false,
    });
    assert.equal(shouldTakeSilentEditBaseline(false), true);
  });

  it("saves a new draft and a changed snapshot", () => {
    assert.equal(
      draftNeedsSaveBeforeSend({
        hasDraftId: false,
        snapshot: "draft",
        lastSavedSnapshot: null,
        descriptionSeededFromJobUnsaved: false,
      }),
      true,
    );
    assert.equal(
      draftNeedsSaveBeforeSend({
        hasDraftId: true,
        snapshot: "edited",
        lastSavedSnapshot: "saved",
        descriptionSeededFromJobUnsaved: false,
      }),
      true,
    );
  });
});

describe("builder wires the seed through to send", () => {
  it("skips the silent baseline only when a description was filled from the job", () => {
    assert.match(builderSrc, /descriptionForLoadedSection\(/);
    assert.match(builderSrc, /takeEditBaseline\.current = shouldTakeSilentEditBaseline\(/);
    assert.doesNotMatch(builderSrc, /takeEditBaseline\.current = true/);
    assert.match(
      builderSrc,
      /snap === lastSnapshot\.current && !seededDescriptionUnsaved\.current/,
    );
  });

  it("awaits a queued save and writes the current payload before send-email and send-quote-email", () => {
    const mutation = builderSrc.slice(
      builderSrc.indexOf("const sendEmailMutation"),
      builderSrc.indexOf("const sendSmsMutation"),
    );
    const enqueueAt = mutation.indexOf("enqueueSave");
    const saveAt = mutation.indexOf("saveDraftMutation.mutateAsync(buildPayload())");
    const quoteAt = mutation.indexOf("send-quote-email");
    const emailAt = mutation.indexOf("/send-email");
    assert.ok(enqueueAt !== -1 && saveAt !== -1);
    assert.ok(enqueueAt < saveAt);
    assert.ok(saveAt < quoteAt);
    assert.ok(saveAt < emailAt);
    assert.match(mutation, /draftNeedsSaveBeforeSend\(/);
    const ensure = builderSrc.slice(
      builderSrc.indexOf("const ensureDraftSaved"),
      builderSrc.indexOf("const handleDownloadPdf"),
    );
    assert.match(ensure, /draftNeedsSaveBeforeSend\(/);
    assert.match(ensure, /enqueueSave\(/);
  });
});

describe("server still refuses a proposal with no saved description", () => {
  it("keeps the send-email and send-quote-email checks and names the unsaved text", () => {
    assert.match(
      routesSrc,
      /proposal has no saved description text — the customer would see an empty job description/,
    );
    assert.match(
      routesSrc,
      /quote has no saved description text — the PDF would have an empty job description/,
    );
    assert.equal(routesSrc.split("if (!hasIntroduction && !hasDescriptionSection)").length - 1, 2);
  });
});
