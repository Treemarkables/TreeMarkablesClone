// ============================================================================
// AI Voice Agent — Twilio Media Streams ↔ OpenAI Realtime API bridge.
//
// When a caller presses 1 on the inbound IVR menu (see /api/webhooks/twilio-ivr
// in routes.ts), Twilio opens a bidirectional WebSocket to
// /api/voice-agent/stream carrying the call audio as base64 G.711 μ-law @ 8kHz.
// Each connection gets a VoiceAgentSession that opens a matching OpenAI
// Realtime WebSocket configured for g711_ulaw in AND out, so audio is piped in
// both directions with zero transcoding.
//
// The agent runs a quote-triage conversation (it never gives prices), captures
// structured lead data via the `capture_lead` tool, and on teardown hands the
// transcript + captured fields to processVoiceAgentCall() which creates the
// customer / lead job / diary entry / notification.
//
// Failure design: if the OpenAI socket won't connect or dies mid-call, we close
// the Twilio socket WITHOUT hanging up the call — the TwiML after </Connect>
// then redirects the caller to the normal dial-Jules flow (?mode=dial). On a
// successful conversation we hang up via the Twilio REST API, so that redirect
// never fires.
// ============================================================================
import type http from "http";
import { createHmac, timingSafeEqual } from "crypto";
import WebSocket, { WebSocketServer } from "ws";
import { storage } from "../storage";
import { getBusinessIdentity } from "../businessIdentity";
import { getTradePreset } from "../trades/presets";
import { getTwilioClient } from "./twilioClient";
import { processVoiceAgentCall, type CapturedLead, type TranscriptTurn } from "./voiceAgentLead";
import type { BusinessSettings } from "@shared/schema";

const STREAM_TOKEN_TTL_MS = 5 * 60 * 1000;

function tokenSecret(): string {
  // The Twilio auth token doubles as the HMAC secret — it's already required
  // for webhook signature validation, so no new env var.
  return process.env.TWILIO_AUTH_TOKEN || process.env.SESSION_SECRET || "";
}

function signStreamToken(callSid: string, expiry: number): string {
  return createHmac("sha256", tokenSecret()).update(`${callSid}.${expiry}`).digest("hex");
}

// Minted into the <Stream url> by the IVR webhook. WS upgrades can't go
// through Twilio signature validation, so the URL carries this instead.
export function mintStreamToken(callSid: string): string {
  const expiry = Date.now() + STREAM_TOKEN_TTL_MS;
  return `${expiry}.${signStreamToken(callSid, expiry)}`;
}

// Full verification needs the CallSid, which Twilio only sends in the stream's
// `start` message — so the upgrade check is structural (expiry not passed) and
// the binding check happens on `start`.
export function verifyStreamTokenStructure(token: string): boolean {
  const [expiryStr, sig] = token.split(".");
  const expiry = Number(expiryStr);
  return Boolean(sig && Number.isFinite(expiry) && expiry > Date.now() && tokenSecret());
}

