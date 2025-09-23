import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  X, Plus, Upload, Image, Trash2, Eye, Download, Send, FileText,
  DollarSign, Calculator, Package, Clock, MapPin, User, Camera, 
  Edit, Copy, Save, FolderPlus, GripVertical
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertProposalSchema, insertProposalLineItemSchema, type ProposalLineItem } from "@shared/schema";

// Extend shared schemas for form validation  
const proposalFormSchema = insertProposalSchema.extend({
  jobId: z.string().optional(), // Allow empty for draft proposals
  totalAmount: z.number().min(0, "Total amount must be positive").optional(),
  taxRate: z.preprocess((val) => parseFloat(val as string) || 15, z.number().min(0).max(100).default(15)),
  validUntil: z.string().optional(), // UI field that maps to expiryDays
}).partial();

// Simplified line item form schema
const lineItemFormSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.preprocess((val) => parseFloat(val as string) || 0, z.number().min(0.01, "Quantity must be positive")),
  unitPrice: z.preprocess((val) => parseFloat(val as string) || 0, z.number().min(0, "Unit price must be positive")),
  unit: z.string().default("each"),
  category: z.string().optional(),
  notes: z.string().optional(),
  isOptional: z.boolean().default(false),
});

interface ProposalBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  jobId?: string;
  customerId?: string;
  mode?: "create" | "edit";
  proposalId?: string;
}

interface LineItemChoice {
  id: string;
  label: string;
  description: string;
  price: number;
  isDefault?: boolean;
}

type PricingType = 'normal' | 'choice' | 'fixed';

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit: string;
  category?: string;
  notes?: string;
  isOptional: boolean;
  selected: boolean; // For customer selection
  // Pricing configuration
  pricingType: PricingType;
  choices: LineItemChoice[];
  selectedChoiceId?: string;
  fixedPrice?: number;
}

interface UploadedPhoto {
  id: string;
  url: string;
  filename: string;
  type: string;
  category: string;
  notes?: string;
  capturedAt: string;
}

interface ProposalSectionData {
  id: string;
  title: string;
  description: string;
  photos: UploadedPhoto[];
  lineItems: LineItem[];
  sortOrder: number;
}

