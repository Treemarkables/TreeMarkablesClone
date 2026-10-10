/**
 * First-byte HTML for public Treemarkables marketing routes.
 *
 * The React app still paints the designed page after load. This snapshot is
 * what a crawler (and a browser before JavaScript) receives: a real H1, the
 * page copy, phone, yard address, internal links and a quote CTA. It sits
 * outside #root so React does not wipe it during the auth check, and it is
 * removed once the real page paints. Injected only on www / the apex, and
 * only for marketing paths — /dispatch, /login and the staff app keep the
 * Inflow shell.
 *
 * aggregateRating is intentionally absent. The site shows reviews, but
 * self-serving rating markup can be penalised. Follow-up, not this change.
 */
import { isTreemarkablesPublicPath, normalisePublicPath } from "@shared/treemarkablesMarketingPaths";

const ORIGIN = "https://www.treemarkables.co.nz";
const PHONE_DISPLAY = "027 216 6882";
const PHONE_TEL = "+64272166882";
const PHONE_SCHEMA = "+64 27 216 6882";
const ADDRESS_LINE = "213 Stanley Road, Awapuni, Gisborne 4010, New Zealand";

const NAV: Array<[string, string]> = [
  ["/", "Home"],
  ["/tree-removal", "Tree removal"],
  ["/tree-pruning", "Tree pruning"],
  ["/stump-grinding", "Stump grinding"],
  ["/hedge-trimming", "Hedge trimming"],
  ["/summer-offer", "Summer offer"],
  ["/blog", "Blog"],
  ["/contact", "Contact"],
];

interface PageCopy {
  h1: string;
  lede: string;
  extra?: string;
}

const HAZARD_SLUG = "hazardous-tree-removal-gisborne-5-signs-dangerous-tree";
const PRUNING_SLUG = "why-regular-tree-pruning-protects-your-home-gisborne";

