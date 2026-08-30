# Gisborne Park Golf Club — website

Standalone marketing site for Gisborne Park Golf Club (Cochrane Street, Elgin,
Gisborne). Built as a favour to the club; lives in this repo for now, structured
so it can be lifted into its own repo at any time (same pattern as
`inflow-site/` — see that directory's README for the `git subtree split`
recipe).

Stack: Vite 6 + React 18 + wouter + Tailwind 3.4 + TypeScript. No backend, no
forms: contact is phone and email only.

## Run it

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # tsc -b && vite build → dist/
```

## Before go-live (content TODOs)

1. **Pricing** — membership and green fees are placeholders. Enter real prices
   in `src/lib/course.ts` and flip `PRICING_CONFIRMED` to `true`.
2. **Email** — `src/lib/brand.ts` has a placeholder address; confirm the club's
   preferred public email.
3. **Domain** — `BRAND.domain` in `src/lib/brand.ts`, plus `index.html` meta,
   `public/robots.txt` and `public/sitemap.xml` all use the placeholder
   `gisbornepark.co.nz`.
4. **Photos** — all photography is Unsplash stand-in stock (verified URLs, one
   file: `src/lib/photos.ts`). Swap for the club's own shots. The clubhouse
   section on the home page is deliberately an empty frame awaiting a real
   photo.
5. **Crest** — the colour scheme is sampled from the club's royal-blue crest,
   and the header/footer mark is a simplified shield echo of it. Once a
   transparent-background version of the real crest lands in `public/`, swap
   the `<svg>` in `src/components/Wordmark.tsx` for it.
5. **Scorecard** — data in `src/lib/course.ts` came from Hole19 (white tees);
   have the club sight-check it against the printed card.

## Deploy

Same as inflow-site: a Cloudflare Pages project with root directory
`golf-site`, build command `npm run build`, output `dist`.
`public/_redirects` handles SPA hard refreshes.
