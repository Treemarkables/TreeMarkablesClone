import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, Send, X, Loader2, MapPin, Mail, FileText, Plus, Trash2, DollarSign, MessageSquare, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InvoiceTemplate } from '@/components/InvoiceTemplate';
import { EmailComposerModal } from '@/components/EmailComposerModal';
import { SMSComposerModal } from '@/components/SMSComposerModal';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { DocumentTemplate, Customer, Job } from '@shared/schema';

interface InvoiceBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  customer: Customer;
  invoiceTemplate: DocumentTemplate;
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
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

export function InvoiceBuilder({ isOpen, onClose, job, customer, invoiceTemplate }: InvoiceBuilderProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showSmsComposer, setShowSmsComposer] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [existingInvoiceId, setExistingInvoiceId] = useState<string | null>(null);
  
  // Immediate lock to prevent concurrent button clicks (doesn't rely on state updates)
  const isCreatingRef = useRef(false);
  
  // Editable fields
  const [editableAddress, setEditableAddress] = useState('');
  const [editableEmail, setEditableEmail] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

  // Fetch proposals for this job
  const { data: proposalsResponse, isLoading: loadingProposals } = useQuery({
    queryKey: ['/api/proposals', job.id],
    queryFn: async () => {
      const response = await fetch(`/api/proposals?jobId=${job.id}&includeSections=true`);
      if (!response.ok) throw new Error('Failed to fetch proposals');
      return response.json();
    },
    enabled: isOpen
  });

  // Fetch quotes for this job
  const { data: quotesResponse, isLoading: loadingQuotes } = useQuery({
    queryKey: ['/api/quotes', job.id],
    queryFn: async () => {
      const response = await fetch(`/api/quotes?jobId=${job.id}`);
      if (!response.ok) throw new Error('Failed to fetch quotes');
      return response.json();
    },
    enabled: isOpen
  });


  // Initialize fields when modal opens or data loads (only once to prevent overwriting user edits)
  useEffect(() => {
    if (!isOpen || hasInitialized) return;

    // Only initialize if we have the data or if data loading is complete
    const dataLoaded = !loadingProposals && !loadingQuotes;
    if (!dataLoaded) return;

    // Set address and email
    setEditableAddress(job.address || customer.address || '');
    setEditableEmail(customer.email || '');

    // Get proposals and quotes
    const proposals = proposalsResponse?.data || [];
    const quotes = quotesResponse?.data || [];

    // Find accepted proposal or most recent sent proposal
    const acceptedProposal = proposals.find((p: any) => p.status === 'accepted');
    const sentProposal = proposals.find((p: any) => p.status === 'sent');
    const proposal = acceptedProposal || sentProposal || proposals[0];

    // Find accepted or sent quote
    const acceptedQuote = quotes.find((q: any) => q.status === 'accepted');
    const sentQuote = quotes.find((q: any) => q.status === 'sent');
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
              description: item.description || '',
              quantity: item.quantity || 1,
              unitPrice: parseFloat(item.rate || item.unitPrice || 0),
              total: parseFloat(item.total || item.amount || 0)
            });
          });
        }
      });
    }

    // If proposal had no line items, fall back to quote
    if (extractedItems.length === 0 && quote?.lineItems && Array.isArray(quote.lineItems)) {
      quote.lineItems.forEach((item: any) => {
        extractedItems.push({
          id: Math.random().toString(),
          description: item.description || '',
          quantity: item.quantity || 1,
          unitPrice: parseFloat(item.rate || item.unitPrice || 0),
          total: parseFloat(item.total || item.amount || 0)
        });
      });
    }

    // If still no items, fall back to job line items
    if (extractedItems.length === 0 && job.lineItems && job.lineItems.length > 0) {
      extractedItems = job.lineItems.map((item: any) => ({
        id: item.id || Math.random().toString(),
        description: item.description || '',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        total: item.total || (item.quantity * item.unitPrice) || 0
      }));
    }

    // Final fallback to job total
    if (extractedItems.length === 0) {
      extractedItems = [{
        id: Math.random().toString(),
        description: job.description || 'Tree service',
        quantity: 1,
        unitPrice: parseFloat(job.totalAmount || '0'),
        total: parseFloat(job.totalAmount || '0')
      }];
    }

    setLineItems(extractedItems);

    // Set description from proposal/quote
    if (proposal) {
      setEditableDescription(proposal.introduction || job.description || '');
    } else if (quote) {
      setEditableDescription(quote.description || job.description || '');
    } else {
      setEditableDescription(job.description || '');
    }

    // Mark as initialized to prevent overwriting user edits
    setHasInitialized(true);
  }, [isOpen, hasInitialized, loadingProposals, loadingQuotes, proposalsResponse, quotesResponse, job, customer]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCreatedInvoice(null);
      setExistingInvoiceId(null);
      setIsCreating(false);
      setLineItems([]);
      setHasInitialized(false);
    }
  }, [isOpen]);

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const gst = subtotal * 0.15;
    const total = subtotal + gst;
    return { subtotal, gst, total };
  };

  // Update line item
  const updateLineItem = (id: string, field: keyof InvoiceLineItem, value: any) => {
    setLineItems(items => items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate total if quantity or unitPrice changed
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  // Add new line item
  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: Math.random().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }]);
  };

  // Remove line item
  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  // Import line items from quote or proposal
  const importFromQuoteOrProposal = () => {
    const proposals = proposalsResponse?.data || [];
    const quotes = quotesResponse?.data || [];

    console.log('🔍 Import Debug - Proposals:', proposals);
    console.log('🔍 Import Debug - Quotes:', quotes);

    // Find accepted proposal or most recent sent proposal
    const acceptedProposal = proposals.find((p: any) => p.status === 'accepted');
    const sentProposal = proposals.find((p: any) => p.status === 'sent');
    const proposal = acceptedProposal || sentProposal || proposals[0];

    console.log('🔍 Import Debug - Selected Proposal:', proposal);

    // Find accepted or sent quote
    const acceptedQuote = quotes.find((q: any) => q.status === 'accepted');
    const sentQuote = quotes.find((q: any) => q.status === 'sent');
    const quote = acceptedQuote || sentQuote || quotes[0];

    console.log('🔍 Import Debug - Selected Quote:', quote);

    // Extract line items from proposal or quote
    let extractedItems: InvoiceLineItem[] = [];

    // Check if proposal has direct line items array
    if (proposal?.lineItems && Array.isArray(proposal.lineItems)) {
      console.log('🔍 Import Debug - Found proposal.lineItems:', proposal.lineItems);
      proposal.lineItems.forEach((item: any) => {
        extractedItems.push({
          id: Math.random().toString(),
          description: item.description || '',
          quantity: item.quantity || 1,
          unitPrice: parseFloat(item.unitPrice || 0),
          total: parseFloat(item.totalPrice || item.total || 0)
        });
      });
    }
    // Check if proposal has sections with line items
    else if (proposal?.sections && Array.isArray(proposal.sections)) {
      console.log('🔍 Import Debug - Found proposal.sections:', proposal.sections);
      proposal.sections.forEach((section: any) => {
        if (section.lineItems && Array.isArray(section.lineItems)) {
          section.lineItems.forEach((item: any) => {
            extractedItems.push({
              id: Math.random().toString(),
              description: item.description || '',
              quantity: item.quantity || 1,
              unitPrice: parseFloat(item.unitPrice || 0),
              total: parseFloat(item.totalPrice || item.total || 0)
            });
          });
        }
      });
    }

    // If proposal had no line items, fall back to quote
    if (extractedItems.length === 0 && quote?.lineItems && Array.isArray(quote.lineItems)) {
      console.log('🔍 Import Debug - Using quote.lineItems:', quote.lineItems);
      quote.lineItems.forEach((item: any) => {
        extractedItems.push({
          id: Math.random().toString(),
          description: item.description || '',
          quantity: item.quantity || 1,
          unitPrice: parseFloat(item.rate || item.unitPrice || 0),
          total: parseFloat(item.total || item.amount || 0)
        });
      });
    }

    console.log('🔍 Import Debug - Extracted Items:', extractedItems);

    if (extractedItems.length > 0) {
      setLineItems(extractedItems);
      toast({
        title: "Line Items Imported",
        description: `Imported ${extractedItems.length} line item(s) from ${proposal ? 'proposal' : 'quote'}.`
      });
    } else {
      toast({
        title: "No Items Found",
        description: "No line items found in the quote or proposal for this job.",
        variant: "destructive"
      });
    }
  };

  // Create invoice (shared logic)
  const createInvoice = async () => {
    // Immediate lock check (doesn't rely on state updates)
    if (isCreatingRef.current) {
      console.log('🔒 Invoice creation already in progress (ref lock), skipping...');
      return null;
    }
    
    // Prevent multiple simultaneous creations
    if (isCreating) {
      console.log('🔒 Invoice creation already in progress (state lock), skipping...');
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
        variant: "destructive"
      });
      return null;
    }

    if (lineItems.length === 0 || lineItems.every(item => !item.description.trim())) {
      isCreatingRef.current = false;
      toast({
        title: "Line Items Required",
        description: "Please add at least one line item with a description.",
        variant: "destructive"
      });
      return null;
    }

    setIsCreating(true);
    
    try {
      const formattedLineItems = lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.unitPrice,
        amount: item.total
      }));

      const res = await apiRequest('POST', `/api/jobs/${job.id}/convert-to-invoice`, {
        invoiceType: 'full',
        customData: {
          address: editableAddress,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: job.notes || '',
          description: editableDescription,
          lineItems: formattedLineItems
        }
      });

      const response = await res.json();

      // Handle 409 Conflict - invoice already exists
      if (res.status === 409 && response.invoiceId) {
        console.log('📄 Invoice already exists, using existing ID:', response.invoiceId);
        
        const existingInvoice = {
          id: response.invoiceId,
          invoiceNumber: response.invoiceNumber || 'Unknown'
        };
        
        setCreatedInvoice(existingInvoice);
        setExistingInvoiceId(response.invoiceId);
        
        toast({
          title: "Invoice Already Exists",
          description: `Using existing invoice ${response.invoiceNumber || 'for this job'}.`
        });

        return existingInvoice;
      }

      if (response.success) {
        setCreatedInvoice(response.data);
        
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/invoices`] });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', job.id, 'diary-timeline'] });
        
        toast({
          title: "Invoice Created",
          description: `Invoice ${response.data.invoiceNumber} created successfully.`
        });

        return response.data;
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to create invoice.",
          variant: "destructive"
        });
        return null;
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  };

  // Save invoice only
  const handleSaveInvoice = async (e?: React.MouseEvent) => {
    console.log('🎯 SAVE INVOICE CLICKED');
    e?.preventDefault();
    e?.stopPropagation();
    
    // Immediate lock check
    if (isCreatingRef.current) {
      console.log('🔒 Save blocked: invoice creation in progress');
      return;
    }
    
    // Prevent execution if already creating
    if (isCreating) return;
    
    // If invoice already created, just close
    if (createdInvoice) {
      handleClose();
      return;
    }
    
    const invoice = await createInvoice();
    if (invoice) {
      handleClose();
    }
  };

  // Create and send invoice
  const handleSendInvoice = async (e?: React.MouseEvent) => {
    console.log('🎯 SEND INVOICE CLICKED');
    e?.preventDefault();
    e?.stopPropagation();
    
    // Immediate lock check
    if (isCreatingRef.current) {
      console.log('🔒 Send blocked: invoice creation in progress');
      return;
    }
    
    // Prevent execution if already creating
    if (isCreating) return;
    
    // If invoice already created, just open email composer
    if (createdInvoice) {
      console.log('📧 Invoice already exists, opening email composer');
      setShowEmailComposer(true);
      return;
    }
    
    const invoice = await createInvoice();
    if (invoice) {
      console.log('📧 Invoice created successfully, opening email composer');
      setShowEmailComposer(true);
    } else {
      console.log('❌ Failed to create invoice, not opening composer');
    }
  };

  // Create and send invoice via SMS
  const handleSmsInvoice = async (e?: React.MouseEvent) => {
    console.log('🎯 SMS INVOICE CLICKED');
    e?.preventDefault();
    e?.stopPropagation();
    
    // Immediate lock check
    if (isCreatingRef.current) {
      console.log('🔒 SMS blocked: invoice creation in progress');
      return;
    }
    
    // Prevent execution if already creating
    if (isCreating) return;
    
    // If invoice already created, just open SMS composer
    if (createdInvoice) {
      setShowSmsComposer(true);
      return;
    }
    
    const invoice = await createInvoice();
    if (invoice) {
      setShowSmsComposer(true);
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
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Create Invoice from {proposalsResponse?.data?.find((p: any) => p.status === 'accepted' || p.status === 'sent') ? 'Proposal' : quotesResponse?.data?.find((q: any) => q.status === 'accepted' || q.status === 'sent') ? 'Quote' : 'Job'}</span>
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
              <span className="ml-3 text-gray-600">Loading invoice data...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Editable Fields Section */}
              <div className="space-y-4 bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Details (Editable)
                </h3>

                {/* Address */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    Service Address
                  </Label>
                  <Input
                    value={editableAddress}
                    onChange={(e) => setEditableAddress(e.target.value)}
                    placeholder="Enter service address"
                    className="bg-white"
                    data-testid="input-invoice-address"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-blue-600" />
                    Customer Email
                  </Label>
                  <Input
                    type="email"
                    value={editableEmail}
                    onChange={(e) => setEditableEmail(e.target.value)}
                    placeholder="Enter customer email"
                    className="bg-white"
                    data-testid="input-invoice-email"
                  />
                </div>

                {/* Description */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Description</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={importFromQuoteOrProposal}
                        disabled={loadingProposals || loadingQuotes}
                        data-testid="button-import-from-quote"
                      >
                        <FileDown className="h-4 w-4 mr-1" />
                        Import from Quote/Proposal
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addLineItem}
                        data-testid="button-add-line-item"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Item
                      </Button>
                    </div>
                  </div>
                  
                  <Textarea
                    value={editableDescription}
                    onChange={(e) => setEditableDescription(e.target.value)}
                    placeholder="Enter invoice description"
                    className="bg-white min-h-[80px]"
                    data-testid="input-invoice-description"
                  />

                  <div className="space-y-2">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded border">
                        <div className="col-span-5">
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            placeholder="Description"
                            className="text-sm"
                            data-testid={`input-item-description-${index}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            placeholder="Qty"
                            className="text-sm"
                            data-testid={`input-item-quantity-${index}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            placeholder="Price"
                            className="text-sm"
                            data-testid={`input-item-price-${index}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <div className="text-sm font-medium text-gray-700">
                            ${item.total.toFixed(2)}
                          </div>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {lineItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(item.id)}
                              className="h-8 w-8"
                              data-testid={`button-remove-item-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="bg-white p-4 rounded border space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal (excl GST):</span>
                      <span className="font-medium">${subtotal.toFixed(2)}</span>
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
              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveInvoice}
                  disabled={isCreating}
                  variant="outline"
                  data-testid="button-save-invoice"
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
                <Button
                  type="button"
                  onClick={handleSmsInvoice}
                  disabled={isCreating}
                  variant="outline"
                  data-testid="button-sms-invoice-builder"
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
                  className="bg-blue-600 hover:bg-blue-700"
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

              {/* Preview Section */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Preview</h3>
                <div className="border rounded-lg p-6 bg-white">
                  <InvoiceTemplate
                    invoice={{
                      id: job.id,
                      invoiceNumber: `INV-Preview`,
                      customerId: customer.id,
                      jobId: job.id,
                      amount: subtotal.toString(),
                      status: 'draft' as const,
                      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                      issueDate: new Date().toISOString(),
                      items: lineItems.map(item => ({
                        description: item.description,
                        quantity: item.quantity,
                        rate: item.unitPrice,
                        amount: item.total
                      })),
                      address: editableAddress,
                      customer,
                      job
                    }}
                    customer={customer}
                    job={job}
                    jobAddress={editableAddress}
                    template={invoiceTemplate}
                    lineItems={lineItems}
                    description={editableDescription}
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
          customer={customer}
          customEmail={editableEmail}
          invoiceData={{
            id: createdInvoice.id,
            invoiceNumber: createdInvoice.invoiceNumber,
            amount: createdInvoice.amount,
            dueDate: createdInvoice.dueDate
          }}
          templateType="invoice"
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
            dueDate: createdInvoice.dueDate
          }}
          templateType="invoice"
        />
      )}
    </>
  );
}