const PAGES: Record<string, PageCopy> = {
  "/": {
    h1: "Tree care done once, done right.",
    lede:
      "Gisborne's trusted arborists for safe tree removals, expert pruning and tidy clean-ups — backed by 18+ years and 130+ five-star reviews. We work across Gisborne, Tairāwhiti, Wairoa and the East Coast.",
    extra: `
      <h2>Full-service tree care across Tairāwhiti</h2>
      <ul>
        <li><a href="/tree-removal">Tree removal</a> — safe, controlled removals, from hazardous trees to tight-access sections. 24/7 emergency callouts.</li>
        <li><a href="/tree-pruning">Tree pruning</a> — healthier structure, better light, and a tidier canopy.</li>
        <li><a href="/stump-grinding">Stump grinding</a> — ground out below the surface so you can reclaim the space.</li>
        <li><a href="/hedge-trimming">Hedge trimming</a> — crisp, healthy hedges shaped to last.</li>
      </ul>
      <p>Free, no-obligation quotes. We visit, assess the job in person, and leave a clear itemised price before any work begins. Fully insured.</p>
    `,
  },
  "/tree-removal": {
    h1: "Get that risky tree down — safely.",
    lede:
      "Gisborne's certified arborists for hazardous, storm-damaged and unwanted trees. Fully insured, fast response, and not a branch left behind. Homes and farms across Gisborne, Wairoa and the East Coast.",
    extra: `
      <p>We remove trees close to houses, powerlines and tight driveways, and we respond to storm damage day or night. You'll get a clear quote before we start, and the site is raked and blown down when we leave.</p>
      <p>See also <a href="/tree-pruning">tree pruning</a>, <a href="/stump-grinding">stump grinding</a> and <a href="/hedge-trimming">hedge trimming</a>.</p>
    `,
  },
  "/tree-pruning": {
    h1: "Pruned right, growing strong.",
    lede:
      "Expert pruning to keep your trees healthy, safe and beautifully shaped — qualified arborists across Gisborne and the East Coast.",
    extra: `
      <p>We prune to preserve the tree. Crown reduction, shaping and deadwood removal keep weight off roofs and let light and air through the canopy. Removal only if it is truly needed.</p>
      <p>See also <a href="/tree-removal">tree removal</a>, <a href="/stump-grinding">stump grinding</a> and our <a href="/blog/why-regular-tree-pruning-protects-your-home-gisborne">guide to regular pruning</a>.</p>
    `,
  },
  "/stump-grinding": {
    h1: "Stumps gone. Ground flush.",
    lede:
      "Remove unsightly stumps safely and fast. Two grinders — a narrow-access machine for tight spots and the biggest in Gisborne for the heavy stuff.",
    extra: `
      <p>We grind stumps below the surface for homes, lifestyle blocks and rural properties around Gisborne and Wairoa. The chips can stay as mulch or be taken away.</p>
      <p>See also <a href="/tree-removal">tree removal</a> and <a href="/hedge-trimming">hedge trimming</a>.</p>
    `,
  },
  "/hedge-trimming": {
    h1: "Sharp hedges, zero fuss.",
    lede:
      "Privacy, windbreaks and clean lines — kept in shape year-round. Gisborne's coastal winds grow hedges fast; we keep them tidy.",
    extra: `
      <p>We trim, shape and maintain hedges for homes and coastal properties in Gisborne and surrounding areas. Big or small.</p>
      <p>See also <a href="/tree-pruning">tree pruning</a> and <a href="/tree-removal">tree removal</a>.</p>
    `,
  },
  "/summer-offer": {
    h1: "Road to Summer: win up to $1000 back on your tree care",
    lede:
      "Book any tree care service before November 30th and stand a 1-in-90 chance to win up to $1000 off your job. Our way of saying thanks to our Gisborne community.",
    extra: `
      <p>The offer covers tree removal, pruning, stump grinding, hedge trimming and emergency callouts with Treemarkables in Gisborne and the surrounding East Coast.</p>
      <p><a href="/contact">Book now and enter</a> or call ${PHONE_DISPLAY}.</p>
    `,
  },
  "/blog": {
    h1: "Tree Care Insights",
    lede:
      "Expert advice and tips from Gisborne's professional arborists. Learn how to keep your trees healthy and your property safe.",
    extra: `
      <article>
        <h2><a href="/blog/${HAZARD_SLUG}">5 Signs Your Tree Is a Hazard and Needs Removing</a></h2>
        <p>Worried a tree on your Gisborne property is a hazard? Learn 5 critical signs of a dangerous tree, from dead branches to root decay. Contact Treemarkables for a free assessment.</p>
      </article>
      <article>
        <h2><a href="/blog/${PRUNING_SLUG}">Why Regular Tree Pruning Protects Your Home in Gisborne</a></h2>
        <p>Gisborne's mild climate and coastal winds create conditions where branches can grow quickly and pose risks to homes. Learn why regular pruning is essential preventive maintenance.</p>
      </article>
    `,
  },
  "/contact": {
    h1: "Get in Touch",
    lede:
      "Ready to transform your outdoor space? Contact our qualified arborists for a free, no-obligation quote. We usually come back within 24 hours.",
    extra: `
      <p>Phone <a href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a>. Email <a href="mailto:quotes@treemarkables.nz">quotes@treemarkables.nz</a>.</p>
      <p>Yard: ${ADDRESS_LINE}. We serve Gisborne, Tairāwhiti, Wairoa and the East Coast.</p>
      <ul>
        <li><a href="/tree-removal">Tree removal</a></li>
        <li><a href="/tree-pruning">Tree pruning</a></li>
        <li><a href="/stump-grinding">Stump grinding</a></li>
        <li><a href="/hedge-trimming">Hedge trimming</a></li>
      </ul>
    `,
  },
  "/privacy-policy": {
    h1: "Privacy Policy",
    lede:
      "Treemarkables LTD is committed to protecting your privacy in accordance with the New Zealand Privacy Act 2020. This policy explains how we collect, use, disclose and safeguard your information when you visit our website or ask for a quote. Effective date: 11 February 2026.",
    extra: `
      <h2>Information we collect</h2>
      <p>We may collect your name, email address, phone number, billing and shipping address, payment details processed by our payment provider, and anything you send us through a form. We also collect technical data such as IP address, browser type and the pages you visit.</p>
      <h2>Contact us</h2>
      <p>Treemarkables LTD, ${ADDRESS_LINE}. Email <a href="mailto:quotes@treemarkables.nz">quotes@treemarkables.nz</a>. Phone <a href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a>.</p>
    `,
  },
  [`/blog/${HAZARD_SLUG}`]: {
    h1: "5 Signs Your Tree Is a Hazard and Needs Removing",
    lede:
      "Worried a tree on your Gisborne property is a hazard? These five signs — dead branches, trunk damage, leaning and root problems, included bark, and proximity to a target — mean it is time for a professional look.",
    extra: `
      <p>As a homeowner in Gisborne, your trees are a valuable asset. A hazardous tree has structural defects that make it likely to fail, posing a risk to people or property. Recognising the warning signs early matters. Ignoring them can damage a home or vehicle, or injure someone.</p>
      <h2>1. Large, dead or hanging branches (widow-makers)</h2>
      <p>Dead branches that stay attached can fall without warning, with or without wind. Look for branches with no leaves in the growing season, missing bark, or heavy limbs that are cracked. That is a job for a qualified arborist, not a ladder.</p>
      <h2>2. Trunk damage and cavities</h2>
      <p>Deep cracks, splits or hollows let rot into the core. If more than about 30% of the trunk is damaged or hollow, treat the tree as a significant hazard and get it assessed.</p>
      <h2>3. Leaning and root problems</h2>
      <p>A new lean, heaving soil, exposed roots on the opposite side, or fungi at the base can mean the roots are failing. Saturated ground after heavy rain makes this more dangerous. A tree with compromised roots can fall without further warning.</p>
      <h2>4. Included bark at branch unions</h2>
      <p>Bark trapped in a tight V-shaped fork does not form a strong wood union. The crotch can look solid and still split, often in summer storms or under a heavy canopy. A wide U-shaped union is the stronger shape.</p>
      <h2>5. Proximity to targets</h2>
      <p>A decaying tree in an empty paddock is not the same risk as a tree within falling distance of a house, driveway, play area or power line. If any warning sign above sits over a target, proactive removal is a safety measure.</p>
      <p>Treemarkables assesses and removes hazardous trees across Gisborne and the East Coast. Call ${PHONE_DISPLAY} or <a href="/contact">request a free assessment</a>. If the tree can be kept, <a href="/tree-pruning">pruning</a> may be the better job.</p>
    `,
  },
  [`/blog/${PRUNING_SLUG}`]: {
    h1: "Why Regular Tree Pruning Protects Your Home in Gisborne",
    lede:
      "Gisborne's mild climate and coastal winds help trees thrive, and they also grow heavy limbs that fail in a nor'easter. Regular pruning is preventive maintenance for the house, the people under the tree, and the tree itself.",
    extra: `
      <p>We are often called after high winds or heavy rain to deal with broken limbs that a scheduled prune would have taken off while they were still small. Pruning is not only about the look of the tree.</p>
      <h2>Promote tree health</h2>
      <p>Removing dead, diseased or crossing branches lets the tree put energy into sound wood. Air and light through the canopy also dry foliage faster in Gisborne's humid summers, which helps with fungal problems.</p>
      <h2>Protect the house</h2>
      <p>Limbs over a roof can smash tiles and start leaks. Limbs in power lines or rubbing a wall are a fire and outage risk. Reducing weight and wind sail makes a failure less likely. Norfolk pines and eucalyptus around Gisborne drop heavy wood without much warning.</p>
      <h2>When to prune, and who should do it</h2>
      <p>Most trees are best pruned in the late dormant season — in Gisborne, late winter to early spring (August to September) — before new growth. Large trees need a qualified crew: the wrong cut damages the tree, and the work is dangerous around lines and roofs. If you are unsure whether a tree is protected, check with Gisborne District Council before cutting. We can help with that.</p>
      <p>Call ${PHONE_DISPLAY} or <a href="/contact">ask for a quote</a>. For a tree that should come out rather than be pruned, see <a href="/tree-removal">tree removal</a>.</p>
    `,
  },
};

