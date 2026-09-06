import { Link } from "wouter";

// Simplified echo of the club crest (royal-blue shield, gold edge, three
// marks rising like the crest's doves). Swap the <svg> for the real crest
// artwork once a transparent-background version of the logo is in public/.
export default function Wordmark({ onDark = false }: { onDark?: boolean }) {
  const text = onDark ? "text-cream" : "text-club-900";
  const sub = onDark ? "text-cream/60" : "text-club-500";
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Gisborne Park Golf Club, home">
      <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M32 4 L56 11 V32 C56 46.5 46 56.5 32 61.5 C18 56.5 8 46.5 8 32 V11 Z"
          fill="#2B3990"
          stroke="#C9A227"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="24" cy="21" r="4.5" fill="#FAF6EB" />
        <circle cx="32" cy="33" r="4.5" fill="#FAF6EB" />
        <circle cx="40" cy="45" r="4.5" fill="#FAF6EB" />
      </svg>
      <span className="leading-none">
        <span className={`block font-display text-[17px] ${text}`}>Gisborne Park</span>
        <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] ${sub}`}>
          Golf Club
        </span>
      </span>
    </Link>
  );
}
