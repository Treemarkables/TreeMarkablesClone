// Firebase Cloud Messaging service using FCM v1 HTTP API directly
// Uses google-auth-library for OAuth 2.0 token exchange (proven to work)
import { GoogleAuth } from 'google-auth-library';

class FirebaseMessagingService {
  private auth: GoogleAuth | null = null;
  private projectId: string | null = null;

  private getAuth(): { auth: GoogleAuth; projectId: string } | null {
    if (this.auth && this.projectId) {
      return { auth: this.auth, projectId: this.projectId };
    }

    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountStr) {
      console.warn('⚠️  Firebase service account not configured - push notifications disabled');
      return null;
    }

    try {
      const sa = JSON.parse(serviceAccountStr);

      // Fix double-escaped newlines when pasted into Replit secrets
      if (sa.private_key && sa.private_key.includes('\\n')) {
        sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      }

      this.auth = new GoogleAuth({
        credentials: sa,
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      });
      this.projectId = sa.project_id;
      console.log('✅ Firebase FCM service initialized for project:', this.projectId);
      return { auth: this.auth, projectId: this.projectId! };
    } catch (error) {
      console.error('❌ Error initializing Firebase FCM service:', error);
      return null;
    }
  }

  async sendToDevice(token: string, notification: {
    title: string;
    body: string;
    icon?: string;
    clickAction?: string;
    data?: Record<string, string>;
  }): Promise<boolean> {
    const authCtx = this.getAuth();
    if (!authCtx) return false;

    try {
      // Use getClient().getRequestHeaders() — the correct TypeScript API for getting auth headers
      const client = await authCtx.auth.getClient();
      const authHeaders = await client.getRequestHeaders();

      if (!authHeaders.Authorization) {
        console.error('❌ Could not obtain FCM auth headers');
        return false;
      }
      const messageData: Record<string, string> = {
        ...(notification.data || {}),
        ...(notification.clickAction ? { clickAction: notification.clickAction } : {}),
      };

      const body = JSON.stringify({
        message: {
          token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: messageData,
        },
      });

      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${authCtx.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body,
        }
      );

      const result = await response.json() as any;

      if (response.ok) {
        console.log('✅ FCM notification sent:', result.name);
        return true;
      }

      const errCode = result?.error?.status || result?.error?.code || response.status;
      const errMsg = result?.error?.message || 'Unknown error';

      // Stale/deregistered tokens — treat as silent failure
      if (
        errCode === 'NOT_FOUND' ||
        errCode === 'UNREGISTERED' ||
        errMsg.includes('not a valid FCM registration token') ||
        errMsg.includes('NotRegistered')
      ) {
        console.log('❌ FCM token no longer valid (stale/deregistered):', token.substring(0, 20) + '...');
        return false;
      }

      console.error('❌ FCM send failed:', errCode, errMsg);
      return false;
    } catch (error) {
      console.error('❌ Error sending FCM notification:', error);
      return false;
    }
  }

  async sendToMultipleDevices(tokens: string[], notification: {
    title: string;
    body: string;
    icon?: string;
    clickAction?: string;
    data?: Record<string, string>;
  }): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
    const results = { success: 0, failure: 0, invalidTokens: [] as string[] };

    for (const token of tokens) {
      const sent = await this.sendToDevice(token, notification);
      if (sent) {
        results.success++;
      } else {
        results.failure++;
        results.invalidTokens.push(token);
      }
    }

    return results;
  }

  async sendJobAssignmentNotification(token: string, data: {
    jobNumber: string;
    jobTitle: string;
    scheduledDate: string;
    scheduledTime: string;
    address?: string;
  }): Promise<boolean> {
    return this.sendToDevice(token, {
      title: 'New Job Assignment',
      body: `Job #${data.jobNumber}: ${data.jobTitle}\n${data.scheduledDate} at ${data.scheduledTime}`,
      clickAction: '/dispatch',
      data: { type: 'job_assignment', jobNumber: data.jobNumber },
    });
  }

  async sendScheduleChangeNotification(token: string, data: {
    jobNumber: string;
    jobTitle: string;
    oldDateTime: string;
    newDateTime: string;
  }): Promise<boolean> {
    return this.sendToDevice(token, {
      title: 'Schedule Changed',
      body: `Job #${data.jobNumber} rescheduled\nFrom: ${data.oldDateTime}\nTo: ${data.newDateTime}`,
      clickAction: '/dispatch',
      data: { type: 'schedule_change', jobNumber: data.jobNumber },
    });
  }

  async sendNewLeadNotification(token: string, data: {
    customerName: string;
    source?: string;
  }): Promise<boolean> {
    return this.sendToDevice(token, {
      title: 'New Lead',
      body: `New inquiry from ${data.customerName}${data.source ? ` via ${data.source}` : ''}`,
      clickAction: '/conversations',
      data: { type: 'new_lead' },
    });
  }

  async sendInvoicePaymentNotification(token: string, data: {
    invoiceNumber: string;
    amount: string;
    customerName: string;
  }): Promise<boolean> {
    return this.sendToDevice(token, {
      title: 'Payment Received',
      body: `${data.customerName} paid ${data.amount}\nInvoice #${data.invoiceNumber}`,
      clickAction: '/invoices',
      data: { type: 'invoice_payment', invoiceNumber: data.invoiceNumber },
    });
  }
}

export const firebaseMessagingService = new FirebaseMessagingService();
