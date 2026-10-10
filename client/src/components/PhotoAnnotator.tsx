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
  Group,
  Image as KonvaImage,
} from "react-konva";
import type Konva from "konva";
import { annotationTextFrame } from "@shared/annotationTextWrap";
import {
  strokePhase,
  type ActiveStroke,
} from "@/components/photoAnnotatorGestures";
import {
  ANNOTATOR_DIALOG_CLASS,
  arrowHeadScreenPx,
  clientToStagePx,
  fitImageContain,
  isSignificantMark,
  moveDraft,
} from "@/components/photoAnnotatorGeometry";
import {
  applyTextBoxPointer,
  defaultTextBox,
  fontSizeNormForStroke,
  textBoxCoveringContent,
  type TextBoxHandle,
  type TextBoxNorm,
} from "@/components/photoAnnotatorTextBox";
import { PhotoAnnotatorTextBox } from "@/components/PhotoAnnotatorTextBox";
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
      fontSize: number; // normalized fraction of image width; toolbar size, not the box
      /** Wrap width, fraction of image width. Older marks omit this. */
      boxWidth?: number;
      /** Box height, fraction of image width. Older marks omit this. */
      boxHeight?: number;
    });

const COLORS = ["#FF3B30", "#34C759", "#FFFFFF", "#000000", "#FFCC00", "#3498DB"];
const STROKE_WIDTHS = [2, 4, 8];

type TextEditing = TextBoxNorm & {
  id: string;
  value: string;
  fontSize: number;
  color: string;
};

type TextDrag = {
  pointerId: number;
  handle: TextBoxHandle;
  start: TextBoxNorm;
  originX: number;
  originY: number;
  moved: boolean;
  mode: "edit" | "selected";
  shapeId: string;
  fontSize: number;
  text: string;
};

function textShapeFromDraft(draft: TextEditing, value: string): AnnotationShape {
  return {
    type: "text",
    id: draft.id,
    x: draft.x,
    y: draft.y,
    text: value,
    color: draft.color,
    fontSize: draft.fontSize,
    boxWidth: draft.boxWidth,
    boxHeight: draft.boxHeight,
  };
}

function isSignificant(drafting: AnnotationShape): boolean {
  if (drafting.type === "text") return false;
  return isSignificantMark(drafting);
}

function pointerIdOf(e: Konva.KonvaEventObject<PointerEvent>): number | null {
  const id = e.evt?.pointerId;
  return typeof id === "number" ? id : null;
}

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
    /** Stage width in CSS pixels, so the server can scale screen-pixel strokes. */
    stageWidth: number;
  }) => Promise<void> | void;
}

