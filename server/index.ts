import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupTimeTrackingRoutes } from "./timeTrackingRoutes";
import { timeTrackingService } from "./timeTrackingService";
import { setupVite, log } from "./vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import session from "express-session";
import createMemoryStore from "memorystore";

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

// Configure session middleware with memorystore
const MemoryStore = createMemoryStore(session);
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'treemarkables-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000, // Prune expired entries every 24h
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    },
  })
);

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
    
    const indexPath = path.join(staticPath, "index.html");
    
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

// Add process-level error handlers for better debugging
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, "error");
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Promise Rejection: ${reason}`, "error");
  console.error('Promise that was rejected:', promise);
  process.exit(1);
});

(async () => {
  try {
    log("Starting server initialization...", "startup");
    
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

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Request error: ${status} - ${message}`, "error");
      res.status(status).json({ message });
      throw err;
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

  } catch (error) {
    const err = error as Error;
    log(`Server initialization failed: ${err.message}`, "error");
    console.error('Initialization error stack:', err.stack);
    process.exit(1);
  }
})();
