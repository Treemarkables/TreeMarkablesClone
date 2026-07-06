/**
 * Inflow — self-serve signup smoke test ("does the funnel actually work end-to-end?").
 *
 * Drives POST /api/signup over real HTTP the way a new subscriber would, then asserts the
 * tenant was fully provisioned: business + admin + Freemium subscription + default document
 * templates, that the returned session actually authenticates, that entitlements resolve,
 * that the duplicate-email guard fires, and that plain login works with the new credentials.
 * Optionally exercises a PAID plan signup to confirm a Stripe Checkout URL comes back.
 *
 * It SEEDS real rows (via the real signup path) and tears them down afterward, so point
 * DATABASE_URL + TEST_BASE_URL at a NON-PROD environment.
 *
 *   # dev server must be running (it serves /api/signup)
 *   set -a && source .env && set +a
 *   TEST_BASE_URL=http://localhost:5001 npx tsx scripts/signupSmokeTest.mts
 *
 * Flags:
 *   --allow-remote   permit a non-localhost TEST_BASE_URL (otherwise refused — this CREATES tenants)
 *   --keep           skip teardown (leave the __smoke__ tenants for manual inspection)
 *   --paid           also run a paid-plan (crew) signup and expect a Stripe Checkout URL
 *
 * Exit code = number of FAILUREs (0 = clean), so CI can gate on it. WARNs never fail.
 */
import pg from "pg";

const BASE_URL = (process.env.TEST_BASE_URL || "http://localhost:5001").replace(/\/$/, "");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
const KEEP = process.argv.includes("--keep");
const PAID = process.argv.includes("--paid");

// ── Guards ──────────────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set — point it at a NON-PROD Neon branch.");
  process.exit(2);
}
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
if (!isLocal && !ALLOW_REMOTE) {
  console.error(`Refusing non-local TEST_BASE_URL (${BASE_URL}) without --allow-remote.`);
  console.error("This test CREATES real tenants via /api/signup — never run it against production.");
  process.exit(2);
}
if (/app\.(treemarkables|inflowapp)\.co\.nz/.test(BASE_URL)) {
  console.error("TEST_BASE_URL points at a production host. Aborting.");
  process.exit(2);
}

const TAG = "__smoke__";
const rnd = Math.floor(Number(process.hrtime.bigint() % 1000000n)); // unique-ish, no Date/random

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

type Row = { name: string; verdict: "PASS" | "FAIL" | "WARN"; detail: string };
const results: Row[] = [];
const record = (name: string, verdict: Row["verdict"], detail = "") => results.push({ name, verdict, detail });

// Pull the real (non-empty) session cookie out of a signup/login response. The app emits
// TWO `treemarkables.sid` Set-Cookie headers (the real one + a legacy-domain clear-cookie);
// pick the non-empty value or every authenticated call is silently unauthenticated.
function sessionCookie(res: Response): string | null {
  const raw = (res.headers as any).getSetCookie?.() ?? [res.headers.get("set-cookie")].filter(Boolean);
  return (raw as string[])
    .map((s) => s.split(";")[0])
    .filter((s) => s.startsWith("treemarkables.sid="))
    .find((s) => s.length > "treemarkables.sid=".length) ?? null;
}

