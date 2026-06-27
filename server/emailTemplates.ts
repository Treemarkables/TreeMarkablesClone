/**
 * Shared branded email templates — proposal, invoice, quote.
 *
 * Designed for max compatibility with Apple Mail, Gmail, Outlook web.
 * Uses table-based layout + inline styles (the safe lowest-common-denominator
 * for HTML email; flexbox/grid is unreliable in Outlook desktop).
 *
 * Brand per CLAUDE.md:
 *   - Neon green: #39FF14
 *   - Header: black background (#0b0b0b) with neon-green wordmark
 *   - Customer-facing URLs hardcoded to https://app.treemarkables.co.nz
 */

const BRAND = {
  neon: '#39FF14',
  black: '#0b0b0b',
  ink: '#0f172a',
  muted: '#64748b',
  line: '#e5e7eb',
  surface: '#f8fafc',
  pageBg: '#f3f4f6',
} as const;

const COMPANY = {
  name: 'Treemarkables LTD',
  tagline: 'Professional Arborists · Gisborne',
  address: '213 Stanley Road, Gisborne',
  phone: '027 216 6882',
  email: 'quotes@treemarkables.nz',
  gstNumber: '131-047-592-GST004',
  appUrl: 'https://app.treemarkables.co.nz',
} as const;

export interface BrandedEmailOptions {
  /** Customer's name for the greeting. */
  customerName: string;
  /** Lead paragraph (markdown-free plain text — newlines preserved). */
  intro: string;
  /** Small label above the total — e.g. "Proposal #PRO-1234". */
  documentLabel: string;
  /** Dollar amount displayed in the info card (incl. GST). */
  totalAmount: number;
  /** Subtitle next to the total — defaults to "incl. GST". */
  totalLabel?: string;
  /** Primary call-to-action button text. */
  ctaText: string;
  /** Primary call-to-action button URL. */
  ctaUrl: string;
  /** Small helper line under the CTA button. */
  ctaHint?: string;
  /** Optional extra small note shown below the CTA hint. */
  fineprint?: string;
  /** Business identity for the header + footer. Each field defaults to
   *  Treemarkables (COMPANY) when omitted, so callers must pass these from
   *  getBusinessIdentity() to avoid branding other trades as Treemarkables.
   *  `gstNumber` is the exception: it has NO Treemarkables fallback — when empty
   *  the GST line is hidden entirely, so an unconfigured tenant never shows TM's
   *  GST number. */
  company?: {
    name?: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    gstNumber?: string;
  };
}

function money(n: number): string {
  return '$' + n.toLocaleString('en-NZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Escape minimal HTML so customer-supplied text can't break the layout. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert newlines in `intro` into <br>s without losing escaping. */
function escMultiline(s: string): string {
  return esc(s).replace(/\n/g, '<br>');
}

export function renderBrandedEmail(opts: BrandedEmailOptions): string {
  const totalLabel = opts.totalLabel ?? 'incl. GST';
  const ctaHint = opts.ctaHint
    ? `<div style="margin-top:12px;font-size:12px;color:${BRAND.muted};">${esc(opts.ctaHint)}</div>`
    : '';
  const fineprint = opts.fineprint
    ? `<tr><td style="padding:0 28px 18px;color:${BRAND.muted};font-size:12px;line-height:1.55;text-align:center;">${esc(opts.fineprint)}</td></tr>`
    : '';
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${BRAND.pageBg};margin:0;padding:0;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

      <!-- Header: business wordmark, uppercased via CSS to render like a logotype -->
      <tr><td style="background:${BRAND.black};padding:22px 28px;">
        <div style="color:${BRAND.neon};font-size:22px;font-weight:800;letter-spacing:-0.01em;line-height:1;text-transform:uppercase;">${esc(opts.company?.name || COMPANY.name)}</div>
        <div style="color:#9ca3af;font-size:11px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;margin-top:4px;">${esc(opts.company?.tagline || COMPANY.tagline)}</div>
      </td></tr>

      <!-- Greeting + intro -->
      <tr><td style="padding:28px 28px 8px;color:${BRAND.ink};font-size:15px;line-height:1.55;">
        <p style="margin:0 0 14px;">Hi ${esc(opts.customerName)},</p>
        <p style="margin:0 0 18px;">${escMultiline(opts.intro)}</p>
      </td></tr>

      <!-- Info card: document label + total -->
      <tr><td style="padding:0 28px 8px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <div style="color:${BRAND.muted};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">${esc(opts.documentLabel)}</div>
            <div style="color:${BRAND.ink};font-size:26px;font-weight:800;margin-top:4px;line-height:1.1;">${money(opts.totalAmount)} <span style="font-size:13px;font-weight:500;color:${BRAND.muted};">${esc(totalLabel)}</span></div>
          </td></tr>
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:22px 28px 8px;text-align:center;">
        <a href="${opts.ctaUrl}" style="display:inline-block;background:${BRAND.black};color:${BRAND.neon};padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;border:2px solid ${BRAND.black};">${esc(opts.ctaText)} &rarr;</a>
        ${ctaHint}
      </td></tr>
      ${fineprint}

      <!-- Footer -->
      <tr><td style="padding:22px 28px;border-top:1px solid ${BRAND.line};color:${BRAND.muted};font-size:12px;line-height:1.6;text-align:center;background:#fafbfc;">
        <div style="font-weight:600;color:${BRAND.ink};">${esc(opts.company?.name || COMPANY.name)}</div>
        <div>${esc(opts.company?.address || COMPANY.address)} &middot; ${esc(opts.company?.phone || COMPANY.phone)}</div>
        <div><a href="mailto:${opts.company?.email || COMPANY.email}" style="color:${BRAND.muted};text-decoration:none;">${esc(opts.company?.email || COMPANY.email)}</a>${opts.company?.gstNumber ? ` &middot; GST ${esc(opts.company.gstNumber)}` : ''}</div>
      </td></tr>

    </table>
  </td></tr>
</table>`;
}
