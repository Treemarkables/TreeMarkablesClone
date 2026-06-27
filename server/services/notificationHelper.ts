import { storage } from '../storage.js';

/**
 * Notification helper service
 * Provides easy-to-use functions for sending push notifications to employees
 */

interface NotificationOptions {
  title: string;
  body: string;
  clickAction?: string;
  collapseId?: string;
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
      const sent = await firebaseMessagingService.sendToDevice(tokenRecord.token, options, tokenRecord.deviceInfo || undefined);
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
export async function notifyJobAssignment(employeeId: string, jobNumber: string, jobTitle: string, jobId?: string) {
  const prefs = await storage.getNotificationPreferences(employeeId);
  if (prefs && !prefs.jobAssignments) {
    return false;
  }
  
  const clickUrl = jobId ? `/dispatch?job=${jobId}` : '/dispatch';
  
  return notifyEmployee(employeeId, {
    title: '📋 New Job Assignment',
    body: `You've been assigned to Job #${jobNumber}${jobTitle ? `: ${jobTitle}` : ''}`,
    clickAction: clickUrl,
    collapseId: `job-assignment-${jobNumber}`,
    data: {
      type: 'job_assignment',
      jobNumber,
      jobId: jobId || '',
    },
  });
}

/**
 * Notify about schedule change
 */
export async function notifyScheduleChange(employeeId: string, jobNumber: string, newDate: string, jobId?: string) {
  const prefs = await storage.getNotificationPreferences(employeeId);
  if (prefs && !prefs.scheduleChanges) {
    return false;
  }
  
  const clickUrl = jobId ? `/dispatch?job=${jobId}` : '/dispatch';
  
  return notifyEmployee(employeeId, {
    title: '🕒 Schedule Update',
    body: `Job #${jobNumber} has been rescheduled to ${newDate}`,
    clickAction: clickUrl,
    collapseId: `schedule-change-${jobNumber}`,
    data: {
      type: 'schedule_change',
      jobNumber,
      jobId: jobId || '',
    },
  });
}

/**
 * Notify admin about new lead
 */
export async function notifyNewLead(adminEmployeeId: string, customerName: string, source: string) {
  const prefs = await storage.getNotificationPreferences(adminEmployeeId);
  if (prefs && !prefs.newLeads) {
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
  if (prefs && !prefs.invoicePayments) {
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
  if (prefs && !prefs.quoteAccepted) {
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
  return notifyEmployee(employeeId, {
    title: '⚠️ System Alert',
    body: message,
    clickAction: '/settings',
    data: {
      type: 'system_alert',
    },
  });
}

/**
 * Normalize contact info for consistent comparison
 * Handles NZ phone numbers in both local (021...) and international (+64 21...) formats
 */
function normalizeContact(contact: string | null | undefined): string {
  if (!contact) {
    return '';
  }
  
  const trimmed = contact.trim();
  
  // Check if it looks like an email (contains @)
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  
  // Otherwise treat as phone number
  // Strip all non-digits to get just the numbers
  const digitsOnly = trimmed.replace(/\D/g, '');
  
  // Canonicalize NZ numbers to international format without +
  // Local format: 021234567 → 6421234567
  // International: +6421234567 → 6421234567
  if (digitsOnly.startsWith('0')) {
    // NZ local format - replace leading 0 with 64
    return '64' + digitsOnly.substring(1);
  } else if (digitsOnly.startsWith('64')) {
    // Already in international format
    return digitsOnly;
  } else {
    // Other formats (Facebook IDs, etc.) - return as is
    return digitsOnly;
  }
}

/**
 * Find existing open conversation for a customer contact (email or phone)
 * Returns the most recent open conversation, or null if none exists
 */
export async function findExistingOpenConversation(contact: string): Promise<any | null> {
  try {
    if (!contact) {
      return null;
    }
    
    const normalizedContact = normalizeContact(contact);
    if (!normalizedContact) {
      return null;
    }
    
    // Get all open conversations (filter at DB level for efficiency)
    const allConversations = await storage.getAllConversations({ status: 'open' });
    
    // Filter for conversations that have messages from this contact
    const matchingConversations = [];
    
    for (const conv of allConversations) {
      // Check if customer email or phone matches
      const normalizedCustomerEmail = normalizeContact(conv.customerEmail);
      const normalizedCustomerPhone = normalizeContact(conv.customerPhone);
      
      if (normalizedCustomerEmail === normalizedContact || 
          normalizedCustomerPhone === normalizedContact) {
        matchingConversations.push(conv);
        continue;
      }
      
      // Also check senderContact from first message
      const normalizedSenderContact = normalizeContact(conv.senderContact);
      if (normalizedSenderContact === normalizedContact) {
        matchingConversations.push(conv);
        continue;
      }
      
      // Check all messages for this contact (N+1 query - could be optimized with storage method)
      const messages = await storage.getConversationMessages(conv.id);
      const hasMatchingMessage = messages.some(msg => {
        const normalizedMsgContact = normalizeContact(msg.fromContact);
        return normalizedMsgContact === normalizedContact;
      });
      
      if (hasMatchingMessage) {
        matchingConversations.push(conv);
      }
    }
    
    // Return the most recent matching conversation
    if (matchingConversations.length > 0) {
      const sorted = matchingConversations.sort((a, b) => 
        new Date(b.lastMessageAt || b.createdAt || 0).getTime() - 
        new Date(a.lastMessageAt || a.createdAt || 0).getTime()
      );
      console.log(`✅ Found existing open conversation for ${contact}: ${sorted[0].id}`);
      return sorted[0];
    }
    
    console.log(`ℹ️ No existing open conversation found for ${contact}`);
    return null;
  } catch (error) {
    console.error('Error finding existing conversation:', error);
    return null;
  }
}

/**
 * Notify admins about an inbound SMS reply from a known customer
 */
export async function notifyCustomerSmsReply(customerName: string, messageBody: string, jobNumber?: string) {
  try {
    const title = jobNumber
      ? `SMS from ${customerName} — Job #${jobNumber}`
      : `SMS from ${customerName}`;
    const body = messageBody.slice(0, 120) + (messageBody.length > 120 ? '…' : '');
    return await pushToAdminsWithCustomerMessages({
      title,
      body,
      clickAction: '/conversations',
      data: { type: 'sms_reply', customerName, jobNumber: jobNumber || '' },
    });
  } catch (error) {
    console.error('Error notifying SMS reply:', error);
    return 0;
  }
}

/**
 * Send a push notification to all admin employees who have customerMessages enabled
 */
export async function pushToAdminsWithCustomerMessages(options: NotificationOptions) {
  try {
    const employees = await storage.getAllEmployees();
    const admins = employees.filter(emp => emp.role === 'admin');
    let sent = 0;
    for (const admin of admins) {
      const prefs = await storage.getNotificationPreferences(admin.id);
      if (prefs?.customerMessages !== false) {
        const result = await notifyEmployee(admin.id, options);
        if (result) sent++;
      }
    }
    return sent;
  } catch (error) {
    console.error('Error pushing to admins:', error);
    return 0;
  }
}

/**
 * For a conversation, return the jobId of the most recent non-archived job
 * for its customer. Used so push notifications about a reply can deep-link
 * to the job card's diary tab once the conversation has been converted to a
 * lead/job, instead of back to the generic Conversations list.
 *
 * Fetches the conversation from storage to read customerId — callers pass
 * partial objects without FKs, so we can't rely on them for the lookup.
 */
async function getConversationJobId(conversationId: string): Promise<string | null> {
  try {
    const full = await storage.getConversation(conversationId);
    const customerId = full?.customerId;
    if (!customerId) return null;
    const jobs = await storage.getJobsByCustomer(customerId);
    const active = jobs.find(
      (j: any) => j.status !== 'archived' && j.status !== 'unsuccessful',
    );
    return (active ?? jobs[0])?.id ?? null;
  } catch (error) {
    console.error('Error looking up job for conversation:', error);
    return null;
  }
}

/**
 * Create notification bell entry for new conversation AND send push notification
 * Call this after successfully creating a conversation from real channels (not seed data)
 */
export async function createConversationNotification(conversation: {
  id: string;
  title: string | null;
  source: string | null;
  serviceType?: string | null;
  priority?: string | null;
}) {
  try {
    await storage.createNotification({
      title: `New ${conversation.source || 'conversation'} contact`,
      message: conversation.title || 'New inquiry received',
      type: 'new_conversation',
      priority: conversation.priority === 'urgent' ? 'high' : 'medium',
      actionUrl: `/conversation/${conversation.id}`,
      metadata: {
        conversationId: conversation.id,
        source: conversation.source,
        serviceType: conversation.serviceType
      }
    });

    const sourceLabel = conversation.source === 'email' ? 'Email' :
                        conversation.source === 'sms' ? 'SMS' :
                        conversation.source === 'phone' ? 'Call' :
                        conversation.source || 'Message';

    const jobId = await getConversationJobId(conversation.id);
    const clickAction = jobId
      ? `/dispatch?job=${jobId}&tab=diary`
      : `/conversation/${conversation.id}`;

    await pushToAdminsWithCustomerMessages({
      title: `New ${sourceLabel} Inquiry`,
      body: conversation.title || 'New customer inquiry received',
      clickAction,
      data: {
        type: 'new_conversation',
        conversationId: conversation.id,
        source: conversation.source || '',
        jobId: jobId || '',
      },
    });

    console.log(`✅ Created notification bell + push for new conversation: ${conversation.id} (${conversation.source})`);
    return true;
  } catch (error) {
    console.error('Error creating conversation notification:', error);
    return false;
  }
}

/**
 * Create notification bell entry + push for a new lead (job auto-created from
 * a customer-facing form). The bell deep-links to the job's diary tab so the
 * operator lands directly on the lead.
 */
export async function createNewLeadNotification(params: {
  jobId: string;
  jobNumber: number | string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  sourceLabel: string;
  messagePreview?: string;
  conversationId?: string;
}) {
  try {
    const clickAction = `/dispatch?job=${params.jobId}&tab=diary`;
    const previewText = (params.messagePreview || '').trim();
    const truncatedPreview = previewText.length > 200
      ? previewText.substring(0, 200) + '...'
      : previewText;
    const bellMessage = truncatedPreview
      ? `${params.customerName}: ${truncatedPreview}`
      : `New lead from ${params.customerName}`;

    await storage.createNotification({
      title: `New ${params.sourceLabel} lead`,
      message: bellMessage,
      type: 'new_lead',
      priority: 'high',
      actionUrl: clickAction,
      jobId: params.jobId,
      customerId: params.customerId,
      metadata: {
        jobNumber: params.jobNumber,
        source: params.sourceLabel,
        conversationId: params.conversationId,
        contactEmail: params.customerEmail,
        contactPhone: params.customerPhone,
      },
    });

    const contactBits = [params.customerPhone, params.customerEmail].filter(Boolean).join(' · ');
    const pushBody = contactBits
      ? `${params.customerName} (${contactBits})`
      : params.customerName;

    await pushToAdminsWithCustomerMessages({
      title: `New ${params.sourceLabel} lead`,
      body: pushBody,
      clickAction,
      data: {
        type: 'new_lead',
        jobId: params.jobId,
        conversationId: params.conversationId || '',
        source: params.sourceLabel,
      },
    });

    console.log(`✅ Created new-lead notification for job ${params.jobId} (#${params.jobNumber})`);
    return true;
  } catch (error) {
    console.error('Error creating new-lead notification:', error);
    return false;
  }
}

/**
 * Create a bell notification for a job-side activity (photo, note, proposal sent, etc.)
 * that didn't flow through the /api/jobs/:jobId/diary route (where notification
 * creation is already wired up). Looks up the job to attach jobNumber + customerId
 * for the bell card and deep-links to the diary tab.
 *
 * Pass the matching `type` from notificationFilter.TYPE_TO_PREF so the bell's
 * client-side preference filter routes the entry to the right toggle.
 */
export async function createJobActivityNotification(params: {
  jobId: string;
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high';
  authorName?: string;
  diaryEntryId?: string;
  proposalId?: string;
  quoteId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    const job = await storage.getJob(params.jobId);
    if (!job) {
      console.warn(`⚠️  Skipping ${params.type} notification: job ${params.jobId} not found`);
      return false;
    }
    await storage.createNotification({
      title: params.title,
      message: params.message,
      type: params.type,
      priority: params.priority || 'medium',
      isRead: false,
      userId: params.userId,
      jobId: params.jobId,
      customerId: job.customerId || undefined,
      proposalId: params.proposalId,
      quoteId: params.quoteId,
      diaryEntryId: params.diaryEntryId,
      actionUrl: `/dispatch?job=${params.jobId}&tab=diary`,
      metadata: {
        jobNumber: job.jobNumber,
        authorName: params.authorName,
        ...(params.metadata || {}),
      },
    });
    console.log(`🔔 Bell entry: ${params.type} for job ${job.jobNumber}`);
    return true;
  } catch (error) {
    console.error(`Error creating ${params.type} notification:`, error);
    return false;
  }
}

/**
 * Send push notification for a reply received on an existing conversation
 * Call this when a customer replies via email, SMS, or any channel
 */
export async function notifyConversationReply(conversation: {
  id: string;
  title: string | null;
  source: string | null;
  customerName?: string | null;
}, replyPreview?: string, messageId?: string) {
  try {
    // De-dup: avoid notifying twice for the SAME inbound message. When the
    // caller knows the message's Message-ID we match on that exactly (robust
    // across the poller/webhook race and across a "Clear all"), so genuinely
    // distinct replies in the same conversation each notify. Without a
    // messageId we fall back to a SHORT per-conversation window — long enough
    // to swallow a near-instant double-call, short enough that a real follow-up
    // message still gets its own bell entry. (The old guard blanket-suppressed
    // every reply on a conversation for a whole 24h.)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentNotifications = await storage.getNotificationsCreatedSince(since);
    const alreadyNotified = messageId
      ? recentNotifications.some(
          (n) =>
            n.type === 'new_conversation' &&
            (n.metadata as any)?.messageId === messageId,
        )
      : recentNotifications.some(
          (n) =>
            n.type === 'new_conversation' &&
            (n.metadata as any)?.conversationId === conversation.id &&
            Date.now() - new Date(n.createdAt as any).getTime() < 5 * 60 * 1000,
        );
    if (alreadyNotified) {
      console.log(`✅ Skipping duplicate conversation reply notification for: ${conversation.id}`);
      return true;
    }

    const sourceLabel = conversation.source === 'email' ? 'Email' :
                        conversation.source === 'sms' ? 'SMS' :
                        conversation.source === 'phone' ? 'Call' :
                        conversation.source || 'Message';

    const senderName = conversation.customerName || conversation.title || 'Customer';
    const bodyText = replyPreview
      ? `${senderName}: ${replyPreview.slice(0, 100)}${replyPreview.length > 100 ? '…' : ''}`
      : `${senderName} replied via ${sourceLabel}`;

    const jobId = await getConversationJobId(conversation.id);
    const clickAction = jobId
      ? `/dispatch?job=${jobId}&tab=diary`
      : `/conversation/${conversation.id}`;

    await storage.createNotification({
      title: `${sourceLabel} reply from ${senderName}`,
      message: bodyText,
      type: 'new_conversation',
      priority: 'medium',
      actionUrl: clickAction,
      metadata: {
        conversationId: conversation.id,
        source: conversation.source,
        jobId: jobId || undefined,
        ...(messageId && { messageId }),
      }
    });

    const sent = await pushToAdminsWithCustomerMessages({
      title: `${sourceLabel} Reply — ${senderName}`,
      body: bodyText,
      clickAction,
      data: {
        type: 'conversation_reply',
        conversationId: conversation.id,
        source: conversation.source || '',
        jobId: jobId || '',
      },
    });

    console.log(`✅ Sent conversation reply push to ${sent} admin(s): ${conversation.id}`);
    return true;
  } catch (error) {
    console.error('Error sending conversation reply notification:', error);
    return false;
  }
}
