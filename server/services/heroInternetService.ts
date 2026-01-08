import { storage } from '../storage';
import type { InsertCallRecord, CallRecord } from '@shared/schema';
import { z } from 'zod';

export function validateWebhookToken(authHeader: string | undefined): boolean {
  const expectedToken = process.env.HERO_WEBHOOK_SECRET;
  if (!expectedToken) {
    console.error('❌ HERO_WEBHOOK_SECRET not configured - webhook rejected for security');
    return false;
  }
  
  if (!authHeader) {
    console.error('❌ Missing Authorization header in webhook request');
    return false;
  }
  
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const isValid = token === expectedToken;
  
  if (!isValid) {
    console.error('❌ Invalid webhook token');
  }
  
  return isValid;
}

// Zod schema for webhook payload validation
// Hero Internet sends: caller, callee, call_start, call_end, duration, state, id
const heroWebhookSchema = z.object({
  // Hero Internet field names
  id: z.string().optional(),
  state: z.string().optional(), // ringing|answered|ended|missed|busy|invalid|rejected|blocked|noanswer|aianalysis
  caller: z.string().optional(),
  callee: z.string().optional(),
  call_start: z.string().optional(),
  call_end: z.string().optional(),
  duration: z.union([z.number(), z.string()]).optional(),
  recording_url: z.string().optional().nullable(),
  transcription: z.string().optional().nullable(),
  transcription_summary: z.string().optional().nullable(),
  sentiment: z.string().optional().nullable(),
  // Legacy field names (for compatibility)
  call_id: z.string().optional(),
  direction: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  summary: z.string().optional().nullable(),
  extension: z.string().optional(),
  status: z.string().optional(),
  started_at: z.string().optional(),
  ended_at: z.string().optional(),
}).passthrough();

interface HeroCredentials {
  phoneNumber: string;
  password: string;
  apiEndpoint: string;
}

async function getCredentials(): Promise<HeroCredentials> {
  const phoneNumber = process.env.HERO_PHONE_NUMBER;
  const password = process.env.HERO_PASSWORD;
  
  if (!phoneNumber || !password) {
    throw new Error('Hero Internet credentials not configured. Set HERO_PHONE_NUMBER and HERO_PASSWORD.');
  }
  
  return {
    phoneNumber,
    password,
    apiEndpoint: 'https://portal.hero.co.nz/api'
  };
}

export async function initiateCall(fromNumber: string, toNumber: string): Promise<{ success: boolean; message: string }> {
  try {
    const { phoneNumber, password, apiEndpoint } = await getCredentials();
    
    const url = `${apiEndpoint}/call.php?login=${encodeURIComponent(phoneNumber)}&password=${encodeURIComponent(password)}&aparty=${encodeURIComponent(fromNumber)}&bparty=${encodeURIComponent(toNumber)}&delay=1`;
    
    const response = await fetch(url);
    const result = await response.text();
    
    console.log(`📞 Hero Internet call initiated: ${fromNumber} → ${toNumber}, response: ${result}`);
    
    return {
      success: response.ok,
      message: result
    };
  } catch (error) {
    console.error('Error initiating Hero Internet call:', error);
    throw error;
  }
}

export interface HeroWebhookPayload {
  // Hero Internet field names
  id?: string;
  state?: string;
  caller?: string;
  callee?: string;
  call_start?: string;
  call_end?: string;
  duration?: number | string;
  recording_url?: string;
  transcription?: string;
  transcription_summary?: string;
  sentiment?: string;
  // Legacy field names (for compatibility)
  call_id?: string;
  direction?: string;
  from?: string;
  to?: string;
  summary?: string;
  extension?: string;
  status?: string;
  started_at?: string;
  ended_at?: string;
}

