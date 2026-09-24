import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GMAIL_ALL_MAIL_MAILBOX,
  GMAIL_SPAM_MAILBOX,
  createReplyDedupe,
  fileMailboxReplies,
  junkMailboxFromBoxes,
  replyMailboxesToScan,
  uidsToMarkSeen,
  uidsToRescueFromSpam,
} from "./gmailReplyScan.ts";

const jobReply = {
  messageId: "<customer-reply@mail.example>",
  from: "customer@example.com",
  to: "job-8004ff8a-1618-4d18-aaaa-bbbbbbbbbbbb@jobs.treemarkables.co.nz",
  subject: "Re: quote",
  date: new Date("2026-09-24T01:00:00.000Z"),
  textBody: "Yes please go ahead",
};

describe("replyMailboxesToScan", () => {
  it("keeps All Mail (Inbox and other labels) and adds the Spam mailbox", () => {
    const mailboxes = replyMailboxesToScan(null);
    assert.deepEqual(mailboxes.map((box) => box.name), [GMAIL_ALL_MAIL_MAILBOX, GMAIL_SPAM_MAILBOX]);
    assert.equal(mailboxes[0].rescueFromSpam, false);
    assert.equal(mailboxes[1].rescueFromSpam, true);
  });

  it("uses the discovered Junk folder once and does not drop All Mail", () => {
    const mailboxes = replyMailboxesToScan("[Gmail]/Correo no deseado");
    assert.deepEqual(mailboxes.map((box) => box.name), [
      GMAIL_ALL_MAIL_MAILBOX,
      "[Gmail]/Correo no deseado",
    ]);
    assert.equal(mailboxes[1].rescueFromSpam, true);
  });

  it("does not scan the English Spam name twice when discovery already found it", () => {
    const mailboxes = replyMailboxesToScan(GMAIL_SPAM_MAILBOX);
    assert.deepEqual(mailboxes.map((box) => box.name), [GMAIL_ALL_MAIL_MAILBOX, GMAIL_SPAM_MAILBOX]);
  });

  it("ignores a junk path that is All Mail itself", () => {
    const mailboxes = replyMailboxesToScan(GMAIL_ALL_MAIL_MAILBOX);
    assert.deepEqual(mailboxes.map((box) => box.name), [GMAIL_ALL_MAIL_MAILBOX, GMAIL_SPAM_MAILBOX]);
  });
});

describe("junkMailboxFromBoxes", () => {
  it("finds Gmail's special-use Junk folder", () => {
    const path = junkMailboxFromBoxes({
      INBOX: { delimiter: "/", attribs: [] },
      "[Gmail]": {
        delimiter: "/",
        attribs: ["\\HasChildren", "\\Noselect"],
        children: {
          "All Mail": { delimiter: "/", attribs: ["\\All", "\\HasNoChildren"] },
          Spam: { delimiter: "/", attribs: ["\\Junk", "\\HasNoChildren"] },
          Trash: { delimiter: "/", attribs: ["\\Trash", "\\HasNoChildren"] },
        },
      },
    });
    assert.equal(path, "[Gmail]/Spam");
  });

  it("returns null when the account has no Junk mailbox", () => {
    assert.equal(junkMailboxFromBoxes({ INBOX: { attribs: [] } }), null);
  });
});

describe("createReplyDedupe", () => {
  it("treats the same Message-ID in Spam and All Mail as one reply", () => {
    const dedupe = createReplyDedupe();
    assert.equal(dedupe.has(jobReply), false);
    dedupe.remember(jobReply);
    assert.equal(dedupe.has({ ...jobReply, subject: "same id, other folder" }), true);
    assert.equal(dedupe.has({ ...jobReply, messageId: "<other@mail.example>" }), false);
  });

  it("fingerprints a Message-ID-less copy so one poll cannot file it twice", () => {
    const dedupe = createReplyDedupe();
    const noId = { ...jobReply, messageId: "  " };
    assert.equal(dedupe.has(noId), false);
    dedupe.remember(noId);
    assert.equal(dedupe.has({ ...noId, messageId: undefined }), true);
    assert.equal(dedupe.has({ ...noId, textBody: "a different reply" }), false);
  });
});

