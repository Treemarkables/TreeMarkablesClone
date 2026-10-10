import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Phone, Plus, Star } from "lucide-react";
import HeaderV2 from "@/components/HeaderV2";
import RedesignFooter from "@/components/RedesignFooter";
import SEO from "@/components/SEO";
import InquiryForm from "@/components/InquiryForm";
import ContactFormModal from "@/components/ContactFormModal";
import type { MarketingPage } from "@shared/treemarkablesPageCopy";

const PHONE = "0272166882";
const ORIGIN = "https://www.treemarkables.co.nz";

function handlePhoneClick(e: React.MouseEvent) {
  e.preventDefault();
  if (window.gtag) {
    window.gtag("event", "phone_call_click", { event_category: "Contact", event_label: "Phone Number Click" });
  }
  if (window.gtag_report_conversion) {
    window.gtag_report_conversion(`tel:${PHONE}`);
  }
  setTimeout(() => {
    window.location.href = `tel:${PHONE}`;
  }, 100);
}

export default function MarketingLanding({
  page,
  eyebrow,
  imageAlt,
}: {
  page: MarketingPage;
  eyebrow: string;
  imageAlt: string;
}) {
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const openQuote = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsQuoteOpen(true);
  };

  return (
    <div className="scroll-smooth bg-paper text-ink antialiased selection:bg-neon selection:text-black">
      <SEO
        title={page.title}
        description={page.description}
        ogTitle={page.title}
        ogDescription={page.description}
        ogImage={`${ORIGIN}${page.ogImage}`}
        canonicalUrl={`${ORIGIN}${page.path}`}
      />
      <HeaderV2 />

      <section id="top" className="relative min-h-[88svh] flex items-end overflow-hidden bg-ink">
        <img src={page.ogImage} alt={imageAlt} className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-transparent to-transparent" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 pb-16 pt-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/10 px-4 py-1.5 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-neon" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neon">{eyebrow}</span>
            </div>
            <h1 className="font-display font-bold text-white leading-[0.95] tracking-tight" style={{ fontSize: "clamp(40px,6.2vw,76px)" }}>
              {page.h1}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/75 max-w-2xl leading-relaxed">{page.lede}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#contact" onClick={openQuote} className="inline-flex items-center gap-2 bg-neon text-black font-bold text-base px-7 py-4 rounded-full hover:brightness-95 transition-all shadow-[0_8px_30px_rgba(57,255,20,0.4)]">
                Get a free quote <ArrowRight className="h-5 w-5" />
              </a>
              <a href={`tel:${PHONE}`} onClick={handlePhoneClick} className="inline-flex items-center gap-2 text-white font-semibold text-base px-7 py-4 rounded-full border border-white/25 backdrop-blur-sm">
                <Phone className="h-5 w-5" /> 027 216 6882
              </a>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-white/80">
              <span className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-neon text-neon" />
                ))}
              </span>
              <span>5-star rated</span>
            </div>
          </div>
        </div>
      </section>

      {page.sections?.map((section) => (
        <section key={section.heading} className="bg-paper py-16 md:py-20 border-t border-ink/5">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(28px,3.6vw,44px)" }}>
              {section.heading}
            </h2>
            <div className="mt-5 space-y-4 text-lg text-mute leading-relaxed">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>
      ))}

      {page.services && page.services.length > 0 && (
        <section className="bg-paper pb-16 md:pb-20">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight" style={{ fontSize: "clamp(28px,3.6vw,44px)" }}>
              {page.serviceHeading || "Services"}
            </h2>
            <ul className="mt-6 grid sm:grid-cols-2 gap-3">
              {page.services.map((service) => (
                <li key={service.href}>
                  <Link href={service.href} className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-4 py-4 text-ink font-semibold hover:border-neon transition-colors">
                    <ArrowRight className="h-4 w-4 text-forest shrink-0" />
                    {service.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {page.faqs && page.faqs.length > 0 && (
        <section id="faq" className="bg-paper pb-16 md:pb-24">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">FAQ</div>
            <h2 className="font-display font-bold text-ink leading-tight tracking-tight mb-8" style={{ fontSize: "clamp(28px,3.6vw,44px)" }}>
              {page.faqHeading || "Questions"}
            </h2>
            <div className="space-y-3">
              {page.faqs.map((item) => (
                <details key={item.q} className="group bg-white rounded-2xl border border-ink/10 open:border-ink/20 open:shadow-sm transition [&[open]_.faq-plus]:rotate-45">
                  <summary className="cursor-pointer flex items-center justify-between gap-4 p-5 list-none [&::-webkit-details-marker]:hidden">
                    <span className="font-semibold text-ink">{item.q}</span>
                    <span className="faq-plus shrink-0 h-7 w-7 rounded-full bg-paper border border-ink/10 flex items-center justify-center transition-transform">
                      <Plus className="h-4 w-4 text-forest" />
                    </span>
                  </summary>
                  <div className="px-5 pb-5 -mt-1 text-mute leading-relaxed">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="contact" className="bg-paper py-16 md:py-24 border-t border-ink/5">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-forest/70 mb-3">Free quote</div>
            <h2 className="font-display font-bold text-ink leading-[1.05] tracking-tight" style={{ fontSize: "clamp(32px,4vw,52px)" }}>
              Ask for a free quote
            </h2>
            <p className="text-mute mt-5 text-lg max-w-md leading-relaxed">
              Tell us the address and what the tree is doing. Free, no-obligation quotes. Phone{" "}
              <a href={`tel:${PHONE}`} onClick={handlePhoneClick} className="text-ink font-semibold">
                027 216 6882
              </a>
              , or send the form and we will come back to you.
            </p>
            <p className="mt-6 text-mute">26 Cochrane Street, Gisborne, NZ</p>
          </div>
          <InquiryForm />
        </div>
      </section>

      <ContactFormModal open={isQuoteOpen} onOpenChange={setIsQuoteOpen} />
      <RedesignFooter />
    </div>
  );
}
