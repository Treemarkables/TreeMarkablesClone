// Bundle the hash-router build (dist-artifact/) into ONE self-contained HTML
// file for publishing as a Claude Artifact: CSS + JS inlined, every image
// swapped for a data URI. Run `VITE_HASH_ROUTER=1 npx vite build --outDir
// dist-artifact` first, then `node scripts/buildArtifact.mjs <out.html>`.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist-artifact");
const out = process.argv[2] ?? join(root, "artifact.html");

const html = readFileSync(join(dist, "index.html"), "utf8");
const cssFile = html.match(/assets\/(index-[\w-]+\.css)/)[1];
const jsFile = html.match(/assets\/(index-[\w-]+\.js)/)[1];
const css = readFileSync(join(dist, "assets", cssFile), "utf8");
let js = readFileSync(join(dist, "assets", jsFile), "utf8");

const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
const toDataUri = (path) => {
  const b = readFileSync(path);
  return `data:${mime[extname(path)]};base64,${b.toString("base64")}`;
};

// Swap every public image path literal in the JS bundle for a data URI.
const images = [
  ...readdirSync(join(dist, "photos")).map((f) => `/photos/${f}`),
  "/crest.png",
  "/crest-light.png",
];
for (const rel of images) {
  const uri = toDataUri(join(dist, rel));
  const before = js.length;
  js = js.split(`"${rel}"`).join(JSON.stringify(uri));
  if (js.length === before) console.warn(`WARN: no literal found for ${rel}`);
}

// A "</script>" sequence inside the JS would terminate the inline tag early.
js = js.replaceAll("</script>", "<\\/script>");

const page = `<meta charset="utf-8" />
<title>Gisborne Park Golf Club</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,300..900;1,300..900&family=Young+Serif&display=swap" />
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
writeFileSync(out, page);
console.log(out, Math.round(page.length / 1024), "KB");
