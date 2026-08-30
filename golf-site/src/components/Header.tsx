import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import Wordmark from "./Wordmark";
import { LinkButton } from "./Button";
import { BRAND, NAV } from "@/lib/brand";

// Routes whose hero is a full-bleed dark photo the transparent header sits on.
const DARK_HERO_ROUTES = new Set(["/", "/course", "/events"]);

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location]);

  // Over a dark hero the transparent header needs light ink; everywhere else
  // (and once scrolled onto the blurred cream bar) it needs dark ink.
  const onDark = !scrolled && !open && DARK_HERO_ROUTES.has(location);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-200 ${
        scrolled || open
          ? "bg-cream/90 backdrop-blur border-b border-fairway-200/70"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-site px-6 md:px-10 h-16 md:h-20 flex items-center justify-between">
        <Wordmark onDark={onDark} />

        <nav className="hidden md:flex items-center gap-1">
          {NAV.slice(1).map((item) => {
            const active = location === item.href;
            const idle = onDark
              ? "text-cream/75 hover:text-cream"
              : "text-bark/60 hover:text-fairway-950";
            const current = onDark ? "text-cream font-semibold" : "text-fairway-950 font-semibold";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${active ? current : idle}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center">
          <LinkButton
            href={BRAND.phoneHref}
            external
            variant={onDark ? "secondary" : "primary"}
            size="md"
          >
            <PhoneIcon />
            {BRAND.phone}
          </LinkButton>
        </div>

        <button
          className={`md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md ${
            onDark ? "text-cream" : "text-fairway-950"
          }`}
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-fairway-200/70 bg-cream">
          <nav className="px-6 py-4 flex flex-col gap-1">
            {NAV.slice(1).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-3 rounded-md text-base text-fairway-950 hover:bg-fairway-100"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2">
              <LinkButton
                href={BRAND.phoneHref}
                external
                variant="primary"
                size="lg"
                className="w-full"
              >
                <PhoneIcon />
                Call {BRAND.phone}
              </LinkButton>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