const UNKNOWN_BLOG: PageCopy = {
  h1: "Post not found",
  lede: "That blog post is not on this site. The tree care notes we have published are listed on the blog.",
  extra: `<p><a href="/blog">Back to the blog</a></p>`,
};

function pageCopy(pathname: string): PageCopy {
  const path = normalisePublicPath(pathname);
  if (path === "/home") return PAGES["/"];
  if (PAGES[path]) return PAGES[path];
  if (path.startsWith("/blog/")) return UNKNOWN_BLOG;
  return PAGES["/"];
}

function navHtml(): string {
  const links = NAV.map(
    ([href, label]) => `<a href="${href}">${label}</a>`,
  ).join(" ");
  return `<nav aria-label="Services">${links} <a href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a></nav>`;
}

function pageHtml(pathname: string): string {
  const copy = pageCopy(pathname);
  return `<style>
    #tm-prerender{box-sizing:border-box;background:#f6f5f0;color:#161616;font-family:Georgia,"Iowan Old Style",serif;line-height:1.55;padding:1.25rem 1.25rem 3rem;max-width:46rem;margin:0 auto}
    #tm-prerender a{color:#0f5c32}
    #tm-prerender h1{font-size:2.1rem;line-height:1.15;margin:0.6rem 0}
    #tm-prerender h2{font-size:1.25rem;margin:1.25rem 0 0.4rem}
    #tm-prerender nav a{margin-right:0.75rem}
    #tm-prerender .tm-cta{display:inline-block;margin-right:0.75rem;font-weight:700}
    body:has(#root > *) #tm-prerender{display:none !important}
  </style>
  <div id="tm-prerender">
    <header>
      <p><a href="/">Treemarkables</a> — arborists, Gisborne</p>
      ${navHtml()}
    </header>
    <main>
      <h1>${copy.h1}</h1>
      <p>${copy.lede}</p>
      ${copy.extra || ""}
      <p>
        <a class="tm-cta" href="/contact">Get a free quote</a>
        <a class="tm-cta" href="tel:${PHONE_TEL}">Call ${PHONE_DISPLAY}</a>
      </p>
    </main>
    <footer>
      <p>Treemarkables. ${ADDRESS_LINE}.</p>
      <p>Phone <a href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a>. Email <a href="mailto:quotes@treemarkables.nz">quotes@treemarkables.nz</a>.</p>
      <p>Serving Gisborne, Tairāwhiti, Wairoa and the East Coast.</p>
      <p><a href="/privacy-policy">Privacy policy</a></p>
    </footer>
  </div>
  <script>
    window.addEventListener("inflow-booted", function () {
      var el = document.getElementById("tm-prerender");
      if (el) el.remove();
    });
  </script>`;
}

