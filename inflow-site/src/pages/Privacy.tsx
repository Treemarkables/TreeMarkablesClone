import LegalPage, { LegalSection } from "@/components/LegalPage";
import { BRAND } from "@/lib/brand";

export default function Privacy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      updated="June 2026"
      intro={
        <>
          {BRAND.name} is a job-management platform for trades and field-service businesses. This
          policy explains what we collect, why, and how we look after it. We comply with the New
          Zealand Privacy Act 2020 and its Information Privacy Principles.
        </>
      }
    >
      <LegalSection title="Who we are">
        <p>
          {BRAND.name} is operated from Gisborne, New Zealand. For any privacy question or request,
          contact us at{" "}
          <a className="underline decoration-lime-deep" href={`mailto:${BRAND.contactEmail}`}>
            {BRAND.contactEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Two kinds of data">
        <p>
          <strong>Your account data</strong> — information about you and your business: name, email,
          phone, business details, staff you add, and your subscription and billing records.
        </p>
        <p>
          <strong>Your business's data</strong> — the information you put into {BRAND.name} to run
          your work: your customers and their contact details, jobs, quotes, proposals, invoices,
          photos, documents, schedules and messages. For this data <strong>you are the controller</strong>{" "}
          and {BRAND.name} is the processor — we hold and process it on your behalf, under your
          instructions, and don't use it for our own purposes.
        </p>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>To provide and operate the service; to process your subscription and payments; to send
          service and account communications; to provide support; to keep the platform secure; and to
          improve {BRAND.name}. We do not sell your data, and we do not use your business's customer
          data to train AI models.</p>
      </LegalSection>

      <LegalSection title="Service providers (sub-processors)">
        <p>We use trusted providers to run {BRAND.name}. They only process data to provide their
          service to us:</p>
        <ul className="list-disc list-inside space-y-1.5 marker:text-ink-400">
          <li><strong>Hosting & database</strong> — DigitalOcean and Neon (Postgres), hosted in Australia.</li>
          <li><strong>File & photo storage</strong> — Google Cloud Storage (Australia).</li>
          <li><strong>Payments</strong> — Stripe. Card details go directly to Stripe; we never see or store full card numbers.</li>
          <li><strong>Messaging</strong> — our SMS and (optional) call-recording providers, used only when you send texts or use calling.</li>
          <li><strong>AI features</strong> — when you use AI tools (e.g. speech-to-quote, lead capture), the relevant content is sent to our AI provider to generate the result. It is not used to train their models.</li>
          <li><strong>Email</strong> — our transactional email provider for account and job notifications.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Where your data is held">
        <p>Your data is stored on servers in Australia. Some sub-processors above may process limited
          data in other countries; where they do, we rely on providers that offer protections
          comparable to the NZ Privacy Act.</p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>We keep your data for as long as your account is active. If you close your account, you can
          export your data first; we then delete or de-identify it within a reasonable period, except
          where we must retain records to meet legal or tax obligations.</p>
      </LegalSection>

      <LegalSection title="Security">
        <p>We protect your data with encryption in transit, access controls, tenant isolation so one
          business can never see another's data, and audit logging. No system is perfectly secure, but
          we take protection seriously and will notify you and the Privacy Commissioner of any breach
          that is likely to cause serious harm, as required by law.</p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Under the Privacy Act you can ask to access or correct the personal information we hold
          about you. If your business uses {BRAND.name} and you are one of their customers, please
          contact that business directly — they control your data and we act on their instructions.
          For account holders, email us and we'll help.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>We may update this policy as the service evolves. We'll post the new version here and update
          the date above; significant changes will be notified in-app or by email.</p>
      </LegalSection>

      <p className="text-xs text-ink-400 pt-4 border-t border-ink-100">
        This is a plain-English summary provided for transparency and is not legal advice. We
        recommend reviewing it with your own adviser before relying on it.
      </p>
    </LegalPage>
  );
}
