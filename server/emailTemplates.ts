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

/** Per-business brand colours that drive the header band + accent. Both optional —
 *  each falls back to Treemarkables' palette so output is unchanged until a business
 *  sets its own (business_settings.brand_header_color / brand_accent_color). */
export interface BrandColorInput {
  headerColor?: string;
  accentColor?: string;
}

interface ResolvedBrand {
  headerBg: string;   // header/footer band background
  accent: string;     // wordmark / divider / CTA / amount accent
  onHeader: string;   // readable text on the header band
  wordmark: string;   // accent when it stands out on the header, else onHeader
  onAccent: string;   // readable text on an accent-filled button
  ink: string;
  muted: string;
  line: string;
  surface: string;
  pageBg: string;
}

function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return [0, 0, 0];
  const int = parseInt(h, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** WCAG relative luminance (0 = black, 1 = white). */
function relLuminance(hex: string): number {
  const lin = hexToRgb(hex).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrastRatio(a: string, b: string): number {
  const hi = Math.max(relLuminance(a), relLuminance(b));
  const lo = Math.min(relLuminance(a), relLuminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick black or white — whichever reads better on `bg`. */
export function readableOn(bg: string): string {
  return contrastRatio('#ffffff', bg) >= contrastRatio('#0b0b0b', bg) ? '#ffffff' : '#0b0b0b';
}

/** Turn a tenant's two brand colours into the full palette the templates need,
 *  computing contrast-safe text so any colour combination stays legible. */
function resolveBrand(input?: BrandColorInput): ResolvedBrand {
  const headerBg = input?.headerColor || BRAND.black;
  const accent = input?.accentColor || BRAND.neon;
  const onHeader = readableOn(headerBg);
  // Use the accent for the wordmark when it stands out against the header; if a
  // tenant sets header ≈ accent, fall back to the readable mono so the business
  // name never vanishes into the band.
  const wordmark = contrastRatio(accent, headerBg) >= 2.5 ? accent : onHeader;
  return {
    headerBg,
    accent,
    onHeader,
    wordmark,
    onAccent: readableOn(accent),
    ink: BRAND.ink,
    muted: BRAND.muted,
    line: BRAND.line,
    surface: BRAND.surface,
    pageBg: BRAND.pageBg,
  };
}

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
  /** Per-business brand colours. Omit to keep Treemarkables' black + neon-green. */
  brand?: BrandColorInput;
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
  const b = resolveBrand(opts.brand);
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
      <tr><td style="background:${b.headerBg};padding:22px 28px;">
        <div style="color:${b.wordmark};font-size:22px;font-weight:800;letter-spacing:-0.01em;line-height:1;text-transform:uppercase;">${esc(opts.company?.name || COMPANY.name)}</div>
        ${opts.company?.tagline ? `<div style="color:#9ca3af;font-size:11px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;margin-top:4px;">${esc(opts.company.tagline)}</div>` : ''}
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
        <a href="${opts.ctaUrl}" style="display:inline-block;background:${b.headerBg};color:${b.accent};padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;border:2px solid ${b.headerBg};">${esc(opts.ctaText)} &rarr;</a>
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

export interface WelcomeEmailOptions {
  /** Recipient's first name for the greeting. */
  ownerName: string;
  /** The new business's name (header wordmark + body). */
  businessName: string;
  /** Sign-in CTA URL (built from APP_URL). */
  signInUrl: string;
  /** A few getting-started steps shown as a checklist. */
  steps: Array<{ label: string; hint: string }>;
  /** Per-business brand colours. Omit to keep the platform black + neon-green. */
  brand?: BrandColorInput;
}

/**
 * Signup confirmation / welcome email. Same branded header + footer style as the
 * money documents, but no total card — a greeting, a "you're in" line, a short
 * getting-started checklist, and a sign-in button. Header wordmark + footer use
 * the tenant's OWN business name (never the platform's), so the account owner
 * sees their brand.
 */
export function renderWelcomeEmail(opts: WelcomeEmailOptions): string {
  const b = resolveBrand(opts.brand);
  const steps = opts.steps
    .map(
      (s) => `
        <tr><td style="padding:8px 0;border-bottom:1px solid ${BRAND.line};">
          <div style="font-weight:600;color:${BRAND.ink};font-size:14px;">${esc(s.label)}</div>
          <div style="color:${BRAND.muted};font-size:13px;line-height:1.5;margin-top:2px;">${esc(s.hint)}</div>
        </td></tr>`,
    )
    .join('');
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${BRAND.pageBg};margin:0;padding:0;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

      <tr><td style="background:${b.headerBg};padding:22px 28px;">
        <div style="color:${b.wordmark};font-size:22px;font-weight:800;letter-spacing:-0.01em;line-height:1;text-transform:uppercase;">${esc(opts.businessName)}</div>
      </td></tr>

      <tr><td style="padding:28px 28px 8px;color:${BRAND.ink};font-size:15px;line-height:1.55;">
        <p style="margin:0 0 14px;">Hi ${esc(opts.ownerName)},</p>
        <p style="margin:0 0 6px;">Your Inflow account for <strong>${esc(opts.businessName)}</strong> is ready to go.</p>
        <p style="margin:0 0 18px;color:${BRAND.muted};font-size:14px;">Here are a couple of things to set up first:</p>
      </td></tr>

      <tr><td style="padding:0 28px 8px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${steps}</table>
      </td></tr>

      <tr><td style="padding:22px 28px 8px;text-align:center;">
        <a href="${opts.signInUrl}" style="display:inline-block;background:${b.headerBg};color:${b.accent};padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;border:2px solid ${b.headerBg};">Sign in to Inflow &rarr;</a>
        <div style="margin-top:12px;font-size:12px;color:${BRAND.muted};">Bookmark ${esc(opts.signInUrl)} to get back in any time.</div>
      </td></tr>

      <tr><td style="padding:22px 28px;border-top:1px solid ${BRAND.line};color:${BRAND.muted};font-size:12px;line-height:1.6;text-align:center;background:#fafbfc;">
        <div>You're receiving this because an Inflow account was created for ${esc(opts.businessName)}.</div>
        <div style="margin-top:4px;">If this wasn't you, reply to this email and we'll sort it out.</div>
      </td></tr>

    </table>
  </td></tr>
</table>`;
}

/** Intro that keeps newlines and supports **bold** / *italic* from the composed
 *  message, while still escaping everything else. */
function escRich(s: string): string {
  return esc(s)
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export interface InvoiceEmailLineItem {
  description: string;
  quantity?: number | string;
  price: number;
}

export interface InvoiceEmailOptions {
  /** Customer name (used only when `intro` is empty). */
  customerName: string;
  /** Composed message shown as the lead. When empty a short default is used.
   *  Rendered with newline + **bold** support, otherwise escaped. */
  intro?: string;
  /** Label on the amount-due card — e.g. "Invoice #3975". */
  invoiceLabel: string;
  /** Due date already formatted for display — e.g. "5 Jun 2026". */
  dueDateText?: string;
  /** Site the work was carried out at (optional banner). */
  workAddress?: string;
  lineItems: InvoiceEmailLineItem[];
  subtotal: number;
  gst: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  /** Online-invoice link (view + pay). */
  ctaUrl: string;
  ctaText?: string;
  /** Free-text payment methods line, e.g. "We accept payment by: Cash and bank transfer". */
  paymentInstructions?: string;
  /** Per-business bank details. The payment block renders ONLY when an account is
   *  set, so an unconfigured tenant never shows another business's account. */
  bank?: { accountName?: string; accountNumber?: string; reference?: string };
  /** Business identity for header + footer (from getBusinessIdentity()). */
  company?: {
    name?: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    gstNumber?: string;
  };
  /** Per-business brand colours. Omit to keep Treemarkables' black + neon-green. */
  brand?: BrandColorInput;
  /** Public review link (/review/:token). When set, a "How did we do?" block
   *  renders between the bank details and the footer. */
  reviewUrl?: string;
}

/**
 * Branded invoice email — header wordmark, an amount-due hero with a single
 * view-and-pay CTA, the line items + totals, and (when configured) the business's
 * own bank details. Fully driven by per-business identity + brand colours: nothing
 * here is hardcoded to Treemarkables beyond the palette/identity DEFAULTS.
 */
export function renderInvoiceEmail(opts: InvoiceEmailOptions): string {
  const b = resolveBrand(opts.brand);
  const name = opts.company?.name || COMPANY.name;

  const introHtml = opts.intro && opts.intro.trim()
    ? escRich(opts.intro)
    : `Hi ${esc(opts.customerName)},<br><br>Thanks for your business. Your invoice is below — you can pay by bank transfer using the details shown, or view it online.`;

  const paid = opts.balanceDue <= 0;
  const pill = paid
    ? `<span style="display:inline-block;background:#e7f8ec;color:#137333;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;">Paid</span>`
    : opts.dueDateText
      ? `<span style="display:inline-block;background:#fdecec;color:#a32d2d;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;">Due ${esc(opts.dueDateText)}</span>`
      : '';

  const workAddress = opts.workAddress
    ? `<tr><td style="padding:0 28px 4px;">
        <div style="background:${b.surface};border:1px solid ${b.line};border-radius:8px;padding:10px 14px;font-size:13px;color:${b.ink};">
          <span style="color:${b.muted};font-weight:600;">Work carried out at</span> ${esc(opts.workAddress)}
        </div>
      </td></tr>`
    : '';

  const itemRows = (opts.lineItems && opts.lineItems.length > 0 ? opts.lineItems : [])
    .map(it => `<tr>
        <td style="padding:11px 0;border-bottom:1px solid ${b.line};font-size:14px;color:${b.ink};">${esc(it.description || '')}</td>
        <td align="center" style="padding:11px 0;border-bottom:1px solid ${b.line};font-size:14px;color:${b.muted};width:46px;">${esc(String(it.quantity ?? 1))}</td>
        <td align="right" style="padding:11px 0;border-bottom:1px solid ${b.line};font-size:14px;color:${b.ink};white-space:nowrap;width:96px;">${money(it.price)}</td>
      </tr>`)
    .join('');

  const totalRow = (label: string, value: string, opt: { strong?: boolean; topRule?: boolean } = {}) =>
    `<tr>
      <td style="padding:6px 0;${opt.topRule ? `border-top:2px solid ${b.ink};` : ''}font-size:14px;color:${opt.strong ? b.ink : b.muted};${opt.strong ? 'font-weight:700;' : ''}">${label}</td>
      <td align="right" style="padding:6px 0;${opt.topRule ? `border-top:2px solid ${b.ink};` : ''}font-size:14px;color:${b.ink};${opt.strong ? 'font-weight:700;' : ''}white-space:nowrap;">${value}</td>
    </tr>`;

  const hasBank = !!(opts.bank && (opts.bank.accountName || opts.bank.accountNumber));
  const bankBlock = hasBank
    ? `<tr><td style="padding:6px 28px 4px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${b.surface};border:1px solid ${b.line};border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <div style="color:${b.muted};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">${esc(opts.paymentInstructions || 'How to pay — bank transfer')}</div>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="font-size:14px;color:${b.ink};line-height:1.7;">
              ${opts.bank?.accountName ? `<tr><td style="color:${b.muted};width:130px;">Account name</td><td style="font-weight:500;">${esc(opts.bank.accountName)}</td></tr>` : ''}
              ${opts.bank?.accountNumber ? `<tr><td style="color:${b.muted};">Account number</td><td style="font-weight:500;">${esc(opts.bank.accountNumber)}</td></tr>` : ''}
              ${opts.bank?.reference ? `<tr><td style="color:${b.muted};">Reference</td><td style="font-weight:500;">${esc(opts.bank.reference)}</td></tr>` : ''}
            </table>
          </td></tr>
        </table>
      </td></tr>`
    : '';

  // Optional review ask — rides along with the invoice so the request lands
  // while the job is fresh, without a separate email.
  const reviewBlock = opts.reviewUrl
    ? `<tr><td style="padding:6px 28px 4px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${b.surface};border:1px solid ${b.line};border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <div style="color:${b.ink};font-size:14px;font-weight:700;margin-bottom:4px;">How did we do?</div>
            <div style="color:${b.muted};font-size:13px;line-height:1.55;margin-bottom:12px;">If you have a spare minute, we'd really appreciate a quick review — it makes a big difference to a local business like ours.</div>
            <a href="${opts.reviewUrl}" style="display:inline-block;background:${b.headerBg};color:${b.wordmark};padding:10px 18px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;">Leave a review</a>
          </td></tr>
        </table>
      </td></tr>`
    : '';

  // Footer contact line: phone · email · website, each clickable, in the accent.
  const footerLinks = [
    opts.company?.phone ? `<a href="tel:${esc(opts.company.phone).replace(/\s/g, '')}" style="color:${b.wordmark};text-decoration:none;">${esc(opts.company.phone)}</a>` : '',
    opts.company?.email ? `<a href="mailto:${esc(opts.company.email)}" style="color:${b.wordmark};text-decoration:none;">${esc(opts.company.email)}</a>` : '',
    opts.company?.website ? `<a href="${esc(opts.company.website)}" style="color:${b.wordmark};text-decoration:none;">${esc(opts.company.website.replace(/^https?:\/\//, ''))}</a>` : '',
  ].filter(Boolean).join(' &middot; ');

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${b.pageBg};margin:0;padding:0;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

      <!-- Header band + accent rule -->
      <tr><td style="background:${b.headerBg};padding:22px 28px;">
        <div style="color:${b.wordmark};font-size:22px;font-weight:800;letter-spacing:-0.01em;line-height:1;text-transform:uppercase;">${esc(name)}</div>
        ${opts.company?.tagline ? `<div style="color:#9ca3af;font-size:11px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;margin-top:4px;">${esc(opts.company.tagline)}</div>` : ''}
      </td></tr>
      <tr><td style="height:3px;line-height:3px;font-size:0;background:${b.accent};">&nbsp;</td></tr>

      <!-- Intro -->
      <tr><td style="padding:26px 28px 12px;color:${b.ink};font-size:15px;line-height:1.55;">${introHtml}</td></tr>

      <!-- Amount-due hero + CTA -->
      <tr><td style="padding:0 28px 8px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${b.surface};border:1px solid ${b.line};border-radius:12px;">
          <tr>
            <td style="padding:18px 20px;" valign="top">
              <div style="color:${b.muted};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Amount due</div>
              <div style="color:${b.ink};font-size:30px;font-weight:800;margin-top:4px;line-height:1;">${money(opts.balanceDue)}</div>
            </td>
            <td style="padding:18px 20px;text-align:right;" valign="top">
              <div style="color:${b.muted};font-size:13px;margin-bottom:6px;">${esc(opts.invoiceLabel)}</div>
              ${pill}
            </td>
          </tr>
          <tr><td colspan="2" style="padding:0 20px 18px;">
            <a href="${opts.ctaUrl}" style="display:block;text-align:center;background:${b.accent};color:${b.onAccent};padding:13px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;">${esc(opts.ctaText || 'View & pay invoice online')}</a>
          </td></tr>
        </table>
      </td></tr>

      ${workAddress}

      <!-- Line items -->
      <tr><td style="padding:14px 28px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;border-bottom:2px solid ${b.ink};font-size:11px;font-weight:700;letter-spacing:0.04em;color:${b.muted};">DESCRIPTION</td>
            <td align="center" style="padding:8px 0;border-bottom:2px solid ${b.ink};font-size:11px;font-weight:700;letter-spacing:0.04em;color:${b.muted};">QTY</td>
            <td align="right" style="padding:8px 0;border-bottom:2px solid ${b.ink};font-size:11px;font-weight:700;letter-spacing:0.04em;color:${b.muted};">PRICE</td>
          </tr>
          ${itemRows}
        </table>
      </td></tr>

      <!-- Totals -->
      <tr><td style="padding:6px 28px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="right" style="width:240px;border-collapse:collapse;">
          ${totalRow('Subtotal', money(opts.subtotal))}
          ${totalRow('GST', money(opts.gst))}
          ${totalRow('Total', money(opts.total), { strong: true, topRule: true })}
          ${totalRow('Paid', money(opts.paidAmount))}
          ${totalRow('Balance due', money(opts.balanceDue), { strong: true, topRule: true })}
        </table>
      </td></tr>
      <tr><td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>

      ${bankBlock}

      ${reviewBlock}

      <!-- Footer band -->
      <tr><td style="background:${b.headerBg};padding:22px 28px;color:${b.onHeader};font-size:12px;line-height:1.7;">
        <div style="font-weight:700;">${esc(name)}</div>
        <div style="color:#9ca3af;">${[opts.company?.address ? esc(opts.company.address) : '', opts.company?.gstNumber ? `GST ${esc(opts.company.gstNumber)}` : ''].filter(Boolean).join(' &middot; ')}</div>
        ${footerLinks ? `<div style="margin-top:8px;">${footerLinks}</div>` : ''}
      </td></tr>

    </table>
  </td></tr>
</table>`;
}
