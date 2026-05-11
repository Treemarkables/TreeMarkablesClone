// One-shot helper for the Replit → DO migration (Phase 4 cutover prep).
//
// Copies every object under SRC_PRIVATE_OBJECT_DIR (Replit-managed bucket,
// reached via the Replit sidecar at 127.0.0.1:1106) to DST_PRIVATE_OBJECT_DIR
// (GCS bucket `treemarkables-photos`, reached via the DO service-account
// credentials). Object names are preserved so existing DB-stored URLs
// (`/objects/photos/<file>`, `/api/recordings/<file>`) keep resolving after
// the DNS flip to DO.
//
// MUST run inside Replit — the sidecar endpoint only exists there.
//
// Usage (Replit shell):
//
//   export GOOGLE_APPLICATION_CREDENTIALS_JSON='{...DO service-account JSON...}'
//   export DST_PRIVATE_OBJECT_DIR=/treemarkables-photos/.private
//   # SRC_PRIVATE_OBJECT_DIR defaults to PRIVATE_OBJECT_DIR (Replit-side).
//
//   tsx scripts/migrate-object-storage.ts --dry-run     # inventory + size breakdown
//   tsx scripts/migrate-object-storage.ts --limit 5     # copy 5 files (smoke test)
//   tsx scripts/migrate-object-storage.ts               # full copy (resumable)
//
// Delete this script in Phase 5.

import { Storage } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";

const args = process.argv.slice(2);
const hasFlag = (name: string) => args.includes(`--${name}`);
const numArg = (name: string, fallback: number): number => {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return fallback;
  const token = args[i];
  const raw = token.includes("=") ? token.split("=")[1] : args[i + 1];
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    console.error(`Invalid value for --${name}: ${raw}`);
    process.exit(1);
  }
  return n;
};

const DRY_RUN = hasFlag("dry-run");
const LIMIT = numArg("limit", Number.POSITIVE_INFINITY);
const CONCURRENCY = numArg("concurrency", 8);

const SRC_DIR = process.env.SRC_PRIVATE_OBJECT_DIR || process.env.PRIVATE_OBJECT_DIR;
const DST_DIR = process.env.DST_PRIVATE_OBJECT_DIR;
const CREDS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

if (!SRC_DIR) die("Set SRC_PRIVATE_OBJECT_DIR or PRIVATE_OBJECT_DIR (e.g. /<replit-bucket>/.private)");
if (!DST_DIR) die("Set DST_PRIVATE_OBJECT_DIR (e.g. /treemarkables-photos/.private)");
if (!CREDS_JSON && !DRY_RUN) die("Set GOOGLE_APPLICATION_CREDENTIALS_JSON to the DO service-account JSON");

