import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Phone,
  Mail,
  ArrowUpRight,
  ArrowRight,
  Star,
  MapPin,
  ScanSearch,
  ReceiptText,
  Axe,
  Sparkles,
  Check,
  ShieldCheck,
  Clock,
  Plus,
} from "lucide-react";
import { SiFacebook } from "react-icons/si";
import logoImage from "@assets/logo-11_1775755479888.png";
import SEO from "@/components/SEO";
import HeaderV2 from "@/components/HeaderV2";
import InquiryForm from "@/components/InquiryForm";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

interface ApiReview {
  id?: string;
  name: string;
  location?: string;
  rating: number;
  comment?: string;
  service?: string;
}
interface ApiResponse {
  success: boolean;
  reviews?: ApiReview[];
  message?: string;
}

const PHONE = "0272166882";

const services = [
  { title: "Tree Removal", desc: "Safe, controlled removals — from hazardous trees to tight-access sections.", img: "/hazardous-tree-removal.jpg", route: "/tree-removal", feature: true },
  { title: "Tree Pruning", desc: "Healthier structure, better light, and a tidier canopy.", img: "/tree-pruning.jpg", route: "/tree-pruning" },
  { title: "Stump Grinding", desc: "Ground out below the surface — reclaim your space.", img: "/stump-grinding.jpg", route: "/stump-grinding" },
  { title: "Hedge Trimming", desc: "Crisp, healthy hedges shaped to last.", img: "/hedge-trimming.jpg", route: "/hedge-trimming" },
  { title: "24/7 Emergency", desc: "Storm damage? We respond fast, day or night.", img: "/emergency-tree-removal.jpg", route: "/tree-removal" },
  { title: "Mulch Delivery", desc: "Fresh arborist mulch, delivered to your gate.", img: "/team-photo-real.jpg", route: "#contact" },
];

const steps = [
  { n: "01", icon: ScanSearch, title: "On-site assessment", desc: "We walk the site — access, hazards, ground conditions, gear needed. No guessing from photos." },
  { n: "02", icon: ReceiptText, title: "Clear plan & quote", desc: "A straight, itemised quote up front. You know the scope, timeline and price before we start." },
  { n: "03", icon: Axe, title: "Controlled removal", desc: "The right gear for the job and a qualified crew — safe, precise work every time." },
  { n: "04", icon: Sparkles, title: "Thorough clean-up", desc: "All waste cleared, area raked and blown down — ready to use straight away." },
];

const why = [
  ["Precision execution", "We plan thoroughly and deliver safely — zero guesswork."],
  ["Clear communication", "Timing updates so you always know what's happening."],
  ["No mess left behind", "Complicated jobs handled properly, site left spotless."],
  ["Local & accountable", "An 18-year Gisborne crew you'll actually see again."],
];

const faqs = [
  ["How much does it cost to remove a tree?", "Costs vary with size, location, condition and access, and whether stump grinding or debris removal is included. Small trees in open areas are quick and affordable; large trees near buildings or powerlines need more time, gear and care. You'll get a clear, itemised quote before any work begins."],
  ["Do you provide free quotes?", "Yes — all quotes are free and no-obligation. We visit your property, assess the job in person, and walk you through our recommendations."],
  ["Do I need council permission to remove a tree?", "Sometimes. Gisborne District Council has rules around notable, heritage or protected trees and certain zones. We can help you check whether a resource consent is needed."],
  ["Are you fully insured?", "Yes — we carry full public liability insurance for every job, and we're happy to provide a certificate of currency on request."],
  ["Are your arborists qualified?", "Absolutely. Our team holds recognised arboricultural qualifications and keeps skills current through ongoing training."],
  ["What if something gets damaged?", "We take every precaution with rigging, drop zones and ground protection. In the unlikely event of damage, our insurance covers it and we'll put it right straight away."],
];

