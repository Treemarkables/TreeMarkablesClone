import { Link } from "wouter";
import LegalPage, { LegalSection } from "@/components/LegalPage";
import { BRAND } from "@/lib/brand";

export default function Security() {
  return (
    <LegalPage
      eyebrow="Trust"
      title="Security"
      updated="July 2026"
      intro={
        <>
          Your business runs on the data you put into {BRAND.name} — your customers, jobs, quotes,
          invoices and records. This page explains, in plain English, how we keep that data safe.
          If you have a question we don't answer here, email{" "}
          <a className="underline decoration-lime-deep" href={`mailto:${BRAND.contactEmail}`}>
            {BRAND.contactEmail}
          </a>{" "}
          and we'll answer it directly.
        </>
      }
    >
      <LegalSection title="Your data is yours alone">
        <p>
          Every business on {BRAND.name} is fully isolated from every other. Isolation is enforced
          inside the database itself using PostgreSQL row-level security — every record belongs to
          exactly one business, and the database refuses to return another business's rows even if
          the application asked for them. One tenant can never see another's customers, jobs,
          pricing or documents.
        </p>
        <p>
          We also test this continuously: an automated cross-tenant isolation harness logs in as
          two separate businesses and probes the API for any leak between them, including attempts
          to read, modify or delete the other business's records.
        </p>
      </LegalSection>

      <LegalSection title="Encryption">
        <p>
          All traffic between your devices and {BRAND.name} is encrypted in transit with TLS
          (HTTPS). Your data is encrypted at rest in our database and file storage — both providers
          encrypt all stored data by default.
        </p>
      </LegalSection>

      <LegalSection title="Where your data lives">
        <p>
          Your data is stored in Australia — the database in Sydney and photos and documents in
          Australian cloud storage — close to New Zealand and under providers offering protections
          comparable to the NZ Privacy Act. See our{" "}
          <Link className="underline decoration-lime-deep" href="/privacy">
            Privacy Policy
          </Link>{" "}
          for the full list of service providers.
        </p>
      </LegalSection>

      <LegalSection title="Payments">
        <p>
          Card payments are handled by Stripe, a PCI-DSS Level 1 certified payment provider. Card
          numbers go directly from your customer's browser to Stripe — they never touch or pass
          through {BRAND.name}'s servers, and we never see or store them.
        </p>
      </LegalSection>

      <LegalSection title="Access control">
        <p>
          You control who on your team sees what: staff accounts have role-based permissions, so a
          crew member and an office admin see different things. Passwords are stored only as
          one-way cryptographic hashes (we can't read them), and login endpoints are rate-limited
          to block password-guessing attacks.
        </p>
      </LegalSection>

      <LegalSection title="Backups and recovery">
        <p>
          Our database is continuously backed up with point-in-time recovery, so data can be
          restored to a precise moment rather than just a nightly snapshot. Files and photos are
          stored on durable, redundant cloud object storage.
        </p>
      </LegalSection>

      <LegalSection title="How we work">
        <p>
          We run regular internal security audits of the whole platform — the kind that look for
          real attack paths, not just checklists — and remediate findings promptly. Changes to
          sensitive data are audit-logged, webhooks from third parties are signature-verified, and
          the platform is health-monitored around the clock with alerts to our team.
        </p>
      </LegalSection>

      <LegalSection title="Privacy Act 2020">
        <p>
          We comply with the New Zealand Privacy Act 2020 and its Information Privacy Principles,
          including mandatory breach notification: if a breach ever occurs that is likely to cause
          serious harm, we will notify you and the Office of the Privacy Commissioner as the law
          requires. We do not sell your data, and we do not use your business's customer data to
          train AI models.
        </p>
      </LegalSection>

      <LegalSection title="Certifications">
        <p>
          {BRAND.name} does not yet hold formal certifications such as SOC 2 or ISO 27001 — those
          audits are on our roadmap as our customers' needs grow. In the meantime we're happy to
          complete security questionnaires or walk through our practices with you directly; just
          get in touch.
        </p>
      </LegalSection>

      <LegalSection title="Reporting a vulnerability">
        <p>
          If you believe you've found a security issue in {BRAND.name}, please tell us at{" "}
          <a className="underline decoration-lime-deep" href={`mailto:${BRAND.contactEmail}`}>
            {BRAND.contactEmail}
          </a>{" "}
          with enough detail to reproduce it. We'll acknowledge your report, investigate promptly,
          and keep you informed. We ask that you give us a reasonable opportunity to fix the issue
          before disclosing it publicly, and that you don't access data that isn't yours.
        </p>
      </LegalSection>

      <p className="text-xs text-ink-400 pt-4 border-t border-ink-100">
        This page is a plain-English summary of our security practices as at the date above. It is
        provided for transparency and is not a contractual warranty.
      </p>
    </LegalPage>
  );
}
