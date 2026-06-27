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
import { ChevronLeft, Upload, Building2, Phone, Mail, MapPin, Hash, CreditCard, Image, AlignLeft, AlignCenter, AlignRight, Type, User, Tag, Briefcase } from "lucide-react";
import { Link } from "wouter";
import { HelpLink } from "@/components/HelpLink";

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

  // Email + AI identity lives in a separate store (business_settings) from the
  // PDF/document branding above (document_templates). These fields drive the
  // branded-email header + AI-drafted replies; GST is the one shared value and is
  // synced to both stores on save (see saveMutation) so they never disagree.
  type BizIdentity = { businessName: string; ownerName: string; businessTagline: string; businessDiscipline: string };
  const { data: bizData } = useQuery<{ success: boolean; data: Partial<BizIdentity> }>({
    queryKey: ["/api/business-settings"],
  });
  const [biz, setBiz] = useState<BizIdentity>({ businessName: "", ownerName: "", businessTagline: "", businessDiscipline: "" });
  const [bizLoaded, setBizLoaded] = useState(false);
  if (bizData?.data && !bizLoaded) {
    setBiz({
      businessName: bizData.data.businessName ?? "",
      ownerName: bizData.data.ownerName ?? "",
      businessTagline: bizData.data.businessTagline ?? "",
      businessDiscipline: bizData.data.businessDiscipline ?? "",
    });
    setBizLoaded(true);
  }
  const setB = (field: keyof BizIdentity, value: string) =>
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
      // 2) Email + AI identity store. GST is the one shared value — write the same
      //    number to both so a tenant's emails and invoices never disagree.
      await apiRequest("PUT", "/api/business-settings", {
        businessName: biz.businessName,
        ownerName: biz.ownerName,
        businessTagline: biz.businessTagline,
        businessDiscipline: biz.businessDiscipline,
        businessGstNumber: values.gstNumber ?? "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates/default/invoice"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      toast({ title: "Company info saved" });
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

        {/* Email + AI identity (business_settings) — distinct from the legal/PDF
            details above. The brand name and tagline render in the branded-email
            header; the owner name signs AI-drafted replies; the trade shapes AI
            prompts. GST is shared with the invoice details above. */}
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
