import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
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
  MessageSquare
} from 'lucide-react';
import type { JobTemplate, InsertJobTemplate, EmailTemplate, InsertEmailTemplate, SmsTemplate, InsertSmsTemplate } from "@shared/schema";
import { insertJobTemplateSchema, insertEmailTemplateSchema, insertSmsTemplateSchema } from "@shared/schema";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  count?: number;
  message?: string;
}

export default function JobTemplateManagement() {
  const [activeTab, setActiveTab] = useState('job-templates');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplate | null>(null);
  const [editingSmsTemplate, setEditingSmsTemplate] = useState<SmsTemplate | null>(null);
  const { toast } = useToast();

  // Fetch job templates (client-side filtering applied below)
  const { data: templatesResponse, isLoading, isError, error } = useQuery<ApiResponse<JobTemplate>>({
    queryKey: ['/api/job-templates'],
  });

  // Show error toast if query fails
  React.useEffect(() => {
    if (isError) {
      toast({
        title: 'Error Loading Templates',
        description: 'Failed to load job templates. Please try again.',
        variant: 'destructive',
      });
    }
  }, [isError, toast]);

  const templates = templatesResponse?.data || [];

  // Filter templates based on search term and category
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchTerm || (
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (data: InsertJobTemplate) => apiRequest('POST', '/api/job-templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-templates'] });
      toast({
        title: 'Template Created',
        description: 'Job template has been created successfully.',
      });
      setIsCreateOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create job template. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertJobTemplate> }) => 
      apiRequest('PUT', `/api/job-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-templates'] });
      toast({
        title: 'Template Updated',
        description: 'Job template has been updated successfully.',
      });
      setEditingTemplate(null);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update job template. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => apiRequest('DELETE', `/api/job-templates/${templateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-templates'] });
      toast({
        title: 'Template Deleted',
        description: 'Job template has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete job template. Please try again.',
        variant: 'destructive',
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
    if (confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      deleteTemplateMutation.mutate(templateId);
    }
  };

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'tree_removal', label: 'Tree Removal' },
    { value: 'pruning', label: 'Tree Pruning' },
    { value: 'stump_grinding', label: 'Stump Grinding' },
    { value: 'hedge_trimming', label: 'Hedge Trimming' },
    { value: 'emergency', label: 'Emergency Services' },
    { value: 'consultation', label: 'Arborist Consultation' },
    { value: 'land_clearing', label: 'Land Clearing' },
    { value: 'other', label: 'Other Services' },
  ];

  const riskLevels = [
    { value: 'low', label: 'Low Risk', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: 'Medium Risk', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'high', label: 'High Risk', color: 'bg-red-100 text-red-800' },
  ];

  const getRiskLevelBadge = (riskLevel: string) => {
    const risk = riskLevels.find(r => r.value === riskLevel);
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
          <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="heading-template-management">
            Template Management
          </h2>
          <p className="text-muted-foreground" data-testid="text-templates-description">
            Manage job workflows, email communications, and SMS messaging templates
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
          <TabsTrigger value="email-templates" data-testid="tab-email-templates">
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
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48" data-testid="select-category-filter">
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
              <Card key={template.id} className="hover-elevate" data-testid={`template-card-${template.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2" data-testid={`template-name-${template.id}`}>
                        <FileText className="w-5 h-5 text-primary" />
                        {template.name}
                      </CardTitle>
                      <CardDescription className="mt-1" data-testid={`template-category-${template.id}`}>
                        {categories.find(c => c.value === template.category)?.label}
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
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteTemplate(template.id)}
                        data-testid={`button-delete-${template.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4" data-testid={`template-description-${template.id}`}>
                    {template.description || 'No description provided'}
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium" data-testid={`template-price-${template.id}`}>
                          ${template.basePrice}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid={`template-duration-${template.id}`}>
                          {template.estimatedDuration}h
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm" data-testid={`template-crew-${template.id}`}>
                          {template.crewSize || 2} crew
                        </span>
                      </div>
                      {getRiskLevelBadge(template.riskLevel)}
                    </div>

                    {template.requiredSkills && template.requiredSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.requiredSkills.slice(0, 3).map((skill, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
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
                    <Button size="sm" className="flex-1" data-testid={`button-use-template-${template.id}`}>
                      <Copy className="w-4 h-4 mr-2" />
                      Use Template
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`button-view-template-${template.id}`}>
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
                <h3 className="text-lg font-medium text-muted-foreground mb-2">No templates found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm || selectedCategory !== 'all' 
                    ? 'Try adjusting your search or filters.' 
                    : 'Create your first job template to get started.'}
                </p>
                {!searchTerm && selectedCategory === 'all' && (
                  <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-template">
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
            <p className="text-muted-foreground mb-4">Coming soon - Manage email communication templates</p>
          </div>
        </TabsContent>
        
        <TabsContent value="sms-templates" className="space-y-4">
          <div className="text-center py-8">
            <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">SMS Templates</h3>
            <p className="text-muted-foreground mb-4">Coming soon - Manage SMS messaging templates</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Builder - ServiceM8 integration removed */}
    </div>
  );
}