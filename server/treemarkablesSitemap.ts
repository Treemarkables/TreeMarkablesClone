/**
 * Public sitemap for https://www.treemarkables.co.nz/sitemap.xml.
 *
 * The previous handler called res.sendFile() on process.cwd()/sitemap.xml and
 * swallowed only synchronous throws. sendFile reports a missing file, a path
 * outside its root, or a stream error through next(err). The process error
 * handler turns that into HTTP 500, and the esbuild server bundle does not
 * embed the XML file, so the URL depended on the deploy working directory.
 *
 * This builds the document in memory. Static marketing URLs are always
 * included. Blog posts are a separate lookup: if that throws, the response is
 * still the static urlset.
 */
export const TREEMARKABLES_SITEMAP_ORIGIN = "https://www.treemarkables.co.nz";

export interface TreemarkablesBlogPost {
  slug: string;
  /** YYYY-MM-DD. Omitted from the url entry when it is not that shape. */
  lastmod: string;
}

interface StaticPage {
  path: string;
  changefreq: "weekly" | "monthly" | "yearly";
  priority: string;
}

const STATIC_LASTMOD = "2026-10-10";

/** Order matches the historical sitemap: services, places, offer, blog, then legal. */
const STATIC_PAGES: readonly StaticPage[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/tree-removal", changefreq: "monthly", priority: "0.9" },
  { path: "/tree-pruning", changefreq: "monthly", priority: "0.9" },
  { path: "/stump-grinding", changefreq: "monthly", priority: "0.9" },
  { path: "/hedge-trimming", changefreq: "monthly", priority: "0.9" },
  { path: "/emergency-tree-removal", changefreq: "monthly", priority: "0.9" },
  { path: "/wairoa", changefreq: "monthly", priority: "0.8" },
  { path: "/east-coast", changefreq: "monthly", priority: "0.8" },
  { path: "/summer-offer", changefreq: "monthly", priority: "0.8" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
];

/**
 * Marketing posts published on /blog. Keep in step with client/src/pages/Blog.tsx
 * and the prerender catalog in treemarkablesPublicHtml.ts. There is no blog table.
 */
const PUBLISHED_BLOG_POSTS: readonly TreemarkablesBlogPost[] = [
  {
    slug: "hazardous-tree-removal-gisborne-5-signs-dangerous-tree",
    lastmod: "2026-02-25",
  },
  {
    slug: "why-regular-tree-pruning-protects-your-home-gisborne",
    lastmod: "2025-09-14",
  },
];

const BLOG_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LASTMOD = /^\d{4}-\d{2}-\d{2}$/;

export interface SitemapResponse {
  headersSent: boolean;
  status: (code: number) => void;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(path: string, lastmod: string, changefreq: string, priority: string): string {
  const loc = path === "/"
    ? `${TREEMARKABLES_SITEMAP_ORIGIN}/`
    : `${TREEMARKABLES_SITEMAP_ORIGIN}${path}`;
  const modified = LASTMOD.test(lastmod) ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>
    <loc>${escapeXml(loc)}</loc>${modified}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/** Static pages plus any blog posts that have a safe slug. Never throws. */
export function renderTreemarkablesSitemap(posts: readonly TreemarkablesBlogPost[]): string {
  const staticEntries = STATIC_PAGES.map((page) =>
    urlEntry(page.path, STATIC_LASTMOD, page.changefreq, page.priority),
  );
  const seen = new Set<string>();
  const blogEntries: string[] = [];
  for (const post of posts) {
    if (!post || typeof post.slug !== "string" || !BLOG_SLUG.test(post.slug)) continue;
    if (seen.has(post.slug)) continue;
    seen.add(post.slug);
    const lastmod = typeof post.lastmod === "string" && LASTMOD.test(post.lastmod) ? post.lastmod : "";
    blogEntries.push(urlEntry(`/blog/${post.slug}`, lastmod, "monthly", "0.7"));
  }

  const blogIndex = staticEntries.findIndex((entry) => entry.includes("/blog<"));
  const before = blogIndex === -1 ? staticEntries : staticEntries.slice(0, blogIndex + 1);
  const after = blogIndex === -1 ? [] : staticEntries.slice(blogIndex + 1);
  const body = [...before, ...blogEntries, ...after].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/** Isolated blog lookup. A throw here must not fail the sitemap response. */
export async function queryTreemarkablesBlogPosts(): Promise<readonly TreemarkablesBlogPost[]> {
  return PUBLISHED_BLOG_POSTS;
}

export async function buildTreemarkablesSitemapXml(
  queryBlog: () => Promise<readonly TreemarkablesBlogPost[]> = queryTreemarkablesBlogPosts,
): Promise<string> {
  try {
    const posts = await queryBlog();
    return renderTreemarkablesSitemap(Array.isArray(posts) ? posts : []);
  } catch (error) {
    console.error("Treemarkables sitemap blog query failed; serving static pages only:", error);
    return renderTreemarkablesSitemap([]);
  }
}

export async function handleTreemarkablesSitemap(
  res: SitemapResponse,
  queryBlog?: () => Promise<readonly TreemarkablesBlogPost[]>,
): Promise<void> {
  let xml: string;
  try {
    xml = queryBlog
      ? await buildTreemarkablesSitemapXml(queryBlog)
      : await buildTreemarkablesSitemapXml();
  } catch (error) {
    console.error("Error serving sitemap:", error);
    xml = renderTreemarkablesSitemap([]);
  }
  if (res.headersSent) return;
  res.status(200);
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(xml);
}
