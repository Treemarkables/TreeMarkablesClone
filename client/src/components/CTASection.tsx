export default function CTASection() {
  const handleRequestQuote = () => {
    document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden bg-[#0f1f0f]">
      <div className="flex flex-col md:flex-row min-h-[360px] md:min-h-[420px]">
        {/* Left: site photo with angled diagonal clip on the right edge */}
        <div
          className="relative w-full min-h-[240px] md:min-h-0 md:w-[48%] flex-shrink-0"
          style={{ clipPath: 'polygon(0 0, 93% 0, 100% 100%, 0 100%)' }}
        >
          <img
            src="/tree-removal-real.png"
            alt="Treemarkables arborists at work"
            className="absolute inset-0 w-full h-full object-cover object-center"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/25" />
        </div>

        {/* Right: CTA text + button */}
        <div className="flex-1 flex flex-col justify-center px-8 py-14 md:py-0 md:pl-10 md:pr-16 lg:pl-14 lg:pr-24">
          <h2
            className="text-white font-extrabold leading-tight mb-3"
            style={{ fontSize: 'clamp(26px, 3.5vw, 46px)' }}
          >
            Interested in our services?
          </h2>
          <p
            className="font-bold mb-8"
            style={{ fontSize: 'clamp(20px, 2.5vw, 36px)', color: '#39FF14' }}
          >
            Get a free quote.
          </p>
          <div>
            <button
              onClick={handleRequestQuote}
              className="inline-block font-bold uppercase tracking-widest px-10 py-4 rounded-md transition-colors duration-200 text-sm"
              style={{
                backgroundColor: '#39FF14',
                color: '#0a160a',
                letterSpacing: '0.12em',
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#32CD32'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#39FF14'; }}
            >
              Request a Quote
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
