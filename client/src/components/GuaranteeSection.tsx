export default function GuaranteeSection() {
  return (
    <section className="bg-black py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-16">
          {/* Left: heading */}
          <div className="md:w-1/2">
            <h2
              className="font-extrabold leading-tight tracking-tight"
              style={{
                fontSize: 'clamp(32px, 5vw, 60px)',
                color: '#39FF14',
                fontFamily: "'TT Norms Pro', sans-serif",
              }}
            >
              Our Treemarkables Guarantee
            </h2>
          </div>

          {/* Right: guarantee text */}
          <div className="md:w-1/2">
            <p
              className="text-white leading-relaxed"
              style={{ fontSize: 'clamp(15px, 1.6vw, 18px)' }}
            >
              If we have not completed the job as promised, we will come back and fix any issues free of charge.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
