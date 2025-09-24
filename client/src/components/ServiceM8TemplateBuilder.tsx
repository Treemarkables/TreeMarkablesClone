import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Plus, 
  X, 
  Save, 
  FileText, 
  Clock, 
  DollarSign, 
  Users, 
  User,
  Phone,
  Mail,
  Settings,
  CheckCircle,
  Circle
} from 'lucide-react';
import type { JobTemplate, InsertJobTemplate, ChecklistItem } from "@shared/schema";
import { insertJobTemplateSchema } from "@shared/schema";

interface ServiceM8TemplateBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: InsertJobTemplate) => void;
  editingTemplate?: JobTemplate | null;
}

// Template form schema based on ServiceM8 style interface
const templateFormSchema = insertJobTemplateSchema.extend({
  // Contact information
  jobContactFirstName: insertJobTemplateSchema.shape.createdBy.optional(),
  jobContactLastName: insertJobTemplateSchema.shape.createdBy.optional(),
  jobContactEmail: insertJobTemplateSchema.shape.createdBy.optional(),
  jobContactPhone: insertJobTemplateSchema.shape.createdBy.optional(),
  jobContactMobile: insertJobTemplateSchema.shape.createdBy.optional(),
});

type TemplateFormData = {
  name: string;
  category: string;
  serviceType: string;
  defaultTitle: string;
  defaultDescription?: string;
  basePrice?: string;
  pricePerHour?: string;
  materialCosts?: string;
  priceModel: string;
  estimatedDuration?: number;
  crewSize: number;
  defaultPriority: string;
  riskLevel: string;
  procedures?: string;
  specialInstructions?: string;
  requiredPermits: boolean;
  weatherDependent: boolean;
  requiredSkills: string[];
  requiredEquipment: string[];
  safetyRequirements: string[];
  preJobChecklist: string[];
  postJobChecklist: string[];
  categoryTags: string[];
  isActive: boolean;
  createdBy: string;
  // Contact fields
  jobContactFirstName?: string;
  jobContactLastName?: string;
  jobContactEmail?: string;
  jobContactPhone?: string;
  jobContactMobile?: string;
};

