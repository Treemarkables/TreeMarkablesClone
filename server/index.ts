import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
        serveStatic(app);
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
