import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  FileText,
  Clock,
  DollarSign,
  Users,
  AlertTriangle,
  Search,
  Edit,
  Trash2,
  Copy,
  Settings,
  Mail,
  MessageSquare,
  X,
} from "lucide-react";
import type {
  JobTemplate,
  InsertJobTemplate,
  EmailTemplate,
  InsertEmailTemplate,
  SmsTemplate,
  InsertSmsTemplate,
} from "@shared/schema";
import {
  insertJobTemplateSchema,
  insertEmailTemplateSchema,
  insertSmsTemplateSchema,
} from "@shared/schema";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  count?: number;
  message?: string;
}

export default function JobTemplateManagement() {
  const [activeTab, setActiveTab] = useState("job-templates");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(
    null,
  );
  const [editingEmailTemplate, setEditingEmailTemplate] =
    useState<EmailTemplate | null>(null);
  const [editingSmsTemplate, setEditingSmsTemplate] =
    useState<SmsTemplate | null>(null);
  const { toast } = useToast();

  // Fetch job templates (client-side filtering applied below)
  const {
    data: templatesResponse,
    isLoading,
    isError,
    error,
  } = useQuery<ApiResponse<JobTemplate>>({
    queryKey: ["/api/job-templates"],
  });

  // Show error toast if query fails
  React.useEffect(() => {
    if (isError) {
      toast({
        title: "Error Loading Templates",
        description: "Failed to load job templates. Please try again.",
        variant: "destructive",
      });
    }
  }, [isError, toast]);

  const templates = templatesResponse?.data || [];

  // Filter templates based on search term and category
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !searchTerm ||
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (data: InsertJobTemplate) =>
      apiRequest("POST", "/api/job-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-templates"] });
      setIsCreateOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create job template. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<InsertJobTemplate>;
    }) => apiRequest("PUT", `/api/job-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-templates"] });
      setEditingTemplate(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update job template. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) =>
      apiRequest("DELETE", `/api/job-templates/${templateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-templates"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete job template. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle template save
  const handleTemplateSave = (data: InsertJobTemplate) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  // Handle template builder close
  const handleTemplateBuilderClose = () => {
    setIsCreateOpen(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this template? This action cannot be undone.",
      )
    ) {
      deleteTemplateMutation.mutate(templateId);
    }
  };

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "tree_removal", label: "Tree Removal" },
    { value: "pruning", label: "Tree Pruning" },
    { value: "stump_grinding", label: "Stump Grinding" },
    { value: "hedge_trimming", label: "Hedge Trimming" },
    { value: "emergency", label: "Emergency Services" },
    { value: "consultation", label: "Arborist Consultation" },
    { value: "land_clearing", label: "Land Clearing" },
    { value: "other", label: "Other Services" },
  ];

  const riskLevels = [
    { value: "low", label: "Low Risk", color: "bg-green-100 text-green-800" },
    {
      value: "medium",
      label: "Medium Risk",
      color: "bg-yellow-100 text-yellow-800",
    },
    { value: "high", label: "High Risk", color: "bg-red-100 text-red-800" },
  ];

  const getRiskLevelBadge = (riskLevel: string) => {
    const risk = riskLevels.find((r) => r.value === riskLevel);
    return (
      <Badge className={risk?.color} data-testid={`badge-risk-${riskLevel}`}>
        {risk?.label || riskLevel}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full mb-4" />
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="text-2xl font-bold text-foreground mb-2"
            data-testid="heading-template-management"
          >
            Template Management
          </h2>
          <p
            className="text-muted-foreground"
            data-testid="text-templates-description"
          >
            Manage job workflows, email communications, and SMS messaging
            templates
          </p>
        </div>
        <Button
          data-testid="button-create-template"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="job-templates" data-testid="tab-job-templates">
            <FileText className="w-4 h-4 mr-2" />
            Job Templates
          </TabsTrigger>
          <TabsTrigger
            value="email-templates"
            data-testid="tab-email-templates"
          >
            <Mail className="w-4 h-4 mr-2" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="sms-templates" data-testid="tab-sms-templates">
            <MessageSquare className="w-4 h-4 mr-2" />
            SMS Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="job-templates" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-templates"
                />
              </div>
            </div>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger
                className="w-48"
                data-testid="select-category-filter"
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="hover-elevate"
                data-testid={`template-card-${template.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle
                        className="text-lg flex items-center gap-2"
                        data-testid={`template-name-${template.id}`}
                      >
                        <FileText className="w-5 h-5 text-primary" />
                        {template.name}
                      </CardTitle>
                      <CardDescription
                        className="mt-1"
                        data-testid={`template-category-${template.id}`}
                      >
                        {
                          categories.find((c) => c.value === template.category)
                            ?.label
                        }
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingTemplate(template);
                          setIsCreateOpen(false);
                        }}
                        data-testid={`button-edit-${template.id}`}
                        aria-label="Edit template"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteTemplate(template.id)}
                        data-testid={`button-delete-${template.id}`}
                        aria-label="Delete template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p
                    className="text-sm text-muted-foreground mb-4"
                    data-testid={`template-description-${template.id}`}
                  >
                    {template.description || "No description provided"}
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span
                          className="text-sm font-medium"
                          data-testid={`template-price-${template.id}`}
                        >
                          ${template.basePrice}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span
                          className="text-sm"
                          data-testid={`template-duration-${template.id}`}
                        >
                          {template.estimatedDuration}h
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span
                          className="text-sm"
                          data-testid={`template-crew-${template.id}`}
                        >
                          {template.crewSize || 2} crew
                        </span>
                      </div>
                      {getRiskLevelBadge(template.riskLevel)}
                    </div>

                    {template.requiredSkills &&
                      template.requiredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {template.requiredSkills
                            .slice(0, 3)
                            .map((skill, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="text-xs"
                              >
                                {skill}
                              </Badge>
                            ))}
                          {template.requiredSkills.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{template.requiredSkills.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      className="flex-1"
                      data-testid={`button-use-template-${template.id}`}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Use Template
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-view-template-${template.id}`}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTemplates.length === 0 && !isLoading && (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No templates found
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm || selectedCategory !== "all"
                    ? "Try adjusting your search or filters."
                    : "Create your first job template to get started."}
                </p>
                {!searchTerm && selectedCategory === "all" && (
                  <Button
                    onClick={() => setIsCreateOpen(true)}
                    data-testid="button-create-first-template"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Template
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="email-templates" className="space-y-4">
          <div className="text-center py-8">
            <Mail className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Email Templates</h3>
            <p className="text-muted-foreground mb-4">
              Coming soon - Manage email communication templates
            </p>
          </div>
        </TabsContent>

        <TabsContent value="sms-templates" className="space-y-4">
          <div className="text-center py-8">
            <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">SMS Templates</h3>
            <p className="text-muted-foreground mb-4">
              Coming soon - Manage SMS messaging templates
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Form Dialog */}
      <TemplateFormDialog
        isOpen={isCreateOpen || editingTemplate !== null}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingTemplate(null);
        }}
        onSave={handleTemplateSave}
        editingTemplate={editingTemplate}
        categories={categories}
        riskLevels={riskLevels}
      />
    </div>
  );
}

