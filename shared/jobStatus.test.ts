import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { statusAfterBooking, statusAfterDiaryBook } from "./jobStatus.ts";

describe("statusAfterDiaryBook", () => {
  it("moves a lead to quote when booked from the diary Book button", () => {
    assert.equal(statusAfterDiaryBook("lead"), "quote");
  });

  it("still advances a quote to work_order on that same Book path", () => {
    assert.equal(statusAfterDiaryBook("quote"), "work_order");
  });

  it("leaves every other status alone", () => {
    for (const status of ["mulch", "work_order", "completed", "unsuccessful", null, undefined, ""]) {
      assert.equal(statusAfterDiaryBook(status), null);
    }
  });
});

describe("statusAfterBooking", () => {
  it("does not move a lead — crew scheduling and dispatch stay unchanged", () => {
    assert.equal(statusAfterBooking("lead"), null);
    assert.equal(statusAfterBooking("quote"), "work_order");
  });

  it("leaves a work_order as a work_order when it is booked", () => {
    assert.equal(statusAfterBooking("work_order"), null);
  });
});
