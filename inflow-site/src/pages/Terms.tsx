import LegalPage, { LegalSection } from "@/components/LegalPage";
import { BRAND } from "@/lib/brand";

export default function Terms() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      updated="June 2026"
      intro={
        <>
          These terms govern your use of {BRAND.name}. By creating an account or using the service,
          you agree to them. Please read them alongside our Privacy Policy.
        </>
      }
    >
      <LegalSection title="The service">
        <p>{BRAND.name} is a subscription job-management platform for trades and field-service
          businesses. We provide it on an "as available" basis and work hard to keep it running, but
          we don't guarantee uninterrupted access.</p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>You're responsible for your account, your staff's access, and keeping login details secure.
          You must give accurate information and use {BRAND.name} only for lawful purposes and in line
          with these terms.</p>
      </LegalSection>

      <LegalSection title="Subscriptions & billing">
        <p>Paid plans are billed monthly in advance in New Zealand dollars. Prices are shown excluding
          GST, which is added at checkout. Plans, usage allowances and add-ons are as described on our
          Pricing page. You can upgrade, downgrade or cancel at any time; cancelling stops future
          billing, and you keep access until the end of the current period. Fees already paid are
          non-refundable except where required by law.</p>
        <p>If a payment fails, we may retry it and notify you. If it remains unpaid, your account may
          move to the free tier rather than being deleted — your data stays, but paid features are
          paused until billing is restored.</p>
      </LegalSection>

      <LegalSection title="Your data is yours">
        <p>You own the data you put into {BRAND.name}. We claim no ownership of it. You can export it
          at any time, and we only access it to operate the service, provide support, or as you
          instruct. See our Privacy Policy for the detail.</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Don't use {BRAND.name} to break the law, send spam or unlawful messages, infringe others'
          rights, attempt to breach our security or other tenants' data, or resell the service without
          our agreement. You're responsible for getting any consents you need before texting or
          emailing your own customers through the platform.</p>
      </LegalSection>

      <LegalSection title="Availability & support">
        <p>We aim to keep {BRAND.name} available and to fix issues promptly. Support is provided by
          email and (on applicable plans) priority channels — see our Support page. We may release
          updates, change features, or perform maintenance from time to time.</p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>To the extent permitted by law, {BRAND.name} is provided without warranties beyond those
          that cannot be excluded, and our total liability to you is limited to the fees you paid in
          the three months before the claim. Nothing in these terms limits rights you have under the
          New Zealand Consumer Guarantees Act where it applies.</p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>You can stop using {BRAND.name} and cancel any time. We may suspend or end access if these
          terms are seriously or repeatedly breached. On termination you can export your data within a
          reasonable window before it is deleted.</p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>These terms are governed by the laws of New Zealand, and the New Zealand courts have
          jurisdiction over any dispute.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Questions about these terms? Email{" "}
          <a className="underline decoration-lime-deep" href={`mailto:${BRAND.contactEmail}`}>
            {BRAND.contactEmail}
          </a>
          .</p>
      </LegalSection>

      <p className="text-xs text-ink-400 pt-4 border-t border-ink-100">
        This is a plain-English draft provided for transparency and is not legal advice. Please have
        it reviewed by your own adviser before relying on it.
      </p>
    </LegalPage>
  );
}
