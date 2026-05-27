// Sentry instrumentation — MUST be imported as the very first thing in
// server/index.ts so the OpenTelemetry-based Sentry Node SDK can patch
// modules (express, http, pg, etc.) at load time. If this is imported
// after other modules, breadcrumbs/spans go missing.
//
// Disabled entirely when SENTRY_DSN is unset (e.g. local dev without a
// DSN configured) so we don't spam Sentry from developer machines.
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",

    // Stay on the free tier — no performance tracing/profiling, just errors.
    tracesSampleRate: 0,

    // server/index.ts already filters these as "recoverable" at the
    // uncaughtException/unhandledRejection level. Drop them in Sentry too
    // so transient Neon/network blips don't dominate the 5k/mo quota.
    ignoreErrors: [
      "Connection terminated",
      "terminating connection",
      "connection unexpectedly",
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "EPIPE",
      "ENOTFOUND",
      "socket hang up",
      "neonConfig",
      "@neondatabase/serverless",
    ],
  });
  // eslint-disable-next-line no-console
  console.log(`✅ Sentry backend init (env=${process.env.NODE_ENV || "development"})`);
} else {
  // eslint-disable-next-line no-console
  console.log("ℹ️  SENTRY_DSN not set — backend error reporting disabled");
}