function parseDir(dir: string): { bucket: string; prefix: string } {
  const trimmed = dir.replace(/^\//, "").replace(/\/$/, "");
  const slash = trimmed.indexOf("/");
  if (slash === -1) return { bucket: trimmed, prefix: "" };
  return { bucket: trimmed.slice(0, slash), prefix: trimmed.slice(slash + 1) };
}

const src = parseDir(SRC_DIR);
const dst = parseDir(DST_DIR);

console.log(`Source: bucket="${src.bucket}" prefix="${src.prefix}/"  via Replit sidecar`);
console.log(`Dest:   bucket="${dst.bucket}" prefix="${dst.prefix}/"  via direct service account`);
console.log(`Mode:   ${DRY_RUN ? "DRY RUN (no writes)" : `LIVE (concurrency=${CONCURRENCY}, limit=${LIMIT === Number.POSITIVE_INFINITY ? "∞" : LIMIT})`}`);
console.log("");

const srcClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

const dstClient = CREDS_JSON
  ? (() => {
      const creds = JSON.parse(CREDS_JSON);
      return new Storage({ credentials: creds, projectId: creds.project_id });
    })()
  : null;

const srcBucket = srcClient.bucket(src.bucket);
const dstBucket = dstClient?.bucket(dst.bucket);

type SrcObject = { name: string; size: number; contentType?: string; md5?: string };

async function listAllSourceFiles(): Promise<SrcObject[]> {
  console.log("Listing source files…");
  const [files] = await srcBucket.getFiles({ prefix: src.prefix ? `${src.prefix}/` : undefined });
  return files.map((f) => ({
    name: f.name,
    size: Number(f.metadata.size ?? 0),
    contentType: f.metadata.contentType ?? undefined,
    md5: f.metadata.md5Hash ?? undefined,
  }));
}

function destName(srcObjectName: string): string {
  const stripped = src.prefix ? srcObjectName.replace(new RegExp(`^${src.prefix}/`), "") : srcObjectName;
  return dst.prefix ? `${dst.prefix}/${stripped}` : stripped;
}

async function copyOne(obj: SrcObject): Promise<"copied" | "skipped"> {
  const dstObjectName = destName(obj.name);
  const srcFile = srcBucket.file(obj.name);
  const dstFile = dstBucket!.file(dstObjectName);

  const [exists] = await dstFile.exists();
  if (exists) {
    const [meta] = await dstFile.getMetadata();
    const sameSize = Number(meta.size ?? -1) === obj.size;
    const sameMd5 = meta.md5Hash === obj.md5;
    if (sameSize && sameMd5) return "skipped";
    console.warn(`  ! ${dstObjectName} exists but differs (src=${obj.size}/${obj.md5} dst=${meta.size}/${meta.md5Hash}); re-copying`);
  }

  await new Promise<void>((resolve, reject) => {
    srcFile
      .createReadStream()
      .on("error", reject)
      .pipe(
        dstFile.createWriteStream({
          resumable: false,
          metadata: { contentType: obj.contentType || "application/octet-stream" },
        }),
      )
      .on("finish", () => resolve())
      .on("error", reject);
  });
  return "copied";
}

async function main() {
  const files = await listAllSourceFiles();
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  console.log(`Found ${files.length} object(s), ${(totalBytes / 1024 / 1024).toFixed(1)} MB.`);

  if (DRY_RUN) {
    const byTopFolder = new Map<string, { count: number; bytes: number }>();
    for (const f of files) {
      const rel = src.prefix ? f.name.replace(new RegExp(`^${src.prefix}/`), "") : f.name;
      const top = rel.split("/")[0] || "(root)";
      const entry = byTopFolder.get(top) ?? { count: 0, bytes: 0 };
      entry.count++;
      entry.bytes += f.size;
      byTopFolder.set(top, entry);
    }
    console.log("Breakdown by top-level folder:");
    for (const [folder, { count, bytes }] of byTopFolder) {
      console.log(`  ${folder}/  →  ${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    }
    if (files.length > 0) {
      console.log("\nSample (first 5):");
      for (const f of files.slice(0, 5)) console.log(`  ${f.name}  (${f.size} bytes, ${f.contentType ?? "?"})`);
    }
    return;
  }

  const queue = files.slice(0, LIMIT === Number.POSITIVE_INFINITY ? files.length : LIMIT);
  let copied = 0;
  let skipped = 0;
  let errors = 0;
  const errorList: { name: string; err: unknown }[] = [];
  let idx = 0;

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const i = idx++;
      if (i >= queue.length) return;
      const f = queue[i];
      try {
        const result = await copyOne(f);
        if (result === "copied") copied++;
        else skipped++;
      } catch (err) {
        errors++;
        errorList.push({ name: f.name, err });
        console.error(`  ✗ ${f.name}: ${(err as Error).message}`);
      }
      const done = copied + skipped + errors;
      if (done % 25 === 0 || done === queue.length) {
        console.log(`  progress: ${done}/${queue.length}  copied=${copied} skipped=${skipped} errors=${errors}`);
      }
    }
  });

  await Promise.all(workers);

  console.log("");
  console.log(`Done. copied=${copied} skipped=${skipped} errors=${errors} of ${queue.length} attempted.`);
  if (errorList.length) {
    console.log("\nFirst 10 errors:");
    for (const e of errorList.slice(0, 10)) console.log(`  ${e.name}: ${(e.err as Error).message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
