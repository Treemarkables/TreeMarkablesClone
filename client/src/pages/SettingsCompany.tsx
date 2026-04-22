import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Upload, Building2, Phone, Mail, MapPin, Hash, CreditCard, Image } from "lucide-react";
import { Link } from "wouter";

interface Template {
  id: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  gstNumber: string;
  paymentTerms: string;
  logoUrl?: string;
}

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

  if (!isLoading && data?.data && !loaded) {
    setForm({
      companyName: data.data.companyName ?? "",
      companyAddress: data.data.companyAddress ?? "",
      companyPhone: data.data.companyPhone ?? "",
      companyEmail: data.data.companyEmail ?? "",
      gstNumber: data.data.gstNumber ?? "",
      paymentTerms: data.data.paymentTerms ?? "",
      logoUrl: data.data.logoUrl ?? "",
    });
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: Partial<Template>) => {
      const id = data?.data?.id;
      if (!id) throw new Error("No template found");
      return apiRequest("PUT", `/api/templates/${id}`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates/default/invoice"] });
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
          <h1 className="text-xl font-semibold">Company Info</h1>
          <p className="text-sm text-muted-foreground">
            These details appear on your invoices, quotes and proposals
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Image className="w-4 h-4 text-muted-foreground" />
            Company Logo
          </Label>
          <div className="flex items-center gap-4">
            {currentLogo ? (
              <img
                src={currentLogo}
                alt="Logo"
                className="h-16 max-w-48 object-contain rounded border bg-white p-1"
              />
            ) : (
              <div className="h-16 w-32 rounded border border-dashed flex items-center justify-center bg-muted">
                <Building2 className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="space-y-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoMutation.isPending}
              >
                <Upload className="w-3 h-3 mr-1" />
                {logoMutation.isPending ? "Uploading…" : "Upload logo"}
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPG, WebP or SVG — shown on all proposals, quotes, invoices, PDFs and emails</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleFileChange}
            />
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
          </Label>
          <Input
            value={form.gstNumber ?? ""}
            onChange={(e) => set("gstNumber", e.target.value)}
            placeholder="e.g. 131-047-592-GST004"
          />
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
