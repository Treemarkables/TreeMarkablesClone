import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Copy,
  MessageSquare,
  Eye,
  Variable,
  AlertCircle,
  Check,
} from "lucide-react";
import { Link } from "wouter";
import type { SmsTemplate } from "@shared/schema";

const SMS_CATEGORIES = [
  { value: "job_status", label: "Job Status Updates" },
  { value: "quote", label: "Quote Related" },
  { value: "invoice", label: "Invoice & Payment" },
  { value: "reminder", label: "Reminders" },
  { value: "confirmation", label: "Confirmations" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

const AVAILABLE_VARIABLES = [
  { name: "firstName", description: "Customer first name" },
  { name: "lastName", description: "Customer last name" },
  { name: "customerName", description: "Full customer name" },
  { name: "jobNumber", description: "Job number" },
  { name: "address", description: "Job address" },
  { name: "scheduledDate", description: "Scheduled date" },
  { name: "scheduledTime", description: "Scheduled time" },
  { name: "amount", description: "Amount/Price" },
  { name: "invoiceNumber", description: "Invoice number" },
  { name: "dueDate", description: "Due date" },
  { name: "companyName", description: "Your company name" },
  { name: "companyPhone", description: "Your phone number" },
];

interface TemplateFormData {
  name: string;
  category: string;
  message: string;
  variables: string[];
  description: string;
  maxLength: number;
  isActive: boolean;
  isDefault: boolean;
}

const defaultFormData: TemplateFormData = {
  name: "",
  category: "job_status",
  message: "",
  variables: [],
  description: "",
  maxLength: 459,
  isActive: true,
  isDefault: false,
};

export default function SmsTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(
    null,
  );
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [previewData, setPreviewData] = useState<Record<string, string>>({
    firstName: "John",
    lastName: "Smith",
    customerName: "John Smith",
    jobNumber: "3456",
    address: "123 Example Street, Gisborne",
    scheduledDate: "28 Nov 2025",
    scheduledTime: "9:00 AM",
    amount: "$450.00",
    invoiceNumber: "INV-3456",
    dueDate: "5 Dec 2025",
    companyName: "Treemarkables",
    companyPhone: "0800 TREES",
  });
  const [showPreview, setShowPreview] = useState(false);

  const { data: templatesResponse, isLoading } = useQuery<{
    success: boolean;
    data: SmsTemplate[];
  }>({
    queryKey: ["/api/sms-templates"],
  });

  const templates = templatesResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      return apiRequest("POST", "/api/sms-templates", {
        ...data,
        createdBy: "admin",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-templates"] });
      handleCloseEditor();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<TemplateFormData>;
    }) => {
      return apiRequest("PUT", `/api/sms-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-templates"] });
      handleCloseEditor();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/sms-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-templates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenEditor = (template?: SmsTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        category: template.category,
        message: template.message,
        variables: template.variables || [],
        description: template.description || "",
        maxLength: template.maxLength || 306,
        isActive: template.isActive,
        isDefault: template.isDefault,
      });
    } else {
      setEditingTemplate(null);
      setFormData(defaultFormData);
    }
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditingTemplate(null);
    setFormData(defaultFormData);
    setShowPreview(false);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    if (!formData.message.trim()) {
      toast({ title: "Message content is required", variant: "destructive" });
      return;
    }

    const usedVariables = AVAILABLE_VARIABLES.filter((v) =>
      formData.message.includes(`{${v.name}}`),
    ).map((v) => v.name);

    const dataToSave = {
      ...formData,
      variables: usedVariables,
    };

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const insertVariable = (variableName: string) => {
    const variable = `{${variableName}}`;
    setFormData((prev) => ({
      ...prev,
      message: prev.message + variable,
    }));
  };

  const duplicateTemplate = (template: SmsTemplate) => {
    setEditingTemplate(null);
    setFormData({
      name: `${template.name} (Copy)`,
      category: template.category,
      message: template.message,
      variables: template.variables || [],
      description: template.description || "",
      maxLength: template.maxLength || 306,
      isActive: true,
      isDefault: false,
    });
    setIsEditorOpen(true);
  };

  const getPreviewMessage = () => {
    let preview = formData.message;
    Object.entries(previewData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    });
    return preview;
  };

  const characterCount = formData.message.length;
  const isOverLimit = characterCount > formData.maxLength;
  const smsSegments = Math.ceil(characterCount / 160) || 1;

  const getCategoryLabel = (value: string) => {
    return SMS_CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back to settings"
            data-testid="button-back-to-settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">SMS Templates</h1>
          <p className="text-muted-foreground">
            Create and manage your SMS message templates
          </p>
        </div>
        <Button
          onClick={() => handleOpenEditor()}
          data-testid="button-create-template"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/3 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No SMS templates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first template to streamline customer communications
            </p>
            <Button
              onClick={() => handleOpenEditor()}
              data-testid="button-create-first-template"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={!template.isActive ? "opacity-60" : ""}
              data-testid={`card-template-${template.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {template.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {template.isDefault && (
                        <Badge variant="default" className="text-xs">
                          Default
                        </Badge>
                      )}
                      {!template.isActive && (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3 min-h-[3.75rem]">
                  {template.message}
                </p>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    {template.message.length} chars
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => duplicateTemplate(template)}
                      aria-label="Duplicate template"
                      data-testid={`button-duplicate-${template.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEditor(template)}
                      aria-label="Edit template"
                      data-testid={`button-edit-${template.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Delete template"
                          data-testid={`button-delete-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Template</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{template.name}"?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(template.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit SMS Template" : "Create SMS Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update your SMS template"
                : "Create a new SMS template for customer communications"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Job Scheduled Notification"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                data-testid="input-template-name"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="message">Message Content *</Label>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm ${isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}
                  >
                    {characterCount} / {formData.maxLength} chars
                  </span>
                  <Badge
                    variant={smsSegments > 1 ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {smsSegments} SMS
                  </Badge>
                </div>
              </div>
              <Textarea
                id="message"
                placeholder="Hi {firstName}, your job at {address} has been scheduled for {scheduledDate}..."
                value={formData.message}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, message: e.target.value }))
                }
                className={`min-h-[120px] ${isOverLimit ? "border-destructive focus-visible:ring-destructive" : ""}`}
                data-testid="textarea-message"
              />
              {isOverLimit && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Message exceeds recommended length
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Insert Variable</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((variable) => (
                  <Button
                    key={variable.name}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => insertVariable(variable.name)}
                    title={variable.description}
                    data-testid={`button-variable-${variable.name}`}
                  >
                    <Variable className="h-3 w-3 mr-1" />
                    {variable.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  data-testid="button-toggle-preview"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </Button>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, isActive: checked }))
                      }
                    />
                    <Label htmlFor="isActive" className="text-sm">
                      Active
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="isDefault"
                      checked={formData.isDefault}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, isDefault: checked }))
                      }
                    />
                    <Label htmlFor="isDefault" className="text-sm">
                      Default
                    </Label>
                  </div>
                </div>
              </div>

              {showPreview && (
                <Card className="bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Message Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 max-w-[280px]">
                      <p className="text-sm whitespace-pre-wrap">
                        {getPreviewMessage()}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Preview shows how your message will look with sample data
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseEditor}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-template"
            >
              {createMutation.isPending || updateMutation.isPending ? (
                "Saving..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {editingTemplate ? "Update Template" : "Create Template"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
