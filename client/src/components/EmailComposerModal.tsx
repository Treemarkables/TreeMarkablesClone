import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  Eye
} from "lucide-react";
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
  templateType?: 'invoice' | 'quote' | 'proposal';
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "invoice_delivery",
    name: "Invoice Delivery",
    subject: "Invoice RE: {jobNumber} {customerAddress}",
    body: `Hi {customerName},

Please find a copy of your Treemarkables LTD Invoice in regards to {jobDescription} attached. View your invoice online here: {invoiceLink}

If you have any queries or are unable to open the invoice, please contact {contactName} on {contactPhone}.

Regards,
{contactName}
{companySignature}`
  },
  {
    id: "payment_reminder",
    name: "Payment Reminder", 
    subject: "Payment Reminder - Invoice {invoiceNumber}",
    body: `Hi {customerName},

This is a friendly reminder that your invoice {invoiceNumber} for {jobDescription} is now due.

Amount Due: {invoiceAmount}
Due Date: {dueDate}

You can view and pay your invoice online here: {invoiceLink}

If you have any questions, please don't hesitate to contact us.

Best regards,
{contactName}`
  },
  {
    id: "quote_delivery",
    name: "Quote Delivery",
    subject: "Your Quote RE: {jobNumber} {customerAddress}",
    body: `Hi {customerName},

Thank you for your enquiry. Please find your detailed quote for {jobDescription} attached.

Quote Number: {quoteNumber}
Valid Until: {quoteExpiry}
Total Amount: {quoteAmount}

You can view your quote online here: {quoteLink}

We look forward to hearing from you. If you have any questions about this quote, please contact {contactName} on {contactPhone}.

Best regards,
{contactName}
{companySignature}`
  },
  {
    id: "proposal_delivery", 
    name: "Proposal Delivery",
    subject: "Your Detailed Proposal RE: {jobNumber}",
    body: `Hi {customerName},

Thank you for considering Treemarkables for your tree service needs. Please find your comprehensive proposal for {jobDescription} attached.

This proposal includes:
- Detailed scope of work
- Professional recommendations  
- Competitive pricing
- Our certification and insurance details

You can view your proposal online here: {proposalLink}

We would be delighted to discuss this proposal further. Please contact {contactName} on {contactPhone} with any questions.

Kind regards,
{contactName}
{companySignature}`
  }
];

