/**
 * Demo quote-inquiry seeder — drop a few realistic website quote inquiries into
 * a TEST tenant's Conversations inbox so the triage → "Create Job from Lead"
 * flow can be screen-recorded without touching a real tenant.
 *
 * What it creates (all stamped with the target tenant's business_id), matching
 * exactly what POST /api/contact writes for a real submission:
 *   - one open `conversations` row per inquiry (source web_form,
 *     tags contact-form/website, unread, last_message_by customer)
 *   - one inbound `conversation_messages` row with the standard
 *     "Contact Form Submission" body (the Create-Job convert flow parses this)
 *   - one `notifications` bell row per inquiry deep-linking to /conversation/:id
 *
 * Safety design (same as seedMetricsShowcase.mts):
 *   - refuses to run without SEED_CONFIRM=yes
 *   - target tenant looked up BY NAME (SEED_BUSINESS_NAME) — ids differ
 *     between the Neon dev branch and prod, names don't
 *   - hard-refuses the Treemarkables tenant (name match + both known ids)
 *   - every message/notification carries metadata.seed='demo_seed' so
 *     SEED_WIPE=1 cleanly removes a previous run before re-seeding
 *
 * Usage (DATABASE_URL = target branch; dev to test, prod via DO console):
 *   SEED_CONFIRM=yes SEED_BUSINESS_NAME='Cut right' npx tsx scripts/seedDemoInquiries.mts
 *   SEED_CONFIRM=yes SEED_BUSINESS_NAME='Cut right' SEED_WIPE=1 npx tsx scripts/seedDemoInquiries.mts
 */
// App's naive timestamp columns hold UTC wall times — force UTC so running
// from an NZ-localtime machine doesn't store NZ wall times (see
// seedMetricsShowcase.mts for the full explanation).
process.env.TZ = "UTC";

import pg from "pg";

const TAG = "demo_seed";
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

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();

// NZ-day-anchored timestamps, stored as the UTC instants the app expects.
function nzOffsetMs(d: Date): number {
  const tzName = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", timeZoneName: "shortOffset" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT+12";
  const m = tzName.match(/([+-]\d+)/);
  return (m ? parseInt(m[1], 10) : 12) * 3600 * 1000;
}
const nzTodayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(now); // YYYY-MM-DD
const nzMidnight = new Date(new Date(`${nzTodayStr}T00:00:00Z`).getTime() - nzOffsetMs(now));
const atNZ = (dayOffset: number, hour: number, minute: number) =>
  new Date(nzMidnight.getTime() + dayOffset * DAY + hour * 3600e3 + minute * 60e3);

// ── Fictional inquiries ──────────────────────────────────────────────────────
// Fresh names (no overlap with seedMetricsShowcase customers) so the
// contact-form dedupe/matching path treats each as a brand-new lead.

