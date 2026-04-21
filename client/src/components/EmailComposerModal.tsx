import React, { useState, useEffect, useRef, useMemo } from "react";
import DOMPurify from "dompurify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Send,
  X,
  Paperclip,
  FileText,
  Bold,
  Italic,
  Underline,
  Link,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image,
  Check,
  Mail,
  Eye,
  Mic,
  MicOff,
  AlertCircle,
  Loader2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { CalendarAvailabilityModal } from "./CalendarAvailabilityModal";
import { format as formatDate } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { InvoiceTemplate } from "./InvoiceTemplate";
import { QuoteTemplate } from "./QuoteTemplate";
import { ProposalTemplate } from "./ProposalTemplate";

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  job?: any;
  customer?: any;
  invoiceData?: any;
  quoteData?: any;
  proposalData?: any;
  templateType?: "invoice" | "quote" | "proposal";
  customEmail?: string;
  defaultCc?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  attachInvoicePdf?: boolean;
}

export function EmailComposerModal({
  isOpen,
  onClose,
  job,
  customer,
  invoiceData,
  quoteData,
  proposalData,
  templateType,
  customEmail,
  defaultCc,
}: EmailComposerModalProps) {
  // Safe amount formatter - handles strings, numbers, null, undefined
  const formatAmount = (value: any): string => {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(2) : "0.00";
  };

  const [emailData, setEmailData] = useState({
    to: "",
    cc: "",
    subject: "",
    body: "",
    selectedTemplate: "",
  });
  interface TypedAttachment {
    name: string;
    type: "invoice" | "quote" | "proposal" | "file" | "photo";
    id?: string;
    url?: string;
  }

  const [attachments, setAttachments] = useState<TypedAttachment[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState<{
    type: "invoice" | "quote" | "proposal" | null;
    data: any;
  }>({ type: null, data: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const recognitionRef = useRef<any>(null);
  const emailBodyRef = useRef<HTMLDivElement>(null);

  // Insert text at the caret inside the email body (same pattern as voice input).
  const insertTextIntoBody = (text: string) => {
    if (!emailBodyRef.current) return;
    emailBodyRef.current.focus();

    // Clear placeholder if present
    if (emailBodyRef.current.innerHTML.includes("Compose your email...")) {
      emailBodyRef.current.innerHTML = "";
    }

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && emailBodyRef.current.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // No caret inside the editor — append at the end.
      emailBodyRef.current.appendChild(document.createTextNode(text));
    }
    setEmailData((prev) => ({ ...prev, body: emailBodyRef.current?.innerHTML || "" }));
  };

  const handleSlotPick = (slotStart: Date) => {
    const nz = toZonedTime(slotStart, "Pacific/Auckland");
    // e.g. "Tuesday 25 November at 2 PM"
    const phrase = formatDate(nz, "EEEE d MMMM 'at' h a");
    insertTextIntoBody(phrase);
  };

  // Fetch email templates from database
  const { data: dbTemplates = [] } = useQuery({
    queryKey: ["/api/email-templates"],
    select: (response: any) => response.data || [],
    enabled: isOpen,
  });

  // Combine database templates with default Custom Message template
  const EMAIL_TEMPLATES: EmailTemplate[] = [
    {
      id: "custom_message",
      name: "Custom Message",
      subject: "",
      body: `<p>Hi {firstName},</p><p><br></p><p><br></p><p>Best regards,<br>Jules</p>`,
    },
    ...dbTemplates.map((t: any) => ({
      id: t.id,
      name: t.name,
      subject: t.subject || "",
      body: t.textContent || t.htmlContent || "",
      attachInvoicePdf: t.attachInvoicePdf ?? false,
    })),
  ];

  // Fetch job invoices so we can auto-attach the PDF even when invoiceData prop isn't set
  const { data: jobInvoicesResponse, isLoading: isLoadingJobInvoice } =
    useQuery<{ success: boolean; data: any[] }>({
      queryKey: ["/api/invoices", job?.id, "modal"],
      queryFn: async () => {
        if (!job?.id) return { success: true, data: [] };
        const res = await fetch(`/api/invoices?jobId=${job.id}`, {
          credentials: "include",
        });
        return res.json();
      },
      enabled: !!job?.id && isOpen,
    });
  const jobInvoice = jobInvoicesResponse?.data?.[0] ?? null;

  // Fetch job photos for Smart Attachments
  const { data: jobPhotos } = useQuery<{
    success: boolean;
    jobId: string;
    beforePhotos: string[];
    afterPhotos: string[];
  }>({
    queryKey: ["/api/jobs", job?.id, "photos"],
    enabled: !!job?.id && isOpen,
  });

  // Fetch diary entries to get diary photos
  const { data: diaryEntries } = useQuery<{
    success: boolean;
    data: Array<{
      id: string;
      entryType: string;
      photos: string[] | null;
      photoUrl: string | null;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/jobs", job?.id, "diary"],
    enabled: !!job?.id && isOpen,
  });

  // Extract all unique photo URLs from diary entries
  const diaryPhotos = useMemo(() => {
    if (!diaryEntries?.data) return [];
    const photos: string[] = [];
    diaryEntries.data.forEach((entry) => {
      if (entry.entryType === "photo") {
        if (entry.photos && Array.isArray(entry.photos)) {
          photos.push(...entry.photos);
        }
        if (entry.photoUrl) {
          photos.push(entry.photoUrl);
        }
      }
    });
    // Return unique photos only
    return [...new Set(photos)];
  }, [diaryEntries]);

  // Get appropriate template based on context
  const getDefaultTemplate = () => {
    // Use explicit templateType to determine template (user intent)
    if (templateType === "invoice") {
      // Prioritize exact match "Invoice", then any template with "invoice" in the name
      return (
        EMAIL_TEMPLATES.find((t) => t.name === "Invoice") ||
        EMAIL_TEMPLATES.find((t) => t.name.toLowerCase().includes("invoice")) ||
        EMAIL_TEMPLATES[0]
      );
    } else if (templateType === "quote") {
      return (
        EMAIL_TEMPLATES.find((t) => t.name === "Quote") ||
        EMAIL_TEMPLATES.find((t) => t.name.toLowerCase().includes("quote")) ||
        EMAIL_TEMPLATES[0]
      );
    } else if (templateType === "proposal") {
      return (
        EMAIL_TEMPLATES.find((t) => t.name === "Proposal") ||
        EMAIL_TEMPLATES.find((t) =>
          t.name.toLowerCase().includes("proposal"),
        ) ||
        EMAIL_TEMPLATES[0]
      );
    } else if (templateType === "general") {
      // For general emails, look for a "General" template or fall back to custom message
      return (
        EMAIL_TEMPLATES.find((t) => t.name === "General") ||
        EMAIL_TEMPLATES.find((t) => t.name.toLowerCase().includes("general")) ||
        EMAIL_TEMPLATES.find((t) => t.id === "custom_message") ||
        EMAIL_TEMPLATES[0]
      );
    }

    // When templateType is not specified, default to custom message for general emails
    return (
      EMAIL_TEMPLATES.find((t) => t.id === "custom_message") ||
      EMAIL_TEMPLATES[0]
    );
  };

  // Auto-attach documents whenever they become available (separate from initialization)
  useEffect(() => {
    if (isOpen && (invoiceData || quoteData || proposalData)) {
      const attachmentsList: TypedAttachment[] = [];

      if (invoiceData) {
        attachmentsList.push({
          name: `Treemarkables LTD Invoice ${invoiceData.invoiceNumber}`,
          type: "invoice",
          id: invoiceData.id,
          url: invoiceData.id
            ? `/api/invoices/${invoiceData.id}/pdf`
            : undefined,
        });
      }
      if (quoteData) {
        attachmentsList.push({
          name: `Treemarkables LTD Quote ${quoteData.quoteNumber}`,
          type: "quote",
          id: quoteData.id,
          url: undefined, // PDF generation not yet implemented
        });
      }
      if (proposalData) {
        // URL returns application/pdf (binary). Smart Attachments intentionally
        // attach the PDF — use ?format=html on the endpoint if HTML is ever needed.
        attachmentsList.push({
          name: `Treemarkables LTD Proposal ${proposalData.proposalNumber || "PROP-" + job.jobNumber}`,
          type: "proposal",
          id: proposalData.id,
          url: proposalData.id
            ? `/api/proposals/${proposalData.id}/pdf`
            : undefined,
        });
      }

      setAttachments(attachmentsList);
    }
  }, [isOpen, invoiceData, quoteData, proposalData, job?.jobNumber]);

  // Pre-populate email data when modal opens (only on first open, not on data updates)
  useEffect(() => {
    if (isOpen && job && customer && !hasInitialized) {
      const isInvoiceContext = !!invoiceData;
      const billingEmail =
        customEmail ||
        (isInvoiceContext
          ? job.billingContactEmail ||
            customer.billingContactEmail ||
            job.jobContactEmail ||
            customer.email ||
            customer.jobContactEmail
          : job.jobContactEmail ||
            customer.billingContactEmail ||
            customer.email ||
            customer.jobContactEmail);

      // Extract first name — prefer job contact fields, fall back to customer record
      let firstName = "there";
      if (job?.jobContactFirstName) {
        firstName = job.jobContactFirstName;
      } else if (customer.firstName) {
        firstName = customer.firstName;
      } else if (customer.name) {
        // If name is stored as "LastName, FirstName", extract first name
        if (customer.name.includes(",")) {
          const parts = customer.name.split(",").map((p: string) => p.trim());
          firstName =
            parts.length === 2 ? parts[1] : customer.name.split(" ")[0];
        } else {
          // Extract first word as first name
          firstName = customer.name.split(" ")[0];
        }
      }

      // Also keep full name for other templates that might need it
      // Prefer job contact fields, fall back to customer record
      let customerName = "Valued Customer";
      if (job?.jobContactFirstName && job?.jobContactLastName) {
        customerName = `${job.jobContactFirstName} ${job.jobContactLastName}`.trim();
      } else if (job?.jobContactFirstName) {
        customerName = job.jobContactFirstName;
      } else if (customer.firstName && customer.lastName) {
        customerName = `${customer.firstName} ${customer.lastName}`.trim();
      } else if (customer.firstName) {
        customerName = customer.firstName;
      } else if (customer.name) {
        customerName = customer.name;
      }

      // Apply appropriate template based on context
      const template = getDefaultTemplate();
      const documentData = invoiceData || quoteData || proposalData;

      // Calculate invoice total with GST (invoice.amount is ex-GST)
      let invoiceTotalWithGST = 0;
      if (invoiceData?.amount) {
        const subtotal =
          typeof invoiceData.amount === "string"
            ? parseFloat(invoiceData.amount)
            : invoiceData.amount;
        const gst = subtotal * 0.15;
        invoiceTotalWithGST = subtotal + gst;
      }

      // Use current domain for links (works in both dev and production)
      const baseUrl = window.location.origin;

      const populatedSubject = template.subject
        .replace(/{jobNumber}/g, job.jobNumber || "")
        .replace(/{address}/g, job.address || customer.address || "")
        .replace(/{customerAddress}/g, job.address || "")
        .replace(/{invoiceNumber}/g, invoiceData?.invoiceNumber || "")
        .replace(
          /{invoiceAmount}/g,
          `$${formatAmount(invoiceTotalWithGST || invoiceData?.totalAmount || invoiceData?.amount)}`,
        )
        .replace(
          /\$\{invoiceAmount\}/g,
          `$${formatAmount(invoiceTotalWithGST || invoiceData?.totalAmount || invoiceData?.amount)}`,
        );

      let populatedBody = template.body
        .replace(/{firstName}/g, firstName || "there")
        .replace(/{customerName}/g, customerName || "Valued Customer")
        .replace(/{jobNumber}/g, job.jobNumber || "")
        .replace(
          /{jobDescription}/g,
          job.description || job.title || "tree service",
        )
        .replace(/{address}/g, job.address || customer.address || "")
        .replace(
          /{invoiceLink}/g,
          invoiceData?.id
            ? `${baseUrl}/invoice/${invoiceData.id}`
            : "View invoice in your customer portal",
        )
        .replace(
          /{quoteLink}/g,
          quoteData?.id
            ? `${baseUrl}/quote/${quoteData.id}`
            : "View quote in your customer portal",
        )
        .replace(
          /{proposalLink}/g,
          proposalData?.id
            ? `${baseUrl}/proposal/${proposalData.id}`
            : "View proposal in your customer portal",
        )
        .replace(/{quoteNumber}/g, quoteData?.quoteNumber || "")
        .replace(
          /{quoteExpiry}/g,
          quoteData?.validUntil
            ? new Date(quoteData.validUntil).toLocaleDateString()
            : "",
        )
        .replace(/{quoteAmount}/g, `$${formatAmount(quoteData?.totalAmount)}`)
        .replace(
          /{proposalNumber}/g,
          proposalData?.proposalNumber ||
            (job?.jobNumber ? `PROP-${job.jobNumber}` : ""),
        )
        .replace(/{invoiceNumber}/g, invoiceData?.invoiceNumber || "")
        .replace(
          /{invoiceAmount}/g,
          `$${formatAmount(invoiceTotalWithGST || invoiceData?.totalAmount || invoiceData?.amount)}`,
        )
        .replace(
          /{dueDate}/g,
          invoiceData?.dueDate
            ? new Date(invoiceData.dueDate).toLocaleDateString()
            : "",
        )
        .replace(/{contactName}/g, "Treemarkables Team")
        .replace(/{contactPhone}/g, "0272166882");

      // When there are multiple saved invoice emails (chips UI), start CC empty so
      // the user selects which ones to include. For a single address, pre-populate as before.
      const savedEmailCount = defaultCc
        ? defaultCc.split(",").map((e) => e.trim()).filter(Boolean).length
        : 0;
      setEmailData({
        to: billingEmail || "",
        cc: savedEmailCount > 1 ? "" : (defaultCc || ""),
        subject: populatedSubject,
        body: populatedBody,
        selectedTemplate: template.id,
      });

      // Auto-attach invoice PDF if the pre-selected template has attachInvoicePdf: true
      // Fall back to the job's existing invoice if invoiceData prop wasn't passed in
      const invoiceForAttach = invoiceData || jobInvoice;
      if ((template as any).attachInvoicePdf && invoiceForAttach) {
        setAttachments((prev) => {
          const alreadyAttached = prev.some((a: any) => a.type === "invoice");
          if (alreadyAttached) return prev;
          return [
            ...prev,
            {
              name: `Treemarkables LTD Invoice ${invoiceForAttach.invoiceNumber}`,
              type: "invoice" as const,
              id: invoiceForAttach.id,
              url: invoiceForAttach.id
                ? `/api/invoices/${invoiceForAttach.id}/pdf`
                : undefined,
            },
          ];
        });
      }

      setHasInitialized(true);
    } else if (!isOpen) {
      // Reset initialization flag when modal closes
      setHasInitialized(false);
    }
  }, [
    isOpen,
    job,
    customer,
    invoiceData,
    quoteData,
    proposalData,
    templateType,
    hasInitialized,
    jobInvoice,
    defaultCc,
  ]);

  // When job invoice loads asynchronously (after init ran), auto-attach if the active template needs it
  useEffect(() => {
    if (!jobInvoice || !hasInitialized || invoiceData) return;
    const currentTemplate = EMAIL_TEMPLATES.find(
      (t) => t.id === emailData.selectedTemplate,
    );
    if (!(currentTemplate as any)?.attachInvoicePdf) return;
    setAttachments((prev) => {
      const alreadyAttached = prev.some((a) => a.type === "invoice");
      if (alreadyAttached) return prev;
      return [
        ...prev,
        {
          name: `Treemarkables LTD Invoice ${jobInvoice.invoiceNumber}`,
          type: "invoice" as const,
          id: jobInvoice.id,
          url: `/api/invoices/${jobInvoice.id}/pdf`,
        },
      ];
    });
  }, [jobInvoice, hasInitialized]);

  // Sync emailData.body to contentEditable div (for template updates and initial render)
  useEffect(() => {
    if (emailBodyRef.current) {
      // Set initial content on first render or when template changes
      const currentContent = emailBodyRef.current.innerHTML;
      const newContent =
        emailData.body ||
        '<p style="color: #9ca3af;">Compose your email...</p>';

      // Only update if content has actually changed AND user is not currently typing
      if (
        currentContent !== newContent &&
        document.activeElement !== emailBodyRef.current
      ) {
        // Sanitize HTML to prevent XSS attacks from malicious templates or user data
        emailBodyRef.current.innerHTML = DOMPurify.sanitize(newContent, {
          ALLOWED_TAGS: [
            "p",
            "br",
            "strong",
            "em",
            "u",
            "a",
            "ul",
            "ol",
            "li",
            "span",
            "div",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
          ],
          ALLOWED_ATTR: ["href", "style", "class"],
          ALLOW_DATA_ATTR: false,
        });
      }
    }
  }, [emailData.body]);

  // Handle photo selection for email attachments
  const togglePhotoSelection = (photoUrl: string) => {
    console.log("📷 togglePhotoSelection called with:", photoUrl);
    console.log("📷 Current selectedPhotos before toggle:", selectedPhotos);
    setSelectedPhotos((prev) => {
      const isCurrentlySelected = prev.includes(photoUrl);
      const newSelection = isCurrentlySelected
        ? prev.filter((url) => url !== photoUrl)
        : [...prev, photoUrl];
      console.log(
        "📷 Photo",
        isCurrentlySelected ? "DESELECTED" : "SELECTED",
        "- New selection:",
        newSelection,
      );
      return newSelection;
    });
  };

  const handleDocumentPreview = (
    type: "invoice" | "quote" | "proposal",
    data: any,
  ) => {
    setShowPreview({ type, data });
  };

  // Fetch proposal sections for preview
  const { data: proposalSections } = useQuery({
    queryKey: [`/api/proposals/${showPreview.data?.id}/sections`],
    enabled: showPreview.type === "proposal" && !!showPreview.data?.id,
  });

  // Map sections from API response for ProposalTemplate
  const mappedSections = proposalSections?.success
    ? (proposalSections.data || []).map((section: any) => ({
        id: section.id,
        title: section.title,
        description: section.content || "",
        photos: section.photos || [],
        lineItems: (section.lineItems || []).map((item: any) => ({
          id: item.id,
          description: item.description || "",
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          totalPrice: parseFloat(item.totalPrice) || 0,
          unit: item.unit || "each",
          category: item.category || "service",
          notes: item.notes || "",
          isOptional: item.isOptional || false,
          selected: item.selected !== undefined ? item.selected : true,
          pricingType: item.pricingType || "normal",
          choices: item.choices || [],
          selectedChoiceId: item.selectedChoiceId,
        })),
        sortOrder: section.sortOrder || 0,
      }))
    : [];

  // Handle file attachment
  const handleFileAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit

    // Validate file sizes
    const oversizedFiles = fileArray.filter((file) => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      toast({
        title: "File Too Large",
        description: `Files must be smaller than 10MB. Please compress: ${oversizedFiles.map((f) => f.name).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Add files to state
    setUploadedFiles((prev) => [...prev, ...fileArray]);
    setAttachments((prev) => [
      ...prev,
      ...fileArray.map((file) => ({
        name: file.name,
        type: "file" as const,
        url: URL.createObjectURL(file),
      })),
    ]);

    // Clear the input for future selections
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (fileName: string) => {
    setAttachments((prev) =>
      prev.filter((attachment) => attachment.name !== fileName),
    );
    setUploadedFiles((prev) => prev.filter((file) => file.name !== fileName));
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (emailPayload: any) => {
      console.log("📧 Mutation: Starting email send request");
      try {
        const result = await apiRequest(
          "POST",
          "/api/emails/send",
          emailPayload,
        );
        console.log("📧 Mutation: Email sent successfully", result);
        return result;
      } catch (error: any) {
        console.error("📧 Mutation: Email send failed", error);
        console.error("📧 Mutation: Error details:", {
          message: error.message,
          status: error.status,
          response: error.response,
        });
        throw error;
      }
    },
    onSuccess: () => {
      console.log("📧 Mutation: onSuccess callback triggered");
      // Success notification disabled per user preference

      // Invalidate job diary cache to show the new email entry
      if (job?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/jobs", job.id, "diary"],
        });
      }

      onClose();
    },
    onError: (error: any) => {
      console.error("📧 Mutation: onError callback triggered", error);
      toast({
        title: "Email Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    },
  });

  // Convert URLs to clickable hyperlinks
  const linkifyUrls = (text: string): string => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(
      urlRegex,
      '<a href="$1" style="color: #3b82f6; text-decoration: underline;">$1</a>',
    );
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    // Extract first name — prefer job contact fields, fall back to customer record
    let firstName = "there";
    if (job?.jobContactFirstName) {
      firstName = job.jobContactFirstName;
    } else if (customer?.firstName) {
      firstName = customer.firstName;
    } else if (customer?.name) {
      if (customer.name.includes(",")) {
        const parts = customer.name.split(",").map((p: string) => p.trim());
        firstName = parts.length === 2 ? parts[1] : customer.name.split(" ")[0];
      } else {
        firstName = customer.name.split(" ")[0];
      }
    }

    // Full name — prefer job contact fields, fall back to customer record
    let customerName = "Valued Customer";
    if (job?.jobContactFirstName && job?.jobContactLastName) {
      customerName = `${job.jobContactFirstName} ${job.jobContactLastName}`.trim();
    } else if (job?.jobContactFirstName) {
      customerName = job.jobContactFirstName;
    } else if (customer?.firstName && customer?.lastName) {
      customerName = `${customer.firstName} ${customer.lastName}`.trim();
    } else if (customer?.firstName) {
      customerName = customer.firstName;
    } else if (customer?.name) {
      customerName = customer.name;
    }

    // Use current domain for links (works in both dev and production)
    const baseUrl = window.location.origin;

    const populatedSubject = template.subject
      .replace(/{jobNumber}/g, job?.jobNumber || "")
      .replace(/{address}/g, job?.address || customer?.address || "")
      .replace(/{customerAddress}/g, job?.address || "")
      .replace(/{invoiceNumber}/g, invoiceData?.invoiceNumber || "")
      .replace(
        /{invoiceAmount}/g,
        `$${formatAmount(invoiceData?.totalAmount || invoiceData?.amount)}`,
      )
      .replace(
        /\$\{invoiceAmount\}/g,
        `$${formatAmount(invoiceData?.totalAmount || invoiceData?.amount)}`,
      )
      .replace(/{quoteNumber}/g, quoteData?.quoteNumber || "")
      .replace(/{quoteAmount}/g, `$${formatAmount(quoteData?.totalAmount)}`)
      .replace(/{proposalNumber}/g, proposalData?.proposalNumber || "")
      .replace(
        /{proposalAmount}/g,
        `$${formatAmount(proposalData?.totalAmount)}`,
      );

    let populatedBody = template.body
      .replace(/{firstName}/g, firstName || "there")
      .replace(/{customerName}/g, customerName || "Valued Customer")
      .replace(/{jobNumber}/g, job?.jobNumber || "")
      .replace(
        /{jobDescription}/g,
        job?.description || job?.title || "tree service",
      )
      .replace(/{address}/g, job?.address || customer?.address || "")
      .replace(/{invoiceNumber}/g, invoiceData?.invoiceNumber || "")
      .replace(
        /{invoiceLink}/g,
        invoiceData?.id
          ? `${baseUrl}/invoice/${invoiceData.id}`
          : "View invoice in your customer portal",
      )
      .replace(
        /{quoteLink}/g,
        quoteData?.id
          ? `${baseUrl}/quote/${quoteData.id}`
          : "View quote in your customer portal",
      )
      .replace(
        /{proposalLink}/g,
        proposalData?.id
          ? `${baseUrl}/proposal/${proposalData.id}`
          : "View proposal in your customer portal",
      )
      .replace(/{quoteNumber}/g, quoteData?.quoteNumber || "")
      .replace(
        /{quoteExpiry}/g,
        quoteData?.validUntil
          ? new Date(quoteData.validUntil).toLocaleDateString()
          : "",
      )
      .replace(/{quoteAmount}/g, `$${formatAmount(quoteData?.totalAmount)}`)
      .replace(
        /{proposalNumber}/g,
        proposalData?.proposalNumber ||
          (job?.jobNumber ? `PROP-${job.jobNumber}` : ""),
      )
      .replace(/{contactName}/g, "Treemarkables Team")
      .replace(
        /{contactPhone}/g,
        customer?.jobContactPhone ||
          customer?.billingContactPhone ||
          "027-XXX-XXXX",
      )
      .replace(
        /{invoiceAmount}/g,
        `$${formatAmount(invoiceData?.totalAmount || invoiceData?.amount)}`,
      )
      .replace(
        /{dueDate}/g,
        invoiceData?.dueDate
          ? new Date(invoiceData.dueDate).toLocaleDateString()
          : "",
      );

    // Convert URLs to clickable hyperlinks
    populatedBody = linkifyUrls(populatedBody);

    setEmailData((prev) => ({
      ...prev,
      subject: populatedSubject,
      body: populatedBody,
      selectedTemplate: templateId,
    }));

    // Auto-attach invoice PDF if the template requests it
    // Fall back to the job's existing invoice if invoiceData prop wasn't passed in
    const invoiceForAttach = invoiceData || jobInvoice;
    if (template.attachInvoicePdf && invoiceForAttach) {
      setAttachments((prev) => {
        const alreadyAttached = prev.some((a) => a.type === "invoice");
        if (alreadyAttached) return prev;
        return [
          ...prev,
          {
            name: `Treemarkables LTD Invoice ${invoiceForAttach.invoiceNumber}`,
            type: "invoice" as const,
            id: invoiceForAttach.id,
            url: invoiceForAttach.id
              ? `/api/invoices/${invoiceForAttach.id}/pdf`
              : undefined,
          },
        ];
      });
    } else if (template.attachInvoicePdf && !invoiceForAttach) {
      // Template wants PDF but no invoice found — clear any stale invoice attachment
      setAttachments((prev) => prev.filter((a) => a.type !== "invoice"));
    }
  };

  const handleSendEmail = () => {
    console.log("📧 handleSendEmail called");

    if (!emailData.to.trim()) {
      console.log("❌ Email validation failed: no recipient");
      toast({
        title: "Email Required",
        description: "Please enter a recipient email address",
        variant: "destructive",
      });
      return;
    }

    if (!emailData.subject.trim()) {
      console.log("❌ Email validation failed: no subject");
      toast({
        title: "Subject Required",
        description: "Please enter an email subject",
        variant: "destructive",
      });
      return;
    }

    const emailPayload = {
      to: emailData.to,
      cc: emailData.cc || undefined,
      subject: emailData.subject,
      body: emailData.body,
      attachments: attachments.map((attachment) => ({
        name: attachment.name,
        type: attachment.type,
        id: attachment.id,
        url: attachment.url,
      })),
      selectedPhotos: selectedPhotos,
      jobId: job?.id,
      customerId: customer?.id,
      // Pass invoiceId if the invoice already exists in database
      // This allows server to fetch invoice directly even if invoiceData is malformed
      invoiceId: invoiceData?.id || undefined,
      quoteId: quoteData?.id,
      proposalId: proposalData?.id,
      invoiceData: invoiceData, // Pass full invoice data so backend can create invoice if needed
    };

    console.log("📧 Sending email with payload:", {
      to: emailPayload.to,
      subject: emailPayload.subject,
      attachmentCount: emailPayload.attachments.length,
      photoCount: emailPayload.selectedPhotos.length,
      selectedPhotoUrls: emailPayload.selectedPhotos,
      invoiceId: emailPayload.invoiceId,
      hasInvoiceData: !!emailPayload.invoiceData,
    });

    console.log(
      "📧 SELECTED PHOTOS ARRAY:",
      JSON.stringify(selectedPhotos, null, 2),
    );
    console.log(
      "📧 FULL INVOICE DATA BEING SENT:",
      JSON.stringify(invoiceData, null, 2),
    );

    sendEmailMutation.mutate(emailPayload);
  };

  const insertFormatting = (format: string) => {
    // Simple formatting helper - in a real app you'd use a proper rich text editor
    const textarea = document.querySelector(
      'textarea[name="email-body"]',
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    let formattedText = selectedText;
    switch (format) {
      case "bold":
        formattedText = `**${selectedText}**`;
        break;
      case "italic":
        formattedText = `*${selectedText}*`;
        break;
      case "link":
        formattedText = `[${selectedText || "Link Text"}](https://example.com)`;
        break;
    }

    const newValue =
      textarea.value.substring(0, start) +
      formattedText +
      textarea.value.substring(end);
    setEmailData((prev) => ({ ...prev, body: newValue }));
  };

  // Initialize speech recognition
  useEffect(() => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-NZ";

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript && emailBodyRef.current) {
        // Convert spoken punctuation to symbols
        let processedText = finalTranscript
          .replace(/\bquestion mark\b/gi, "?")
          .replace(/\bexclamation mark\b/gi, "!")
          .replace(/\bexclamation point\b/gi, "!")
          .replace(/\bperiod\b/gi, ".")
          .replace(/\bfull stop\b/gi, ".")
          .replace(/\bcomma\b/gi, ",")
          .replace(/\bcolon\b/gi, ":")
          .replace(/\bsemicolon\b/gi, ";")
          .replace(/\bdash\b/gi, "-")
          .replace(/\bhyphen\b/gi, "-")
          .replace(/\bopen quote\b/gi, '"')
          .replace(/\bclose quote\b/gi, '"')
          .replace(/\bquotation mark\b/gi, '"')
          .replace(/\bnew line\b/gi, "\n")
          .replace(/\bnew paragraph\b/gi, "\n\n");

        // Capitalize first letter and after sentence-ending punctuation
        processedText = processedText
          .replace(/^\s*\w/, (match) => match.toUpperCase()) // First letter
          .replace(/([.!?]\s+)(\w)/g, (match, p1, p2) => p1 + p2.toUpperCase()); // After punctuation

        // Insert text at cursor position instead of appending to end
        emailBodyRef.current.focus();

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();

          // Create text node with processed text
          const textNode = document.createTextNode(processedText);
          range.insertNode(textNode);

          // Move cursor to end of inserted text
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);

          // Update state with new HTML content
          setEmailData((prev) => ({
            ...prev,
            body: emailBodyRef.current?.innerHTML || "",
          }));
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);

      if (event.error === "not-allowed") {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access to use voice input",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [toast]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Voice Input Not Supported",
        description: "Your browser doesn't support voice input",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 border-b p-2">
          <div className="flex items-center justify-end sm:justify-between gap-2">
            <div className="hidden sm:flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              <DialogTitle className="text-base font-semibold">
                New Email
              </DialogTitle>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              data-testid="button-close-email"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex gap-1 sm:gap-2 justify-center flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs px-2 sm:px-4"
                    data-testid="button-smart-attachments"
                  >
                    <FileText className="w-3.5 h-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Smart Attachments</span>
                    <span className="sm:hidden ml-1">Attachments</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[95vw] sm:w-[600px] p-0"
                  align="center"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div
                    className="max-h-[50vh] overflow-y-auto p-4"
                    style={{
                      WebkitOverflowScrolling: "touch",
                      overscrollBehavior: "contain",
                    }}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      Smart Attachments
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                      {/* Invoice PDF */}
                      {invoiceData && (
                        <div
                          className="relative p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50"
                          onClick={() =>
                            handleDocumentPreview("invoice", invoiceData)
                          }
                          data-testid="attachment-invoice-pdf"
                        >
                          <div className="flex flex-col items-center text-center">
                            <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center mb-2">
                              <FileText className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-xs font-medium text-gray-900 mb-1 truncate w-full">
                              Invoice #{invoiceData.invoiceNumber}
                            </div>
                            <div className="text-xs text-gray-500 truncate w-full">
                              $
                              {invoiceData.totalAmount ||
                                invoiceData.amount ||
                                "0.00"}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Quote PDF */}
                      {quoteData && (
                        <div
                          className="relative p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50"
                          onClick={() =>
                            handleDocumentPreview("quote", quoteData)
                          }
                          data-testid="attachment-quote-pdf"
                        >
                          <div className="flex flex-col items-center text-center">
                            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center mb-2">
                              <FileText className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-xs font-medium text-gray-900 mb-1 truncate w-full">
                              Quote #{quoteData.quoteNumber}
                            </div>
                            <div className="text-xs text-gray-500 truncate w-full">
                              ${quoteData.totalAmount || "0.00"}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Proposal PDF */}
                      {proposalData && (
                        <div
                          className="relative p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50"
                          onClick={() =>
                            handleDocumentPreview("proposal", proposalData)
                          }
                          data-testid="attachment-proposal-pdf"
                        >
                          <div className="flex flex-col items-center text-center">
                            <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center mb-2">
                              <FileText className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-xs font-medium text-gray-900 mb-1 truncate w-full">
                              Proposal #
                              {proposalData.proposalNumber ||
                                "PROP-" + job?.jobNumber}
                            </div>
                            <div className="text-xs text-gray-500 truncate w-full">
                              Professional proposal
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Job Photos */}
                      {jobPhotos?.beforePhotos?.map(
                        (photoUrl: string, index: number) => (
                          <div
                            key={`before-${index}`}
                            className={`relative rounded-lg cursor-pointer transition-all overflow-hidden ${
                              selectedPhotos.includes(photoUrl)
                                ? "ring-2 ring-blue-500 ring-offset-2"
                                : "ring-1 ring-gray-200 hover:ring-gray-300"
                            }`}
                            onClick={() => togglePhotoSelection(photoUrl)}
                            data-testid={`photo-before-${index}`}
                          >
                            {selectedPhotos.includes(photoUrl) && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center z-10 shadow-md">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                            <div className="aspect-square">
                              <img
                                src={photoUrl}
                                alt={`Before photo ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                              <div className="text-xs text-center text-white font-medium">
                                Before {index + 1}
                              </div>
                            </div>
                          </div>
                        ),
                      )}

                      {jobPhotos?.afterPhotos?.map(
                        (photoUrl: string, index: number) => (
                          <div
                            key={`after-${index}`}
                            className={`relative rounded-lg cursor-pointer transition-all overflow-hidden ${
                              selectedPhotos.includes(photoUrl)
                                ? "ring-2 ring-blue-500 ring-offset-2"
                                : "ring-1 ring-gray-200 hover:ring-gray-300"
                            }`}
                            onClick={() => togglePhotoSelection(photoUrl)}
                            data-testid={`photo-after-${index}`}
                          >
                            {selectedPhotos.includes(photoUrl) && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center z-10 shadow-md">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                            <div className="aspect-square">
                              <img
                                src={photoUrl}
                                alt={`After photo ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                              <div className="text-xs text-center text-white font-medium">
                                After {index + 1}
                              </div>
                            </div>
                          </div>
                        ),
                      )}

                      {/* Diary Photos */}
                      {diaryPhotos.map((photoUrl: string, index: number) => (
                        <div
                          key={`diary-${index}`}
                          className={`relative rounded-lg cursor-pointer transition-all overflow-hidden ${
                            selectedPhotos.includes(photoUrl)
                              ? "ring-2 ring-blue-500 ring-offset-2"
                              : "ring-1 ring-gray-200 hover:ring-gray-300"
                          }`}
                          onClick={() => togglePhotoSelection(photoUrl)}
                          data-testid={`photo-diary-${index}`}
                        >
                          {selectedPhotos.includes(photoUrl) && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center z-10 shadow-md">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <div className="aspect-square">
                            <img
                              src={photoUrl}
                              alt={`Diary photo ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-600/70 to-transparent p-2">
                            <div className="text-xs text-center text-white font-medium">
                              Diary {index + 1}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Show message when no photos available */}
                      {!jobPhotos?.beforePhotos?.length &&
                        !jobPhotos?.afterPhotos?.length &&
                        diaryPhotos.length === 0 &&
                        !invoiceData &&
                        !quoteData &&
                        !proposalData && (
                          <div className="col-span-full text-center py-4 text-sm text-gray-500">
                            No attachments available for this job
                          </div>
                        )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2 sm:px-4"
              >
                <label
                  htmlFor="email-file-attachment"
                  className="cursor-pointer"
                  data-testid="button-attach-file"
                >
                  <Paperclip className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Attach</span>
                </label>
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={sendEmailMutation.isPending}
                size="sm"
                className="h-8 text-xs px-3 sm:px-4"
                data-testid="button-send-email"
              >
                <Send className="w-3.5 h-3.5 sm:mr-1.5" />
                <span>
                  {sendEmailMutation.isPending ? "Sending..." : "Send"}
                </span>
              </Button>
            </div>
            <Select
              value={emailData.selectedTemplate}
              onValueChange={handleTemplateSelect}
            >
              <SelectTrigger className="w-full text-xs h-8">
                <SelectValue placeholder="Email Templates" />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-2 sm:gap-2 overflow-y-auto p-2 sm:p-3">
          {/* Email Fields */}
          <div className="space-y-1 sm:space-y-1.5">
            <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-2 sm:items-center">
              <Label
                htmlFor="email-to"
                className="text-xs sm:col-span-1 sm:text-right font-medium"
              >
                To:
              </Label>
              <Input
                id="email-to"
                name="email-to"
                value={emailData.to}
                onChange={(e) =>
                  setEmailData((prev) => ({ ...prev, to: e.target.value }))
                }
                className="sm:col-span-11 h-8 text-base"
                placeholder="recipient@email.com"
                data-testid="input-email-to"
              />
            </div>

            {/* Saved invoice recipient chips — shown when customer has multiple saved emails */}
            {(() => {
              const savedEmails = defaultCc
                ? defaultCc.split(",").map((e) => e.trim()).filter(Boolean)
                : [];
              if (savedEmails.length === 0) return null;
              return (
                <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-2 sm:items-start">
                  <Label className="text-xs sm:col-span-1 sm:text-right font-medium pt-1">
                    Saved:
                  </Label>
                  <div className="sm:col-span-11 flex flex-wrap gap-1.5">
                    {savedEmails.map((email) => {
                      const ccEmails = emailData.cc.split(",").map((e) => e.trim()).filter(Boolean);
                      const isActive = ccEmails.includes(email) || emailData.to === email;
                      const toggle = () => {
                        setEmailData((prev) => {
                          const current = prev.cc.split(",").map((e) => e.trim()).filter(Boolean);
                          const next = isActive
                            ? current.filter((e) => e !== email)
                            : [...current, email];
                          return { ...prev, cc: next.join(", ") };
                        });
                      };
                      return (
                        <button
                          key={email}
                          type="button"
                          onClick={toggle}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                            isActive
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                          }`}
                        >
                          {isActive && <Check className="w-3 h-3" />}
                          {email}
                        </button>
                      );
                    })}
                    <span className="text-xs text-gray-400 self-center">click to add/remove from CC</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-2 sm:items-center">
              <Label
                htmlFor="email-cc"
                className="text-xs sm:col-span-1 sm:text-right font-medium"
              >
                CC:
              </Label>
              <Input
                id="email-cc"
                name="email-cc"
                value={emailData.cc}
                onChange={(e) =>
                  setEmailData((prev) => ({ ...prev, cc: e.target.value }))
                }
                className="sm:col-span-11 h-8 text-base"
                placeholder="cc@email.com (optional)"
                data-testid="input-email-cc"
              />
            </div>

            <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-2 sm:items-center">
              <Label
                htmlFor="email-subject"
                className="text-xs sm:col-span-1 sm:text-right font-medium"
              >
                Subject:
              </Label>
              <Input
                id="email-subject"
                name="email-subject"
                value={emailData.subject}
                onChange={(e) =>
                  setEmailData((prev) => ({ ...prev, subject: e.target.value }))
                }
                className="sm:col-span-11 h-8 text-base"
                data-testid="input-email-subject"
              />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-2 sm:items-start">
                <Label className="text-xs sm:col-span-1 sm:text-right font-medium pt-1">
                  Attached:
                </Label>
                <div className="sm:col-span-11 flex gap-1.5 flex-wrap">
                  {attachments.map((attachment, index) => {
                    const getAttachmentVariant = (type: string) => {
                      switch (type) {
                        case "invoice":
                          return "destructive";
                        case "quote":
                          return "default";
                        case "proposal":
                          return "secondary";
                        default:
                          return "outline";
                      }
                    };

                    return (
                      <Badge
                        key={index}
                        variant={getAttachmentVariant(attachment.type)}
                        className="flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        {attachment.name}
                        <X
                          className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500"
                          onClick={() => removeAttachment(attachment.name)}
                        />
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Invoice PDF status — shown when template wants PDF but none is attached yet */}
            {(() => {
              const currentTemplate = EMAIL_TEMPLATES.find(
                (t) => t.id === emailData.selectedTemplate,
              );
              const needsPdf = (currentTemplate as any)?.attachInvoicePdf;
              const invoiceAttached = attachments.some(
                (a) => a.type === "invoice",
              );
              if (!needsPdf || invoiceAttached) return null;
              return (
                <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-2 sm:items-start">
                  <div className="sm:col-span-1" />
                  <div className="sm:col-span-11">
                    {isLoadingJobInvoice ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                        Checking for invoice PDF…
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        No invoice found for this job — create one in the
                        Billing tab first to attach the PDF
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Hidden file input - using sr-only for accessibility */}
            <input
              id="email-file-attachment"
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.zip"
              onChange={handleFileSelect}
              className="sr-only"
            />
          </div>

          {/* Formatting Toolbar */}
          <div className="flex items-center gap-0.5 sm:gap-1 p-1.5 sm:p-2 border-y border-gray-200 flex-wrap bg-gray-50/50">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => insertFormatting("bold")}
              data-testid="button-format-bold"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => insertFormatting("italic")}
              data-testid="button-format-italic"
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => insertFormatting("link")}
              data-testid="button-format-link"
            >
              <Link className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {}}
              data-testid="button-format-list"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {}}
              data-testid="button-format-numbered-list"
            >
              <ListOrdered className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsAvailabilityOpen(true)}
              title="Check your Google Calendar availability"
              data-testid="button-check-availability"
            >
              <CalendarIcon className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={isListening ? "default" : "ghost"}
              size="icon"
              className={`h-8 w-8 ${isListening ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
              onClick={toggleVoiceInput}
              data-testid="button-voice-input"
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Email Body */}
          <div className="flex-1 min-h-0 relative">
            <div
              ref={emailBodyRef}
              contentEditable
              suppressContentEditableWarning
              dir="ltr"
              onInput={(e) => {
                const html = e.currentTarget.innerHTML;
                setEmailData((prev) => ({ ...prev, body: html }));
              }}
              onFocus={(e) => {
                // Clear placeholder on focus
                if (
                  e.currentTarget.innerHTML.includes("Compose your email...")
                ) {
                  e.currentTarget.innerHTML = "";
                }
              }}
              onBlur={(e) => {
                // Restore placeholder if empty
                if (!e.currentTarget.textContent?.trim()) {
                  e.currentTarget.innerHTML = DOMPurify.sanitize(
                    '<p style="color: #9ca3af;">Compose your email...</p>',
                  );
                  setEmailData((prev) => ({ ...prev, body: "" }));
                }
              }}
              className="w-full h-full resize-none border-0 focus-visible:ring-0 text-base leading-relaxed pb-48 outline-none overflow-y-auto"
              data-testid="div-email-body"
              style={{
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                direction: "ltr",
                unicodeBidi: "embed",
                cursor: "text",
                caretColor: "auto",
              }}
            />
          </div>
        </div>
      </DialogContent>

      {/* Calendar Availability Modal */}
      <CalendarAvailabilityModal
        isOpen={isAvailabilityOpen}
        onClose={() => setIsAvailabilityOpen(false)}
        onSlotPick={handleSlotPick}
      />

      {/* Document Preview Modal */}
      {showPreview.type && showPreview.data && (
        <Dialog
          open={!!showPreview.type}
          onOpenChange={() => setShowPreview({ type: null, data: null })}
        >
          <DialogContent className="max-w-full sm:max-w-4xl h-[90vh] flex flex-col p-3 sm:p-6">
            <DialogHeader className="flex-row items-center justify-between space-y-0 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                <DialogTitle>
                  {showPreview.type === "invoice" &&
                    `Invoice Preview - #${showPreview.data.invoiceNumber}`}
                  {showPreview.type === "quote" &&
                    `Quote Preview - #${showPreview.data.quoteNumber}`}
                  {showPreview.type === "proposal" &&
                    `Proposal Preview - #${showPreview.data.proposalNumber || "PROP-" + job?.jobNumber}`}
                </DialogTitle>
              </div>
              <Button
                onClick={() => setShowPreview({ type: null, data: null })}
                variant="ghost"
                size="sm"
                data-testid="button-close-preview"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="max-w-3xl mx-auto bg-white shadow-lg">
                {showPreview.type === "invoice" && (
                  <InvoiceTemplate
                    template={{
                      id: "default-invoice",
                      name: "Default Invoice Template",
                      type: "invoice",
                      description: null,
                      isDefault: true,
                      isActive: true,
                      companyName: "Treemarkables",
                      companyAddress: "Gisborne, New Zealand",
                      companyEmail: "info@treemarkables.co.nz",
                      companyPhone: "+64 6 867 1234",
                      gstNumber: "GST123456789",
                      paymentTerms: "30 days",
                      primaryColor: "#f97316",
                      secondaryColor: "#3b82f6",
                      logoUrl: null,
                      headerLayout: null,
                      footerText: null,
                      createdAt: null,
                      updatedAt: null,
                    }}
                    invoice={showPreview.data}
                    customer={customer}
                    jobAddress={
                      showPreview.data.address ||
                      job?.billingAddress ||
                      job?.address ||
                      ""
                    }
                    contactName={showPreview.data.contactName}
                    billingName={job?.billingNameOverride || undefined}
                    lineItems={showPreview.data.lineItems || []}
                    description={
                      showPreview.data.description ||
                      job?.description ||
                      job?.title ||
                      ""
                    }
                    photos={showPreview.data.photos || []}
                    showActions={false}
                  />
                )}
                {showPreview.type === "quote" && (
                  <QuoteTemplate
                    template={{
                      id: "default-quote",
                      name: "Default Quote Template",
                      type: "quote",
                      description: null,
                      isDefault: true,
                      isActive: true,
                      companyName: "Treemarkables",
                      companyAddress: "Hauroa rd\nGisborne, 4010",
                      companyEmail: "quotes@treemarkables.nz",
                      companyPhone: "027 216 6882",
                      gstNumber: "GST123456789",
                      paymentTerms: "30 days",
                      primaryColor: "#f97316",
                      secondaryColor: "#3b82f6",
                      logoUrl: null,
                      headerLayout: null,
                      footerText: null,
                      createdAt: null,
                      updatedAt: null,
                    }}
                    quote={showPreview.data}
                    customer={customer}
                    showActions={false}
                  />
                )}
                {showPreview.type === "proposal" && (
                  <ProposalTemplate
                    template={{
                      id: "default-proposal",
                      name: "Default Proposal Template",
                      type: "proposal",
                      description: null,
                      isDefault: true,
                      isActive: true,
                      companyName: "Treemarkables",
                      companyAddress: "Gisborne, New Zealand",
                      companyEmail: "info@treemarkables.co.nz",
                      companyPhone: "+64 6 867 1234",
                      gstNumber: "GST123456789",
                      paymentTerms: "30 days",
                      primaryColor: "#f97316",
                      secondaryColor: "#3b82f6",
                      logoUrl: null,
                      headerLayout: null,
                      footerText: null,
                      createdAt: null,
                      updatedAt: null,
                    }}
                    proposal={showPreview.data}
                    customer={customer}
                    sections={mappedSections}
                    showActions={false}
                  />
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
