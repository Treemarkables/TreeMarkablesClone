import { retrieveSMSReplies } from './smsEveryoneClient';
import { db } from '../db';
import { jobs, jobDiaryEntries, customers } from '@shared/schema';
import { eq, or, sql } from 'drizzle-orm';

const POLLING_INTERVAL_MS = 60 * 1000; // 1 minute (60 seconds)
let pollingIntervalId: NodeJS.Timeout | null = null;
let isPolling = false;

function normalizePhoneForMatching(phone: string): string {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // SMS Everyone returns numbers like 6421123456 (NZ format without +)
  // We want to match against various formats in our DB
  if (cleaned.startsWith('64')) {
    return cleaned;
  }
  
  // If it starts with 0, convert to NZ international format
  if (cleaned.startsWith('0')) {
    return `64${cleaned.substring(1)}`;
  }
  
  // If it's 9-10 digits, assume NZ and add 64
  if (cleaned.length === 9 || cleaned.length === 10) {
    return `64${cleaned}`;
  }
  
  return cleaned;
}

async function processSMSReplies() {
  if (isPolling) {
    console.log('📱 SMS reply poll already in progress, skipping...');
    return;
  }

  isPolling = true;
  
  try {
    const replies = await retrieveSMSReplies();
    
    if (!replies || replies.length === 0) {
      console.log('📱 No new SMS replies');
      return;
    }

    console.log(`📱 Processing ${replies.length} SMS ${replies.length === 1 ? 'reply' : 'replies'}`);
    
    for (const reply of replies) {
      try {
        const senderPhone = normalizePhoneForMatching(reply.Originator);
        console.log(`📱 Processing SMS reply from ${reply.Originator} (normalized: ${senderPhone})`);

        // Find jobs where this phone number matches
        // Check jobContactPhone, billingContactPhone, or billingContactMobile
        const matchedJobs = await db
          .select()
          .from(jobs)
          .where(
            or(
              sql`REGEXP_REPLACE(${jobs.jobContactPhone}, '[^0-9]', '', 'g') LIKE '%' || ${senderPhone.slice(-9)} || '%'`,
              sql`REGEXP_REPLACE(${jobs.billingContactPhone}, '[^0-9]', '', 'g') LIKE '%' || ${senderPhone.slice(-9)} || '%'`,
              sql`REGEXP_REPLACE(${jobs.billingContactMobile}, '[^0-9]', '', 'g') LIKE '%' || ${senderPhone.slice(-9)} || '%'`
            )
          )
          .limit(10);

        if (matchedJobs.length === 0) {
          console.log(`📱 No matching job found for phone ${reply.Originator} - skipping reply`);
          continue;
        }

        // If multiple jobs match, use the most recent one (by lastActivityAt or createdAt)
        const matchedJob = matchedJobs.reduce((latest, current) => {
          const latestTime = latest.lastActivityAt || latest.createdAt || new Date(0);
          const currentTime = current.lastActivityAt || current.createdAt || new Date(0);
          return currentTime > latestTime ? current : latest;
        });

        console.log(`📱 Matched reply to job #${matchedJob.jobNumber} (${matchedJob.id})`);

        // Get customer name for diary entry
        let customerName = 'Customer';
        if (matchedJob.customerId) {
          const customer = await db
            .select()
            .from(customers)
            .where(eq(customers.id, matchedJob.customerId))
            .limit(1);
          
          if (customer.length > 0) {
            customerName = customer[0].name;
          }
        }

        // Create diary entry for the SMS reply
        await db.insert(jobDiaryEntries).values({
          jobId: matchedJob.id,
          entryType: 'sms',
          title: '📱 SMS Reply Received',
          description: `SMS reply from ${customerName} (${reply.Originator}):\n\n${reply.MessageText}`,
          authorName: customerName,
          authorRole: 'customer',
          tags: ['sms', 'reply', 'communication'],
          createdAt: new Date(reply.Received)
        });

        // Update job's lastActivityAt to bring it to top of dispatch board
        await db
          .update(jobs)
          .set({ 
            lastActivityAt: new Date(reply.Received)
          })
          .where(eq(jobs.id, matchedJob.id));

        console.log(`📱 ✅ Stored SMS reply as diary entry in job #${matchedJob.jobNumber}`);
      } catch (error) {
        console.error(`📱 Error processing SMS reply from ${reply.Originator}:`, error);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Only log 403 errors once to avoid spam
    if (errorMessage.includes('403')) {
      if (!(processSMSReplies as any).logged403) {
        console.warn('⚠️  SMS Replies API returned 403 - This feature may not be enabled on your SMS Everyone account');
        console.warn('⚠️  Contact SMS Everyone support to enable 2-way SMS / Replies API feature');
        console.warn('⚠️  Outbound SMS sending will continue to work normally');
        (processSMSReplies as any).logged403 = true;
      }
    } else {
      console.error('📱 Error polling SMS replies:', errorMessage);
    }
  } finally {
    isPolling = false;
  }
}

export function startSMSReplyPolling() {
  if (pollingIntervalId) {
    console.log('📱 SMS reply polling already started');
    return;
  }

  console.log(`📱 Starting SMS reply polling (every ${POLLING_INTERVAL_MS / 1000} seconds)`);
  
  // Poll immediately on start
  processSMSReplies();
  
  // Then poll every minute
  pollingIntervalId = setInterval(() => {
    processSMSReplies();
  }, POLLING_INTERVAL_MS);
}

export function stopSMSReplyPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    console.log('📱 SMS reply polling stopped');
  }
}
