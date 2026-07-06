#!/usr/bin/env tsx

/**
 * Demo data seed — fully fictional data for sales demos.
 *
 * This app is single-tenant: all data is global and shared across every
 * logged-in account. So demo data must live in a SEPARATE database, never
 * mixed with the live customer's records.
 *
 * Safety design (read before touching this file):
 *  - This script ignores DATABASE_URL entirely. It only writes to whatever
 *    DEMO_DATABASE_URL points at, so a stale prod DATABASE_URL in your shell
 *    can never be the target.
 *  - It refuses to run without DEMO_SEED_CONFIRM=yes.
 *  - DEMO_RESET=1 wipes existing demo data first (TRUNCATE ... CASCADE) so a
 *    demo can be reset to a clean slate between sessions.
 *
 * Usage:
 *   DEMO_DATABASE_URL='postgres://…demo-db…' DEMO_SEED_CONFIRM=yes tsx scripts/seed-demo.ts
 *   DEMO_DATABASE_URL='…' DEMO_SEED_CONFIRM=yes DEMO_RESET=1 tsx scripts/seed-demo.ts
 *
 * Demo login (created by this script):
 *   email:    demo@demo.inflowapp.co.nz   password: demo1234   (admin)
 */

import bcrypt from "bcrypt";

const DEMO_EMAIL_DOMAIN = "demo.inflowapp.co.nz";
const DEMO_PASSWORD = "demo1234";
const GST_RATE = 0.15;

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

