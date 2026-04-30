import { retrieveSMSReplies } from './smsEveryoneClient';
import { db } from '../db';
import { jobs, jobDiaryEntries, customers, notifications, conversations, conversationMessages } from '@shared/schema';
import { eq, or, sql, desc } from 'drizzle-orm';
import { fromZonedTime } from 'date-fns-tz';
import { broadcast } from '../sseManager';

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
      return;
    }

    console.log(`📱 Processing ${replies.length} SMS ${replies.length === 1 ? 'reply' : 'replies'}`);
    
    for (const reply of replies) {
      try {
        const senderPhone = normalizePhoneForMatching(reply.Originator);
        console.log(`📱 Processing SMS reply from ${reply.Originator} (normalized: ${senderPhone})`);

        // Find jobs where this phone number matches
        // Use last 8 digits to avoid country code mismatches (021959262 vs 6421959262)
        // Both formats share the same last 8 digits: 21959262
        const last8Digits = senderPhone.slice(-8);
        console.log(`📱 Matching with last 8 digits: ${last8Digits}`);
        
        // Check jobContactPhone, billingContactPhone, billingContactMobile, AND customer phone/mobile
        const matchedJobs = await db
          .select()
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
          .where(
            or(
              sql`REGEXP_REPLACE(${jobs.jobContactPhone}, '[^0-9]', '', 'g') LIKE '%' || ${last8Digits} || '%'`,
              sql`REGEXP_REPLACE(${jobs.billingContactPhone}, '[^0-9]', '', 'g') LIKE '%' || ${last8Digits} || '%'`,
              sql`REGEXP_REPLACE(${jobs.billingContactMobile}, '[^0-9]', '', 'g') LIKE '%' || ${last8Digits} || '%'`,
              sql`REGEXP_REPLACE(${customers.phone}, '[^0-9]', '', 'g') LIKE '%' || ${last8Digits} || '%'`,
              sql`REGEXP_REPLACE(${customers.mobile}, '[^0-9]', '', 'g') LIKE '%' || ${last8Digits} || '%'`
            )
          )
          .limit(10);

        if (matchedJobs.length === 0) {
          console.log(`📱 No matching job found for phone ${reply.Originator} - skipping reply`);
          continue;
        }

        // Extract job from join result and find most recent
        const jobResults = matchedJobs.map(row => ({
          job: row.jobs,
          customer: row.customers
        }));
        
        // If multiple jobs match, use the most recent one (by lastActivityAt or createdAt)
        const bestMatch = jobResults.reduce((latest, current) => {
          const latestTime = latest.job.lastActivityAt || latest.job.createdAt || new Date(0);
          const currentTime = current.job.lastActivityAt || current.job.createdAt || new Date(0);
          return currentTime > latestTime ? current : latest;
        });
        
        const matchedJob = bestMatch.job;
        const matchedCustomer = bestMatch.customer;

        console.log(`📱 Matched reply to job #${matchedJob.jobNumber} (${matchedJob.id})`);

        // Get customer name for diary entry
        let customerName = matchedCustomer?.name || 'Customer';

        // Create diary entry for the SMS reply
        // SMS Everyone NZ timestamps are in NZ local time without timezone indicator.
        // Use fromZonedTime (date-fns-tz) so it automatically handles NZST (+12:00) vs
        // NZDT (+13:00) based on the actual date — no hardcoded offset needed.
        // Example: "2026-04-09 09:31:40" in "Pacific/Auckland" -> correct UTC
        const receivedTimestamp = fromZonedTime(
          reply.Received.replace(' ', 'T'),
          'Pacific/Auckland'
        );
        
        await db.insert(jobDiaryEntries).values({
          jobId: matchedJob.id,
          entryType: 'sms',
          title: '📱 SMS Reply Received',
          description: `SMS reply from ${customerName} (${reply.Originator}):\n\n${reply.MessageText}`,
          authorName: customerName,
          authorRole: 'customer',
          tags: ['sms', 'reply', 'communication', 'customer-reply'],
          createdAt: receivedTimestamp,
          metadata: { phoneNumber: reply.Originator }
        });

        // Create notification for SMS reply
        await db.insert(notifications).values({
          title: `📱 SMS Reply from ${customerName}`,
          message: `${reply.MessageText.substring(0, 100)}${reply.MessageText.length > 100 ? '...' : ''}`,
          type: 'sms_reply',
          priority: 'medium',
          jobId: matchedJob.id,
          customerId: matchedJob.customerId,
          actionUrl: `/dispatch?job=${matchedJob.id}`,
          createdAt: receivedTimestamp
        });

        // Update job's lastActivityAt to bring it to top of dispatch board
        await db
          .update(jobs)
          .set({ 
            lastActivityAt: receivedTimestamp
          })
          .where(eq(jobs.id, matchedJob.id));

        // Extract email address from SMS body if present and update job/customer
        const emailMatch = reply.MessageText.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) {
          const extractedEmail = emailMatch[0].toLowerCase();
          console.log(`📧 Extracted email from SMS reply: ${extractedEmail}`);
          if (!matchedJob.jobContactEmail) {
            await db.update(jobs).set({ jobContactEmail: extractedEmail }).where(eq(jobs.id, matchedJob.id));
            console.log(`📧 Updated job #${matchedJob.jobNumber} contact email to ${extractedEmail}`);
          }
          if (matchedCustomer && !matchedCustomer.email) {
            await db.update(customers).set({ email: extractedEmail }).where(eq(customers.id, matchedCustomer.id));
            console.log(`📧 Updated customer ${customerName} email to ${extractedEmail}`);
          }
        }

        // Extract full name from SMS body (e.g. "Kasia Green" on its own line, or "Full name is ...")
        const nameMatch = reply.MessageText.match(/(?:full\s*name\s*(?:is|:)\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
        if (nameMatch) {
          const fullName = nameMatch[1].trim();
          const nameParts = fullName.split(/\s+/);
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ');
          if (!matchedJob.jobContactFirstName && firstName) {
            await db.update(jobs).set({ jobContactFirstName: firstName }).where(eq(jobs.id, matchedJob.id));
          }
          if (!matchedJob.jobContactLastName && lastName) {
            await db.update(jobs).set({ jobContactLastName: lastName }).where(eq(jobs.id, matchedJob.id));
          }
          console.log(`👤 Extracted name from SMS: ${firstName} ${lastName}`);
        }

        console.log(`📱 ✅ Stored SMS reply as diary entry and notification in job #${matchedJob.jobNumber}`);
        broadcast(['/api/jobs', '/api/conversations', '/api/notifications/summary']);

        // Also add SMS reply to conversations if there's an active conversation with this phone
        try {
          // Find conversation by phone number (check participantContact field)
          const phoneToMatch = senderPhone.slice(-9); // Last 9 digits for matching
          const matchingConversations = await db
            .select()
            .from(conversations)
            .where(
              sql`REGEXP_REPLACE(${conversations.participantContact}, '[^0-9]', '', 'g') LIKE '%' || ${phoneToMatch} || '%'`
            )
            .orderBy(desc(conversations.lastMessageAt))
            .limit(1);

          if (matchingConversations.length > 0) {
            const conversation = matchingConversations[0];
            
            // Add the SMS reply as a conversation message
            await db.insert(conversationMessages).values({
              conversationId: conversation.id,
              type: 'message',
              content: reply.MessageText,
              direction: 'inbound',
              fromName: customerName,
              fromContact: reply.Originator,
              platform: 'sms',
              isRead: false,
              createdAt: receivedTimestamp
            });

            // Update conversation's lastMessageAt
            await db
              .update(conversations)
              .set({
                lastMessageAt: receivedTimestamp,
                lastMessageBy: 'customer',
                updatedAt: receivedTimestamp
              })
              .where(eq(conversations.id, conversation.id));

            console.log(`📱 ✅ Also added SMS reply to conversation ${conversation.id}`);
          }
        } catch (convError) {
          console.error('📱 Error adding SMS reply to conversation:', convError);
        }
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
