import { sendSMSEveryoneMessage, getSMSEveryoneSenderId } from './smsEveryoneClient';

interface SMSParams {
  to: string;
  message: string;
}

function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  // SMS Everyone requires international format without the + sign
  // For NZ numbers: 6421123456 (not +6421123456)
  if (cleaned.startsWith('64')) {
    return cleaned;
  }
  
  if (cleaned.startsWith('0')) {
    return `64${cleaned.substring(1)}`;
  }
  
  if (cleaned.length === 9 || cleaned.length === 10) {
    return `64${cleaned}`;
  }
  
  return cleaned;
}

class SMSService {
  private isConfigured: boolean = false;
  private senderId: string = '';
  private isInitializing: boolean = false;

  constructor() {
    this.configure();
  }

  private async configure(): Promise<void> {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      this.senderId = await getSMSEveryoneSenderId();
      this.isConfigured = true;
      console.log('📱 SMS Everyone NZ service configured successfully');
    } catch (error) {
      console.log('📱 SMS Everyone not configured - SMS service in mock mode');
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

      if (!this.isConfigured) {
        console.log('\n=== SMS NOTIFICATION (Mock Mode) ===');
        console.log(`To: ${normalizedPhone}`);
        console.log(`From: ${this.senderId || 'Treemarkables'}`);
        console.log(`Message: ${params.message}`);
        console.log('Time:', new Date().toLocaleString());
        console.log('==============================\n');
        return true;
      }

      const result = await sendSMSEveryoneMessage(normalizedPhone, params.message);

      console.log(`📱 SMS sent successfully to ${normalizedPhone} via SMS Everyone (Campaign ID: ${result.CampaignId})`);
      console.log(`📱 Credits used: ${result.Credits}, Messages: ${result.Messages}`);
      return true;
    } catch (error) {
      console.error('📱 SMS Everyone error:', error);
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
