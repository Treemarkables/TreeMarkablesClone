// Firebase Cloud Messaging service using Firebase Admin SDK
import admin from 'firebase-admin';
import { APP_URL } from '../config/appUrl.js';
import { jobIdFromNotificationPath, resolveNotificationPath } from '@shared/notificationDeepLink';

function stringData(data: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (value == null || value === '') continue;
    out[key] = String(value);
  }
  return out;
}

export interface FcmSendResult {
  ok: boolean;
  // FCM error code (e.g. 'messaging/third-party-auth-error') when ok is false.
  errorCode?: string;
}

class FirebaseMessagingService {
  private initialized = false;

  private init(): boolean {
    if (this.initialized) return true;

    const serviceAccountStr =
      process.env.FIREBASE_SERVICE_ACCOUNT || process.env.Fire_Service_Account;
    if (!serviceAccountStr) {
      console.warn('⚠️  Firebase service account not configured - push notifications disabled');
      return false;
    }

    try {
      const sa = JSON.parse(serviceAccountStr);
      if (sa.private_key && sa.private_key.includes('\\n')) {
        sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      }

      if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(sa) });
      }

      this.initialized = true;
      console.log('✅ Firebase Admin SDK initialized for project:', sa.project_id);
      return true;
    } catch (error) {
      console.error('❌ Error initializing Firebase Admin SDK:', error);
      return false;
    }
  }

  async sendToDevice(token: string, notification: {
    title: string;
    body: string;
    icon?: string;
    clickAction?: string;
    collapseId?: string;
    data?: Record<string, string>;
  }, deviceLabel?: string): Promise<boolean> {
    return (await this.sendToDeviceDetailed(token, notification, deviceLabel)).ok;
  }

  async sendToDeviceDetailed(token: string, notification: {
    title: string;
    body: string;
    icon?: string;
    clickAction?: string;
    collapseId?: string;
    data?: Record<string, string>;
  }, deviceLabel?: string): Promise<FcmSendResult> {
    if (!this.init()) return { ok: false, errorCode: 'not-configured' };

    try {
      const dataPayload = stringData(notification.data);
      if (notification.clickAction) {
        dataPayload.clickAction = notification.clickAction;
      }
      if (!dataPayload.jobId && dataPayload.clickAction) {
        const fromPath = jobIdFromNotificationPath(dataPayload.clickAction);
        if (fromPath) dataPayload.jobId = fromPath;
      }
      // Legacy senders used a bare `/dispatch` clickAction even when jobId was
      // in `data`. Resolve here so APNs/FCM/web all carry the job-card path.
      const resolved = resolveNotificationPath(dataPayload);
      if (resolved) dataPayload.clickAction = resolved;

      // collapseId makes APNs/FCM replace an undelivered or displayed copy of
      // the same logical alert instead of stacking it — an employee whose
      // reinstalls left several live tokens pointing at one phone sees a
      // single banner, not one per token. apns-collapse-id max is 64 bytes.
      const collapseId = notification.collapseId?.slice(0, 64);
      const clickPath = dataPayload.clickAction;
      const clickLink = clickPath
        ? `${APP_URL}${clickPath.startsWith('/') ? clickPath : `/${clickPath}`}`
        : undefined;

      const message: admin.messaging.Message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: dataPayload,
        apns: {
          headers: {
            'apns-priority': '10',
            ...(collapseId ? { 'apns-collapse-id': collapseId } : {}),
          },
          // Repeat custom keys on the APNs payload itself. Specifying `aps`
          // alone has in some Admin SDK versions dropped top-level `data`
          // from userInfo, which made iOS taps fall through to the default
          // dispatch board.
          payload: {
            aps: { sound: 'default', badge: 1 },
            ...dataPayload,
          },
        },
        android: {
          priority: 'high',
          ...(collapseId ? { collapseKey: collapseId } : {}),
          notification: {
            sound: 'default',
            ...(clickPath ? { clickAction: clickPath } : {}),
          },
        },
        ...(clickLink ? { webpush: { fcmOptions: { link: clickLink } } } : {}),
      };

      const result = await admin.messaging().send(message);
      // Log the deep-link target alongside the message id so the DO logs reveal
      // whether a tap that "lands on the dispatch board" was sent the right
      // /dispatch?job=<id> target or a bare /dispatch fallback (missing jobId).
      console.log(
        `✅ FCM notification sent: id=${result} type=${dataPayload.type || '?'} clickAction=${dataPayload.clickAction || '(none)'} jobId=${dataPayload.jobId || '(none)'} device=${deviceLabel || '?'} token=…${token.slice(-8)}`,
      );
      return { ok: true };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };

      if (
        err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token'
      ) {
        console.log('❌ FCM token no longer valid (stale/deregistered) — deactivating:', token.substring(0, 20) + '...');
        try {
          const { storage } = await import('../storage.js');
          await storage.deleteFcmTokenByToken(token);
        } catch (cleanupErr) {
          console.error('❌ Failed to deactivate stale FCM token:', cleanupErr);
        }
        return { ok: false, errorCode: err.code };
      }

      // messaging/third-party-auth-error = Firebase was rejected when forwarding
      // to the platform's push gateway (APNs for iOS, Web Push/VAPID for
      // browsers). This is a PROJECT CREDENTIAL problem, NOT a bad token — the
      // APNs auth key (.p8) or Web Push cert in the Firebase console is missing,
      // expired, or mismatched (wrong Key ID / Team ID / bundle id, or
      // sandbox-vs-production APNs). Do NOT deactivate the token here; log the
      // device platform so we can tell which gateway's credential is broken.
      if (err.code === 'messaging/third-party-auth-error') {
        console.error(
          `❌ FCM third-party-auth-error (push-gateway credential rejected — check Firebase APNs key / Web Push cert): device=${deviceLabel || '?'} token=…${token.slice(-8)} — ${err.message}`,
        );
        return { ok: false, errorCode: err.code };
      }

      console.error(`❌ FCM send failed: ${err.code} device=${deviceLabel || '?'} token=…${token.slice(-8)} — ${err.message}`);
      return { ok: false, errorCode: err.code };
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
    // jobId is not on this legacy helper; callers that have it use notifyJobAssignment.
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
