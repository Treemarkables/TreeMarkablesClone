#!/usr/bin/env node
/**
 * CI gate: fail on high/critical npm audit findings that are not allowlisted.
 *
 * package.json is off-limits in this repo, so the current lockfile has a known
 * set of high GHSAs (drizzle-orm, nodemailer, sharp, puppeteer→extract-zip,
 * imap→utf7→semver). Those ids live in docs/security/npm-audit-allowlist.json.
 * A NEW high/critical advisory still fails the build.
 *
 * Usage: node scripts/npmAuditCi.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const allowPath = join(root, "docs/security/npm-audit-allowlist.json");

function ghsaFromUrl(url) {
  if (!url) return null;
  const match = String(url).match(/GHSA-[0-9a-z-]+/i);
  return match ? match[0] : null;
}

function collectHighAdvisories(report) {
  const found = new Map();
  const vulns = report?.vulnerabilities || {};
  for (const [pkg, vuln] of Object.entries(vulns)) {
    for (const via of vuln?.via || []) {
      if (!via || typeof via !== "object") continue;
      const severity = via.severity;
      if (severity !== "high" && severity !== "critical") continue;
      const id = ghsaFromUrl(via.url) || (via.source != null ? String(via.source) : null);
      if (!id) continue;
      if (!found.has(id)) {
        found.set(id, {
          id,
          package: via.name || pkg,
          severity,
          title: via.title || "",
          url: via.url || "",
        });
      }
    }
  }
  return [...found.values()];
}

const allowFile = JSON.parse(readFileSync(allowPath, "utf8"));
const allow = new Map(
  (allowFile.ghsas || []).map((row) => [row.id, row]),
);

const result = spawnSync("npm", ["audit", "--json", "--package-lock-only"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch (err) {
  console.error("npm audit did not return JSON:", err instanceof Error ? err.message : err);
  if (result.stderr) console.error(result.stderr);
  process.exit(1);
}

const high = collectHighAdvisories(report);
const blocked = [];
const allowed = [];
for (const adv of high) {
  if (allow.has(adv.id)) allowed.push({ ...adv, allow: allow.get(adv.id) });
  else blocked.push(adv);
}

const counts = report?.metadata?.vulnerabilities || {};
console.log(
  `npm audit: info=${counts.info ?? 0} low=${counts.low ?? 0} moderate=${counts.moderate ?? 0} high=${counts.high ?? 0} critical=${counts.critical ?? 0}`,
);

if (allowed.length) {
  console.log(`Allowlisted high/critical (${allowed.length}):`);
  for (const row of allowed) {
    console.log(`  - ${row.id} ${row.package}: ${row.allow.reason}`);
  }
}

if (blocked.length) {
  console.error(`Unallowlisted high/critical (${blocked.length}):`);
  for (const row of blocked) {
    console.error(`  - ${row.id} ${row.severity} ${row.package}: ${row.title}`);
    if (row.url) console.error(`    ${row.url}`);
  }
  console.error("Add a documented GHSA row to docs/security/npm-audit-allowlist.json only if a package.json bump is blocked.");
  process.exit(1);
}

console.log("npm audit CI: no unallowlisted high/critical advisories.");
