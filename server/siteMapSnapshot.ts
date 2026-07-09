// Server-side rendering of a job's site map (satellite imagery + tree markers)
// into a single PNG, so the marked-up bird's-eye view can ride the existing
// proposal photo pipeline (viewer, PDF, email) as a plain /objects/photos URL.
//
// Client-side canvas capture is not an option for the same reason photo
// annotation moved server-side (see photoAnnotationRenderer.ts): the GCS-served
// routes send no CORS headers and Leaflet tiles taint the canvas on iOS.
//
// Imagery comes from the same keyless Esri World_Imagery tile service the
// interactive JobSiteMap component uses; attribution is burned into the PNG.

import sharp from "sharp";

export class NoMarkersError extends Error {
  constructor() {
    super("Job has no site-map markers");
    this.name = "NoMarkersError";
  }
}

export interface SnapshotMarker {
  latitude: string;
  longitude: string;
  label: string | null;
  notes: string | null;
  markerType: string | null;
  color: string | null;
}

const TILE_SIZE = 256;
const MAX_CANVAS_W = 1280;
const MAX_CANVAS_H = 960;
// Floor so a tight marker cluster still gets enough surrounding property for
// context instead of a postage stamp.
const MIN_CANVAS_W = 800;
const MIN_CANVAS_H = 600;
const MIN_ZOOM = 16;
// Matches the detail the interactive map shows when framing a property.
// Where native z20 coverage is missing, fetchTile falls back to the upscaled
// parent tile, so a customer-facing image degrades soft instead of grey.
const MAX_ZOOM = 20;
const ATTRIBUTION = "Imagery (c) Esri, Maxar, Earthstar Geographics";

const XML_ENTITIES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&apos;",
};
const escapeXml = (s: string): string =>
  s.replace(/[<>&"']/g, (c) => XML_ENTITIES[c]);

// Global Web-Mercator pixel coordinates at a given zoom.
function lonToPx(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z * TILE_SIZE;
}
function latToPx(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    2 ** z *
    TILE_SIZE
  );
}

function greyTile(): Promise<Buffer> {
  return sharp({
    create: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      channels: 3,
      background: { r: 220, g: 220, b: 220 },
    },
  })
    .png()
    .toBuffer();
}

