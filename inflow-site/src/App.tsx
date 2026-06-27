import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import Features from "@/pages/Features";
import Pricing from "@/pages/Pricing";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Support from "@/pages/Support";
import NotFound from "@/pages/NotFound";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);
  return null;
}

// Per-route title + meta description (no dependency). Keeps tab titles, search
// snippets and link-share previews correct as you navigate the SPA.
const PAGE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Inflow — the operating system for trades businesses",
    description: "Run your whole trade from one place: jobs, quotes, invoices, customers, staff and safety. Built for the field, made in New Zealand.",
  },
  "/features": {
    title: "Features — Inflow",
    description: "Every workflow a trades business runs on — jobs & dispatch, quoting & proposals, invoicing, safety, CRM, supplier invoices and job costing — in one app.",
  },
  "/pricing": {
    title: "Pricing — Inflow",
    description: "Start free, then pay by jobs per month — never per seat. Unlimited users on every paid plan. NZD, plus GST. No lock-in.",
  },
  "/about": {
    title: "About — Inflow",
    description: "Inflow was built inside a real trades business in Gisborne, New Zealand — for the way trades actually work.",
  },
  "/contact": {
    title: "Contact — Inflow",
    description: "Tell us about your business. We're onboarding NZ trades businesses one at a time.",
  },
  "/support": {
    title: "Support — Inflow",
    description: "Get help with Inflow — email support, in-app help centre, onboarding and billing questions.",
  },
  "/privacy": { title: "Privacy Policy — Inflow", description: "How Inflow collects, uses and protects your data, under the New Zealand Privacy Act 2020." },
  "/terms": { title: "Terms of Service — Inflow", description: "The terms that govern your use of Inflow." },
};

function setMetaTag(key: string, content: string, asProperty = false) {
  const attr = asProperty ? "property" : "name";
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function DocumentMeta() {
  const [location] = useLocation();
  useEffect(() => {
    const meta = PAGE_META[location] ?? PAGE_META["/"];
    const url = `https://inflowapp.co.nz${location === "/" ? "" : location}`;
    document.title = meta.title;
    setMetaTag("description", meta.description);
    setMetaTag("og:title", meta.title, true);
    setMetaTag("og:description", meta.description, true);
    setMetaTag("og:url", url, true);
    // canonical
    let canon = document.head.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement("link");
      canon.setAttribute("rel", "canonical");
      document.head.appendChild(canon);
    }
    canon.setAttribute("href", url);
  }, [location]);
  return null;
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <ScrollToTop />
      <DocumentMeta />
      <Header />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/features" component={Features} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/about" component={About} />
          <Route path="/contact" component={Contact} />
          <Route path="/support" component={Support} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}
