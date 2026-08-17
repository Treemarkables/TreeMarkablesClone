import { storage } from '../storage';
import { db, acquireTenantDb } from '../db';
import { emailService } from './emailService';
import * as notificationHelper from './notificationHelper';
import { getTwilioClient } from './twilioClient';
import { runWithBusiness } from '../tenancy/tenantStore';
import * as schema from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { APP_URL } from '../config/appUrl';

/**
 * Scheduled, self-contained health checks for the customer-facing pipeline.
 *
 * 1. Website quote forms (lead pipeline): writes a throwaway "conversation" under the
 *    Treemarkables tenant, then reads it back THROUGH an RLS-scoped connection
 *    (`acquireTenantDb`) to prove a new enquiry is both persisted AND visible in the
 *    owner's tenant-scoped Inbox. This is the exact failure mode that silently dropped
 *    website quotes in June 2026 — rows stamped with a wrong / null business_id were
 *    filtered out of the Inbox while the form still said "thank you". The sentinel row
 *    is deleted again each run. No customer is created (avoids a Mailchimp sync) and no
 *    job is created (job numbers come from an ever-advancing counter, so create+delete
 *    would leave permanent gaps customers can see).
 *
 * 2. Phone line (Twilio inbound): credentials valid, account active, and the inbound
 *    number's voice webhook still points at the answer handler that rings the app.
 *    Config-level check only (no real call placed).
 *
 * On any failure → email the owner + push admins. Alerts are state-transition based
 * with a periodic re-alert, so a sustained outage doesn't spam every cycle, and a
 * "recovered" note is sent when things go green again.
 */

const INTERVAL_MS = 15 * 60 * 1000; // run every 15 minutes
const INITIAL_DELAY_MS = 60 * 1000; // first run 60s after boot (catch broken deploys fast)
const REALERT_MS = 6 * 60 * 60 * 1000; // re-alert at most every 6h while still failing
const FALLBACK_OWNER_EMAIL = 'accounts@treemarkables.nz';
const VOICE_WEBHOOK_PATH = '/api/webhooks/twilio-answer';
const HEALTHCHECK_SOURCE = 'health_check';

type CheckResult = { name: string; ok: boolean; detail: string };

// In-memory alert state. Resets on deploy/restart — acceptable: a restart while still
// broken simply re-alerts on the next cycle, which is the safe direction.
let lastOverallHealthy: boolean | null = null;
let lastAlertAt = 0;

/** Lead pipeline: write a sentinel conversation under the tenant, confirm it's visible
 *  under RLS, then delete it. */
async function runLeadPipelineCheck(): Promise<CheckResult> {
  const name = 'Website quote forms (lead pipeline)';

  let businessId: string | undefined;
  try {
    businessId = (await storage.getBusinessSettings())?.businessId ?? undefined;
  } catch (e) {
    return { name, ok: false, detail: `could not load business settings: ${(e as Error).message}` };
  }
  if (!businessId) {
    return { name, ok: false, detail: 'getBusinessSettings() returned no businessId — cannot tenant-scope the check' };
  }

  // Self-heal: clear any sentinel rows left behind by a crashed prior run.
  try {
    await db.delete(schema.conversations).where(eq(schema.conversations.source, HEALTHCHECK_SOURCE));
  } catch {
    /* best effort */
  }

  let conversationId: string | undefined;
  try {
    await runWithBusiness(businessId, async () => {
      const conv = await storage.createConversation({
        title: 'Pipeline health check (automated — safe to delete)',
        status: 'open',
        priority: 'low',
        source: HEALTHCHECK_SOURCE,
        tags: ['__healthcheck__'],
      });
      conversationId = conv.id;
    });

    if (!conversationId) {
      return { name, ok: false, detail: 'conversation write returned no id' };
    }

    const visible = await verifyVisibleUnderTenant(businessId, conversationId);
    return { name, ok: visible.ok, detail: visible.detail };
  } catch (e) {
    return { name, ok: false, detail: `write/verify failed: ${(e as Error).message}` };
  } finally {
    if (conversationId) {
      try {
        await storage.deleteConversation(conversationId);
      } catch {
        /* cleared by the self-heal delete on the next run */
      }
    }
  }
}

