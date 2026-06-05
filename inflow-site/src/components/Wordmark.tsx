import { Link } from "wouter";

export default function Wordmark({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const fg = variant === "light" ? "text-ink-900" : "text-paper";
  return (
    <Link
      href="/"
      className={`flex items-center gap-2.5 ${fg} font-semibold tracking-snug`}
      aria-label="Inflow — home"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-ink-900">
        <img
          src="/inflow-icon-192.png?v=8"
          alt=""
          className="h-8 w-8 rounded-md"
          width={32}
          height={32}
        />
      </span>
      <span className="text-[19px] leading-none">Inflow</span>
    </Link>
  );
}