async function main() {
  const demoUrl = process.env.DEMO_DATABASE_URL;
  if (!demoUrl) {
    fail(
      "DEMO_DATABASE_URL is not set.\n" +
        "   Point it at the demo database's connection string.\n" +
        "   This script intentionally does NOT read DATABASE_URL, so it can never\n" +
        "   seed production by accident.",
    );
  }
  if (process.env.DEMO_SEED_CONFIRM !== "yes") {
    fail("Refusing to run without DEMO_SEED_CONFIRM=yes (guards against accidental runs).");
  }

  let host = "(unparseable)";
  try {
    host = new URL(demoUrl).host;
  } catch {
    /* leave as unparseable */
  }

  // Force every DB access to the demo database. db.ts reads DATABASE_URL at
  // import time, so this assignment must happen BEFORE the dynamic imports below.
  process.env.DATABASE_URL = demoUrl;

  console.log(`\n🌱 Demo seed target host: ${host}`);

  // Dynamic imports so db.ts binds to the demo URL set above.
  const { db, pool } = await import("../server/db");
  const { storage } = await import("../server/storage");
  const { sql } = await import("drizzle-orm");

  try {
    if (process.env.DEMO_RESET === "1") {
      console.log("🧹 DEMO_RESET=1 — wiping existing demo data (TRUNCATE … CASCADE)…");
      await db.execute(
        sql`TRUNCATE TABLE customers, jobs, quotes, leads, calls, job_diary_entries RESTART IDENTITY CASCADE`,
      );
      await db.execute(
        sql`DELETE FROM employees WHERE email ILIKE ${"%@" + DEMO_EMAIL_DOMAIN}`,
      );
      console.log("   …done.");
    }

    // ── Employees (these are the demo logins) ──────────────────────────────
    console.log("👷 Creating demo staff…");
    const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);

    const admin = await storage.createEmployee({
      firstName: "Demo",
      lastName: "Admin",
      email: `demo@${DEMO_EMAIL_DOMAIN}`,
      phone: "+64 20 000 0001",
      password: hashed,
      position: "foreman",
      role: "admin",
      status: "active",
      skillLevel: "expert",
      certifications: ["ISA Certified Arborist"],
      hourlyRate: "45.00",
      chargeOutRate: "120.00",
    });

    await storage.createEmployee({
      firstName: "Sam",
      lastName: "Climber",
      email: `sam@${DEMO_EMAIL_DOMAIN}`,
      phone: "+64 20 000 0002",
      password: hashed,
      position: "arborist",
      role: "crew",
      status: "active",
      skillLevel: "expert",
      skills: ["climbing", "chainsaw"],
      hourlyRate: "38.00",
      chargeOutRate: "95.00",
    });

    await storage.createEmployee({
      firstName: "Alex",
      lastName: "Groundie",
      email: `alex@${DEMO_EMAIL_DOMAIN}`,
      phone: "+64 20 000 0003",
      password: hashed,
      position: "ground_crew",
      role: "crew",
      status: "active",
      skillLevel: "intermediate",
      skills: ["chipper", "ground_support"],
      hourlyRate: "30.00",
      chargeOutRate: "75.00",
    });

    // ── Customers (all fictional) ──────────────────────────────────────────
    console.log("🧑 Creating demo customers…");
    const customerSeeds = [
      {
        name: "Jordan Avery",
        email: "jordan.avery@example.com",
        phone: "+64 20 111 0001",
        address: "12 Rimu Lane",
        city: "Demo Heights",
        region: "Demoland",
        source: "google",
        tags: ["residential"],
      },
      {
        name: "Pat Sterling",
        email: "pat.sterling@example.com",
        phone: "+64 20 111 0002",
        address: "88 Kowhai Crescent",
        city: "Demo Heights",
        region: "Demoland",
        source: "referral",
        tags: ["residential", "repeat"],
      },
      {
        name: "Riverside Property Group",
        email: "maintenance@example.com",
        phone: "+64 20 111 0003",
        address: "5 Totara Terrace",
        city: "Demo City",
        region: "Demoland",
        source: "website",
        tags: ["commercial", "property-manager"],
      },
      {
        name: "Demo District Council",
        email: "parks@example.com",
        phone: "+64 20 111 0004",
        address: "1 Civic Square",
        city: "Demo City",
        region: "Demoland",
        source: "tender",
        tags: ["council", "contract"],
      },
      {
        name: "Casey Lin",
        email: "casey.lin@example.com",
        phone: "+64 20 111 0005",
        address: "27 Manuka Way",
        city: "Demo Bay",
        region: "Demoland",
        source: "facebook",
        tags: ["residential"],
      },
      {
        name: "Morgan Reid",
        email: "morgan.reid@example.com",
        phone: "+64 20 111 0006",
        address: "140 Pohutukawa Drive",
        city: "Demo Bay",
        region: "Demoland",
        source: "google",
        tags: ["residential"],
      },
    ];
    const customers = [];
    for (const c of customerSeeds) {
      customers.push(await storage.createCustomer(c));
    }
    const [jordan, pat, riverside, council, casey, morgan] = customers;

    // ── Helpers ────────────────────────────────────────────────────────────
    const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);
    const money = (n: number) => n.toFixed(2);
    const lineItem = (description: string, quantity: number, unitPrice: number) => ({
      id: crypto.randomUUID(),
      description,
      quantity,
      unitPrice,
      total: Number((quantity * unitPrice).toFixed(2)),
    });
    const totalsFor = (items: { total: number }[]) => {
      const subtotal = items.reduce((s, i) => s + i.total, 0);
      const gstAmount = Number((subtotal * GST_RATE).toFixed(2));
      const totalIncludingGst = Number((subtotal + gstAmount).toFixed(2));
      return {
        subtotal: money(subtotal),
        gstAmount: money(gstAmount),
        totalIncludingGst: money(totalIncludingGst),
        totalAmount: money(totalIncludingGst),
      };
    };

    // ── Jobs across the pipeline ─────────────────────────────────────────────
    console.log("🌳 Creating demo jobs across the pipeline…");

    const job1Items = [
      lineItem("Large gum tree removal incl. crane", 1, 3800),
      lineItem("Stump grinding", 1, 450),
      lineItem("Green-waste disposal", 1, 250),
    ];
    const completedJob = await storage.createJob({
      customerId: jordan.id,
      jobNumber: "DEMO-1001",
      title: "Large gum tree removal — Rimu Lane",
      description:
        "Sectional removal of a storm-damaged 22m gum overhanging the house. Crane-assisted, full site cleanup and stump grind.",
      address: "12 Rimu Lane, Demo Heights",
      city: "Demo Heights",
      region: "Demoland",
      status: "completed",
      priority: "high",
      leadSource: "google",
      scheduledDate: daysFromNow(-6),
      completedDate: daysFromNow(-6),
      assignedTeam: ["Sam Climber", "Alex Groundie"],
      lineItems: job1Items,
      ...totalsFor(job1Items),
      notes: "Customer thrilled with the cleanup. Asked for a quote on the back hedge.",
    });

    const job2Items = [
      lineItem("Crown reduction — 6 pohutukawa", 6, 280),
      lineItem("Traffic management", 1, 400),
    ];
    await storage.createJob({
      customerId: council.id,
      jobNumber: "DEMO-1002",
      title: "Pohutukawa crown reduction — Civic Square",
      description: "Annual maintenance pruning of the Civic Square pohutukawa avenue. Council contract work.",
      address: "1 Civic Square, Demo City",
      city: "Demo City",
      region: "Demoland",
      status: "scheduled",
      priority: "medium",
      leadSource: "tender",
      scheduledDate: daysFromNow(3),
      scheduledStartTime: "07:30",
      assignedTeam: ["Sam Climber", "Alex Groundie"],
      lineItems: job2Items,
      ...totalsFor(job2Items),
      permitRequired: true,
    });

    const job3Items = [
      lineItem("Hedge trimming — 30m boundary", 1, 620),
      lineItem("Chipper hire", 1, 180),
    ];
    await storage.createJob({
      customerId: riverside.id,
      jobNumber: "DEMO-1003",
      title: "Boundary hedge trim — Totara Terrace",
      description: "Quarterly hedge maintenance for managed rental property.",
      address: "5 Totara Terrace, Demo City",
      city: "Demo City",
      region: "Demoland",
      status: "work_order",
      priority: "medium",
      leadSource: "website",
      workOrderAt: daysFromNow(-1),
      assignedTeam: ["Alex Groundie"],
      lineItems: job3Items,
      ...totalsFor(job3Items),
    });

    const job4Items = [lineItem("Emergency limb removal", 1, 950)];
    await storage.createJob({
      customerId: casey.id,
      jobNumber: "DEMO-1004",
      title: "Storm limb removal — Manuka Way",
      description: "Fallen limb blocking the driveway after high winds. Same-day emergency callout.",
      address: "27 Manuka Way, Demo Bay",
      city: "Demo Bay",
      region: "Demoland",
      status: "quote",
      priority: "urgent",
      leadSource: "phone",
      lineItems: job4Items,
      ...totalsFor(job4Items),
    });

    const job5Items = [lineItem("Full tree health assessment + report", 1, 350)];
    await storage.createJob({
      customerId: morgan.id,
      jobNumber: "DEMO-1005",
      title: "Tree health assessment — Pohutukawa Drive",
      description: "Customer went with a cheaper competitor for the follow-up work.",
      address: "140 Pohutukawa Drive, Demo Bay",
      city: "Demo Bay",
      region: "Demoland",
      status: "unsuccessful",
      priority: "low",
      leadSource: "google",
      lineItems: job5Items,
      ...totalsFor(job5Items),
      unsuccessfulReason: "went_competitor",
      unsuccessfulNotes: "Quoted fairly but a competitor undercut on the remedial work.",
      unsuccessfulDate: daysFromNow(-2),
    });

    // ── Quotes ───────────────────────────────────────────────────────────────
    console.log("📄 Creating demo quotes…");
    await storage.createQuote({
      customerId: pat.id,
      quoteNumber: "DEMO-Q-2001",
      description: "Remove two leaning silver birches and grind stumps.",
      amount: "2150.00",
      status: "sent",
      sentDate: daysFromNow(-3),
      validUntil: daysFromNow(27),
      createdBy: `${admin.firstName} ${admin.lastName}`,
    });
    await storage.createQuote({
      customerId: jordan.id,
      jobId: completedJob.id,
      quoteNumber: "DEMO-Q-2002",
      description: "Back-hedge reshape and height reduction (follow-up from gum removal).",
      amount: "780.00",
      status: "accepted",
      sentDate: daysFromNow(-4),
      responseDate: daysFromNow(-3),
      createdBy: `${admin.firstName} ${admin.lastName}`,
    });
    await storage.createQuote({
      customerId: riverside.id,
      quoteNumber: "DEMO-Q-2003",
      description: "Annual grounds maintenance package — 4 visits.",
      amount: "4600.00",
      status: "draft",
      createdBy: `${admin.firstName} ${admin.lastName}`,
    });

    // ── Leads ─────────────────────────────────────────────────────────────────
    console.log("📥 Creating demo leads…");
    await storage.createPipelineLead({
      name: "Taylor Brooke",
      email: "taylor.brooke@example.com",
      phone: "+64 20 111 0007",
      address: "9 Kauri Close, Demo Bay",
      serviceRequested: "Tree removal",
      urgency: "medium",
      status: "new",
      source: "website",
      estimatedValue: "1800.00",
    });
    await storage.createLead?.({
      name: "Jamie Frost",
      email: "jamie.frost@example.com",
      phone: "+64 20 111 0008",
      address: "200 Beach Road, Demo Bay",
      serviceRequested: "Hedge trimming",
      urgency: "low",
      status: "contacted",
      source: "facebook",
      estimatedValue: "650.00",
      followUpDate: daysFromNow(2),
    });

    // ── Calls (phone numbers match customers so name resolution works) ─────────
    console.log("📞 Creating demo calls…");
    await storage.createCall({
      customerId: casey.id,
      phoneNumber: casey.phone!,
      direction: "inbound",
      status: "answered",
      duration: 184,
      summary: "Reported a fallen limb across the driveway after the storm. Booked an emergency callout.",
      intent: "emergency",
      sentiment: "neutral",
    });
    await storage.createCall({
      customerId: pat.id,
      phoneNumber: pat.phone!,
      direction: "outbound",
      status: "answered",
      duration: 96,
      summary: "Followed up on the silver birch quote. Customer is comparing options, will decide this week.",
      intent: "follow_up",
      sentiment: "positive",
    });

    // ── Diary entries on the completed job ─────────────────────────────────────
    console.log("📝 Creating demo job-diary entries…");
    await storage.createJobDiaryEntry({
      jobId: completedJob.id,
      entryType: "milestone",
      title: "On site",
      description: "Crew arrived, safety briefing done, crane positioned and exclusion zone set up.",
      authorName: "Sam Climber",
      authorRole: "arborist",
    });
    await storage.createJobDiaryEntry({
      jobId: completedJob.id,
      entryType: "completion",
      title: "Job complete",
      description: "Tree removed in sections, stump ground, all green waste chipped and removed. Customer walkthrough done.",
      authorName: "Sam Climber",
      authorRole: "arborist",
    });

    console.log("\n✅ Demo seed complete.");
    console.log("   Login:  demo@demo.inflowapp.co.nz  /  demo1234  (admin)");
    console.log(`   Created: ${customers.length} customers, 5 jobs, 3 quotes, 2 leads, 2 calls, 3 staff.`);
    console.log("   Re-run with DEMO_RESET=1 to wipe and reseed.\n");

    await pool.end();
  } catch (err) {
    console.error("\n💥 Demo seed failed:", err);
    await pool.end();
    process.exit(1);
  }
}

main();
