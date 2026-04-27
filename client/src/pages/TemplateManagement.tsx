import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Edit,
  Trash2,
  Copy,
  Eye,
  FileText,
  Receipt,
  DollarSign,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { DocumentTemplate, InsertDocumentTemplate, InvoiceSectionConfig } from "@shared/schema";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";

const MOCK_INVOICE = {
  id: "preview",
  invoiceNumber: "INV-0042",
  customerId: "preview",
  amount: 1500,
  status: "draft" as const,
  dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
  issueDate: new Date().toISOString(),
  notes: "Tree removal and stump grinding at the property.",
};

const MOCK_CUSTOMER = {
  id: "preview",
  name: "Jane Smith",
  email: "jane@example.com",
  address: "45 Palm Drive, Gisborne",
  phone: "021 555 0123",
  createdAt: new Date().toISOString(),
};

const MOCK_LINE_ITEMS = [
  { id: "1", description: "Tree Removal (Large Totara)", quantity: 1, unitPrice: 800, total: 800 },
  { id: "2", description: "Stump Grinding", quantity: 2, unitPrice: 200, total: 400 },
  { id: "3", description: "Site Cleanup & Green Waste Disposal", quantity: 1, unitPrice: 300, total: 300 },
];

const DEFAULT_SECTIONS: InvoiceSectionConfig[] = [
  { id: "header",      label: "Header & Logo",          visible: true, locked: true },
  { id: "billTo",      label: "Bill To",                visible: true, locked: false },
  { id: "description", label: "Description / Notes",    visible: true, locked: false },
  { id: "lineItems",   label: "Services & Line Items",  visible: true, locked: false },
  { id: "totals",      label: "Totals & GST",           visible: true, locked: true },
  { id: "payment",     label: "Payment Information",    visible: true, locked: false },
  { id: "footer",      label: "Business Footer",        visible: true, locked: false },
];

function normaliseSections(raw: unknown): InvoiceSectionConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_SECTIONS.map(s => ({ ...s }));
  // Merge saved sections with defaults so new sections are appended
  const savedIds = (raw as InvoiceSectionConfig[]).map(s => s.id);
  const merged = [
    ...(raw as InvoiceSectionConfig[]),
    ...DEFAULT_SECTIONS.filter(d => !savedIds.includes(d.id)),
  ];
  return merged;
}

const templateFormSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  type: z.enum(["quote", "proposal", "invoice"]),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  companyName: z.string().default("Treemarkables LTD"),
  companyAddress: z.string().default("Hauroa rd\nGisborne, 4010"),
  companyEmail: z.string().default("quotes@treemarkables.nz"),
  companyPhone: z.string().default("027 216 6882"),
  gstNumber: z.string().default("131-047-592-GST004"),
  paymentTerms: z.string().default("Payment due within 7 days"),
  primaryColor: z.string().default("#f97316"),
  secondaryColor: z.string().default("#3b82f6"),
  headerColor: z.string().default("#ffffff"),
  logoUrl: z.string().nullable().optional(),
  logoSize: z.number().min(20).max(200).default(40),
  logoAlignment: z.enum(["left", "center", "right"]).default("left"),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

