import { getUncachableResendClient } from '../resendClient';
import { formatNZTime } from '@shared/dateUtils';

interface EmailParams {
  to: string;
  from?: string;
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

      // Use provided from email, or fall back to configured from email, or default
      const fromEmail = params.from || configuredFromEmail || this.defaultFromEmail;
      
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
      
      const emailPayload: any = {
        from: fromEmail,
        to: params.to,
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
    jobNumber?: string // Job number for job-specific reply-to address
  ): Promise<EmailResult> {
    const statusTemplates = {
      scheduled: {
        subject: `Job Scheduled: ${jobTitle}`,
        text: `Hi ${customerName},\n\nGood news! Your tree service job "${jobTitle}" has been scheduled.\n\nWe'll send you more details soon.\n\nBest regards,\nTreemarkables Team`,
        html: this.getJobStatusEmailHTML(customerName, jobTitle, 'scheduled', additionalData)
      },
      in_progress: {
        subject: `Job Started: ${jobTitle}`,
        text: `Hi ${customerName},\n\nOur team has arrived and started working on "${jobTitle}".\n\nWe'll update you when the job is complete.\n\nBest regards,\nTreemarkables Team`,
        html: this.getJobStatusEmailHTML(customerName, jobTitle, 'in_progress', additionalData)
      },
      completed: {
        subject: `Job Completed: ${jobTitle}`,
        text: `Hi ${customerName},\n\nGreat news! Your tree service job "${jobTitle}" has been completed successfully.\n\nThank you for choosing Treemarkables!\n\nBest regards,\nTreemarkables Team`,
        html: this.getJobStatusEmailHTML(customerName, jobTitle, 'completed', additionalData)
      },
      cancelled: {
        subject: `Job Update: ${jobTitle}`,
        text: `Hi ${customerName},\n\nWe need to update you about your job "${jobTitle}". Please contact us for more information.\n\nBest regards,\nTreemarkables Team`,
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
      from: this.fromEmail,
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
    quoteData: any
  ): Promise<EmailResult> {
    const subject = `Your Quote #${quoteNumber} - Treemarkables`;
    const text = `Hi ${customerName},\n\nThank you for your interest in our tree services. Please find your quote #${quoteNumber} attached.\n\nQuote Amount: $${amount.toFixed(2)} NZD\n\nThis quote is valid for 30 days. Please contact us if you have any questions.\n\nBest regards,\nTreemarkables Team`;
    
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
      from: this.fromEmail,
      subject,
      text,
      html
    });
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();