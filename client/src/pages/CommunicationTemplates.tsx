import { useState, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  Paperclip,
  Eye,
  Search,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const TEMPLATE_CATEGORIES: { value: string; label: string; description: string }[] = [
  { value: "confirmation", label: "Job Scheduling Confirmation", description: "Used by AI Smart Dispatch when confirming scheduled jobs" },
  { value: "quote", label: "Quote / Proposal", description: "Sending quotes or proposals to customers" },
  { value: "invoice", label: "Invoice", description: "Invoice delivery and payment requests" },
  { value: "job_status", label: "Job Status Update", description: "Notifying customers of job progress" },
  { value: "reminder", label: "Reminder", description: "Follow-up and reminder messages" },
  { value: "welcome", label: "Welcome", description: "New customer welcome messages" },
  { value: "custom_message", label: "Other", description: "General purpose templates" },
];

const categoryLabel = (value: string) =>
  TEMPLATE_CATEGORIES.find(c => c.value === value)?.label ?? value;

const VARIABLE_GROUPS = [
  {
    label: "Customer",
    vars: [
      { token: "{customerName}", hint: "Full name" },
      { token: "{firstName}", hint: "First name" },
      { token: "{customerPhone}", hint: "Phone number" },
      { token: "{email}", hint: "Email address" },
    ],
  },
  {
    label: "Job",
    vars: [
      { token: "{jobNumber}", hint: "Job #" },
      { token: "{jobAddress}", hint: "Job address" },
      { token: "{jobDescription}", hint: "Description" },
      { token: "{scheduledDate}", hint: "Scheduled date" },
    ],
  },
  {
    label: "Financial",
    vars: [
      { token: "{totalAmount}", hint: "Total ($)" },
    ],
  },
  {
    label: "Company",
    vars: [
      { token: "{companyName}", hint: "Company name" },
      { token: "{companyPhone}", hint: "Company phone" },
    ],
  },
];

function substituteVariables(text: string, job: any, customer: any, settings?: any): string {
  if (!text) return "";
  const customerName = customer?.name || "Valued Customer";
  const firstName = customerName.split(" ")[0] || customerName;
  const phone = customer?.phone || job?.jobContactPhone || "";
  const address = job?.address || "123 Example St";
  const companyName = settings?.businessName || settings?.companyName || "Treemarkables LTD";
  const companyPhone = settings?.phone || settings?.companyPhone || "027 216 6882";
  return text
    .replace(/\{customerName\}/g, customerName)
    .replace(/\{firstName\}/g, firstName)
    // Canonical new tokens
    .replace(/\{customerPhone\}/g, phone)
    .replace(/\{jobAddress\}/g, address)
    // Legacy aliases kept for backward compat
    .replace(/\{phone\}/g, phone)
    .replace(/\{address\}/g, address)
    .replace(/\{email\}/g, customer?.email || job?.jobContactEmail || "")
    .replace(/\{jobNumber\}/g, job?.jobNumber || "JOB-001")
    .replace(/\{jobDescription\}/g, job?.description || "")
    .replace(/\{scheduledDate\}/g, job?.scheduledDate || "")
    .replace(/\{totalAmount\}/g, job?.totalAmount ? `$${job.totalAmount}` : "")
    .replace(/\{companyName\}/g, companyName)
    .replace(/\{companyPhone\}/g, companyPhone);
}

const emailTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  category: z.string().default("custom_message"),
  subject: z.string().min(1, "Subject is required"),
  htmlContent: z.string().min(1, "Message body is required"),
  textContent: z.string().optional(),
  variables: z.array(z.string()).default([]),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  attachInvoicePdf: z.boolean().default(false),
  createdBy: z.string().default("admin"),
});

const smsTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  category: z.string().default("custom_message"),
  message: z
    .string()
    .min(1, "Message is required")
    .max(306, "SMS must be 306 characters or less"),
  variables: z.array(z.string()).default([]),
  description: z.string().optional(),
  maxLength: z.number().default(306),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  createdBy: z.string().default("admin"),
});

type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>;
type SmsTemplateFormData = z.infer<typeof smsTemplateSchema>;

