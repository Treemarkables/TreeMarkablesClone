# Deploying the Inflow marketing site → inflowapp.co.nz

Static Vite/React SPA, hosted on **Cloudflare Pages**, auto-deploying from `main`.
The code lives in the `inflow-site/` subdirectory of the TreeMarkablesClone monorepo.

> Steps marked **[dashboard]** must be done by a human in the Cloudflare dashboard —
> they need account + DNS access that isn't available from the codebase.

## One-time setup

1. **[dashboard]** Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
   Pick the `Treemarkables/TreeMarkablesClone` repo, production branch `main`.

2. **[dashboard]** Build settings:
   | Field | Value |
   |---|---|
   | Framework preset | Vite |
   | **Root directory** (Advanced) | `inflow-site` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

   Root directory = `inflow-site` is the key bit — it tells Pages to build only this
   subfolder, not the whole monorepo. Output `dist` is relative to that root
   (i.e. `inflow-site/dist`).

3. **[dashboard]** Environment variables (optional):
   - `VITE_REQUEST_ACCESS_ENDPOINT` — POST endpoint for the "Request access" form.
     If unset, the form falls back to its no-endpoint behaviour (see `RequestAccessForm.tsx`).

4. **[dashboard]** Custom domain: Pages project → **Custom domains → Set up a domain** →
   add `inflowapp.co.nz` and `www.inflowapp.co.nz`. Because DNS is already on Cloudflare,
   it auto-creates the CNAME records. Leave them **proxied (orange-cloud)** — unlike the
   main Treemarkables app (which must stay grey-cloud through DO), a Pages site is served
   by Cloudflare directly, so proxied is correct here.

## How it works after setup

- Every push to `main` that touches `inflow-site/` triggers a Pages build + deploy.
- `public/_redirects` (`/* /index.html 200`) gives the wouter SPA its fallback so
  `/pricing`, `/features`, `/about`, `/contact` resolve on hard refresh / direct link.
- Preview deployments are created automatically for PRs.

## Local verification before relying on a deploy

```bash
cd inflow-site
npm install
npm run build      # tsc -b && vite build — must pass clean
npm run preview    # serves dist at http://localhost:4173
```
