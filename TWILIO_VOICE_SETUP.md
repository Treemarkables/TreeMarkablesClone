# Twilio Voice Call Recording Setup — Live Call + Auto Transcription

## Overview

Customers ring your personal mobile. Your carrier unconditionally forwards every call to the Twilio number. Twilio then:

1. Calls your personal mobile back so you can answer and have a live conversation
2. Records the entire conversation
3. Transcribes it with OpenAI Whisper
4. Extracts the customer name, address, and job details
5. Auto-creates a customer and job in your app
6. Auto-generates a draft quote if pricing was discussed

If you don't answer within 20 seconds, it plays the Treemarkables voicemail greeting and records a message instead — which goes through the same transcription pipeline.

## Prerequisites

- Active Twilio account with a NZ phone number
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` configured as secrets
- `OWNER_PHONE_NUMBER` secret set to your personal mobile in E.164 format (e.g. `+6421XXXXXXX`)
- `OPENAI_API_KEY` configured

### For iOS Native App (recommended — rings even when app is backgrounded)

Additional secrets required:
- `TWILIO_API_KEY` — API Key SID (starts with `SK`). Create at Twilio Console → API Keys → Create Standard.
- `TWILIO_API_SECRET` — The secret shown once at creation time.
- `TWILIO_CLIENT_IDENTITY` — Optional; defaults to `treemarkables-owner`.

See `IOS_BUILD_GUIDE.md` for the full Xcode build and TestFlight distribution walkthrough.

## Step 1: Set Up Unconditional Call Forwarding on Your Phone

Every call to your personal mobile must forward immediately to Twilio (not just unanswered calls).

**iPhone — Settings method:**
Settings → Phone → Call Forwarding → turn on → enter your Twilio NZ number (e.g. `+6448878776`)

**iPhone — USSD codes (works on all NZ carriers):**

| Carrier | Unconditional forward on | Off |
|---------|--------------------------|-----|
| Spark | `**21*+64[TwilioDigits]#` | `##21#` |
| Vodafone | `**21*+64[TwilioDigits]#` | `##21#` |
| 2degrees | `**21*+64[TwilioDigits]#` | `##21#` |

Replace `[TwilioDigits]` with your Twilio number digits without the leading `+64` (e.g. `48878776`).

## Step 2: Configure the Twilio Console

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers → Manage → Active Numbers**
3. Click your Twilio NZ number

Under **Voice Configuration**:

**A CALL COMES IN:**
- Set to: `Webhook`
- URL: `https://app.treemarkables.co.nz/api/webhooks/twilio-answer`
- Method: `HTTP POST`

**STATUS CALLBACK URL:** *(optional but recommended)*
- URL: `https://app.treemarkables.co.nz/api/webhooks/twilio-voice`
- Method: `HTTP POST`

Click **Save**.

## Step 3: Add the OWNER_PHONE_NUMBER env var

In the Digital Ocean App Platform dashboard → app `plankton-app` → Settings → App-Level Environment Variables, add:
- Key: `OWNER_PHONE_NUMBER`
- Value: your personal mobile in E.164 format, e.g. `+6421XXXXXXX`

Make sure the following are also set (full list — most should already be there):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN` (needed for signature validation + recording download)
- `TWILIO_PHONE_NUMBER`
- `TWILIO_API_KEY` + `TWILIO_API_SECRET` (needed for the iOS Voice SDK)
- `TWILIO_TWIML_APP_SID` (needed for outgoing calls from the iOS app)
- `OPENAI_API_KEY` (Whisper + GPT extraction)
- `PRIVATE_OBJECT_DIR` (GCS bucket path for permanent recording storage)

## Step 3a: Verify the wiring

Once env vars are set and the DO deploy is live, run the diagnostic from your laptop:

```bash
curl -H "x-webhook-secret: $HERO_WEBHOOK_SECRET" \
  https://app.treemarkables.co.nz/api/twilio/admin/diagnostic | jq
```

This reports:
- Which Twilio env vars are set
- Whether the Twilio account is reachable and active
- The voice webhook URL Twilio currently has for your phone number (vs the expected URL)
- The last 5 calls recorded in the DB
- A `recommendations` array listing anything missing

Iterate on env vars / Twilio console settings until `recommendations` is empty.

## How Each Call Works

```
Customer calls your personal mobile
    ↓
Carrier immediately forwards to Twilio NZ number
    ↓
Twilio hits /api/webhooks/twilio-answer
    ↓
Twilio simultaneously rings:
  • OWNER_PHONE_NUMBER (your mobile via callback)
  • Twilio Voice SDK client (iOS app, if open)
    ↓
You answer on either → full conversation recorded in real time
If no answer (20s) → voicemail greeting plays, customer leaves message
    ↓
Recording sent to /api/webhooks/twilio-voice
    ↓
App downloads MP3 → stores in Object Storage (permanent)
    ↓
Whisper transcribes the audio
    ↓
GPT extracts: customer name, address, service type, urgency, price
    ↓
Customer record created (or matched by phone number)
Job created and linked to customer
If pricing discussed: draft quote auto-generated
All logged to job diary with full transcript
```

## Caller ID — How It Works

When your carrier forwards a call to Twilio, it passes the original caller's number in a `ForwardedFrom` header. The app reads this so the customer is correctly identified — not you (the phone owner).

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

Have someone call your personal mobile. Your phone should ring once briefly (the original), then ring again (Twilio calling back). Answer the second ring and have a short test conversation:

> "Hi, I'm John Smith calling about removing a large kahikatea tree at 47 Remuera Road Auckland. I was quoted about $1,800."

### 2. Test the voicemail fallback

Call your personal mobile and let it ring without answering. After Twilio's 20-second timeout you should hear the voicemail greeting and be able to leave a message.

### 3. Check logs

Watch server logs for:
```
📞 Twilio answer webhook — client=treemarkables-owner, phone=+6421XXXXXXX
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
| Outbound call to OWNER_PHONE_NUMBER | ~$0.03/min |
| Recording storage | ~$0.004/min |
| Whisper transcription | ~$0.006/min |
| GPT extraction | ~$0.02/call |
| GPT quote extraction | ~$0.02/call (when pricing discussed) |

**Example:** 50 calls × 5 min avg = ~$5–8 NZD/month total. Recordings stored permanently in GCS bucket `treemarkables-photos/.private/recordings/`.

## Troubleshooting

**Phone not ringing on callback**
- Check `OWNER_PHONE_NUMBER` secret is set to E.164 format: `+6421XXXXXXX`
- Verify your Twilio number webhook URL points to `/api/webhooks/twilio-answer`
- Check Twilio debugger: https://console.twilio.com/debugger

**Recording not appearing in job diary**
- Check server logs for `❌ Failed to download recording`
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` secrets are set
- Make sure `PRIVATE_OBJECT_DIR` env var is set (e.g. `/treemarkables-photos/.private`) — without a trailing space

**Webhook signature rejected (403)**
- The webhook URL configured in Twilio must exactly match the host the request hits — `app.treemarkables.co.nz`. Run the diagnostic (Step 3a) — it compares Twilio's stored URL against the expected one.

**Customer not created / job not created**
- Check logs for "Insufficient data to create job"
- The customer's name must be mentioned in the call
- Either a service type or an address must be mentioned

**Caller showing as wrong number**
- If `ForwardedFrom` is empty, your carrier may not be passing it through
- Check Twilio logs for the `From` and `ForwardedFrom` fields
