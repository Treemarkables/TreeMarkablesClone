import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatNZD,
  ganttFormatRange,
  ganttFormatTime,
  ganttJobName,
  ganttStreetAddress,
} from "./calendarMath.ts";

describe("ganttFormatRange — Option A time copy", () => {
  it("joins start and end with to, never a hyphen or en-dash", () => {
    assert.equal(ganttFormatRange("10 AM", "12 PM"), "10 AM to 12 PM");
    assert.equal(ganttFormatRange("9 AM", "11 AM"), "9 AM to 11 AM");
    assert.equal(ganttFormatRange("11 AM", "1 PM"), "11 AM to 1 PM");
    assert.equal(ganttFormatRange("10 AM", "12 PM").includes("-"), false);
    assert.equal(ganttFormatRange("10 AM", "12 PM").includes("–"), false);
  });

  it("returns a single side when the other is blank", () => {
    assert.equal(ganttFormatRange("10 AM", ""), "10 AM");
    assert.equal(ganttFormatRange("", "12 PM"), "12 PM");
    assert.equal(ganttFormatRange("", ""), "");
  });
});

describe("ganttFormatTime + range", () => {
  it("formats hour-only times the way Option A cards show them", () => {
    assert.equal(
      ganttFormatRange(ganttFormatTime("10:00"), ganttFormatTime("12:00")),
      "10 AM to 12 PM",
    );
    assert.equal(
      ganttFormatRange(ganttFormatTime("09:00"), ganttFormatTime("11:00")),
      "9 AM to 11 AM",
    );
  });
});

describe("ganttStreetAddress", () => {
  it("uses the first comma segment as the bold street line", () => {
    assert.equal(ganttStreetAddress("34 Ferguson Drive, Gisborne"), "34 Ferguson Drive");
    assert.equal(ganttStreetAddress("12 Rata Street"), "12 Rata Street");
    assert.equal(ganttStreetAddress(""), "");
    assert.equal(ganttStreetAddress(null), "");
  });
});

describe("ganttJobName", () => {
  it("prefers job title, then customer name, then job number", () => {
    assert.equal(
      ganttJobName({ title: "Te Wiremu house", jobNumber: "4012" }, "Alice"),
      "Te Wiremu house",
    );
    assert.equal(
      ganttJobName({ title: "  ", jobNumber: "4012" }, "Alice"),
      "Alice",
    );
    assert.equal(ganttJobName({ jobNumber: "4012" }, ""), "#4012");
  });
});

describe("formatNZD price chip copy", () => {
  it("matches Option A chip examples", () => {
    assert.equal(formatNZD(2000), "$2k");
    assert.equal(formatNZD(1400), "$1.4k");
    assert.equal(formatNZD(890), "$890");
  });
});
