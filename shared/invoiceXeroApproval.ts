/**
 * Approval gate for syncing an invoice to Xero.
 *
 * confirm must be the boolean true. The sync function is not called otherwise.
 */

import type { XeroSyncPreview } from "./invoiceXeroFollowUps";

export type XeroSyncOutcome =
  | { ok: true; message: string }
  | { ok: false; status: number; message: string };

export async function commitApprovedXeroSync(
  input: {
    confirm: unknown;
    status: string;
    preview: XeroSyncPreview;
  },
  sync: () => Promise<{ ok: boolean; message: string }>,
): Promise<XeroSyncOutcome> {
  if (input.confirm !== true) {
    return {
      ok: false,
      status: 400,
      message: "Syncing needs confirm: true. Nothing was sent to Xero.",
    };
  }
  if (input.status !== "draft" && input.status !== "snoozed") {
    return {
      ok: false,
      status: 409,
      message: "This invoice is not waiting for approval.",
    };
  }
  if (input.preview.blockingReason) {
    return { ok: false, status: 422, message: input.preview.blockingReason };
  }
  const result = await sync();
  if (!result.ok) {
    return {
      ok: false,
      status: 502,
      message: result.message || "Xero didn't accept the invoice. Nothing was marked as synced.",
    };
  }
  return { ok: true, message: result.message || "Invoice synced to Xero." };
}
