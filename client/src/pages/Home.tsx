import Header from "@/components/Header";
import Hero from "@/components/Hero";
import WhyChooseUs from "@/components/WhyChooseUs";
import ServicesOffered from "@/components/ServicesOffered";
import OurProcess from "@/components/OurProcess";
import Reviews from "@/components/Reviews";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
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