interface TemplateFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InsertJobTemplate) => void;
  editingTemplate: JobTemplate | null;
  categories: Array<{ value: string; label: string }>;
  riskLevels: Array<{ value: string; label: string; color: string }>;
}

function TemplateFormDialog({
  isOpen,
  onClose,
  onSave,
  editingTemplate,
  categories,
  riskLevels,
}: TemplateFormDialogProps) {
  const [formData, setFormData] = useState<Partial<InsertJobTemplate>>({
    name: "",
    category: "tree_removal",
    description: "",
    serviceType: "tree_removal",
    defaultTitle: "",
    defaultDescription: "",
    basePrice: "0",
    estimatedDuration: 0,
    crewSize: 2,
    requiredSkills: [],
    requiredEquipment: [],
    safetyRequirements: [],
    riskLevel: "medium",
    preJobChecklist: [],
    postJobChecklist: [],
    equipmentChecklist: [],
    categoryTags: [],
    isActive: true,
    createdBy: "admin",
  });

  const [preJobChecklistInput, setPreJobChecklistInput] = useState("");
  const [postJobChecklistInput, setPostJobChecklistInput] = useState("");
  const [equipmentChecklistInput, setEquipmentChecklistInput] = useState("");
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    if (editingTemplate) {
      setFormData({
        name: editingTemplate.name,
        category: editingTemplate.category,
        description: editingTemplate.description || "",
        serviceType: editingTemplate.serviceType,
        defaultTitle: editingTemplate.defaultTitle,
        defaultDescription: editingTemplate.defaultDescription || "",
        basePrice: editingTemplate.basePrice || "0",
        estimatedDuration: editingTemplate.estimatedDuration || 0,
        crewSize: editingTemplate.crewSize || 2,
        requiredSkills: editingTemplate.requiredSkills || [],
        requiredEquipment: editingTemplate.requiredEquipment || [],
        safetyRequirements: editingTemplate.safetyRequirements || [],
        riskLevel: editingTemplate.riskLevel,
        preJobChecklist: editingTemplate.preJobChecklist || [],
        postJobChecklist: editingTemplate.postJobChecklist || [],
        equipmentChecklist: editingTemplate.equipmentChecklist || [],
        categoryTags: editingTemplate.categoryTags || [],
        isActive: editingTemplate.isActive,
        createdBy: editingTemplate.createdBy,
      });
    } else {
      setFormData({
        name: "",
        category: "tree_removal",
        description: "",
        serviceType: "tree_removal",
        defaultTitle: "",
        defaultDescription: "",
        basePrice: "0",
        estimatedDuration: 0,
        crewSize: 2,
        requiredSkills: [],
        requiredEquipment: [],
        safetyRequirements: [],
        riskLevel: "medium",
        preJobChecklist: [],
        postJobChecklist: [],
        equipmentChecklist: [],
        categoryTags: [],
        isActive: true,
        createdBy: "admin",
      });
    }
  }, [editingTemplate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as InsertJobTemplate);
  };

  const addPreJobChecklistItem = () => {
    if (preJobChecklistInput.trim()) {
      setFormData({
        ...formData,
        preJobChecklist: [
          ...(formData.preJobChecklist || []),
          preJobChecklistInput.trim(),
        ],
      });
      setPreJobChecklistInput("");
    }
  };

  const removePreJobChecklistItem = (index: number) => {
    setFormData({
      ...formData,
      preJobChecklist:
        formData.preJobChecklist?.filter((_, i) => i !== index) || [],
    });
  };

  const addPostJobChecklistItem = () => {
    if (postJobChecklistInput.trim()) {
      setFormData({
        ...formData,
        postJobChecklist: [
          ...(formData.postJobChecklist || []),
          postJobChecklistInput.trim(),
        ],
      });
      setPostJobChecklistInput("");
    }
  };

  const removePostJobChecklistItem = (index: number) => {
    setFormData({
      ...formData,
      postJobChecklist:
        formData.postJobChecklist?.filter((_, i) => i !== index) || [],
    });
  };

  const addEquipmentChecklistItem = () => {
    if (equipmentChecklistInput.trim()) {
      setFormData({
        ...formData,
        equipmentChecklist: [
          ...(formData.equipmentChecklist || []),
          equipmentChecklistInput.trim(),
        ],
      });
      setEquipmentChecklistInput("");
    }
  };

  const removeEquipmentChecklistItem = (index: number) => {
    setFormData({
      ...formData,
      equipmentChecklist:
        formData.equipmentChecklist?.filter((_, i) => i !== index) || [],
    });
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      setFormData({
        ...formData,
        requiredSkills: [...(formData.requiredSkills || []), skillInput.trim()],
      });
      setSkillInput("");
    }
  };

  const removeSkill = (index: number) => {
    setFormData({
      ...formData,
      requiredSkills:
        formData.requiredSkills?.filter((_, i) => i !== index) || [],
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title-template">
            {editingTemplate ? "Edit Template" : "Create Job Template"}
          </DialogTitle>
          <DialogDescription>
            {editingTemplate
              ? "Update the job template details below."
              : "Create a new job template for your team."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  data-testid="input-template-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Standard Tree Removal"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      category: value,
                      serviceType: value,
                    })
                  }
                >
                  <SelectTrigger
                    id="category"
                    data-testid="select-template-category"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((c) => c.value !== "all")
                      .map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                data-testid="textarea-template-description"
                value={formData.description ?? ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of this template..."
                rows={3}
              />
            </div>
          </div>

          {/* Default Job Details */}
          <div className="space-y-4">
            <h3 className="font-medium">Default Job Details</h3>

            <div className="space-y-2">
              <Label htmlFor="defaultTitle">Default Job Title *</Label>
              <Input
                id="defaultTitle"
                data-testid="input-default-title"
                value={formData.defaultTitle}
                onChange={(e) =>
                  setFormData({ ...formData, defaultTitle: e.target.value })
                }
                placeholder="e.g., Tree Removal Service"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultDescription">
                Default Job Description
              </Label>
              <Textarea
                id="defaultDescription"
                data-testid="textarea-default-description"
                value={formData.defaultDescription ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultDescription: e.target.value,
                  })
                }
                placeholder="Default description for jobs created from this template..."
                rows={3}
              />
            </div>
          </div>

          {/* Pricing & Resources */}
          <div className="space-y-4">
            <h3 className="font-medium">Pricing & Resources</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="basePrice">Base Price ($)</Label>
                <Input
                  id="basePrice"
                  data-testid="input-base-price"
                  type="number"
                  step="0.01"
                  value={formData.basePrice ?? "0"}
                  onChange={(e) =>
                    setFormData({ ...formData, basePrice: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedDuration">Duration (hours)</Label>
                <Input
                  id="estimatedDuration"
                  data-testid="input-estimated-duration"
                  type="number"
                  step="0.5"
                  value={formData.estimatedDuration ?? 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estimatedDuration: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="crewSize">Crew Size</Label>
                <Input
                  id="crewSize"
                  data-testid="input-crew-size"
                  type="number"
                  value={formData.crewSize ?? 2}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      crewSize: parseInt(e.target.value) || 2,
                    })
                  }
                  placeholder="2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="riskLevel">Risk Level</Label>
              <Select
                value={formData.riskLevel}
                onValueChange={(value) =>
                  setFormData({ ...formData, riskLevel: value })
                }
              >
                <SelectTrigger id="riskLevel" data-testid="select-risk-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {riskLevels.map((risk) => (
                    <SelectItem key={risk.value} value={risk.value}>
                      {risk.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Required Skills */}
          <div className="space-y-4">
            <h3 className="font-medium">Required Skills</h3>
            <div className="flex gap-2">
              <Input
                data-testid="input-add-skill"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="Add a required skill..."
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
              <Button
                type="button"
                onClick={addSkill}
                data-testid="button-add-skill"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.requiredSkills?.map((skill, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="gap-1"
                  data-testid={`skill-badge-${index}`}
                >
                  {skill}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => removeSkill(index)}
                    data-testid={`button-remove-skill-${index}`}
                  />
                </Badge>
              ))}
            </div>
          </div>

          {/* Checklists */}
          <div className="space-y-4">
            <h3 className="font-medium">Checklists</h3>

            {/* Pre-Job Checklist */}
            <div className="space-y-2">
              <Label>Pre-Job Checklist</Label>
              <p className="text-sm text-muted-foreground">
                Tasks to complete before starting the job
              </p>
              <div className="flex gap-2">
                <Input
                  data-testid="input-add-pre-checklist"
                  value={preJobChecklistInput}
                  onChange={(e) => setPreJobChecklistInput(e.target.value)}
                  placeholder="Add checklist item..."
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPreJobChecklistItem();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={addPreJobChecklistItem}
                  data-testid="button-add-pre-checklist"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {formData.preJobChecklist?.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                    data-testid={`pre-checklist-item-${index}`}
                  >
                    <span className="text-sm">{item}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removePreJobChecklistItem(index)}
                      data-testid={`button-remove-pre-checklist-${index}`}
                      aria-label="Remove pre-job checklist item"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Post-Job Checklist */}
            <div className="space-y-2">
              <Label>Post-Job Checklist</Label>
              <p className="text-sm text-muted-foreground">
                Tasks to complete after finishing the job
              </p>
              <div className="flex gap-2">
                <Input
                  data-testid="input-add-post-checklist"
                  value={postJobChecklistInput}
                  onChange={(e) => setPostJobChecklistInput(e.target.value)}
                  placeholder="Add checklist item..."
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPostJobChecklistItem();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={addPostJobChecklistItem}
                  data-testid="button-add-post-checklist"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {formData.postJobChecklist?.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                    data-testid={`post-checklist-item-${index}`}
                  >
                    <span className="text-sm">{item}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removePostJobChecklistItem(index)}
                      data-testid={`button-remove-post-checklist-${index}`}
                      aria-label="Remove post-job checklist item"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment Checklist */}
            <div className="space-y-2">
              <Label>Equipment Checklist</Label>
              <p className="text-sm text-muted-foreground">
                Equipment items that staff should bring to this job
              </p>
              <div className="flex gap-2">
                <Input
                  data-testid="input-add-equipment-checklist"
                  value={equipmentChecklistInput}
                  onChange={(e) => setEquipmentChecklistInput(e.target.value)}
                  placeholder="e.g., Chainsaw, Safety harness..."
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEquipmentChecklistItem();
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={addEquipmentChecklistItem}
                  data-testid="button-add-equipment-checklist"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-1">
                {formData.equipmentChecklist?.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                    data-testid={`equipment-checklist-item-${index}`}
                  >
                    <span className="text-sm">{item}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeEquipmentChecklistItem(index)}
                      data-testid={`button-remove-equipment-checklist-${index}`}
                      aria-label="Remove equipment checklist item"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel-template"
            >
              Cancel
            </Button>
            <Button type="submit" data-testid="button-save-template">
              {editingTemplate ? "Update Template" : "Create Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
