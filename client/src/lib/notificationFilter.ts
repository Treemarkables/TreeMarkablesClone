export interface NotificationPrefs {
  browserNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  emailActivity: boolean;
  smsActivity: boolean;
  proposalActivity: boolean;
  photoActivity: boolean;
  noteActivity: boolean;
  quoteActivity: boolean;
  jobStatusChanges: boolean;
  leadActivity: boolean;
  paymentActivity: boolean;
  rescheduleRequests: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  browserNotifications: false,
  emailNotifications: true,
  smsNotifications: true,
  emailActivity: true,
  smsActivity: true,
  proposalActivity: true,
  photoActivity: true,
  noteActivity: true,
  quoteActivity: true,
  jobStatusChanges: true,
  leadActivity: true,
  paymentActivity: true,
  rescheduleRequests: true,
};

export function loadNotificationPrefs(): NotificationPrefs {
  const stored = localStorage.getItem("notificationPreferences");
  if (!stored) return { ...DEFAULT_NOTIFICATION_PREFS };
  try {
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

// Map each notification type to the preference key that governs its visibility.
// Unknown types are treated as always visible (fail-open).
export const TYPE_TO_PREF: Record<string, keyof NotificationPrefs> = {
  photo_added: "photoActivity",
  note_added: "noteActivity",

  email_reply: "emailActivity",
  email_received: "emailActivity",

  sms_reply: "smsActivity",

  proposal_sent: "proposalActivity",
  proposal_accepted: "proposalActivity",

  quote_sent: "quoteActivity",
  quote_accepted: "quoteActivity",

  job_status_change: "jobStatusChanges",
  job_status_changed: "jobStatusChanges",
  job_status_update: "jobStatusChanges",
  job_scheduled: "jobStatusChanges",
  job_completed: "jobStatusChanges",

  new_lead: "leadActivity",
  new_conversation: "leadActivity",
  reminder_stale_lead: "leadActivity",

  invoice_payment: "paymentActivity",
  reminder_uninvoiced: "paymentActivity",

  reschedule_request: "rescheduleRequests",
  schedule_proposal_ready: "rescheduleRequests",
  reminder_no_crew: "rescheduleRequests",
  reminder_stale_quote: "rescheduleRequests",
};

export function isNotificationVisible(
  type: string,
  prefs: NotificationPrefs,
): boolean {
  const prefKey = TYPE_TO_PREF[type];
  if (!prefKey) return true;
  return prefs[prefKey] !== false;
}
