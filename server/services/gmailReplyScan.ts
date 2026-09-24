/**
 * Which Gmail folders the reply poller scans, and how a message is recognised
 * across those folders.
 *
 * `[Gmail]/All Mail` already includes Inbox and every other label except Spam
 * and Trash. Customer replies that Gmail filed as Spam never appeared there,
 * so the poller also opens the Spam mailbox (Gmail special-use `\Junk`,
 * falling back to `[Gmail]/Spam`).
 *
 * Matching a reply to a job is unchanged. This module only decides folders,
 * same-poll dedupe, and which Spam messages are safe to lift into Inbox.
 */

export const GMAIL_ALL_MAIL_MAILBOX = '[Gmail]/All Mail';
export const GMAIL_SPAM_MAILBOX = '[Gmail]/Spam';
/** Gmail treats a move here as "Not spam" (adds Inbox, drops the Spam label). */
export const GMAIL_INBOX_MOVE_TARGET = 'INBOX';

export interface ReplyMailbox {
  name: string;
  /** When true, a successfully filed message may be moved to Inbox. */
  rescueFromSpam: boolean;
}

export interface ImapBoxNode {
  delimiter?: string;
  attribs?: string[];
  children?: Record<string, ImapBoxNode>;
}

export interface ReplyDedupeInput {
  messageId?: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: Date;
  textBody?: string;
}

export interface MailboxProcessOutcome {
  uid?: number;
  messageId?: string;
  /** processEmailReply returned true, or this poll already filed the message. */
  filedOrDuplicate: boolean;
}

/**
 * All Mail first (Inbox and every non-spam label), then Spam.
 * A discovered `\Junk` mailbox replaces the English `[Gmail]/Spam` default
 * so a localised Gmail folder name is still scanned once.
 */
export function replyMailboxesToScan(discoveredJunk: string | null | undefined): ReplyMailbox[] {
  const allMail: ReplyMailbox = { name: GMAIL_ALL_MAIL_MAILBOX, rescueFromSpam: false };
  const junk = discoveredJunk?.trim();
  const spamName = junk && junk !== GMAIL_ALL_MAIL_MAILBOX ? junk : GMAIL_SPAM_MAILBOX;
  if (spamName === allMail.name) return [allMail];
  return [allMail, { name: spamName, rescueFromSpam: true }];
}

/** IMAP LIST special-use `\Junk` → full mailbox path, or null when absent. */
export function junkMailboxFromBoxes(
  boxes: Record<string, ImapBoxNode> | null | undefined,
  prefix = '',
  parentDelim = '/',
): string | null {
  if (!boxes) return null;
  for (const [name, box] of Object.entries(boxes)) {
    const path = prefix ? `${prefix}${parentDelim}${name}` : name;
    const attribs = box.attribs || [];
    if (attribs.some((attrib) => attrib.toLowerCase() === '\\junk')) return path;
    if (box.children) {
      const found = junkMailboxFromBoxes(box.children, path, box.delimiter || parentDelim);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Identity of one logical email across Spam and All Mail / Inbox.
 * Message-ID is also what the diary row stores, so the next poll (after a
 * move into Inbox) hits the existing duplicate check and does not file again.
 * Without a Message-ID, a content fingerprint only covers this poll.
 */
export function replyDedupeKey(email: ReplyDedupeInput): string | null {
  const messageId = email.messageId?.trim();
  if (messageId) return `mid:${messageId}`;

  const from = (email.from || '').trim().toLowerCase();
  const to = (email.to || '').trim().toLowerCase();
  const subject = (email.subject || '').trim();
  const body = (email.textBody || '').trim();
  if (!from && !to && !subject && !body) return null;
  const date = email.date instanceof Date && !Number.isNaN(email.date.getTime())
    ? email.date.toISOString()
    : '';
  return `fp:${from}|${to}|${subject}|${date}|${body.slice(0, 2000)}`;
}

export function createReplyDedupe() {
  const seen = new Set<string>();
  return {
    has(email: ReplyDedupeInput): boolean {
      const key = replyDedupeKey(email);
      if (!key) return false;
      return seen.has(key);
    },
    remember(email: ReplyDedupeInput): void {
      const key = replyDedupeKey(email);
      if (key) seen.add(key);
    },
  };
}

/**
 * File each message in one mailbox. A message already filed earlier in this
 * poll (All Mail, then Spam, or the reverse) is not passed to fileReply again.
 */
export async function fileMailboxReplies<T extends ReplyDedupeInput & { uid?: number }>(
  emails: T[],
  dedupe: { has: (email: ReplyDedupeInput) => boolean; remember: (email: ReplyDedupeInput) => void },
  fileReply: (email: T) => Promise<boolean>,
): Promise<MailboxProcessOutcome[]> {
  const outcomes: MailboxProcessOutcome[] = [];
  for (const email of emails) {
    if (dedupe.has(email)) {
      console.log(`📧 Already handled in this poll (messageId: ${email.messageId || 'fingerprint'}) — not filing again`);
      outcomes.push({ uid: email.uid, messageId: email.messageId, filedOrDuplicate: true });
      continue;
    }
    const success = await fileReply(email);
    if (success) dedupe.remember(email);
    outcomes.push({ uid: email.uid, messageId: email.messageId, filedOrDuplicate: success });
  }
  return outcomes;
}

export function uidsToMarkSeen(outcomes: MailboxProcessOutcome[]): number[] {
  const uids: number[] = [];
  for (const outcome of outcomes) {
    if (outcome.filedOrDuplicate && typeof outcome.uid === 'number') uids.push(outcome.uid);
  }
  return [...new Set(uids)];
}

/**
 * Spam messages that are safe to move to Inbox. A Message-ID is required:
 * the following All Mail scan stores that id on the diary row and will skip
 * a second insert. A message with no Message-ID stays in Spam (still marked
 * seen when filing succeeded) so the move itself cannot create a second diary entry.
 */
export function uidsToRescueFromSpam(
  rescueFromSpam: boolean,
  outcomes: MailboxProcessOutcome[],
): number[] {
  if (!rescueFromSpam) return [];
  const uids: number[] = [];
  for (const outcome of outcomes) {
    if (!outcome.filedOrDuplicate) continue;
    if (!outcome.messageId?.trim()) continue;
    if (typeof outcome.uid !== 'number') continue;
    uids.push(outcome.uid);
  }
  return [...new Set(uids)];
}