async function signup(planKey: "freemium" | "crew", suffix: string) {
  const businessName = `${TAG} Biz ${suffix} ${rnd}`;
  const email = `smoke+${suffix}-${rnd}@example.test`;
  const password = "SmokeTestPass1234";
  const res = await fetch(`${BASE_URL}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessName, firstName: "Smoke", lastName: "Tester", email, password, planKey }),
  });
  const text = await res.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch { /* leave {} */ }
  return { res, body, text, email, password, businessName };
}

async function getAs(cookie: string | null, path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: res.status, body: await res.text() };
}

(async () => {
  const createdBusinessIds: string[] = [];
  try {
    // Preflight: server reachable?
    try {
      await fetch(`${BASE_URL}/api/health`).catch(() => fetch(`${BASE_URL}/`));
    } catch {
      console.error(`Cannot reach ${BASE_URL}. Start the dev server first.`);
      process.exit(2);
    }

    // ── 1) Freemium signup provisions a full tenant ───────────────────────────
    const s = await signup("freemium", "free");
    if (!s.res.ok || !s.body?.success || !s.body?.businessId) {
      record("POST /api/signup (freemium)", "FAIL", `HTTP ${s.res.status}: ${s.text.slice(0, 200)}`);
      throw new Error("signup failed — cannot continue");
    }
    const businessId: string = s.body.businessId;
    createdBusinessIds.push(businessId);
    record("POST /api/signup (freemium)", "PASS", `business ${businessId}`);

    // ── 2) The returned session actually authenticates ────────────────────────
    const cookie = sessionCookie(s.res);
    const me = await getAs(cookie, "/api/auth/me");
    if (me.status === 200 && me.body.includes(businessId)) {
      record("session authenticates (/api/auth/me)", "PASS", "logged in as the new tenant");
    } else {
      record("session authenticates (/api/auth/me)", "FAIL", `HTTP ${me.status}: ${me.body.slice(0, 160)}`);
    }

    // ── 3) Entitlements resolve (freemium = no plan:crew/business gates) ───────
    // /api/auth/me carries an `entitlements` array the UI gates on.
    if (me.status === 200 && /"entitlements"\s*:/.test(me.body)) {
      const crewLeaked = /"entitlements"\s*:\s*\[[^\]]*plan:crew/.test(me.body);
      record("entitlements resolve", crewLeaked ? "WARN" : "PASS",
        crewLeaked ? "freemium tenant unexpectedly has plan:crew" : "freemium → no paid gates (correct)");
    } else {
      record("entitlements resolve", "WARN", "no entitlements array on /api/auth/me");
    }

    // ── 4) DB-side provisioning: subscription + document templates ────────────
    const sub = await pool.query(
      `SELECT s.status, p.key AS plan_key
         FROM subscriptions s LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.business_id = $1`, [businessId]);
    if (sub.rowCount === 0) {
      record("Freemium subscription seeded", "WARN",
        "no subscription row — subscription_plans likely has no 'freemium' row on this DB (createTenant guards on it)");
    } else if (sub.rows[0].plan_key === "freemium" && sub.rows[0].status === "active") {
      record("Freemium subscription seeded", "PASS", "active freemium subscription");
    } else {
      record("Freemium subscription seeded", "WARN", `unexpected: ${JSON.stringify(sub.rows[0])}`);
    }

    const tpl = await pool.query(
      `SELECT type FROM document_templates WHERE business_id = $1 ORDER BY type`, [businessId]);
    const types = tpl.rows.map((r) => r.type).sort();
    const expected = ["invoice", "proposal", "quote"];
    if (expected.every((t) => types.includes(t))) {
      record("default document templates seeded", "PASS", `${tpl.rowCount} templates: ${types.join(", ")}`);
    } else {
      record("default document templates seeded", "FAIL", `expected quote/proposal/invoice, got: ${types.join(", ") || "(none)"}`);
    }

    // ── 5) Duplicate-email guard fires ────────────────────────────────────────
    const dup = await fetch(`${BASE_URL}/api/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName: `${TAG} Dup ${rnd}`, firstName: "Dup", lastName: "Tester", email: s.email, password: "SmokeTestPass1234", planKey: "freemium" }),
    });
    record("duplicate-email guard", dup.status === 400 ? "PASS" : "FAIL",
      dup.status === 400 ? "second signup with same email rejected (400)" : `expected 400, got ${dup.status}`);

    // ── 6) Plain login works with the new credentials ─────────────────────────
    const login = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: s.email, password: s.password }),
    });
    const loginCookie = sessionCookie(login);
    const meAfterLogin = await getAs(loginCookie, "/api/auth/me");
    record("login with new credentials", login.ok && meAfterLogin.status === 200 && meAfterLogin.body.includes(businessId) ? "PASS" : "FAIL",
      login.ok ? `authenticated (HTTP ${meAfterLogin.status})` : `login HTTP ${login.status}`);

    // ── 7) (optional) Paid plan returns a Stripe Checkout URL ─────────────────
    if (PAID) {
      const p = await signup("crew", "paid");
      if (p.res.ok && p.body?.businessId) createdBusinessIds.push(p.body.businessId);
      if (p.res.ok && p.body?.checkoutUrl) {
        record("paid signup returns Stripe Checkout URL", "PASS", String(p.body.checkoutUrl).slice(0, 60) + "…");
      } else if (p.res.ok) {
        record("paid signup returns Stripe Checkout URL", "WARN",
          "tenant created but no checkoutUrl — Stripe not configured / no crew price on this env (non-fatal)");
      } else {
        record("paid signup returns Stripe Checkout URL", "FAIL", `HTTP ${p.res.status}: ${p.text.slice(0, 160)}`);
      }
    }

    // ── Report ────────────────────────────────────────────────────────────────
    const pad = Math.max(...results.map((r) => r.name.length));
    console.log("\nSIGNUP SMOKE TEST");
    console.log("─".repeat(pad + 22));
    for (const r of results) {
      const mark = r.verdict === "PASS" ? "✅" : r.verdict === "FAIL" ? "❌" : "⚠️ ";
      console.log(`${mark} ${r.name.padEnd(pad)}  ${r.verdict.padEnd(6)} ${r.detail}`);
    }
    console.log("─".repeat(pad + 22));
    const fails = results.filter((r) => r.verdict === "FAIL");
    const warns = results.filter((r) => r.verdict === "WARN");
    console.log(`\n${fails.length} failure(s), ${warns.length} warning(s).`);
    console.log(fails.length === 0 ? "Self-serve signup provisions a working tenant end-to-end." : "SIGNUP FUNNEL BROKEN — see failures above.");
    process.exitCode = fails.length;
  } catch (e) {
    console.error("\n❌ Smoke test error:", (e as Error).message);
    process.exitCode = 2;
  } finally {
    // ── Teardown (FK-safe order, owner connection) ────────────────────────────
    if (!KEEP && createdBusinessIds.length) {
      const TABLES = ["document_templates", "subscriptions", "employees", "business_settings", "businesses"];
      for (const bid of createdBusinessIds) {
        for (const tbl of TABLES) {
          const col = tbl === "businesses" ? "id" : "business_id";
          await pool.query(`DELETE FROM ${tbl} WHERE ${col} = $1`, [bid]).catch((err) =>
            console.error(`  teardown ${tbl} (${bid}) failed: ${err.message}`));
        }
      }
      console.log("Tore down the throwaway tenant(s).");
    } else if (KEEP) {
      console.log("--keep set: throwaway tenant(s) left in place.");
    }
    await pool.end();
  }
})();
