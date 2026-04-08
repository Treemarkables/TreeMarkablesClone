# Twilio Voice Call Recording Setup — Live Call + Auto Transcription

## Overview

When a customer calls your real number (on business cards, website, etc.) and you don't answer — or you've set up conditional forwarding — the call routes to Twilio. Twilio then:

1. Calls your real phone so you can answer and have a live conversation
2. Records the entire conversation
3. Transcribes it with OpenAI Whisper
4. Extracts the customer name, address, and job details
5. Auto-creates a customer and job in your app
6. Auto-generates a draft quote if pricing was discussed

If you don't answer within 20 seconds, it plays a voicemail greeting and records a message instead — which goes through the same transcription pipeline.

## Prerequisites

- Active Twilio account with a NZ phone number
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` configured as secrets
- `HERO_PHONE_NUMBER` secret set to your real phone number (e.g. `+6421XXXXXXX`)
- `OPENAI_API_KEY` configured

## How Calls Reach Twilio

**Option A — Carrier conditional forwarding (recommended)**

Set up forwarding on your NZ carrier so unanswered calls go to your Twilio number:

| Carrier | Code to enable | Code to disable |
|---------|---------------|-----------------|
| Spark | `**61*+64[TwilioNumber]*11*20#` | `##61#` |
| Vodafone | `**61*+64[TwilioNumber]#` | `##61#` |
| 2degrees | `**61*+64[TwilioNumber]#` | `##61#` |

Replace `[TwilioNumber]` with your Twilio number digits only (e.g. `94123456` for a 09 number). The `20` sets the ring time to 20 seconds before forwarding.

**Option B — iPhone call forwarding**

Settings → Phone → Call Forwarding → enter your Twilio number. Note: this forwards ALL calls, not just unanswered ones.

## Twilio Console Configuration

### Step 1: Get your deployed app URL

Use your **published** app URL (not the dev preview URL):
```
https://your-app-name.replit.app
```

### Step 2: Configure your Twilio phone number

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers → Manage → Active Numbers**
3. Click your Twilio NZ number

Under **Voice Configuration**:

**A CALL COMES IN:**
- Set to: `Webhook`
- URL: `https://your-app-name.replit.app/api/webhooks/twilio-answer`
- Method: `HTTP POST`

**STATUS CALLBACK URL:** *(optional but recommended for missed call tracking)*
- URL: `https://your-app-name.replit.app/api/webhooks/twilio-voice`
- Method: `HTTP POST`

Click **Save** at the bottom.

### That's it

No TwiML Bin needed. The app dynamically generates the TwiML at runtime using your `HERO_PHONE_NUMBER` secret.

## What Happens on Each Call

```
Customer calls your real number
    ↓
Carrier forwards to Twilio (if unanswered)
    ↓
Twilio hits /api/webhooks/twilio-answer
    ↓
App rings HERO_PHONE_NUMBER (your real phone)
    ↓
If you answer: conversation recorded in real time
If no answer (20s): voicemail greeting plays, customer leaves message
    ↓
Recording sent to /api/webhooks/twilio-voice
    ↓
App downloads MP3 → stores in Object Storage (permanent)
    ↓
Whisper transcribes the audio
    ↓
GPT-4 extracts: customer name, address, service type, urgency, price
    ↓
Customer record created (or matched by phone number)
Job created and linked to customer
If pricing discussed: draft quote auto-generated
All logged to job diary with full transcript
```

## Caller ID — How It Works

When your NZ carrier forwards a call to Twilio, it passes the original caller's number in a `ForwardedFrom` header. The app reads this so the customer is correctly identified — not you (the phone owner).

If a call comes directly to the Twilio number (not forwarded), the app falls back to the standard `From` field.

## What You'll See After a Call

In the **Job Diary** for the auto-created job:
- Phone icon entry with the full transcript
- Inline audio player to replay the recording
- Sentiment badge (Positive / Neutral / Negative)
- Auto-extracted job details shown as a summary

In the **Communications** tab:
- All call records with linked job numbers
- Search by caller name, number, or transcript content

## Testing

### 1. Test the answer flow

Call your Twilio number directly. Within 2 seconds your `HERO_PHONE_NUMBER` should ring. Answer it and have a short conversation:

> "Hi, I'm John Smith calling about removing a large kahikatea tree at 47 Remuera Road Auckland. I was quoted about $1,800."

### 2. Test the voicemail fallback

Call your Twilio number and let it ring for 20+ seconds without answering on `HERO_PHONE_NUMBER`. You should hear the voicemail greeting and be able to leave a message.

### 3. Check logs

Watch server logs for:
```
📞 Twilio answer webhook — forwarding to +6421XXXXXXX
📞 Twilio voice webhook - CallSid: CA...
🎙️ Call CA... completed with recording: https://...
✅ Recording downloaded (XXXXXX bytes)
✅ Recording uploaded to Object Storage
📝 Call record created: <uuid>
✅ Call transcribed: Hi, I'm John Smith...
🤖 Extracted job data: { customerName: 'John Smith', ... }
✅ New customer created: John Smith
✅ Job #1234 auto-created from call
💰 Pricing discussion detected - generating quote draft...
✅ Quote auto-generated for job #1234
```

### 4. Verify in app

1. Open **Dispatch Board** — new job should appear
2. Open the job card → **Diary** tab — call transcript and audio player should be there
3. Open **Communications** tab → **Calls** — recording should be listed and playable

## Costs (Approximate — NZD)

| Item | Cost |
|------|------|
| Twilio NZ number | ~$1.50/month |
| Inbound call to Twilio | ~$0.01/min |
| Outbound call to HERO_PHONE_NUMBER | ~$0.03/min |
| Recording storage | ~$0.004/min |
| Whisper transcription | ~$0.006/min |
| GPT-4 extraction | ~$0.02/call |
| GPT-4o quote extraction | ~$0.02/call (when pricing discussed) |

**Example:** 50 calls × 5 min avg = ~$5–8 NZD/month total. Recordings are stored permanently at no ongoing cost via Replit Object Storage.

## Troubleshooting

**HERO_PHONE_NUMBER doesn't ring**
- Check the secret is set to E.164 format: `+6421XXXXXXX`
- Verify your Twilio number webhook URL points to `/api/webhooks/twilio-answer` (not `/twilio-voice`)
- Check Twilio debugger: https://console.twilio.com/debugger

**Recording not appearing in job diary**
- Check server logs for `❌ Failed to download recording`
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` secrets are set
- Make sure `PRIVATE_OBJECT_DIR` environment variable is set (should be auto-configured)

**Webhook signature rejected (403)**
- Must use the deployed (published) app URL in Twilio, not the dev preview URL
- The dev URL changes; the published URL is stable

**Customer not created / job not created**
- Check logs for "Insufficient data to create job"
- The customer's name must be mentioned in the call
- Either a service type or an address must be mentioned

**Caller showing as wrong number**
- If `ForwardedFrom` is empty, your carrier may not be passing it through
- Check Twilio logs for the `From` and `ForwardedFrom` fields
- As a workaround, have customers call the Twilio number directly
