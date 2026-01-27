import { storage } from '../storage';
import type { InsertCallRecord, CallRecord } from '@shared/schema';
import { z } from 'zod';
import OpenAI from 'openai';

// Telnyx webhook event schema for call.recording.saved
const telnyxRecordingWebhookSchema = z.object({
  data: z.object({
    event_type: z.string(),
    id: z.string(),
    occurred_at: z.string(),
    payload: z.object({
      call_control_id: z.string().optional(),
      call_leg_id: z.string().optional(),
      call_session_id: z.string().optional(),
      connection_id: z.string().optional(),
      recording_id: z.string().optional(),
      channels: z.string().optional(), // 'single' or 'dual'
      format: z.string().optional(), // 'wav' or 'mp3'
      recording_started_at: z.string().optional(),
      recording_ended_at: z.string().optional(),
      recording_urls: z.object({
        wav: z.string().optional(),
        mp3: z.string().optional(),
      }).optional(),
      public_recording_urls: z.object({
        wav: z.string().optional(),
        mp3: z.string().optional(),
      }).optional(),
      client_state: z.string().nullable().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      direction: z.string().optional(), // 'inbound' or 'outbound'
      duration_millis: z.number().optional(),
    }).passthrough(),
  }).passthrough(),
  meta: z.object({
    attempt: z.number().optional(),
    delivered_to: z.string().optional(),
  }).optional(),
}).passthrough();

// Telnyx webhook for call events (call.initiated, call.answered, call.hangup)
const telnyxCallEventSchema = z.object({
  data: z.object({
    event_type: z.string(),
    id: z.string(),
    occurred_at: z.string(),
    payload: z.object({
      call_control_id: z.string().optional(),
      call_leg_id: z.string().optional(),
      call_session_id: z.string().optional(),
      connection_id: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      direction: z.string().optional(),
      state: z.string().optional(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      hangup_cause: z.string().optional(),
      hangup_source: z.string().optional(),
      sip_hangup_cause: z.string().optional(),
    }).passthrough(),
  }).passthrough(),
  meta: z.object({
    attempt: z.number().optional(),
    delivered_to: z.string().optional(),
  }).optional(),
}).passthrough();

interface TelnyxCredentials {
  apiKey: string;
  phoneNumber: string;
}

function getCredentials(): TelnyxCredentials {
  const apiKey = process.env.TELNYX_API_KEY;
  const phoneNumber = process.env.TELNYX_PHONE_NUMBER;
  
  if (!apiKey) {
    throw new Error('TELNYX_API_KEY not configured');
  }
  
  return {
    apiKey,
    phoneNumber: phoneNumber || '',
  };
}

export async function testTelnyxConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { apiKey, phoneNumber } = getCredentials();
    
    // Test API key by making a simple API call
    const response = await fetch('https://api.telnyx.com/v2/phone_numbers', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      return {
        success: true,
        message: `Telnyx configured${phoneNumber ? ` with number: ${phoneNumber}` : ''}`,
      };
    } else {
      return {
        success: false,
        message: `Telnyx API error: ${response.status}`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Telnyx not configured',
    };
  }
}

function normalizePhoneNumber(phone: string): string {
  // Remove formatting characters
  let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Convert international format to local NZ format
  if (normalized.startsWith('+64')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('64') && normalized.length > 9) {
    normalized = '0' + normalized.slice(2);
  }
  
  return normalized;
}

async function findCustomerByPhone(phone: string): Promise<{ id: string; name: string; email: string } | null> {
  if (!phone) return null;
  
  try {
    const customer = await storage.findCustomerByPhone(phone);
    if (customer) {
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email || '',
      };
    }
  } catch (error) {
    console.error('Error finding customer by phone:', error);
  }
  
  return null;
}

async function findLeadByPhone(phone: string): Promise<{ id: string; name: string; email: string } | null> {
  if (!phone) return null;
  
  try {
    const leads = await storage.getAllPipelineLeads();
    const normalized = normalizePhoneNumber(phone);
    const last9 = normalized.slice(-9);
    
    for (const lead of leads) {
      if (!lead.phone) continue;
      const leadPhone = normalizePhoneNumber(lead.phone);
      if (leadPhone === normalized || leadPhone.endsWith(last9)) {
        return {
          id: lead.id,
          name: lead.name,
          email: lead.email || '',
        };
      }
    }
  } catch (error) {
    console.error('Error finding lead by phone:', error);
  }
  
  return null;
}

async function findMostRecentJobForCustomer(customerId: string): Promise<{ id: string } | null> {
  try {
    const jobs = await storage.getJobsByCustomer(customerId);
    if (jobs.length > 0) {
      const sortedJobs = jobs.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      return { id: sortedJobs[0].id };
    }
  } catch (error) {
    console.error('Error finding recent job for customer:', error);
  }
  
  return null;
}

