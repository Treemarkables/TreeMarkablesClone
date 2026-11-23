/**
 * True only when a caption file actually exists.
 * `captionsStatus === "ready"` alone is not enough: a logged-out watch page
 * was rendering a `<track>` at `/api/videos/:id/captions.vtt` that 404s when
 * the row has no `captions_vtt` (or the anonymous request cannot see it).
 */
export function videoHasCaptions(
  video: {
    captionsStatus?: string | null;
    captionsVtt?: string | null;
    hasCaptions?: boolean | null;
  } | null | undefined,
): boolean {
  if (!video) return false;
  if (video.hasCaptions === true) return true;
  if (video.hasCaptions === false) return false;
  return (
    video.captionsStatus === "ready" &&
    typeof video.captionsVtt === "string" &&
    video.captionsVtt.trim().length > 0
  );
}
