// READ-ONLY diagnostic for the "Squeak" job data-loss report.
// Runs only SELECT statements. Safe to run against production.
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const term = process.argv[2] || "squeak";
const like = `%${term}%`;

console.log(`\n=== Customers matching "${term}" ===`);
const custs = await sql`
  SELECT id, name, email, phone, created_at
  FROM customers
  WHERE lower(coalesce(name,'')) LIKE lower(${like})
     OR lower(coalesce(email,'')) LIKE lower(${like})
  ORDER BY created_at DESC LIMIT 10`;
console.table(custs);

const custIds = custs.map(c => c.id);

console.log(`\n=== Jobs matching "${term}" OR belonging to matched customer ===`);
const jobs = await sql`
  SELECT id, title, status, customer_id,
         length(coalesce(description,'')) AS desc_len,
         length(coalesce(proposal_title,'')) AS prop_title_len,
         jsonb_array_length(proposal_sections) AS prop_sections_count,
         jsonb_array_length(line_items) AS line_items_count,
         created_at, updated_at
  FROM jobs
  WHERE lower(coalesce(title,'')) LIKE lower(${like})
     OR lower(coalesce(description,'')) LIKE lower(${like})
     OR lower(coalesce(notes,'')) LIKE lower(${like})
     OR lower(coalesce(internal_notes,'')) LIKE lower(${like})
     OR lower(coalesce(address,'')) LIKE lower(${like})
     OR (${custIds.length} > 0 AND customer_id = ANY(${custIds}))
  ORDER BY updated_at DESC
  LIMIT 30`;
console.table(jobs);

// Lookup any QUOTES for the matched customers/jobs
if (custIds.length > 0) {
  console.log(`\n=== Quotes for matched customers ===`);
  const quotes = await sql`
    SELECT id, quote_number, job_id, customer_id, status, amount,
           length(coalesce(description,'')) AS desc_len,
           (line_items IS NOT NULL) AS has_line_items,
           sent_date, response_date, created_at, updated_at
    FROM quotes WHERE customer_id = ANY(${custIds})
    ORDER BY updated_at DESC LIMIT 30`;
  console.table(quotes);

  console.log(`\n=== Proposals for matched customers (any job) ===`);
  const allProps = await sql`
    SELECT id, proposal_number, job_id, customer_id, status, title,
           sent_date, viewed_date, response_date, created_at, updated_at
    FROM proposals WHERE customer_id = ANY(${custIds})
    ORDER BY updated_at DESC LIMIT 30`;
  console.table(allProps);

  console.log(`\n=== Conversations for matched customers ===`);
  const convs = await sql`
    SELECT id, title, status, source, customer_id, lead_id, created_at, updated_at
    FROM conversations WHERE customer_id = ANY(${custIds})
    ORDER BY updated_at DESC LIMIT 30`;
  console.table(convs);
}

// Per-job deep dive
for (const j of jobs) {
  console.log(`\n--- Job ${j.id} ("${j.title}") deep dive ---`);
  const full = await sql`
    SELECT description, proposal_title, proposal_sections, line_items,
           customer_id, address, internal_notes,
           created_at, updated_at
    FROM jobs WHERE id = ${j.id}`;
  const row = full[0];
  console.log("description (first 200):", JSON.stringify((row.description || "").slice(0, 200)));
  console.log("proposal_title:", JSON.stringify(row.proposal_title));
  console.log("proposal_sections count:", Array.isArray(row.proposal_sections) ? row.proposal_sections.length : "(not array)");
  console.log("line_items count:", Array.isArray(row.line_items) ? row.line_items.length : "(not array)");
  console.log("customer_id:", row.customer_id);
  console.log("address:", row.address);
  console.log("created_at:", row.created_at, "updated_at:", row.updated_at);

  const diary = await sql`
    SELECT id, entry_type, title, length(coalesce(description,'')) AS desc_len, author_name, created_at, updated_at
    FROM job_diary_entries WHERE job_id = ${j.id}
    ORDER BY created_at DESC LIMIT 30`;
  console.log(`job_diary_entries: ${diary.length} (emails: ${diary.filter(d => d.entry_type === "email").length})`);
  if (diary.length) console.table(diary);

  const acts = await sql`
    SELECT id, type, direction, subject, created_at
    FROM activities WHERE job_id = ${j.id} ORDER BY created_at DESC LIMIT 30`;
  console.log(`activities (by job_id): ${acts.length}`);
  if (acts.length) console.table(acts);

  const jobProps = await sql`
    SELECT id, proposal_number, status, title, sent_date, viewed_date, response_date, created_at, updated_at
    FROM proposals WHERE job_id = ${j.id} ORDER BY updated_at DESC`;
  console.log(`proposals (by job_id): ${jobProps.length}`);
  if (jobProps.length) console.table(jobProps);

  const jobQuotes = await sql`
    SELECT id, quote_number, status, amount, sent_date, response_date, created_at, updated_at
    FROM quotes WHERE job_id = ${j.id} ORDER BY updated_at DESC`;
  console.log(`quotes (by job_id): ${jobQuotes.length}`);
  if (jobQuotes.length) console.table(jobQuotes);
}

// Email tracking — useful for "where did the May-21 email go"
console.log(`\n=== conversation_messages to/from randmnalder@outlook.com (last 50) ===`);
const msgs = await sql`
  SELECT id, conversation_id, type, direction, from_contact, to_contact, subject, length(coalesce(content,'')) AS body_len, created_at
  FROM conversation_messages
  WHERE lower(coalesce(to_contact,'')) LIKE '%randmnalder%'
     OR lower(coalesce(from_contact,'')) LIKE '%randmnalder%'
  ORDER BY created_at DESC LIMIT 50`;
console.table(msgs);

console.log(`\n=== email_events for randmnalder (last 30) ===`);
const evts = await sql`
  SELECT id, message_id, event_type, recipient, timestamp, link_url
  FROM email_events
  WHERE lower(coalesce(recipient,'')) LIKE '%randmnalder%'
  ORDER BY timestamp DESC LIMIT 30`;
console.table(evts);

if (custIds.length > 0) {
  console.log(`\n=== pending_outbound_messages for matched customers ===`);
  const pend = await sql`
    SELECT id, job_id, customer_id, proposal_id, proposal_number, recipient_email, channel, status, sent_at, created_at
    FROM pending_outbound_messages
    WHERE customer_id = ANY(${custIds})
    ORDER BY created_at DESC LIMIT 30`;
  console.table(pend);
}

console.log("\n=== Done (read-only) ===");
