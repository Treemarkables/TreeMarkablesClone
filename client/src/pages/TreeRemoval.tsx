import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import FAQSection from "@/components/FAQSection";
import SEO from "@/components/SEO";
import { Shield, Award, Clock, CheckCircle, Phone, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import InquiryForm from "@/components/InquiryForm";
import ContactFormModal from "@/components/ContactFormModal";
import PhotoSlider from "@/components/PhotoSlider";
import sliderPhoto1 from "@assets/generated_images/E0AAF8BC-CFB4-4F84-ABE2-2B1493FE147D.jpeg";
import sliderPhoto2 from "@assets/generated_images/C145D020-049C-4424-9E2F-A852B84FCA59_1_102_o.jpeg";
import sliderPhoto3 from "@assets/generated_images/59A2C278-76AD-4BB7-A475-408D758C5760_1_102_a.jpeg";
import worriedTreeImage from "@assets/generated_images/DCF3191F-E513-401F-AC8B-FF6F329C4A83_1_102_o.jpeg";

export default function TreeRemoval() {
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
    setIsQuoteModalOpen(true);
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


  // Local business structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://app.treemarkables.co.nz/#business",
    "name": "Treemarkables",
    "description": "Professional tree removal services in Gisborne, New Zealand. Certified arborists specializing in hazardous tree removal, emergency services, and precision cutting.",
    "url": "https://app.treemarkables.co.nz",
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
    "serviceType": "Tree Removal Service",
    "priceRange": "$$",
    "openingHours": "Mo-Su 07:00-18:00"
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <SEO 
        title="Tree Removal Gisborne – Safe, Certified & 24/7"
        description="Need a dangerous or unwanted tree removed? Our certified arborists provide safe tree removal for homes and farms in Gisborne and Wairoa. Contact us for competitive prices."
        keywords="tree removal Gisborne, safe tree removal, certified arborists Gisborne, dangerous tree removal, unwanted tree removal, Wairoa tree removal, competitive tree removal prices"
        ogTitle="Tree Removal Gisborne – Safe & Efficient Service"
        ogDescription="Need a dangerous or unwanted tree removed? Our certified arborists provide safe tree removal for homes and farms in Gisborne and Wairoa. Contact us for competitive prices."
        ogImage="https://app.treemarkables.co.nz/hazardous-tree-removal.jpg"
        canonicalUrl="https://app.treemarkables.co.nz/tree-removal"
        structuredData={structuredData}
      />
      <Header />
      <ContactFormModal
        open={isQuoteModalOpen}
        onOpenChange={setIsQuoteModalOpen}
      />
      {/* Hero Section */}
      <section className="relative h-[70vh] sm:h-[80vh] md:min-h-screen overflow-hidden">
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/tree-removal-hero.mov" type="video/mp4" />
        </video>
        {/* Gradient overlay — dark at bottom where text sits, lighter at top to show the action */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        
        {/* Heading raised slightly from the bottom, centred, full width */}
        <div className="absolute bottom-0 left-0 right-0 z-10 pb-16 sm:pb-20 px-4">
          <h1
            className="font-bold text-white text-center w-full"
            style={{ fontSize: 'clamp(1.5rem, 4.5vw, 3.5rem)', lineHeight: 1.15 }}
            data-testid="text-hero-title"
          >
            Gisborne's tree removal experts
          </h1>
        </div>
      </section>

      <section className="py-10 md:py-14 bg-muted/30">
        <div className="max-w-2xl mx-auto px-6">
          <InquiryForm />
        </div>
      </section>

      <PhotoSlider
        photos={[
          { src: sliderPhoto1, alt: "Tree removal job in Gisborne" },
          { src: sliderPhoto2, alt: "Tree removal crew working on a large tree" },
          { src: sliderPhoto3, alt: "Tree removal before and after in Gisborne" },
        ]}
      />

      <section className="w-full" data-testid="section-worried-tree">
        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
          <div className="relative min-h-[280px] md:min-h-[560px]">
            <img
              src={worriedTreeImage}
              alt="Large tree leaning over a Gisborne home before removal"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="bg-white px-6 py-12 md:px-12 md:py-16 flex flex-col justify-center">
            <div className="max-w-xl space-y-5 text-[15px] leading-relaxed text-gray-700">
              <p>
                Every Gisborne local knows the feeling. The wind picks up, the rain hits sideways, and suddenly that big gum, pine, or macrocarpa near the house doesn't feel so charming anymore. You're lying awake listening to it creak, wondering if tonight's the night a limb comes through the roof — or worse.
              </p>
              <p>
                You're not being paranoid. After Cyclone Gabrielle, Fire and Emergency took around 1,800 storm-related calls in 24 hours. Trees that had stood for 50 years came down in a single night. Insurance claims, smashed roofs, blocked driveways — we've cleaned up plenty of "she'll be right" trees that weren't.
              </p>
              <p>
                The good news: most of the time you can spot a problem tree well before it becomes a problem. Lean, deadwood in the canopy, lifting roots, cracks at the base, fungal growth on the trunk — these are the warning signs. The bad news: by the time you're worried enough to Google it, you're usually already overdue for a proper assessment.
              </p>
              <p>
                We'll come out, climb it, and tell you straight — does it need to come down, can it be saved with a prune, or is it actually fine? No upsell, no scare tactics. If the tree's safe we'll tell you that too, free of charge.
              </p>
            </div>
            <div className="mt-7">
              <Button
                onClick={handleGetQuote}
                size="lg"
                className="rounded-full px-6"
                data-testid="button-book-free-assessment"
              >
                Book a free assessment
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency Alert Banner */}
      <div className="bg-red-600 text-white py-3 text-center">
        <div className="max-w-6xl mx-auto px-6">
          <p className="font-semibold">
            ⚠️ High winds expected this week — Book your free safety assessment today!
          </p>
        </div>
      </div>

      {/* Why Gisborne homeowners choose Treemarkables */}
      <section className="w-full py-14 md:py-20 px-5 md:px-6 bg-[#fafafa] text-[#1a1a1a]" data-testid="section-why-choose">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[26px] md:text-[32px] font-bold text-center text-black mb-8 md:mb-12">
            Why Gisborne homeowners choose Treemarkables
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="bg-white border border-[#eaeaea] rounded-xl p-8 text-center" data-testid="card-why-choose-emergency">
              <div className="w-14 h-14 rounded-full bg-[#39FF14] inline-flex items-center justify-center mb-[18px]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-black mb-2.5">24/7 emergency response</h3>
              <p className="text-[15px] leading-relaxed text-[#555]">
                Storm damage or hazardous tree? We're on it day or night, anywhere in Tairāwhiti.
              </p>
            </div>

            <div className="bg-white border border-[#eaeaea] rounded-xl p-8 text-center" data-testid="card-why-choose-guarantee">
              <div className="w-14 h-14 rounded-full bg-[#39FF14] inline-flex items-center justify-center mb-[18px]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-black mb-2.5">The Treemarkables guarantee</h3>
              <p className="text-[15px] leading-relaxed text-[#555]">
                If we haven't delivered on what we agreed, we'll come back and sort it. No questions, no fuss.
              </p>
            </div>

            <div className="bg-white border border-[#eaeaea] rounded-xl p-8 text-center" data-testid="card-why-choose-local">
              <div className="w-14 h-14 rounded-full bg-[#39FF14] inline-flex items-center justify-center mb-[18px]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-black mb-2.5">Locally owned &amp; operated</h3>
              <p className="text-[15px] leading-relaxed text-[#555]">
                Born and based in Gisborne. Your trusted local tree care team since day one.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              What Gisborne Homeowners Say About Us
            </h2>
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 text-yellow-500 fill-current" />
                ))}
              </div>
              <span className="text-xl font-bold text-foreground">4.9/5</span>
              <span className="text-muted-foreground">(120+ Google Reviews)</span>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4 italic">
                "Excellent service! They removed a massive pine tree that was threatening our house. 
                Professional, quick, and left no mess behind."
              </p>
              <p className="font-semibold text-foreground">— Sarah M., Kaiti</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4 italic">
                "Called them for an emergency after the storm. They came out the same day and 
                handled everything perfectly. Highly recommend!"
              </p>
              <p className="font-semibold text-foreground">— Mike T., Elgin</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4 italic">
                "Great team! They trimmed our pohutukawa near the power lines safely. 
                Fair pricing and excellent cleanup."
              </p>
              <p className="font-semibold text-foreground">— Jenny L., Mangapapa</p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <Shield className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">Fully Insured</h3>
              <p className="text-muted-foreground">$2M public liability coverage</p>
            </div>
            <div className="flex flex-col items-center">
              <Award className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">NZ Qualified Arborists</h3>
              <p className="text-muted-foreground">WorkSafe certified professionals</p>
            </div>
            <div className="flex flex-col items-center">
              <Clock className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">24/7 Emergency</h3>
              <p className="text-muted-foreground">Same-day response guaranteed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Areas Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Tree Removal Service Areas
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              We provide professional tree removal services throughout Gisborne and the wider East Coast region.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6 text-center">
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Gisborne Central</h4>
              <p className="text-sm text-muted-foreground">City center and surrounding suburbs</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Kaiti</h4>
              <p className="text-sm text-muted-foreground">Residential and coastal properties</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Te Hapara</h4>
              <p className="text-sm text-muted-foreground">Suburban homes and farms</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Mangapapa</h4>
              <p className="text-sm text-muted-foreground">Rural and lifestyle blocks</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Wainui Beach</h4>
              <p className="text-sm text-muted-foreground">Coastal properties and beach homes</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Makaraka</h4>
              <p className="text-sm text-muted-foreground">Semi-rural properties</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Elgin</h4>
              <p className="text-sm text-muted-foreground">Rural farms and estates</p>
            </div>
            <div className="bg-background rounded-lg p-4 hover-elevate">
              <h4 className="font-semibold text-foreground mb-2">Wairoa</h4>
              <p className="text-sm text-muted-foreground">Extended service area</p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full" data-testid="section-reliable-tree-removal">
        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
          <div className="relative min-h-[280px] md:min-h-[560px]">
            <img
              src={sliderPhoto2}
              alt="Treemarkables crew carrying out a tree removal in Gisborne"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="bg-white px-6 py-12 md:px-12 md:py-16 flex flex-col justify-center">
            <div className="max-w-xl space-y-5 text-[15px] leading-relaxed text-gray-700">
              <p>
                <span className="font-semibold text-gray-900">Looking for reliable Gisborne tree removal?</span> Treemarkables is a locally owned and operated tree removal company servicing Gisborne, Tairāwhiti and the wider East Coast.
              </p>
              <p>
                Our qualified arborists handle everything from hazardous storm-damaged trees and emergency removals through to large-scale residential and commercial tree felling across Gisborne city, Wainui, Makaraka, Patutahi, Manutūkē, Te Karaka and Tolaga Bay.
              </p>
              <p>
                With a 16-metre bucket truck, professional climbing crews, wood chippers and stump grinders on hand, we safely remove trees of any size — close to houses, near power lines, or on tight access sections.
              </p>
              <p>
                Every Gisborne tree removal job includes a free on-site quote, full debris cleanup, and the Treemarkables guarantee: if we haven't delivered on what we agreed, we'll come back and sort it.
              </p>
              <p>
                For fast, professional tree removal in Gisborne, get in touch today.
              </p>
            </div>
            <div className="mt-7">
              <Button
                onClick={handleGetQuote}
                size="lg"
                className="rounded-full px-6"
                data-testid="button-reliable-tree-removal-cta"
              >
                Get in touch
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <FAQSection />

      {/* Contact Section */}
      <ContactSection />

      <Footer />
    </div>
  );
}