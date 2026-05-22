// Public, branded "watch page" for a shared video (the Loom-style share link).
// No auth: the video id in the URL is an unguessable UUID, so the link itself
// grants access. Reached at /watch/:videoId; this is what the Copy-link buttons
// hand out instead of the raw object-stream URL.
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";

interface PublicVideo {
  id: string;
  title?: string | null;
  description?: string | null;
  url: string;
  thumbnailUrl?: string | null;
  createdAt?: string | null;
}

export default function WatchVideo() {
  const [, params] = useRoute("/watch/:videoId");
  const videoId = params?.videoId;

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Brand header */}
      <header className="bg-black h-20 flex items-center px-4 sm:px-6 shrink-0">
        <img
          src="/treemarkables-logo.png"
          alt="Treemarkables"
          className="h-12 w-auto"
        />
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
            />
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