export default function CommunicationTemplates() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"email" | "sms">("email");
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Preview state
  const [previewJobSearch, setPreviewJobSearch] = useState("");
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Refs for cursor-position insertion
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const smsBodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedField = useRef<"subject" | "body" | "smsBody">("body");

  const emailForm = useForm<EmailTemplateFormData>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      name: "", category: "custom_message", subject: "", htmlContent: "",
      textContent: "", variables: [], description: "", isActive: true,
      isDefault: false, attachInvoicePdf: false, createdBy: "admin",
    },
  });

  const smsForm = useForm<SmsTemplateFormData>({
    resolver: zodResolver(smsTemplateSchema),
    defaultValues: {
      name: "", category: "custom_message", message: "", variables: [],
      description: "", maxLength: 306, isActive: true, isDefault: false, createdBy: "admin",
    },
  });

  const watchedSubject = emailForm.watch("subject");
  const watchedBody = emailForm.watch("htmlContent");
  const watchedSmsBody = smsForm.watch("message");

  // Fetch templates
  const { data: emailTemplates = [], isLoading: loadingEmail } = useQuery({
    queryKey: ["/api/email-templates"],
    select: (response: any) => response.data || [],
  });
  const { data: smsTemplates = [], isLoading: loadingSms } = useQuery({
    queryKey: ["/api/sms-templates"],
    select: (response: any) => response.data || [],
  });

  // Fetch business settings for company variable substitution
  const { data: businessSettingsData } = useQuery({
    queryKey: ["/api/business-settings"],
  });
  const businessSettings: any = (businessSettingsData as any)?.data || (businessSettingsData as any) || null;

  // Fetch jobs for preview
  const { data: jobsData } = useQuery({
    queryKey: ["/api/jobs", previewJobSearch],
    queryFn: async () => {
      const url = previewJobSearch.trim()
        ? `/api/jobs/search?q=${encodeURIComponent(previewJobSearch)}&limit=10`
        : `/api/jobs?limit=10`;
      const res = await fetch(url);
      return res.json();
    },
    enabled: isDialogOpen,
  });
  const jobList: any[] = Array.isArray(jobsData?.jobs)
    ? jobsData.jobs
    : Array.isArray(jobsData?.data)
      ? jobsData.data
      : [];

  // Fetch selected preview job + customer
  const { data: previewJobData } = useQuery({
    queryKey: ["/api/jobs", previewJobId],
    enabled: !!previewJobId,
  });
  const previewJob: any = (previewJobData as any)?.data || (previewJobData as any) || null;

  const { data: previewCustomerData } = useQuery({
    queryKey: ["/api/customers", previewJob?.customerId],
    enabled: !!previewJob?.customerId,
  });
  const previewCustomer: any = (previewCustomerData as any)?.data || (previewCustomerData as any) || null;

  // Mutations
  const saveEmailTemplateMutation = useMutation({
    mutationFn: async (data: EmailTemplateFormData) => {
      const endpoint = editingTemplate ? `/api/email-templates/${editingTemplate.id}` : "/api/email-templates";
      const method = editingTemplate ? "PUT" : "POST";
      return apiRequest(method, endpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      emailForm.reset();
    },
    onError: () => toast({ title: "Error", description: "Failed to save email template.", variant: "destructive" }),
  });

  const saveSmsTemplateMutation = useMutation({
    mutationFn: async (data: SmsTemplateFormData) => {
      const endpoint = editingTemplate ? `/api/sms-templates/${editingTemplate.id}` : "/api/sms-templates";
      const method = editingTemplate ? "PUT" : "POST";
      return apiRequest(method, endpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-templates"] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      smsForm.reset();
    },
    onError: () => toast({ title: "Error", description: "Failed to save SMS template.", variant: "destructive" }),
  });

  const deleteEmailTemplateMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/email-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] }),
  });

  const deleteSmsTemplateMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/sms-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sms-templates"] }),
  });

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setShowPreview(false);
    setPreviewJobId(null);
    if (activeTab === "email") {
      emailForm.reset({ name: "", category: "custom_message", subject: "", htmlContent: "",
        textContent: "", variables: [], description: "", isActive: true, isDefault: false,
        attachInvoicePdf: false, createdBy: "admin" });
    } else {
      smsForm.reset({ name: "", category: "custom_message", message: "", variables: [],
        description: "", maxLength: 306, isActive: true, isDefault: false, createdBy: "admin" });
    }
    setIsDialogOpen(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setShowPreview(false);
    setPreviewJobId(null);
    if (activeTab === "email") {
      emailForm.reset({
        name: template.name, category: template.category || "custom_message",
        subject: template.subject, htmlContent: template.htmlContent,
        textContent: template.textContent || "", variables: template.variables || [],
        description: template.description || "", isActive: template.isActive ?? true,
        isDefault: template.isDefault ?? false, attachInvoicePdf: template.attachInvoicePdf ?? false,
        createdBy: template.createdBy || "admin",
      });
    } else {
      smsForm.reset({
        name: template.name, category: template.category || "custom_message",
        message: template.message, variables: template.variables || [],
        description: template.description || "", maxLength: template.maxLength || 306,
        isActive: template.isActive ?? true, isDefault: template.isDefault ?? false,
        createdBy: template.createdBy || "admin",
      });
    }
    setIsDialogOpen(true);
  };

  const handleDeleteTemplate = (id: string) => {
    if (activeTab === "email") deleteEmailTemplateMutation.mutate(id);
    else deleteSmsTemplateMutation.mutate(id);
  };

  // Insert variable token at cursor in focused field
  const insertVariable = useCallback((token: string) => {
    if (activeTab === "email") {
      if (lastFocusedField.current === "subject") {
        const el = subjectRef.current;
        if (!el) return;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const current = emailForm.getValues("subject");
        const next = current.slice(0, start) + token + current.slice(end);
        emailForm.setValue("subject", next, { shouldDirty: true });
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + token.length, start + token.length);
        }, 0);
      } else {
        const el = bodyRef.current;
        if (!el) return;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? el.value.length;
        const current = emailForm.getValues("htmlContent");
        const next = current.slice(0, start) + token + current.slice(end);
        emailForm.setValue("htmlContent", next, { shouldDirty: true });
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + token.length, start + token.length);
        }, 0);
      }
    } else {
      const el = smsBodyRef.current;
      if (!el) return;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const current = smsForm.getValues("message");
      const next = current.slice(0, start) + token + current.slice(end);
      smsForm.setValue("message", next, { shouldDirty: true });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    }
  }, [activeTab, emailForm, smsForm]);

  // Variable chip panel component
  const VariableChips = () => (
    <div className="border rounded-md p-3 bg-muted/30 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Click a variable to insert at cursor
      </p>
      <div className="space-y-1.5">
        {VARIABLE_GROUPS.map(group => (
          <div key={group.label} className="flex items-start gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-16 pt-0.5 shrink-0">
              {group.label}
            </span>
            <div className="flex flex-wrap gap-1">
              {group.vars.map(v => (
                <button
                  key={v.token}
                  type="button"
                  title={v.hint}
                  onClick={() => insertVariable(v.token)}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-orange-50 border border-orange-200 text-orange-700 hover-elevate cursor-pointer"
                  data-testid={`var-chip-${v.token.replace(/[{}]/g, "")}`}
                >
                  {v.token}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Preview pane
  const PreviewPane = () => {
    const isEmail = activeTab === "email";
    const rawSubject = isEmail ? watchedSubject : "";
    const rawBody = isEmail ? watchedBody : watchedSmsBody;
    const renderedSubject = substituteVariables(rawSubject, previewJob, previewCustomer, businessSettings);
    const renderedBody = substituteVariables(rawBody, previewJob, previewCustomer, businessSettings);

    return (
      <div className="flex flex-col h-full gap-3">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search jobs to preview variables…"
            value={previewJobSearch}
            onChange={e => setPreviewJobSearch(e.target.value)}
            className="h-8 text-xs"
            data-testid="input-preview-job-search"
          />
        </div>

        {jobList.length > 0 && (
          <div className="border rounded-md overflow-hidden max-h-28 overflow-y-auto text-xs">
            {jobList.map((j: any) => (
              <button
                key={j.id}
                type="button"
                onClick={() => { setPreviewJobId(j.id); setPreviewJobSearch(""); }}
                className={`w-full text-left px-3 py-1.5 hover-elevate border-b last:border-b-0 ${previewJobId === j.id ? "bg-orange-50 text-orange-700 font-medium" : ""}`}
                data-testid={`preview-job-option-${j.id}`}
              >
                #{j.jobNumber} — {j.address || "No address"}
              </button>
            ))}
          </div>
        )}

        {previewJobId && previewJob && (
          <p className="text-[10px] text-muted-foreground">
            Previewing with: <span className="font-medium">#{previewJob.jobNumber}</span>
            {previewCustomer && ` · ${previewCustomer.name}`}
          </p>
        )}

        <div className="flex-1 border rounded-md overflow-hidden bg-white flex flex-col min-h-0">
          <div className="bg-gray-50 border-b px-3 py-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</p>
          </div>
          <div className="overflow-y-auto flex-1 p-3 space-y-2">
            {isEmail && (
              <div>
                <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Subject</p>
                <p className="text-sm font-medium text-gray-900 break-words">
                  {renderedSubject || <span className="text-muted-foreground italic">No subject yet</span>}
                </p>
              </div>
            )}
            <div>
              {isEmail && <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Body</p>}
              {isEmail ? (
                renderedBody ? (
                  <div
                    className="text-sm text-gray-800"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(renderedBody.replace(/\n/g, "<br />"), {
                        ALLOWED_TAGS: ["b", "i", "strong", "em", "br", "p", "ul", "ol", "li", "a", "span", "div"],
                        ALLOWED_ATTR: ["href", "target", "style"],
                      }),
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground italic">Start typing your template…</p>
                )
              ) : (
                <pre className="text-sm text-gray-800 whitespace-pre-wrap break-words font-sans">
                  {renderedBody || <span className="text-muted-foreground italic">Start typing your template…</span>}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" aria-label="Back to settings" data-testid="button-back-to-settings">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Communication Templates</h1>
            <p className="text-gray-600">Create reusable email and SMS templates with variables</p>
          </div>
        </div>
        <Button onClick={handleNewTemplate} data-testid="button-new-template">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Variables Help */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Available Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {VARIABLE_GROUPS.flatMap(g => g.vars).map(v => (
              <Badge key={v.token} variant="secondary" className="font-mono text-xs">{v.token}</Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            These variables are replaced with real values when a template is selected.
            Both <code className="text-xs bg-muted px-1 rounded">{"{customerName}"}</code> and{" "}
            <code className="text-xs bg-muted px-1 rounded">{"{{customer_name}}"}</code> formats work.
          </p>
        </CardContent>
      </Card>

      {/* Templates List */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "email" | "sms")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="email" data-testid="tab-email-templates">
            <Mail className="h-4 w-4 mr-2" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="sms" data-testid="tab-sms-templates">
            <MessageSquare className="h-4 w-4 mr-2" />
            SMS Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-6 space-y-4">
          {loadingEmail ? (
            <div className="text-center text-muted-foreground">Loading templates…</div>
          ) : emailTemplates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No email templates yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first email template to speed up customer communication
                </p>
                <Button onClick={handleNewTemplate} data-testid="button-create-first-email">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Email Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {emailTemplates.map((template: any) => (
                <Card key={template.id} className="hover-elevate" data-testid={`card-email-template-${template.id}`}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                      <span>{template.name}</span>
                      <div className="flex gap-2 items-center">
                        <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)} aria-label="Edit template"
                          data-testid={`button-edit-email-${template.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(template.id)} aria-label="Delete template"
                          data-testid={`button-delete-email-${template.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardTitle>
                    {template.category && (
                      <Badge variant="secondary" className="w-fit text-xs">{categoryLabel(template.category)}</Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Subject:</p>
                        <p className="text-sm">{template.subject}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Message:</p>
                        <p className="text-sm line-clamp-3">{template.htmlContent}</p>
                      </div>
                      {template.attachInvoicePdf && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                          <Paperclip className="h-3 w-3" />
                          <span>Invoice PDF auto-attached</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sms" className="mt-6 space-y-4">
          {loadingSms ? (
            <div className="text-center text-muted-foreground">Loading templates…</div>
          ) : smsTemplates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No SMS templates yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first SMS template to speed up customer communication
                </p>
                <Button onClick={handleNewTemplate} data-testid="button-create-first-sms">
                  <Plus className="h-4 w-4 mr-2" />
                  Create SMS Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {smsTemplates.map((template: any) => (
                <Card key={template.id} className="hover-elevate" data-testid={`card-sms-template-${template.id}`}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                      <span>{template.name}</span>
                      <div className="flex gap-2 items-center">
                        <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)} aria-label="Edit template"
                          data-testid={`button-edit-sms-${template.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(template.id)} aria-label="Delete template"
                          data-testid={`button-delete-sms-${template.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardTitle>
                    {template.category && (
                      <Badge variant="secondary" className="w-fit text-xs">{categoryLabel(template.category)}</Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm line-clamp-3">{template.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {template.message.length} / 306 characters
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog — split-pane layout */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl w-full max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
            <DialogTitle>
              {editingTemplate ? "Edit" : "Create"} {activeTab === "email" ? "Email" : "SMS"} Template
            </DialogTitle>
            <DialogDescription>
              Use variables like {"{customerName}"}, {"{jobNumber}"}, {"{address}"} to personalise messages.
              Click any chip below a field to insert it at the cursor.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left pane — form */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 border-r">
              {activeTab === "email" ? (
                <Form {...emailForm}>
                  <form
                    id="template-form"
                    onSubmit={emailForm.handleSubmit((data) => saveEmailTemplateMutation.mutate(data))}
                    className="space-y-4"
                  >
                    <FormField control={emailForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Quote Follow-up" data-testid="input-template-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={emailForm.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-email-category">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TEMPLATE_CATEGORIES.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">
                          {TEMPLATE_CATEGORIES.find(c => c.value === field.value)?.description}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={emailForm.control} name="subject" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Subject</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            ref={subjectRef}
                            placeholder="Your quote for job #{jobNumber}"
                            data-testid="input-email-subject"
                            onFocus={() => { lastFocusedField.current = "subject"; }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={emailForm.control} name="htmlContent" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            ref={bodyRef}
                            placeholder="Hi {customerName}, attached is your quote for the work at {address}..."
                            rows={8}
                            data-testid="textarea-email-body"
                            onFocus={() => { lastFocusedField.current = "body"; }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <VariableChips />

                    <FormField control={emailForm.control} name="attachInvoicePdf" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="flex items-center gap-1.5">
                            <Paperclip className="h-3.5 w-3.5" />
                            Attach invoice PDF
                          </FormLabel>
                          <FormDescription className="text-xs">
                            Automatically attach the invoice PDF when this template is used
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange}
                            data-testid="switch-attach-invoice-pdf" />
                        </FormControl>
                      </FormItem>
                    )} />
                  </form>
                </Form>
              ) : (
                <Form {...smsForm}>
                  <form
                    id="template-form"
                    onSubmit={smsForm.handleSubmit((data) => saveSmsTemplateMutation.mutate(data))}
                    className="space-y-4"
                  >
                    <FormField control={smsForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Job Confirmation" data-testid="input-template-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={smsForm.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-sms-category">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TEMPLATE_CATEGORIES.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">
                          {TEMPLATE_CATEGORIES.find(c => c.value === field.value)?.description}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={smsForm.control} name="message" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            ref={smsBodyRef}
                            placeholder="Hi {customerName}, we're scheduled for {address} tomorrow. See you then!"
                            rows={6}
                            maxLength={306}
                            data-testid="textarea-sms-body"
                            onFocus={() => { lastFocusedField.current = "smsBody"; }}
                          />
                        </FormControl>
                        <FormDescription>
                          {field.value?.length || 0} / 306 characters
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <VariableChips />
                  </form>
                </Form>
              )}
            </div>

            {/* Right pane — live preview */}
            <div className="w-80 shrink-0 overflow-y-auto px-4 py-4 bg-gray-50 hidden md:flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-gray-700">Live Preview</span>
              </div>
              <PreviewPane />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center px-6 py-3 border-t flex-shrink-0 bg-white">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-1.5" />
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="template-form"
                disabled={saveEmailTemplateMutation.isPending || saveSmsTemplateMutation.isPending}
                data-testid={activeTab === "email" ? "button-save-email-template" : "button-save-sms-template"}
              >
                {(saveEmailTemplateMutation.isPending || saveSmsTemplateMutation.isPending)
                  ? "Saving…" : "Save Template"}
              </Button>
            </div>
          </div>

          {/* Mobile preview panel (shown when toggled) */}
          {showPreview && (
            <div className="md:hidden border-t px-4 py-4 bg-gray-50 max-h-64 overflow-y-auto">
              <PreviewPane />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
