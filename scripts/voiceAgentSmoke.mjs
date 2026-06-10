// Simulated-Twilio smoke test for the AI voice agent (IVR + media bridge +
// post-call lead pipeline). Pretends to be Twilio: posts the answer/IVR
// webhooks, then opens a fake Media Stream WebSocket and asserts the OpenAI
// agent replies with greeting audio and that a call record + lead job land
// in the database. Toggles voice_agent_enabled in the connected DB and
// reverts it at the end — run against LOCAL DEV ONLY, never production.
//
// Usage:  set -a && source .env && set +a && node scripts/voiceAgentSmoke.mjs
//         (server must be running; SMOKE_PORT overrides the default 5002)
//
// Costs a few cents of OpenAI Realtime audio per run.
//
// Local env note: without TWILIO_* vars in .env, webhook signature validation
// is skipped and the dial path returns the "sorry" TwiML (no dial targets
// configured) — the assertions account for that.
import pg from "pg";
import WebSocket from "ws";

const BASE = `http://localhost:${process.env.SMOKE_PORT || 5002}`;
const CALL_SID = "CAtest" + Math.random().toString(36).slice(2, 10);
const FROM = "+64211234567";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function post(path, params) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  }).then((r) => r.text());
}

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${detail}`); }
}

async function setEnabled(v) {
  await pool.query("UPDATE business_settings SET voice_agent_enabled = $1", [v]);
}

// ── 1. Agent disabled → original flow (here: "sorry", since no dial targets) ─
await setEnabled(false);
const disabled = await post("/api/webhooks/twilio-answer", { CallSid: CALL_SID, From: FROM, To: "+6499999999" });
check("disabled: no Gather menu", !disabled.includes("<Gather"));
check("disabled: dial-flow body (no-destination Say)", disabled.includes("unable to take your call"), disabled.slice(0, 200));

// ── 2. Agent enabled → Gather menu with dial fallback inline ────────────────
await setEnabled(true);
const menu = await post("/api/webhooks/twilio-answer", { CallSid: CALL_SID, From: FROM, To: "+6499999999" });
check("enabled: Gather menu present", menu.includes("<Gather") && menu.includes("/api/webhooks/twilio-ivr"));
check("enabled: greeting mentions press 1/2", /press 1/i.test(menu) && /press 2/i.test(menu));
check("enabled: greeting resolved {businessName}", menu.includes("Treemarkables") && !menu.includes("{businessName}"));
check("enabled: dial-flow fallback after Gather", menu.includes("unable to take your call"));

// ── 3. ?mode=dial escape hatch → original flow even when enabled ────────────
const modeDial = await post("/api/webhooks/twilio-answer?mode=dial", { CallSid: CALL_SID, From: FROM });
check("mode=dial: no menu", !modeDial.includes("<Gather"));

// ── 4. IVR digit routing ─────────────────────────────────────────────────────
const press2 = await post("/api/webhooks/twilio-ivr", { CallSid: CALL_SID, From: FROM, Digits: "2" });
check("press 2 → dial flow, no Connect", !press2.includes("<Connect"));

const press1 = await post("/api/webhooks/twilio-ivr", { CallSid: CALL_SID, From: FROM, Digits: "1" });
check("press 1 → Connect/Stream", press1.includes("<Connect>") && press1.includes("/api/voice-agent/stream?token="));
check("press 1 → fallback redirect present", press1.includes("twilio-answer?mode=dial"));
check("press 1 → callerPhone parameter", press1.includes(FROM));
const tokenMatch = press1.match(/token=([^"]+)"/);
check("press 1 → stream token minted", Boolean(tokenMatch));

// ── 5. Media bridge ──────────────────────────────────────────────────────────
const badWs = await new Promise((resolve) => {
  const ws = new WebSocket(`ws://localhost:${process.env.SMOKE_PORT || 5002}/api/voice-agent/stream?token=123.deadbeef`);
  ws.on("open", () => resolve("opened"));
  ws.on("error", () => resolve("rejected"));
  ws.on("close", () => resolve("rejected"));
});
check("bad/expired stream token rejected", badWs === "rejected");

async function testBridge(token) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${process.env.SMOKE_PORT || 5002}/api/voice-agent/stream?token=${token}`);
    let mediaFrames = 0;
    let audioBytes = 0;
    const silence = Buffer.alloc(160, 0xff).toString("base64"); // 20ms μ-law silence
    let mediaTimer;
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearInterval(mediaTimer);
      try { ws.close(); } catch {}
      resolve(result);
    };
    // Let the "call" run 12s — long enough for the greeting audio AND its
    // transcript event to land server-side — then hang up like a real caller.
    const timeout = setTimeout(() => {
      try { ws.send(JSON.stringify({ event: "stop" })); } catch {}
      setTimeout(() => done({ mediaFrames, audioBytes }), 1500);
    }, 12000);
    ws.on("open", () => {
      ws.send(JSON.stringify({
        event: "start",
        start: { streamSid: "MZtest123", callSid: CALL_SID, customParameters: { callerPhone: FROM } },
      }));
      mediaTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: "media", media: { payload: silence } }));
        }
      }, 20);
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === "media") {
          mediaFrames++;
          audioBytes += Buffer.from(msg.media?.payload || "", "base64").length;
        }
      } catch {}
    });
    ws.on("error", (err) => { clearTimeout(timeout); done({ error: String(err), mediaFrames, audioBytes }); });
    ws.on("close", () => { clearTimeout(timeout); done({ mediaFrames, audioBytes, closed: true }); });
  });
}

if (tokenMatch) {
  console.log("…connecting fake Twilio stream (expect OpenAI greeting audio back)…");
  const bridge = await testBridge(tokenMatch[1]);
  console.log(`   bridge result: ${JSON.stringify(bridge)}`);
  check("bridge: agent audio received (≥2s speech)", (bridge.audioBytes || 0) > 16000, JSON.stringify(bridge));
}

// ── 6. Post-call pipeline artifacts ──────────────────────────────────────────
await new Promise((r) => setTimeout(r, 8000));
const calls = await pool.query(
  "SELECT id, phone_number, intent, transcript_text FROM calls WHERE twilio_call_sid = $1",
  [CALL_SID],
);
check("pipeline: call record created", calls.rowCount === 1, `rows=${calls.rowCount}`);
if (calls.rowCount === 1) {
  console.log(`   transcript: ${String(calls.rows[0].transcript_text || "").slice(0, 200)}`);
}
const jobs = await pool.query(
  "SELECT job_number, title, status, lead_source, created_at FROM jobs WHERE lead_source = 'voice_agent' AND created_at > now() - interval '2 minutes' ORDER BY created_at DESC LIMIT 1",
);
check("pipeline: voice_agent lead job from THIS run", jobs.rowCount === 1);
if (jobs.rowCount === 1) console.log(`   job: #${jobs.rows[0].job_number} "${jobs.rows[0].title}" (${jobs.rows[0].status})`);

// ── cleanup: revert toggle ────────────────────────────────────────────────────
await setEnabled(false);
await pool.end();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