async function fetchTileRaw(
  z: number,
  x: number,
  y: number,
): Promise<Buffer | null> {
  const max = 2 ** z;
  if (y < 0 || y >= max) return null;
  const wrappedX = ((x % max) + max) % max;
  try {
    const res = await fetch(
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${wrappedX}`,
    );
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// A tile that's missing at this zoom (thin native coverage) is replaced with
// its parent tile's quadrant upscaled — soft imagery beats a grey hole in a
// customer-facing image. One level only; beyond that render grey.
async function fetchTile(z: number, x: number, y: number): Promise<Buffer> {
  const direct = await fetchTileRaw(z, x, y);
  if (direct) return direct;

  const parent = await fetchTileRaw(z - 1, x >> 1, y >> 1);
  if (!parent) return greyTile();
  try {
    const half = TILE_SIZE / 2;
    return await sharp(parent)
      .extract({
        left: (x & 1) * half,
        top: (y & 1) * half,
        width: half,
        height: half,
      })
      .resize(TILE_SIZE, TILE_SIZE)
      .png()
      .toBuffer();
  } catch {
    return greyTile();
  }
}

function markerNumber(i: number): string {
  return String(i + 1);
}

/**
 * Render the job's markers over stitched satellite tiles and return a PNG.
 * Throws NoMarkersError when the marker list is empty.
 */
export async function renderSiteMapSnapshot(
  markers: SnapshotMarker[],
): Promise<Buffer> {
  if (markers.length === 0) throw new NoMarkersError();

  const lats = markers.map((m) => parseFloat(m.latitude));
  const lngs = markers.map((m) => parseFloat(m.longitude));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Highest zoom in [MIN_ZOOM, MAX_ZOOM] where the padded marker bbox fits the
  // max canvas. A single marker (zero-size bbox) always fits → MAX_ZOOM.
  let zoom = MIN_ZOOM;
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const wPx = (lonToPx(maxLng, z) - lonToPx(minLng, z)) * 1.5; // 25% pad each side
    const hPx = (latToPx(minLat, z) - latToPx(maxLat, z)) * 1.5;
    if (wPx <= MAX_CANVAS_W && hPx <= MAX_CANVAS_H) {
      zoom = z;
      break;
    }
  }

  // Size the canvas to the marker spread (with generous padding) so a tight
  // cluster on one property isn't a speck in a suburb-wide frame.
  const bboxPxW = lonToPx(maxLng, zoom) - lonToPx(minLng, zoom);
  const bboxPxH = latToPx(minLat, zoom) - latToPx(maxLat, zoom);
  const clamp = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Math.ceil(n)));
  const canvasW = clamp(bboxPxW * 2.5, MIN_CANVAS_W, MAX_CANVAS_W);
  const canvasH = clamp(bboxPxH * 2.5, MIN_CANVAS_H, MAX_CANVAS_H);

  const centerPxX = (lonToPx(minLng, zoom) + lonToPx(maxLng, zoom)) / 2;
  const centerPxY = (latToPx(minLat, zoom) + latToPx(maxLat, zoom)) / 2;
  const originX = Math.round(centerPxX - canvasW / 2);
  const originY = Math.round(centerPxY - canvasH / 2);

  // Stitch the covering tile grid, then crop to the canvas window.
  const minTileX = Math.floor(originX / TILE_SIZE);
  const maxTileX = Math.floor((originX + canvasW - 1) / TILE_SIZE);
  const minTileY = Math.floor(originY / TILE_SIZE);
  const maxTileY = Math.floor((originY + canvasH - 1) / TILE_SIZE);

  const coords: Array<{ x: number; y: number }> = [];
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      coords.push({ x: tx, y: ty });
    }
  }

  // Modest concurrency to be polite to the tile service.
  const tiles: Array<{ x: number; y: number; buf: Buffer }> = [];
  const BATCH = 8;
  for (let i = 0; i < coords.length; i += BATCH) {
    const batch = coords.slice(i, i + BATCH);
    const bufs = await Promise.all(batch.map((c) => fetchTile(zoom, c.x, c.y)));
    batch.forEach((c, j) => tiles.push({ ...c, buf: bufs[j] }));
  }

  const gridW = (maxTileX - minTileX + 1) * TILE_SIZE;
  const gridH = (maxTileY - minTileY + 1) * TILE_SIZE;
  const stitched = await sharp({
    create: {
      width: gridW,
      height: gridH,
      channels: 3,
      background: { r: 220, g: 220, b: 220 },
    },
  })
    .composite(
      tiles.map((t) => ({
        input: t.buf,
        left: (t.x - minTileX) * TILE_SIZE,
        top: (t.y - minTileY) * TILE_SIZE,
      })),
    )
    .png()
    .toBuffer();

  const base = sharp(stitched).extract({
    left: originX - minTileX * TILE_SIZE,
    top: originY - minTileY * TILE_SIZE,
    width: canvasW,
    height: canvasH,
  });

  // ── SVG overlay: numbered marker circles + legend + attribution ──
  const R = 14;
  const parts: string[] = [];

  markers.forEach((m, i) => {
    const cx = lonToPx(parseFloat(m.longitude), zoom) - originX;
    const cy = latToPx(parseFloat(m.latitude), zoom) - originY;
    const color = m.color || "#22c55e";
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${escapeXml(color)}" stroke="white" stroke-width="3"/>` +
        `<text x="${cx}" y="${cy}" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="bold" ` +
        `fill="white" text-anchor="middle" dominant-baseline="central">${markerNumber(i)}</text>`,
    );
  });

  // Legend (top-left): up to 10 rows, then "+N more".
  const LEGEND_MAX = 10;
  const rows = markers.slice(0, LEGEND_MAX).map((m, i) => {
    const type = m.markerType || "tree";
    const label = m.label ? `${m.label} (${type})` : type;
    return { n: markerNumber(i), color: m.color || "#22c55e", text: label };
  });
  const extra = markers.length - LEGEND_MAX;
  const rowH = 22;
  const legendH = rows.length * rowH + (extra > 0 ? rowH : 0) + 12;
  const legendW = 320;
  parts.push(
    `<rect x="8" y="8" width="${legendW}" height="${legendH}" rx="6" fill="white" fill-opacity="0.88"/>`,
  );
  rows.forEach((r, i) => {
    const y = 8 + 6 + i * rowH + rowH / 2;
    parts.push(
      `<circle cx="26" cy="${y}" r="8" fill="${escapeXml(r.color)}" stroke="white" stroke-width="2"/>` +
        `<text x="26" y="${y}" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${r.n}</text>` +
        `<text x="42" y="${y}" font-family="Inter, Arial, sans-serif" font-size="13" fill="#1f2937" dominant-baseline="central">${escapeXml(r.text.slice(0, 40))}</text>`,
    );
  });
  if (extra > 0) {
    const y = 8 + 6 + rows.length * rowH + rowH / 2;
    parts.push(
      `<text x="42" y="${y}" font-family="Inter, Arial, sans-serif" font-size="13" fill="#6b7280" dominant-baseline="central">+${extra} more</text>`,
    );
  }

  // Attribution (bottom-right).
  parts.push(
    `<rect x="${canvasW - 320}" y="${canvasH - 22}" width="320" height="22" fill="black" fill-opacity="0.55"/>` +
      `<text x="${canvasW - 10}" y="${canvasH - 11}" font-family="Inter, Arial, sans-serif" font-size="11" fill="white" text-anchor="end" dominant-baseline="central">${escapeXml(ATTRIBUTION)}</text>`,
  );

  const overlay =
    `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">` +
    parts.join("") +
    `</svg>`;

  return base
    .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
