import { Link } from "wouter";
import { LinkButton } from "@/components/Button";
import LegalPage, { LegalSection } from "@/components/LegalPage";
import {
  DELETE_INTRO,
  DELETE_KEPT,
  DELETE_MAILTO,
  DELETE_OWN_LOGIN,
  DELETE_DISCLAIMER,
  DELETE_PAGE_HEADING,
  DELETE_QUESTIONS,
  DELETE_REMOVED,
  DELETE_REMOVED_LEAD,
  DELETE_STEPS,
  DELETE_STEPS_LEAD,
  DELETE_TIMEFRAME,
  DELETE_UPDATED,
  stepParts,
} from "@/lib/deleteAccountCopy";

function StepLine({ step }: { step: string }) {
  return (
    <>
      {stepParts(step).map((part, index) => {
        if (part.type === "email") {
          return (
            <a key={index} className="underline decoration-lime-deep" href={DELETE_MAILTO}>
              {part.value}
            </a>
          );
        }
        if (part.type === "subject") {
          return <strong key={index}>{part.value}</strong>;
        }
        return <span key={index}>{part.value}</span>;
      })}
    </>
  );
}

export default function DeleteAccount() {
  const questions = DELETE_QUESTIONS.split("Privacy Policy");
  return (
    <LegalPage
      eyebrow="Account"
      title={DELETE_PAGE_HEADING}
      updated={DELETE_UPDATED}
      intro={DELETE_INTRO}
    >
      <LegalSection title="How to request deletion">
        <p>{DELETE_STEPS_LEAD}</p>
        <ol className="list-decimal list-inside space-y-2 marker:text-ink-400">
          {DELETE_STEPS.map((step) => (
            <li key={step}>
              <StepLine step={step} />
            </li>
          ))}
        </ol>
        <p>
          <LinkButton href={DELETE_MAILTO} external variant="primary" size="lg">
            Email your deletion request
          </LinkButton>
        </p>
      </LegalSection>

      <LegalSection title="What we delete">
        <p>{DELETE_REMOVED_LEAD}</p>
        <ul className="list-disc list-inside space-y-1.5 marker:text-ink-400">
          {DELETE_REMOVED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title="What we keep, and for how long">
        <ul className="list-disc list-inside space-y-1.5 marker:text-ink-400">
          {DELETE_KEPT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title="How long deletion takes">
        <p>{DELETE_TIMEFRAME}</p>
      </LegalSection>

      <LegalSection title="Removing only your own sign-in">
        <p>{DELETE_OWN_LOGIN}</p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          {questions[0]}
          <Link href="/privacy" className="underline decoration-lime-deep">
            Privacy Policy
          </Link>
          {questions[1] ?? ""}
        </p>
      </LegalSection>

      <p className="text-xs text-ink-400 pt-4 border-t border-ink-100">{DELETE_DISCLAIMER}</p>
    </LegalPage>
  );
}
