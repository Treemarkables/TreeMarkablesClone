import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOverlayHistory } from "@/hooks/useOverlayHistory";
import {
  clampPan,
  dismissBackdropOpacity,
  dismissOffset,
  isDismissDrag,
  pinchScale,
  pointerDistance,
  shouldDismissSwipe,
  swipeDirection,
  PHOTO_VIEWER_MAX_SCALE,
} from "@/components/jobPhotoViewer";

/**
 * Full-screen job photo viewer.
 *
 * Android WebView lays an `<img>` out at its camera pixel size when the only
 * constraints are max-width / max-height on a flex child (percentage
 * max-height does not resolve, and min-height:auto refuses to shrink). The
 * old viewer was that image inside a dialog centered with
 * top:50% + translateY(-50%), so the screen showed the middle of the photo
 * and the Close button sat above the viewport. WebView pinch-zoom is off, so
 * there was no way to zoom back out.
 *
 * This viewer gives the image a definite box (absolute, 100% × 100%,
 * object-fit: contain) so it cannot change layout size. Pinch scales that
 * box with a transform. Close is a 56px circle, position:fixed, top-right,
 * below the status bar (safe-area plus padding), and above the counter.
 * A downward drag on a fitted photo follows the finger and dismisses; a
 * zoomed photo still pans. Opening pushes a history entry so Android back
 * closes the viewer.
 */
