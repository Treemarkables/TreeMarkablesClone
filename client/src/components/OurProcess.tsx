const steps = [
  {
    number: "1",
    title: "Free Estimate",
    description: "Contact us for a free estimate.",
  },
  {
    number: "2",
    title: "Safe Tree Removal",
    description: "Our team safely removes the tree from your property.",
  },
  {
    number: "3",
    title: "Cleanup & Disposal",
    description: "We clean up all debris and remove it from your property.",
  },
];

export default function OurProcess() {
  return (
    <section
      id="process"
      className="py-14 relative overflow-hidden"
      style={{ backgroundColor: "#111a11" }}
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Our Process
          </h2>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-gray-600" />
            <div className="h-px w-16 bg-gray-600" />
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="rounded-lg px-8 py-8"
              style={{ backgroundColor: "#1a2e1a" }}
              data-testid={`card-process-${index}`}
            >
              <div className="flex items-start gap-4">
                <span
                  className="text-5xl font-extrabold leading-none"
                  style={{ color: "#39FF14", opacity: 0.9 }}
                >
                  {step.number}
                </span>
                <div className="flex-1 pt-1">
                  <h3
                    className="text-xl font-bold text-white mb-2"
                    data-testid={`title-process-${index}`}
                  >
                    {step.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed" data-testid={`description-process-${index}`}>
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