export async function processCallWebhook(payload: HeroWebhookPayload): Promise<CallRecord> {
  console.log('📞 Processing Hero Internet call webhook:', JSON.stringify(payload, null, 2));
  
  // Validate payload
  const validationResult = heroWebhookSchema.safeParse(payload);
  if (!validationResult.success) {
    console.error('📞 Invalid webhook payload:', validationResult.error.errors);
    throw new Error(`Invalid webhook payload: ${validationResult.error.errors.map(e => e.message).join(', ')}`);
  }
  
  const validatedPayload = validationResult.data;
  
  // Handle both Hero's field names (caller/callee) and legacy names (from/to)
  const fromNumber = normalizePhoneNumber(validatedPayload.caller || validatedPayload.from || '');
  const toNumber = normalizePhoneNumber(validatedPayload.callee || validatedPayload.to || '');
  
  // Determine direction based on which number matches our Hero line
  const heroLineNumber = process.env.HERO_PHONE_NUMBER || '';
  const normalizedHeroLine = normalizePhoneNumber(heroLineNumber);
  const direction = (toNumber === normalizedHeroLine || validatedPayload.direction === 'inbound') ? 'inbound' : 'outbound';
  
  console.log(`📞 Call: ${fromNumber} → ${toNumber}, Direction: ${direction}`);
  
  const customerMatch = await findCustomerByPhone(direction === 'inbound' ? fromNumber : toNumber);
  const leadMatch = customerMatch ? null : await findLeadByPhone(direction === 'inbound' ? fromNumber : toNumber);
  
  let jobId: string | undefined;
  if (customerMatch) {
    const recentJob = await findMostRecentJobForCustomer(customerMatch.id);
    jobId = recentJob?.id;
  }
  
  // Map Hero's state to our status field
  const stateToStatus: Record<string, string> = {
    'answered': 'completed',
    'ended': 'completed',
    'ringing': 'ringing',
    'missed': 'missed',
    'busy': 'busy',
    'noanswer': 'no-answer',
    'rejected': 'rejected',
    'blocked': 'blocked',
    'invalid': 'failed',
    'notavailable': 'failed',
    'aianalysis': 'processing'
  };
  const status = stateToStatus[validatedPayload.state || ''] || validatedPayload.status || 'completed';
  
  // Handle duration - can be number or string
  const duration = typeof validatedPayload.duration === 'string' 
    ? parseInt(validatedPayload.duration, 10) || undefined
    : validatedPayload.duration;
  
  // Handle timestamps - Hero sends call_start/call_end, legacy uses started_at/ended_at
  const startedAt = validatedPayload.call_start || validatedPayload.started_at;
  const endedAt = validatedPayload.call_end || validatedPayload.ended_at;
  
  const callRecord: InsertCallRecord = {
    direction,
    status,
    fromNumber,
    toNumber,
    duration,
    recordingUrl: validatedPayload.recording_url || undefined,
    transcription: validatedPayload.transcription || undefined,
    transcriptionSummary: validatedPayload.transcription_summary || validatedPayload.summary || undefined,
    sentiment: validatedPayload.sentiment || undefined,
    heroCallId: validatedPayload.id || validatedPayload.call_id,
    heroExtension: validatedPayload.extension,
    customerId: customerMatch?.id,
    leadId: leadMatch?.id,
    jobId,
    callerName: customerMatch?.name || leadMatch?.name,
    callerEmail: customerMatch?.email || leadMatch?.email,
    callStartedAt: startedAt ? new Date(startedAt) : undefined,
    callEndedAt: endedAt ? new Date(endedAt) : undefined,
  };
  
  const savedRecord = await storage.createCallRecord(callRecord);
  
  if (jobId && savedRecord.id) {
    await createJobDiaryEntryForCall(savedRecord, jobId);
  }
  
  console.log(`📞 Call record saved: ${savedRecord.id}, linked to customer: ${customerMatch?.id || 'none'}, job: ${jobId || 'none'}`);
  
  return savedRecord;
}

function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
  
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
    // Use the indexed phone lookup from storage
    const customer = await storage.findCustomerByPhone(phone);
    if (customer) {
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email || ''
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
    // Use indexed query - search leads by phone using database query
    const leads = await storage.getAllPipelineLeads();
    const normalized = normalizePhoneNumber(phone);
    const last9 = normalized.slice(-9);
    
    // Find matching lead - prefer exact match, fallback to last 9 digits
    for (const lead of leads) {
      if (!lead.phone) continue;
      const leadPhone = normalizePhoneNumber(lead.phone);
      if (leadPhone === normalized || leadPhone.endsWith(last9)) {
        return {
          id: lead.id,
          name: lead.name,
          email: lead.email || ''
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
      },
    });
    
    await storage.updateCallRecord(callRecord.id, {
      jobDiaryEntryId: diaryEntry.id,
    });
    
    console.log(`📓 Created job diary entry ${diaryEntry.id} for call ${callRecord.id}`);
  } catch (error) {
    console.error('Error creating job diary entry for call:', error);
  }
}

export async function testHeroConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const { phoneNumber } = await getCredentials();
    return {
      success: true,
      message: `Hero Internet configured with number: ${phoneNumber}`
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Hero Internet not configured'
    };
  }
}

export async function getCallRecords(filters?: {
  jobId?: string;
  customerId?: string;
  leadId?: string;
  direction?: string;
  limit?: number;
}): Promise<CallRecord[]> {
  return storage.getCallRecords(filters);
}

export async function getCallRecord(id: string): Promise<CallRecord | null> {
  return storage.getCallRecord(id);
}

export async function linkCallToJob(callId: string, jobId: string): Promise<CallRecord> {
  const updated = await storage.updateCallRecord(callId, { jobId });
  
  if (updated) {
    await createJobDiaryEntryForCall(updated, jobId);
  }
  
  return updated;
}

export async function linkCallToCustomer(callId: string, customerId: string): Promise<CallRecord> {
  return storage.updateCallRecord(callId, { customerId });
}
