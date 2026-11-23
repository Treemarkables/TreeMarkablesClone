/**
 * Detects bulk/marketing email so inbound paths don't turn newsletters into
 * lead conversations. Two signals, both set by every compliant mailing
 * platform and never by a person writing a one-off email:
 *
 *   - List-Unsubscribe header (RFC 2369/8058 — required by Gmail/Yahoo for
 *     bulk senders since Feb 2024)
 *   - Precedence: bulk | list | junk
 *
 * Headers arrive in different shapes per inbound path: mailparser gives a
 * Map, SendGrid Inbound Parse posts one raw RFC-822 header string, and the
 * Resend API returns an object or an array of { name, value }.
 */

const BULK_PRECEDENCE = new Set(['bulk', 'list', 'junk']);

function getHeader(headers: unknown, name: string): string | undefined {
  if (!headers) return undefined;
  const lowerName = name.toLowerCase();

  if (typeof headers === 'string') {
    // Raw header block (SendGrid). Match at line start, tolerate folded values.
    const match = headers.match(new RegExp(`^${lowerName}:[ \\t]*(.*)$`, 'im'));
    return match ? match[1].trim() : undefined;
  }

  if (headers instanceof Map) {
    // mailparser lowercases keys; values are strings or structured objects.
    const value = headers.get(lowerName);
    if (value === undefined || value === null) return undefined;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  if (Array.isArray(headers)) {
    const entry = headers.find(
      (h: any) => typeof h?.name === 'string' && h.name.toLowerCase() === lowerName,
    );
    return entry ? String(entry.value ?? '') : undefined;
  }

  if (typeof headers === 'object') {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === lowerName);
    return key !== undefined ? String((headers as Record<string, unknown>)[key] ?? '') : undefined;
  }

  return undefined;
}

export function isBulkMail(headers: unknown): boolean {
  if (getHeader(headers, 'list-unsubscribe') !== undefined) return true;

  const precedence = getHeader(headers, 'precedence')?.trim().toLowerCase();
  if (precedence && BULK_PRECEDENCE.has(precedence)) return true;

  return false;
}