export default function TemplateManagement() {
  const [selectedType, setSelectedType] = useState<
    "all" | "quote" | "proposal" | "invoice"
  >("all");
  const [editingTemplate, setEditingTemplate] =
    useState<DocumentTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      type: "quote",
      description: "",
      isDefault: false,
      isActive: true,
      companyName: "Treemarkables LTD",
      companyAddress: "Hauroa rd\nGisborne, 4010",
      companyEmail: "quotes@treemarkables.nz",
      companyPhone: "027 216 6882",
      gstNumber: "131-047-592-GST004",
      paymentTerms: "Payment due within 7 days",
      primaryColor: "#f97316",
      secondaryColor: "#3b82f6",
      headerColor: "#ffffff",
      logoUrl: null,
      logoSize: 40,
      logoAlignment: "left",
    },
  });

  const [sections, setSections] = useState<InvoiceSectionConfig[]>(() =>
    DEFAULT_SECTIONS.map(s => ({ ...s }))
  );

  // Fetch all templates
  const {
    data: templatesResponse,
    isLoading,
    refetch,
  } = useQuery<{ success: boolean; data: DocumentTemplate[] }>({
    queryKey: ["/api/templates"],
  });
  const templates: DocumentTemplate[] = templatesResponse?.data ?? [];

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const response = await apiRequest("POST", "/api/templates", data);
      return response.json();
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      refetch();
    },
    onError: () => {
      toast({ title: "Error creating template", variant: "destructive" });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<TemplateFormData>;
    }) => {
      const response = await apiRequest("PUT", `/api/templates/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingTemplate(null);
      refetch();
    },
    onError: () => {
      toast({ title: "Error updating template", variant: "destructive" });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/templates/${id}`);
      return response.json();
    },
    onSuccess: () => {
      refetch();
    },
    onError: () => {
      toast({ title: "Error deleting template", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PUT", `/api/templates/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      refetch();
    },
    onError: () => {
      toast({ title: "Error updating template status", variant: "destructive" });
    },
  });

  const watchedValues = form.watch();

  // Build a live preview template from the current form state + sections
  const previewTemplate = {
    id: "preview",
    name: watchedValues.name || "Preview Template",
    type: watchedValues.type || "invoice",
    description: watchedValues.description || null,
    isDefault: watchedValues.isDefault ?? false,
    isActive: watchedValues.isActive ?? true,
    companyName: watchedValues.companyName || "Treemarkables LTD",
    companyAddress: watchedValues.companyAddress || "213 Stanley Road, Gisborne",
    companyEmail: watchedValues.companyEmail || "quotes@treemarkables.nz",
    companyPhone: watchedValues.companyPhone || "027 216 6882",
    gstNumber: watchedValues.gstNumber || "131-047-592",
    paymentTerms: watchedValues.paymentTerms || "Payment due within 7 days",
    primaryColor: watchedValues.primaryColor || "#f97316",
    secondaryColor: watchedValues.secondaryColor || "#3b82f6",
    headerColor: watchedValues.headerColor || "#ffffff",
    headerLayout: null,
    footerText: null,
    logoUrl: watchedValues.logoUrl || null,
    logoSize: watchedValues.logoSize ?? 40,
    logoAlignment: watchedValues.logoAlignment ?? "left",
    sectionConfig: sections,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const onSubmit = (data: TemplateFormData) => {
    const payload = { ...data, sectionConfig: sections };
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: payload });
    } else {
      createTemplateMutation.mutate(payload as TemplateFormData);
    }
  };

  const handleEdit = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setSections(normaliseSections(template.sectionConfig));
    form.reset({
      name: template.name,
      type: template.type as "quote" | "proposal" | "invoice",
      description: template.description || "",
      isDefault: template.isDefault,
      isActive: template.isActive,
      companyName: template.companyName || "Treemarkables LTD",
      companyAddress: template.companyAddress || "Hauroa rd\nGisborne, 4010",
      companyEmail: template.companyEmail || "quotes@treemarkables.nz",
      companyPhone: template.companyPhone || "027 216 6882",
      gstNumber: template.gstNumber || "131-047-592-GST004",
      paymentTerms: template.paymentTerms || "Payment due within 7 days",
      primaryColor: template.primaryColor || "#f97316",
      secondaryColor: template.secondaryColor || "#3b82f6",
      headerColor: (template.headerColor as string) || "#ffffff",
      logoUrl: template.logoUrl || null,
      logoSize: template.logoSize ?? 40,
      logoAlignment: (template.logoAlignment as "left" | "center" | "right") ?? "left",
    });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setSections(DEFAULT_SECTIONS.map(s => ({ ...s })));
    form.reset({
      name: "",
      type: "quote",
      description: "",
      isDefault: false,
      isActive: true,
      companyName: "Treemarkables LTD",
      companyAddress: "Hauroa rd\nGisborne, 4010",
      companyEmail: "quotes@treemarkables.nz",
      companyPhone: "027 216 6882",
      gstNumber: "131-047-592-GST004",
      paymentTerms: "Payment due within 7 days",
      primaryColor: "#f97316",
      secondaryColor: "#3b82f6",
      headerColor: "#ffffff",
      logoUrl: null,
      logoSize: 40,
      logoAlignment: "left",
    });
    setIsDialogOpen(true);
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= sections.length) return;
    setSections(prev => {
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
  };

  const toggleSection = (index: number) => {
    setSections(prev =>
      prev.map((s, i) => (i === index ? { ...s, visible: !s.visible } : s))
    );
  };

  const renameSection = (index: number, label: string) => {
    setSections(prev =>
      prev.map((s, i) => (i === index ? { ...s, label } : s))
    );
  };

  const filteredTemplates = templates.filter(
    (template: DocumentTemplate) =>
      selectedType === "all" || template.type === selectedType,
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "quote":
        return <DollarSign className="h-4 w-4" />;
      case "proposal":
        return <FileText className="h-4 w-4" />;
      case "invoice":
        return <Receipt className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "quote":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "proposal":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "invoice":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Document Templates
          </h1>
          <p className="text-muted-foreground">
            Manage your quote, proposal, and invoice templates with
            Treemarkables branding
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={handleCreate}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-create-template"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] w-full max-h-[95vh] p-0 overflow-hidden flex flex-col">
            <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
              <DialogTitle>
                {editingTemplate ? "Edit Template" : "Create New Template"}
              </DialogTitle>
            </DialogHeader>
            {/* Split pane: form left, preview right */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Form panel */}
              <div className="w-full lg:w-[420px] flex-shrink-0 overflow-y-auto border-r px-6 py-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Standard Quote Template"
                            {...field}
                            data-testid="input-template-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-template-type">
                              <SelectValue placeholder="Select template type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="quote">Quote</SelectItem>
                            <SelectItem value="proposal">Proposal</SelectItem>
                            <SelectItem value="invoice">Invoice</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Template description..."
                          {...field}
                          data-testid="textarea-template-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Default Template</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Use as default for this document type
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-template-default"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Active Template</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Available for use
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-template-active"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <Tabs defaultValue="company" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="company">Company</TabsTrigger>
                    <TabsTrigger value="styling">Styling</TabsTrigger>
                    <TabsTrigger value="terms">Terms</TabsTrigger>
                    <TabsTrigger value="sections">Sections</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>

                  <TabsContent value="company" className="space-y-4">
                    <div className="rounded-md border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
                      Company logo is managed globally in <span className="font-medium">Settings → Company</span> and applies to every proposal, quote, invoice, PDF and email.
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-company-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="companyEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Email</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-company-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="companyPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Phone</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-company-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="gstNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>GST Number</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                data-testid="input-gst-number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="companyAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Address</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              data-testid="textarea-company-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="styling" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="headerColor"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Header Background Color</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  {...field}
                                  value={field.value || "#ffffff"}
                                  className="w-20"
                                  data-testid="input-header-color"
                                />
                                <Input
                                  {...field}
                                  value={field.value || "#ffffff"}
                                  placeholder="#ffffff"
                                  data-testid="input-header-color-text"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="primaryColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Color (Orange)</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  {...field}
                                  className="w-20"
                                  data-testid="input-primary-color"
                                />
                                <Input
                                  {...field}
                                  placeholder="#f97316"
                                  data-testid="input-primary-color-text"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="secondaryColor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secondary Color (Blue)</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  {...field}
                                  className="w-20"
                                  data-testid="input-secondary-color"
                                />
                                <Input
                                  {...field}
                                  placeholder="#3b82f6"
                                  data-testid="input-secondary-color-text"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="terms" className="space-y-4">
                    <FormField
                      control={form.control}
                      name="paymentTerms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Terms</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Payment due within 7 days"
                              data-testid="textarea-payment-terms"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="sections" className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Click any section name to rename it. Toggle sections on or off, and use the arrows to reorder them on the document.
                      Locked sections (like the header and totals) cannot be hidden.
                    </p>
                    <div className="space-y-2" data-testid="section-list">
                      {sections.map((section, index) => (
                        <div
                          key={section.id}
                          className={`flex items-center gap-3 p-3 rounded-md border ${
                            section.visible ? "bg-card" : "bg-muted/40 opacity-60"
                          }`}
                          data-testid={`section-row-${section.id}`}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <input
                            className="flex-1 text-sm font-medium bg-transparent border-0 outline-none focus:bg-background focus:border focus:border-input focus:rounded focus:px-2 focus:py-0.5 transition-all min-w-0"
                            value={section.label}
                            onChange={e => renameSection(index, e.target.value)}
                            placeholder="Section name"
                            aria-label={`Rename ${section.label} section`}
                          />
                          {section.locked && (
                            <Badge variant="secondary" className="text-xs">Always on</Badge>
                          )}
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={index === 0}
                              onClick={() => moveSection(index, -1)}
                              data-testid={`button-section-up-${section.id}`}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={index === sections.length - 1}
                              onClick={() => moveSection(index, 1)}
                              data-testid={`button-section-down-${section.id}`}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Switch
                              checked={section.visible}
                              disabled={section.locked}
                              onCheckedChange={() => toggleSection(index)}
                              data-testid={`switch-section-${section.id}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="preview" className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Live Preview</span>
                      <Badge variant="secondary" className="text-xs">Sample data</Badge>
                    </div>
                    <div className="overflow-y-auto rounded-md border" style={{ maxHeight: "55vh" }}>
                      <InvoiceTemplate
                        template={previewTemplate as any}
                        invoice={MOCK_INVOICE}
                        customer={MOCK_CUSTOMER as any}
                        lineItems={MOCK_LINE_ITEMS}
                        description="Tree removal and stump grinding at the property. All debris removed and site left clean."
                        jobAddress="45 Palm Drive, Gisborne"
                        billingName="Jane Smith"
                        sectionConfig={sections}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-template"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-orange-600 hover:bg-orange-700"
                    disabled={
                      createTemplateMutation.isPending ||
                      updateTemplateMutation.isPending
                    }
                    data-testid="button-save-template"
                  >
                    {editingTemplate ? "Update Template" : "Create Template"}
                  </Button>
                </div>
              </form>
            </Form>
              </div>{/* end form panel */}

              {/* Live preview panel — only on very wide screens; smaller screens use the Preview tab */}
              <div className="hidden xl:flex flex-1 flex-col overflow-y-auto bg-muted/30 p-5 gap-3">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Live Preview</span>
                  <Badge variant="secondary" className="text-xs">Sample data</Badge>
                </div>
                <div
                  style={{ transformOrigin: "top left", transform: "scale(0.72)", width: "138.9%", pointerEvents: "none" }}
                  className="select-none"
                >
                  <InvoiceTemplate
                    template={previewTemplate as any}
                    invoice={MOCK_INVOICE}
                    customer={MOCK_CUSTOMER as any}
                    lineItems={MOCK_LINE_ITEMS}
                    description="Tree removal and stump grinding at the property. All debris removed and site left clean."
                    jobAddress="45 Palm Drive, Gisborne"
                    billingName="Jane Smith"
                    sectionConfig={sections}
                  />
                </div>
              </div>
            </div>{/* end split pane */}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Tabs */}
      <Tabs
        value={selectedType}
        onValueChange={(value) => setSelectedType(value as any)}
      >
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-templates">
            All Templates
          </TabsTrigger>
          <TabsTrigger value="quote" data-testid="tab-quote-templates">
            Quotes
          </TabsTrigger>
          <TabsTrigger value="proposal" data-testid="tab-proposal-templates">
            Proposals
          </TabsTrigger>
          <TabsTrigger value="invoice" data-testid="tab-invoice-templates">
            Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedType} className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-muted rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No templates found
                </h3>
                <p className="text-muted-foreground mb-4">
                  {selectedType === "all"
                    ? "Create your first document template to get started."
                    : `No ${selectedType} templates exist yet.`}
                </p>
                <Button
                  onClick={handleCreate}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template: DocumentTemplate) => (
                <Card
                  key={template.id}
                  className="hover-elevate transition-all duration-200"
                  data-testid={`card-template-${template.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(template.type)}
                        <CardTitle className="text-lg">
                          {template.name}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-1">
                        {template.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                        <Badge
                          className={`text-xs ${getTypeColor(template.type)}`}
                        >
                          {template.type.charAt(0).toUpperCase() +
                            template.type.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium">Company:</span>
                        <span>{template.companyName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-muted-foreground">Status:</span>
                        <Switch
                          checked={template.isActive}
                          disabled={toggleActiveMutation.isPending}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: template.id, isActive: checked })
                          }
                          data-testid={`switch-template-active-${template.id}`}
                        />
                        <span className={template.isActive ? "text-foreground" : "text-muted-foreground"}>
                          {template.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(template)}
                            data-testid={`button-edit-template-${template.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-preview-template-${template.id}`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            data-testid={`button-copy-template-${template.id}`}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            deleteTemplateMutation.mutate(template.id)
                          }
                          disabled={deleteTemplateMutation.isPending}
                          data-testid={`button-delete-template-${template.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
