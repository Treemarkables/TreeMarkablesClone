import { Section, Container } from "@/components/Container";
import RequestAccessForm from "@/components/RequestAccessForm";
import { BRAND } from "@/lib/brand";

export default function Contact() {
  return (
    <>
      <Section className="pb-10">
        <div className="max-w-3xl mx-auto text-center">
          <span className="eyebrow">Sign up</span>
          <h1 className="heading-display text-5xl md:text-6xl mt-5">
            Create your account.
          </h1>
          <p className="mt-6 text-lg text-ink-500 leading-relaxed max-w-prose mx-auto">
            Continue to the Inflow app and set a password. That registers your business, an admin login, and a free subscription.
          </p>
        </div>
      </Section>

      <section className="pb-20 md:pb-28">
        <Container>
          <div className="max-w-xl mx-auto">
            <div>
              <RequestAccessForm />
            </div>
            <aside className="mt-12 grid sm:grid-cols-3 gap-8 text-center">
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
                    <li>You set a password on the Inflow app.</li>
                    <li>We create your business and admin login.</li>
                    <li>You're on the free plan and can sign in.</li>
                  </ol>
                }
              />
              <Block
                title="Already using Inflow?"
                body={
                  <a className="underline decoration-lime-deep" href={BRAND.loginUrl}>
                    Sign in to your account →
                  </a>
                }
              />
            </aside>
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
