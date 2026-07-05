import { useEffect, useState } from "react";
import HeaderV2 from "@/components/HeaderV2";
import RedesignFooter from "@/components/RedesignFooter";
import RedesignReviews from "@/components/RedesignReviews";
import SEO from "@/components/SEO";
import InquiryForm from "@/components/InquiryForm";
import ContactFormModal from "@/components/ContactFormModal";
import {
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Star,
  Check,
  Plus,
  Scissors,
  Calendar,
  Flower2,
  MoveHorizontal,
} from "lucide-react";
import hedgeCtaImage from "@assets/generated_images/085E9CAA-804B-4CAB-9ACC-5F01FCC57C40_4_5005_c.jpeg";
import sliderPhoto1 from "@assets/generated_images/669C2196-13EE-400F-847C-8CC0E1BCBC49_1_101_o.jpeg";
import sliderPhoto2 from "@assets/generated_images/2766DDE9-E1CE-4202-9826-C98136F33554_1_105_c.jpeg";
import sliderPhoto3 from "@assets/generated_images/F3D7C8A2-F7D8-4CAB-B547-224297C35A84_1_102_o.jpeg";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

const PHONE = "0272166882";
const heroBackground = "/hedge-trimming-hero.jpg";

const introList = [
  "Sharp, clean cuts for healthy regrowth",
  "Tall and hard-to-reach hedges, safely handled",
  "All clippings cleared — section left tidy",
];

const areas: [string, string][] = [
  ["Gisborne Central", "Urban hedge care"],
  ["Kaiti", "Coastal hedges"],
  ["Te Hapara", "Residential boundaries"],
  ["Mangapapa", "Rural property hedges"],
  ["Wainui Beach", "Salt-tolerant hedges"],
  ["Makaraka", "Semi-rural maintenance"],
  ["Elgin", "Farm & estate hedges"],
  ["Ormond", "Rural & lifestyle"],
  ["Makorori", "Coastal properties"],
];

const faqs: [string, string][] = [
  ["How often should hedges be trimmed?", "Most hedges do best with two trims a year — late spring and early autumn. Fast growers or formal shapes may need a little more."],
  ["When should I trim a flowering hedge?", "Always just after it finishes flowering, never before — trimming early cuts off next season's blooms."],
  ["Can you do tall or hard-to-reach hedges?", "Yes — we've got the gear to safely trim tall hedges and shelter belts, even in tight spots."],
  ["Do you offer regular maintenance?", "Yes — we can set up a scheduled program so your hedges stay sharp without you having to think about it."],
  ["Do you clean up the clippings?", "Always — we clear and tidy, leaving your section clean and ready to enjoy."],
  ["Are you insured and qualified?", "Yes — NZ-qualified arborists with $5M public liability cover."],
];

const galleryImages: [string, string][] = [
  [sliderPhoto1, "Trimmed hedge driveway in Gisborne"],
  [sliderPhoto2, "Hedge trimming before and after — long hedge"],
  [sliderPhoto3, "Olive tree shaping before and after"],
  [hedgeCtaImage, "Treemarkables arborist trimming a tall hedge"],
  [heroBackground, "Tall manicured hedge with driveway"],
  ["/hedge-trimming.jpg", "Hedge trimming work in Gisborne"],
];

