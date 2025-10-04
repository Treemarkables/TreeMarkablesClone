import { useEffect } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import WhyChooseUs from "@/components/WhyChooseUs";
import ServicesOffered from "@/components/ServicesOffered";
import OurProcess from "@/components/OurProcess";
import Reviews from "@/components/Reviews";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

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
    "description": "Local arborists specialising in safe tree removal, pruning, stump grinding and hedge trimming across Gisborne, Wairoa and the East Coast.",
    "url": "https://www.treemarkables.co.nz",
    "telephone": "027-216-6882",
    "email": "quotes@treemarkables.nz",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Gisborne",
      "addressRegion": "Gisborne",
      "addressCountry": "NZ"
    },
    "areaServed": ["Gisborne", "Wairoa", "East Coast", "Poverty Bay"],
    "serviceType": ["Tree Removal", "Tree Pruning", "Stump Grinding", "Hedge Trimming"],
    "priceRange": "$$"
  };

  return (
    <div className="bg-background">
      <SEO 
        title="Treemarkables – Qualified Arborists in Gisborne & East Coast"
        description="Local arborists specialising in safe tree removal, pruning, stump grinding and hedge trimming across Gisborne, Wairoa and the East Coast. Get a free quote today."
        keywords="arborists Gisborne, tree removal Gisborne, tree pruning, stump grinding, hedge trimming, East Coast tree services, Wairoa tree removal, qualified arborist NZ"
        ogTitle="Treemarkables – Qualified Arborists in Gisborne & East Coast"
        ogDescription="Local arborists specialising in safe tree removal, pruning, stump grinding and hedge trimming across Gisborne, Wairoa and the East Coast. Get a free quote today."
        canonicalUrl="https://www.treemarkables.co.nz"
        structuredData={structuredData}
      />
      <Header />
      <Hero />
      <ServicesOffered />
      <WhyChooseUs />
      <OurProcess />
      <Reviews />
      <ContactSection />
      <Footer />
    </div>
  );
}