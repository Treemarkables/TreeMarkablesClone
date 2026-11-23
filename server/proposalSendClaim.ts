/**
 * Second Send for the same proposal, channel, and recipient inside the
 * dedupe window is ignored. The first request still sends. Releasing the
 * claim on failure lets a real retry through.
 */

import { incrementRateLimit, resetRateLimitKey } from "./security/rateLimitStore";
import {
  PROPOSAL_SEND_DEDUPE_MS,
  proposalSendDedupeKey,
  type ProposalSendChannel,
} from "../shared/proposalSend";

export async function beginProposalSend(
  proposalId: string,
  channel: ProposalSendChannel,
  recipient: string,
): Promise<"send" | "duplicate"> {
  const row = await incrementRateLimit(
    proposalSendDedupeKey(proposalId, channel, recipient),
    PROPOSAL_SEND_DEDUPE_MS,
  );
  return row.count > 1 ? "duplicate" : "send";
}

export async function releaseProposalSend(
  proposalId: string,
  channel: ProposalSendChannel,
  recipient: string,
): Promise<void> {
  await resetRateLimitKey(proposalSendDedupeKey(proposalId, channel, recipient));
}
