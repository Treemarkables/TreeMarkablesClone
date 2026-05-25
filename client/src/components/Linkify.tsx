// Linkify — render a plain-text string with any embedded http(s) URLs turned
// into clickable <a> elements. Used on customer-facing surfaces (QuoteViewer,
// ProposalViewer) where the underlying field is stored as plain text but we
// want URLs (e.g. the auto-injected "Watch the on-site walkthrough" link
// from the videos pipeline) to be tappable.
//
// Intentionally minimal: one regex, no markdown, no auto-detection of
// non-URL handles. If we ever want full markdown rendering we'd bring in a
// library; for now plain-URL detection is sufficient.

import type { ReactNode } from "react";

// Matches http:// or https:// followed by non-whitespace. The trailing
// punctuation strip below handles common "sentence ends with a URL" cases
// where the period / comma shouldn't be part of the link.
const URL_REGEX = /https?:\/\/[^\s]+/g;
const TRAILING_PUNCT = /[.,;:!?)\]}>]+$/;

interface LinkifyProps {
  children: string | null | undefined;
  className?: string;
}

export function Linkify({ children, className }: LinkifyProps) {
  if (!children) return null;
  const text = children;
  const parts: ReactNode[] = [];
  let cursor = 0;

  // Array.from sidesteps the project's older TS iteration target without
  // needing a tsconfig change.
  const matches = Array.from(text.matchAll(URL_REGEX));
  for (const match of matches) {
    const matchedAt = match.index ?? 0;
    let url = match[0];
    let trailing = "";
    // Pull off trailing punctuation so "watch.example.com." doesn't make the
    // period part of the URL.
    const trail = url.match(TRAILING_PUNCT);
    if (trail) {
      trailing = trail[0];
      url = url.slice(0, url.length - trailing.length);
    }
    if (matchedAt > cursor) {
      parts.push(text.slice(cursor, matchedAt));
    }
    parts.push(
      <a
        key={matchedAt}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={
          className ??
          "text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        }
      >
        {url}
      </a>,
    );
    if (trailing) parts.push(trailing);
    cursor = matchedAt + url.length + trailing.length;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return <>{parts}</>;
}
