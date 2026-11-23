/**
 * Approval gate for the Not billed queue.
 *
 * confirm must be the boolean true. The action is not called otherwise.
 * Creating an invoice and sending it are both actions. Syncing to Xero is
 * not an action on this queue.
 */

import type { NotBilledStep } from "./jobsNotBilled";

export type BillingActionOutcome =
  | { ok: true; message: string }
  | { ok: false; status: number; message: string };

export async function commitApprovedBillingAction(
  input: {
    confirm: unknown;
    status: string;
    step: string;
    blockingReason?: string | null;
  },
  act: () => Promise<{ ok: boolean; message: string }>,
): Promise<BillingActionOutcome> {
  if (input.confirm !== true) {
    return {
      ok: false,
      status: 400,
      message: "This needs confirm: true. Nothing was created or sent.",
    };
  }
  if (input.status !== "draft" && input.status !== "snoozed") {
    return { ok: false, status: 409, message: "This job is not waiting for approval." };
  }
  if (input.step !== "create_invoice" && input.step !== "send_invoice") {
    return { ok: false, status: 409, message: "This step is handled on Not in Xero. Nothing was created or sent." };
  }
  if (input.blockingReason) {
    return { ok: false, status: 422, message: input.blockingReason };
  }
  const result = await act();
  if (!result.ok) {
    return {
      ok: false,
      status: 502,
      message: result.message || "That didn't go through. Nothing was marked as done.",
    };
  }
  return { ok: true, message: result.message };
}

export function isNotBilledStep(step: string): step is NotBilledStep {
  return step === "create_invoice" || step === "send_invoice";
}
