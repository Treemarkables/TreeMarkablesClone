// Force recompile 2025-11-24
// IMPORTANT: ./instrument MUST be the very first import. The Sentry Node SDK
// patches modules (express, http, pg) at load time via OpenTelemetry — if it
// loads after other modules, breadcrumbs and stack-trace context go missing.
import "./instrument";
import * as Sentry from "@sentry/node";
import http from "http";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.ts";
import { APP_URL } from "./config/appUrl";
import { tenantContextMiddleware } from "./tenancy/tenantMiddleware";
import { requireApiAuth } from "./tenancy/requireApiAuth";
import { setupTimeTrackingRoutes } from "./timeTrackingRoutes";
import { timeTrackingService } from "./timeTrackingService";
import { setupVite, log } from "./vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, assertTenantDbMatchesOwner, assertTenantTablesHaveRlsPolicies } from "./db";
import { ensureSchemaUpToDate } from "./schemaMigrations";
import { attachVoiceAgentWss } from "./services/voiceAgent";

// Security: Configure dev login access (fail-safe: disabled by default, only enabled in development)
if (!process.env.ALLOW_EMPLOYEE_ID_LOGIN) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  process.env.ALLOW_EMPLOYEE_ID_LOGIN = isDevelopment ? 'true' : 'false';

  if (!isDevelopment) {
    console.warn(`[SECURITY] ALLOW_EMPLOYEE_ID_LOGIN auto-configured to 'false' (NODE_ENV=${process.env.NODE_ENV || 'undefined'}). Set NODE_ENV=development to enable dev login selector.`);
  } else {
    console.log(`[CONFIG] ALLOW_EMPLOYEE_ID_LOGIN auto-configured to 'true' for development mode.`);
  }
}

const port = parseInt(process.env.PORT || '5000', 10);
const isProduction = process.env.NODE_ENV !== 'development';

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION ONLY: Use the port already bound by launcher.js, OR bind it
// ourselves as a fallback (e.g. direct `node dist/index.js` without launcher).
//
// launcher.mjs binds port 5000 in <100ms (before Node finishes parsing this
// 1.4MB bundle). It sets globalThis.__launcherServer and globalThis.__launcherHandler.
// When this code runs (~5-7s later) we simply reuse that server and swap the
// handler from "starting" to the real Express app once it's ready.
// ─────────────────────────────────────────────────────────────────────────────
let productionHttpServer: http.Server | null = null;
// currentHandler is only used in the direct (no-launcher) fallback path.
let currentHandler: ((req: http.IncomingMessage, res: http.ServerResponse) => void) | null = null;

