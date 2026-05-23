import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Phone, Menu, ChevronDown, ArrowUpRight } from "lucide-react";
import logoImage from "@assets/logo-11_1775755479888.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

const PHONE = "0272166882";
// Base path of the home page. Section links and "Get a quote" hash-jump from here.
const HOME = "/";

const serviceLinks = [
  { href: "/tree-removal", label: "Tree Removal" },
  { href: "/tree-pruning", label: "Tree Pruning" },
  { href: "/stump-grinding", label: "Stump Grinding" },
  { href: "/hedge-trimming", label: "Hedge Trimming" },
];

const sectionLinks = [
  { href: `${HOME}#process`, label: "How we work" },
  { href: `${HOME}#reviews`, label: "Reviews" },
  { href: `${HOME}#faq`, label: "FAQ" },
];

export default function HeaderV2() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.gtag) {
      window.gtag("event", "phone_call_click", { event_category: "Contact", event_label: "Phone Number Click" });
    }
    if (window.gtag_report_conversion) {
      window.gtag_report_conversion(`tel:${PHONE}`);
    }
    // Always open the dialer shortly after — even if the conversion callback is slow/blocked.
    setTimeout(() => {
      window.location.href = `tel:${PHONE}`;
    }, 100);
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-ink/90 backdrop-blur shadow-lg border-b border-white/10"
          : "bg-gradient-to-b from-ink/60 to-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-24">
          <Link href={HOME} className="flex items-center shrink-0">
            <img src={logoImage} alt="Treemarkables" className="h-32 w-auto object-contain" />
          </Link>
          <nav className="hidden lg:flex items-center gap-8">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-xl font-medium text-white/80 hover:text-white transition-colors focus:outline-none">
                  Services <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-ink border-white/10 min-w-[200px] mt-2">
                {serviceLinks.map((s) => (
                  <DropdownMenuItem
                    key={s.href}
                    asChild
                    className="text-base text-white/85 focus:bg-white/10 focus:text-white cursor-pointer"
                  >
                    <Link href={s.href}>{s.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {sectionLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="relative text-xl font-medium text-white/80 hover:text-white transition-colors after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-neon after:transition-all after:duration-300 hover:after:w-full after:content-['']"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <a
              href={`tel:${PHONE}`}
              onClick={handlePhoneClick}
              aria-label="Call 027 216 6882"
              className="inline-flex items-center justify-center gap-2 h-11 px-3 sm:px-4 rounded-full bg-neon text-black font-semibold text-base shadow-[0_4px_18px_rgba(57,255,20,0.35)] hover:brightness-95 transition-all"
            >
              <Phone className="h-5 w-5" />
              <span className="hidden md:inline">027 216 6882</span>
            </a>
            <a
              href={`${HOME}#contact`}
              className="inline-flex items-center gap-1.5 bg-neon text-black text-lg font-bold px-6 py-3 rounded-full hover:brightness-95 transition-all shadow-[0_4px_24px_rgba(57,255,20,0.35)]"
            >
              Get a quote <ArrowUpRight className="h-5 w-5" />
            </a>
            <button
              className="lg:hidden text-white p-2 -mr-2"
              aria-label="Menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Menu className="h-7 w-7" />
            </button>
          </div>
        </div>
      </div>
      {menuOpen && (
        <div className="lg:hidden bg-ink border-t border-white/10">
          <div className="px-5 py-4 flex flex-col gap-1">
            <div className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wider text-white/40">Services</div>
            {serviceLinks.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-3 rounded-lg text-white/90 hover:bg-white/5"
              >
                {s.label}
              </Link>
            ))}
            <div className="h-px bg-white/10 my-2" />
            {sectionLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-3 rounded-lg text-white/90 hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}
            <a href={`tel:${PHONE}`} onClick={handlePhoneClick} className="px-3 py-3 rounded-lg text-neon font-semibold">
              Call 027 216 6882
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
