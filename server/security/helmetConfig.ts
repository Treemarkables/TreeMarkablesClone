/**
 * App-wide security headers via helmet().
 *
 * Goal: `/login` and the SPA shell stop failing securityheaders.com on the
 * basics (HSTS, CSP, X-Frame-Options, Referrer-Policy, nosniff) without
 * blanking the SPA or breaking field/PWA/iOS login.
 *
 * CSP leftovers that stay on purpose (Wave 1 — nonce/hash rewrite is Wave-later):
 * - script-src 'unsafe-inline': gtag snippets + Capacitor FCM/notification boot
 *   scripts in client/index.html. Removing this blanks analytics and can race
 *   the iOS native-token capture.
 * - style-src 'unsafe-inline': index.html <style> block, Radix/Leaflet inline
 *   styles, Google Fonts CSS, a couple of page-level @import url() fonts.
 * - script-src 'unsafe-eval' in development only (Vite HMR).
 */
import helmet from "helmet";
import type { RequestHandler } from "express";

const isProduction = process.env.NODE_ENV !== "development";

const SCRIPT_SRC = [
  "'self'",
  "'unsafe-inline'",
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://www.googleadservices.com",
  "https://googleads.g.doubleclick.net",
  "https://www.google.com",
  "https://www.gstatic.com",
  "https://challenges.cloudflare.com",
  "https://js.stripe.com",
];

const STYLE_SRC = [
  "'self'",
  "'unsafe-inline'",
  "https://fonts.googleapis.com",
  "https://api.fontshare.com",
  "https://cdn.fontshare.com",
];

const FONT_SRC = [
  "'self'",
  "data:",
  "https://fonts.gstatic.com",
  "https://api.fontshare.com",
  "https://cdn.fontshare.com",
];

const FRAME_SRC = [
  "'self'",
  "https://challenges.cloudflare.com",
  "https://js.stripe.com",
  "https://hooks.stripe.com",
  "https://checkout.stripe.com",
  "https://maps.google.com",
  "https://www.google.com",
];

export function buildHelmetDirectives(): Record<string, string[] | null> {
  const scriptSrc = isProduction ? SCRIPT_SRC : [...SCRIPT_SRC, "'unsafe-eval'"];
  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    scriptSrc,
    styleSrc: STYLE_SRC,
    fontSrc: FONT_SRC,
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    mediaSrc: ["'self'", "data:", "blob:", "https:"],
    // https:/wss:/ws: rather than a host allow-list: Firebase, Sentry, Addy,
    // Nominatim, OSM tiles, Google Analytics, and Stripe all speak from
    // rotating subdomains. A tight list is how Wave 1 blanks the SPA.
    connectSrc: ["'self'", "https:", "wss:", "ws:", "blob:"],
    frameSrc: FRAME_SRC,
    workerSrc: ["'self'", "blob:"],
    manifestSrc: ["'self'"],
    upgradeInsecureRequests: isProduction ? [] : null,
  };
}

export function createHelmetMiddleware(): RequestHandler {
  return helmet({
    // COEP would block OSM tiles, GCS images, fonts, and Stripe without CORS
    // isolation we do not have. Helmet 8 defaults this off; pin it anyway.
    crossOriginEmbedderPolicy: false,
    // Google Calendar OAuth / Stripe can open a window; don't break popups.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    // HSTS only over TLS. Sending it on http://localhost poisons future
    // https://localhost visits and does not match production's 30-day sessions.
    hsts: isProduction
      ? { maxAge: 15552000, includeSubDomains: true, preload: false }
      : false,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: buildHelmetDirectives(),
    },
  });
}
