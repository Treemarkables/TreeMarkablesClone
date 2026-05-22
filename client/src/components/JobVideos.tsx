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
import { Trash2, Upload, Copy, Video as VideoIcon } from "lucide-react";
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
    onSuccess: () => {
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: videosKey });
    },
    onError: (error: any) => {
      toast({
        title: "Video upload failed",
        description: error?.message || "Please try again.",
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
    <Card className="bg-card border border-border">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <VideoIcon className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Job Videos</h3>
        </div>

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

        {/* Video list */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading videos…</p>
        ) : videos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No videos yet. Record on site, then upload here to share with the customer.
          </p>
        ) : (
          <div className="space-y-3">
            {videos.map((v: any) => (
              <div
                key={v.id}
                className="rounded-lg border border-border p-2 space-y-2"
                data-testid={`job-video-${v.id}`}
              >
                {v.title && <p className="text-xs font-medium">{v.title}</p>}
                <video
                  src={v.url}
                  poster={v.thumbnailUrl || undefined}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full max-h-80 rounded bg-black object-contain"
                />
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(v.url)}
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
      </CardContent>
    </Card>
  );
}
