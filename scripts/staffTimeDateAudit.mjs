#!/usr/bin/env node
/**
 * Audit (and optionally repair) jobs.staff_time_entries rows whose `date` was
 * stamped with the UTC calendar day instead of the NZ one.
 *
 * The bug: every writer of an entry's `date` used
 * `new Date().toISOString().split('T')[0]`. NZ is UTC+12/+13, so any entry
 * created before ~1pm NZ was filed under YESTERDAY.
 *
 * Reconstruction source: entries written through storage.addStaffTimeEntry
 * carry an id of the form `${Date.now()}-${random}` — the creation instant in
 * epoch ms. That is a better source than the "Timer stopped" job_diary_entries
 * rows (those only exist for the live-timer path, and only since 2026-07).
 *
 * An entry is REPAIRABLE only when it is unambiguous:
 *   stored date === UTC(created)  AND  UTC(created) !== NZ(created)
 * i.e. it was created inside the divergence window and carries exactly the
 * wrong-by-one day the bug produces.
 *
 * It is AMBIGUOUS when the same signature could also be a deliberate
 * back-date: the Staff Time forms have a real <input type="date">, so a user
 * logging yesterday's hours in the NZ morning produces an identical row. Those
 * are reported separately and never rewritten without --include-ambiguous.
 *
 * Usage:
 *   node scripts/staffTimeDateAudit.mjs              # dry run, report only
 *   node scripts/staffTimeDateAudit.mjs --apply      # rewrite unambiguous rows
 *   node scripts/staffTimeDateAudit.mjs --business <id>
 */
import pg from 'pg';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const BUSINESS = args[args.indexOf('--business') + 1];
const bizFilter = args.includes('--business') ? BUSINESS : null;

const nzFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' });
const utcDay = (d) => d.toISOString().split('T')[0];
const nzDay = (d) => nzFmt.format(d);

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query(
  `SELECT id, job_number, business_id, staff_time_entries
     FROM jobs
    WHERE jsonb_typeof(staff_time_entries) = 'array'
      AND jsonb_array_length(staff_time_entries) > 0
      ${bizFilter ? 'AND business_id = $1' : ''}`,
  bizFilter ? [bizFilter] : [],
);

const stats = { jobs: rows.length, entries: 0, noEpochId: 0, alreadyNz: 0, repairable: 0, ambiguous: 0, jobsTouched: 0 };
const repairs = [];
const ambiguous = [];

for (const job of rows) {
  const entries = job.staff_time_entries;
  let changed = false;
  const next = entries.map((e) => {
    stats.entries++;
    const m = /^(\d{13})-/.exec(String(e?.id ?? ''));
    // Seeded (`demo-…`) and pre-id legacy entries carry no creation instant:
    // there is nothing to recompute from, so leave them alone.
    if (!m || !e?.date) { stats.noEpochId++; return e; }

    const created = new Date(Number(m[1]));
    const utc = utcDay(created);
    const nz = nzDay(created);
    if (utc === nz) { stats.alreadyNz++; return e; }   // created outside the window
    if (e.date !== utc) { stats.alreadyNz++; return e; } // deliberate date, untouched by the bug

    // Same signature, two possible causes. A solitary entry on this job at this
    // instant is a live-timer stop or a single-staff save (always default-dated
    // → definitely the bug). A burst of entries written within the same second
    // is a RecordedTimeModal bulk save, where the date may have been picked.
    const burst = entries.filter((o) => {
      const om = /^(\d{13})-/.exec(String(o?.id ?? ''));
      return om && Math.abs(Number(om[1]) - Number(m[1])) < 2000;
    }).length;

    const record = { jobNumber: job.job_number, id: e.id, from: e.date, to: nz,
                     created: created.toISOString(), hours: e.hours, burst };
    if (burst > 1) { stats.ambiguous++; ambiguous.push(record); return e; }

    stats.repairable++;
    repairs.push(record);
    changed = true;
    return { ...e, date: nz };
  });

  if (changed) {
    stats.jobsTouched++;
    if (APPLY) {
      await client.query('UPDATE jobs SET staff_time_entries = $1 WHERE id = $2',
        [JSON.stringify(next), job.id]);
    }
  }
}

console.log(APPLY ? '=== APPLIED ===' : '=== DRY RUN (no writes) ===');
console.log(stats);
console.log(`\nUnambiguous repairs (${repairs.length}):`);
console.table(repairs.slice(0, 40));
console.log(`\nAmbiguous — bulk-save bursts, NOT rewritten (${ambiguous.length}):`);
console.table(ambiguous.slice(0, 40));
if (!APPLY && repairs.length) console.log('\nRe-run with --apply to write these.');

await client.end();