/** Read the row back through an RLS-scoped tenant connection — the read path the Inbox
 *  uses. If RLS is off (local dev) fall back to an owner read so the check still runs. */
async function verifyVisibleUnderTenant(
  businessId: string,
  conversationId: string,
): Promise<{ ok: boolean; detail: string }> {
  let conn: Awaited<ReturnType<typeof acquireTenantDb>> | undefined;
  try {
    conn = await acquireTenantDb(businessId);
  } catch {
    // RLS disabled (e.g. local dev) — no tenant pool. Confirm persistence via owner read.
    const [row] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId));
    return row
      ? { ok: true, detail: 'lead pipeline ok (written; RLS off, owner read)' }
      : { ok: false, detail: 'lead written but not found on read-back' };
  }

  try {
    const rows = await conn!.tenantDb
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId));
    if (rows.length === 0) {
      return {
        ok: false,
        detail:
          `lead was written but is NOT visible under tenant RLS (businessId=${businessId}) — ` +
          'new website enquiries would not appear in the Inbox',
      };
    }
    return { ok: true, detail: 'lead pipeline ok (written + visible under tenant RLS)' };
  } finally {
    await conn!.release();
  }
}

/** Customer document links: prove the newest proposal is reachable ANONYMOUSLY
 *  through the public URL — the exact path a customer follows from an SMS/email
 *  link. Round-trips the whole chain (DNS/Cloudflare → DO → tenantMiddleware
 *  owner-path allowlist → /api/proposals/:id/public), so a regression in any
 *  layer (route rename, RLS allowlist change, domain/redirect breakage) alerts
 *  the owner within 15 minutes instead of surfacing as customer complaints.
 *  Added after the July 2026 dead-SMS-link incident, which only existed in
 *  production (local dev runs RLS-off) and was found by a customer. */
async function runCustomerLinkCheck(): Promise<CheckResult> {
  const name = 'Customer proposal links (public view)';

  let proposalId: string | undefined;
  try {
    const [latest] = await db
      .select({ id: schema.proposals.id })
      .from(schema.proposals)
      .orderBy(desc(schema.proposals.createdAt))
      .limit(1);
    proposalId = latest?.id;
  } catch (e) {
    return { name, ok: false, detail: `could not load a proposal to probe: ${(e as Error).message}` };
  }
  if (!proposalId) {
    return { name, ok: true, detail: 'no proposals in the database yet — nothing to probe' };
  }

  // In production probe the real public URL (exercises Cloudflare + DO edge).
  // Elsewhere probe the local server — APP_URL falls back to the prod domain,
  // and a dev DB's proposal id would 404 against prod, false-alerting.
  const base =
    process.env.NODE_ENV === 'production'
      ? APP_URL
      : `http://localhost:${process.env.PORT || 5000}`;
  const url = `${base}/api/proposals/${proposalId}/public`;

  try {
    // Plain fetch, no cookies — deliberately anonymous, like a customer.
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      return {
        name,
        ok: false,
        detail:
          `anonymous GET ${url} returned ${res.status} — customers opening proposal ` +
          `links from SMS/email would see "Proposal not found"`,
      };
    }
    const body = (await res.json()) as { success?: boolean };
    if (!body?.success) {
      return { name, ok: false, detail: `anonymous GET ${url} returned 200 but success=false` };
    }
    return { name, ok: true, detail: `customer links ok (anonymous public fetch of latest proposal succeeded)` };
  } catch (e) {
    return { name, ok: false, detail: `anonymous GET ${url} failed: ${(e as Error).message}` };
  }
}