const INQUIRIES = [
  {
    name: "Rebecca Lawson",
    email: "rebecca.lawson82@gmail.com",
    phone: "0212447810",
    hearAbout: "Google",
    message:
      "Hi there, we have a large gum tree at the back of our section that's leaning over the garage and dropping big branches every time it's windy. We'd like a quote to have it removed, including taking away all the wood if possible. Happy for someone to come by and take a look — most weekdays after 3pm work for us. Thanks!",
    at: atNZ(0, 10, 47),
  },
  {
    name: "Mark Peterson",
    email: "mark.peterson.nz@outlook.com",
    phone: "0274881203",
    hearAbout: "Referral",
    message:
      "Kia ora, you were recommended by our neighbours the Hendersons. We've got three old plum trees and a big magnolia that need a decent prune and shape before summer, plus a hedge along the driveway that's getting out of hand. Could you give us a quote for the lot?",
    at: atNZ(0, 8, 12),
  },
  {
    name: "Aroha Williams",
    email: "aroha.williams@xtra.co.nz",
    phone: "0221904566",
    hearAbout: "Facebook",
    message:
      "Hello, the storm last week snapped a big branch on our oak tree and it's now hanging over the fence into the neighbour's yard, fairly close to the power lines on their side. Would love someone to come out this week if possible and quote on making it safe and tidying up the rest of the tree.",
    at: atNZ(-1, 16, 33),
  },
  {
    name: "Karen Bishop",
    email: "karen@bishopproperty.co.nz",
    phone: "0212786644",
    hearAbout: "Website",
    message:
      "Hi, I manage a small block of six townhouses on Matai Street and we're after an annual tree and hedge maintenance arrangement — there are around a dozen trees on the shared grounds plus boundary hedges. Could you quote for a yearly maintenance visit, and separately for an initial tidy-up? Invoicing would go to the body corporate.",
    at: atNZ(-2, 11, 5),
  },
];

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
    console.log("SEED_WIPE=1 — removing previous demo-seed inquiries…");
    const convIds = await c.query(
      `SELECT DISTINCT conversation_id FROM conversation_messages
       WHERE business_id = $1 AND metadata->>'seed' = $2`,
      [bizId, TAG],
    );
    const ids = convIds.rows.map((r) => r.conversation_id);
    const delNotif = await c.query(
      `DELETE FROM notifications WHERE business_id = $1 AND metadata->>'seed' = $2`,
      [bizId, TAG],
    );
    console.log(`  wiped ${delNotif.rowCount} notifications`);
    if (ids.length > 0) {
      // conversation_messages cascade-delete with their conversation
      const delConv = await c.query(
        `DELETE FROM conversations WHERE business_id = $1 AND id = ANY($2)`,
        [bizId, ids],
      );
      console.log(`  wiped ${delConv.rowCount} conversations (messages cascade)`);
    } else {
      console.log("  no previous demo-seed conversations found");
    }
  }

  for (const q of INQUIRIES) {
    // Title derivation matches POST /api/contact exactly.
    const title = q.message.trim().substring(0, 100) + (q.message.length > 100 ? "..." : "");
    const conv = await c.query(
      `INSERT INTO conversations
         (business_id, title, status, priority, source, tags,
          last_message_at, last_message_by, unread_count, is_active, created_at, updated_at)
       VALUES ($1, $2, 'open', 'medium', 'web_form', $3, $4, 'customer', 1, true, $4, $4)
       RETURNING id`,
      [bizId, title, ["contact-form", "website"], q.at],
    );
    const convId: string = conv.rows[0].id;

    const fullMessage = `Contact Form Submission\n\nName: ${q.name}\nEmail: ${q.email}\nPhone: ${q.phone}\nHow they heard about us: ${q.hearAbout}\n\nMessage:\n${q.message}`;
    await c.query(
      `INSERT INTO conversation_messages
         (business_id, conversation_id, type, content, direction,
          from_name, from_contact, platform, is_read, metadata, created_at, updated_at)
       VALUES ($1, $2, 'message', $3, 'inbound', $4, $5, 'web_form', false, $6, $7, $7)`,
      [bizId, convId, fullMessage, q.name, q.email.toLowerCase(), { seed: TAG }, q.at],
    );

    await c.query(
      `INSERT INTO notifications
         (business_id, title, message, type, priority, is_read, action_url, metadata, created_at)
       VALUES ($1, 'New website contact', $2, 'new_conversation', 'medium', false, $3, $4, $5)`,
      [bizId, title, `/conversation/${convId}`, { conversationId: convId, source: "web_form", seed: TAG }, q.at],
    );

    console.log(`  ✅ ${q.name} — /conversation/${convId}`);
  }

  await c.query("COMMIT");
  console.log(`\nDone — ${INQUIRIES.length} inquiries seeded into '${businessName}'.`);
} catch (err) {
  await c.query("ROLLBACK").catch(() => {});
  throw err;
} finally {
  c.release();
  await pool.end();
}
