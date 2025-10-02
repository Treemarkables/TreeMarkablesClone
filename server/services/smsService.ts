import { getTwilioClient, getTwilioFromPhoneNumber } from './twilioClient';
import type { Twilio } from 'twilio';

interface SMSParams {
  to: string;
  message: string;
}

function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('64')) {
    return `+${cleaned}`;
  }
  
  if (cleaned.startsWith('0')) {
    return `+64${cleaned.substring(1)}`;
  }
  
  if (cleaned.length === 9 || cleaned.length === 10) {
    return `+64${cleaned}`;
  }
  
  return phone;
}

class SMSService {
  private client: Twilio | null = null;
  private isConfigured: boolean = false;
  private fromPhone: string = '';
  private isInitializing: boolean = false;

  constructor() {
    this.configure();
  }

  private async configure(): Promise<void> {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      this.client = await getTwilioClient();
      this.fromPhone = await getTwilioFromPhoneNumber();
      this.isConfigured = true;
      console.log('📱 Twilio SMS service configured successfully via Replit connector');
    } catch (error) {
      console.log('📱 Twilio connector not configured - SMS service in mock mode');
      console.log('📱 Error:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.isInitializing = false;
    }
  }

  private async ensureConfigured(): Promise<void> {
    if (!this.isConfigured && !this.isInitializing) {
      await this.configure();
    }
  }

  async sendSMS(params: SMSParams): Promise<boolean> {
    try {
      await this.ensureConfigured();

      const normalizedPhone = normalizePhoneNumber(params.to);
      console.log(`📱 Normalizing phone: ${params.to} -> ${normalizedPhone}`);

      if (!this.isConfigured || !this.client) {
        console.log('\n=== SMS NOTIFICATION (Mock Mode) ===');
        console.log(`To: ${normalizedPhone}`);
        console.log(`From: ${this.fromPhone || 'Treemarkables'}`);
        console.log(`Message: ${params.message}`);
        console.log('Time:', new Date().toLocaleString());
        console.log('==============================\n');
        return true;
      }

      console.log(`📱 DEBUG - Account SID being used: ${(this.client as any).accountSid?.substring(0, 15)}...`);
      console.log(`📱 DEBUG - From phone: ${this.fromPhone}`);
      console.log(`📱 DEBUG - To phone: ${normalizedPhone}`);

      const message = await this.client.messages.create({
        body: params.message,
        from: this.fromPhone,
        to: normalizedPhone,
      });

      console.log(`📱 SMS sent successfully to ${normalizedPhone}, SID: ${message.sid}`);
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
