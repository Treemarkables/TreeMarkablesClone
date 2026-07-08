// Recipient validation for the email-send dialogs. Customer records sometimes
// hold malformed addresses (e.g. a bare domain like "international.gghs.school.nz"),
// which pre-fill the To field and only fail server-side after the send attempt.
// Catching them client-side names the bad address before anything is sent.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split a To/CC field on commas/semicolons into individual addresses (mirrors the server's parseRecipients). */
export function splitRecipients(value: string): string[] {
  return value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Validate every address in a To/CC field. Returns an error message naming the
 * first invalid address, or null when all are valid. An empty field is valid —
 * required-ness is the caller's concern.
 */
export function invalidRecipientMessage(value: string, fieldLabel = "To"): string | null {
  for (const addr of splitRecipients(value)) {
    if (!EMAIL_RE.test(addr)) {
      return `"${addr}" in the ${fieldLabel} field isn't a valid email address — it should look like name@example.com. If it came from the customer's saved details, correct it there too.`;
    }
  }
  return null;
}
