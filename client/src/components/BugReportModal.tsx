import { useEffect, useRef, useState } from "react";
import { Bug, Camera, Check, Loader2, Mic, Square, Trash2, Video, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBugReport } from "@/contexts/BugReportContext";
import { isNativeApp } from "@/lib/platform";
import { bugReportSeverities, type BugReportSeverity } from "@shared/schema";

// "Report a problem" — one modal, four inputs: text, a voice note, photos, a
// video/screen recording. Submits as: create draft → upload each attachment to
// its own endpoint → /submit (which alerts the operator). The reporter only
// waits on the uploads; the alert runs server-side after the response.

interface Props {
  open: boolean;
  onClose: () => void;
}

interface PhotoPick {
  file: File;
  previewUrl: string;
}

const SEVERITY_LABEL: Record<BugReportSeverity, string> = {
  blocker: "Can't continue",
  major: "Something's broken",
  minor: "Small glitch",
  idea: "Suggestion",
};

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function detectPlatform(): "ios" | "android" | "web" {
  if (!isNativeApp()) return "web";
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ? "ios" : "android";
}

async function postForm(url: string, file: Blob, filename: string): Promise<Response> {
  const form = new FormData();
  form.append("file", file, filename);
  return fetch(url, { method: "POST", body: form, credentials: "include" });
}