if (isProduction) {
  const launcherServer = (globalThis as any).__launcherServer as http.Server | undefined;

  if (launcherServer) {
    // ── Launcher path (normal production deployment) ──────────────────────
    // The port is already bound and health checks are already returning 200.
    productionHttpServer = launcherServer;
    log(`Reusing launcher's pre-bound server on port ${port}`, "startup");
  } else {
    // ── Fallback: direct start without launcher ───────────────────────────
    // Bind our own server with a switchable "starting" handler.
    currentHandler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'starting', env: process.env.NODE_ENV }));
    };

    productionHttpServer = http.createServer((req, res) => {
      if (currentHandler) currentHandler(req, res);
    });

    productionHttpServer.listen(port, "0.0.0.0", () => {
      log(`Port ${port} bound (direct start — no launcher)`, "startup");
    });

    productionHttpServer.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${port} is already in use`, "error");
      } else {
        log(`Server error: ${error.message}`, "error");
      }
      console.error('Server error details:', error);
      process.exit(1);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the full Express app
// ─────────────────────────────────────────────────────────────────────────────
const app = express();

// Trust proxy - needed for secure cookies behind Replit's proxy
app.set('trust proxy', 1);

// Health check endpoint — registered first, outside session middleware
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', env: process.env.NODE_ENV });
});

// Legacy-domain redirect. Customer document links already sent out (invoices,
// proposals, quotes, etc.) point at the old app host. The app now lives at
// APP_URL (app.inflowapp.co.nz). 301 the customer-facing paths to the new host
// so those old links keep working.
//
// Scoped to these path prefixes ONLY — NOT `/` or `/login` — so already-shipped
// native apps, which load the app root on the old host and whose origin guards
// expect it, keep working until they're rebuilt. The old host is grey-cloud
// (DNS-only) so this can't be a Cloudflare redirect rule; it has to live here.
//
// The APP_HOST !== legacy guard prevents a redirect loop if APP_URL is unset and
// still falls back to the old host.
const LEGACY_APP_HOST = 'app.treemarkables.co.nz';
const REDIRECT_PATH_PREFIXES = ['/proposal', '/invoice', '/quote', '/watch', '/review', '/customer-portal'];
const APP_HOST = (() => { try { return new URL(APP_URL).host; } catch { return ''; } })();
// Full cutover switch: when LEGACY_HOST_REDIRECT_ALL=true (set in DO once the
// owner is ready), EVERY browser page-load on the legacy app host 301s to
// APP_URL — not just the customer-link prefixes. Deliberately excluded even
// then:
//   - /api/*     — Twilio/Stripe/etc. webhooks still point at the old host
//                  (Stripe treats a 301 as delivery failure), and an already-
//                  open SPA tab keeps its session working mid-flight.
//   - /objects/* — media referenced from old emails/documents.
//   - non-GET/HEAD — form posts etc. must not lose their bodies to a redirect.
// ⚠️ Flipping this also moves the iOS shell (which still loads the old host,
// see capacitor allowNavigation) — sessions are per-host, so users get the
// login screen once. Coordinate with a native rebuild or accept the re-login.
const REDIRECT_ALL = (process.env.LEGACY_HOST_REDIRECT_ALL || '').trim().toLowerCase() === 'true';
app.use((req, res, next) => {
  if (APP_HOST && APP_HOST !== LEGACY_APP_HOST && req.hostname === LEGACY_APP_HOST) {
    const isCustomerLink = REDIRECT_PATH_PREFIXES.some(
      (p) => req.path === p || req.path.startsWith(p + '/'),
    );
    const isFullCutoverPath =
      REDIRECT_ALL &&
      (req.method === 'GET' || req.method === 'HEAD') &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/objects');
    if (isCustomerLink || isFullCutoverPath) {
      return res.redirect(301, `${APP_URL}${req.originalUrl}`);
    }
  }
  next();
});

// Increase JSON payload limit for large CSV imports (ServiceM8 data can be huge)
// The verify callback captures the raw body as a Buffer so webhook signature
// verification (e.g. Svix for Resend events) can work correctly alongside
// the normal JSON parsing middleware.
app.use(express.json({
  limit: '50mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve root-level public/ folder as static files (PDFs, guides, etc.)
app.use(express.static(path.join(process.cwd(), 'public')));

// Configure session middleware with PostgreSQL store for persistence across server restarts
const PgSession = connectPgSimple(session);
const isDevelopment = process.env.NODE_ENV === 'development';

// SESSION_SECRET signs the session cookie. If it's ever unset in production the
// cookie would be signed with a public literal from the repo — an attacker could
// then forge a valid session for any employee/business (defeating RLS too). Fail
// fast at boot rather than silently shipping a forgeable secret.
if (!isDevelopment && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production — refusing to start with a default signing secret');
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'treemarkables-dev-secret-change-in-production',
    resave: true,
    saveUninitialized: false,
    rolling: true,
    name: 'treemarkables.sid',
    store: new PgSession({
      pool: pool as any,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15,
    }),
    cookie: {
      // Local dev runs over http://localhost, where browsers silently drop a
      // `Secure` cookie — and `SameSite=None` *requires* Secure, so the session
      // cookie would never persist and every post-login /api/auth/me would 401,
      // bouncing the user back to /login. Use lax + non-secure in dev. Production
      // (https, PWA/iOS webview cross-site context) keeps secure + sameSite:none.
      secure: !isDevelopment,
      httpOnly: true,
      maxAge: isDevelopment
        ? 1000 * 60 * 60 * 24 * 90
        : 1000 * 60 * 60 * 24 * 30,
      sameSite: isDevelopment ? 'lax' : 'none',
      // Host-only cookie: omit domain so it scopes to app.treemarkables.co.nz
      // exactly. Domain-scoped cookies (.treemarkables.co.nz) caused PWA users
      // to lose sessions on Chrome's installed-PWA storage partition.
    },
  })
);

console.log('✅ Session store: PostgreSQL (sessions persist across server restarts)');

// Tenancy: bind each request to its business via AsyncLocalStorage (for write-path
// stamping), and — when TENANT_RLS_ENABLED — pin a tenant-scoped pooled connection so
// Postgres RLS enforces read isolation. Must come after session middleware. With the
// flag off this only sets businessId (no pooled connection) — exact current behaviour.
app.use(tenantContextMiddleware);

// Global API auth backstop — 401 for unauthenticated /api/* calls that aren't on
// the public allowlist, so authorization no longer depends solely on RLS. Flag-
// gated (API_AUTH_ENFORCED, default off); roll out + smoke-test like RLS.
app.use(requireApiAuth);

// Runtime static file serving with path resolution
function resolveAndServeStatic(appInstance: express.Express) {
  log("Starting runtime static file path resolution...", "static");

  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const staticDirOverride = process.env.STATIC_DIR;
  if (staticDirOverride) {
    log(`Using STATIC_DIR override: ${staticDirOverride}`, "static");
    const indexPath = path.join(staticDirOverride, "index.html");
    if (fs.existsSync(indexPath)) {
      log(`Verified index.html exists at override path: ${indexPath}`, "static");
      setupStaticServing(appInstance, staticDirOverride);
      return;
    } else {
      throw new Error(`STATIC_DIR override path is invalid: missing index.html at ${indexPath}`);
    }
  }

  const candidates = [
    path.resolve(process.cwd(), "dist/public"),
    path.resolve(__dirname, "..", "public"),
    path.resolve(process.cwd(), "public"),
    path.resolve(process.cwd(), "server/public"),
    path.resolve(__dirname, "public"),
  ];

  log(`Testing ${candidates.length} candidate paths for static files:`, "static");

  for (let i = 0; i < candidates.length; i++) {
    const candidatePath = candidates[i];
    const indexPath = path.join(candidatePath, "index.html");
    const exists = fs.existsSync(indexPath);

    log(`  ${i + 1}. ${candidatePath} - ${exists ? 'FOUND' : 'NOT FOUND'}`, "static");

    if (exists) {
      log(`Selected static directory: ${candidatePath}`, "static");
      log(`Verified index.html at: ${indexPath}`, "static");
      setupStaticServing(appInstance, candidatePath);
      return;
    }
  }

  const allPaths = candidates.map((p, i) => `  ${i + 1}. ${p}`).join('\n');
  throw new Error(
    `Could not find static files with index.html in any of these locations:\n${allPaths}\n\nMake sure to build the client first with 'npm run build'`
  );
}

function setupStaticServing(appInstance: express.Express, staticPath: string) {
  log(`Setting up Express static serving for: ${staticPath}`, "static");

  appInstance.use((req, res, next) => {
    const noCacheFiles = ['/sw.js', '/manifest.webmanifest', '/index.html'];
    if (noCacheFiles.some(file => req.path === file || req.path.endsWith(file))) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
  });

  appInstance.use(express.static(staticPath, {
    fallthrough: true,
    redirect: false,
    index: false,
    setHeaders: (res, filePath) => {
      // Vite content-hashes everything under /assets/ (index-C5HqaHu6.js), so
      // those files are safe to cache forever — a new build gets new names.
      // Without this they ship with the express.static default (max-age=0),
      // so every visit refetches every chunk and any transient server blip
      // during a deploy rollout becomes a visible "Failed to fetch dynamically
      // imported module" crash. index.html / sw.js / manifest are NOT under
      // /assets/ and keep their no-store headers from the middleware above.
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  appInstance.use("*", (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }

    if (req.originalUrl.startsWith('/assets/') || req.originalUrl.match(/\.(js|css|map|woff|woff2|ttf|png|jpg|svg|ico)(\?.*)?$/)) {
      return res.status(404).send('Asset not found');
    }

    const indexPath = path.join(staticPath, "index.html");

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    log(`Serving SPA fallback: ${req.originalUrl} -> index.html`, "static");

    res.sendFile(indexPath, (err) => {
      if (err) {
        log(`Error serving index.html: ${err.message}`, "error");
        res.status(500).json({
          error: "Failed to serve application",
          details: err.message
        });
      }
    });
  });

  log(`Static file serving setup completed successfully`, "static");
}

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

function isRecoverableDatabaseError(msg: string): boolean {
  const patterns = [
    'Connection terminated',
    'terminating connection',
    'connection unexpectedly',
    'Cannot set property message of',
    'ErrorEvent',
    '_handleErrorWhileConnecting',
    '_handleErrorEvent',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'socket hang up',
    'neonConfig',
    '@neondatabase/serverless',
  ];
  return patterns.some(p => msg.includes(p));
}

const RECOVERABLE_NETWORK_PATTERNS = [
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND',
  'socket hang up', 'read ECONNRESET', 'write ECONNRESET',
  'imap', 'IMAP', 'tls', 'TLS', 'ssl', 'SSL',
];

process.on('uncaughtException', (error) => {
  const msg = error.message || '';
  const stack = error.stack || '';
  if (isRecoverableDatabaseError(msg) || isRecoverableDatabaseError(stack)) {
    log(`Database connection error (recovering): ${msg}`, "error");
    return;
  }
  const isNetworkError = RECOVERABLE_NETWORK_PATTERNS.some(p => msg.includes(p) || stack.includes(p));
  if (isNetworkError) {
    log(`Network/IMAP connection error (recovering — not crashing): ${msg}`, "error");
    return;
  }
  // Non-recoverable: report to Sentry before we exit. Flush so the event
  // actually leaves the process before process.exit kills us.
  Sentry.captureException(error);
  Sentry.flush(2000).finally(() => {
    log(`Uncaught Exception: ${msg}`, "error");
    console.error('Stack trace:', stack);
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason: any, promise) => {
  const msg = reason?.message || String(reason);
  const stack = reason?.stack || '';
  if (isRecoverableDatabaseError(msg) || isRecoverableDatabaseError(stack)) {
    log(`Database connection promise rejected (recovering): ${msg}`, "error");
    return;
  }
  // Real rejection — report to Sentry. We don't exit (see comment below) so
  // no flush is required; Sentry's background transport will deliver it.
  Sentry.captureException(reason);
  // Log but do NOT exit — crashing the entire server over a background task
  // error causes a restart loop that is far more disruptive than the error itself.
  log(`Unhandled Promise Rejection (recovered): ${msg}`, "error");
  console.error('Unhandled rejection stack:', stack || '(no stack)');
});

// Notification queue worker - processes pending notifications
function startNotificationQueueWorker() {
  log("🔔 Starting notification queue worker...", "startup");

  setInterval(async () => {
    try {
      const { storage } = await import("./storage");
      const { emailService } = await import("./services/emailService");
      const { smsService } = await import("./services/smsService");

      const pendingNotifications = await storage.getPendingNotifications(new Date());

      if (pendingNotifications.length > 0) {
        log(`[Notification Queue] Processing ${pendingNotifications.length} pending notification(s)`, "startup");
      }

      for (const notification of pendingNotifications) {
        try {
          if (notification.recipientEmail && (notification.notificationType === 'email' || notification.notificationType === 'both')) {
            await emailService.sendEmail({
              to: notification.recipientEmail,
              subject: notification.subject || 'Job Notification',
              html: notification.message,
              text: notification.message.replace(/<[^>]*>/g, '')
            });
            log(`[Notification Queue] Email sent to ${notification.recipientEmail}`, "startup");
          }

          if (notification.recipientPhone && (notification.notificationType === 'sms' || notification.notificationType === 'both')) {
            const smsMessage = (notification.metadata as any)?.smsMessage || notification.message.replace(/<[^>]*>/g, '').substring(0, 160);
            await smsService.sendSMS({
              to: notification.recipientPhone,
              message: smsMessage
            });
            log(`[Notification Queue] SMS sent to ${notification.recipientPhone}`, "startup");
          }

          await storage.markNotificationSent(notification.id);
          log(`[Notification Queue] Notification ${notification.id} marked as sent`, "startup");

        } catch (error) {
          const err = error as Error;
          log(`[Notification Queue] Failed to send notification ${notification.id}: ${err.message}`, "error");
          await storage.markNotificationFailed(notification.id, err.message);
        }
      }
    } catch (error) {
      const err = error as Error;
      log(`[Notification Queue] Worker error: ${err.message}`, "error");
    }

    // Process customer-facing booking reminders on the same tick. Kept on
    // the same interval so we don't add a second background loop.
    try {
      const { processDueReminders } = await import("./services/bookingReminderService");
      await processDueReminders();
    } catch (error) {
      const err = error as Error;
      log(`[Booking Reminders] Worker error: ${err.message}`, "error");
    }

    // Vehicle compliance expiry reminders (rego / CoF / scheduled service).
    // Self-throttles to hourly internally and is idempotent via the
    // equipment_compliance_reminders dedupe table, so the 60s tick is safe.
    try {
      const { runComplianceReminderScan } = await import("./services/complianceReminderService");
      await runComplianceReminderScan();
    } catch (error) {
      const err = error as Error;
      log(`[Compliance Reminders] Worker error: ${err.message}`, "error");
    }
  }, 60000);

  log("🔔 Notification queue worker started (checking every 60 seconds)", "startup");
}

(async () => {
  try {
    log("Starting server initialization...", "startup");

    // Fail fast if the tenant connection points at a different database than the
    // owner connection (a wrong DIRECT_DATABASE_URL once made prod data appear to
    // "vanish" — owner-path login worked, tenant reads hit an empty branch). Refuse
    // to boot so the misconfig surfaces as an obvious deploy failure.
    try {
      await assertTenantDbMatchesOwner();
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }

    // Tenant-isolation backstop: any business_id table without an RLS policy is
    // cross-tenant readable under the app_tenant grant. Logs loudly; hard-fails
    // only under TENANT_RLS_STRICT (then the outer catch exits). Runs after the
    // self-healing boot DDL on the previous deploy has had a chance to add policies.
    await assertTenantTablesHaveRlsPolicies();

    // Self-healing schema: bring the database up to match the deployed code so a
    // schema change can't silently outrun the prod DB (caused the deposit-column /
    // billing-table scrambles). Non-fatal — log loudly but keep booting, so a
    // transient migration hiccup doesn't take the whole app down.
    try {
      await ensureSchemaUpToDate();
      log("✅ Schema up to date", "startup");
    } catch (e) {
      console.error("[schema] boot migrations failed (continuing):", e);
    }

    let devServer: http.Server | undefined;
    try {
      log("Registering API routes...", "startup");
      // registerRoutes creates an http.Server internally (used for Vite in dev mode)
      devServer = await registerRoutes(app);
      log("API routes registered successfully", "startup");
      setupTimeTrackingRoutes(app);
    } catch (error) {
      const err = error as Error;
      log(`Failed to register routes: ${err.message}`, "error");
      console.error('Route registration error:', err.stack);
      throw error;
    }

    // Sentry Express error handler — MUST be after all routes/middleware are
    // registered but BEFORE our custom error handler below. It captures the
    // error and passes it on, so our handler still controls the HTTP response.
    Sentry.setupExpressErrorHandler(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      if (!res.headersSent) {
        const errMsg = err?.message || '';
        const errStack = err?.stack || '';
        if (isRecoverableDatabaseError(errMsg) || isRecoverableDatabaseError(errStack)) {
          log(`Transient DB error in request (503): ${errMsg}`, "error");
          res.status(503).json({ message: "Service temporarily unavailable, please retry" });
          return;
        }
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        log(`Request error: ${status} - ${message}`, "error");
        res.status(status).json({ message });
      }
    });

    app.use((req, res, next) => {
      const noCacheFiles = ['/sw.js', '/manifest.webmanifest', '/index.html'];
      if (noCacheFiles.some(file => req.path === file || req.path.endsWith(file))) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
      }
      next();
    });

    const nodeEnv = app.get("env") || process.env.NODE_ENV || "development";
    log(`Environment: ${nodeEnv}`, "startup");

    if (nodeEnv === "development") {
      // Development: use the server created by registerRoutes (Vite needs it for HMR WebSocket)
      try {
        log("Setting up Vite development server...", "startup");
        await setupVite(app, devServer!);
        log("Vite development server setup complete", "startup");
      } catch (error) {
        const err = error as Error;
        log(`Failed to setup Vite: ${err.message}`, "error");
        throw error;
      }

      // Voice agent media stream (Twilio <Stream>) — path-filtered upgrade
      // listener that coexists with Vite's HMR WebSocket on the same server.
      attachVoiceAgentWss(devServer!);

      // In development, listen on the devServer (Vite's server)
      devServer!.listen(port, "0.0.0.0", () => {
        log(`Server successfully started on port ${port}`, "startup");
        log(`Server ready to accept connections at http://0.0.0.0:${port}`, "startup");
        startBackgroundWorkersAfterListen();
      });

      devServer!.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          log(`Port ${port} is already in use`, "error");
        } else {
          log(`Server error: ${error.message}`, "error");
        }
        console.error('Server error details:', error);
        process.exit(1);
      });

      const gracefulShutdown = (signal: string) => {
        log(`Received ${signal}, shutting down gracefully...`, "startup");
        devServer!.close(() => {
          pool.end().then(() => process.exit(0)).catch(() => process.exit(0));
        });
        setTimeout(() => process.exit(1), 5000);
      };
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } else {
      // Production: static file serving, then switch the pre-bound server to the Express app
      try {
        log("Setting up static file serving for production...", "startup");
        resolveAndServeStatic(app);
        log("Static file serving setup complete", "startup");
      } catch (error) {
        const err = error as Error;
        log(`Failed to setup static file serving: ${err.message}`, "error");
        throw error;
      }

      // Switch the production server to use the full Express app.
      // If the launcher pre-bound the port, update its global handler.
      // If we bound the port ourselves (fallback), update currentHandler.
      if ((globalThis as any).__launcherHandler !== undefined) {
        (globalThis as any).__launcherHandler = app;
      } else {
        currentHandler = app as any;
      }

      // Voice agent media stream (Twilio <Stream>) — attach to the pre-bound
      // production server. Upgrades arriving in the boot window before this
      // line are dropped; the IVR TwiML's <Redirect> fallback dials Jules.
      if (productionHttpServer) {
        attachVoiceAgentWss(productionHttpServer);
      }
      log(`Server fully initialised — Express app now active on port ${port}`, "startup");
      log(`Server ready to accept connections at http://0.0.0.0:${port}`, "startup");

      startBackgroundWorkersAfterListen();

      const gracefulShutdown = (signal: string) => {
        log(`Received ${signal}, shutting down gracefully...`, "startup");
        productionHttpServer!.close(() => {
          pool.end().then(() => process.exit(0)).catch(() => process.exit(0));
        });
        setTimeout(() => {
          log('Forced shutdown after timeout', "error");
          process.exit(1);
        }, 5000);
      };
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }

  } catch (error) {
    const err = error as Error;
    log(`Server initialization failed: ${err.message}`, "error");
    console.error('Initialization error stack:', err.stack);
    process.exit(1);
  }
})();

