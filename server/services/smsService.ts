// @ts-ignore - Twilio types issue with package.json exports
import { Twilio } from 'twilio';

interface SMSParams {
  to: string;
  message: string;
}

class SMSService {
  private client: Twilio | null = null;
  private isConfigured: boolean = false;
  private fromPhone: string = '';

  constructor() {
    this.configure();
  }

  private configure(): void {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (accountSid && authToken && phoneNumber) {
      this.client = new Twilio(accountSid, authToken);
      this.fromPhone = phoneNumber;
      this.isConfigured = true;
      console.log('📱 Twilio SMS service configured successfully');
    } else {
      console.log('📱 Twilio credentials not found - SMS service in mock mode');
    }
  }

  async sendSMS(params: SMSParams): Promise<boolean> {
    try {
      if (!this.isConfigured || !this.client) {
        // Mock mode - log the SMS instead of sending
        console.log('\n=== SMS NOTIFICATION (Mock Mode) ===');
        console.log(`To: ${params.to}`);
        console.log(`From: ${this.fromPhone || 'Treemarkables'}`);
        console.log(`Message: ${params.message}`);
        console.log('Time:', new Date().toLocaleString());
        console.log('==============================\n');
        return true;
      }

      const message = await this.client.messages.create({
        body: params.message,
        from: this.fromPhone,
        to: params.to,
      });

      console.log(`📱 SMS sent successfully to ${params.to}, SID: ${message.sid}`);
      return true;
    } catch (error) {
      console.error('📱 Twilio SMS error:', error);
      return false;
    }
  }

  async sendJobStatusSMS(
    customerPhone: string,
    customerName: string,
    jobTitle: string,
    status: string,
    additionalInfo?: string
  ): Promise<boolean> {
    const statusMessages = {
      scheduled: `Hi ${customerName}, your tree service "${jobTitle}" has been scheduled. We'll send you details soon. - Treemarkables`,
      in_progress: `Hi ${customerName}, our team has started working on "${jobTitle}". We'll update you when complete. - Treemarkables`,
      completed: `Hi ${customerName}, your tree service "${jobTitle}" is now complete! Thank you for choosing Treemarkables. View details: localhost:5000/customer-portal`,
      cancelled: `Hi ${customerName}, we need to update you about "${jobTitle}". Please call us at 021-555-0123. - Treemarkables`
    };

    const message = statusMessages[status as keyof typeof statusMessages];
    if (!message) {
      console.error(`No SMS template found for status: ${status}`);
      return false;
    }

    const finalMessage = additionalInfo ? `${message}\n\n${additionalInfo}` : message;
    
    return this.sendSMS({
      to: customerPhone,
      message: finalMessage
    });
  }

  async sendQuoteSMS(
    customerPhone: string,
    customerName: string,
    quoteNumber: string,
    amount: number
  ): Promise<boolean> {
    const message = `Hi ${customerName}, your quote #${quoteNumber} is ready! Total: $${amount.toFixed(2)} NZD. Valid for 30 days. View: localhost:5000/customer-portal - Treemarkables`;
    
    return this.sendSMS({
      to: customerPhone,
      message
    });
  }

  async sendReminderSMS(
    customerPhone: string,
    customerName: string,
    reminderType: string,
    details: string
  ): Promise<boolean> {
    const message = `Hi ${customerName}, reminder: ${details} - Treemarkables. Questions? Call 021-555-0123`;
    
    return this.sendSMS({
      to: customerPhone,
      message
    });
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

export const smsService = new SMSService();