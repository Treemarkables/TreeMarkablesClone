#!/usr/bin/env node
/**
 * Create the new Inflow subscription Prices in Stripe ($85 Crew / $130 Business, NZD/mo).
 *
 * WHY THIS SCRIPT EXISTS: Stripe Price objects are IMMUTABLE — you can't edit the amount
 * of the existing $89/$189 prices. Re-pricing means creating NEW Price objects on the same
 * Products, then pointing subscription_plans.stripe_price_id at them.
 *
 * Targets whatever account STRIPE_SECRET_KEY belongs to (same key the app uses), so run it
 * with the app's production env loaded. SAFE TO RE-RUN: it uses lookup_keys, so a second run
 * finds the existing price instead of creating a duplicate.
 *
 * Usage:
 *   node scripts/createInflowStripePrices.mjs            # dry run — prints what it WOULD do
 *   node scripts/createInflowStripePrices.mjs --commit    # actually create the prices
 *   node scripts/createInflowStripePrices.mjs --commit --write-db      # ALSO write the new IDs into the DB
 *   node scripts/createInflowStripePrices.mjs --commit --archive-old   # also deactivate the old prices
 *
 * After --commit it prints the new price IDs and the exact UPDATE SQL to swap them in.
 * With --write-db it runs those UPDATEs against DATABASE_URL itself (prints the host first —
 * make sure it's your PROD database, the same branch you edit in the Neon console).
 */

const COMMIT = process.argv.includes('--commit');
const ARCHIVE_OLD = process.argv.includes('--archive-old');
const WRITE_DB = process.argv.includes('--write-db');

// New pricing (2026-06-22). amount in NZD cents. oldPriceId = the existing price to read the
// Product from (and optionally archive). lookupKey makes the script idempotent.
const PLANS = [
  { key: 'crew',     name: 'Inflow Crew',     amountCents: 8500,  oldPriceId: 'price_1Tf0Z6LboGXT31TYwrPjNonb', lookupKey: 'inflow_crew_monthly_85' },
  { key: 'business', name: 'Inflow Business', amountCents: 13000, oldPriceId: 'price_1Tf0Z7LboGXT31TYR2GirPLw', lookupKey: 'inflow_business_monthly_130' },
];

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('✗ STRIPE_SECRET_KEY not set. Load the app env first (e.g. `set -a && source .env && set +a`).');
  process.exit(1);
}

const mod = await import('stripe');
const Stripe = mod.default || mod;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });

const keyMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST';
console.log(`\nStripe mode: ${keyMode}   |   ${COMMIT ? 'COMMIT (will create prices)' : 'DRY RUN (no changes)'}\n`);

const results = [];

for (const plan of PLANS) {
  // Idempotency: already created on a previous run?
  const existing = await stripe.prices.list({ lookup_keys: [plan.lookupKey], active: true, limit: 1 });
  if (existing.data.length) {
    const p = existing.data[0];
    console.log(`• ${plan.key}: already exists → ${p.id} ($${(p.unit_amount / 100).toFixed(2)} ${p.currency.toUpperCase()})`);
    results.push({ ...plan, newPriceId: p.id });
    continue;
  }

  // Resolve the Product from the old price so the new price lands on the same product.
  let productId = null;
  try {
    const oldPrice = await stripe.prices.retrieve(plan.oldPriceId);
    productId = typeof oldPrice.product === 'string' ? oldPrice.product : oldPrice.product?.id;
    console.log(`• ${plan.key}: old price ${plan.oldPriceId} → product ${productId}`);
  } catch (e) {
    console.log(`• ${plan.key}: old price ${plan.oldPriceId} not found (${e.message}) → will create a new Product "${plan.name}"`);
  }

  if (!COMMIT) {
    console.log(`    would create: $${(plan.amountCents / 100).toFixed(2)} NZD/mo  (lookup_key=${plan.lookupKey})${productId ? '' : `, new product "${plan.name}"`}\n`);
    results.push({ ...plan, newPriceId: '(dry-run)' });
    continue;
  }

  if (!productId) {
    const product = await stripe.products.create({ name: plan.name, metadata: { planKey: plan.key } });
    productId = product.id;
    console.log(`    created product ${productId}`);
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: 'nzd',
    unit_amount: plan.amountCents,
    recurring: { interval: 'month' },
    lookup_key: plan.lookupKey,
    metadata: { planKey: plan.key, source: 'createInflowStripePrices 2026-06-22' },
  });
  console.log(`    ✓ created price ${price.id}  ($${(plan.amountCents / 100).toFixed(2)} NZD/mo)`);
  results.push({ ...plan, newPriceId: price.id });

  if (ARCHIVE_OLD) {
    try {
      await stripe.prices.update(plan.oldPriceId, { active: false });
      console.log(`    ✓ archived old price ${plan.oldPriceId}`);
    } catch (e) {
      console.log(`    ! could not archive ${plan.oldPriceId}: ${e.message}`);
    }
  }
}

console.log('\n— Point the DB at the new prices —\n');
for (const r of results) {
  console.log(`UPDATE subscription_plans SET stripe_price_id = '${r.newPriceId}' WHERE key = '${r.key}';`);
}
console.log('');

const realIds = results.filter((r) => r.newPriceId && r.newPriceId.startsWith('price_'));

if (!COMMIT) {
  console.log('(dry run — re-run with --commit to actually create the prices)\n');
} else if (WRITE_DB) {
  if (!process.env.DATABASE_URL) {
    console.error('✗ --write-db given but DATABASE_URL is not set. Run the two UPDATEs above manually instead.');
    process.exit(1);
  }
  let host = '(unparseable)';
  try { host = new URL(process.env.DATABASE_URL).hostname; } catch {}
  console.log(`→ Writing new price IDs to DATABASE_URL host: ${host}`);
  console.log('  ⚠️  This MUST be your PROD database — the same branch you edit in the Neon console.\n');
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  for (const r of realIds) {
    await sql`UPDATE subscription_plans SET stripe_price_id = ${r.newPriceId} WHERE key = ${r.key}`;
    console.log(`  ✓ ${r.key} → ${r.newPriceId}`);
  }
  const rows = await sql`SELECT key, stripe_price_id, price_nzd FROM subscription_plans WHERE key IN ('crew','business') ORDER BY key`;
  console.log('\n  Current rows:');
  for (const row of rows) console.log(`    ${row.key}: ${row.stripe_price_id}  ($${row.price_nzd})`);
  console.log('');
} else {
  console.log('(prices created — paste the two UPDATEs above into the Neon SQL editor, or re-run with --write-db to apply them automatically)\n');
}
