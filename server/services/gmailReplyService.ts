import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { db } from '../db';
import { jobs, jobDiaryEntries, customers } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

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

      imap.once('ready', () => {
        imap.openBox('INBOX', false, async (err, box) => {
          if (err) {
            console.error('📧 Error opening Gmail inbox:', err);
            imap.end();
            reject(err);
            return;
          }

          // Search for unread emails from the last 7 days
          const searchDate = new Date();
          searchDate.setDate(searchDate.getDate() - 7);

          imap.search(['UNSEEN', ['SINCE', searchDate]], async (err, results) => {
            if (err) {
              console.error('📧 Gmail search error:', err);
              imap.end();
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              console.log('📧 No new email replies found');
              imap.end();
              resolve();
              return;
            }

            console.log(`📧 Found ${results.length} unread email(s) to process`);

            const fetch = imap.fetch(results, { bodies: '', markSeen: false });
            const emailsToProcess: ParsedEmailReply[] = [];

            fetch.on('message', (msg, seqno) => {
              let emailUid: number | undefined;

              msg.on('body', (stream) => {
                simpleParser(stream, async (err, parsed) => {
                  if (err) {
                    console.error('📧 Error parsing email:', err);
                    return;
                  }

                  // Extract sender email
                  const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase();
                  const toEmail = parsed.to?.value?.[0]?.address?.toLowerCase();
                  console.log(`📧 Processing email from: ${fromEmail}, to: ${toEmail}, subject: ${parsed.subject}`);
                  
                  if (!fromEmail) {
                    console.log(`📧 Skipping - no FROM address`);
                    return;
                  }

                  // Skip emails from our own domain (these are outgoing emails)
                  if (fromEmail.includes('treemarkables.co.nz') || fromEmail.includes('treemarkables.nz')) {
                    console.log(`📧 Skipping outgoing email from: ${fromEmail}`);
                    return;
                  }

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
                    uid: emailUid // Store UID for later marking as seen
                  };

                  emailsToProcess.push(emailData);
                });
              });

              msg.once('attributes', (attrs) => {
                // Store UID but DON'T mark as seen yet - wait until after successful DB insert
                emailUid = attrs.uid;
              });
            });

            fetch.once('error', (err) => {
              console.error('📧 Fetch error:', err);
              reject(err);
            });

            fetch.once('end', async () => {
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

              console.log(`📧 Processed ${emailsToProcess.length} email reply(ies)`);
              imap.end();
              resolve();
            });
          });
        });
      });

      imap.once('error', (err) => {
        console.error('📧 IMAP connection error:', err);
        reject(err);
      });

      imap.once('end', () => {
        console.log('📧 Gmail IMAP connection ended');
      });

      imap.connect();
    });
  }

  /**
   * Process a single email reply and match it to a job
   * Returns true if successfully processed, false otherwise
   */
  private async processEmailReply(email: ParsedEmailReply): Promise<boolean> {
    try {
      // STEP 1: Try to extract job number from TO address (job-XXXX@jobs.treemarkables.co.nz)
      let job = null;
      let customer = null;
      
      if (email.to) {
        const jobNumberMatch = email.to.match(/job-(\d+)@/i);
        if (jobNumberMatch) {
          const jobNumber = jobNumberMatch[1];
          console.log(`📧 ✅ Extracted job number ${jobNumber} from TO address: ${email.to}`);
          
          // Find job by job number
          job = await db.query.jobs.findFirst({
            where: eq(jobs.jobNumber, jobNumber),
            with: {
              customer: true
            }
          });
          
          if (job) {
            customer = job.customer;
            console.log(`📧 ✅ Found job #${job.jobNumber} for customer: ${customer.name}`);
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

        if (!customer) {
          console.log(`📧 ❌ No customer found for email: ${email.from}`);
          return false;
        }
        
        console.log(`📧 ✅ Found customer: ${customer.name} (ID: ${customer.id})`);

        // Find the most recent job for this customer
        const customerJobs = await db.query.jobs.findMany({
          where: eq(jobs.customerId, customer.id),
          orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
          limit: 1
        });

        if (!customerJobs || customerJobs.length === 0) {
          console.log(`📧 No jobs found for customer: ${customer.name}`);
          return false;
        }

        job = customerJobs[0];
      }

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

      // Clean up email body text (remove quoted replies)
      const cleanedBody = this.cleanEmailBody(email.textBody);

      // Create job diary entry for the email reply
      await db.insert(jobDiaryEntries).values({
        jobId: job.id,
        entryType: 'email',
        title: `Email reply received: ${email.subject}`,
        description: `Email received from ${customer.name} (${email.from})\n\nSubject: ${email.subject}\n\n${cleanedBody}`,
        content: email.htmlBody || email.textBody,
        authorName: customer.name,
        authorRole: 'customer',
        tags: ['communication', 'email', 'customer-reply'],
        metadata: {
          emailAddress: email.from,
          messageId: email.messageId,
          inReplyTo: email.inReplyTo,
          receivedAt: email.date.toISOString(),
          direction: 'incoming',
          rawBody: email.textBody // Store raw body for debugging
        }
      });

      console.log(`📧 ✅ Added email reply to job diary - Job #${job.jobNumber}, Customer: ${customer.name}`);
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

    // Remove common reply headers
    cleaned = cleaned.replace(/^On .+? wrote:[\s\S]*$/im, '');
    cleaned = cleaned.replace(/^From:.+?Sent:.+?To:.+?Subject:[\s\S]*$/im, '');
    
    // Remove quoted lines starting with >
    cleaned = cleaned.split('\n')
      .filter(line => !line.trim().startsWith('>'))
      .join('\n');

    // Remove trailing quoted content
    cleaned = cleaned.replace(/\n*On .+? wrote:\s*$/is, '');
    cleaned = cleaned.replace(/\n+On\s+.+$/is, '');

    // Remove common email signatures
    cleaned = cleaned.replace(/--\s*\n[\s\S]*$/im, '');
    cleaned = cleaned.replace(/Sent from my.*/i, '');

    return cleaned.trim();
  }
}

export const gmailReplyService = new GmailReplyService();
