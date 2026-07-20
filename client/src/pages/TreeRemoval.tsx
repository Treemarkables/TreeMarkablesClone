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
  ArrowUpRight,
  Star,
  Check,
  ShieldCheck,
  MoveHorizontal,
  Plus,
  Zap,
} from "lucide-react";
import sliderPhoto1 from "@assets/generated_images/E0AAF8BC-CFB4-4F84-ABE2-2B1493FE147D.jpeg";
import sliderPhoto2 from "@assets/generated_images/C145D020-049C-4424-9E2F-A852B84FCA59_1_102_o.jpeg";
import sliderPhoto3 from "@assets/generated_images/59A2C278-76AD-4BB7-A475-408D758C5760_1_102_a.jpeg";
import worriedTreeImage from "@assets/generated_images/DCF3191F-E513-401F-AC8B-FF6F329C4A83_1_102_o.jpeg";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    gtag_report_conversion?: (url?: string) => boolean;
  }
}

const PHONE = "0272166882";

const whyChoose = [
  { icon: Zap, title: "24/7 emergency response", desc: "Storm damage or a hazardous tree? We're on it day or night, anywhere in Tairāwhiti." },
  { icon: ShieldCheck, title: "The Treemarkables guarantee", desc: "If we haven't delivered on what we agreed, we'll come back and sort it. No fuss." },
  { icon: MapPin, title: "Locally owned & operated", desc: "Born and based in Gisborne — your trusted local tree care team since day one." },
];

const reliable = [
  "16-metre bucket truck, climbing crews, chippers & stump grinders",
  "Trees of any size — handled safely with the right gear",
  "Free on-site quote, full debris cleanup, the Treemarkables guarantee",
];

const areas: [string, string][] = [
  ["Gisborne Central", "City centre & suburbs"],
  ["Kaiti", "Residential & coastal"],
  ["Te Hapara", "Suburban homes & farms"],
  ["Mangapapa", "Rural & lifestyle blocks"],
  ["Wainui Beach", "Coastal & beach homes"],
  ["Makaraka", "Semi-rural properties"],
  ["Elgin", "Rural farms & estates"],
  ["Ormond", "Rural & lifestyle blocks"],
  ["Makorori", "Coastal properties"],
];

const faqs: [string, string][] = [
  ["How much does it cost to remove a tree?", "It depends on size, location, condition and access, and whether stump grinding or debris removal is included. Small trees in the open are quick and affordable; large trees near buildings or structures need more time and gear. You get a clear, itemised quote before any work begins."],
  ["Do you handle emergencies and storm damage?", "Yes — 24/7. If a tree's come down or is threatening your home, call us any time and we'll respond fast across Tairāwhiti."],
  ["Is stump grinding included?", "It can be — just let us know. We'll quote removal with or without stump grinding and full debris cleanup so there are no surprises."],
  ["Are you fully insured and qualified?", "Yes — NZ-qualified arborists with $5M public liability cover. We're happy to provide a certificate of currency on request."],
  ["Do I need council permission?", "Sometimes. Gisborne District Council protects certain notable, heritage and zoned trees. We can help you check before any work is planned."],
];

const galleryImages: [string, string][] = [
  [sliderPhoto1, "Tree removal job in Gisborne"],
  [sliderPhoto2, "Treemarkables crew on a tree removal"],
  [worriedTreeImage, "Large tree before removal"],
  [sliderPhoto3, "Tree removal before and after"],
  ["/hazardous-tree-removal.jpg", "Hazardous tree removal"],
  ["/emergency-tree-removal.jpg", "Emergency tree removal after a storm"],
  ["/cta-drone.jpg", "Arborist climbing high in a tree"],
];

