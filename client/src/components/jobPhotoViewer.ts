/** Pinch range for the job photo viewer. 1 is "fit the screen". */
export const PHOTO_VIEWER_MIN_SCALE = 1;
export const PHOTO_VIEWER_MAX_SCALE = 5;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Scale after a pinch, clamped so the photo cannot shrink past fit. */
export function pinchScale(
  startScale: number,
  startDistance: number,
  distance: number,
): number {
  if (!(startDistance > 0) || !(distance > 0)) return clamp(startScale, PHOTO_VIEWER_MIN_SCALE, PHOTO_VIEWER_MAX_SCALE);
  return clamp(
    startScale * (distance / startDistance),
    PHOTO_VIEWER_MIN_SCALE,
    PHOTO_VIEWER_MAX_SCALE,
  );
}

/**
 * Keep a centered, scaled photo from being panned entirely off the stage.
 * At scale 1 the photo already fits, so pan is zero.
 */
export function clampPan(
  pan: { x: number; y: number },
  scale: number,
  view: { w: number; h: number },
): { x: number; y: number } {
  if (!(scale > 1) || !(view.w > 0) || !(view.h > 0)) return { x: 0, y: 0 };
  const maxX = (view.w * (scale - 1)) / 2;
  const maxY = (view.h * (scale - 1)) / 2;
  return {
    x: clamp(pan.x, -maxX, maxX),
    y: clamp(pan.y, -maxY, maxY),
  };
}

/** Horizontal flick at scale 1 changes photo. A mostly-vertical move does not. */
export function swipeDirection(
  dx: number,
  dy: number,
  scale: number,
): "next" | "prev" | null {
  if (scale > 1) return null;
  if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return null;
  return dx < 0 ? "next" : "prev";
}

/** Downward travel that closes the viewer when the photo is fitted. */
export const PHOTO_VIEWER_DISMISS_DISTANCE = 120;
/** px/ms. A shorter flick than the distance threshold still closes. */
export const PHOTO_VIEWER_DISMISS_VELOCITY = 0.8;

/**
 * A fitted photo follows a downward drag. A zoomed photo does not — that
 * drag is pan. Horizontal travel stays a photo change, not a dismiss.
 */
export function isDismissDrag(dx: number, dy: number, scale: number): boolean {
  if (scale > 1) return false;
  return dy > 24 && dy > Math.abs(dx);
}

/** How far the fitted photo has followed the finger. Never negative. */
export function dismissOffset(dy: number, scale: number): number {
  if (scale > 1) return 0;
  return Math.max(0, dy);
}

/**
 * Close after a firm downward drag (120px) or a fast flick. A short, slow
 * drag snaps back. Zoomed photos never dismiss this way.
 */
export function shouldDismissSwipe(dy: number, elapsedMs: number, scale: number): boolean {
  if (scale > 1 || !(dy > 0)) return false;
  if (dy >= PHOTO_VIEWER_DISMISS_DISTANCE) return true;
  if (dy < 48) return false;
  if (!(elapsedMs > 0)) return true;
  return dy / elapsedMs >= PHOTO_VIEWER_DISMISS_VELOCITY;
}

/** Backdrop stays readable, then fades as the photo is dragged down. */
export function dismissBackdropOpacity(dy: number): number {
  return clamp(1 - Math.max(0, dy) / 360, 0.15, 1);
}
