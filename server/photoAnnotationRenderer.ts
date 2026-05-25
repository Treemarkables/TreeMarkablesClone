// Server-side rendering of photo annotations onto the source image.
//
// Replaces the original client-side toDataURL() approach, which forced the
// browser to load the image with crossOrigin="anonymous" to avoid tainting
// the Konva canvas — that, in turn, made the image fail to load on iOS
// Safari (the GCS-served /objects/photos route doesn't send CORS headers).
//
// Now: client just sends the shape JSON; this module fetches the source
// image, composites an SVG overlay via sharp, and returns the baked PNG.
// Matches the existing composeBeforeAfter pattern in photoStorage.ts.

import sharp from "sharp";

type ShapeBase = { id: string; color: string };
type StrokedBase = ShapeBase & { strokeWidth: number };

// Mirror of the AnnotationShape union from client/src/components/PhotoAnnotator.
// Kept in sync by convention rather than imported because the client lives
// behind the Vite bundler.
export type AnnotationShape =
  | (StrokedBase & { type: "pen"; points: number[] })
  | (StrokedBase & {
      type: "arrow";
      points: [number, number, number, number];
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
      fontSize: number;
    });

const XML_ENTITIES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&apos;",
};
const escapeXml = (s: string): string =>
  s.replace(/[<>&"']/g, (c) => XML_ENTITIES[c]);

// All shape coords are normalized as a fraction of the image's WIDTH (per the
// client's convention — see PhotoAnnotator's coord-helper comment). So both
// x and y multiply by `W`, not separate width/height. Distances and radii
// likewise scale with W.
function shapeToSvg(s: AnnotationShape, W: number): string {
  const px = (n: number) => n * W;

  switch (s.type) {
    case "pen": {
      if (s.points.length < 4) return "";
      const pts: string[] = [];
      for (let i = 0; i < s.points.length; i += 2) {
        pts.push(`${px(s.points[i])},${px(s.points[i + 1])}`);
      }
      return (
        `<polyline points="${pts.join(" ")}" stroke="${s.color}" ` +
        `stroke-width="${s.strokeWidth}" fill="none" ` +
        `stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }

    case "arrow": {
      const x1 = px(s.points[0]);
      const y1 = px(s.points[1]);
      const x2 = px(s.points[2]);
      const y2 = px(s.points[3]);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 1) return "";

      // Match the Konva arrowhead geometry from the client.
      const headLen = Math.max(10, s.strokeWidth * 3);
      const headW = Math.max(10, s.strokeWidth * 3);
      const ux = dx / len;
      const uy = dy / len;
      const baseX = x2 - ux * headLen;
      const baseY = y2 - uy * headLen;
      // Perpendicular unit vector (rotate 90° CCW)
      const perpX = -uy;
      const perpY = ux;
      const leftX = baseX + (perpX * headW) / 2;
      const leftY = baseY + (perpY * headW) / 2;
      const rightX = baseX - (perpX * headW) / 2;
      const rightY = baseY - (perpY * headW) / 2;

      // Line stops at the head's base so it doesn't poke through the triangle.
      return (
        `<line x1="${x1}" y1="${y1}" x2="${baseX}" y2="${baseY}" ` +
        `stroke="${s.color}" stroke-width="${s.strokeWidth}" stroke-linecap="round"/>` +
        `<polygon points="${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}" fill="${s.color}"/>`
      );
    }

    case "rect": {
      const x = px(s.x);
      const y = px(s.y);
      const w = px(s.w);
      const h = px(s.h);
      // Konva accepts negative width/height (drag-from-bottom-right). SVG
      // requires positive — normalize by shifting the origin if needed.
      const nx = w < 0 ? x + w : x;
      const ny = h < 0 ? y + h : y;
      return (
        `<rect x="${nx}" y="${ny}" width="${Math.abs(w)}" height="${Math.abs(h)}" ` +
        `stroke="${s.color}" stroke-width="${s.strokeWidth}" fill="none"/>`
      );
    }

    case "circle": {
      return (
        `<circle cx="${px(s.x)}" cy="${px(s.y)}" r="${px(s.r)}" ` +
        `stroke="${s.color}" stroke-width="${s.strokeWidth}" fill="none"/>`
      );
    }

    case "text": {
      const fontSize = px(s.fontSize);
      // Konva strokes glyph outlines when stroke + strokeWidth are set; SVG
      // equivalent uses paint-order="stroke fill" so the fill sits on top of
      // a thin black outline — keeps text legible on any background.
      const strokeW = Math.max(1, fontSize * 0.04);
      const x = px(s.x);
      // Konva positions text by top-left; SVG <text> uses the baseline. Shift
      // down by ~fontSize so the rendered text appears in the same place the
      // user typed.
      const y = px(s.y) + fontSize;
      return (
        `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" ` +
        `font-size="${fontSize}" font-weight="bold" fill="${s.color}" ` +
        `stroke="black" stroke-width="${strokeW}" paint-order="stroke fill">` +
        `${escapeXml(s.text)}</text>`
      );
    }
  }
}

/**
 * Composite the given annotation shapes onto `sourceBuffer` and return a PNG.
 * Returns the original image untouched when `shapes` is empty.
 */
export async function bakeAnnotations(
  sourceBuffer: Buffer,
  shapes: AnnotationShape[],
): Promise<Buffer> {
  if (shapes.length === 0) {
    return sharp(sourceBuffer).png().toBuffer();
  }

  // Rotate the image based on EXIF so the overlay coords match what the user
  // saw in the editor (the client always sees auto-rotated bytes via the
  // <img> element). Then read the post-rotation dimensions.
  const rotated = await sharp(sourceBuffer).rotate().toBuffer();
  const { width, height } = await sharp(rotated).metadata();
  if (!width || !height) {
    throw new Error("Could not read source image dimensions");
  }

  const overlaySvg =
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
    shapes.map((s) => shapeToSvg(s, width)).join("") +
    `</svg>`;

  return sharp(rotated)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
