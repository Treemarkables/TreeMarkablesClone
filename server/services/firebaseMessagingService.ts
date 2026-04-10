// Firebase Cloud Messaging service for sending push notifications
import admin from 'firebase-admin';

class FirebaseMessagingService {
  private initialized = false;

  // Initialize Firebase Admin SDK
  initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      
      if (!serviceAccount) {
        console.warn('⚠️  Firebase service account not configured - push notifications disabled');
        return;
      }

      // Parse the service account JSON
      const serviceAccountData = JSON.parse(serviceAccount);

      // Fix common issue: private_key newlines double-escaped when pasted into secrets
      if (serviceAccountData.private_key && serviceAccountData.private_key.includes('\\n')) {
        serviceAccountData.private_key = serviceAccountData.private_key.replace(/\\n/g, '\n');
      }

      // Debug: log key format info (no sensitive data)
      const pk = serviceAccountData.private_key || '';
      console.log('🔑 Firebase key debug:', {
        clientEmail: serviceAccountData.client_email,
        projectId: serviceAccountData.project_id,
        keyType: serviceAccountData.type,
        keyStartsWith: pk.substring(0, 40),
        hasActualNewlines: pk.includes('\n'),
        hasEscapedNewlines: pk.includes('\\n'),
        keyLength: pk.length,
      });

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountData),
      });

      this.initialized = true;
      console.log('✅ Firebase Admin SDK initialized for push notifications');
    } catch (error) {
      console.error('❌ Error initializing Firebase Admin SDK:', error);
    }
  }

  // Send notification to a single device
  async sendToDevice(token: string, notification: {
    title: string;
    body: string;
    icon?: string;
    clickAction?: string;
    data?: Record<string, string>;
  }): Promise<boolean> {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.initialized) {
      console.warn('Firebase not initialized - skipping notification');
      return false;
    }

    try {
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        webpush: notification.clickAction ? {
          fcmOptions: {
            link: notification.clickAction,
          },
        } : undefined,
        token: token,
      };

      const response = await admin.messaging().send(message);
      console.log('✅ Notification sent successfully:', response);
      return true;
    } catch (error: any) {
      // Handle invalid token errors
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        console.log('❌ Invalid FCM token - should be removed from database:', token);
        return false;
      }
      
      console.error('❌ Error sending notification:', error);
      return false;
    }
  }

  // Send notification to multiple devices
  async sendToMultipleDevices(tokens: string[], notification: {
    title: string;
    body: string;
    icon?: string;
    clickAction?: string;
    data?: Record<string, string>;
  }): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.initialized) {
      console.warn('Firebase not initialized - skipping notifications');
      return { success: 0, failure: tokens.length, invalidTokens: [] };
    }

    const results = {
      success: 0,
      failure: 0,
      invalidTokens: [] as string[],
    };

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

  // Send notification for job assignment
  async sendJobAssignmentNotification(token: string, data: {
    jobNumber: string;
    jobTitle: string;
    scheduledDate: string;
    scheduledTime: string;
    address?: string;
  }): Promise<boolean> {
    return this.sendToDevice(token, {
      title: `🌳 New Job Assignment`,
      body: `Job #${data.jobNumber}: ${data.jobTitle}\n${data.scheduledDate} at ${data.scheduledTime}`,
      clickAction: '/dispatch',
      data: {
        type: 'job_assignment',
        jobNumber: data.jobNumber,
      },
    });
  }

  // Send notification for schedule change
  async sendScheduleChangeNotification(token: string, data: {
    jobNumber: string;
    jobTitle: string;
    oldDateTime: string;
    newDateTime: string;
  }): Promise<boolean> {
    return this.sendToDevice(token, {
      title: `📅 Schedule Changed`,
      body: `Job #${data.jobNumber} rescheduled\nFrom: ${data.oldDateTime}\nTo: ${data.newDateTime}`,
      clickAction: '/dispatch',
      data: {
        type: 'schedule_change',
        jobNumber: data.jobNumber,
      },
    });
  }

  // Send notification for new lead
  async sendNewLeadNotification(token: string, data: {
    customerName: string;
    source?: string;
  }): Promise<boolean> {
    return this.sendToDevice(token, {
      title: `📞 New Lead`,
      body: `New inquiry from ${data.customerName}${data.source ? ` via ${data.source}` : ''}`,
      clickAction: '/conversations',
      data: {
        type: 'new_lead',
      },
    });
  }

  // Send notification for invoice payment
  async sendInvoicePaymentNotification(token: string, data: {
    invoiceNumber: string;
    amount: string;
    customerName: string;
  }): Promise<boolean> {
    return this.sendToDevice(token, {
      title: `💰 Payment Received`,
      body: `${data.customerName} paid ${data.amount}\nInvoice #${data.invoiceNumber}`,
      clickAction: '/invoices',
      data: {
        type: 'invoice_payment',
        invoiceNumber: data.invoiceNumber,
      },
    });
  }
}

export const firebaseMessagingService = new FirebaseMessagingService();
