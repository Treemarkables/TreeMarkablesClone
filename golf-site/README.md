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
4. **Photos** — the club's own shots (green, gazebo, golfers, clubhouse) live
   in `public/photos/` and are wired up via `src/lib/photos.ts`. The dusk
   hero, course-page hero, events hero and twilight shots are still verified
   Unsplash stand-ins — swap them in the same file when the club has
   equivalents (a wide, high-res hero shot is the one most worth chasing).
5. **Crest** — the real crest is in as `public/crest.png` (navy on
   transparent) and `public/crest-light.png` (cream, for dark bands), both
   generated from the club's artwork; the colour scheme is sampled from it.
5. **Scorecard** — data in `src/lib/course.ts` came from Hole19 (white tees);
   have the club sight-check it against the printed card.

## Deploy

Same as inflow-site: a Cloudflare Pages project with root directory
`golf-site`, build command `npm run build`, output `dist`.
`public/_redirects` handles SPA hard refreshes.
