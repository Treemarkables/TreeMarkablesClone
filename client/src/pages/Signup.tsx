import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TreePine } from "lucide-react";

interface Plan {
  key: string;
  name: string;
  priceNzd: string;
}

// Trades offered at signup. Canonical source is server/trades/presets.ts
// (TRADE_KEYS + each preset's label) — keep this list in sync. Picking one seeds
// the tenant's discipline, AI vocabulary and defaults so the app speaks their trade.
const TRADE_OPTIONS: { key: string; label: string }[] = [
  { key: "tree", label: "Tree services" },
  { key: "plumbing", label: "Plumbing" },
  { key: "electrical", label: "Electrical" },
  { key: "building", label: "Building" },
  { key: "general", label: "Other / general field services" },
];

export default function Signup() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const params = new URLSearchParams(window.location.search);
  // The plan can arrive from the pricing page (?plan=crew) but is also selectable
  // here so someone landing on /signup directly can choose. Paid → Stripe; free → app.
  const [planKey, setPlanKey] = useState(params.get("plan") || "freemium");
  const planLabel = planKey === "crew" ? "Crew" : planKey === "business" ? "Business" : "Free";
  // Default 'general' (neutral) — never auto-assume a trade; the subscriber picks.
  const [industry, setIndustry] = useState("general");

  // Live plans so the picker shows the current prices (never hardcoded).
  const { data: plansResp } = useQuery<{ success: boolean; data: Plan[] }>({
    queryKey: ["/api/billing/plans"],
  });
  const plans = plansResp?.data ?? [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setPending(true);
    const form = e.currentTarget;
    const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value;
    const data = {
      businessName: val("businessName").trim(),
      firstName: val("firstName").trim(),
      lastName: val("lastName").trim(),
      email: val("email").trim(),
      password: val("password"),
      planKey,
      industry,
    };
    try {
      const r = await apiRequest("POST", "/api/signup", data);
      const j = await r.json();
      if (!j.success) throw new Error(j.message || "Sign-up failed.");
      // The endpoint logs them in. Paid plan → Stripe; free → into the app.
      window.location.href = j.checkoutUrl || "/dispatch";
    } catch (err) {
      setError((err as Error).message || "Sign-up failed.");
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <TreePine className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Create your Inflow account</CardTitle>
          <CardDescription>
            {planKey === "freemium"
              ? "Start free — no card required."
              : `Starting on the ${planLabel} plan. You'll add your card next.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {plans.length > 0 && (
            <div className="space-y-2 mb-4">
              <Label>Choose your plan</Label>
              {plans.map((p) => {
                const selected = p.key === planKey;
                const price = Number(p.priceNzd);
                return (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => setPlanKey(p.key)}
                    aria-pressed={selected}
                    className={`w-full flex items-center justify-between rounded-lg border p-3 text-left ${
                      selected ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {price > 0 ? `$${price.toFixed(0)}/mo` : "Free"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="businessName">Business name</Label>
              <Input id="businessName" name="businessName" required autoComplete="organization" />
            </div>
            <div>
              <Label htmlFor="industry">Your trade</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select your trade" />
                </SelectTrigger>
                <SelectContent>
                  {TRADE_OPTIONS.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Sets up your app with the right job types and wording. You can change it later.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" required autoComplete="given-name" />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" required autoComplete="family-name" />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={8} />
              <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating your account…</>
              ) : planKey === "freemium" ? (
                "Create account"
              ) : (
                "Continue to payment"
              )}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center mt-4">
            Already have an account?{" "}
            <a href="/login" className="text-primary underline">Log in</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
