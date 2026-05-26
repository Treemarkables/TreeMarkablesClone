// PhotoAnnotator — fullscreen photo-markup editor (CompanyCam-style).
//
// Caller-agnostic: takes an image src, returns shape JSON + a rendered PNG
// data URL. The PNG is at the image's natural resolution. Shape coords are
// normalized as fractions of the image's *width* (so both x and y use the
// same denominator) — this keeps re-edits at different display sizes
// consistent without aspect-ratio surprises.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Line,
  Rect,
  Circle,
  Arrow,
  Text,
  Image as KonvaImage,
} from "react-konva";
import type Konva from "konva";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  Circle as CircleIcon,
  Square,
  Type,
  Pencil,
  Undo2,
  Trash2,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = "pen" | "arrow" | "rect" | "circle" | "text";

type ShapeBase = { id: string; color: string };
type StrokedBase = ShapeBase & { strokeWidth: number };

export type AnnotationShape =
  | (StrokedBase & { type: "pen"; points: number[] }) // [x0,y0,x1,y1,...] normalized
  | (StrokedBase & {
      type: "arrow";
      points: [number, number, number, number]; // [x1,y1,x2,y2] normalized
    })
  | (StrokedBase & {
      type: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
    })
  | (StrokedBase & { type: "circle"; x: number; y: number; r: number })
  | (ShapeBase & {
      type: "text";
      x: number;
      y: number;
      text: string;
      fontSize: number; // normalized fraction of image width
    });

const COLORS = ["#FF3B30", "#39FF14", "#FFFFFF", "#000000", "#FFCC00", "#3498DB"];
const STROKE_WIDTHS = [2, 4, 8];

export interface PhotoAnnotatorProps {
  open: boolean;
  onClose: () => void;
  /** Image to annotate (object URL or http(s)). Must be CORS-readable so we
   *  can export via toDataURL — same-origin GCS or public URLs work. */
  src: string;
  initialAnnotations?: AnnotationShape[] | null;
  /** Called when the user taps Save. Receives the shape JSON; the server
   *  bakes the composite PNG (see server/photoAnnotationRenderer). The
   *  client no longer rasterizes anything — keeps us out of CORS /
   *  tainted-canvas territory entirely. */
  onSave: (payload: {
    annotations: AnnotationShape[];
  }) => Promise<void> | void;
}

