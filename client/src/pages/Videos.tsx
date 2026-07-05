// Videos library — central upload home for walkthrough videos (Loom replacement).
// Lets staff upload a video even before a job card exists; videos can be linked
// to a job later (backend supports PATCH /api/videos/:id { jobId }). Knowledge /
// how-to videos will also live here once that surface is built (schema-ready).
import { useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Upload, Copy, Video as VideoIcon, Search, Pencil, Check, X, Briefcase, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadFileWithProgress, type UploadProgress } from "@/lib/uploadWithProgress";

export default function Videos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const videosKey = ["/api/videos"];
  const { data: response, isLoading } = useQuery({
    queryKey: videosKey,
    queryFn: async () => {
      const r = await fetch(`/api/videos`, { credentials: "include" });
      if (!r.ok) return { success: false, data: [] };
      return r.json();
    },
  });
  const videos: any[] = response?.data || [];

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress({ loaded: 0, total: file.size, percent: 0, phase: "uploading" });
      // Text fields must precede the file part so the streaming upload parses them in time.
      const fields: Record<string, string> = {};
      if (title.trim()) fields.title = title.trim();
      return uploadFileWithProgress<any>({
        url: `/api/videos`,
        file,
        fields,
        onProgress: setUploadProgress,
      });
    },
    onSuccess: () => {
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      setUploadProgress(null);
      queryClient.invalidateQueries({ queryKey: videosKey });
    },
    onError: (error: any) => {
      setUploadProgress(null);
      toast({
        title: "Video upload failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
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
    onError: () => toast({ title: "Could not delete video", variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const r = await fetch(`/api/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
        credentials: "include",
      });
      if (!r.ok) throw new Error("Rename failed");
      return r.json();
    },
    onSuccess: () => {
      setEditingId(null);
      setEditTitle("");
      queryClient.invalidateQueries({ queryKey: videosKey });
    },
    onError: () => toast({ title: "Could not save title", variant: "destructive" }),
  });

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
        // Search the video's own fields AND the linked job/customer fields shown on
        // the card (customer name, job #, address) — people search by site/customer,
        // not just the video title.
        [v.title, v.originalName, v.filename, v.description, v.customerName, v.jobTitle, v.jobAddress, v.jobNumber]
          .filter((field) => field != null && field !== "")
          .some((field: any) => String(field).toLowerCase().includes(q)),
      )
    : videos;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const copyLink = (url: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}${url}`).catch(() => {
      toast({ title: "Could not copy link", variant: "destructive" });
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <VideoIcon className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Videos</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Upload walkthrough videos here even before a job card exists. Videos
        uploaded from inside a job card automatically attach to that job and can
        be shown to the customer on their quote.
      </p>

      {/* Upload */}
      <Card className="bg-card border border-border">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="video-title" className="text-xs">
              Title (optional)
            </Label>
            <Input
              id="video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Site assessment — 12 Rimu Lane"
              data-testid="input-library-video-title"
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFile}
            data-testid="input-library-video-file"
          />
          <Button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadMutation.isPending}
            data-testid="button-library-upload"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {!uploadMutation.isPending
              ? "Upload video"
              : uploadProgress?.phase === "processing"
                ? "Processing…"
                : uploadProgress && uploadProgress.percent >= 0
                  ? `Uploading ${uploadProgress.percent}%`
                  : "Uploading…"}
          </Button>
          {uploadMutation.isPending && (
            <div className="space-y-1" data-testid="library-video-upload-progress">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width:
                      uploadProgress?.phase === "processing"
                        ? "100%"
                        : `${uploadProgress?.percent && uploadProgress.percent > 0 ? uploadProgress.percent : 3}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {uploadProgress?.phase === "processing"
                  ? "Finalizing on the server — almost done."
                  : "Large videos can take a few minutes on mobile data. Keep this open."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      {videos.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by title, customer, address or job #…"
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-videos"
          />
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading videos…</p>
      ) : videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No videos uploaded yet.</p>
      ) : filteredVideos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No videos match "{search}".</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredVideos.map((v: any) => (
            <Card
              key={v.id}
              className="bg-card border border-border"
              data-testid={`library-video-${v.id}`}
            >
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-0.5">
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
                          className="h-8"
                          autoFocus
                          data-testid={`input-edit-title-${v.id}`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => saveEdit(v.id)}
                          disabled={renameMutation.isPending}
                          aria-label="Save title"
                          data-testid={`button-save-title-${v.id}`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel editing title"
                          data-testid={`button-cancel-title-${v.id}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(v)}
                        className="flex items-center gap-1.5 min-w-0 text-left group w-full"
                        data-testid={`button-edit-title-${v.id}`}
                      >
                        <span className="text-sm font-medium truncate">
                          {v.title || v.originalName || (v.customerName ? `Walkthrough — ${v.customerName}` : "Untitled video")}
                        </span>
                        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                      </button>
                    )}
                    {v.jobId ? (
                      <Link
                        href={`/dispatch?job=${v.jobId}`}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline min-w-0"
                        data-testid={`link-video-job-${v.id}`}
                      >
                        <Briefcase className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {v.customerName || "Linked job"}
                          {v.jobNumber ? ` · #${v.jobNumber}` : ""}
                          {v.jobAddress ? ` · ${v.jobAddress}` : ""}
                        </span>
                      </Link>
                    ) : (
                      <span className="block text-xs text-muted-foreground">Not linked to a job yet</span>
                    )}
                  </div>
                  {!v.jobId && (
                    <Badge variant="outline" className="shrink-0">Unassigned</Badge>
                  )}
                </div>
                <video
                  src={v.url}
                  poster={v.thumbnailUrl || undefined}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full max-h-72 rounded bg-black object-contain"
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
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(`/watch/${v.id}`)}
                    data-testid={`button-library-copy-${v.id}`}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(v.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-library-delete-${v.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
