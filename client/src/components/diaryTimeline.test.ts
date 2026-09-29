/**
 * Job 4237's diary: a proposal-sent email with NULL content, and an inbound
 * Apple Mail reply whose description is blank so the HTML document is the body.
 * Names and addresses here are fake.
 *
 * Run: node --experimental-strip-types --test client/src/components/diaryTimeline.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assembleDiaryEntries,
  cleanDiaryContent,
  emailBubbleMessage,
  emailEntryPhotoUrls,
  fetchDiaryTimelineSources,
  formatDiaryTimestamp,
  hideEmbeddedPhotoNote,
  stripTrailingOnWrote,
} from "./diaryTimeline.ts";

const APPLE_MAIL_HTML = `<html class="apple-mail-supports-explicit-dark-mode"><head><meta http-equiv="content-type" content="text/html; charset=utf-8"></head><body dir="auto"><div dir="ltr"></div><div dir="ltr"><div dir="ltr">Hi there,&nbsp;</div><div dir="ltr"><br></div><div dir="ltr">Thanks for the sample quote. Could you split the sample total into two lines?</div><div dir="ltr"><br></div><div dir="ltr">Alex</div></div><div dir="ltr"><br><blockquote type="cite">On 24 Sep 2026, at 7:01 PM, Sample Trees &lt;user@example.com&gt; wrote:<br><br></blockquote></div><blockquote type="cite"><div><table role="presentation" width="100%"><tr><td><p>Hi Alex Morgan,</p><p>Here is a sample proposal.</p><div>Proposal #PROP-1000000000001</div><div>$1,200.00 <span>incl. GST</span></div><a href="https://app.example.com/watch/00000000-0000-4000-8000-000000000001">View Proposal</a></td></tr></table><img alt="" src="https://example.com/pixel" style="display: none; width: 1px; height: 1px;"></div></blockquote></body></html>`;

const proposalSentRow = {
  id: "entry-proposal-sent",
  entryType: "email",
  title: "Proposal Sent: PROP-1000000000001",
  description:
    'Proposal "Sample Quote" sent to customer@example.com\n\nTotal: $1043.48 NZD excl. GST',
  content: null,
  authorName: "System",
  createdAt: "2026-09-24T07:01:07.138Z",
  photos: null,
  metadata: {
    cc: null,
    total: "1200.00",
    recipient: "customer@example.com",
    proposalId: "00000000-0000-4000-8000-000000000002",
    proposalNumber: "PROP-1000000000001",
    sendgridMessageId: "sg-test-id",
  },
};

const replyRow = {
  id: "entry-reply",
  entryType: "email",
  title: "Email reply: Re: Sample Quote",
  description: "",
  content: APPLE_MAIL_HTML,
  authorName: "Alex Morgan",
  createdAt: "2026-09-28T20:48:21.530Z",
  photos: null,
  metadata: {
    rawBody: "",
    subject: "Re: Sample Quote",
    direction: "incoming",
    inReplyTo: "<outbound@example.com>",
    messageId: "<reply@example.com>",
    receivedAt: "2026-09-28T20:47:30Z",
    emailAddress: "customer@example.com",
  },
};

const proposal = {
  id: "proposal-1",
  templateUsed: null,
  proposalNumber: "PROP-1000000000001",
  title: "Sample Quote",
  description: null,
  status: "draft",
  createdBy: "Owner",
  createdAt: "2026-09-24T07:01:06.508Z",
};

describe("job diary shapes from a blank-description Apple Mail reply", () => {
  it("builds both emails and the matching proposal without throwing", () => {
    const entries = assembleDiaryEntries({
      diary: { data: [proposalSentRow, replyRow] },
      proposals: { data: [proposal] },
      servicem8: { data: [] },
      schedule: { data: [] },
    });
    assert.equal(entries.length, 3);
    assert.deepEqual(
      entries.map((e) => e.id),
      ["entry-reply", "entry-proposal-sent", "proposal-1"],
    );

    const sent = entries.find((e) => e.id === "entry-proposal-sent");
    assert.ok(sent);
    assert.equal(sent.type, "email");
    assert.match(sent.content, /Proposal "Sample Quote" sent to customer@example.com/);
    assert.equal(sent.content.includes("null"), false);

    const reply = entries.find((e) => e.id === "entry-reply");
    assert.ok(reply);
    assert.equal(reply.content.startsWith("<html"), true);

    const created = entries.find((e) => e.id === "proposal-1");
    assert.ok(created);
    assert.equal(created.type, "proposal");
    assert.equal(created.title, "Proposal Created: PROP-1000000000001");
    assert.equal(created.content, "Sample Quote");
  });

  it("renders the HTML reply as text and the null-content send as its description", () => {
    const entries = assembleDiaryEntries({
      diary: { data: [proposalSentRow, replyRow] },
      proposals: { data: [proposal] },
      servicem8: { data: [] },
      schedule: { data: [] },
    });
    const reply = entries.find((e) => e.id === "entry-reply");
    const sent = entries.find((e) => e.id === "entry-proposal-sent");
    assert.ok(reply && sent);

    const started = Date.now();
    const bubble = emailBubbleMessage(reply);
    const sentBubble = emailBubbleMessage({ title: sent.title, content: null });
    const described = emailBubbleMessage(sent);
    assert.ok(Date.now() - started < 50, "bubble render should stay on the main thread");

    assert.equal(bubble.isReceived, true);
    assert.equal(bubble.isSent, false);
    assert.match(bubble.text, /split the sample total/);
    assert.equal(bubble.text.includes("<html"), false);
    assert.equal(bubble.text.includes("<table"), false);
    assert.equal(bubble.text.includes("<a "), false);

    assert.equal(sentBubble.isSent, true);
    assert.equal(sentBubble.text, "");
    assert.match(described.text, /Total: \$1043\.48/);
    assert.equal(formatDiaryTimestamp(reply.timestamp).length > 0, true);
    assert.equal(formatDiaryTimestamp("not-a-date"), "");
  });

  it("does not let a proposals failure drop diary rows", async () => {
    const request = async (method: string, url: string) => {
      assert.equal(method, "GET");
      if (url.includes("/diary") && !url.includes("servicem8")) {
        return { json: async () => ({ data: [proposalSentRow, replyRow] }) };
      }
      if (url.includes("/proposals")) {
        throw new Error("proposals 500");
      }
      if (url.includes("servicem8")) throw new Error("no route");
      return { json: async () => ({ data: [] }) };
    };
    const sources = await fetchDiaryTimelineSources(
      {
        diary: "/api/jobs/job-1/diary?limit=100",
        proposals: "/api/proposals?jobId=job-1",
        servicem8: "/api/servicem8/jobs/job-1/diary",
        assignments: "/api/jobs/job-1/staff-assignments",
      },
      request,
    );
    const entries = assembleDiaryEntries(sources);
    assert.equal(entries.length, 2);
    assert.equal(entries.some((e) => e.id === "entry-reply"), true);
    assert.equal(entries.some((e) => e.type === "proposal"), false);
  });

  it("still fails the diary when the diary request itself fails", async () => {
    const request = async (_method: string, url: string) => {
      if (url.includes("/proposals")) return { json: async () => ({ data: [proposal] }) };
      if (url.endsWith("/diary?limit=100") || url.includes("/diary?")) {
        throw new Error("diary 500");
      }
      return { json: async () => ({ data: [] }) };
    };
    await assert.rejects(
      () =>
        fetchDiaryTimelineSources(
          {
            diary: "/api/jobs/job-1/diary?limit=100",
            proposals: "/api/proposals?jobId=job-1",
            servicem8: "/api/servicem8/jobs/job-1/diary",
            assignments: "/api/jobs/job-1/staff-assignments",
          },
          request,
        ),
      /diary 500/,
    );
  });

  it("keeps sent email photo paths and hides the embedded-count line only when they exist", () => {
    const description = [
      "Email sent to admin@example.net.nz",
      "",
      "Photos: 4 photo(s) embedded",
      "",
      "Message:",
      "<p>Hi Jae</p>",
    ].join("\n");
    const photoPaths = [
      "/objects/photos/1790649620570_287afc69.jpg",
      "/objects/photos/e8c1af41.jpeg",
      "/objects/photos/0f4daa8c.jpeg",
      "/objects/photos/14a0de3a.jpeg",
    ];
    const row = {
      id: "entry-photo-email",
      entryType: "email",
      title: "Email sent: Sponsorship ",
      description,
      content: null,
      authorName: "System",
      createdAt: "2026-09-28T03:42:00.000Z",
      photos: photoPaths,
      photoUrl: photoPaths[0],
      metadata: {
        emailAddress: "admin@example.net.nz",
        sendgridMessageId: "re_test",
        attachments: [
          {
            url: "/api/invoices/inv-1/pdf",
            filename: "Invoice-100.pdf",
            contentType: "application/pdf",
          },
        ],
      },
    };
    const [entry] = assembleDiaryEntries({
      diary: { data: [row] },
      proposals: { data: [] },
      servicem8: { data: [] },
      schedule: { data: [] },
    });
    assert.ok(entry);
    assert.deepEqual(emailEntryPhotoUrls(entry), photoPaths);
    const bubble = emailBubbleMessage(entry);
    assert.equal(bubble.isSent, true);
    assert.match(bubble.recipientInfo, /Photos: 4 photo\(s\) embedded/);
    assert.equal(
      hideEmbeddedPhotoNote(bubble.recipientInfo, true),
      "admin@example.net.nz",
    );
    assert.equal(hideEmbeddedPhotoNote(bubble.text, true).includes("Photos:"), false);
    assert.match(hideEmbeddedPhotoNote(bubble.text, true), /Hi Jae/);
    // Old rows recorded a count and left photos null. The grey line stays.
    assert.equal(
      hideEmbeddedPhotoNote(bubble.recipientInfo, emailEntryPhotoUrls({ photos: null, photoUrl: null }).length > 0),
      bubble.recipientInfo,
    );
  });

  it("strips a long missed On-wrote tail without hanging", () => {
    let body = "Thanks, that works.\n";
    for (let i = 0; i < 80; i++) {
      body += `On word${i} at word${i} name <user${i}@example.com> not the end\n`;
    }
    body += "tail that never says the magic word";
    const started = Date.now();
    const cleaned = cleanDiaryContent(body, "email");
    assert.ok(Date.now() - started < 50);
    assert.match(cleaned, /Thanks, that works/);
    const quoted = "See you then.\nOn 24 Sep 2026, at 7:01 PM, Alex <user@example.com> wrote:";
    assert.equal(stripTrailingOnWrote(quoted), "See you then.");
  });
});
