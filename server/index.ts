// Force recompile 2025-11-24
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

const app = express();

// Trust proxy - needed for secure cookies behind Replit's proxy
app.set('trust proxy', 1);

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
    resave: true, // Resave session on each request to prevent expiration during active use
    saveUninitialized: false,
    rolling: true, // Reset maxAge on every request to keep active sessions alive
    name: 'treemarkables.sid', // Custom cookie name (helps Safari)
    store: new PgSession({
      pool: pool as any, // Use PostgreSQL pool for persistent sessions
      tableName: 'session', // Session table name
      createTableIfMissing: true, // Auto-create session table
      pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
    }),
    cookie: {
      secure: true, // Replit always serves over HTTPS — required for sameSite: 'none'
      httpOnly: true,
      maxAge: isDevelopment 
        ? 1000 * 60 * 60 * 24 * 90  // 90 days in development for convenience
        : 1000 * 60 * 60 * 24 * 30,   // 30 days in production
      sameSite: 'none', // Allow cross-origin iframe (Replit preview pane + production)
      domain: isDevelopment ? undefined : '.treemarkables.co.nz', // Explicit domain in production
    },
  })
);

console.log('✅ Session store: PostgreSQL (sessions persist across server restarts)');

// Runtime static file serving with path resolution
function resolveAndServeStatic(app: express.Express) {
  log("Starting runtime static file path resolution...", "static");
  
  // Node-safe dirname resolution  
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
  // Check for explicit override via environment variable
  const staticDirOverride = process.env.STATIC_DIR;
  if (staticDirOverride) {
    log(`Using STATIC_DIR override: ${staticDirOverride}`, "static");
    const indexPath = path.join(staticDirOverride, "index.html");
    if (fs.existsSync(indexPath)) {
      log(`Verified index.html exists at override path: ${indexPath}`, "static");
      setupStaticServing(app, staticDirOverride);
      return;
    } else {
      log(`STATIC_DIR override path missing index.html: ${indexPath}`, "error");
      throw new Error(`STATIC_DIR override path is invalid: missing index.html at ${indexPath}`);
    }
  }

  // Try candidate paths in order of preference - BUILD OUTPUT FIRST
  const candidates = [
    path.resolve(process.cwd(), "dist/public"), // Build output directory (PRIORITY)
    path.resolve(__dirname, "..", "public"), // Project root/public  
    path.resolve(process.cwd(), "public"), // Fallback root public
    path.resolve(process.cwd(), "server/public"), // Alternative server location
    path.resolve(__dirname, "public"), // Current server/public (legacy fallback)
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
      setupStaticServing(app, candidatePath);
      return;
    }
  }

  // If no candidates worked, provide detailed error information
  log(`Failed to find static files in any candidate path`, "error");
  log(`Current working directory: ${process.cwd()}`, "error");
  log(`Server dirname: ${__dirname}`, "error");
  
  const allPaths = candidates.map((p, i) => `  ${i + 1}. ${p}`).join('\n');
  throw new Error(
    `Could not find static files with index.html in any of these locations:\n${allPaths}\n\nMake sure to build the client first with 'npm run build'`
  );
}

