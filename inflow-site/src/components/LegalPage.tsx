import type { ReactNode } from "react";
import { Section } from "@/components/Container";

/** Shared layout for the Privacy / Terms / Support pages: centered header, readable
 *  left-aligned body. Use <LegalSection title="…"> blocks for each section. */
export default function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section className="pt-28 md:pt-32">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="heading-display text-4xl md:text-5xl mt-4">{title}</h1>
          {updated && <p className="mt-3 text-sm text-ink-400">Last updated {updated}</p>}
        </div>
        {intro && <p className="mt-10 text-lg text-ink-600 leading-relaxed">{intro}</p>}
        <div className="mt-10 space-y-9">{children}</div>
      </div>
    </Section>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="heading-section text-xl md:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-[1.7] text-ink-700">{children}</div>
    </section>
  );
}
