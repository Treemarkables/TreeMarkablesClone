import { describe, it } from "node:test";
import assert from "node:assert/strict";
import express, { type Express } from "express";
import type { Server } from "node:http";
import { insertJobSchema } from "@shared/schema";
import {
  TREEMARKABLES_BUSINESS_ID,
  customersMatching,
  jobBodyForCreate,
  parseAssistantJobBody,
  parseExGstPrice,
  planAssistantJob,
  secretMatches,
  type AssistantCustomer,
} from "./assistantJobCreate.ts";
import { registerAssistantJobRoutes, type AssistantJobDeps } from "./assistantJobRoutes.ts";

const SPELLING = "Jon Smythh";
const ADDRESS = "12 Stret Rd, Gisborne";
const DESCRIPTION = "Fell the leaning pine by the fence";

function customer(partial: Partial<AssistantCustomer> & Pick<AssistantCustomer, "id" | "name">): AssistantCustomer {
  return {
    email: null,
    phone: null,
    mobile: null,
    address: null,
    ...partial,
  };
}

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

function harness(customers: AssistantCustomer[], secret = "test-secret") {
  const writes: { customers: unknown[]; jobs: Record<string, unknown>[] } = {
    customers: [],
    jobs: [],
  };
  const deps: AssistantJobDeps = {
    readSecret: () => secret,
    appUrl: "https://app.example",
    getCustomer: async (id) => customers.find((row) => row.id === id),
    findMatches: async () => customers,
    createCustomer: async (input) => {
      writes.customers.push(input);
      return customer({
        id: "new-customer",
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address,
      });
    },
    createJob: async (body) => {
      writes.jobs.push(body);
      return {
        status: 200,
        body: {
          success: true,
          data: {
            id: "job-1",
            jobNumber: "4129",
            customerId: body.customerId,
            address: body.address,
            description: body.description,
          },
        },
      };
    },
  };
  const app = express();
  app.use(express.json());
  registerAssistantJobRoutes(app, deps);
  return { app, writes };
}

async function post(
  url: string,
  body: unknown,
  authorization?: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}

const base = {
  customerName: SPELLING,
  address: ADDRESS,
  description: DESCRIPTION,
  price: "450.00",
};

