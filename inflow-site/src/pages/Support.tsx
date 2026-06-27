import LegalPage, { LegalSection } from "@/components/LegalPage";
import { BRAND } from "@/lib/brand";

export default function Support() {
  return (
    <LegalPage
      eyebrow="Help"
      title="Support"
      intro={
        <>
          Real people who've run a trades business, not a ticket queue. Here's how to get help with{" "}
          {BRAND.name}.
        </>
      }
    >
      <LegalSection title="Get in touch">
        <p>
          Email us at{" "}
          <a className="underline decoration-lime-deep" href={`mailto:${BRAND.contactEmail}`}>
            {BRAND.contactEmail}
          </a>{" "}
          and tell us what's happening — the more detail (what you were doing, what you expected, a
          screenshot if you can), the faster we can help.
        </p>
        <p>We aim to reply within 1 business day. Business-plan customers get priority response.</p>
      </LegalSection>

      <LegalSection title="In-app help">
        <p>Once you're signed in, the in-app Help centre has step-by-step guides and short how-to
          videos for every core workflow — quoting, scheduling, invoicing, safety and more. It's the
          fastest way to get unstuck mid-job.</p>
      </LegalSection>

      <LegalSection title="Getting started">
        <p>New to {BRAND.name}? We hand-onboard every business — we'll set up your account with you and
          help bring across your customers and details from your old tool. Email us to get started.</p>
      </LegalSection>

      <LegalSection title="Billing & account">
        <p>For questions about your plan, invoices, add-ons or cancelling, email{" "}
          <a className="underline decoration-lime-deep" href={`mailto:${BRAND.contactEmail}`}>
            {BRAND.contactEmail}
          </a>
          . You can manage your subscription any time from Settings → Billing in the app.</p>
      </LegalSection>

      <LegalSection title="Something broken or urgent?">
        <p>If the app is down or you've hit a blocker that's stopping work, email us with "URGENT" in
          the subject and we'll jump on it.</p>
      </LegalSection>
    </LegalPage>
  );
}
