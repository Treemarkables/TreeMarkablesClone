import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Droplet,
  Sprout,
  Thermometer,
  Leaf,
  CloudRain,
  Sparkles,
  Play,
  Plus,
  Minus,
  ArrowRight,
} from "lucide-react";

const AGED_PRICE = 35;
const MIN_QTY = 4;
const GST_RATE = 0.15;

const NEON = "#39FF14";

const PRODUCT = {
  name: "Aged Mulch",
  price: AGED_PRICE,
};

const benefits = [
  {
    icon: Droplet,
    title: "Holds Moisture",
    desc: "Stops soil drying out — water less often, even in summer.",
  },
  {
    icon: Sprout,
    title: "Smothers Weeds",
    desc: "Blocks weed seeds from germinating. Less weeding, less spray.",
  },
  {
    icon: Thermometer,
    title: "Protects Roots",
    desc: "Keeps soil cool in summer, warm in winter — happier plants.",
  },
  {
    icon: Leaf,
    title: "Feeds Your Soil",
    desc: "Breaks down into rich organic matter, full of nutrients and microbes.",
  },
  {
    icon: CloudRain,
    title: "Stops Erosion",
    desc: "Holds topsoil in place when heavy rain hits.",
  },
  {
    icon: Sparkles,
    title: "Looks Tidy",
    desc: "Finishes off garden beds — instant kerb appeal.",
  },
];

const presetQuantities = [4, 6, 9, 12];

const clampQty = (n: number) => Math.max(MIN_QTY, Math.min(50, n));
const formatPrice = (n: number) => `$${n.toFixed(2)}`;

