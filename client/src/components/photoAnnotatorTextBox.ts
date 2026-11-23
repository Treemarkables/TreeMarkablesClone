// Drag and resize for a photo text box. Font size stays on the toolbar
// (the 2 / 4 / 8 size buttons). The box only changes where the words sit
// and how wide they wrap.

import {
  annotationTextFrame,
  clampAnnotationTextBox,
  type AnnotationTextBoxNorm,
} from "@shared/annotationTextWrap";

export type TextBoxNorm = AnnotationTextBoxNorm;

export type TextBoxHandle =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

/** Toolbar stroke sizes, as a fraction of image width. Medium matches the old fixed 0.04. */
export function fontSizeNormForStroke(strokeWidth: number): number {
  if (strokeWidth >= 8) return 0.06;
  if (strokeWidth <= 2) return 0.03;
  return 0.04;
}

export function defaultTextBox(
  xNorm: number,
  yNorm: number,
  fontSizeNorm: number,
  imageWidthPx: number,
  imageHeightPx: number,
): TextBoxNorm {
  const font = fontSizeNorm > 0 ? fontSizeNorm : 0.04;
  return clampAnnotationTextBox(
    {
      x: xNorm,
      y: yNorm,
      boxWidth: Math.max(font * 8, 0.42),
      boxHeight: font * 1.2 * 2,
    },
    imageWidthPx,
    imageHeightPx,
    font,
  );
}

/**
 * Move or resize from the pointer delta. `dxNorm` / `dyNorm` are fractions
 * of image width (y uses that same denominator). Font size is not an input
 * that changes — it only sets the smallest box the finger can make.
 */
export function applyTextBoxPointer(
  start: TextBoxNorm,
  handle: TextBoxHandle,
  dxNorm: number,
  dyNorm: number,
  imageWidthPx: number,
  imageHeightPx: number,
  fontSizeNorm: number,
): TextBoxNorm {
  let x = start.x;
  let y = start.y;
  let boxWidth = start.boxWidth;
  let boxHeight = start.boxHeight;
  const east = handle === "e" || handle === "ne" || handle === "se";
  const west = handle === "w" || handle === "nw" || handle === "sw";
  const south = handle === "s" || handle === "se" || handle === "sw";
  const north = handle === "n" || handle === "ne" || handle === "nw";
  if (handle === "move") {
    x += dxNorm;
    y += dyNorm;
  }
  if (east) boxWidth += dxNorm;
  if (west) {
    const right = start.x + start.boxWidth;
    boxWidth = start.boxWidth - dxNorm;
    x = right - boxWidth;
  }
  if (south) boxHeight += dyNorm;
  if (north) {
    const bottom = start.y + start.boxHeight;
    boxHeight = start.boxHeight - dyNorm;
    y = bottom - boxHeight;
  }
  return clampAnnotationTextBox(
    { x, y, boxWidth, boxHeight },
    imageWidthPx,
    imageHeightPx,
    fontSizeNorm,
  );
}

export interface TextBoxPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Finger target. 22px radius is a 44px touch on a phone. */
export const TEXT_BOX_HANDLE_RADIUS = 22;

const HANDLES: TextBoxHandle[] = [
  "nw",
  "ne",
  "sw",
  "se",
  "n",
  "s",
  "e",
  "w",
];

function handlePoint(
  box: TextBoxPx,
  handle: TextBoxHandle,
): { x: number; y: number } | null {
  const midX = box.x + box.width / 2;
  const midY = box.y + box.height / 2;
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  switch (handle) {
    case "nw":
      return { x: box.x, y: box.y };
    case "ne":
      return { x: right, y: box.y };
    case "sw":
      return { x: box.x, y: bottom };
    case "se":
      return { x: right, y: bottom };
    case "n":
      return { x: midX, y: box.y };
    case "s":
      return { x: midX, y: bottom };
    case "e":
      return { x: right, y: midY };
    case "w":
      return { x: box.x, y: midY };
    default:
      return null;
  }
}

/**
 * Keep every wrapped line inside the box. A taller box stays taller. A
 * shorter box grows to the text so a narrow wrap does not clip the note.
 * Font size is unchanged.
 */
export function textBoxCoveringContent(
  box: TextBoxNorm,
  text: string,
  fontSizeNorm: number,
  imageWidthPx: number,
  imageHeightPx: number,
): TextBoxNorm {
  const frame = annotationTextFrame({
    xNorm: box.x,
    yNorm: box.y,
    fontSizeNorm,
    text: text.trim() ? text : " ",
    imageWidthPx,
    imageHeightPx,
    boxWidthNorm: box.boxWidth,
  });
  const content = frame.heightPx / (imageWidthPx > 0 ? imageWidthPx : 1);
  const boxHeight = Math.max(box.boxHeight, content);
  return clampAnnotationTextBox(
    { ...box, boxHeight },
    imageWidthPx,
    imageHeightPx,
    fontSizeNorm,
  );
}

export function textBoxHandleAt(
  box: TextBoxPx,
  px: number,
  py: number,
  radius = TEXT_BOX_HANDLE_RADIUS,
): TextBoxHandle | "body" | null {
  if (!(box.width > 0) || !(box.height > 0)) return null;
  for (const handle of HANDLES) {
    const point = handlePoint(box, handle);
    if (!point) continue;
    if (Math.hypot(px - point.x, py - point.y) <= radius) return handle;
  }
  if (
    px >= box.x &&
    px <= box.x + box.width &&
    py >= box.y &&
    py <= box.y + box.height
  ) {
    return "body";
  }
  return null;
}
