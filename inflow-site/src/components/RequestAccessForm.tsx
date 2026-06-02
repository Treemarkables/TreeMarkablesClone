import { useState, type FormEvent } from "react";
import { Button } from "./Button";
import { BRAND } from "@/lib/brand";

type State = "idle" | "submitting" | "success" | "error";

export default function RequestAccessForm() {
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg(null);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    const endpoint = import.meta.env.VITE_REQUEST_ACCESS_ENDPOINT as
      | string
      | undefined;

    try {
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Server error (${res.status})`);
      } else {
        const body = encodeURIComponent(
          [
            `Name: ${data.name ?? ""}`,
            `Business: ${data.business ?? ""}`,
            `Trade: ${data.trade ?? ""}`,
            `Crew size: ${data.crewSize ?? ""}`,
            `Email: ${data.email ?? ""}`,
            `Phone: ${data.phone ?? ""}`,
            `Currently using: ${data.tools ?? ""}`,
            ``,
            `${data.message ?? ""}`,
          ].join("\n")
        );
        const subject = encodeURIComponent(
          `Inflow access request — ${data.business ?? data.name ?? ""}`
        );
        window.location.href = `mailto:${BRAND.contactEmail}?subject=${subject}&body=${body}`;
      }
      setState("success");
      form.reset();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl bg-ink-900 text-paper p-8 md:p-10">
        <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-lime text-ink-900 font-semibold">
          ✓
        </div>
        <h3 className="mt-5 heading-section text-2xl md:text-3xl">Thanks — we'll be in touch.</h3>
        <p className="mt-3 text-ink-300 leading-relaxed">
          We onboard each business by hand, so expect a real reply within a day or two from someone who's actually built this thing.
        </p>
        <button
          className="mt-6 text-sm underline decoration-lime"
          onClick={() => setState("idle")}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-paper border border-ink-100 p-6 md:p-8 shadow-soft"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Your name" name="name" required />
        <Field label="Business name" name="business" required />
        <Field label="What trade?" name="trade" placeholder="e.g. Arborist, builder, sparky" required />
        <Field label="Crew size" name="crewSize" placeholder="e.g. 3" />
        <Field label="Email" name="email" type="email" required />
        <Field label="Phone" name="phone" type="tel" />
      </div>

      <div className="mt-4">
        <Field label="What are you currently using?" name="tools" placeholder="Tradify / ServiceM8 / paper job book / etc." />
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-ink-700 mb-1.5">
          Anything else we should know?
        </label>
        <textarea
          name="message"
          rows={4}
          className="w-full rounded-lg border border-ink-200 bg-paper px-3.5 py-2.5 text-[15px] outline-none focus:border-ink-900 focus:ring-2 focus:ring-lime/40 transition-shadow"
        />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <p className="text-xs text-ink-500">
          We'll never share your details. Replies come from a real human.
        </p>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={state === "submitting"}
        >
          {state === "submitting" ? "Sending…" : "Request access"}
        </Button>
      </div>

      {state === "error" && (
        <p className="mt-4 text-sm text-red-600">
          {errorMsg ?? "Couldn't send right now."} You can also email us directly at{" "}
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
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
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
        className="w-full h-11 rounded-lg border border-ink-200 bg-paper px-3.5 text-[15px] outline-none focus:border-ink-900 focus:ring-2 focus:ring-lime/40 transition-shadow"
      />
    </label>
  );
}
