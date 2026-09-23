import { useState, type FormEvent } from "react";
import { Button } from "./Button";
import { BRAND } from "@/lib/brand";
import { continueToSignup } from "@/lib/signupLink";

type State = "idle" | "submitting" | "error";

export default function RequestAccessForm() {
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg(null);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const result = continueToSignup({
      signupUrl: BRAND.signupUrl,
      firstName: String(data.firstName ?? ""),
      lastName: String(data.lastName ?? ""),
      businessName: String(data.businessName ?? ""),
      email: String(data.email ?? ""),
      plan: "freemium",
    });

    if (!result.ok) {
      setErrorMsg(result.reason);
      setState("error");
      return;
    }

    window.location.assign(result.href);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-paper border border-ink-100 p-6 md:p-8 shadow-soft"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="First name" name="firstName" autoComplete="given-name" required />
        <Field label="Last name" name="lastName" autoComplete="family-name" required />
        <Field label="Business name" name="businessName" autoComplete="organization" required />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <p className="text-xs text-ink-500">
          Next you'll set a password on the Inflow app. That registers your business on the free plan.
        </p>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={state === "submitting"}
        >
          {state === "submitting" ? "Continuing…" : "Continue to sign up"}
        </Button>
      </div>

      {state === "error" && (
        <p className="mt-4 text-sm text-red-600">
          {errorMsg ?? "Couldn't open signup right now."} You can email us at{" "}
          <a className="underline" href={`mailto:${BRAND.contactEmail}`}>
            {BRAND.contactEmail}
          </a>
          .
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-700 mb-1.5">
        {label}
        {required && <span className="text-ink-400"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="w-full h-11 rounded-lg border border-ink-200 bg-paper px-3.5 text-[15px] outline-none focus:border-ink-900 focus:ring-2 focus:ring-lime/40 transition-shadow"
      />
    </label>
  );
}