describe("fileMailboxReplies", () => {
  it("files a Spam copy through the same callback once, then only rescues it", async () => {
    const dedupe = createReplyDedupe();
    const mailboxes = replyMailboxesToScan("[Gmail]/Spam");
    let filings = 0;
    const fileReply = async () => {
      filings += 1;
      return true;
    };

    const allMail = mailboxes[0];
    const spam = mailboxes[1];
    const fromAllMail = await fileMailboxReplies(
      [{ ...jobReply, uid: 10 }],
      dedupe,
      fileReply,
    );
    const fromSpam = await fileMailboxReplies(
      [{ ...jobReply, uid: 77 }],
      dedupe,
      fileReply,
    );

    assert.equal(filings, 1);
    assert.equal(allMail.rescueFromSpam, false);
    assert.deepEqual(uidsToRescueFromSpam(allMail.rescueFromSpam, fromAllMail), []);
    assert.deepEqual(uidsToMarkSeen(fromAllMail), [10]);
    assert.equal(spam.rescueFromSpam, true);
    assert.deepEqual(uidsToRescueFromSpam(spam.rescueFromSpam, fromSpam), [77]);
    assert.deepEqual(uidsToMarkSeen(fromSpam), [77]);
  });

  it("does not rescue a Spam message the filer rejected", async () => {
    const dedupe = createReplyDedupe();
    const outcomes = await fileMailboxReplies(
      [{ ...jobReply, uid: 3 }],
      dedupe,
      async () => false,
    );
    assert.deepEqual(uidsToRescueFromSpam(true, outcomes), []);
    assert.deepEqual(uidsToMarkSeen(outcomes), []);
    const retry = await fileMailboxReplies(
      [{ ...jobReply, uid: 3 }],
      dedupe,
      async () => true,
    );
    assert.deepEqual(uidsToRescueFromSpam(true, retry), [3]);
  });
});

describe("spam post-process", () => {
  it("moves a filed Spam message that has a Message-ID, and marks it seen", () => {
    const outcomes = [{ uid: 42, messageId: jobReply.messageId, filedOrDuplicate: true }];
    assert.deepEqual(uidsToRescueFromSpam(true, outcomes), [42]);
    assert.deepEqual(uidsToMarkSeen(outcomes), [42]);
  });

  it("moves a Spam copy already filed from All Mail in this poll, without a second diary write", () => {
    const dedupe = createReplyDedupe();
    dedupe.remember(jobReply);
    assert.equal(dedupe.has(jobReply), true);
    const outcomes = [{ uid: 7, messageId: jobReply.messageId, filedOrDuplicate: true }];
    assert.deepEqual(uidsToRescueFromSpam(true, outcomes), [7]);
    assert.deepEqual(uidsToRescueFromSpam(false, outcomes), []);
  });

  it("leaves a failed or non-matching Spam message where it is", () => {
    const outcomes = [{ uid: 3, messageId: "<spam@mail.example>", filedOrDuplicate: false }];
    assert.deepEqual(uidsToRescueFromSpam(true, outcomes), []);
    assert.deepEqual(uidsToMarkSeen(outcomes), []);
  });

  it("does not move a filed Spam message that has no Message-ID", () => {
    const outcomes = [{ uid: 4, messageId: "  ", filedOrDuplicate: true }];
    assert.deepEqual(uidsToRescueFromSpam(true, outcomes), []);
    assert.deepEqual(uidsToMarkSeen(outcomes), [4]);
  });

  it("does not rescue messages scanned from All Mail", () => {
    const outcomes = [{ uid: 8, messageId: jobReply.messageId, filedOrDuplicate: true }];
    assert.deepEqual(uidsToRescueFromSpam(false, outcomes), []);
    assert.deepEqual(uidsToMarkSeen(outcomes), [8]);
  });
});
