import { gmailReplyService } from './gmailReplyService';
import { broadcast } from '../sseManager';

const POLLING_INTERVAL_MS = 60 * 1000; // 1 minute — matches SMS poller cadence. Gmail IMAP tolerates this fine.
let pollingIntervalId: NodeJS.Timeout | null = null;
let isPolling = false;

// Poller health, surfaced by the 15-min health check (healthCheck.ts). A poller
// that stops succeeding — bad Gmail credentials, IMAP outage, a processing bug —
// means customer replies pile up invisibly in Gmail, so it must alert the owner
// rather than fail quietly.
let lastSuccessAt: Date | null = null;
let lastErrorAt: Date | null = null;
let lastErrorMessage = '';
let consecutiveFailures = 0;

export function getEmailPollerHealth() {
  return {
    running: !!pollingIntervalId,
    lastSuccessAt,
    lastErrorAt,
    lastErrorMessage,
    consecutiveFailures,
  };
}

async function processEmailReplies() {
  if (isPolling) {
    console.log('📧 Email reply poll already in progress, skipping...');
    return;
  }

  isPolling = true;

  try {
    await gmailReplyService.checkForEmailReplies();
    broadcast(['/api/jobs', '/api/conversations', '/api/notifications/summary']);
    lastSuccessAt = new Date();
    consecutiveFailures = 0;
  } catch (error) {
    console.error('📧 Error checking for email replies:', error);
    lastErrorAt = new Date();
    lastErrorMessage = (error as Error)?.message || String(error);
    consecutiveFailures++;
  } finally {
    isPolling = false;
  }
}

export function startEmailReplyPolling() {
  if (pollingIntervalId) {
    console.log('📧 Email reply polling already running');
    return;
  }

  console.log(`📧 Starting email reply polling (every ${Math.floor(POLLING_INTERVAL_MS / 1000 / 60)} minutes)...`);

  // Run immediately on startup
  processEmailReplies();

  // Then run on interval
  pollingIntervalId = setInterval(processEmailReplies, POLLING_INTERVAL_MS);

  console.log('📧 Email reply polling started');
}

export function stopEmailReplyPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    console.log('📧 Email reply polling stopped');
  }
}