async function postJson(url: string, body?: unknown, method = "POST"): Promise<Response> {
  return fetch(url, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export default function BugReportModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const { recentErrors } = useBugReport();

  const [severity, setSeverity] = useState<BugReportSeverity>("minor");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PhotoPick[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [voice, setVoice] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("audio/webm");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordSecondsRef = useRef(0);

  const [phase, setPhase] = useState<"edit" | "sending" | "done">("edit");
  const [progress, setProgress] = useState("");
  const draftIdRef = useRef<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // The page the user was on when they opened the modal, not where they end up.
  const pageUrlRef = useRef<string>(typeof window !== "undefined" ? window.location.href : "");

  const canRecord =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    "MediaRecorder" in window;

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopStream();
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      if (voice) URL.revokeObjectURL(voice.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    if (!canRecord) {
      toast({ variant: "destructive", title: "Voice notes aren't supported on this device" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
      else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mimeType = "audio/webm;codecs=opus";
      else if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
      mimeRef.current = mimeType || "audio/webm";
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined);
      } catch {
        recorder = new MediaRecorder(stream);
        mimeRef.current = "audio/webm";
      }
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current.split(";")[0] });
        setVoice((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { blob, url: URL.createObjectURL(blob), seconds: recordSecondsRef.current };
        });
        stopStream();
        setIsRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordSecondsRef.current = 0;
      timerRef.current = setInterval(() => {
        recordSecondsRef.current += 1;
        setRecordSeconds(recordSecondsRef.current);
        // Hard cap so a forgotten recorder can't produce a 50MB+ file.
        if (recordSecondsRef.current >= 180) recorderRef.current?.stop();
      }, 1000);
    } catch (err) {
      console.error("bug-report: microphone error", err);
      toast({ variant: "destructive", title: "Couldn't access the microphone", description: "Check the app's microphone permission and try again." });
      stopStream();
    }
  };
  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    else stopStream();
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const picked: PhotoPick[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
      .slice(0, 10 - photos.length)
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...picked]);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const hasContent = description.trim().length > 0 || !!voice || photos.length > 0 || !!video;

  const discardDraft = () => {
    const id = draftIdRef.current;
    draftIdRef.current = null;
    if (id) void postJson(`/api/bug-reports/${id}`, undefined, "DELETE").catch(() => undefined);
  };

  const handleClose = () => {
    if (phase === "sending") return;
    if (isRecording) stopRecording();
    if (phase === "edit") discardDraft();
    onClose();
  };

  const submit = async () => {
    if (!hasContent) {
      toast({ variant: "destructive", title: "Add a few words, a voice note, a photo or a video first" });
      return;
    }
    if (isRecording) stopRecording();
    setPhase("sending");
    try {
      setProgress("Creating report…");
      const createRes = await postJson("/api/bug-reports", {
        severity,
        title: title.trim() || undefined,
        description: description.trim(),
        pageUrl: pageUrlRef.current,
        platform: detectPlatform(),
        screenSize: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio || 1}`,
        extraContext: {
          language: navigator.language,
          online: navigator.onLine,
          recentErrors: recentErrors(),
          referrer: document.referrer || undefined,
        },
      });
      if (!createRes.ok) throw new Error("create failed");
      const created = (await createRes.json()) as { data: { id: string } };
      const id = created.data.id;
      draftIdRef.current = id;

      for (let i = 0; i < photos.length; i++) {
        setProgress(`Uploading photo ${i + 1} of ${photos.length}…`);
        const r = await postForm(`/api/bug-reports/${id}/photos`, photos[i].file, photos[i].file.name || `photo-${i + 1}.jpg`);
        if (!r.ok) throw new Error("photo upload failed");
      }
      if (video) {
        setProgress(`Uploading video (${formatBytes(video.size)})…`);
        const r = await postForm(`/api/bug-reports/${id}/videos`, video, video.name || "recording.mp4");
        if (!r.ok) throw new Error("video upload failed");
      }
      if (voice) {
        setProgress("Uploading voice note…");
        const ext = voice.blob.type.includes("mp4") ? "m4a" : voice.blob.type.includes("ogg") ? "ogg" : "webm";
        const r = await postForm(`/api/bug-reports/${id}/voice`, voice.blob, `voice-note.${ext}`);
        if (!r.ok) throw new Error("voice upload failed");
      }

      setProgress("Sending…");
      const submitRes = await postJson(`/api/bug-reports/${id}/submit`, {
        severity,
        title: title.trim() || undefined,
        description: description.trim(),
      });
      if (!submitRes.ok) throw new Error("submit failed");
      draftIdRef.current = null;
      setPhase("done");
    } catch (err) {
      console.error("bug-report: submit error", err);
      toast({
        variant: "destructive",
        title: "Couldn't send the report",
        description: "Check your connection and try again. Nothing you typed has been lost.",
      });
      setPhase("edit");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto" data-testid="dialog-bug-report">
        {phase === "done" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" /> Thanks, we've got it
              </DialogTitle>
              <DialogDescription>
                Your report is with the team now. We'll fix what we can and get back to you if we need more detail.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={onClose} data-testid="button-bug-report-close">Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" /> Report a problem
              </DialogTitle>
              <DialogDescription>
                Tell us what went wrong. A quick voice note, a photo or a screen recording helps us fix it faster.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>How bad is it?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {bugReportSeverities.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant={severity === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSeverity(s)}
                      data-testid={`button-bug-severity-${s}`}
                    >
                      {SEVERITY_LABEL[s]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bug-title">In a few words</Label>
                <Input
                  id="bug-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Invoice won't send from the job card"
                  maxLength={200}
                  data-testid="input-bug-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bug-description">What happened?</Label>
                <Textarea
                  id="bug-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What did you tap, what did you expect, and what happened instead?"
                  rows={4}
                  data-testid="textarea-bug-description"
                />
              </div>

              <div className="space-y-2">
                <Label>Voice note</Label>
                {voice ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                    <audio controls src={voice.url} className="h-9 min-w-0 flex-1" data-testid="audio-bug-voice-preview" />
                    <span className="text-xs text-muted-foreground shrink-0">{formatSeconds(voice.seconds)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove voice note"
                      onClick={() => { URL.revokeObjectURL(voice.url); setVoice(null); }}
                      data-testid="button-bug-voice-remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : isRecording ? (
                  <Button type="button" variant="destructive" className="w-full" onClick={stopRecording} data-testid="button-bug-voice-stop">
                    <Square className="h-4 w-4 mr-2" /> Stop recording · {formatSeconds(recordSeconds)}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" className="w-full" onClick={startRecording} disabled={!canRecord} data-testid="button-bug-voice-start">
                    <Mic className="h-4 w-4 mr-2" /> {canRecord ? "Record a voice note" : "Voice notes not supported here"}
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Photos or screenshots</Label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }}
                  data-testid="input-bug-photos"
                />
                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {photos.map((p, i) => (
                      <div key={p.previewUrl} className="relative aspect-square overflow-hidden rounded-md border border-border">
                        <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          aria-label="Remove photo"
                          onClick={() => removePhoto(i)}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photos.length >= 10}
                  data-testid="button-bug-add-photos"
                >
                  <Camera className="h-4 w-4 mr-2" /> {photos.length ? "Add more photos" : "Add photos"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Video or screen recording</Label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => { setVideo(e.target.files?.[0] ?? null); e.target.value = ""; }}
                  data-testid="input-bug-video"
                />
                {video ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-sm">
                    <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{video.name || "Recording"}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatBytes(video.size)}</span>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove video" onClick={() => setVideo(null)} data-testid="button-bug-video-remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full" onClick={() => videoInputRef.current?.click()} data-testid="button-bug-add-video">
                    <Video className="h-4 w-4 mr-2" /> Add a video
                  </Button>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                We'll include the page you were on, your device type and any recent app errors so we can reproduce it.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={phase === "sending"} data-testid="button-bug-cancel">
                Cancel
              </Button>
              <Button type="button" onClick={submit} disabled={phase === "sending" || !hasContent} data-testid="button-bug-submit">
                {phase === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {progress || "Sending…"}
                  </>
                ) : (
                  "Send report"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
