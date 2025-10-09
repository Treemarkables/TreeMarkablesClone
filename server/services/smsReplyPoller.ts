import { retrieveSMSReplies } from './smsEveryoneClient';
import { db } from '../db';
import { conversations, conversationMessages } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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
        const senderPhone = normalizePhoneForMatching(reply.originator);
        console.log(`📱 Processing SMS from ${reply.originator} (normalized: ${senderPhone})`);

        // Try to find existing conversation by matching phone number
        // Look in both lead and customer conversations
        let existingConversation = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.source, 'sms'),
              eq(conversations.isActive, true)
            )
          )
          .limit(100); // Get recent SMS conversations

        // Find conversation where the phone matches
        const matchedConversation = existingConversation.find(conv => {
          // Check if title contains the phone number
          const titlePhone = normalizePhoneForMatching(conv.title);
          return titlePhone.includes(senderPhone) || senderPhone.includes(titlePhone);
        });

        let conversationId: string;

        if (matchedConversation) {
          conversationId = matchedConversation.id;
          console.log(`📱 Found existing conversation: ${conversationId}`);
          
          // Update conversation with latest message info
          await db
            .update(conversations)
            .set({
              lastMessageAt: new Date(reply.received),
              lastMessageBy: 'customer',
              unreadCount: matchedConversation.unreadCount + 1,
              updatedAt: new Date()
            })
            .where(eq(conversations.id, conversationId));
        } else {
          // Create new conversation for this SMS reply
          const newConversation = await db
            .insert(conversations)
            .values({
              title: `SMS from ${reply.originator}`,
              source: 'sms',
              status: 'open',
              lastMessageAt: new Date(reply.received),
              lastMessageBy: 'customer',
              unreadCount: 1,
            })
            .returning();
          
          conversationId = newConversation[0].id;
          console.log(`📱 Created new conversation: ${conversationId}`);
        }

        // Add the reply message to the conversation
        await db
          .insert(conversationMessages)
          .values({
            conversationId,
            type: 'sms',
            content: reply.message_text,
            direction: 'inbound',
            fromContact: reply.originator,
            fromName: reply.originator,
            toContact: reply.recipient,
            platform: 'sms',
            externalId: reply.reference,
            deliveryStatus: 'delivered',
            isRead: false,
          });

        console.log(`📱 ✅ Stored SMS reply in conversation ${conversationId}`);
      } catch (error) {
        console.error(`📱 Error processing SMS reply from ${reply.originator}:`, error);
      }
    }
  } catch (error) {
    console.error('📱 Error polling SMS replies:', error instanceof Error ? error.message : error);
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
