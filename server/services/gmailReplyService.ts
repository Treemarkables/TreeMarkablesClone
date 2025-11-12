import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { db } from '../db';
import { jobs, jobDiaryEntries, customers } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

interface ParsedEmailReply {
  from: string;
  subject: string;
  date: Date;
  textBody: string;
  htmlBody?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
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
              msg.on('body', (stream) => {
                simpleParser(stream, async (err, parsed) => {
                  if (err) {
                    console.error('📧 Error parsing email:', err);
                    return;
                  }

                  // Extract sender email
                  const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase();
                  if (!fromEmail) return;

                  // Skip emails from our own domain (these are outgoing emails)
                  if (fromEmail.includes('treemarkables.co.nz') || fromEmail.includes('treemarkables.nz')) {
                    return;
                  }

                  const emailData: ParsedEmailReply = {
                    from: fromEmail,
                    subject: parsed.subject || '(no subject)',
                    date: parsed.date || new Date(),
                    textBody: parsed.text || '',
                    htmlBody: parsed.html || undefined,
                    messageId: parsed.messageId,
                    inReplyTo: parsed.inReplyTo,
                    references: parsed.references
                  };

                  emailsToProcess.push(emailData);
                });
              });

              msg.once('attributes', (attrs) => {
                // Mark as seen after processing
                const { uid } = attrs;
                imap.addFlags(uid, ['\\Seen'], (err) => {
                  if (err) console.error('📧 Error marking email as read:', err);
                });
              });
            });

            fetch.once('error', (err) => {
              console.error('📧 Fetch error:', err);
              reject(err);
            });

            fetch.once('end', async () => {
              // Process all collected emails
              for (const email of emailsToProcess) {
                await this.processEmailReply(email);
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
   */
  private async processEmailReply(email: ParsedEmailReply): Promise<void> {
    try {
      // Find customer by email address
      const customer = await db.query.customers.findFirst({
        where: eq(customers.email, email.from)
      });

      if (!customer) {
        console.log(`📧 No customer found for email: ${email.from}`);
        return;
      }

      // Find the most recent job for this customer
      const customerJobs = await db.query.jobs.findMany({
        where: eq(jobs.customerId, customer.id),
        orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
        limit: 1
      });

      if (!customerJobs || customerJobs.length === 0) {
        console.log(`📧 No jobs found for customer: ${customer.name}`);
        return;
      }

      const job = customerJobs[0];

      // Check if this email reply already exists in the diary
      const existingEntry = await db.query.jobDiaryEntries.findFirst({
        where: and(
          eq(jobDiaryEntries.jobId, job.id),
          eq(jobDiaryEntries.entryType, 'email')
        )
      });

      // Check metadata to see if we've already logged this specific email
      if (existingEntry && email.messageId) {
        const metadata = existingEntry.metadata as any;
        if (metadata?.messageId === email.messageId) {
          console.log(`📧 Email already logged: ${email.messageId}`);
          return;
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
          direction: 'incoming'
        }
      });

      console.log(`📧 ✅ Added email reply to job diary - Job #${job.jobNumber}, Customer: ${customer.name}`);
    } catch (error) {
      console.error('📧 Error processing email reply:', error);
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
