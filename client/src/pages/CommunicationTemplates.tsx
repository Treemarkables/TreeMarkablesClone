import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageSquare, Plus, Pencil, Trash2, ChevronLeft, Paperclip } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

// Form schemas
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
  message: z.string().min(1, "Message is required").max(306, "SMS must be 306 characters or less"),
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

  // Fetch email templates
  const { data: emailTemplates = [], isLoading: loadingEmail } = useQuery({
    queryKey: ['/api/email-templates'],
    select: (response: any) => response.data || [],
  });

  // Fetch SMS templates
  const { data: smsTemplates = [], isLoading: loadingSms } = useQuery({
    queryKey: ['/api/sms-templates'],
    select: (response: any) => response.data || [],
  });

  // Forms
  const emailForm = useForm<EmailTemplateFormData>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: { 
      name: "", 
      category: "custom_message",
      subject: "", 
      htmlContent: "",
      textContent: "",
      variables: [],
      description: "",
      isActive: true,
      isDefault: false,
      attachInvoicePdf: false,
      createdBy: "admin"
    }
  });

  const smsForm = useForm<SmsTemplateFormData>({
    resolver: zodResolver(smsTemplateSchema),
    defaultValues: { 
      name: "", 
      category: "custom_message",
      message: "",
      variables: [],
      description: "",
      maxLength: 306,
      isActive: true,
      isDefault: false,
      createdBy: "admin"
    }
  });

  // Create/Update Email Template
  const saveEmailTemplateMutation = useMutation({
    mutationFn: async (data: EmailTemplateFormData) => {
      const endpoint = editingTemplate 
        ? `/api/email-templates/${editingTemplate.id}`
        : '/api/email-templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      return apiRequest(method, endpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      toast({
        title: editingTemplate ? "Template updated" : "Template created",
        description: `Email template "${emailForm.getValues('name')}" has been saved.`,
      });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      emailForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save email template. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create/Update SMS Template
  const saveSmsTemplateMutation = useMutation({
    mutationFn: async (data: SmsTemplateFormData) => {
      const endpoint = editingTemplate 
        ? `/api/sms-templates/${editingTemplate.id}`
        : '/api/sms-templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      return apiRequest(method, endpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms-templates'] });
      toast({
        title: editingTemplate ? "Template updated" : "Template created",
        description: `SMS template "${smsForm.getValues('name')}" has been saved.`,
      });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      smsForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save SMS template. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete Email Template
  const deleteEmailTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/email-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      toast({
        title: "Template deleted",
        description: "Email template has been removed.",
      });
    },
  });

  // Delete SMS Template
  const deleteSmsTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/sms-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sms-templates'] });
      toast({
        title: "Template deleted",
        description: "SMS template has been removed.",
      });
    },
  });

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    if (activeTab === "email") {
      emailForm.reset({ 
        name: "", 
        category: "custom_message",
        subject: "", 
        htmlContent: "",
        textContent: "",
        variables: [],
        description: "",
        isActive: true,
        isDefault: false,
        attachInvoicePdf: false,
        createdBy: "admin"
      });
    } else {
      smsForm.reset({ 
        name: "", 
        category: "custom_message",
        message: "",
        variables: [],
        description: "",
        maxLength: 306,
        isActive: true,
        isDefault: false,
        createdBy: "admin"
      });
    }
    setIsDialogOpen(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    if (activeTab === "email") {
      emailForm.reset({
        name: template.name,
        category: template.category || "custom_message",
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent || "",
        variables: template.variables || [],
        description: template.description || "",
        isActive: template.isActive ?? true,
        isDefault: template.isDefault ?? false,
        attachInvoicePdf: template.attachInvoicePdf ?? false,
        createdBy: template.createdBy || "admin",
      });
    } else {
      smsForm.reset({
        name: template.name,
        category: template.category || "custom_message",
        message: template.message,
        variables: template.variables || [],
        description: template.description || "",
        maxLength: template.maxLength || 160,
        isActive: template.isActive ?? true,
        isDefault: template.isDefault ?? false,
        createdBy: template.createdBy || "admin",
      });
    }
    setIsDialogOpen(true);
  };

  const handleDeleteTemplate = (id: string) => {
    if (activeTab === "email") {
      deleteEmailTemplateMutation.mutate(id);
    } else {
      deleteSmsTemplateMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="button-back-to-settings">
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
        <CardHeader>
          <CardTitle className="text-sm">Available Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{"{customerName}"}</Badge>
            <Badge variant="secondary">{"{jobNumber}"}</Badge>
            <Badge variant="secondary">{"{address}"}</Badge>
            <Badge variant="secondary">{"{phone}"}</Badge>
            <Badge variant="secondary">{"{email}"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Use these variables in your templates - they'll be automatically replaced with actual values
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
            <div className="text-center text-muted-foreground">Loading templates...</div>
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
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{template.name}</span>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEditTemplate(template)}
                          data-testid={`button-edit-email-${template.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteTemplate(template.id)}
                          data-testid={`button-delete-email-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardTitle>
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
            <div className="text-center text-muted-foreground">Loading templates...</div>
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
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{template.name}</span>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEditTemplate(template)}
                          data-testid={`button-edit-sms-${template.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteTemplate(template.id)}
                          data-testid={`button-delete-sms-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardTitle>
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit" : "Create"} {activeTab === "email" ? "Email" : "SMS"} Template
            </DialogTitle>
            <DialogDescription>
              Use variables like {"{customerName}"}, {"{jobNumber}"}, {"{address}"} to personalize messages
            </DialogDescription>
          </DialogHeader>

          {activeTab === "email" ? (
            <Form {...emailForm}>
              <form 
                onSubmit={emailForm.handleSubmit((data) => saveEmailTemplateMutation.mutate(data))} 
                className="space-y-4"
              >
                <FormField
                  control={emailForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Quote Follow-up" data-testid="input-template-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Subject</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Your quote for job #{jobNumber}" 
                          data-testid="input-email-subject"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="htmlContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Hi {customerName}, attached is your quote for the work at {address}..."
                          rows={8}
                          data-testid="textarea-email-body"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="attachInvoicePdf"
                  render={({ field }) => (
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
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-attach-invoice-pdf"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={saveEmailTemplateMutation.isPending}
                    data-testid="button-save-email-template"
                  >
                    {saveEmailTemplateMutation.isPending ? "Saving..." : "Save Template"}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...smsForm}>
              <form 
                onSubmit={smsForm.handleSubmit((data) => saveSmsTemplateMutation.mutate(data))} 
                className="space-y-4"
              >
                <FormField
                  control={smsForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Job Confirmation" data-testid="input-template-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={smsForm.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Hi {customerName}, we're scheduled for {address} tomorrow. See you then!"
                          rows={6}
                          maxLength={306}
                          data-testid="textarea-sms-body"
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0} / 306 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={saveSmsTemplateMutation.isPending}
                    data-testid="button-save-sms-template"
                  >
                    {saveSmsTemplateMutation.isPending ? "Saving..." : "Save Template"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
