// The native plugin used to forward only NSError.localizedDescription.
// For Twilio Voice error 31005 that string is "Connection error", which hid
// the code. Prefer the numeric code whenever the plugin (or the JS SDK) has it.

export function formatTwilioError(
  message: string | undefined | null,
  code: string | number | undefined | null,
): string {
  const text = (message ?? "").trim();
  const raw = code == null ? "" : String(code).trim();
  const usable = raw && raw !== "0" ? raw : "";
  if (text && usable) return `${text} (${usable})`;
  if (text) return text;
  if (usable) return `Twilio error ${usable}`;
  return "";
}
