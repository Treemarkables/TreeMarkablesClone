import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveCompanyInfo } from "./documentBlockDefaults.ts";
import {
  TREEMARKABLES_YARD_ADDRESS,
  TREEMARKABLES_YARD_LATITUDE,
  TREEMARKABLES_YARD_LONGITUDE,
  fallbackCompanyAddress,
  isTreemarkablesBusiness,
  treemarkablesYardDirectionsUrl,
  treemarkablesYardOrigin,
} from "./treemarkablesYard.ts";

const PROD = "a985f349-b6aa-4ef9-a6f9-70aa00e1dcb2";

describe("Treemarkables yard", () => {
  it("keeps the street the owner gave, without a guessed suburb or postcode", () => {
    assert.equal(TREEMARKABLES_YARD_ADDRESS, "26 Cochrane Street, Gisborne");
    assert.doesNotMatch(TREEMARKABLES_YARD_ADDRESS, /Stanley|Awapuni|Elgin|4010/);
  });

  it("uses the LINZ address point imported as OSM node 5644893247", () => {
    assert.equal(treemarkablesYardOrigin(), "-38.6571330,177.9878278");
    assert.equal(TREEMARKABLES_YARD_LATITUDE, -38.657133);
    assert.equal(TREEMARKABLES_YARD_LONGITUDE, 177.9878278);
  });

  it("builds driving directions from that point, not from a street-name search", () => {
    const url = treemarkablesYardDirectionsUrl("12 Gladstone Road, Gisborne");
    assert.match(url, /origin=-38\.6571330%2C177\.9878278|origin=-38\.6571330,177\.9878278/);
    assert.match(url, /12%20Gladstone%20Road/);
    assert.doesNotMatch(url, /Stanley/);
  });

  it("recognises only the Treemarkables business ids", () => {
    assert.equal(isTreemarkablesBusiness(PROD), true);
    assert.equal(isTreemarkablesBusiness("215d4e9b-2bf0-4ef8-98c4-1b02a435f7ce"), true);
    assert.equal(isTreemarkablesBusiness("11111111-1111-1111-1111-111111111111"), false);
    assert.equal(isTreemarkablesBusiness(null), false);
  });

  it("does not replace a stored address, including the old yard still in the database", () => {
    assert.equal(
      fallbackCompanyAddress("Treemarkables LTD", "213 Stanley road, Gisborne"),
      "213 Stanley road, Gisborne",
    );
    assert.equal(
      fallbackCompanyAddress("Cut Right", "1 Main Street"),
      "1 Main Street",
    );
  });

  it("fills a blank address for Treemarkables only", () => {
    assert.equal(fallbackCompanyAddress("Treemarkables LTD", ""), TREEMARKABLES_YARD_ADDRESS);
    assert.equal(fallbackCompanyAddress("Treemarkables", "  "), TREEMARKABLES_YARD_ADDRESS);
    assert.equal(fallbackCompanyAddress("Cut Right", ""), "");
    assert.equal(fallbackCompanyAddress("Cut Right", null), "");
  });
});

describe("resolveCompanyInfo address", () => {
  it("uses the yard when a Treemarkables template has no address", () => {
    const co = resolveCompanyInfo({ companyName: "Treemarkables LTD", companyAddress: "" });
    assert.equal(co.address, TREEMARKABLES_YARD_ADDRESS);
  });

  it("keeps another business's blank address blank", () => {
    const co = resolveCompanyInfo({ companyName: "Cut Right", companyAddress: "" });
    assert.equal(co.address, "");
    assert.equal(co.name, "Cut Right");
  });

  it("keeps a stored Stanley Road value so production templates are not rewritten here", () => {
    const co = resolveCompanyInfo({
      companyName: "Treemarkables LTD",
      companyAddress: "213 Stanley road, Gisborne",
    });
    assert.equal(co.address, "213 Stanley road, Gisborne");
  });
});
