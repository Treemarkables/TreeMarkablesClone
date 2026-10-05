/**
 * Run: npx tsx --test server/photoAnnotationRenderer.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { bakeAnnotations } from "./photoAnnotationRenderer.ts";

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
});
