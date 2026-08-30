import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "wouter";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-150 select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-fairway-900 text-cream hover:bg-fairway-950 active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-cream",
  secondary:
    "bg-gold text-fairway-950 hover:bg-gold-bright active:scale-[0.985] focus:outline-none focus:ring-2 focus:ring-fairway-900 focus:ring-offset-2 focus:ring-offset-cream",
  ghost: "bg-transparent text-fairway-900 hover:bg-fairway-100 active:scale-[0.985]",
  outline:
    "bg-transparent text-cream border border-cream/40 hover:border-cream hover:bg-cream/10 active:scale-[0.985]",
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
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

type LinkButtonProps = CommonProps & {
  href: string;
  external?: boolean;
};

export function LinkButton({
  href,
  external,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: LinkButtonProps) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  if (external) {
    return (
      <a href={href} className={cls}>
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
