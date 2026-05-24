#!/usr/bin/env tsx
// One-shot seed: 8 Day-1 "Getting started" help articles.
// Mirrors the content in SEED_HELP_CONTENT.md. Idempotent — re-running upserts on slug.
// Run from the DO Console against production DATABASE_URL, or locally against the dev
// Neon branch with `set -a && source .env && set +a && npx tsx scripts/seedHelpContent.ts`.

import { db } from "../server/db";
import { helpArticles } from "../shared/schema";

type Seed = {
  slug: string;
  title: string;
  sequenceOrder: number;
  bodyHtml: string;
};

const articles: Seed[] = [
  {
    slug: "welcome-to-inflow",
    title: "Welcome to Inflow — 2-minute tour",
    sequenceOrder: 1,
    bodyHtml: `
<p>Welcome. Inflow runs the day-to-day of your business — quotes, jobs, invoicing, staff, and safety — in one place.</p>
<p>This short tour shows you the main areas and where to start. Hit play above.</p>
<p>The rest of the Getting started checklist below walks you through setting up your business details, branding, pricing, and payouts. Once that's done you'll be ready to take your first job.</p>
`.trim(),
  },
  {
    slug: "set-up-your-business-details",
    title: "Set up your business details",
    sequenceOrder: 2,
    bodyHtml: `
<p>These details appear on every quote, invoice, and customer email you send, so it's worth getting them right up front.</p>
<h2>What to set</h2>
<p>Go to <strong>Settings → Company</strong> and fill in:</p>
<ul>
<li>Trading name (what customers see)</li>
<li>Legal entity name (if different — used on invoices)</li>
<li>NZBN (New Zealand Business Number) if registered</li>
<li>GST number if you're GST-registered</li>
<li>Business address</li>
<li>Main contact email and phone</li>
</ul>
<h2>Why it matters</h2>
<p>Invoices need your legal name and GST number to be valid for your customers' tax records. The contact details flow into automated emails so customers always know how to reach you.</p>
<p>You can come back and edit these any time — but every quote and invoice generated before the change keeps the old details.</p>
`.trim(),
  },
  {
    slug: "upload-your-logo",
    title: "Upload your logo and set brand colours",
    sequenceOrder: 3,
    bodyHtml: `
<p>Your logo and brand colour show up on quotes, invoices, the customer portal, and outbound emails. Setting them now means every customer touchpoint looks like you from day one.</p>
<h2>Logo</h2>
<p>Go to <strong>Settings → Company → Branding</strong> and upload your logo. A square or wide PNG with a transparent background works best — at least 400px on the longest side.</p>
<p>If you don't have a logo yet, that's fine. Your trading name displays in clean text until you upload one.</p>
<h2>Brand colour</h2>
<p>Pick the primary colour that matches your existing branding. It's used for buttons and accent elements in the customer-facing pages.</p>
<h2>Preview</h2>
<p>Open any draft quote after saving to see how your branding looks on the customer-facing PDF.</p>
`.trim(),
  },
  {
    slug: "configure-pricing-and-gst",
    title: "Configure default pricing and tax (GST)",
    sequenceOrder: 4,
    bodyHtml: `
<p>Inflow handles New Zealand GST automatically once you've told it whether you're registered.</p>
<h2>If you're GST-registered</h2>
<p>Go to <strong>Settings → Pricing</strong> and:</p>
<ul>
<li>Turn on <strong>GST registered</strong></li>
<li>Set GST rate to <strong>15%</strong> (the default)</li>
<li>Choose whether your prices are <strong>GST-inclusive</strong> or <strong>GST-exclusive</strong> by default</li>
</ul>
<p>Most tree and trade businesses quote GST-inclusive to consumers and GST-exclusive to commercial clients. Pick the one you use most often — you can override per quote.</p>
<h2>If you're not GST-registered</h2>
<p>Leave GST registered off. Inflow won't add GST lines and won't show a GST number on invoices.</p>
<h2>Currency</h2>
<p>Currency is fixed to NZD. If you operate cross-border, get in touch — that's not supported in v1.</p>
`.trim(),
  },
  {
    slug: "service-area-and-timezone",
    title: "Set your service area and timezone",
    sequenceOrder: 5,
    bodyHtml: `
<p>These two settings power scheduling, automated reminder timing, and which inbound leads you see first.</p>
<h2>Timezone</h2>
<p>Default is <strong>Pacific/Auckland</strong>. Leave it unless you operate outside NZ. Every booking, reminder, and report uses this timezone, so getting it wrong shifts everything by hours.</p>
<h2>Service area</h2>
<p>Go to <strong>Settings → Service Area</strong> and add the regions you cover (e.g. Auckland, Waikato, Bay of Plenty). You can be as broad or as specific as you like.</p>
<p>Inbound web leads are tagged with the customer's suburb so you can quickly spot which jobs are in or out of your patch.</p>
<h2>Why it matters</h2>
<p>SMS reminders default to send between 7am and 8pm in your timezone — set this wrong and customers get pinged at 3am. The service area also drives the suggested travel time in scheduling.</p>
`.trim(),
  },
  {
    slug: "connect-your-bank-details",
    title: "Connect your bank details for payouts",
    sequenceOrder: 6,
    bodyHtml: `
<p>So customers can pay you, your bank details need to appear on every invoice.</p>
<h2>Add your account</h2>
<p>Go to <strong>Settings → Payments</strong> and add:</p>
<ul>
<li>Bank account name (the name on the account)</li>
<li>Bank account number (NN-NNNN-NNNNNNN-NN)</li>
<li>Reference text customers should use (your invoice number is set automatically — most owners just leave this)</li>
</ul>
<p>These details print on the bottom of every invoice PDF and are included in the "view invoice" page customers see in their inbox.</p>
<h2>Online payment (optional)</h2>
<p>If you'd like customers to pay by card, enable a payment processor in the same screen. This is optional — most NZ trade businesses still take payment by direct credit.</p>
<h2>Test it</h2>
<p>Send a $1 test invoice to yourself and check the bank details print correctly on the PDF before you send a real one.</p>
`.trim(),
  },
  {
    slug: "enable-email-notifications",
    title: "Enable email notifications",
    sequenceOrder: 7,
    bodyHtml: `
<p>Notifications keep both you and your customers in the loop without you having to manually email anyone.</p>
<h2>What gets sent</h2>
<p>Out of the box, Inflow sends:</p>
<ul>
<li>Quote sent → customer</li>
<li>Quote accepted → you</li>
<li>Booking confirmed → customer (with date/time + your contact details)</li>
<li>Reminder the day before → customer</li>
<li>Invoice sent → customer</li>
<li>Invoice paid → you</li>
</ul>
<h2>Turn things on or off</h2>
<p>Go to <strong>Settings → Notifications</strong>. Each event can be toggled independently and you can customise the text of any template.</p>
<h2>Who receives owner notifications</h2>
<p>By default, the email address you set in Step 2 (business details). To send to multiple addresses or to your office manager, add them as a CC in the same screen.</p>
<h2>Test</h2>
<p>Send yourself a test quote so you see exactly what your customer sees. Adjust the templates until the tone matches your voice.</p>
`.trim(),
  },
  {
    slug: "youre-ready-whats-next",
    title: "You're ready — what's next",
    sequenceOrder: 8,
    bodyHtml: `
<p>That's the core setup done. Your business details, branding, pricing, service area, payouts, and notifications are all in place.</p>
<h2>Next: build your team</h2>
<p>Head to <strong>Staff &amp; Permissions</strong> to invite your crew, assign roles (admin, office, field), and lock down what each role can see. That's the next help sequence — coming soon.</p>
<h2>Try the full workflow</h2>
<p>The fastest way to learn Inflow is to run a real job through it:</p>
<ol>
<li>Create a test customer</li>
<li>Build them a quote</li>
<li>Convert it to a job</li>
<li>Mark it complete</li>
<li>Send the invoice</li>
</ol>
<p>You'll discover what suits your workflow and where you want to tweak templates.</p>
<h2>Stuck?</h2>
<p>Browse the <strong>Reference</strong> section below by topic. If you can't find what you need, email support and we'll help — and add a help article so the next person doesn't get stuck on the same thing.</p>
`.trim(),
  },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`Seeding ${articles.length} help articles${dryRun ? " (dry run — no writes)" : ""}…`);

  for (const a of articles) {
    if (dryRun) {
      console.log(`  • [${a.sequenceOrder}] ${a.slug} — ${a.bodyHtml.length} chars of HTML`);
      continue;
    }
    const [row] = await db
      .insert(helpArticles)
      .values({
        slug: a.slug,
        title: a.title,
        category: "Getting started",
        bodyHtml: a.bodyHtml,
        sequenceOrder: a.sequenceOrder,
        relatedVideoIds: null,
        published: true,
      })
      .onConflictDoUpdate({
        target: helpArticles.slug,
        set: {
          title: a.title,
          category: "Getting started",
          bodyHtml: a.bodyHtml,
          sequenceOrder: a.sequenceOrder,
          published: true,
          updatedAt: new Date(),
        },
      })
      .returning({ id: helpArticles.id, slug: helpArticles.slug });
    console.log(`  ✓ [${a.sequenceOrder}] ${row.slug} (${row.id})`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .then(() => process.exit(0));