export default function PhotoAnnotator({
  open,
  onClose,
  src,
  initialAnnotations,
  onSave,
}: PhotoAnnotatorProps) {
  // Load the image with a plain `new Image()` against the same-origin
  // URL — no fetch, no Blob, no `crossOrigin` attribute. Earlier attempts
  // using either fetch+Blob or `crossOrigin="anonymous"` failed silently
  // on iOS Safari and the Mac shell. The resulting canvas is "tainted"
  // (we can't read its pixels), which is fine because rendering is done
  // server-side now via photoAnnotationRenderer.
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      setImageError(null);
      return;
    }
    let cancelled = false;
    setImage(null);
    setImageError(null);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) {
        console.error("PhotoAnnotator: image load failed for", src);
        setImageError(`Couldn't load image (…${src.slice(-40)})`);
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Stage size in CSS pixels (fit-to-container, image-aspect-preserving)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!image) return;
    // Use the viewport as the primary source of truth for stage sizing,
    // not the container's clientWidth/clientHeight.
    //
    // Why: in embedded webviews (iOS WKWebView and the Mac Inflow shell
    // we tested in), the flex-1 container's measurement reads as 0×0
    // even after the dialog is fully laid out. Earlier rAF/RO retries
    // didn't fix it — measurement just kept reading 0. Falling back to
    // window dimensions sidesteps the broken container measurement
    // entirely while still giving us the right aspect-fit dimensions.
    //
    // Top + bottom toolbars together are ~120-150px depending on safe
    // areas. Subtracting 180 leaves a small breathing margin so the
    // canvas doesn't bleed under the toolbars.
    const update = () => {
      let cw = window.innerWidth;
      let ch = Math.max(200, window.innerHeight - 180);

      // If the container DOES have a real measurement, prefer it — it's
      // more precise than the window heuristic above.
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0) cw = rect.width;
        if (rect.height > 0) ch = rect.height;
      }
      if (cw === 0 || ch === 0) return;

      const imgRatio = image.naturalWidth / image.naturalHeight;
      const conRatio = cw / ch;
      const w = conRatio > imgRatio ? ch * imgRatio : cw;
      const h = conRatio > imgRatio ? ch : cw / imgRatio;
      setStageSize({ w, h });
    };

    update();
    // Re-measure after one frame and one short timeout in case the
    // container's real dimensions become available later — we want to
    // tighten the fit when we can.
    const raf = requestAnimationFrame(update);
    const t1 = setTimeout(update, 100);
    const t2 = setTimeout(update, 500);

    const el = containerRef.current;
    const ro = el ? new ResizeObserver(update) : null;
    if (ro && el) ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [image, open]);

  // Toolbar state
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState("#FF3B30");
  const [strokeWidth, setStrokeWidth] = useState(4);

  // Shapes (normalized fractions of image width)
  const [shapes, setShapes] = useState<AnnotationShape[]>(
    initialAnnotations ?? [],
  );
  const [drafting, setDrafting] = useState<AnnotationShape | null>(null);

  // Text overlay state — separate from shapes until committed
  const [textEditing, setTextEditing] = useState<{
    id: string;
    px: number; // stage-pixel x (for overlay positioning)
    py: number;
    value: string;
  } | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setShapes(initialAnnotations ?? []);
      setDrafting(null);
      setTextEditing(null);
    }
  }, [open, initialAnnotations]);

  // --- coord helpers: normalize against width so x and y share a denominator
  const denom = stageSize.w || 1;
  const toNorm = useCallback(
    (px: number, py: number) => ({ x: px / denom, y: py / denom }),
    [denom],
  );
  const fromNorm = useCallback(
    (nx: number, ny: number) => ({ x: nx * denom, y: ny * denom }),
    [denom],
  );

  const pointerNorm = (e: Konva.KonvaEventObject<unknown>) => {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return toNorm(pos.x, pos.y);
  };

  // --- drawing handlers
  const handlePointerDown = (e: Konva.KonvaEventObject<unknown>) => {
    if (textEditing) return; // committing text on next blur
    const p = pointerNorm(e);
    if (!p) return;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    if (tool === "text") {
      const pos = fromNorm(p.x, p.y);
      setTextEditing({ id, px: pos.x, py: pos.y, value: "" });
      return;
    }

    if (tool === "pen") {
      setDrafting({
        type: "pen",
        id,
        color,
        strokeWidth,
        points: [p.x, p.y],
      });
    } else if (tool === "arrow") {
      setDrafting({
        type: "arrow",
        id,
        color,
        strokeWidth,
        points: [p.x, p.y, p.x, p.y],
      });
    } else if (tool === "rect") {
      setDrafting({
        type: "rect",
        id,
        color,
        strokeWidth,
        x: p.x,
        y: p.y,
        w: 0,
        h: 0,
      });
    } else if (tool === "circle") {
      setDrafting({
        type: "circle",
        id,
        color,
        strokeWidth,
        x: p.x,
        y: p.y,
        r: 0,
      });
    }
  };

  const handlePointerMove = (e: Konva.KonvaEventObject<unknown>) => {
    if (!drafting) return;
    const p = pointerNorm(e);
    if (!p) return;
    if (drafting.type === "pen") {
      setDrafting({ ...drafting, points: [...drafting.points, p.x, p.y] });
    } else if (drafting.type === "arrow") {
      setDrafting({
        ...drafting,
        points: [drafting.points[0], drafting.points[1], p.x, p.y],
      });
    } else if (drafting.type === "rect") {
      setDrafting({
        ...drafting,
        w: p.x - drafting.x,
        h: p.y - drafting.y,
      });
    } else if (drafting.type === "circle") {
      const dx = p.x - drafting.x;
      const dy = p.y - drafting.y;
      setDrafting({ ...drafting, r: Math.sqrt(dx * dx + dy * dy) });
    }
  };

  const handlePointerUp = () => {
    if (!drafting) return;
    // Discard zero/near-zero shapes — likely accidental taps
    let significant = true;
    if (drafting.type === "pen") {
      significant = drafting.points.length >= 4;
    } else if (drafting.type === "arrow") {
      const [x1, y1, x2, y2] = drafting.points;
      significant = Math.hypot(x2 - x1, y2 - y1) > 0.005;
    } else if (drafting.type === "rect") {
      significant = Math.abs(drafting.w) > 0.005 && Math.abs(drafting.h) > 0.005;
    } else if (drafting.type === "circle") {
      significant = drafting.r > 0.005;
    }
    if (significant) setShapes((s) => [...s, drafting]);
    setDrafting(null);
  };

  const commitText = () => {
    if (!textEditing) return;
    const value = textEditing.value.trim();
    if (value) {
      const n = toNorm(textEditing.px, textEditing.py);
      setShapes((s) => [
        ...s,
        {
          type: "text",
          id: textEditing.id,
          x: n.x,
          y: n.y,
          text: value,
          color,
          fontSize: 0.04, // 4% of image width — looks roughly like 24px on a 600px-wide preview
        },
      ]);
    }
    setTextEditing(null);
  };

  const undo = () => setShapes((s) => s.slice(0, -1));
  const clearAll = () => setShapes([]);

  // --- save
  // Server bakes the composite PNG from the shape JSON (see
  // server/photoAnnotationRenderer). The client doesn't touch toDataURL
  // anymore — no CORS, no tainted-canvas issues.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const handleSave = async () => {
    if (!image) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({ annotations: shapes });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  // --- render shapes
  const renderShape = (s: AnnotationShape) => {
    const px = (n: number) => n * stageSize.w;
    // Because we normalize y by width too, y * stageSize.w gives back the
    // correct pixel y. Confirmed: stageSize.h = stageSize.w * (imgH / imgW),
    // so a y-fraction of imgH/imgW maps to stageSize.h. ✓
    switch (s.type) {
      case "pen":
        return (
          <Line
            key={s.id}
            points={s.points.map((v) => v * stageSize.w)}
            stroke={s.color}
            strokeWidth={s.strokeWidth}
            tension={0.3}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        );
      case "arrow":
        return (
          <Arrow
            key={s.id}
            points={[
              px(s.points[0]),
              px(s.points[1]),
              px(s.points[2]),
              px(s.points[3]),
            ]}
            stroke={s.color}
            strokeWidth={s.strokeWidth}
            fill={s.color}
            pointerLength={Math.max(10, s.strokeWidth * 3)}
            pointerWidth={Math.max(10, s.strokeWidth * 3)}
            listening={false}
          />
        );
      case "rect":
        return (
          <Rect
            key={s.id}
            x={px(s.x)}
            y={px(s.y)}
            width={px(s.w)}
            height={px(s.h)}
            stroke={s.color}
            strokeWidth={s.strokeWidth}
            listening={false}
          />
        );
      case "circle":
        return (
          <Circle
            key={s.id}
            x={px(s.x)}
            y={px(s.y)}
            radius={px(s.r)}
            stroke={s.color}
            strokeWidth={s.strokeWidth}
            listening={false}
          />
        );
      case "text":
        return (
          <Text
            key={s.id}
            x={px(s.x)}
            y={px(s.y)}
            text={s.text}
            fill={s.color}
            fontSize={px(s.fontSize)}
            fontStyle="bold"
            // Faint outline so text is legible on any background. Konva
            // strokes the glyph itself when stroke + strokeWidth are set.
            stroke="black"
            strokeWidth={Math.max(1, px(s.fontSize) * 0.04)}
            fillAfterStrokeEnabled
            listening={false}
          />
        );
    }
  };

  // Offset of the stage inside its (centered) flex container — used to
  // position the text-editing overlay correctly.
  const containerEl = containerRef.current;
  const stageOffsetX = containerEl
    ? (containerEl.clientWidth - stageSize.w) / 2
    : 0;
  const stageOffsetY = containerEl
    ? (containerEl.clientHeight - stageSize.h) / 2
    : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-none w-screen h-[100dvh] p-0 gap-0 border-0 rounded-none sm:rounded-none flex flex-col bg-black translate-x-0 translate-y-0 left-0 top-0"
        data-testid="modal-photo-annotator"
      >
        {/* Top bar — pt accounts for the iPhone status bar / notch */}
        <div
          className="flex items-center justify-between px-3 pb-3 bg-neutral-900 border-b border-neutral-800 flex-shrink-0"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={saving}
            className="text-white hover:bg-neutral-800"
            data-testid="button-cancel-annotate"
          >
            <X className="w-4 h-4 mr-1" /> Cancel
          </Button>
          <div className="text-white text-sm font-medium">Annotate photo</div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !image}
            data-testid="button-save-annotate"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            Save
          </Button>
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden flex items-center justify-center select-none"
        >
          {/* Surface load failures instead of leaving the canvas
              mysteriously blank. */}
          {imageError && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm px-6 text-center">
              Couldn't load photo: {imageError}
            </div>
          )}
          {!src && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm px-6 text-center">
              No photo URL provided to the editor.
            </div>
          )}
          {!image && !imageError && src && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
          {saveError && (
            <div className="absolute bottom-2 left-2 right-2 z-10 text-xs text-white bg-red-600/90 px-3 py-2 rounded">
              {saveError}
            </div>
          )}
          {image && stageSize.w > 0 && (
            <Stage
              ref={stageRef}
              width={stageSize.w}
              height={stageSize.h}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            >
              <Layer>
                <KonvaImage
                  image={image}
                  width={stageSize.w}
                  height={stageSize.h}
                  listening={false}
                />
                {shapes.map(renderShape)}
                {drafting && renderShape(drafting)}
              </Layer>
            </Stage>
          )}

          {/* Text input overlay (HTML, not Konva, so the user can type) */}
          {textEditing && (
            <textarea
              autoFocus
              value={textEditing.value}
              onChange={(e) =>
                setTextEditing({ ...textEditing, value: e.target.value })
              }
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitText();
                } else if (e.key === "Escape") {
                  setTextEditing(null);
                }
              }}
              className="absolute bg-transparent border border-white/60 outline-none resize-none font-bold leading-tight p-1"
              style={{
                left: stageOffsetX + textEditing.px,
                top: stageOffsetY + textEditing.py,
                color,
                fontSize: stageSize.w * 0.04,
                minWidth: 80,
                textShadow:
                  "0 0 2px black, 0 0 2px black, 0 0 2px black, 0 0 2px black",
              }}
              data-testid="textarea-annotate-text"
            />
          )}
        </div>

        {/* Bottom toolbar — pb accounts for the iPhone home indicator */}
        <div
          className="bg-neutral-900 border-t border-neutral-800 flex-shrink-0 px-2 pt-2 flex flex-wrap items-center gap-1.5 sm:gap-2 justify-center"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <ToolBtn
            icon={<ArrowUpRight className="w-5 h-5" />}
            active={tool === "arrow"}
            onClick={() => setTool("arrow")}
            label="Arrow"
          />
          <ToolBtn
            icon={<CircleIcon className="w-5 h-5" />}
            active={tool === "circle"}
            onClick={() => setTool("circle")}
            label="Circle"
          />
          <ToolBtn
            icon={<Square className="w-5 h-5" />}
            active={tool === "rect"}
            onClick={() => setTool("rect")}
            label="Rect"
          />
          <ToolBtn
            icon={<Pencil className="w-5 h-5" />}
            active={tool === "pen"}
            onClick={() => setTool("pen")}
            label="Draw"
          />
          <ToolBtn
            icon={<Type className="w-5 h-5" />}
            active={tool === "text"}
            onClick={() => setTool("text")}
            label="Text"
          />

          <div className="w-px h-6 bg-neutral-700 mx-1" />

          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "w-7 h-7 rounded-full border-2 transition-transform",
                color === c
                  ? "border-white scale-110"
                  : "border-neutral-600",
              )}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
              data-testid={`button-color-${c.replace("#", "")}`}
            />
          ))}

          <div className="w-px h-6 bg-neutral-700 mx-1" />

          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setStrokeWidth(w)}
              className={cn(
                "w-7 h-7 rounded-full border-2 flex items-center justify-center",
                strokeWidth === w ? "border-white" : "border-neutral-600",
              )}
              aria-label={`Stroke width ${w}`}
              data-testid={`button-stroke-${w}`}
            >
              <div
                className="rounded-full bg-white"
                style={{ width: w * 2, height: w * 2 }}
              />
            </button>
          ))}

          <div className="w-px h-6 bg-neutral-700 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={shapes.length === 0}
            className="text-white hover:bg-neutral-800"
            data-testid="button-undo-annotate"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={shapes.length === 0}
            className="text-white hover:bg-neutral-800"
            data-testid="button-clear-annotate"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolBtn({
  icon,
  active,
  onClick,
  label,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "w-10 h-10 rounded-md flex items-center justify-center transition-colors",
        active
          ? "bg-white text-black"
          : "text-white hover:bg-neutral-800",
      )}
      data-testid={`button-tool-${label.toLowerCase()}`}
    >
      {icon}
    </button>
  );
}
