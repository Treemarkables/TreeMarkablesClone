/**
 * Metrics-showcase seeder — populate a TEST tenant's Metrics dashboard with
 * realistic, fully fictional data so it can be screenshotted / screen-recorded
 * without exposing a real business's records.
 *
 * What it creates (all stamped with the target tenant's business_id):
 *   - ~16 fictional customers (a few repeat customers so retention % shows)
 *   - ~12 months of jobs (~10 completed a month, seasonally weighted, densest
 *     in the last few weeks): completed+invoiced, upcoming work orders (some
 *     today), pending quotes, lost quotes, raw leads
 *   - a sent proposal for every quoted job (accepted / pending / lost mix)
 *   - invoices (mostly paid, recent ones pending) with ex-GST line items
 *   - the tenant's EXISTING active staff booked onto every completed / upcoming
 *     job (job_staff_assignments rows, jobs.assigned_staff_ids) with recorded
 *     time entries (jobs.staff_time_entries) on completed jobs, so crew hours,
 *     labour cost, gross margin, estimation accuracy and the staff schedule
 *     all have data. The seeder never creates employees.
 *   - `leads` rows over the same 12 months (some created today)
 *   - today-anchored rows: a job completed+invoiced today, quotes sent today,
 *     work orders on today, leads created today — so the "Today" tiles aren't 0
 *
 * Safety design:
 *   - refuses to run without SEED_CONFIRM=yes
 *   - target tenant is looked up BY NAME (SEED_BUSINESS_NAME) at runtime —
 *     ids differ between the Neon dev branch and prod, names don't
 *   - hard-refuses the Treemarkables tenant (name match + both known ids)
 *   - every row is tagged (import_source / notes / template_used =
 *     'demo_seed' markers) so SEED_WIPE=1 can cleanly remove a previous run
 *     before re-seeding. Anything the tenant created by hand is untouched.
 *
 * Every date is relative to the run date, so re-running with SEED_WIPE=1 is
 * how you "refresh" the demo when the last run has gone stale.
 *
 * Usage (DATABASE_URL = target branch; dev to test, prod via DO console):
 *   SEED_CONFIRM=yes SEED_BUSINESS_NAME='Cut right' npx tsx scripts/seedMetricsShowcase.mts
 *   SEED_CONFIRM=yes SEED_BUSINESS_NAME='Cut right' SEED_WIPE=1 npx tsx scripts/seedMetricsShowcase.mts
 */
// The app's naive `timestamp` columns hold UTC wall times (written by the app
// under TZ=UTC on DO). node-pg serializes Date params in the PROCESS-local
// timezone, so force UTC before any Date work — otherwise running this from a
// NZ-localtime machine would store NZ wall times and every date would read
// 12-13h late in production.
process.env.TZ = "UTC";

import pg from "pg";

const TAG = "demo_seed";
const INVOICE_TAG = "[demo-seed] Fictional showcase data — safe to delete.";
const GST = 0.15;
// Known Treemarkables business ids (prod + Neon dev branch). Guarded in
// addition to the name check because the name could in theory be edited.
const TM_ID_PREFIXES = ["a985f349", "215d4e9b"];

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (process.env.SEED_CONFIRM !== "yes") {
  fail("Refusing to run without SEED_CONFIRM=yes (guards against accidental runs).");
}
const businessName = process.env.SEED_BUSINESS_NAME;
if (!businessName) {
  fail("SEED_BUSINESS_NAME is not set. Point it at the TEST tenant's exact business name, e.g. 'Cut right'.");
}
if (businessName.toLowerCase().includes("treemarkables")) {
  fail("This seeder is for TEST tenants only — it will not touch Treemarkables.");
}
if (!process.env.DATABASE_URL) {
  fail("DATABASE_URL not set — point it at the target branch (dev to test, prod for the real demo).");
}

// Deterministic RNG so re-runs produce a similar-shaped dataset.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260909);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();