async function transcribeRecording(recordingUrl: string): Promise<{ transcription: string; summary: string; sentiment: string } | null> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.log('📞 OpenAI API key not configured, skipping transcription');
      return null;
    }
    
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    // Download the recording
    console.log('📞 Downloading recording for transcription:', recordingUrl);
    const recordingResponse = await fetch(recordingUrl);
    if (!recordingResponse.ok) {
      console.error('📞 Failed to download recording:', recordingResponse.status);
      return null;
    }
    
    const audioBuffer = await recordingResponse.arrayBuffer();
    const audioFile = new File([audioBuffer], 'recording.mp3', { type: 'audio/mpeg' });
    
    // Transcribe with Whisper
    console.log('📞 Transcribing with OpenAI Whisper...');
    const transcriptionResult = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
    });
    
    const transcription = transcriptionResult.text;
    console.log('📞 Transcription complete, length:', transcription.length);
    
    if (!transcription || transcription.length < 10) {
      return { transcription: transcription || '', summary: '', sentiment: 'neutral' };
    }
    
    // Generate summary and sentiment with GPT
    console.log('📞 Generating summary and sentiment analysis...');
    const analysisResult = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an assistant that analyzes phone call transcripts for a tree removal service business.
Provide a brief summary (2-3 sentences) and determine the sentiment (positive, neutral, or negative).
Respond in JSON format: {"summary": "...", "sentiment": "positive|neutral|negative"}`
        },
        {
          role: 'user',
          content: `Analyze this call transcript:\n\n${transcription}`
        }
      ],
      response_format: { type: 'json_object' },
    });
    
    const analysisText = analysisResult.choices[0]?.message?.content || '{}';
    const analysis = JSON.parse(analysisText);
    
    return {
      transcription,
      summary: analysis.summary || '',
      sentiment: analysis.sentiment || 'neutral',
    };
  } catch (error) {
    console.error('📞 Error transcribing recording:', error);
    return null;
  }
}

async function createJobDiaryEntryForCall(callRecord: CallRecord, jobId: string): Promise<void> {
  try {
    const durationMinutes = callRecord.duration ? Math.ceil(callRecord.duration / 60) : 0;
    const directionLabel = callRecord.direction === 'inbound' ? 'Incoming' : 'Outgoing';
    
    const diaryEntry = await storage.createJobDiaryEntry({
      jobId,
      entryType: 'call',
      title: `${directionLabel} Call - ${callRecord.callerName || callRecord.fromNumber}`,
      description: callRecord.transcriptionSummary || `${directionLabel} phone call (${durationMinutes} min)`,
      authorName: 'System',
      authorRole: 'system',
      content: callRecord.transcription || '',
      metadata: {
        callRecordId: callRecord.id,
        recordingUrl: callRecord.recordingUrl,
        transcription: callRecord.transcription,
        duration: callRecord.duration,
        sentiment: callRecord.sentiment,
        fromNumber: callRecord.fromNumber,
        toNumber: callRecord.toNumber,
        provider: 'telnyx',
      },
    });
    
    await storage.updateCallRecord(callRecord.id, {
      jobDiaryEntryId: diaryEntry.id,
    });
    
    console.log(`📓 Created job diary entry ${diaryEntry.id} for Telnyx call ${callRecord.id}`);
  } catch (error) {
    console.error('Error creating job diary entry for call:', error);
  }
}

export interface TelnyxWebhookPayload {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: Record<string, any>;
  };
  meta?: {
    attempt?: number;
    delivered_to?: string;
  };
}

// Answer and forward an incoming call
async function answerAndForwardCall(callControlId: string, forwardToNumber: string): Promise<void> {
  const { apiKey } = getCredentials();
  
  try {
    // First, answer the call
    console.log(`📞 Answering call ${callControlId}...`);
    const answerResponse = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/answer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    if (!answerResponse.ok) {
      console.error('📞 Failed to answer call:', await answerResponse.text());
      return;
    }
    
    console.log(`📞 Call answered, now transferring to ${forwardToNumber}...`);
    
    // Then transfer to the forwarding number
    const transferResponse = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/transfer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: forwardToNumber,
      }),
    });
    
    if (!transferResponse.ok) {
      console.error('📞 Failed to transfer call:', await transferResponse.text());
    } else {
      console.log(`📞 Call transferred successfully to ${forwardToNumber}`);
    }
  } catch (error) {
    console.error('📞 Error handling incoming call:', error);
  }
}

export async function processTelnyxWebhook(payload: TelnyxWebhookPayload): Promise<CallRecord | null> {
  const eventType = payload.data?.event_type;
  console.log(`📞 Processing Telnyx webhook event: ${eventType}`);
  
  // Handle incoming call - answer and forward
  if (eventType === 'call.initiated') {
    const direction = payload.data?.payload?.direction;
    const callControlId = payload.data?.payload?.call_control_id;
    
    if (direction === 'incoming' && callControlId) {
      // Forward to the configured number (use TELNYX_FORWARD_NUMBER or fallback)
      const forwardNumber = process.env.TELNYX_FORWARD_NUMBER || process.env.HERO_PHONE_NUMBER;
      
      if (forwardNumber) {
        console.log(`📞 Incoming call detected, forwarding to ${forwardNumber}`);
        await answerAndForwardCall(callControlId, forwardNumber);
      } else {
        console.log('📞 No forward number configured, call will not be answered');
      }
    }
    return null;
  }
  
  // Only process recording.saved events for recordings
  if (eventType !== 'call.recording.saved') {
    console.log(`📞 Ignoring Telnyx event type: ${eventType}`);
    return null;
  }
  
  // Validate payload
  const validationResult = telnyxRecordingWebhookSchema.safeParse(payload);
  if (!validationResult.success) {
    console.error('📞 Invalid Telnyx webhook payload:', validationResult.error.errors);
    throw new Error(`Invalid webhook payload: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
  }
  
  const data = validationResult.data;
  const eventPayload = data.data.payload;
  
  // Extract recording URL (prefer mp3 for smaller size)
  const recordingUrls = eventPayload.recording_urls || eventPayload.public_recording_urls || {};
  const recordingUrl = recordingUrls.mp3 || recordingUrls.wav;
  
  if (!recordingUrl) {
    console.log('📞 No recording URL in webhook, skipping');
    return null;
  }
  
  // Extract phone numbers
  const fromNumber = normalizePhoneNumber(eventPayload.from || '');
  const toNumber = normalizePhoneNumber(eventPayload.to || '');
  
  // Determine direction
  const telnyxNumber = process.env.TELNYX_PHONE_NUMBER || '';
  const normalizedTelnyxNumber = normalizePhoneNumber(telnyxNumber);
  let direction: 'inbound' | 'outbound';
  
  if (eventPayload.direction === 'inbound' || toNumber === normalizedTelnyxNumber) {
    direction = 'inbound';
  } else {
    direction = 'outbound';
  }
  
  console.log(`📞 Telnyx call: ${fromNumber} → ${toNumber}, Direction: ${direction}`);
  
  // Find matching customer/lead
  const phoneToMatch = direction === 'inbound' ? fromNumber : toNumber;
  const customerMatch = await findCustomerByPhone(phoneToMatch);
  const leadMatch = customerMatch ? null : await findLeadByPhone(phoneToMatch);
  
  let jobId: string | undefined;
  if (customerMatch) {
    const recentJob = await findMostRecentJobForCustomer(customerMatch.id);
    jobId = recentJob?.id;
  }
  
  // Calculate duration
  let duration: number | undefined;
  if (eventPayload.duration_millis) {
    duration = Math.round(eventPayload.duration_millis / 1000);
  } else if (eventPayload.recording_started_at && eventPayload.recording_ended_at) {
    const start = new Date(eventPayload.recording_started_at).getTime();
    const end = new Date(eventPayload.recording_ended_at).getTime();
    duration = Math.round((end - start) / 1000);
  }
  
  // Transcribe the recording
  let transcription: string | undefined;
  let transcriptionSummary: string | undefined;
  let sentiment: string | undefined;
  
  const transcriptionResult = await transcribeRecording(recordingUrl);
  if (transcriptionResult) {
    transcription = transcriptionResult.transcription;
    transcriptionSummary = transcriptionResult.summary;
    sentiment = transcriptionResult.sentiment;
  }
  
  // Create call record
  const callRecord: InsertCallRecord = {
    provider: 'telnyx',
    direction,
    status: 'completed',
    fromNumber,
    toNumber,
    duration,
    recordingUrl,
    transcription,
    transcriptionSummary,
    sentiment,
    telnyxCallId: eventPayload.call_control_id || eventPayload.call_session_id,
    telnyxRecordingId: eventPayload.recording_id,
    customerId: customerMatch?.id,
    leadId: leadMatch?.id,
    jobId,
    callerName: customerMatch?.name || leadMatch?.name,
    callerEmail: customerMatch?.email || leadMatch?.email,
    callStartedAt: eventPayload.recording_started_at ? new Date(eventPayload.recording_started_at) : undefined,
    callEndedAt: eventPayload.recording_ended_at ? new Date(eventPayload.recording_ended_at) : undefined,
  };
  
  const savedRecord = await storage.createCallRecord(callRecord);
  
  // Create job diary entry if linked to a job
  if (jobId && savedRecord.id) {
    await createJobDiaryEntryForCall(savedRecord, jobId);
  }
  
  console.log(`📞 Telnyx call record saved: ${savedRecord.id}, customer: ${customerMatch?.id || 'none'}, job: ${jobId || 'none'}`);
  
  return savedRecord;
}