export function JobPhotoViewer({
  open,
  photos,
  index,
  onIndexChange,
  onClose,
  src,
  title = "Job photo",
  onAnnotate,
  onDownload,
  downloading = false,
}: {
  open: boolean;
  photos: string[];
  index: number;
  onIndexChange?: (index: number) => void;
  onClose: () => void;
  /** Display URL for the current index (annotated PNG when one exists). */
  src?: string | null;
  title?: string;
  onAnnotate?: () => void;
  onDownload?: () => void;
  downloading?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useOverlayHistory(open, () => onCloseRef.current());
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: "pan" | "pinch" | "swipe" | "dismiss";
    startScale: number;
    startDistance: number;
    startPan: { x: number; y: number };
    originX: number;
    originY: number;
    startedAt: number;
  } | null>(null);
  const lastTap = useRef(0);
  const closingRef = useRef(false);
  const [dismissY, setDismissY] = useState(0);
  const [dismissDragging, setDismissDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    scaleRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setScale(1);
    setPan({ x: 0, y: 0 });
    closingRef.current = false;
    setDismissY(0);
    setDismissDragging(false);
  }, [index, src, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // A photo annotator (or another dialog) portaled above this viewer
        // must take Escape. Closing both at once hid the photo the user
        // was marking up.
        const dialogs = document.querySelectorAll("[role='dialog']");
        const top = dialogs[dialogs.length - 1];
        if (top && top.getAttribute("data-testid") !== "job-photo-viewer") return;
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === "ArrowRight") {
        onIndexChange?.(Math.min(photos.length - 1, index + 1));
      } else if (event.key === "ArrowLeft") {
        onIndexChange?.(Math.max(0, index - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length, onIndexChange]);

  if (!open || !src) return null;

  const viewSize = () => {
    const rect = stageRef.current?.getBoundingClientRect();
    return { w: rect?.width ?? 0, h: rect?.height ?? 0 };
  };

  const commit = (nextScale: number, nextPan: { x: number; y: number }) => {
    const next = clampPan(nextPan, nextScale, viewSize());
    scaleRef.current = nextScale;
    panRef.current = next;
    setScale(nextScale);
    setPan(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (closingRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        mode: "pinch",
        startScale: scaleRef.current,
        startDistance: pointerDistance(a, b),
        startPan: { ...panRef.current },
        originX: event.clientX,
        originY: event.clientY,
        startedAt: Date.now(),
      };
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      if (scaleRef.current > 1) commit(1, { x: 0, y: 0 });
      else commit(Math.min(2.5, PHOTO_VIEWER_MAX_SCALE), { x: 0, y: 0 });
      gesture.current = null;
      return;
    }
    lastTap.current = now;
    gesture.current = {
      mode: scaleRef.current > 1 ? "pan" : "swipe",
      startScale: scaleRef.current,
      startDistance: 0,
      startPan: { ...panRef.current },
      originX: event.clientX,
      originY: event.clientY,
      startedAt: Date.now(),
    };
  };

  const finishDismiss = (dy: number) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setDismissDragging(false);
    setDismissY(Math.max(dy, 360));
    window.setTimeout(() => onCloseRef.current(), 180);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current;
    if (!current) return;
    if (current.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      commit(pinchScale(current.startScale, current.startDistance, pointerDistance(a, b)), current.startPan);
      return;
    }
    if (current.mode === "pan") {
      commit(current.startScale, {
        x: current.startPan.x + (event.clientX - current.originX),
        y: current.startPan.y + (event.clientY - current.originY),
      });
      return;
    }
    const dx = event.clientX - current.originX;
    const dy = event.clientY - current.originY;
    if (current.mode === "dismiss" || isDismissDrag(dx, dy, scaleRef.current)) {
      gesture.current = { ...current, mode: "dismiss" };
      setDismissDragging(true);
      setDismissY(dismissOffset(dy, scaleRef.current));
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0 && current?.mode === "dismiss") {
      const dy = event.clientY - current.originY;
      if (shouldDismissSwipe(dy, Date.now() - current.startedAt, scaleRef.current)) {
        finishDismiss(dy);
      } else {
        setDismissDragging(false);
        setDismissY(0);
      }
    } else if (pointers.current.size === 0 && current?.mode === "swipe") {
      const direction = swipeDirection(
        event.clientX - current.originX,
        event.clientY - current.originY,
        scaleRef.current,
      );
      if (direction === "next" && index < photos.length - 1) onIndexChange?.(index + 1);
      if (direction === "prev" && index > 0) onIndexChange?.(index - 1);
    }
    if (pointers.current.size < 2 && current?.mode === "pinch") {
      gesture.current = null;
    }
    if (pointers.current.size === 0) gesture.current = null;
  };

  const zoomed = scale > 1;

  return (
    <div
      className="fixed inset-0 z-[90] flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden text-white"
      data-testid="job-photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        backgroundColor: `rgba(0,0,0,${dismissBackdropOpacity(dismissY)})`,
        transition: dismissDragging ? "none" : "background-color 180ms ease-out",
      }}
    >
      <div
        className="pointer-events-none fixed z-[99] w-max max-w-[calc(100%-6.5rem)] truncate text-sm text-white"
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top) + 34px)",
          left: "calc(env(safe-area-inset-left) + 16px)",
          width: "max-content",
        }}
        data-testid="text-photo-count"
      >
        {photos.length > 1 ? `${index + 1} of ${photos.length}` : title}
      </div>

      <div
        ref={stageRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(event) => event.preventDefault()}
      >
        {/* Definite 100% box. object-fit contain letterboxes the bitmap.
            Pinch zoom does not change layout. A dismiss drag translates this
            wrapper only, so the fitted photo follows the finger. */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translateY(${dismissY}px)`,
            transition: dismissDragging ? "none" : "transform 180ms ease-out",
          }}
        >
          <img
            src={src}
            alt={`${title} ${index + 1}`}
            draggable={false}
            data-testid="img-photo-viewer"
            className="absolute inset-0 h-full w-full select-none object-contain"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "center center",
            }}
          />
        </div>

        {photos.length > 1 && index > 0 && !zoomed && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute left-3 top-1/2 z-[91] h-11 w-11 -translate-y-1/2 rounded-full border-white/40 bg-black/60 text-white"
            onClick={() => onIndexChange?.(index - 1)}
            aria-label="Previous photo"
            data-testid="button-previous-photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {photos.length > 1 && index < photos.length - 1 && !zoomed && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute right-3 top-1/2 z-[91] h-11 w-11 -translate-y-1/2 rounded-full border-white/40 bg-black/60 text-white"
            onClick={() => onIndexChange?.(index + 1)}
            aria-label="Next photo"
            data-testid="button-next-photo"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}
      </div>

      {(onAnnotate || onDownload || photos.length > 1) && (
        <div
          className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-white/15 px-3 pt-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {onAnnotate && (
            <Button
              type="button"
              variant="outline"
              className="border-white/30 bg-transparent text-white"
              onClick={onAnnotate}
              data-testid="button-annotate-photo"
            >
              Annotate
            </Button>
          )}
          {onDownload && (
            <Button
              type="button"
              className="min-w-0 flex-1"
              onClick={onDownload}
              disabled={downloading}
              data-testid="button-download-photo"
            >
              {downloading ? "Preparing..." : "Download Photo"}
            </Button>
          )}
          {photos.length > 1 && (
            <div className="flex max-w-full items-center gap-2 overflow-x-auto px-1">
              {photos.map((_, dot) => (
                <button
                  key={dot}
                  type="button"
                  onClick={() => onIndexChange?.(dot)}
                  aria-label={`Show photo ${dot + 1}`}
                  data-testid={`button-photo-dot-${dot}`}
                  className={`h-2 rounded-full ${dot === index ? "w-6 bg-white" : "w-2 bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onClose}
        aria-label="Close photo"
        data-testid="button-close-photo"
        className="fixed z-[100] h-14 w-14 min-h-14 min-w-14 shrink-0 rounded-full border-2 border-white bg-black text-white shadow-lg [&_svg]:size-7"
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top) + 16px)",
          right: "calc(env(safe-area-inset-right) + 12px)",
          width: 56,
          height: 56,
          minWidth: 56,
          minHeight: 56,
          zIndex: 100,
          backgroundColor: "#000",
          color: "#fff",
          border: "2px solid #fff",
          borderRadius: 9999,
          touchAction: "manipulation",
        }}
      >
        <X style={{ width: 28, height: 28 }} strokeWidth={2.5} />
      </Button>
    </div>
  );
}
