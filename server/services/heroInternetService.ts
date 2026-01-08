import { storage } from '../storage';
import type { InsertCallRecord, CallRecord } from '@shared/schema';
import { z } from 'zod';

// Zod schema for webhook payload validation
const heroWebhookSchema = z.object({
  call_id: z.string().optional(),
  direction: z.enum(['inbound', 'outbound']).optional().default('inbound'),
  from: z.string().min(1, 'From number is required'),
  to: z.string().min(1, 'To number is required'),
  duration: z.number().optional(),
  recording_url: z.string().url().optional().nullable(),
  transcription: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional().nullable(),
  extension: z.string().optional(),
  status: z.string().optional().default('completed'),
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
  call_id?: string;
  direction?: string;
  from?: string;
  to?: string;
  duration?: number;
  recording_url?: string;
  transcription?: string;
  summary?: string;
  sentiment?: string;
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
  const direction = validatedPayload.direction === 'inbound' ? 'inbound' : 'outbound';
  const fromNumber = normalizePhoneNumber(validatedPayload.from || '');
  const toNumber = normalizePhoneNumber(validatedPayload.to || '');
  
  const customerMatch = await findCustomerByPhone(direction === 'inbound' ? fromNumber : toNumber);
  const leadMatch = customerMatch ? null : await findLeadByPhone(direction === 'inbound' ? fromNumber : toNumber);
  
  let jobId: string | undefined;
  if (customerMatch) {
    const recentJob = await findMostRecentJobForCustomer(customerMatch.id);
    jobId = recentJob?.id;
  }
  
  const callRecord: InsertCallRecord = {
    direction,
    status: validatedPayload.status || 'completed',
    fromNumber: validatedPayload.from,
    toNumber: validatedPayload.to,
    duration: validatedPayload.duration,
    recordingUrl: validatedPayload.recording_url || undefined,
    transcription: validatedPayload.transcription || undefined,
    transcriptionSummary: validatedPayload.summary || undefined,
    sentiment: validatedPayload.sentiment || undefined,
    heroCallId: validatedPayload.call_id,
    heroExtension: validatedPayload.extension,
    customerId: customerMatch?.id,
    leadId: leadMatch?.id,
    jobId,
    callerName: customerMatch?.name || leadMatch?.name,
    callerEmail: customerMatch?.email || leadMatch?.email,
    callStartedAt: validatedPayload.started_at ? new Date(validatedPayload.started_at) : undefined,
    callEndedAt: validatedPayload.ended_at ? new Date(validatedPayload.ended_at) : undefined,
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
