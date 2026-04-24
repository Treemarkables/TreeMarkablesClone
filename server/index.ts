// Force recompile 2025-11-24
import http from "http";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.ts";
import { setupTimeTrackingRoutes } from "./timeTrackingRoutes";
import { timeTrackingService } from "./timeTrackingService";
import { setupVite, log } from "./vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

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

// Increase JSON payload limit for large CSV imports (ServiceM8 data can be huge)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve root-level public/ folder as static files (PDFs, guides, etc.)
app.use(express.static(path.join(process.cwd(), 'public')));

// Configure session middleware with PostgreSQL store for persistence across server restarts
const PgSession = connectPgSimple(session);
const isDevelopment = process.env.NODE_ENV === 'development';

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
      secure: true,
      httpOnly: true,
      maxAge: isDevelopment
        ? 1000 * 60 * 60 * 24 * 90
        : 1000 * 60 * 60 * 24 * 30,
      sameSite: 'none',
      domain: isDevelopment ? undefined : '.treemarkables.co.nz',
    },
  })
);

console.log('✅ Session store: PostgreSQL (sessions persist across server restarts)');

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
  log(`Uncaught Exception: ${msg}`, "error");
  console.error('Stack trace:', stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise) => {
  const msg = reason?.message || String(reason);
  const stack = reason?.stack || '';
  if (isRecoverableDatabaseError(msg) || isRecoverableDatabaseError(stack)) {
    log(`Database connection promise rejected (recovering): ${msg}`, "error");
    return;
  }
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
  }, 60000);

  log("🔔 Notification queue worker started (checking every 60 seconds)", "startup");
}

(async () => {
  try {
    log("Starting server initialization...", "startup");

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
      `);
      log("✅ Background schema migrations complete", "startup");

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

  // Start background workers
  startNotificationQueueWorker();

  (async () => {
    try {
      const { startSMSReplyPolling } = await import('./services/smsReplyPoller');
      startSMSReplyPolling();
      const { startEmailReplyPolling } = await import('./services/emailReplyPoller');
      startEmailReplyPolling();
      const { marketingScheduler } = await import('./services/marketingScheduler');
      marketingScheduler.start();
    } catch (err) {
      log(`⚠️ Background worker startup warning: ${(err as Error).message}`, "startup");
    }
  })();
}