function setupStaticServing(app: express.Express, staticPath: string) {
  log(`Setting up Express static serving for: ${staticPath}`, "static");
  
  // CRITICAL: Force no-cache for PWA files to prevent iOS from using stale cached versions
  // iOS caches sw.js aggressively, which causes old JavaScript bundles to persist even after PWA reinstall
  app.use((req, res, next) => {
    const noCacheFiles = ['/sw.js', '/manifest.webmanifest', '/index.html'];
    
    if (noCacheFiles.some(file => req.path === file || req.path.endsWith(file))) {
      log(`🚫 Forcing no-cache for critical PWA file: ${req.path}`, "static");
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
  });
  
  // Serve static files with proper options
  app.use(express.static(staticPath, {
    fallthrough: true,
    redirect: false,
    index: false, // We handle index.html separately for better error handling
  }));

  // Handle SPA routing - serve index.html for all non-API routes
  app.use("*", (req, res, next) => {
    // Skip API routes - let them return 404 naturally
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }
    
    // Skip asset routes - stale cached assets should get 404, not index.html
    // (serving index.html for .js/.css requests causes "execute HTML as JS" crash)
    if (req.originalUrl.startsWith('/assets/') || req.originalUrl.match(/\.(js|css|map|woff|woff2|ttf|png|jpg|svg|ico)(\?.*)?$/)) {
      return res.status(404).send('Asset not found');
    }
    
    const indexPath = path.join(staticPath, "index.html");
    
    // Always serve index.html with no-cache so browsers never use a stale version
    // that references old content-hashed JS bundle filenames
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
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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

process.on('uncaughtException', (error) => {
  const msg = error.message || '';
  const stack = error.stack || '';
  if (isRecoverableDatabaseError(msg) || isRecoverableDatabaseError(stack)) {
    log(`Database connection error (recovering): ${msg}`, "error");
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
  log(`Unhandled Promise Rejection: ${msg}`, "error");
  console.error('Promise that was rejected:', promise);
  process.exit(1);
});

// Notification queue worker - processes pending notifications
function startNotificationQueueWorker() {
  log("🔔 Starting notification queue worker...", "startup");
  
  // Check queue every minute
  setInterval(async () => {
    try {
      const { storage } = await import("./storage");
      const { emailService } = await import("./services/emailService");
      const { smsService } = await import("./services/smsService");
      
      // Get pending notifications that are due
      const pendingNotifications = await storage.getPendingNotifications(new Date());
      
      if (pendingNotifications.length > 0) {
        log(`[Notification Queue] Processing ${pendingNotifications.length} pending notification(s)`, "startup");
      }
      
      for (const notification of pendingNotifications) {
        try {
          // Send email notification
          if (notification.recipientEmail && (notification.notificationType === 'email' || notification.notificationType === 'both')) {
            await emailService.sendEmail({
              to: notification.recipientEmail,
              subject: notification.subject || 'Job Notification',
              html: notification.message,
              text: notification.message.replace(/<[^>]*>/g, '') // Strip HTML for text version
            });
            log(`[Notification Queue] Email sent to ${notification.recipientEmail}`, "startup");
          }
          
          // Send SMS notification
          if (notification.recipientPhone && (notification.notificationType === 'sms' || notification.notificationType === 'both')) {
            const smsMessage = (notification.metadata as any)?.smsMessage || notification.message.replace(/<[^>]*>/g, '').substring(0, 160);
            await smsService.sendSMS({ 
              to: notification.recipientPhone, 
              message: smsMessage 
            });
            log(`[Notification Queue] SMS sent to ${notification.recipientPhone}`, "startup");
          }
          
          // Mark as sent
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
  }, 60000); // Run every minute
  
  log("🔔 Notification queue worker started (checking every 60 seconds)", "startup");
}

(async () => {
  try {
    log("Starting server initialization...", "startup");

    // Run startup migrations to ensure schema is up to date
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS checklist_templates (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          text TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      log("✅ Schema migration: checklist_templates ready", "startup");

      // Add customer_confirmed column to jobs table if it doesn't exist
      await pool.query(`
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_confirmed BOOLEAN NOT NULL DEFAULT false
      `);
      log("✅ Schema migration: jobs.customer_confirmed ready", "startup");

      // Add eta_notification_requested column to jobs table if it doesn't exist
      await pool.query(`
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eta_notification_requested BOOLEAN NOT NULL DEFAULT false
      `);
      log("✅ Schema migration: jobs.eta_notification_requested ready", "startup");

      // Create assistant_messages table for AI chat history
      await pool.query(`
        CREATE TABLE IF NOT EXISTS assistant_messages (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id VARCHAR NOT NULL,
          employee_id VARCHAR NOT NULL DEFAULT '',
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      // Backfill: add employee_id column if table was created without it
      await pool.query(`
        ALTER TABLE assistant_messages ADD COLUMN IF NOT EXISTS employee_id VARCHAR NOT NULL DEFAULT ''
      `);
      log("✅ Schema migration: assistant_messages ready", "startup");

      // Add default_gross_margin_pct to business_settings for analytics fallback
      await pool.query(`
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS default_gross_margin_pct NUMERIC(5,2) NOT NULL DEFAULT 0
      `);
      log("✅ Schema migration: business_settings.default_gross_margin_pct ready", "startup");

      // Add xero_default_bank_account_code to business_settings for reconciliation
      await pool.query(`
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS xero_default_bank_account_code TEXT
      `);
      log("✅ Schema migration: business_settings.xero_default_bank_account_code ready", "startup");

      // Add invoice_payment_days to business_settings
      await pool.query(`
        ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS invoice_payment_days INTEGER NOT NULL DEFAULT 7
      `);
      log("✅ Schema migration: business_settings.invoice_payment_days ready", "startup");

      // Add logo_size to document_templates
      await pool.query(`
        ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS logo_size INTEGER NOT NULL DEFAULT 40
      `);
      log("✅ Schema migration: document_templates.logo_size ready", "startup");

      // Add logo_alignment to document_templates
      await pool.query(`
        ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS logo_alignment TEXT NOT NULL DEFAULT 'left'
      `);
      log("✅ Schema migration: document_templates.logo_alignment ready", "startup");

      // Add header_color to document_templates
      await pool.query(`
        ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS header_color TEXT NOT NULL DEFAULT '#ffffff'
      `);
      log("✅ Schema migration: document_templates.header_color ready", "startup");

      // Add requires_pre_start to equipment
      await pool.query(`
        ALTER TABLE equipment ADD COLUMN IF NOT EXISTS requires_pre_start BOOLEAN NOT NULL DEFAULT false
      `);
      log("✅ Schema migration: equipment.requires_pre_start ready", "startup");

      // Add invoice_cc_email to customers for auto-CC on invoice emails
      await pool.query(`
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS invoice_cc_email TEXT
      `);
      log("✅ Schema migration: customers.invoice_cc_email ready", "startup");

      // Add block_config to document_templates for visual invoice block builder
      await pool.query(`
        ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS block_config JSONB
      `);
      log("✅ Schema migration: document_templates.block_config ready", "startup");
    } catch (migErr) {
      log(`⚠️ Schema migration warning: ${(migErr as Error).message}`, "startup");
    }
    
    // Register API routes with error handling
    let server;
    try {
      log("Registering API routes...", "startup");
      server = await registerRoutes(app);
      log("API routes registered successfully", "startup");
      
      // Register time tracking routes
      setupTimeTrackingRoutes(app);
      
      // Initialize time tracking sample data
      await timeTrackingService.initializeSampleData();
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

    // CRITICAL: Force no-cache for PWA files BEFORE any file serving middleware
    // This must run first to prevent iOS from caching sw.js, manifest, and index.html
    app.use((req, res, next) => {
      const noCacheFiles = ['/sw.js', '/manifest.webmanifest', '/index.html'];
      
      if (noCacheFiles.some(file => req.path === file || req.path.endsWith(file))) {
        log(`🚫 Forcing no-cache for critical PWA file: ${req.path}`, "startup");
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
      }
      next();
    });

    // Setup Vite dev server or static file serving with error handling
    const nodeEnv = app.get("env") || process.env.NODE_ENV || "development";
    log(`Environment: ${nodeEnv}`, "startup");
    
    if (nodeEnv === "development") {
      try {
        log("Setting up Vite development server...", "startup");
        await setupVite(app, server);
        log("Vite development server setup complete", "startup");
      } catch (error) {
        const err = error as Error;
        log(`Failed to setup Vite: ${err.message}`, "error");
        console.error('Vite setup error:', err.stack);
        throw error;
      }
    } else {
      try {
        log("Setting up static file serving for production...", "startup");
        resolveAndServeStatic(app);
        log("Static file serving setup complete", "startup");
      } catch (error) {
        const err = error as Error;
        log(`Failed to setup static file serving: ${err.message}`, "error");
        console.error('Static serving error:', err.stack);
        throw error;
      }
    }

    // Start the HTTP server with comprehensive error handling
    const port = parseInt(process.env.PORT || '5000', 10);
    log(`Starting HTTP server on port ${port}...`, "startup");
    
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`Server successfully started on port ${port}`, "startup");
      log(`Server ready to accept connections at http://0.0.0.0:${port}`, "startup");
    });

    // Handle server listen errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        log(`Port ${port} is already in use`, "error");
      } else if (error.code === 'EACCES') {
        log(`Permission denied to bind to port ${port}`, "error");
      } else {
        log(`Server error: ${error.message}`, "error");
      }
      console.error('Server error details:', error);
      process.exit(1);
    });

    // Graceful shutdown - properly close server and release port
    const gracefulShutdown = (signal: string) => {
      log(`Received ${signal}, shutting down gracefully...`, "startup");
      server.close(() => {
        log('HTTP server closed', "startup");
        pool.end().then(() => {
          log('Database pool closed', "startup");
          process.exit(0);
        }).catch(() => {
          process.exit(0);
        });
      });
      // Force exit after 5 seconds if graceful shutdown hangs
      setTimeout(() => {
        log('Forced shutdown after timeout', "error");
        process.exit(1);
      }, 5000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Start notification queue worker
    startNotificationQueueWorker();
    
    // Start SMS reply polling (polls every 60 seconds)
    const { startSMSReplyPolling } = await import('./services/smsReplyPoller');
    startSMSReplyPolling();

    // Start email reply polling (polls every 5 minutes)
    const { startEmailReplyPolling } = await import('./services/emailReplyPoller');
    startEmailReplyPolling();

    // Start marketing campaign scheduler (checks every 5 minutes)
    const { marketingScheduler } = await import('./services/marketingScheduler');
    marketingScheduler.start();

  } catch (error) {
    const err = error as Error;
    log(`Server initialization failed: ${err.message}`, "error");
    console.error('Initialization error stack:', err.stack);
    process.exit(1);
  }
})();