// Anchor all seeded dates to Pacific/Auckland day boundaries — that's what the
// dashboard's "today" filters use. Wall-clock hours are NZ hours converted to
// the UTC instants the app expects in these naive timestamp columns.
function nzOffsetMs(d: Date): number {
  const tzName = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", timeZoneName: "shortOffset" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+12";
  const m = tzName.match(/([+-]\d+)/);
  return (m ? parseInt(m[1], 10) : 12) * 3600 * 1000;
}
const nzDateStr = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(d); // YYYY-MM-DD
const nzTodayStr = nzDateStr(now);
const nzMidnight = new Date(new Date(`${nzTodayStr}T00:00:00Z`).getTime() - nzOffsetMs(now));
// Day offsets are counted in NZ calendar days from today. Each day's midnight
// is re-derived from its own NZ date so the DST shift across a year is absorbed.
function nzMidnightAt(dayOffset: number): Date {
  const approxNoon = new Date(nzMidnight.getTime() + dayOffset * DAY + 12 * 3600e3);
  const dateStr = nzDateStr(approxNoon);
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - nzOffsetMs(approxNoon));
}
const atNZ = (dayOffset: number, hour: number, minute = intBetween(0, 59)) =>
  new Date(nzMidnightAt(dayOffset).getTime() + hour * 3600e3 + minute * 60e3);
const daysAgo = (d: number, hour = 9) => atNZ(-d, hour);
const nzDateOf = (dayOffset: number) => nzDateStr(new Date(nzMidnightAt(dayOffset).getTime() + 12 * 3600e3)); // YYYY-MM-DD
const nzWeekday = (dayOffset: number) => new Date(`${nzDateOf(dayOffset)}T12:00:00Z`).getUTCDay(); // 0 = Sun … 6 = Sat
const nzMonth = (dayOffset: number) => Number(nzDateOf(dayOffset).slice(5, 7));
// Nudge an offset onto a working day (Mon–Sat): tree crews rarely bill Sundays.
function workingDay(dayOffset: number): number {
  let d = dayOffset;
  while (nzWeekday(d) === 0) d += d <= 0 ? -1 : 1;
  return d;
}
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

// ── Fictional dataset ────────────────────────────────────────────────────────

const CUSTOMERS = [
  { name: "Sarah Mitchell", address: "14 Kowhai Crescent, Riverdale", source: "google" },
  { name: "Dave Thompson", address: "82 Harbour View Road, Seaton", source: "referral" },
  { name: "Priya Sharma", address: "7 Rata Street, Fernhill", source: "website" },
  { name: "Mike & Karen O'Sullivan", address: "230 Valley Road, Te Awa", source: "google" },
  { name: "Harbourview Property Management", address: "Level 2, 18 Quay Street, Seaton", source: "referral" },
  { name: "Janet Ferguson", address: "5 Miro Lane, Fernhill", source: "facebook" },
  { name: "Tom Bradley", address: "119 Ridge Road, Highcliff", source: "word_of_mouth" },
  { name: "Aroha Ngata", address: "33 Pohutukawa Drive, Bayfair", source: "google" },
  { name: "St Aidan's School Board", address: "1 Chapel Street, Riverdale", source: "referral" },
  { name: "Liz & Peter Hammond", address: "48 Orchard Grove, Te Awa", source: "website" },
  { name: "Kereru Lane Body Corporate", address: "2-16 Kereru Lane, Seaton", source: "referral" },
  { name: "Grant Wilson", address: "301 Coast Road, Bayfair", source: "facebook" },
  { name: "Emma Chen", address: "12 Totara Place, Fernhill", source: "google" },
  { name: "Russell Cooper", address: "77 Station Road, Highcliff", source: "word_of_mouth" },
  { name: "Nga Mara Community Trust", address: "9 Marae Road, Te Awa", source: "referral" },
  { name: "Fiona McAllister", address: "26 Beach Parade, Bayfair", source: "website" },
];

// hours = estimated crew man-hours. Price is derived from hours at a
// per-man-hour charge-out (plus a machinery/disposal loading) and then
// clamped to lo/hi so each service lands in a believable band.
const JOB_TITLES = [
  { title: "Large gum removal — rear boundary", lo: 2800, hi: 9500, hours: [16, 40] },
  { title: "Hedge trimming — front & side boundary", lo: 450, hi: 1400, hours: [4, 10] },
  { title: "Crown lift & deadwood removal", lo: 900, hi: 2600, hours: [6, 14] },
  { title: "Stump grinding x3", lo: 500, hi: 1300, hours: [3, 6] },
  { title: "Storm damage cleanup", lo: 800, hi: 4200, hours: [6, 20] },
  { title: "Pohutukawa reduction & shaping", lo: 1200, hi: 3400, hours: [8, 16] },
  { title: "Pine removal x2 + chip on site", lo: 3200, hi: 11000, hours: [18, 44] },
  { title: "Section clear & green waste removal", lo: 1500, hi: 5200, hours: [10, 24] },
  { title: "Palm cleaning & frond removal", lo: 380, hi: 900, hours: [3, 6] },
  { title: "Tree health assessment & report", lo: 300, hi: 750, hours: [2, 4] },
  { title: "Macrocarpa hedge reduction", lo: 1600, hi: 4800, hours: [10, 22] },
  { title: "Willow removal over garage", lo: 2200, hi: 6800, hours: [12, 28] },
  { title: "Fruit tree pruning — orchard block", lo: 600, hi: 1800, hours: [5, 12] },
  { title: "Liquidambar removal & stump grind", lo: 1800, hi: 5400, hours: [10, 24] },
  { title: "Boundary trees — council consent trim", lo: 1400, hi: 4000, hours: [8, 18] },
];

