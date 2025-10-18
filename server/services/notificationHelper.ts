import { storage } from '../storage.js';

/**
 * Notification helper service
 * Provides easy-to-use functions for sending push notifications to employees
 */

interface NotificationOptions {
  title: string;
  body: string;
  clickAction?: string;
  data?: Record<string, any>;
}

/**
 * Send a notification to a specific employee
 */
export async function notifyEmployee(employeeId: string, options: NotificationOptions) {
  try {
    // Import Firebase messaging service dynamically
    const { firebaseMessagingService } = await import('./firebaseMessagingService.js');
    
    // Get notification preferences for this employee
    const prefs = await storage.getNotificationPreferences(employeeId);
    
    // Get all active FCM tokens for this employee
    const tokens = await storage.getActiveFcmTokens(employeeId);
    
    if (tokens.length === 0) {
      console.log(`📱 No active notification tokens for employee ${employeeId}`);
      return false;
    }
    
    // Send to all active devices
    let successCount = 0;
    for (const tokenRecord of tokens) {
      const sent = await firebaseMessagingService.sendToDevice(tokenRecord.token, options);
      if (sent) {
        successCount++;
        // Mark token as recently used
        await storage.markFcmTokenAsUsed(tokenRecord.token);
      }
    }
    
    console.log(`✅ Notification sent to ${successCount}/${tokens.length} devices for employee ${employeeId}`);
    return successCount > 0;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Send notifications to multiple employees
 */
export async function notifyEmployees(employeeIds: string[], options: NotificationOptions) {
  const results = await Promise.all(
    employeeIds.map(id => notifyEmployee(id, options))
  );
  return results.filter(Boolean).length;
}

/**
 * Notify about job assignment
 */
export async function notifyJobAssignment(employeeId: string, jobNumber: string, jobTitle: string) {
  const prefs = await storage.getNotificationPreferences(employeeId);
  if (!prefs?.enableJobAssignments) {
    return false;
  }
  
  return notifyEmployee(employeeId, {
    title: '📋 New Job Assignment',
    body: `You've been assigned to Job #${jobNumber}${jobTitle ? `: ${jobTitle}` : ''}`,
    clickAction: '/dispatch',
    data: {
      type: 'job_assignment',
      jobNumber,
    },
  });
}

/**
 * Notify about schedule change
 */
export async function notifyScheduleChange(employeeId: string, jobNumber: string, newDate: string) {
  const prefs = await storage.getNotificationPreferences(employeeId);
  if (!prefs?.enableScheduleChanges) {
    return false;
  }
  
  return notifyEmployee(employeeId, {
    title: '🕒 Schedule Update',
    body: `Job #${jobNumber} has been rescheduled to ${newDate}`,
    clickAction: '/dispatch',
    data: {
      type: 'schedule_change',
      jobNumber,
    },
  });
}

/**
 * Notify admin about new lead
 */
export async function notifyNewLead(adminEmployeeId: string, customerName: string, source: string) {
  const prefs = await storage.getNotificationPreferences(adminEmployeeId);
  if (!prefs?.enableNewLeads) {
    return false;
  }
  
  return notifyEmployee(adminEmployeeId, {
    title: '🌟 New Lead',
    body: `New inquiry from ${customerName} via ${source}`,
    clickAction: '/conversations',
    data: {
      type: 'new_lead',
      customerName,
      source,
    },
  });
}

/**
 * Notify about invoice payment
 */
export async function notifyInvoicePayment(employeeId: string, invoiceNumber: string, amount: string) {
  const prefs = await storage.getNotificationPreferences(employeeId);
  if (!prefs?.enableInvoicePayments) {
    return false;
  }
  
  return notifyEmployee(employeeId, {
    title: '💰 Payment Received',
    body: `Invoice #${invoiceNumber} paid - ${amount}`,
    clickAction: '/invoices',
    data: {
      type: 'invoice_payment',
      invoiceNumber,
    },
  });
}

/**
 * Notify about quote acceptance
 */
export async function notifyQuoteAccepted(employeeId: string, quoteNumber: string, customerName: string) {
  const prefs = await storage.getNotificationPreferences(employeeId);
  if (!prefs?.enableQuoteAcceptance) {
    return false;
  }
  
  return notifyEmployee(employeeId, {
    title: '✅ Quote Accepted',
    body: `${customerName} accepted quote #${quoteNumber}`,
    clickAction: '/quotes',
    data: {
      type: 'quote_accepted',
      quoteNumber,
    },
  });
}

/**
 * Send system alert to admin
 */
export async function notifySystemAlert(employeeId: string, message: string) {
  const prefs = await storage.getNotificationPreferences(employeeId);
  if (!prefs?.enableSystemAlerts) {
    return false;
  }
  
  return notifyEmployee(employeeId, {
    title: '⚠️ System Alert',
    body: message,
    clickAction: '/settings',
    data: {
      type: 'system_alert',
    },
  });
}
