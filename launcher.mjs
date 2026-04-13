// launcher.mjs — ESM entry point for production deployment
// ────────────────────────────────────────────────────────────────────────────
// Binds port 5000 in <100ms, BEFORE the 1.4MB dist/index.js bundle is parsed.
//
// Problem: Node.js takes 5-7 seconds to JIT-parse dist/index.js. During that
// window nothing listens on port 5000, so Replit's health check gets
// "connection refused" and fails the deployment.
//
// Fix: This tiny launcher (loads in <100ms) binds the port first and returns
// HTTP 200 {"status":"starting"} to all requests. Once dist/index.js finishes
// loading, it detects globalThis.__launcherServer and attaches Express to it.
// ────────────────────────────────────────────────────────────────────────────
import http from 'http';

const port = parseInt(process.env.PORT || '5000', 10);

// Shared handler — starts as a minimal "still starting" 200 response.
// dist/index.js swaps this to the real Express app once it is ready.
globalThis.__launcherHandler = function startingResponse(_req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'starting' }));
};

const server = http.createServer(function (req, res) {
  globalThis.__launcherHandler(req, res);
});

// Expose the server so dist/index.js can attach graceful-shutdown handlers.
globalThis.__launcherServer = server;

await new Promise((resolve, reject) => {
  server.listen(port, '0.0.0.0', () => {
    const ms = Math.round(process.uptime() * 1000);
    console.log(`[launcher] Port ${port} bound in ${ms}ms — loading app...`);
    resolve(undefined);
  });
  server.on('error', reject);
});

// Dynamically import the main bundle. ESM await suspends this module and lets
// the event loop run — health checks that arrive while the 1.4MB bundle is
// being parsed will have their TCP connections accepted and queued.
// Once parsing finishes, dist/index.js runs synchronously, detects
// globalThis.__launcherServer, and installs the real Express handler.
await import('./dist/index.js');
