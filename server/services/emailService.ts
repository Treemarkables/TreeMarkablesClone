import { getUncachableResendClient } from '../resendClient';
import { formatNZTime } from '@shared/dateUtils';

// Split a recipient field into individual addresses. Accepts a single address,
// a comma/semicolon-separated string ("a@x.com, b@y.com"), or an array. Returns
// a clean array so Resend puts every address on the To line of ONE email.
export function parseRecipients(to: string | string[]): string[] {
  const raw = Array.isArray(to) ? to : String(to ?? "").split(/[,;]+/);
  return raw.map((a) => a.trim()).filter(Boolean);
}

interface EmailParams {
  to: string | string[];
  from?: string; // Full "Name <addr>" override — wins over fromName
  fromName?: string; // Per-tenant display name shown over the shared verified sending address (e.g. "Bob's Plumbing"). Falsy → platform default.
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[]; // CC email address(es)
  replyTo?: string; // Email address for customer replies (explicit override)
  jobNumber?: string; // Job number for automatic job-specific reply-to address
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition?: string; // Optional for backward compatibility
    content_id?: string;  // CID for inline image embedding (e.g. "photo-0")
  }>;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string; // Error message for debugging
}

class EmailService {
  private isConfigured: boolean = false;
  private defaultFromEmail: string = 'info@treemarkables.co.nz';
  private defaultReplyTo: string = 'info@treemarkables.nz'; // Google Workspace email that can receive replies

  constructor() {
    this.checkConfiguration();
  }

  private async checkConfiguration(): Promise<void> {
    try {
      // Try to get Resend client to verify configuration
      await getUncachableResendClient();
      this.isConfigured = true;
      console.log('📧 Resend email service configured successfully');
    } catch (error) {
      this.isConfigured = false;
      console.log('📧 Resend not connected - email service in mock mode');
    }
  }

  /**
   * Format job-specific reply-to address for automatic email capture
   * @param jobNumber Job number (e.g., "3447")
   * @returns Job-specific email address (e.g., "job-3447@jobs.treemarkables.co.nz")
   */
  private formatJobReplyAddress(jobNumber: string): string {
    return `job-${jobNumber}@jobs.treemarkables.co.nz`;
  }

  /**
   * Pull the bare email address out of a From header that may be either
   * "Name <addr@x.com>" or just "addr@x.com".
   */
  private extractEmailAddress(from: string): string {
    const match = from.match(/<([^>]+)>/);
    return (match ? match[1] : from).trim();
  }

