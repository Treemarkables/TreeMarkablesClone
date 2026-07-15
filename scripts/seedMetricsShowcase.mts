/**
 * Metrics-showcase seeder — populate a TEST tenant's Metrics dashboard with
 * realistic, fully fictional data so it can be screenshotted without exposing
 * a real business's records.
 *
 * What it creates (all stamped with the target tenant's business_id):
 *   - ~16 fictional customers (a few repeat customers so retention % shows)
 *   - ~50 jobs spread over the last 6 months: completed+invoiced, upcoming
 *     work orders (some today), pending quotes, unsuccessful quotes, leads
 *   - a sent proposal for every quoted job (accepted / pending / lost mix)
 *   - invoices (mostly paid, a few pending) with ex-GST line items
 *   - a handful of `leads` rows (some created today, for Today metrics)
 *   - today-anchored rows: a job completed+invoiced today, quotes sent today,
 *     work orders scheduled today — so the "Today" tiles aren't zero
 *
 * Safety design:
 *   - refuses to run without SEED_CONFIRM=yes
 *   - target tenant is looked up BY NAME (SEED_BUSINESS_NAME) at runtime —
 *     ids differ between the Neon dev branch and prod, names don't
 *   - hard-refuses the Treemarkables tenant (name match + both known ids)
 *   - every row is tagged (import_source / notes / template_used =
 *     'demo_seed' markers) so SEED_WIPE=1 can cleanly remove a previous run
 *     before re-seeding
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
const rand = mulberry32(20260716);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));

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
const nzTodayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(now); // YYYY-MM-DD
const nzMidnight = new Date(new Date(`${nzTodayStr}T00:00:00Z`).getTime() - nzOffsetMs(now));
const atNZ = (dayOffset: number, hour: number) =>
  new Date(nzMidnight.getTime() + dayOffset * DAY + hour * 3600e3 + intBetween(0, 59) * 60e3);
const daysAgo = (d: number, hour = 9) => atNZ(-d, hour);
const daysAhead = (d: number, hour = 8) => atNZ(d, hour);
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
];

const LEAD_SOURCES = ["google", "referral", "website", "facebook", "phone", "word_of_mouth"];
const UNSUCCESSFUL_REASONS = ["price_too_high", "went_competitor", "changed_mind", "scheduling", "no_longer_needed"];

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

  await c.query("BEGIN");

  if (process.env.SEED_WIPE === "1") {
    // Delete in FK order: invoices/proposals → jobs → leads → customers.
    const del = async (label: string, sql: string) => {
      const r = await c.query(sql, [bizId]);
      console.log(`  wiped ${r.rowCount} ${label}`);
    };
    console.log("SEED_WIPE=1 — removing previous demo-seed rows…");
    await del("invoices", `DELETE FROM invoices WHERE business_id = $1 AND notes = '${INVOICE_TAG}'`);
    await del("proposals", `DELETE FROM proposals WHERE business_id = $1 AND template_used = '${TAG}'`);
    await del("jobs", `DELETE FROM jobs WHERE business_id = $1 AND import_source = '${TAG}'`);
    await del("leads", `DELETE FROM leads WHERE business_id = $1 AND notes = '${INVOICE_TAG}'`);
    await del("customers", `DELETE FROM customers WHERE business_id = $1 AND import_source = '${TAG}'`);
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
    const r = await c.query(
      `INSERT INTO customers (business_id, name, email, phone, address, source, import_source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, '${TAG}', $7, $7) RETURNING id`,
      [
        bizId,
        cust.name,
        `${slug}@example.co.nz`,
        `02${intBetween(1, 9)} ${intBetween(100, 999)} ${intBetween(1000, 9999)}`,
        cust.address,
        cust.source,
        daysAgo(intBetween(150, 200) - i * 3),
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

  let proposalSeq = 100;
  let jobsCreated = 0;
  let proposalsCreated = 0;
  let invoicesCreated = 0;
  let revenueExGst = 0;

  type JobSpec = {
    kind: "completed" | "work_order" | "quote" | "unsuccessful" | "lead";
    quoteCreatedDaysAgo: number; // when the job/quote was created
    scheduleOffsetDays?: number; // relative to now; negative = past (completed), positive = upcoming
    invoiceStatus?: "paid" | "pending";
  };

  const specs: JobSpec[] = [];
  // 30 completed+invoiced spread over ~6 months. The most recent completes
  // TODAY; the next four complete within the last fortnight so weekly views
  // have activity, and a couple of those invoices stay 'pending' so the
  // outstanding/AR side of the dashboard isn't empty.
  for (let i = 0; i < 30; i++) {
    const done = i === 0 ? 0 : i <= 4 ? intBetween(2, 12) : intBetween(2, 175);
    specs.push({
      kind: "completed",
      quoteCreatedDaysAgo: done + intBetween(7, 21),
      scheduleOffsetDays: -done,
      invoiceStatus: i !== 0 && done < 14 && i % 2 === 1 ? "pending" : "paid",
    });
  }
  // 6 accepted work orders, upcoming; two of them scheduled today.
  for (let i = 0; i < 6; i++) {
    specs.push({
      kind: "work_order",
      quoteCreatedDaysAgo: intBetween(5, 25),
      scheduleOffsetDays: i < 2 ? 0 : intBetween(1, 14),
    });
  }
  // 6 pending quotes (proposal sent, no answer yet); one sent today.
  for (let i = 0; i < 6; i++) {
    specs.push({ kind: "quote", quoteCreatedDaysAgo: i === 0 ? 0 : intBetween(1, 21) });
  }
  // 6 lost quotes.
  for (let i = 0; i < 6; i++) {
    specs.push({ kind: "unsuccessful", quoteCreatedDaysAgo: intBetween(10, 160) });
  }
  // 2 raw leads (job cards still at 'lead').
  for (let i = 0; i < 2; i++) {
    specs.push({ kind: "lead", quoteCreatedDaysAgo: i === 0 ? 0 : intBetween(1, 5) });
  }

  for (const spec of specs) {
    const t = pick(JOB_TITLES);
    const customerId = weightedCustomer();
    const custRow = CUSTOMERS[customerIds.indexOf(customerId)];
    const jobNumber = String(nextJobNumber++);
    const createdAt = daysAgo(spec.quoteCreatedDaysAgo, intBetween(8, 16));

    const subtotal = Math.round(between(t.lo, t.hi) / 5) * 5; // ex-GST
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

    const scheduledDate =
      spec.scheduleOffsetDays === undefined ? null
      : spec.scheduleOffsetDays <= 0 ? daysAgo(-spec.scheduleOffsetDays, 8)
      : daysAhead(spec.scheduleOffsetDays, 8);
    const completedDate = spec.kind === "completed" ? daysAgo(-spec.scheduleOffsetDays!, 15) : null;
    const workOrderAt =
      spec.kind === "completed" || spec.kind === "work_order"
        ? new Date(sentDate.getTime() + intBetween(1, 4) * DAY)
        : null;

    // Costs (job-level fields only — line-item totalCost stays 0 so revenue-stats
    // doesn't double count). Target a 35–60% gross margin.
    const isDone = spec.kind === "completed";
    const costRatio = between(0.4, 0.65);
    const laborCosts = isDone ? subtotal * costRatio * 0.6 : 0;
    const materialsCosts = isDone ? subtotal * costRatio * 0.15 : 0;
    const disposalCosts = isDone ? subtotal * costRatio * 0.15 : 0;
    const travelCosts = isDone ? subtotal * costRatio * 0.1 : 0;

    const estHours = intBetween(t.hours[0], t.hours[1]);
    const actHours = isDone ? Math.max(1, Math.round(estHours * between(0.85, 1.25))) : null;
    const accuracy = actHours ? Math.max(0, (1 - Math.abs(estHours - actHours) / estHours) * 100) : null;

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
         address, status, created_at, updated_at, scheduled_date, completed_date, work_order_at,
         quote_presentation_method, quote_presented_date, proposal_sent, proposal_sent_date,
         total_amount, subtotal, gst_amount, total_including_gst,
         labor_costs, materials_costs, disposal_costs, travel_costs,
         estimated_man_hours, actual_man_hours, estimation_accuracy, estimation_variance,
         metrics_eligible, line_items, checklist, equipment_checklist, proposal_sections,
         unsuccessful_reason, unsuccessful_date
       ) VALUES (
         $1, $2, $3, $4, $5, $6, '${TAG}',
         $7, $8, $9, $9, $10, $11, $12,
         $13, $14, $15, $16,
         $17, $18, $19, $20,
         $21, $22, $23, $24,
         $25, $26, $27, $28,
         true, $29, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
         $30, $31
       ) RETURNING id`,
      [
        bizId, customerId, jobNumber, t.title,
        `Fictional demo job seeded for dashboard screenshots.`,
        pick(LEAD_SOURCES),
        custRow?.address ?? "Address not specified",
        status, createdAt, scheduledDate, completedDate, workOrderAt,
        spec.kind === "lead" ? null : presentationMethod,
        spec.kind === "lead" ? null : (presentationMethod === "on_site" ? sentDate : null),
        spec.kind !== "lead",
        spec.kind === "lead" ? null : sentDate,
        money(totalIncGst), money(subtotal), money(gstAmount), money(totalIncGst),
        money(laborCosts), money(materialsCosts), money(disposalCosts), money(travelCosts),
        estHours, actHours, accuracy === null ? null : money(accuracy),
        actHours === null ? null : actHours - estHours,
        JSON.stringify(lineItems),
        spec.kind === "unsuccessful" ? pick(UNSUCCESSFUL_REASONS) : null,
        spec.kind === "unsuccessful" ? new Date(sentDate.getTime() + intBetween(3, 10) * DAY) : null,
      ],
    );
    const jobId = jobRes.rows[0].id;
    jobsCreated++;

    // Proposal for every quoted job (everything except raw leads).
    if (spec.kind !== "lead") {
      const accepted = spec.kind === "completed" || spec.kind === "work_order";
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
          `CR-${jobNumber}`,
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

    // Invoice for completed jobs.
    if (spec.kind === "completed" && completedDate) {
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
          money(totalIncGst),
          paid ? "paid" : "pending",
          JSON.stringify([{ description: t.title, quantity: 1, rate: subtotal, amount: subtotal }]),
          INVOICE_TAG,
          paid ? new Date(Math.min(now.getTime(), cappedIssue.getTime() + intBetween(2, 18) * DAY)) : null,
        ],
      );
      invoicesCreated++;
      revenueExGst += subtotal;
    }
  }

  // ── Leads table (Today tile + lead metrics + conversion rate) ─────────────
  // ~40 leads over the same 6 months keeps the conversion-rate tile plausible
  // (completed jobs ÷ leads) instead of >100%.
  const firstNames = ["Rachel", "Hemi", "Sue", "Alan", "Megan", "Carl", "Tina", "Oliver", "Beth", "Nikau", "Paul", "Wendy", "Josh", "Kiri", "Stan", "Donna", "Marcus", "Ellie", "Rewi", "Claire"];
  const lastNames = ["Donovan", "Walker", "Pritchard", "Briggs", "Foster", "Jensen", "Rawiri", "Grey", "Holmes", "Parata", "Simmons", "Clarke", "Tibble", "Nash", "Owens", "Field", "Hayes", "Morton", "Keane", "Lamb"];
  const leadNames = Array.from({ length: 40 }, (_, i) => `${firstNames[i % 20]} ${lastNames[(i * 7 + 3) % 20]}`);
  let leadsCreated = 0;
  for (const [i, name] of leadNames.entries()) {
    const created = i < 2 ? daysAgo(0, 8 + i) : daysAgo(intBetween(1, 178), intBetween(8, 17));
    await c.query(
      `INSERT INTO leads (business_id, name, phone, service_requested, urgency, status, source, notes, estimated_value, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
      [
        bizId, name,
        `02${intBetween(1, 9)} ${intBetween(100, 999)} ${intBetween(1000, 9999)}`,
        pick(["tree removal", "hedge trimming", "stump grinding", "crown reduction", "storm cleanup"]),
        pick(["low", "medium", "high"]),
        i < 2 ? "new" : pick(["contacted", "qualified", "quoted", "won", "lost"]),
        pick(LEAD_SOURCES),
        INVOICE_TAG,
        money(between(400, 6000)),
        created,
      ],
    );
    leadsCreated++;
  }

  await c.query("COMMIT");

  console.log(`  created ${jobsCreated} jobs (${specs.filter((s) => s.kind === "completed").length} completed, 6 work orders, 6 pending quotes, 6 lost, 2 lead)`);
  console.log(`  created ${proposalsCreated} proposals, ${invoicesCreated} invoices, ${leadsCreated} leads`);
  console.log(`  total invoiced revenue (ex-GST): $${revenueExGst.toLocaleString("en-NZ")}`);
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
