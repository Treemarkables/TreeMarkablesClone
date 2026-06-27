/**
 * Generate the social share card (Open Graph image) → public/og-image.png (1200×630 @2x).
 * Renders an on-brand HTML card with the real Inter font + brand colours via headless
 * Chrome, so it matches the site exactly. Re-run after any branding change:
 *   node inflow-site/scripts/genOgImage.mjs
 */
import puppeteer from "puppeteer";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, "..", "public");
const icon = `data:image/png;base64,${readFileSync(join(pub, "inflow-icon-512.png")).toString("base64")}`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://rsms.me/"><link rel="stylesheet" href="https://rsms.me/inter/inter.css">
<style>
  *{margin:0;box-sizing:border-box}
  html,body{width:1200px;height:630px}
  body{background:#0A0A0B;color:#FBFBF7;font-family:'Inter',-apple-system,Helvetica,Arial,sans-serif;
       padding:74px;position:relative;overflow:hidden}
  .glow{position:absolute;top:-200px;right:-180px;width:620px;height:620px;border-radius:50%;
        background:radial-gradient(circle,rgba(200,255,61,.18),transparent 66%)}
  .brand{display:flex;align-items:center;gap:16px}
  .brand img{width:58px;height:58px;border-radius:13px}
  .brand span{font-size:32px;font-weight:600;letter-spacing:-.02em}
  h1{margin-top:84px;font-size:84px;font-weight:700;line-height:1.02;letter-spacing:-.035em;max-width:960px}
  .accent{position:relative;display:inline-block;white-space:nowrap}
  .accent::after{content:'';position:absolute;left:-4px;right:-4px;bottom:10px;height:18px;
                 background:#C8FF3D;opacity:.9;z-index:-1}
  p{margin-top:42px;font-size:33px;line-height:1.38;color:#B8BEC7;max-width:860px}
  .url{position:absolute;bottom:74px;left:74px;font-size:27px;font-weight:600;color:#C8FF3D;letter-spacing:-.01em}
  .nz{position:absolute;bottom:74px;right:74px;font-size:22px;color:#5B6470}
</style></head><body>
  <div class="glow"></div>
  <div class="brand"><img src="${icon}"><span>Inflow</span></div>
  <h1>Run your trade from <span class="accent">one place.</span></h1>
  <p>Jobs, quotes, invoices, safety and CRM — built for the field.</p>
  <div class="url">inflowapp.co.nz</div>
  <div class="nz">Made in New Zealand</div>
</body></html>`;

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.evaluate(async () => { await document.fonts.ready; });
  const out = join(pub, "og-image.png");
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log("wrote", out);
} finally {
  await browser.close();
}
