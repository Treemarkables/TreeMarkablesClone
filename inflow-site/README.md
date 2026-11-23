# Inflow marketing site

The customer-facing marketing site for [Inflow](https://inflowapp.co.nz) — the SaaS spinoff of Treemarkables.

Lives as a sibling folder inside the Treemarkables monorepo for now. Built as a standalone Vite app so it can be lifted out into its own repo cleanly once the full Treemarkables/Inflow separation happens (post Apple iOS approval).

---

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS (no Shadcn — kept minimal so a future repo split is friction-free)
- [Wouter](https://github.com/molefrog/wouter) for routing (matches the main app)
- Inter Tight web font via [rsms.me/inter](https://rsms.me/inter/)

No backend. Marketing pages are static. **Sign up does not open the visitor's mail app.**

Header, home, features, about, and pricing CTAs go to the live app:

`https://app.inflowapp.co.nz/signup`

That page posts to `POST /api/signup`, which runs `createTenant` (business + admin employee + freemium subscription). The contact form collects name, business, and email, then sends the visitor to the same URL with those fields prefilled. They set a password on the app. A `mailto:` link is shown only if that signup URL cannot be built — it is not the success path.

Optional override for a non-production app: `VITE_APP_SIGNUP_URL`. Leave it unset in production.

---

## Pages

| Route | File |
|---|---|
| `/` | `src/pages/Home.tsx` |
| `/features` | `src/pages/Features.tsx` |
| `/pricing` | `src/pages/Pricing.tsx` |
| `/about` | `src/pages/About.tsx` |
| `/contact` | `src/pages/Contact.tsx` |
| 404 | `src/pages/NotFound.tsx` |

Shared layout: `src/components/Header.tsx`, `Footer.tsx`, `Wordmark.tsx`. Form: `src/components/RequestAccessForm.tsx`. Brand constants: `src/lib/brand.ts`. Tailwind tokens: `tailwind.config.js`.

---

## Local development

This project is **not yet installed**. Per the repo CLAUDE.md, `npm install` requires explicit owner approval.

When you're ready:

```bash
cd inflow-site
npm install
npm run dev          # starts on http://localhost:5173
```

Build:

```bash
npm run build        # outputs to inflow-site/dist
npm run preview      # serves the built site locally
```

---

## Sign up

Account creation is the app's existing signup, not a marketing-site endpoint and not a mail draft.

1. Production needs **no** env var. CTAs use `https://app.inflowapp.co.nz/signup` (`BRAND.signupUrl` in `src/lib/brand.ts`).
2. To point a preview build at another app, set:
   ```bash
   # inflow-site/.env.local
   VITE_APP_SIGNUP_URL=https://app.inflowapp.co.nz/signup
   ```
   The value must be an `https` URL (or `http://localhost`). A `mailto:` value is ignored and the live signup URL is used instead.
3. The contact form adds `businessName`, `firstName`, `lastName`, `email`, and `plan=freemium`. Pricing CTAs add `plan=freemium|crew|business`. The app signup page reads those query params, then `POST /api/signup` creates the tenant.

`hello@inflowapp.co.nz` stays as a contact address (footer, and the form's error state). Submitting the form does not open Mail.

---

## Deployment plan (proposed — not yet executed)

Target: **separate DO Static Site** behind `inflowapp.co.nz`. The existing Treemarkables DO app (`plankton-app`) is untouched.

1. Create a new DO Static Site app pointing at this repo, with **Source Directory** `/inflow-site` and **Build Command** `npm run build`, **Output Directory** `dist`.
2. In Cloudflare DNS for `inflowapp.co.nz`, add an `ALIAS`/`CNAME` for `@` (apex) and `www` pointing at the DO Static Site's hostname. Keep grey-cloud (DNS-only) — matches the pattern from CLAUDE.md for `app.treemarkables.co.nz`.
3. Verify the DO app issues TLS for both `inflowapp.co.nz` and `www.inflowapp.co.nz`.
4. Leave `VITE_APP_SIGNUP_URL` unset so Sign up stays on `https://app.inflowapp.co.nz/signup`. Set it only for a non-production app.

DNS / DO actions happen through dashboards, not from this repo.

---

## Brand notes

- **Palette:** anchored to the existing Inflow iOS icon (`/public/inflow-icon-*.png`). Black `#0A0A0B` + lime `#C8FF3D`. Light canvas (`#FBFBF7` paper) so the marketing site reads SaaS, not tree-service.
- **Type:** Inter Tight (headings) + Inter (body) via rsms.me. Tight letter-spacing on display sizes.
- **Voice:** plain, trades-respecting, no jargon. "Built in a trades business, for trades businesses" — that's the angle.
- **Component density:** generous whitespace, large display type, restrained colour use. Lime is an accent (1 button per section max, plus the brand mark) — never a flood.

---

## What this site **isn't** (deliberately)

- Not the app — the product runs at `https://app.inflowapp.co.nz`. Sign up there (`/signup`) creates the tenant.
- Not a CMS. Copy lives in `.tsx`. Add a CMS once content velocity demands it.
- Not SEO-optimised for organic search yet. It's a SPA, so search engines render JS-light. If organic search becomes a channel, migrate to Astro or Next.js (or add `vite-plugin-ssr`) — most of the components carry over.
- Not where the help/SOPs live. Subscriber-only help is in-app at `/help` (see `INFLOW_HELP_PLAN.md`).

---

## Future repo split (post Apple approval)

When Treemarkables and Inflow fully separate:

1. `git subtree split --prefix=inflow-site -b inflow-site-only`
2. Push that branch to a new repo (`inflowapp/site` or similar).
3. Repoint the DO Static Site at the new repo. No code changes required.

The lack of shared dependencies with the main app is intentional — this keeps that lift-out trivial.
