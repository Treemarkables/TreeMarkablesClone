// Word-wrap for photo-markup text.
//
// Coordinates elsewhere are fractions of the image WIDTH (x and y share that
// denominator — see PhotoAnnotator). This module turns a text shape into a
// box that stays inside the image: lines break instead of running off the
// right edge, and the block shifts up when it would run off the bottom.
//
// The same numbers are used by the on-screen editor and the server PNG bake
// so a saved mark doesn't come back as one long line.

export const ANNOTATION_LINE_HEIGHT = 1.2;

// Bold Arial-ish advance widths, as a fraction of font size. Biased a little
// wide so a line wraps before it crosses the photo edge (librsvg and Konva
// don't share a font engine).
function charUnit(ch: string): number {
  if (ch === " " || ch === "\t") return 0.34;
  if ("iljtfIr.,:;'`|!".includes(ch)) return 0.36;
  if ("mwMW@#%&".includes(ch)) return 0.92;
  if (ch >= "A" && ch <= "Z") return 0.74;
  if (ch >= "0" && ch <= "9") return 0.62;
  return 0.58;
}

export function estimateAnnotationTextWidth(
  text: string,
  fontSizePx: number,
): number {
  let width = 0;
  for (const ch of text) width += charUnit(ch) * fontSizePx;
  return width;
}

function breakLongWord(
  word: string,
  maxWidthPx: number,
  fontSizePx: number,
): string[] {
  if (estimateAnnotationTextWidth(word, fontSizePx) <= maxWidthPx) return [word];
  const parts: string[] = [];
  let buf = "";
  for (const ch of word) {
    const next = buf + ch;
    // Always keep at least one character, even if it is wider than the box.
    if (buf && estimateAnnotationTextWidth(next, fontSizePx) > maxWidthPx) {
      parts.push(buf);
      buf = ch;
    } else {
      buf = next;
    }
  }
  if (buf) parts.push(buf);
  return parts.length > 0 ? parts : [word];
}

function wrapParagraph(
  paragraph: string,
  maxWidthPx: number,
  fontSizePx: number,
): string[] {
  const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    for (const piece of breakLongWord(word, maxWidthPx, fontSizePx)) {
      const candidate = current ? `${current} ${piece}` : piece;
      if (
        current &&
        estimateAnnotationTextWidth(candidate, fontSizePx) > maxWidthPx
      ) {
        lines.push(current);
        current = piece;
      } else {
        current = candidate;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Break `text` into lines that each fit in `maxWidthPx`. Blank lines stay. */
export function wrapAnnotationText(
  text: string,
  maxWidthPx: number,
  fontSizePx: number,
): string[] {
  if (!(maxWidthPx > 0) || !(fontSizePx > 0)) {
    return text.split("\n");
  }
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    lines.push(...wrapParagraph(paragraph, maxWidthPx, fontSizePx));
  }
  return lines.length > 0 ? lines : [""];
}

export interface AnnotationTextFrame {
  xPx: number;
  yPx: number;
  widthPx: number;
  fontSizePx: number;
  lineHeightPx: number;
  lines: string[];
}

/**
 * Box for one text mark. `xNorm` / `yNorm` are fractions of the image width.
 * A short label away from the edges keeps its original anchor. A long label
 * wraps, and a mark placed on the right or bottom is pulled back inside.
 */
export function annotationTextFrame(input: {
  xNorm: number;
  yNorm: number;
  fontSizeNorm: number;
  text: string;
  imageWidthPx: number;
  imageHeightPx: number;
}): AnnotationTextFrame {
  const imageWidthPx = input.imageWidthPx;
  const imageHeightPx = input.imageHeightPx;
  const fontSizeNorm = input.fontSizeNorm > 0 ? input.fontSizeNorm : 0.04;
  const fontSizePx = Math.max(1, fontSizeNorm * (imageWidthPx > 0 ? imageWidthPx : 1));
  const lineHeightPx = fontSizePx * ANNOTATION_LINE_HEIGHT;

  if (!(imageWidthPx > 0)) {
    return {
      xPx: 0,
      yPx: 0,
      widthPx: 0,
      fontSizePx,
      lineHeightPx,
      lines: wrapAnnotationText(input.text, 0, fontSizePx),
    };
  }

  const pad = Math.max(2, fontSizePx * 0.2);
  const right = Math.max(pad, imageWidthPx - pad);
  let xPx = (Number.isFinite(input.xNorm) ? input.xNorm : 0) * imageWidthPx;
  let widthPx = right - xPx;
  // A tap against the right edge still gets a few characters of width,
  // shifted left so the box ends at the photo edge.
  const minWidth = Math.min(
    Math.max(fontSizePx, right - pad),
    Math.max(fontSizePx * 4, fontSizePx),
  );
  if (!(widthPx >= minWidth)) {
    widthPx = minWidth;
    xPx = Math.max(pad, right - widthPx);
  }
  if (xPx + widthPx > right) {
    widthPx = Math.max(fontSizePx, right - xPx);
  }

  const lines = wrapAnnotationText(input.text, widthPx, fontSizePx);
  const blockH = Math.max(lineHeightPx, lines.length * lineHeightPx);
  // y is a fraction of image WIDTH, same as x. A short label keeps that
  // anchor. Only a block that would cross the bottom edge moves up.
  let yPx = (Number.isFinite(input.yNorm) ? input.yNorm : 0) * imageWidthPx;
  if (imageHeightPx > 0) {
    const bottom = imageHeightPx - pad;
    if (yPx + blockH > bottom) {
      yPx = Math.max(0, bottom - blockH);
    }
  }
  if (yPx < 0) yPx = 0;

  return { xPx, yPx, widthPx, fontSizePx, lineHeightPx, lines };
}
