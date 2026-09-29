const DETAIL_LIMIT = 300;

/** One line for a JSON `{ message }`. No stack, no connection strings. */
export function clientSafeErrorText(error: unknown, fallback = "Request failed"): string {
  const raw = rawErrorText(error);
  const flat = raw.replace(/\s+/g, " ").trim();
  const redacted = flat
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^/\s:]+:[^@\s/]+@/gi, (match) =>
      match.replace(/:\/\/[^/\s:]+:[^@\s/]+@/, "://[redacted]@"),
    )
    .replace(/\b(password|secret|token|api[_-]?key|authorization)\b\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  const message = redacted || fallback;
  if (message.length <= DETAIL_LIMIT) return message;
  return `${message.slice(0, DETAIL_LIMIT - 1)}…`;
}

function rawErrorText(error: unknown): string {
  if (error instanceof Error) {
    const parts = [error.message || ""];
    const cause = (error as { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message && cause.message !== error.message) {
      parts.push(cause.message);
    }
    return parts.filter(Boolean).join(" — ");
  }
  if (typeof error === "string") return error;
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return String(error);
  }
  if (error == null) return "";
  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
}
