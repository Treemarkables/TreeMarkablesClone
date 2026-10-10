// Editor stroke widths are screen pixels (the 2 / 4 / 8 toolbar). Shape
// coordinates are fractions of the image width, so a 4px stroke painted
// straight onto a 4000px job photo is a hairline and looks like the mark
// never saved. Scale screen pixels by imageWidth / stageWidth.

export const DEFAULT_ANNOTATION_STAGE_WIDTH = 390;

export function annotationMarkStrokePx(
  screenPx: number,
  imageWidth: number,
  stageWidth?: number,
): number {
  if (!Number.isFinite(screenPx) || screenPx <= 0 || !Number.isFinite(imageWidth) || imageWidth <= 0) {
    return 1;
  }
  const stage =
    stageWidth != null && Number.isFinite(stageWidth) && stageWidth > 1
      ? stageWidth
      : DEFAULT_ANNOTATION_STAGE_WIDTH;
  return Math.max(1, (screenPx / stage) * imageWidth);
}
