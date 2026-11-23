/**
 * POST /api/assistant/jobs
 *
 * A trusted assistant creates one Treemarkables job by calling the same
 * POST /api/jobs handler the job card uses. The secret is
 * INFLOW_ASSISTANT_JOB_SECRET (server env only). Writes require confirm: true.
 */
import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { APP_URL } from "./config/appUrl";
import { runWithBusiness } from "./tenancy/tenantStore";
import {
  TREEMARKABLES_BUSINESS_ID,
  assistantJobAuth,
  parseAssistantJobBody,
  planAssistantJob,
  type AssistantCustomer,
  type AssistantJobReadback,
} from "./assistantJobCreate";

export interface AssistantJobDeps {
  readSecret(): string | undefined;
  getCustomer(id: string): Promise<AssistantCustomer | undefined>;
  findMatches(query: { name?: string; email?: string; phone?: string }): Promise<AssistantCustomer[]>;
  createCustomer(input: {
    name: string;
    email?: string;
    phone?: string;
    address: string;
  }): Promise<AssistantCustomer>;
  createJob(body: Record<string, unknown>): Promise<{ status: number; body: unknown }>;
  appUrl?: string;
}

export function jobLink(appUrl: string, jobId: string): string {
  return `${appUrl.replace(/\/$/, "")}/dispatch?job=${encodeURIComponent(jobId)}`;
}

export async function invokeJobCreate(
  createJobFromBody: (body: Record<string, unknown>, res: Response) => Promise<unknown>,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  let statusCode = 200;
  let settled = false;
  let resolve!: (value: { status: number; body: unknown }) => void;
  const finished = new Promise<{ status: number; body: unknown }>((resolver) => {
    resolve = resolver;
  });
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      if (!settled) {
        settled = true;
        resolve({ status: statusCode, body: payload });
      }
      return res;
    },
  };
  await createJobFromBody(body, res as unknown as Response);
  if (!settled) {
    return { status: 500, body: { success: false, wrote: false, message: "Job create did not respond" } };
  }
  return finished;
}

function send(res: Response, status: number, body: Record<string, unknown>): void {
  res.status(status).json(body);
}

export function registerAssistantJobRoutes(app: Express, deps: AssistantJobDeps): void {
  app.post("/api/assistant/jobs", async (req: Request, res: Response) => {
    const auth = assistantJobAuth(req.header("authorization"), deps.readSecret());
    if (!auth.ok) {
      send(res, auth.status, {
        success: false,
        wrote: false,
        message: auth.message,
      });
      return;
    }

    const parsed = parseAssistantJobBody(req.body);
    if (!parsed.ok) {
      send(res, parsed.status, {
        success: false,
        wrote: false,
        businessId: TREEMARKABLES_BUSINESS_ID,
        message: parsed.message,
      });
      return;
    }

    try {
      const customerById = parsed.value.customerId
        ? await deps.getCustomer(parsed.value.customerId)
        : undefined;
      const matches = parsed.value.customerId
        ? []
        : await deps.findMatches({
            name: parsed.value.customerName,
            email: parsed.value.customerEmail,
            phone: parsed.value.customerPhone,
          });
      const plan = planAssistantJob({
        parsed: parsed.value,
        matches,
        customerById,
        lineItemId: randomUUID(),
      });

      if (plan.type === "refuse") {
        send(res, plan.status, plan.body);
        return;
      }
      if (plan.type === "readback") {
        send(res, 200, plan.body);
        return;
      }

      const outcome = await runWithBusiness(TREEMARKABLES_BUSINESS_ID, async () => {
        let customerId: string;
        if (plan.customer.mode === "existing") {
          customerId = plan.customer.id;
        } else {
          const created = await deps.createCustomer({
            name: plan.customer.name,
            email: plan.customer.email,
            phone: plan.customer.phone,
            address: plan.customer.address,
          });
          customerId = created.id;
        }
        const jobBody = { ...plan.jobBody, customerId };
        const createdJob = await deps.createJob(jobBody);
        return { customerId, createdJob };
      });

      const payload = outcome.createdJob.body;
      const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
      const data = record.data && typeof record.data === "object"
        ? record.data as Record<string, unknown>
        : undefined;
      const jobId = typeof data?.id === "string" ? data.id : undefined;
      const wrote = outcome.createdJob.status < 400 && record.success === true && !!jobId;
      const readback = wrote
        ? storedReadback(plan.readback, data)
        : plan.readback;
      send(res, outcome.createdJob.status, {
        ...record,
        wrote,
        businessId: TREEMARKABLES_BUSINESS_ID,
        customerId: outcome.customerId,
        readback,
        ...(jobId ? { link: jobLink(deps.appUrl ?? APP_URL, jobId) } : {}),
      });
    } catch (error) {
      console.error("[assistant-job] create failed:", error);
      send(res, 500, {
        success: false,
        wrote: false,
        businessId: TREEMARKABLES_BUSINESS_ID,
        message: "Error creating job",
      });
    }
  });
}

function storedReadback(
  planned: AssistantJobReadback,
  job: Record<string, unknown> | undefined,
): AssistantJobReadback {
  const address = typeof job?.address === "string" ? job.address : planned.address;
  const description = typeof job?.description === "string" ? job.description : planned.description;
  return {
    ...planned,
    address,
    description,
  };
}
