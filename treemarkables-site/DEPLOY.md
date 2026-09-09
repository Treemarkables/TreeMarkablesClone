# Deploy: Treemarkables marketing (`www.treemarkables.co.nz`)

www is **Treemarkables-only** marketing. The Inflow product stays on
`app.inflowapp.co.nz` (DigitalOcean App Platform). Inflow deploys must not be
able to overwrite this HTML.

The static files live in `treemarkables-site/` (sibling of `inflow-site/` and
`golf-site/`). They are crawlable HTML — not the Inflow React PWA.

There are two layers. Ship **both**. Layer A unblocks www on the current DNS
the moment this branch reaches `main`. Layer B is the split that stops the next
Inflow deploy from putting `client/index.html` (title: Inflow) back on www.

---

## Why www was broken

`www.treemarkables.co.nz` DNS still pointed at the same DigitalOcean app as the
Inflow product (`plankton-app`). That app serves `client/index.html`:

- `<title>Inflow</title>`
- Inflow meta description, apple-touch title, `/manifest.json`
- empty `#root` until React hydrates

Google therefore saw an Inflow PWA shell on the arborist domain. `robots.txt`
and `sitemap.xml` still listed Treemarkables routes. `/sitemap.xml` used
`res.sendFile` against `process.cwd()`, which 500s when cwd is `dist/`.

Do **not** “fix” this by editing `client/index.html`. That file is the Inflow
app shell.

---

## Layer A — same DigitalOcean app, host-split (ships with this PR)

`server/treemarkablesMarketing.ts` is registered first on the Express app.

| Host | Behaviour |
|---|---|
| `www.treemarkables.co.nz` | Static files from `treemarkables-site/`. App paths 301 to `https://app.inflowapp.co.nz{path}`. Sitemap/robots served from the site dir, with an in-memory fallback so they cannot 500. |
| `treemarkables.co.nz` (apex) | 301 to `https://www.treemarkables.co.nz{path}` |
| `app.inflowapp.co.nz`, `www.inflowapp.co.nz`, anything else | **Untouched.** Middleware calls `next()`. |

`/health`, `/api/*` and `/objects/*` still pass through on the Treemarkables
host so the quote form can POST `/api/contact` while www is still on this app.

**Redirect target:** live Inflow **app** is `app.inflowapp.co.nz` (Express,
`x-do-app-origin`). `www.inflowapp.co.nz` is the Inflow **marketing** Pages
site; sending `/login` or `/dispatch` there would 200 the Inflow brochure SPA.
Override with `TREEMARKABLES_APP_REDIRECT_ORIGIN` only if you later move the
product onto www.

After merge to `main`, DigitalOcean autodeploys. Then:

```bash
curl -sI -H 'Host: www.treemarkables.co.nz' https://plankton-app-9kv78.ondigitalocean.app/
# expect: text/html and Treemarkables title in the body

curl -s https://www.treemarkables.co.nz/ | grep -E '<title>|name="description"'
# Treemarkables | Arborist & Tree Care Gisborne

curl -sI https://www.treemarkables.co.nz/login
# 301 Location: https://app.inflowapp.co.nz/login

curl -sI https://www.treemarkables.co.nz/sitemap.xml
# 200 application/xml
```

Confirm `treemarkables-site/` is included in the DO build context (the app
already deploys the whole repo; `sitemap.xml` at repo root is the same pattern).

---

## Layer B — Cloudflare Pages split (stops Inflow deploys overwriting www)

Do this in the Cloudflare dashboard. It needs DNS access we do not have from
the repo.

1. **Workers & Pages → Create → Pages → Connect to Git**
   Repo `Treemarkables/TreeMarkablesClone`, production branch `main`.

2. **Build settings**

   | Field | Value |
   |---|---|
   | Framework preset | None |
   | Root directory (Advanced) | `treemarkables-site` |
   | Build command | `node generate.mjs` |
   | Build output directory | `/` (the `treemarkables-site` folder itself) |

   There is no `package.json` and no Vite. `generate.mjs` rewrites the HTML
   from the copy constants; the committed HTML is already valid if the build
   command is left blank.

3. **Custom domains:** add `www.treemarkables.co.nz` and `treemarkables.co.nz`.
   Because DNS is already on Cloudflare, Pages will create the records.

4. **Orange-cloud (proxied) is correct for Pages.** Grey-cloud is only required
   for the DigitalOcean *app* host (`app.inflowapp.co.nz` / the old
   `app.treemarkables.co.nz`) so Cloudflare does not double-proxy DO’s own
   edge. The Inflow marketing site on `inflowapp.co.nz` is already orange-cloud
   for the same reason.

5. **Apex:** Pages should 301 `treemarkables.co.nz` → `www.treemarkables.co.nz`
   (or use a Cloudflare Redirect Rule). The Express middleware does this too
   until DNS leaves DO.

6. **Leave Inflow DNS alone.**
   - `app.inflowapp.co.nz` → DigitalOcean (grey-cloud)
   - `www.inflowapp.co.nz` / `inflowapp.co.nz` → existing Inflow Pages project
     (`inflow-site/`). Do not point those at `treemarkables-site`.

7. **After www CNAME points at Pages**, DigitalOcean no longer receives
   Treemarkables marketing requests. Inflow autodeploys can change
   `client/index.html` as much as they like; www cannot see it.

8. **Quote form after the split:** the static form POSTs `/api/contact`. That
   path only exists on the DO app. Either:
   - keep a Cloudflare Worker / transform that proxies `www…/api/contact` to
     `https://app.inflowapp.co.nz/api/contact`, or
   - change `data-contact-api` in `generate.mjs` to the app URL.

   This PR already sends CORS headers on `/api/contact` when `Origin` is
   `https://www.treemarkables.co.nz` or `https://treemarkables.co.nz`, so a
   browser POST from Pages to the app is allowed. Phone (`027 216 6882`) stays
   the primary CTA either way.

---

## What not to do

- Do not point `www.treemarkables.co.nz` at the Inflow DO app as a long-term
  setup. Layer A is only the bridge.
- Do not add Treemarkables routes back into `client/src/App.tsx` as the www
  source of truth. Those React pages cannot put title/H1 in the first HTML
  byte.
- Do not serve `/manifest.json` or `/inflow-icon-*.png` on the Treemarkables
  host. The middleware 404s those names.
- Do not orange-cloud `app.inflowapp.co.nz`.