export default function PhotoAnnotator({
  open,
  onClose,
  src,
  initialAnnotations,
  onSave,
}: PhotoAnnotatorProps) {
  // Load the image via fetch → Blob → object URL instead of useImage with
  // crossOrigin="anonymous". Two reasons:
  //   1. iOS Safari refuses to load same-origin images that declare a CORS
  //      attribute unless the server also sends matching CORS headers, and
  //      our /objects/photos/:filename route doesn't. Without this workaround
  //      the canvas stays empty on iPhone (the bug that prompted this fix).
  //   2. Object URLs are always same-origin, so the Konva canvas is never
  //      tainted — stage.toDataURL() on save still works for the export.
  // Load the image with the simplest possible path: a plain `new Image()`
  // pointed at the same-origin URL. No fetch, no Blob, no crossOrigin
  // attribute. Earlier attempts (useImage with crossOrigin="anonymous",
  // then fetch → Blob → object URL) both failed silently on iOS Safari,
  // leaving the canvas blank with no error to surface.
  //
  // Trade-off: the canvas is "tainted" (because we can't prove the image
  // is CORS-clean), so stage.toDataURL() will throw on save. handleSave
  // catches that SecurityError and shows a user-facing message. A proper
  // fix (server-side baking via sharp, like composeBeforeAfter) is
  // tracked as a follow-up — right now image display takes priority.
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
      const next = fitImageContain(
        image.naturalWidth,
        image.naturalHeight,
        cw,
        ch,
      );
      if (next.w <= 0 || next.h <= 0) return;
      setStageSize(next);
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
  // The stroke under the finger. Updated synchronously so a move or lift
  // that arrives before React re-renders still belongs to this symbol.
  const activeStrokeRef = useRef<ActiveStroke<AnnotationShape> | null>(null);
  // Once the user draws, a late annotation fetch must not replace the canvas
  // with the (still empty) server copy.
  const editedRef = useRef(false);

  // Text box being typed. Position and size are fractions of image width.
  const [textEditing, setTextEditing] = useState<TextEditing | null>(null);
  const textEditingRef = useRef<TextEditing | null>(null);
  textEditingRef.current = textEditing;
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const textDragRef = useRef<TextDrag | null>(null);
  const editTextRef = useRef<(id: string) => void>(() => {});

  // Load saved shapes when the editor opens. Skip once the user has drawn,
  // or a prefetch that resolves mid-stroke wipes the marks before Save.
  useEffect(() => {
    if (!open) {
      editedRef.current = false;
      return;
    }
    if (editedRef.current) return;
    setShapes(initialAnnotations ?? []);
    activeStrokeRef.current = null;
    setDrafting(null);
    setTextEditing(null);
    setSelectedTextId(null);
    textDragRef.current = null;
  }, [open, initialAnnotations]);

  // --- coord helpers: normalize against width so x and y share a denominator
  const denom = stageSize.w || 1;
  const toNorm = useCallback(
    (px: number, py: number) => ({ x: px / denom, y: py / denom }),
    [denom],
  );

  const pointerNorm = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return toNorm(pos.x, pos.y);
  };

  const finishActiveStroke = () => {
    const active = activeStrokeRef.current;
    if (!active) return;
    activeStrokeRef.current = null;
    // Discard zero/near-zero shapes — likely accidental taps.
    if (isSignificant(active.draft)) {
      setShapes((s) => [...s, active.draft]);
    }
    setDrafting(null);
  };
  const finishStrokeRef = useRef(finishActiveStroke);
  finishStrokeRef.current = finishActiveStroke;

  // Track the finger on the window, not via setPointerCapture on the stage
  // container. Konva listens on the inner .konvajs-content node; capture on
  // the parent never delivers pointermove, so the end point stays on the
  // start point. A zero-length Konva arrow still paints its triangle, which
  // is the head-only mark on iPhone. clientX/clientY still arrive here for
  // the whole drag, including a lift outside the photo.
  useEffect(() => {
    const applyClient = (ev: PointerEvent) => {
      const active = activeStrokeRef.current;
      const stage = stageRef.current;
      const content = stage?.content;
      if (!active || !stage || !content || active.draft.type === "text") return;
      const pt = clientToStagePx(
        ev.clientX,
        ev.clientY,
        content.getBoundingClientRect(),
        stage.width(),
        stage.height(),
      );
      if (!pt) return;
      const width = stage.width();
      if (!(width > 0)) return;
      const next = moveDraft(active.draft, pt.x / width, pt.y / width);
      activeStrokeRef.current = { pointerId: active.pointerId, draft: next };
      setDrafting(next);
    };
    const onMove = (ev: PointerEvent) => {
      const pointerId = typeof ev.pointerId === "number" ? ev.pointerId : null;
      if (
        strokePhase(activeStrokeRef.current, { type: "move", pointerId }) !==
        "update"
      ) {
        return;
      }
      applyClient(ev);
    };
    const onUp = (ev: PointerEvent) => {
      const pointerId = typeof ev.pointerId === "number" ? ev.pointerId : null;
      if (
        strokePhase(activeStrokeRef.current, { type: "up", pointerId }) !==
        "finish"
      ) {
        return;
      }
      if (ev.type !== "pointercancel") applyClient(ev);
      finishStrokeRef.current();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // Drag and resize use the same window pointer stream as drawing. The
  // handle calls preventDefault so the textarea keeps the keyboard.
  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const drag = textDragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const stage = stageRef.current;
      if (!stage || !(stage.width() > 0)) return;
      const dx = (ev.clientX - drag.originX) / stage.width();
      const dy = (ev.clientY - drag.originY) / stage.width();
      if (Math.hypot(dx, dy) > 0.01) drag.moved = true;
      const movedBox = applyTextBoxPointer(
        drag.start,
        drag.handle,
        dx,
        dy,
        stage.width(),
        stage.height(),
        drag.fontSize,
      );
      const typing =
        drag.mode === "edit" ? textEditingRef.current?.value : undefined;
      const next = textBoxCoveringContent(
        movedBox,
        typing ?? drag.text,
        drag.fontSize,
        stage.width(),
        stage.height(),
      );
      if (drag.mode === "edit") {
        setTextEditing((current) =>
          current && current.id === drag.shapeId ? { ...current, ...next } : current,
        );
      } else {
        setShapes((current) =>
          current.map((shape) =>
            shape.type === "text" && shape.id === drag.shapeId
              ? { ...shape, ...next }
              : shape,
          ),
        );
      }
      editedRef.current = true;
    };
    const onUp = (ev: PointerEvent) => {
      const drag = textDragRef.current;
      if (!drag || ev.pointerId !== drag.pointerId) return;
      textDragRef.current = null;
      if (drag.mode === "selected" && drag.handle === "move" && !drag.moved) {
        editTextRef.current(drag.shapeId);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // --- drawing handlers
  // Pointer events only. Mouse + touch both fire for one finger on a phone,
  // and the extra down/up after the first symbol cancelled the next one.
  const handlePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const pointerId = pointerIdOf(e);
    if (
      strokePhase(activeStrokeRef.current, { type: "down", pointerId }) ===
      "ignore"
    ) {
      return;
    }
    const p = pointerNorm(e);
    if (!p) return;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    if (tool === "text") {
      editedRef.current = true;
      const px = p.x * (stageSize.w || 1);
      const py = p.y * (stageSize.w || 1);
      const hit = [...shapes]
        .reverse()
        .find((shape) => {
          if (shape.type !== "text") return false;
          const frame = annotationTextFrame({
            xNorm: shape.x,
            yNorm: shape.y,
            fontSizeNorm: shape.fontSize,
            text: shape.text,
            imageWidthPx: stageSize.w,
            imageHeightPx: stageSize.h,
            boxWidthNorm: shape.boxWidth,
            boxHeightNorm: shape.boxHeight,
          });
          return (
            px >= frame.xPx &&
            px <= frame.xPx + frame.widthPx &&
            py >= frame.yPx &&
            py <= frame.yPx + frame.heightPx
          );
        });
      if (hit && hit.type === "text") {
        if (textEditing && textEditing.id !== hit.id) commitText();
        const frame = annotationTextFrame({
          xNorm: hit.x,
          yNorm: hit.y,
          fontSizeNorm: hit.fontSize,
          text: hit.text,
          imageWidthPx: stageSize.w,
          imageHeightPx: stageSize.h,
          boxWidthNorm: hit.boxWidth,
          boxHeightNorm: hit.boxHeight,
        });
        const width = stageSize.w || 1;
        setSelectedTextId(hit.id);
        const native = e.evt;
        if (typeof native.pointerId === "number") {
          startTextDrag(
            "move",
            native,
            "selected",
            hit.id,
            {
              x: frame.xPx / width,
              y: frame.yPx / width,
              boxWidth: hit.boxWidth ?? frame.widthPx / width,
              boxHeight: hit.boxHeight ?? frame.heightPx / width,
            },
            hit.fontSize,
            hit.text,
          );
        }
        return;
      }
      if (textEditing) commitText();
      const fontSize = fontSizeNormForStroke(strokeWidth);
      const box = defaultTextBox(
        p.x,
        p.y,
        fontSize,
        stageSize.w,
        stageSize.h,
      );
      setSelectedTextId(id);
      setTextEditing({
        id,
        ...box,
        value: "",
        fontSize,
        color,
      });
      return;
    }

    let shape: AnnotationShape | null = null;
    if (tool === "pen") {
      shape = {
        type: "pen",
        id,
        color,
        strokeWidth,
        points: [p.x, p.y],
      };
    } else if (tool === "arrow") {
      shape = {
        type: "arrow",
        id,
        color,
        strokeWidth,
        points: [p.x, p.y, p.x, p.y],
      };
    } else if (tool === "rect") {
      shape = {
        type: "rect",
        id,
        color,
        strokeWidth,
        x: p.x,
        y: p.y,
        w: 0,
        h: 0,
      };
    } else if (tool === "circle") {
      shape = {
        type: "circle",
        id,
        color,
        strokeWidth,
        x: p.x,
        y: p.y,
        r: 0,
      };
    }
    if (!shape) return;

    editedRef.current = true;
    activeStrokeRef.current = { pointerId, draft: shape };
    setDrafting(shape);
  };

  const commitText = () => {
    const current = textEditingRef.current;
    if (!current) return;
    const value = current.value.trim();
    textEditingRef.current = value ? { ...current, value } : null;
    setTextEditing(null);
    setShapes((existing) => {
      const without = existing.filter((shape) => shape.id !== current.id);
      if (!value) return without;
      return [...without, textShapeFromDraft(current, value)];
    });
    if (value) setSelectedTextId(current.id);
    editedRef.current = true;
  };
  const commitTextRef = useRef(commitText);
  commitTextRef.current = commitText;

  const beginEditText = (id: string) => {
    const shape = shapes.find((item) => item.id === id && item.type === "text");
    if (!shape || shape.type !== "text") return;
    const frame = annotationTextFrame({
      xNorm: shape.x,
      yNorm: shape.y,
      fontSizeNorm: shape.fontSize,
      text: shape.text,
      imageWidthPx: stageSize.w,
      imageHeightPx: stageSize.h,
      boxWidthNorm: shape.boxWidth,
      boxHeightNorm: shape.boxHeight,
    });
    const width = stageSize.w || 1;
    setTextEditing({
      id: shape.id,
      x: frame.xPx / width,
      y: frame.yPx / width,
      boxWidth: shape.boxWidth ?? frame.widthPx / width,
      boxHeight: shape.boxHeight ?? frame.heightPx / width,
      value: shape.text,
      fontSize: shape.fontSize,
      color: shape.color,
    });
    setSelectedTextId(shape.id);
  };
  editTextRef.current = beginEditText;

  const startTextDrag = (
    handle: TextBoxHandle,
    event: { pointerId: number; clientX: number; clientY: number },
    mode: "edit" | "selected",
    shapeId: string,
    start: TextBoxNorm,
    fontSize: number,
    text: string,
  ) => {
    textDragRef.current = {
      pointerId: event.pointerId,
      handle,
      start,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
      mode,
      shapeId,
      fontSize,
      text,
    };
  };

  const chooseTool = (next: Tool) => {
    if (next !== "text") {
      commitText();
      setSelectedTextId(null);
      textDragRef.current = null;
    }
    setTool(next);
  };

  const patchActiveText = (patch: { color?: string; fontSize?: number }) => {
    if (tool !== "text") return;
    const editing = textEditingRef.current;
    if (editing) {
      const next = { ...editing, ...patch };
      const fitted = textBoxCoveringContent(
        next,
        next.value,
        next.fontSize,
        stageSize.w,
        stageSize.h,
      );
      setTextEditing({ ...next, ...fitted });
      return;
    }
    if (!selectedTextId) return;
    editedRef.current = true;
    setShapes((existing) =>
      existing.map((shape) => {
        if (shape.type !== "text" || shape.id !== selectedTextId) return shape;
        const next = { ...shape, ...patch };
        const width = stageSize.w || 1;
        const frame = annotationTextFrame({
          xNorm: next.x,
          yNorm: next.y,
          fontSizeNorm: next.fontSize,
          text: next.text,
          imageWidthPx: stageSize.w,
          imageHeightPx: stageSize.h,
          boxWidthNorm: next.boxWidth,
          boxHeightNorm: next.boxHeight,
        });
        const fitted = textBoxCoveringContent(
          {
            x: frame.xPx / width,
            y: frame.yPx / width,
            boxWidth: next.boxWidth ?? frame.widthPx / width,
            boxHeight: next.boxHeight ?? frame.heightPx / width,
          },
          next.text,
          next.fontSize,
          stageSize.w,
          stageSize.h,
        );
        return { ...next, ...fitted };
      }),
    );
  };

  const undo = () => {
    editedRef.current = true;
    setShapes((s) => s.slice(0, -1));
  };
  const clearAll = () => {
    editedRef.current = true;
    setShapes([]);
    setTextEditing(null);
    setSelectedTextId(null);
    textDragRef.current = null;
  };

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
      // Include the stroke still under the finger and text that hasn't
      // blurred yet. Both live outside `shapes` until the next render, so
      // reading state alone drops the mark the user just made.
      const editing = textEditingRef.current;
      const editingValue = editing?.value.trim() ?? "";
      const pending: AnnotationShape[] = shapes.filter(
        (shape) => shape.id !== editing?.id,
      );
      const active = activeStrokeRef.current;
      if (
        active &&
        isSignificant(active.draft) &&
        !pending.some((shape) => shape.id === active.draft.id)
      ) {
        pending.push(active.draft);
      }
      if (editing && editingValue) {
        pending.push(textShapeFromDraft(editing, editingValue));
      }
      await onSave({ annotations: pending, stageWidth: stageSize.w });
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
            pointerLength={arrowHeadScreenPx(s.strokeWidth)}
            pointerWidth={arrowHeadScreenPx(s.strokeWidth)}
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
      case "text": {
        if (textEditing?.id === s.id) return null;
        const frame = annotationTextFrame({
          xNorm: s.x,
          yNorm: s.y,
          fontSizeNorm: s.fontSize,
          text: s.text,
          imageWidthPx: stageSize.w,
          imageHeightPx: stageSize.h,
          boxWidthNorm: s.boxWidth,
          boxHeightNorm: s.boxHeight,
        });
        return (
          <Group
            key={s.id}
            clipX={frame.xPx}
            clipY={frame.yPx}
            clipWidth={Math.max(1, frame.widthPx)}
            clipHeight={Math.max(1, frame.heightPx)}
            listening={false}
          >
            <Text
              x={frame.xPx}
              y={frame.yPx}
              width={Math.max(1, frame.widthPx)}
              text={frame.visibleLines.join("\n")}
              wrap="word"
              lineHeight={1.2}
              fill={s.color}
              fontSize={frame.fontSizePx}
              fontStyle="bold"
              fontFamily="Arial"
              // Faint outline so text is legible on any background. Konva
              // strokes the glyph itself when stroke + strokeWidth are set.
              stroke="black"
              strokeWidth={Math.max(1, frame.fontSizePx * 0.04)}
              fillAfterStrokeEnabled
              listening={false}
            />
          </Group>
        );
      }
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

  const selectedText =
    !textEditing && tool === "text"
      ? shapes.find(
          (shape) => shape.type === "text" && shape.id === selectedTextId,
        )
      : undefined;
  const textChrome =
    textEditing != null
      ? {
          id: textEditing.id,
          x: textEditing.x,
          y: textEditing.y,
          boxWidth: textEditing.boxWidth,
          boxHeight: textEditing.boxHeight,
          fontSize: textEditing.fontSize,
          value: textEditing.value,
          color: textEditing.color,
          editing: true,
        }
      : selectedText && selectedText.type === "text"
        ? {
            id: selectedText.id,
            x: selectedText.x,
            y: selectedText.y,
            boxWidth: selectedText.boxWidth,
            boxHeight: selectedText.boxHeight,
            fontSize: selectedText.fontSize,
            value: selectedText.text,
            color: selectedText.color,
            editing: false,
          }
        : null;
  const textFrame =
    textChrome && stageSize.w > 0
      ? annotationTextFrame({
          xNorm: textChrome.x,
          yNorm: textChrome.y,
          fontSizeNorm: textChrome.fontSize,
          text: textChrome.value || " ",
          imageWidthPx: stageSize.w,
          imageHeightPx: stageSize.h,
          boxWidthNorm: textChrome.boxWidth,
          boxHeightNorm: textChrome.boxHeight,
        })
      : null;
  const textBoxNorm: TextBoxNorm | null = textFrame
    ? {
        x: textFrame.xPx / stageSize.w,
        y: textFrame.yPx / stageSize.w,
        boxWidth: textFrame.widthPx / stageSize.w,
        boxHeight: textFrame.heightPx / stageSize.w,
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={ANNOTATOR_DIALOG_CLASS}
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
          className="flex-1 relative overflow-hidden flex items-center justify-center select-none touch-none"
        >
          {/* Surface load failures instead of leaving the canvas mysteriously
              blank — saves a lot of "what's wrong?" guessing. */}
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
              style={{ touchAction: "none" }}
              onPointerDown={handlePointerDown}
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

          {textChrome && textFrame && textBoxNorm && (
            <PhotoAnnotatorTextBox
              left={stageOffsetX + textFrame.xPx}
              top={stageOffsetY + textFrame.yPx}
              width={textFrame.widthPx}
              height={textFrame.heightPx}
              editing={textChrome.editing}
              value={textChrome.value}
              color={textChrome.color}
              fontSizePx={textFrame.fontSizePx}
              onChangeText={(value) =>
                setTextEditing((current) => {
                  if (!current) return current;
                  const fitted = textBoxCoveringContent(
                    current,
                    value,
                    current.fontSize,
                    stageSize.w,
                    stageSize.h,
                  );
                  return { ...current, ...fitted, value };
                })
              }
              onCommit={commitText}
              onCancel={() => setTextEditing(null)}
              onHandlePointerDown={(handle, event) =>
                startTextDrag(
                  handle,
                  event,
                  textChrome.editing ? "edit" : "selected",
                  textChrome.id,
                  textBoxNorm,
                  textChrome.fontSize,
                  textChrome.value,
                )
              }
              onBodyPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                startTextDrag(
                  "move",
                  event,
                  "selected",
                  textChrome.id,
                  textBoxNorm,
                  textChrome.fontSize,
                  textChrome.value,
                );
              }}
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
            onClick={() => chooseTool("arrow")}
            label="Arrow"
          />
          <ToolBtn
            icon={<CircleIcon className="w-5 h-5" />}
            active={tool === "circle"}
            onClick={() => chooseTool("circle")}
            label="Circle"
          />
          <ToolBtn
            icon={<Square className="w-5 h-5" />}
            active={tool === "rect"}
            onClick={() => chooseTool("rect")}
            label="Rect"
          />
          <ToolBtn
            icon={<Pencil className="w-5 h-5" />}
            active={tool === "pen"}
            onClick={() => chooseTool("pen")}
            label="Draw"
          />
          <ToolBtn
            icon={<Type className="w-5 h-5" />}
            active={tool === "text"}
            onClick={() => chooseTool("text")}
            label="Text"
          />

          <div className="w-px h-6 bg-neutral-700 mx-1" />

          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c);
                patchActiveText({ color: c });
              }}
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
              onClick={() => {
                setStrokeWidth(w);
                patchActiveText({ fontSize: fontSizeNormForStroke(w) });
              }}
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
