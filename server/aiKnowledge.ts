/**
 * Shared AI knowledge — single source of truth for the owner-written business
 * knowledge document (Settings → AI Knowledge, `business_settings.ai_knowledge`).
 *
 * Any AI surface that drafts content or talks to customers should include this
 * block in its prompt so business facts (services offered, service area,
 * policies, FAQs) live in ONE place instead of being repeated across prompts.
 * Current consumers: voice agent (server/services/voiceAgent.ts),
 * speech-to-quote (server/routes.ts). Adopt it in new AI features the same way.
 */
import type { BusinessSettings } from "@shared/schema";

// Hard cap on what gets injected, independent of what's stored — keeps prompt
// size (and voice-agent per-call cost) bounded even if the column grows.
const MAX_INJECTED_CHARS = 8000;

type SettingsLike = Partial<Pick<BusinessSettings, "aiKnowledge">> | null | undefined;

/**
 * Returns a labelled prompt block with the owner's knowledge document, or an
 * empty string when nothing is written — callers can append unconditionally.
 */
export function buildBusinessKnowledgeBlock(settings: SettingsLike): string {
  const knowledge = (settings?.aiKnowledge || "").trim();
  if (!knowledge) return "";
  const capped =
    knowledge.length > MAX_INJECTED_CHARS
      ? `${knowledge.slice(0, MAX_INJECTED_CHARS)}\n[truncated]`
      : knowledge;
  return [
    "",
    "Business knowledge from the owner — treat as authoritative about this business:",
    capped,
    "",
  ].join("\n");
}