export function ProposalBuilder({ 
  isOpen, 
  onClose, 
  jobId, 
  customerId, 
  mode = "create",
  proposalId 
}: ProposalBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form state
  const form = useForm({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      jobId: jobId || "",
      customerId: customerId || "",
      title: "",
      description: "",
      validUntil: "",
      totalAmount: 0,
      taxRate: 15,
      notes: "",
      deliveryMethod: "email" as const,
    },
  });

  // Component state - sections-based approach
  const [sections, setSections] = useState<ProposalSectionData[]>([
    {
      id: 'section-1',
      title: 'Tree Removal Services',
      description: '',
      photos: [],
      lineItems: [],
      sortOrder: 1
    }
  ]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [activeSectionId, setActiveSectionId] = useState('section-1');

  // Line item form
  const [currentLineItem, setCurrentLineItem] = useState<Partial<LineItem>>({
    description: "",
    quantity: 1,
    unitPrice: 0,
    unit: "each",
    category: "labor",
    notes: "",
    isOptional: false,
    pricingType: "normal",
    choices: [],
    selectedChoiceId: undefined,
    fixedPrice: undefined,
  });

  // Choice management for current line item
  const [currentChoice, setCurrentChoice] = useState<Partial<LineItemChoice>>({
    label: "",
    description: "",
    price: 0,
    isDefault: false,
  });

  // Section management functions
  const addNewSection = () => {
    const newSection: ProposalSectionData = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      description: '',
      photos: [],
      lineItems: [],
      sortOrder: sections.length + 1
    };
    setSections(prev => [...prev, newSection]);
    setActiveSectionId(newSection.id);
    toast({
      title: "Success",
      description: "New section added",
    });
  };

  const removeSection = (sectionId: string) => {
    if (sections.length <= 1) {
      toast({
        title: "Cannot Remove",
        description: "At least one section is required",
        variant: "destructive",
      });
      return;
    }
    const newSections = sections.filter(s => s.id !== sectionId);
    setSections(newSections);
    if (activeSectionId === sectionId) {
      setActiveSectionId(newSections[0]?.id || "");
    }
    toast({
      title: "Success",
      description: "Section removed",
    });
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, title } : section
    ));
  };

  const updateSectionDescription = (sectionId: string, description: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, description } : section
    ));
  };

  // Choice management functions
  const addChoiceToCurrentItem = () => {
    if (!currentChoice.label || !currentChoice.price) {
      toast({
        title: "Validation Error",
        description: "Please fill in choice label and price",
        variant: "destructive",
      });
      return;
    }

    const newChoice: LineItemChoice = {
      id: `choice-${Date.now()}`,
      label: currentChoice.label || "",
      description: currentChoice.description || "",
      price: currentChoice.price || 0,
      isDefault: currentChoice.isDefault || false,
    };

    setCurrentLineItem(prev => ({
      ...prev,
      choices: [...(prev.choices || []), newChoice],
      pricingType: "choice",
      selectedChoiceId: newChoice.isDefault ? newChoice.id : prev.selectedChoiceId,
    }));

    setCurrentChoice({
      label: "",
      description: "",
      price: 0,
      isDefault: false,
    });

    toast({
      title: "Success",
      description: "Choice option added",
    });
  };

  const removeChoiceFromCurrentItem = (choiceId: string) => {
    setCurrentLineItem(prev => {
      const newChoices = (prev.choices || []).filter(choice => choice.id !== choiceId);
      return {
        ...prev,
        choices: newChoices,
        pricingType: newChoices.length > 0 ? "choice" : "normal",
        selectedChoiceId: prev.selectedChoiceId === choiceId ? newChoices[0]?.id : prev.selectedChoiceId,
      };
    });
  };

  const calculateLineItemTotal = (item: Partial<LineItem>): number => {
    if (item.pricingType === "fixed" && item.fixedPrice !== undefined) {
      return item.fixedPrice;
    }
    
    if (item.pricingType === "choice" && item.selectedChoiceId) {
      const selectedChoice = item.choices?.find(choice => choice.id === item.selectedChoiceId);
      if (selectedChoice) {
        return (item.quantity || 1) * selectedChoice.price;
      }
    }
    
    return (item.quantity || 0) * (item.unitPrice || 0);
  };

  // Line item management functions
  const addLineItemToSection = (sectionId: string) => {
    // Validation logic
    if (!currentLineItem.description) {
      toast({
        title: "Validation Error",
        description: "Please provide a description",
        variant: "destructive",
      });
      return;
    }

    if (currentLineItem.pricingType === "choice" && (!currentLineItem.choices || currentLineItem.choices.length === 0)) {
      toast({
        title: "Validation Error",
        description: "Please add at least one choice option",
        variant: "destructive",
      });
      return;
    }

    if (currentLineItem.pricingType === "normal" && (!currentLineItem.quantity || !currentLineItem.unitPrice)) {
      toast({
        title: "Validation Error",
        description: "Please fill in quantity and unit price",
        variant: "destructive",
      });
      return;
    }

    if (currentLineItem.pricingType === "fixed" && (!currentLineItem.fixedPrice || currentLineItem.fixedPrice <= 0)) {
      toast({
        title: "Validation Error",
        description: "Please provide a valid fixed price",
        variant: "destructive",
      });
      return;
    }

    const defaultChoiceId = currentLineItem.pricingType === "choice" 
      ? currentLineItem.choices?.find(choice => choice.isDefault)?.id || currentLineItem.choices?.[0]?.id
      : undefined;

    // Create item with default choice selected
    const itemWithChoice: Partial<LineItem> = {
      ...currentLineItem,
      selectedChoiceId: defaultChoiceId,
    };
    
    const totalPrice = calculateLineItemTotal(itemWithChoice);

    const newItem: LineItem = {
      id: `item-${Date.now()}`,
      description: currentLineItem.description || "",
      quantity: currentLineItem.quantity || 1,
      unitPrice: currentLineItem.unitPrice || 0,
      totalPrice,
      unit: currentLineItem.unit || "each",
      category: currentLineItem.category,
      notes: currentLineItem.notes,
      isOptional: currentLineItem.isOptional || false,
      selected: true, // Auto-select new items
      pricingType: currentLineItem.pricingType || "normal",
      choices: currentLineItem.choices || [],
      selectedChoiceId: defaultChoiceId,
      fixedPrice: currentLineItem.fixedPrice,
    };

    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, lineItems: [...section.lineItems, newItem] }
        : section
    ));
    
    setCurrentLineItem({
      description: "",
      quantity: 1,
      unitPrice: 0,
      unit: "each",
      category: "labor",
      notes: "",
      isOptional: false,
      pricingType: "normal",
      choices: [],
      selectedChoiceId: undefined,
      fixedPrice: undefined,
    });

    toast({
      title: "Success",
      description: "Line item added successfully",
    });
  };

  const removeLineItem = (sectionId: string, itemId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, lineItems: section.lineItems.filter(item => item.id !== itemId) }
        : section
    ));
    toast({
      title: "Success",
      description: "Line item removed",
    });
  };

  const toggleLineItemSelection = (sectionId: string, itemId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? {
            ...section, 
            lineItems: section.lineItems.map(item => 
              item.id === itemId ? { ...item, selected: !item.selected } : item
            )
          }
        : section
    ));
  };

  const updateLineItemChoice = (sectionId: string, itemId: string, choiceId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? {
            ...section, 
            lineItems: section.lineItems.map(item => {
              if (item.id === itemId) {
                const updatedItem = { ...item, selectedChoiceId: choiceId };
                updatedItem.totalPrice = calculateLineItemTotal(updatedItem);
                return updatedItem;
              }
              return item;
            })
          }
        : section
    ));
    
    toast({
      title: "Success",
      description: "Choice selection updated",
    });
  };

  // Calculate totals across all sections
  const getAllSelectedLineItems = () => {
    return sections.flatMap(section => section.lineItems.filter(item => item.selected));
  };
  
  const selectedLineItems = getAllSelectedLineItems();
  const subtotal = selectedLineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxAmount = subtotal * (form.watch("taxRate") || 0) / 100;
  const grandTotal = subtotal + taxAmount;

  // Update form total when sections change
  useEffect(() => {
    form.setValue("totalAmount", grandTotal);
  }, [sections, form, grandTotal]);

  // Photo management functions
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>, sectionId: string) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setPhotoUploading(true);

    try {
      if (jobId) {
        // Upload to backend if we have a jobId
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
          formData.append('photos', files[i]);
        }
        formData.append('type', 'before'); // Fixed photo type
        formData.append('category', 'documentation');

        const uploadedPhotos = await uploadPhotoMutation.mutateAsync(formData);
        
        // Ensure uploadedPhotos is an array before spreading
        const photosArray = Array.isArray(uploadedPhotos) ? uploadedPhotos : [];
        
        // Add photos to the specific section
        setSections(prev => prev.map(section => 
          section.id === sectionId 
            ? { ...section, photos: [...section.photos, ...photosArray] }
            : section
        ));
      } else {
        // For proposals without jobId, create preview objects
        const newPhotos: UploadedPhoto[] = Array.from(files).map((file, index) => ({
          id: `temp-${Date.now()}-${index}`,
          url: URL.createObjectURL(file),
          filename: file.name,
          type: 'before',
          category: 'documentation',
          capturedAt: new Date().toISOString(),
        }));

        setSections(prev => prev.map(section => 
          section.id === sectionId 
            ? { ...section, photos: [...section.photos, ...newPhotos] }
            : section
        ));
      }
    } catch (error) {
      console.error('Photo upload error:', error);
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = (sectionId: string, photoId: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, photos: section.photos.filter(p => p.id !== photoId) }
        : section
    ));
  };

  // Mutations
  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Creating proposal with data:', data);
      const response = await apiRequest('POST', '/api/proposals', data);
      console.log('Proposal creation response:', response);
      return response;
    },
    onSuccess: (response) => {
      console.log('Proposal created successfully:', response);
      toast({
        title: "Success",
        description: `Proposal created successfully! Proposal Number: ${response.data?.proposalNumber || 'N/A'}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      
      // Also invalidate the job diary timeline if this proposal is associated with a job
      if (jobId) {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'diary-timeline'] });
      }
      
      // Reset form state
      form.reset();
      setSections([]);
      
      // Close modal with a slight delay to show success toast
      setTimeout(() => {
        onClose();
      }, 1500);
    },
    onError: (error: any) => {
      console.error('Proposal creation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create proposal. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Photo upload mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!jobId) {
        throw new Error('Job ID required for photo upload');
      }
      const response = await fetch(`/api/jobs/${jobId}/photos`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || 'Upload failed');
      }
      
      const data = await response.json();
      
      // Convert job photo URLs to proposal photo format
      return data.photos?.map((photoUrl: string, index: number) => ({
        id: `job-photo-${Date.now()}-${index}`,
        url: photoUrl,
        filename: photoUrl.split('/').pop() || `photo-${index}`,
        type: 'before',
        category: 'documentation',
        capturedAt: new Date().toISOString(),
      })) || [];
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Photos uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload photos",
        variant: "destructive",
      });
    },
  });

  // Submit proposal
  const onSubmit = async (data: any) => {
    try {
      const proposalData = {
        customerId: data.customerId || customerId,
        jobId: data.jobId || jobId,
        quoteId: data.quoteId, // Optional - can be undefined
        proposalNumber: data.proposalNumber || `PROP-${Date.now()}`, // Auto-generate if not provided
        title: data.title,
        description: data.description,
        totalAmount: grandTotal,
        taxRate: data.taxRate,
        status: 'draft',
        deliveryMethod: data.deliveryMethod,
        notes: data.notes,
        createdBy: 'system', // Replace with actual user
        sections: sections, // Include sections and line items
      };

      await createProposalMutation.mutateAsync(proposalData);
    } catch (error) {
      console.error('Form submission error:', error);
      // Error handled by mutation's onError callback
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-primary">
                {mode === "edit" ? "Edit Proposal" : "Create Proposal"}
              </DialogTitle>
              <p className="text-muted-foreground">
                Build your professional proposal with multiple sections
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              data-testid="button-close-proposal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Proposal Information Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Proposal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Proposal Title</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Tree Removal Proposal"
                              data-testid="input-proposal-title"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valid Until</FormLabel>
                          <FormControl>
                            <Input 
                              type="date"
                              data-testid="input-valid-until"
                              {...field} 
                            />
                          </FormControl>
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
                        <FormLabel>Proposal Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief overview of the proposal..."
                            className="min-h-[100px]"
                            data-testid="textarea-proposal-description"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Rate (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              data-testid="input-tax-rate"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="deliveryMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-delivery-method">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="print">Print</SelectItem>
                              <SelectItem value="portal">Customer Portal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Sections Management */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Proposal Sections</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addNewSection}
                      data-testid="button-add-section"
                    >
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Add Section
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {sections.map((section) => (
                      <Card key={section.id} className="border-l-4 border-l-primary">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <Input
                              value={section.title}
                              onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                              className="font-semibold text-lg border-none p-0 focus-visible:ring-0"
                              placeholder="Section title..."
                              data-testid={`input-section-title-${section.id}`}
                            />
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {section.lineItems.length} items
                              </Badge>
                              {sections.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSection(section.id)}
                                  data-testid={`button-remove-section-${section.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-6">
                          {/* Section Description */}
                          <div>
                            <label className="text-sm font-medium mb-2 block">Description</label>
                            <Textarea
                              value={section.description}
                              onChange={(e) => updateSectionDescription(section.id, e.target.value)}
                              placeholder="Describe this section of work..."
                              className="min-h-[80px]"
                              data-testid={`textarea-section-description-${section.id}`}
                            />
                          </div>

                          {/* Section Photos */}
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <label className="text-sm font-medium">Photos</label>
                              <div>
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  onChange={(e) => handlePhotoUpload(e, section.id)}
                                  className="hidden"
                                  id={`photo-upload-${section.id}`}
                                />
                                <label htmlFor={`photo-upload-${section.id}`}>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={photoUploading}
                                    data-testid={`button-upload-photo-${section.id}`}
                                    asChild
                                  >
                                    <span>
                                      <Camera className="h-4 w-4 mr-2" />
                                      {photoUploading ? "Uploading..." : "Add Photos"}
                                    </span>
                                  </Button>
                                </label>
                              </div>
                            </div>

                            {section.photos.length > 0 && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {section.photos.map((photo) => (
                                  <div key={photo.id} className="relative group">
                                    <img
                                      src={photo.url}
                                      alt={photo.filename}
                                      className="w-full h-24 object-cover rounded-lg border"
                                    />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => removePhoto(section.id, photo.id)}
                                      data-testid={`button-remove-photo-${photo.id}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Section Line Items */}
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <label className="text-sm font-medium">Line Items</label>
                            </div>

                            {/* Add Line Item Form */}
                            <Card className="mb-4">
                              <CardHeader>
                                <CardTitle className="text-base">Add Line Item</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {/* Basic Details */}
                                <div>
                                  <Input
                                    placeholder="Description"
                                    value={currentLineItem.description || ""}
                                    onChange={(e) => setCurrentLineItem(prev => ({ ...prev, description: e.target.value }))}
                                    data-testid={`input-line-item-description-${section.id}`}
                                  />
                                </div>

                                {/* Pricing Type Selection */}
                                <div className="space-y-3">
                                  <div className="flex items-center space-x-4">
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        checked={currentLineItem.pricingType === "normal"}
                                        onChange={() => setCurrentLineItem(prev => ({ 
                                          ...prev, 
                                          pricingType: "normal",
                                          choices: [],
                                          selectedChoiceId: undefined,
                                          fixedPrice: undefined
                                        }))}
                                        data-testid={`radio-normal-pricing-${section.id}`}
                                      />
                                      <span className="text-sm">Normal Pricing</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        checked={currentLineItem.pricingType === "choice"}
                                        onChange={() => setCurrentLineItem(prev => ({ 
                                          ...prev, 
                                          pricingType: "choice",
                                          fixedPrice: undefined
                                        }))}
                                        data-testid={`radio-multiple-choice-${section.id}`}
                                      />
                                      <span className="text-sm">Multiple Choice</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        checked={currentLineItem.pricingType === "fixed"}
                                        onChange={() => setCurrentLineItem(prev => ({ 
                                          ...prev, 
                                          pricingType: "fixed",
                                          choices: [],
                                          selectedChoiceId: undefined
                                        }))}
                                        data-testid={`radio-fixed-price-${section.id}`}
                                      />
                                      <span className="text-sm">Fixed Price</span>
                                    </label>
                                  </div>

                                  {/* Normal Pricing Fields */}
                                  {currentLineItem.pricingType === "normal" && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <Input
                                        type="number"
                                        placeholder="Quantity"
                                        value={currentLineItem.quantity || ""}
                                        onChange={(e) => setCurrentLineItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                                        data-testid={`input-line-item-quantity-${section.id}`}
                                      />
                                      <Input
                                        type="number"
                                        placeholder="Unit Price"
                                        value={currentLineItem.unitPrice || ""}
                                        onChange={(e) => setCurrentLineItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                                        data-testid={`input-line-item-price-${section.id}`}
                                      />
                                    </div>
                                  )}

                                  {/* Fixed Price Field */}
                                  {currentLineItem.pricingType === "fixed" && (
                                    <div>
                                      <Input
                                        type="number"
                                        placeholder="Fixed Price"
                                        value={currentLineItem.fixedPrice || ""}
                                        onChange={(e) => setCurrentLineItem(prev => ({ ...prev, fixedPrice: parseFloat(e.target.value) || 0 }))}
                                        data-testid={`input-fixed-price-${section.id}`}
                                      />
                                    </div>
                                  )}

                                  {/* Multiple Choice Options */}
                                  {currentLineItem.pricingType === "choice" && (
                                    <div className="space-y-3">
                                      <div className="border rounded-lg p-3">
                                        <h5 className="font-medium mb-3">Add Choice Option</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                          <Input
                                            placeholder="Choice Label"
                                            value={currentChoice.label || ""}
                                            onChange={(e) => setCurrentChoice(prev => ({ ...prev, label: e.target.value }))}
                                            data-testid={`input-choice-label-${section.id}`}
                                          />
                                          <Input
                                            placeholder="Description"
                                            value={currentChoice.description || ""}
                                            onChange={(e) => setCurrentChoice(prev => ({ ...prev, description: e.target.value }))}
                                            data-testid={`input-choice-description-${section.id}`}
                                          />
                                          <Input
                                            type="number"
                                            placeholder="Price"
                                            value={currentChoice.price || ""}
                                            onChange={(e) => setCurrentChoice(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                                            data-testid={`input-choice-price-${section.id}`}
                                          />
                                        </div>
                                        <div className="flex items-center space-x-2 mb-3">
                                          <Checkbox
                                            checked={currentChoice.isDefault || false}
                                            onCheckedChange={(checked) => setCurrentChoice(prev => ({ ...prev, isDefault: checked as boolean }))}
                                            data-testid={`checkbox-choice-default-${section.id}`}
                                          />
                                          <label className="text-sm">Set as default choice</label>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={addChoiceToCurrentItem}
                                          data-testid={`button-add-choice-${section.id}`}
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Add Choice
                                        </Button>
                                      </div>

                                      {/* Current Choice Options */}
                                      {currentLineItem.choices && currentLineItem.choices.length > 0 && (
                                        <div>
                                          <h5 className="font-medium mb-2">Choice Options ({currentLineItem.choices.length})</h5>
                                          <div className="space-y-2">
                                            {currentLineItem.choices.map((choice) => (
                                              <div key={choice.id} className="flex items-center justify-between p-2 border rounded">
                                                <div>
                                                  <span className="font-medium">{choice.label}</span>
                                                  {choice.isDefault && <Badge variant="secondary" className="ml-2">Default</Badge>}
                                                  <div className="text-sm text-muted-foreground">
                                                    {choice.description} - ${choice.price.toFixed(2)}
                                                  </div>
                                                </div>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => removeChoiceFromCurrentItem(choice.id)}
                                                  data-testid={`button-remove-choice-${choice.id}`}
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Quantity for multiple choice */}
                                      <div>
                                        <Input
                                          type="number"
                                          placeholder="Quantity"
                                          value={currentLineItem.quantity || ""}
                                          onChange={(e) => setCurrentLineItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                                          data-testid={`input-choice-quantity-${section.id}`}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <Button
                                  type="button"
                                  onClick={() => addLineItemToSection(section.id)}
                                  data-testid={`button-add-line-item-${section.id}`}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Item
                                </Button>
                              </CardContent>
                            </Card>

                            {/* Line Items List */}
                            {section.lineItems.length > 0 && (
                              <div className="space-y-2">
                                {section.lineItems.map((item) => (
                                  <Card key={item.id} className="border-l-2 border-l-muted">
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-3 flex-1">
                                          <Checkbox
                                            checked={item.selected}
                                            onCheckedChange={() => toggleLineItemSelection(section.id, item.id!)}
                                            data-testid={`checkbox-line-item-${item.id}`}
                                            className="mt-1"
                                          />
                                          <div className="flex-1">
                                            <div className="font-medium">{item.description}</div>
                                            
                                            {/* Fixed Price Item */}
                                            {item.pricingType === "fixed" && (
                                              <div className="text-sm text-muted-foreground">
                                                <Badge variant="outline" className="mr-2">Fixed Price</Badge>
                                                ${item.totalPrice.toFixed(2)}
                                              </div>
                                            )}

                                            {/* Multiple Choice Item */}
                                            {item.pricingType === "choice" && item.choices.length > 0 && (
                                              <div className="space-y-2 mt-2">
                                                <div className="flex items-center space-x-2">
                                                  <Badge variant="outline">Multiple Choice</Badge>
                                                  <span className="text-sm text-muted-foreground">
                                                    Qty: {item.quantity}
                                                  </span>
                                                </div>
                                                <Select 
                                                  value={item.selectedChoiceId || ""} 
                                                  onValueChange={(value) => updateLineItemChoice(section.id, item.id!, value)}
                                                >
                                                  <SelectTrigger className="w-full" data-testid={`select-choice-${item.id}`}>
                                                    <SelectValue placeholder="Select an option..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {item.choices.map((choice) => (
                                                      <SelectItem key={choice.id} value={choice.id}>
                                                        <div className="flex flex-col">
                                                          <span className="font-medium">{choice.label}</span>
                                                          <span className="text-sm text-muted-foreground">
                                                            {choice.description} - ${choice.price.toFixed(2)}
                                                          </span>
                                                        </div>
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <div className="text-sm text-muted-foreground">
                                                  Total: ${item.totalPrice.toFixed(2)}
                                                </div>
                                              </div>
                                            )}

                                            {/* Normal Item */}
                                            {item.pricingType === "normal" && (
                                              <div className="text-sm text-muted-foreground">
                                                {item.quantity} × ${item.unitPrice.toFixed(2)} = ${item.totalPrice.toFixed(2)}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => removeLineItem(section.id, item.id!)}
                                          data-testid={`button-remove-line-item-${item.id}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Summary Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Proposal Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Cost Summary */}
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-semibold" data-testid="text-subtotal">
                          ${subtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax ({form.watch("taxRate") || 0}%):</span>
                        <span className="font-semibold" data-testid="text-tax">
                          ${taxAmount.toFixed(2)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-primary" data-testid="text-total">
                          ${grandTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Selected Items Summary */}
                    <div>
                      <h4 className="font-semibold mb-2">Selected Items ({selectedLineItems.length})</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {selectedLineItems.map((item) => (
                          <div key={item.id} className="text-sm flex justify-between">
                            <span className="truncate">{item.description}</span>
                            <span>${item.totalPrice.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  data-testid="button-cancel-proposal"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProposalMutation.isPending}
                  data-testid="button-save-proposal"
                >
                  {createProposalMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {mode === "edit" ? "Update Proposal" : "Create Proposal"}
                    </>
                  )}
                </Button>
              </div>

            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}