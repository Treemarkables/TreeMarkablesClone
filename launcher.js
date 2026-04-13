'use strict';
// ────────────────────────────────────────────────────────────────────────────
// launcher.js — used in TWO ways:
//
// Mode A — direct entry point: `node launcher.js`
//   Binds port 5000 in <100ms, then setImmediate(() => require('./dist/index.js'))
//   dist/index.js detects global.__launcherServer and skips its own listen().
//
// Mode B — NODE_OPTIONS preload: NODE_OPTIONS="--require ./launcher.js"
//   Node loads this file BEFORE dist/index.js executes.  We bind the port
//   synchronously (OS bind is immediate), set globals, and return.
//   dist/index.js then runs normally and detects global.__launcherServer.
//
// Both modes skip the pre-bind entirely in development so the dev server is
// unaffected even if NODE_OPTIONS is set globally.
// ────────────────────────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV !== 'development';
const isDirectRun  = (require.main === module);

if (!isProduction) {
  // Development: do nothing — let the dev server (tsx) manage the port.
  if (isDirectRun) {
    console.log('[launcher] Development mode — launching app directly...');
    require('./dist/index.js');
  }
  // In --require mode, just exit silently.
  return; // CommonJS top-level return is fine
}

// ── Production only ──────────────────────────────────────────────────────────
const http = require('http');
const port = parseInt(process.env.PORT || '5000', 10);

// The shared handler starts as a "still starting" 200 response.
// dist/index.js will swap it to the real Express app once it's assembled.
global.__launcherHandler = function startingResponse(_req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'starting' }));
};

const server = http.createServer(function (req, res) {
  global.__launcherHandler(req, res);
});

// Expose the server so dist/index.js can attach shutdown handlers.
global.__launcherServer = server;

server.listen(port, '0.0.0.0', function () {
  const ms = Math.round(process.uptime() * 1000);
  console.log('[launcher] Port ' + port + ' bound in ' + ms + 'ms — loading app...');
});

server.on('error', function (err) {
  console.error('[launcher] Server error:', err);
  process.exit(1);
});

if (isDirectRun) {
  // Mode A: load the app after one event-loop tick so buffered health-check
  // connections can be processed before the synchronous require() starts.
  setImmediate(function () {
    try {
      require('./dist/index.js');
    } catch (err) {
      console.error('[launcher] Fatal: failed to load dist/index.js —', err);
      process.exit(1);
    }
  });
}
// Mode B (--require): dist/index.js will load automatically after this file returns.
