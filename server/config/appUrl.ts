// Single source of truth for the app's public base URL — the domain customer-facing
// links (proposals, invoices, video, payment redirects) and Stripe return URLs are
// built from.
//
// Set `APP_URL` in the Digital Ocean environment to cut the app over to its own domain
// (e.g. https://app.inflowapp.co.nz). The treemarkables fallback keeps behaviour
// unchanged until that env var is set, so this is safe to ship before the new domain
// is live.
//
// NOTE: this is the *app* container URL, distinct from per-tenant customer document
// identity (which stays per-business) and from the tree-care marketing SEO URLs (which
// stay on treemarkables this phase).
export const APP_URL = (process.env.APP_URL || "https://app.treemarkables.co.nz").replace(/\/$/, "");
