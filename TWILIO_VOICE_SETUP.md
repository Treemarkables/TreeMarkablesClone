# Twilio Voice Call Recording & Auto Job Creation Setup

## Overview
This system automatically:
1. Records all incoming phone calls to your Twilio number
2. Transcribes calls using OpenAI Whisper
3. Extracts job details using GPT-5
4. Creates customers and jobs automatically
5. **NEW**: Auto-generates quote drafts when pricing is discussed

## Prerequisites
- Active Twilio account with phone number
- Twilio credentials configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
- OpenAI API key configured (OPENAI_API_KEY)

## Twilio Phone Number Configuration

### Step 1: Configure Voice Settings
1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers → Manage → Active Numbers**
3. Click on your Twilio phone number

### Step 2: Enable Call Recording
Under **Voice & Fax** section:

**A CALL COMES IN:**
- Set to: `TwiML Bin` (or `Webhook`)
- Create a new TwiML Bin with this content:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you for calling Treemarkables. Please leave your details and we'll get back to you shortly.</Say>
    <Record 
        maxLength="300" 
        transcribe="false" 
        recordingStatusCallback="https://YOUR_REPL_URL.replit.app/api/webhooks/twilio-voice"
        recordingStatusCallbackEvent="completed"
    />
</Response>
```

**Replace `YOUR_REPL_URL` with your actual Replit app URL.**

### Step 3: Configure Status Callback (Alternative Method)

If you prefer to answer calls differently, you can also set:

**A CALL COMES IN:**
- Set to: `Webhook`
- URL: `https://YOUR_REPL_URL.replit.app/api/webhooks/twilio-voice`
- Method: `HTTP POST`

**STATUS CALLBACK URL:**
- URL: `https://YOUR_REPL_URL.replit.app/api/webhooks/twilio-voice`
- Method: `HTTP POST`

### Step 4: Enable Recording on All Calls

Under **Voice Configuration**:
- Recording: `Record from answer`
- Recording Channels: `Dual channel`
- Status Callback: `https://YOUR_REPL_URL.replit.app/api/webhooks/twilio-voice`

Click **Save** at the bottom.

## How It Works

### Call Flow
1. **Customer calls** → Twilio phone number
2. **Call is answered** → Custom greeting plays
3. **Recording starts** → Customer leaves message
4. **Call ends** → Twilio sends webhook to `/api/webhooks/twilio-voice`
5. **System processes**:
   - Downloads MP3 recording
   - Transcribes with Whisper
   - Extracts job data with GPT-5
   - Creates/finds customer by phone
   - Creates job automatically
   - **Auto-generates quote if pricing discussed**
   - Logs everything to job diary

### Data Extraction
GPT-4 extracts:
- **Customer Name**: From conversation
- **Phone Number**: From caller ID
- **Service Type**: tree-removal, pruning, stump-grinding, etc.
- **Address**: Job location
- **Urgency**: emergency, urgent, normal, low
- **Estimated Price**: If quoted in call
- **Notes**: Key job details

### Auto Job Creation Rules
A job is auto-created if:
- Customer exists or can be created (needs name from call)
- AND (service type OR address is mentioned)

Otherwise, the call is recorded and transcribed but no job is created.

### Auto Quote Generation (NEW)
When a job is auto-created from a call, the system analyzes the transcript for pricing discussions:

**Quote is auto-generated if ANY of these are detected:**
- Estimated price mentioned in call (e.g., "$2000", "two thousand dollars")
- Keywords: "price", "cost", "quote" in transcript

**Quote Extraction Process:**
1. GPT-5 analyzes transcript for pricing components
2. Extracts detailed quote information:
   - Job description
   - Tree types mentioned
   - Estimated price (in NZD)
   - Line items (if multiple services discussed)
   - Additional notes
3. Creates proposal/quote with status "draft"
4. Logs quote creation to job diary with extracted details

**Example:**
Call transcript: *"I need two oak trees removed and stumps ground. Tree removal is $1500, stump grinding $500."*

Generated quote:
- Section 1: "Tree removal" - 2 × $750 = $1,500
- Section 2: "Stump grinding" - 1 × $500 = $500
- Total: $2,000

The quote is saved as a draft and appears in the job's proposals list, ready for review and sending to the customer.

## Testing

### 1. Test Call (with Quote Generation)
Call your Twilio number and say:
> "Hi, my name is John Smith. I need a large oak tree removed from 123 Main Street in Auckland. It's urgent, probably about $2000."

### 2. Check Logs
Watch server logs for:
```
📞 Twilio voice webhook - CallSid: CA..., Status: completed
🎙️ Call CA... completed with recording: https://...
✅ Recording downloaded: /uploads/recordings/twilio-CA...mp3
📝 Call record created: <call-id>
✅ Call transcribed: Hi, my name is John Smith...
🤖 Extracted job data: { customerName: 'John Smith', ... }
✅ New customer created: John Smith
✅ Job #1234 auto-created from call
💰 Pricing discussion detected - generating quote draft...
📋 Quote data extracted: { estimatedPrice: 2000, ... }
✅ Quote auto-generated for job #1234
```

### 3. Verify in App
1. Check **Dispatch Board** for new job
2. View **Job Diary** for call transcript and quote creation log
3. Check **Proposals** tab on job for auto-generated quote draft
4. Check **Customer** was created with phone number

## Webhook URL
Your webhook endpoint is:
```
https://YOUR_REPL_URL.replit.app/api/webhooks/twilio-voice
```

This endpoint:
- Accepts POST requests from Twilio
- Expects form data with: `CallSid`, `CallStatus`, `From`, `To`, `RecordingUrl`, `RecordingDuration`
- Returns TwiML response to Twilio

## Costs (Approximate)
- **Phone Number**: $1/month
- **Incoming Calls**: $0.0085/minute
- **Recording**: $0.0025/minute
- **Whisper Transcription**: $0.006/minute
- **GPT-5 Job Extraction**: ~$0.015/call
- **GPT-5 Quote Extraction**: ~$0.015/call (when pricing discussed)

**Example**: 100 calls × 3 min avg = ~$3.30 + Whisper/GPT costs
**With Quote Generation**: Add ~$0.015 per call with pricing discussion

## Troubleshooting

### No webhook received
- Check Twilio phone number configuration
- Verify webhook URL is correct and publicly accessible
- Check Twilio debugger: https://console.twilio.com/debugger

### Recording not downloaded
- Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set
- Check server has write permissions to /uploads/recordings/

### Job not created
- Check logs for "Insufficient data to create job"
- Ensure customer name is mentioned in call
- Verify service type or address is mentioned

### Transcription fails
- Verify OPENAI_API_KEY is set
- Check recording file exists and is readable
- Ensure OpenAI API quota is available

## Security Notes
- **Webhook signature validation**: All requests validated using X-Twilio-Signature header
- **Request authentication**: Only requests from Twilio with valid signatures are processed
- **Recordings storage**: Stored locally in /uploads/recordings/ with unique filenames
- **Transcripts storage**: Stored in database with job diary linkage
- **Phone normalization**: All numbers normalized to NZ format (+64)
- **HTTPS required**: Webhook must be accessed over HTTPS in production
