import { useEffect } from "react";
import HeaderV2 from "@/components/HeaderV2";
import RedesignFooter from "@/components/RedesignFooter";
import RedesignReviews from "@/components/RedesignReviews";
import SEO from "@/components/SEO";
import InquiryForm from "@/components/InquiryForm";
import {
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  Star,
  Check,
  Plus,
  Leaf,
  Wind,
  Scissors,
  MoveVertical,
  GitBranch,
} from "lucide-react";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

const PHONE = "0272166882";
const heroImage = "/tree-pruning.jpg";

const types = [
  { icon: GitBranch, title: "Structural pruning", desc: "Early shaping of young trees to build strong structure — vital in coastal winds and near buildings." },
  { icon: Wind, title: "Crown thinning", desc: "Selective branch removal to cut wind resistance and let light through. Great for exposed coastal sites." },
  { icon: Scissors, title: "Deadwooding", desc: "Removing dead, dying or diseased branches for better health and safety. Can be done year-round." },
  { icon: MoveVertical, title: "Crown reduction", desc: "Lowering height or spread while keeping the natural shape — ideal for trees that have outgrown their space." },
];

const areas: [string, string][] = [
  ["Gisborne Central", "Urban tree care"],
  ["Kaiti", "Coastal pruning"],
  ["Te Hapara", "Residential tree health"],
  ["Mangapapa", "Rural property care"],
  ["Wainui Beach", "Salt-resistant care"],
  ["Makaraka", "Semi-rural maintenance"],
  ["Elgin", "Farm & estate care"],
  ["Ormond", "Rural & lifestyle"],
  ["Makorori", "Coastal properties"],
];

const faqs: [string, string][] = [
  ["When is the best time to prune?", "It depends on the species and goal. Structural pruning suits late winter to early spring, deadwooding can be done year-round, and flowering trees are best pruned just after they finish flowering."],
  ["Will pruning hurt my tree?", "Done correctly, no — proper pruning improves health, structure and safety. We make clean cuts in the right places and never over-prune."],
  ["Can you reduce a tree's height without removing it?", "Yes — crown reduction lowers height or spread while keeping the natural shape, ideal for trees that have outgrown their space."],
  ["Do you clean up afterwards?", "Always — all clippings and green waste are cleared and the site left tidy."],
  ["Do you provide free quotes?", "Yes — free, no-obligation on-site assessments across Gisborne and the East Coast."],
  ["Are you insured and qualified?", "Yes — NZ-qualified arborists with $5M public liability cover. Certificate of currency available on request."],
];

