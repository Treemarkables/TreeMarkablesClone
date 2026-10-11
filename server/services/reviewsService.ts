/**
 * Reviews Service - Fetch Google and Facebook Reviews
 *
 * Setup Instructions:
 *
 * GOOGLE REVIEWS:
 * 1. Get your Google Place ID:
 *    - Go to https://developers.google.com/maps/documentation/places/web-service/place-id
 *    - Or search your business on Google Maps, the Place ID is in the URL
 * 2. Get Google Places API Key:
 *    - Go to https://console.cloud.google.com/
 *    - Create/select a project
 *    - Enable "Places API"
 *    - Create credentials (API Key)
 * 3. Add these DigitalOcean environment variables on the app:
 *    - GOOGLE_PLACES_API_KEY
 *    - GOOGLE_PLACE_ID
 *
 * FACEBOOK REVIEWS:
 * 1. Get your Facebook Page ID:
 *    - Go to your Facebook Page
 *    - Click "About" → Page Transparency → Page ID
 * 2. Get Page Access Token:
 *    - Go to https://developers.facebook.com/tools/explorer/
 *    - Select your page
 *    - Generate token with 'pages_read_engagement' permission
 *    - Use Access Token Tool to extend it (never expires)
 * 3. Add these DigitalOcean environment variables on the app:
 *    - FACEBOOK_PAGE_ACCESS_TOKEN
 *    - FACEBOOK_PAGE_ID
 *    - FACEBOOK_GRAPH_VERSION (optional, default v23.0)
 */

import fs from "fs";
import path from "path";
import {
  facebookErrorInfo,
  facebookGraphUrl,
  logFacebookApiError,
  redactFacebookSecrets,
  type FacebookErrorInfo,
} from "../config/facebookGraph";

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
  profile_photo_url?: string;
}

interface GooglePlacesResponse {
  result?: {
    reviews?: GoogleReview[];
    rating?: number;
    user_ratings_total?: number;
  };
  status: string;
  error_message?: string;
}

interface Review {
  id: string;
  name: string;
  location: string;
  rating: number;
  comment: string;
  service: string;
  source: string;
  date: string;
}

export interface FacebookReviewsPayload {
  success: boolean;
  reviews: Review[];
  cached?: boolean;
  message?: string;
  code?: number;
  fbtraceId?: string;
}

export interface FacebookConnectionStatus {
  connected: boolean;
  pageName?: string;
  pageId?: string;
  message?: string;
  code?: number;
  fbtraceId?: string;
}

type FacebookFetch = (url: string, init?: RequestInit) => Promise<Response>;

interface FacebookRequestOptions {
  fetchImpl?: FacebookFetch;
  env?: NodeJS.ProcessEnv;
  cacheFile?: string;
  now?: number;
  ttlMs?: number;
}

interface StoredReviews {
  fetchedAt: number;
  reviews: Review[];
}

/** Fresh window. Older copies are still served when Graph fails. */
export const FACEBOOK_REVIEWS_TTL_MS = 10 * 60 * 1000;

const memoryByFile = new Map<string, StoredReviews>();

function defaultCacheFile(): string {
  return path.join(process.cwd(), ".cache", "facebook-reviews.json");
}

function isReview(value: unknown): value is Review {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string"
    && typeof row.name === "string"
    && typeof row.location === "string"
    && typeof row.rating === "number"
    && Number.isFinite(row.rating)
    && typeof row.comment === "string"
    && typeof row.service === "string"
    && row.source === "facebook"
    && typeof row.date === "string";
}

function readCacheFile(file: string): StoredReviews | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const fetchedAt = typeof record.fetchedAt === "number"
      ? record.fetchedAt
      : Date.parse(String(record.fetchedAt ?? ""));
    if (!Number.isFinite(fetchedAt)) return null;
    if (!Array.isArray(record.reviews)) return null;
    const reviews = record.reviews.filter(isReview).slice(0, 25);
    if (reviews.length === 0) return null;
    return { fetchedAt, reviews };
  } catch {
    return null;
  }
}

