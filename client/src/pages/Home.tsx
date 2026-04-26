import { useEffect } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import FloatingReviews from "@/components/FloatingReviews";
import WhyChooseUs from "@/components/WhyChooseUs";
import ServicesOffered from "@/components/ServicesOffered";
import CTASection from "@/components/CTASection";
import Reviews from "@/components/Reviews";
import GuaranteeSection from "@/components/GuaranteeSection";
import ContactSection from "@/components/ContactSection";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import InquiryForm from "@/components/InquiryForm";

export default function Home() {
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

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Treemarkables",
    "description": "Local arborists specialising in safe tree removal, pruning, stump grinding and hedge trimming across Gisborne, Wairoa and the East Coast",
    "url": "https://app.treemarkables.co.nz",
    "telephone": "027-216-6882",
    "email": "quotes@treemarkables.nz",
    "image": "https://app.treemarkables.co.nz/logo.jpg",
    "logo": "https://app.treemarkables.co.nz/logo.jpg",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Gisborne",
      "addressRegion": "Gisborne",
      "addressCountry": "NZ"
    },
    "areaServed": ["Gisborne", "Wairoa", "East Coast", "Tairāwhiti"],
    "openingHours": "Mo-Su 00:00-24:00",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Tree Services",
      "itemListElement": [
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Tree Removal" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Tree Pruning" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Stump Grinding" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Hedge Trimming" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Emergency Tree Removal" } },
        { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Mulch Deliveries" } }
      ]
    },
    "sameAs": [
      "https://www.facebook.com/TreemarkablesGisborne"
    ],
    "priceRange": "$$"
  };

  return (
    <div>
      <SEO 
        title="Tree Removal & Arborist Services Gisborne | Treemarkables"
        description="Local arborists specialising in safe tree removal, pruning, stump grinding and hedge trimming across Gisborne, Wairoa and the East Coast. Get a free quote today."
        keywords="arborists Gisborne, tree removal Gisborne, tree pruning, stump grinding, hedge trimming, East Coast tree services, Wairoa tree removal, qualified arborist NZ"
        ogTitle="Treemarkables – Qualified Arborists in Gisborne & East Coast"
        ogDescription="Local arborists specialising in safe tree removal, pruning, stump grinding and hedge trimming across Gisborne, Wairoa and the East Coast. Get a free quote today."
        canonicalUrl="https://app.treemarkables.co.nz"
        structuredData={structuredData}
      />
      <Header />
      <FloatingReviews />
      <Hero />
      <section className="py-10 md:py-14 bg-muted/30">
        <div className="max-w-2xl mx-auto px-6">
          <InquiryForm />
        </div>
      </section>
      <ServicesOffered />
      <WhyChooseUs />
      <CTASection />
      <Reviews />
      <GuaranteeSection />
      <FAQSection />
      <ContactSection />
      <Footer />
    </div>
  );
}