export default function Mulch() {
  const [qty, setQty] = useState(6);
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const mulchCost = qty * PRODUCT.price;
  const gst = mulchCost * GST_RATE;
  const total = mulchCost + gst;

  return (
    <div className="min-h-screen bg-background pt-20">
      <SEO
        title="Order Mulch — Treemarkables"
        description="Fresh arborist mulch delivered across Gisborne. Order standard or aged mulch by the cubic metre, with free delivery on 9 m³ or more."
      />
      <Header />

      {/* Hero */}
      <section className="px-4 py-9 text-center border-b bg-muted/30">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight max-w-2xl mx-auto">
          Order{" "}
          <span
            className="px-2 rounded text-black"
            style={{ background: NEON }}
          >
            Mulch
          </span>{" "}
          Delivered
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Quality arborist mulch, delivered across Gisborne.
        </p>
      </section>

      {/* Benefits */}
      <section className="px-4 py-10 border-b">
        <h2 className="text-2xl font-extrabold text-center mb-2 tracking-tight">
          Why{" "}
          <span
            className="px-1.5 rounded text-black"
            style={{ background: NEON }}
          >
            Mulch?
          </span>
        </h2>
        <p className="text-center text-sm text-muted-foreground mb-7 max-w-xl mx-auto">
          A few centimetres of mulch does more for your garden than almost
          anything else you can do.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-w-3xl mx-auto">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="bg-card border border-border rounded-lg p-4"
            >
              <b.icon className="w-6 h-6 mb-2" />
              <div className="font-bold text-sm">{b.title}</div>
              <div className="text-xs text-muted-foreground leading-snug mt-1">
                {b.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Video */}
      <section className="px-4 py-10 border-b">
        <h2 className="text-2xl font-extrabold text-center mb-2 tracking-tight">
          How It{" "}
          <span
            className="px-1.5 rounded text-black"
            style={{ background: NEON }}
          >
            Works
          </span>
        </h2>
        <p className="text-center text-sm text-muted-foreground mb-7">
          Watch the 60-second walkthrough — from order to delivery.
        </p>
        <div className="relative w-full aspect-video bg-black rounded-xl border-2 border-black overflow-hidden cursor-pointer max-w-xl mx-auto group">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
              style={{
                background: NEON,
                boxShadow: "0 4px 20px rgba(57,255,20,0.4)",
              }}
            >
              <Play
                className="w-7 h-7 text-black ml-1"
                fill="currentColor"
              />
            </div>
            <div className="text-white text-xs font-bold tracking-wider uppercase opacity-95 text-center px-5">
              Ordering Mulch with Treemarkables
            </div>
          </div>
          <div className="absolute bottom-3 right-3 bg-black/75 text-white text-[11px] px-2 py-0.5 rounded font-semibold">
            1:00
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          See exactly how your mulch gets from our chippers to your driveway.
        </p>
      </section>

      {/* Form */}
      <section className="px-4 py-8 border-b">
        <div className="max-w-xl mx-auto">
          <div className="bg-yellow-50 border border-dashed border-yellow-600 text-yellow-800 text-[10px] uppercase tracking-widest p-2 rounded text-center mb-6 font-semibold">
            — Interactive Wireframe —
          </div>

          {/* Step 1 — quantity */}
          <div className="mb-9">
            <div className="flex items-center mb-3.5">
              <span
                className="inline-flex w-6 h-6 text-black rounded-full items-center justify-center font-extrabold text-xs mr-2"
                style={{ background: NEON }}
              >
                1
              </span>
              <span className="font-bold text-base">How much mulch?</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQty(clampQty(qty - 1))}
                className="h-11 w-10 flex-shrink-0"
                aria-label="Decrease quantity"
              >
                <Minus className="w-5 h-5" />
              </Button>
              <Input
                type="number"
                min={MIN_QTY}
                max={50}
                value={qty}
                onChange={(e) =>
                  setQty(clampQty(parseInt(e.target.value) || MIN_QTY))
                }
                className="flex-1 h-11 border-2 border-black text-center text-xl font-bold"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQty(clampQty(qty + 1))}
                className="h-11 w-10 flex-shrink-0"
                aria-label="Increase quantity"
              >
                <Plus className="w-5 h-5" />
              </Button>
              <div className="text-xs text-muted-foreground text-center leading-tight flex-shrink-0">
                cubic
                <br />
                metres
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presetQuantities.map((p) => {
                const isActive = qty === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setQty(p)}
                    className={`px-3 py-1.5 border rounded-full text-xs font-semibold transition-colors ${
                      isActive
                        ? "border-black text-black"
                        : "border-border text-muted-foreground"
                    }`}
                    style={isActive ? { background: NEON } : undefined}
                  >
                    {p} m³
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2 — address */}
          <div className="mb-9">
            <div className="flex items-center mb-3.5">
              <span
                className="inline-flex w-6 h-6 text-black rounded-full items-center justify-center font-extrabold text-xs mr-2"
                style={{ background: NEON }}
              >
                2
              </span>
              <span className="font-bold text-base">Delivery address</span>
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Street address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <Input
                placeholder="Suburb"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
              />
              <Input
                placeholder="Postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
              />
              <Input
                placeholder="Access notes (gate width, tip location)"
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Step 3 — contact */}
          <div>
            <div className="flex items-center mb-3.5">
              <span
                className="inline-flex w-6 h-6 text-black rounded-full items-center justify-center font-extrabold text-xs mr-2"
                style={{ background: NEON }}
              >
                3
              </span>
              <span className="font-bold text-base">Your details</span>
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="px-4 py-8 bg-muted/30">
        <div className="max-w-xl mx-auto">
          <div className="text-xs uppercase tracking-widest font-bold mb-4">
            Order Summary
          </div>
          <div className="flex justify-between py-2.5 border-b text-sm">
            <span className="text-muted-foreground">Quantity</span>
            <span className="font-semibold">{qty} m³</span>
          </div>
          <div className="flex justify-between py-2.5 border-b text-sm">
            <span className="text-muted-foreground">
              {PRODUCT.name} (${PRODUCT.price}/m³)
            </span>
            <span className="font-semibold">{formatPrice(mulchCost)}</span>
          </div>
          <div className="flex justify-between py-2.5 border-b text-sm">
            <span className="text-muted-foreground">Delivery</span>
            <span
              className="font-extrabold text-[11px] text-black px-2 py-0.5 rounded"
              style={{ background: NEON }}
            >
              FREE
            </span>
          </div>
          <div className="flex justify-between py-2.5 border-b text-sm">
            <span className="text-muted-foreground">GST (15%)</span>
            <span className="font-semibold">{formatPrice(gst)}</span>
          </div>
          <div className="flex justify-between border-t-2 border-black mt-2.5 pt-4 text-2xl font-extrabold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          <div className="text-[11px] text-muted-foreground/70 text-right mb-4">
            Incl. GST
          </div>

          <Button
            type="button"
            disabled
            className="w-full bg-black text-white font-extrabold tracking-wide h-12 text-sm"
          >
            Book Delivery
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <div className="text-center text-xs text-muted-foreground mt-2">
            No payment now — invoice on delivery
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
