import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { db } from '../db';
import { jobs, jobDiaryEntries, customers, conversationMessages } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { PhotoStorageService } from '../photoStorage';

interface ParsedEmailAttachment {
  filename?: string;
  contentType: string;
  content: Buffer;
  size?: number;
}

interface ParsedEmailReply {
  from: string;
  to?: string; // TO address - used to extract job number from job-XXXX@jobs.treemarkables.co.nz
  subject: string;
  date: Date;
  textBody: string;
  htmlBody?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  uid?: number; // IMAP UID for marking as seen after successful processing
  attachments?: ParsedEmailAttachment[];
}

class GmailReplyService {
  private imapConfig: any;
  private isEnabled: boolean = false;

  constructor() {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      console.log('📧 Gmail reply capture disabled - credentials not configured');
      this.isEnabled = false;
      return;
    }

    this.imapConfig = {
      user: gmailUser,
      password: gmailPassword,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10000,
      authTimeout: 5000
    };

    this.isEnabled = true;
    console.log('📧 Gmail reply capture service initialized');
  }

  /**
   * Check for new email replies and add them to job diaries
   */
  async checkForEmailReplies(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    return new Promise((resolve, reject) => {
      const imap = new Imap(this.imapConfig);
      let settled = false;
      const settle = (fn: () => void) => {
        if (!settled) { settled = true; fn(); }
      };

      // Use .on (not .once) so that every error event is caught — IMAP can emit
      // multiple error events during its lifecycle (connect phase, fetch phase,
      // teardown). A second uncaught error event would become an uncaughtException.
      imap.on('error', (err: Error) => {
        console.error('📧 IMAP connection error:', err);
        try { imap.destroy(); } catch (_) {}
        settle(() => reject(err));
      });

      imap.once('ready', () => {
        // Use '[Gmail]/All Mail' so we catch emails delivered to any label or routing
        // rule (e.g. job-XXXX@jobs.treemarkables.co.nz) that bypasses the primary Inbox.
        // Read-write mode (false) so we can mark emails as Seen after processing.
        imap.openBox('[Gmail]/All Mail', false, async (err, box) => {
          if (err) {
            console.error('📧 Error opening Gmail All Mail folder:', err);
            imap.end();
            settle(() => reject(err));
            return;
          }

          // Search for all emails from the last 2 days (not just unread).
          // Previously used UNSEEN-only, which skipped replies the user had already
          // opened in Gmail. The messageId duplicate-check in processEmailReply
          // prevents re-logging entries that are already in the diary.
          const searchDate = new Date();
          searchDate.setDate(searchDate.getDate() - 2);

          imap.search([['SINCE', searchDate]], async (err, results) => {
            if (err) {
              console.error('📧 Gmail search error:', err);
              imap.end();
              settle(() => reject(err));
              return;
            }

            if (!results || results.length === 0) {
              console.log('📧 No new email replies found');
              imap.end();
              settle(() => resolve());
              return;
            }

            console.log(`📧 Found ${results.length} email(s) in All Mail (last 2 days) to process`);

            const fetch = imap.fetch(results, { bodies: '', markSeen: false });
            const emailsToProcess: ParsedEmailReply[] = [];
            const parsePromises: Promise<void>[] = [];

            fetch.on('message', (msg, seqno) => {
              let emailUid: number | undefined;

              msg.once('attributes', (attrs) => {
                // Store UID but DON'T mark as seen yet - wait until after successful DB insert
                emailUid = attrs.uid;
              });

              msg.on('body', (stream) => {
                // Create a promise for each email parse operation
                const parsePromise = new Promise<void>((resolveEmail) => {
                  simpleParser(stream, async (err, parsed) => {
                    if (err) {
                      console.error('📧 Error parsing email:', err);
                      resolveEmail();
                      return;
                    }

                    // Extract sender email
                    const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase();
                    const toEmail = parsed.to?.value?.[0]?.address?.toLowerCase();
                    console.log(`📧 Processing email from: ${fromEmail}, to: ${toEmail}, subject: ${parsed.subject}`);
                    
                    if (!fromEmail) {
                      console.log(`📧 Skipping - no FROM address`);
                      resolveEmail();
                      return;
                    }

                    // Skip emails from our own domain (these are outgoing emails)
                    if (fromEmail.includes('treemarkables.co.nz') || fromEmail.includes('treemarkables.nz')) {
                      console.log(`📧 Skipping outgoing email from: ${fromEmail}`);
                      resolveEmail();
                      return;
                    }

                    // mailparser delivers attachments as { filename, contentType, content (Buffer), size, ... }.
                    // Keep image attachments so the diary entry can render them; non-image
                    // parts (PDFs, signatures, etc.) are ignored here on purpose.
                    const imageAttachments: ParsedEmailAttachment[] = (parsed.attachments || [])
                      .filter((a: any) => typeof a?.contentType === 'string' && a.contentType.toLowerCase().startsWith('image/') && Buffer.isBuffer(a.content))
                      .map((a: any) => ({
                        filename: a.filename,
                        contentType: a.contentType,
                        content: a.content,
                        size: a.size,
                      }));

                    const emailData: ParsedEmailReply = {
                      from: fromEmail,
                      to: toEmail,
                      subject: parsed.subject || '(no subject)',
                      date: parsed.date || new Date(),
                      textBody: parsed.text || '',
                      htmlBody: parsed.html || undefined,
                      messageId: parsed.messageId,
                      inReplyTo: parsed.inReplyTo,
                      references: parsed.references,
                      uid: emailUid, // Store UID for later marking as seen
                      attachments: imageAttachments.length > 0 ? imageAttachments : undefined,
                    };

                    emailsToProcess.push(emailData);
                    resolveEmail();
                  });
                });
                
                parsePromises.push(parsePromise);
              });
            });

            fetch.once('error', (err) => {
              console.error('📧 Fetch error:', err);
              settle(() => reject(err));
            });

            fetch.once('end', async () => {
              try {
                // Wait for all emails to finish parsing
                await Promise.all(parsePromises);
                
                console.log(`📧 Finished parsing ${emailsToProcess.length} email(s), processing now...`);
                
                // Process all collected emails and track successfully processed UIDs
                const successfulUids: number[] = [];
                
                for (const email of emailsToProcess) {
                  const success = await this.processEmailReply(email);
                  if (success && email.uid) {
                    successfulUids.push(email.uid);
                  }
                }

                // ONLY mark as seen after successful processing
                if (successfulUids.length > 0) {
                  for (const uid of successfulUids) {
                    imap.addFlags(uid, ['\\Seen'], (err) => {
                      if (err) {
                        console.error(`📧 Error marking email UID ${uid} as read:`, err);
                      }
                    });
                  }
                  console.log(`📧 Marked ${successfulUids.length} email(s) as read after successful processing`);
                }

                console.log(`📧 Successfully processed ${successfulUids.length} of ${emailsToProcess.length} email reply(ies)`);
                imap.end();
                settle(() => resolve());
              } catch (err) {
                console.error('📧 Error processing fetched emails:', err);
                try { imap.end(); } catch (_) {}
                settle(() => reject(err));
              }
            });
          });
        });
      });

      imap.once('end', () => {
        console.log('📧 Gmail IMAP connection ended');
      });

      imap.connect();
    });
  }

  /**
   * Check if email recipient is an allowed address for conversation processing
   * Only process emails sent to quotes@ or job- aliases
   */
  private isAllowedRecipient(toAddress: string | undefined): boolean {
    if (!toAddress) return false;
    
    const lowerTo = toAddress.toLowerCase();
    
    // Allow emails sent to quotes@
    if (lowerTo.includes('quotes@treemarkables')) return true;
    
    // Allow emails sent to job-XXXX aliases (both job number format and UUID format)
    if (lowerTo.match(/job-[\w-]+@/i)) return true;
    
    return false;
  }

  /**
   * Process a single email reply and match it to a job
   * Returns true if successfully processed, false otherwise
   */
  private async processEmailReply(email: ParsedEmailReply): Promise<boolean> {
    try {
      // FILTER: Only process emails sent to allowed recipients (quotes@ or job- aliases)
      if (!this.isAllowedRecipient(email.to)) {
        console.log(`📧 Skipping - not sent to quotes@ or job alias: ${email.to}`);
        return false;
      }

      // STEP 1: Try to extract job identifier from TO address (job-XXXX@jobs.treemarkables.co.nz)
      // Supports both job number format (job-3682@) and UUID format (job-8004ff8a-1618-4d18-...@)
      let job = null;
      let customer = null;
      
      if (email.to) {
        const jobAliasMatch = email.to.match(/job-([\w-]+)@/i);
        if (jobAliasMatch) {
          const jobIdentifier = jobAliasMatch[1];
          console.log(`📧 ✅ Extracted job identifier "${jobIdentifier}" from TO address: ${email.to}`);
          
          // Check if it's a numeric job number or a UUID
          const isJobNumber = /^\d+$/.test(jobIdentifier);
          
          if (isJobNumber) {
            // Find job by job number
            job = await db.query.jobs.findFirst({
              where: eq(jobs.jobNumber, jobIdentifier)
            });
          } else {
            // Find job by UUID (database ID)
            job = await db.query.jobs.findFirst({
              where: eq(jobs.id, jobIdentifier)
            });
          }
          
          if (job) {
            console.log(`📧 ✅ Found job #${job.jobNumber} (matched by ${isJobNumber ? 'job number' : 'UUID'})`);
          }
          
          if (job) {
            // Get customer separately
            customer = await db.query.customers.findFirst({
              where: eq(customers.id, job.customerId)
            });
            
            if (customer) {
              console.log(`📧 ✅ Found job #${job.jobNumber} for customer: ${customer.name}`);
            } else {
              console.log(`📧 ⚠️ Found job #${jobNumber} but customer not found`);
              job = null; // Reset job if customer not found
            }
          } else {
            console.log(`📧 ⚠️ No job found with number ${jobNumber}`);
          }
        }
      }
      
      // STEP 2: If no job found by TO address, fall back to finding customer by FROM email
      if (!job) {
        console.log(`📧 Looking up customer with email: ${email.from}`);
        
        // Find customer by email address
        customer = await db.query.customers.findFirst({
          where: eq(customers.email, email.from)
        });

        if (customer) {
          console.log(`📧 ✅ Found customer: ${customer.name} (ID: ${customer.id})`);

          // Find the most recent job for this customer
          const customerJobs = await db.query.jobs.findMany({
            where: eq(jobs.customerId, customer.id),
            orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
            limit: 1
          });

          if (customerJobs && customerJobs.length > 0) {
            job = customerJobs[0];
          }
        }
      }
      
      // STEP 3: If no customer/job found, still try to add to existing conversation
      // This handles replies from leads who haven't been converted to customers yet
      if (!customer && !job) {
        console.log(`📧 No customer found for email: ${email.from} - checking for existing conversation`);
        
        try {
          const notificationHelper = await import('./notificationHelper.js');
          const { storage } = await import('../storage.js');

          // DEDUP GUARD: If this exact messageId already exists in any conversation message, skip entirely.
          // This is the primary fix for the "keeps reappearing" bug — the same Gmail email was being
          // inserted into conversation_messages on every poll cycle.
          if (email.messageId) {
            const existingMsg = await db
              .select({ id: conversationMessages.id })
              .from(conversationMessages)
              .where(sql`${conversationMessages.metadata}->>'messageId' = ${email.messageId}`)
              .limit(1);
            if (existingMsg.length > 0) {
              console.log(`📧 Conversation message already exists for messageId: ${email.messageId} - skipping`);
              return true;
            }
          }

          // Check for existing open conversation from this email
          let conversation = await notificationHelper.findExistingOpenConversation(email.from.trim().toLowerCase());
          
          // Clean up email body text (remove quoted replies)
          const cleanedBody = this.cleanEmailBody(email.textBody);
          
          // Extract sender name from email if available
          const senderName = email.from.split('@')[0].replace(/[._]/g, ' ');
          
          if (conversation) {
            console.log(`📧 ✅ Found existing conversation for ${email.from}: ${conversation.id}`);
            await notificationHelper.notifyConversationReply(
              { id: conversation.id, title: conversation.title, source: 'email', customerName: senderName },
              cleanedBody
            );
          } else {
            // No open conversation — check if ANY conversation (even closed/converted) already has a
            // message from this sender. If so, reopen that one rather than creating a duplicate.
            // This prevents ghost conversations coming back every poll after the user dismisses them.
            const allConvs = await storage.getAllConversations({});
            let priorConv: any = null;
            for (const c of allConvs) {
              const msgs = await storage.getConversationMessages(c.id);
              if (msgs.some((m: any) => m.fromContact?.toLowerCase() === email.from.trim().toLowerCase())) {
                priorConv = c;
                break;
              }
            }

            if (priorConv) {
              // Reopen the prior conversation instead of creating a new one
              console.log(`📧 Reopening prior conversation for ${email.from}: ${priorConv.id}`);
              await storage.updateConversation(priorConv.id, { status: 'open' });
              conversation = { ...priorConv, status: 'open' };
              await notificationHelper.notifyConversationReply(
                { id: conversation.id, title: conversation.title, source: 'email', customerName: senderName },
                cleanedBody
              );
            } else {
              // Truly new lead — create a fresh conversation
              console.log(`📧 Creating new conversation for lead: ${email.from}`);
              const conversationTitle = cleanedBody.length > 0 
                ? cleanedBody.substring(0, 100) + (cleanedBody.length > 100 ? '...' : '')
                : `Re: ${email.subject}`;
              
              conversation = await storage.createConversation({
                title: conversationTitle,
                status: 'open',
                priority: 'medium',
                source: 'email',
                tags: ['email-reply', 'lead']
              });
              
              // Create notification bell entry for new conversation
              await notificationHelper.createConversationNotification(conversation);
              console.log(`📧 ✅ Created new conversation for email from lead: ${conversation.id}`);
            }
          }
          
          // Create conversation message
          await storage.createConversationMessage({
            conversationId: conversation.id,
            type: 'message',
            content: cleanedBody,
            direction: 'inbound',
            fromName: senderName,
            fromContact: email.from.trim().toLowerCase(),
            platform: 'email',
            subject: email.subject,
            metadata: {
              subject: email.subject,
              messageId: email.messageId,
              inReplyTo: email.inReplyTo
            }
          });
          
          // Update conversation's lastMessageAt
          await storage.updateConversation(conversation.id, {
            lastMessageAt: email.date,
            lastMessageBy: 'customer'
          });
          
          console.log(`📧 ✅ Added email reply to conversation: ${conversation.id}`);
          return true;
        } catch (convError) {
          console.error('📧 Error creating conversation from lead email:', convError);
          return false;
        }
      }

      // Clean up email body text (remove quoted replies)
      const cleanedBody = this.cleanEmailBody(email.textBody);

      // Only create job diary entry if we have both job and customer
      if (job && customer) {
        // Check for duplicate email FIRST - across ALL diary entries, not just this job
        if (email.messageId) {
          const duplicateCheck = await db
            .select()
            .from(jobDiaryEntries)
            .where(
              sql`${jobDiaryEntries.metadata}->>'messageId' = ${email.messageId}`
            )
            .limit(1);

          if (duplicateCheck.length > 0) {
            console.log(`📧 Email already logged (messageId: ${email.messageId}) - skipping`);
            return true; // Return true because it was already successfully logged
          }
        }

        // Upload image attachments so they render on the diary entry. One failed
        // upload shouldn't block the email body from being recorded — log and move on.
        const photoUrls: string[] = [];
        if (email.attachments && email.attachments.length > 0) {
          const photoStorage = new PhotoStorageService();
          for (const att of email.attachments) {
            try {
              const { url } = await photoStorage.uploadPhoto(
                att.content,
                att.filename || `email-attachment-${Date.now()}`,
                att.contentType,
              );
              photoUrls.push(url);
            } catch (uploadErr) {
              console.error(`📧 Failed to upload email image attachment "${att.filename}":`, uploadErr);
            }
          }
          if (photoUrls.length > 0) {
            console.log(`📧 ✅ Uploaded ${photoUrls.length} image attachment(s) from email reply`);
          }
        }

        // Create job diary entry for the email reply.
        // Capture the inserted id so the notification can deep-link straight to
        // this entry in the diary (scroll + highlight), not just the diary tab.
        const [insertedDiaryEntry] = await db.insert(jobDiaryEntries).values({
          jobId: job.id,
          entryType: 'email',
          title: `Email reply: ${email.subject}`,
          description: cleanedBody,
          content: email.htmlBody || email.textBody,
          authorName: customer.name,
          authorRole: 'customer',
          tags: ['communication', 'email', 'customer-reply'],
          ...(photoUrls.length > 0 && {
            photoUrl: photoUrls[0],
            photos: photoUrls,
          }),
          metadata: {
            emailAddress: email.from,
            messageId: email.messageId,
            inReplyTo: email.inReplyTo,
            receivedAt: email.date.toISOString(),
            direction: 'incoming',
            subject: email.subject,
            rawBody: email.textBody, // Store raw body for debugging
            ...(photoUrls.length > 0 && { attachmentCount: photoUrls.length }),
          }
        }).returning({ id: jobDiaryEntries.id });
        const diaryEntryId = insertedDiaryEntry?.id;

        console.log(`📧 ✅ Added email reply to job diary - Job #${job.jobNumber}, Customer: ${customer.name}`);
        
        // Create notification for email reply so it appears in notification bell
        // De-dup: skip if an email_reply notification for this job was already created in the last 24h
        // (includes archived records so the guard survives a "Clear all")
        try {
          const { storage } = await import('../storage.js');
          const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentNotifs = await storage.getNotificationsCreatedSince(since24h);
          const jobAlreadyNotified = recentNotifs.some(
            (n) => n.type === 'email_reply' && n.jobId === job.id
          );
          if (!jobAlreadyNotified) {
            const emailPreview = cleanedBody.substring(0, 100) + (cleanedBody.length > 100 ? '...' : '');
            await storage.createNotification({
              title: `📧 Email Reply from ${customer.name}`,
              message: emailPreview || `Re: ${email.subject}`,
              type: 'email_reply',
              priority: 'medium',
              jobId: job.id,
              customerId: job.customerId,
              ...(diaryEntryId && { diaryEntryId }),
              actionUrl: `/dispatch?job=${job.id}&tab=diary${diaryEntryId ? `&entry=${diaryEntryId}` : ''}`
            });
            console.log(`🔔 Created notification for email reply from ${customer.name} on job #${job.jobNumber}`);

            const { pushToAdminsWithCustomerMessages } = await import('./notificationHelper.js');
            const pushCount = await pushToAdminsWithCustomerMessages({
              title: `Email Reply — ${customer.name}`,
              body: emailPreview || `Re: ${email.subject}`,
              clickAction: `/dispatch?job=${job.id}&tab=diary${diaryEntryId ? `&entry=${diaryEntryId}` : ''}`,
              data: {
                type: 'email_reply',
                jobId: job.id,
                customerId: job.customerId || '',
                jobNumber: String(job.jobNumber),
              },
            });
            console.log(`📲 Pushed email-reply notification to ${pushCount} admin(s) for job #${job.jobNumber}`);
          } else {
            console.log(`🔔 Skipping duplicate email_reply notification for job #${job.jobNumber}`);
          }
        } catch (notifError) {
          console.error('Error creating email reply notification:', notifError);
        }
        
        // Job-matched replies live in the job diary only — never in the conversations page.
        // The diary entry + email_reply notification above is the complete record; creating a
        // conversation here would also fire a `new_conversation` notification that routes to
        // /conversation/{id}, which is exactly what we don't want for job replies.
        console.log(`📧 Reply matched to job #${job.jobNumber} - logged to diary only, skipping conversations page`);
        return true;
      }
      
      // Create or update conversation to trigger notification bell
      // This only runs for emails NOT sent to job-specific addresses
      try {
        // Import notification helper
        const notificationHelper = await import('./notificationHelper.js');
        const { storage } = await import('../storage.js');
        
        // Check for existing open conversation from this email
        let conversation = await notificationHelper.findExistingOpenConversation(email.from.trim().toLowerCase());
        let isNewConversation = !conversation;
        
        // Extract sender name from email or use customer name if available
        const senderName = customer?.name || email.from.split('@')[0].replace(/[._]/g, ' ');
        
        if (!conversation) {
          // Create new conversation from email reply
          const conversationTitle = cleanedBody.length > 0 
            ? cleanedBody.substring(0, 100) + (cleanedBody.length > 100 ? '...' : '')
            : `Re: ${email.subject}`;
          
          conversation = await storage.createConversation({
            title: conversationTitle,
            status: 'open',
            priority: 'medium',
            source: 'email',
            tags: ['email-reply', customer ? 'customer' : 'lead'],
            customerId: customer?.id || null
          });
          
          // Create notification bell entry for new conversation
          await notificationHelper.createConversationNotification(conversation);
          console.log(`📧 ✅ Created new conversation for email reply: ${conversation.id}`);
        } else {
          console.log(`📧 ✅ Found existing open conversation for ${email.from}, adding message to: ${conversation.id}`);
          await notificationHelper.notifyConversationReply(
            { id: conversation.id, title: conversation.title, source: 'email', customerName: senderName },
            cleanedBody
          );
        }
        
        // Create conversation message with optional job info
        const messageMetadata: Record<string, any> = {
          subject: email.subject,
          messageId: email.messageId,
          inReplyTo: email.inReplyTo
        };
        
        if (job) {
          messageMetadata.jobNumber = job.jobNumber;
          messageMetadata.jobId = job.id;
        }
        
        await storage.createConversationMessage({
          conversationId: conversation.id,
          type: 'message',
          content: cleanedBody,
          direction: 'inbound',
          fromName: senderName,
          fromContact: email.from.trim().toLowerCase(),
          platform: 'email',
          subject: email.subject,
          metadata: messageMetadata
        });
        
        // Update conversation's lastMessageAt
        await storage.updateConversation(conversation.id, {
          lastMessageAt: email.date,
          lastMessageBy: 'customer'
        });
        
        console.log(`📧 ✅ Added email to conversation messages`);
      } catch (convError) {
        console.error('📧 Error creating conversation from email reply:', convError);
        // Continue even if conversation creation fails - the job diary entry was still created
      }
      
      return true; // Successfully processed
    } catch (error) {
      console.error('📧 Error processing email reply:', error);
      return false; // Failed to process
    }
  }

  /**
   * Clean up email body by removing quoted text and signatures
   */
  private cleanEmailBody(body: string): string {
    if (!body) return '';

    let cleaned = body;

    // Remove everything after a line of 3+ underscores (HR separator in plain text)
    // This strips the quoted original email footer (e.g. "___\nFrom: Treemarkables")
    cleaned = cleaned.replace(/\n[_\-]{3,}[\s\S]*$/m, '');

    // Remove common reply headers ("On X wrote:" blocks)
    cleaned = cleaned.replace(/^On .+? wrote:[\s\S]*$/im, '');
    cleaned = cleaned.replace(/\n*On .+? wrote:\s*$/is, '');
    cleaned = cleaned.replace(/\n+On\s+.+$/is, '');

    // Remove Outlook-style quoted header blocks (From: / Sent: / To: / Subject:)
    cleaned = cleaned.replace(/^From:.+?Sent:.+?To:.+?Subject:[\s\S]*$/im, '');
    cleaned = cleaned.replace(/\n*From:\s*Treemarkables[\s\S]*$/im, '');

    // Remove quoted lines starting with >
    cleaned = cleaned.split('\n')
      .filter(line => !line.trim().startsWith('>'))
      .join('\n');

    // Remove common email signatures
    cleaned = cleaned.replace(/--\s*\n[\s\S]*$/im, '');
    cleaned = cleaned.replace(/Sent from my.*/i, '');

    // Strip everything from a closing salutation onward. Catches lines like
    // "Kind regards", "Regards", "Cheers", "Regards, Glen Udall" etc., which
    // are reliably followed by a name + signature block we don't want.
    cleaned = cleaned.replace(
      /\n+(?:kind regards|best regards|warm regards|regards|cheers mate|cheers|many thanks|thank you so much|thank you|thanks|sincerely|yours sincerely|yours faithfully|best wishes|talk soon|speak soon|best)(?:[,.!]|\s*,\s*\S[^\n]*)?\s*$[\s\S]*/im,
      '',
    );

    // Collapse multiple blank lines into one
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
  }
}

export const gmailReplyService = new GmailReplyService();
