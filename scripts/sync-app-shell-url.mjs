#!/usr/bin/env node
// scripts/sync-app-shell-url.mjs
//
// Stamps the native-app-shell URL (the container the iOS/Android/Electron apps load)
// from appShell.config.json into every shell file. These live in 4 languages so they
// can't share an import — this script is the single propagation mechanism.
//
// SCOPE: native app shells ONLY. It never touches customer-facing links (invoices,
// proposals, emails) — those stay per-tenant / treemarkables by design.
//
// To move the app shells to a new domain:
//   1. Edit appShell.config.json  →  "host" + "url"
//   2. node scripts/sync-app-shell-url.mjs
//   3. Rebuild each shell (cap sync / electron / Xcode)
//
// It normalises ANY known shell host → the configured one, so it's idempotent and works
// in either direction (treemarkables ⇄ inflow).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const cfg = JSON.parse(readFileSync(resolve(ROOT, "appShell.config.json"), "utf-8"));
const targetHost = cfg.host;
const targetUrl = cfg.url || `https://${targetHost}`;
if (!targetHost || !targetUrl.includes(targetHost)) {
  console.error("✗ appShell.config.json: `host`/`url` missing or inconsistent");
  process.exit(1);
}

// Every host the shells might currently contain. Add new candidate domains here so the
// script can normalise away from them too.
const KNOWN_HOSTS = ["app.treemarkables.co.nz", "app.inflowapp.co.nz"];

// Native-shell files only (the allowlist is deliberately narrow).
const FILES = [
  "capacitor.config.ts",
  "electron/main.js",
  "android-native/co/nz/inflowapp/voice/VoiceFirebaseMessagingService.kt",
  "ios-native/AppDelegate+Firebase.swift",
  "ios/App/App/AppDelegate+Firebase.swift",
];

let totalChanged = 0;
for (const rel of FILES) {
  const path = resolve(ROOT, rel);
  if (!existsSync(path)) {
    console.log(`  • ${rel} — not present (skipped)`);
    continue;
  }
  let text = readFileSync(path, "utf-8");
  const before = text;
  for (const host of KNOWN_HOSTS) {
    if (host === targetHost) continue;
    // Replace the bare host (covers https://host, origin guards, comments).
    text = text.split(host).join(targetHost);
  }
  if (text !== before) {
    writeFileSync(path, text, "utf-8");
    totalChanged++;
    console.log(`  ✓ ${rel} — set to ${targetHost}`);
  } else {
    console.log(`  • ${rel} — already ${targetHost}`);
  }
}

console.log(
  totalChanged === 0
    ? `\nAll shell files already on ${targetHost}.`
    : `\nUpdated ${totalChanged} file(s) → ${targetUrl}. Rebuild each shell to apply.`,
);
