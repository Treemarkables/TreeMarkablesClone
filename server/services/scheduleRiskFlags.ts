// Risk flags for the Live Roster day map.
//
// Pulls every "this site is dangerous" signal the app already records for a
// job — risk assessments, JHA ratings, linked hazard-tree pins, SWMS
// high-risk work, urgent priority, and hazard keywords in the job notes — and
// collapses them into one level per job so the map can colour the pin.
//
// Read-only. Runs on the tenant-scoped `db` proxy like every other route, so
// RLS scopes each table to the caller's business.

import { db } from '../db';
import * as schema from '../../shared/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';

export type RiskLevel = 'none' | 'elevated' | 'high';

export interface JobRiskFlags {
  level: RiskLevel;
  /** Short, human-readable reasons — rendered verbatim in the pin popup. */
  reasons: string[];
  /** Job priority is surfaced separately so the map can badge urgent work. */
  urgent: boolean;
}

export interface RiskInputJob {
  id: string;
  priority?: string | null;
  description?: string | null;
  specialInstructions?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
}

// Site hazards a scheduler wants to know about before the crew rolls out.
// Matched case-insensitively against the job's free-text fields. Kept short
// and specific on purpose — "road" or "water" alone would flag half the book.
const HAZARD_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(power ?lines?|overhead lines?|live wires?|high voltage|lines company|transpower)\b/i, label: 'Powerlines' },
  { pattern: /\b(state highway|highway|traffic management|road closure|stop\/go|stop go)\b/i, label: 'Roadside / traffic' },
  { pattern: /\b(cliff|steep bank|steep slope|river ?bank|unstable ground|land ?slip)\b/i, label: 'Steep or unstable ground' },
  { pattern: /\b(hung[- ]up|widow ?maker|storm damage|split trunk|rotten|decayed|dead tree)\b/i, label: 'Compromised tree' },
  { pattern: /\b(crane lift|crane job|crane)\b/i, label: 'Crane work' },
  { pattern: /\b(school|childcare|kindergarten|daycare)\b/i, label: 'Near school or childcare' },
];

const HIGH_RATINGS = new Set(['high', 'critical', 'extreme']);

function bump(current: RiskLevel, next: RiskLevel): RiskLevel {
  const rank: Record<RiskLevel, number> = { none: 0, elevated: 1, high: 2 };
  return rank[next] > rank[current] ? next : current;
}

