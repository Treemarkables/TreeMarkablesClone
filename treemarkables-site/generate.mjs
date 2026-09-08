#!/usr/bin/env node
/**
 * Writes crawlable Treemarkables marketing HTML. No React, no empty #root.
 * Run from repo root or this folder: node generate.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = "https://www.treemarkables.co.nz";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const PHONE_DISPLAY = "027 216 6882";
const PHONE_TEL = "0272166882";
const EMAIL = "quotes@treemarkables.nz";
const ADDRESS = "213 Stanley Road, Awapuni, Gisborne 4010";
const YEAR = new Date().getFullYear();

const pages = [
  {
    slug: "",
    file: "index.html",
    title: "Treemarkables | Arborist & Tree Care Gisborne",
    h1: "Arborist & tree care in Gisborne",
    description:
      "Gisborne arborists for tree removal, pruning, stump grinding and hedge trimming. Tidy residential work, free quotes. Call Treemarkables 027 216 6882.",
    ogImage: "/images/team-photo.jpg",
    heroImage: "/images/team-photo.jpg",
    heroAlt: "Treemarkables arborist crew in Gisborne",
    lede: "Local arborists for tree removal, pruning, stump grinding and hedge trimming. Residential specialists who leave the site tidy. Free on-site quotes.",
    kind: "home",
  },
  {
    slug: "tree-removal",
    title: "Tree Removal Gisborne | Treemarkables Arborists",
    h1: "Tree removal in Gisborne",
    description:
      "Safe, professional tree removal in Gisborne and surrounds. Residential specialists who leave sites tidy. Free quotes from Treemarkables — call 027 216 6882.",
    ogImage: "/images/hazardous-tree-removal.jpg",
    heroImage: "/images/hazardous-tree-removal.jpg",
    heroAlt: "Hazardous tree removal in Gisborne",
    lede: "Controlled takedowns for hazardous, storm-damaged or unwanted trees — including tight-access residential sections. We quote on site and clean up properly.",
    kind: "service",
    serviceName: "Tree removal",
    points: [
      ["Any size, the right gear", "Climbing crews, a 16-metre bucket truck, chippers and traffic control when the job needs it."],
      ["Residential specialists", "Tight sections, powerlines and neighbours considered before a single cut."],
      ["Tidy finish", "Wood chipped or removed, lawns raked and blown. Stump grinding quoted if you want the ground back."],
    ],
    faqs: [
      ["How much does tree removal cost in Gisborne?", "It depends on size, lean, access and whether stump grinding is included. You get a clear, itemised quote before we start — no surprises."],
      ["Do you handle storm damage?", "Yes. Call 027 216 6882 any time a tree is down or threatening a house, fence or powerline."],
      ["Do I need council permission?", "Sometimes. Gisborne District Council protects some notable and heritage trees. We help you check before work is planned."],
    ],
  },
  {
    slug: "tree-pruning",
    title: "Tree Pruning Gisborne | Treemarkables Tree Care",
    h1: "Tree pruning in Gisborne",
    description:
      "Expert tree pruning in Gisborne for healthier canopies, more light and safer gardens. Local arborists, free on-site quotes. Call Treemarkables 027 216 6882.",
    ogImage: "/images/cta-drone.jpg",
    heroImage: "/images/cta-drone.jpg",
    heroAlt: "Arborist pruning a tree canopy in Gisborne",
    lede: "Structural pruning, crown thinning, deadwooding and reductions — so trees stay healthy, let light through and sit safely around homes and coastal wind.",
    kind: "service",
    serviceName: "Tree pruning",
    points: [
      ["Healthier structure", "Young trees shaped early; mature trees thinned and cleaned so they last."],
      ["More light, less risk", "Selective cuts reduce sail in the wind and open gardens without butchering the tree."],
      ["Local coastal knowledge", "Salt, northerlies and clay soils are part of how we plan a prune in Tairāwhiti."],
    ],
    faqs: [
      ["When is the best time to prune?", "Deadwood can come off year-round. Structural work is planned around species and flowering. We advise on site."],
      ["Will pruning hurt the tree?", "Correct cuts at the branch collar heal cleanly. Topping or hacking does the damage — we do not do that."],
      ["Do you prune near powerlines?", "We work around lines with the right gear and will tell you if a lines company needs to be involved."],
    ],
  },
  {
    slug: "gisborne-arborist",
    title: "Gisborne Arborist | Treemarkables Tree Care",
    h1: "Gisborne arborist you can call",
    description:
      "Looking for a Gisborne arborist? Treemarkables handles removal, pruning, stump grinding and hedges. Local crew, tidy work. Call 027 216 6882 for a free quote.",
    ogImage: "/images/hazardous-tree-gisborne.jpg",
    heroImage: "/images/hazardous-tree-gisborne.jpg",
    heroAlt: "Gisborne arborist assessing a tree",
    lede: "A Gisborne-owned crew for residential tree work across the city, Wainui, Kaiti and the wider East Coast. Qualified, insured, and used to leaving lawns usable the same day.",
    kind: "service",
    serviceName: "Arborist services",
    points: [
      ["One local crew", "Removal, pruning, stumps and hedges — you are not bounced between subcontractors."],
      ["On-site quotes", "We walk the section. Photos help, but price and method come from seeing access and targets."],
      ["Accountable work", "Eighteen-plus years in Gisborne. You will see the same people again."],
    ],
    faqs: [
      ["Are you qualified and insured?", "Yes — recognised arboricultural qualifications and public liability cover. A certificate of currency is available on request."],
      ["What areas do you cover?", "Gisborne city and suburbs, Wainui, Makaraka, Ormond, Wairoa and the wider East Coast by arrangement."],
      ["How fast can you quote?", "Most residential jobs are quoted on a site visit. Call 027 216 6882 and we will lock a time."],
    ],
  },
  {
    slug: "stump-grinding",
    title: "Stump Grinding Gisborne | Treemarkables",
    h1: "Stump grinding in Gisborne",
    description:
      "Stump grinding in Gisborne after tree removal — clear stumps and reclaim lawn or garden beds. Fast, tidy finish. Call Treemarkables on 027 216 6882 for a quote.",
    ogImage: "/images/stump-grinding.jpg",
    heroImage: "/images/stump-grinding.jpg",
    heroAlt: "Stump grinding after tree removal in Gisborne",
    lede: "Grind the stump below the surface after a removal — or book grinding on an old stump that has been in the way for years. Reclaim lawn, garden beds or a building platform.",
    kind: "service",
    serviceName: "Stump grinding",
    points: [
      ["Below grade", "Stump and surface roots ground out so you can turf, plant or pave over the spot."],
      ["With removal or standalone", "Add grinding to a removal quote, or call us just for leftover stumps."],
      ["Tidy chips", "Grindings can stay as mulch or be removed — your choice on the quote."],
    ],
    faqs: [
      ["How deep do you grind?", "Typically below lawn level so the area can be filled and grassed. Deeper work is quoted if you are building or planting trees."],
      ["Can you grind next to fences or slabs?", "Usually yes, with care around services. We check for irrigation, power and soak holes first."],
      ["Is it included with tree removal?", "Only if you ask. We quote removal with or without grinding so the price is honest."],
    ],
  },
  {
    slug: "hedge-trimming",
    title: "Hedge Trimming Gisborne | Treemarkables",
    h1: "Hedge trimming in Gisborne",
    description:
      "Professional hedge trimming in Gisborne for neat boundaries and tidy gardens. Residential specialists, free quotes. Call Treemarkables today on 027 216 6882.",
    ogImage: "/images/hedge-trimming.jpg",
    heroImage: "/images/hedge-trimming.jpg",
    heroAlt: "Freshly trimmed residential hedge in Gisborne",
    lede: "Boundary hedges, privacy screens and garden hedges cut clean and even — including taller work from the bucket truck when ladders are the wrong tool.",
    kind: "service",
    serviceName: "Hedge trimming",
    points: [
      ["Neat boundaries", "Level tops and tight faces so the street frontage and neighbour line look finished."],
      ["Height we can reach", "Tall photinia, laurel and native screens are everyday work, not a special trip."],
      ["Green waste gone", "Clippings chipped or taken unless you want them left as mulch."],
    ],
    faqs: [
      ["How often should a hedge be trimmed?", "Most formal hedges in Gisborne want one or two cuts a year. We will say what yours needs after a look."],
      ["Do you reduce overgrown hedges?", "Yes, in stages if the species will brown out from a hard cut. We will be straight about what will look good."],
      ["Can you do a one-off tidy before a sale or event?", "Yes — call and we will fit a residential tidy-up as soon as we can."],
    ],
  },
  {
    slug: "contact",
    title: "Contact Treemarkables | Gisborne Arborists",
    h1: "Contact Treemarkables",
    description:
      "Call Treemarkables on 027 216 6882 for a free tree-care quote in Gisborne. 213 Stanley Road, Awapuni, Gisborne 4010.",
    ogImage: "/images/team-photo.jpg",
    heroImage: "/images/team-photo.jpg",
    heroAlt: "Treemarkables team",
    lede: "Free on-site quotes for residential tree work in Gisborne and surrounds. Phone is the fastest way to get us on site.",
    kind: "contact",
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy | Treemarkables",
    h1: "Privacy policy",
    description: "How Treemarkables collects and looks after personal information under the New Zealand Privacy Act 2020.",
    ogImage: "/images/team-photo.jpg",
    heroImage: "/images/team-photo.jpg",
    heroAlt: "Treemarkables",
    lede: "Treemarkables LTD follows the New Zealand Privacy Act 2020. This page explains what we collect and why.",
    kind: "privacy",
  },
];

const servicesNav = [
  ["/tree-removal", "Tree removal"],
  ["/tree-pruning", "Tree pruning"],
  ["/gisborne-arborist", "Gisborne arborist"],
  ["/stump-grinding", "Stump grinding"],
  ["/hedge-trimming", "Hedge trimming"],
];

function jsonLd(page) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
        "@id": `${ORIGIN}/#business`,
        name: "Treemarkables",
        alternateName: "Treemarkables Arborists",
        description:
          "Gisborne arborists for tree removal, pruning, stump grinding and hedge trimming.",
        url: ORIGIN,
        telephone: "+64272166882",
        email: EMAIL,
        image: `${ORIGIN}/images/team-photo.jpg`,
        logo: `${ORIGIN}/images/logo.png`,
        priceRange: "$$",
        address: {
          "@type": "PostalAddress",
          streetAddress: "213 Stanley Road",
          addressLocality: "Awapuni",
          addressRegion: "Gisborne",
          postalCode: "4010",
          addressCountry: "NZ",
        },
        geo: { "@type": "GeoCoordinates", latitude: -38.6623, longitude: 178.0176 },
        areaServed: ["Gisborne", "Tairāwhiti", "Wairoa", "East Coast"],
        knowsAbout: ["Arborist", "Tree care", "Tree removal", "Tree pruning", "Stump grinding", "Hedge trimming"],
        openingHoursSpecification: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          opens: "07:00",
          closes: "18:00",
        },
      },
      {
        "@type": "WebPage",
        "@id": `${ORIGIN}${page.slug ? `/${page.slug}` : "/"}#page`,
        url: `${ORIGIN}${page.slug ? `/${page.slug}` : "/"}`,
        name: page.title,
        description: page.description,
        isPartOf: { "@type": "WebSite", name: "Treemarkables", url: ORIGIN },
        about: { "@id": `${ORIGIN}/#business` },
      },
    ],
  };
}

function quoteForm() {
  return `
<form class="quote" id="quote-form" action="/api/contact" method="post" data-contact-api="/api/contact">
  <label>Name
    <input name="name" required maxlength="255" autocomplete="name">
  </label>
  <label>Email
    <input name="email" type="email" required maxlength="255" autocomplete="email">
  </label>
  <label>Phone
    <input name="phone" type="tel" maxlength="50" autocomplete="tel" inputmode="tel">
  </label>
  <label>How did you hear about us?
    <select name="hearAbout">
      <option value="">Select</option>
      <option>Google</option>
      <option>Facebook</option>
      <option>Word of mouth/Referral</option>
      <option>Previous customer</option>
      <option>Local advertising</option>
      <option>Other</option>
    </select>
  </label>
  <label>Message
    <textarea name="message" required maxlength="5000" rows="5" placeholder="What needs doing, and your site address."></textarea>
  </label>
  <label class="hp" aria-hidden="true">Website
    <input name="website" tabindex="-1" autocomplete="off">
  </label>
  <button class="btn btn-neon" type="submit">Request a free quote</button>
  <p class="form-status" id="quote-status" role="status"></p>
  <p>Prefer to talk? Call <a href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a>.</p>
</form>`;
}

function header(active) {
  const links = [
    ["/", "Home"],
    ...servicesNav,
    ["/contact", "Contact"],
  ]
    .map(([href, label]) => `<a href="${href}"${href === active ? ' aria-current="page"' : ""}>${label}</a>`)
    .join("");
  return `
<header class="site-header">
  <div class="header-row">
    <a href="/" aria-label="Treemarkables home"><img class="logo" src="/images/logo.png" alt="Treemarkables"></a>
    <nav class="nav-desktop" aria-label="Primary">${links}</nav>
    <div class="header-actions">
      <a class="btn btn-neon" href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" data-menu-toggle>Menu</button>
    </div>
  </div>
  <nav class="nav-mobile" id="mobile-nav">${links}</nav>
</header>`;
}

function footer() {
  return `
<footer class="site-footer">
  <div class="footer-grid">
    <div>
      <img src="/images/logo.png" alt="Treemarkables" style="height:4.5rem;width:auto;margin-bottom:0.75rem">
      <p class="nap">${ADDRESS}<br>
      <a href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a><br>
      <a href="${ORIGIN}">${ORIGIN}</a></p>
    </div>
    <div>
      <h2>Services</h2>
      <ul>${servicesNav.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("")}</ul>
    </div>
    <div>
      <h2>Get in touch</h2>
      <ul>
        <li><a href="mailto:${EMAIL}">${EMAIL}</a></li>
        <li><a href="/contact">Contact &amp; quotes</a></li>
        <li><a href="/privacy-policy">Privacy policy</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© ${YEAR} Treemarkables. All rights reserved.</span>
    <span class="nap">${ADDRESS} · ${PHONE_DISPLAY} · ${ORIGIN}</span>
  </div>
</footer>`;
}

function homeBody(page) {
  return `
<section class="hero">
  <img class="hero-bg" src="${page.heroImage}" alt="${page.heroAlt}">
  <div class="hero-shade"></div>
  <div class="hero-inner">
    <p class="eyebrow">Gisborne · Tairāwhiti</p>
    <h1>${escapeHtml(page.h1)}</h1>
    <p class="lede">${escapeHtml(page.lede)}</p>
    <div class="cta-row">
      <a class="btn btn-neon" href="/contact">Get a free quote</a>
      <a class="btn btn-ghost" href="tel:${PHONE_TEL}">Call ${PHONE_DISPLAY}</a>
    </div>
  </div>
</section>
<section class="section muted-band">
  <div class="wrap">
    <h2>Tree care services</h2>
    <div class="grid-3">
      <article class="card"><h3><a class="service-link" href="/tree-removal">Tree removal</a></h3><p>Safe, controlled removals for hazardous and unwanted trees. Sites left tidy.</p></article>
      <article class="card"><h3><a class="service-link" href="/tree-pruning">Tree pruning</a></h3><p>Healthier canopies, more light and safer gardens — pruned properly, not topped.</p></article>
      <article class="card"><h3><a class="service-link" href="/stump-grinding">Stump grinding</a></h3><p>Clear the stump after removal and reclaim lawn or garden beds.</p></article>
      <article class="card"><h3><a class="service-link" href="/hedge-trimming">Hedge trimming</a></h3><p>Neat boundaries and privacy screens, including tall residential hedges.</p></article>
      <article class="card"><h3><a class="service-link" href="/gisborne-arborist">Gisborne arborist</a></h3><p>A local crew you can call for the full range of residential tree work.</p></article>
      <article class="card"><h3>Free quotes</h3><p>We visit the property, talk through the job and price it in person. Call ${PHONE_DISPLAY}.</p></article>
    </div>
  </div>
</section>
<section class="section" id="contact">
  <div class="wrap grid-2">
    <div>
      <h2>Request a free quote</h2>
      <p>Tell us the address and what you need done. We will call you back to book a site visit.</p>
      <p class="nap">${ADDRESS}<br><a href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a></p>
    </div>
    ${quoteForm()}
  </div>
</section>`;
}

function serviceBody(page) {
  const points = page.points
    .map(([title, body]) => `<article class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></article>`)
    .join("");
  const faqs = page.faqs
    .map(([q, a]) => `<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`)
    .join("");
  return `
<section class="hero">
  <img class="hero-bg" src="${page.heroImage}" alt="${page.heroAlt}">
  <div class="hero-shade"></div>
  <div class="hero-inner">
    <p class="eyebrow">Treemarkables · Gisborne</p>
    <h1>${escapeHtml(page.h1)}</h1>
    <p class="lede">${escapeHtml(page.lede)}</p>
    <div class="cta-row">
      <a class="btn btn-neon" href="/contact">Get a free quote</a>
      <a class="btn btn-ghost" href="tel:${PHONE_TEL}">Call ${PHONE_DISPLAY}</a>
    </div>
  </div>
</section>
<section class="section">
  <div class="wrap grid-3">${points}</div>
</section>
<section class="section muted-band">
  <div class="wrap faq">
    <h2>${page.serviceName} questions</h2>
    ${faqs}
  </div>
</section>
<section class="section" id="contact">
  <div class="wrap grid-2">
    <div>
      <h2>Free on-site quote</h2>
      <p>Call ${PHONE_DISPLAY} or send the form. We work across Gisborne and the East Coast.</p>
    </div>
    ${quoteForm()}
  </div>
</section>`;
}

function contactBody(page) {
  return `
<section class="hero">
  <img class="hero-bg" src="${page.heroImage}" alt="${page.heroAlt}">
  <div class="hero-shade"></div>
  <div class="hero-inner">
    <p class="eyebrow">Quotes &amp; bookings</p>
    <h1>${escapeHtml(page.h1)}</h1>
    <p class="lede">${escapeHtml(page.lede)}</p>
    <div class="cta-row">
      <a class="btn btn-neon" href="tel:${PHONE_TEL}">Call ${PHONE_DISPLAY}</a>
      <a class="btn btn-ghost" href="mailto:${EMAIL}">Email ${EMAIL}</a>
    </div>
  </div>
</section>
<section class="section">
  <div class="wrap grid-2">
    <div>
      <h2>Visit or call</h2>
      <p class="nap">${ADDRESS}</p>
      <p><a href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a><br>
      <a href="mailto:${EMAIL}">${EMAIL}</a><br>
      <a href="${ORIGIN}">${ORIGIN}</a></p>
      <p>Customers call ${PHONE_DISPLAY} directly. We will come to you for a free quote.</p>
    </div>
    ${quoteForm()}
  </div>
</section>`;
}

function privacyBody(page) {
  return `
<section class="section">
  <div class="wrap" style="max-width:46rem">
    <h1>${escapeHtml(page.h1)}</h1>
    <p>Effective 11 February 2026. Treemarkables LTD (“we”) is based at ${ADDRESS}.</p>
    <h2>Information we collect</h2>
    <p>When you request a quote or contact us we may collect your name, email, phone number, service address and the details of the job. The site also records standard technical data such as IP address and pages viewed.</p>
    <h2>How we use it</h2>
    <p>We use this information to quote and deliver tree-care work, to call or email you back, and to meet legal obligations. We do not sell personal information.</p>
    <h2>Your rights</h2>
    <p>Under the Privacy Act 2020 you can ask to access or correct your information, or to have it deleted where we are not required to keep it. Email <a href="mailto:${EMAIL}">${EMAIL}</a> or write to us at the address above.</p>
  </div>
</section>`;
}

function pageScript() {
  return `
<script>
(function () {
  var toggle = document.querySelector("[data-menu-toggle]");
  var nav = document.getElementById("mobile-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  var form = document.getElementById("quote-form");
  if (!form) return;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var status = document.getElementById("quote-status");
    var endpoint = form.getAttribute("data-contact-api") || "/api/contact";
    var payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      hearAbout: form.hearAbout.value,
      message: form.message.value.trim(),
      website: form.website.value
    };
    status.textContent = "Sending…";
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
      .then(function (result) {
        if (result.res.ok && result.data && result.data.success !== false) {
          status.textContent = "Thanks — we will call you back about a free quote.";
          form.reset();
          return;
        }
        status.textContent = (result.data && result.data.message) || "Please call ${PHONE_DISPLAY}.";
      })
      .catch(function () {
        status.textContent = "Please call ${PHONE_DISPLAY} or email ${EMAIL}.";
      });
  });
})();
</script>`;
}

function render(page) {
  const canonical = `${ORIGIN}${page.slug ? `/${page.slug}` : "/"}`;
  const active = page.slug ? `/${page.slug}` : "/";
  const body =
    page.kind === "home"
      ? homeBody(page)
      : page.kind === "service"
        ? serviceBody(page)
        : page.kind === "contact"
          ? contactBody(page)
          : privacyBody(page);

  return `<!DOCTYPE html>
<html lang="en-NZ">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="index, follow">
  <meta name="author" content="Treemarkables">
  <meta name="geo.region" content="NZ-GIS">
  <meta name="geo.placename" content="Gisborne">
  <meta name="geo.position" content="-38.6623;178.0176">
  <meta name="ICBM" content="-38.6623, 178.0176">
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/png" href="/treemarkables-icon-black.png">
  <link rel="apple-touch-icon" href="/treemarkables-logo-green-180.png">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Treemarkables">
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ORIGIN}${page.ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="en_NZ">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(page.title)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <meta name="twitter:image" content="${ORIGIN}${page.ogImage}">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap">
  <link rel="stylesheet" href="/css/site.css">
  <script type="application/ld+json">${JSON.stringify(jsonLd(page))}</script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-VK3PPB6SFW"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-VK3PPB6SFW');</script>
</head>
<body>
  <a class="skip-link" href="#content">Skip to content</a>
  ${header(active)}
  <main id="content">
    ${body}
  </main>
  ${footer()}
  ${pageScript()}
</body>
</html>
`;
}

function write404() {
  return `<!DOCTYPE html>
<html lang="en-NZ">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found | Treemarkables</title>
  <meta name="description" content="That page is not on the Treemarkables website.">
  <meta name="robots" content="noindex">
  <link rel="icon" type="image/png" href="/treemarkables-icon-black.png">
  <link rel="stylesheet" href="/css/site.css">
</head>
<body>
  ${header("/")}
  <main id="content" class="section">
    <div class="wrap">
      <h1>Page not found</h1>
      <p>Try the <a href="/">Treemarkables home page</a> or call <a href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a>.</p>
    </div>
  </main>
  ${footer()}
</body>
</html>
`;
}

const sitemapUrls = [
  ["/", "1.0", "weekly"],
  ["/tree-removal", "0.9", "monthly"],
  ["/tree-pruning", "0.9", "monthly"],
  ["/gisborne-arborist", "0.9", "monthly"],
  ["/stump-grinding", "0.9", "monthly"],
  ["/hedge-trimming", "0.9", "monthly"],
  ["/contact", "0.6", "monthly"],
  ["/privacy-policy", "0.3", "yearly"],
];

const lastmod = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    ([loc, priority, changefreq]) => `  <url>
    <loc>${ORIGIN}${loc === "/" ? "/" : loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /
Allow: /tree-removal
Allow: /tree-pruning
Allow: /gisborne-arborist
Allow: /stump-grinding
Allow: /hedge-trimming
Allow: /contact
Allow: /privacy-policy
Allow: /sitemap.xml
Disallow: /api/
Disallow: /login
Disallow: /dispatch
Disallow: /diary

Sitemap: ${ORIGIN}/sitemap.xml
`;

const appRedirects = [
  "/login",
  "/signup",
  "/dispatch",
  "/dispatch-board",
  "/diary",
  "/dashboard",
  "/today",
  "/job-dashboard",
  "/metrics",
  "/settings",
  "/calendar",
  "/inbox",
  "/clients",
  "/invoices",
  "/proposal",
  "/quote",
  "/invoice",
  "/watch",
  "/review",
  "/customer-portal",
  "/safety",
  "/equipment",
  "/staff-schedule",
  "/mulch-drops",
  "/history",
  "/opportunities",
  "/reputation",
  "/reviews",
  "/marketing",
  "/help",
  "/developer",
];

const redirects = [
  "/home / 301",
  "/blog / 301",
  "/blog/* / 301",
  "/summer-offer / 301",
  "/mulch /contact 301",
  "/mulch/thanks /contact 301",
  ...appRedirects.map((p) => `${p} https://app.inflowapp.co.nz${p} 301`),
  ...appRedirects.map((p) => `${p}/* https://app.inflowapp.co.nz${p}/:splat 301`),
].join("\n");

for (const page of pages) {
  const html = render(page);
  if (!page.slug) {
    fs.writeFileSync(path.join(root, "index.html"), html);
  } else {
    const dir = path.join(root, page.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
  }
}

fs.writeFileSync(path.join(root, "404.html"), write404());
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(root, "robots.txt"), robots);
fs.writeFileSync(path.join(root, "_redirects"), redirects + "\n");
fs.writeFileSync(
  path.join(root, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/sitemap.xml
  Content-Type: application/xml; charset=utf-8

/robots.txt
  Content-Type: text/plain; charset=utf-8
`,
);

console.log("Wrote Treemarkables marketing HTML to", root);