  /**
   * Build a per-tenant From header: a tenant's display name over the shared,
   * already-verified sending address. The address (domain) stays on the
   * platform's verified Resend domain — subscribers do nothing — only the
   * visible name changes, so the customer perceives the email as the tenant's.
   * Strips characters that would break the header and quotes names with commas.
   */
  private composeFrom(fromName: string, baseFrom: string): string {
    const address = this.extractEmailAddress(baseFrom);
    const safeName = fromName.replace(/["<>\r\n]/g, '').trim();
    if (!safeName) return baseFrom;
    const display = safeName.includes(',') ? `"${safeName}"` : safeName;
    return `${display} <${address}>`;
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    try {
      // Get fresh Resend client for each send (uncacheable)
      let resendClient;
      let configuredFromEmail;
      
      try {
        const { client, fromEmail } = await getUncachableResendClient();
        resendClient = client;
        configuredFromEmail = fromEmail;
        this.isConfigured = true;
        console.log(`✅ Resend client initialized for email send`);
      } catch (error) {
        // Fall back to mock mode if Resend not configured
        console.error(`❌ Failed to initialize Resend client for email send:`, error instanceof Error ? error.message : error);
        this.isConfigured = false;
      }

      if (!this.isConfigured || !resendClient) {
        // Mock mode - log the email instead of sending
        console.log('\n❌ === EMAIL GOING TO MOCK MODE (Resend not configured) ===');
        console.log(`To: ${params.to}`);
        console.log(`From: ${params.from || this.defaultFromEmail}`);
        if (params.replyTo) console.log(`Reply-To: ${params.replyTo}`);
        console.log(`Subject: ${params.subject}`);
        if (params.text) console.log(`Text: ${params.text}`);
        if (params.html) console.log(`HTML: ${params.html}`);
        if (params.templateId) console.log(`Template ID: ${params.templateId}`);
        if (params.dynamicTemplateData) {
          console.log('Template Data:', JSON.stringify(params.dynamicTemplateData, null, 2));
        }
        console.log('Time:', new Date().toLocaleString());
        console.log('⚠️  Email will NOT be sent - Resend client unavailable\n');
        return { success: true, messageId: `mock-${Date.now()}` };
      }

      // Resolve the From header. Priority:
      //   1. params.from — full "Name <addr>" override
      //   2. params.fromName — per-tenant display name over the shared verified sending address
      //   3. the platform default ("Treemarkables <info@updates.treemarkables.co.nz>")
      const baseFrom = configuredFromEmail || this.defaultFromEmail;
      const fromEmail = params.from
        ? params.from
        : (params.fromName ? this.composeFrom(params.fromName, baseFrom) : baseFrom);
      
      // Map attachments to Resend format
      // Resend SDK Attachment$1 interface uses camelCase: contentType, contentId
      // parseAttachments() internally converts: contentType→content_type, contentId→content_id
      const resendAttachments = params.attachments?.map(att => ({
        filename: att.filename,
        content: Buffer.from(att.content, 'base64'),
        contentType: att.type,
        ...(att.content_id ? { contentId: att.content_id } : {})
      }));

      // Build email payload for Resend
      // Use job-specific reply-to addresses when jobNumber is provided (Cloudflare Email Routing active)
      // Cloudflare forwards job-{number}@jobs.treemarkables.co.nz → accounts@treemarkables.nz → Gmail IMAP
      let replyToAddress = params.replyTo; // Explicit override if provided
      if (!replyToAddress && params.jobNumber) {
        replyToAddress = this.formatJobReplyAddress(params.jobNumber); // e.g., job-3447@jobs.treemarkables.co.nz
      }
      if (!replyToAddress) {
        replyToAddress = this.defaultReplyTo; // Fallback to info@treemarkables.nz
      }
      
      // Normalise to an array so a comma-separated `to` becomes multiple
      // recipients on a single email's To line ("send to multiple contacts").
      const toList = parseRecipients(params.to);
      const emailPayload: any = {
        from: fromEmail,
        to: toList.length > 1 ? toList : (toList[0] ?? ""),
        subject: params.subject,
        ...(params.html && { html: params.html }),
        ...(params.text && { text: params.text }),
        ...(params.cc && { cc: Array.isArray(params.cc) ? params.cc : [params.cc] }),
        replyTo: replyToAddress, // Node SDK uses camelCase 'replyTo' (not 'reply_to')
        ...(resendAttachments && resendAttachments.length > 0 && { attachments: resendAttachments })
      };

      // Log attachment info before sending
      if (resendAttachments && resendAttachments.length > 0) {
        console.log(`📎 Sending email with ${resendAttachments.length} file attachment(s):`);
        resendAttachments.forEach((att, idx) => {
          const sizeKB = Math.round(att.content.length / 1024);
          console.log(`  ${idx + 1}. ${att.filename} (${sizeKB}KB, type: ${att.contentType || 'unknown'})`);
        });
      }

      // Log payload WITHOUT attachment content (binary data floods logs)
      const payloadForLogging = {
        ...emailPayload,
        attachments: emailPayload.attachments?.map((a: any) => ({
          filename: a.filename,
          contentLength: a.content?.length || 0
        }))
      };
      console.log('📧 Resend API payload:', JSON.stringify(payloadForLogging, null, 2));
      
      const response = await resendClient.emails.send(emailPayload);

      console.log('📧 Resend API response:', JSON.stringify(response, null, 2));

      // Extract message ID from Resend response
      const messageId = response.data?.id || undefined;
      
      if (response.error) {
        console.error('📧 Resend API error in response:', response.error);
        return { success: false, error: response.error.message || JSON.stringify(response.error) };
      }
      
      console.log(`📧 Email sent successfully to ${params.to}${messageId ? ` (Message ID: ${messageId})` : ''}`);
      return { success: true, messageId };
    } catch (error: any) {
      console.error('📧 Resend email error:', error);
      // Log detailed error information
      const errorMessage = error.message || 'Unknown email error';
      if (error.message) {
        console.error('📧 Error message:', error.message);
      }
      if (error.response) {
        console.error('📧 Error response:', JSON.stringify(error.response, null, 2));
      }
      if (error.data) {
        console.error('📧 Error data:', JSON.stringify(error.data, null, 2));
      }
      return { success: false, error: errorMessage };
    }
  }

  async sendJobStatusEmail(
    customerEmail: string,
    customerName: string,
    jobTitle: string,
    status: string,
    additionalData?: Record<string, any>,
    jobNumber?: string, // Job number for job-specific reply-to address
    businessName: string = 'Treemarkables' // de-hardcoded — caller passes the business name; default keeps Treemarkables unchanged
  ): Promise<EmailResult> {
    const statusTemplates = {
      // 'scheduled' status retired 2026-05. The template body lives on under
      // the work_order key so the existing "your job is booked" notification
      // wording still works when a work_order gets a scheduledDate set.
      scheduled: {
        subject: `Job Scheduled: ${jobTitle}`,
        text: `Hi ${customerName},\n\nGood news! Your job "${jobTitle}" has been scheduled.\n\nWe'll send you more details soon.\n\nBest regards,\n${businessName} Team`,
        html: this.getJobStatusEmailHTML(customerName, jobTitle, 'scheduled', additionalData)
      },
      in_progress: {
        subject: `Job Started: ${jobTitle}`,
        text: `Hi ${customerName},\n\nOur team has arrived and started working on "${jobTitle}".\n\nWe'll update you when the job is complete.\n\nBest regards,\n${businessName} Team`,
        html: this.getJobStatusEmailHTML(customerName, jobTitle, 'in_progress', additionalData)
      },
      completed: {
        subject: `Job Completed: ${jobTitle}`,
        text: `Hi ${customerName},\n\nGreat news! Your job "${jobTitle}" has been completed successfully.\n\nThank you for choosing ${businessName}!\n\nBest regards,\n${businessName} Team`,
        html: this.getJobStatusEmailHTML(customerName, jobTitle, 'completed', additionalData)
      },
      cancelled: {
        subject: `Job Update: ${jobTitle}`,
        text: `Hi ${customerName},\n\nWe need to update you about your job "${jobTitle}". Please contact us for more information.\n\nBest regards,\n${businessName} Team`,
        html: this.getJobStatusEmailHTML(customerName, jobTitle, 'cancelled', additionalData)
      }
    };

    const template = statusTemplates[status as keyof typeof statusTemplates];
    if (!template) {
      console.error(`No email template found for status: ${status}`);
      return { success: false };
    }

    return this.sendEmail({
      to: customerEmail,
      fromName: businessName, // From header matches the "{businessName} Team" sign-off
      subject: template.subject,
      text: template.text,
      html: template.html,
      jobNumber // Pass jobNumber for job-specific reply-to
    });
  }

  private getJobStatusEmailHTML(
    customerName: string,
    jobTitle: string,
    status: string,
    additionalData?: Record<string, any>
  ): string {
    const statusColors = {
      scheduled: '#3B82F6',
      in_progress: '#F59E0B',
      completed: '#10B981',
      cancelled: '#EF4444'
    };

    const statusMessages = {
      scheduled: 'has been scheduled and confirmed',
      in_progress: 'is currently in progress',
      completed: 'has been completed successfully',
      cancelled: 'requires your attention'
    };

    const color = statusColors[status as keyof typeof statusColors] || '#6B7280';
    const message = statusMessages[status as keyof typeof statusMessages] || 'has been updated';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Update - Treemarkables</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10B981 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🌳 Treemarkables</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Professional Tree Services</p>
        </div>
        
        <div style="background: #f8fafc; padding: 25px; border-radius: 8px; border-left: 4px solid ${color}; margin-bottom: 25px;">
          <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 22px;">Job Update</h2>
          <p style="margin: 0 0 10px 0; font-size: 16px;">Hi ${customerName},</p>
          <p style="margin: 0; font-size: 16px;">Your job "<strong>${jobTitle}</strong>" ${message}.</p>
        </div>

        ${additionalData?.scheduledDate ? `
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px;">
          <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">📅 Schedule Details</h3>
          <p style="margin: 0; color: #6b7280;">Scheduled for: <strong>${formatNZTime(additionalData.scheduledDate, 'full')} (NZ time)</strong></p>
        </div>
        ` : ''}

        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:5000/customer-portal" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Job Details</a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <div style="text-align: center; color: #6b7280; font-size: 14px;">
          <p style="margin: 0;">Need help? Contact us at <a href="tel:021-555-0123" style="color: #059669;">021 555 0123</a></p>
          <p style="margin: 10px 0 0 0;">© 2024 Treemarkables - Professional Tree Services in New Zealand</p>
        </div>
      </body>
      </html>
    `;
  }

  async sendQuoteEmail(
    customerEmail: string,
    customerName: string,
    quoteNumber: string,
    amount: number,
    quoteData: any,
    businessName: string = 'Treemarkables' // de-hardcoded — caller passes the business name; default keeps Treemarkables unchanged
  ): Promise<EmailResult> {
    const subject = `Your Quote #${quoteNumber} - Treemarkables`;
    const text = `Hi ${customerName},\n\nThank you for your interest in our tree services. Please find your quote #${quoteNumber} attached.\n\nQuote Amount: $${amount.toFixed(2)} NZD\n\nThis quote is valid for 30 days. Please contact us if you have any questions.\n\nBest regards,\n${businessName} Team`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Quote - Treemarkables</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10B981 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🌳 Treemarkables</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Professional Tree Services</p>
        </div>
        
        <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
          <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 22px;">Your Quote #${quoteNumber}</h2>
          <p style="margin: 0 0 10px 0; font-size: 16px;">Hi ${customerName},</p>
          <p style="margin: 0; font-size: 16px;">Thank you for your interest in our tree services. Here's your personalized quote:</p>
        </div>

        <div style="background: white; padding: 25px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px;">
          <div style="text-align: center; padding: 20px; background: #f0fdf4; border-radius: 6px; margin-bottom: 20px;">
            <h3 style="color: #059669; margin: 0 0 10px 0; font-size: 24px;">Total: $${amount.toFixed(2)} NZD</h3>
            <p style="color: #16a34a; margin: 0; font-size: 14px;">Quote valid for 30 days</p>
          </div>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:5000/customer-portal" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; margin-right: 10px;">Accept Quote</a>
          <a href="tel:021-555-0123" style="background: white; color: #059669; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; border: 2px solid #059669;">Call to Discuss</a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <div style="text-align: center; color: #6b7280; font-size: 14px;">
          <p style="margin: 0;">Questions? Contact us at <a href="tel:021-555-0123" style="color: #059669;">021 555 0123</a></p>
          <p style="margin: 10px 0 0 0;">© 2024 Treemarkables - Professional Tree Services in New Zealand</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: customerEmail,
      fromName: businessName, // From header matches the "{businessName} Team" sign-off
      subject,
      text,
      html
    });
  }

