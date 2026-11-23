/**
 * Despatch → New → Invoice.
 *
 * Run: node --experimental-strip-types --test client/src/lib/dispatchNewInvoice.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dispatchNewInvoiceRequest,
  shouldStartDispatchInvoiceCreate,
} from "./dispatchNewInvoice.ts";

const schemaSrc = readFileSync(new URL("../../../shared/schema.ts", import.meta.url), "utf8");
const routesSrc = readFileSync(new URL("../../../server/routes.ts", import.meta.url), "utf8");

function jobStatusValues(): string[] {
  const match = schemaSrc.match(/export const JobStatus = z\.enum\(\[([^\]]+)\]\)/);
  assert.ok(match, "JobStatus enum not found");
  return [...match[1].matchAll(/'([^']+)'/g)].map((found) => found[1]);
}

describe("despatch create invoice", () => {
  it("rejects status invoiced, which is why the draft POST never opened a card", () => {
    const statuses = jobStatusValues();
    assert.equal(statuses.includes("invoiced"), false);
    assert.match(schemaSrc, /status: JobStatus\.optional\(\)/);
    // POST /api/jobs and PUT /api/jobs/:id both parse with this schema.
    assert.match(routesSrc, /insertJobSchema\.safeParse\(processedBody\)/);
    assert.match(routesSrc, /insertJobSchema\.partial\(\)\.safeParse\(processedBody\)/);
  });

  it("creates a work order and opens the invoice builder", () => {
    const request = dispatchNewInvoiceRequest();
    assert.equal(request.status, "work_order");
    assert.equal(request.openInvoice, true);
    assert.equal(jobStatusValues().includes(request.status), true);
  });

  it("ignores a second click while the first draft is still being created", () => {
    assert.equal(shouldStartDispatchInvoiceCreate(true), false);
    assert.equal(shouldStartDispatchInvoiceCreate(false), true);
  });

  it("is what the despatch board posts, not status invoiced", () => {
    const board = readFileSync(new URL("../components/DispatchBoard.tsx", import.meta.url), "utf8");
    const handler = board.slice(board.indexOf("const handleCreateInvoice"));
    const handlerBody = handler.slice(0, handler.indexOf("const saveSchedule"));
    assert.match(handlerBody, /dispatchNewInvoiceRequest/);
    assert.match(handlerBody, /shouldStartDispatchInvoiceCreate/);
    assert.doesNotMatch(handlerBody, /status:\s*"invoiced"/);
    assert.match(board, /initialOpenInvoice/);
    assert.match(board, /dispatch-new-invoice/);
    const billing = readFileSync(new URL("../components/JobBillingPanel.tsx", import.meta.url), "utf8");
    const desktop = readFileSync(new URL("../components/JobCardDesktop.tsx", import.meta.url), "utf8");
    assert.match(billing, /onOpenInvoice/);
    assert.match(desktop, /onOpenInvoice=\{actions\?\.invoice\}/);
  });
});
