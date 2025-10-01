import { MailService } from '@sendgrid/mail';

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[]; // CC email address(es)
  replyTo?: string; // Email address for customer replies
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: string;
  }>;
}

class EmailService {
  private mailService: MailService;
  private isConfigured: boolean = false;
  private fromEmail: string = 'jullianhalley@hotmail.com';

  constructor() {
    this.mailService = new MailService();
    this.configure();
  }

  private configure(): void {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      this.mailService.setApiKey(apiKey);
      this.isConfigured = true;
      console.log('📧 SendGrid email service configured successfully');
    } else {
      console.log('📧 SendGrid API key not found - email service in mock mode');
    }
  }

  async sendEmail(params: EmailParams): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        // Mock mode - log the email instead of sending
        console.log('\n=== EMAIL NOTIFICATION (Mock Mode) ===');
        console.log(`To: ${params.to}`);
        console.log(`From: ${params.from}`);
        if (params.replyTo) console.log(`Reply-To: ${params.replyTo}`);
        console.log(`Subject: ${params.subject}`);
        if (params.text) console.log(`Text: ${params.text}`);
        if (params.html) console.log(`HTML: ${params.html}`);
        if (params.templateId) console.log(`Template ID: ${params.templateId}`);
        if (params.dynamicTemplateData) {
          console.log('Template Data:', JSON.stringify(params.dynamicTemplateData, null, 2));
        }
        console.log('Time:', new Date().toLocaleString());
        console.log('================================\n');
        return true;
      }

      const fromEmail = params.from || this.fromEmail;
      
      await this.mailService.send({
        to: params.to,
        from: fromEmail,
        subject: params.subject,
        text: params.text,
        html: params.html,
        ...(params.cc && { cc: params.cc }), // CC recipients
        ...(params.replyTo && { replyTo: params.replyTo }), // Customer replies route to job email
        ...(params.templateId && { templateId: params.templateId }),
        ...(params.dynamicTemplateData && { dynamicTemplateData: params.dynamicTemplateData }),
        ...(params.attachments && { attachments: params.attachments }),
      });

      console.log(`📧 Email sent successfully to ${params.to}`);
      return true;
    } catch (error: any) {
      console.error('📧 SendGrid email error:', error);
      // Log detailed error information
      if (error.response && error.response.body && error.response.body.errors) {
        console.error('📧 SendGrid error details:', JSON.stringify(error.response.body.errors, null, 2));
      }
      return false;
    }
  }

  async sendJobStatusEmail(
    customerEmail: string,
    customerName: string,
    jobTitle: string,
    status: string,
    additionalData?: Record<string, any>
  ): Promise<boolean> {
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
      return false;
    }

    return this.sendEmail({
      to: customerEmail,
      from: this.fromEmail,
      subject: template.subject,
      text: template.text,
      html: template.html
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
          <p style="margin: 0; color: #6b7280;">Scheduled for: <strong>${new Date(additionalData.scheduledDate).toLocaleDateString('en-NZ', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</strong></p>
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
  ): Promise<boolean> {
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