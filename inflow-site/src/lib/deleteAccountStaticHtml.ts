import {
  DELETE_DESCRIPTION,
  DELETE_DISCLAIMER,
  DELETE_DOCUMENT_TITLE,
  DELETE_INTRO,
  DELETE_KEPT,
  DELETE_LOGIN_URL,
  DELETE_MAILTO,
  DELETE_OWN_LOGIN,
  DELETE_PAGE_HEADING,
  DELETE_PAGE_URL,
  DELETE_QUESTIONS,
  DELETE_REMOVED,
  DELETE_REMOVED_LEAD,
  DELETE_SIGNUP_URL,
  DELETE_STEPS,
  DELETE_STEPS_LEAD,
  DELETE_TIMEFRAME,
  DELETE_UPDATED,
  stepParts,
} from "./deleteAccountCopy";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderStep(step: string): string {
  return stepParts(step)
    .map((part) => {
      if (part.type === "email") {
        return `<a class="underline decoration-lime-deep" href="${esc(DELETE_MAILTO)}">${esc(part.value)}</a>`;
      }
      if (part.type === "subject") {
        return `<strong>${esc(part.value)}</strong>`;
      }
      return esc(part.value);
    })
    .join("");
}

function renderItems(items: string[]): string {
  return items.map((item) => `<li>${esc(item)}</li>`).join("");
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-150 select-none whitespace-nowrap";
const primaryLg = `${buttonBase} bg-ink-900 text-paper hover:bg-ink-800 h-12 px-6 text-base`;
const primaryMd = `${buttonBase} bg-ink-900 text-paper hover:bg-ink-800 h-10 px-5 text-sm`;
const ghostMd = `${buttonBase} bg-transparent text-ink-900 hover:bg-ink-100 h-10 px-5 text-sm`;

/** Header, deletion article, and footer. Styled with the same classes as the marketing site. */
export function renderDeleteAccountShell(): string {
  const year = new Date().getFullYear();
  return `<div class="min-h-screen flex flex-col bg-paper">
<header class="sticky top-0 z-50 bg-paper/85 backdrop-blur border-b border-ink-100">
  <div class="mx-auto max-w-site px-6 md:px-10 h-16 md:h-20 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2.5 text-ink-900 font-semibold tracking-snug" aria-label="Inflow — home">
      <span class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-ink-900">
        <img src="/inflow-icon-192.png?v=8" alt="" class="h-8 w-8 rounded-md" width="32" height="32" />
      </span>
      <span class="text-[19px] leading-none">Inflow</span>
    </a>
    <nav class="hidden md:flex items-center gap-1" aria-label="Primary">
      <a href="/features" class="px-3 py-2 text-sm rounded-md text-ink-500 hover:text-ink-900">Features</a>
      <a href="/about" class="px-3 py-2 text-sm rounded-md text-ink-500 hover:text-ink-900">About</a>
      <a href="/contact" class="px-3 py-2 text-sm rounded-md text-ink-500 hover:text-ink-900">Contact</a>
    </nav>
    <div class="hidden md:flex items-center gap-2">
      <a href="${esc(DELETE_LOGIN_URL)}" class="${ghostMd}">Log in</a>
      <a href="${esc(DELETE_SIGNUP_URL)}" class="${primaryMd}">Sign up</a>
    </div>
  </div>
</header>
<main class="flex-1">
  <section class="py-20 md:py-28 pt-28 md:pt-32">
    <div class="mx-auto w-full max-w-site px-6 md:px-10">
      <div class="max-w-3xl mx-auto">
        <div class="text-center">
          <span class="eyebrow">Account</span>
          <h1 class="heading-display text-4xl md:text-5xl mt-4">${esc(DELETE_PAGE_HEADING)}</h1>
          <p class="mt-3 text-sm text-ink-400">Last updated ${esc(DELETE_UPDATED)}</p>
        </div>
        <p class="mt-10 text-lg text-ink-600 leading-relaxed">${esc(DELETE_INTRO)}</p>
        <div class="mt-10 space-y-9">
          <section>
            <h2 class="heading-section text-xl md:text-2xl">How to request deletion</h2>
            <div class="mt-3 space-y-3 text-[15px] leading-[1.7] text-ink-700">
              <p>${esc(DELETE_STEPS_LEAD)}</p>
              <ol class="list-decimal list-inside space-y-2 marker:text-ink-400">
                ${DELETE_STEPS.map((step) => `<li>${renderStep(step)}</li>`).join("")}
              </ol>
              <p><a class="${primaryLg}" href="${esc(DELETE_MAILTO)}">Email your deletion request</a></p>
            </div>
          </section>
          <section>
            <h2 class="heading-section text-xl md:text-2xl">What we delete</h2>
            <div class="mt-3 space-y-3 text-[15px] leading-[1.7] text-ink-700">
              <p>${esc(DELETE_REMOVED_LEAD)}</p>
              <ul class="list-disc list-inside space-y-1.5 marker:text-ink-400">
                ${renderItems(DELETE_REMOVED)}
              </ul>
            </div>
          </section>
          <section>
            <h2 class="heading-section text-xl md:text-2xl">What we keep, and for how long</h2>
            <div class="mt-3 space-y-3 text-[15px] leading-[1.7] text-ink-700">
              <ul class="list-disc list-inside space-y-1.5 marker:text-ink-400">
                ${renderItems(DELETE_KEPT)}
              </ul>
            </div>
          </section>
          <section>
            <h2 class="heading-section text-xl md:text-2xl">How long deletion takes</h2>
            <div class="mt-3 space-y-3 text-[15px] leading-[1.7] text-ink-700">
              <p>${esc(DELETE_TIMEFRAME)}</p>
            </div>
          </section>
          <section>
            <h2 class="heading-section text-xl md:text-2xl">Removing only your own sign-in</h2>
            <div class="mt-3 space-y-3 text-[15px] leading-[1.7] text-ink-700">
              <p>${esc(DELETE_OWN_LOGIN)}</p>
            </div>
          </section>
          <section>
            <h2 class="heading-section text-xl md:text-2xl">Questions</h2>
            <div class="mt-3 space-y-3 text-[15px] leading-[1.7] text-ink-700">
              <p>${esc(DELETE_QUESTIONS).replace(
                "Privacy Policy",
                `<a class="underline decoration-lime-deep" href="/privacy">Privacy Policy</a>`,
              )}</p>
            </div>
          </section>
          <p class="text-xs text-ink-400 pt-4 border-t border-ink-100">${esc(DELETE_DISCLAIMER)}</p>
        </div>
      </div>
    </div>
  </section>
</main>
<footer class="bg-ink-900 text-paper">
  <div class="mx-auto w-full max-w-site px-6 md:px-10 py-10">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <p class="text-xs text-ink-400">© ${year} Inflow. All rights reserved.</p>
      <div class="flex flex-wrap gap-6 text-xs text-ink-400">
        <a href="/privacy" class="hover:text-paper">Privacy</a>
        <a href="/terms" class="hover:text-paper">Terms</a>
        <a href="/security" class="hover:text-paper">Security</a>
        <a href="/support" class="hover:text-paper">Support</a>
        <a href="/delete-account" class="hover:text-paper">Delete account</a>
      </div>
    </div>
  </div>
</footer>
</div>`;
}

function replaceMeta(html: string, attr: "name" | "property", key: string, value: string): string {
  const pattern = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  if (!pattern.test(html)) return html;
  return html.replace(pattern, `$1${esc(value)}$2`);
}

/**
 * Copy the built marketing document and put the deletion article in the first
 * response, so a crawler that does not run JavaScript still sees the steps.
 * The existing stylesheet and script tags are left in place.
 */
export function applyDeleteAccountDocument(indexHtml: string): string {
  const root = '<div id="root"></div>';
  if (!indexHtml.includes(root)) {
    throw new Error("Account deletion prerender expected an empty <div id=\"root\"></div> in index.html.");
  }
  let html = indexHtml.replace(/<title>[^<]*<\/title>/, `<title>${esc(DELETE_DOCUMENT_TITLE)}</title>`);
  html = replaceMeta(html, "name", "description", DELETE_DESCRIPTION);
  html = replaceMeta(html, "property", "og:title", DELETE_DOCUMENT_TITLE);
  html = replaceMeta(html, "property", "og:description", DELETE_DESCRIPTION);
  html = replaceMeta(html, "property", "og:url", DELETE_PAGE_URL);
  html = replaceMeta(html, "name", "twitter:title", DELETE_DOCUMENT_TITLE);
  html = replaceMeta(html, "name", "twitter:description", DELETE_DESCRIPTION);
  html = html.replace(
    /(<link rel="canonical" href=")[^"]*(")/,
    `$1${esc(DELETE_PAGE_URL)}$2`,
  );
  html = html.replace(root, `<div id="root">${renderDeleteAccountShell()}</div>`);
  return html;
}