export function verifyStreamToken(token: string, callSid: string): boolean {
  const [expiryStr, sig] = token.split(".");
  const expiry = Number(expiryStr);
  if (!sig || !Number.isFinite(expiry) || expiry < Date.now() || !tokenSecret()) return false;
  const expected = signStreamToken(callSid, expiry);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Agent prompt + tool
// ----------------------------------------------------------------------------

function buildAgentInstructions(settings: BusinessSettings | null, callerPhone: string): string {
  const identity = getBusinessIdentity(settings);
  const preset = getTradePreset(settings?.industry);
  const extra = (settings?.voiceAgentExtraInstructions || "").trim();
  return [
    `You are the friendly phone assistant for ${identity.name}, a New Zealand ${identity.discipline} business. You are speaking with a caller who pressed 1 for a quick quote. Speak naturally and concisely — this is a phone call, so keep each reply to one or two short sentences. Use New Zealand English.`,
    ``,
    `Your job is to gather the details ${identity.ownerName} needs to prepare a quote. Work through these one at a time (don't interrogate — keep it conversational):`,
    `1. The caller's name.`,
    `2. The address of the property where the work is needed (street, suburb, town).`,
    `3. What work they need done. Relevant terms for this trade: ${preset.aiVocabulary}.`,
    `4. Details of the job — for example how many trees, roughly how big, species if known.`,
    `5. Access — can a truck or machinery get close, or is it tight access?`,
    `6. How urgent it is (emergency, this week, whenever suits).`,
    `7. Preferred timing for the work or for a site visit.`,
    `8. Anything else they'd like ${identity.ownerName} to know.`,
    ``,
    `Rules:`,
    `- NEVER give a price, estimate, price range, or guess at cost — not even a rough idea. If asked, say ${identity.ownerName} will come back to them with a quote shortly.`,
    `- The caller's phone number is ${callerPhone || "unknown"}. Confirm it's the best number to reach them on — do not ask them to read out their number unless they say it isn't.`,
    `- Call the capture_lead tool whenever you have new or corrected details, and set conversationComplete to true once everything is covered.`,
    `- Close the call by telling them ${identity.ownerName} will come back to them with a quote shortly, and thank them for calling.`,
    `- If the caller asks for something you can't help with (existing job queries, invoices, complaints), take a message in the notes and let them know ${identity.ownerName} will follow up.`,
    extra ? `\nAdditional instructions from the business owner:\n${extra}` : ``,
  ].join("\n");
}

const CAPTURE_LEAD_TOOL = {
  type: "function" as const,
  name: "capture_lead",
  description:
    "Record the quote-request details gathered so far. Call this whenever you learn new or corrected details, and again with conversationComplete=true when the conversation has covered everything and you are about to say goodbye.",
  parameters: {
    type: "object",
    properties: {
      callerName: { type: "string", description: "The caller's name" },
      address: { type: "string", description: "Service address (street, suburb, town)" },
      jobDescription: { type: "string", description: "What work the caller needs done" },
      treeDetails: { type: "string", description: "Details: number of trees, size, species, etc." },
      access: { type: "string", description: "Site access notes (truck access, tight access, slopes)" },
      urgency: {
        type: "string",
        enum: ["emergency", "urgent", "normal", "flexible"],
        description: "How urgent the work is",
      },
      preferredTiming: { type: "string", description: "Preferred timing for the work or a site visit" },
      notes: { type: "string", description: "Anything else worth passing on" },
      confirmedPhone: { type: "string", description: "Best contact number, if different from caller ID" },
      conversationComplete: {
        type: "boolean",
        description: "true once all questions are covered and you are wrapping up the call",
      },
    },
    required: ["conversationComplete"],
  },
};

// ----------------------------------------------------------------------------
// Per-call session
// ----------------------------------------------------------------------------

// The GA `gpt-realtime` protocol renamed several session/event fields vs the
// `gpt-4o-realtime-preview` family. We pick the wire format from the model name
// and accept both event spellings on the way back.
function isLegacyRealtimeModel(model: string): boolean {
  return model.includes("4o") || model.includes("preview");
}

class VoiceAgentSession {
  private twilioWs: WebSocket;
  private openaiWs: WebSocket | null = null;
  private token: string;
  private streamSid = "";
  private callSid = "";
  private callerPhone = "";
  private settings: BusinessSettings | null = null;
  private transcript: TranscriptTurn[] = [];
  private capturedLead: CapturedLead | null = null;
  private startedAt = 0;
  private finished = false;
  private hangUpOnFinish = false;
  private wrapUpAfterResponse = false;
  private responseActive = false;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private startTimeout: ReturnType<typeof setTimeout> | null = null;
  private model = process.env.VOICE_AGENT_MODEL || "gpt-realtime";

  constructor(twilioWs: WebSocket, token: string) {
    this.twilioWs = twilioWs;
    this.token = token;
    // Twilio sends `start` immediately after connecting; a socket that never
    // does is not Twilio.
    this.startTimeout = setTimeout(() => {
      if (!this.callSid) this.finish("no start message");
    }, 10_000);
    twilioWs.on("message", (raw) => this.onTwilioMessage(raw));
    twilioWs.on("close", () => this.finish("twilio socket closed"));
    twilioWs.on("error", (err) => {
      console.error("🎙️ Voice agent: Twilio socket error:", err);
      this.finish("twilio socket error");
    });
  }

  private onTwilioMessage(raw: WebSocket.RawData) {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.event) {
      case "start": {
        if (this.startTimeout) clearTimeout(this.startTimeout);
        this.streamSid = String(msg.start?.streamSid || "");
        this.callSid = String(msg.start?.callSid || "");
        this.callerPhone = String(msg.start?.customParameters?.callerPhone || "");
        if (!verifyStreamToken(this.token, this.callSid)) {
          console.error(`🎙️ Voice agent: stream token mismatch for call ${this.callSid}`);
          this.twilioWs.close();
          return;
        }
        this.startedAt = Date.now();
        console.log(`🎙️ Voice agent: stream started for call ${this.callSid} from ${this.callerPhone || "unknown"}`);
        void this.startOpenAi();
        break;
      }
      case "media": {
        if (this.openaiWs?.readyState === WebSocket.OPEN && msg.media?.payload) {
          // Twilio media payload is already base64 μ-law — forward untouched.
          this.openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: msg.media.payload }));
        }
        break;
      }
      case "stop": {
        this.finish("caller hung up / stream stopped");
        break;
      }
      default:
        break;
    }
  }

  private async startOpenAi() {
    try {
      this.settings = await storage.getBusinessSettings();
    } catch (err) {
      console.error("🎙️ Voice agent: settings load failed, using defaults:", err);
    }

    const maxMinutes = Math.min(Math.max(this.settings?.voiceAgentMaxMinutes || 10, 2), 30);
    this.maxDurationTimer = setTimeout(() => this.onMaxDuration(), maxMinutes * 60_000);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("🎙️ Voice agent: OPENAI_API_KEY missing — falling back to dial flow");
      this.twilioWs.close();
      return;
    }

    const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Required by the preview models; ignored by GA.
        "OpenAI-Beta": "realtime=v1",
      },
    });
    this.openaiWs = ws;

    ws.on("open", () => {
      ws.send(JSON.stringify(this.buildSessionUpdate()));
      // Agent speaks first — greet, then start the triage questions.
      ws.send(
        JSON.stringify({
          type: "response.create",
          response: { instructions: "Greet the caller warmly and ask for their name to get started." },
        }),
      );
    });
    ws.on("message", (raw) => this.onOpenAiMessage(raw));
    ws.on("close", () => {
      // OpenAI dropped while the call is still live → close the Twilio socket
      // WITHOUT hanging up, so the TwiML fallback dials Jules.
      this.finish("openai socket closed");
    });
    ws.on("error", (err) => {
      console.error("🎙️ Voice agent: OpenAI socket error:", err);
      this.finish("openai socket error");
    });
  }

  private buildSessionUpdate(): object {
    const instructions = buildAgentInstructions(this.settings, this.callerPhone);
    const voice = this.settings?.voiceAgentVoice || "marin";
    if (isLegacyRealtimeModel(this.model)) {
      return {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          voice,
          instructions,
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: { type: "server_vad" },
          tools: [CAPTURE_LEAD_TOOL],
          tool_choice: "auto",
        },
      };
    }
    return {
      type: "session.update",
      session: {
        type: "realtime",
        output_modalities: ["audio"],
        audio: {
          input: {
            format: { type: "audio/pcmu" },
            turn_detection: { type: "server_vad" },
            transcription: { model: "gpt-4o-mini-transcribe" },
          },
          output: {
            format: { type: "audio/pcmu" },
            voice,
          },
        },
        instructions,
        tools: [CAPTURE_LEAD_TOOL],
        tool_choice: "auto",
      },
    };
  }

  private onOpenAiMessage(raw: WebSocket.RawData) {
    let event: any;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (event.type) {
      // Audio out — GA and legacy spellings.
      case "response.output_audio.delta":
      case "response.audio.delta": {
        if (this.twilioWs.readyState === WebSocket.OPEN && this.streamSid && event.delta) {
          this.twilioWs.send(
            JSON.stringify({ event: "media", streamSid: this.streamSid, media: { payload: event.delta } }),
          );
        }
        break;
      }
      // Barge-in: caller started talking — drop whatever the agent was saying.
      case "input_audio_buffer.speech_started": {
        if (this.twilioWs.readyState === WebSocket.OPEN && this.streamSid) {
          this.twilioWs.send(JSON.stringify({ event: "clear", streamSid: this.streamSid }));
        }
        if (this.responseActive && this.openaiWs?.readyState === WebSocket.OPEN) {
          this.openaiWs.send(JSON.stringify({ type: "response.cancel" }));
        }
        break;
      }
      case "response.created": {
        this.responseActive = true;
        break;
      }
      case "response.done": {
        this.responseActive = false;
        if (this.wrapUpAfterResponse) {
          // The goodbye has been spoken — give the tail audio a moment to play
          // out of Twilio's buffer, then end the call for real.
          setTimeout(() => {
            this.hangUpOnFinish = true;
            this.finish("conversation complete");
          }, 3_000);
        }
        break;
      }
      // Caller-side transcript — same event name in GA and legacy.
      case "conversation.item.input_audio_transcription.completed": {
        const text = String(event.transcript || "").trim();
        if (text) this.transcript.push({ role: "caller", text });
        break;
      }
      // Agent-side transcript — GA and legacy spellings.
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const text = String(event.transcript || "").trim();
        if (text) this.transcript.push({ role: "agent", text });
        break;
      }
      case "response.function_call_arguments.done": {
        this.onCaptureLead(event);
        break;
      }
      case "error": {
        // Non-fatal protocol errors (e.g. cancel with no active response) are
        // logged and ignored; the socket close handler covers fatal ones.
        console.error("🎙️ Voice agent: OpenAI event error:", JSON.stringify(event.error || event));
        break;
      }
      default:
        break;
    }
  }

  private onCaptureLead(event: any) {
    let args: any = {};
    try {
      args = JSON.parse(event.arguments || "{}");
    } catch {
      // Malformed arguments — keep whatever we captured previously.
    }
    this.capturedLead = { ...(this.capturedLead || {}), ...args };
    const complete = args.conversationComplete === true;
    console.log(`🎙️ Voice agent: capture_lead (complete=${complete}) for call ${this.callSid}`);

    if (this.openaiWs?.readyState === WebSocket.OPEN) {
      this.openaiWs.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: event.call_id,
            output: JSON.stringify({
              status: "saved",
              next: complete
                ? "Say a brief goodbye now — the details are saved."
                : "Details saved. Continue the conversation.",
            }),
          },
        }),
      );
      this.openaiWs.send(JSON.stringify({ type: "response.create" }));
    }
    if (complete) this.wrapUpAfterResponse = true;
  }

  private onMaxDuration() {
    console.log(`🎙️ Voice agent: max duration reached for call ${this.callSid}`);
    if (this.openaiWs?.readyState === WebSocket.OPEN) {
      this.wrapUpAfterResponse = true;
      this.openaiWs.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions:
              "Time is up — apologise briefly, say the details so far have been passed on and a quote will follow shortly, and say goodbye.",
          },
        }),
      );
      // Belt and braces if the wrap-up response never completes.
      setTimeout(() => {
        this.hangUpOnFinish = true;
        this.finish("max duration hard stop");
      }, 20_000);
    } else {
      this.finish("max duration reached");
    }
  }

  // Single-fire teardown. Closes both sockets, optionally hangs up the call
  // via REST (success path only), and hands off to the post-call pipeline.
  private finish(reason: string) {
    if (this.finished) return;
    this.finished = true;
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    if (this.startTimeout) clearTimeout(this.startTimeout);
    console.log(`🎙️ Voice agent: session ended (${reason}) for call ${this.callSid || "unknown"}`);

    try {
      if (this.openaiWs && this.openaiWs.readyState <= WebSocket.OPEN) this.openaiWs.close();
    } catch { /* already closing */ }
    try {
      if (this.twilioWs.readyState <= WebSocket.OPEN) this.twilioWs.close();
    } catch { /* already closing */ }

    if (this.hangUpOnFinish && this.callSid) {
      getTwilioClient()
        .then((client) => client.calls(this.callSid).update({ status: "completed" }))
        .catch((err) => console.error("🎙️ Voice agent: REST hangup failed:", err));
    }

    // Anything captured — even a partial conversation — becomes a lead.
    if (this.callSid && (this.transcript.length > 0 || this.capturedLead)) {
      const durationSec = this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
      processVoiceAgentCall({
        callSid: this.callSid,
        callerPhone: this.capturedLead?.confirmedPhone || this.callerPhone,
        transcriptTurns: this.transcript,
        capturedLead: this.capturedLead,
        durationSec,
      }).catch((err) => console.error("🎙️ Voice agent: post-call pipeline failed:", err));
    }
  }
}

// ----------------------------------------------------------------------------
// WSS attachment
// ----------------------------------------------------------------------------

export function attachVoiceAgentWss(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    // Only claim our path. Returning (not destroying) on a non-match is what
    // keeps Vite's HMR WebSocket alive in dev — both listeners coexist.
    const url = req.url || "";
    if (!url.startsWith("/api/voice-agent/stream")) return;
    const token = new URL(url, "http://localhost").searchParams.get("token") || "";
    if (!verifyStreamTokenStructure(token)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      new VoiceAgentSession(ws, token);
    });
  });
  console.log("🎙️ Voice agent WebSocket endpoint attached at /api/voice-agent/stream");
}
