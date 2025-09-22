import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  X, Plus, Upload, Image, Trash2, Eye, Download, Send, FileText,
  DollarSign, Calculator, Package, Clock, MapPin, User, Camera, 
  Edit, Copy, Save
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertProposalSchema, insertProposalLineItemSchema } from "@shared/schema";

// Extend shared schemas for form validation  
const proposalFormSchema = insertProposalSchema.extend({
  jobId: z.string().optional(), // Allow empty for draft proposals
  totalAmount: z.number().min(0, "Total amount must be positive").optional(),
  taxRate: z.preprocess((val) => parseFloat(val as string) || 15, z.number().min(0).max(100).default(15)),
  validUntil: z.string().optional(), // UI field that maps to expiryDays
}).omit({ createdAt: true, updatedAt: true, expiryDays: true }).partial();

// Line item form schema with validation
const lineItemFormSchema = insertProposalLineItemSchema.extend({
  quantity: z.preprocess((val) => parseFloat(val as string) || 0, z.number().min(0.01, "Quantity must be positive")),
  unitPrice: z.preprocess((val) => parseFloat(val as string) || 0, z.number().min(0, "Unit price must be positive")),
}).omit({ id: true, proposalId: true, createdAt: true, updatedAt: true, totalPrice: true, sortOrder: true });

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

  // Component state
  const [activeTab, setActiveTab] = useState("details");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");

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
      // Use fetch directly for file uploads to maintain FormData
      const response = await fetch(`/api/jobs/${jobId}/photos`, {
        method: 'POST',
        body: formData, // Send FormData directly for multipart upload
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Photos are added to state in handlePhotoUpload
      toast({
        title: "Success",
        description: "Photos uploaded successfully",
      });
      // Invalidate photos query
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Error", 
        description: error.message || "Failed to upload photo",
        variant: "destructive",
      });
    },
  });

  // Delete photo mutation
  const deletePhotoMutation = useMutation({
    mutationFn: async ({ photoId, photoUrl }: { photoId: string; photoUrl: string }) => {
      if (!jobId) {
        throw new Error('Job ID required for photo deletion');
      }
      const response = await fetch(`/api/jobs/${jobId}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl, type: 'proposal' }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Delete failed' }));
        throw new Error(errorData.message || 'Delete failed');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Photo deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Error",
        description: error.message || "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  // Handle photo deletion
  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    try {
      await deletePhotoMutation.mutateAsync({ photoId, photoUrl });
      // Remove from local state
      setUploadedPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch (error) {
      console.error("Delete error:", error);
    }
  };
  
  // Load existing photos for the job
  const { data: existingPhotos } = useQuery({
    queryKey: ['/api/jobs', jobId, 'photos'],
    enabled: !!jobId && isOpen,
    select: (data) => data?.data?.filter((photo: any) => photo.type === 'proposal') || [],
  });
  
  // Initialize photos when component opens or existing photos load
  useEffect(() => {
    if (existingPhotos && existingPhotos.length > 0) {
      setUploadedPhotos(existingPhotos);
    }
  }, [existingPhotos]);

  // Handle file upload
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    if (!jobId) {
      toast({
        title: "Upload Error",
        description: "Job must be saved before uploading photos",
        variant: "destructive",
      });
      return;
    }

    setPhotoUploading(true);
    
    try {
      const formData = new FormData();
      
      // Append all files with "photos" field name (backend expects this)
      for (let i = 0; i < files.length; i++) {
        formData.append("photos", files[i]);
      }
      
      // Add metadata
      formData.append("type", "proposal");
      formData.append("category", "documentation");
      formData.append("capturedBy", "User");
      formData.append("capturedAt", new Date().toISOString());
      
      const result = await uploadPhotoMutation.mutateAsync(formData);
      
      // Add uploaded photos to state
      if (result.data && Array.isArray(result.data)) {
        setUploadedPhotos(prev => [...prev, ...result.data]);
      } else if (result.data) {
        setUploadedPhotos(prev => [...prev, result.data]);
      }
      
    } catch (error) {
      console.error("Upload error:", error);
      // Error toast is handled by mutation onError
    } finally {
      setPhotoUploading(false);
      event.target.value = ""; // Reset file input
    }
  };

  // Add line item with validation
  const addLineItem = () => {
    // Validate line item using Zod schema
    const validation = lineItemFormSchema.safeParse(currentLineItem);
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0]?.message || "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    const validatedItem = validation.data;

    const totalPrice = validatedItem.quantity * validatedItem.unitPrice;
    const newItem: LineItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: validatedItem.description,
      quantity: validatedItem.quantity,
      unitPrice: validatedItem.unitPrice,
      totalPrice,
      unit: validatedItem.unit || "each",
      category: validatedItem.category,
      notes: validatedItem.notes,
      isOptional: validatedItem.isOptional || false,
    };

    setLineItems(prev => [...prev, newItem]);
    
    // Reset form
    setCurrentLineItem({
      description: "",
      quantity: 1,
      unitPrice: 0,
      unit: "each",
      category: "labor",
      notes: "",
      isOptional: false,
    });
    
    // Don't call updateTotal here - let useEffect handle it
  };

  // Remove line item
  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
    // Don't call updateTotal here - let useEffect handle it
  };

  // Update total amount
  const updateTotal = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = form.getValues("taxRate") || 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    form.setValue("totalAmount", total);
  };

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxAmount = subtotal * (form.watch("taxRate") || 0) / 100;
  const grandTotal = subtotal + taxAmount;

  // Submit proposal
  const onSubmit = async (data: any) => {
    // Map form data to backend schema
    const proposalData = {
      customerId: data.customerId || customerId,
      title: data.title,
      description: data.description || "",
      deliveryMethod: data.deliveryMethod || "email",
      expiryDays: data.validUntil ? Math.ceil((new Date(data.validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 30,
      notes: data.notes,
      status: "draft",
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(), 
      totalAmount: grandTotal.toString(),
    };
    
    // Normalize line items for backend
    const normalizedLineItems = lineItems.map(item => ({
      sourceType: "fixed" as const,
      description: item.description,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
      unit: item.unit,
      category: item.category,
      notes: item.notes || "",
      isOptional: item.isOptional,
    }));

    const payload = {
      ...proposalData,
      lineItems: normalizedLineItems,
      photos: uploadedPhotos.map(photo => photo.id),
    };

    await createProposalMutation.mutateAsync(payload);
  };

  useEffect(() => {
    updateTotal();
  }, [lineItems, form.watch("taxRate")]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 -m-6 mb-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {mode === "create" ? "Create Proposal" : "Edit Proposal"}
                </DialogTitle>
                <p className="text-orange-100 text-sm">
                  Build a professional proposal with photos and line items
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={() => {/* TODO: Preview */}}
                data-testid="button-preview-proposal"
              >
                <Eye className="w-4 h-4 mr-1" />
                Preview
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/10"
                data-testid="button-close-proposal"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="photos" className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Line Items
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Summary
            </TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Details Tab */}
              <TabsContent value="details" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Proposal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Proposal Title *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Tree Removal Service Proposal" data-testid="input-proposal-title" />
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
                              <Input {...field} type="date" data-testid="input-valid-until" />
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
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Describe the work to be performed..."
                              rows={4}
                              data-testid="textarea-proposal-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Photos Tab */}
              <TabsContent value="photos" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Proposal Photos</CardTitle>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          id="photo-upload"
                          data-testid="input-photo-upload"
                        />
                        <Button
                          type="button"
                          onClick={() => document.getElementById("photo-upload")?.click()}
                          disabled={photoUploading}
                          data-testid="button-upload-photos"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {photoUploading ? "Uploading..." : "Upload Photos"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {uploadedPhotos.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <Image className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-gray-500">No photos uploaded yet</p>
                        <p className="text-sm text-gray-400">Click "Upload Photos" to add images</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {uploadedPhotos.map((photo) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.url}
                              alt={photo.filename}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeletePhoto(photo.id, photo.url)}
                                data-testid={`button-delete-photo-${photo.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <Badge className="absolute top-2 left-2 text-xs">
                              {photo.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Line Items Tab */}
              <TabsContent value="items" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Line Item</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Description *</label>
                        <Input
                          value={currentLineItem.description}
                          onChange={(e) => setCurrentLineItem(prev => ({...prev, description: e.target.value}))}
                          placeholder="e.g., Oak tree removal"
                          data-testid="input-line-item-description"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Category</label>
                        <Select 
                          value={currentLineItem.category} 
                          onValueChange={(value) => setCurrentLineItem(prev => ({...prev, category: value}))}
                        >
                          <SelectTrigger data-testid="select-line-item-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="labor">Labor</SelectItem>
                            <SelectItem value="materials">Materials</SelectItem>
                            <SelectItem value="equipment">Equipment</SelectItem>
                            <SelectItem value="permits">Permits</SelectItem>
                            <SelectItem value="disposal">Disposal</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm font-medium">Quantity *</label>
                        <Input
                          type="number"
                          value={currentLineItem.quantity}
                          onChange={(e) => setCurrentLineItem(prev => ({...prev, quantity: e.target.value}))}
                          min="0.01"
                          step="0.01"
                          data-testid="input-line-item-quantity"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Unit</label>
                        <Select 
                          value={currentLineItem.unit} 
                          onValueChange={(value) => setCurrentLineItem(prev => ({...prev, unit: value}))}
                        >
                          <SelectTrigger data-testid="select-line-item-unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="each">Each</SelectItem>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="m2">Square meters</SelectItem>
                            <SelectItem value="linear_m">Linear meters</SelectItem>
                            <SelectItem value="kg">Kilograms</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Unit Price *</label>
                        <Input
                          type="number"
                          value={currentLineItem.unitPrice}
                          onChange={(e) => setCurrentLineItem(prev => ({...prev, unitPrice: e.target.value}))}
                          min="0"
                          step="0.01"
                          data-testid="input-line-item-price"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Total</label>
                        <Input
                          value={`$${((currentLineItem.quantity || 0) * (currentLineItem.unitPrice || 0)).toFixed(2)}`}
                          disabled
                          data-testid="input-line-item-total"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea
                        value={currentLineItem.notes}
                        onChange={(e) => setCurrentLineItem(prev => ({...prev, notes: e.target.value}))}
                        placeholder="Additional notes for this item..."
                        rows={2}
                        data-testid="textarea-line-item-notes"
                      />
                    </div>
                    
                    <Button 
                      type="button" 
                      onClick={addLineItem}
                      data-testid="button-add-line-item"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Line Item
                    </Button>
                  </CardContent>
                </Card>

                {/* Line Items List */}
                {lineItems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Line Items ({lineItems.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {lineItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.description}</span>
                                {item.category && (
                                  <Badge variant="secondary" className="text-xs">
                                    {item.category}
                                  </Badge>
                                )}
                                {item.isOptional && (
                                  <Badge variant="outline" className="text-xs">
                                    Optional
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                {item.quantity} {item.unit} × ${item.unitPrice.toFixed(2)} = ${item.totalPrice.toFixed(2)}
                              </div>
                              {item.notes && (
                                <div className="text-xs text-gray-500 mt-1">{item.notes}</div>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeLineItem(item.id!)}
                              data-testid={`button-remove-line-item-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Summary Tab */}
              <TabsContent value="summary" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cost Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Cost Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax ({form.watch("taxRate") || 0}%):</span>
                        <span>${taxAmount.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total:</span>
                        <span>${grandTotal.toFixed(2)}</span>
                      </div>
                      
                      <div className="mt-4">
                        <FormField
                          control={form.control}
                          name="taxRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tax Rate (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  min="0" 
                                  max="100" 
                                  step="0.1"
                                  onChange={(e) => field.onChange(e.target.value)}
                                  data-testid="input-tax-rate"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Additional Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Additional Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Proposal Notes</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Terms and conditions, payment details, etc..."
                                rows={6}
                                data-testid="textarea-proposal-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Form Actions */}
              <div className="flex justify-between items-center pt-6 border-t">
                <div className="text-sm text-gray-600">
                  {lineItems.length} line items • {uploadedPhotos.length} photos
                </div>
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    data-testid="button-cancel-proposal"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {/* TODO: Save as draft */}}
                    data-testid="button-save-draft"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createProposalMutation.isPending || lineItems.length === 0}
                    data-testid="button-create-proposal"
                  >
                    {createProposalMutation.isPending ? "Creating..." : mode === "create" ? "Create Proposal" : "Update Proposal"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}