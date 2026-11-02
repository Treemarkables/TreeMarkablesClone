import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dispatchJobTotalExGst, taxModeIsGstInclusive } from "./dispatchJobTotal.ts";

describe("dispatchJobTotalExGst", () => {
  it("uses a positive subtotal as the ex-GST price", () => {
    assert.equal(
      dispatchJobTotalExGst({
        subtotal: "1250.50",
        totalIncludingGst: "5000",
        totalAmount: "900",
        taxMode: "tax_inclusive",
      }),
      "1250.50",
    );
  });

  it("divides totalIncludingGst by 1.15 when subtotal is missing or zero", () => {
    assert.equal(
      dispatchJobTotalExGst({ subtotal: "0", totalIncludingGst: "115", totalAmount: "999" }),
      "100",
    );
    assert.equal(
      dispatchJobTotalExGst({ subtotal: "0.00", totalIncludingGst: "690.00", totalAmount: "600" }),
      "600",
    );
  });

  it("keeps an ex-GST totalAmount when the other GST columns are zero (job 4131)", () => {
    // total_amount 600, subtotal 0, total_including_gst 0 used to display $522.
    assert.equal(
      dispatchJobTotalExGst({
        subtotal: "0",
        totalIncludingGst: "0",
        totalAmount: "600",
      }),
      "600",
    );
    assert.equal(
      dispatchJobTotalExGst({
        subtotal: 0,
        totalIncludingGst: 0,
        totalAmount: "600.00",
        taxMode: "tax_exclusive",
      }),
      "600.00",
    );
    assert.equal(
      dispatchJobTotalExGst({
        subtotal: null,
        totalIncludingGst: null,
        totalAmount: 600,
        taxMode: "cost_markup",
      }),
      "600",
    );
  });

  it("divides totalAmount by 1.15 only when taxMode is GST-inclusive", () => {
    assert.equal(taxModeIsGstInclusive("tax_inclusive"), true);
    assert.equal(taxModeIsGstInclusive(" TAX_INCLUSIVE "), true);
    assert.equal(taxModeIsGstInclusive("tax_exclusive"), false);
    assert.equal(taxModeIsGstInclusive(null), false);
    assert.equal(
      dispatchJobTotalExGst({
        subtotal: "0",
        totalIncludingGst: "0",
        totalAmount: "115",
        taxMode: "tax_inclusive",
      }),
      "100",
    );
  });

  it("returns 0 when every price column is empty", () => {
    assert.equal(dispatchJobTotalExGst({}), "0");
    assert.equal(dispatchJobTotalExGst({ subtotal: "0", totalAmount: "0" }), "0");
  });
});
