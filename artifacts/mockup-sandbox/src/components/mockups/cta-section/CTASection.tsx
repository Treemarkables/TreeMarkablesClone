export function CTASection() {
  return (
    <div className="min-h-screen bg-[#0a160a] flex items-center justify-center p-8">
      <div className="w-full max-w-5xl">
        {/* CTA Banner */}
        <section
          className="relative overflow-hidden rounded-xl"
          style={{ backgroundColor: "#0f1f0f", minHeight: "380px" }}
        >
          {/* Background subtle texture */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f1f0f] via-[#102010] to-[#0a150a]" />

          {/* Layout: image left, text right */}
          <div className="relative flex flex-col md:flex-row min-h-[380px]">
            {/* LEFT: Diagonal image panel */}
            <div
              className="relative md:w-[48%] overflow-hidden"
              style={{ minHeight: "280px" }}
            >
              <img
                src="/__mockup/images/arborist-drone.jpg"
                alt="Treemarkables arborist working at height"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              {/* Dark overlay so image doesn't overpower */}
              <div className="absolute inset-0 bg-black/20" />
              {/* Diagonal cut on the right edge of the image */}
              <div
                className="absolute inset-y-0 right-0 w-24 bg-[#0f1f0f]"
                style={{
                  clipPath: "polygon(60% 0%, 100% 0%, 100% 100%, 0% 100%)",
                }}
              />
            </div>

            {/* RIGHT: Text content */}
            <div className="relative md:w-[52%] flex items-center px-10 py-12 md:pl-12 md:pr-16">
              <div>
                <p
                  className="text-white font-extrabold leading-tight mb-8"
                  style={{ fontSize: "2.5rem", fontFamily: "system-ui, sans-serif" }}
                >
                  Get a free quote.
                </p>
                <button
                  onClick={() =>
                    document
                      .querySelector("#contact")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="px-8 py-3 rounded font-bold text-sm tracking-widest uppercase"
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

        {/* Context label */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Preview — this section will appear between "Our Process" and "Reviews" on the homepage.
          The button scrolls to the enquiry form below.
        </p>
      </div>
    </div>
  );
}
