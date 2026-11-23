import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapXeroInvoiceAmounts } from "./xeroInvoiceAmounts.ts";

describe("mapXeroInvoiceAmounts", () => {
  it("stores Xero SubTotal as the ex-GST invoice amount and job total", () => {
    assert.deepEqual(
      mapXeroInvoiceAmounts({ subTotal: 600, total: 690, totalTax: 90 }),
      {
        invoiceAmount: "600.00",
        jobAmounts: {
          subtotal: "600.00",
          totalAmount: "600.00",
          totalIncludingGst: "690.00",
          gstAmount: "90.00",
        },
      },
    );
  });

  it("derives GST from Total minus SubTotal when TotalTax is absent", () => {
    const mapped = mapXeroInvoiceAmounts({ subTotal: "600.00", total: "690.00" });
    assert.equal(mapped.invoiceAmount, "600.00");
    assert.equal(mapped.jobAmounts?.totalAmount, "600.00");
    assert.equal(mapped.jobAmounts?.gstAmount, "90.00");
    assert.equal(mapped.jobAmounts?.totalIncludingGst, "690.00");
  });

  it("reads PascalCase Xero fields and keeps a zero-rated tax amount", () => {
    assert.deepEqual(
      mapXeroInvoiceAmounts({ SubTotal: 600, Total: 600, TotalTax: 0 }),
      {
        invoiceAmount: "600.00",
        jobAmounts: {
          subtotal: "600.00",
          totalAmount: "600.00",
          totalIncludingGst: "600.00",
          gstAmount: "0.00",
        },
      },
    );
  });

  it("does not write the GST-inclusive Total when SubTotal is missing", () => {
    assert.deepEqual(mapXeroInvoiceAmounts({ total: 690, totalTax: 90 }), {
      invoiceAmount: null,
      jobAmounts: null,
    });
    assert.deepEqual(mapXeroInvoiceAmounts({ subTotal: 0, total: 690 }), {
      invoiceAmount: null,
      jobAmounts: null,
    });
    assert.deepEqual(mapXeroInvoiceAmounts(null), {
      invoiceAmount: null,
      jobAmounts: null,
    });
  });
});
