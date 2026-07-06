// Runtime platform detection for the Capacitor iOS/Android shell vs the web app.
//
// Why this matters: Apple App Store Guideline 3.1.1 forbids selling digital
// subscriptions inside the iOS app via anything other than Apple In-App Purchase.
// Inflow bills B2B subscriptions through Stripe on the web (inflowapp.co.nz), so
// the native build must not surface any checkout / billing-portal CTA. Gate those
// purchase surfaces behind `!isNativeApp()`.

export function isNativeApp(): boolean {
  const cap = (window as any).Capacitor;
  return typeof cap !== "undefined" && !!cap.isNativePlatform?.();
}
