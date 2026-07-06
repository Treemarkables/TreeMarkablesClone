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
  Plus,
  Settings,
  Footprints,
  Wrench,
  Bug,
  Sprout,
} from "lucide-react";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

const PHONE = "0272166882";
const heroImage = "/stump-grinding-hero.jpg";

const whyGrind = [
  { icon: Footprints, title: "Trip hazard", desc: "A danger to kids on the lawn and guests at the barbecue." },
  { icon: Wrench, title: "Wrecks mowers", desc: "One hidden stump can cost hundreds in repairs to your mower or ride-on." },
  { icon: Bug, title: "Attracts pests", desc: "Borer, termites and wood-rot fungi love a damp Gisborne stump." },
  { icon: Sprout, title: "Suckers & regrows", desc: "Willow, poplar, gum and wattle throw up new shoots for years if not ground out." },
];

const areas: [string, string][] = [
  ["Gisborne Central", "Urban stump removal"],
  ["Kaiti", "Coastal property cleanup"],
  ["Te Hapara", "Residential grinding"],
  ["Mangapapa", "Rural property cleanup"],
  ["Wainui Beach", "Beach property services"],
  ["Makaraka", "Semi-rural removal"],
  ["Elgin", "Farm & estate cleanup"],
  ["Ormond", "Rural & lifestyle"],
  ["Makorori", "Coastal properties"],
];

const faqs: [string, string][] = [
  ["How does stump grinding work?", "A grinding wheel chews the stump 150–300mm below ground, turning it and the surface roots into fine mulch. No chemicals, no waiting, no massive hole."],
  ["Can you reach stumps in tight spots?", "Yes — our narrow-access grinder fits through standard side gates and tight paths most machines simply can't reach."],
  ["Can you handle big rural stumps?", "Absolutely — we run the biggest stump grinder in Gisborne for shelter belts, old gums and paddock clearing."],
  ["What happens to the mulch?", "Your call — raked back into the hole as backfill, or carted away so you can pave, plant or build straight away."],
  ["How much does it cost?", "It depends on diameter, depth, access and how many stumps. Send a photo or two for a fast, real number — or we'll come look, free and no pressure."],
  ["Are you insured and qualified?", "Yes — $5M public liability, fully insured, with qualified arborists and trained operators (not a hire-shop grinder)."],
];

