// Pure geometry for the photo annotator. Coordinates are fractions of the
// image width on both axes, so a stage that contain-fits the photo maps a
// point back onto the same image pixel at any display size.

export const ANNOTATOR_DIALOG_CLASS =
  "max-w-none w-screen sm:w-screen h-[100dvh] max-h-[100dvh] overflow-hidden p-0 gap-0 border-0 rounded-none sm:rounded-none flex flex-col bg-black translate-x-0 translate-y-0 left-0 top-0 sm:max-w-none";

export interface ContentBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PenDraft {
  type: "pen";
  points: number[];
}

export interface ArrowDraft {
  type: "arrow";
  points: [number, number, number, number];
}

export interface RectDraft {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CircleDraft {
  type: "circle";
  x: number;
  y: number;
  r: number;
}

export type MovableDraft = PenDraft | ArrowDraft | RectDraft | CircleDraft;

/** Contain-fit. The whole image stays visible; nothing is cropped. */
export function fitImageContain(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
): { w: number; h: number } {
  if (
    !(imageWidth > 0) ||
    !(imageHeight > 0) ||
    !(boxWidth > 0) ||
    !(boxHeight > 0)
  ) {
    return { w: 0, h: 0 };
  }
  const imgRatio = imageWidth / imageHeight;
  const boxRatio = boxWidth / boxHeight;
  if (boxRatio > imgRatio) {
    const h = boxHeight;
    return { w: h * imgRatio, h };
  }
  const w = boxWidth;
  return { w, h: w / imgRatio };
}

/**
 * Map a viewport point into stage pixels. `box` is the stage content
 * element's getBoundingClientRect. Points that leave the photo clamp to
 * the edge so the mark still ends on the image.
 */
export function clientToStagePx(
  clientX: number,
  clientY: number,
  box: ContentBox,
  stageWidth: number,
  stageHeight: number,
): { x: number; y: number } | null {
  if (
    !(box.width > 0) ||
    !(box.height > 0) ||
    !(stageWidth > 0) ||
    !(stageHeight > 0) ||
    !Number.isFinite(clientX) ||
    !Number.isFinite(clientY)
  ) {
    return null;
  }
  const x = ((clientX - box.left) / box.width) * stageWidth;
  const y = ((clientY - box.top) / box.height) * stageHeight;
  return {
    x: Math.min(stageWidth, Math.max(0, x)),
    y: Math.min(stageHeight, Math.max(0, y)),
  };
}

/** Stage pixels → image pixels. Y is a fraction of width, same as X. */
export function stagePxToImagePx(
  stageX: number,
  stageY: number,
  stageWidth: number,
  imageWidth: number,
): { x: number; y: number } {
  return {
    x: (stageX / stageWidth) * imageWidth,
    y: (stageY / stageWidth) * imageWidth,
  };
}

/** Konva arrow head, in screen pixels. Same formula the bake uses. */
export function arrowHeadScreenPx(strokeWidth: number): number {
  return Math.max(10, strokeWidth * 3);
}

export function arrowShaftScreenPx(
  points: readonly [number, number, number, number],
  stageWidth: number,
): number {
  const [x1, y1, x2, y2] = points;
  return Math.hypot((x2 - x1) * stageWidth, (y2 - y1) * stageWidth);
}

export function isSignificantMark(draft: MovableDraft): boolean {
  if (draft.type === "pen") return draft.points.length >= 4;
  if (draft.type === "arrow") {
    const [x1, y1, x2, y2] = draft.points;
    return Math.hypot(x2 - x1, y2 - y1) > 0.005;
  }
  if (draft.type === "rect") {
    return Math.abs(draft.w) > 0.005 && Math.abs(draft.h) > 0.005;
  }
  return draft.r > 0.005;
}

export function moveDraft<T extends MovableDraft>(
  draft: T,
  nx: number,
  ny: number,
): T {
  if (draft.type === "pen") {
    return { ...draft, points: [...draft.points, nx, ny] };
  }
  if (draft.type === "arrow") {
    return {
      ...draft,
      points: [draft.points[0], draft.points[1], nx, ny],
    };
  }
  if (draft.type === "rect") {
    return { ...draft, w: nx - draft.x, h: ny - draft.y };
  }
  return { ...draft, r: Math.hypot(nx - draft.x, ny - draft.y) };
}