function writeCacheFile(file: string, stored: StoredReviews): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(stored), "utf8");
    fs.renameSync(tmp, file);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Facebook reviews cache write failed: ${redactFacebookSecrets(message)}`);
  }
}

function lastGood(file: string): StoredReviews | null {
  const memory = memoryByFile.get(file);
  if (memory && memory.reviews.length > 0) return memory;
  const disk = readCacheFile(file);
  if (disk) memoryByFile.set(file, disk);
  return disk;
}

function remember(file: string, stored: StoredReviews): void {
  if (stored.reviews.length === 0) return;
  memoryByFile.set(file, stored);
  writeCacheFile(file, stored);
}

/** Drop the in-process copy for one cache file. The file on disk is left as-is. */
export function forgetFacebookReviewsMemory(cacheFile: string): void {
  memoryByFile.delete(cacheFile);
}

function withCache(
  cached: StoredReviews | null,
  info: Pick<FacebookErrorInfo, "message" | "code" | "fbtraceId">,
): FacebookReviewsPayload {
  if (cached && cached.reviews.length > 0) {
    console.error(`Serving ${cached.reviews.length} cached Facebook reviews after: ${info.message}`);
    return {
      success: true,
      reviews: cached.reviews,
      cached: true,
      message: info.message,
      code: info.code,
      fbtraceId: info.fbtraceId,
    };
  }
  return {
    success: false,
    reviews: [],
    message: info.message,
    code: info.code,
    fbtraceId: info.fbtraceId,
  };
}

function mapFacebookRatings(data: unknown): Review[] {
  if (!Array.isArray(data)) return [];
  const reviews: Review[] = [];
  for (let index = 0; index < data.length && reviews.length < 25; index++) {
    const item = data[index];
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const reviewer = row.reviewer && typeof row.reviewer === "object"
      ? (row.reviewer as Record<string, unknown>)
      : null;
    const name = typeof reviewer?.name === "string" && reviewer.name.trim()
      ? reviewer.name.trim()
      : "Facebook User";
    const recommendation = typeof row.recommendation_type === "string" ? row.recommendation_type : "";
    let rating = 5;
    if (typeof row.rating === "number" && Number.isFinite(row.rating)) {
      rating = Math.min(5, Math.max(1, Math.round(row.rating)));
    } else if (recommendation === "negative") {
      rating = 1;
    }
    reviews.push({
      id: `fb-${index}`,
      name,
      location: "Facebook",
      rating,
      comment: typeof row.review_text === "string" ? row.review_text : "",
      service: "Service",
      source: "facebook",
      date: typeof row.created_time === "string" ? row.created_time : new Date(0).toISOString(),
    });
  }
  return reviews;
}

function errorRecord(body: unknown): unknown {
  if (!body || typeof body !== "object") return { message: "Facebook returned an unreadable response" };
  const record = body as Record<string, unknown>;
  if ("error" in record && record.error) return record.error;
  return null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetch Google Reviews using Places API
 */
export async function fetchGoogleReviews(): Promise<Review[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    console.log("⚠️ Google Reviews: Missing API key or Place ID. Add GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID to the DigitalOcean environment.");
    return [];
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&key=${apiKey}`;

    const response = await fetch(url);
    const data: GooglePlacesResponse = await response.json();

    if (data.status !== "OK") {
      console.error("❌ Google Reviews API error:", data.status, data.error_message);
      return [];
    }

    const reviews = data.result?.reviews || [];
    console.log(`✅ Fetched ${reviews.length} Google reviews`);

    return reviews.map((review, index) => ({
      id: `google-${index}`,
      name: review.author_name,
      location: "Google Review",
      rating: review.rating,
      comment: review.text || "",
      service: "Customer Review",
      source: "google",
      date: new Date(review.time * 1000).toISOString(),
    }));
  } catch (error) {
    console.error("❌ Error fetching Google reviews:", error);
    return [];
  }
}

