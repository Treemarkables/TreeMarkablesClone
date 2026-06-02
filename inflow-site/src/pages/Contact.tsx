import { Section, Container } from "@/components/Container";
import RequestAccessForm from "@/components/RequestAccessForm";
import { BRAND } from "@/lib/brand";

export default function Contact() {
  return (
    <>
      <Section className="pb-10">
        <div className="max-w-3xl">
          <span className="eyebrow">Contact</span>
          <h1 className="heading-display text-5xl md:text-6xl mt-5">
            Tell us about your business.
          </h1>
          <p className="mt-6 text-lg text-ink-500 leading-relaxed max-w-prose">
            We're onboarding a small group of NZ trades businesses one at a time. Drop in a few details and we'll be in touch personally.
          </p>
        </div>
      </Section>

      <section className="pb-20 md:pb-28">
        <Container>
          <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10">
            <aside className="space-y-8 lg:pr-6">
              <Block
                title="Email"
                body={
                  <a className="underline decoration-lime-deep" href={`mailto:${BRAND.contactEmail}`}>
                    {BRAND.contactEmail}
                  </a>
                }
              />
              <Block
                title="What happens next"
                body={
                  <ol className="space-y-3 list-decimal list-inside marker:text-ink-400">
                    <li>We read what you sent and reply within 1–2 working days.</li>
                    <li>Quick call to understand your workflow.</li>
                    <li>Hand-onboarding — we set up your account with you.</li>
                  </ol>
                }
              />
              <Block
                title="Already using Treemarkables / Inflow?"
                body={
                  <a className="underline decoration-lime-deep" href={BRAND.appUrl}>
                    Sign in to your account →
                  </a>
                }
              />
            </aside>

            <div>
              <RequestAccessForm />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

function Block({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-[0.18em] text-ink-400 mb-3">
        {title}
      </h3>
      <div className="text-[15px] text-ink-700 leading-relaxed">{body}</div>
    </div>
  );
}
