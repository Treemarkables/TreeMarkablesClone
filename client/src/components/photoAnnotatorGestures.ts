// Phone drawing sends more than one pointer stream for a single finger
// (touch, then a compatibility mouse event, sometimes a late pointerup).
// The editor used to listen to all of them, so the extra down/up after the
// first symbol ate the next one. One stroke is tracked here; anything that
// is not that stroke is ignored.

export interface ActiveStroke<T> {
  pointerId: number | null;
  draft: T;
}

export type StrokePhase = "start" | "update" | "finish" | "ignore";

export function strokePhase(
  active: ActiveStroke<unknown> | null,
  event: { type: "down" | "move" | "up"; pointerId: number | null },
): StrokePhase {
  if (event.type === "down") {
    // A second finger, or the synthetic click after a stroke, must not
    // replace the mark already on the screen.
    return active ? "ignore" : "start";
  }
  if (!active) return "ignore";
  if (
    active.pointerId != null &&
    event.pointerId != null &&
    active.pointerId !== event.pointerId
  ) {
    return "ignore";
  }
  return event.type === "move" ? "update" : "finish";
}
