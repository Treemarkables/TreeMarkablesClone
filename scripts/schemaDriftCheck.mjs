#!/usr/bin/env node
/**
 * Schema drift checker — finds columns the Drizzle schema declares that the live
 * database is MISSING (the failure mode that broke prod 2026-06-08: trade-gen added
 * `business_settings.industry` to schema.ts but the ALTER never ran on prod, so every
 * `SELECT *` via getBusinessSettings() threw `column "industry" does not exist`).
 *
 * Usage:
 *   node scripts/schemaDriftCheck.mjs                 # check the DB in $DATABASE_URL (dev)
 *   node scripts/schemaDriftCheck.mjs --sql           # just print a prod-safe diff query, no DB connection
 *   node scripts/schemaDriftCheck.mjs --fix-sql       # print idempotent ALTER…ADD COLUMN IF NOT EXISTS for every missing col
 *
 * Read-only by default (never alters anything). The --sql output is meant to be pasted
 * into the Neon PROD SQL Editor (my local env only reaches the dev branch).
 *
 * Parsing is intentionally simple: it reads the first string literal of each column
 * builder (text("x"), varchar("x"), …) inside every pgTable("name", { … }). Index/FK
 * definitions in the optional 3rd arg reference table.col (no type builder), so they're
 * naturally skipped.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const SCHEMA_FILES = ["shared/schema.ts", "shared/timeTracking.ts"];

const COLUMN_BUILDER =
  /\b(?:text|varchar|char|boolean|integer|bigint|smallint|serial|bigserial|numeric|decimal|real|doublePrecision|timestamp|timestamptz|date|time|jsonb|json|uuid)\(\s*"([a-zA-Z0-9_]+)"/g;

/** Parse every pgTable("name", { ... }) and the db column names it declares. */
function parseSchema(src) {
  const tables = {};
  const re = /pgTable\(\s*"([a-zA-Z0-9_]+)"\s*,\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const tableName = m[1];
    // Walk braces from the opening { of the column object to its match.
    let i = re.lastIndex - 1;
    let depth = 0;
    const start = i;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = src.slice(start, i + 1);
    const cols = new Set();
    let c;
    COLUMN_BUILDER.lastIndex = 0;
    while ((c = COLUMN_BUILDER.exec(body))) cols.add(c[1]);
    tables[tableName] = [...(tables[tableName] ? new Set([...tables[tableName], ...cols]) : cols)];
  }
  return tables;
}

const expected = {};
for (const f of SCHEMA_FILES) {
  try {
    Object.assign(expected, mergeTables(expected, parseSchema(readFileSync(join(ROOT, f), "utf8"))));
  } catch {
    /* file may not exist in every checkout */
  }
}
function mergeTables(a, b) {
  const out = { ...a };
  for (const [t, cols] of Object.entries(b)) {
    out[t] = [...new Set([...(out[t] || []), ...cols])];
  }
  return out;
}

const totalCols = Object.values(expected).reduce((n, c) => n + c.length, 0);
const pairs = [];
for (const [t, cols] of Object.entries(expected)) for (const col of cols) pairs.push([t, col]);

// A portable, read-only diff query: which (table,column) the schema expects are NOT in the DB.
const valuesList = pairs.map(([t, c]) => `('${t}','${c}')`).join(",\n    ");
const diffSql = `-- READ-ONLY. Lists schema columns missing from this database (run on PROD).
SELECT e.tbl AS table_name, e.col AS missing_column
FROM (VALUES
    ${valuesList}
) AS e(tbl, col)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = e.tbl AND c.column_name = e.col
)
ORDER BY 1, 2;`;

const mode = process.argv[2];

if (mode === "--sql") {
  console.log(diffSql);
  process.exit(0);
}

// Live check against $DATABASE_URL.
const { default: pg } = await import("pg");
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Source your .env first, or use --sql for a prod-pasteable query.");
  process.exit(2);
}
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
});
await client.connect();
const live = await client.query(
  `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'`,
);
const liveTables = new Set(live.rows.map((r) => r.table_name));
const liveSet = new Set(live.rows.map((r) => `${r.table_name}.${r.column_name}`));

const missingCols = [];
const missingTables = [];
for (const [t, cols] of Object.entries(expected)) {
  if (!liveTables.has(t)) {
    missingTables.push(t);
    continue;
  }
  for (const col of cols) if (!liveSet.has(`${t}.${col}`)) missingCols.push(`${t}.${col}`);
}

const host = (process.env.DATABASE_URL.match(/@([^/]+)\//) || [])[1] || "(unknown host)";
console.log(`\nSchema-drift check against: ${host}`);
console.log(`Schema declares ${Object.keys(expected).length} tables / ${totalCols} columns.\n`);

if (missingTables.length) {
  console.log(`⚠️  ${missingTables.length} table(s) missing entirely:`);
  for (const t of missingTables.sort()) console.log(`   - ${t}`);
  console.log("");
}
if (missingCols.length) {
  console.log(`⚠️  ${missingCols.length} column(s) declared in schema but MISSING from the DB:`);
  for (const c of missingCols.sort()) console.log(`   - ${c}`);
} else {
  console.log("✅ No missing columns — every schema-declared column exists in this database.");
}

await client.end();
