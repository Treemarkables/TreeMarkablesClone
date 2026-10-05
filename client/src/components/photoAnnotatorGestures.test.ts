/**
 * Run: node --experimental-strip-types --test client/src/components/photoAnnotatorGestures.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { strokePhase, type ActiveStroke } from "./photoAnnotatorGestures.ts";

describe("strokePhase", () => {
  it("commits one stroke and then allows another on the same photo", () => {
    let active: ActiveStroke<string> | null = null;
    const committed: string[] = [];

    const down = (id: number, draft: string) => {
      assert.equal(strokePhase(active, { type: "down", pointerId: id }), "start");
      active = { pointerId: id, draft };
    };
    const up = (id: number) => {
      assert.equal(strokePhase(active, { type: "up", pointerId: id }), "finish");
      committed.push(active!.draft);
      active = null;
    };

    down(1, "arrow");
    assert.equal(strokePhase(active, { type: "move", pointerId: 1 }), "update");
    up(1);

    down(2, "circle");
    up(2);

    assert.deepEqual(committed, ["arrow", "circle"]);
  });

  it("ignores the extra pointer that a phone fires around the first symbol", () => {
    const active: ActiveStroke<string> = { pointerId: 1, draft: "arrow" };
    // Synthetic second down while the finger is still drawing.
    assert.equal(strokePhase(active, { type: "down", pointerId: 2 }), "ignore");
    // And the matching up must not finish (and drop) the real stroke.
    assert.equal(strokePhase(active, { type: "up", pointerId: 2 }), "ignore");
    assert.equal(strokePhase(active, { type: "move", pointerId: 1 }), "update");
    assert.equal(strokePhase(active, { type: "up", pointerId: 1 }), "finish");
  });

  it("ignores a leftover pointerup after the stroke already committed", () => {
    assert.equal(strokePhase(null, { type: "up", pointerId: 1 }), "ignore");
    assert.equal(strokePhase(null, { type: "move", pointerId: 1 }), "ignore");
  });
});