export function EmailComposerModal({ 
  isOpen, 
  onClose, 
  job, 
  customer, 
  invoiceData,
  quoteData,
  proposalData,
  templateType
}: EmailComposerModalProps) {
  const [emailData, setEmailData] = useState({
    to: "",
    cc: "",
    subject: "",
    body: "",
    selectedTemplate: ""
  });
  interface TypedAttachment {
    name: string;
    type: 'invoice' | 'quote' | 'proposal' | 'file' | 'photo';
    id?: string;
    url?: string;
  }

  const [attachments, setAttachments] = useState<TypedAttachment[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState<{ type: 'invoice' | 'quote' | 'proposal' | null; data: any }>({ type: null, data: null });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch job photos for Smart Attachments
  const { data: jobPhotos } = useQuery<{
    success: boolean;
    jobId: string;
    beforePhotos: string[];
    afterPhotos: string[];
  }>({
    queryKey: ['/api/jobs', job?.id, 'photos'],
    enabled: !!job?.id && isOpen,
  });

  // Get appropriate template based on context
  const getDefaultTemplate = () => {
    if (templateType === 'quote' || quoteData) {
      return EMAIL_TEMPLATES.find(t => t.id === 'quote_delivery') || EMAIL_TEMPLATES[0];
    } else if (templateType === 'proposal' || proposalData) {
      return EMAIL_TEMPLATES.find(t => t.id === 'proposal_delivery') || EMAIL_TEMPLATES[0];
    } else {
      return EMAIL_TEMPLATES.find(t => t.id === 'invoice_delivery') || EMAIL_TEMPLATES[0];
    }
  };

  // Pre-populate email data when modal opens
  useEffect(() => {
    if (isOpen && job && customer) {
      const billingEmail = customer.billingContactEmail || customer.email || customer.jobContactEmail;
      const customerName = customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      
      // Auto-attach appropriate document if available
      const attachmentsList: TypedAttachment[] = [];
      if (invoiceData) {
        attachmentsList.push({
          name: `Treemarkables LTD Invoice ${invoiceData.invoiceNumber}`,
          type: 'invoice',
          id: invoiceData.id,
          url: invoiceData.id ? `/api/invoices/${invoiceData.id}/pdf` : undefined
        });
      }
      if (quoteData) {
        attachmentsList.push({
          name: `Treemarkables LTD Quote ${quoteData.quoteNumber}`,
          type: 'quote',
          id: quoteData.id,
          url: undefined // PDF generation not yet implemented
        });
      }
      if (proposalData) {
        attachmentsList.push({
          name: `Treemarkables LTD Proposal ${proposalData.proposalNumber || 'PROP-' + job.jobNumber}`,
          type: 'proposal',
          id: proposalData.id,
          url: proposalData.id ? `/api/proposals/${proposalData.id}/pdf` : undefined
        });
      }
      setAttachments(attachmentsList);

      // Apply appropriate template based on context
      const template = getDefaultTemplate();
      const documentData = invoiceData || quoteData || proposalData;
      
      const populatedSubject = template.subject
        .replace("{jobNumber}", job.jobNumber || "")
        .replace("{customerAddress}", job.address || "");
      
      const populatedBody = template.body
        .replace("{customerName}", customerName || "Valued Customer")
        .replace("{jobDescription}", job.description || job.title || "tree service")
        .replace("{invoiceLink}", invoiceData?.id ? `${window.location.origin}/invoice/${invoiceData.id}` : "View invoice in your customer portal")
        .replace("{quoteLink}", quoteData?.id ? `${window.location.origin}/quote/${quoteData.id}` : "View quote in your customer portal")
        .replace("{proposalLink}", proposalData?.id ? `${window.location.origin}/proposal/${proposalData.id}` : "View proposal in your customer portal")
        .replace("{quoteNumber}", quoteData?.quoteNumber || "")
        .replace("{quoteExpiry}", quoteData?.validUntil ? new Date(quoteData.validUntil).toLocaleDateString() : "")
        .replace("{quoteAmount}", quoteData?.totalAmount ? `$${quoteData.totalAmount}` : "$0.00")
        .replace("{proposalNumber}", proposalData?.proposalNumber || (job?.jobNumber ? `PROP-${job.jobNumber}` : ""))
        .replace("{invoiceNumber}", invoiceData?.invoiceNumber || "")
        .replace("{invoiceAmount}", invoiceData?.totalAmount || invoiceData?.amount ? `$${invoiceData.totalAmount || invoiceData.amount}` : "$0.00")
        .replace("{dueDate}", invoiceData?.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : "")
        .replace("{contactName}", "Treemarkables Team")
        .replace("{contactPhone}", customer?.jobContactPhone || customer?.billingContactPhone || "027-XXX-XXXX")
        .replace("{companySignature}", "\n\nTreemarkables LTD\nCertified Arborists\nGisborne, New Zealand\nPhone: 027-XXX-XXXX\nEmail: info@treemarkables.co.nz");

      setEmailData({
        to: billingEmail || "",
        cc: "",
        subject: populatedSubject,
        body: populatedBody,
        selectedTemplate: template.id
      });
    }
  }, [isOpen, job, customer, invoiceData, quoteData, proposalData, templateType]);

  // Handle photo selection for email attachments
  const togglePhotoSelection = (photoUrl: string) => {
    setSelectedPhotos(prev => 
      prev.includes(photoUrl) 
        ? prev.filter(url => url !== photoUrl)
        : [...prev, photoUrl]
    );
  };

  const handleDocumentPreview = (type: 'invoice' | 'quote' | 'proposal', data: any) => {
    setShowPreview({ type, data });
  };

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
    const oversizedFiles = fileArray.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      toast({
        title: "File Too Large",
        description: `Files must be smaller than 10MB. Please compress: ${oversizedFiles.map(f => f.name).join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    // Add files to state
    setUploadedFiles(prev => [...prev, ...fileArray]);
    setAttachments(prev => [...prev, ...fileArray.map(file => ({
      name: file.name,
      type: 'file' as const,
      url: URL.createObjectURL(file)
    }))]);
    
    toast({
      title: "Files Attached",
      description: `${fileArray.length} file(s) attached successfully`,
    });

    // Clear the input for future selections
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (fileName: string) => {
    setAttachments(prev => prev.filter(attachment => attachment.name !== fileName));
    setUploadedFiles(prev => prev.filter(file => file.name !== fileName));
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (emailPayload: any) => {
      return await apiRequest('POST', '/api/emails/send', emailPayload);
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Invoice email has been sent successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Email Error",
        description: error.message || "Failed to send email",
        variant: "destructive"
      });
    }
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const customerName = customer?.name || `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
    
    const populatedSubject = template.subject
      .replace("{jobNumber}", job?.jobNumber || "")
      .replace("{customerAddress}", job?.address || "")
      .replace("{invoiceNumber}", invoiceData?.invoiceNumber || "")
      .replace("{quoteNumber}", quoteData?.quoteNumber || "")
      .replace("{proposalNumber}", proposalData?.proposalNumber || "");
    
    const populatedBody = template.body
      .replace("{customerName}", customerName || "Valued Customer")
      .replace("{jobDescription}", job?.description || job?.title || "tree service")
      .replace("{invoiceLink}", invoiceData?.id ? `${window.location.origin}/invoice/${invoiceData.id}` : "View invoice in your customer portal")
      .replace("{quoteLink}", quoteData?.id ? `${window.location.origin}/quote/${quoteData.id}` : "View quote in your customer portal")
      .replace("{proposalLink}", proposalData?.id ? `${window.location.origin}/proposal/${proposalData.id}` : "View proposal in your customer portal")
      .replace("{quoteNumber}", quoteData?.quoteNumber || "")
      .replace("{quoteExpiry}", quoteData?.validUntil ? new Date(quoteData.validUntil).toLocaleDateString() : "")
      .replace("{quoteAmount}", quoteData?.totalAmount ? `$${quoteData.totalAmount}` : "$0.00")
      .replace("{proposalNumber}", proposalData?.proposalNumber || (job?.jobNumber ? `PROP-${job.jobNumber}` : ""))
      .replace("{contactName}", "Treemarkables Team")
      .replace("{contactPhone}", customer?.jobContactPhone || customer?.billingContactPhone || "027-XXX-XXXX")
      .replace("{companySignature}", "\n\nTreemarkables LTD\nCertified Arborists\nGisborne, New Zealand\nPhone: 027-XXX-XXXX\nEmail: info@treemarkables.co.nz")
      .replace("{invoiceAmount}", invoiceData?.totalAmount || invoiceData?.amount ? `$${invoiceData.totalAmount || invoiceData.amount}` : "$0.00")
      .replace("{dueDate}", invoiceData?.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : "");

    setEmailData(prev => ({
      ...prev,
      subject: populatedSubject,
      body: populatedBody,
      selectedTemplate: templateId
    }));
  };

  const handleSendEmail = () => {
    if (!emailData.to.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter a recipient email address",
        variant: "destructive"
      });
      return;
    }

    if (!emailData.subject.trim()) {
      toast({
        title: "Subject Required", 
        description: "Please enter an email subject",
        variant: "destructive"
      });
      return;
    }

    const emailPayload = {
      to: emailData.to,
      cc: emailData.cc || undefined,
      subject: emailData.subject,
      body: emailData.body,
      attachments: attachments.map(attachment => ({
        name: attachment.name,
        type: attachment.type,
        id: attachment.id,
        url: attachment.url
      })),
      selectedPhotos: selectedPhotos,
      jobId: job?.id,
      customerId: customer?.id,
      invoiceId: invoiceData?.id,
      quoteId: quoteData?.id,
      proposalId: proposalData?.id
    };

    sendEmailMutation.mutate(emailPayload);
  };

  const insertFormatting = (format: string) => {
    // Simple formatting helper - in a real app you'd use a proper rich text editor
    const textarea = document.querySelector('textarea[name="email-body"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let formattedText = selectedText;
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'link':
        formattedText = `[${selectedText || 'Link Text'}](https://example.com)`;
        break;
    }

    const newValue = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end);
    setEmailData(prev => ({ ...prev, body: newValue }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white p-2">
          <div className="flex items-center justify-end sm:justify-between gap-2 mb-1">
            <div className="hidden sm:flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              <DialogTitle className="text-base font-semibold text-white">New Email</DialogTitle>
            </div>
            <Button 
              onClick={onClose} 
              variant="ghost" 
              size="sm"
              className="text-white hover:bg-white/20 h-6 w-6 p-0"
              data-testid="button-close-email"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            <Select value={emailData.selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="w-full bg-white/10 border-white/20 text-white text-xs h-7">
                <SelectValue placeholder="Email Templates" />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TEMPLATES.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-1">
              <Button 
                onClick={handleFileAttachment} 
                variant="outline" 
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full h-7 text-xs"
                data-testid="button-attach-file"
              >
                <Paperclip className="w-3 h-3 mr-1" />
                <span>Attach</span>
              </Button>
              <Button 
                onClick={handleSendEmail}
                disabled={sendEmailMutation.isPending}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/20 w-full h-7 text-xs"
                data-testid="button-send-email"
              >
                <Send className="w-3 h-3 mr-1" />
                <span>{sendEmailMutation.isPending ? 'Sending...' : 'Send'}</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-3 sm:gap-4 overflow-y-auto p-3 sm:p-4">
          {/* Email Fields */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-3 sm:items-center">
              <Label htmlFor="email-to" className="text-sm sm:col-span-1 sm:text-right">To:</Label>
              <Input
                id="email-to"
                name="email-to"
                value={emailData.to}
                onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                className="sm:col-span-11"
                placeholder="recipient@email.com"
                data-testid="input-email-to"
              />
            </div>
            
            <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-3 sm:items-center">
              <Label htmlFor="email-cc" className="text-sm sm:col-span-1 sm:text-right">CC:</Label>
              <Input
                id="email-cc"
                name="email-cc"
                value={emailData.cc}
                onChange={(e) => setEmailData(prev => ({ ...prev, cc: e.target.value }))}
                className="sm:col-span-11"
                placeholder="cc@email.com (optional)"
                data-testid="input-email-cc"
              />
            </div>

            <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-3 sm:items-center">
              <Label htmlFor="email-subject" className="text-sm sm:col-span-1 sm:text-right">Subject:</Label>
              <Input
                id="email-subject"
                name="email-subject"
                value={emailData.subject}
                onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                className="sm:col-span-11"
                data-testid="input-email-subject"
              />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-3 sm:items-center">
                <Label className="text-sm sm:col-span-1 sm:text-right">Attached:</Label>
                <div className="sm:col-span-11 flex gap-2 flex-wrap">
                  {attachments.map((attachment, index) => {
                    const getAttachmentVariant = (type: string) => {
                      switch (type) {
                        case 'invoice': return 'destructive';
                        case 'quote': return 'default';
                        case 'proposal': return 'secondary';
                        default: return 'outline';
                      }
                    };
                    
                    return (
                      <Badge key={index} variant={getAttachmentVariant(attachment.type)} className="flex items-center gap-1">
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

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.zip"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* Smart Attachments Section */}
          <div className="border rounded-lg bg-gray-50 p-2 sm:p-4">
            <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">Smart Attachments</h3>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
              {/* Invoice PDF */}
              {invoiceData && (
                <div 
                  className="relative p-2 sm:p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50"
                  onClick={() => handleDocumentPreview('invoice', invoiceData)}
                  data-testid="attachment-invoice-pdf"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-500 rounded flex items-center justify-center mb-1 sm:mb-2">
                      <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="text-[10px] sm:text-xs font-medium text-gray-900 mb-0.5 sm:mb-1 truncate w-full">
                      Invoice #{invoiceData.invoiceNumber}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 truncate w-full">
                      ${invoiceData.totalAmount || invoiceData.amount || '0.00'}
                    </div>
                  </div>
                </div>
              )}

              {/* Quote PDF */}
              {quoteData && (
                <div 
                  className="relative p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50"
                  onClick={() => handleDocumentPreview('quote', quoteData)}
                  data-testid="attachment-quote-pdf"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center mb-2">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-xs font-medium text-gray-900 mb-1">
                      Quote #{quoteData.quoteNumber}
                    </div>
                    <div className="text-xs text-gray-500">
                      for ${quoteData.totalAmount || '0.00'}
                    </div>
                    <div className="text-xs text-gray-400">
                      Valid until {quoteData.validUntil ? new Date(quoteData.validUntil).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
              )}

              {/* Proposal PDF */}
              {proposalData && (
                <div 
                  className="relative p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50"
                  onClick={() => handleDocumentPreview('proposal', proposalData)}
                  data-testid="attachment-proposal-pdf"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center mb-2">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-xs font-medium text-gray-900 mb-1">
                      Proposal #{proposalData.proposalNumber || 'PROP-' + job?.jobNumber}
                    </div>
                    <div className="text-xs text-gray-500">
                      Professional tree service proposal
                    </div>
                  </div>
                </div>
              )}

              {/* Job Photos */}
              {jobPhotos?.beforePhotos?.map((photoUrl: string, index: number) => (
                <div
                  key={`before-${index}`}
                  className={`relative p-2 border rounded-lg cursor-pointer transition-colors ${
                    selectedPhotos.includes(photoUrl) 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => togglePhotoSelection(photoUrl)}
                  data-testid={`photo-before-${index}`}
                >
                  {selectedPhotos.includes(photoUrl) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <img 
                    src={photoUrl} 
                    alt={`Before photo ${index + 1}`}
                    className="w-full h-12 sm:h-16 object-cover rounded mb-0.5 sm:mb-1"
                  />
                  <div className="text-[10px] sm:text-xs text-center text-gray-600">Before {index + 1}</div>
                </div>
              ))}

              {jobPhotos?.afterPhotos?.map((photoUrl: string, index: number) => (
                <div
                  key={`after-${index}`}
                  className={`relative p-2 border rounded-lg cursor-pointer transition-colors ${
                    selectedPhotos.includes(photoUrl) 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => togglePhotoSelection(photoUrl)}
                  data-testid={`photo-after-${index}`}
                >
                  {selectedPhotos.includes(photoUrl) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <img 
                    src={photoUrl} 
                    alt={`After photo ${index + 1}`}
                    className="w-full h-12 sm:h-16 object-cover rounded mb-0.5 sm:mb-1"
                  />
                  <div className="text-[10px] sm:text-xs text-center text-gray-600">After {index + 1}</div>
                </div>
              ))}

              {/* Show message when no photos available */}
              {(!jobPhotos?.beforePhotos?.length && !jobPhotos?.afterPhotos?.length && !invoiceData && !quoteData && !proposalData) && (
                <div className="col-span-full text-center py-4 text-gray-500 text-sm">
                  No attachments available for this job
                </div>
              )}
            </div>
          </div>

          {/* Formatting Toolbar */}
          <div className="flex items-center gap-0.5 sm:gap-1 p-1 sm:p-2 border-b border-gray-200 flex-wrap">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertFormatting('bold')}
              data-testid="button-format-bold"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertFormatting('italic')}
              data-testid="button-format-italic"
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => insertFormatting('link')}
              data-testid="button-format-link"
            >
              <Link className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-300 mx-2" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {}}
              data-testid="button-format-list"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {}}
              data-testid="button-format-numbered-list"
            >
              <ListOrdered className="w-4 h-4" />
            </Button>
          </div>

          {/* Email Body */}
          <div className="flex-1 min-h-0">
            <Textarea
              name="email-body"
              value={emailData.body}
              onChange={(e) => setEmailData(prev => ({ ...prev, body: e.target.value }))}
              className="w-full h-full resize-none border-0 focus-visible:ring-0 text-sm leading-relaxed"
              placeholder="Compose your email..."
              data-testid="textarea-email-body"
            />
          </div>
        </div>
      </DialogContent>

      {/* Document Preview Modal */}
      {showPreview.type && showPreview.data && (
        <Dialog open={!!showPreview.type} onOpenChange={() => setShowPreview({ type: null, data: null })}>
          <DialogContent className="max-w-full sm:max-w-4xl h-[90vh] flex flex-col p-3 sm:p-6">
            <DialogHeader className="flex-row items-center justify-between space-y-0 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                <DialogTitle>
                  {showPreview.type === 'invoice' && `Invoice Preview - #${showPreview.data.invoiceNumber}`}
                  {showPreview.type === 'quote' && `Quote Preview - #${showPreview.data.quoteNumber}`}
                  {showPreview.type === 'proposal' && `Proposal Preview - #${showPreview.data.proposalNumber || 'PROP-' + job?.jobNumber}`}
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
                {showPreview.type === 'invoice' && (
                  <InvoiceTemplate 
                    template={{
                      id: 'default-invoice',
                      name: 'Default Invoice Template',
                      type: 'invoice',
                      description: null,
                      isDefault: true,
                      isActive: true,
                      companyName: 'Treemarkables',
                      companyAddress: 'Gisborne, New Zealand',
                      companyEmail: 'info@treemarkables.co.nz',
                      companyPhone: '+64 6 867 1234',
                      gstNumber: 'GST123456789',
                      paymentTerms: '30 days',
                      primaryColor: '#f97316',
                      secondaryColor: '#3b82f6',
                      logoUrl: null,
                      headerLayout: null,
                      footerText: null,
                      createdAt: null,
                      updatedAt: null
                    }}
                    invoice={showPreview.data}
                    customer={customer}
                    showActions={false}
                  />
                )}
                {showPreview.type === 'quote' && (
                  <QuoteTemplate 
                    template={{
                      id: 'default-quote',
                      name: 'Default Quote Template',
                      type: 'quote',
                      description: null,
                      isDefault: true,
                      isActive: true,
                      companyName: 'Treemarkables',
                      companyAddress: 'Hauroa rd\nGisborne, 4010',
                      companyEmail: 'quotes@treemarkables.nz',
                      companyPhone: '027 216 6882',
                      gstNumber: 'GST123456789',
                      paymentTerms: '30 days',
                      primaryColor: '#f97316',
                      secondaryColor: '#3b82f6',
                      logoUrl: null,
                      headerLayout: null,
                      footerText: null,
                      createdAt: null,
                      updatedAt: null
                    }}
                    quote={showPreview.data}
                    customer={customer}
                    showActions={false}
                  />
                )}
                {showPreview.type === 'proposal' && (
                  <ProposalTemplate 
                    template={{
                      id: 'default-proposal',
                      name: 'Default Proposal Template',
                      type: 'proposal',
                      description: null,
                      isDefault: true,
                      isActive: true,
                      companyName: 'Treemarkables',
                      companyAddress: 'Gisborne, New Zealand',
                      companyEmail: 'info@treemarkables.co.nz',
                      companyPhone: '+64 6 867 1234',
                      gstNumber: 'GST123456789',
                      paymentTerms: '30 days',
                      primaryColor: '#f97316',
                      secondaryColor: '#3b82f6',
                      logoUrl: null,
                      headerLayout: null,
                      footerText: null,
                      createdAt: null,
                      updatedAt: null
                    }}
                    proposal={showPreview.data}
                    customer={customer}
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