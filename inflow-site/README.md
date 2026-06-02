# Inflow marketing site

The customer-facing marketing site for [Inflow](https://inflowapp.co.nz) — the SaaS spinoff of Treemarkables.

Lives as a sibling folder inside the Treemarkables monorepo for now. Built as a standalone Vite app so it can be lifted out into its own repo cleanly once the full Treemarkables/Inflow separation happens (post Apple iOS approval).

---

## Stack

- Vite + React 18 + TypeScript
- Tailwind CSS (no Shadcn — kept minimal so a future repo split is friction-free)
- [Wouter](https://github.com/molefrog/wouter) for routing (matches the main app)
- Inter Tight web font via [rsms.me/inter](https://rsms.me/inter/)

No backend. Marketing pages are static. The "Request access" form either:

1. POSTs to an HTTP endpoint configured via `VITE_REQUEST_ACCESS_ENDPOINT`, **or**
2. Falls back to opening the user's mail client with a pre-filled message to `hello@inflowapp.co.nz` if no endpoint is set.

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

## Wiring the request-access form

Two options:

### Option A — POST to a real endpoint (recommended once you have one)

1. Pick a destination. Easiest options:
   - A new `POST /api/inflow/request-access` route in the existing Treemarkables `server/routes.ts` (writes to a new `inflow_access_requests` table — needs schema migration approval).
   - A Cloud Function / Workers script that emails you.
   - A Formspree / Tally / Basin form (no backend code at all).
2. Set the endpoint in an env file:
   ```bash
   # inflow-site/.env.local
   VITE_REQUEST_ACCESS_ENDPOINT=https://api.example.com/inflow-access
   ```
3. The form posts JSON: `{ name, business, trade, crewSize, email, phone, tools, message }`.

### Option B — Mail client fallback (current default)

Do nothing. When `VITE_REQUEST_ACCESS_ENDPOINT` is unset, submitting the form opens the user's mail client pre-filled with the details, addressed to `hello@inflowapp.co.nz`. Good enough until you wire something up.

---

## Deployment plan (proposed — not yet executed)

Target: **separate DO Static Site** behind `inflowapp.co.nz`. The existing Treemarkables DO app (`plankton-app`) is untouched.

1. Create a new DO Static Site app pointing at this repo, with **Source Directory** `/inflow-site` and **Build Command** `npm run build`, **Output Directory** `dist`.
2. In Cloudflare DNS for `inflowapp.co.nz`, add an `ALIAS`/`CNAME` for `@` (apex) and `www` pointing at the DO Static Site's hostname. Keep grey-cloud (DNS-only) — matches the pattern from CLAUDE.md for `app.treemarkables.co.nz`.
3. Verify the DO app issues TLS for both `inflowapp.co.nz` and `www.inflowapp.co.nz`.
4. Set `VITE_REQUEST_ACCESS_ENDPOINT` in DO's env vars (if using Option A above).

DNS / DO actions happen through dashboards, not from this repo.

---

## Brand notes

- **Palette:** anchored to the existing Inflow iOS icon (`/public/inflow-icon-*.png`). Black `#0A0A0B` + lime `#C8FF3D`. Light canvas (`#FBFBF7` paper) so the marketing site reads SaaS, not tree-service.
- **Type:** Inter Tight (headings) + Inter (body) via rsms.me. Tight letter-spacing on display sizes.
- **Voice:** plain, trades-respecting, no jargon. "Built in a trades business, for trades businesses" — that's the angle.
- **Component density:** generous whitespace, large display type, restrained colour use. Lime is an accent (1 button per section max, plus the brand mark) — never a flood.

---

## What this site **isn't** (deliberately)

- Not the app — the actual product runs at `app.treemarkables.co.nz` (until separation completes).
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
