import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import Wordmark from "./Wordmark";
import { LinkButton } from "./Button";
import { BRAND, NAV } from "@/lib/brand";

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

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-200 ${
        scrolled
          ? "bg-paper/85 backdrop-blur border-b border-ink-100"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-site px-6 md:px-10 h-16 md:h-20 flex items-center justify-between">
        <Wordmark />

        <nav className="hidden md:flex items-center gap-1">
          {NAV.slice(1).map((item) => {
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  active
                    ? "text-ink-900"
                    : "text-ink-500 hover:text-ink-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <LinkButton href={BRAND.loginUrl} external variant="ghost" size="md">
            Log in
          </LinkButton>
          <LinkButton href="/contact" variant="primary" size="md">
            Request access
          </LinkButton>
        </div>

        <button
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-900"
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
        <div className="md:hidden border-t border-ink-100 bg-paper">
          <nav className="px-6 py-4 flex flex-col gap-1">
            {NAV.slice(1).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-3 rounded-md text-base text-ink-900 hover:bg-ink-100"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <LinkButton href={BRAND.loginUrl} external variant="ghost" size="md" className="border border-ink-200">
                Log in
              </LinkButton>
              <LinkButton href="/contact" variant="primary" size="md">
                Request access
              </LinkButton>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
