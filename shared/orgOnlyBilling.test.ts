/**
 * Run: node --experimental-strip-types --test shared/orgOnlyBilling.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orgOnlyBillingName, resolveBillingName, GDC_BILLING_NAME } from "./orgOnlyBilling.ts";

describe("orgOnlyBillingName", () => {
  it("detects GDC by name", () => {
    assert.equal(orgOnlyBillingName({ name: "Gisborne council" }), GDC_BILLING_NAME);
    assert.equal(orgOnlyBillingName({ name: "Gisborne District Council" }), GDC_BILLING_NAME);
  });
  it("detects GDC staff records by email domain", () => {
    assert.equal(orgOnlyBillingName({ name: "Aaron Whiteman", email: "aaron.whiteman@gdc.govt.nz" }), GDC_BILLING_NAME);
    assert.equal(orgOnlyBillingName(null, { name: "x", jobContactEmail: "Daniel.Thompson@GDC.govt.nz" }), GDC_BILLING_NAME);
  });
  it("keeps council departments on their own name", () => {
    assert.equal(orgOnlyBillingName({ name: "Kiwa pools", email: "Campbell.Macgregor@gdc.govt.nz" }), null);
    assert.equal(orgOnlyBillingName({ name: "Recovery emergency management", email: "dannielle.koia@gdc.govt.nz" }), null);
  });
  it("leaves other customers alone", () => {
    assert.equal(orgOnlyBillingName({ name: "Jane Smith", email: "jane@gmail.com" }), null);
    assert.equal(resolveBillingName("Jane Smith", { name: "Jane Smith" }), "Jane Smith");
  });
});
