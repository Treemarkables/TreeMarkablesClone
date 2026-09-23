import { retrieveSMSReplies } from './smsEveryoneClient';
import { db } from '../db';
import { jobs, jobDiaryEntries, customers, notifications, conversations, conversationMessages } from '@shared/schema';
import { eq, and, or, sql, desc } from 'drizzle-orm';
import { fromZonedTime } from 'date-fns-tz';
import { broadcast } from '../sseManager';
import { runWithBusiness, withTenant } from '../tenancy/tenantStore';
import { resolveBusinessIdByChannel } from '../tenancy/channelMap';
import { onLaneJobEvent } from './laneAutomationService';

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

        // Multi-tenant routing: resolve which business this reply was sent TO — its
        // Recipient is the registered inbound number — via the channel map, then scope
        // the job match to that tenant so an overlapping customer number can't attach the
        // reply to another business. An unmapped recipient (e.g. the legacy single-tenant
        // line) falls back to the prior cross-tenant match + matched-job tenant.
        const recipientBusinessId = await resolveBusinessIdByChannel('phone', reply.Recipient);
        if (recipientBusinessId) {
          console.log(`📱 Reply recipient ${reply.Recipient} → business ${recipientBusinessId}`);
        }

        // Check jobContactPhone, billingContactPhone, billingContactMobile, AND customer phone/mobile
        const phoneMatch = or(
          sql`REGEXP_REPLACE(${jobs.jobContactPhone}, '[^0-9]', '', 'g') LIKE '%' || ${last8Digits} || '%'`,
          sql`REGEXP_REPLACE(${jobs.billingContactPhone}, '[^0-9]', '', 'g') LIKE '%' || ${last8Digits} || '%'`,
          sql`REGEXP_REPLACE(${jobs.billingContactMobile}, '[^0-9]', '', 'g') LIKE '%' || ${last8Digits} || '%'`,
          sql`REGEXP_REPLACE(${customers.phone}, '[^0-9]', '', 'g') LIKE '%' || ${last8Digits} || '%'`,
          sql`REGEXP_REPLACE(${customers.mobile}, '[^0-9]', '', 'g') LIKE '%' || ${last8Digits} || '%'`
        );
        const matchedJobs = await db
          .select()
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
          .where(recipientBusinessId ? and(eq(jobs.businessId, recipientBusinessId), phoneMatch) : phoneMatch)
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

        // The poller runs as a background job (no request/session → owner connection),
        // so bind the matched job's tenant for the writes below — withTenant() then stamps
        // each insert (diary entry, notification, conversation message) with that businessId
        // instead of the column DEFAULT (Treemarkables). NOTE: the admin-push fan-out and
        // the cross-tenant phone match remain tracked separately (need tenant-mapping infra).
        await runWithBusiness(recipientBusinessId ?? matchedJob.businessId ?? undefined, async () => {

        // Create diary entry for the SMS reply
        // SMS Everyone NZ timestamps are in NZ local time without timezone indicator.
        // Use fromZonedTime (date-fns-tz) so it automatically handles NZST (+12:00) vs
        // NZDT (+13:00) based on the actual date — no hardcoded offset needed.
        // Example: "2026-04-09 09:31:40" in "Pacific/Auckland" -> correct UTC
        const receivedTimestamp = fromZonedTime(
          reply.Received.replace(' ', 'T'),
          'Pacific/Auckland'
        );
        
        const messageBody = reply.MessageText || '';
        const [diaryEntry] = await db.insert(jobDiaryEntries).values(withTenant({
          jobId: matchedJob.id,
          entryType: 'sms',
          title: '📱 SMS Reply Received',
          description: messageBody,
          content: messageBody,
          authorName: customerName,
          authorRole: 'customer',
          tags: ['sms', 'reply', 'communication', 'customer-reply'],
          createdAt: receivedTimestamp,
          metadata: {
            phoneNumber: reply.Originator,
            direction: 'inbound',
          }
        })).returning();

        // Deep-link the bell and the push to this diary row. A bare
        // /dispatch?job= opens Despatch and the reply looks missing.
        const diaryEntryId = diaryEntry?.id;
        const diaryLink = diaryEntryId
          ? `/dispatch?job=${matchedJob.id}&tab=diary&entry=${diaryEntryId}`
          : `/dispatch?job=${matchedJob.id}&tab=diary`;

        // Create notification for SMS reply
        await db.insert(notifications).values(withTenant({
          title: `📱 SMS Reply from ${customerName}`,
          message: `${messageBody.substring(0, 100)}${messageBody.length > 100 ? '...' : ''}`,
          type: 'sms_reply',
          priority: 'medium',
          jobId: matchedJob.id,
          customerId: matchedJob.customerId,
          ...(diaryEntryId && { diaryEntryId }),
          actionUrl: diaryLink,
          createdAt: receivedTimestamp
        }));

        // Update job's lastActivityAt to bring it to top of dispatch board
        await db
          .update(jobs)
          .set({
            lastActivityAt: receivedTimestamp
          })
          .where(eq(jobs.id, matchedJob.id));

        // Lanes: a customer reply can auto-remove the job from a follow-up lane (or move it).
        onLaneJobEvent(matchedJob.id, 'customer_replied').catch(err => console.error('[Lanes] sms-reply trigger error:', err));

        // Extract email address from SMS body if present and update job/customer
        const emailMatch = messageBody.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b/);
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
        const nameMatch = messageBody.match(/(?:full\s*name\s*(?:is|:)\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
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

        try {
          const { pushToAdminsWithCustomerMessages } = await import('./notificationHelper.js');
          const smsPreview = messageBody.substring(0, 120) + (messageBody.length > 120 ? '…' : '');
          const pushCount = await pushToAdminsWithCustomerMessages({
            title: `SMS Reply — ${customerName}`,
            body: smsPreview,
            clickAction: diaryLink,
            data: {
              type: 'sms_reply',
              jobId: matchedJob.id,
              customerId: matchedJob.customerId || '',
              jobNumber: String(matchedJob.jobNumber),
              tab: 'diary',
              ...(diaryEntryId && { entry: diaryEntryId }),
            },
          });
          console.log(`📲 Pushed SMS-reply notification to ${pushCount} admin(s) for job #${matchedJob.jobNumber}`);
        } catch (pushErr) {
          console.error('📱 Error sending SMS-reply push notification:', pushErr);
        }

        // File the reply on Conversations as well as the job diary. The old
        // lookup read conversations.participant_contact, which is not a column,
        // so the insert never ran unless that query happened to succeed.
        try {
          const businessId = recipientBusinessId ?? matchedJob.businessId;
          const phoneTail = senderPhone.slice(-8);
          const phoneLike = `%${phoneTail}%`;
          const [existing] = phoneTail && businessId
            ? await db
                .select({ id: conversations.id, unreadCount: conversations.unreadCount })
                .from(conversations)
                .leftJoin(customers, eq(conversations.customerId, customers.id))
                .where(
                  and(
                    eq(conversations.businessId, businessId),
                    or(
                      sql`EXISTS (
                        SELECT 1 FROM conversation_messages m
                        WHERE m.conversation_id = ${conversations.id}
                          AND REGEXP_REPLACE(COALESCE(m.from_contact, ''), '[^0-9]', '', 'g') LIKE ${phoneLike}
                      )`,
                      sql`REGEXP_REPLACE(COALESCE(${customers.phone}, ''), '[^0-9]', '', 'g') LIKE ${phoneLike}`,
                      sql`REGEXP_REPLACE(COALESCE(${customers.mobile}, ''), '[^0-9]', '', 'g') LIKE ${phoneLike}`,
                    ),
                  ),
                )
                .orderBy(desc(conversations.lastMessageAt))
                .limit(1)
            : [];

          let conversationId = existing?.id;
          const nextUnread = (existing?.unreadCount ?? 0) + 1;
          if (!conversationId) {
            const [created] = await db.insert(conversations).values(withTenant({
              title: `SMS from ${customerName}`,
              status: 'open',
              priority: 'medium',
              source: 'sms',
              customerId: matchedJob.customerId,
              tags: ['sms', 'customer-reply'],
              lastMessageAt: receivedTimestamp,
              lastMessageBy: 'customer',
              unreadCount: nextUnread,
            })).returning({ id: conversations.id });
            conversationId = created?.id;
          }

          if (conversationId) {
            await db.insert(conversationMessages).values(withTenant({
              conversationId,
              type: 'message',
              content: messageBody,
              direction: 'inbound',
              fromName: customerName,
              fromContact: reply.Originator,
              platform: 'sms',
              isRead: false,
              createdAt: receivedTimestamp,
            }));

            await db
              .update(conversations)
              .set({
                status: 'open',
                lastMessageAt: receivedTimestamp,
                lastMessageBy: 'customer',
                updatedAt: receivedTimestamp,
                unreadCount: nextUnread,
              })
              .where(eq(conversations.id, conversationId));

            console.log(`📱 ✅ Added SMS reply to conversation ${conversationId}`);
          }
        } catch (convError) {
          console.error('📱 Error adding SMS reply to conversation:', convError);
        }
        }); // runWithBusiness(matchedJob.businessId)
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