interface BlogMeta {
  slug: string;
  headline: string;
  description: string;
  date: string;
  image: string;
}

const BLOG_META: Record<string, BlogMeta> = {
  [`/blog/${HAZARD_SLUG}`]: {
    slug: HAZARD_SLUG,
    headline: "5 Signs Your Tree Is a Hazard and Needs Removing",
    description:
      "Worried a tree on your Gisborne property is a hazard? Learn 5 critical signs of a dangerous tree, from dead branches to root decay.",
    date: "2026-02-25",
    image: `${ORIGIN}/hazardous-tree-gisborne.jpg`,
  },
  [`/blog/${PRUNING_SLUG}`]: {
    slug: PRUNING_SLUG,
    headline: "Why Regular Tree Pruning Protects Your Home in Gisborne",
    description:
      "Gisborne's mild climate and coastal winds create conditions where branches can grow quickly and pose risks to homes. Regular pruning is preventive maintenance.",
    date: "2025-09-14",
    image: `${ORIGIN}/tree-pruning.jpg`,
  },
};

function localBusiness(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${ORIGIN}/#business`,
    name: "Treemarkables",
    description:
      "Residential arborists in Gisborne, New Zealand. Tree removal, pruning, stump grinding and hedge trimming across Tairāwhiti, Wairoa and the East Coast.",
    url: `${ORIGIN}/`,
    telephone: PHONE_SCHEMA,
    email: "quotes@treemarkables.nz",
    image: `${ORIGIN}/team-photo.jpg`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "213 Stanley Road",
      addressLocality: "Awapuni",
      addressRegion: "Gisborne",
      postalCode: "4010",
      addressCountry: "NZ",
    },
    areaServed: [
      { "@type": "City", name: "Gisborne" },
      { "@type": "AdministrativeArea", name: "Tairāwhiti" },
      { "@type": "City", name: "Wairoa" },
      { "@type": "AdministrativeArea", name: "East Coast" },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Arborist services",
      itemListElement: [
        ["Tree removal", "/tree-removal"],
        ["Tree pruning", "/tree-pruning"],
        ["Stump grinding", "/stump-grinding"],
        ["Hedge trimming", "/hedge-trimming"],
        ["Emergency tree removal", "/tree-removal"],
      ].map(([name, path]) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name,
          url: `${ORIGIN}${path}`,
        },
      })),
    },
  };
}

