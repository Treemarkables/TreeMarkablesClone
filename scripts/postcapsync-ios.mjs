#!/usr/bin/env node
// Re-add local iOS plugin classes to capacitor.config.json's packageClassList
// after `npx cap sync ios`. The CLI scans node_modules plugins only, so any
// plugin we wrote directly in the App target (not as an npm package) gets
// dropped on every sync. Run this after every `cap sync ios`.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const LOCAL_PLUGINS = ["TwilioVoicePlugin"];
const CONFIG_PATH = resolve("ios/App/App/capacitor.config.json");

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
const existing = new Set(config.packageClassList ?? []);
for (const cls of LOCAL_PLUGINS) {
  existing.add(cls);
}
config.packageClassList = [...existing];
writeFileSync(CONFIG_PATH, JSON.stringify(config, null, "\t") + "\n");
console.log(
  `✅ packageClassList now includes: ${config.packageClassList.join(", ")}`,
);
