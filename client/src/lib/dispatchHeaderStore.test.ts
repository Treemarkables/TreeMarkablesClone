import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DISPATCH_JOB_FILTERS } from "./dispatchHeaderStore.ts";

describe("dispatch Active Jobs filter default", () => {
  it("opens on Unscheduled, not All", () => {
    assert.deepEqual(DEFAULT_DISPATCH_JOB_FILTERS, ["work_order"]);
  });
});