const LEAD_SOURCES = ["google", "referral", "website", "facebook", "phone", "word_of_mouth"];
const UNSUCCESSFUL_REASONS = ["price_too_high", "went_competitor", "changed_mind", "scheduling", "no_longer_needed"];

// NZ tree work is busiest through late spring–autumn and quietest mid-winter.
function seasonalWeight(month: number): number {
  if ([11, 12, 1, 2, 3].includes(month)) return 1.25;
  if ([6, 7, 8].includes(month)) return 0.7;
  return 1.0;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const c = await pool.connect();

try {
  const bizRes = await c.query(`SELECT id, name FROM businesses WHERE name = $1`, [businessName]);
  if (bizRes.rows.length !== 1) {
    const all = await c.query(`SELECT name FROM businesses ORDER BY created_at`);
    fail(
      `Expected exactly one business named '${businessName}', found ${bizRes.rows.length}.\n` +
        `   Businesses on this database: ${all.rows.map((r) => `'${r.name}'`).join(", ")}`,
    );
  }
  const bizId: string = bizRes.rows[0].id;
  if (TM_ID_PREFIXES.some((p) => bizId.startsWith(p))) {
    fail(`Business '${businessName}' resolves to a Treemarkables id (${bizId}) — refusing.`);
  }
  const host = new URL(process.env.DATABASE_URL!).host;
  console.log(`\nTarget: '${businessName}' (${bizId}) on ${host}\n`);

  // Proposal-number prefix from the business initials ('Cut above' → CA-1042).
  const proposalPrefix =
    businessName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 3) || "PR";

  // ── Staff (never created here — whatever the tenant already has) ──────────
  type Staff = { id: string; name: string; role: string; costRate: number; chargeRate: number };
  const staffRes = await c.query(
    `SELECT id, first_name, last_name, role, hourly_rate, charge_out_rate
       FROM employees
      WHERE business_id = $1 AND is_active = true AND status = 'active'
      ORDER BY created_at`,
    [bizId],
  );
  const allStaff: Staff[] = staffRes.rows.map((r, i) => ({
    id: r.id,
    name: `${r.first_name} ${r.last_name}`.trim(),
    role: r.role,
    // Fall back to plausible NZ arborist cost / charge-out rates when the
    // tenant hasn't set them, so labour cost + margin still populate.
    costRate: r.hourly_rate ? Number(r.hourly_rate) : [36, 42, 34, 45, 38][i % 5],
    chargeRate: r.charge_out_rate ? Number(r.charge_out_rate) : 95,
  }));
  // Prefer the crew over admins; a 1-2 person business books the owner too.
  const crewOnly = allStaff.filter((s) => s.role !== "admin");
  const crew: Staff[] = crewOnly.length >= 2 ? crewOnly : allStaff;
  const adminId: string | null = allStaff.find((s) => s.role === "admin")?.id ?? null;
  if (crew.length === 0) {
    console.log("  ⚠ no active employees on this tenant — jobs will be seeded without crew assignments/time entries");
  } else {
    console.log(`  crew available for assignments: ${crew.map((s) => s.name).join(", ")}`);
  }

  await c.query("BEGIN");

  if (process.env.SEED_WIPE === "1") {
    // Delete in FK order: assignments/invoices/proposals → jobs → leads → customers.
    const del = async (label: string, sql: string) => {
      const r = await c.query(sql, [bizId]);
      console.log(`  wiped ${r.rowCount} ${label}`);
    };
    console.log("SEED_WIPE=1 — removing previous demo-seed rows…");
    await del(
      "staff assignments",
      `DELETE FROM job_staff_assignments
        WHERE job_id IN (SELECT id FROM jobs WHERE business_id = $1 AND import_source = '${TAG}')`,
    );
    await del("invoices", `DELETE FROM invoices WHERE business_id = $1 AND notes = '${INVOICE_TAG}'`);
    await del("proposals", `DELETE FROM proposals WHERE business_id = $1 AND template_used = '${TAG}'`);
    await del("jobs", `DELETE FROM jobs WHERE business_id = $1 AND import_source = '${TAG}'`);
    await del("leads", `DELETE FROM leads WHERE business_id = $1 AND notes = '${INVOICE_TAG}'`);
    // Match by notes tag OR the legacy import_source tag (pre-onboarding-reset
    // seeds used import_source='demo_seed'; resetTenantOnboarding flips that to
    // 'manual' but stamps the notes tag).
    await del("customers", `DELETE FROM customers WHERE business_id = $1 AND (import_source = '${TAG}' OR notes = '${INVOICE_TAG}')`);
  }

  // Job numbers: continue from the tenant's highest numeric job number, or 1001.
  const jnRes = await c.query(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(job_number, '\\D', '', 'g'), '')::int), 1000) AS max
       FROM jobs WHERE business_id = $1`,
    [bizId],
  );
  let nextJobNumber = Number(jnRes.rows[0].max) + 1;

  // ── Customers ──────────────────────────────────────────────────────────────
  const customerIds: string[] = [];
  for (const [i, cust] of CUSTOMERS.entries()) {
    const slug = cust.name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
    // import_source stays 'manual' so seeded customers don't mark the setup
    // checklist's "Import your data" item done; the notes tag is what
    // SEED_WIPE matches on.
    const r = await c.query(
      `INSERT INTO customers (business_id, name, email, phone, address, source, import_source, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'manual', '${INVOICE_TAG}', $7, $7) RETURNING id`,
      [
        bizId,
        cust.name,
        `${slug}@example.co.nz`,
        `02${intBetween(1, 9)} ${intBetween(100, 999)} ${intBetween(1000, 9999)}`,
        cust.address,
        cust.source,
        daysAgo(intBetween(330, 380) - i * 4),
      ],
    );
    customerIds.push(r.rows[0].id);
  }
  console.log(`  created ${customerIds.length} customers`);

  // Weight a handful of customers as repeats so retention metrics show.
  const weightedCustomer = () => {
    if (rand() < 0.45) return customerIds[intBetween(0, 4)]; // the 5 repeat customers
    return pick(customerIds);
  };

  let jobsCreated = 0;
  let proposalsCreated = 0;
  let invoicesCreated = 0;
  let assignmentsCreated = 0;
  let revenueExGst = 0;
  let revenueLast30 = 0;
  let completedLast30 = 0;

  type JobSpec = {
    kind: "completed" | "work_order" | "quote" | "unsuccessful" | "lead";
    quoteCreatedDaysAgo: number; // when the job card / quote was created
    scheduleOffsetDays?: number; // relative to today; negative/zero = past (completed), positive = upcoming
    invoiceStatus?: "paid" | "pending";
  };

  const specs: JobSpec[] = [];

  // Completed + invoiced jobs: 52 weeks, ~2.3 a week scaled by season, so a
  // year shows ~10 a month. The current week is anchored: one completes TODAY
  // and the days already elapsed this week each get one, so weekly views and
  // the Today tiles have activity. Recent invoices (< 14 days) alternate
  // paid/pending so the outstanding/AR side isn't empty.
  const todayWeekday = nzWeekday(0); // 0 = Sun
  const daysSinceMonday = (todayWeekday + 6) % 7;
  const completedOffsets: number[] = [0]; // days ago
  for (let d = 1; d <= daysSinceMonday; d++) completedOffsets.push(d);
  for (let week = 1; week < 52; week++) {
    const mondayAgo = week * 7 + daysSinceMonday; // days ago of that week's Monday
    const weight = seasonalWeight(nzMonth(-mondayAgo));
    const count = Math.max(0, Math.round(2.3 * weight + between(-0.6, 0.6)));
    const used = new Set<number>();
    for (let k = 0; k < count; k++) {
      let dayInWeek = intBetween(0, 5); // Mon–Sat
      for (let tries = 0; used.has(dayInWeek) && tries < 6; tries++) dayInWeek = (dayInWeek + 1) % 6;
      used.add(dayInWeek);
      completedOffsets.push(mondayAgo - dayInWeek);
    }
  }
  completedOffsets.sort((a, b) => a - b);
  for (const [i, done] of completedOffsets.entries()) {
    specs.push({
      kind: "completed",
      quoteCreatedDaysAgo: done + intBetween(7, 28),
      scheduleOffsetDays: -done,
      invoiceStatus:
        done === 0 ? "pending"
        : done < 14 && i % 2 === 1 ? "pending"
        : done < 45 && rand() < 0.15 ? "pending"
        : "paid",
    });
  }

  // 8 accepted work orders, upcoming; two of them on today's board.
  for (let i = 0; i < 8; i++) {
    specs.push({
      kind: "work_order",
      quoteCreatedDaysAgo: intBetween(4, 30),
      scheduleOffsetDays: i < 2 ? 0 : workingDay(intBetween(1, 21)),
    });
  }
  // 8 pending quotes (proposal sent, no answer yet); two sent today.
  for (let i = 0; i < 8; i++) {
    specs.push({ kind: "quote", quoteCreatedDaysAgo: i < 2 ? 0 : intBetween(1, 28) });
  }
  // Lost quotes across the year — roughly one for every four wins.
  const lostCount = Math.round(completedOffsets.length / 4);
  for (let i = 0; i < lostCount; i++) {
    specs.push({ kind: "unsuccessful", quoteCreatedDaysAgo: i < 3 ? intBetween(3, 25) : intBetween(10, 340) });
  }
  // 3 raw leads (job cards still at 'lead'); one from today.
  for (let i = 0; i < 3; i++) {
    specs.push({ kind: "lead", quoteCreatedDaysAgo: i === 0 ? 0 : intBetween(1, 6) });
  }

  for (const spec of specs) {
    const t = pick(JOB_TITLES);
    const customerId = weightedCustomer();
    const custRow = CUSTOMERS[customerIds.indexOf(customerId)];
    const jobNumber = String(nextJobNumber++);
    const createdAt = daysAgo(spec.quoteCreatedDaysAgo, intBetween(8, 16));

    const isDone = spec.kind === "completed";
    const isBooked = isDone || spec.kind === "work_order";

    // Estimate → price. Man-hours drive the quote: crew charge-out per
    // man-hour plus a 10–35% loading for machinery / chipper / disposal.
    const estHours = intBetween(t.hours[0], t.hours[1]);
    const rawPrice = estHours * between(88, 118) * between(1.1, 1.35);
    const subtotal = Math.round(Math.min(t.hi, Math.max(t.lo, rawPrice)) / 5) * 5; // ex-GST
    const gstAmount = subtotal * GST;
    const totalIncGst = subtotal + gstAmount;

    const presentationMethod = rand() < 0.4 ? "on_site" : "sent_later";
    // Proposal goes out 0-2 days after the job card is created (same day for today's rows).
    const sentDate =
      spec.quoteCreatedDaysAgo === 0
        ? daysAgo(0, 10)
        : daysAgo(Math.max(0, spec.quoteCreatedDaysAgo - intBetween(0, 2)), intBetween(9, 17));

    const status =
      spec.kind === "completed" ? "completed"
      : spec.kind === "work_order" ? "work_order"
      : spec.kind === "quote" ? "quote"
      : spec.kind === "unsuccessful" ? "unsuccessful"
      : "lead";

    // Crew plan: how many people, how many days. Small jobs are a one-person
    // half day; big removals are a 3-person multi-day booking.
    const crewSize = crew.length === 0 ? 0 : Math.min(crew.length, estHours <= 6 ? 1 : estHours <= 20 ? 2 : 3);
    const hoursPerPersonDay = 8;
    const jobDays = isBooked
      ? Math.max(1, Math.min(3, Math.ceil(estHours / (Math.max(1, crewSize) * hoursPerPersonDay))))
      : 1;

    // Scheduling — a job's scheduled_date is its FIRST day; multi-day jobs
    // carry scheduled_end_date + the explicit scheduled_dates list.
    let scheduledDate: Date | null = null;
    let scheduledEndDate: Date | null = null;
    let scheduledDates: string[] | null = null;
    let firstDayOffset = 0; // day offset (relative to today) of the first job day
    if (spec.scheduleOffsetDays !== undefined) {
      firstDayOffset = spec.scheduleOffsetDays <= 0 ? spec.scheduleOffsetDays - (jobDays - 1) : spec.scheduleOffsetDays;
      scheduledDate = atNZ(firstDayOffset, 7, 30);
      if (jobDays > 1) {
        scheduledEndDate = atNZ(firstDayOffset + jobDays - 1, 7, 30);
        scheduledDates = Array.from({ length: jobDays }, (_, d) => nzDateOf(firstDayOffset + d));
      }
    }
    const lastDayOffset = firstDayOffset + jobDays - 1;
    const completedDate = isDone ? atNZ(lastDayOffset, 15, intBetween(10, 55)) : null;
    const workOrderAt = isBooked ? new Date(sentDate.getTime() + intBetween(1, 4) * DAY) : null;

    // Actual hours on completed jobs land within ±25% of the estimate, then
    // get split across the crew per day as recorded time entries.
    const actHours = isDone ? Math.max(1, Math.round(estHours * between(0.8, 1.25))) : null;
    const accuracy = actHours ? Math.max(0, (1 - Math.abs(estHours - actHours) / estHours) * 100) : null;

    const jobCrew: Staff[] = crewSize > 0 ? shuffle(crew).slice(0, crewSize) : [];
    type TimeEntry = { id: string; employeeId: string; hours: number; rate: number; costRate: number; date: string };
    const timeEntries: TimeEntry[] = [];
    let actualLaborCost = 0;
    if (isDone && actHours && jobCrew.length > 0) {
      // Distribute actual hours over crew × days; the lead takes a touch more.
      const slots = jobCrew.length * jobDays;
      let remaining = actHours;
      let slot = 0;
      for (let d = 0; d < jobDays; d++) {
        for (const [ci, s] of jobCrew.entries()) {
          slot++;
          const share =
            slot === slots
              ? remaining
              : Math.max(0.5, Math.round(((actHours / slots) * (ci === 0 ? 1.1 : 0.95) + between(-0.5, 0.5)) * 2) / 2);
          const hours = Math.round(Math.min(remaining, share) * 100) / 100;
          remaining = Math.round((remaining - hours) * 100) / 100;
          if (hours <= 0) continue;
          timeEntries.push({
            id: `demo-${jobNumber}-${d}-${ci}`,
            employeeId: s.id,
            hours,
            rate: s.chargeRate,
            costRate: s.costRate,
            date: nzDateOf(firstDayOffset + d),
          });
          actualLaborCost += hours * s.costRate;
        }
      }
    } else if (isDone && actHours) {
      // No staff on the tenant: fall back to a flat labour cost so margin still shows.
      actualLaborCost = actHours * 40;
    }
    const totalStaffHours = timeEntries.reduce((s, e) => s + e.hours, 0);

    // Other costs (job-level fields only — line-item totalCost stays 0 so
    // revenue-stats doesn't double count). Labour ~35–45% + these ~10–18%
    // of revenue puts gross margin in the 40–55% band.
    const materialsCosts = isDone ? subtotal * between(0.03, 0.08) : 0;
    const disposalCosts = isDone ? subtotal * between(0.04, 0.09) : 0;
    const travelCosts = isDone ? subtotal * between(0.015, 0.035) : 0;
    const totalCosts = actualLaborCost + materialsCosts + disposalCosts + travelCosts;
    const grossMargin = isDone && subtotal > 0 ? ((subtotal - totalCosts) / subtotal) * 100 : null;

    const lineItems = [
      {
        id: `demo-${jobNumber}-1`,
        description: t.title,
        quantity: 1,
        unitPrice: subtotal,
        total: totalIncGst,
        unitCost: 0,
        totalCost: 0,
        costExGst: 0,
        priceExGst: subtotal,
        totalExGst: subtotal,
        taxRate: 15,
      },
    ];

    const jobRes = await c.query(
      `INSERT INTO jobs (
         business_id, customer_id, job_number, title, description, lead_source, import_source,
         address, status, created_at, updated_at, scheduled_date, scheduled_end_date, scheduled_dates,
         completed_date, work_order_at,
         quote_presentation_method, quote_presented_date, proposal_sent, proposal_sent_date,
         total_amount, subtotal, gst_amount, total_including_gst,
         actual_labor_costs, materials_costs, disposal_costs, travel_costs,
         gross_margin, gross_margin_calculated,
         estimated_man_hours, actual_man_hours, estimation_accuracy, estimation_variance,
         estimated_duration, assigned_staff_ids, assigned_to, staff_time_entries, total_staff_hours,
         metrics_eligible, line_items, checklist, equipment_checklist, proposal_sections,
         unsuccessful_reason, unsuccessful_date
       ) VALUES (
         $1, $2, $3, $4, $5, $6, '${TAG}',
         $7, $8, $9, $9, $10, $11, $12,
         $13, $14,
         $15, $16, $17, $18,
         $19, $20, $21, $22,
         $23, $24, $25, $26,
         $27, $28,
         $29, $30, $31, $32,
         $33, $34, $35, $36, $37,
         true, $38, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
         $39, $40
       ) RETURNING id`,
      [
        bizId, customerId, jobNumber, t.title,
        `Fictional demo job seeded for dashboard screenshots.`,
        pick(LEAD_SOURCES),
        custRow?.address ?? "Address not specified",
        status, createdAt, scheduledDate, scheduledEndDate, scheduledDates ? JSON.stringify(scheduledDates) : null,
        completedDate, workOrderAt,
        spec.kind === "lead" ? null : presentationMethod,
        spec.kind === "lead" ? null : (presentationMethod === "on_site" ? sentDate : null),
        spec.kind !== "lead",
        spec.kind === "lead" ? null : sentDate,
        money(totalIncGst), money(subtotal), money(gstAmount), money(totalIncGst),
        isDone ? money(actualLaborCost) : null, money(materialsCosts), money(disposalCosts), money(travelCosts),
        grossMargin === null ? null : money(Math.max(-99.99, Math.min(99.99, grossMargin))), isDone,
        estHours, actHours, accuracy === null ? null : money(accuracy),
        actHours === null ? null : actHours - estHours,
        Math.max(1, Math.round(estHours / Math.max(1, crewSize || 2))),
        jobCrew.length > 0 && isBooked ? jobCrew.map((s) => s.id) : null,
        jobCrew.length > 0 && isBooked ? jobCrew.map((s) => s.id) : null,
        timeEntries.length > 0 ? JSON.stringify(timeEntries) : null,
        timeEntries.length > 0 ? money(totalStaffHours) : null,
        JSON.stringify(lineItems),
        spec.kind === "unsuccessful" ? pick(UNSUCCESSFUL_REASONS) : null,
        spec.kind === "unsuccessful" ? new Date(sentDate.getTime() + intBetween(3, 10) * DAY) : null,
      ],
    );
    const jobId = jobRes.rows[0].id;
    jobsCreated++;

    // Crew bookings — one row per person per job day (mirrors the app's
    // multi-day expansion in POST /api/jobs/:jobId/staff-assignments).
    if (isBooked && jobCrew.length > 0) {
      for (let d = 0; d < jobDays; d++) {
        const dayDate = nzDateOf(firstDayOffset + d);
        const dayHours = isDone
          ? Math.max(2, Math.min(9, timeEntries.filter((e) => e.date === dayDate).reduce((s, e) => s + e.hours, 0) / jobCrew.length + 0.5))
          : Math.max(2, Math.min(8.5, estHours / (jobCrew.length * jobDays) + 0.5));
        const start = atNZ(firstDayOffset + d, 7, 30);
        const end = new Date(start.getTime() + dayHours * 3600e3);
        for (const [ci, s] of jobCrew.entries()) {
          await c.query(
            `INSERT INTO job_staff_assignments (
               business_id, job_id, employee_id, start_time, end_time, role, status,
               confirmed, confirmed_at, notification_sent, notification_sent_at, notes, created_by, created_at, updated_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,true,$8,$9,$10,$8,$8)`,
            [
              bizId, jobId, s.id, start, end,
              ci === 0 ? "lead" : "ground_crew",
              isDone ? "completed" : "confirmed",
              workOrderAt ?? createdAt,
              INVOICE_TAG,
              adminId,
            ],
          );
          assignmentsCreated++;
        }
      }
    }

    // Proposal for every quoted job (everything except raw leads).
    if (spec.kind !== "lead") {
      const accepted = isBooked;
      const rejected = spec.kind === "unsuccessful";
      const responseDate = accepted || rejected ? new Date(sentDate.getTime() + intBetween(1, 5) * DAY) : null;
      await c.query(
        `INSERT INTO proposals (
           business_id, job_id, customer_id, proposal_number, title, status, delivery_method,
           sent_date, viewed_date, response_date, signed_date,
           total_amount, subtotal, gst_amount, potential_value,
           template_used, created_by, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,'email',$7,$8,$9,$10,$11,$12,$13,$11,'${TAG}','${TAG}',$14,$14)`,
        [
          bizId, jobId, customerId,
          `${proposalPrefix}-${jobNumber}`,
          t.title,
          accepted ? "accepted" : rejected ? "rejected" : rand() < 0.5 ? "viewed" : "sent",
          sentDate,
          rand() < 0.7 ? new Date(sentDate.getTime() + intBetween(0, 2) * DAY) : null,
          responseDate,
          accepted ? responseDate : null,
          money(totalIncGst), money(subtotal), money(gstAmount),
          createdAt,
        ],
      );
      proposalsCreated++;
    }

    // Invoice for completed jobs. `amount` is ex-GST (matches the app since
    // #471/#502); items[].amount is what the dashboards sum.
    if (isDone && completedDate) {
      const issueDate = new Date(completedDate.getTime() + intBetween(0, 2) * DAY);
      const cappedIssue = issueDate > now ? now : issueDate;
      const paid = spec.invoiceStatus === "paid";
      await c.query(
        `INSERT INTO invoices (
           business_id, customer_id, job_id, invoice_number, job_title, address, contact_name,
           issue_date, due_date, amount, status, items, notes, paid_at, sent_date, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$8,$8,$8)`,
        [
          bizId, customerId, jobId, jobNumber, t.title,
          custRow?.address ?? "", custRow?.name ?? "",
          cappedIssue,
          new Date(cappedIssue.getTime() + 14 * DAY),
          money(subtotal),
          paid ? "paid" : "pending",
          JSON.stringify([{ description: t.title, quantity: 1, rate: subtotal, amount: subtotal }]),
          INVOICE_TAG,
          paid ? new Date(Math.min(now.getTime(), cappedIssue.getTime() + intBetween(2, 18) * DAY)) : null,
        ],
      );
      invoicesCreated++;
      revenueExGst += subtotal;
      if (-lastDayOffset <= 30) {
        revenueLast30 += subtotal;
        completedLast30++;
      }
    }
  }

  // ── Leads table (Today tile + lead metrics + conversion rate) ─────────────
  // Roughly 2.2 leads per completed job over the same 12 months keeps the
  // conversion-rate tile (completed jobs ÷ leads) plausible at ~45%.
  const firstNames = ["Rachel", "Hemi", "Sue", "Alan", "Megan", "Carl", "Tina", "Oliver", "Beth", "Nikau", "Paul", "Wendy", "Josh", "Kiri", "Stan", "Donna", "Marcus", "Ellie", "Rewi", "Claire", "Ben", "Moana", "Greg", "Hana", "Ian", "Lucy", "Tane", "Vicky", "Neil", "Ruth"];
  const lastNames = ["Donovan", "Walker", "Pritchard", "Briggs", "Foster", "Jensen", "Rawiri", "Grey", "Holmes", "Parata", "Simmons", "Clarke", "Tibble", "Nash", "Owens", "Field", "Hayes", "Morton", "Keane", "Lamb", "Baxter", "Waititi", "Cole", "Dunn", "Ellis", "Faulkner", "Gibbs", "Hurst", "Irwin", "Kemp"];
  const leadTotal = Math.round(completedOffsets.length * 2.2);
  const leadNames = Array.from({ length: leadTotal }, (_, i) => `${firstNames[i % firstNames.length]} ${lastNames[(i * 7 + 3) % lastNames.length]}`);
  let leadsCreated = 0;
  for (const [i, name] of leadNames.entries()) {
    const created = i < 2 ? daysAgo(0, 8 + i) : daysAgo(i < 12 ? intBetween(1, 30) : intBetween(1, 360), intBetween(8, 17));
    await c.query(
      `INSERT INTO leads (business_id, name, phone, service_requested, urgency, status, source, notes, estimated_value, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
      [
        bizId, name,
        `02${intBetween(1, 9)} ${intBetween(100, 999)} ${intBetween(1000, 9999)}`,
        pick(["tree removal", "hedge trimming", "stump grinding", "crown reduction", "storm cleanup", "section clear"]),
        pick(["low", "medium", "high"]),
        i < 2 ? "new" : i < 12 ? pick(["new", "contacted", "qualified", "quoted"]) : pick(["contacted", "qualified", "quoted", "won", "lost"]),
        pick(LEAD_SOURCES),
        INVOICE_TAG,
        money(between(400, 6000)),
        created,
      ],
    );
    leadsCreated++;
  }

  await c.query("COMMIT");

  const kinds = (k: JobSpec["kind"]) => specs.filter((s) => s.kind === k).length;
  console.log(`  created ${jobsCreated} jobs (${kinds("completed")} completed, ${kinds("work_order")} work orders, ${kinds("quote")} pending quotes, ${kinds("unsuccessful")} lost, ${kinds("lead")} lead)`);
  console.log(`  created ${proposalsCreated} proposals, ${invoicesCreated} invoices, ${leadsCreated} leads, ${assignmentsCreated} crew assignments`);
  console.log(`  invoiced revenue ex-GST: 12 months $${Math.round(revenueExGst).toLocaleString("en-NZ")} · last 30 days $${Math.round(revenueLast30).toLocaleString("en-NZ")} (${completedLast30} jobs)`);
  console.log(`\n✅ Done. Log in as '${businessName}' and open /metrics.`);
  console.log(`   Re-run with SEED_WIPE=1 to reset and re-seed.\n`);
} catch (err) {
  await c.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exit(1);
} finally {
  c.release();
  await pool.end();
}
