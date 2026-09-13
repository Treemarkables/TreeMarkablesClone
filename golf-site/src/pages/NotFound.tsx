import { LinkButton } from "@/components/Button";
import { Section } from "@/components/Container";

export default function NotFound() {
  return (
    <Section className="py-32 text-center">
      <p className="kicker">Out of bounds</p>
      <h1 className="heading-display mt-4 text-5xl text-club-950">
        That one's in the trees.
      </h1>
      <p className="mx-auto mt-4 max-w-md text-ink/70">
        The page you're after doesn't exist. Take a drop and head back to the
        clubhouse.
      </p>
      <div className="mt-8">
        <LinkButton href="/" variant="primary" size="lg">
          Back to the first tee
        </LinkButton>
      </div>
    </Section>
  );
}
