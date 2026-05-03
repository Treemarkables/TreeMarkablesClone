import pg from "pg";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Small pg.Pool kept solely for connect-pg-simple (session store).
// All Drizzle ORM queries use the Neon HTTP driver below, which makes
// stateless per-query HTTP requests — no persistent connections, no
// "Connection terminated due to connection timeout" errors on Neon.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 30000,
  ssl: process.env.DATABASE_URL?.includes('sslmode=')
    ? undefined
    : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Session pool error (non-fatal):', err.message);
});

// Neon HTTP driver — one HTTP request per query, zero persistent connections.
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
