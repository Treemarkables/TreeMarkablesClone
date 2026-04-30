import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import FAQSection from "@/components/FAQSection";
import SEO from "@/components/SEO";
import { Shield, Award, Clock, CheckCircle, Scissors, TreePine, Users, MapPin, Phone, AlertTriangle, Heart, Leaf, Calendar, Target, Wrench, ArrowRight, Check, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import InquiryForm from "@/components/InquiryForm";
import ContactFormModal from "@/components/ContactFormModal";
import PhotoSlider from "@/components/PhotoSlider";
import GoogleReviewsGrid from "@/components/GoogleReviewsGrid";
import hedgeCtaImage from "@assets/generated_images/085E9CAA-804B-4CAB-9ACC-5F01FCC57C40_4_5005_c.jpeg";
import sliderPhoto1 from "@assets/generated_images/669C2196-13EE-400F-847C-8CC0E1BCBC49_1_101_o.jpeg";
import sliderPhoto2 from "@assets/generated_images/2766DDE9-E1CE-4202-9826-C98136F33554_1_105_c.jpeg";
import sliderPhoto3 from "@assets/generated_images/F3D7C8A2-F7D8-4CAB-B547-224297C35A84_1_102_o.jpeg";
const heroBackground = "/hedge-trimming-hero.jpg";

export default function HedgeTrimming() {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  // Add Google tag event script for form submission tracking
  useEffect(() => {
    const script = document.createElement('script');
    script.innerHTML = `
      gtag('event', 'Formsubmission', {
        // <event_parameters>
      });
    `;
    document.head.appendChild(script);
    
    return () => {
      // Cleanup on unmount
      const scripts = document.head.querySelectorAll('script');
      scripts.forEach(s => {
        if (s.innerHTML.includes('Formsubmission')) {
          document.head.removeChild(s);
        }
      });
    };
  }, []);

  const handleGetQuote = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCallNow = () => {
    if ((window as any).gtag) {
      (window as any).gtag('event', 'phone_call_click', { event_category: 'Contact', event_label: 'Phone Number Click' });
    }
    if ((window as any).gtag_report_conversion) {
      (window as any).gtag_report_conversion('tel:0272166882');
    }
    setTimeout(() => {
      window.location.href = 'tel:0272166882';
    }, 100);
  };

  // Local business structured data for Hedge Trimming SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://app.treemarkables.co.nz/hedge-trimming#business",
    "name": "Treemarkables Hedge Trimming Services",
    "description": "Professional hedge trimming and maintenance services in Gisborne, New Zealand. Expert shaping, pruning, and regular maintenance for residential and commercial hedges.",
    "url": "https://app.treemarkables.co.nz/hedge-trimming",
    "telephone": "+64272166882",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Gisborne",
      "addressRegion": "Gisborne Region",
      "addressCountry": "NZ"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -38.6623,
      "longitude": 178.0176
    },
    "areaServed": [
      "Gisborne",
      "Kaiti",
      "Te Hapara",
      "Mangapapa", 
      "Wainui Beach",
      "Makaraka",
      "Elgin"
    ],
    "serviceType": "Hedge Trimming Service",
    "priceRange": "$$",
    "openingHours": "Mo-Su 07:00-18:00"
  };

  return (
    <div className="min-h-screen bg-background pt-20">
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
      <Header />
      {/* Hero Section */}
      <section 
        className="relative min-h-screen bg-gradient-to-br from-primary/10 to-green-600/10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-6xl mx-auto px-6 pt-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6" data-testid="text-hero-title">
              Hedge Trimming Gisborne
            </h1>
            <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
              Well-maintained hedges provide privacy, windbreaks and structure to your landscape, 
              but Gisborne's coastal winds and fast-growing plants mean they can quickly become unruly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={handleGetQuote} className="text-lg px-6" data-testid="button-get-quote">
                Talk to us today
              </Button>
              <Button size="lg" variant="outline" onClick={handleCallNow} className="text-lg px-6" data-testid="button-call-now">
                <Phone className="w-4 h-4 mr-2" />
                027-216-6882
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="inquiry" className="py-10 md:py-14 bg-muted/30">
        <div className="max-w-2xl mx-auto px-6">
          <InquiryForm />
        </div>
      </section>

      <section className="py-10 md:py-14">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden grid grid-cols-1 md:grid-cols-2">
            <div className="relative min-h-[260px] md:min-h-[340px]">
              <img
                src={hedgeCtaImage}
                alt="Treemarkables arborist trimming a tall hedge in Gisborne"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
            <div className="p-6 md:p-10 flex flex-col justify-center items-end text-right">
              <h2 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight mb-4">
                From big to small hedges. We got you sorted. Book your free
                quote now.
              </h2>
              <button
                type="button"
                onClick={() => setIsQuoteModalOpen(true)}
                className="inline-flex items-center justify-center rounded-full bg-[#1f4d1f] hover:bg-[#163816] text-white font-semibold px-6 py-3 transition-colors"
                data-testid="button-get-free-quote-cta"
              >
                Get a free quote now
              </button>
            </div>
          </div>
        </div>
      </section>

      <PhotoSlider
        photos={[
          { src: sliderPhoto1, alt: "Trimmed hedge driveway in Gisborne" },
          { src: sliderPhoto2, alt: "Hedge trimming before and after — long hedge" },
          { src: sliderPhoto3, alt: "Olive tree shaping before and after" },
        ]}
      />

      <ContactFormModal
        open={isQuoteModalOpen}
        onOpenChange={setIsQuoteModalOpen}
      />

      {/* When to Trim */}
      <section className="bg-white py-12 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-block text-[11px] font-semibold tracking-widest text-green-700 bg-green-50 px-3 py-1 rounded-full mb-3">
              HEDGE CARE GUIDE
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900 mb-2">
              When to trim your hedges
            </h2>
            <p className="text-[15px] text-gray-600 max-w-xl mx-auto leading-relaxed">
              Right time, right cut. Here's how we approach hedge trimming on the East Coast.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            <div className="relative bg-white border border-gray-200 rounded-2xl p-6 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-green-600"></div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Optimal timing schedule</h3>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed mb-5">
                Most hedges thrive on two trims a year — late spring and early autumn. This rhythm fits Gisborne's growing seasons and keeps plants strong without stress.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-green-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sprout className="w-3.5 h-3.5 text-green-700" />
                    <span className="text-xs font-semibold text-green-700">SPRING</span>
                  </div>
                  <div className="text-[13px] font-semibold text-gray-900 mb-0.5">Sep – Nov</div>
                  <div className="text-xs text-gray-600 leading-tight">Encourages dense new growth</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Leaf className="w-3.5 h-3.5 text-orange-700" />
                    <span className="text-xs font-semibold text-orange-700">AUTUMN</span>
                  </div>
                  <div className="text-[13px] font-semibold text-gray-900 mb-0.5">Mar – May</div>
                  <div className="text-xs text-gray-600 leading-tight">Tidies shape before winter</div>
                </div>
              </div>
            </div>

            <div className="relative bg-white border border-gray-200 rounded-2xl p-6 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-pink-500"></div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-pink-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Flowering hedges</h3>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed mb-5">
                Flowering hedges play by different rules. Trim too early and you cut off next season's blooms. Wait until just after they finish flowering and you'll get the best of both — healthy structure and a full display next year.
              </p>

              <div className="bg-pink-50 rounded-xl p-3 flex gap-2.5 items-start">
                <div className="flex-shrink-0 w-[22px] h-[22px] rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-semibold">
                  !
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-pink-900 mb-0.5">Golden rule</div>
                  <div className="text-xs text-gray-600 leading-tight">
                    Always trim <em>after</em> flowering, never before
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-9 text-center overflow-hidden">
            <div className="absolute -top-5 -right-5 opacity-[0.08] select-none pointer-events-none">
              <TreePine className="w-[140px] h-[140px] text-green-900" />
            </div>

            <div className="relative">
              <h3 className="text-2xl font-semibold tracking-tight text-gray-900 mb-2">
                Ready for professional hedge care?
              </h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed mb-5">
                From a quick tidy-up to a full reshape — we've got the gear and the experience. Free quotes across Gisborne and surrounds.
              </p>

              <div className="flex gap-2.5 justify-center flex-wrap">
                <Button onClick={handleGetQuote} className="rounded-xl px-5 py-3 text-sm font-semibold" data-testid="button-quote-hedge-care">
                  Get free quote
                  <ArrowRight className="w-3.5 h-3.5 ml-2" />
                </Button>
                <Button variant="outline" onClick={handleCallNow} className="rounded-xl px-5 py-3 text-sm font-semibold" data-testid="button-call-hedge-care">
                  <Phone className="w-3.5 h-3.5 mr-2" />
                  Call today
                </Button>
              </div>

              <div className="mt-5 pt-4 border-t border-green-200 flex justify-center gap-6 flex-wrap text-xs text-gray-600">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={3} />
                  Free quotes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={3} />
                  Fully insured
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={3} />
                  Qualified arborists
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Credentials */}
      <section className="py-12 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Fully Insured</h3>
              <p className="text-muted-foreground">Complete coverage for your peace of mind</p>
            </div>
            <div>
              <Scissors className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Professional Tools</h3>
              <p className="text-muted-foreground">Sharp, clean tools for healthy cuts</p>
            </div>
            <div>
              <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Regular Programs</h3>
              <p className="text-muted-foreground">Scheduled maintenance available</p>
            </div>
          </div>
        </div>
      </section>

      <GoogleReviewsGrid
        heading="What Gisborne homeowners say"
        ctaLabel="Talk to us today"
        onCtaClick={handleGetQuote}
      />

      <FAQSection />

      {/* Contact Section */}
      <ContactSection />

      <Footer />
    </div>
  );
}