export async function computeJobRiskFlags(jobs: RiskInputJob[]): Promise<Map<string, JobRiskFlags>> {
  const out = new Map<string, JobRiskFlags>();
  if (jobs.length === 0) return out;
  const ids = jobs.map((j) => j.id);
  for (const id of ids) out.set(id, { level: 'none', reasons: [], urgent: false });

  const flag = (jobId: string | null | undefined, level: RiskLevel, reason: string) => {
    if (!jobId) return;
    const entry = out.get(jobId);
    if (!entry) return;
    entry.level = bump(entry.level, level);
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
  };

  // 1. Formal risk assessments (active only).
  const assessments = await db.select({
    jobId: schema.riskAssessments.jobId,
    overallRisk: schema.riskAssessments.overallRisk,
    weatherRisk: schema.riskAssessments.weatherRisk,
    hazards: schema.riskAssessments.hazards,
  })
    .from(schema.riskAssessments)
    .where(and(inArray(schema.riskAssessments.jobId, ids), eq(schema.riskAssessments.isActive, true)));
  for (const a of assessments) {
    const overall = (a.overallRisk ?? '').toLowerCase();
    if (HIGH_RATINGS.has(overall)) flag(a.jobId, 'high', `Risk assessment rated ${overall}`);
    else if (overall === 'medium') flag(a.jobId, 'elevated', 'Risk assessment rated medium');
    const weather = (a.weatherRisk ?? '').toLowerCase();
    if (weather === 'unsafe' || weather === 'suspended') flag(a.jobId, 'high', `Weather risk ${weather}`);
    for (const h of a.hazards ?? []) {
      for (const kw of HAZARD_KEYWORDS) {
        if (kw.pattern.test(h)) flag(a.jobId, 'elevated', `Assessment hazard: ${kw.label}`);
      }
    }
  }

  // 2. JHA overall rating (1–5 matrix; 4+ is high, 3 is worth a look).
  const jhas = await db.select({
    jobId: schema.jhaAssessments.jobId,
    rating: schema.jhaAssessments.overallRiskRating,
    status: schema.jhaAssessments.status,
  })
    .from(schema.jhaAssessments)
    .where(inArray(schema.jhaAssessments.jobId, ids));
  for (const j of jhas) {
    if (j.status === 'archived' || j.rating == null) continue;
    if (j.rating >= 4) flag(j.jobId, 'high', `JHA risk rating ${j.rating}/5`);
    else if (j.rating === 3) flag(j.jobId, 'elevated', `JHA risk rating ${j.rating}/5`);
  }

  // 3. Hazard-tree pins linked to the job.
  const links = await db.select({
    jobId: schema.treePinWorkLinks.jobId,
    pinId: schema.treePinWorkLinks.pinId,
  })
    .from(schema.treePinWorkLinks)
    .where(inArray(schema.treePinWorkLinks.jobId, ids));
  if (links.length > 0) {
    const pins = await db.select({
      id: schema.treePins.id,
      riskRating: schema.treePins.riskRating,
    })
      .from(schema.treePins)
      .where(and(inArray(schema.treePins.id, links.map((l) => l.pinId)), isNull(schema.treePins.archivedAt)));
    const pinRating = new Map(pins.map((p) => [p.id, (p.riskRating ?? '').toLowerCase()]));
    const counted = new Map<string, { high: number; medium: number }>();
    for (const l of links) {
      if (!l.jobId) continue;
      const rating = pinRating.get(l.pinId);
      if (!rating) continue;
      const c = counted.get(l.jobId) ?? { high: 0, medium: 0 };
      if (HIGH_RATINGS.has(rating)) c.high += 1;
      else if (rating === 'medium') c.medium += 1;
      counted.set(l.jobId, c);
    }
    counted.forEach((c, jobId) => {
      if (c.high > 0) flag(jobId, 'high', `${c.high} high-risk hazard tree${c.high === 1 ? '' : 's'} pinned`);
      else if (c.medium > 0) flag(jobId, 'elevated', `${c.medium} medium-risk hazard tree${c.medium === 1 ? '' : 's'} pinned`);
    });
  }

  // 4. SWMS documents declaring high-risk work.
  const swms = await db.select({
    jobId: schema.swmsDocuments.jobId,
    highRiskWork: schema.swmsDocuments.highRiskWork,
    status: schema.swmsDocuments.status,
  })
    .from(schema.swmsDocuments)
    .where(inArray(schema.swmsDocuments.jobId, ids));
  for (const s of swms) {
    if (s.status === 'archived') continue;
    const work = (s.highRiskWork ?? []).filter(Boolean);
    if (work.length > 0) flag(s.jobId, 'high', `SWMS high-risk work: ${work.slice(0, 3).join(', ')}`);
  }

  // 5. Priority + hazard keywords straight off the job record.
  for (const job of jobs) {
    const entry = out.get(job.id);
    if (!entry) continue;
    const priority = (job.priority ?? '').toLowerCase();
    if (priority === 'urgent') {
      entry.urgent = true;
      flag(job.id, 'elevated', 'Marked urgent');
    } else if (priority === 'high') {
      entry.urgent = true;
    }
    const text = [job.description, job.specialInstructions, job.notes, job.internalNotes]
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .join('\n');
    if (text) {
      for (const kw of HAZARD_KEYWORDS) {
        if (kw.pattern.test(text)) flag(job.id, 'elevated', `Notes mention: ${kw.label}`);
      }
    }
  }

  return out;
}
