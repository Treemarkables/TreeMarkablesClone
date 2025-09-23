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
}).omit({ createdAt: true, updatedAt: true, expiryDays: true }).partial();

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

  // Line item management functions
  const addLineItemToSection = (sectionId: string) => {
    if (!currentLineItem.description || !currentLineItem.quantity || !currentLineItem.unitPrice) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const totalPrice = (currentLineItem.quantity || 0) * (currentLineItem.unitPrice || 0);
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
        
        // Add photos to the specific section
        setSections(prev => prev.map(section => 
          section.id === sectionId 
            ? { ...section, photos: [...section.photos, ...uploadedPhotos] }
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
      const response = await apiRequest('POST', '/api/proposals', data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Proposal created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create proposal",
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
      return response.json();
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
    const proposalData = {
      customerId: data.customerId || customerId,
      jobId: data.jobId || jobId,
      title: data.title,
      description: data.description,
      totalAmount: grandTotal,
      taxRate: data.taxRate,
      status: 'draft',
      deliveryMethod: data.deliveryMethod,
      notes: data.notes,
      createdBy: 'system', // Replace with actual user
    };

    await createProposalMutation.mutateAsync(proposalData);
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
                              <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                  <Input
                                    placeholder="Description"
                                    value={currentLineItem.description || ""}
                                    onChange={(e) => setCurrentLineItem(prev => ({ ...prev, description: e.target.value }))}
                                    data-testid={`input-line-item-description-${section.id}`}
                                  />
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
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3 flex-1">
                                          <Checkbox
                                            checked={item.selected}
                                            onCheckedChange={() => toggleLineItemSelection(section.id, item.id!)}
                                            data-testid={`checkbox-line-item-${item.id}`}
                                          />
                                          <div className="flex-1">
                                            <div className="font-medium">{item.description}</div>
                                            <div className="text-sm text-muted-foreground">
                                              {item.quantity} × ${item.unitPrice.toFixed(2)} = ${item.totalPrice.toFixed(2)}
                                            </div>
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