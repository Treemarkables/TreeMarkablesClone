import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Upload, Building2, Phone, Mail, MapPin, Hash, CreditCard, Image, AlignLeft, AlignCenter, AlignRight, Type, User, Tag, Briefcase, Landmark, Palette } from "lucide-react";
import { Link } from "wouter";
import { HelpLink } from "@/components/HelpLink";

// Contrast helpers for the email-brand preview — mirror server/emailTemplates.ts so
// the wordmark / button text shown here matches what the sent email computes.
function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return [11, 11, 11];
  const int = parseInt(h, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function relLuminance(hex: string): number {
  const lin = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
function contrastRatio(a: string, b: string): number {
  const hi = Math.max(relLuminance(a), relLuminance(b));
  const lo = Math.min(relLuminance(a), relLuminance(b));
  return (hi + 0.05) / (lo + 0.05);
}
function readableOn(bg: string): string {
  return contrastRatio("#ffffff", bg) >= contrastRatio("#0b0b0b", bg) ? "#ffffff" : "#0b0b0b";
}
function wordmarkOn(accent: string, header: string): string {
  return contrastRatio(accent, header) >= 2.5 ? accent : readableOn(header);
}

interface Template {
  id: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  gstNumber: string;
  paymentTerms: string;
  logoUrl?: string;
  logoSize?: number;
  logoAlignment?: "left" | "center" | "right";
}

type LogoAlignment = "left" | "center" | "right";

export default function SettingsCompany() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Template>>({});
  const [loaded, setLoaded] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; data: Template }>({
    queryKey: ["/api/templates/default/invoice"],
    select: (d) => d,
  });

  // Email/AI identity + invoice bank details live in business_settings (separate
  // store from the document-template branding above). These drive the branded-email
  // header, AI-drafted replies, and the invoice payment block. GST is shared and is
  // synced to both stores on save. The brand name is the email wordmark (can differ
  // from the legal company name above). Bank details default blank — a tenant's
  // invoice shows no payment block until set, never another business's account.
  type BizFields = {
    businessName: string;
    ownerName: string;
    businessTagline: string;
    businessDiscipline: string;
    tradeVocabulary: string;
    bankAccountName: string;
    bankAccountNumber: string;
    brandHeaderColor: string;
    brandAccentColor: string;
    jobReplyForwardEmail: string;
  };
  const { data: bizData } = useQuery<{ success: boolean; data: Partial<BizFields> }>({
    queryKey: ["/api/business-settings"],
  });
  const [biz, setBiz] = useState<BizFields>({
    businessName: "", ownerName: "", businessTagline: "", businessDiscipline: "",
    tradeVocabulary: "",
    bankAccountName: "", bankAccountNumber: "",
    brandHeaderColor: "#0b0b0b", brandAccentColor: "#39FF14",
    jobReplyForwardEmail: "",
  });
  const [bizLoaded, setBizLoaded] = useState(false);
  if (bizData?.data && !bizLoaded) {
    setBiz({
      businessName: bizData.data.businessName ?? "",
      ownerName: bizData.data.ownerName ?? "",
      businessTagline: bizData.data.businessTagline ?? "",
      businessDiscipline: bizData.data.businessDiscipline ?? "",
      tradeVocabulary: bizData.data.tradeVocabulary ?? "",
      bankAccountName: bizData.data.bankAccountName ?? "",
      bankAccountNumber: bizData.data.bankAccountNumber ?? "",
      brandHeaderColor: bizData.data.brandHeaderColor || "#0b0b0b",
      brandAccentColor: bizData.data.brandAccentColor || "#39FF14",
      jobReplyForwardEmail: bizData.data.jobReplyForwardEmail ?? "",
    });
    setBizLoaded(true);
  }
  const setB = (field: keyof BizFields, value: string) =>
    setBiz((b) => ({ ...b, [field]: value }));

  if (!isLoading && data?.data && !loaded) {
    const rawAlign = (data.data as Template).logoAlignment;
    const alignment: LogoAlignment =
      rawAlign === "center" || rawAlign === "right" ? rawAlign : "left";
    setForm({
      companyName: data.data.companyName ?? "",
      companyAddress: data.data.companyAddress ?? "",
      companyPhone: data.data.companyPhone ?? "",
      companyEmail: data.data.companyEmail ?? "",
      gstNumber: data.data.gstNumber ?? "",
      paymentTerms: data.data.paymentTerms ?? "",
      logoUrl: data.data.logoUrl ?? "",
      logoSize: (data.data as Template).logoSize ?? 40,
      logoAlignment: alignment,
    });
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: Partial<Template>) => {
      const id = data?.data?.id;
      if (!id) throw new Error("No template found");
      // 1) PDF/document branding store.
      await apiRequest("PUT", `/api/templates/${id}`, values);
      // 2) Email/AI identity + invoice bank store. GST is the one shared value —
      //    write the same number to both so emails and invoices never disagree.
      await apiRequest("PUT", "/api/business-settings", {
        businessName: biz.businessName,
        ownerName: biz.ownerName,
        businessTagline: biz.businessTagline,
        businessDiscipline: biz.businessDiscipline,
        tradeVocabulary: biz.tradeVocabulary,
        bankAccountName: biz.bankAccountName,
        bankAccountNumber: biz.bankAccountNumber,
        brandHeaderColor: biz.brandHeaderColor,
        brandAccentColor: biz.brandAccentColor,
        jobReplyForwardEmail: biz.jobReplyForwardEmail.trim(),
        businessGstNumber: values.gstNumber ?? "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates/default/invoice"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const logoMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/templates/upload-logo", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = (await res.json()) as { success: boolean; url: string };

      // Propagate the new logo to every default document template so the
      // proposal/quote/invoice builders and viewers all show it. We do this
      // from the client so it works regardless of server-side sync behaviour.
      const types = ["invoice", "proposal", "quote"] as const;
      const defaults = await Promise.all(
        types.map(async (type) => {
          try {
            const r = await fetch(`/api/templates/default/${type}`, { credentials: "include" });
            if (!r.ok) return null;
            const body = (await r.json()) as { success?: boolean; data?: { id?: string } };
            return body?.data?.id ?? null;
          } catch {
            return null;
          }
        }),
      );
      await Promise.all(
        defaults
          .filter((id): id is string => !!id)
          .map((id) => apiRequest("PUT", `/api/templates/${id}`, { logoUrl: url })),
      );

      return { url };
    },
    onSuccess: (result) => {
      const url = result.url;
      setLogoPreview(url);
      setForm((f) => ({ ...f, logoUrl: url }));
      queryClient.invalidateQueries({ queryKey: ["/api/templates/default/proposal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates/default/quote"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates/default/invoice"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
    },
    onError: () => {
      toast({ title: "Logo upload failed", variant: "destructive" });
    },
  });

  const set = (field: keyof Template, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Propagate logoSize / logoAlignment to the default templates for invoice,
  // proposal and quote (same pattern as the logo upload mutation). Debounced
  // by a short delay so dragging the slider doesn't fire a request per pixel.
  const layoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleLayoutSave = (patch: { logoSize?: number; logoAlignment?: LogoAlignment }) => {
    if (layoutTimer.current) clearTimeout(layoutTimer.current);
    layoutTimer.current = setTimeout(async () => {
      const types = ["invoice", "proposal", "quote"] as const;
      try {
        const defaults = await Promise.all(
          types.map(async (type) => {
            try {
              const r = await fetch(`/api/templates/default/${type}`, { credentials: "include" });
              if (!r.ok) return null;
              const body = (await r.json()) as { success?: boolean; data?: { id?: string } };
              return body?.data?.id ?? null;
            } catch {
              return null;
            }
          }),
        );
        await Promise.all(
          defaults
            .filter((id): id is string => !!id)
            .map((id) => apiRequest("PUT", `/api/templates/${id}`, patch)),
        );
        queryClient.invalidateQueries({ queryKey: ["/api/templates/default/proposal"] });
        queryClient.invalidateQueries({ queryKey: ["/api/templates/default/quote"] });
        queryClient.invalidateQueries({ queryKey: ["/api/templates/default/invoice"] });
      } catch {
        toast({ title: "Couldn't save logo layout", variant: "destructive" });
      }
    }, 400);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    logoMutation.mutate(file);
  };

  const currentLogo = logoPreview || form.logoUrl;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            Company Info
            <HelpLink slug="set-up-your-business-details" />
          </h1>
          <p className="text-sm text-muted-foreground">
            These details appear on your invoices, quotes and proposals
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-5">
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Image className="w-4 h-4 text-muted-foreground" />
            Company Logo
            <HelpLink slug="upload-your-logo" />
          </Label>

          {/* Header preview — mirrors the document header so users can see
              what their logo will look like at the chosen size and alignment */}
          <div className="rounded-md border bg-white overflow-hidden">
            <div
              className={`flex items-center px-4 ${
                (form.logoAlignment ?? "left") === "center"
                  ? "justify-center"
                  : (form.logoAlignment ?? "left") === "right"
                  ? "justify-end"
                  : "justify-start"
              }`}
              style={{ height: 96 }}
            >
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt="Logo"
                  className="w-auto object-contain"
                  style={{ height: `${form.logoSize ?? 40}px`, maxHeight: 80 }}
                />
              ) : (
                <div className="h-12 w-32 rounded border border-dashed flex items-center justify-center bg-muted">
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="px-4 py-1.5 border-t bg-muted/40 text-[11px] text-muted-foreground">
              Header preview — shown on proposals, quotes and invoices
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoMutation.isPending}
            >
              <Upload className="w-3 h-3 mr-1" />
              {logoMutation.isPending ? "Uploading…" : "Upload logo"}
            </Button>
            <span className="text-xs text-muted-foreground">PNG, JPG, WebP or SVG</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end pt-1">
            {/* Size slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Logo size</Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {form.logoSize ?? 40}px
                </span>
              </div>
              <Slider
                min={24}
                max={120}
                step={2}
                value={[form.logoSize ?? 40]}
                onValueChange={([v]) => {
                  setForm((f) => ({ ...f, logoSize: v }));
                  scheduleLayoutSave({ logoSize: v });
                }}
              />
            </div>

            {/* Alignment buttons */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Alignment</Label>
              <div className="inline-flex rounded-md border overflow-hidden">
                {([
                  { v: "left", Icon: AlignLeft, label: "Left" },
                  { v: "center", Icon: AlignCenter, label: "Centre" },
                  { v: "right", Icon: AlignRight, label: "Right" },
                ] as const).map(({ v, Icon, label }) => {
                  const current = (form.logoAlignment ?? "left") === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-label={label}
                      aria-pressed={current}
                      onClick={() => {
                        setForm((f) => ({ ...f, logoAlignment: v }));
                        scheduleLayoutSave({ logoAlignment: v });
                      }}
                      className={`px-3 py-1.5 text-xs flex items-center gap-1 border-r last:border-r-0 ${
                        current ? "bg-primary text-primary-foreground" : "bg-background"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-1">
          <Label className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Company Name
          </Label>
          <Input
            value={form.companyName ?? ""}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="e.g. Treemarkables LTD"
          />
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Address
          </Label>
          <Textarea
            value={form.companyAddress ?? ""}
            onChange={(e) => set("companyAddress", e.target.value)}
            placeholder="e.g. 213 Stanley Road, Gisborne"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Phone
            </Label>
            <Input
              value={form.companyPhone ?? ""}
              onChange={(e) => set("companyPhone", e.target.value)}
              placeholder="e.g. 027 216 6882"
            />
          </div>

          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email
            </Label>
            <Input
              type="email"
              value={form.companyEmail ?? ""}
              onChange={(e) => set("companyEmail", e.target.value)}
              placeholder="e.g. invoices@treemarkables.nz"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-muted-foreground" />
            GST Number
            <HelpLink slug="configure-pricing-and-gst" />
          </Label>
          <Input
            value={form.gstNumber ?? ""}
            onChange={(e) => set("gstNumber", e.target.value)}
            placeholder="e.g. 131-047-592-GST004"
          />
          <p className="text-xs text-muted-foreground">Shown on your invoices and in customer emails.</p>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            Payment Terms
          </Label>
          <Input
            value={form.paymentTerms ?? ""}
            onChange={(e) => set("paymentTerms", e.target.value)}
            placeholder="e.g. Payment due within 7 days"
          />
        </div>

        <Separator />

        {/* Bank details (business_settings) — shown on invoices so customers pay the
            RIGHT business. Blank = no payment block on the invoice. */}
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Landmark className="w-4 h-4 text-muted-foreground" />
            Bank details
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shown on your invoices so customers know where to pay. Leave blank to hide the payment block.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Account name</Label>
            <Input
              value={biz.bankAccountName}
              onChange={(e) => setB("bankAccountName", e.target.value)}
              placeholder="e.g. Treemarkables Ltd"
            />
          </div>
          <div className="space-y-1">
            <Label>Account number</Label>
            <Input
              value={biz.bankAccountNumber}
              onChange={(e) => setB("bankAccountNumber", e.target.value)}
              placeholder="e.g. 06-0637-0768850-00"
            />
          </div>
        </div>

        <Separator />

        {/* Email + AI identity (business_settings) — distinct from the legal/PDF
            details above. Brand name + tagline render in the branded-email header;
            owner name signs AI-drafted replies; trade shapes AI prompts. */}
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            Emails &amp; AI
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            How your business appears in customer emails and AI-drafted replies. Your invoices use the legal details above.
          </p>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-2">
            <Type className="w-4 h-4 text-muted-foreground" />
            Brand name
          </Label>
          <Input
            value={biz.businessName}
            onChange={(e) => setB("businessName", e.target.value)}
            placeholder="e.g. Treemarkables"
          />
          <p className="text-xs text-muted-foreground">Shown as the wordmark at the top of customer emails (can be shorter than your legal name).</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Owner name
            </Label>
            <Input
              value={biz.ownerName}
              onChange={(e) => setB("ownerName", e.target.value)}
              placeholder="e.g. Jules"
            />
            <p className="text-xs text-muted-foreground">Signs your AI-drafted email replies.</p>
          </div>

          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              Trade
            </Label>
            <Input
              value={biz.businessDiscipline}
              onChange={(e) => setB("businessDiscipline", e.target.value)}
              placeholder="e.g. arborist, plumber"
            />
            <p className="text-xs text-muted-foreground">Used in AI prompts — “a New Zealand … business”.</p>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-2">
            <Type className="w-4 h-4 text-muted-foreground" />
            Speech-to-quote vocabulary
          </Label>
          <Textarea
            value={biz.tradeVocabulary}
            onChange={(e) => setB("tradeVocabulary", e.target.value)}
            placeholder="e.g. PEX, copper, backflow, isolation valve, hot-water cylinder, rough-in"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">Your trade's terms — biases video-walkthrough transcription so it spells them right instead of inventing words. Leave blank for a generic field-service bias.</p>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            Tagline
          </Label>
          <Input
            value={biz.businessTagline}
            onChange={(e) => setB("businessTagline", e.target.value)}
            placeholder="e.g. Qualified Arborists"
          />
          <p className="text-xs text-muted-foreground">Appears under your brand name in the email header.</p>
        </div>

        {/* Forward customer replies to an inbox (business_settings.jobReplyForwardEmail).
            Blank = off; replies still appear on the job card either way. */}
        <div className="space-y-1">
          <Label className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            Forward customer replies to
          </Label>
          <Input
            type="email"
            value={biz.jobReplyForwardEmail}
            onChange={(e) => setB("jobReplyForwardEmail", e.target.value)}
            placeholder="you@yourbusiness.co.nz"
          />
          <p className="text-xs text-muted-foreground">
            Optional. When a customer replies to a job email, send a copy to this inbox so you also get it in your normal email. Leave blank to keep replies on the job card only. Replies you send go straight back to the customer.
          </p>
        </div>

        {/* Email brand colours (business_settings) — drive the header band, accent
            rule and buttons in customer emails. Text colour is auto-computed for
            contrast so any combination stays legible. */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-muted-foreground" />
            Email brand colours
          </Label>
          <p className="text-xs text-muted-foreground">
            Used for the header band, accent line and buttons in your customer emails. Text colour adjusts automatically for readability.
          </p>

          {/* Live preview — mirrors the sent email's header + accent + CTA */}
          <div className="rounded-md border overflow-hidden">
            <div style={{ background: biz.brandHeaderColor, padding: "16px 18px" }}>
              <div
                style={{
                  color: wordmarkOn(biz.brandAccentColor, biz.brandHeaderColor),
                  fontWeight: 800,
                  fontSize: 18,
                  lineHeight: 1,
                  textTransform: "uppercase",
                  letterSpacing: "-0.01em",
                }}
              >
                {biz.businessName || "Your business"}
              </div>
              {biz.businessTagline ? (
                <div style={{ color: "#9ca3af", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>
                  {biz.businessTagline}
                </div>
              ) : null}
            </div>
            <div style={{ height: 3, background: biz.brandAccentColor }} />
            <div className="bg-white px-[18px] py-3">
              <span
                style={{
                  display: "inline-block",
                  background: biz.brandAccentColor,
                  color: readableOn(biz.brandAccentColor),
                  padding: "8px 16px",
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                View &amp; pay invoice online
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Header background</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Header background colour"
                  value={biz.brandHeaderColor}
                  onChange={(e) => setB("brandHeaderColor", e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer bg-transparent p-0.5"
                />
                <Input
                  value={biz.brandHeaderColor}
                  onChange={(e) => setB("brandHeaderColor", e.target.value)}
                  placeholder="#0b0b0b"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Accent</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Accent colour"
                  value={biz.brandAccentColor}
                  onChange={(e) => setB("brandAccentColor", e.target.value)}
                  className="h-9 w-12 rounded border cursor-pointer bg-transparent p-0.5"
                />
                <Input
                  value={biz.brandAccentColor}
                  onChange={(e) => setB("brandAccentColor", e.target.value)}
                  placeholder="#39FF14"
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
