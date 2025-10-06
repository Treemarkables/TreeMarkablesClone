import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import {
  X, Plus, Upload, Image, Trash2, Eye, Download, Send, FileText,
  DollarSign, Calculator, Package, Clock, MapPin, User, Camera, 
  Edit, Copy, Save, FolderPlus, GripVertical, Mail, MessageSquare, CheckCircle
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
import { insertProposalSchema } from "@shared/schema";
import { ProposalTemplate } from "@/components/ProposalTemplate";
import { useProposalSections } from "@/hooks/proposal/useProposalSections";
import { useProposalMutations } from "@/hooks/proposal/useProposalMutations";
import { useLineItemDraft } from "@/hooks/proposal/useLineItemDraft";
import { calculateProposalTotals, createInitialSectionFromJob } from "@/utils/proposal/helpers";
import type { LineItem, ProposalSection as ProposalSectionType } from "@/types/proposal";

const proposalFormSchema = insertProposalSchema.extend({
  jobId: z.string().optional(),
  totalAmount: z.number().min(0, "Total amount must be positive").optional(),
  taxRate: z.preprocess((val) => parseFloat(val as string) || 15, z.number().min(0).max(100).default(15)),
  validUntil: z.string().optional(),
}).partial();

interface ProposalBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  jobId?: string;
  customerId?: string;
  mode?: "create" | "edit";
  proposalId?: string;
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

  // Fetch default proposal template
  const { data: proposalTemplateData } = useQuery({
    queryKey: ['/api/templates/default/proposal'],
    enabled: isOpen,
  });

  // Fetch job data to inherit job description and line items
  const { data: jobData } = useQuery({
    queryKey: ['/api/jobs', jobId],
    enabled: !!jobId && isOpen,
  });

  // Fetch diary entries to access photos
  const { data: diaryEntriesData } = useQuery({
    queryKey: ['/api/jobs', jobId, 'diary'],
    enabled: !!jobId && isOpen,
  });

  // Fetch existing proposal data when in edit mode
  const { data: existingProposalData } = useQuery({
    queryKey: ['/api/proposals', proposalId],
    enabled: !!proposalId && mode === 'edit' && isOpen,
  });
  
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

  // Fetch customer data (after form is initialized)
  const formCustomerId = form.watch('customerId');
  const activeCustomerId = formCustomerId || customerId;
  const { data: customerData } = useQuery({
    queryKey: ['/api/customers', activeCustomerId],
    enabled: !!activeCustomerId && isOpen,
  });

  // Component state - must be declared before useEffect hooks
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
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showDiaryPhotoDialog, setShowDiaryPhotoDialog] = useState(false);
  const [currentPhotoSectionId, setCurrentPhotoSectionId] = useState<string>('');
  const [selectedDiaryPhotos, setSelectedDiaryPhotos] = useState<string[]>([]);
  const [draftProposalId, setDraftProposalId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSavedSnapshot = useRef<string | null>(null);
  const [emailForm, setEmailForm] = useState({
    to: '',
    cc: '',
    subject: '',
    message: ''
  });
  const [smsForm, setSmsForm] = useState({
    to: '',
    message: ''
  });

  // Initialize proposal with job data when available
  useEffect(() => {
    if (jobData && (jobData as any)?.success && (jobData as any)?.data && isOpen) {
      const job = (jobData as any).data;
      
      // Update form with job information
      form.setValue('title', job.title || 'Tree Service Proposal');
      form.setValue('description', job.description || '');
      form.setValue('customerId', job.customerId || customerId || '');
      
      // Initialize sections with job description and line items
      const initialSection: ProposalSectionData = {
        id: 'section-1',
        title: job.serviceType || 'Tree Removal Services',
        description: job.description || '',
        photos: [],
        lineItems: job.lineItems ? job.lineItems.map((item: any, index: number) => ({
          id: item.id || `job-item-${index}`,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          totalPrice: item.total || (item.quantity || 1) * (item.unitPrice || 0),
          unit: item.unit || 'each',
          category: item.category || 'service',
          notes: item.notes || '',
          isOptional: false,
          selected: true,
          pricingType: 'normal' as const,
          choices: [],
          selectedChoiceId: undefined,
          fixedPrice: undefined,
        })) : [],
        sortOrder: 1
      };
      
      setSections([initialSection]);
      
      console.log('Proposal initialized with job data:', job);
    }
  }, [jobData, isOpen, form, customerId]);

  // Initialize draftProposalId with existing proposalId when in edit mode
  useEffect(() => {
    if (mode === 'edit' && proposalId && isOpen && !draftProposalId) {
      setDraftProposalId(proposalId);
    }
  }, [mode, proposalId, isOpen, draftProposalId]);

  // Reset draftProposalId when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDraftProposalId(null);
    }
  }, [isOpen]);

  // Load existing proposal data when in edit mode
  useEffect(() => {
    if (existingProposalData && (existingProposalData as any)?.success && mode === 'edit' && isOpen) {
      const proposal = (existingProposalData as any).data;
      
      console.log('Loading existing proposal:', proposal);
      
      // Populate form with existing proposal data
      form.setValue('title', proposal.title || '');
      form.setValue('description', proposal.description || '');
      form.setValue('customerId', proposal.customerId || '');
      form.setValue('jobId', proposal.jobId || '');
      form.setValue('notes', proposal.notes || '');
      form.setValue('taxRate', proposal.taxRate || 15);
      form.setValue('deliveryMethod', proposal.deliveryMethod || 'email');
      
      // Load sections with photos and line items properly mapped
      if (proposal.sections && Array.isArray(proposal.sections)) {
        const loadedSections = proposal.sections.map((section: any) => ({
          id: section.id,
          title: section.title,
          description: section.content || '',
          photos: section.photos || [], // Already mapped by backend
          lineItems: (section.lineItems || []).map((item: any) => ({
            id: item.id,
            description: item.description || '',
            quantity: parseFloat(item.quantity) || 1,
            unitPrice: parseFloat(item.unitPrice) || 0,
            totalPrice: parseFloat(item.totalPrice) || 0,
            unit: item.unit || 'each',
            category: item.category || 'labor',
            notes: item.notes || '',
            isOptional: item.isOptional || false,
            selected: item.selected !== false,
            pricingType: item.pricingType || 'normal',
            choices: [] // Choices would be loaded separately if needed
          })),
          sortOrder: section.sortOrder || 0
        }));
        
        setSections(loadedSections);
        console.log('Loaded sections with photos and line items:', loadedSections);
      }
    }
  }, [existingProposalData, mode, isOpen, form]);

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

  // Diary photo selection functions
  const openDiaryPhotoDialog = (sectionId: string) => {
    setCurrentPhotoSectionId(sectionId);
    setSelectedDiaryPhotos([]);
    setShowDiaryPhotoDialog(true);
  };

  const toggleDiaryPhotoSelection = (photoUrl: string) => {
    setSelectedDiaryPhotos(prev => 
      prev.includes(photoUrl) 
        ? prev.filter(url => url !== photoUrl)
        : [...prev, photoUrl]
    );
  };

  const addDiaryPhotosToSection = () => {
    if (selectedDiaryPhotos.length === 0) return;

    // Convert diary photo URLs to the photo format used in sections
    const newPhotos = selectedDiaryPhotos.map((url, index) => ({
      id: `diary-photo-${Date.now()}-${index}`,
      url: url,
      filename: url.split('/').pop() || 'diary-photo',
      type: 'before' as const,
      category: 'documentation' as const,
      capturedAt: new Date().toISOString(),
    }));

    setSections(prev => prev.map(section => 
      section.id === currentPhotoSectionId
        ? { ...section, photos: [...section.photos, ...newPhotos] }
        : section
    ));

    toast({
      title: "Success",
      description: `Added ${selectedDiaryPhotos.length} photo(s) from diary`,
    });

    setShowDiaryPhotoDialog(false);
    setSelectedDiaryPhotos([]);
  };

  // Get all photos from diary entries
  const getDiaryPhotos = () => {
    if (!diaryEntriesData || !(diaryEntriesData as any)?.success) return [];
    
    const entries = (diaryEntriesData as any).data || [];
    const allPhotos: string[] = [];

    entries.forEach((entry: any) => {
      if (entry.photos && Array.isArray(entry.photos)) {
        allPhotos.push(...entry.photos);
      }
      if (entry.photoUrl) {
        allPhotos.push(entry.photoUrl);
      }
    });

    // Remove duplicates
    return [...new Set(allPhotos)];
  };

  // Mutations
  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Creating proposal with data:', data);
      const response = await apiRequest('POST', '/api/proposals', data);
      console.log('Proposal creation response:', response);
      return response;
    },
    onSuccess: (response: any) => {
      console.log('Proposal created successfully:', response);
      toast({
        title: "Success",
        description: `Proposal created successfully! Proposal Number: ${response?.proposalNumber || 'N/A'}`,
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
      const response = await fetch(`/api/jobs/${jobId}/photos/batch`, {
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

  // Auto-save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (data: any) => {
      if (draftProposalId) {
        // Update existing draft
        const response = await apiRequest('PUT', `/api/proposals/${draftProposalId}`, data);
        return await response.json();
      } else {
        // Create new draft
        const response = await apiRequest('POST', '/api/proposals', data);
        return await response.json();
      }
    },
    onSuccess: (response: any) => {
      // Extract the proposal ID from the response
      const proposalId = response?.data?.id || response?.id;
      if (!draftProposalId && proposalId) {
        setDraftProposalId(proposalId);
        console.log('Draft proposal ID set to:', proposalId);
      }
      setAutoSaveStatus('saved');
      setLastSavedAt(new Date());
    },
    onError: (error: any) => {
      console.error('Auto-save error:', error);
      setAutoSaveStatus('unsaved');
    },
  });

  // Send email mutation  
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: { proposalId: string; to: string; subject: string; message?: string; cc?: string }) => {
      console.log('Sending proposal email:', emailData);
      const response = await apiRequest('POST', `/api/proposals/${emailData.proposalId}/send-email`, {
        to: emailData.to,
        subject: emailData.subject,
        message: emailData.message,
        cc: emailData.cc
      });
      return response;
    },
    onSuccess: (response: any) => {
      console.log('Email sent successfully:', response);
      toast({
        title: "Email Sent",
        description: `Proposal email sent successfully to ${emailForm.to}`,
      });
      setShowEmailDialog(false);
      setEmailForm({ to: '', cc: '', subject: '', message: '' });
    },
    onError: (error: any) => {
      console.error('Email sending error:', error);
      toast({
        title: "Email Failed",
        description: error.message || "Failed to send proposal email",
        variant: "destructive"
      });
    }
  });

  // Handle email form submission
  const handleSendEmail = async () => {
    if (!emailForm.to.trim() || !emailForm.subject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter recipient email and subject",
        variant: "destructive"
      });
      return;
    }

    // Use the actual saved draft proposal ID
    const actualProposalId = draftProposalId || proposalId;
    
    // Check if proposal is saved
    if (!actualProposalId) {
      toast({
        title: "Save Proposal First",
        description: "Please wait for the proposal to finish auto-saving, then try again.",
        variant: "destructive"
      });
      return;
    }

    await sendEmailMutation.mutateAsync({
      proposalId: actualProposalId,
      to: emailForm.to,
      subject: emailForm.subject,
      message: emailForm.message,
      cc: emailForm.cc
    });
  };

  // Initialize email form with customer data
  const initializeEmailForm = () => {
    const previewData = getPreviewData();
    const customerEmail = previewData.customer?.email || '';
    const proposalNumber = previewData.proposal.proposalNumber || 'N/A';
    
    setEmailForm({
      to: customerEmail,
      cc: '',
      subject: `Tree Service Proposal ${proposalNumber}`,
      message: `Dear ${previewData.customer?.name || 'Valued Customer'},\n\nThank you for your interest in our tree services. Please find your personalized proposal attached.\n\nWe look forward to working with you!\n\nBest regards,\nProfessional Tree Care Services`
    });
  };

  // Send SMS mutation
  const sendSmsMutation = useMutation({
    mutationFn: async (smsData: { to: string; message: string; jobId?: string; customerId?: string }) => {
      console.log('Sending proposal SMS:', smsData);
      const response = await apiRequest('POST', '/api/communications/sms', smsData);
      return await response.json();
    },
    onSuccess: (response: any) => {
      console.log('SMS sent successfully:', response);
      toast({
        title: "SMS Sent",
        description: `Proposal SMS sent successfully to ${smsForm.to}`,
      });
      setShowSmsDialog(false);
      setSmsForm({ to: '', message: '' });
    },
    onError: (error: any) => {
      console.error('SMS sending error:', error);
      toast({
        title: "SMS Failed",
        description: error.message || "Failed to send proposal SMS",
        variant: "destructive"
      });
    }
  });

  // Accept proposal mutation - converts to work order
  const acceptProposalMutation = useMutation({
    mutationFn: async () => {
      // Use the actual saved draft proposal ID
      const actualProposalId = draftProposalId || proposalId;
      
      if (!actualProposalId) {
        throw new Error('Please wait for the proposal to finish auto-saving, then try again');
      }

      console.log('Accepting proposal:', actualProposalId);
      const response = await apiRequest('POST', `/api/proposals/${actualProposalId}/accept`);
      return response;
    },
    onSuccess: (response: any) => {
      console.log('Proposal accepted successfully:', response);
      const workOrder = response?.data?.workOrder;
      const jobNumber = workOrder?.jobNumber || 'N/A';
      
      toast({
        title: "Proposal Accepted!",
        description: `Proposal has been accepted and converted to Work Order #${jobNumber}`,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      
      // Close the preview modal
      setShowPreview(false);
      
      // Optionally close the proposal builder
      onClose();
    },
    onError: (error: any) => {
      console.error('Proposal acceptance error:', error);
      toast({
        title: "Acceptance Failed",
        description: error.message || "Failed to accept proposal",
        variant: "destructive"
      });
    }
  });

  // Handle SMS form submission
  const handleSendSms = async () => {
    if (!smsForm.to.trim() || !smsForm.message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter phone number and message",
        variant: "destructive"
      });
      return;
    }

    const previewData = getPreviewData();
    
    await sendSmsMutation.mutateAsync({
      to: smsForm.to,
      message: smsForm.message,
      jobId: jobId,
      customerId: customerId || previewData.customer?.id
    });
  };

  // Initialize SMS form with customer data
  const initializeSmsForm = () => {
    const previewData = getPreviewData();
    const formData = form.getValues();
    const customerPhone = previewData.customer?.phone || '';
    const customerName = previewData.customer?.name || 'Valued Customer';
    const proposalTitle = formData.title || 'Tree Service Proposal';
    const totalAmount = grandTotal.toFixed(2);
    
    setSmsForm({
      to: customerPhone,
      message: `Hi ${customerName}, your ${proposalTitle} is ready! Total: $${totalAmount} NZD. We look forward to working with you. - Treemarkables`
    });
  };

  // Auto-save functionality - debounced save every 3 seconds after changes
  useEffect(() => {
    if (!isOpen || sections.length === 0) return;

    // Create snapshot of current state for comparison
    const formData = form.getValues();
    const currentSnapshot = JSON.stringify({
      sections,
      formData: {
        title: formData.title,
        description: formData.description,
        notes: formData.notes,
        taxRate: formData.taxRate,
      },
    });

    // Skip if data hasn't changed from last save
    if (lastSavedSnapshot.current === currentSnapshot) {
      return;
    }

    // Data has changed, mark as unsaved
    setAutoSaveStatus('unsaved');

    const timer = setTimeout(() => {
      performAutoSave(currentSnapshot);
    }, 3000); // 3 second debounce

    return () => clearTimeout(timer);
  }, [sections, form.watch()]);

  const performAutoSave = async (snapshot: string) => {
    const formData = form.getValues();
    
    // Don't save if no meaningful data
    if (!formData.title && sections.length === 1 && sections[0].lineItems.length === 0) {
      return;
    }

    setAutoSaveStatus('saving');

    const draftData = {
      customerId: formData.customerId || customerId,
      jobId: formData.jobId || jobId,
      proposalNumber: draftProposalId ? undefined : `DRAFT-${Date.now()}`,
      title: formData.title || 'Untitled Proposal',
      description: formData.description,
      totalAmount: grandTotal,
      taxRate: formData.taxRate || 15,
      status: 'draft',
      deliveryMethod: formData.deliveryMethod || 'email',
      notes: formData.notes,
      createdBy: 'system',
      sections: sections,
    };

    try {
      const result = await saveDraftMutation.mutateAsync(draftData);
      // Save successful, store the snapshot
      lastSavedSnapshot.current = snapshot;
      console.log('Auto-save successful, snapshot stored');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  // Preview functionality
  const handlePreview = () => {
    setShowPreview(true);
  };

  // Prepare data for preview
  const getPreviewData = () => {
    const formData = form.getValues();
    
    // Mock proposal data for preview
    const previewProposal = {
      id: 'preview-' + Date.now(),
      proposalNumber: 'PROP-PREVIEW',
      status: 'draft',
      introduction: formData.description || '',
      conclusion: formData.notes || '',
      expiryDate: formData.validUntil || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'preview-user',
      customerId: formData.customerId || 'preview-customer',
      sentDate: null,
      viewedDate: null,
      responseDate: null,
      customerSignature: null,
      signedDate: null,
      templateUsed: null,
      branding: null,
      title: formData.title || 'Preview Proposal',
      deliveryMethod: 'email'
    } as any;

    // Use real template data from API, fallback to mock data
    const defaultProposalTemplate = (proposalTemplateData as any)?.success ? (proposalTemplateData as any).data : null;
    const previewTemplate = defaultProposalTemplate || {
      id: 'preview-template',
      name: 'Preview Template',
      type: 'proposal',
      description: null,
      isDefault: false,
      isActive: true,
      companyName: 'Treemarkables',
      companyPhone: '+64 6 867 1234',
      companyEmail: 'info@treemarkables.co.nz', 
      companyAddress: 'Gisborne, New Zealand',
      paymentTerms: 'Payment due within 7 days',
      gstNumber: '131-047-592-GST004',
      headerLayout: null,
      footerText: null,
      styles: null,
      logoUrl: null,
      logoPosition: null,
      primaryColor: null,
      secondaryColor: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Use real customer data from API, fallback to mock data
    const realCustomer = (customerData as any)?.success ? (customerData as any).data : null;
    const previewCustomer = realCustomer || {
      id: formData.customerId || 'preview-customer',
      name: 'Preview Customer',
      email: 'customer@example.com',
      phone: '+64 21 123 4567',
      address: 'Customer Address, Gisborne',
      city: 'Gisborne',
      region: 'Gisborne',
      notes: null,
      source: null,
      importSource: 'manual',
      importBatchId: null,
      externalId: null,
      servicem8Uuid: null,
      lifetimeValue: '0',
      totalJobs: 0,
      lastContactDate: null,
      preferredContactMethod: null,
      tags: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Convert sections to preview format
    const previewSections = sections.map(section => ({
      ...section,
      photos: section.photos,
      lineItems: section.lineItems.map(item => ({
        ...item,
        id: item.id || `item-${Date.now()}-${Math.random()}`, // Ensure ID is never undefined
        selected: item.selected !== false, // Default to true if not explicitly false
      }))
    }));

    return {
      proposal: previewProposal,
      template: previewTemplate,
      customer: previewCustomer,
      sections: previewSections
    };
  };

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
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-full sm:max-w-5xl h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0 pb-2 sm:pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <DialogTitle className="text-lg sm:text-2xl font-bold text-primary">
                  {mode === "edit" ? "Edit Proposal" : "Create Proposal"}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    Build your professional proposal with multiple sections
                  </p>
                  {autoSaveStatus === 'saving' && (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && lastSavedAt && (
                    <span className="text-xs text-green-600">
                      ✓ Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-8">
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
                        
                        <CardContent className="space-y-3 p-3 sm:p-4">
                          {/* Section Description */}
                          <div>
                            <label className="text-sm font-medium mb-1.5 block">Description</label>
                            <Textarea
                              value={section.description}
                              onChange={(e) => updateSectionDescription(section.id, e.target.value)}
                              placeholder="Describe this section of work..."
                              className="min-h-[80px] border-0 p-0 focus-visible:ring-0"
                              data-testid={`textarea-section-description-${section.id}`}
                            />
                          </div>

                          {/* Section Photos */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium">Photos</label>
                              <div className="flex gap-2">
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
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDiaryPhotoDialog(section.id)}
                                  disabled={getDiaryPhotos().length === 0}
                                  data-testid={`button-select-diary-photos-${section.id}`}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Select from Diary
                                </Button>
                              </div>
                            </div>

                            {section.photos.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {section.photos.map((photo) => (
                                  <div key={photo.id} className="relative group">
                                    <img
                                      src={photo.url}
                                      alt={photo.filename}
                                      className="w-full h-20 object-cover rounded-lg border"
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
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium">Line Items</label>
                            </div>

                            {/* Add Line Item Form */}
                            <Card className="mb-3">
                              <CardHeader className="p-3">
                                <CardTitle className="text-sm">Add Line Item</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2 p-3 pt-0">
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
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                    <div className="space-y-2">
                                      <div className="border rounded-lg p-2">
                                        <h5 className="text-sm font-medium mb-2">Add Choice Option</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
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
                                        <div className="flex items-center space-x-2 mb-2">
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
                                          <h5 className="text-sm font-medium mb-1.5">Choice Options ({currentLineItem.choices.length})</h5>
                                          <div className="space-y-1.5">
                                            {currentLineItem.choices.map((choice) => (
                                              <div key={choice.id} className="flex flex-wrap items-center justify-between gap-2 p-1.5 border rounded text-sm">
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium">{choice.label}</span>
                                                    {choice.isDefault && <Badge variant="secondary">Default</Badge>}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground break-words">
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
                              <div className="space-y-1.5">
                                {section.lineItems.map((item) => (
                                  <Card key={item.id} className="border-l-2 border-l-muted">
                                    <CardContent className="p-2 sm:p-3">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                          <Checkbox
                                            checked={item.selected}
                                            onCheckedChange={() => toggleLineItemSelection(section.id, item.id!)}
                                            data-testid={`checkbox-line-item-${item.id}`}
                                            className="mt-0.5"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium break-words">{item.description}</div>
                                            
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
                <CardContent className="p-3 sm:p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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
              <div className="flex flex-wrap justify-between gap-2 pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreview}
                    data-testid="button-preview-proposal"
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      initializeEmailForm();
                      setShowEmailDialog(true);
                    }}
                    data-testid="button-email-proposal"
                    className="flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      initializeSmsForm();
                      setShowSmsDialog(true);
                    }}
                    data-testid="button-sms-proposal"
                    className="flex items-center gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    SMS
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-4">
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
              </div>

              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {showPreview && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-full sm:max-w-6xl h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
            <DialogHeader className="flex-shrink-0 pb-2 sm:pb-4 border-b sticky top-0 bg-background z-10">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex-1">
                  <DialogTitle className="text-lg sm:text-2xl font-bold text-primary">
                    Proposal Preview
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    Preview of your proposal as it will appear to customers
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => acceptProposalMutation.mutate()}
                    disabled={acceptProposalMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid="button-accept-proposal"
                  >
                    {acceptProposalMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        <span className="hidden sm:inline">Accepting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Accept Quote</span>
                        <span className="sm:hidden">Accept</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPreview(false)}
                    data-testid="button-close-preview"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-auto">
              {(() => {
                const previewData = getPreviewData();
                return (
                  <ProposalTemplate
                    template={previewData.template}
                    proposal={previewData.proposal}
                    customer={previewData.customer}
                    sections={previewData.sections}
                    showActions={true}
                    onEmail={() => {
                      initializeEmailForm();
                      setShowEmailDialog(true);
                    }}
                    onDownload={() => console.log('Download proposal')}
                    onCopy={() => console.log('Copy proposal')}
                  />
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Email Dialog */}
      {showEmailDialog && (
        <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
          <DialogContent className="max-w-full sm:max-w-2xl p-4 sm:p-6">
            <DialogHeader className="pb-2 sm:pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                Send Proposal Email
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Recipient Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium">To *</label>
                <Input
                  type="email"
                  placeholder="customer@example.com"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                  data-testid="input-email-to"
                />
              </div>

              {/* CC Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium">CC (optional)</label>
                <Input
                  type="email"
                  placeholder="cc@example.com"
                  value={emailForm.cc}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, cc: e.target.value }))}
                  data-testid="input-email-cc"
                />
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject *</label>
                <Input
                  placeholder="Proposal subject"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                  data-testid="input-email-subject"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  placeholder="Enter your message..."
                  value={emailForm.message}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                  rows={8}
                  data-testid="textarea-email-message"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-xs text-gray-500">
                  * Required fields
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowEmailDialog(false)}
                    disabled={sendEmailMutation.isPending}
                    data-testid="button-cancel-email"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendEmail}
                    disabled={sendEmailMutation.isPending || !emailForm.to.trim() || !emailForm.subject.trim()}
                    data-testid="button-send-email"
                  >
                    {sendEmailMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* SMS Dialog */}
      {showSmsDialog && (
        <Dialog open={showSmsDialog} onOpenChange={setShowSmsDialog}>
          <DialogContent className="max-w-full sm:max-w-2xl p-4 sm:p-6">
            <DialogHeader className="pb-2 sm:pb-4">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                Send Proposal SMS
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Phone Number */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number *</label>
                <Input
                  type="tel"
                  placeholder="+64 21 123 4567"
                  value={smsForm.to}
                  onChange={(e) => setSmsForm(prev => ({ ...prev, to: e.target.value }))}
                  data-testid="input-sms-phone"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Message *</label>
                <Textarea
                  placeholder="Enter your message..."
                  value={smsForm.message}
                  onChange={(e) => setSmsForm(prev => ({ ...prev, message: e.target.value }))}
                  rows={6}
                  maxLength={160}
                  data-testid="textarea-sms-message"
                />
                <div className="text-xs text-gray-500 text-right">
                  {smsForm.message.length} / 160 characters
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-xs text-gray-500">
                  * Required fields
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowSmsDialog(false)}
                    disabled={sendSmsMutation.isPending}
                    data-testid="button-cancel-sms"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendSms}
                    disabled={sendSmsMutation.isPending || !smsForm.to.trim() || !smsForm.message.trim()}
                    data-testid="button-send-sms"
                  >
                    {sendSmsMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send SMS
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Diary Photo Selection Dialog */}
      {showDiaryPhotoDialog && (
        <Dialog open={showDiaryPhotoDialog} onOpenChange={setShowDiaryPhotoDialog}>
          <DialogContent className="max-w-full sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Select Photos from Diary
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto p-4">
              {getDiaryPhotos().length === 0 ? (
                <div className="text-center py-12">
                  <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">No photos found in job diary</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {getDiaryPhotos().map((photoUrl, index) => (
                    <div
                      key={`diary-photo-${index}`}
                      className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                        selectedDiaryPhotos.includes(photoUrl)
                          ? 'border-blue-600 ring-2 ring-blue-600 ring-offset-2'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                      onClick={() => toggleDiaryPhotoSelection(photoUrl)}
                      data-testid={`diary-photo-${index}`}
                    >
                      <img
                        src={photoUrl}
                        alt={`Diary photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      {selectedDiaryPhotos.includes(photoUrl) && (
                        <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t p-4 flex items-center justify-between bg-gray-50">
              <div className="text-sm text-gray-600">
                {selectedDiaryPhotos.length} photo(s) selected
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDiaryPhotoDialog(false)}
                  data-testid="button-cancel-diary-photos"
                >
                  Cancel
                </Button>
                <Button
                  onClick={addDiaryPhotosToSection}
                  disabled={selectedDiaryPhotos.length === 0}
                  data-testid="button-add-diary-photos"
                >
                  Add {selectedDiaryPhotos.length > 0 ? `${selectedDiaryPhotos.length} ` : ''}Photo(s)
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}