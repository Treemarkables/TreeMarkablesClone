/**
 * Recalculate jobs.paid_amount and jobs.balance_due from succeeded payments.
 *
 * Dry-run unless APPLY=1. Refuses to run when NODE_ENV=production.
 * Do not point DATABASE_URL at production. This change does not run the script.
 *
 * A second run writes nothing: paid and balance are set from the ledger, and
 * rows that already match are left alone. Jobs with no succeeded payment row
 * are not touched, so a paid amount entered by hand without a ledger row stays.
 *
 *   APPLY=1 npx tsx scripts/backfillJobPaidFromPayments.ts
 */

import { planPaidBackfill, type BackfillRow } from "../shared/jobPaidFromPayments.ts";

function redactDatabaseHost(raw: string | undefined): string {
  if (!raw) return "(no database host)";
  let hostname = "";
  try {
    hostname = new URL(raw).hostname;
  } catch {
    return "(unreadable database host)";
  }
  const [first, ...rest] = hostname.split(".");
  const short = first.length <= 6 ? `${first.slice(0, 2)}…` : `${first.slice(0, 4)}…${first.slice(-2)}`;
  return rest.length ? `${short}.${rest.join(".")}` : short;
}

function redactSecrets(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-url]");
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run: NODE_ENV is production.");
    process.exit(1);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Nothing was changed.");
    process.exit(1);
  }
  const apply = process.env.APPLY === "1";
  console.log(`Database host: ${redactDatabaseHost(databaseUrl)}`);
  console.log(apply ? "APPLY=1: writing paid amounts and balances." : "Dry run. Set APPLY=1 to write. Nothing will be changed.");

  interface PgClient {
    query: (text: string, values?: unknown[]) => Promise<{ rows: BackfillRow[] }>;
    release: () => void;
  }
  const imported = await import("pg");
  const pgNamespace = imported as {
    Pool?: new (config: object) => { connect: () => Promise<PgClient>; end: () => Promise<void> };
    default?: { Pool?: new (config: object) => { connect: () => Promise<PgClient>; end: () => Promise<void> } };
  };
  const Pool = pgNamespace.default?.Pool ?? pgNamespace.Pool;
  if (!Pool) throw new Error("Could not load the database driver.");
  const hostname = new URL(databaseUrl).hostname;
  const ssl = hostname === "localhost" || hostname === "127.0.0.1" ? undefined : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: databaseUrl, ssl, max: 1 });
  const client = await pool.connect();
  try {
    const selected = await client.query(`
      SELECT
        p.id AS "paymentId",
        p.job_id AS "paymentJobId",
        p.invoice_id AS "invoiceId",
        i.job_id AS "invoiceJobId",
        i.status AS "invoiceStatus",
        i.invoice_number AS "invoiceNumber",
        i.business_id AS "invoiceBusinessId",
        p.amount AS "amount",
        p.status AS "status",
        p.kind AS "kind",
        p.paid_at::text AS "paidAt",
        COALESCE(p.job_id, i.job_id) AS "jobId",
        j.business_id AS "jobBusinessId",
        j.job_number AS "jobNumber",
        j.total_amount AS "totalAmount",
        j.paid_amount AS "paidAmount",
        j.balance_due AS "balanceDue"
      FROM payments p
      LEFT JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN jobs j ON j.id = COALESCE(p.job_id, i.job_id)
      WHERE p.status = 'succeeded'
    `);
    const plan = planPaidBackfill(selected.rows);
    console.log(
      `Jobs to update: ${plan.jobs.length}. Unchanged: ${plan.unchangedJobs}. Invoices to mark paid: ${plan.invoices.length}. Payment job links: ${plan.paymentJobLinks.length}. Payments with no job: ${plan.skippedPayments}.`,
    );
    for (const job of plan.jobs) {
      console.log(
        `job ${job.jobNumber ?? job.jobId}: paid ${job.previousPaid} -> ${job.paidAmount}, balance ${job.previousBalance} -> ${job.balanceDue}`,
      );
    }
    for (const invoice of plan.invoices) {
      console.log(`invoice ${invoice.invoiceNumber ?? invoice.invoiceId}: mark paid`);
    }
    if (!apply) return;

    await client.query("BEGIN");
    try {
      for (const job of plan.jobs) {
        await client.query(
          `UPDATE jobs
           SET paid_amount = $2, balance_due = $3, updated_at = now()
           WHERE id = $1
             AND (paid_amount IS DISTINCT FROM $2::numeric OR balance_due IS DISTINCT FROM $3::numeric)`,
          [job.jobId, job.paidAmount, job.balanceDue],
        );
      }
      for (const invoice of plan.invoices) {
        await client.query(
          `UPDATE invoices
           SET status = 'paid',
               paid_at = COALESCE(paid_at, $2::timestamptz, now()),
               updated_at = now()
           WHERE id = $1
             AND (status IS NULL OR lower(status) NOT IN ('paid', 'cancelled', 'canceled', 'void', 'voided'))`,
          [invoice.invoiceId, invoice.paidAt],
        );
      }
      for (const link of plan.paymentJobLinks) {
        await client.query(
          `UPDATE payments SET job_id = $2 WHERE id = $1 AND job_id IS NULL`,
          [link.paymentId, link.jobId],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.log(`Wrote ${plan.jobs.length} jobs, ${plan.invoices.length} invoices, ${plan.paymentJobLinks.length} payment links.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Backfill failed";
  console.error(redactSecrets(message));
  process.exit(1);
});
