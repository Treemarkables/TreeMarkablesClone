import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Upload, Trash2, Loader2, Voicemail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Twilio's <Play> verb only accepts mp3/wav. Phone voice memos are .m4a and
// browser MediaRecorder produces .webm — neither plays. So we capture mic audio
// via the Web Audio API and encode a WAV ourselves, which Twilio plays directly.
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

const MAX_SECONDS = 60;

type RecorderRefs = {
  stream: MediaStream;
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
};

export function VoicemailGreetingCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mediaRef = useRef<RecorderRefs | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  // Bumped after each save/reset so the preview <audio> below refetches the
  // saved file instead of replaying a browser-cached copy of the old greeting.
  const [version, setVersion] = useState(0);

  const { data: status } = useQuery<{ success: boolean; exists: boolean; format: string | null }>({
    queryKey: ["/api/twilio/voicemail-greeting/status"],
  });
  const hasCustomGreeting = !!status?.exists;

  // Tick the elapsed timer while recording; auto-stop at the cap.
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stopRecording();
        return s + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  // Revoke the preview object URL when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (e) => {
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      mediaRef.current = { stream, ctx, source, processor, chunks };
      setSeconds(0);
      setPreview(null);
      setRecording(true);
    } catch {
      toast({
        title: "Microphone unavailable",
        description: "Allow microphone access in your browser, then try again.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    const m = mediaRef.current;
    if (!m) return;
    m.processor.disconnect();
    m.source.disconnect();
    m.stream.getTracks().forEach((t) => t.stop());
    const sampleRate = m.ctx.sampleRate;
    void m.ctx.close();
    const length = m.chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(length);
    let offset = 0;
    for (const c of m.chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    mediaRef.current = null;
    setRecording(false);
    if (length === 0) return;
    const blob = encodeWav(merged, sampleRate);
    setPreview({ url: URL.createObjectURL(blob), blob });
  };

  const saveMutation = useMutation({
    mutationFn: async ({ data, filename }: { data: Blob; filename: string }) => {
      const fd = new FormData();
      fd.append("audio", data, filename);
      const res = await fetch("/api/twilio/voicemail-greeting", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Upload failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/twilio/voicemail-greeting/status"] });
      setVersion((v) => v + 1);
      if (preview?.url) URL.revokeObjectURL(preview.url);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't save greeting", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/twilio/voicemail-greeting", {});
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Failed to remove greeting");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/twilio/voicemail-greeting/status"] });
      setVersion((v) => v + 1);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't remove greeting", description: err.message, variant: "destructive" });
    },
  });

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".mp3") && !name.endsWith(".wav")) {
      toast({
        title: "Unsupported file",
        description: "Upload an MP3 or WAV file (those are the formats the phone system can play).",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    saveMutation.mutate({ data: file, filename: file.name });
  };

  const fmt = (s: number) => `0:${s.toString().padStart(2, "0")}`;
  const busy = saveMutation.isPending || deleteMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Voicemail className="w-5 h-5 text-green-500" />
              Voicemail Greeting
            </CardTitle>
            <CardDescription>
              Record the message callers hear when nobody picks up. Messages are still
              recorded and turned into jobs automatically.
            </CardDescription>
          </div>
          {hasCustomGreeting ? (
            <Badge className="bg-green-500 self-start">Your greeting is live</Badge>
          ) : (
            <Badge variant="secondary" className="self-start">Using default message</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasCustomGreeting && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Current greeting</p>
            <audio
              controls
              className="w-full"
              src={`/api/public/voicemail-greeting?v=${version}`}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {recording ? (
            <Button variant="destructive" onClick={stopRecording} data-testid="button-stop-greeting">
              <Square className="w-4 h-4 mr-2" />
              Stop ({fmt(seconds)})
            </Button>
          ) : (
            <Button onClick={startRecording} disabled={busy} data-testid="button-record-greeting">
              <Mic className="w-4 h-4 mr-2" />
              {hasCustomGreeting ? "Record new greeting" : "Record greeting"}
            </Button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            className="hidden"
            onChange={onFileSelected}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={recording || busy}
            data-testid="button-upload-greeting"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload audio file
          </Button>

          {hasCustomGreeting && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => deleteMutation.mutate()}
              disabled={recording || busy}
              data-testid="button-reset-greeting"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Use default message
            </Button>
          )}
        </div>

        {preview && !recording && (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Preview your recording</p>
            <audio controls className="w-full" src={preview.url} />
            <div className="flex gap-2">
              <Button
                onClick={() => saveMutation.mutate({ data: preview.blob, filename: "greeting.wav" })}
                disabled={saveMutation.isPending}
                data-testid="button-save-greeting"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Save as greeting
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (preview.url) URL.revokeObjectURL(preview.url);
                  setPreview(null);
                }}
                disabled={saveMutation.isPending}
              >
                Discard
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Keep it short — speak after the tone, then Stop (up to {MAX_SECONDS} seconds). Tip: have
          callers leave their name, address, and the work they need.
        </p>
      </CardContent>
    </Card>
  );
}
