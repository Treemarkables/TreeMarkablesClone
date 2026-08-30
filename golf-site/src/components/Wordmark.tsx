import { Link } from "wouter";

// Pure-SVG roundel + set type; the club has no digital logo assets yet.
export default function Wordmark({ onDark = false }: { onDark?: boolean }) {
  const text = onDark ? "text-cream" : "text-fairway-950";
  const sub = onDark ? "text-cream/60" : "text-fairway-600";
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Gisborne Park Golf Club, home">
      <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="#123527" />
        <circle cx="32" cy="32" r="30" fill="none" stroke="#C9A227" strokeWidth="2.5" />
        <line x1="27" y1="14" x2="27" y2="46" stroke="#FAF6EB" strokeWidth="3" strokeLinecap="round" />
        <path d="M29 15 L46 21 L29 27 Z" fill="#C9A227" />
        <ellipse cx="31" cy="49" rx="13" ry="3.5" fill="#28654A" />
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
