import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionTreePinStatus,
  isTreePinStatus,
  nextTreePinStatuses,
  pinStatusFromJobStatus,
  treePinMapsUrl,
} from "./treePins.ts";

describe("tree pin status machine", () => {
  it("accepts the five lifecycle statuses", () => {
    for (const status of ["assessed", "quoted", "scheduled", "done", "monitor"]) {
      assert.equal(isTreePinStatus(status), true);
    }
    assert.equal(isTreePinStatus("captured"), false);
  });

  it("allows assessed → quoted / scheduled / monitor", () => {
    assert.deepEqual(nextTreePinStatuses("assessed"), ["quoted", "scheduled", "monitor"]);
  });

  it("allows urgent skip from assessed to scheduled", () => {
    assert.equal(canTransitionTreePinStatus("assessed", "scheduled"), true);
  });

  it("does not allow done → quoted", () => {
    assert.equal(canTransitionTreePinStatus("done", "quoted"), false);
  });

  it("maps Inflow job statuses onto pin statuses", () => {
    assert.equal(pinStatusFromJobStatus("quote"), "quoted");
    assert.equal(pinStatusFromJobStatus("work_order"), "scheduled");
    assert.equal(pinStatusFromJobStatus("completed"), "done");
    assert.equal(pinStatusFromJobStatus("mulch"), null);
  });

  it("builds a Google Maps deep link for crew nav", () => {
    assert.equal(
      treePinMapsUrl(-38.6623, 178.0176),
      "https://maps.google.com/?q=-38.6623000,178.0176000",
    );
  });
});
