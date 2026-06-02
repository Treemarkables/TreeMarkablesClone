import { LinkButton } from "@/components/Button";
import { Section } from "@/components/Container";

export default function NotFound() {
  return (
    <Section className="text-center">
      <p className="eyebrow">404</p>
      <h1 className="heading-display text-5xl md:text-6xl mt-3">
        Page not found
      </h1>
      <p className="mt-4 text-ink-500 max-w-prose mx-auto">
        The page you're looking for doesn't exist, or has moved.
      </p>
      <div className="mt-8">
        <LinkButton href="/" variant="primary" size="lg">
          Back to home
        </LinkButton>
      </div>
    </Section>
  );
}