async function fetchFacebookReviewsPayload(options: FacebookRequestOptions = {}): Promise<FacebookReviewsPayload> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cacheFile = options.cacheFile ?? defaultCacheFile();
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? FACEBOOK_REVIEWS_TTL_MS;
  const token = (env.FACEBOOK_PAGE_ACCESS_TOKEN || env.FACEBOOK_ACCESS_TOKEN || "").trim();
  const pageId = (env.FACEBOOK_PAGE_ID || "").trim();
  const cached = lastGood(cacheFile);

  if (cached && now - cached.fetchedAt < ttlMs) {
    return { success: true, reviews: cached.reviews, cached: true };
  }

  if (!token || !pageId) {
    const message = !token
      ? "Facebook Page Access Token not configured. Set FACEBOOK_PAGE_ACCESS_TOKEN in the DigitalOcean environment."
      : "Facebook Page ID not configured. Set FACEBOOK_PAGE_ID in the DigitalOcean environment.";
    console.log(`⚠️ Facebook Reviews: ${message}`);
    return withCache(cached, { message });
  }

  // Same request shape as before (token in the query). The version is the only change.
  // Callers must not log this URL — redactFacebookSecrets strips the token if it leaks into an error.
  const url = facebookGraphUrl(
    `${encodeURIComponent(pageId)}/ratings?access_token=${encodeURIComponent(token)}&fields=${encodeURIComponent("reviewer{name},rating,review_text,created_time,recommendation_type")}&limit=10`,
    env,
  );

  try {
    const response = await fetchImpl(url);
    const body = await readJson(response);
    const graphError = !response.ok ? (errorRecord(body) ?? { message: `Facebook returned HTTP ${response.status}` }) : errorRecord(body);
    if (graphError) {
      const info = facebookErrorInfo(graphError, token);
      logFacebookApiError("reviews", info);
      return withCache(cached, info);
    }

    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const reviews = mapFacebookRatings(record?.data);
    if (reviews.length > 0) {
      remember(cacheFile, { fetchedAt: now, reviews });
    }
    console.log(`✅ Fetched ${reviews.length} Facebook reviews`);
    return { success: true, reviews, cached: false };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Error fetching Facebook reviews";
    const message = redactFacebookSecrets(raw, token);
    console.error(`Facebook reviews error: ${message}`);
    return withCache(cached, { message });
  }
}

let defaultInflight: Promise<FacebookReviewsPayload> | null = null;

/**
 * Public Facebook reviews. A recent success is served from memory (or the
 * last-good file after a restart). When Graph fails, that last good copy is
 * returned with Facebook's message and code so the page section stays filled.
 */
export async function loadFacebookPageReviews(options?: FacebookRequestOptions): Promise<FacebookReviewsPayload> {
  if (options) return fetchFacebookReviewsPayload(options);
  if (!defaultInflight) {
    defaultInflight = fetchFacebookReviewsPayload().finally(() => {
      defaultInflight = null;
    });
  }
  return defaultInflight;
}

/**
 * Fetch Facebook Reviews using Graph API.
 * On failure, returns the last good cached reviews when any exist.
 */
export async function fetchFacebookReviews(): Promise<Review[]> {
  const result = await loadFacebookPageReviews();
  return result.reviews;
}

/** Page-name probe for /api/facebook/status. Does not cache reviews. */
export async function checkFacebookConnection(options: FacebookRequestOptions = {}): Promise<FacebookConnectionStatus> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = (env.FACEBOOK_PAGE_ACCESS_TOKEN || env.FACEBOOK_ACCESS_TOKEN || "").trim();
  const pageId = (env.FACEBOOK_PAGE_ID || "").trim();

  if (!token || !pageId) {
    return {
      connected: false,
      message: "Facebook credentials not configured. Set FACEBOOK_PAGE_ACCESS_TOKEN and FACEBOOK_PAGE_ID in the DigitalOcean environment.",
    };
  }

  const url = facebookGraphUrl(
    `${encodeURIComponent(pageId)}?fields=name&access_token=${encodeURIComponent(token)}`,
    env,
  );
  try {
    const response = await fetchImpl(url);
    const body = await readJson(response);
    const graphError = !response.ok ? (errorRecord(body) ?? { message: `Facebook returned HTTP ${response.status}` }) : errorRecord(body);
    if (graphError) {
      const info = facebookErrorInfo(graphError, token);
      logFacebookApiError("status", info);
      return { connected: false, message: info.message, code: info.code, fbtraceId: info.fbtraceId };
    }
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const pageName = typeof record?.name === "string" ? record.name : undefined;
    if (!pageName) {
      return { connected: false, message: "Facebook returned no page name" };
    }
    return { connected: true, pageName, pageId };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Error checking Facebook status";
    const message = redactFacebookSecrets(raw, token);
    console.error(`Facebook status check error: ${message}`);
    return { connected: false, message };
  }
}

/**
 * Fetch all reviews from both Google and Facebook
 */
export async function fetchAllReviews(): Promise<{ google: Review[]; facebook: Review[] }> {
  const [googleReviews, facebookReviews] = await Promise.all([
    fetchGoogleReviews(),
    fetchFacebookReviews(),
  ]);

  return {
    google: googleReviews,
    facebook: facebookReviews,
  };
}
