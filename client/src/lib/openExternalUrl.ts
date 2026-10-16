/**
 * Open a tel:, mailto:, sms:, or off-site https URL from the Android shell.
 *
 * Capacitor's WebView does not implement window.open (supportMultipleWindows
 * stays off), so "Open in Google Maps" and Stripe Checkout did nothing.
 * Assigning location hits shouldOverrideUrlLoading, and the bridge hands
 * anything that is not the app host to the system via ACTION_VIEW. The page
 * itself stays put. Same-origin URLs keep window.open so a PDF or in-app
 * route is not navigated over the SPA on desktop.
 */

const SPECIAL = new Set(["tel:", "mailto:", "sms:"]);

export function shouldAssignInPlace(url: string, pageUrl: string, native: boolean): boolean {
  if (!native) return false;
  let parsed: URL;
  let page: URL;
  try {
    parsed = new URL(url, pageUrl);
    page = new URL(pageUrl);
  } catch {
    return true;
  }
  if (SPECIAL.has(parsed.protocol)) return true;
  return parsed.host !== page.host;
}

function isNativePlatform(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export function openExternalUrl(url: string): void {
  const pageUrl = window.location.href;
  if (shouldAssignInPlace(url, pageUrl, isNativePlatform())) {
    window.location.assign(new URL(url, pageUrl).href);
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(url, pageUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (SPECIAL.has(parsed.protocol)) {
    const a = document.createElement("a");
    a.href = parsed.href;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  window.open(parsed.href, "_blank", "noopener,noreferrer");
}