describe("assistant job create", () => {
  it("returns a readback and writes nothing until confirm is boolean true", async () => {
    const { app, writes } = harness([]);
    const server = await listen(app);
    try {
      const preview = await post(`${server.url}/api/assistant/jobs`, base, "Bearer test-secret");
      assert.equal(preview.status, 200);
      assert.equal(preview.json.wrote, false);
      const readback = preview.json.readback as Record<string, unknown>;
      assert.equal((readback.customer as { name: string }).name, SPELLING);
      assert.equal(readback.address, ADDRESS);
      assert.equal(readback.description, DESCRIPTION);
      assert.equal(readback.price, "450.00");
      assert.equal(readback.currency, "NZD");

      const quoted = await post(
        `${server.url}/api/assistant/jobs`,
        { ...base, confirm: "true" },
        "Bearer test-secret",
      );
      assert.equal(quoted.status, 200);
      assert.equal(quoted.json.wrote, false);

      assert.equal(writes.customers.length, 0);
      assert.equal(writes.jobs.length, 0);
    } finally {
      await server.close();
    }
  });

  it("stores a spelled name and address unchanged when confirm is true", async () => {
    const { app, writes } = harness([]);
    const server = await listen(app);
    try {
      const created = await post(
        `${server.url}/api/assistant/jobs`,
        { ...base, confirm: true, customerPhone: "021 555 0101" },
        "Bearer test-secret",
      );
      assert.equal(created.status, 200);
      assert.equal(created.json.wrote, true);
      assert.equal(created.json.link, "https://app.example/dispatch?job=job-1");
      assert.deepEqual(writes.customers[0], {
        name: SPELLING,
        email: undefined,
        phone: "021 555 0101",
        address: ADDRESS,
      });
      const job = writes.jobs[0];
      assert.equal(job.customerId, "new-customer");
      assert.equal(job.address, ADDRESS);
      assert.equal(job.description, DESCRIPTION);
      assert.equal(job.status, "quote");
      const parsed = insertJobSchema.safeParse({ ...job, jobNumber: "4129" });
      assert.equal(parsed.success, true, JSON.stringify(parsed.success ? {} : parsed.error.issues));
    } finally {
      await server.close();
    }
  });

  it("does not create when several customers match", async () => {
    const rows = [
      customer({ id: "a", name: "Ann Smith", address: "1 First St" }),
      customer({ id: "b", name: "Ann  Smith", address: "2 Second St" }),
    ];
    const { app, writes } = harness(rows);
    const server = await listen(app);
    try {
      const result = await post(
        `${server.url}/api/assistant/jobs`,
        { ...base, customerName: "Ann Smith", confirm: true },
        "Bearer test-secret",
      );
      assert.equal(result.status, 409);
      assert.equal(result.json.wrote, false);
      const matches = result.json.matches as { id: string }[];
      assert.deepEqual(matches.map((row) => row.id), ["a", "b"]);
      assert.equal(writes.customers.length, 0);
      assert.equal(writes.jobs.length, 0);
    } finally {
      await server.close();
    }
  });

  it("uses one existing customer and keeps the caller's address", async () => {
    const rows = [
      customer({ id: "cust-9", name: "Harbour Trust", address: "Old billing address", phone: "068671111" }),
    ];
    const { app, writes } = harness(rows);
    const server = await listen(app);
    try {
      const result = await post(
        `${server.url}/api/assistant/jobs`,
        { ...base, customerName: "harbour trust", confirm: true },
        "Bearer test-secret",
      );
      assert.equal(result.status, 200);
      assert.equal(result.json.wrote, true);
      assert.equal(writes.customers.length, 0);
      assert.equal(writes.jobs[0].customerId, "cust-9");
      assert.equal(writes.jobs[0].address, ADDRESS);
      const readback = result.json.readback as { customer: { name: string } };
      assert.equal(readback.customer.name, "Harbour Trust");
    } finally {
      await server.close();
    }
  });

  it("refuses a phone that belongs to a differently spelled customer", async () => {
    const rows = [
      customer({ id: "cust-1", name: "John Smith", phone: "0215550101" }),
    ];
    const { app, writes } = harness(rows);
    const server = await listen(app);
    try {
      const result = await post(
        `${server.url}/api/assistant/jobs`,
        { ...base, customerPhone: "021 555 0101", confirm: true },
        "Bearer test-secret",
      );
      assert.equal(result.status, 409);
      assert.equal(writes.jobs.length, 0);
      assert.equal((result.json.matches as { name: string }[])[0].name, "John Smith");
    } finally {
      await server.close();
    }
  });

  it("rejects another business and a missing secret without writing", async () => {
    const { app, writes } = harness([]);
    const closed = harness([], "");
    const openServer = await listen(app);
    const closedServer = await listen(closed.app);
    try {
      const other = await post(
        `${openServer.url}/api/assistant/jobs`,
        { ...base, businessId: "someone-else", confirm: true },
        "Bearer test-secret",
      );
      assert.equal(other.status, 403);
      const unauth = await post(`${openServer.url}/api/assistant/jobs`, { ...base, confirm: true });
      assert.equal(unauth.status, 401);
      const unconfigured = await post(
        `${closedServer.url}/api/assistant/jobs`,
        { ...base, confirm: true },
        "Bearer test-secret",
      );
      assert.equal(unconfigured.status, 503);
      assert.equal(writes.jobs.length, 0);
      assert.equal(closed.writes.jobs.length, 0);
    } finally {
      await openServer.close();
      await closedServer.close();
    }
  });
});

describe("assistant job price and match rules", () => {
  it("prices the line the way the job card reads exc GST", () => {
    const price = parseExGstPrice("450");
    assert.equal(price.ok, true);
    if (!price.ok) return;
    assert.equal(price.price, "450.00");
    assert.equal(price.gstCents, 6750);
    assert.equal(price.incGstCents, 51750);
    const body = jobBodyForCreate({
      customerId: "cust",
      address: ADDRESS,
      description: DESCRIPTION,
      exGstCents: price.exGstCents,
      gstCents: price.gstCents,
      incGstCents: price.incGstCents,
      lineItemId: "line-1",
    });
    assert.equal(body.subtotal, "450.00");
    assert.equal(body.gstAmount, "67.50");
    assert.equal(body.totalIncludingGst, "517.50");
    assert.equal(body.totalAmount, "517.50");
    const line = (body.lineItems as { totalExGst: number; description: string }[])[0];
    assert.equal(line.totalExGst, 450);
    assert.equal(line.description, DESCRIPTION);
  });

  it("matches a name only when the spelling is the same", () => {
    const rows = [
      customer({ id: "1", name: "Jon Smyth" }),
      customer({ id: "2", name: "John Smith" }),
    ];
    assert.deepEqual(customersMatching(rows, { name: "jon  smyth" }).map((row) => row.id), ["1"]);
    assert.equal(customersMatching(rows, { name: "Jon Smythh" }).length, 0);
  });

  it("does not write a preview plan", () => {
    const parsed = parseAssistantJobBody(base);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const plan = planAssistantJob({
      parsed: parsed.value,
      matches: [],
      lineItemId: "line-1",
    });
    assert.equal(plan.type, "readback");
  });

  it("compares the secret without storing it", () => {
    assert.equal(secretMatches("abc", "abc"), true);
    assert.equal(secretMatches("abc", "abcd"), false);
    assert.equal(TREEMARKABLES_BUSINESS_ID, "a985f349-b6aa-4ef9-a6f9-70aa00e1dcb2");
  });
});
