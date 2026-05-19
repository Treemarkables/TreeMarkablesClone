import { gmailReplyService } from './gmailReplyService';
import { broadcast } from '../sseManager';

const POLLING_INTERVAL_MS = 60 * 1000; // 1 minute — matches SMS poller cadence. Gmail IMAP tolerates this fine.
let pollingIntervalId: NodeJS.Timeout | null = null;
let isPolling = false;

async function processEmailReplies() {
  if (isPolling) {
    console.log('📧 Email reply poll already in progress, skipping...');
    return;
  }

  isPolling = true;
  
  try {
    await gmailReplyService.checkForEmailReplies();
    broadcast(['/api/jobs', '/api/conversations', '/api/notifications/summary']);
  } catch (error) {
    console.error('📧 Error checking for email replies:', error);
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
