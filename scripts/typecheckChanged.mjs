#!/usr/bin/env node
/**
 * Typecheck gate scoped to CHANGED files.
 *
 * The repo carries ~1000 legacy tsc errors and ships via Vite/esbuild (which
 * strip types without checking them), so a full `tsc` gate is impossible.
 * Instead: run the full typecheck, but FAIL only on errors in files this
 * branch touched relative to the base ref. Legacy errors elsewhere are
 * ignored, so the gate is green on day one and every PR keeps its own files
 * clean.
 *
 * This catches exactly the class of bug that silently killed email-reply
 * processing in Aug 2026: a ReferenceError from an identifier that was renamed
 * in one place but not another — a plain TS2304 that esbuild happily shipped.
 *
 * Usage: node scripts/typecheckChanged.mjs [baseRef]   (default: origin/main)
 */
import { execSync, spawnSync } from 'node:child_process';

const base = process.argv[2] || 'origin/main';

let changed;
try {
  changed = execSync(`git diff --name-only ${base}...HEAD`, { encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter((f) => /\.(ts|tsx)$/.test(f));
} catch (e) {
  console.error(`Could not diff against ${base}: ${e.message}`);
  process.exit(1);
}

if (changed.length === 0) {
  console.log('No TypeScript files changed — skipping typecheck.');
  process.exit(0);
}

console.log(`Typechecking (gating on ${changed.length} changed file(s)):`);
changed.forEach((f) => console.log(`  ${f}`));

// tsc needs a big heap on this codebase (OOMs at the default limit).
const res = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
  encoding: 'utf8',
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
  maxBuffer: 256 * 1024 * 1024,
});

const out = `${res.stdout || ''}\n${res.stderr || ''}`;
const changedSet = new Set(changed);

// tsc line format: path/to/file.ts(12,34): error TS2304: Cannot find name 'x'.
const offending = out.split('\n').filter((line) => {
  const m = line.match(/^(.+?)\(\d+,\d+\): error TS/);
  return m && changedSet.has(m[1].replace(/\\/g, '/'));
});

if (offending.length > 0) {
  console.error(`\n${offending.length} type error(s) in changed files:\n`);
  offending.forEach((l) => console.error(`  ${l}`));
  console.error('\nFix these before merging (errors in untouched files are ignored).');
  process.exit(1);
}

console.log('Changed files are type-clean (legacy errors in untouched files ignored).');
