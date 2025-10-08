import { Button } from "@/components/ui/button";

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
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/20 to-black/10"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-32">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            We're just a bunch of Gizzy guys and we climb trees
          </h1>

        </div>
      </div>
    </section>
  );
}