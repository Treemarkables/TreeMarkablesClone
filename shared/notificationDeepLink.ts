/**
 * Push / bell notification → in-app route.
 *
 * One mapper for FCM data, the iOS tap userInfo flatten, and the web
 * service-worker click payload. Job-linked types must never collapse to
 * a bare `/dispatch` when a job id is present — that is the fallback
 * that opens the despatch board instead of the job card.
 */

export const NOTIFICATION_NAV_STORAGE_KEY = "pendingNotificationNav";
export const DISPATCH_OPEN_JOB_KEY = "dispatch_open_job";
export const DISPATCH_OPEN_TAB_KEY = "dispatch_open_tab";
export const DISPATCH_OPEN_ENTRY_KEY = "dispatch_open_entry";
export const NOTIFICATION_NAV_TTL_MS = 60_000;

const APP_HOSTS = new Set([
  "app.inflowapp.co.nz",
  "app.treemarkables.co.nz",
  "localhost",
  "127.0.0.1",
]);

const DIARY_TYPES = new Set([
  "email_reply",
  "sms_reply",
  "proposal_sent",
  "photo_added",
  "note_added",
  "holding_message_pending",
  "new_lead",
]);

export type NotificationPayload = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * FCM / APNs sometimes nest custom keys under `data` or `FCM_MSG.data`
 * instead of the top level. Flatten so clickAction / jobId lookups work
 * regardless of which envelope arrived.
 */
export function flattenNotificationPayload(
  raw: NotificationPayload | null | undefined,
): NotificationPayload {
  if (!isPlainObject(raw)) return {};
  const nested: NotificationPayload = {};
  if (isPlainObject(raw.data)) Object.assign(nested, raw.data);
  if (isPlainObject(raw.FCM_MSG) && isPlainObject(raw.FCM_MSG.data)) {
    Object.assign(nested, raw.FCM_MSG.data);
  }
  return { ...nested, ...raw };
}

/** Turn an absolute same-origin URL or an in-app path into a router path. */
export function internalPathFromHref(value: string): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    if (!APP_HOSTS.has(url.hostname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function jobIdFromNotificationPath(path: string): string | null {
  if (!path) return null;
  const jobsMatch = path.match(/^\/jobs\/([^/?#]+)/);
  if (jobsMatch) return decodeURIComponent(jobsMatch[1]);
  const qIndex = path.indexOf("?");
  if (qIndex === -1) return null;
  return new URLSearchParams(path.slice(qIndex + 1)).get("job");
}

export function tabFromNotificationPath(
  path: string,
): "details" | "billing" | "checklist" | "diary" | null {
  const qIndex = path.indexOf("?");
  if (qIndex === -1) return null;
  const tab = new URLSearchParams(path.slice(qIndex + 1)).get("tab");
  if (tab === "diary" || tab === "checklist" || tab === "billing" || tab === "details") {
    return tab;
  }
  return null;
}

export function entryFromNotificationPath(path: string): string | null {
  const qIndex = path.indexOf("?");
  if (qIndex === -1) return null;
  return new URLSearchParams(path.slice(qIndex + 1)).get("entry");
}

function jobDeepLink(
  jobId: string,
  type: string,
  tab: string,
  entry: string,
): string {
  const params = new URLSearchParams();
  params.set("job", jobId);
  const useDiary = tab === "diary" || DIARY_TYPES.has(type);
  if (useDiary) params.set("tab", "diary");
  else if (tab === "checklist" || tab === "billing" || tab === "details") params.set("tab", tab);
  if (entry) params.set("entry", entry);
  return `/dispatch?${params.toString()}`;
}

function isBareDispatch(path: string): boolean {
  return path === "/dispatch" || path === "/dispatch/";
}

/**
 * Map a push payload to an in-app path.
 * Returns null when the notification is not deep-linkable (caller may fall
 * back to opening the app on the default board).
 */
export function resolveNotificationPath(
  raw: NotificationPayload | null | undefined,
): string | null {
  const data = flattenNotificationPayload(raw);
  const type = asString(data.type);
  const jobId = asString(data.jobId);
  const conversationId = asString(data.conversationId);
  const tab = asString(data.tab);
  const entry = asString(data.entry);
  const explicit =
    internalPathFromHref(asString(data.clickAction)) ||
    internalPathFromHref(asString(data.click_action)) ||
    internalPathFromHref(asString(data.clickUrl)) ||
    internalPathFromHref(asString(data.url));

  if (explicit) {
    if (jobId && isBareDispatch(explicit)) {
      return jobDeepLink(jobId, type, tab, entry);
    }
    return explicit;
  }

  switch (type) {
    case "job_assignment":
    case "schedule_change":
      return jobId ? jobDeepLink(jobId, type, tab, entry) : "/dispatch";
    case "email_reply":
    case "sms_reply":
    case "proposal_sent":
    case "photo_added":
    case "note_added":
    case "holding_message_pending":
    case "new_lead":
      if (jobId) return jobDeepLink(jobId, type, tab || "diary", entry);
      return type === "new_lead" ? "/inbox" : "/dispatch";
    case "new_conversation":
    case "conversation_reply":
      if (conversationId) return `/conversation/${conversationId}`;
      if (jobId) return jobDeepLink(jobId, type, "diary", entry);
      return "/inbox";
    case "invoice_payment":
      return "/invoices";
    case "quote_accepted":
      return "/quotes";
    case "test":
      return "/dispatch";
    default:
      if (jobId) return jobDeepLink(jobId, type, tab, entry);
      if (conversationId) return `/conversation/${conversationId}`;
      return null;
  }
}

export type StoredNotificationNav = {
  path: string;
  ts: number;
};

export function parseStoredNotificationNav(
  raw: string | null | undefined,
  now = Date.now(),
  ttlMs = NOTIFICATION_NAV_TTL_MS,
): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredNotificationNav;
    if (!parsed?.path || typeof parsed.path !== "string") return null;
    if (now - (parsed.ts || 0) >= ttlMs) return null;
    return parsed.path;
  } catch {
    return null;
  }
}

export function serializeStoredNotificationNav(
  path: string,
  now = Date.now(),
): string {
  return JSON.stringify({ path, ts: now } satisfies StoredNotificationNav);
}
