#!/usr/bin/env tsx

/**
 * One-shot backfill: copy proposal "Job Description" sections into
 * job.description for every job where job.description is currently empty.
 *
 * Why this exists
 * ───────────────
 * Pre-sync, proposal section text and job.description were entirely
 * independent columns. Users who built proposals first (the natural flow
 * for new work) typed the customer-facing scope into the proposal — and
 * job.description stayed empty. The mobile job card then showed blank.
 *
 * The display fallback in JobDetailsPanel (PR #25) papers over this for
 * mobile, and the sync hook in /api/proposals/sections fixes it going
 * forward. This script catches every existing affected job in one pass.
 *
 * Policy
 * ──────
 *   - EMPTY ONLY: never overwrites a job that already has a description.
 *   - MOST RECENT PROPOSAL WINS: when multiple proposals exist for a job,
 *     uses the most recently created one. service_description sectionType
 *     preferred; falls back to title containing "description".
 *   - DRY-RUN FIRST: set DRY_RUN=1 env var to log what would change
 *     without writing. Strongly recommended before live run.
 *
 * Usage
 * ─────
 *   DRY_RUN=1 tsx scripts/backfill-job-descriptions-from-proposals.ts
 *   tsx scripts/backfill-job-descriptions-from-proposals.ts   (live)
 *
 * Output: counts + per-job summary printed to stdout. Database writes
 * also log [PROPOSAL_DESCRIPTION_BACKFILL] lines for grep-ability.
 */

import { pool } from "../server/db";
import { storage } from "../server/storage";

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

interface Section {
  sectionType?: string | null;
  title?: string | null;
  content?: string | null;
  sortOrder?: number | null;
}

const pickJobDescriptionSection = (sections: Section[]): string | null => {
  // Primary: semantic sectionType.
  const semantic = sections.find((s) => s.sectionType === "service_description");
  if (semantic?.content?.trim()) return semantic.content.trim();
  // Fallback: title-based match — handles older / custom proposal templates
  // where sectionType wasn't set to the canonical value.
  const titled = sections.find((s) => (s.title ?? "").toLowerCase().includes("description"));
  if (titled?.content?.trim()) return titled.content.trim();
  return null;
};

async function main() {
  console.log(`🌱 Backfill starting (DRY_RUN=${DRY_RUN ? "yes" : "NO — will write"})`);

  // Pull every non-archived job. The empty-description filter happens in JS
  // (description column is nullable AND can be the empty string AND can be
  // whitespace; safer to check all three than write three WHERE clauses).
  const { jobs } = await storage.getAllJobs({ excludeArchived: true });
  console.log(`📋 Loaded ${jobs.length} jobs`);

  const candidates = jobs.filter((j) => !(j.description ?? "").trim());
  console.log(`🎯 ${candidates.length} jobs have empty description (backfill candidates)`);

  let copied = 0;
  let skippedNoProposal = 0;
  let skippedNoSection = 0;

  for (const job of candidates) {
    const proposals = await storage.getProposalsByJob(job.id);
    if (proposals.length === 0) {
      skippedNoProposal += 1;
      continue;
    }
    // Newest first.
    const sorted = [...proposals].sort((a, b) => {
      const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTs - aTs;
    });

    let descriptionToWrite: string | null = null;
    for (const proposal of sorted) {
      const sections = await storage.getProposalSectionsByProposal(proposal.id);
      const text = pickJobDescriptionSection(sections);
      if (text) {
        descriptionToWrite = text;
        break;
      }
    }

    if (!descriptionToWrite) {
      skippedNoSection += 1;
      continue;
    }

    const preview = descriptionToWrite.replace(/\s+/g, " ").slice(0, 80);
    if (DRY_RUN) {
      console.log(`  [DRY] job #${job.jobNumber} (${job.id}) ← "${preview}${descriptionToWrite.length > 80 ? "…" : ""}"`);
    } else {
      await storage.updateJob(job.id, { description: descriptionToWrite });
      console.log(`  [PROPOSAL_DESCRIPTION_BACKFILL] job #${job.jobNumber} (${job.id}) ← "${preview}${descriptionToWrite.length > 80 ? "…" : ""}"`);
    }
    copied += 1;
  }

  console.log("\n────────── Backfill summary ──────────");
  console.log(`  Total jobs scanned:        ${jobs.length}`);
  console.log(`  Empty-description jobs:    ${candidates.length}`);
  console.log(`  ${DRY_RUN ? "Would copy" : "Copied"}:                ${copied}`);
  console.log(`  Skipped (no proposal):     ${skippedNoProposal}`);
  console.log(`  Skipped (no usable text):  ${skippedNoSection}`);
  if (DRY_RUN) {
    console.log("\n  Run without DRY_RUN to apply the changes.");
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
