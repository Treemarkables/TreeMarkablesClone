// JobVideos — staff control for attaching on-site walkthrough videos to a job
// (the Loom replacement). Upload streams to GCS via the backend; customer-visible
// videos surface on the customer's quote/proposal view. Used inside the job card.
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Upload, Copy, Video as VideoIcon, Search, Pencil, Check, X, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JobVideosProps {
  jobId: string;
}

export function JobVideos({ jobId }: JobVideosProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [showToCustomer, setShowToCustomer] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [open, setOpen] = useState(false);
  // AI quote-from-video flow: post-upload we ask "generate description?", then
  // run Whisper + GPT-5, then show the result for review/edit before applying.
  const [pendingTranscribeId, setPendingTranscribeId] = useState<string | null>(null);
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [showResult, setShowResult] = useState(false);
  // The video the result dialog is "about" — needed so the Re-generate button
  // knows which video to re-run when the user wants another pass.
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const videosKey = ["/api/jobs", jobId, "videos"];

  const { data: response, isLoading } = useQuery({
    queryKey: videosKey,
    queryFn: async () => {
      const r = await fetch(`/api/jobs/${jobId}/videos`, { credentials: "include" });
      if (!r.ok) return { success: false, data: [] };
      return r.json();
    },
    enabled: !!jobId,
  });
  const videos: any[] = response?.data || [];

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      // Text fields must precede the file part so the streaming upload parses them in time.
      if (title.trim()) form.append("title", title.trim());
      form.append("showToCustomer", String(showToCustomer));
      form.append("video", file);
      const r = await fetch(`/api/jobs/${jobId}/videos`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || "Upload failed");
      }
      return r.json();
    },
    onSuccess: (response: any) => {
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: videosKey });
      // Open the "generate description?" prompt for the just-uploaded video.
      const newId = response?.data?.id;
      if (newId) setPendingTranscribeId(newId);
    },
    onError: (error: any) => {
      toast({
        title: "Video upload failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // AI: transcribe the walkthrough and turn it into a quote-ready description.
  // The optional `force` flag bypasses the server's cached-result fast-path
  // — used by the "Re-generate" button in the result dialog so the user can
  // iterate when Whisper mishears a species or GPT's structure misses the
  // mark on first pass.
  const transcribeMutation = useMutation({
    mutationFn: async ({ videoId, force }: { videoId: string; force?: boolean }) => {
      const url = force
        ? `/api/videos/${videoId}/transcribe?force=1`
        : `/api/videos/${videoId}/transcribe`;
      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.message || "Transcription failed");
      return { ...body, videoId };
    },
    onSuccess: (response: any) => {
      const desc = response?.data?.generatedDescription || "";
      setGeneratedDescription(desc);
      // Remember which video this result belongs to so the "Re-generate"
      // button knows what to re-run.
      setActiveVideoId(response?.videoId || null);
      setPendingTranscribeId(null);
      setShowResult(true);
      queryClient.invalidateQueries({ queryKey: videosKey });
    },
    onError: (error: any) => {
      toast({
        title: "Could not generate description",
        description: error?.message || "Try again, or fill in the job description manually.",
        variant: "destructive",
      });
      setPendingTranscribeId(null);
    },
  });

  // Apply the generated description back to the parent job. Supports replace
  // (overwrite) and append (concatenate to existing description with a blank
  // line between).
  const applyDescriptionMutation = useMutation({
    mutationFn: async ({ mode, description }: { mode: "replace" | "append"; description: string }) => {
      let finalDescription = description;
      if (mode === "append") {
        const jobRes = await fetch(`/api/jobs/${jobId}`, { credentials: "include" });
        const jobBody = await jobRes.json().catch(() => ({}));
        const current = jobBody?.data?.description?.trim() || "";
        finalDescription = current ? `${current}\n\n${description}` : description;
      }
      const r = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: finalDescription }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || "Could not update job description");
      }
      return r.json();
    },
    onSuccess: () => {
      setShowResult(false);
      setGeneratedDescription("");
      setActiveVideoId(null);
      // Invalidate anything keyed off this job so the open job card re-renders
      // with the new description.
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not save description",
        description: error?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, show }: { id: string; show: boolean }) => {
      const r = await fetch(`/api/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ showToCustomer: show }),
      });
      if (!r.ok) throw new Error("Update failed");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: videosKey }),
    onError: () =>
      toast({ title: "Could not update video", variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const r = await fetch(`/api/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      if (!r.ok) throw new Error("Rename failed");
      return r.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditTitle("");
      queryClient.invalidateQueries({ queryKey: videosKey });
    },
    onError: () =>
      toast({ title: "Could not save title", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/videos/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Delete failed");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: videosKey }),
    onError: () =>
      toast({ title: "Could not delete video", variant: "destructive" }),
  });

  // Retry the automatic caption pass when it errored (or for videos uploaded
  // before captions existed). The server kicks off Whisper async; we re-poll
  // the list a few times so the status flips from processing → ready.
  const captionsRetryMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/videos/${id}/captions/regenerate`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Caption retry failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: videosKey });
      // Captions land asynchronously — refresh the list shortly after so the
      // "ready" status (and the CC track) appears without a manual reload.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: videosKey }), 8000);
    },
    onError: () =>
      toast({ title: "Could not regenerate captions", variant: "destructive" }),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const copyLink = (url: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}${url}`).catch(() => {
      toast({ title: "Could not copy link", variant: "destructive" });
    });
  };

  const startEdit = (v: any) => {
    setEditingId(v.id);
    setEditTitle(v.title || "");
  };

  const saveEdit = (id: string) => {
    renameMutation.mutate({ id, title: editTitle.trim() });
  };

  const q = search.trim().toLowerCase();
  const filteredVideos = q
    ? videos.filter((v: any) =>
        [v.title, v.originalName, v.filename, v.description]
          .filter(Boolean)
          .some((field: string) => field.toLowerCase().includes(q)),
      )
    : videos;

  return (
    <Card className="bg-card border border-border">
      <CardContent className="p-4">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger
            className="group flex items-center gap-2 w-full"
            data-testid="toggle-job-videos"
          >
            <VideoIcon className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Job Videos</h3>
            {videos.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({videos.length})
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-3">

        {/* Upload control */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`video-title-${jobId}`} className="text-xs">
              Title (optional)
            </Label>
            <Input
              id={`video-title-${jobId}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Driveway oak removal walkthrough"
              data-testid="input-video-title"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`video-show-${jobId}`}
              checked={showToCustomer}
              onCheckedChange={setShowToCustomer}
              data-testid="switch-video-show"
            />
            <Label htmlFor={`video-show-${jobId}`} className="text-xs">
              Show to customer on their quote
            </Label>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFile}
            data-testid="input-video-file"
          />
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadMutation.isPending}
            data-testid="button-upload-video"
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploadMutation.isPending ? "Uploading…" : "Upload video"}
          </Button>
        </div>

        {/* Search */}
        {videos.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search videos by title or keyword…"
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-job-videos"
            />
          </div>
        )}

        {/* Video list */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading videos…</p>
        ) : videos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No videos yet. Record on site, then upload here to share with the customer.
          </p>
        ) : filteredVideos.length === 0 ? (
          <p className="text-xs text-muted-foreground">No videos match "{search}".</p>
        ) : (
          <div className="space-y-3">
            {filteredVideos.map((v: any) => (
              <div
                key={v.id}
                className="rounded-lg border border-border p-2 space-y-2"
                data-testid={`job-video-${v.id}`}
              >
                {editingId === v.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(v.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      placeholder="Video title"
                      className="h-8 text-xs"
                      autoFocus
                      data-testid={`input-edit-job-title-${v.id}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => saveEdit(v.id)}
                      disabled={renameMutation.isPending}
                      data-testid={`button-save-job-title-${v.id}`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditingId(null)}
                      data-testid={`button-cancel-job-title-${v.id}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(v)}
                    className="flex items-center gap-1.5 text-left group w-full"
                    data-testid={`button-edit-job-title-${v.id}`}
                  >
                    <span className="text-xs font-medium truncate">
                      {v.title || "Add title…"}
                    </span>
                    <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                  </button>
                )}
                <video
                  src={v.url}
                  poster={v.thumbnailUrl || undefined}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full max-h-80 rounded bg-black object-contain"
                >
                  {v.captionsStatus === "ready" && (
                    <track
                      kind="captions"
                      srcLang="en"
                      label="English"
                      src={`/api/videos/${v.id}/captions.vtt`}
                      default
                    />
                  )}
                </video>
                {/* Caption status — captions are generated automatically on
                    upload; surface progress and a retry if the pass errored. */}
                {v.captionsStatus === "processing" && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generating captions…
                  </p>
                )}
                {v.captionsStatus === "error" && (
                  <button
                    type="button"
                    onClick={() => captionsRetryMutation.mutate(v.id)}
                    disabled={captionsRetryMutation.isPending}
                    className="text-xs text-muted-foreground underline underline-offset-2"
                    data-testid={`button-retry-captions-${v.id}`}
                  >
                    Captions failed — retry
                  </button>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!v.showToCustomer}
                      onCheckedChange={(show) =>
                        toggleMutation.mutate({ id: v.id, show })
                      }
                      data-testid={`toggle-show-${v.id}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      Visible to customer
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* AI: per-row retry — handles two cases the post-upload
                        prompt can't: (1) video uploaded but Generate was
                        declined, (2) previous Generate failed and left
                        transcriptStatus=error or none. Clicking re-runs the
                        same endpoint (idempotent fast-path returns cached
                        result if ready). */}
                    {v.transcriptStatus !== "ready" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => transcribeMutation.mutate({ videoId: v.id })}
                        disabled={
                          transcribeMutation.isPending &&
                          transcribeMutation.variables?.videoId === v.id
                        }
                        title="Transcribe this video and generate a job description with AI"
                        data-testid={`button-generate-${v.id}`}
                      >
                        {transcribeMutation.isPending &&
                        transcribeMutation.variables?.videoId === v.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                    {v.transcriptStatus === "ready" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Open the result dialog with the cached AI
                          // description so the user can re-apply it
                          // (replace/append) or click Re-generate to force
                          // a fresh server-side pass.
                          if (v.generatedDescription) {
                            setGeneratedDescription(v.generatedDescription);
                            setActiveVideoId(v.id);
                            setShowResult(true);
                          }
                        }}
                        title="View the AI-generated description for this video"
                        data-testid={`button-view-generated-${v.id}`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(`/watch/${v.id}`)}
                      data-testid={`button-copy-${v.id}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(v.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${v.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {/* Post-upload: ask whether to AI-generate a quote description. */}
      <AlertDialog
        open={!!pendingTranscribeId}
        onOpenChange={(o) => {
          if (!o && !transcribeMutation.isPending) setPendingTranscribeId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Generate quote description from this video?
            </AlertDialogTitle>
            <AlertDialogDescription>
              We'll transcribe what you said and turn it into a customer-ready
              job description you can review and apply to this job.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={transcribeMutation.isPending}
              data-testid="button-skip-transcribe"
            >
              Not now
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingTranscribeId) {
                  transcribeMutation.mutate({ videoId: pendingTranscribeId });
                }
              }}
              disabled={transcribeMutation.isPending}
              data-testid="button-confirm-transcribe"
            >
              {transcribeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result dialog: review & edit the generated description before applying. */}
      <Dialog
        open={showResult}
        onOpenChange={(o) => {
          if (!o && !applyDescriptionMutation.isPending && !transcribeMutation.isPending) {
            setShowResult(false);
            setGeneratedDescription("");
            setActiveVideoId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Generated job description
            </DialogTitle>
            <DialogDescription>
              Review and edit before applying to this job. Replace overwrites
              the current description; Append adds it underneath.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={generatedDescription}
            onChange={(e) => setGeneratedDescription(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            data-testid="textarea-generated-description"
          />
          <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowResult(false);
                setGeneratedDescription("");
                setActiveVideoId(null);
              }}
              disabled={
                applyDescriptionMutation.isPending ||
                transcribeMutation.isPending
              }
              data-testid="button-discard-generated"
            >
              Discard
            </Button>
            {/* Re-generate forces a fresh server-side pass (bypasses cache).
                Useful when Whisper misheard a species or the structure
                missed the mark — clicking it re-runs Whisper + GPT-5 with
                the latest prompts. */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (activeVideoId) {
                  transcribeMutation.mutate({ videoId: activeVideoId, force: true });
                }
              }}
              disabled={
                !activeVideoId ||
                transcribeMutation.isPending ||
                applyDescriptionMutation.isPending
              }
              data-testid="button-regenerate-generated"
            >
              {transcribeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Re-running…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Re-generate
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                applyDescriptionMutation.mutate({
                  mode: "append",
                  description: generatedDescription,
                })
              }
              disabled={
                applyDescriptionMutation.isPending || !generatedDescription.trim()
              }
              data-testid="button-append-generated"
            >
              Append
            </Button>
            <Button
              type="button"
              onClick={() =>
                applyDescriptionMutation.mutate({
                  mode: "replace",
                  description: generatedDescription,
                })
              }
              disabled={
                applyDescriptionMutation.isPending || !generatedDescription.trim()
              }
              data-testid="button-replace-generated"
            >
              {applyDescriptionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Replace job description"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
