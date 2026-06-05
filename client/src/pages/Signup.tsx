import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, TreePine } from "lucide-react";

export default function Signup() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const planKey = params.get("plan") || "freemium";
  const planLabel = planKey === "crew" ? "Crew" : planKey === "business" ? "Business" : "Free";

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
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="businessName">Business name</Label>
              <Input id="businessName" name="businessName" required autoComplete="organization" />
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
              ) : (
                "Create account"
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
