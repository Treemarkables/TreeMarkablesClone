// Signed claim for one resumable video upload. The browser sends it back with
// every chunk and with the complete call. The signature stops a caller from
// swapping the object name or the GCS session URL (that URL is a write
// capability, and it must be the one this server created). Two app instances
// can check it without shared memory.
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
  VIDEO_EXPIRED_MESSAGE,
  assertGcsSessionUri,
  assertSafeVideoFilename,
} from "../shared/videoUpload.ts";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export interface VideoUploadIntent {
  filename: string;
  mimeType: string;
  fileSize: number;
  originalName: string;
  jobId: string | null;
  businessId: string;
  employeeId: string;
  kind: "job" | "knowledge";
  sessionUri: string;
  origin: string;
  exp: number;
}

interface TokenBody extends VideoUploadIntent {
  v: 1;
}

export function videoUploadSecret(): string {
  return process.env.SESSION_SECRET || "treemarkables-dev-secret-change-in-production";
}

export function newVideoObjectFilename(extension: string): string {
  const ext = extension.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${Date.now()}_${randomUUID()}.${ext}`;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signVideoUploadToken(
  intent: Omit<VideoUploadIntent, "exp">,
  secret: string,
  now = Date.now(),
): string {
  assertSafeVideoFilename(intent.filename);
  assertGcsSessionUri(intent.sessionUri);
  const body: TokenBody = { ...intent, v: 1, exp: now + TOKEN_TTL_MS };
  const data = encode(JSON.stringify(body));
  return `${data}.${sign(data, secret)}`;
}

function asKind(value: unknown): "job" | "knowledge" | null {
  if (value === "job" || value === "knowledge") return value;
  return null;
}

export function verifyVideoUploadToken(token: string, secret: string, now = Date.now()): VideoUploadIntent {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("Invalid upload token");
  const [data, sig] = parts;
  const expected = sign(data, secret);
  const got = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    throw new Error("Invalid upload token");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid upload token");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid upload token");
  const body = parsed as Partial<TokenBody>;
  const kind = asKind(body.kind);
  if (body.v !== 1 || !kind) throw new Error("Invalid upload token");
  if (typeof body.exp !== "number" || body.exp < now) throw new Error(VIDEO_EXPIRED_MESSAGE);
  if (typeof body.filename !== "string") throw new Error("Invalid upload token");
  if (typeof body.mimeType !== "string" || !body.mimeType.startsWith("video/")) {
    throw new Error("Invalid upload token");
  }
  if (typeof body.fileSize !== "number" || !Number.isInteger(body.fileSize) || body.fileSize < 1) {
    throw new Error("Invalid upload token");
  }
  if (typeof body.originalName !== "string") throw new Error("Invalid upload token");
  if (!(body.jobId === null || typeof body.jobId === "string")) throw new Error("Invalid upload token");
  if (typeof body.businessId !== "string" || !body.businessId) throw new Error("Invalid upload token");
  if (typeof body.employeeId !== "string" || !body.employeeId) throw new Error("Invalid upload token");
  if (typeof body.sessionUri !== "string" || typeof body.origin !== "string") {
    throw new Error("Invalid upload token");
  }
  assertSafeVideoFilename(body.filename);
  assertGcsSessionUri(body.sessionUri);
  return {
    filename: body.filename,
    mimeType: body.mimeType,
    fileSize: body.fileSize,
    originalName: body.originalName,
    jobId: body.jobId,
    businessId: body.businessId,
    employeeId: body.employeeId,
    kind,
    sessionUri: body.sessionUri,
    origin: body.origin,
    exp: body.exp,
  };
}