const fallbackReviews: ApiReview[] = [
  { id: "1", name: "Sarah M.", location: "Gisborne", rating: 5, service: "Tree Removal", comment: "Did an amazing job removing a massive pine from our backyard. Professional, quick, and cleaned up everything perfectly." },
  { id: "2", name: "Mike P.", location: "Makaraka", rating: 5, service: "Emergency", comment: "Called for an emergency removal after a storm and they were out the same day. Knew exactly what they were doing." },
  { id: "3", name: "Jenny L.", location: "Kaiti", rating: 5, service: "Hedge Trimming", comment: "Had my hedge trimmed and some pruning done. The difference is incredible — garden looks fantastic now." },
  { id: "4", name: "Dave R.", location: "Te Hapara", rating: 5, service: "Stump Grinding", comment: "Top notch. Made quick work of three old stumps that had bothered me for years. Clean job, fair price." },
  { id: "5", name: "Lisa K.", location: "Elgin", rating: 5, service: "Tree Pruning", comment: "These guys are legends! Friendly, reliable, and really know their stuff. Wouldn't use anyone else around Gizzy." },
  { id: "6", name: "Tom H.", location: "Wainui", rating: 5, service: "Tree Care", comment: "Came out the same week for a quote. Fair pricing, excellent work, left the place spotless. Can't ask for more." },
];

