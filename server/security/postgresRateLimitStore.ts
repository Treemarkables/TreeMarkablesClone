import type {
  Store,
  ClientRateLimitInfo,
  IncrementResponse,
  Options,
} from "express-rate-limit";
import { incrementRateLimit, resetRateLimitKey, getRateLimit } from "./rateLimitStore";

/**
 * express-rate-limit Store backed by the shared Postgres `rate_limits` table.
 * Keys are prefixed per-limiter so login / contact / signup counters never collide.
 */
export class PostgresRateLimitStore implements Store {
  prefix: string;
  windowMs = 60_000;
  /** Shared Postgres table — not per-process memory. */
  localKeys = false;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const row = await incrementRateLimit(this.fullKey(key), this.windowMs);
    return {
      totalHits: row.count,
      resetTime: row.resetAt,
    };
  }

  async decrement(_key: string): Promise<void> {
    // Not used (we do not skipSuccessfulRequests). No-op keeps the Store contract.
  }

  async resetKey(key: string): Promise<void> {
    await resetRateLimitKey(this.fullKey(key));
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const row = await getRateLimit(this.fullKey(key));
    if (!row) return undefined;
    return { totalHits: row.count, resetTime: row.resetAt };
  }
}
