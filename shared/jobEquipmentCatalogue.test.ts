import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  JOB_EQUIPMENT_CATALOGUE,
  JOB_EQUIPMENT_LABELS,
  resolveJobEquipmentLabel,
  sanitizeJobEquipment,
  toggleJobEquipment,
} from "./jobEquipmentCatalogue.ts";

describe("locked job equipment catalogue", () => {
  it("has exactly the six locked labels and no hyphens", () => {
    assert.deepEqual(JOB_EQUIPMENT_LABELS, [
      "bucket truck",
      "big truck",
      "chipper",
      "big stump grinder",
      "small stump grinder",
      "orchard ladder",
    ]);
    for (const item of JOB_EQUIPMENT_CATALOGUE) {
      assert.equal(item.label.includes("-"), false, item.label);
      assert.equal(item.label, item.label.toLowerCase());
    }
  });

  it("resolves ids, hyphenated aliases, and register-style names", () => {
    assert.equal(resolveJobEquipmentLabel("bucket_truck"), "bucket truck");
    assert.equal(resolveJobEquipmentLabel("big-stump-grinder"), "big stump grinder");
    assert.equal(resolveJobEquipmentLabel("Bandit chipper"), "chipper");
    assert.equal(resolveJobEquipmentLabel("16m bucket truck"), "bucket truck");
    assert.equal(resolveJobEquipmentLabel("small stump grinder"), "small stump grinder");
    assert.equal(resolveJobEquipmentLabel("orchard ladder"), "orchard ladder");
  });

  it("does not guess a size for a bare stump grinder", () => {
    assert.equal(resolveJobEquipmentLabel("stump grinder"), null);
    assert.equal(resolveJobEquipmentLabel("Hedge kit"), null);
  });

  it("sanitizes to catalogue order and drops unknowns", () => {
    assert.deepEqual(
      sanitizeJobEquipment([
        "orchard ladder",
        "unknown",
        "chipper",
        "CHIPPER",
        "bucket-truck",
        12,
        "",
      ]),
      ["bucket truck", "chipper", "orchard ladder"],
    );
    assert.deepEqual(sanitizeJobEquipment(null), []);
    assert.deepEqual(sanitizeJobEquipment(undefined), []);
  });

  it("toggles an item on and off without leaving the catalogue", () => {
    const withChipper = toggleJobEquipment([], "chipper");
    assert.deepEqual(withChipper, ["chipper"]);
    const withTwo = toggleJobEquipment(withChipper, "big truck");
    assert.deepEqual(withTwo, ["big truck", "chipper"]);
    assert.deepEqual(toggleJobEquipment(withTwo, "chipper"), ["big truck"]);
  });
});
