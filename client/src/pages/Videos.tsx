// Videos library — central upload home for walkthrough videos (Loom replacement).
// Lets staff upload a video even before a job card exists; videos can be linked
// to a job later (backend supports PATCH /api/videos/:id { jobId }). Knowledge /
// how-to videos will also live here once that surface is built (schema-ready).
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Upload, Copy, Video as VideoIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Videos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");

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
      const form = new FormData();
      // Text fields must precede the file part so the streaming upload parses them in time.
      if (title.trim()) form.append("title", title.trim());
      form.append("video", file);
      const r = await fetch(`/api/videos`, {
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
    onSuccess: () => {
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: videosKey });
    },
    onError: (error: any) =>
      toast({
        title: "Video upload failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      }),
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
            <Upload className="w-4 h-4 mr-2" />
            {uploadMutation.isPending ? "Uploading…" : "Upload video"}
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading videos…</p>
      ) : videos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No videos uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((v: any) => (
            <Card
              key={v.id}
              className="bg-card border border-border"
              data-testid={`library-video-${v.id}`}
            >
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">
                    {v.title || v.originalName || "Untitled"}
                  </p>
                  {v.jobId ? (
                    <Badge variant="secondary">Linked to job</Badge>
                  ) : (
                    <Badge variant="outline">Unassigned</Badge>
                  )}
                </div>
                <video
                  src={v.url}
                  poster={v.thumbnailUrl || undefined}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full rounded bg-black"
                />
                <div className="flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(v.url)}
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
