import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import {
  X,
  Plus,
  Upload,
  Image,
  Trash2,
  Eye,
  Download,
  Send,
  FileText,
  DollarSign,
  Calculator,
  Package,
  Clock,
  MapPin,
  User,
  Camera,
  Edit,
  Copy,
  Save,
  FolderPlus,
  GripVertical,
  Mail,
  MessageSquare,
  CheckCircle,
  Mic,
  MoreVertical,
  Check,
  Percent,
  Crown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { insertProposalSchema } from "@shared/schema";
import { ProposalTemplate } from "@/components/ProposalTemplate";
import { useProposalSections } from "@/hooks/proposal/useProposalSections";
import { useProposalMutations } from "@/hooks/proposal/useProposalMutations";
import { useLineItemDraft } from "@/hooks/proposal/useLineItemDraft";
import {
  calculateProposalTotals,
  createInitialSectionFromJob,
} from "@/utils/proposal/helpers";
import type {
  LineItem,
  ProposalSection as ProposalSectionType,
} from "@/types/proposal";

const proposalFormSchema = insertProposalSchema
  .extend({
    jobId: z.string().optional(),
    totalAmount: z.number().min(0, "Total amount must be positive").optional(),
    taxRate: z.preprocess(
      (val) => parseFloat(val as string) || 15,
      z.number().min(0).max(100).default(15),
    ),
    validUntil: z.string().optional(),
    discountAmount: z.preprocess(
      (val) => parseFloat(val as string) || 0,
      z.number().min(0).default(0),
    ),
    discountType: z.enum(["fixed", "percentage"]).default("fixed"),
  })
  .partial();

interface ProposalBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  jobId?: string;
  customerId?: string;
  mode?: "create" | "edit";
  proposalId?: string;
  onRequestJobSave?: () => Promise<string>; // Callback to save parent job and return job ID
  jobDescription?: string; // Pass current description from job card to avoid stale data
  customEmail?: string; // Live job contact email from parent form — takes priority over DB values
}

