#!/usr/bin/env node
/**
 * Typecheck gate: fail only on NEW type errors introduced by this branch.
 *
 * The repo carries ~1000 legacy tsc errors and ships via Vite/esbuild (which
 * strip types without checking them), so a plain `tsc` gate is impossible, and
 * a per-changed-file gate would stay permanently red for hot files like
 * routes.ts that carry legacy errors. Instead this runs the full typecheck
 * TWICE — once against the base ref, once against the working tree — and fails
 * only on errors present now but not in the base. Legacy errors cancel out.
 *
 * Errors are compared as (file | TS code | message) multisets, ignoring line
 * numbers, so unrelated edits shifting lines don't create false positives.
 * This catches exactly the class of bug that silently killed email-reply
 * processing in Aug 2026: an identifier renamed in one place but not another —
 * a plain TS2304 on a line the diff never touched, which esbuild happily
 * shipped.
 *
 * Usage: node scripts/typecheckChanged.mjs [baseRef]   (default: origin/main)
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, symlinkSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

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
console.log(`${changed.length} TypeScript file(s) changed vs ${base} — comparing type errors...`);

// tsc needs a big heap on this codebase (OOMs at the default limit).
// --incremental false: both runs must be full, deterministic checks — the
// shared tsbuildinfo cache would otherwise leak state between them.
function runTsc(cwd) {
  // --noErrorTruncation: tsc elides long types differently depending on how
  // long the embedded absolute paths are, so the same error can print
  // differently in the two checkouts — full messages compare reliably.
  const res = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false', '--incremental', 'false', '--noErrorTruncation'], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
    maxBuffer: 256 * 1024 * 1024,
  });
  // Error messages can embed ABSOLUTE paths (e.g. import("/abs/path/shared/schema")),
  // which differ between the head and base checkouts — strip the run's root so
  // identical errors compare equal across the two runs.
  const cwdPrefix = new RegExp(cwd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/', 'g');
  const out = `${res.stdout || ''}\n${res.stderr || ''}`.replace(cwdPrefix, '');
  // tsc line format: path/to/file.ts(12,34): error TS2304: Cannot find name 'x'.
  const errors = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^(.+?)\(\d+,\d+\): (error TS\d+: .*)$/);
    if (m) errors.push({ key: `${m[1].replace(/\\/g, '/')} | ${m[2]}`, line: line.trim() });
  }
  return errors;
}

// Head run first (working tree — also usable locally before committing).
console.log('Typechecking HEAD (working tree)...');
const headErrors = runTsc(process.cwd());

// Base run in a throwaway git worktree sharing our node_modules.
const baseTree = resolve(process.cwd(), '.typecheck-base-tree');
let baseErrors;
try {
  if (existsSync(baseTree)) {
    execSync(`git worktree remove --force ${JSON.stringify(baseTree)}`, { stdio: 'ignore' });
  }
  execSync(`git worktree add --detach ${JSON.stringify(baseTree)} ${base}`, { stdio: 'ignore' });
  symlinkSync(resolve(process.cwd(), 'node_modules'), resolve(baseTree, 'node_modules'), 'dir');
  console.log(`Typechecking base (${base})...`);
  baseErrors = runTsc(baseTree);
} finally {
  try {
    rmSync(resolve(baseTree, 'node_modules'), { force: true }); // remove symlink, not the real node_modules
    execSync(`git worktree remove --force ${JSON.stringify(baseTree)}`, { stdio: 'ignore' });
  } catch {
    /* best effort */
  }
}

// Multiset diff: an error key must appear MORE times at head than at base to fail.
const baseCounts = new Map();
for (const e of baseErrors) baseCounts.set(e.key, (baseCounts.get(e.key) || 0) + 1);

const newErrors = [];
for (const e of headErrors) {
  const remaining = baseCounts.get(e.key) || 0;
  if (remaining > 0) {
    baseCounts.set(e.key, remaining - 1); // cancels against a pre-existing identical error
  } else {
    newErrors.push(e.line);
  }
}

console.log(`Base: ${baseErrors.length} error(s) (legacy, ignored). Head: ${headErrors.length} error(s).`);

if (newErrors.length > 0) {
  console.error(`\n${newErrors.length} NEW type error(s) introduced by this branch:\n`);
  newErrors.forEach((l) => console.error(`  ${l}`));
  console.error('\nFix these before merging (pre-existing errors are ignored).');
  process.exit(1);
}

console.log('No new type errors introduced.');
