import React, { useState, useEffect } from "react";
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
  Check
} from "lucide-react";

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  job?: any;
  customer?: any;
  invoiceData?: any;
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
  }
];

export function EmailComposerModal({ 
  isOpen, 
  onClose, 
  job, 
  customer, 
  invoiceData 
}: EmailComposerModalProps) {
  const [emailData, setEmailData] = useState({
    to: "",
    cc: "",
    subject: "",
    body: "",
    selectedTemplate: ""
  });
  const [attachments, setAttachments] = useState<string[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch job photos for Smart Attachments
  const { data: jobPhotos } = useQuery({
    queryKey: ['/api/jobs', job?.id, 'photos'],
    enabled: !!job?.id && isOpen,
  });

  // Pre-populate email data when modal opens
  useEffect(() => {
    if (isOpen && job && customer) {
      const billingEmail = customer.billingContactEmail || customer.email || customer.jobContactEmail;
      const customerName = customer.name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      
      // Auto-attach invoice if available
      if (invoiceData) {
        setAttachments([`Treemarkables LTD Invoice ${invoiceData.invoiceNumber}`]);
      }

      // Apply default invoice template
      const template = EMAIL_TEMPLATES[0]; // Invoice delivery template
      const populatedSubject = template.subject
        .replace("{jobNumber}", job.jobNumber || "")
        .replace("{customerAddress}", job.address || "");
      
      const populatedBody = template.body
        .replace("{customerName}", customerName || "Valued Customer")
        .replace("{jobDescription}", job.description || job.title || "tree service")
        .replace("{invoiceLink}", invoiceData?.id ? `${window.location.origin}/invoice/${invoiceData.id}` : "View invoice in your customer portal")
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
  }, [isOpen, job, customer, invoiceData]);

  // Handle photo selection for email attachments
  const togglePhotoSelection = (photoUrl: string) => {
    setSelectedPhotos(prev => 
      prev.includes(photoUrl) 
        ? prev.filter(url => url !== photoUrl)
        : [...prev, photoUrl]
    );
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
      .replace("{invoiceNumber}", invoiceData?.invoiceNumber || "");
    
    const populatedBody = template.body
      .replace("{customerName}", customerName || "Valued Customer")
      .replace("{jobDescription}", job?.description || job?.title || "tree service")
      .replace("{invoiceLink}", invoiceData?.id ? `${window.location.origin}/invoice/${invoiceData.id}` : "View invoice in your customer portal")
      .replace("{contactName}", "Treemarkables Team")
      .replace("{contactPhone}", customer?.jobContactPhone || customer?.billingContactPhone || "027-XXX-XXXX")
      .replace("{companySignature}", "\n\nTreemarkables LTD\nCertified Arborists\nGisborne, New Zealand\nPhone: 027-XXX-XXXX\nEmail: info@treemarkables.co.nz")
      .replace("{invoiceAmount}", invoiceData?.amount ? `$${invoiceData.amount}` : "$0.00")
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
      attachments: attachments,
      selectedPhotos: selectedPhotos,
      jobId: job?.id,
      customerId: customer?.id,
      invoiceId: invoiceData?.id
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
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-row items-center justify-between space-y-0 pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">New Email</DialogTitle>
          <div className="flex items-center gap-2">
            <Select value={emailData.selectedTemplate} onValueChange={handleTemplateSelect}>
              <SelectTrigger className="w-48">
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
            <Button 
              onClick={() => {}} 
              variant="outline" 
              size="sm"
              data-testid="button-attach-file"
            >
              <Paperclip className="w-4 h-4 mr-2" />
              Attach File
            </Button>
            <Button 
              onClick={handleSendEmail}
              disabled={sendEmailMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-send-email"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendEmailMutation.isPending ? 'Sending...' : 'Send'}
            </Button>
            <Button 
              onClick={onClose} 
              variant="ghost" 
              size="sm"
              data-testid="button-close-email"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Email Fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3 items-center">
              <Label htmlFor="email-to" className="col-span-1 text-right">To:</Label>
              <Input
                id="email-to"
                name="email-to"
                value={emailData.to}
                onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                className="col-span-11"
                placeholder="recipient@email.com"
                data-testid="input-email-to"
              />
            </div>
            
            <div className="grid grid-cols-12 gap-3 items-center">
              <Label htmlFor="email-cc" className="col-span-1 text-right">CC:</Label>
              <Input
                id="email-cc"
                name="email-cc"
                value={emailData.cc}
                onChange={(e) => setEmailData(prev => ({ ...prev, cc: e.target.value }))}
                className="col-span-11"
                placeholder="cc@email.com (optional)"
                data-testid="input-email-cc"
              />
            </div>

            <div className="grid grid-cols-12 gap-3 items-center">
              <Label htmlFor="email-subject" className="col-span-1 text-right">Subject:</Label>
              <Input
                id="email-subject"
                name="email-subject"
                value={emailData.subject}
                onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                className="col-span-11"
                data-testid="input-email-subject"
              />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="grid grid-cols-12 gap-3 items-center">
                <Label className="col-span-1 text-right">Attached:</Label>
                <div className="col-span-11 flex gap-2">
                  {attachments.map((attachment, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {attachment}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Smart Attachments Section */}
          <div className="border rounded-lg bg-gray-50 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Smart Attachments</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* Invoice/Quote PDF */}
              {invoiceData && (
                <div 
                  className="relative p-3 border rounded-lg bg-white cursor-pointer hover:bg-gray-50"
                  data-testid="attachment-invoice-pdf"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 bg-red-500 rounded flex items-center justify-center mb-2">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-xs font-medium text-gray-900 mb-1">
                      Quote #{invoiceData.invoiceNumber}
                    </div>
                    <div className="text-xs text-gray-500">
                      for ${invoiceData.amount || '0.00'}
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
                    className="w-full h-16 object-cover rounded mb-1"
                  />
                  <div className="text-xs text-center text-gray-600">Before {index + 1}</div>
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
                    className="w-full h-16 object-cover rounded mb-1"
                  />
                  <div className="text-xs text-center text-gray-600">After {index + 1}</div>
                </div>
              ))}

              {/* Show message when no photos available */}
              {(!jobPhotos?.beforePhotos?.length && !jobPhotos?.afterPhotos?.length && !invoiceData) && (
                <div className="col-span-full text-center py-4 text-gray-500 text-sm">
                  No attachments available for this job
                </div>
              )}
            </div>
          </div>

          {/* Formatting Toolbar */}
          <div className="flex items-center gap-1 p-2 border-b border-gray-200">
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
    </Dialog>
  );
}