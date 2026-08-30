import { Link } from "wouter";
import Wordmark from "./Wordmark";
import { BRAND, NAV } from "@/lib/brand";

export default function Footer() {
  return (
    <footer className="bg-club-950 text-cream">
      <div className="mx-auto max-w-site px-6 md:px-10 py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Wordmark onDark />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/60">
              Eighteen tree-lined holes on the flat in Elgin, five minutes from
              the middle of Gisborne. Members, visitors and first-timers all
              welcome, every day of the year.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/40">
              Visit
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              {NAV.slice(1).map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-cream/80 hover:text-cream transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/40">
              Get in touch
            </h3>
            <ul className="mt-4 space-y-2 text-sm text-cream/80">
              <li>
                <a href={BRAND.phoneHref} className="hover:text-cream transition-colors">
                  {BRAND.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${BRAND.email}`} className="hover:text-cream transition-colors">
                  {BRAND.email}
                </a>
              </li>
              <li className="pt-2 text-cream/60">{BRAND.address}</li>
              <li className="text-cream/60">{BRAND.hours}</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-cream/10 pt-6 text-xs text-cream/40">
          © {new Date().getFullYear()} {BRAND.name}
        </div>
      </div>
    </footer>
  );
}
