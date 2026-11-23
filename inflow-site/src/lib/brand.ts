import { LIVE_APP_ORIGIN, resolveAppSignupUrl } from "./signupLink";

export const BRAND = {
  name: "Inflow",
  tagline: "The operating system for trades businesses.",
  domain: "inflowapp.co.nz",
  contactEmail: "hello@inflowapp.co.nz",
  appUrl: LIVE_APP_ORIGIN,
  // Direct entry to the app's login screen.
  loginUrl: `${LIVE_APP_ORIGIN}/login`,
  // Self-serve signup. The app posts to POST /api/signup (createTenant).
  // VITE_APP_SIGNUP_URL overrides this for a non-production app only.
  signupUrl: resolveAppSignupUrl(import.meta.env.VITE_APP_SIGNUP_URL),
} as const;

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  // Pricing hidden until launch — restore alongside the /pricing route in App.tsx.
  // { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;