  async sendMulchOrderConfirmation(params: {
    customerEmail: string;
    customerName: string;
    jobNumber: string;
    quantityM3: number;
    productName: string;
    pricePerM3: number;
    subtotal: number;
    gst: number;
    total: number;
    coverageM2: number;
    coverageDepthMm: number;
    address: string;
    accessNotes?: string;
  }): Promise<EmailResult> {
    const {
      customerEmail,
      customerName,
      jobNumber,
      quantityM3,
      productName,
      pricePerM3,
      subtotal,
      gst,
      total,
      coverageM2,
      coverageDepthMm,
      address,
      accessNotes,
    } = params;

    const firstName = customerName.split(/\s+/)[0] || customerName;
    const subject = `Mulch order received — Treemarkables (#${jobNumber})`;
    const NEON = '#39FF14';
    const fmt = (n: number) => `$${n.toFixed(2)}`;

    const text = [
      `Hi ${firstName},`,
      ``,
      `Thanks for your mulch order. We've got it and we'll give you a call within one working day to confirm delivery timing.`,
      ``,
      `Your order (#${jobNumber}):`,
      `- Quantity: ${quantityM3} m³`,
      `- ${productName} ($${pricePerM3}/m³ ex GST): ${fmt(subtotal)}`,
      `- Delivery: FREE`,
      `- GST (15%): ${fmt(gst)}`,
      `- Total (incl. GST): ${fmt(total)}`,
      `- Coverage estimate: ~${coverageM2} m² at ${coverageDepthMm} mm depth`,
      `- Delivery address: ${address}`,
      accessNotes ? `- Access notes: ${accessNotes}` : null,
      ``,
      `What happens next:`,
      `1. We'll call you within one working day to confirm timing and tip location.`,
      `2. Mulch is delivered straight off the truck, tipped where you want it.`,
      `3. Invoice arrives by email after delivery — no payment up front.`,
      ``,
      `Need to change something? Call us on 027 216 6882 or reply to this email.`,
      ``,
      `Thanks,`,
      `Treemarkables`,
    ]
      .filter((line) => line !== null)
      .join('\n');

    const escape = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;color:#111;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
    <div style="background:#fafafa;border-bottom:1px solid #eee;padding:28px 24px;text-align:center;">
      <div style="display:inline-block;width:56px;height:56px;background:${NEON};border-radius:50%;line-height:56px;font-size:28px;font-weight:800;color:#000;">✓</div>
      <h1 style="margin:14px 0 6px;font-size:22px;font-weight:800;letter-spacing:-0.3px;">Thanks, ${escape(firstName)}!</h1>
      <p style="margin:0;color:#555;font-size:14px;line-height:1.5;">We've got your mulch order. We'll call you within one working day to confirm delivery timing.</p>
    </div>

    <div style="padding:24px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:800;color:#555;margin-bottom:14px;">Your order</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#666;">Reference</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">#${escape(jobNumber)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#666;">Quantity</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${quantityM3} m³</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#666;">${escape(productName)} ($${pricePerM3}/m³ ex GST)</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmt(subtotal)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#666;">Delivery</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;"><span style="background:${NEON};color:#000;font-weight:800;font-size:11px;padding:2px 8px;border-radius:4px;">FREE</span></td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#666;">GST (15%)</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmt(gst)}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#666;">Coverage estimate</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">~${coverageM2} m² at ${coverageDepthMm} mm</td></tr>
        <tr><td style="padding:14px 0 4px;border-top:2px solid #000;font-size:18px;font-weight:800;">Total</td><td style="padding:14px 0 4px;border-top:2px solid #000;text-align:right;font-size:18px;font-weight:800;">${fmt(total)}</td></tr>
      </table>
      <div style="text-align:right;font-size:11px;color:#999;margin-top:2px;">Incl. GST — invoice on delivery</div>

      <div style="margin-top:24px;padding-top:18px;border-top:1px solid #eee;font-size:13px;color:#555;line-height:1.55;">
        <strong style="color:#111;">Delivery address:</strong> ${escape(address)}${accessNotes ? `<br><strong style="color:#111;">Access notes:</strong> ${escape(accessNotes)}` : ''}
      </div>
    </div>

    <div style="background:#fafafa;border-top:1px solid #eee;padding:20px 24px;font-size:13px;color:#555;line-height:1.55;">
      <div style="font-weight:800;color:#111;margin-bottom:8px;">What happens next</div>
      <ol style="margin:0;padding-left:20px;">
        <li style="margin-bottom:6px;">We'll call you within one working day to confirm timing and tip location.</li>
        <li style="margin-bottom:6px;">Mulch is delivered straight off the truck, tipped where you want it.</li>
        <li>Invoice arrives by email after delivery — no payment up front.</li>
      </ol>
      <div style="margin-top:16px;">Need to change something? Call us on <a href="tel:0272166882" style="color:#111;font-weight:600;">027 216 6882</a> or reply to this email.</div>
    </div>

    <div style="text-align:center;padding:18px 24px;font-size:11px;color:#999;">
      Treemarkables — Gisborne, NZ
    </div>
  </div>
</body>
</html>`;

    return this.sendEmail({
      to: customerEmail,
      subject,
      text,
      html,
      jobNumber,
    });
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();