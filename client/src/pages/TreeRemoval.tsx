import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactSection from "@/components/ContactSection";
import FAQSection from "@/components/FAQSection";
import SEO from "@/components/SEO";
import { Shield, Award, Clock, CheckCircle, Phone, Star, AlertTriangle, Scissors, Heart, TreePine, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";

export default function TreeRemoval() {
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

      {/* Tree services grid */}
      <section className="w-full" data-testid="section-services-grid">
        <h2 className="sr-only">Tree services section for a Gisborne arborist business with five service cards using more accurate illustrative icons.</h2>
        <div style={{ background: "#DCEFC8", padding: "40px 24px", fontFamily: "var(--font-sans)" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 500, color: "#3B6D11", margin: "0 0 12px", letterSpacing: "0.02em" }}>
              Tree services in Gisborne &amp; surrounding suburbs
            </h2>
            <p style={{ fontSize: "14px", color: "#27500A", margin: "0 auto", maxWidth: "560px", lineHeight: 1.5 }}>
              Proudly serving Gisborne and the wider Tairāwhiti region with professional arboricultural care.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: "#EAF3DE", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                  <ellipse cx="30" cy="52" rx="14" ry="2" fill="#173404" opacity="0.2" />
                  <path d="M30 8 C24 8 20 13 21 18 C16 18 13 22 14 27 C9 28 8 33 12 36 L48 36 C52 33 51 28 46 27 C47 22 44 18 39 18 C40 13 36 8 30 8 Z" fill="#639922" stroke="#173404" strokeWidth="1.5" />
                  <path d="M22 16 Q26 14 30 15 M34 14 Q38 16 40 20 M16 24 Q20 22 24 24 M36 24 Q40 22 44 26 M26 30 Q30 28 34 30" stroke="#27500A" strokeWidth="1" fill="none" opacity="0.5" />
                  <rect x="27" y="36" width="6" height="14" fill="#7A4A1F" stroke="#173404" strokeWidth="1.5" />
                  <path d="M27 40 L33 40 M27 44 L33 44" stroke="#173404" strokeWidth="0.8" opacity="0.6" />
                  <path d="M40 44 L48 36 L52 38 L46 46 L48 50 L44 52 Z" fill="#888780" stroke="#173404" strokeWidth="1.5" strokeLinejoin="round" />
                  <line x1="44" y1="40" x2="50" y2="40" stroke="#173404" strokeWidth="0.8" />
                </svg>
              </div>
              <div style={{ fontSize: "15px", fontWeight: 500, color: "#173404", marginBottom: "8px" }}>Tree removal</div>
              <p style={{ fontSize: "12px", color: "#27500A", lineHeight: 1.5, margin: 0, padding: "0 4px" }}>Safe removal of hazardous or unwanted trees across Gisborne properties</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: "#EAF3DE", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                  <ellipse cx="30" cy="54" rx="14" ry="2" fill="#173404" opacity="0.2" />
                  <rect x="28" y="32" width="4" height="20" fill="#7A4A1F" stroke="#173404" strokeWidth="1.5" />
                  <path d="M30 32 C20 32 14 24 18 16 C14 12 18 6 24 8 C26 4 34 4 36 8 C42 6 46 12 42 16 C46 24 40 32 30 32 Z" fill="#639922" stroke="#173404" strokeWidth="1.5" />
                  <path d="M22 14 Q26 12 30 14 M34 12 Q38 14 40 18 M20 22 Q24 20 28 22 M32 22 Q36 20 40 24" stroke="#27500A" strokeWidth="1" fill="none" opacity="0.5" />
                  <path d="M40 14 L52 6" stroke="#888780" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M50 4 L54 8 L52 10 L48 6 Z" fill="#888780" stroke="#173404" strokeWidth="1.2" />
                  <path d="M40 12 L44 16" stroke="#173404" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ fontSize: "15px", fontWeight: 500, color: "#173404", marginBottom: "8px" }}>Tree pruning</div>
              <p style={{ fontSize: "12px", color: "#27500A", lineHeight: 1.5, margin: 0, padding: "0 4px" }}>Expert pruning to improve tree health, shape and longevity</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: "#EAF3DE", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                  <ellipse cx="30" cy="52" rx="20" ry="2" fill="#173404" opacity="0.2" />
                  <line x1="4" y1="50" x2="56" y2="50" stroke="#7A4A1F" strokeWidth="1.5" />
                  <path d="M6 50 L6 32 Q6 26 10 24 Q14 20 18 24 Q22 18 26 22 Q30 16 34 22 Q38 18 42 24 Q46 20 50 24 Q54 26 54 32 L54 50 Z" fill="#3B6D11" stroke="#173404" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M10 28 Q12 26 14 28 M16 24 Q18 22 20 24 M22 22 Q24 20 26 22 M28 20 Q30 18 32 20 M34 22 Q36 20 38 22 M40 24 Q42 22 44 24 M46 26 Q48 24 50 26" stroke="#27500A" strokeWidth="0.8" fill="none" opacity="0.7" />
                  <path d="M12 36 Q14 34 16 36 M20 38 Q22 36 24 38 M28 36 Q30 34 32 36 M36 38 Q38 36 40 38 M44 36 Q46 34 48 36" stroke="#27500A" strokeWidth="0.8" fill="none" opacity="0.5" />
                  <path d="M14 44 Q16 42 18 44 M22 46 Q24 44 26 46 M30 44 Q32 42 34 44 M38 46 Q40 44 42 46 M46 44 Q48 42 50 44" stroke="#27500A" strokeWidth="0.8" fill="none" opacity="0.4" />
                  <path d="M14 16 L20 22 L18 24 L12 18 Z" fill="#B4B2A9" stroke="#173404" strokeWidth="1.2" />
                  <path d="M16 18 L22 24" stroke="#444441" strokeWidth="0.8" />
                  <rect x="11" y="13" width="4" height="6" fill="#444441" stroke="#173404" strokeWidth="0.8" transform="rotate(-45 13 16)" />
                </svg>
              </div>
              <div style={{ fontSize: "15px", fontWeight: 500, color: "#173404", marginBottom: "8px" }}>Hedge trimming</div>
              <p style={{ fontSize: "12px", color: "#27500A", lineHeight: 1.5, margin: 0, padding: "0 4px" }}>Tidy, well-shaped hedges for residential and rural properties</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: "#EAF3DE", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                  <ellipse cx="30" cy="54" rx="22" ry="2" fill="#173404" opacity="0.2" />
                  <ellipse cx="12" cy="48" rx="4" ry="4" fill="#2C2C2A" stroke="#173404" strokeWidth="1.2" />
                  <ellipse cx="48" cy="48" rx="4" ry="4" fill="#2C2C2A" stroke="#173404" strokeWidth="1.2" />
                  <circle cx="12" cy="48" r="1.5" fill="#888780" />
                  <circle cx="48" cy="48" r="1.5" fill="#888780" />
                  <rect x="10" y="36" width="34" height="10" rx="2" fill="#BA7517" stroke="#173404" strokeWidth="1.5" />
                  <rect x="14" y="32" width="22" height="6" rx="1" fill="#854F0B" stroke="#173404" strokeWidth="1.2" />
                  <circle cx="44" cy="40" r="6" fill="#888780" stroke="#173404" strokeWidth="1.5" />
                  <circle cx="44" cy="40" r="3.5" fill="#444441" stroke="#173404" strokeWidth="0.8" />
                  <path d="M44 36 L44 38 M48 40 L46 40 M44 44 L44 42 M40 40 L42 40 M46.8 37.2 L45.5 38.5 M46.8 42.8 L45.5 41.5 M41.2 42.8 L42.5 41.5 M41.2 37.2 L42.5 38.5" stroke="#444441" strokeWidth="1" strokeLinecap="round" />
                  <rect x="36" y="38" width="3" height="4" fill="#5C3A14" stroke="#173404" strokeWidth="1" />
                  <path d="M22 32 L20 26 L24 24 L26 30" fill="none" stroke="#173404" strokeWidth="1" strokeLinecap="round" />
                  <ellipse cx="22" cy="50" rx="4" ry="1.5" fill="#7A4A1F" stroke="#173404" strokeWidth="1" />
                  <path d="M19 50 L19 48 M22 50 L22 47 M25 50 L25 48" stroke="#444441" strokeWidth="0.6" />
                </svg>
              </div>
              <div style={{ fontSize: "15px", fontWeight: 500, color: "#173404", marginBottom: "8px" }}>Stump grinding</div>
              <p style={{ fontSize: "12px", color: "#27500A", lineHeight: 1.5, margin: 0, padding: "0 4px" }}>Complete stump removal using specialised grinding equipment</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: "#EAF3DE", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                  <ellipse cx="30" cy="54" rx="22" ry="2" fill="#173404" opacity="0.2" />
                  <line x1="2" y1="52" x2="58" y2="52" stroke="#7A4A1F" strokeWidth="1.5" />
                  <path d="M6 6 Q10 4 14 6 Q18 2 24 6 Q28 4 32 8 L8 8 Q4 8 6 6 Z" fill="#888780" stroke="#173404" strokeWidth="1" opacity="0.8" />
                  <line x1="12" y1="10" x2="10" y2="16" stroke="#185FA5" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                  <line x1="18" y1="10" x2="16" y2="14" stroke="#185FA5" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                  <line x1="24" y1="10" x2="22" y2="16" stroke="#185FA5" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                  <path d="M14 52 L14 44 Q14 42 16 42 L20 42 Q22 42 22 44 L22 52" fill="#7A4A1F" stroke="#173404" strokeWidth="1.5" />
                  <path d="M14 44 L18 38 L22 44 Z" fill="#5C3A14" stroke="#173404" strokeWidth="1.2" />
                  <path d="M22 50 Q30 44 40 42 Q48 40 54 36" stroke="#7A4A1F" strokeWidth="5" strokeLinecap="round" fill="none" />
                  <path d="M22 50 Q30 44 40 42 Q48 40 54 36" stroke="#5C3A14" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6" />
                  <ellipse cx="38" cy="38" rx="9" ry="6" fill="#3B6D11" stroke="#173404" strokeWidth="1.2" transform="rotate(-15 38 38)" />
                  <ellipse cx="48" cy="32" rx="7" ry="5" fill="#3B6D11" stroke="#173404" strokeWidth="1.2" transform="rotate(-15 48 32)" />
                  <ellipse cx="30" cy="42" rx="6" ry="4" fill="#27500A" stroke="#173404" strokeWidth="1" transform="rotate(-15 30 42)" />
                  <path d="M32 36 Q34 34 36 36 M40 32 Q42 30 44 32 M46 28 Q48 26 50 28" stroke="#27500A" strokeWidth="0.8" fill="none" opacity="0.7" />
                  <path d="M30 50 L26 46 M40 44 L36 46" stroke="#5C3A14" strokeWidth="1" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ fontSize: "15px", fontWeight: 500, color: "#173404", marginBottom: "8px" }}>Storm damage</div>
              <p style={{ fontSize: "12px", color: "#27500A", lineHeight: 1.5, margin: 0, padding: "0 4px" }}>Emergency response for fallen or damaged trees after weather events</p>
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

      {/* Tree Care Philosophy */}
      <section className="py-8 md:py-16 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          {/* Main Philosophy */}
          <div className="text-center mb-16">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Heart className="h-10 w-10 text-green-600 dark:text-green-400" data-testid="icon-philosophy-heart" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Our Tree Care Philosophy
            </h2>
            <div className="max-w-4xl mx-auto space-y-4 text-lg text-muted-foreground">
              <p>
                At Treemarkables, we believe every tree has value. Our first priority is always 
                <span className="font-semibold text-foreground"> tree preservation through expert pruning and care</span>.
              </p>
              <p>
                We only recommend tree removal when it's absolutely necessary for safety or when 
                there's no viable alternative to protect people and property.
              </p>
            </div>
          </div>

          {/* Preference for Pruning */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-8 mb-12">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                  <Scissors className="h-6 w-6 text-green-600 dark:text-green-400" data-testid="icon-pruning" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Tree Pruning: Our Preferred Solution
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Professional <a href="/tree-pruning" className="text-primary hover:text-primary/80 underline">tree pruning</a> can solve most tree problems while preserving the tree's health and beauty. 
                  We can address safety concerns, improve tree structure, remove diseased branches, and enhance 
                  your property's appearance without removing the entire tree.
                </p>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-foreground">
                    Free assessment to explore pruning alternatives before considering removal
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* When Removal is Necessary */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-foreground text-center mb-8">
              When Tree Removal Becomes Necessary
            </h3>
            <p className="text-center text-muted-foreground mb-8 max-w-3xl mx-auto">
              While we prefer to save trees whenever possible, there are situations where removal 
              is the only safe and responsible option:
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="hover-elevate" data-testid="card-removal-reason-0">
                <CardContent className="pt-6 pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" data-testid="icon-reason-0" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-3 text-center" data-testid="title-reason-0">
                    Safety Hazards
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed text-center" data-testid="description-reason-0">
                    When trees pose immediate danger to people, property, or power lines due to disease, damage, or structural weakness.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover-elevate" data-testid="card-removal-reason-1">
                <CardContent className="pt-6 pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" data-testid="icon-reason-1" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-3 text-center" data-testid="title-reason-1">
                    Irreversible Disease
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed text-center" data-testid="description-reason-1">
                    Trees affected by severe disease that cannot be treated and may spread to healthy trees nearby.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover-elevate" data-testid="card-removal-reason-2">
                <CardContent className="pt-6 pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" data-testid="icon-reason-2" />
                    </div>
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-3 text-center" data-testid="title-reason-2">
                    Structural Damage
                  </h4>
                  <p className="text-muted-foreground text-sm leading-relaxed text-center" data-testid="description-reason-2">
                    Trees causing foundation damage, blocking essential infrastructure, or creating access issues that cannot be resolved through pruning.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center bg-muted/30 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              Not Sure if Your Tree Needs to Be Removed?
            </h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Get a free consultation from our qualified arborists. We'll assess your tree's health 
              and explore all possible solutions before recommending removal.
            </p>
            <Button 
              onClick={handleGetQuote}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-consultation"
            >
              Get Free Tree Assessment
            </Button>
          </div>
        </div>
      </section>

      {/* Service Details */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6" data-testid="text-service-title">
                Why Gisborne Homeowners Choose Treemarkables
              </h2>
              <div className="space-y-5">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Same-Day Emergency Response</h3>
                    <p className="text-muted-foreground">Available 24/7 for storm damage and hazardous tree emergencies across Gisborne</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Fully Insured & WorkSafe Compliant</h3>
                    <p className="text-muted-foreground">Qualified NZ Arborists with comprehensive public liability insurance and safety certifications</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">No-Mess Cleanup Guarantee</h3>
                    <p className="text-muted-foreground">Complete debris removal, stump grinding, and site restoration - your property left spotless</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground">Locally Owned & Operated</h3>
                    <p className="text-muted-foreground">Your trusted Gisborne tree care specialists since 2020</p>
                  </div>
                </div>
              </div>
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

      {/* Related Services Section */}
      <section className="py-16 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-foreground mb-6">
              Complete Tree Care Services
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              After tree removal, you might need our other specialized services to complete your project.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Scissors className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/stump-grinding" className="hover:text-primary transition-colors">
                    Stump Grinding
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Complete the job with professional stump removal, leaving your property clean and ready for landscaping.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/stump-grinding">Learn More</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <TreePine className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/tree-pruning" className="hover:text-primary transition-colors">
                    Tree Pruning
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Keep your remaining trees healthy and safe with our expert pruning and maintenance services.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tree-pruning">Learn More</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <Leaf className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-3">
                  <Link href="/hedge-trimming" className="hover:text-primary transition-colors">
                    Hedge Trimming
                  </Link>
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Maintain your property's boundaries and aesthetics with professional hedge care and shaping.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/hedge-trimming">Learn More</Link>
                </Button>
              </CardContent>
            </Card>
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