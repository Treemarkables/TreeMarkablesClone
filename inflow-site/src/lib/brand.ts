export const BRAND = {
  name: "Inflow",
  tagline: "The operating system for trades businesses.",
  domain: "inflowapp.co.nz",
  contactEmail: "hello@inflowapp.co.nz",
  appUrl: "https://app.inflowapp.co.nz",
  // Direct entry to the app's login screen.
  loginUrl: "https://app.inflowapp.co.nz/login",
} as const;

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;
