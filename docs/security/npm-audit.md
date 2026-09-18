# npm audit in CI

The typecheck GitHub Actions job runs `node scripts/npmAuditCi.mjs` after `npm ci`.

## Policy

- Fail the job on **high** or **critical** advisories in `npm audit --json`.
- Moderate/low are reported in the log and do not fail the build.
- Known noise that cannot be fixed without editing off-limits `package.json` lives in [`npm-audit-allowlist.json`](./npm-audit-allowlist.json), keyed by GHSA id.
- A **new** high/critical GHSA that is not on that list fails CI even if it sits under an already-noisy package. That is intentional.

## Allowlist rules

Add a GHSA only when:

1. The fix requires a `package.json` bump (this file is tooling-owned), **and**
2. The note explains why the issue is not an immediate production exploit in *this* app, **and**
3. `expires` is set so the row gets re-reviewed (drop it when a dedicated bump PR lands).

Do not allowlist by package name. Parent packages (puppeteer, imap) inherit severity from a leaf GHSA; allowing the leaf is enough.

## Local

```bash
npm audit --json
node scripts/npmAuditCi.mjs
```
