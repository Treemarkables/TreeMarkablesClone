import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_REVENUE_TARGET_GST_LABEL,
  parseDailyRevenueTarget,
} from "./dailyRevenueTarget.ts";

describe("parseDailyRevenueTarget", () => {
  it("reads a stored decimal or number and does not invent a default", () => {
    assert.equal(parseDailyRevenueTarget("4000"), 4000);
    assert.equal(parseDailyRevenueTarget("4000.00"), 4000);
    assert.equal(parseDailyRevenueTarget(3500), 3500);
    assert.equal(parseDailyRevenueTarget(" 1250.50 "), 1250.5);
    assert.equal(parseDailyRevenueTarget(undefined), null);
    assert.equal(parseDailyRevenueTarget(null), null);
    assert.equal(parseDailyRevenueTarget(""), null);
    assert.equal(parseDailyRevenueTarget(0), null);
    assert.equal(parseDailyRevenueTarget("-20"), null);
    assert.equal(parseDailyRevenueTarget("nope"), null);
  });

  it("uses the existing exc. GST label", () => {
    assert.equal(DAILY_REVENUE_TARGET_GST_LABEL, "exc. GST");
  });
});
