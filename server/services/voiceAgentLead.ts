// ============================================================================
// AI Voice Agent — post-call lead pipeline.
//
// Invoked by VoiceAgentSession teardown (voiceAgent.ts) with whatever the
// Realtime session captured: the per-turn transcript and the structured fields
// from the capture_lead tool. Even a partial conversation becomes a lead —
// Jules would rather see "caller hung up halfway" with a phone number than
// nothing.
//
// Mirrors the proven /api/contact + twilio-voice patterns: find-or-create
// customer by phone → reuse open lead job or create one → diary entry with the
// transcript → new-lead notification.
// ============================================================================
import OpenAI from "openai";
import { storage } from "../storage";
import { runWithBusiness } from "../tenancy/tenantStore";
import * as notificationHelper from "./notificationHelper";

export interface TranscriptTurn {
  role: "caller" | "agent";
  text: string;
}

export interface CapturedLead {
  callerName?: string;
  address?: string;
  jobDescription?: string;
  treeDetails?: string;
  access?: string;
  urgency?: string;
  preferredTiming?: string;
  notes?: string;
  confirmedPhone?: string;
  conversationComplete?: boolean;
}

export interface VoiceAgentCallResult {
  callSid: string;
  callerPhone: string;
  transcriptTurns: TranscriptTurn[];
  capturedLead: CapturedLead | null;
  durationSec: number;
  // Inflow seam: when provided, the whole pipeline runs in that tenant's
  // context. Absent (Treemarkables today) → DB column defaults, identical to
  // the existing Twilio webhooks.
  businessId?: string;
}

function formatTranscript(turns: TranscriptTurn[]): string {
  return turns.map((t) => `${t.role === "caller" ? "Caller" : "Assistant"}: ${t.text}`).join("\n");
}

// Fallback when the model never called capture_lead (e.g. the caller hung up
// early): extract the same fields from the raw transcript.
async function extractLeadFromTranscript(transcript: string, callerPhone: string): Promise<CapturedLead> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const extraction = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are a data extraction assistant for a New Zealand trades business. The transcript below is a phone conversation between the business's AI assistant and a caller requesting a quote.

Extract as JSON:
- callerName: the caller's name if mentioned
- address: the service address if mentioned
- jobDescription: what work they need done
- treeDetails: job specifics (number of trees, size, species, scope)
- access: site access notes
- urgency: one of [emergency, urgent, normal, flexible]
- preferredTiming: preferred timing if mentioned
- notes: anything else worth passing on
- confirmedPhone: a contact number if the caller gave one different from "${callerPhone}"

Return ONLY valid JSON. If a field isn't mentioned, use null.`,
      },
      { role: "user", content: transcript },
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(extraction.choices[0].message.content || "{}");
}

export async function processVoiceAgentCall(result: VoiceAgentCallResult): Promise<void> {
  const run = () => processInContext(result);
  if (result.businessId) {
    await runWithBusiness(result.businessId, run);
  } else {
    await run();
  }
}