export default function TreeRemoval() {
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  // Google tag event script for form submission tracking
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
    "@id": "https://www.treemarkables.co.nz/#business",
    name: "Treemarkables",
    description: "Professional tree removal services in Gisborne, New Zealand. Certified arborists specializing in hazardous tree removal, emergency services, and precision cutting.",
    url: "https://www.treemarkables.co.nz",
    telephone: "+64272166882",
    address: { "@type": "PostalAddress", addressLocality: "Gisborne", addressRegion: "Gisborne Region", addressCountry: "NZ" },
    geo: { "@type": "GeoCoordinates", latitude: -38.6623, longitude: 178.0176 },
    areaServed: ["Gisborne", "Kaiti", "Te Hapara", "Mangapapa", "Wainui Beach", "Makaraka", "Elgin", "Ormond", "Makorori"],
    serviceType: "Tree Removal Service",
    priceRange: "$$",
    openingHours: "Mo-Su 07:00-18:00",
  };

  return (
    <div className="scroll-smooth bg-paper text-ink antialiased selection:bg-neon selection:text-black">
      <SEO
        title="Tree Removal Gisborne – Safe, Certified & 24/7"
        description="Need a dangerous or unwanted tree removed? Our certified arborists provide safe tree removal for homes and farms in Gisborne and Wairoa. Contact us for competitive prices."
        keywords="tree removal Gisborne, safe tree removal, certified arborists Gisborne, dangerous tree removal, unwanted tree removal, Wairoa tree removal, competitive tree removal prices"
        ogTitle="Tree Removal Gisborne – Safe & Efficient Service"
        ogDescription="Need a dangerous or unwanted tree removed? Our certified arborists provide safe tree removal for homes and farms in Gisborne and Wairoa. Contact us for competitive prices."
        ogImage="https://www.treemarkables.co.nz/hazardous-tree-removal.jpg"
        canonicalUrl="https://www.treemarkables.co.nz/tree-removal"
        structuredData={structuredData}
      />
      <HeaderV2 />

      {/* Hero with video */}
      <section id="top" className="relative min-h-[100svh] flex items-end overflow-hidden bg-ink">
        <video
          className="absolute inset-0 w-full h-full object-cover object-center"
          muted
          autoPlay
          loop
          playsInline
          poster={worriedTreeImage}
        >
          <source src="/tree-removal-hero.mov" type="video/quicktime" />
          <source src="/tree-removal-hero.mov" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-transparent to-transparent" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 pb-16 pt-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-4 py-1.5 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-neon" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neon">Tree Removal · Gisborne &amp; East Coast</span>
            </div>
            <h1 className="font-display font-bold text-white leading-[0.95] tracking-tight" style={{ fontSize: "clamp(40px,6.5vw,84px)" }}>
              Get that risky tree<br /><span className="text-neon">down — safely.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/70 max-w-xl leading-relaxed">
              Gisborne's certified arborists for hazardous, storm-damaged and unwanted trees. Fully insured, fast response, and not a branch left behind.
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
                <div className="flex">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-neon text-neon" />)}
                </div>
                <span className="text-sm text-white/80"><strong className="text-white">5.0</strong> · 130+ reviews</span>
              </div>
              <div className="flex items-center gap-2 text-white/70 text-sm"><Zap className="h-4 w-4 text-neon" /> 24/7 emergency callouts</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="bg-ink2 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[["$5M", "Public liability cover"], ["NZQ", "Qualified arborists"], ["24/7", "Emergency response"], ["Free", "On-site quotes"]].map(([big, small]) => (
            <div key={small} className="text-center md:text-left">
              <div className="font-display font-bold text-neon" style={{ fontSize: "clamp(26px,3.4vw,40px)" }}>{big}</div>
              <div className="text-sm text-white/60 mt-1">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Photo gallery */}
      <section className="bg-paper pt-16 md:pt-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Recent work</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(26px,3.4vw,44px)" }}>
              Tree removals around Gisborne
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

      {/* Worried tree split */}
      <section className="bg-paper py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative order-1 lg:order-none">
            <div className="absolute -inset-3 rounded-[2rem] bg-neon/15 -z-10" />
            <img src={worriedTreeImage} alt="Tree leaning over a Gisborne home" className="rounded-[1.5rem] w-full h-[440px] object-cover shadow-xl" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Should it stay or go?</div>
            <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight" style={{ fontSize: "clamp(30px,4vw,52px)" }}>
              Worried about a tree on your property?
            </h2>
            <p className="text-mute mt-5 text-lg leading-relaxed">
              The wind picks up, the rain hits sideways, and suddenly that big gum, pine or macrocarpa near the house doesn't feel so charming. Lean, deadwood, lifting roots, cracks at the base — these are the warning signs.
            </p>
            <div className="mt-6 rounded-2xl border-l-4 border-neon bg-white p-5 shadow-sm">
              <p className="text-ink/80 leading-relaxed">
                <strong className="text-ink">After Cyclone Gabrielle, FENZ took ~1,800 storm calls in 24 hours.</strong> Trees that stood 50 years came down in a single night. Don't wait for "she'll be right."
              </p>
            </div>
            <p className="text-mute mt-6 text-lg leading-relaxed">
              We'll come out, climb it, and tell you straight — does it need to come down, can a prune save it, or is it actually fine? No upsell, no scare tactics. If it's safe, we'll tell you that too, free of charge.
            </p>
            <a href="#contact" onClick={(e) => { e.preventDefault(); setIsQuoteOpen(true); }} className="inline-flex items-center gap-2 mt-8 bg-ink text-white font-bold px-7 py-4 rounded-full hover:bg-ink2 transition-colors">
              Book a free assessment <ArrowRight className="h-5 w-5 text-neon" />
            </a>
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="bg-paper pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Why Treemarkables</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(28px,3.8vw,48px)" }}>
              Why Gisborne homeowners choose us
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {whyChoose.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white border border-ink/10 rounded-2xl p-7 shadow-sm">
                <div className="h-14 w-14 rounded-2xl bg-neon flex items-center justify-center mb-5 shadow-[0_8px_30px_rgba(57,255,20,0.3)]">
                  <Icon className="h-6 w-6 text-black" />
                </div>
                <h3 className="font-display font-semibold text-ink text-xl mb-2">{title}</h3>
                <p className="text-mute leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner (diagonal) */}
      <section className="relative overflow-hidden bg-[#0b1d0b]">
        <div className="flex flex-col md:flex-row min-h-[360px] md:min-h-[460px]">
          <div className="relative w-full min-h-[260px] md:min-h-0 md:w-[48%] flex-shrink-0" style={{ clipPath: "polygon(0 0,93% 0,100% 100%,0 100%)" }}>
            <img src="/cta-drone.jpg" alt="Treemarkables arborist climbing high in a tree" loading="lazy" className="absolute inset-0 w-full h-full object-cover object-center" />
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

      {/* Reliable split */}
      <section className="bg-paper pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Local &amp; equipped</div>
            <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight" style={{ fontSize: "clamp(30px,4vw,52px)" }}>
              Reliable Gisborne tree removal.
            </h2>
            <p className="text-mute mt-5 text-lg leading-relaxed">
              A locally owned crew servicing Gisborne, Tairāwhiti and the wider East Coast — from hazardous storm-damaged trees and emergency removals through to large residential and commercial felling.
            </p>
            <ul className="mt-7 space-y-3.5">
              {reliable.map((item) => (
                <li key={item} className="flex gap-3.5">
                  <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-neon/15 border border-neon/40 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-forest" />
                  </span>
                  <span className="text-ink/80">{item}</span>
                </li>
              ))}
            </ul>
            <a href="#contact" onClick={(e) => { e.preventDefault(); setIsQuoteOpen(true); }} className="inline-flex items-center gap-2 mt-8 bg-ink text-white font-bold px-7 py-4 rounded-full hover:bg-ink2 transition-colors">
              Get in touch <ArrowRight className="h-5 w-5 text-neon" />
            </a>
          </div>
          <div className="relative order-first lg:order-last">
            <div className="absolute -inset-3 rounded-[2rem] bg-neon/15 -z-10" />
            <img src={sliderPhoto2} alt="Treemarkables crew carrying out a tree removal in Gisborne" className="rounded-[1.5rem] w-full h-[440px] object-cover shadow-xl" />
          </div>
        </div>
      </section>

      {/* Service areas */}
      <section id="areas" className="relative bg-paper py-20 md:py-28 overflow-hidden">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full" style={{ background: "radial-gradient(circle,rgba(57,255,20,0.10),transparent 70%)" }} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Where we work</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight inline-block bg-neon rounded-full px-8 py-3" style={{ fontSize: "clamp(28px,3.8vw,48px)" }}>
              Tree removal across Tairāwhiti
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {areas.map(([t, d]) => (
              <div key={t} className="bg-white border border-ink/10 rounded-2xl p-5 shadow-sm hover:border-neon transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <MapPin className="h-4 w-4 text-forest" />
                  <span className="text-ink font-semibold">{t}</span>
                </div>
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
              Tree removal questions, answered.
            </h2>
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
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="relative bg-paper py-20 md:py-28 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Free quote</div>
            <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight inline-block bg-neon rounded-full px-8 py-4" style={{ fontSize: "clamp(34px,4.8vw,60px)" }}>
              Let's sort that tree.
            </h2>
            <p className="text-mute mt-5 text-lg max-w-md leading-relaxed">
              Tell us about the tree and we'll come take a look. Free, no-obligation quotes across Gisborne and the East Coast — usually back to you within 24 hours.
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
