// Single Graph API version for every Facebook call (reviews, page status,
// Messenger, and marketing). v18.0 is retired: a valid Page token now gets
// OAuthException code 2500 "Unknown path components", which is not an expired
// token (code 190).
//
// Override with the DigitalOcean env var FACEBOOK_GRAPH_VERSION (for example
// v23.0 or 23.0). An empty or malformed value stays on the default.

export const DEFAULT_FACEBOOK_GRAPH_VERSION = "v23.0";

const VERSION_PATTERN = /^v\d+\.\d+$/;

export function facebookGraphVersion(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.FACEBOOK_GRAPH_VERSION ?? "").trim();
  if (!raw) return DEFAULT_FACEBOOK_GRAPH_VERSION;
  const normalized = raw.startsWith("v") ? raw : `v${raw}`;
  if (!VERSION_PATTERN.test(normalized)) return DEFAULT_FACEBOOK_GRAPH_VERSION;
  return normalized;
}

/** Path may include a query string. It is appended to the fixed Graph host. */
export function facebookGraphUrl(pathAndQuery: string, env?: NodeJS.ProcessEnv): string {
  const suffix = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  return `https://graph.facebook.com/${facebookGraphVersion(env)}${suffix}`;
}

export interface FacebookPageAccessToken {
  /** Sanitized token for Graph calls. Never return this to a client. */
  token: string;
  length: number;
  startsWithEaa: boolean;
  hadQuotesOrWhitespace: boolean;
}

/** Non-secret fields for /api/facebook/status. The token itself is not included. */
export interface FacebookTokenDiagnostics {
  tokenLength: number;
  tokenStartsWithEaa: boolean;
  tokenHadQuotesOrWhitespace: boolean;
}

/**
 * Trim ends (including newlines) and remove up to two matching pairs of
 * surrounding quotes. A pasted DigitalOcean value like `"EAAxxxx"\n` otherwise makes
 * Graph return code 190 "Cannot parse access token".
 */
export function sanitizeFacebookAccessToken(raw: string): string {
  let token = raw.trim();
  for (let i = 0; i < 2; i += 1) {
    const doubleWrapped = token.length >= 2 && token.startsWith('"') && token.endsWith('"');
    const singleWrapped = token.length >= 2 && token.startsWith("'") && token.endsWith("'");
    if (!doubleWrapped && !singleWrapped) break;
    token = token.slice(1, -1).trim();
  }
  return token;
}

/**
 * Page token, falling back to FACEBOOK_ACCESS_TOKEN when the page var is unset.
 * A non-empty page value wins even if sanitizing it leaves nothing.
 */
export function readFacebookPageAccessToken(env: NodeJS.ProcessEnv = process.env): FacebookPageAccessToken {
  const page = env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const raw = page != null && page !== "" ? page : (env.FACEBOOK_ACCESS_TOKEN ?? "");
  const token = sanitizeFacebookAccessToken(raw);
  return {
    token,
    length: token.length,
    startsWithEaa: token.startsWith("EAA"),
    hadQuotesOrWhitespace: raw !== token,
  };
}

export function facebookTokenDiagnostics(access: FacebookPageAccessToken): FacebookTokenDiagnostics {
  return {
    tokenLength: access.length,
    tokenStartsWithEaa: access.startsWithEaa,
    tokenHadQuotesOrWhitespace: access.hadQuotesOrWhitespace,
  };
}

const ACCESS_TOKEN_QUERY = /([?&#]access_token=)[^&#\s]+/gi;
const FACEBOOK_USER_TOKEN = /\bEAA[A-Za-z0-9_-]{8,}\b/g;

/** Strip access tokens from text that might be logged or returned to a client. */
export function redactFacebookSecrets(value: string, secret?: string): string {
  let out = value.replace(ACCESS_TOKEN_QUERY, "$1[redacted]").replace(FACEBOOK_USER_TOKEN, "[redacted]");
  if (secret && secret.length >= 8 && out.includes(secret)) {
    out = out.split(secret).join("[redacted]");
  }
  return out;
}

export interface FacebookErrorInfo {
  message: string;
  code?: number;
  type?: string;
  fbtraceId?: string;
  tokenExpired: boolean;
}

/**
 * Facebook's own message and code. "Token expired" is reserved for code 190.
 * Other OAuthException codes (including 2500, unknown path) keep Facebook's text.
 */
export function facebookErrorInfo(error: unknown, secret?: string): FacebookErrorInfo {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : null;
  const code = typeof record?.code === "number" && Number.isFinite(record.code) ? record.code : undefined;
  const type = typeof record?.type === "string" ? record.type : undefined;
  const fbtraceId = typeof record?.fbtrace_id === "string" ? record.fbtrace_id : undefined;
  const raw = typeof record?.message === "string" && record.message.trim()
    ? record.message.trim()
    : "Facebook request failed";
  const safe = redactFacebookSecrets(raw, secret);
  if (code === 190) {
    const message = /token expired/i.test(safe) ? safe : `Facebook token expired or invalid. ${safe}`;
    return { message, code, type, fbtraceId, tokenExpired: true };
  }
  return { message: safe, code, type, fbtraceId, tokenExpired: false };
}

export function logFacebookApiError(context: string, info: FacebookErrorInfo): void {
  console.error(
    `Facebook API error (${context}): code=${info.code ?? "none"} type=${info.type ?? "none"} fbtrace_id=${info.fbtraceId ?? "none"} message=${info.message}`,
  );
}