function GoogleG({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Google">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function Home() {
  const { data: fb } = useQuery<ApiResponse>({ queryKey: ["/api/reviews/facebook"], retry: 1, staleTime: 1000 * 60 * 10 });
  const { data: gg } = useQuery<ApiResponse>({ queryKey: ["/api/reviews/google"], retry: 1, staleTime: 1000 * 60 * 10 });

  const apiReviews = [...(fb?.reviews ?? []), ...(gg?.reviews ?? [])];
  const reviews = (apiReviews.length > 0 ? apiReviews : fallbackReviews).slice(0, 6);

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
    <div className="scroll-smooth bg-paper text-ink antialiased selection:bg-neon selection:text-black">
      <SEO
        title="Treemarkables — Gisborne's Number 1 Arborist & Tree Care"
        description="Gisborne's trusted arborists for safe tree removals, expert pruning, stump grinding and hedge trimming across Tairāwhiti and the East Coast."
        canonicalUrl="https://www.treemarkables.co.nz/"
      />

      <HeaderV2 />

      {/* ── Hero ── */}
      <section id="top" className="relative min-h-[100svh] flex items-end overflow-hidden bg-ink">
        <img src="/team-photo.jpg" alt="Treemarkables arborist team in Gisborne" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/55 via-transparent to-transparent" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 pb-16 pt-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-4 py-1.5 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-neon" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neon">Gisborne · Wairoa · East Coast</span>
            </div>
            <h1 className="font-display font-bold text-white leading-[0.95] tracking-tight" style={{ fontSize: "clamp(44px,7vw,92px)" }}>
              Tree care done<br />once, <span className="text-neon">done right.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed">
              Gisborne's trusted arborists for safe tree removals, expert pruning and tidy clean-ups — backed by 18+ years and 130+ five-star reviews.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#contact" className="inline-flex items-center gap-2 bg-neon text-black font-bold text-base px-7 py-4 rounded-full hover:brightness-95 transition-all shadow-[0_8px_30px_rgba(57,255,20,0.4)]">
                Get a free quote <ArrowRight className="h-5 w-5" />
              </a>
              <a href="#services" className="inline-flex items-center gap-2 text-white font-semibold text-base px-7 py-4 rounded-full border border-white/25 hover:bg-white/10 transition-colors backdrop-blur-sm">
                Explore services
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-neon text-neon" />
                  ))}
                </div>
                <span className="text-sm text-white/80"><strong className="text-white">5.0</strong> · 130+ reviews</span>
              </div>
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <GoogleG className="w-4 h-4" /> Google &amp; Facebook verified
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat bar ── */}
      <section className="bg-ink2 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            ["18+", "Years on the tools"],
            ["130+", "Five-star reviews"],
            ["24/7", "Emergency callouts"],
            ["100%", "Insured & qualified"],
          ].map(([big, small]) => (
            <div key={small} className="text-center md:text-left">
              <div className="font-display font-bold text-neon" style={{ fontSize: "clamp(30px,4vw,46px)" }}>{big}</div>
              <div className="text-sm text-white/60 mt-1">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="bg-paper py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">What we do</div>
              <h2 className="font-display font-bold leading-[1.05] tracking-tight text-ink" style={{ fontSize: "clamp(32px,4.5vw,56px)" }}>
                Full-service tree care,<br className="hidden sm:block" /> across Tairāwhiti.
              </h2>
            </div>
            <p className="text-mute max-w-sm md:text-right">From a single overhanging branch to a full section clear-out — one qualified crew, one tidy finish.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[260px] gap-4">
            {services.map((s) => {
              const inner = (
                <>
                  <img src={s.img} alt={s.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl" />
                  <div className="relative h-full flex flex-col justify-end p-6">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-display font-semibold text-white ${s.feature ? "text-3xl" : "text-xl"}`}>{s.title}</h3>
                      <span className="h-9 w-9 rounded-full bg-neon text-black flex items-center justify-center translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                        <ArrowUpRight className="h-5 w-5" />
                      </span>
                    </div>
                    <p className={`text-white/70 text-sm mt-2 ${s.feature ? "max-w-md text-base" : ""}`}>{s.desc}</p>
                  </div>
                </>
              );
              const cls = `group relative rounded-2xl overflow-hidden ${s.feature ? "sm:col-span-2 sm:row-span-2" : ""}`;
              return s.route.startsWith("#") ? (
                <a key={s.title} href={s.route} className={cls}>{inner}</a>
              ) : (
                <Link key={s.title} href={s.route} className={cls}>{inner}</Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Process ── */}
      <section id="process" className="relative bg-paper py-20 md:py-28 overflow-hidden">
        <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle,rgba(57,255,20,0.10),transparent 70%)" }} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">How we work</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(30px,4vw,52px)" }}>Four steps. Zero loose ends.</h2>
            <p className="text-mute mt-4 text-lg">Tight, efficient jobs from the first site visit to the final rake-down.</p>
          </div>
          <div className="relative">
            <div className="hidden lg:block absolute top-7 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-forest/0 via-forest/25 to-forest/0" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
              {steps.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.n} className="relative text-center lg:text-left">
                    <div className="mx-auto lg:mx-0 h-14 w-14 rounded-2xl bg-neon flex items-center justify-center mb-5 shadow-[0_8px_30px_rgba(57,255,20,0.35)]">
                      <Icon className="h-6 w-6 text-black" />
                    </div>
                    <div className="font-display font-bold text-ink/10 text-2xl absolute top-0 right-0 lg:static lg:mb-1">{s.n}</div>
                    <h3 className="font-display font-semibold text-ink text-xl mb-2">{s.title}</h3>
                    <p className="text-mute text-sm leading-relaxed">{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Why us ── */}
      <section className="bg-paper py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative">
            <div className="absolute -inset-3 rounded-[2rem] bg-neon/15 -z-10" />
            <img src="/team-photo-real.jpg" alt="Treemarkables crew on site" className="rounded-[1.5rem] w-full h-[420px] object-cover shadow-xl" />
            <div className="absolute -bottom-6 -right-2 sm:right-6 bg-ink text-white rounded-2xl px-6 py-5 shadow-2xl">
              <div className="font-display font-bold text-neon text-3xl leading-none">90+</div>
              <div className="text-xs text-white/70 mt-1 max-w-[120px]">five-star jobs and counting</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Why Treemarkables</div>
            <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight" style={{ fontSize: "clamp(30px,4vw,52px)" }}>
              The crew homeowners call first — and call back.
            </h2>
            <p className="text-mute mt-5 text-lg leading-relaxed">
              No guesswork, no surprises, no mess left behind. Just straight-up advice, fair quotes and a job done properly the first time.
            </p>
            <ul className="mt-8 space-y-4">
              {why.map(([title, body]) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-neon/15 border border-neon/40 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-forest" />
                  </span>
                  <div><span className="font-semibold text-ink">{title}.</span> <span className="text-mute">{body}</span></div>
                </li>
              ))}
            </ul>
            <a href="#contact" className="inline-flex items-center gap-2 mt-9 bg-ink text-white font-bold px-7 py-4 rounded-full hover:bg-ink2 transition-colors">
              Book a free site visit <ArrowRight className="h-5 w-5 text-neon" />
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA banner (diagonal split) ── */}
      <section className="relative overflow-hidden bg-[#0b1d0b]">
        <div className="flex flex-col md:flex-row min-h-[360px] md:min-h-[460px]">
          <div className="relative w-full min-h-[260px] md:min-h-0 md:w-[48%] flex-shrink-0" style={{ clipPath: "polygon(0 0,93% 0,100% 100%,0 100%)" }}>
            <img src="/cta-drone.jpg" alt="Treemarkables arborist climbing high in a tree" className="absolute inset-0 w-full h-full object-cover object-center" loading="lazy" />
            <div className="absolute inset-0 bg-black/20" />
          </div>
          <div className="flex-1 flex flex-col justify-center px-8 py-14 md:py-0 md:pl-10 md:pr-16 lg:pl-14 lg:pr-24">
            <p className="font-display font-bold mb-8 text-neon" style={{ fontSize: "clamp(28px,3.5vw,52px)" }}>Get a free quote.</p>
            <div>
              <a href="#contact" className="inline-block bg-neon hover:brightness-95 text-ink font-bold uppercase tracking-[0.12em] px-10 py-4 rounded-md transition text-sm shadow-[0_8px_30px_rgba(57,255,20,0.35)]">
                Request a Quote
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reviews ── */}
      <section id="reviews" className="bg-paper py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Reviews</div>
            <h2 className="font-display font-bold text-ink leading-[1.1] tracking-tight" style={{ fontSize: "clamp(30px,4vw,52px)" }}>
              Loved by <span className="bg-neon text-ink px-2.5 rounded-lg">Gizzy locals</span>.
            </h2>
            <div className="flex items-center justify-center gap-3 mt-6">
              <div className="flex items-center gap-2.5 bg-white border border-ink/10 rounded-xl px-4 py-3 shadow-sm">
                <GoogleG />
                <div className="leading-none"><div className="text-ink font-bold text-sm">49</div><div className="text-mute text-[11px] mt-0.5">Google</div></div>
              </div>
              <div className="flex items-center gap-2.5 bg-white border border-ink/10 rounded-xl px-4 py-3 shadow-sm">
                <SiFacebook style={{ color: "#1877F2", fontSize: 22 }} />
                <div className="leading-none"><div className="text-ink font-bold text-sm">80</div><div className="text-mute text-[11px] mt-0.5">Facebook</div></div>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map((r, i) => (
              <div key={r.id ?? i} className="bg-white border border-ink/10 rounded-2xl p-6 shadow-sm hover:border-neon hover:shadow-md transition-all">
                <div className="flex gap-1 mb-4">
                  {[...Array(Math.min(5, Math.max(0, r.rating || 5)))].map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-[#1aa12a] text-[#1aa12a]" />
                  ))}
                </div>
                <p className="text-ink/80 leading-relaxed mb-5">"{r.comment}"</p>
                <div className="flex items-center justify-between pt-4 border-t border-ink/10">
                  <div>
                    <div className="text-ink font-semibold text-sm">{r.name}</div>
                    {r.location && <div className="text-mute text-xs">{r.location}</div>}
                  </div>
                  {r.service && <span className="text-[11px] font-semibold text-ink bg-neon px-2.5 py-1 rounded-full">{r.service}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guarantee ── */}
      <section className="bg-paper pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="relative overflow-hidden rounded-[2rem] border-2 border-neon bg-white shadow-sm p-10 md:p-14">
            <ShieldCheck className="absolute -right-6 -bottom-6 h-48 w-48 text-neon/25" />
            <div className="relative max-w-3xl mx-auto text-center">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Our promise</div>
              <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(28px,3.6vw,46px)" }}>The Treemarkables Guarantee</h2>
              <p className="text-ink/70 mt-4 text-lg md:text-xl leading-relaxed">
                If we haven't completed the job as promised, we'll come back and fix any issues — free of charge. Simple as that.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-paper py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">FAQ</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(30px,4vw,52px)" }}>Good questions, straight answers.</h2>
          </div>
          <div className="space-y-3">
            {faqs.map(([q, a]) => (
              <details
                key={q}
                className="group bg-white rounded-2xl border border-ink/10 open:border-ink/20 open:shadow-sm transition [&[open]_.faq-plus]:rotate-45"
              >
                <summary className="cursor-pointer flex items-center justify-between gap-4 p-5 list-none [&::-webkit-details-marker]:hidden">
                  <span className="font-semibold text-ink">{q}</span>
                  <span className="faq-plus shrink-0 h-7 w-7 rounded-full bg-paper border border-ink/10 flex items-center justify-center transition-transform">
                    <Plus className="h-4 w-4 text-forest" />
                  </span>
                </summary>
                <div className="px-5 pb-5 -mt-1 text-mute leading-relaxed">{a}</div>
              </details>
            ))}
          </div>
          <p className="text-center text-mute mt-10">
            Still wondering about something?{" "}
            <a href="#contact" className="text-ink font-semibold underline decoration-neon decoration-2 underline-offset-4">Get in touch</a>.
          </p>
        </div>
      </section>

      {/* ── Contact / final CTA ── */}
      <section id="contact" className="relative bg-ink py-20 md:py-28 overflow-hidden">
        <img src="/cta-drone.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/90 to-ink/70" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-neon mb-3">Free quote</div>
            <h2 className="font-display font-bold text-white leading-[1.05] tracking-tight" style={{ fontSize: "clamp(34px,4.8vw,60px)" }}>Let's sort that tree.</h2>
            <p className="text-white/70 mt-5 text-lg max-w-md leading-relaxed">
              Tell us about the job and we'll come take a look. Free, no-obligation quotes across Gisborne and the East Coast — usually back to you within 24 hours.
            </p>
            <div className="mt-8 space-y-4">
              <a href={`tel:${PHONE}`} onClick={handlePhoneClick} className="flex items-center gap-3 text-white hover:text-neon transition-colors">
                <span className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"><Phone className="h-5 w-5" /></span>
                <span className="font-semibold">027 216 6882</span>
              </a>
              <a href="mailto:quotes@treemarkables.nz" className="flex items-center gap-3 text-white hover:text-neon transition-colors">
                <span className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"><Mail className="h-5 w-5" /></span>
                <span className="font-semibold">quotes@treemarkables.nz</span>
              </a>
              <div className="flex items-center gap-3 text-white/70">
                <span className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center"><MapPin className="h-5 w-5" /></span>
                <span>Gisborne &amp; surrounding areas</span>
              </div>
            </div>
          </div>
          <div>
            <InquiryForm />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-ink border-t border-white/10 py-14">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-2 max-w-sm">
              <img src={logoImage} alt="Treemarkables" className="h-16 w-auto object-contain mb-4" />
              <p className="text-white/55 leading-relaxed">
                Qualified Gisborne arborists for safe tree removal, pruning, stump grinding and hedge trimming across Tairāwhiti and the East Coast.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Services</h4>
              <ul className="space-y-2.5 text-white/55 text-sm">
                <li><Link href="/tree-removal" className="hover:text-neon transition-colors">Tree Removal</Link></li>
                <li><Link href="/tree-pruning" className="hover:text-neon transition-colors">Tree Pruning</Link></li>
                <li><Link href="/stump-grinding" className="hover:text-neon transition-colors">Stump Grinding</Link></li>
                <li><Link href="/hedge-trimming" className="hover:text-neon transition-colors">Hedge Trimming</Link></li>
                <li><Link href="/blog" className="hover:text-neon transition-colors">Tree Care Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2.5 text-white/55 text-sm">
                <li><a href={`tel:${PHONE}`} onClick={handlePhoneClick} className="hover:text-neon transition-colors">027 216 6882</a></li>
                <li><a href="mailto:quotes@treemarkables.nz" className="hover:text-neon transition-colors">quotes@treemarkables.nz</a></li>
                <li>Gisborne &amp; surrounds</li>
                <li className="flex items-center gap-1.5 pt-1 text-neon/90"><Clock className="h-3.5 w-3.5" />24/7 emergency</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-white/40 text-sm">
            <span>© {new Date().getFullYear()} Treemarkables. All rights reserved.</span>
            <Link href="/privacy-policy" className="hover:text-neon transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
