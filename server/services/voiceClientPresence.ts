// Heartbeat for "this Voice identity has a live access token".
//
// Twilio does not offer a supported API to list registered Voice SDK
// devices. The app posts here after a successful register(), and the answer
// webhook treats an expired row as unregistered so the dial skips <Client>.
// Two app instances share this table; it is not process memory.
//
// No business_id column: the identity already embeds the business id, and a
// business_id column would need an RLS policy. The webhook and this write
// both use the owner pool.

import { pool } from "../db";

const IDENTITY = /^inflow-[A-Za-z0-9-]{8,160}$/;

let ensured: Promise<void> | null = null;

export function isVoiceIdentity(identity: string): boolean {
  return IDENTITY.test(identity);
}

function ensureTable(): Promise<void> {
  if (!ensured) {
    const pending = pool
      .query(
        `CREATE TABLE IF NOT EXISTS voice_client_presence (
           identity text PRIMARY KEY,
           expires_at timestamptz NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT NOW()
         )`,
      )
      .then(() => undefined);
    ensured = pending;
    pending.catch(() => {
      if (ensured === pending) ensured = null;
    });
  }
  return ensured;
}

export async function recordVoiceClientPresence(
  identity: string,
  ttlSeconds: number,
): Promise<void> {
  if (!isVoiceIdentity(identity)) return;
  const ttl = Math.max(60, Math.min(86_399, Math.floor(ttlSeconds)));
  await ensureTable();
  await pool.query(
    `INSERT INTO voice_client_presence (identity, expires_at, updated_at)
     VALUES ($1, NOW() + ($2::int * INTERVAL '1 second'), NOW())
     ON CONFLICT (identity) DO UPDATE
     SET expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
    [identity, ttl],
  );
}

export async function readVoiceClientPresence(
  identity: string,
): Promise<"registered" | "unregistered" | "unknown"> {
  if (!isVoiceIdentity(identity)) return "unknown";
  try {
    await ensureTable();
    const result = await pool.query(
      `SELECT expires_at > NOW() AS live
       FROM voice_client_presence
       WHERE identity = $1`,
      [identity],
    );
    const row = result.rows[0] as { live?: boolean } | undefined;
    if (!row) return "unknown";
    return row.live ? "registered" : "unregistered";
  } catch (err) {
    console.error("voice presence read failed — dialling the app anyway:", err);
    return "unknown";
  }
}
