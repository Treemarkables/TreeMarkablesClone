import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface DraftArgs {
  customerFirstName: string;
  jobDescription?: string | null;
  quoteNumber?: string | number | null;
  quoteAmount?: string | number | null;
  daysSince: number;
  attemptNumber: number;
  channel: 'sms' | 'email';
}

export async function generateQuoteFollowupDraft(args: DraftArgs): Promise<{ body: string }> {
  const {
    customerFirstName,
    jobDescription,
    quoteNumber,
    quoteAmount,
    daysSince,
    attemptNumber,
    channel,
  } = args;

  const greetingName = (customerFirstName || '').trim() || 'there';
  const quoteRef = quoteNumber ? `quote #${quoteNumber}` : 'the quote';
  const amountStr = quoteAmount ? `NZ$${quoteAmount}` : '';
  const jobBlurb = (jobDescription || '').toString().slice(0, 400);

  const systemPrompt = `You are Jules, owner of Treemarkables — a New Zealand arborist business in Gisborne. You're following up on a quote you sent a customer ${daysSince} days ago that they haven't responded to yet.

Strict rules:
- Plain text only. No HTML, no markdown, no emoji.
- Casual Kiwi tone — friendly, brief, not pushy.
- 1 to 2 short sentences. Keep it tight.
- Acknowledge it's a follow-up gently. Don't open with "Just following up" — find a more natural lead-in.
- Don't restate the price unless it adds something useful.
- Don't invent details that weren't in the job description.
- ${attemptNumber > 1 ? 'This is a second/later follow-up — softer, leave the door open, do NOT pressure.' : 'This is the first follow-up.'}
- Start with "Hi ${greetingName}," on its own line.
- ${channel === 'sms' ? 'This will be sent as an SMS. No formal sign-off — end naturally.' : 'This will be sent as an email. End with "Cheers," on its own line then "Jules" on the next line.'}`;

  const userPrompt = `Customer first name: ${greetingName}
Channel: ${channel}
Quote reference: ${quoteRef}${amountStr ? ` (${amountStr})` : ''}
Days since quote was sent: ${daysSince}
Follow-up attempt number: ${attemptNumber}
Job description: ${jobBlurb || '(not provided)'}

Draft the follow-up message now.`;

  const aiResponse = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const body = (aiResponse.choices[0]?.message?.content || '').trim();
  if (!body) {
    throw new Error('AI returned an empty draft');
  }
  return { body };
}
