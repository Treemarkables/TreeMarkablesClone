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
      {/* Brand header. This route is outside the app shell, so nothing else
          applies the iPhone status-bar inset. A fixed h-20 row starts at y=0
          and centres Back inside the status bar (it overlaps the battery and
          iOS will not deliver the tap). The inset is padding on the black
          bar; the 80px row, and the button, sit below it. */}
      <header
        className="sticky top-0 z-20 shrink-0 bg-black"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        <div className="flex h-20 items-center justify-between gap-3 px-4 sm:px-6">
          <img
            src="/treemarkables-logo.png"
            alt="Treemarkables"
            className="h-12 w-auto min-w-0 shrink object-contain object-left"
          />
          {cameFromApp && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.history.back()}
              data-testid="button-watch-back"
              aria-label="Back"
              className="h-12 min-h-12 min-w-12 shrink-0 px-4 text-base font-semibold"
              style={{
                minHeight: 48,
                minWidth: 48,
                height: 48,
                backgroundColor: "#fff",
                color: "#111",
                border: "2px solid #111",
                touchAction: "manipulation",
              }}
            >
              <ArrowLeft className="h-5 w-5" /> Back
            </Button>
          )}
        </div>
      </header>

      <main
        className="flex-1 w-full max-w-4xl mx-auto py-8"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
        }}
      >
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

      <footer
        className="shrink-0 text-center text-xs text-muted-foreground pt-6"
        style={{
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
          paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
        }}
      >
        Powered by Treemarkables
      </footer>
    </div>
  );
}
