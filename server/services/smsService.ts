import { sendSMSEveryoneMessage, getSMSEveryoneSenderId } from './smsEveryoneClient';
import * as usageMeter from './usageMeter';
import { currentBusinessId } from '../tenancy/tenantStore';
import { storage } from '../storage';

interface SMSParams {
  to: string;
  message: string;
  businessId?: string;  // explicit tenant (required on cron/off-request paths); else from ALS
  feature?: string;     // e.g. 'booking_reminder' — for usage analytics
}

// ── Customer-link guard ──────────────────────────────────────────────────────
// Last gate before an SMS leaves the platform, so it protects every sender —
// stale client bundles, crons, future features — across all tenants. Message
// text is composed client-side, so the server can't trust the link inside it.
//
// 1. `/proposal/<id>` without `/accept` is the SESSION-AUTHED staff viewer —
//    anonymous customers 404 on it under RLS (the July 2026 dead-link bug).
//    Rewrite it to the public accept page rather than trusting old clients.
// 2. A linked proposal that doesn't exist in the DB means the message would be
//    a dead end no matter the path — block the send and log an audit line
//    (grep DO logs for SMS_LINK_AUDIT).
// 3. Any localhost link in a customer SMS is always a bug (a template once
//    shipped `localhost:5000/customer-portal`) — block it.
const PROPOSAL_LINK_RE = /\/proposal\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/accept)?/gi;

async function guardCustomerLinks(
  message: string,
): Promise<{ message: string; ok: boolean; reason?: string }> {
  if (/localhost|127\.0\.0\.1/i.test(message)) {
    return { message, ok: false, reason: 'message contains a localhost link' };
  }

  const proposalIds = new Set<string>();
  const rewritten = message.replace(PROPOSAL_LINK_RE, (_m, id: string, accept?: string) => {
    proposalIds.add(id);
    return `/proposal/${id}${accept ?? '/accept'}`;
  });

  for (const id of proposalIds) {
    try {
      const proposal = await storage.getProposal(id);
      if (!proposal) {
        return { message: rewritten, ok: false, reason: `linked proposal ${id} does not exist` };
      }
    } catch (e) {
      // Lookup infrastructure failure (not a missing row) — don't block sends on it.
      console.warn(`⚠️ SMS_LINK_AUDIT proposal lookup failed for ${id}:`, (e as Error).message);
    }
  }

  return { message: rewritten, ok: true };
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

      // Usage-cap gate. businessId comes explicitly (cron paths) or from the request's
      // tenant context. No tenant → can't meter → fail-open (send unmetered).
      const businessId = params.businessId ?? currentBusinessId();
      if (businessId) {
        const ok = await usageMeter.guard('sms', businessId, params.feature);
        if (!ok) return false; // over cap AND enforcement on
      }

      const linkGuard = await guardCustomerLinks(params.message);
      if (!linkGuard.ok) {
        console.error(
          `🛑 SMS_LINK_AUDIT blocked send to=${params.to} business=${businessId ?? 'n/a'} reason="${linkGuard.reason}" message="${params.message.slice(0, 200)}"`,
        );
        return false;
      }
      if (linkGuard.message !== params.message) {
        console.warn(
          `🔧 SMS_LINK_AUDIT rewrote staff viewer link to public accept link (to=${params.to} business=${businessId ?? 'n/a'})`,
        );
      }
      const message = linkGuard.message;

      const normalizedPhone = normalizePhoneNumber(params.to);
      console.log(`📱 Normalizing phone: ${params.to} -> ${normalizedPhone}`);

      if (!this.isConfigured) {
        console.log('\n=== SMS NOTIFICATION (Mock Mode) ===');
        console.log(`To: ${normalizedPhone}`);
        console.log(`From: ${this.senderId || 'Treemarkables'}`);
        console.log(`Message: ${message}`);
        console.log('Time:', new Date().toLocaleString());
        console.log('==============================\n');
        if (businessId) await usageMeter.recordUsage('sms', businessId, { feature: params.feature });
        return true;
      }

      const result = await sendSMSEveryoneMessage(normalizedPhone, message);

      console.log(`📱 SMS sent successfully to ${normalizedPhone} via SMS Everyone (Campaign ID: ${result.CampaignId})`);
      console.log(`📱 Credits used: ${result.Credits}, Messages: ${result.Messages}`);
      if (businessId) await usageMeter.recordUsage('sms', businessId, { feature: params.feature });
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
      scheduled: `Hi ${customerName}, your tree service has been scheduled. We'll be in touch with the details. - Treemarkables`,
      in_progress: `Hi ${customerName}, our team has started working on your job. We'll update you when complete. - Treemarkables`,
      completed: `Hi ${customerName}, your job is now complete! Thank you for choosing Treemarkables.`,
      cancelled: `Hi ${customerName}, we need to update you about your job. Please call us at 021-555-0123. - Treemarkables`
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
    // No link here on purpose: this template only knows the quote NUMBER, not a
    // linkable document id, and the localhost URL it used to carry would have
    // gone straight to customers (now blocked by guardCustomerLinks anyway).
    const message = `Hi ${customerName}, your quote #${quoteNumber} is ready! Total: $${amount.toFixed(2)} NZD. Valid for 30 days. We'll follow up with the full details. - Treemarkables`;
    
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