export default function StumpGrinding() {
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
    "@id": "https://app.treemarkables.co.nz/stump-grinding#business",
    name: "Treemarkables Stump Grinding Services",
    description: "Professional stump grinding and removal services in Gisborne, New Zealand. Complete stump removal for residential and commercial properties with advanced grinding equipment.",
    url: "https://app.treemarkables.co.nz/stump-grinding",
    telephone: "+64272166882",
    address: { "@type": "PostalAddress", addressLocality: "Gisborne", addressRegion: "Gisborne Region", addressCountry: "NZ" },
    geo: { "@type": "GeoCoordinates", latitude: -38.6623, longitude: 178.0176 },
    areaServed: ["Gisborne", "Kaiti", "Te Hapara", "Mangapapa", "Wainui Beach", "Makaraka", "Elgin"],
    serviceType: "Stump Grinding Service",
    priceRange: "$$",
    openingHours: "Mo-Su 07:00-18:00",
  };

  return (
    <div className="scroll-smooth bg-paper text-ink antialiased selection:bg-neon selection:text-black">
      <SEO
        title="Stump Grinding Gisborne – Complete Stump Removal"
        description="Eliminate unsightly stumps with our powerful stump grinding service. Serving Gisborne, Wairoa and rural properties. Book your stump removal today."
        keywords="stump grinding Gisborne, fast stump removal, tidy stump grinding, Wairoa stump removal, rural stump grinding, powerful stump grinder, book stump removal"
        ogTitle="Stump Grinding Gisborne – Fast & Tidy Stump Removal"
        ogDescription="Eliminate unsightly stumps with our powerful stump grinding service. Serving Gisborne, Wairoa and rural properties. Book your stump removal today."
        ogImage="https://app.treemarkables.co.nz/stump-grinding.jpg"
        canonicalUrl="https://app.treemarkables.co.nz/stump-grinding"
        structuredData={structuredData}
      />
      <HeaderV2 />

      {/* Hero */}
      <section id="top" className="relative min-h-[100svh] flex items-end overflow-hidden bg-ink">
        <img src={heroImage} alt="Stump grinding in Gisborne" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-transparent to-transparent" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 pb-16 pt-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-4 py-1.5 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-neon" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neon">Stump Grinding · Gisborne &amp; East Coast</span>
            </div>
            <h1 className="font-display font-bold text-white leading-[0.95] tracking-tight" style={{ fontSize: "clamp(40px,6.5vw,84px)" }}>
              Stumps gone.<br /><span className="text-neon">Ground flush.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed">
              Remove unsightly stumps safely and fast. Two grinders — a narrow-access machine for tight spots and the biggest in Gisborne for the heavy stuff.
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
              <div className="flex items-center gap-2 text-white/70 text-sm"><Settings className="h-4 w-4 text-neon" /> No stump too big, no spot too tight</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="bg-ink2 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[["$5M", "Public liability cover"], ["2", "Stump grinders"], ["#1", "Biggest grinder in Gisborne"], ["Free", "On-site quotes"]].map(([big, small]) => (
            <div key={small} className="text-center md:text-left">
              <div className="font-display font-bold text-neon" style={{ fontSize: "clamp(26px,3.4vw,40px)" }}>{big}</div>
              <div className="text-sm text-white/60 mt-1">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Time-lapse video + intro */}
      <section className="w-full bg-paper">
        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
          <div className="relative min-h-[280px] md:min-h-[560px] bg-black">
            <video className="absolute inset-0 w-full h-full object-cover" muted autoPlay loop playsInline>
              <source src="/stump-video.mov" type="video/quicktime" />
              <source src="/stump-video.mov" type="video/mp4" />
            </video>
          </div>
          <div className="bg-white px-6 py-12 md:px-12 md:py-16 flex flex-col justify-center">
            <div className="max-w-xl">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Tree stump grinding · Gisborne</div>
              <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight mb-6" style={{ fontSize: "clamp(28px,3.6vw,46px)" }}>
                Two grinders. Any job, any access.
              </h2>
              <div className="space-y-5 text-ink/75 leading-relaxed">
                <p>Got a stump that needs gone? We've got two stump grinders to handle any job in Gisborne — a compact narrow-access machine that fits through standard side gates and tight spots most operators can't reach, and the biggest stump grinder in Gisborne for taking on massive shelter belts, old gum stumps and rural clearing work.</p>
                <p>Whether it's one fruit-tree stump down the side of the house or a paddock full of pine stumps on a lifestyle block, we'll grind it flush, tidy up the mulch, and leave your section ready to mow, plant or build on. Free quotes, fully insured, locally owned.</p>
              </div>
              <a href="#contact" onClick={(e) => { e.preventDefault(); setIsQuoteOpen(true); }} className="inline-flex items-center gap-2 mt-8 bg-ink text-white font-bold px-7 py-4 rounded-full hover:bg-ink2 transition-colors">
                Get a free quote <ArrowRight className="h-5 w-5 text-neon" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Why grind */}
      <section className="bg-paper py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Why bother</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(28px,3.8vw,48px)" }}>
              Why grind it out?
            </h2>
            <p className="text-mute mt-4 text-lg">Most "she'll be right" stumps cause regret within a year or two.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {whyGrind.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white border border-ink/10 rounded-2xl p-6 shadow-sm">
                <div className="h-12 w-12 rounded-xl bg-neon/15 border border-neon/40 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-forest" />
                </div>
                <h3 className="font-display font-semibold text-ink text-lg mb-2">{title}</h3>
                <p className="text-mute text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="relative overflow-hidden bg-[#0b1d0b]">
        <div className="flex flex-col md:flex-row min-h-[360px] md:min-h-[460px]">
          <div className="relative w-full min-h-[260px] md:min-h-0 md:w-[48%] flex-shrink-0" style={{ clipPath: "polygon(0 0,93% 0,100% 100%,0 100%)" }}>
            <img src="/stump-grinding.jpg" alt="Treemarkables grinding a stump" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-center" />
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
              Stump grinding across Tairāwhiti
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
              Stump grinding questions, answered.
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
              Let's grind that stump.
            </h2>
            <p className="text-mute mt-5 text-lg max-w-md leading-relaxed">
              Send us a photo or two and we'll give you a real number, fast — or we'll come take a look. Free, no pressure, across Gisborne and the East Coast.
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
