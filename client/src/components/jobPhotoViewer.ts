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