/** Twilio inbound: credentials valid, account active, inbound number wired to the
 *  answer webhook that rings the app. */
async function runTwilioConfigCheck(): Promise<CheckResult> {
  const name = 'Phone line (Twilio inbound)';

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const hasAuth = !!process.env.TWILIO_AUTH_TOKEN || !!process.env.TWILIO_API_KEY;
  const number = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !hasAuth) {
    return { name, ok: false, detail: 'Twilio credentials not set (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)' };
  }
  if (!number) {
    return { name, ok: false, detail: 'TWILIO_PHONE_NUMBER is not set' };
  }

  try {
    const client = await getTwilioClient();

    const account = await client.api.accounts(sid).fetch();
    if (account.status !== 'active') {
      return { name, ok: false, detail: `Twilio account status is "${account.status}" (expected "active")` };
    }

    const list = await client.incomingPhoneNumbers.list({ phoneNumber: number, limit: 1 });
    if (list.length === 0) {
      return { name, ok: false, detail: `no incoming Twilio number matching ${number} in this account` };
    }

    const voiceUrl = list[0].voiceUrl || '';
    if (!voiceUrl.includes(VOICE_WEBHOOK_PATH)) {
      return {
        name,
        ok: false,
        detail:
          `inbound number ${number} voice webhook is "${voiceUrl || '(empty)'}" — expected to contain ` +
          `${VOICE_WEBHOOK_PATH}; calls would not ring the app`,
      };
    }

    return { name, ok: true, detail: `phone ok (account active, ${number} → ${voiceUrl})` };
  } catch (e) {
    return { name, ok: false, detail: `Twilio API error: ${(e as Error).message}` };
  }
}

/** Email-reply pipeline: the Gmail IMAP poller files customer replies onto job
 *  cards every minute. When it stops succeeding — bad credentials, IMAP outage,
 *  a processing bug — replies pile up invisibly in Gmail (the Aug 2026
 *  incident). Healthy = at least one successful poll in the last 35 minutes.
 *  Environments without Gmail credentials (local dev) report ok/skipped. */
async function runEmailReplyPollerCheck(): Promise<CheckResult> {
  const name = 'Email replies (Gmail poller)';
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { name, ok: true, detail: 'Gmail credentials not configured — skipped' };
  }
  try {
    const { getEmailPollerHealth } = await import('./emailReplyPoller.js');
    const h = getEmailPollerHealth();
    if (!h.running) {
      return { name, ok: false, detail: 'poller is not running (startEmailReplyPolling never ran or was stopped)' };
    }
    const STALE_MS = 35 * 60 * 1000; // ~35 polls missed before alarming — rides out transient IMAP blips
    if (!h.lastSuccessAt) {
      // Give a fresh boot time to complete its first poll before alarming.
      if (process.uptime() < 10 * 60) {
        return { name, ok: true, detail: 'no successful poll yet — instance booted recently' };
      }
      return { name, ok: false, detail: `no successful poll since boot; ${h.consecutiveFailures} consecutive failure(s), last error: ${h.lastErrorMessage || 'none recorded'}` };
    }
    const ageMs = Date.now() - h.lastSuccessAt.getTime();
    if (ageMs > STALE_MS) {
      return { name, ok: false, detail: `last successful poll ${Math.round(ageMs / 60000)} min ago; ${h.consecutiveFailures} consecutive failure(s), last error: ${h.lastErrorMessage || 'none recorded'}` };
    }
    return { name, ok: true, detail: `last successful poll ${Math.round(ageMs / 60000)} min ago` };
  } catch (e) {
    return { name, ok: false, detail: `could not read poller health: ${(e as Error).message}` };
  }
}