export function ProposalBuilder({
  isOpen,
  onClose,
  jobId,
  customerId,
  mode = "create",
  proposalId,
  onRequestJobSave,
  jobDescription,
  customEmail,
}: ProposalBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch default proposal template
  const { data: proposalTemplateData } = useQuery({
    queryKey: ["/api/templates/default/proposal"],
    enabled: isOpen,
  });

  // Fetch job data to inherit job description and line items
  const { data: jobData } = useQuery({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId && isOpen,
  });

  // Fetch diary entries to access photos
  const { data: diaryEntriesData } = useQuery({
    queryKey: ["/api/jobs", jobId, "diary"],
    enabled: !!jobId && isOpen,
  });

  // Fetch existing proposal data when in edit mode
  // staleTime: Infinity + refetchOnWindowFocus: false prevent background re-fetches
  // from triggering the useEffect that resets local sections state mid-edit
  const { data: existingProposalData } = useQuery({
    queryKey: ["/api/proposals", proposalId],
    enabled: !!proposalId && mode === "edit" && isOpen,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  // Fetch materials/services for line item selection
  const { data: materialsData } = useQuery({
    queryKey: ["/api/materials"],
    enabled: isOpen,
  });
  const materials = (materialsData as any)?.data || [];

  // Form state
  const form = useForm({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      jobId: jobId || "",
      customerId: customerId || "",
      title: "",
      introduction: "",
      validUntil: "",
      totalAmount: 0,
      taxRate: 15,
      discountAmount: 0,
      discountType: "fixed" as const,
      notes: "",
      deliveryMethod: "email" as const,
    },
  });

  // Fetch customer data (after form is initialized)
  const formCustomerId = form.watch("customerId");
  const activeCustomerId = formCustomerId || customerId;
  const { data: customerData } = useQuery({
    queryKey: ["/api/customers", activeCustomerId],
    enabled: !!activeCustomerId && isOpen,
  });
  const vipCustomer = (customerData as any)?.success
    ? (customerData as any).data
    : null;

  // Component state - must be declared before useEffect hooks
  const [sections, setSections] = useState<ProposalSectionData[]>([
    {
      id: "section-1",
      title: "Job Description",
      description: "",
      photos: [],
      lineItems: [],
      sortOrder: 1,
    },
  ]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [activeSectionId, setActiveSectionId] = useState("section-1");
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [showDiaryPhotoDialog, setShowDiaryPhotoDialog] = useState(false);
  const [currentPhotoSectionId, setCurrentPhotoSectionId] =
    useState<string>("");
  const [selectedDiaryPhotos, setSelectedDiaryPhotos] = useState<string[]>([]);
  const [enlargedPhotoUrl, setEnlargedPhotoUrl] = useState<string | null>(null);
  const [materialsDropdownSectionId, setMaterialsDropdownSectionId] = useState<
    string | null
  >(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [draftProposalId, setDraftProposalId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "saved" | "saving" | "unsaved"
  >("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSavedSnapshot = useRef<string | null>(null);
  // Guard: track whether sections have been initialised from server data for the
  // current proposalId.  Prevents a background re-fetch of existingProposalData
  // from overwriting unsaved local edits (e.g. newly-added line items).
  const sectionsInitializedRef = useRef<string | null>(null);
  // Guard: track whether create-mode sections have been initialised from jobData.
  // Prevents GlobalJobCard auto-save cache updates (which create a new jobData
  // object reference) from re-triggering the useEffect and wiping user-added items.
  const createModeInitializedRef = useRef(false);
  const [emailForm, setEmailForm] = useState({
    to: "",
    cc: "",
    subject: "",
    message: "",
  });
  const [smsForm, setSmsForm] = useState({
    to: "",
    message: "",
  });

  // Initialize proposal with job data when available (only in create mode)
  useEffect(() => {
    if (
      jobData &&
      (jobData as any)?.success &&
      (jobData as any)?.data &&
      isOpen &&
      mode === "create"
    ) {
      // Guard: only initialize once per open session.
      // Set the ref synchronously here so that:
      //   a) form.setValue calls below don't re-run on every jobData cache update
      //   b) the ref is already true before the functional-updater runs,
      //      which is fine because the updater falls back to the hasUserContent
      //      check as an extra layer of protection.
      if (createModeInitializedRef.current) return;
      createModeInitializedRef.current = true;

      const job = (jobData as any).data;

      // Check if job description should be included (defaults to true if not set)
      const includeDescription =
        job.includeDescriptionInQuotesProposals !== false;
      // Use passed jobDescription prop first (to get latest unsaved form data), fallback to API data
      const descriptionValue = includeDescription
        ? (jobDescription ?? job.description ?? "")
        : "";

      // Build the initial section
      const initialSection: ProposalSectionData = {
        id: "section-1",
        title: job.serviceType || "Job Description",
        description: descriptionValue,
        photos: [],
        lineItems: job.lineItems
          ? job.lineItems.map((item: any, index: number) => ({
              id: item.id || `job-item-${index}`,
              description: item.description,
              quantity: item.quantity || 1,
              unitPrice: item.unitPrice || 0,
              totalPrice:
                item.total || (item.quantity || 1) * (item.unitPrice || 0),
              unit: item.unit || "each",
              category: item.category || "service",
              notes: item.notes || "",
              isOptional: false,
              selected: true,
              pricingType: "normal" as const,
              choices: [],
              selectedChoiceId: undefined,
              fixedPrice: undefined,
              priceIncludesTax: item.priceIncludesTax || false,
            }))
          : [],
        sortOrder: 1,
      };

      // Use a functional updater as an extra safety net: if, despite the ref
      // guard above, sections already contain user-added content (e.g. in React
      // StrictMode dev double-mount), we must never overwrite them.
      setSections((currentSections) => {
        const hasUserContent = currentSections.some(
          (s) => (s.lineItems || []).length > 0 || (s.photos || []).length > 0,
        );
        if (hasUserContent) return currentSections;
        return [initialSection];
      });

      // Populate proposal form fields — only runs once thanks to the ref guard
      form.setValue("title", job.title || "Treemarkables Quote");
      form.setValue("introduction", descriptionValue);
      form.setValue("customerId", job.customerId || customerId || "");

      console.log("✅ Proposal initialized with job data:", job);
      console.log("✅ Section description set to:", descriptionValue);
    }
  }, [jobData, isOpen, form, customerId, mode, jobDescription]);

  // Initialize draftProposalId with existing proposalId when in edit mode
  useEffect(() => {
    if (mode === "edit" && proposalId && isOpen && !draftProposalId) {
      setDraftProposalId(proposalId);
    }
  }, [mode, proposalId, isOpen, draftProposalId]);

  // Reset draftProposalId when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDraftProposalId(null);
    }
  }, [isOpen]);

  // Reset both guards whenever the modal closes so they re-initialise correctly
  // the next time it opens (possibly for a different proposal/job).
  useEffect(() => {
    if (!isOpen) {
      sectionsInitializedRef.current = null;
      createModeInitializedRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    sectionsInitializedRef.current = null;
  }, [proposalId]);

  // Load existing proposal data when in edit mode
  useEffect(() => {
    if (
      existingProposalData &&
      (existingProposalData as any)?.success &&
      mode === "edit" &&
      isOpen
    ) {
      // Guard: only initialise once per (proposalId + open session).
      // Without this, any background re-fetch of existingProposalData would call
      // setSections() again and wipe out unsaved changes like newly-added line items.
      const currentKey = `${proposalId}-${isOpen}`;
      if (sectionsInitializedRef.current === currentKey) return;

      const proposal = (existingProposalData as any).data;

      console.log("Loading existing proposal:", proposal);

      // Populate form with existing proposal data
      form.setValue("title", proposal.title || "");
      form.setValue("introduction", proposal.introduction || "");
      form.setValue("customerId", proposal.customerId || "");
      form.setValue("jobId", proposal.jobId || "");
      form.setValue("notes", proposal.notes || "");
      form.setValue("taxRate", proposal.taxRate || 15);
      form.setValue("deliveryMethod", proposal.deliveryMethod || "email");

      // Load sections with photos and line items properly mapped
      if (proposal.sections && Array.isArray(proposal.sections)) {
        const loadedSections = proposal.sections.map((section: any) => ({
          id: section.id,
          title: section.title,
          description: section.description || "",
          photos: section.photos || [],
          lineItems: (section.lineItems || []).map((item: any) => ({
            id: item.id,
            description: item.description || "",
            quantity: parseFloat(item.quantity) || 1,
            unitPrice: parseFloat(item.unitPrice) || 0,
            totalPrice: parseFloat(item.totalPrice) || 0,
            unit: item.unit || "each",
            category: item.category || "labor",
            notes: item.notes || "",
            isOptional: item.isOptional || false,
            selected: item.selected !== false,
            pricingType: item.pricingType || "normal",
            choices: [],
            priceIncludesTax: item.priceIncludesTax || false,
          })),
          sortOrder: section.sortOrder || 0,
        }));

        // Use a functional updater so we atomically check the ref inside the setter.
        // If already initialized, preserve any unsaved user additions (line items etc.)
        setSections((currentSections) => {
          if (sectionsInitializedRef.current === currentKey)
            return currentSections;
          sectionsInitializedRef.current = currentKey;
          return loadedSections;
        });
        console.log(
          "Loaded sections with photos and line items:",
          loadedSections,
        );
      }
    }
  }, [existingProposalData, mode, isOpen, form, proposalId]);

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
    priceIncludesTax: false,
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
      description: "",
      photos: [],
      lineItems: [],
      sortOrder: sections.length + 1,
    };
    setSections((prev) => [...prev, newSection]);
    setActiveSectionId(newSection.id);
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
    const newSections = sections.filter((s) => s.id !== sectionId);
    setSections(newSections);
    if (activeSectionId === sectionId) {
      setActiveSectionId(newSections[0]?.id || "");
    }
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, title } : section,
      ),
    );
  };

  const updateSectionDescription = (sectionId: string, description: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, description } : section,
      ),
    );
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

    setCurrentLineItem((prev) => ({
      ...prev,
      choices: [...(prev.choices || []), newChoice],
      pricingType: "choice",
      selectedChoiceId: newChoice.isDefault
        ? newChoice.id
        : prev.selectedChoiceId,
    }));

    setCurrentChoice({
      label: "",
      description: "",
      price: 0,
      isDefault: false,
    });
  };

  const removeChoiceFromCurrentItem = (choiceId: string) => {
    setCurrentLineItem((prev) => {
      const newChoices = (prev.choices || []).filter(
        (choice) => choice.id !== choiceId,
      );
      return {
        ...prev,
        choices: newChoices,
        pricingType: newChoices.length > 0 ? "choice" : "normal",
        selectedChoiceId:
          prev.selectedChoiceId === choiceId
            ? newChoices[0]?.id
            : prev.selectedChoiceId,
      };
    });
  };

  const calculateLineItemTotal = (item: Partial<LineItem>): number => {
    if (item.pricingType === "fixed" && item.fixedPrice !== undefined) {
      return item.fixedPrice;
    }

    if (item.pricingType === "choice" && item.selectedChoiceId) {
      const selectedChoice = item.choices?.find(
        (choice) => choice.id === item.selectedChoiceId,
      );
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

    if (
      currentLineItem.pricingType === "choice" &&
      (!currentLineItem.choices || currentLineItem.choices.length === 0)
    ) {
      toast({
        title: "Validation Error",
        description: "Please add at least one choice option",
        variant: "destructive",
      });
      return;
    }

    if (
      currentLineItem.pricingType === "normal" &&
      (!currentLineItem.quantity || !currentLineItem.unitPrice)
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in quantity and unit price",
        variant: "destructive",
      });
      return;
    }

    if (
      currentLineItem.pricingType === "fixed" &&
      (!currentLineItem.fixedPrice || currentLineItem.fixedPrice <= 0)
    ) {
      toast({
        title: "Validation Error",
        description: "Please provide a valid fixed price",
        variant: "destructive",
      });
      return;
    }

    const defaultChoiceId =
      currentLineItem.pricingType === "choice"
        ? currentLineItem.choices?.find((choice) => choice.isDefault)?.id ||
          currentLineItem.choices?.[0]?.id
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
      priceIncludesTax: currentLineItem.priceIncludesTax || false,
    };

    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, lineItems: [...section.lineItems, newItem] }
          : section,
      ),
    );

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
      priceIncludesTax: false,
    });
  };

  const removeLineItem = (sectionId: string, itemId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lineItems: (section.lineItems || []).filter(
                (item) => item.id !== itemId,
              ),
            }
          : section,
      ),
    );
  };

  const toggleLineItemSelection = (sectionId: string, itemId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lineItems: (section.lineItems || []).map((item) =>
                item.id === itemId
                  ? { ...item, selected: !item.selected }
                  : item,
              ),
            }
          : section,
      ),
    );
  };

  const updateLineItemChoice = (
    sectionId: string,
    itemId: string,
    choiceId: string,
  ) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lineItems: (section.lineItems || []).map((item) => {
                if (item.id === itemId) {
                  const updatedItem = { ...item, selectedChoiceId: choiceId };
                  updatedItem.totalPrice = calculateLineItemTotal(updatedItem);
                  return updatedItem;
                }
                return item;
              }),
            }
          : section,
      ),
    );
  };

  // Calculate totals across all sections
  const getAllSelectedLineItems = () => {
    return sections.flatMap((section) =>
      (section.lineItems || []).filter((item) => item.selected),
    );
  };

  const selectedLineItems = getAllSelectedLineItems();
  const subtotal = selectedLineItems.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  );

  // Calculate discount
  const discountAmount = form.watch("discountAmount") || 0;
  const discountType = form.watch("discountType") || "fixed";
  const discountValue =
    discountType === "percentage"
      ? (subtotal * discountAmount) / 100
      : discountAmount;

  const discountedSubtotal = Math.max(0, subtotal - discountValue);
  const taxAmount = (discountedSubtotal * (form.watch("taxRate") || 0)) / 100;
  const grandTotal = discountedSubtotal + taxAmount;

  // Update form total when sections change
  useEffect(() => {
    form.setValue("totalAmount", grandTotal);
  }, [sections, form, grandTotal]);

  // Photo management functions
  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    sectionId: string,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setPhotoUploading(true);

    try {
      if (jobId) {
        // Compress images before upload for 5-10x faster upload speed
        const { compressImages } = await import("@/lib/imageCompression");
        const compressedFiles = await compressImages(files, {
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.8,
        });

        // Upload compressed images to backend
        const formData = new FormData();
        for (let i = 0; i < compressedFiles.length; i++) {
          formData.append("photos", compressedFiles[i]);
        }
        formData.append("type", "before"); // Fixed photo type
        formData.append("category", "documentation");

        const uploadedPhotos = await uploadPhotoMutation.mutateAsync(formData);

        // Ensure uploadedPhotos is an array before spreading
        const photosArray = Array.isArray(uploadedPhotos) ? uploadedPhotos : [];

        // Add photos to the specific section
        setSections((prev) =>
          prev.map((section) =>
            section.id === sectionId
              ? {
                  ...section,
                  photos: [...(section.photos || []), ...photosArray],
                }
              : section,
          ),
        );
      } else {
        // For proposals without jobId, create preview objects
        const newPhotos: UploadedPhoto[] = Array.from(files).map(
          (file, index) => ({
            id: `temp-${Date.now()}-${index}`,
            url: URL.createObjectURL(file),
            filename: file.name,
            type: "before",
            category: "documentation",
            capturedAt: new Date().toISOString(),
          }),
        );

        setSections((prev) =>
          prev.map((section) =>
            section.id === sectionId
              ? {
                  ...section,
                  photos: [...(section.photos || []), ...newPhotos],
                }
              : section,
          ),
        );
      }
    } catch (error) {
      console.error("Photo upload error:", error);
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = (sectionId: string, photoId: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              photos: (section.photos || []).filter((p) => p.id !== photoId),
            }
          : section,
      ),
    );
  };

  // Diary photo selection functions
  const openDiaryPhotoDialog = (sectionId: string) => {
    setCurrentPhotoSectionId(sectionId);
    setSelectedDiaryPhotos([]);
    setShowDiaryPhotoDialog(true);
  };

  const toggleDiaryPhotoSelection = (photoUrl: string) => {
    setSelectedDiaryPhotos((prev) =>
      prev.includes(photoUrl)
        ? prev.filter((url) => url !== photoUrl)
        : [...prev, photoUrl],
    );
  };

  const addDiaryPhotosToSection = () => {
    if (selectedDiaryPhotos.length === 0) return;

    // Convert diary photo URLs to the photo format used in sections
    const newPhotos = selectedDiaryPhotos.map((url, index) => ({
      id: `diary-photo-${Date.now()}-${index}`,
      url: url,
      filename: url.split("/").pop() || "diary-photo",
      type: "before" as const,
      category: "documentation" as const,
      capturedAt: new Date().toISOString(),
    }));

    setSections((prev) =>
      prev.map((section) =>
        section.id === currentPhotoSectionId
          ? { ...section, photos: [...(section.photos || []), ...newPhotos] }
          : section,
      ),
    );

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
      // Pull out internal routing flag — never sent to the server
      const { _proposalId, ...payload } = data;
      if (_proposalId) {
        // EDIT MODE: update existing proposal via PUT
        console.log("Updating proposal", _proposalId, "with data:", payload);
        const response = await apiRequest(
          "PUT",
          `/api/proposals/${_proposalId}`,
          payload,
        );
        return await response.json();
      }
      // CREATE MODE: create new proposal via POST
      console.log("Creating proposal with data:", payload);
      const response = await apiRequest("POST", "/api/proposals", payload);
      return await response.json();
    },
    onSuccess: (response: any) => {
      console.log("Proposal saved successfully:", response);
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });

      // Also invalidate the job diary timeline if this proposal is associated with a job
      if (jobId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/jobs", jobId, "diary-timeline"],
        });
      }

      // Reset form state
      form.reset();
      setSections([]);

      // Close modal with a slight delay
      setTimeout(() => {
        onClose();
      }, 1500);
    },
    onError: (error: any) => {
      console.error("Proposal save error:", error);
      toast({
        title: "Error",
        description:
          error.message || "Failed to save proposal. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Photo upload mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!jobId) {
        throw new Error("Job ID required for photo upload");
      }
      const response = await fetch(`/api/jobs/${jobId}/photos/batch`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Upload failed" }));
        throw new Error(errorData.message || "Upload failed");
      }

      const data = await response.json();

      // Convert job photo URLs to proposal photo format
      return (
        data.photos?.map((photoUrl: string, index: number) => ({
          id: `job-photo-${Date.now()}-${index}`,
          url: photoUrl,
          filename: photoUrl.split("/").pop() || `photo-${index}`,
          type: "before",
          category: "documentation",
          capturedAt: new Date().toISOString(),
        })) || []
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "photos"],
      });
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
        const response = await apiRequest(
          "PUT",
          `/api/proposals/${draftProposalId}`,
          data,
        );
        return await response.json();
      } else {
        // Create new draft
        const response = await apiRequest("POST", "/api/proposals", data);
        return await response.json();
      }
    },
    onSuccess: (response: any) => {
      // Extract the proposal ID from the response
      const proposalId = response?.data?.id || response?.id;
      if (!draftProposalId && proposalId) {
        setDraftProposalId(proposalId);
        console.log("Draft proposal ID set to:", proposalId);
      }
      setAutoSaveStatus("saved");
      setLastSavedAt(new Date());
    },
    onError: (error: any) => {
      console.error("Auto-save error:", error);
      setAutoSaveStatus("unsaved");
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: {
      proposalId: string;
      to: string;
      subject: string;
      message?: string;
      cc?: string;
    }) => {
      console.log("Sending proposal email:", emailData);
      const response = await apiRequest(
        "POST",
        `/api/proposals/${emailData.proposalId}/send-email`,
        {
          to: emailData.to,
          subject: emailData.subject,
          message: emailData.message,
          cc: emailData.cc,
        },
      );
      return response;
    },
    onSuccess: (response: any) => {
      console.log("Email sent successfully:", response);
      // Success notification disabled per user preference
      setShowEmailDialog(false);
      setEmailForm({ to: "", cc: "", subject: "", message: "" });
    },
    onError: (error: any) => {
      console.error("Email sending error:", error);
      toast({
        title: "Email Failed",
        description: error.message || "Failed to send proposal email",
        variant: "destructive",
      });
    },
  });

  // Handle email form submission
  const handleSendEmail = async () => {
    if (!emailForm.to.trim() || !emailForm.subject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter recipient email and subject",
        variant: "destructive",
      });
      return;
    }

    // Auto-save the proposal before sending email to ensure latest data is used
    const formData = form.getValues();

    // Validate required fields
    const actualCustomerId = formData.customerId || customerId;
    if (!actualCustomerId) {
      toast({
        title: "Missing Customer",
        description:
          "A customer must be assigned to the proposal before sending",
        variant: "destructive",
      });
      return;
    }

    const proposalData = {
      customerId: actualCustomerId,
      jobId: formData.jobId || jobId,
      quoteId: formData.quoteId,
      proposalNumber: draftProposalId ? undefined : `PROP-${Date.now()}`,
      title: formData.title || "Untitled Proposal",
      introduction: formData.introduction,
      totalAmount: grandTotal.toString(),
      subtotal: subtotal.toString(),
      gstAmount: taxAmount.toString(),
      taxRate: (formData.taxRate || 15).toString(),
      discountAmount: discountValue.toString(),
      discountType: formData.discountType || "fixed",
      status: "draft",
      deliveryMethod: formData.deliveryMethod || "email",
      notes: formData.notes,
      createdBy: "system",
      sections: sections, // Include latest sections with photos
    };

    try {
      // Save first to ensure database has latest data
      const saveResult = await saveDraftMutation.mutateAsync(proposalData);

      // Extract proposal ID from the save result directly
      const actualProposalId =
        saveResult?.data?.id || saveResult?.id || draftProposalId || proposalId;

      if (!actualProposalId) {
        toast({
          title: "Save Failed",
          description: "Could not save proposal. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Now send the email with the saved data
      await sendEmailMutation.mutateAsync({
        proposalId: actualProposalId,
        to: emailForm.to,
        subject: emailForm.subject,
        message: emailForm.message,
        cc: emailForm.cc,
      });
    } catch (error) {
      console.error("Error saving before email:", error);

      // Extract more detailed error message
      let errorMessage =
        "Could not save proposal before sending. Please try manual save first.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      ) {
        errorMessage = (error as any).message;
      }

      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Initialize email form with customer data
  // Priority: customEmail prop (live form value from parent) > job.jobContactEmail > customer.email
  const initializeEmailForm = () => {
    const previewData = getPreviewData();
    const emailAddress =
      customEmail ||
      previewData.job?.jobContactEmail ||
      previewData.customer?.email ||
      "";

    setEmailForm({
      to: emailAddress,
      cc: "",
      subject: `Treemarkables Quote`,
      message: `Thank you for your inquiry, we are pleased to provide you with the following proposal.`,
    });
  };

  // Send SMS mutation
  const sendSmsMutation = useMutation({
    mutationFn: async (smsData: {
      to: string;
      message: string;
      jobId?: string;
      customerId?: string;
    }) => {
      console.log("Sending proposal SMS:", smsData);
      const response = await apiRequest(
        "POST",
        "/api/communications/sms",
        smsData,
      );
      return await response.json();
    },
    onSuccess: (response: any) => {
      console.log("SMS sent successfully:", response);
      // Success notification disabled per user preference
      setShowSmsDialog(false);
      setSmsForm({ to: "", message: "" });
    },
    onError: (error: any) => {
      console.error("SMS sending error:", error);
      toast({
        title: "SMS Failed",
        description: error.message || "Failed to send proposal SMS",
        variant: "destructive",
      });
    },
  });

  // Accept proposal mutation - converts to work order
  const acceptProposalMutation = useMutation({
    mutationFn: async () => {
      // Use the actual saved draft proposal ID
      const actualProposalId = draftProposalId || proposalId;

      if (!actualProposalId) {
        throw new Error(
          "Please wait for the proposal to finish auto-saving, then try again",
        );
      }

      console.log("Accepting proposal:", actualProposalId);
      const response = await apiRequest(
        "POST",
        `/api/proposals/${actualProposalId}/accept`,
      );
      return response;
    },
    onSuccess: (response: any) => {
      console.log("Proposal accepted successfully:", response);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

      // Close the preview modal
      setShowPreview(false);

      // Optionally close the proposal builder
      onClose();
    },
    onError: (error: any) => {
      console.error("Proposal acceptance error:", error);
      toast({
        title: "Acceptance Failed",
        description: error.message || "Failed to accept proposal",
        variant: "destructive",
      });
    },
  });

  // Handle SMS form submission
  const handleSendSms = async () => {
    if (!smsForm.to.trim() || !smsForm.message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter phone number and message",
        variant: "destructive",
      });
      return;
    }

    const previewData = getPreviewData();

    await sendSmsMutation.mutateAsync({
      to: smsForm.to,
      message: smsForm.message,
      jobId: jobId,
      customerId: customerId || previewData.customer?.id,
      proposalId: draftProposalId || proposalId || undefined,
    });
  };

  // Initialize SMS form with customer data
  const initializeSmsForm = () => {
    const previewData = getPreviewData();
    const formData = form.getValues();
    // Check customer phone first, then fall back to job contact phones (mobile takes priority over landline)
    const customerPhone =
      previewData.customer?.phone ||
      previewData.job?.jobContactMobile ||
      previewData.job?.billingContactMobile ||
      previewData.job?.jobContactPhone ||
      previewData.job?.billingContactPhone ||
      "";
    console.log("SMS phone lookup:", {
      customerPhone: previewData.customer?.phone,
      jobContactMobile: previewData.job?.jobContactMobile,
      billingMobile: previewData.job?.billingContactMobile,
      jobContactPhone: previewData.job?.jobContactPhone,
      billingPhone: previewData.job?.billingContactPhone,
      resolved: customerPhone,
    });
    const customerName =
      previewData.customer?.name ||
      previewData.job?.clientName ||
      "Valued Customer";
    const firstName = customerName.split(" ")[0];
    const totalAmount = grandTotal.toFixed(2);

    // Create short proposal link if we have a proposal ID (include https:// for clickability)
    const shortLink = proposalId
      ? `https://${window.location.host}/proposal/${proposalId}`
      : "";

    setSmsForm({
      to: customerPhone,
      message: shortLink
        ? `Hi ${firstName}, your proposal is ready! Total: $${totalAmount} NZD. View quote: ${shortLink}\nJules\nTreemarkables`
        : `Hi ${firstName}, your proposal is ready! Total: $${totalAmount} NZD. We look forward to working with you.\nJules\nTreemarkables`,
    });
  };

  // Auto-save functionality - debounced save every 3 seconds after changes
  useEffect(() => {
    // DISABLED: Auto-save temporarily disabled to prevent data loss
    return;

    if (!isOpen || sections.length === 0) return;

    // Create snapshot of current state for comparison
    const formData = form.getValues();
    const currentSnapshot = JSON.stringify({
      sections,
      formData: {
        title: formData.title,
        introduction: formData.introduction,
        notes: formData.notes,
        taxRate: formData.taxRate,
      },
    });

    // Skip if data hasn't changed from last save
    if (lastSavedSnapshot.current === currentSnapshot) {
      return;
    }

    // Data has changed, mark as unsaved
    setAutoSaveStatus("unsaved");

    const timer = setTimeout(() => {
      performAutoSave(currentSnapshot);
    }, 3000); // 3 second debounce

    return () => clearTimeout(timer);
  }, [sections, form.watch()]);

  const performAutoSave = async (snapshot: string) => {
    const formData = form.getValues();

    // Don't save if no meaningful data
    if (
      !formData.title &&
      sections.length === 1 &&
      (sections[0].lineItems || []).length === 0
    ) {
      return;
    }

    setAutoSaveStatus("saving");

    const draftData = {
      customerId: formData.customerId || customerId,
      jobId: formData.jobId || jobId,
      proposalNumber: draftProposalId ? undefined : `DRAFT-${Date.now()}`,
      title: formData.title || "Untitled Proposal",
      introduction: formData.introduction,
      subtotal: subtotal.toString(),
      gstAmount: taxAmount.toString(),
      totalAmount: grandTotal.toString(),
      taxRate: (formData.taxRate || 15).toString(),
      discountAmount: discountValue.toString(),
      discountType: formData.discountType || "fixed",
      status: "draft",
      deliveryMethod: formData.deliveryMethod || "email",
      notes: formData.notes,
      createdBy: "system",
      sections: sections,
    };

    try {
      const result = await saveDraftMutation.mutateAsync(draftData);
      // Save successful, store the snapshot
      lastSavedSnapshot.current = snapshot;
      console.log("Auto-save successful, snapshot stored");
    } catch (error) {
      console.error("Auto-save failed:", error);
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
      id: "preview-" + Date.now(),
      proposalNumber: "PROP-PREVIEW",
      status: "draft",
      introduction: formData.introduction || "",
      conclusion: formData.notes || "",
      expiryDate: formData.validUntil || "",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "preview-user",
      customerId: formData.customerId || "preview-customer",
      sentDate: null,
      viewedDate: null,
      responseDate: null,
      customerSignature: null,
      signedDate: null,
      templateUsed: null,
      branding: null,
      title: formData.title || "Preview Proposal",
      deliveryMethod: "email",
      discountAmount: String(discountValue || 0),
      discountType: formData.discountType || "fixed",
      subtotal: String(subtotal),
      gstAmount: String(taxAmount),
      totalAmount: String(grandTotal),
      taxRate: String(formData.taxRate || 15),
    } as any;

    // Use real template data from API, fallback to mock data
    const defaultProposalTemplate = (proposalTemplateData as any)?.success
      ? (proposalTemplateData as any).data
      : null;
    const previewTemplate = defaultProposalTemplate || {
      id: "preview-template",
      name: "Preview Template",
      type: "proposal",
      description: null,
      isDefault: false,
      isActive: true,
      companyName: "Treemarkables",
      companyPhone: "+64 6 867 1234",
      companyEmail: "info@treemarkables.co.nz",
      companyAddress: "Gisborne, New Zealand",
      paymentTerms: "Payment due within 7 days",
      gstNumber: "131-047-592-GST004",
      headerLayout: null,
      footerText: null,
      styles: null,
      logoUrl: null,
      logoPosition: null,
      primaryColor: null,
      secondaryColor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Use real customer data from API, fallback to mock data
    console.log("Customer data for preview:", customerData);
    const realCustomer = (customerData as any)?.success
      ? (customerData as any).data
      : null;
    console.log("Real customer extracted:", realCustomer);
    const previewCustomer = realCustomer || {
      id: formData.customerId || "preview-customer",
      name: "Preview Customer",
      email: "customer@example.com",
      phone: "+64 21 123 4567",
      address: "Customer Address, Gisborne",
      city: "Gisborne",
      region: "Gisborne",
      notes: null,
      source: null,
      importSource: "manual",
      importBatchId: null,
      externalId: null,
      servicem8Uuid: null,
      lifetimeValue: "0",
      totalJobs: 0,
      lastContactDate: null,
      preferredContactMethod: null,
      tags: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    console.log("Preview customer being used:", previewCustomer);

    // Convert sections to preview format
    const previewSections = sections.map((section) => ({
      ...section,
      photos: section.photos,
      lineItems: (section.lineItems || []).map((item) => ({
        ...item,
        id: item.id || `item-${Date.now()}-${Math.random()}`, // Ensure ID is never undefined
        selected: item.selected !== false, // Default to true if not explicitly false
      })),
    }));

    // Get job data if available
    const job =
      jobData && (jobData as any)?.success ? (jobData as any).data : null;

    return {
      proposal: previewProposal,
      template: previewTemplate,
      customer: previewCustomer,
      sections: previewSections,
      job: job,
    };
  };

  // Manual save handler (keeps modal open)
  const handleManualSave = async () => {
    const formData = form.getValues();
    let effectiveJobId = formData.jobId || jobId;

    // If no job ID and we have a callback to save the parent job, call it first
    if (!effectiveJobId && onRequestJobSave) {
      try {
        effectiveJobId = await onRequestJobSave();
        form.setValue("jobId", effectiveJobId);
      } catch (error) {
        console.error("Failed to save parent job:", error);
        toast({
          title: "Save Failed",
          description: "Please save the job before creating a proposal",
          variant: "destructive",
        });
        return;
      }
    }

    if (!effectiveJobId) {
      toast({
        title: "Job Required",
        description: "Please save the job before creating a proposal",
        variant: "destructive",
      });
      return;
    }

    const proposalData = {
      customerId: formData.customerId || customerId,
      jobId: effectiveJobId,
      quoteId: formData.quoteId,
      proposalNumber: draftProposalId ? undefined : `PROP-${Date.now()}`,
      title: formData.title || "Untitled Proposal",
      introduction: formData.introduction,
      subtotal: subtotal.toString(),
      gstAmount: taxAmount.toString(),
      totalAmount: grandTotal.toString(),
      taxRate: (formData.taxRate || 15).toString(),
      discountAmount: discountValue.toString(),
      discountType: formData.discountType || "fixed",
      status: "draft",
      deliveryMethod: formData.deliveryMethod || "email",
      notes: formData.notes,
      createdBy: "system",
      sections: sections,
    };

    try {
      await saveDraftMutation.mutateAsync(proposalData);
    } catch (error) {
      console.error("Manual save error:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save proposal",
        variant: "destructive",
      });
    }
  };

  // Submit proposal (saves and closes modal)
  const onSubmit = async (data: any) => {
    try {
      let effectiveJobId = data.jobId || jobId;

      // In edit mode the proposal already has a jobId — no need to save the parent job
      if (mode !== "edit") {
        // If no job ID and we have a callback to save the parent job, call it first
        if (!effectiveJobId && onRequestJobSave) {
          try {
            effectiveJobId = await onRequestJobSave();
            form.setValue("jobId", effectiveJobId);
          } catch (error) {
            console.error("Failed to save parent job:", error);
            toast({
              title: "Save Failed",
              description: "Please save the job before creating a proposal",
              variant: "destructive",
            });
            return;
          }
        }

        if (!effectiveJobId) {
          toast({
            title: "Job Required",
            description: "Please save the job before creating a proposal",
            variant: "destructive",
          });
          return;
        }
      }

      const proposalData: any = {
        customerId: data.customerId || customerId,
        jobId: effectiveJobId,
        quoteId: data.quoteId,
        proposalNumber: data.proposalNumber || `PROP-${Date.now()}`,
        title: data.title,
        introduction: data.introduction,
        subtotal: subtotal.toString(),
        gstAmount: taxAmount.toString(),
        totalAmount: grandTotal.toString(),
        taxRate: (data.taxRate || 15).toString(),
        discountAmount: discountValue.toString(),
        discountType: data.discountType || "fixed",
        status: "draft",
        deliveryMethod: data.deliveryMethod,
        notes: data.notes,
        createdBy: "system",
        sections: sections,
      };

      // In edit mode, pass the proposal ID so the mutation uses PUT instead of POST
      if (mode === "edit" && draftProposalId) {
        proposalData._proposalId = draftProposalId;
      }

      await createProposalMutation.mutateAsync(proposalData);
    } catch (error) {
      console.error("Form submission error:", error);
      // Error handled by mutation's onError callback
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[min(calc(100vw-1rem),36rem)] max-h-[90vh] overflow-x-hidden overflow-y-hidden flex flex-col p-0 w-full min-w-0 gap-0">
          {/* Modern Header with Gradient Accent */}
          <div
            className="flex-shrink-0 border-b bg-gradient-to-r from-primary/5 via-primary/3 to-transparent"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
          >
            <DialogHeader className="px-4 sm:px-6 pb-4">
              <div className="flex items-start justify-between gap-4 w-full">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-xl sm:text-2xl font-semibold tracking-tight">
                        {mode === "edit" ? "Edit Proposal" : "Create Proposal"}
                      </DialogTitle>
                      <DialogDescription className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
                        Build your professional proposal with sections and line
                        items
                      </DialogDescription>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {autoSaveStatus === "saving" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50">
                      <div className="w-2.5 h-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        Saving
                      </span>
                    </div>
                  )}
                  {autoSaveStatus === "saved" && lastSavedAt && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950/50">
                      <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">
                        Saved
                      </span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-9 w-9 rounded-lg hover:bg-muted"
                    data-testid="button-close-proposal"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* VIP Member Banner */}
          {vipCustomer?.isVipMember && (
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span className="text-sm font-medium text-amber-800">
                  VIP Member — {vipCustomer.name?.split(" ")[0]} receives
                  {vipCustomer.vipDiscountPercent
                    ? ` a ${parseFloat(vipCustomer.vipDiscountPercent)}% discount`
                    : " a VIP discount"}
                </span>
              </div>
              {vipCustomer.vipDiscountPercent && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-800 bg-white hover:bg-amber-100 flex-shrink-0"
                  onClick={() => {
                    form.setValue(
                      "discountAmount",
                      parseFloat(vipCustomer.vipDiscountPercent) as any,
                    );
                    form.setValue("discountType", "percentage");
                  }}
                >
                  Apply {parseFloat(vipCustomer.vipDiscountPercent)}% Discount
                </Button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-x-hidden overflow-y-auto w-full max-w-full min-w-0 bg-muted/30">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0 pb-20 sm:pb-8 p-4 sm:p-6"
              >
                {/* Sections Management */}
                <div className="w-full max-w-full min-w-0">
                  <div className="flex items-center justify-between w-full mb-4">
                    <div>
                      <h2 className="text-base font-semibold">
                        Proposal Sections
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Add sections to organize your services
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addNewSection}
                      className="gap-2"
                      data-testid="button-add-section"
                    >
                      <Plus className="h-4 w-4" />
                      Add Section
                    </Button>
                  </div>

                  <div className="space-y-4 w-full max-w-full min-w-0">
                    {sections.map((section, index) => (
                      <Card
                        key={section.id}
                        className="w-full max-w-full min-w-0 border shadow-sm overflow-hidden"
                      >
                        {/* Section Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                              {index + 1}
                            </div>
                            <div>
                              <h3 className="font-medium text-sm">
                                {section.title}
                              </h3>
                              <span className="text-xs text-muted-foreground">
                                {(section.lineItems || []).length} line item
                                {(section.lineItems || []).length !== 1
                                  ? "s"
                                  : ""}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {sections.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSection(section.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                data-testid={`button-remove-section-${section.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <CardContent className="space-y-3 p-3 sm:p-4">
                          {/* Section Description */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-sm font-medium">
                                Description
                              </label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-[44px] px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                onClick={() => {
                                  // Simple voice-to-text using browser SpeechRecognition
                                  const SpeechRecognition =
                                    (window as any).SpeechRecognition ||
                                    (window as any).webkitSpeechRecognition;
                                  if (!SpeechRecognition) {
                                    toast({
                                      title: "Not Supported",
                                      description:
                                        "Speech recognition is not supported in this browser.",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  const recognition = new SpeechRecognition();
                                  recognition.continuous = false;
                                  recognition.interimResults = false;

                                  recognition.onresult = (event: any) => {
                                    const transcript =
                                      event.results[0][0].transcript;
                                    // Append to existing description
                                    const currentDesc =
                                      section.description || "";
                                    const newDesc = currentDesc
                                      ? `${currentDesc}\n${transcript}`
                                      : transcript;
                                    updateSectionDescription(
                                      section.id,
                                      newDesc,
                                    );
                                  };

                                  recognition.onerror = () => {
                                    toast({
                                      title: "Error",
                                      description:
                                        "Could not capture voice. Please try again.",
                                      variant: "destructive",
                                    });
                                  };

                                  recognition.start();
                                }}
                                data-testid={`button-voice-section-description-${section.id}`}
                              >
                                <Mic className="h-4 w-4 mr-1" />
                                <span className="text-xs">Voice</span>
                              </Button>
                            </div>
                            <Textarea
                              value={section.description}
                              onChange={(e) =>
                                updateSectionDescription(
                                  section.id,
                                  e.target.value,
                                )
                              }
                              placeholder="Describe this section of work..."
                              className="min-h-[160px] border-0 p-0 focus-visible:ring-0"
                              data-testid={`textarea-section-description-${section.id}`}
                            />
                          </div>

                          {/* Section Photos */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium">
                                Photos
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) =>
                                    handlePhotoUpload(e, section.id)
                                  }
                                  className="hidden"
                                  id={`photo-upload-${section.id}`}
                                />
                                <label htmlFor={`photo-upload-${section.id}`}>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={photoUploading}
                                    className="min-h-[44px]"
                                    data-testid={`button-upload-photo-${section.id}`}
                                    asChild
                                  >
                                    <span>
                                      <Camera className="h-4 w-4 mr-2" />
                                      {photoUploading
                                        ? "Uploading..."
                                        : "Add Photos"}
                                    </span>
                                  </Button>
                                </label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    openDiaryPhotoDialog(section.id)
                                  }
                                  disabled={getDiaryPhotos().length === 0}
                                  className="min-h-[44px]"
                                  data-testid={`button-select-diary-photos-${section.id}`}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Select from Diary
                                </Button>
                              </div>
                            </div>

                            {(section.photos || []).length > 0 && (
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                {(section.photos || []).map((photo) => (
                                  <div
                                    key={photo.id}
                                    className="relative group"
                                  >
                                    <img
                                      src={photo.url}
                                      alt={photo.filename}
                                      className="w-full h-14 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() =>
                                        setEnlargedPhotoUrl(photo.url)
                                      }
                                    />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removePhoto(section.id, photo.id);
                                      }}
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
                              <label className="text-sm font-medium">
                                Line Items
                              </label>
                            </div>

                            {/* Add Line Item Form */}
                            <Card className="mb-3 max-w-md">
                              <CardHeader className="p-3">
                                <CardTitle className="text-sm">
                                  Add Line Item
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2 p-3 pt-0">
                                {/* Basic Details - Searchable Material Dropdown */}
                                <div className="relative">
                                  <div className="relative">
                                    <Input
                                      placeholder="Type to search materials or enter description..."
                                      value={currentLineItem.description || ""}
                                      onChange={(e) => {
                                        setCurrentLineItem((prev) => ({
                                          ...prev,
                                          description: e.target.value,
                                        }));
                                        setMaterialSearchQuery(e.target.value);
                                        setMaterialsDropdownSectionId(
                                          section.id,
                                        );
                                      }}
                                      onFocus={() =>
                                        setMaterialsDropdownSectionId(
                                          section.id,
                                        )
                                      }
                                      onBlur={(e) => {
                                        // Delay closing to allow click on dropdown items
                                        setTimeout(() => {
                                          if (
                                            !e.relatedTarget?.closest(
                                              "[data-materials-dropdown]",
                                            )
                                          ) {
                                            setMaterialsDropdownSectionId(null);
                                            setMaterialSearchQuery("");
                                          }
                                        }, 150);
                                      }}
                                      className="min-h-[44px] text-base pr-8"
                                      data-testid={`input-line-item-description-${section.id}`}
                                    />
                                    <Package className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  </div>
                                  {materialsDropdownSectionId ===
                                    section.id && (
                                    <div
                                      data-materials-dropdown
                                      className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto"
                                    >
                                      {materials.length === 0 ? (
                                        <div className="p-3 text-sm text-muted-foreground text-center">
                                          No materials found. Add items in
                                          Settings &gt; Materials.
                                        </div>
                                      ) : (
                                        <>
                                          <div className="p-2 border-b bg-muted/30">
                                            <span className="text-xs font-medium text-muted-foreground">
                                              Select from Materials & Services
                                            </span>
                                          </div>
                                          {materials
                                            .filter(
                                              (m: any) =>
                                                !materialSearchQuery ||
                                                m.name
                                                  ?.toLowerCase()
                                                  .includes(
                                                    materialSearchQuery.toLowerCase(),
                                                  ) ||
                                                m.itemNumber
                                                  ?.toString()
                                                  .includes(
                                                    materialSearchQuery,
                                                  ),
                                            )
                                            .slice(0, 15)
                                            .map((material: any) => (
                                              <div
                                                key={material.id}
                                                className="flex items-center justify-between p-2 hover:bg-accent cursor-pointer border-b last:border-b-0"
                                                onMouseDown={(e) => {
                                                  e.preventDefault(); // Prevent blur before click completes
                                                  const price =
                                                    typeof material.price ===
                                                    "string"
                                                      ? parseFloat(
                                                          material.price,
                                                        )
                                                      : material.price || 0;
                                                  setCurrentLineItem(
                                                    (prev) => ({
                                                      ...prev,
                                                      description:
                                                        material.name ||
                                                        `Item #${material.itemNumber}`,
                                                      unitPrice: price,
                                                      quantity:
                                                        prev.quantity || 1,
                                                      priceIncludesTax:
                                                        material.priceIncludesTaxes ||
                                                        false,
                                                    }),
                                                  );
                                                  setMaterialsDropdownSectionId(
                                                    null,
                                                  );
                                                  setMaterialSearchQuery("");
                                                }}
                                                data-testid={`material-option-${material.id}`}
                                              >
                                                <div className="flex flex-col">
                                                  <span className="text-sm font-medium">
                                                    {material.name}
                                                  </span>
                                                  <span className="text-xs text-muted-foreground">
                                                    #{material.itemNumber} ·{" "}
                                                    {material.category ||
                                                      "Uncategorized"}
                                                  </span>
                                                </div>
                                                <Badge
                                                  variant="secondary"
                                                  className="ml-2"
                                                >
                                                  $
                                                  {typeof material.price ===
                                                  "string"
                                                    ? parseFloat(
                                                        material.price,
                                                      ).toFixed(2)
                                                    : (
                                                        material.price || 0
                                                      ).toFixed(2)}
                                                </Badge>
                                              </div>
                                            ))}
                                          {materials.filter(
                                            (m: any) =>
                                              !materialSearchQuery ||
                                              m.name
                                                ?.toLowerCase()
                                                .includes(
                                                  materialSearchQuery.toLowerCase(),
                                                ) ||
                                              m.itemNumber
                                                ?.toString()
                                                .includes(materialSearchQuery),
                                          ).length === 0 && (
                                            <div className="p-3 text-sm text-muted-foreground text-center">
                                              No matching materials. You can
                                              still type a custom description.
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Pricing Type Selection */}
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        checked={
                                          currentLineItem.pricingType ===
                                          "normal"
                                        }
                                        onChange={() =>
                                          setCurrentLineItem((prev) => ({
                                            ...prev,
                                            pricingType: "normal",
                                            choices: [],
                                            selectedChoiceId: undefined,
                                            fixedPrice: undefined,
                                          }))
                                        }
                                        data-testid={`radio-normal-pricing-${section.id}`}
                                      />
                                      <span className="text-sm">
                                        Normal Pricing
                                      </span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        checked={
                                          currentLineItem.pricingType ===
                                          "choice"
                                        }
                                        onChange={() =>
                                          setCurrentLineItem((prev) => ({
                                            ...prev,
                                            pricingType: "choice",
                                            fixedPrice: undefined,
                                          }))
                                        }
                                        data-testid={`radio-multiple-choice-${section.id}`}
                                      />
                                      <span className="text-sm">
                                        Multiple Choice
                                      </span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        checked={
                                          currentLineItem.pricingType ===
                                          "fixed"
                                        }
                                        onChange={() =>
                                          setCurrentLineItem((prev) => ({
                                            ...prev,
                                            pricingType: "fixed",
                                            choices: [],
                                            selectedChoiceId: undefined,
                                          }))
                                        }
                                        data-testid={`radio-fixed-price-${section.id}`}
                                      />
                                      <span className="text-sm">
                                        Fixed Price
                                      </span>
                                    </label>
                                  </div>

                                  {/* Normal Pricing Fields */}
                                  {currentLineItem.pricingType === "normal" && (
                                    <div className="space-y-2">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <Input
                                          type="number"
                                          placeholder="Quantity"
                                          value={currentLineItem.quantity || ""}
                                          onChange={(e) =>
                                            setCurrentLineItem((prev) => ({
                                              ...prev,
                                              quantity:
                                                parseFloat(e.target.value) || 0,
                                            }))
                                          }
                                          className="min-h-[44px] text-base"
                                          data-testid={`input-line-item-quantity-${section.id}`}
                                        />
                                        <Input
                                          type="number"
                                          placeholder="Unit Price"
                                          value={
                                            currentLineItem.unitPrice || ""
                                          }
                                          onChange={(e) =>
                                            setCurrentLineItem((prev) => ({
                                              ...prev,
                                              unitPrice:
                                                parseFloat(e.target.value) || 0,
                                            }))
                                          }
                                          onBlur={() => {
                                            if (
                                              currentLineItem.description?.trim() &&
                                              (currentLineItem.quantity || 0) > 0 &&
                                              (currentLineItem.unitPrice || 0) > 0
                                            ) {
                                              addLineItemToSection(section.id);
                                            }
                                          }}
                                          className="min-h-[44px] text-base"
                                          data-testid={`input-line-item-price-${section.id}`}
                                        />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          checked={
                                            currentLineItem.priceIncludesTax ||
                                            false
                                          }
                                          onCheckedChange={(checked) =>
                                            setCurrentLineItem((prev) => ({
                                              ...prev,
                                              priceIncludesTax:
                                                checked as boolean,
                                            }))
                                          }
                                          data-testid={`checkbox-price-includes-tax-${section.id}`}
                                        />
                                        <label className="text-sm">
                                          Price includes GST (15%)
                                        </label>
                                      </div>
                                    </div>
                                  )}

                                  {/* Fixed Price Field */}
                                  {currentLineItem.pricingType === "fixed" && (
                                    <div className="space-y-2">
                                      <Input
                                        type="number"
                                        placeholder="Fixed Price"
                                        value={currentLineItem.fixedPrice || ""}
                                        onChange={(e) =>
                                          setCurrentLineItem((prev) => ({
                                            ...prev,
                                            fixedPrice:
                                              parseFloat(e.target.value) || 0,
                                          }))
                                        }
                                        onBlur={() => {
                                          if (
                                            currentLineItem.description?.trim() &&
                                            (currentLineItem.fixedPrice || 0) > 0
                                          ) {
                                            addLineItemToSection(section.id);
                                          }
                                        }}
                                        className="min-h-[44px] text-base"
                                        data-testid={`input-fixed-price-${section.id}`}
                                      />
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          checked={
                                            currentLineItem.priceIncludesTax ||
                                            false
                                          }
                                          onCheckedChange={(checked) =>
                                            setCurrentLineItem((prev) => ({
                                              ...prev,
                                              priceIncludesTax:
                                                checked as boolean,
                                            }))
                                          }
                                          data-testid={`checkbox-price-includes-tax-fixed-${section.id}`}
                                        />
                                        <label className="text-sm">
                                          Price includes GST (15%)
                                        </label>
                                      </div>
                                    </div>
                                  )}

                                  {/* Multiple Choice Options */}
                                  {currentLineItem.pricingType === "choice" && (
                                    <div className="space-y-2">
                                      <div className="bg-muted/50 rounded-lg p-2">
                                        <h5 className="text-sm font-medium mb-2">
                                          Add Choice Option
                                        </h5>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                                          <Input
                                            placeholder="Choice Label"
                                            value={currentChoice.label || ""}
                                            onChange={(e) =>
                                              setCurrentChoice((prev) => ({
                                                ...prev,
                                                label: e.target.value,
                                              }))
                                            }
                                            data-testid={`input-choice-label-${section.id}`}
                                          />
                                          <Input
                                            placeholder="Description"
                                            value={
                                              currentChoice.description || ""
                                            }
                                            onChange={(e) =>
                                              setCurrentChoice((prev) => ({
                                                ...prev,
                                                description: e.target.value,
                                              }))
                                            }
                                            data-testid={`input-choice-description-${section.id}`}
                                          />
                                          <Input
                                            type="number"
                                            placeholder="Price"
                                            value={currentChoice.price || ""}
                                            onChange={(e) =>
                                              setCurrentChoice((prev) => ({
                                                ...prev,
                                                price:
                                                  parseFloat(e.target.value) ||
                                                  0,
                                              }))
                                            }
                                            data-testid={`input-choice-price-${section.id}`}
                                          />
                                        </div>
                                        <div className="flex items-center space-x-2 mb-2">
                                          <Checkbox
                                            checked={
                                              currentChoice.isDefault || false
                                            }
                                            onCheckedChange={(checked) =>
                                              setCurrentChoice((prev) => ({
                                                ...prev,
                                                isDefault: checked as boolean,
                                              }))
                                            }
                                            data-testid={`checkbox-choice-default-${section.id}`}
                                          />
                                          <label className="text-sm">
                                            Set as default choice
                                          </label>
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
                                      {currentLineItem.choices &&
                                        currentLineItem.choices.length > 0 && (
                                          <div>
                                            <h5 className="text-sm font-medium mb-1.5">
                                              Choice Options (
                                              {currentLineItem.choices.length})
                                            </h5>
                                            <div className="space-y-1.5">
                                              {currentLineItem.choices.map(
                                                (choice) => (
                                                  <div
                                                    key={choice.id}
                                                    className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-background rounded text-sm"
                                                  >
                                                    <div className="flex-1 min-w-0">
                                                      <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-medium">
                                                          {choice.label}
                                                        </span>
                                                        {choice.isDefault && (
                                                          <Badge variant="secondary">
                                                            Default
                                                          </Badge>
                                                        )}
                                                      </div>
                                                      <div className="text-xs text-muted-foreground break-words">
                                                        {choice.description} - $
                                                        {choice.price.toFixed(
                                                          2,
                                                        )}
                                                      </div>
                                                    </div>
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() =>
                                                        removeChoiceFromCurrentItem(
                                                          choice.id,
                                                        )
                                                      }
                                                      data-testid={`button-remove-choice-${choice.id}`}
                                                    >
                                                      <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        )}

                                      {/* Quantity for multiple choice */}
                                      <div>
                                        <Input
                                          type="number"
                                          placeholder="Quantity"
                                          value={currentLineItem.quantity || ""}
                                          onChange={(e) =>
                                            setCurrentLineItem((prev) => ({
                                              ...prev,
                                              quantity:
                                                parseFloat(e.target.value) || 0,
                                            }))
                                          }
                                          data-testid={`input-choice-quantity-${section.id}`}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <Button
                                  type="button"
                                  onClick={() =>
                                    addLineItemToSection(section.id)
                                  }
                                  data-testid={`button-add-line-item-${section.id}`}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Item
                                </Button>
                              </CardContent>
                            </Card>

                            {/* Line Items List */}
                            {(section.lineItems || []).length > 0 && (
                              <div className="space-y-1.5">
                                {(section.lineItems || []).map((item) => (
                                  <Card key={item.id} className="bg-muted/30">
                                    <CardContent className="p-2 sm:p-3">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                          <Checkbox
                                            checked={item.selected}
                                            onCheckedChange={() =>
                                              toggleLineItemSelection(
                                                section.id,
                                                item.id!,
                                              )
                                            }
                                            data-testid={`checkbox-line-item-${item.id}`}
                                            className="mt-0.5"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium break-words">
                                              {item.description}
                                            </div>

                                            {/* Fixed Price Item */}
                                            {item.pricingType === "fixed" && (
                                              <div className="text-sm text-muted-foreground">
                                                <Badge
                                                  variant="outline"
                                                  className="mr-2"
                                                >
                                                  Fixed Price
                                                </Badge>
                                                ${item.totalPrice.toFixed(2)}
                                              </div>
                                            )}

                                            {/* Multiple Choice Item */}
                                            {item.pricingType === "choice" &&
                                              item.choices.length > 0 && (
                                                <div className="space-y-2 mt-2">
                                                  <div className="flex items-center space-x-2">
                                                    <Badge variant="outline">
                                                      Multiple Choice
                                                    </Badge>
                                                    <span className="text-sm text-muted-foreground">
                                                      Qty: {item.quantity}
                                                    </span>
                                                  </div>
                                                  <Select
                                                    value={
                                                      item.selectedChoiceId ||
                                                      ""
                                                    }
                                                    onValueChange={(value) =>
                                                      updateLineItemChoice(
                                                        section.id,
                                                        item.id!,
                                                        value,
                                                      )
                                                    }
                                                  >
                                                    <SelectTrigger
                                                      className="w-full"
                                                      data-testid={`select-choice-${item.id}`}
                                                    >
                                                      <SelectValue placeholder="Select an option..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {item.choices.map(
                                                        (choice) => (
                                                          <SelectItem
                                                            key={choice.id}
                                                            value={choice.id}
                                                          >
                                                            <div className="flex flex-col">
                                                              <span className="font-medium">
                                                                {choice.label}
                                                              </span>
                                                              <span className="text-sm text-muted-foreground">
                                                                {
                                                                  choice.description
                                                                }{" "}
                                                                - $
                                                                {choice.price.toFixed(
                                                                  2,
                                                                )}
                                                              </span>
                                                            </div>
                                                          </SelectItem>
                                                        ),
                                                      )}
                                                    </SelectContent>
                                                  </Select>
                                                  <div className="text-sm text-muted-foreground">
                                                    Total: $
                                                    {item.totalPrice.toFixed(2)}
                                                  </div>
                                                </div>
                                              )}

                                            {/* Normal Item */}
                                            {item.pricingType === "normal" && (
                                              <div className="text-sm text-muted-foreground">
                                                {item.quantity} × $
                                                {item.unitPrice.toFixed(2)} = $
                                                {item.totalPrice.toFixed(2)}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            removeLineItem(section.id, item.id!)
                                          }
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
                </div>

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
                          <span
                            className="font-semibold"
                            data-testid="text-subtotal"
                          >
                            ${subtotal.toFixed(2)}
                          </span>
                        </div>

                        {/* Discount Input */}
                        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 space-y-2">
                          <label className="text-sm font-medium text-orange-700 dark:text-orange-300 flex items-center gap-1">
                            <Percent className="h-3.5 w-3.5" />
                            Discount
                          </label>
                          <div className="flex gap-2">
                            <Select
                              value={form.watch("discountType") || "fixed"}
                              onValueChange={(value) =>
                                form.setValue(
                                  "discountType",
                                  value as "fixed" | "percentage",
                                )
                              }
                            >
                              <SelectTrigger
                                className="w-24"
                                data-testid="select-discount-type"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fixed">$</SelectItem>
                                <SelectItem value="percentage">%</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={form.watch("discountAmount") || ""}
                              onChange={(e) =>
                                form.setValue(
                                  "discountAmount",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="flex-1"
                              data-testid="input-discount-amount"
                            />
                          </div>
                          {discountValue > 0 && (
                            <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400">
                              <span>Discount applied:</span>
                              <span className="font-medium">
                                -${discountValue.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between">
                          <span>Tax ({form.watch("taxRate") || 0}%):</span>
                          <span
                            className="font-semibold"
                            data-testid="text-tax"
                          >
                            ${taxAmount.toFixed(2)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total:</span>
                          <span
                            className="text-primary"
                            data-testid="text-total"
                          >
                            ${grandTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Selected Items Summary */}
                      <div>
                        <h4 className="font-semibold mb-2">
                          Selected Items ({selectedLineItems.length})
                        </h4>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {selectedLineItems.map((item) => (
                            <div
                              key={item.id}
                              className="text-sm flex justify-between"
                            >
                              <span className="truncate">
                                {item.description}
                              </span>
                              <span>${item.totalPrice.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Form Actions - Sticky Footer */}
                <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-8 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  <div className="px-4 sm:px-6 py-4">
                    {/* Mobile Layout - Dropdown Menu */}
                    <div className="sm:hidden flex items-center justify-between gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="default"
                            className="flex-1"
                            data-testid="button-actions-menu"
                          >
                            <MoreVertical className="h-4 w-4 mr-2" />
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuItem
                            onClick={handlePreview}
                            data-testid="menu-preview-proposal"
                            className="py-3"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 shadow-md mr-3">
                              <Eye
                                className="h-6 w-6 text-white"
                                strokeWidth={2.5}
                              />
                            </div>
                            <span className="font-medium">Preview</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              initializeEmailForm();
                              setShowEmailDialog(true);
                            }}
                            data-testid="menu-email-proposal"
                            className="py-3"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 shadow-md mr-3">
                              <Mail
                                className="h-6 w-6 text-white"
                                strokeWidth={2.5}
                              />
                            </div>
                            <span className="font-medium">Email</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              initializeSmsForm();
                              setShowSmsDialog(true);
                            }}
                            data-testid="menu-sms-proposal"
                            className="py-3"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 shadow-md mr-3">
                              <MessageSquare
                                className="h-6 w-6 text-white"
                                strokeWidth={2.5}
                              />
                            </div>
                            <span className="font-medium">SMS</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={handleManualSave}
                            disabled={saveDraftMutation.isPending}
                            data-testid="menu-save-proposal"
                            className="py-3"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 shadow-md mr-3">
                              <Save
                                className="h-6 w-6 text-white"
                                strokeWidth={2.5}
                              />
                            </div>
                            <span className="font-medium">
                              {saveDraftMutation.isPending
                                ? "Saving..."
                                : "Save Draft"}
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={onClose}
                            data-testid="menu-cancel-proposal"
                            className="py-3"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-red-400 to-red-600 shadow-md mr-3">
                              <X
                                className="h-6 w-6 text-white"
                                strokeWidth={2.5}
                              />
                            </div>
                            <span className="font-medium">Cancel</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        type="submit"
                        disabled={createProposalMutation.isPending}
                        data-testid="button-update-proposal-mobile"
                        className="gap-2"
                      >
                        {createProposalMutation.isPending ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {mode === "edit" ? "Updating..." : "Creating..."}
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            {mode === "edit" ? "Update" : "Create"}
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Desktop Layout - Individual Buttons */}
                    <div className="hidden sm:flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      {/* Secondary Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handlePreview}
                          data-testid="button-preview-proposal"
                          className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-300 dark:border-purple-800"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">Preview</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            initializeEmailForm();
                            setShowEmailDialog(true);
                          }}
                          data-testid="button-email-proposal"
                          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 dark:border-blue-800"
                        >
                          <Mail className="h-4 w-4" />
                          <span className="hidden sm:inline">Email</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            initializeSmsForm();
                            setShowSmsDialog(true);
                          }}
                          data-testid="button-sms-proposal"
                          className="flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300 dark:border-green-800"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span className="hidden sm:inline">SMS</span>
                        </Button>
                      </div>

                      {/* Primary Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onClose}
                          data-testid="button-cancel-proposal"
                          className="bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleManualSave}
                          disabled={saveDraftMutation.isPending}
                          data-testid="button-save-only-proposal"
                          className="gap-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-300 dark:border-orange-800"
                        >
                          {saveDraftMutation.isPending ? (
                            <>
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              <span className="hidden sm:inline">
                                Saving...
                              </span>
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              <span className="hidden sm:inline">Save</span>
                            </>
                          )}
                        </Button>
                        <Button
                          type="submit"
                          disabled={createProposalMutation.isPending}
                          data-testid="button-update-proposal"
                          className="gap-2"
                        >
                          {createProposalMutation.isPending ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span className="hidden sm:inline">
                                {mode === "edit"
                                  ? "Updating..."
                                  : "Creating..."}
                              </span>
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              <span className="hidden sm:inline">
                                {mode === "edit"
                                  ? "Update Proposal"
                                  : "Create Proposal"}
                              </span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
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
          <DialogContent className="max-w-[min(calc(100vw-1rem),36rem)] max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 p-3 sm:p-4 sticky top-0 bg-background z-[60]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base sm:text-2xl font-bold text-primary">
                    Proposal Preview
                  </DialogTitle>
                  <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                    Preview of your proposal as it will appear to customers
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => acceptProposalMutation.mutate()}
                    disabled={acceptProposalMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] sm:min-h-9"
                    size="default"
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
                        <span className="hidden sm:inline">Accept</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowPreview(false)}
                    className="min-h-[44px] min-w-[44px] sm:h-9 sm:w-9"
                    data-testid="button-close-preview"
                  >
                    <X className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-auto p-4 pr-8 sm:p-6 sm:pr-12">
              {(() => {
                const previewData = getPreviewData();
                return (
                  <ProposalTemplate
                    template={previewData.template}
                    proposal={previewData.proposal}
                    customer={previewData.customer}
                    job={previewData.job}
                    sections={previewData.sections}
                    showActions={true}
                    onEmail={() => {
                      initializeEmailForm();
                      setShowEmailDialog(true);
                    }}
                    onSms={() => {
                      initializeSmsForm();
                      setShowSmsDialog(true);
                    }}
                    onDownload={async () => {
                      const pid = draftProposalId || proposalId;
                      if (!pid) return;
                      try {
                        const res = await fetch(`/api/proposals/${pid}/pdf`);
                        if (!res.ok) throw new Error("PDF failed");
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Proposal-${pid}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch {
                        toast({ title: "Download failed", description: "Could not generate PDF.", variant: "destructive" });
                      }
                    }}
                    onCopy={() => console.log("Copy proposal")}
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
          <DialogContent
            className="max-w-full sm:max-w-2xl p-4 sm:p-6"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
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
                  onChange={(e) =>
                    setEmailForm((prev) => ({ ...prev, to: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setEmailForm((prev) => ({ ...prev, cc: e.target.value }))
                  }
                  data-testid="input-email-cc"
                />
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject *</label>
                <Input
                  placeholder="Proposal subject"
                  value={emailForm.subject}
                  onChange={(e) =>
                    setEmailForm((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  data-testid="input-email-subject"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  placeholder="Enter your message..."
                  value={emailForm.message}
                  onChange={(e) =>
                    setEmailForm((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  rows={8}
                  data-testid="textarea-email-message"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-xs text-gray-500">* Required fields</div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowEmailDialog(false)}
                    disabled={sendEmailMutation.isPending}
                    data-testid="button-cancel-email"
                    className="bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendEmail}
                    disabled={
                      sendEmailMutation.isPending ||
                      !emailForm.to.trim() ||
                      !emailForm.subject.trim()
                    }
                    data-testid="button-send-email"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
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
                  onChange={(e) =>
                    setSmsForm((prev) => ({ ...prev, to: e.target.value }))
                  }
                  data-testid="input-sms-phone"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Message *</label>
                <Textarea
                  placeholder="Enter your message..."
                  value={smsForm.message}
                  onChange={(e) =>
                    setSmsForm((prev) => ({ ...prev, message: e.target.value }))
                  }
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
                <div className="text-xs text-gray-500">* Required fields</div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowSmsDialog(false)}
                    disabled={sendSmsMutation.isPending}
                    data-testid="button-cancel-sms"
                    className="bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendSms}
                    disabled={
                      sendSmsMutation.isPending ||
                      !smsForm.to.trim() ||
                      !smsForm.message.trim()
                    }
                    data-testid="button-send-sms"
                    className="bg-green-600 hover:bg-green-700 text-white"
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
        <Dialog
          open={showDiaryPhotoDialog}
          onOpenChange={setShowDiaryPhotoDialog}
        >
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
                      className={`relative cursor-pointer rounded-lg transition-all ${
                        selectedDiaryPhotos.includes(photoUrl)
                          ? "ring-2 ring-blue-600 ring-offset-2"
                          : "hover:ring-2 hover:ring-muted-foreground/30"
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
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t p-4 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {selectedDiaryPhotos.length} photo(s) selected
                </span>
                {getDiaryPhotos().length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allPhotos = getDiaryPhotos();
                      const allSelected = allPhotos.every((p) =>
                        selectedDiaryPhotos.includes(p),
                      );
                      setSelectedDiaryPhotos(allSelected ? [] : allPhotos);
                    }}
                    data-testid="button-select-all-diary-photos"
                  >
                    {getDiaryPhotos().every((p) =>
                      selectedDiaryPhotos.includes(p),
                    )
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                )}
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
                  Add{" "}
                  {selectedDiaryPhotos.length > 0
                    ? `${selectedDiaryPhotos.length} `
                    : ""}
                  Photo(s)
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Photo Lightbox Modal */}
      {enlargedPhotoUrl && (
        <Dialog
          open={!!enlargedPhotoUrl}
          onOpenChange={() => setEnlargedPhotoUrl(null)}
        >
          <DialogContent className="max-w-full sm:max-w-4xl h-[90vh] p-0 bg-black/95">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-50 text-white hover:bg-white/20"
              onClick={() => setEnlargedPhotoUrl(null)}
              data-testid="button-close-photo-lightbox"
            >
              <X className="h-6 w-6" />
            </Button>
            <div className="flex items-center justify-center h-full p-4">
              <img
                src={enlargedPhotoUrl}
                alt="Enlarged view"
                className="max-w-full max-h-full object-contain"
                onClick={() => setEnlargedPhotoUrl(null)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
