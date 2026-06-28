import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "wouter";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-150 select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink-900 text-paper hover:bg-ink-800 active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 focus:ring-offset-paper",
  secondary:
    "bg-lime text-ink-900 hover:bg-lime-bright active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-ink-900 focus:ring-offset-2 focus:ring-offset-paper",
  ghost:
    "bg-transparent text-ink-900 hover:bg-ink-100 active:scale-[0.985]",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
};

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

type LinkButtonProps = CommonProps & {
  href: string;
  external?: boolean;
  // External links navigate in the same tab by default (e.g. "Log in"). Opt in
  // to a new tab for genuinely external destinations.
  newTab?: boolean;
};

export function LinkButton({
  href,
  external,
  newTab,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: LinkButtonProps) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  if (external) {
    return (
      <a
        href={href}
        className={cls}
        {...(newTab ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