async function runHealthChecks(): Promise<void> {
  const results: CheckResult[] = [];
  for (const run of [runLeadPipelineCheck, runTwilioConfigCheck, runCustomerLinkCheck, runEmailReplyPollerCheck]) {
    try {
      results.push(await run());
    } catch (e) {
      results.push({ name: run.name, ok: false, detail: `unexpected error: ${(e as Error).message}` });
    }
  }

  for (const r of results) {
    console.log(`[health] ${r.ok ? 'OK  ' : 'FAIL'} — ${r.name}: ${r.detail}`);
  }

  await handleAlerting(results);
}

async function handleAlerting(results: CheckResult[]): Promise<void> {
  const failures = results.filter((r) => !r.ok);
  const healthy = failures.length === 0;
  const now = Date.now();

  if (!healthy) {
    const wasHealthy = lastOverallHealthy !== false; // first run or previously green
    const dueForRealert = now - lastAlertAt > REALERT_MS;
    if (wasHealthy || dueForRealert) {
      await sendAlert(failures);
      lastAlertAt = now;
    }
  } else if (lastOverallHealthy === false) {
    // transitioned back to healthy
    await sendRecovery();
    lastAlertAt = 0;
  }

  lastOverallHealthy = healthy;
}

async function ownerEmail(): Promise<string> {
  try {
    return (await storage.getBusinessSettings())?.businessEmail || FALLBACK_OWNER_EMAIL;
  } catch {
    return FALLBACK_OWNER_EMAIL;
  }
}

async function sendAlert(failures: CheckResult[]): Promise<void> {
  const lines = failures.map((f) => `- ${f.name}: ${f.detail}`).join('\n');
  const subject = `[ALERT] Treemarkables health check failed (${failures.length})`;
  const text =
    `An automated health check just failed:\n\n${lines}\n\n` +
    `Checked: ${new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZ.\n` +
    `This means a customer-facing system may be down. Re-checks run every 15 minutes; ` +
    `you'll get a recovery note when it clears.`;
  const html =
    `<p>An automated health check just failed:</p><ul>${failures
      .map((f) => `<li><strong>${f.name}:</strong> ${f.detail}</li>`)
      .join('')}</ul>` +
    `<p>Checked ${new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })} NZ. ` +
    `Re-checks run every 15 minutes; you'll get a recovery note when it clears.</p>`;

  try {
    await emailService.sendEmail({ to: await ownerEmail(), subject, text, html });
  } catch (e) {
    console.error('[health] alert email failed:', (e as Error).message);
  }
  try {
    await notificationHelper.pushToAdminsWithCustomerMessages({
      title: 'Health check failed',
      body: failures.map((f) => f.name).join(', '),
      clickAction: '/today',
      data: { type: 'health_alert' },
    });
  } catch (e) {
    console.error('[health] alert push failed:', (e as Error).message);
  }
}

async function sendRecovery(): Promise<void> {
  const subject = 'Treemarkables health check recovered';
  const text = 'The previously failing health check is passing again. All monitored systems are back to healthy.';
  try {
    await emailService.sendEmail({ to: await ownerEmail(), subject, text, html: `<p>${text}</p>` });
  } catch (e) {
    console.error('[health] recovery email failed:', (e as Error).message);
  }
  try {
    await notificationHelper.pushToAdminsWithCustomerMessages({
      title: 'Health check recovered',
      body: 'All monitored systems are healthy again.',
      clickAction: '/today',
      data: { type: 'health_recovered' },
    });
  } catch {
    /* non-critical */
  }
}

/** Start the recurring health-check worker. Gated by RUN_CRONS at the call site. */
export function startHealthCheckWorker(): void {
  console.log('[health] starting health-check worker (forms + phone + customer links, every 15m)');
  setTimeout(() => {
    runHealthChecks().catch((e) => console.error('[health] run error:', (e as Error).message));
  }, INITIAL_DELAY_MS);
  setInterval(() => {
    runHealthChecks().catch((e) => console.error('[health] run error:', (e as Error).message));
  }, INTERVAL_MS);
}