export default function TreePruning() {
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
    "@id": "https://app.treemarkables.co.nz/tree-pruning#business",
    name: "Treemarkables Tree Pruning Services",
    description: "Professional tree pruning and care services in Gisborne, New Zealand. Expert arborists specializing in structural pruning, crown thinning, deadwooding, and tree health maintenance.",
    url: "https://app.treemarkables.co.nz/tree-pruning",
    telephone: "+64272166882",
    address: { "@type": "PostalAddress", addressLocality: "Gisborne", addressRegion: "Gisborne Region", addressCountry: "NZ" },
    geo: { "@type": "GeoCoordinates", latitude: -38.6623, longitude: 178.0176 },
    areaServed: ["Gisborne", "Kaiti", "Te Hapara", "Mangapapa", "Wainui Beach", "Makaraka", "Elgin"],
    serviceType: "Tree Pruning Service",
    priceRange: "$$",
    openingHours: "Mo-Su 07:00-18:00",
  };

  return (
    <div className="scroll-smooth bg-paper text-ink antialiased selection:bg-neon selection:text-black">
      <SEO
        title="Tree Pruning Gisborne – Qualified Arborists"
        description="Improve tree health and safety with our expert tree pruning services. Treemarkables offers crown reduction and shaping across Gisborne and the wider East Coast. Free assessments available."
        keywords="tree pruning Gisborne, professional arborists, tree health, crown reduction, tree shaping, East Coast tree pruning, free tree assessments, Gisborne tree care"
        ogTitle="Tree Pruning Gisborne – Professional Arborists"
        ogDescription="Improve tree health and safety with our expert tree pruning services. Treemarkables offers crown reduction and shaping across Gisborne and the wider East Coast. Free assessments available."
        ogImage="https://app.treemarkables.co.nz/tree-pruning.jpg"
        canonicalUrl="https://app.treemarkables.co.nz/tree-pruning"
        structuredData={structuredData}
      />
      <HeaderV2 />

      {/* Hero */}
      <section id="top" className="relative min-h-[100svh] flex items-end overflow-hidden bg-ink">
        <img src={heroImage} alt="Arborist pruning a tree in Gisborne" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-transparent to-transparent" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 pb-16 pt-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-4 py-1.5 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-neon" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neon">Tree Pruning · Gisborne &amp; East Coast</span>
            </div>
            <h1 className="font-display font-bold text-white leading-[0.95] tracking-tight" style={{ fontSize: "clamp(40px,6.5vw,84px)" }}>
              Pruned right,<br /><span className="text-neon">growing strong.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed">
              Expert pruning to keep your trees healthy, safe and beautifully shaped — qualified arborists across Gisborne and the East Coast.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#contact" className="inline-flex items-center gap-2 bg-neon text-black font-bold text-base px-7 py-4 rounded-full hover:brightness-95 transition-all shadow-[0_8px_30px_rgba(57,255,20,0.4)]">
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
              <div className="flex items-center gap-2 text-white/70 text-sm"><Leaf className="h-4 w-4 text-neon" /> We prune to preserve — removal only if it's truly needed</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="bg-ink2 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[["$5M", "Public liability cover"], ["NZQ", "Qualified arborists"], ["Local", "Coastal tree experts"], ["Free", "On-site assessments"]].map(([big, small]) => (
            <div key={small} className="text-center md:text-left">
              <div className="font-display font-bold text-neon" style={{ fontSize: "clamp(26px,3.4vw,40px)" }}>{big}</div>
              <div className="text-sm text-white/60 mt-1">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Philosophy split */}
      <section className="bg-paper py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative order-1 lg:order-none">
            <div className="absolute -inset-3 rounded-[2rem] bg-neon/15 -z-10" />
            <img src={heroImage} alt="Careful pruning work" className="rounded-[1.5rem] w-full h-[440px] object-cover shadow-xl" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Our philosophy</div>
            <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight" style={{ fontSize: "clamp(30px,4vw,52px)" }}>
              Every tree has value.
            </h2>
            <p className="text-mute mt-5 text-lg leading-relaxed">
              Our first priority is always preservation through expert pruning and care. Done well, pruning solves most tree problems while keeping the tree healthy, safe and beautiful.
            </p>
            <div className="mt-6 rounded-2xl border-l-4 border-neon bg-white p-5 shadow-sm">
              <p className="text-ink/80 leading-relaxed">
                We only recommend <strong className="text-ink">removal</strong> when it's genuinely necessary for safety — never as the easy option.
              </p>
            </div>
            <a href="#contact" className="inline-flex items-center gap-2 mt-8 bg-ink text-white font-bold px-7 py-4 rounded-full hover:bg-ink2 transition-colors">
              Book a free assessment <ArrowRight className="h-5 w-5 text-neon" />
            </a>
          </div>
        </div>
      </section>

      {/* Pruning types */}
      <section className="bg-paper pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">What we do</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(28px,3.8vw,48px)" }}>
              Pruning, done properly
            </h2>
            <p className="text-mute mt-4 text-lg">The right technique for your trees and Gisborne's coastal conditions.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {types.map(({ icon: Icon, title, desc }) => (
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
            <img src={heroImage} alt="Treemarkables arborist pruning" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-center" />
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

      <RedesignReviews />

      {/* Service areas */}
      <section id="areas" className="relative bg-paper py-20 md:py-28 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle,rgba(57,255,20,0.10),transparent 70%)" }} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Where we work</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight inline-block bg-neon rounded-full px-8 py-3" style={{ fontSize: "clamp(28px,3.8vw,48px)" }}>
              Tree pruning across Tairāwhiti
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
              Tree pruning questions, answered.
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
              Let's sort your trees.
            </h2>
            <p className="text-mute mt-5 text-lg max-w-md leading-relaxed">
              Tell us about your trees and we'll come take a look. Free, no-obligation assessments across Gisborne and the East Coast — usually back to you within 24 hours.
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

      <RedesignFooter />
    </div>
  );
}
