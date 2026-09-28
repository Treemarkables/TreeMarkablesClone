import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express, { type Express, type Request } from "express";
import type { Server } from "node:http";
import { mountOpsRoutes, type OpsDeps } from "./opsHandlers.ts";
import type { OpsAccess } from "./opsAccess.ts";

function listen(app: Express): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server: Server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("no port");
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done, reject) => {
          server.close((error) => (error ? reject(error) : done()));
        }),
      });
    });
  });
}

function accessFromHeader(req: Request): OpsAccess {
  const who = req.header("x-test-user");
  if (who === "admin") {
    return { ok: true, businessId: "biz-a", canSetDailyRevenueTarget: true, via: "session" };
  }
  if (who === "crew") {
    return { ok: true, businessId: "biz-a", canSetDailyRevenueTarget: false, via: "session" };
  }
  return { ok: false, status: 401, message: "Authentication required" };
}

describe("ops HTTP routes", () => {
  it("reads the signed-in business and refuses a crew write", async () => {
    const seen: string[] = [];
    let wrote: number | null = null;
    const deps: OpsDeps = {
      resolveAccess: async (req) => accessFromHeader(req),
      todayNz: () => "2026-09-22",
      appUrl: "https://app.example",
      listUnscheduled: async (businessId) => {
        seen.push(businessId);
        return {
          todayNz: "2026-09-22",
          currency: "NZD",
          gstLabel: "exc. GST",
          total: 0,
          truncated: false,
          limit: 200,
          jobs: [],
          links: {
            dispatch: "https://app.example/dispatch",
            settingsPreferences: "https://app.example/settings/preferences",
          },
        };
      },
      weekRevenue: async (businessId, anchor) => {
        seen.push(`${businessId}:${anchor}`);
        return {
          currency: "NZD",
          gstLabel: "exc. GST",
          timezone: "Pacific/Auckland",
          weekStartsOn: "monday",
          weekStart: "2026-09-21",
          weekEnd: "2026-09-27",
          dailyRevenueTarget: 4000,
          days: [],
          weekScheduledRevenueExGst: 0,
          weekTarget: 28000,
          weekGapToTarget: 28000,
          links: {
            dispatch: "https://app.example/dispatch",
            settingsPreferences: "https://app.example/settings/preferences",
          },
        };
      },
      getDailyRevenueTarget: async (businessId) => {
        seen.push(businessId);
        return 4000;
      },
      setDailyRevenueTarget: async (businessId, amount) => {
        wrote = amount;
        seen.push(businessId);
        return amount;
      },
      listQuoteFollowUps: async () => ({
        waiting: 0,
        followUps: [],
        links: {
          queue: "https://app.example/quote-follow-ups",
          settings: "https://app.example/settings/quote-followup",
        },
      }),
      updateQuoteFollowUpDraft: async () => null,
      approveQuoteFollowUp: async () => ({ status: 200, body: { success: true } }),
      listInvoicesNotInXero: async () => ({
        waiting: 0,
        invoices: [],
        links: { queue: "https://app.example/quote-follow-ups?tab=xero" },
      }),
      syncInvoiceToXero: async () => {
        throw new Error("sync should not run");
      },
    };

    const app = express();
    app.use(express.json());
    mountOpsRoutes(app, deps);
    const { url, close } = await listen(app);
    try {
      const anon = await fetch(`${url}/api/ops/unscheduled`);
      assert.equal(anon.status, 401);

      const listed = await fetch(`${url}/api/ops/unscheduled?businessId=biz-b`, {
        headers: { "x-test-user": "admin" },
      });
      assert.equal(listed.status, 200);
      const listedBody = await listed.json() as { success: boolean; data: { links: { dispatch: string } } };
      assert.equal(listedBody.success, true);
      assert.equal(listedBody.data.links.dispatch, "https://app.example/dispatch");
      assert.deepEqual(seen, ["biz-a"]);

      const week = await fetch(`${url}/api/ops/week-revenue?week=2026-09-22`, {
        headers: { "x-test-user": "admin" },
      });
      assert.equal(week.status, 200);
      assert.equal(seen[1], "biz-a:2026-09-22");

      const badWeek = await fetch(`${url}/api/ops/week-revenue?week=tomorrow`, {
        headers: { "x-test-user": "admin" },
      });
      assert.equal(badWeek.status, 400);

      const target = await fetch(`${url}/api/ops/daily-revenue-target`, {
        headers: { "x-test-user": "crew" },
      });
      assert.equal(target.status, 200);
      const targetBody = await target.json() as { data: { dailyRevenueTarget: number; gstLabel: string } };
      assert.equal(targetBody.data.dailyRevenueTarget, 4000);
      assert.equal(targetBody.data.gstLabel, "exc. GST");

      const crewWrite = await fetch(`${url}/api/ops/daily-revenue-target`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-test-user": "crew" },
        body: JSON.stringify({ dailyRevenueTarget: 5000 }),
      });
      assert.equal(crewWrite.status, 403);
      assert.equal(wrote, null);

      const adminWrite = await fetch(`${url}/api/ops/daily-revenue-target`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-test-user": "admin" },
        body: JSON.stringify({ dailyRevenueTarget: 4500 }),
      });
      assert.equal(adminWrite.status, 200);
      const writeBody = await adminWrite.json() as { data: { dailyRevenueTarget: number } };
      assert.equal(writeBody.data.dailyRevenueTarget, 4500);
      assert.equal(wrote, 4500);
      assert.ok(seen.includes("biz-a"));
      assert.equal(seen.includes("biz-b"), false);
    } finally {
      await close();
    }
  });

  it("lists follow-up drafts and does not send without confirm: true", async () => {
    let approvals = 0;
    const draft = {
      id: "fu-1",
      quoteId: "q1",
      quoteNumber: "1042",
      jobId: "job-1",
      customerName: "Sam Ngata",
      kind: "check_in",
      nudgeStep: 3,
      channel: "sms",
      status: "draft",
      waiting: true,
      subject: null,
      message: "Hi Sam, just checking where you're at with quote 1042.",
      recipientPhone: "021000000",
      recipientEmail: null,
      requoteId: null,
      requoteNumber: null,
      snoozeUntil: null,
      links: {
        queue: "https://app.example/quote-follow-ups?id=fu-1",
        job: "https://app.example/dispatch?job=job-1",
      },
    };
    const deps: OpsDeps = {
      resolveAccess: async (req) => accessFromHeader(req),
      todayNz: () => "2026-09-28",
      appUrl: "https://app.example",
      listUnscheduled: async () => {
        throw new Error("unused");
      },
      weekRevenue: async () => {
        throw new Error("unused");
      },
      getDailyRevenueTarget: async () => null,
      setDailyRevenueTarget: async () => null,
      listQuoteFollowUps: async (businessId) => {
        assert.equal(businessId, "biz-a");
        return {
          waiting: 1,
          followUps: [draft],
          links: {
            queue: "https://app.example/quote-follow-ups",
            settings: "https://app.example/settings/quote-followup",
          },
        };
      },
      updateQuoteFollowUpDraft: async () => null,
      approveQuoteFollowUp: async () => {
        approvals += 1;
        return { status: 200, body: { success: true } };
      },
      listInvoicesNotInXero: async () => ({
        waiting: 0,
        invoices: [],
        links: { queue: "https://app.example/quote-follow-ups?tab=xero" },
      }),
      syncInvoiceToXero: async () => {
        throw new Error("sync should not run");
      },
    };

    const app = express();
    app.use(express.json());
    mountOpsRoutes(app, deps);
    const { url, close } = await listen(app);
    try {
      const listed = await fetch(`${url}/api/ops/quote-follow-ups`, {
        headers: { "x-test-user": "crew" },
      });
      assert.equal(listed.status, 200);
      const body = await listed.json() as { data: { waiting: number; followUps: { message: string }[] } };
      assert.equal(body.data.waiting, 1);
      assert.match(body.data.followUps[0]?.message ?? "", /just checking where you're at/);

      for (const payload of [{}, { confirm: false }, { confirm: "true" }]) {
        const refused = await fetch(`${url}/api/ops/quote-follow-ups/fu-1/approve`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-test-user": "admin" },
          body: JSON.stringify(payload),
        });
        assert.equal(refused.status, 400);
      }
      assert.equal(approvals, 0);

      const approved = await fetch(`${url}/api/ops/quote-follow-ups/fu-1/approve`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user": "admin" },
        body: JSON.stringify({ confirm: true }),
      });
      assert.equal(approved.status, 200);
      assert.equal(approvals, 1);
    } finally {
      await close();
    }
  });

  it("lists invoices not in Xero and does not sync without confirm: true", async () => {
    let syncs = 0;
    const deps: OpsDeps = {
      resolveAccess: async (req) => accessFromHeader(req),
      todayNz: () => "2026-09-28",
      appUrl: "https://app.example",
      listUnscheduled: async () => {
        throw new Error("unused");
      },
      weekRevenue: async () => {
        throw new Error("unused");
      },
      getDailyRevenueTarget: async () => null,
      setDailyRevenueTarget: async () => null,
      listQuoteFollowUps: async () => {
        throw new Error("unused");
      },
      updateQuoteFollowUpDraft: async () => null,
      approveQuoteFollowUp: async () => {
        throw new Error("unused");
      },
      listInvoicesNotInXero: async (businessId) => {
        assert.equal(businessId, "biz-a");
        return {
          waiting: 1,
          invoices: [],
          links: { queue: "https://app.example/quote-follow-ups?tab=xero" },
        };
      },
      syncInvoiceToXero: async () => {
        syncs += 1;
        return { status: 200, body: { success: true } };
      },
    };

    const app = express();
    app.use(express.json());
    mountOpsRoutes(app, deps);
    const { url, close } = await listen(app);
    try {
      const listed = await fetch(`${url}/api/ops/invoices-not-in-xero`, {
        headers: { "x-test-user": "crew" },
      });
      assert.equal(listed.status, 200);
      const body = await listed.json() as { data: { waiting: number; links: { queue: string } } };
      assert.equal(body.data.waiting, 1);
      assert.match(body.data.links.queue, /tab=xero/);

      for (const payload of [{}, { confirm: false }, { confirm: "true" }]) {
        const refused = await fetch(`${url}/api/ops/invoices-not-in-xero/row-1/sync`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-test-user": "admin" },
          body: JSON.stringify(payload),
        });
        assert.equal(refused.status, 400);
      }
      assert.equal(syncs, 0);

      const crew = await fetch(`${url}/api/ops/invoices-not-in-xero/row-1/sync`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user": "crew" },
        body: JSON.stringify({ confirm: true }),
      });
      assert.equal(crew.status, 403);
      assert.equal(syncs, 0);

      const synced = await fetch(`${url}/api/ops/invoices-not-in-xero/row-1/sync`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user": "admin" },
        body: JSON.stringify({ confirm: true }),
      });
      assert.equal(synced.status, 200);
      assert.equal(syncs, 1);
    } finally {
      await close();
    }
  });
});
