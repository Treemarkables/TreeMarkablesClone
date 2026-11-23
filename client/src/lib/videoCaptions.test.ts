import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { videoHasCaptions } from "./videoCaptions.ts";

describe("videoHasCaptions", () => {
  it("does not trust captionsStatus alone", () => {
    assert.equal(videoHasCaptions({ captionsStatus: "ready" }), false);
    assert.equal(videoHasCaptions({ captionsStatus: "ready", captionsVtt: "   " }), false);
    assert.equal(videoHasCaptions({ captionsStatus: "ready", captionsVtt: null }), false);
  });

  it("is true when captions were stored or the public payload says so", () => {
    assert.equal(
      videoHasCaptions({ captionsStatus: "ready", captionsVtt: "WEBVTT\n\n" }),
      true,
    );
    assert.equal(videoHasCaptions({ hasCaptions: true, captionsStatus: "ready" }), true);
    assert.equal(
      videoHasCaptions({ hasCaptions: false, captionsStatus: "ready", captionsVtt: "WEBVTT\n" }),
      false,
    );
  });
});
