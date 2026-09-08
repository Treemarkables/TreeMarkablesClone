# Treemarkables marketing site

Static, crawlable HTML for **https://www.treemarkables.co.nz**.

This is not the Inflow app. It must not contain the Inflow name, logo, or PWA
manifest. The Inflow product lives at `https://app.inflowapp.co.nz`.

```
node generate.mjs    # rewrites HTML / sitemap / robots / _redirects
```

No npm install. Open `index.html` or serve the folder:

```
npx --yes serve -l 4174
```

See `DEPLOY.md` for the DigitalOcean host-split and the Cloudflare Pages split
that stops Inflow deploys from overwriting www.
