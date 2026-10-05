/**
 * Run: npx tsx --test server/photoAnnotationRenderer.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { bakeAnnotations } from "./photoAnnotationRenderer.ts";
import { annotationMarkStrokePx } from "./photoAnnotationStroke.ts";

async function rgbAt(
  png: Buffer,
  x: number,
  y: number,
): Promise<[number, number, number]> {
  const { data, info } = await sharp(png)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

function isRed(rgb: [number, number, number]): boolean {
  return rgb[0] > 180 && rgb[1] < 80 && rgb[2] < 80;
}

function isWhite(rgb: [number, number, number]): boolean {
  return rgb[0] > 240 && rgb[1] > 240 && rgb[2] > 240;
}

describe("bakeAnnotations stroke scale", () => {
  it("paints a screen-pixel line thick enough to see on the photo", async () => {
    const source = await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    // y is a fraction of WIDTH, so 0.25 * 200 = pixel row 50.
    // stroke 4 on a 50px stage → 4/50*200 = 16px. A pixel 6px off the
    // centre is inside that stroke and outside an unscaled 4px stroke.
    const baked = await bakeAnnotations(
      source,
      [
        {
          type: "pen",
          id: "line",
          color: "#FF0000",
          strokeWidth: 4,
          points: [0.1, 0.25, 0.9, 0.25],
        },
      ],
      { stageWidth: 50 },
    );

    assert.equal(isRed(await rgbAt(baked, 100, 50)), true);
    assert.equal(isRed(await rgbAt(baked, 100, 56)), true);
    assert.equal(isWhite(await rgbAt(baked, 100, 10)), true);
  });

  it("scales a rectangle stroke the same way", async () => {
    const source = await sharp({
      create: {
        width: 200,
        height: 120,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    // Top edge at y = 0.1 * 200 = 20. Scaled stroke is 16px, so row 26 is red.
    const baked = await bakeAnnotations(
      source,
      [
        {
          type: "rect",
          id: "box",
          color: "#FF0000",
          strokeWidth: 4,
          x: 0.2,
          y: 0.1,
          w: 0.5,
          h: 0.3,
        },
      ],
      { stageWidth: 50 },
    );

    assert.equal(isRed(await rgbAt(baked, 90, 20)), true);
    assert.equal(isRed(await rgbAt(baked, 90, 26)), true);
    assert.equal(isWhite(await rgbAt(baked, 90, 50)), true);
  });

  it("paints an arrow shaft, not only the head, and keeps it on the same pixels", async () => {
    const width = 400;
    const height = 300;
    const stageWidth = 100;
    const source = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    // Horizontal arrow. y is a fraction of WIDTH: 0.4 * 400 = row 160.
    // Head is max(10, 4*3) = 12 screen px → 12/100*400 = 48 image px.
    // The shaft midpoint sits well before that triangle.
    const stroke = 4;
    const head = annotationMarkStrokePx(Math.max(10, stroke * 3), width, stageWidth);
    const x1 = 0.1 * width;
    const x2 = 0.9 * width;
    const y = 0.4 * width;
    const shaftMidX = Math.round((x1 + (x2 - head)) / 2);
    const shaftMidY = Math.round(y);

    const arrow = {
      type: "arrow" as const,
      id: "arrow",
      color: "#FF0000",
      strokeWidth: stroke,
      points: [0.1, 0.4, 0.9, 0.4] as [number, number, number, number],
    };

    const baked = await bakeAnnotations(source, [arrow], { stageWidth });

    assert.equal(isRed(await rgbAt(baked, shaftMidX, shaftMidY)), true);
    assert.equal(isWhite(await rgbAt(baked, shaftMidX, shaftMidY + 24)), true);
    assert.equal(isRed(await rgbAt(baked, Math.round(x2 - 4), shaftMidY)), true);
    assert.ok(x2 - head > x1 + 10);
    assert.ok(shaftMidX < x2 - head);

    const stub = await bakeAnnotations(
      source,
      [
        {
          ...arrow,
          id: "stub",
          points: [0.5, 0.4, 0.5, 0.4],
        },
      ],
      { stageWidth },
    );
    assert.equal(isWhite(await rgbAt(stub, Math.round(0.5 * width), shaftMidY)), true);
  });

  it("scales a thicker stroke and a circle, and keeps a second colour", async () => {
    const source = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const baked = await bakeAnnotations(
      source,
      [
        {
          type: "circle",
          id: "ring",
          color: "#0000FF",
          strokeWidth: 8,
          x: 0.5,
          y: 0.5,
          r: 0.2,
        },
      ],
      { stageWidth: 50 },
    );

    // Centre (100, 100). Radius 0.2 * 200 = 40. Stroke 8/50*200 = 32,
    // so a pixel 40px right of centre is inside the ring, and the hole is white.
    const ring = await rgbAt(baked, 140, 100);
    assert.equal(ring[2] > 180 && ring[0] < 80, true);
    assert.equal(isWhite(await rgbAt(baked, 100, 100)), true);
  });
});
