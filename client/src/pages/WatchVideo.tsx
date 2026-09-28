// Public, branded "watch page" for a shared video (the Loom-style share link).
// No auth: the video id in the URL is an unguessable UUID, so the link itself
// grants access. Reached at /watch/:videoId; this is what the Copy-link buttons
// hand out instead of the raw object-stream URL.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAppBooted } from "@/lib/nativeBootRecovery";
import { videoHasCaptions } from "@/lib/videoCaptions";

interface PublicVideo {
  id: string;
  title?: string | null;
  description?: string | null;
  url: string;
  thumbnailUrl?: string | null;
  captionsStatus?: string | null;
  /** True only when captions_vtt is stored. Status "ready" alone is not enough. */
  hasCaptions?: boolean | null;
  createdAt?: string | null;
}

/**
 * Lift #inflow-boot for every watch-page commit. Job-card videos are stored
 * with title null, so `<main>` is only a `<video>` and the text detector
 * never fires. The loading spinner and "Video unavailable" states also have
 * to be visible while the public fetch is in flight or has failed.
 */
export function markWatchVideoBooted(video?: { title?: string | null } | null): void {
  void video;
  markAppBooted();
}

export default function WatchVideo() {
  const [, params] = useRoute("/watch/:videoId");
  const videoId = params?.videoId;

  // Staff reach this page from inside the app (Library links here with a full
  // page load), which strands them with no way back. Customers arrive from a
  // shared link (external or empty referrer) and should keep the clean page.
  const cameFromApp = (() => {
    try {
      return !!document.referrer && new URL(document.referrer).origin === window.location.origin;
    } catch {
      return false;
    }
  })();

  const { data, isLoading, isError } = useQuery<{ success: boolean; data: PublicVideo }>({
    queryKey: ["/api/videos", videoId, "public"],
    queryFn: async () => {
      const r = await fetch(`/api/videos/${videoId}/public`);
      if (!r.ok) throw new Error("Video not found");
      return r.json();
    },
    enabled: !!videoId,
  });

  const video = data?.data;

  // Mount, not "when the title arrives". A slow or failed fetch, and a
  // title-less player, must not stay under the boot overlay.
  useEffect(() => {
    markWatchVideoBooted(video ?? null);
  }, [video]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Brand header */}
      <header className="bg-black h-20 flex items-center justify-between px-4 sm:px-6 shrink-0">
        <img
          src="/treemarkables-logo.png"
          alt="Treemarkables"
          className="h-12 w-auto"
        />
        {cameFromApp && (
          <Button
            type="button"
            variant="ghost"
            className="text-white"
            onClick={() => window.history.back()}
            data-testid="button-watch-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        )}
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError || !video ? (
          <div className="text-center py-24">
            <h1 className="text-xl font-semibold mb-2">Video unavailable</h1>
            <p className="text-muted-foreground">
              This video may have been removed, or the link is incorrect.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <video
              src={video.url}
              poster={video.thumbnailUrl || undefined}
              controls
              autoPlay
              playsInline
              className="w-full max-h-[70vh] rounded-lg bg-black object-contain"
              data-testid="watch-video-player"
            >
              {videoHasCaptions(video) && (
                <track
                  kind="captions"
                  srcLang="en"
                  label="English"
                  src={`/api/videos/${video.id}/captions.vtt`}
                  default
                />
              )}
            </video>
            {video.title && (
              <h1 className="text-2xl font-semibold" data-testid="watch-video-title">
                {video.title}
              </h1>
            )}
            {video.description && (
              <p className="text-muted-foreground whitespace-pre-wrap">
                {video.description}
              </p>
            )}
          </div>
        )}
      </main>

      <footer className="shrink-0 text-center text-xs text-muted-foreground py-6">
        Powered by Treemarkables
      </footer>
    </div>
  );
}
