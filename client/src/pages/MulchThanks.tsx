import { useEffect, useState } from "react";
import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Phone,
  TreePine,
  Scissors,
  Trees,
  Leaf,
  ArrowRight,
} from "lucide-react";

const NEON = "#39FF14";

type OrderSummary = {
  qty: number;
  productName: string;
  pricePerM3: number;
  deliveryFee?: number;
  total: number;
  coverage: number;
  customerName?: string;
  jobNumber?: string;
};

const upsells = [
  {
    icon: TreePine,
    title: "Tree Removal",
    desc: "Got a tree on the way out? Certified arborists, fully insured, tidy clean-up.",
    href: "/tree-removal",
  },
  {
    icon: Scissors,
    title: "Tree Pruning",
    desc: "Shape, thin, or crown-lift. Healthier trees and better views.",
    href: "/tree-pruning",
  },
  {
    icon: Leaf,
    title: "Hedge Trimming",
    desc: "Crisp lines, no mess. We bring the gear and take the trimmings away.",
    href: "/hedge-trimming",
  },
  {
    icon: Trees,
    title: "Stump Grinding",
    desc: "Remove the eyesore. Grind below ground level so you can replant or pave.",
    href: "/stump-grinding",
  },
];

const formatPrice = (n: number) => `$${n.toFixed(2)}`;

export default function MulchThanks() {
  const [summary, setSummary] = useState<OrderSummary | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("mulchOrderSummary");
      if (raw) setSummary(JSON.parse(raw));
    } catch {
      // ignore parse errors — fall back to generic confirmation
    }
  }, []);

  const handleCall = () => {
    window.location.href = "tel:0272166882";
  };

  return (
    <div className="min-h-screen bg-background pt-20">
      <SEO
        title="Mulch order received — Treemarkables"
        description="Thanks for your mulch order. We'll be in touch to confirm delivery."
      />
      <Header />

      {/* Confirmation hero */}
      <section className="px-4 py-12 text-center border-b bg-muted/30">
        <div
          className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4"
          style={{ background: NEON }}
        >
          <CheckCircle2 className="w-9 h-9 text-black" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight max-w-2xl mx-auto">
          {summary?.customerName
            ? `Thanks, ${summary.customerName.split(" ")[0]}!`
            : "Order received!"}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-xl mx-auto">
          We've got your mulch order. We'll give you a call within one working
          day to confirm delivery timing.
        </p>
      </section>

      {/* Order recap */}
      {summary && (
        <section className="px-4 py-8 border-b">
          <div className="max-w-xl mx-auto bg-card border border-border rounded-xl p-5">
            <div className="text-xs uppercase tracking-widest font-bold mb-4 text-muted-foreground">
              Your order
            </div>
            {summary.jobNumber && (
              <div className="flex justify-between py-2.5 border-b text-sm">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-semibold">#{summary.jobNumber}</span>
              </div>
            )}
            <div className="flex justify-between py-2.5 border-b text-sm">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-semibold">{summary.qty} m³</span>
            </div>
            <div className="flex justify-between py-2.5 border-b text-sm">
              <span className="text-muted-foreground">
                {summary.productName} (${summary.pricePerM3}/m³ ex GST)
              </span>
              <span className="font-semibold">
                {formatPrice(summary.qty * summary.pricePerM3)}
              </span>
            </div>
            <div className="flex justify-between py-2.5 border-b text-sm">
              <span className="text-muted-foreground">Delivery (ex GST)</span>
              <span className="font-semibold">
                {formatPrice(summary.deliveryFee ?? 0)}
              </span>
            </div>
            <div className="flex justify-between py-2.5 border-b text-sm">
              <span className="text-muted-foreground">GST (15%)</span>
              <span className="font-semibold">
                {formatPrice(
                  (summary.qty * summary.pricePerM3 +
                    (summary.deliveryFee ?? 0)) *
                    0.15,
                )}
              </span>
            </div>
            <div className="flex justify-between py-2.5 border-b text-sm">
              <span className="text-muted-foreground">Coverage estimate</span>
              <span className="font-semibold">~{summary.coverage} m²</span>
            </div>
            <div className="flex justify-between mt-2.5 pt-4 border-t-2 border-black text-2xl font-extrabold">
              <span>Total</span>
              <span>{formatPrice(summary.total)}</span>
            </div>
            <div className="text-[11px] text-muted-foreground/70 text-right">
              Incl. GST — invoice on delivery
            </div>
          </div>
        </section>
      )}

      {/* What happens next */}
      <section className="px-4 py-10 border-b bg-muted/30">
        <h2 className="text-2xl font-extrabold text-center mb-6 tracking-tight">
          What happens{" "}
          <span
            className="px-1.5 rounded text-black"
            style={{ background: NEON }}
          >
            next
          </span>
          ?
        </h2>
        <div className="max-w-xl mx-auto space-y-3 text-sm">
          {[
            "We'll call you within one working day to confirm timing and tip location.",
            "Mulch is delivered straight off the truck, tipped where you want it.",
            "Invoice arrives by email after delivery — no payment up front.",
          ].map((line, i) => (
            <div
              key={line}
              className="flex gap-3 items-start bg-card border border-border rounded-lg p-4"
            >
              <div
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-sm text-black"
                style={{ background: NEON }}
              >
                {i + 1}
              </div>
              <div className="text-foreground leading-snug pt-0.5">{line}</div>
            </div>
          ))}
        </div>
        <div className="max-w-xl mx-auto mt-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Need to change something or have a question?
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleCall}
            className="h-11"
          >
            <Phone className="w-4 h-4 mr-2" />
            Call 027 216 6882
          </Button>
        </div>
      </section>

      {/* Upsell */}
      <section className="px-4 py-10 border-b">
        <h2 className="text-2xl font-extrabold text-center mb-7 tracking-tight">
          We also offer these services
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
          {upsells.map((u) => (
            <Link
              key={u.title}
              href={u.href}
              className="group bg-card border border-border rounded-xl p-5 flex gap-4 items-start hover:border-black transition-colors"
            >
              <div
                className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center"
                style={{ background: NEON }}
              >
                <u.icon className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1">
                <div className="font-extrabold text-base flex items-center gap-2">
                  {u.title}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-snug">
                  {u.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
