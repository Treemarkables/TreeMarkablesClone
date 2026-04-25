import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  Send,
  X,
  Loader2,
  MapPin,
  Mail,
  FileText,
  Plus,
  Trash2,
  DollarSign,
  MessageSquare,
  FileDown,
  Package,
  User,
  Calendar,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { EmailComposerModal } from "@/components/EmailComposerModal";
import { SMSComposerModal } from "@/components/SMSComposerModal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DocumentTemplate, Customer, Job, InvoiceSectionConfig } from "@shared/schema";

interface InvoiceBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  customer: Customer;
  invoiceTemplate: DocumentTemplate;
  startFresh?: boolean; // If true, starts a new invoice instead of loading existing
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category?: string; // labor_fixed, labor_chargeout, materials, equipment, disposal, other
  materialId?: string; // Link to material for margin tracking
  serviceId?: string; // Link to service for margin tracking
  unitCost?: number; // Cost per unit for margin calculation
}

interface CreatedInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  jobId: string;
  amount: string;
  status: string;
  dueDate: string;
  issueDate: string;
  items: any[];
  notes: string;
  address: string;
}

export function InvoiceBuilder({
  isOpen,
  onClose,
  job,
  customer,
  invoiceTemplate,
  startFresh = false,
}: InvoiceBuilderProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(
    null,
  );
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showSmsComposer, setShowSmsComposer] = useState(false);
  const [initializedJobId, setInitializedJobId] = useState<string | null>(null);
  const [existingInvoiceId, setExistingInvoiceId] = useState<string | null>(
    null,
  );

  // Immediate lock to prevent concurrent button clicks (doesn't rely on state updates)
  const isCreatingRef = useRef(false);

  // Editable fields
  const [editableAddress, setEditableAddress] = useState("");
  const [editableContactName, setEditableContactName] = useState("");
  const [editableEmail, setEditableEmail] = useState("");
  const [editableDescription, setEditableDescription] = useState("");
  const [editableNotes, setEditableNotes] = useState("");
  const [customDueDate, setCustomDueDate] = useState<string>("");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  // Fetch the customer fresh so invoiceCcEmail is always up-to-date,
  // even if the parent component cached stale customer data before the record was edited.
  const { data: freshCustomerData } = useQuery({
    queryKey: ["/api/customers", customer.id],
    enabled: !!customer.id,
    select: (response: any) => response.data || response,
  });
  const effectiveCustomer = (freshCustomerData as Customer | undefined) || customer;

  // Fetch proposals for this job
  const { data: proposalsResponse, isLoading: loadingProposals } = useQuery({
    queryKey: ["/api/proposals", job.id],
    queryFn: async () => {
      const response = await fetch(
        `/api/proposals?jobId=${job.id}&includeSections=true`,
      );
      if (!response.ok) throw new Error("Failed to fetch proposals");
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch quotes for this job
  const { data: quotesResponse, isLoading: loadingQuotes } = useQuery({
    queryKey: ["/api/quotes", job.id],
    queryFn: async () => {
      const response = await fetch(`/api/quotes?jobId=${job.id}`);
      if (!response.ok) throw new Error("Failed to fetch quotes");
      return response.json();
    },
    enabled: isOpen,
  });

  // Fetch existing invoices for this job
  const { data: invoicesResponse, isLoading: loadingInvoices } = useQuery({
    queryKey: ["/api/invoices", job.id],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?jobId=${job.id}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
    enabled: isOpen && !!job.id,
  });

  // Fetch business settings for invoice payment days
  const { data: businessSettings } = useQuery({
    queryKey: ["/api/business-settings"],
    enabled: isOpen,
  });
  const invoicePaymentDays: number = (businessSettings as any)?.data?.invoicePaymentDays ?? 7;

  // Fetch materials/services for line item selection
  const { data: materialsData } = useQuery({
    queryKey: ["/api/materials"],
    enabled: isOpen,
  });
  const materials = (materialsData as any)?.data || [];

  // Materials dropdown state
  const [materialsDropdownItemId, setMaterialsDropdownItemId] = useState<
    string | null
  >(null);
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");

  // Reset initialization when modal closes so it reloads when reopened
  useEffect(() => {
    if (!isOpen) {
      setInitializedJobId(null);
      setExistingInvoiceId(null);
      setCreatedInvoice(null);
    }
  }, [isOpen]);

  // Initialize fields when modal opens or when job changes
  useEffect(() => {
    if (!isOpen) return;

    // Check if we've already initialized this specific job
    if (initializedJobId === job.id) return;

    // Only initialize if we have the data or if data loading is complete
    const dataLoaded = !loadingProposals && !loadingQuotes && !loadingInvoices;
    if (!dataLoaded) return;

    console.log(
      "🔄 Initializing invoice for job:",
      job.id,
      "(previous:",
      initializedJobId,
      ")",
    );

    // Check if an invoice already exists for this job
    console.log(
      "🔍 InvoiceBuilder initialization - invoicesResponse:",
      invoicesResponse,
    );
    const existingInvoices = invoicesResponse?.data || [];
    console.log(
      "🔍 Existing invoices found:",
      existingInvoices.length,
      existingInvoices,
    );
    if (existingInvoices.length > 0) {
      const existingInvoice = existingInvoices[0]; // Use the first (most recent) invoice
      console.log(
        "📄 Found existing invoice:",
        existingInvoice.invoiceNumber,
        existingInvoice,
      );
      setCreatedInvoice({
        id: existingInvoice.id,
        invoiceNumber: existingInvoice.invoiceNumber,
        customerId: existingInvoice.customerId,
        jobId: existingInvoice.jobId,
        amount: existingInvoice.amount,
        status: existingInvoice.status,
        dueDate: existingInvoice.dueDate,
        issueDate: existingInvoice.issueDate,
        items: existingInvoice.items || [],
        notes: existingInvoice.notes || "",
        address:
          existingInvoice.address || job.address || customer.address || "",
      });
      setExistingInvoiceId(existingInvoice.id);

      // Populate line items from existing invoice
      if (existingInvoice.items && Array.isArray(existingInvoice.items)) {
        const convertedItems = existingInvoice.items.map(
          (item: any, index: number) => ({
            id: item.id || `item-${index}`,
            description: item.description || "",
            quantity: parseFloat(item.quantity || "1"),
            unitPrice: parseFloat(item.rate || item.unitPrice || "0"),
            total: parseFloat(item.amount || item.total || "0"),
            unit: item.unit || "each",
            category: item.category,
            serviceId: item.serviceId,
            materialId: item.materialId,
            unitCost: item.unitCost ? parseFloat(item.unitCost) : undefined,
          }),
        );
        setLineItems(convertedItems);
      }

      // Populate notes and description from existing invoice (always set, even if empty)
      // description is the primary field; fall back to notes for older invoices that stored description there
      setEditableNotes(existingInvoice.notes ?? "");
      // If the saved invoice description is empty (either the user created
      // the invoice before adding a job description, or the initial copy at
      // create time was from an empty job), fall back to the current job
      // description. A non-empty saved value still wins — we don't stomp on
      // edits that were made directly inside the invoice.
      const savedInvoiceDesc =
        existingInvoice.description ?? existingInvoice.notes ?? "";
      setEditableDescription(savedInvoiceDesc || job.description || "");
    } else {
      console.log("⚠️ No existing invoices found for this job");
    }

    // Set address, contact name, and email
    // Billing overrides set on the job's Billing tab take priority over raw customer/contact fields
    setEditableAddress(
      job.billingAddress || job.address || customer.address || "",
    );
    // Build contact name: prefer billing name override, then existing invoice name, then job contact name
    const jobContactName =
      job.jobContactFirstName && job.jobContactLastName
        ? `${job.jobContactFirstName} ${job.jobContactLastName}`
        : job.jobContactFirstName || job.jobContactLastName || "";
    const existingInvoiceContactName =
      existingInvoices.length > 0 ? existingInvoices[0]?.contactName : null;
    setEditableContactName(
      job.billingNameOverride ||
      existingInvoiceContactName ||
      jobContactName ||
      customer.name ||
      "",
    );
    // Email: prefer billing contact email override, then existing invoice email, then job contact email, then customer email
    setEditableEmail(
      job.billingContactEmail ||
      (existingInvoices.length > 0 ? existingInvoices[0]?.email : null) ||
      (job as any).jobContactEmail ||
      customer.email ||
      "",
    );

    // Initialise the due date: prefer existing invoice's due date, else default from settings
    const existingDue = existingInvoices.length > 0 ? existingInvoices[0]?.dueDate : null;
    if (existingDue) {
      setCustomDueDate(new Date(existingDue).toISOString().split("T")[0]);
    } else {
      const defaultDays = (businessSettings as any)?.data?.invoicePaymentDays ?? 7;
      const d = new Date();
      d.setDate(d.getDate() + defaultDays);
      setCustomDueDate(d.toISOString().split("T")[0]);
    }

    // Get proposals and quotes
    const proposals = proposalsResponse?.data || [];
    const quotes = quotesResponse?.data || [];

    // Find accepted proposal or most recent sent proposal
    const acceptedProposal = proposals.find(
      (p: any) => p.status === "accepted",
    );
    const sentProposal = proposals.find((p: any) => p.status === "sent");
    const proposal = acceptedProposal || sentProposal || proposals[0];

    // Find accepted or sent quote
    const acceptedQuote = quotes.find((q: any) => q.status === "accepted");
    const sentQuote = quotes.find((q: any) => q.status === "sent");
    const quote = acceptedQuote || sentQuote || quotes[0];

    // Extract line items from proposal sections or quote
    let extractedItems: InvoiceLineItem[] = [];

    if (proposal?.sections) {
      // Get line items from proposal sections
      proposal.sections.forEach((section: any) => {
        if (section.lineItems && Array.isArray(section.lineItems)) {
          section.lineItems.forEach((item: any) => {
            extractedItems.push({
              id: Math.random().toString(),
              description: item.description || "",
              quantity: item.quantity || 1,
              unitPrice: parseFloat(item.rate || item.unitPrice || 0),
              total: parseFloat(item.total || item.amount || 0),
            });
          });
        }
      });
    }

    // If proposal had no line items, fall back to quote
    if (
      extractedItems.length === 0 &&
      quote?.lineItems &&
      Array.isArray(quote.lineItems)
    ) {
      quote.lineItems.forEach((item: any) => {
        extractedItems.push({
          id: Math.random().toString(),
          description: item.description || "",
          quantity: item.quantity || 1,
          unitPrice: parseFloat(item.rate || item.unitPrice || 0),
          total: parseFloat(item.total || item.amount || 0),
        });
      });
    }

    // If still no items, fall back to job line items
    if (
      extractedItems.length === 0 &&
      job.lineItems &&
      job.lineItems.length > 0
    ) {
      extractedItems = job.lineItems.map((item: any) => ({
        id: item.id || Math.random().toString(),
        description: item.description || "",
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        total: item.total || item.quantity * item.unitPrice || 0,
      }));
    }

    // Final fallback to job total
    if (extractedItems.length === 0) {
      extractedItems = [
        {
          id: Math.random().toString(),
          description: job.description || "Tree service",
          quantity: 1,
          unitPrice: parseFloat(job.totalAmount || "0"),
          total: parseFloat(job.totalAmount || "0"),
        },
      ];
    }

    // If proposal/quote items are available, always prefer them over the existing invoice's items.
    // This ensures the invoice is pre-filled with the accepted/sent quote without requiring
    // the user to manually click "Import from Quote/Proposal".
    const hasProposalOrQuoteItems = extractedItems.length > 0 &&
      !(extractedItems.length === 1 &&
        extractedItems[0].description === (job.description || "Tree service") &&
        !proposal && !quote);

    const existingItemsLookLikeProposalItems =
      existingInvoices.length > 0 &&
      existingInvoices[0].items &&
      Array.isArray(existingInvoices[0].items) &&
      existingInvoices[0].items.length > 0 &&
      (proposal?.sections?.some((s: any) =>
        s.lineItems?.some((li: any) =>
          existingInvoices[0].items.some((ei: any) => ei.description === li.description)
        )
      ) || quote?.lineItems?.some((li: any) =>
        existingInvoices[0].items.some((ei: any) => ei.description === li.description)
      ));

    if (existingInvoices.length === 0) {
      // New invoice — always set line items from proposal/quote/fallback
      setLineItems(extractedItems);
    } else if (hasProposalOrQuoteItems && !existingItemsLookLikeProposalItems) {
      // Existing invoice but its items weren't sourced from the current proposal/quote —
      // auto-import so the user doesn't have to click the button manually.
      setLineItems(extractedItems);
    }
    // else: existing invoice already has proposal-sourced items, keep them as-is.

    // Set description from proposal/quote (only if no existing invoice)
    if (!existingInvoices.length) {
      if (proposal) {
        setEditableDescription(proposal.introduction || job.description || "");
      } else if (quote) {
        setEditableDescription(quote.description || job.description || "");
      } else {
        setEditableDescription(job.description || "");
      }

      // Initialize notes for new invoices (use job notes as default)
      setEditableNotes(job.notes || "");
    }

    // Mark this job as initialized to prevent overwriting user edits
    setInitializedJobId(job.id);
  }, [
    isOpen,
    initializedJobId,
    loadingProposals,
    loadingQuotes,
    loadingInvoices,
    proposalsResponse,
    quotesResponse,
    invoicesResponse,
    job,
    customer,
  ]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCreatedInvoice(null);
      setExistingInvoiceId(null);
      setIsCreating(false);
      setLineItems([]);
      setEditableNotes("");
      setEditableDescription("");
      setEditableAddress("");
      setEditableContactName("");
      setEditableEmail("");
      setCustomDueDate("");
      setInitializedJobId(null);
    }
  }, [isOpen]);

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = lineItems.reduce(
      (sum, item) => sum + (item.total || 0),
      0,
    );
    const gst = subtotal * 0.15;
    const total = subtotal + gst;
    return { subtotal, gst, total };
  };

  // Update line item
  const updateLineItem = (
    id: string,
    field: keyof InvoiceLineItem,
    value: any,
  ) => {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // Recalculate total if quantity or unitPrice changed
          if (field === "quantity" || field === "unitPrice") {
            updated.total = updated.quantity * updated.unitPrice;
          }
          return updated;
        }
        return item;
      }),
    );
  };

  // Add new line item
  const addLineItem = (category?: string) => {
    setLineItems([
      ...lineItems,
      {
        id: Math.random().toString(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
        category: category || "other",
      },
    ]);
  };

  // Remove line item
  const removeLineItem = (id: string) => {
    const remaining = lineItems.filter((item) => item.id !== id);
    if (remaining.length === 0) {
      setLineItems([{ id: Math.random().toString(), description: "", quantity: 1, unitPrice: 0, total: 0, category: "other" }]);
    } else {
      setLineItems(remaining);
    }
  };

  // Import line items from quote or proposal
  const importFromQuoteOrProposal = () => {
    const proposals = proposalsResponse?.data || [];
    const quotes = quotesResponse?.data || [];

    console.log("🔍 Import Debug - Proposals:", proposals);
    console.log("🔍 Import Debug - Quotes:", quotes);

    // Find accepted proposal or most recent sent proposal
    const acceptedProposal = proposals.find(
      (p: any) => p.status === "accepted",
    );
    const sentProposal = proposals.find((p: any) => p.status === "sent");
    const proposal = acceptedProposal || sentProposal || proposals[0];

    console.log("🔍 Import Debug - Selected Proposal:", proposal);

    // Find accepted or sent quote
    const acceptedQuote = quotes.find((q: any) => q.status === "accepted");
    const sentQuote = quotes.find((q: any) => q.status === "sent");
    const quote = acceptedQuote || sentQuote || quotes[0];

    console.log("🔍 Import Debug - Selected Quote:", quote);

    // Extract line items from proposal or quote
    let extractedItems: InvoiceLineItem[] = [];

    // Check if proposal has direct line items array
    if (proposal?.lineItems && Array.isArray(proposal.lineItems)) {
      console.log(
        "🔍 Import Debug - Found proposal.lineItems:",
        proposal.lineItems,
      );
      proposal.lineItems.forEach((item: any) => {
        extractedItems.push({
          id: Math.random().toString(),
          description: item.description || "",
          quantity: item.quantity || 1,
          unitPrice: parseFloat(item.unitPrice || 0),
          total: parseFloat(item.totalPrice || item.total || 0),
        });
      });
    }
    // Check if proposal has sections with line items
    else if (proposal?.sections && Array.isArray(proposal.sections)) {
      console.log(
        "🔍 Import Debug - Found proposal.sections:",
        proposal.sections,
      );
      proposal.sections.forEach((section: any) => {
        if (section.lineItems && Array.isArray(section.lineItems)) {
          section.lineItems.forEach((item: any) => {
            extractedItems.push({
              id: Math.random().toString(),
              description: item.description || "",
              quantity: item.quantity || 1,
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.totalPrice || item.total || 0),
            });
          });
        }
      });
    }

    // If proposal had no line items, fall back to quote
    if (
      extractedItems.length === 0 &&
      quote?.lineItems &&
      Array.isArray(quote.lineItems)
    ) {
      console.log("🔍 Import Debug - Using quote.lineItems:", quote.lineItems);
      quote.lineItems.forEach((item: any) => {
        extractedItems.push({
          id: Math.random().toString(),
          description: item.description || "",
          quantity: item.quantity || 1,
          unitPrice: parseFloat(item.rate || item.unitPrice || 0),
          total: parseFloat(item.total || item.amount || 0),
        });
      });
    }

    // If still no items, fall back to job's own line items (set via the Quote tab)
    if (extractedItems.length === 0 && job.lineItems && Array.isArray(job.lineItems) && job.lineItems.length > 0) {
      console.log("🔍 Import Debug - Falling back to job.lineItems:", job.lineItems);
      extractedItems = (job.lineItems as any[]).map((item: any) => ({
        id: item.id || Math.random().toString(),
        description: item.description || "",
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || item.rate || 0,
        total: item.total || item.amount || (item.quantity * (item.unitPrice || item.rate || 0)) || 0,
        category: item.category,
        serviceId: item.serviceId,
        materialId: item.materialId,
        unitCost: item.unitCost,
      }));
    }

    console.log("🔍 Import Debug - Extracted Items:", extractedItems);

    if (extractedItems.length > 0) {
      setLineItems(extractedItems);
    } else {
      toast({
        title: "No Items Found",
        description:
          "No line items found in the quote or proposal for this job.",
        variant: "destructive",
      });
    }
  };

  // Create invoice (shared logic)
  const createInvoice = async () => {
    // Immediate lock check (doesn't rely on state updates)
    if (isCreatingRef.current) {
      console.log(
        "🔒 Invoice creation already in progress (ref lock), skipping...",
      );
      return null;
    }

    // Prevent multiple simultaneous creations
    if (isCreating) {
      console.log(
        "🔒 Invoice creation already in progress (state lock), skipping...",
      );
      return null;
    }

    // Set immediate lock
    isCreatingRef.current = true;

    // Validate
    if (!editableAddress.trim()) {
      isCreatingRef.current = false;
      toast({
        title: "Address Required",
        description: "Please enter a service address for the invoice.",
        variant: "destructive",
      });
      return null;
    }

    const filledLineItems = lineItems.filter((item) => item.description.trim());

    setIsCreating(true);

    try {
      const formattedLineItems = filledLineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.unitPrice,
        amount: item.total,
        category: item.category || "other",
        materialId: item.materialId,
        serviceId: item.serviceId,
        unitCost: item.unitCost,
      }));

      const res = await apiRequest(
        "POST",
        `/api/jobs/${job.id}/convert-to-invoice`,
        {
          invoiceType: "full",
          customData: {
            address: editableAddress,
            contactName: editableContactName || undefined,
            dueDate: customDueDate || new Date(Date.now() + invoicePaymentDays * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            notes: editableNotes,
            description: editableDescription,
            lineItems: formattedLineItems,
          },
        },
      );

      const response = await res.json();

      // Handle 409 Conflict - invoice already exists
      if (res.status === 409 && response.invoiceId) {
        console.log(
          "📄 Invoice already exists, using existing ID:",
          response.invoiceId,
        );

        const existingInvoice = {
          id: response.invoiceId,
          invoiceNumber: response.invoiceNumber || "Unknown",
        };

        setCreatedInvoice(existingInvoice);
        setExistingInvoiceId(response.invoiceId);

        toast({
          title: "Invoice Already Exists",
          description: `Using existing invoice ${response.invoiceNumber || "for this job"}.`,
        });

        return existingInvoice;
      }

      if (response.success) {
        setCreatedInvoice(response.data);

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        queryClient.invalidateQueries({
          queryKey: [`/api/jobs/${job.id}/invoices`],
        });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
        queryClient.invalidateQueries({
          queryKey: ["/api/jobs", job.id, "diary-timeline"],
        });

        return response.data;
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to create invoice.",
          variant: "destructive",
        });
        return null;
      }
    } catch (error) {
      console.error("❌ Error creating invoice:", error);
      console.error("❌ Error details:", JSON.stringify(error, null, 2));
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  };

  // Update existing invoice
  const updateInvoice = async () => {
    if (!existingInvoiceId) {
      console.error("❌ No existing invoice ID to update");
      return null;
    }

    // Validate
    if (!editableAddress.trim()) {
      toast({
        title: "Address Required",
        description: "Please enter a service address for the invoice.",
        variant: "destructive",
      });
      return null;
    }

    const filledItems = lineItems.filter((item) => item.description.trim());

    setIsCreating(true);

    try {
      console.log("🔄 Updating invoice:", existingInvoiceId);

      // Format line items for database (using rate/amount instead of unitPrice/total)
      const formattedLineItems = filledItems.map((item) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        rate: item.unitPrice,
        amount: item.total,
      }));

      // Calculate new amount from line items
      const subtotal = filledItems.reduce((sum, item) => sum + item.total, 0);

      const updateData = {
        address: editableAddress,
        contactName: editableContactName || undefined,
        items: formattedLineItems,
        amount: subtotal.toString(),
        description: editableDescription,
        notes: editableNotes,
        ...(customDueDate ? { dueDate: customDueDate } : {}),
      };

      console.log("📤 Sending update with data:", updateData);

      const res = await apiRequest(
        "PATCH",
        `/api/invoices/${existingInvoiceId}`,
        updateData,
      );
      const response = await res.json();

      if (response.success) {
        console.log("✅ Invoice updated successfully");

        // Update createdInvoice state with the fresh data from server
        if (response.data) {
          setCreatedInvoice(response.data);
        }

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        queryClient.invalidateQueries({
          queryKey: [`/api/jobs/${job.id}/invoices`],
        });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });

        return response.data;
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to update invoice.",
          variant: "destructive",
        });
        return null;
      }
    } catch (error) {
      console.error("❌ Error updating invoice:", error);
      toast({
        title: "Error",
        description: "Failed to update invoice. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  // Save invoice only
  const handleSaveInvoice = async (e?: React.MouseEvent) => {
    console.log("🎯 SAVE INVOICE CLICKED");
    e?.preventDefault();
    e?.stopPropagation();

    // Immediate lock check
    if (isCreatingRef.current) {
      console.log("🔒 Save blocked: invoice creation in progress");
      return;
    }

    // Prevent execution if already creating
    if (isCreating) return;

    // If invoice already exists, update it instead of creating new one
    if (existingInvoiceId) {
      console.log(
        "📝 Existing invoice detected, updating instead of creating new",
      );
      const updated = await updateInvoice();
      if (updated) {
        handleClose();
      }
      return;
    }

    // Otherwise create new invoice
    const invoice = await createInvoice();
    if (invoice) {
      handleClose();
    }
  };

  // Create and send invoice
  const handleSendInvoice = async (e?: React.MouseEvent) => {
    console.log("🎯 SEND INVOICE CLICKED");
    e?.preventDefault();
    e?.stopPropagation();

    // Immediate lock check
    if (isCreatingRef.current) {
      console.log("🔒 Send blocked: invoice creation in progress");
      return;
    }

    // Prevent execution if already creating
    if (isCreating) return;

    // If invoice already exists, update it first then open email composer
    if (existingInvoiceId) {
      console.log("📝 Existing invoice detected, updating before sending");
      const updated = await updateInvoice();
      if (updated) {
        console.log("📧 Invoice updated successfully, opening email composer");
        setShowEmailComposer(true);
      } else {
        console.log("❌ Failed to update invoice, not opening composer");
      }
      return;
    }

    // Otherwise create new invoice
    const invoice = await createInvoice();
    if (invoice) {
      console.log("📧 Invoice created successfully, opening email composer");
      setShowEmailComposer(true);
    } else {
      console.log("❌ Failed to create invoice, not opening composer");
    }
  };

  // Create and send invoice via SMS
  const handleSmsInvoice = async (e?: React.MouseEvent) => {
    console.log("🎯 SMS INVOICE CLICKED");
    e?.preventDefault();
    e?.stopPropagation();

    // Immediate lock check
    if (isCreatingRef.current) {
      console.log("🔒 SMS blocked: invoice creation in progress");
      return;
    }

    // Prevent execution if already creating
    if (isCreating) return;

    // If invoice already exists, update it first then open SMS composer
    if (existingInvoiceId) {
      console.log("📝 Existing invoice detected, updating before sending SMS");
      const updated = await updateInvoice();
      if (updated) {
        setShowSmsComposer(true);
      }
      return;
    }

    // Otherwise create new invoice
    const invoice = await createInvoice();
    if (invoice) {
      setShowSmsComposer(true);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!existingInvoiceId || !createdInvoice) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete Invoice #${createdInvoice.invoiceNumber}? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      const response = await apiRequest(`/api/invoices/${existingInvoiceId}`, {
        method: "DELETE",
      });

      if (response.success) {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        queryClient.invalidateQueries({
          queryKey: [`/api/jobs/${job.id}/invoices`],
        });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });

        handleClose();
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to delete invoice.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast({
        title: "Error",
        description: "Failed to delete invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setCreatedInvoice(null);
    setIsCreating(false);
    isCreatingRef.current = false;
    onClose();
  };

  const { subtotal, gst, total } = calculateTotals();
  const isLoading = loadingProposals || loadingQuotes;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent
          className="max-w-[min(calc(100vw-1rem),42rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden w-full p-4 sm:p-6"
          onEscapeKeyDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {existingInvoiceId && createdInvoice ? (
                  <>
                    <span>Edit Invoice</span>
                    <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-md text-sm font-semibold border border-amber-300">
                      #{createdInvoice.invoiceNumber}
                    </span>
                  </>
                ) : (
                  <span>Create New Invoice</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                data-testid="button-close-invoice"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">
                Loading invoice data...
              </span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Existing Invoice Warning Banner */}
              {existingInvoiceId && createdInvoice && (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <FileText className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-semibold text-amber-800">
                        Editing Existing Invoice
                      </h3>
                      <div className="mt-2 text-sm text-amber-700">
                        <p>
                          You are editing invoice{" "}
                          <strong>#{createdInvoice.invoiceNumber}</strong>. Any
                          changes you make will update this existing invoice.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* New Invoice Info Banner */}
              {!existingInvoiceId && (
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <Plus className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-semibold text-blue-800">
                        Creating New Invoice
                      </h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>
                          A new invoice will be created with invoice number{" "}
                          <strong>#{job.jobNumber || "auto-generated"}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Editable Fields Section */}
              <div className="space-y-4 bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Details (Editable)
                </h3>

                {/* Billing Address */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    Billing Address
                  </Label>
                  <Input
                    value={editableAddress}
                    onChange={(e) => setEditableAddress(e.target.value)}
                    placeholder="Enter billing address"
                    className="bg-white"
                    data-testid="input-invoice-address"
                  />
                </div>

                {/* Contact Name */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-blue-600" />
                    Billing Name
                  </Label>
                  <Input
                    value={editableContactName}
                    onChange={(e) => setEditableContactName(e.target.value)}
                    placeholder="e.g., Gisborne District Council"
                    className="bg-white"
                    data-testid="input-invoice-contact-name"
                  />
                  <p className="text-xs text-gray-500">
                    Pre-filled from the Billing Name Override on the Billing tab. Edit here for this invoice only.
                  </p>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-blue-600" />
                    Billing Email
                  </Label>
                  <Input
                    type="email"
                    value={editableEmail}
                    onChange={(e) => setEditableEmail(e.target.value)}
                    placeholder="Enter billing email address"
                    className="bg-white"
                    data-testid="input-invoice-email"
                  />
                  <p className="text-xs text-gray-500">
                    Pre-filled from the Billing Email override on the Billing tab. Edit here for this invoice only.
                  </p>
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    Due Date
                  </Label>
                  <Input
                    type="date"
                    value={customDueDate}
                    onChange={(e) => setCustomDueDate(e.target.value)}
                    className="bg-white"
                    data-testid="input-invoice-due-date"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Invoice Description
                  </Label>
                  <Textarea
                    value={editableDescription}
                    onChange={(e) => setEditableDescription(e.target.value)}
                    placeholder="Enter a general description for this invoice (optional)"
                    className="bg-white min-h-[80px]"
                    data-testid="input-invoice-description"
                  />
                </div>

                {/* Line Items */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <Label className="text-sm font-medium">Line Items</Label>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={importFromQuoteOrProposal}
                        disabled={loadingProposals || loadingQuotes}
                        data-testid="button-import-from-quote"
                      >
                        <FileDown className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">
                          Import from Quote/Proposal
                        </span>
                        <span className="sm:hidden">Import</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addLineItem()}
                        data-testid="button-add-line-item"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Item
                      </Button>
                    </div>
                  </div>

                  {/* Category Legend */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Labour (Fixed)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Labour (Charge-out)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      Materials
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Equipment
                    </span>
                  </div>

                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="bg-muted/30 rounded-lg border p-3 space-y-3"
                      >
                        {/* Header row with category badge and delete button */}
                        <div className="flex items-center justify-between gap-2">
                          <Select
                            value={item.category || "other"}
                            onValueChange={(value) =>
                              updateLineItem(item.id, "category", value)
                            }
                          >
                            <SelectTrigger
                              className={`w-auto h-7 text-xs px-2 border-0 ${
                                item.category === "labor_fixed"
                                  ? "bg-blue-100 text-blue-700"
                                  : item.category === "labor_chargeout"
                                    ? "bg-green-100 text-green-700"
                                    : item.category === "materials"
                                      ? "bg-orange-100 text-orange-700"
                                      : item.category === "equipment"
                                        ? "bg-purple-100 text-purple-700"
                                        : item.category === "disposal"
                                          ? "bg-red-100 text-red-700"
                                          : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="labor_fixed">
                                Labour (Fixed)
                              </SelectItem>
                              <SelectItem value="labor_chargeout">
                                Labour (Charge-out)
                              </SelectItem>
                              <SelectItem value="materials">
                                Materials
                              </SelectItem>
                              <SelectItem value="equipment">
                                Equipment
                              </SelectItem>
                              <SelectItem value="disposal">Disposal</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(item.id)}
                            className="h-7 w-7 p-0"
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                          </Button>
                        </div>

                        {/* Description field with materials dropdown */}
                        <div className="relative">
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            Description (type to search materials)
                          </Label>
                          <div className="relative">
                            <Input
                              value={item.description}
                              onChange={(e) => {
                                updateLineItem(
                                  item.id,
                                  "description",
                                  e.target.value,
                                );
                                setMaterialSearchQuery(e.target.value);
                                setMaterialsDropdownItemId(item.id);
                              }}
                              onFocus={() => {
                                setMaterialsDropdownItemId(item.id);
                                setMaterialSearchQuery(item.description);
                              }}
                              onBlur={(e) => {
                                setTimeout(() => {
                                  if (
                                    !e.relatedTarget?.closest(
                                      "[data-materials-dropdown]",
                                    )
                                  ) {
                                    setMaterialsDropdownItemId(null);
                                    setMaterialSearchQuery("");
                                  }
                                }, 150);
                              }}
                              placeholder="Type to search materials or enter custom description..."
                              className="text-sm pr-8"
                              data-testid={`input-item-description-${index}`}
                            />
                            <Package className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          </div>

                          {/* Materials dropdown */}
                          {materialsDropdownItemId === item.id && (
                            <div
                              data-materials-dropdown
                              className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto"
                            >
                              {materials.length === 0 ? (
                                <div className="p-3 text-sm text-muted-foreground text-center">
                                  No materials found. Add items in Settings &gt;
                                  Materials.
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
                                          .includes(materialSearchQuery),
                                    )
                                    .slice(0, 10)
                                    .map((material: any) => (
                                      <div
                                        key={material.id}
                                        className="flex items-center justify-between p-2 hover:bg-accent cursor-pointer border-b last:border-b-0"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          const price =
                                            typeof material.price === "string"
                                              ? parseFloat(material.price)
                                              : material.price || 0;
                                          const cost =
                                            typeof material.cost === "string"
                                              ? parseFloat(material.cost)
                                              : material.cost || 0;
                                          // Determine if this is a material or a service based on the category/type
                                          const isService =
                                            material.category === "Labour" ||
                                            material.basePrice !== undefined;
                                          // Update this line item with material data
                                          setLineItems((prev) =>
                                            prev.map((li) =>
                                              li.id === item.id
                                                ? {
                                                    ...li,
                                                    description:
                                                      material.name ||
                                                      `Item #${material.itemNumber}`,
                                                    unitPrice: price,
                                                    quantity: li.quantity || 1,
                                                    total:
                                                      (li.quantity || 1) *
                                                      price,
                                                    category:
                                                      material.category ===
                                                      "Labour"
                                                        ? "labor_chargeout"
                                                        : material.category ===
                                                            "Equipment"
                                                          ? "equipment"
                                                          : material.category ===
                                                              "Materials"
                                                            ? "materials"
                                                            : li.category,
                                                    materialId: !isService
                                                      ? material.id
                                                      : undefined,
                                                    serviceId: isService
                                                      ? material.id
                                                      : undefined,
                                                    unitCost: cost,
                                                  }
                                                : li,
                                            ),
                                          );
                                          setMaterialsDropdownItemId(null);
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
                                          {typeof material.price === "string"
                                            ? parseFloat(
                                                material.price,
                                              ).toFixed(2)
                                            : (material.price || 0).toFixed(2)}
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
                                      No matching materials. You can still type
                                      a custom description.
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quantity, Unit Price, and Total in a row */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              {item.category?.startsWith("labor")
                                ? "Hours"
                                : "Qty"}
                            </Label>
                            <Input
                              type="number"
                              value={item.quantity || ""}
                              onChange={(e) =>
                                updateLineItem(
                                  item.id,
                                  "quantity",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              placeholder="0"
                              className="text-sm"
                              data-testid={`input-item-quantity-${index}`}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              {item.category?.startsWith("labor")
                                ? "Rate/hr"
                                : "Unit Price"}
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitPrice || ""}
                              onChange={(e) =>
                                updateLineItem(
                                  item.id,
                                  "unitPrice",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              placeholder="0.00"
                              className="text-sm"
                              data-testid={`input-item-price-${index}`}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">
                              Total
                            </Label>
                            <div className="h-9 flex items-center px-3 bg-muted rounded-md text-sm font-semibold">
                              ${item.total.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="bg-white p-4 rounded border space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Subtotal (excl GST):
                      </span>
                      <span className="font-medium">
                        ${subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">GST (15%):</span>
                      <span className="font-medium">${gst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total:</span>
                      <span className="text-blue-600">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                {/* Delete button - only show when editing existing invoice */}
                {existingInvoiceId && createdInvoice && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteInvoice}
                    data-testid="button-delete-invoice"
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Invoice
                  </Button>
                )}

                <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    data-testid="button-cancel"
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveInvoice}
                    disabled={isCreating}
                    variant="outline"
                    data-testid="button-save-invoice"
                    className="w-full sm:w-auto"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Invoice
                      </>
                    )}
                  </Button>
                  {createdInvoice?.id && (
                    <Button
                      type="button"
                      onClick={async () => {
                        setIsDownloadingPdf(true);
                        try {
                          const response = await fetch(
                            `/api/invoices/${createdInvoice.id}/pdf`,
                          );
                          if (!response.ok)
                            throw new Error("Failed to fetch PDF");
                          const blob = await response.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `Invoice-${createdInvoice.invoiceNumber || createdInvoice.id}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          toast({
                            title: "Download failed",
                            description:
                              "Could not download the PDF. Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsDownloadingPdf(false);
                        }
                      }}
                      disabled={isDownloadingPdf}
                      variant="outline"
                      data-testid="button-download-pdf"
                      className="w-full sm:w-auto"
                    >
                      {isDownloadingPdf ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4 mr-2" />
                      )}
                      {isDownloadingPdf ? "Preparing..." : "Download PDF"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleSmsInvoice}
                    disabled={isCreating}
                    variant="outline"
                    data-testid="button-sms-invoice-builder"
                    className="w-full sm:w-auto"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        SMS Invoice
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendInvoice}
                    disabled={isCreating}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                    data-testid="button-send-invoice"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Invoice
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Preview Section */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Preview</h3>
                <div className="border rounded-lg p-0 sm:p-4 bg-white">
                  <InvoiceTemplate
                    invoice={{
                      id: job.id,
                      invoiceNumber: createdInvoice?.invoiceNumber || `Preview`,
                      customerId: customer.id,
                      jobId: job.id,
                      amount: subtotal.toString(),
                      status: "draft" as const,
                      dueDate: new Date(
                        Date.now() + invoicePaymentDays * 24 * 60 * 60 * 1000,
                      ).toISOString(),
                      issueDate: new Date().toISOString(),
                      items: lineItems.map((item) => ({
                        description: item.description,
                        quantity: item.quantity,
                        rate: item.unitPrice,
                        amount: item.total,
                        category: item.category || "other",
                      })),
                      address: editableAddress,
                      customer,
                      job,
                    }}
                    customer={customer}
                    jobAddress={editableAddress}
                    jobNumber={job.jobNumber}
                    billingName={job.billingNameOverride || undefined}
                    contactName={editableContactName}
                    template={invoiceTemplate}
                    lineItems={lineItems}
                    description={editableDescription}
                    sectionConfig={Array.isArray(invoiceTemplate.sectionConfig) ? invoiceTemplate.sectionConfig as InvoiceSectionConfig[] : undefined}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Composer Modal */}
      {createdInvoice && (
        <EmailComposerModal
          isOpen={showEmailComposer}
          onClose={() => {
            setShowEmailComposer(false);
            handleClose();
          }}
          job={job}
          customer={effectiveCustomer}
          customEmail={editableEmail}
          invoiceData={createdInvoice}
          templateType="invoice"
          defaultCc={effectiveCustomer?.invoiceCcEmail || undefined}
        />
      )}

      {/* SMS Composer Modal */}
      {createdInvoice && (
        <SMSComposerModal
          isOpen={showSmsComposer}
          onClose={() => {
            setShowSmsComposer(false);
            handleClose();
          }}
          job={job}
          customer={customer}
          invoiceData={{
            id: createdInvoice.id,
            invoiceNumber: createdInvoice.invoiceNumber,
            amount: createdInvoice.amount,
            dueDate: createdInvoice.dueDate,
          }}
          templateType="invoice"
        />
      )}
    </>
  );
}
