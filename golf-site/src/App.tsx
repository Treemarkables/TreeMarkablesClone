import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactBand from "@/components/ContactBand";
import Home from "@/pages/Home";
import Course from "@/pages/Course";
import Membership from "@/pages/Membership";
import Events from "@/pages/Events";
import NotFound from "@/pages/NotFound";
import { BRAND } from "@/lib/brand";

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
    title: "Gisborne Park Golf Club — 18 holes in Gisborne, all year round",
    description:
      "Gisborne Park Golf Club: 18 tree-lined holes on the flat in Elgin, Gisborne. Par 72, open all year, visitors welcome. Phone 06 867 9849.",
  },
  "/course": {
    title: "The Course — Gisborne Park Golf Club",
    description:
      "18 holes, par 72, 5,665 yards off the white tees. Flat, tree-lined parkland golf beside Gisborne Airport, with the full scorecard hole by hole.",
  },
  "/membership": {
    title: "Membership & Green Fees — Gisborne Park Golf Club",
    description:
      "Full, couples, junior and nine-hole memberships, plus casual green fees. Phone the clubhouse on 06 867 9849 for current rates.",
  },
  "/events": {
    title: "Events & Functions — Gisborne Park Golf Club",
    description:
      "Weekly club days, twilight golf, open tournaments, and a clubhouse you can hire for your own function, with a golf simulator for wet days.",
  },
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
    const url = `${BRAND.domain}${location === "/" ? "" : location}`;
    document.title = meta.title;
    setMetaTag("description", meta.description);
    setMetaTag("og:title", meta.title, true);
    setMetaTag("og:description", meta.description, true);
    setMetaTag("og:url", url, true);
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
    <div className="min-h-screen flex flex-col bg-cream">
      <ScrollToTop />
      <DocumentMeta />
      <Header />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/course" component={Course} />
          <Route path="/membership" component={Membership} />
          <Route path="/events" component={Events} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <ContactBand />
      <Footer />
    </div>
  );
}
