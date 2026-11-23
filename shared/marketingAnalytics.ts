/**
 * Treemarkables marketing tags.
 *
 * GOOGLE_ADS_ID is the only place the Google Ads account is set. Jullian is
 * still confirming AW-607851664 is the Treemarkables account. Change it here
 * and the marketing HTML snippet and the form events follow.
 *
 * There is no quote-form conversion label in the account snippet that was
 * already on the site. Form success sends a GA4 generate_lead event and the
 * same event to the Ads tag, so it can be imported or counted as an event
 * conversion. Phone clicks use the existing click-to-call label.
 */

export const GA4_MEASUREMENT_ID = "G-VK3PPB6SFW";

export const GOOGLE_ADS_ID = "AW-607851664";

/** Existing "Click to call" conversion on that Ads account. */
export const GOOGLE_ADS_CLICK_TO_CALL_LABEL = "ohyNCIf4spwbEJCp7KEC";

/**
 * Optional quote-form conversion label (the part after the slash).
 * Leave blank until that conversion action exists in Google Ads.
 */
export const GOOGLE_ADS_LEAD_LABEL = "";

export function googleAdsClickToCallSendTo(): string {
  return `${GOOGLE_ADS_ID}/${GOOGLE_ADS_CLICK_TO_CALL_LABEL}`;
}

export function googleAdsLeadSendTo(): string | null {
  const label = GOOGLE_ADS_LEAD_LABEL.trim();
  if (!label) return null;
  return `${GOOGLE_ADS_ID}/${label}`;
}

/**
 * Inline snippet for Treemarkables marketing HTML only.
 * Loads the Ads tag beside the GA4 tag already in client/index.html, and
 * records a phone click from every tel: link (including the prerender,
 * which has no React onClick).
 */
export function treemarkablesAdsSnippet(): string {
  const adsId = GOOGLE_ADS_ID;
  const ga4Id = GA4_MEASUREMENT_ID;
  const clickSendTo = googleAdsClickToCallSendTo();
  return `<script>
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
    gtag('config', '${adsId}');
    window.__tmReportPhone = function(url) {
      var now = Date.now();
      if (window.__tmPhoneAt && now - window.__tmPhoneAt < 1500) return false;
      window.__tmPhoneAt = now;
      var link = typeof url === 'string' ? url : '';
      gtag('event', 'phone_click', {
        send_to: '${ga4Id}',
        link_url: link,
        event_category: 'Contact',
        event_label: 'Phone Number Click'
      });
      gtag('event', 'conversion', {
        send_to: '${clickSendTo}',
        value: 1.0,
        currency: 'NZD'
      });
      return false;
    };
    document.addEventListener('click', function (event) {
      var node = event.target;
      while (node && node !== document) {
        if (node.tagName === 'A') {
          var href = node.getAttribute('href') || '';
          if (href.indexOf('tel:') === 0 && window.__tmReportPhone) window.__tmReportPhone(href);
          return;
        }
        node = node.parentNode;
      }
    }, true);
  </script>`;
}