async function processInContext(result: VoiceAgentCallResult): Promise<void> {
  const { callSid, callerPhone, transcriptTurns, durationSec } = result;
  const transcript = formatTranscript(transcriptTurns);
  console.log(`🎙️ Voice agent pipeline: processing call ${callSid} (${transcriptTurns.length} turns, ${durationSec}s)`);

  let lead: CapturedLead = result.capturedLead || {};
  const hasCapturedFields = Boolean(
    lead.callerName || lead.address || lead.jobDescription || lead.notes,
  );
  if (!hasCapturedFields && transcript.trim()) {
    try {
      lead = { ...(await extractLeadFromTranscript(transcript, callerPhone)), ...lead };
      console.log(`🎙️ Voice agent pipeline: fields extracted from transcript fallback`);
    } catch (extractErr) {
      console.error("🎙️ Voice agent pipeline: transcript extraction failed (continuing):", extractErr);
    }
  }

  const callerName = (lead.callerName || "").trim();
  const jobDescription = (lead.jobDescription || "").trim();
  const summaryParts = [
    jobDescription,
    lead.treeDetails && `Details: ${lead.treeDetails}`,
    lead.access && `Access: ${lead.access}`,
    lead.urgency && `Urgency: ${lead.urgency}`,
    lead.preferredTiming && `Timing: ${lead.preferredTiming}`,
    lead.notes && `Notes: ${lead.notes}`,
  ].filter(Boolean) as string[];
  const summary = summaryParts.join("\n") || "AI phone assistant call — see transcript.";

  // 1. Call record with the full transcript (no recording — the Realtime
  // transcript is the source of truth for the AI leg).
  let callRecordId: string | undefined;
  try {
    const call = await storage.createCall({
      phoneNumber: callerPhone,
      direction: "inbound",
      status: "answered",
      duration: durationSec,
      transcriptText: transcript,
      summary,
      intent: "quote_request",
      twilioCallSid: callSid,
    });
    callRecordId = call.id;
    console.log(`🎙️ Voice agent pipeline: call record ${call.id} created`);
  } catch (callErr) {
    console.error("🎙️ Voice agent pipeline: call record creation failed (continuing):", callErr);
  }

  // 2. Find-or-create the customer by phone (storage normalizes internally).
  let customer: Awaited<ReturnType<typeof storage.findCustomerByPhone>> = undefined;
  const phoneForLookup = (lead.confirmedPhone || callerPhone || "").trim();
  try {
    if (phoneForLookup) {
      customer = await storage.findCustomerByPhone(phoneForLookup);
    }
    if (!customer) {
      customer = await storage.createCustomer({
        name: callerName || (phoneForLookup ? `Caller ${phoneForLookup}` : "Unknown caller"),
        phone: phoneForLookup,
        address: (lead.address || "").trim(),
        source: "phone_call",
        notes: "",
      });
      console.log(`🎙️ Voice agent pipeline: customer created ${customer.id}`);
    }
    if (customer && callRecordId) {
      await storage.updateCall(callRecordId, { customerId: customer.id });
    }
  } catch (customerErr) {
    console.error("🎙️ Voice agent pipeline: customer step failed:", customerErr);
  }
  if (!customer) return;

  // 3. Reuse the customer's open lead-status job, or create a new one — same
  // dedupe rule as the website contact form.
  let job: any;
  let reusedExistingJob = false;
  try {
    const existingJobs = await storage.getJobsByCustomer(customer.id);
    const existingLeadJob = existingJobs.find((j) => j.status === "lead");
    if (existingLeadJob) {
      job = existingLeadJob;
      reusedExistingJob = true;
      console.log(`🎙️ Voice agent pipeline: reusing open lead job #${existingLeadJob.jobNumber}`);
    } else {
      const isMobileNumber = /^(\+?64)?0?2[0-9]/.test(phoneForLookup);
      const jobNumber = await storage.getNextJobNumber();
      job = await storage.createJob({
        customerId: customer.id,
        jobNumber,
        title: `Lead from ${callerName || customer.name} (AI phone assistant)`,
        description: summary,
        address: (lead.address || "").trim() || "Address not specified",
        status: "lead",
        priority: lead.urgency === "emergency" || lead.urgency === "urgent" ? ("high" as const) : ("medium" as const),
        leadSource: "voice_agent",
        totalAmount: "0.00",
        metricsEligible: true,
        metricsStartDate: new Date(),
        jobContactPhone: isMobileNumber ? "" : phoneForLookup,
        jobContactMobile: isMobileNumber ? phoneForLookup : "",
      });
      console.log(`🎙️ Voice agent pipeline: lead job #${jobNumber} created (${job.id})`);
    }
  } catch (jobErr) {
    console.error("🎙️ Voice agent pipeline: job step failed:", jobErr);
  }
  if (!job) return;

  // 4. Diary entry with the structured fields + full transcript.
  try {
    await storage.createJobDiaryEntry({
      jobId: job.id,
      entryType: "call",
      title: `📞 AI assistant call from ${callerName || customer.name}`,
      description: `${summary}\n\nPhone: ${phoneForLookup || "unknown"}\nDuration: ${durationSec}s\n\nTranscript:\n${transcript}`,
      authorName: "AI Phone Assistant",
      authorRole: "system",
      tags: ["call", "voice-agent"],
      metadata: {
        transcription: transcript,
        callSid,
        capturedLead: lead,
      },
    });
    await storage.updateJob(job.id, { lastActivityAt: new Date() });
  } catch (diaryErr) {
    console.error("🎙️ Voice agent pipeline: diary entry failed (continuing):", diaryErr);
  }

  // 5. Tell Jules.
  try {
    await notificationHelper.createNewLeadNotification({
      jobId: job.id,
      jobNumber: job.jobNumber,
      customerId: customer.id,
      customerName: callerName || customer.name,
      customerPhone: phoneForLookup,
      sourceLabel: reusedExistingJob ? "AI phone assistant (repeat)" : "AI phone assistant",
      messagePreview: jobDescription || summary,
    });
    console.log(`🎙️ Voice agent pipeline: lead notification sent for job #${job.jobNumber}`);
  } catch (notifyErr) {
    console.error("🎙️ Voice agent pipeline: notification failed:", notifyErr);
  }
}