// Cron-style background workers (notification queue, SMS/email pollers,
// marketing scheduler) run inside the web process. When two instances of the
// app are pointed at the same database — e.g. during the Replit→DO migration
// soak window — only ONE must run them, otherwise SMS/FCM/FB publishes fire
// twice. RUN_CRONS=false on the standby instance suppresses them.
const cronsEnabled = process.env.RUN_CRONS !== 'false';

function startBackgroundWorkersAfterListen() {
  // Run schema migrations in the background AFTER the server is listening
  (async () => {
    try {
      log("Running background schema migrations...", "startup");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS checklist_templates (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          text TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_confirmed BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eta_notification_requested BOOLEAN NOT NULL DEFAULT false;
        CREATE TABLE IF NOT EXISTS assistant_messages (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id VARCHAR NOT NULL,
          employee_id VARCHAR NOT NULL DEFAULT '',
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS employee_id VARCHAR NOT NULL DEFAULT '';
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS default_gross_margin_pct NUMERIC(5,2) NOT NULL DEFAULT 0;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_default_bank_account_code TEXT;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS invoice_payment_days INTEGER NOT NULL DEFAULT 7;
        ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS logo_size INTEGER NOT NULL DEFAULT 40;
        ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS logo_alignment TEXT NOT NULL DEFAULT 'left';
        ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS header_color TEXT NOT NULL DEFAULT '#ffffff';
        ALTER TABLE equipment ADD COLUMN IF NOT EXISTS requires_pre_start BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS invoice_cc_email TEXT;
        ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS block_config JSONB;
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS booking_reminders_enabled BOOLEAN DEFAULT false;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS auto_quote_followup_enabled BOOLEAN DEFAULT false;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS quote_followup_channel TEXT DEFAULT 'sms';
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS quote_followup_max_attempts INTEGER DEFAULT 2;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS booking_reminders_enabled BOOLEAN DEFAULT false;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS booking_reminder_channel TEXT DEFAULT 'both';
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS booking_reminder_offsets JSONB DEFAULT '[{"hoursBefore":24,"label":"24 hours before"}]'::jsonb;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS booking_reminder_email_template_id VARCHAR;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS booking_reminder_sms_template_id VARCHAR;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS booking_reminder_default_on BOOLEAN DEFAULT false;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS inquiry_auto_reply_enabled BOOLEAN DEFAULT true;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS inquiry_auto_reply_channel TEXT DEFAULT 'email';
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS inquiry_auto_reply_email_subject TEXT DEFAULT 'We''ve received your inquiry — {businessName}';
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS inquiry_auto_reply_email_message TEXT DEFAULT 'Hi {customerName},

Thanks for getting in touch with {businessName}. We''ve received your inquiry and we''ll be in touch within 24 hours to schedule your quote.

If it''s urgent, feel free to reply to this email or give us a call.

Thanks,
The {businessName} Team';
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS inquiry_auto_reply_sms_message TEXT DEFAULT 'Hi {firstName}, thanks for your inquiry with {businessName}. We''ll be in touch within 24 hours to schedule your quote.';
        -- The ADD COLUMNs above are no-ops on an existing DB, so SET the new
        -- {businessName}-token defaults explicitly (fillVars substitutes the tenant's
        -- name at send time). Existing rows keep their stored text; Treemarkables is
        -- unchanged. Generic ('there'-style) so a non-tree tenant isn't pre-branded TM.
        ALTER TABLE business_settings ALTER COLUMN inquiry_auto_reply_email_subject SET DEFAULT 'We''ve received your inquiry — {businessName}';
        ALTER TABLE business_settings ALTER COLUMN inquiry_auto_reply_email_message SET DEFAULT 'Hi {customerName},

Thanks for getting in touch with {businessName}. We''ve received your inquiry and we''ll be in touch within 24 hours to schedule your quote.

If it''s urgent, feel free to reply to this email or give us a call.

Thanks,
The {businessName} Team';
        ALTER TABLE business_settings ALTER COLUMN inquiry_auto_reply_sms_message SET DEFAULT 'Hi {firstName}, thanks for your inquiry with {businessName}. We''ll be in touch within 24 hours to schedule your quote.';
        CREATE TABLE IF NOT EXISTS booking_reminders (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          job_id VARCHAR NOT NULL,
          scheduled_for TIMESTAMP NOT NULL,
          channel TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          manual BOOLEAN NOT NULL DEFAULT false,
          offset_hours INTEGER,
          recipient_email TEXT,
          recipient_phone TEXT,
          subject TEXT,
          email_body TEXT,
          sms_body TEXT,
          sent_at TIMESTAMP,
          email_sent BOOLEAN DEFAULT false,
          sms_sent BOOLEAN DEFAULT false,
          error TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS booking_reminders_job_id_idx ON booking_reminders (job_id);
        CREATE INDEX IF NOT EXISTS booking_reminders_pending_idx ON booking_reminders (status, scheduled_for);
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS compliance_reminders_enabled BOOLEAN DEFAULT true;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS compliance_reminder_offsets JSONB DEFAULT '[30, 7]'::jsonb;
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS job_reply_forward_email TEXT;
        CREATE TABLE IF NOT EXISTS equipment_compliance_reminders (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id VARCHAR,
          equipment_id VARCHAR NOT NULL,
          kind TEXT NOT NULL,
          expiry_date TEXT NOT NULL,
          offset_days INTEGER NOT NULL,
          sent_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS equipment_compliance_reminders_uniq ON equipment_compliance_reminders (equipment_id, kind, expiry_date, offset_days);
        -- This table carries business_id but shipped without an RLS policy, so under
        -- the blanket app_tenant GRANT it was cross-tenant readable/writable even with
        -- RLS on. ENABLE (not FORCE) + tenant_isolation policy closes that. The boot
        -- backstop (assertTenantTablesHaveRlsPolicies) guards against a repeat.
        ALTER TABLE equipment_compliance_reminders ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation ON equipment_compliance_reminders;
        CREATE POLICY tenant_isolation ON equipment_compliance_reminders
          USING (business_id = nullif(current_setting('app.current_business', true), ''))
          WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
            GRANT SELECT, INSERT, UPDATE, DELETE ON equipment_compliance_reminders TO app_tenant;
          END IF;
        END $$;
        -- tree_markers drifted from shared/schema.ts: the bootstrap DDL never had
        -- business_id and no RLS policy exists, so under the blanket app_tenant GRANT
        -- it was cross-tenant readable/writable. Mirrors
        -- migrations/manual/20260709_tree_markers_business_id_rls.sql.
        ALTER TABLE tree_markers ADD COLUMN IF NOT EXISTS business_id VARCHAR;
        UPDATE tree_markers tm SET business_id = j.business_id
          FROM jobs j WHERE tm.job_id = j.id AND tm.business_id IS NULL;
        ALTER TABLE tree_markers ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation ON tree_markers;
        CREATE POLICY tenant_isolation ON tree_markers
          USING (business_id = nullif(current_setting('app.current_business', true), ''))
          WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
            GRANT SELECT, INSERT, UPDATE, DELETE ON tree_markers TO app_tenant;
          END IF;
        END $$;
        -- Site-map photo mode: markers can live on an uploaded image instead
        -- of the satellite map (council jobs where the card address is the
        -- billing address, not the site). Mirrors
        -- migrations/manual/20260710_site_map_photo_mode.sql.
        ALTER TABLE tree_markers ADD COLUMN IF NOT EXISTS surface TEXT NOT NULL DEFAULT 'map';
        CREATE TABLE IF NOT EXISTS job_site_maps (
          business_id VARCHAR,
          job_id VARCHAR PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
          image_url TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE job_site_maps ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation ON job_site_maps;
        CREATE POLICY tenant_isolation ON job_site_maps
          USING (business_id = nullif(current_setting('app.current_business', true), ''))
          WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
            GRANT SELECT, INSERT, UPDATE, DELETE ON job_site_maps TO app_tenant;
          END IF;
        END $$;
        -- Live job timers (clock in/out). Stopping a timer writes into
        -- jobs.staff_time_entries. Mirrors
        -- migrations/manual/20260710_active_timers.sql.
        CREATE TABLE IF NOT EXISTS active_timers (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id VARCHAR,
          job_id VARCHAR NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
          employee_id VARCHAR NOT NULL UNIQUE,
          started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE active_timers ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation ON active_timers;
        CREATE POLICY tenant_isolation ON active_timers
          USING (business_id = nullif(current_setting('app.current_business', true), ''))
          WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
            GRANT SELECT, INSERT, UPDATE, DELETE ON active_timers TO app_tenant;
          END IF;
        END $$;
        -- Heal job-child rows created behind multer with the wrong tenant stamp:
        -- busboy's stream callbacks run in the socket's async context, so those
        -- upload handlers lost the ALS tenant context — withTenant() stamped
        -- nothing and inserts took the column DEFAULT (Treemarkables'
        -- business_id): correct for TM by accident, wrong AND invisible under RLS
        -- for every other tenant. The routes now stamp from the job row; these
        -- idempotent updates restamp any child row that disagrees with its parent
        -- job. Mirrors migrations/manual/20260710_multer_child_rows_backfill.sql.
        UPDATE job_diary_entries d SET business_id = j.business_id
          FROM jobs j WHERE d.job_id = j.id AND d.business_id IS DISTINCT FROM j.business_id;
        UPDATE photos p SET business_id = j.business_id
          FROM jobs j WHERE p.job_id = j.id AND p.business_id IS DISTINCT FROM j.business_id;
        UPDATE notifications n SET business_id = j.business_id
          FROM jobs j WHERE n.job_id = j.id AND n.business_id IS DISTINCT FROM j.business_id;
        UPDATE job_quoting_process_completions q SET business_id = j.business_id
          FROM jobs j WHERE q.job_id = j.id AND q.business_id IS DISTINCT FROM j.business_id;
        CREATE TABLE IF NOT EXISTS role_checklist_tasks (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          role_key VARCHAR NOT NULL,
          item_id TEXT NOT NULL UNIQUE,
          label TEXT NOT NULL,
          icon_name TEXT NOT NULL DEFAULT 'Check',
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_enabled BOOLEAN NOT NULL DEFAULT true,
          is_built_in BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO role_checklist_tasks (role_key, item_id, label, icon_name, sort_order, is_built_in) VALUES
          ('A', 'risk-assessment',     'Risk assessment',                'Shield',         0, true),
          ('A', 'content-creation',    'Content creation',               'Camera',         1, true),
          ('B', 'alert-customer-late', 'Alert customer if running late', 'PhoneCall',      0, true),
          ('B', 'signs-out',           'Signs out',                      'TriangleAlert',  1, true),
          ('B', 'pre-start',           'Pre-start',                      'ClipboardCheck', 2, true),
          ('B', 'day-progress-update', 'Day progress update to Jules',   'MessageSquare',  3, true),
          ('C', 'time-tracking',       'Time tracking',                  'Clock',          0, true),
          ('C', 'review-request',      'Request review from client',     'Star',           1, true)
        ON CONFLICT (item_id) DO NOTHING;
      `);

      // --- Safety module (Tier 1) tables — idempotent create + seed ---
      await pool.query(`
        CREATE TABLE IF NOT EXISTS toolbox_talk_topics (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT UNIQUE,
          title TEXT NOT NULL,
          category TEXT,
          talking_points TEXT,
          is_built_in BOOLEAN NOT NULL DEFAULT false,
          is_active BOOLEAN NOT NULL DEFAULT true,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS toolbox_talks (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          talk_number TEXT NOT NULL UNIQUE,
          topic_id VARCHAR,
          title TEXT NOT NULL,
          job_id VARCHAR,
          location TEXT,
          presenter_name TEXT,
          presenter_id VARCHAR,
          conducted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          created_by VARCHAR,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS toolbox_talk_attendees (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          talk_id VARCHAR NOT NULL REFERENCES toolbox_talks(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          employee_id VARCHAR,
          signature_data_url TEXT,
          signed_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS toolbox_talk_attendees_talk_idx ON toolbox_talk_attendees (talk_id);

        CREATE TABLE IF NOT EXISTS prestart_checklist_templates (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT UNIQUE,
          equipment_type TEXT NOT NULL,
          name TEXT NOT NULL,
          items JSONB NOT NULL DEFAULT '[]'::jsonb,
          is_built_in BOOLEAN NOT NULL DEFAULT false,
          is_active BOOLEAN NOT NULL DEFAULT true,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS prestart_checklists (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          check_number TEXT NOT NULL UNIQUE,
          template_id VARCHAR,
          equipment_type TEXT NOT NULL,
          equipment_name TEXT,
          job_id VARCHAR,
          operator_name TEXT,
          operator_id VARCHAR,
          results JSONB NOT NULL DEFAULT '[]'::jsonb,
          passed BOOLEAN NOT NULL DEFAULT true,
          faults_noted TEXT,
          signature_data_url TEXT,
          conducted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS safety_assets (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          asset_tag TEXT,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          serial_number TEXT,
          manufacturer TEXT,
          in_service_date TIMESTAMP,
          inspection_frequency_days INTEGER NOT NULL DEFAULT 180,
          last_inspected_at TIMESTAMP,
          next_inspection_due TIMESTAMP,
          status TEXT NOT NULL DEFAULT 'in_service',
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS asset_inspections (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          asset_id VARCHAR NOT NULL REFERENCES safety_assets(id) ON DELETE CASCADE,
          inspector_name TEXT,
          inspector_id VARCHAR,
          result TEXT NOT NULL DEFAULT 'pass',
          notes TEXT,
          inspected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          next_inspection_due TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS asset_inspections_asset_idx ON asset_inspections (asset_id);

        CREATE TABLE IF NOT EXISTS competency_types (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT UNIQUE,
          name TEXT NOT NULL,
          category TEXT,
          requires_expiry BOOLEAN NOT NULL DEFAULT true,
          is_built_in BOOLEAN NOT NULL DEFAULT false,
          is_active BOOLEAN NOT NULL DEFAULT true,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS employee_competencies (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id VARCHAR NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          competency_type_id VARCHAR,
          competency_name TEXT NOT NULL,
          issuer TEXT,
          reference_number TEXT,
          issue_date TIMESTAMP,
          expiry_date TIMESTAMP,
          cert_file_path TEXT,
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS employee_competencies_emp_idx ON employee_competencies (employee_id);

        CREATE TABLE IF NOT EXISTS swms_templates (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT UNIQUE,
          name TEXT NOT NULL,
          category TEXT,
          activity_description TEXT,
          default_ppe TEXT[] DEFAULT '{}',
          steps JSONB NOT NULL DEFAULT '[]'::jsonb,
          is_built_in BOOLEAN NOT NULL DEFAULT false,
          is_active BOOLEAN NOT NULL DEFAULT true,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS swms_documents (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          swms_number TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          job_id VARCHAR,
          activity_description TEXT,
          location TEXT,
          ppe_required TEXT[] DEFAULT '{}',
          high_risk_work TEXT[] DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'draft',
          prepared_by TEXT,
          prepared_by_id VARCHAR,
          created_by VARCHAR,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS swms_steps (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          swms_id VARCHAR NOT NULL REFERENCES swms_documents(id) ON DELETE CASCADE,
          step_number INTEGER NOT NULL,
          task_step TEXT NOT NULL,
          hazards TEXT[] DEFAULT '{}',
          controls TEXT[] DEFAULT '{}',
          risk_rating INTEGER,
          responsible_person TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS swms_steps_swms_idx ON swms_steps (swms_id);
        CREATE TABLE IF NOT EXISTS swms_signatures (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          swms_id VARCHAR NOT NULL REFERENCES swms_documents(id) ON DELETE CASCADE,
          worker_name TEXT NOT NULL,
          worker_id VARCHAR,
          signature_data_url TEXT NOT NULL,
          signed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS swms_signatures_swms_idx ON swms_signatures (swms_id);

        CREATE TABLE IF NOT EXISTS notifiable_events (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          event_number TEXT NOT NULL UNIQUE,
          event_type TEXT NOT NULL,
          classification JSONB DEFAULT '{}'::jsonb,
          occurred_at TIMESTAMP NOT NULL,
          location TEXT,
          job_id VARCHAR,
          description TEXT NOT NULL,
          immediate_actions TEXT,
          people_involved JSONB DEFAULT '[]'::jsonb,
          worksafe_notifiable BOOLEAN NOT NULL DEFAULT true,
          worksafe_notified BOOLEAN NOT NULL DEFAULT false,
          worksafe_notified_at TIMESTAMP,
          notification_method TEXT,
          worksafe_reference TEXT,
          scene_preserved BOOLEAN NOT NULL DEFAULT false,
          notify_due_by TIMESTAMP,
          retention_until TIMESTAMP,
          investigation_findings TEXT,
          root_cause TEXT,
          corrective_actions JSONB DEFAULT '[]'::jsonb,
          status TEXT NOT NULL DEFAULT 'open',
          created_by VARCHAR,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed built-in arborist template libraries (idempotent on key)
      await pool.query(`
        INSERT INTO toolbox_talk_topics (key, title, category, talking_points, is_built_in, sort_order) VALUES
          ('chainsaw-safe-use', 'Chainsaw kickback & safe use', 'Equipment', E'Inspect chain brake, throttle interlock and chain catcher\nKeep chain sharp and correctly tensioned\nStand to the side of the cut, never straddle the bar\nWatch the kickback zone (upper tip of the bar)\nMaintain firm two-handed grip and stable footing', true, 0),
          ('chipper-feed-safety', 'Wood chipper feed safety', 'Equipment', E'Test the feed-stop bar and emergency stop before use\nFeed butt-end first and let go - never push material in\nKeep clear of the no-go feed zone\nNo loose clothing, drawstrings or frayed gloves\nNever reach into the feed chute', true, 1),
          ('powerline-awareness', 'Powerline awareness (NZECP 34)', 'Environmental', E'Treat all lines as live\nKeep 4m from lines up to 110kV (6m above)\nConfirm voltage and any network operator permit\nNo metal tools, ropes or limbs inside the safe zone\nStop work and call the lines company if unsure', true, 2),
          ('drop-zones', 'Drop zones & exclusion zones', 'Tree Work', E'Mark the drop zone and exclusion zone before cutting\nKeep a two tree-length clearance for felling\nUse a spotter for public and traffic\nConfirm everyone is clear before each cut\nAgree clear verbal and whistle signals', true, 3),
          ('working-at-height', 'Working at height & aerial rescue', 'Tree Work', E'No lone climbing above 3m - a trained ground person must be present\nConfirm anchor points and continuous attachment\nHave an aerial rescue plan briefed before climbing\nInspect harness, ropes and connectors pre-use\nMonitor wind and weather cut-off thresholds', true, 4),
          ('manual-handling', 'Manual handling', 'General', E'Assess the load before lifting\nBend the knees, keep the back straight\nTeam-lift heavy logs and gear\nUse mechanical aids where possible\nClear the path and watch footing', true, 5),
          ('wasps-bees', 'Wasps, bees & wildlife', 'Environmental', E'Scan the tree for nests before starting\nKnow who carries allergies and where the kit is\nHave a retreat plan if disturbed\nWatch for protected species and nesting birds', true, 6),
          ('fatigue-heat', 'Fatigue & heat management', 'General', E'Hydrate regularly and take breaks in shade\nWatch for signs of heat stress and fatigue\nRotate demanding tasks\nApply sunscreen and cover up for UV', true, 7),
          ('public-safety', 'Public & pedestrian safety', 'General', E'Set up signage and barriers for the public\nUse a spotter on footpaths and driveways\nPause work when people approach the zone\nKeep the site tidy and trip-free', true, 8),
          ('vehicle-reversing', 'Vehicle movements & reversing', 'Equipment', E'Use a spotter when reversing the truck or chipper\nWalk around the vehicle before moving\nAgree reversing signals\nCheck load restraint before driving', true, 9),
          ('lone-work-comms', 'Lone work & site communications', 'General', E'Confirm comms (phone or radio) work on site\nAgree check-in times\nKnow the site address for emergency services\nBrief the emergency and first-aid plan', true, 10)
        ON CONFLICT (key) DO NOTHING;

        INSERT INTO prestart_checklist_templates (key, equipment_type, name, items, is_built_in, sort_order) VALUES
          ('chainsaw', 'chainsaw', 'Chainsaw daily pre-start', '[{"id":"chain-brake","label":"Chain brake & throttle interlock work"},{"id":"chain","label":"Chain sharp & correctly tensioned"},{"id":"bar","label":"Bar & sprocket condition"},{"id":"catcher","label":"Chain catcher fitted"},{"id":"anti-vibe","label":"Anti-vibration mounts intact"},{"id":"fuel","label":"Fuel & bar oil topped up, no leaks"},{"id":"muffler","label":"Muffler & guards secure"},{"id":"ppe","label":"Operator PPE (chaps, helmet, hearing, eye)"}]', true, 0),
          ('chipper', 'chipper', 'Wood chipper pre-start', '[{"id":"guards","label":"Guards & covers secure"},{"id":"estop","label":"Emergency stop / feed-stop bar works"},{"id":"rollers","label":"Feed rollers & reverse function"},{"id":"blades","label":"Blades / knives sharp & secure"},{"id":"hydraulics","label":"Hydraulic hoses - no leaks"},{"id":"tow","label":"Tow hitch & lights (if towable)"},{"id":"nogo","label":"No-go feed zone marked"},{"id":"ppe","label":"Operator PPE"}]', true, 1),
          ('stump_grinder', 'stump_grinder', 'Stump grinder pre-start', '[{"id":"guards","label":"Guards & debris shielding fitted"},{"id":"teeth","label":"Cutter teeth condition & tightness"},{"id":"belts","label":"Hydraulic & belt condition"},{"id":"services","label":"Underground services checked (beforeUdig)"},{"id":"wheels","label":"Wheels / tracks & brakes"},{"id":"controls","label":"Controls & emergency stop"},{"id":"exclusion","label":"Exclusion zone set"},{"id":"ppe","label":"Operator PPE"}]', true, 2),
          ('ewp', 'ewp', 'EWP / MEWP daily pre-use', '[{"id":"function","label":"Function & emergency lowering test"},{"id":"controls","label":"Upper & lower controls operate"},{"id":"outriggers","label":"Tyres / outriggers / levelling"},{"id":"anchor","label":"Guardrails & harness anchor point"},{"id":"cof","label":"Current engineer certificate (CoF) in date"},{"id":"ground","label":"Ground conditions & slope assessed"},{"id":"overhead","label":"Overhead hazards checked"},{"id":"licence","label":"Operator licence current"}]', true, 3),
          ('rigging', 'rigging', 'Rigging & winch check', '[{"id":"ropes","label":"Ropes & slings free of damage"},{"id":"swl","label":"SWL within limits (no overloading)"},{"id":"wire","label":"No knots in wire rope"},{"id":"blocks","label":"Blocks, pulleys & karabiners locked"},{"id":"lowering","label":"Lowering device condition"},{"id":"anchors","label":"Anchor points sound"},{"id":"signals","label":"Whistle / comms signals agreed"}]', true, 4),
          ('vehicle', 'vehicle', 'Vehicle / trailer pre-trip', '[{"id":"wof","label":"WOF / COF in date"},{"id":"tyres","label":"Tyres, lights & indicators"},{"id":"brakes","label":"Brakes & handbrake"},{"id":"load","label":"Load restrained & within limits"},{"id":"coupling","label":"Trailer coupling & safety chains"},{"id":"mirrors","label":"Mirrors & windscreen"},{"id":"fluids","label":"Fluids & no leaks"},{"id":"firstaid","label":"First aid kit & fire extinguisher present"}]', true, 5)
        ON CONFLICT (key) DO NOTHING;

        INSERT INTO competency_types (key, name, category, requires_expiry, is_built_in, sort_order) VALUES
          ('nzc-arb-l3', 'NZ Certificate in Arboriculture L3', 'arboriculture', false, true, 0),
          ('nzc-arb-l4', 'NZ Certificate in Arboriculture L4', 'arboriculture', false, true, 1),
          ('chainsaw-ticket', 'Chainsaw use & maintenance (US 6917/23411)', 'chainsaw', false, true, 2),
          ('tree-felling', 'Tree felling (US 17257/17258)', 'chainsaw', false, true, 3),
          ('climbing-rigging', 'Climbing & dismantling / rigging', 'arboriculture', false, true, 4),
          ('aerial-rescue', 'Aerial rescue', 'arboriculture', true, true, 5),
          ('ewp-licence', 'EWP / MEWP operator licence', 'ewp', true, true, 6),
          ('first-aid', 'First aid certificate', 'first_aid', true, true, 7),
          ('growsafe', 'Growsafe (agrichemical)', 'agrichemical', true, true, 8),
          ('stms', 'STMS / TTM qualification', 'traffic', true, true, 9),
          ('class2-licence', 'Class 2 driver licence', 'driver', true, true, 10),
          ('wtr-endorsement', 'Wheels/Tracks/Rollers (WTR) endorsement', 'driver', true, true, 11)
        ON CONFLICT (key) DO NOTHING;

        INSERT INTO swms_templates (key, name, category, activity_description, default_ppe, steps, is_built_in, sort_order) VALUES
          ('felling', 'Tree felling (manual)', 'Tree Work', 'Manual felling of standing trees with a chainsaw', '{"Helmet","Eye protection","Hearing protection","Hi-vis","Chainsaw chaps","Safety boots","Gloves"}',
            '[{"stepNumber":1,"taskStep":"Site & tree assessment","hazards":["Deadwood / defects","Overhead lines","Public / property"],"controls":["Inspect tree & surrounds","Confirm NZECP 34 distances","Set exclusion zone (2 tree lengths)"],"riskRating":3},{"stepNumber":2,"taskStep":"Plan felling direction & escape","hazards":["Tree lean / wind","Struck-by falling tree"],"controls":["Assess lean & wind","Clear two escape routes at 45 degrees","Brief crew & agree signals"],"riskRating":3},{"stepNumber":3,"taskStep":"Make cuts & fell","hazards":["Chainsaw injury","Kickback","Barber chair"],"controls":["Scarf & back cut leaving a hinge","Use wedges as required","No one in the drop zone"],"riskRating":4},{"stepNumber":4,"taskStep":"Process & clear","hazards":["Manual handling","Chipper feed"],"controls":["Limb from the uphill side","Follow chipper SWMS"],"riskRating":2}]', true, 0),
          ('climbing-dismantle', 'Climbing & dismantling', 'Tree Work', 'Sectional dismantling of a tree by a climbing arborist', '{"Helmet","Eye protection","Hearing protection","Climbing harness","Chainsaw chaps","Safety boots","Gloves"}',
            '[{"stepNumber":1,"taskStep":"Pre-climb inspection","hazards":["Tree defects","Anchor failure"],"controls":["Assess tree integrity","Select sound anchor points","Inspect harness, ropes & connectors"],"riskRating":3},{"stepNumber":2,"taskStep":"Access & position","hazards":["Fall from height"],"controls":["Continuous attachment","Trained ground person present","Aerial rescue plan briefed"],"riskRating":4},{"stepNumber":3,"taskStep":"Rig & lower sections","hazards":["Struck-by","Rigging overload"],"controls":["Within rigging SWL","Clear drop zone","Agreed signals with grounds crew"],"riskRating":4}]', true, 1),
          ('chipping', 'Wood chipping', 'Equipment', 'Chipping brash and limbs through a wood chipper', '{"Helmet","Eye protection","Hearing protection","Hi-vis","Safety boots","Close-fitting gloves"}',
            '[{"stepNumber":1,"taskStep":"Set up & checks","hazards":["Entanglement","Machine fault"],"controls":["Complete chipper pre-start","Test feed-stop bar & E-stop","Mark no-go feed zone"],"riskRating":3},{"stepNumber":2,"taskStep":"Feed material","hazards":["Drawn in / entanglement","Ejected debris"],"controls":["Feed butt-end first and release","No loose clothing","Stand to the side of the chute"],"riskRating":4}]', true, 2),
          ('stump-grinding', 'Stump grinding', 'Equipment', 'Grinding tree stumps below ground level', '{"Helmet","Eye protection","Hearing protection","Hi-vis","Safety boots","Gloves"}',
            '[{"stepNumber":1,"taskStep":"Locate services & set up","hazards":["Underground services strike"],"controls":["beforeUdig check","Confirm clearances","Set exclusion zone & shielding"],"riskRating":3},{"stepNumber":2,"taskStep":"Grind stump","hazards":["Ejected debris","Struck-by"],"controls":["Keep bystanders clear","Use debris shielding","Operator PPE"],"riskRating":3}]', true, 3),
          ('roadside', 'Roadside tree work (TTM)', 'Traffic', 'Tree work on or near a road requiring traffic management', '{"Helmet","Eye protection","Hearing protection","Hi-vis","Safety boots","Gloves"}',
            '[{"stepNumber":1,"taskStep":"Traffic management setup","hazards":["Vehicle strike","Public"],"controls":["TMP per NZGTTM","Qualified STMS on site","Cones, signs & speed control in place"],"riskRating":4},{"stepNumber":2,"taskStep":"Carry out tree work","hazards":["Struck-by","Falling material on road"],"controls":["Spotter for traffic","Drop zone clear of carriageway","Follow felling / climbing SWMS"],"riskRating":4}]', true, 4),
          ('powerline', 'Powerline-adjacent tree work', 'Environmental', 'Tree work near overhead electrical conductors', '{"Helmet","Eye protection","Hearing protection","Hi-vis","Insulated where required","Safety boots","Gloves"}',
            '[{"stepNumber":1,"taskStep":"Confirm voltage & permits","hazards":["Electrocution"],"controls":["Treat all lines as live","Confirm voltage & NZECP 34 distance","Obtain network operator permit if inside zone"],"riskRating":5},{"stepNumber":2,"taskStep":"Work to safe distances","hazards":["Contact with conductor","Conductive limbs/tools"],"controls":["Maintain minimum approach distance","No metal tools or wet ropes in the zone","Stop work if distances cannot be kept"],"riskRating":5}]', true, 5)
        ON CONFLICT (key) DO NOTHING;
      `);

      // --- Per-business GST number (trade-gen Phase A) ---
      // Isolated from the big block (its own try/catch) and split into two queries:
      // the column add + the TM seed are kept out of one batched statement to dodge a
      // first-run parse quirk, and so a hiccup here can't skip the other migrations.
      // Mirrors migrations/manual/20260627_business_gst_number.sql.
      try {
        await pool.query(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS business_gst_number TEXT DEFAULT ''`);
        await pool.query(
          `UPDATE business_settings SET business_gst_number = '131-047-592-GST004'
            WHERE business_name = 'Treemarkables' AND (business_gst_number IS NULL OR business_gst_number = '')`,
        );
      } catch (gstErr) {
        log(`⚠️ business_gst_number migration warning: ${(gstErr as Error).message}`, "startup");
      }

      // --- Per-business invoice bank details (trade-gen Phase A) ---
      // Same isolated + split-statement pattern. Seed TM's real details by name so
      // its invoices are unchanged; new tenants stay empty (no payment block shown,
      // never TM's account). Mirrors migrations/manual/20260627_business_bank_details.sql.
      try {
        await pool.query(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS bank_account_name TEXT DEFAULT ''`);
        await pool.query(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS bank_account_number TEXT DEFAULT ''`);
        await pool.query(
          `UPDATE business_settings SET bank_account_name = 'Treemarkables Ltd', bank_account_number = '06-0637-0768850-00'
            WHERE business_name = 'Treemarkables' AND (bank_account_number IS NULL OR bank_account_number = '')`,
        );
      } catch (bankErr) {
        log(`⚠️ business bank-details migration warning: ${(bankErr as Error).message}`, "startup");
      }

      // --- Universal identity defaults (trade-gen) ---
      // Neutralise the column defaults so NEW tenants start trade-agnostic, not as
      // Jules/arborist/tree. Schema-only + idempotent; existing rows (incl.
      // Treemarkables) keep their values. The demo-row cleanup lives in the manual
      // migration (20260628_universal_identity_defaults.sql) so a data change isn't
      // applied automatically.
      try {
        await pool.query(`ALTER TABLE business_settings ALTER COLUMN owner_name SET DEFAULT ''`);
        await pool.query(`ALTER TABLE business_settings ALTER COLUMN business_tagline SET DEFAULT ''`);
        await pool.query(`ALTER TABLE business_settings ALTER COLUMN business_discipline SET DEFAULT ''`);
        await pool.query(`ALTER TABLE business_settings ALTER COLUMN industry SET DEFAULT 'general'`);
        await pool.query(`ALTER TABLE business_settings ALTER COLUMN business_name SET DEFAULT 'My Business'`);
      } catch (identErr) {
        log(`⚠️ identity-defaults migration warning: ${(identErr as Error).message}`, "startup");
      }

      // --- Per-business speech-to-quote vocabulary (trade-gen) ---
      // Adds the column + seeds Treemarkables with its exact tree vocab by name, so
      // its Whisper bias is unchanged; new tenants stay blank (generic bias).
      // Mirrors migrations/manual/20260628_trade_vocabulary.sql.
      try {
        await pool.query(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS trade_vocabulary TEXT DEFAULT ''`);
        await pool.query(
          `UPDATE business_settings SET trade_vocabulary = 'New Zealand tree services walkthrough. Species: pohutukawa, manuka, kanuka, kauri, totara, rimu, kahikatea, miro, tawa, rewarewa, kowhai, ribbonwood, pittosporum, cabbage tree, ti kouka, gleditsia, magnolia, oak, pine, eucalyptus, gum tree, macrocarpa, leyland cypress, willow, poplar, silver birch, plum. Operations: prune, lift, crown reduction, deadwood, remove, fell, dismantle, stump grind, mulch, chip, firewood lengths, cleanup.'
            WHERE business_name = 'Treemarkables' AND (trade_vocabulary IS NULL OR trade_vocabulary = '')`,
        );
      } catch (vocabErr) {
        log(`⚠️ trade-vocabulary migration warning: ${(vocabErr as Error).message}`, "startup");
      }

      // --- Stripe Connect (per-tenant card payments) columns ---
      // Mirrors migrations/manual/20260628_stripe_connect.sql.
      try {
        await pool.query(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT DEFAULT ''`);
        await pool.query(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN DEFAULT false`);
      } catch (connectErr) {
        log(`⚠️ stripe-connect migration warning: ${(connectErr as Error).message}`, "startup");
      }

      // --- Neutralize document_templates' Treemarkables identity defaults ---
      // Mirrors migrations/manual/20260628_document_template_neutral_defaults.sql.
      // Blank the TM-hardcoded column defaults (existing rows unchanged, TM keeps its
      // values) + clear leftover TM defaults from non-TM templates (TM excluded by id).
      try {
        for (const col of ['company_name', 'company_address', 'company_email', 'company_phone', 'gst_number']) {
          await pool.query(`ALTER TABLE document_templates ALTER COLUMN ${col} SET DEFAULT ''`);
        }
        await pool.query(
          `UPDATE document_templates
              SET company_name='', company_address='', company_email='', company_phone='', gst_number=''
            WHERE business_id IS DISTINCT FROM (SELECT business_id FROM business_settings WHERE business_name='Treemarkables' LIMIT 1)
              AND company_name='Treemarkables LTD' AND company_address='213 Stanley road, Gisborne'
              AND company_email='quotes@treemarkables.nz' AND company_phone='027 216 6882'
              AND gst_number='131-047-592-GST004'`,
        );
      } catch (tmplErr) {
        log(`⚠️ document-template-defaults migration warning: ${(tmplErr as Error).message}`, "startup");
      }

      // --- Backfill default document templates for pre-#276 tenants ---
      // Idempotent: seeds the 3 defaults (scoped + identity from the business's own
      // settings) for any business that has NONE — e.g. the demo tenant — so their
      // public proposal/quote/invoice views stop falling back to Treemarkables'
      // template. Businesses that already have templates are skipped. See onboarding.ts.
      try {
        const { backfillMissingDocumentTemplates } = await import('./onboarding');
        await backfillMissingDocumentTemplates();
      } catch (backfillErr) {
        log(`⚠️ document-template backfill warning: ${(backfillErr as Error).message}`, "startup");
      }

      // --- Per-business email brand colours (trade-gen Phase A) ---
      // Header background + accent for branded customer emails. Defaults reproduce
      // Treemarkables' black + neon-green so every existing email is unchanged until
      // a business picks its own; no TM seed needed (the default IS TM's brand).
      // Mirrors migrations/manual/20260628_business_brand_colors.sql.
      try {
        await pool.query(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS brand_header_color TEXT DEFAULT '#0b0b0b'`);
        await pool.query(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS brand_accent_color TEXT DEFAULT '#39FF14'`);
      } catch (brandErr) {
        log(`⚠️ brand-colours migration warning: ${(brandErr as Error).message}`, "startup");
      }

      // --- Inbound channel → tenant map (Group B tenant-resolution infra) ---
      // Resolves a dialed number / inbound SMS sender / email recipient / FB page
      // id to the owning business, so session-less webhooks stop defaulting writes
      // to the column-default tenant and stop matching callers across all tenants.
      // ENABLE (not FORCE) RLS so the owner connection resolves across tenants while
      // app_tenant only sees its own rows. Grant guarded — app_tenant may not exist
      // in dev. Mirrors migrations/manual/20260627_tenant_channels.sql.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tenant_channels (
          id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id  VARCHAR NOT NULL,
          channel_type TEXT NOT NULL,
          identifier   TEXT NOT NULL,
          label        TEXT,
          is_active    BOOLEAN NOT NULL DEFAULT true,
          created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS tenant_channels_type_identifier_idx
          ON tenant_channels (channel_type, identifier);
        CREATE INDEX IF NOT EXISTS tenant_channels_business_idx
          ON tenant_channels (business_id);
        ALTER TABLE tenant_channels ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS tenant_isolation ON tenant_channels;
        CREATE POLICY tenant_isolation ON tenant_channels
          USING (business_id = nullif(current_setting('app.current_business', true), ''))
          WITH CHECK (business_id = nullif(current_setting('app.current_business', true), ''));
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN
            GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_channels TO app_tenant;
          END IF;
        END $$;
      `);
      // Seed the existing tenant's channels from the single-tenant ENV config so
      // resolution works immediately. Idempotent; a 2nd tenant registers its own.
      try {
        const { rows } = await pool.query(
          `SELECT bs.business_id, bs.business_email
             FROM business_settings bs
             ORDER BY (bs.id = 'default') DESC, bs.created_at ASC
             LIMIT 1`,
        );
        let seedBusinessId: string | undefined = rows[0]?.business_id ?? undefined;
        if (!seedBusinessId) {
          const fallback = await pool.query(`SELECT id FROM businesses ORDER BY created_at ASC LIMIT 1`);
          seedBusinessId = fallback.rows[0]?.id ?? undefined;
        }
        if (seedBusinessId) {
          const { seedChannelsFromEnv } = await import('./tenancy/channelMap');
          await seedChannelsFromEnv(seedBusinessId, rows[0]?.business_email ?? null);
        }
      } catch (channelSeedErr) {
        log(`⚠️ Tenant-channel seed warning: ${(channelSeedErr as Error).message}`, "startup");
      }

      try {
        const { seedDefaultBlockConfig } = await import('./seedTemplates');
        await seedDefaultBlockConfig();
      } catch (seedErr) {
        log(`⚠️ Block config seed warning: ${(seedErr as Error).message}`, "startup");
      }

      await timeTrackingService.initializeSampleData();
      log("✅ Background initialization complete", "startup");
    } catch (bgErr) {
      log(`⚠️ Background migration warning: ${(bgErr as Error).message}`, "startup");
    }
  })();

  // Start background workers (only on the leader instance — see cronsEnabled)
  if (!cronsEnabled) {
    log("⏸️  RUN_CRONS=false — background cron workers suppressed on this instance", "startup");
    return;
  }

  startNotificationQueueWorker();

  (async () => {
    try {
      const { startSMSReplyPolling } = await import('./services/smsReplyPoller');
      startSMSReplyPolling();
      const { startEmailReplyPolling } = await import('./services/emailReplyPoller');
      startEmailReplyPolling();
      const { marketingScheduler } = await import('./services/marketingScheduler');
      marketingScheduler.start();
      const { startHealthCheckWorker } = await import('./services/healthCheck');
      startHealthCheckWorker();
      const { startGoogleCalendarPoller } = await import('./services/googleCalendarSync');
      startGoogleCalendarPoller();
    } catch (err) {
      log(`⚠️ Background worker startup warning: ${(err as Error).message}`, "startup");
    }
  })();
}
