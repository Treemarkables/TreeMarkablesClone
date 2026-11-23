import {
  GA4_MEASUREMENT_ID,
  GOOGLE_ADS_ID,
  googleAdsLeadSendTo,
} from "@shared/marketingAnalytics";

type Gtag = (...args: unknown[]) => void;

/**
 * Call only after POST /api/contact succeeds.
 * Sends GA4 generate_lead and the same event to the Google Ads tag.
 */
export function trackGenerateLead(label: string): void {
  const gtag = (window as Window & { gtag?: Gtag }).gtag;
  if (!gtag) return;
  const base = {
    event_category: "Contact",
    event_label: label,
    value: 1,
    currency: "NZD",
  };
  gtag("event", "generate_lead", { ...base, send_to: GA4_MEASUREMENT_ID });
  gtag("event", "generate_lead", { ...base, send_to: GOOGLE_ADS_ID });
  const leadSendTo = googleAdsLeadSendTo();
  if (leadSendTo) {
    gtag("event", "conversion", {
      send_to: leadSendTo,
      value: 1,
      currency: "NZD",
    });
  }
}
