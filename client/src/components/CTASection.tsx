export default function CTASection() {
  const scrollToContact = () => {
    document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: "#0f1f0f", minHeight: "360px" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f1f0f] via-[#102010] to-[#0a150a]" />

      <div className="relative flex flex-col md:flex-row min-h-[360px]">
        {/* LEFT: Photo panel with diagonal cut */}
        <div className="relative md:w-[48%] overflow-hidden" style={{ minHeight: "260px" }}>
          <img
            src="/arborist-drone.jpg"
            alt="Treemarkables arborist working at height"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="absolute inset-y-0 right-0 w-24"
            style={{
              backgroundColor: "#0f1f0f",
              clipPath: "polygon(60% 0%, 100% 0%, 100% 100%, 0% 100%)",
            }}
          />
        </div>

        {/* RIGHT: Text and CTA */}
        <div className="relative md:w-[52%] flex items-center px-8 py-12 md:pl-12 md:pr-16">
          <div>
            <p
              className="text-white font-extrabold leading-tight mb-8"
              style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", fontFamily: "inherit" }}
            >
              Get a free quote.
            </p>
            <button
              onClick={scrollToContact}
              className="px-8 py-3 rounded font-bold text-sm uppercase tracking-widest transition-opacity hover:opacity-90"
              style={{
                backgroundColor: "#39FF14",
                color: "#0a160a",
                letterSpacing: "0.12em",
              }}
            >
              Get a Free Quote
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