const jobStatuses = [
  { value: 'quote', label: 'Quote' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const jobCategories = [
  { value: 'tree_removal', label: 'Tree Removal' },
  { value: 'pruning', label: 'Pruning' },
  { value: 'stump_grinding', label: 'Stump Grinding' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'hedge_trimming', label: 'Hedge Trimming' },
  { value: 'consultation', label: 'Consultation' }
];

export default function ServiceM8TemplateBuilder({ 
  isOpen, 
  onClose, 
  onSave, 
  editingTemplate 
}: ServiceM8TemplateBuilderProps) {
  const [checklist, setChecklist] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [previewData, setPreviewData] = useState<Partial<TemplateFormData>>({});

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: '',
      category: 'tree_removal',
      serviceType: 'tree_removal',
      defaultTitle: '',
      defaultDescription: '',
      basePrice: '0',
      pricePerHour: '0',
      materialCosts: '0',
      priceModel: 'fixed',
      estimatedDuration: 120,
      crewSize: 2,
      defaultPriority: 'medium',
      riskLevel: 'medium',
      procedures: '',
      specialInstructions: '',
      requiredPermits: false,
      weatherDependent: true,
      requiredSkills: [],
      requiredEquipment: [],
      safetyRequirements: [],
      preJobChecklist: [],
      postJobChecklist: [],
      categoryTags: [],
      isActive: true,
      createdBy: 'admin',
      jobContactFirstName: '',
      jobContactLastName: '',
      jobContactEmail: '',
      jobContactPhone: '',
      jobContactMobile: ''
    }
  });

  // Load editing template data
  useEffect(() => {
    if (editingTemplate) {
      const templateData = {
        ...editingTemplate,
        basePrice: editingTemplate.basePrice?.toString() || '0',
        pricePerHour: editingTemplate.pricePerHour?.toString() || '0',
        materialCosts: editingTemplate.materialCosts?.toString() || '0',
        defaultDescription: editingTemplate.defaultDescription || '',
        requiredSkills: editingTemplate.requiredSkills || [],
        requiredEquipment: editingTemplate.requiredEquipment || [],
        safetyRequirements: editingTemplate.safetyRequirements || [],
      };
      form.reset(templateData);
      setChecklist(editingTemplate.preJobChecklist || []);
    }
  }, [editingTemplate, form]);

  // Update preview data when form changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      setPreviewData(value as Partial<TemplateFormData>);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      const updatedChecklist = [...checklist, newChecklistItem.trim()];
      setChecklist(updatedChecklist);
      form.setValue('preJobChecklist', updatedChecklist);
      setNewChecklistItem('');
    }
  };

  const removeChecklistItem = (index: number) => {
    const updatedChecklist = checklist.filter((_, i) => i !== index);
    setChecklist(updatedChecklist);
    form.setValue('preJobChecklist', updatedChecklist);
  };

  const handleSave = (data: TemplateFormData) => {
    // Convert string prices back to decimals
    const templateData: InsertJobTemplate = {
      ...data,
      basePrice: data.basePrice ? parseFloat(data.basePrice) : undefined,
      pricePerHour: data.pricePerHour ? parseFloat(data.pricePerHour) : undefined,
      materialCosts: data.materialCosts ? parseFloat(data.materialCosts) : undefined,
      preJobChecklist: checklist,
    };
    onSave(templateData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-orange-500 text-white p-4 rounded-t-lg z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {editingTemplate ? 'Edit Job Template' : 'New Job Template'}
            </h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="text-white hover:bg-orange-600"
              data-testid="button-close-template-builder"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Split screen content */}
        <div className="flex w-full pt-20">
          {/* Left Panel - Template Builder Form */}
          <div className="w-1/2 p-6 overflow-y-auto border-r">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                {/* Template Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Template Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Name</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Enter template name" 
                              {...field} 
                              data-testid="input-template-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="defaultPriority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-job-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {jobStatuses.map((status) => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-job-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {jobCategories.map((category) => (
                                  <SelectItem key={category.value} value={category.value}>
                                    {category.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="defaultDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the work that needs to be done"
                              className="min-h-[100px]"
                              {...field}
                              data-testid="textarea-job-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Checklist */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Checklist
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {checklist.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                          <Circle className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1">{item}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeChecklistItem(index)}
                            data-testid={`button-remove-checklist-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      
                      <div className="flex gap-2">
                        <Input
                          placeholder="+ New Item"
                          value={newChecklistItem}
                          onChange={(e) => setNewChecklistItem(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && addChecklistItem()}
                          data-testid="input-new-checklist-item"
                        />
                        <Button 
                          type="button" 
                          onClick={addChecklistItem}
                          data-testid="button-add-checklist-item"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contacts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Contacts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="jobContactFirstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="First name" 
                                {...field} 
                                data-testid="input-contact-first-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="jobContactLastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Last name" 
                                {...field} 
                                data-testid="input-contact-last-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="jobContactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Email address" 
                              type="email" 
                              {...field} 
                              data-testid="input-contact-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="jobContactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Phone number" 
                                {...field} 
                                data-testid="input-contact-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="jobContactMobile"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mobile</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Mobile number" 
                                {...field} 
                                data-testid="input-contact-mobile"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    data-testid="button-cancel-template"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    data-testid="button-save-template"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Template
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          {/* Right Panel - Real-time Preview */}
          <div className="w-1/2 p-6 bg-muted/20">
            <div className="sticky top-0">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Job Template Preview
              </h3>
              
              <Card className="bg-background shadow-lg">
                <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {previewData.name || 'Template Name'}
                      </CardTitle>
                      <p className="text-sm opacity-90 mt-1">
                        {jobCategories.find(cat => cat.value === previewData.category)?.label || 'Category'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white">
                      {jobStatuses.find(status => status.value === previewData.defaultPriority)?.label || 'Status'}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="p-4 space-y-4">
                  {/* Job Description */}
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">DESCRIPTION</h4>
                    <p className="text-sm">
                      {previewData.defaultDescription || 'Type a job note here...'}
                    </p>
                  </div>

                  {/* Checklist Preview */}
                  {checklist.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">CHECKLIST</h4>
                      <div className="space-y-2">
                        {checklist.slice(0, 3).map((item, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <Circle className="h-3 w-3 text-muted-foreground" />
                            {item}
                          </div>
                        ))}
                        {checklist.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{checklist.length - 3} more items
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Contact Info Preview */}
                  {(previewData.jobContactFirstName || previewData.jobContactLastName || previewData.jobContactEmail || previewData.jobContactPhone) && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">CONTACT</h4>
                      <div className="space-y-1 text-sm">
                        {(previewData.jobContactFirstName || previewData.jobContactLastName) && (
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {`${previewData.jobContactFirstName || ''} ${previewData.jobContactLastName || ''}`.trim()}
                          </div>
                        )}
                        {previewData.jobContactEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {previewData.jobContactEmail}
                          </div>
                        )}
                        {previewData.jobContactPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {previewData.jobContactPhone}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Template Info */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Template Preview</span>
                      <span>Updates in real-time</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}