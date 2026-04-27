import { Button } from "@/components/ui/button";
import FloatingReviews from "@/components/FloatingReviews";

export default function Hero() {
  const handleGetQuote = () => {
    console.log('Get quote clicked from hero');
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLearnMore = () => {
    console.log('Learn more clicked');
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[420px] lg:min-h-[560px] flex items-start">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/team-photo.jpg" 
          alt="Treemarkables arborist team at work in Gisborne" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/10"></div>
      </div>
      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24">
        <div className="max-w-3xl">
          <h1
            className="text-white mb-6 font-extrabold leading-tight tracking-tight"
            style={{
              fontSize: 'clamp(36px, 6vw, 72px)',
              textShadow: '0 2px 24px rgba(0,0,0,0.55)',
              fontFamily: "'TT Norms Pro', sans-serif",
            }}
          >Gisborne's Number 1<br />Arborist & Tree Care</h1>

        </div>
      </div>
      <FloatingReviews />
    </section>
  );
}