export default function HedgeTrimming() {
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  useEffect(() => {
    const script = document.createElement("script");
    script.innerHTML = `gtag('event', 'Formsubmission', {});`;
    document.head.appendChild(script);
    return () => {
      const scripts = document.head.querySelectorAll("script");
      scripts.forEach((s) => {
        if (s.innerHTML.includes("Formsubmission")) document.head.removeChild(s);
      });
    };
  }, []);

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.gtag) {
      window.gtag("event", "phone_call_click", { event_category: "Contact", event_label: "Phone Number Click" });
    }
    if (window.gtag_report_conversion) {
      window.gtag_report_conversion(`tel:${PHONE}`);
    }
    setTimeout(() => { window.location.href = `tel:${PHONE}`; }, 100);
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://app.treemarkables.co.nz/hedge-trimming#business",
    name: "Treemarkables Hedge Trimming Services",
    description: "Professional hedge trimming and maintenance services in Gisborne, New Zealand. Expert shaping, pruning, and regular maintenance for residential and commercial hedges.",
    url: "https://app.treemarkables.co.nz/hedge-trimming",
    telephone: "+64272166882",
    address: { "@type": "PostalAddress", addressLocality: "Gisborne", addressRegion: "Gisborne Region", addressCountry: "NZ" },
    geo: { "@type": "GeoCoordinates", latitude: -38.6623, longitude: 178.0176 },
    areaServed: ["Gisborne", "Kaiti", "Te Hapara", "Mangapapa", "Wainui Beach", "Makaraka", "Elgin"],
    serviceType: "Hedge Trimming Service",
    priceRange: "$$",
    openingHours: "Mo-Su 07:00-18:00",
  };

  return (
    <div className="scroll-smooth bg-paper text-ink antialiased selection:bg-neon selection:text-black">
      <SEO
        title="Hedge Trimming Gisborne – Expert Shaping & Care"
        description="Keep your hedges neat year‑round. We trim, shape and maintain hedges for homes and coastal properties in Gisborne and surrounding areas. Request a quote."
        keywords="hedge trimming Gisborne, neat hedges, year-round hedge care, coastal hedge trimming, hedge shaping, hedge maintenance, surrounding areas hedge care"
        ogTitle="Hedge Trimming Gisborne – Neat & Healthy Hedges"
        ogDescription="Keep your hedges neat year‑round. We trim, shape and maintain hedges for homes and coastal properties in Gisborne and surrounding areas. Request a quote."
        ogImage="https://app.treemarkables.co.nz/hedge-trimming.jpg"
        canonicalUrl="https://app.treemarkables.co.nz/hedge-trimming"
        structuredData={structuredData}
      />
      <HeaderV2 />

      {/* Hero */}
      <section id="top" className="relative min-h-[100svh] flex items-end overflow-hidden bg-ink">
        <img src={heroBackground} alt="Neatly trimmed hedge in Gisborne" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-transparent to-transparent" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 pb-16 pt-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-4 py-1.5 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-neon" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neon">Hedge Trimming · Gisborne &amp; East Coast</span>
            </div>
            <h1 className="font-display font-bold text-white leading-[0.95] tracking-tight" style={{ fontSize: "clamp(40px,6.5vw,84px)" }}>
              Sharp hedges,<br /><span className="text-neon">zero fuss.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed">
              Privacy, windbreaks and clean lines — kept in shape year-round. Gisborne's coastal winds grow hedges fast; we keep them tidy.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#contact" onClick={(e) => { e.preventDefault(); setIsQuoteOpen(true); }} className="inline-flex items-center gap-2 bg-neon text-black font-bold text-base px-7 py-4 rounded-full hover:brightness-95 transition-all shadow-[0_8px_30px_rgba(57,255,20,0.4)]">
                Get a free quote <ArrowRight className="h-5 w-5" />
              </a>
              <a href={`tel:${PHONE}`} onClick={handlePhoneClick} className="inline-flex items-center gap-2 text-white font-semibold text-base px-7 py-4 rounded-full border border-white/25 hover:bg-white/10 transition-colors backdrop-blur-sm">
                <Phone className="h-5 w-5" /> 027 216 6882
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-neon text-neon" />)}</div>
                <span className="text-sm text-white/80"><strong className="text-white">5.0</strong> · 130+ reviews</span>
              </div>
              <div className="flex items-center gap-2 text-white/70 text-sm"><Scissors className="h-4 w-4 text-neon" /> Big or small — we've got you sorted</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="bg-ink2 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[["$5M", "Public liability cover"], ["NZQ", "Qualified arborists"], ["2×", "Trims a year recommended"], ["Free", "On-site quotes"]].map(([big, small]) => (
            <div key={small} className="text-center md:text-left">
              <div className="font-display font-bold text-neon" style={{ fontSize: "clamp(26px,3.4vw,40px)" }}>{big}</div>
              <div className="text-sm text-white/60 mt-1">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery */}
      <section className="bg-paper pt-16 md:pt-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Recent work</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(26px,3.4vw,44px)" }}>
              Hedges around Gisborne
            </h2>
          </div>
          <span className="hidden sm:flex items-center gap-1.5 text-mute text-sm shrink-0"><MoveHorizontal className="h-4 w-4" /> Scroll across</span>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-6 px-5 sm:px-8 snap-x snap-mandatory" style={{ scrollbarWidth: "thin" }}>
          {galleryImages.map(([src, alt], i) => (
            <img key={i} src={src} alt={alt} loading="lazy" className="h-64 md:h-80 w-[80vw] sm:w-[440px] object-cover rounded-2xl shrink-0 snap-start" />
          ))}
        </div>
      </section>

      {/* Intro split */}
      <section className="bg-paper py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative order-1 lg:order-none">
            <div className="absolute -inset-3 rounded-[2rem] bg-neon/15 -z-10" />
            <img src="/hedge-trimming.jpg" alt="Crisp hedge lines" className="rounded-[1.5rem] w-full h-[440px] object-cover shadow-xl" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Big or small</div>
            <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight" style={{ fontSize: "clamp(30px,4vw,52px)" }}>
              From low borders to tall shelter belts.
            </h2>
            <p className="text-mute mt-5 text-lg leading-relaxed">
              Whether it's a low boundary hedge or a towering shelter belt, we trim, shape and maintain it with sharp, clean tools — for healthy growth and crisp, even lines.
            </p>
            <ul className="mt-7 space-y-3.5">
              {introList.map((item) => (
                <li key={item} className="flex gap-3.5">
                  <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-neon/15 border border-neon/40 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-forest" />
                  </span>
                  <span className="text-ink/80">{item}</span>
                </li>
              ))}
            </ul>
            <a href="#contact" onClick={(e) => { e.preventDefault(); setIsQuoteOpen(true); }} className="inline-flex items-center gap-2 mt-8 bg-ink text-white font-bold px-7 py-4 rounded-full hover:bg-ink2 transition-colors">
              Get a free quote <ArrowRight className="h-5 w-5 text-neon" />
            </a>
          </div>
        </div>
      </section>

      {/* When to trim */}
      <section className="bg-paper pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Hedge care guide</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(28px,3.8vw,48px)" }}>
              When to trim your hedges
            </h2>
            <p className="text-mute mt-4 text-lg">Right time, right cut — here's how we approach it on the East Coast.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            <div className="bg-white border border-ink/10 rounded-2xl p-7 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-neon/15 border border-neon/40 flex items-center justify-center mb-4"><Calendar className="h-5 w-5 text-forest" /></div>
              <h3 className="font-display font-semibold text-ink text-xl mb-2">Optimal timing</h3>
              <p className="text-mute leading-relaxed mb-5">Most hedges thrive on two trims a year — late spring and early autumn. This rhythm fits Gisborne's seasons and keeps plants strong.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neon/10 rounded-xl p-3"><div className="text-xs font-semibold text-forest mb-0.5">SPRING · Sep–Nov</div><div className="text-sm text-ink/70">Encourages dense new growth</div></div>
                <div className="bg-ink/5 rounded-xl p-3"><div className="text-xs font-semibold text-ink/70 mb-0.5">AUTUMN · Mar–May</div><div className="text-sm text-ink/70">Tidies shape before winter</div></div>
              </div>
            </div>
            <div className="bg-white border border-ink/10 rounded-2xl p-7 shadow-sm">
              <div className="h-12 w-12 rounded-xl bg-neon/15 border border-neon/40 flex items-center justify-center mb-4"><Flower2 className="h-5 w-5 text-forest" /></div>
              <h3 className="font-display font-semibold text-ink text-xl mb-2">Flowering hedges</h3>
              <p className="text-mute leading-relaxed mb-5">Flowering hedges play by different rules — trim too early and you cut off next season's blooms.</p>
              <div className="rounded-xl border-l-4 border-neon bg-neon/5 p-3.5"><div className="text-sm font-semibold text-ink mb-0.5">Golden rule</div><div className="text-sm text-ink/70">Always trim <em>after</em> flowering, never before.</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="relative overflow-hidden bg-[#0b1d0b]">
        <div className="flex flex-col md:flex-row min-h-[360px] md:min-h-[460px]">
          <div className="relative w-full min-h-[260px] md:min-h-0 md:w-[48%] flex-shrink-0" style={{ clipPath: "polygon(0 0,93% 0,100% 100%,0 100%)" }}>
            <img src={hedgeCtaImage} alt="Treemarkables arborist trimming a tall hedge" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-black/20" />
          </div>
          <div className="flex-1 flex flex-col justify-center px-8 py-14 md:py-0 md:pl-10 md:pr-16 lg:pl-14 lg:pr-24">
            <p className="font-display font-bold mb-8 text-neon" style={{ fontSize: "clamp(28px,3.5vw,52px)" }}>Get a free quote.</p>
            <div>
              <a href="#contact" onClick={(e) => { e.preventDefault(); setIsQuoteOpen(true); }} className="inline-block bg-neon hover:brightness-95 text-ink font-bold uppercase tracking-[0.12em] px-10 py-4 rounded-md transition text-sm shadow-[0_8px_30px_rgba(57,255,20,0.35)]">
                Request a Quote
              </a>
            </div>
          </div>
        </div>
      </section>

      <RedesignReviews />

      {/* Service areas */}
      <section id="areas" className="relative bg-paper py-20 md:py-28 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle,rgba(57,255,20,0.10),transparent 70%)" }} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Where we work</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight inline-block bg-neon rounded-full px-8 py-3" style={{ fontSize: "clamp(28px,3.8vw,48px)" }}>
              Hedge trimming across Tairāwhiti
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {areas.map(([t, d]) => (
              <div key={t} className="bg-white border border-ink/10 rounded-2xl p-5 shadow-sm hover:border-neon transition-colors">
                <div className="flex items-center gap-2 mb-1.5"><MapPin className="h-4 w-4 text-forest" /><span className="text-ink font-semibold">{t}</span></div>
                <p className="text-mute text-sm">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-paper pb-20 md:pb-28">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">FAQ</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(28px,3.8vw,48px)" }}>
              Hedge trimming questions, answered.
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map(([q, a]) => (
              <details key={q} className="group bg-white rounded-2xl border border-ink/10 open:border-ink/20 open:shadow-sm transition [&[open]_.faq-plus]:rotate-45">
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
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative bg-paper py-20 md:py-28 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Free quote</div>
            <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight inline-block bg-neon rounded-full px-8 py-4" style={{ fontSize: "clamp(34px,4.8vw,60px)" }}>
              Let's sort those hedges.
            </h2>
            <p className="text-mute mt-5 text-lg max-w-md leading-relaxed">
              Tell us about your hedges and we'll come take a look. Free, no-obligation quotes across Gisborne and the East Coast — usually back to you within 24 hours.
            </p>
            <div className="mt-8 space-y-4">
              <a href={`tel:${PHONE}`} onClick={handlePhoneClick} className="flex items-center gap-3 text-ink hover:text-forest transition-colors">
                <span className="h-10 w-10 rounded-full bg-forest/10 text-forest flex items-center justify-center"><Phone className="h-5 w-5" /></span>
                <span className="font-semibold">027 216 6882</span>
              </a>
              <a href="mailto:quotes@treemarkables.nz" className="flex items-center gap-3 text-ink hover:text-forest transition-colors">
                <span className="h-10 w-10 rounded-full bg-forest/10 text-forest flex items-center justify-center"><Mail className="h-5 w-5" /></span>
                <span className="font-semibold">quotes@treemarkables.nz</span>
              </a>
              <div className="flex items-center gap-3 text-mute">
                <span className="h-10 w-10 rounded-full bg-forest/10 text-forest flex items-center justify-center"><MapPin className="h-5 w-5" /></span>
                <span>Gisborne &amp; surrounding areas</span>
              </div>
            </div>
          </div>
          <div>
            <InquiryForm />
          </div>
        </div>
      </section>

      <ContactFormModal open={isQuoteOpen} onOpenChange={setIsQuoteOpen} />
      <RedesignFooter />
    </div>
  );
}