function blogPosting(meta: BlogMeta): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${ORIGIN}/blog/${meta.slug}#article`,
    headline: meta.headline,
    description: meta.description,
    image: meta.image,
    datePublished: meta.date,
    dateModified: meta.date,
    author: { "@type": "Organization", name: "Treemarkables", url: `${ORIGIN}/` },
    publisher: { "@type": "Organization", name: "Treemarkables", url: `${ORIGIN}/` },
    mainEntityOfPage: `${ORIGIN}/blog/${meta.slug}`,
  };
}

function scriptTag(data: Record<string, unknown>): string {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

/** JSON-LD for a public route. Empty for staff/app routes. No aggregateRating. */
export function treemarkablesJsonLd(pathname: string): string {
  if (!isTreemarkablesPublicPath(pathname)) return "";
  const path = normalisePublicPath(pathname);
  const blocks = [localBusiness()];
  const post = BLOG_META[path];
  if (post) blocks.push(blogPosting(post));
  return blocks.map(scriptTag).join("\n    ");
}

const PUBLIC_MARKER = "tm-prerender";

function stripInflowBoot(html: string): string {
  const start = html.indexOf('<div id="inflow-boot"');
  const rootAt = html.indexOf('<div id="root"');
  if (start === -1 || rootAt === -1 || start > rootAt) return html;
  return html.slice(0, start) + html.slice(rootAt);
}

/**
 * Insert the static page just before #root and drop the Inflow boot loader.
 * Idempotent. No-op for staff routes and for documents that have no #root.
 */
export function injectTreemarkablesPublicHtml(html: string, pathname: string): string {
  if (!isTreemarkablesPublicPath(pathname)) return html;
  if (html.includes(`id="${PUBLIC_MARKER}"`)) return html;
  const withoutBoot = stripInflowBoot(html);
  const rootTag = '<div id="root">';
  const at = withoutBoot.indexOf(rootTag);
  if (at === -1) return withoutBoot;
  return withoutBoot.slice(0, at) + pageHtml(pathname) + withoutBoot.slice(at);
}
