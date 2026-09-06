import { Link } from "wouter";

// The real club crest, extracted to transparent PNGs: navy artwork for light
// backgrounds, cream-tinted for dark bands and the footer.
export default function Wordmark({ onDark = false }: { onDark?: boolean }) {
  const text = onDark ? "text-cream" : "text-club-900";
  const sub = onDark ? "text-cream/60" : "text-club-500";
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="Gisborne Park Golf Club, home">
      <img
        src={onDark ? "/crest-light.png" : "/crest.png"}
        alt=""
        aria-hidden="true"
        className="h-11 w-auto md:h-12"
      />
      <span className="leading-none">
        <span className={`block font-display text-[17px] ${text}`}>Gisborne Park</span>
        <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] ${sub}`}>
          Golf Club
        </span>
      </span>
    </Link>
  );
}
