import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, Mail, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InvoiceTemplate } from '@/components/InvoiceTemplate';
import { EmailComposerModal } from '@/components/EmailComposerModal';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { DocumentTemplate, Customer, Job } from '@shared/schema';

interface InvoiceBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job;
  customer: Customer;
  invoiceTemplate: DocumentTemplate;
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

  // Auto-create invoice when modal opens
  useEffect(() => {
    if (isOpen && !createdInvoice && !isCreating) {
      createInvoice();
    }
  }, [isOpen]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCreatedInvoice(null);
      setIsCreating(false);
    }
  }, [isOpen]);

  const createInvoice = async () => {
    setIsCreating(true);
    
    try {
      // Use job's line items or create a simple default
      const lineItems = job.lineItems && job.lineItems.length > 0 
        ? job.lineItems.map((item: any) => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            rate: item.unitPrice || 0,
            amount: item.total || (item.quantity * item.unitPrice) || 0
          }))
        : [{
            description: job.description || 'Tree service',
            quantity: 1,
            rate: parseFloat(job.totalAmount || '0'),
            amount: parseFloat(job.totalAmount || '0')
          }];

      const res = await apiRequest('POST', `/api/jobs/${job.id}/convert-to-invoice`, {
        invoiceType: 'full',
        customData: {
          address: job.address || customer.address || '',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: job.notes || '',
          description: job.description || `Invoice for ${job.title || 'tree service'}`,
          lineItems
        }
      });

      const response = await res.json();

      if (response.success) {
        setCreatedInvoice(response.data);
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/invoices`] });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', job.id, 'diary-timeline'] });
        
        toast({
          title: "Invoice Created",
          description: `Invoice ${response.data.invoiceNumber} created successfully.`
        });
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to create invoice.",
          variant: "destructive"
        });
        onClose();
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive"
      });
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendEmail = () => {
    if (createdInvoice) {
      setShowEmailComposer(true);
    }
  };

  const handleClose = () => {
    setCreatedInvoice(null);
    setIsCreating(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Invoice Preview</span>
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

          {isCreating ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Creating invoice...</span>
            </div>
          ) : createdInvoice ? (
            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="flex gap-3 justify-end border-b pb-4">
                <Button
                  onClick={handleSendEmail}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-send-invoice"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invoice
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  data-testid="button-close"
                >
                  Close
                </Button>
              </div>

              {/* Invoice Preview */}
              <div className="border rounded-lg p-6 bg-white">
                <InvoiceTemplate
                  invoice={{
                    ...createdInvoice,
                    customer,
                    job
                  }}
                  customer={customer}
                  job={job}
                  jobAddress={createdInvoice.address || job.address || customer.address || ''}
                  template={invoiceTemplate}
                />
              </div>

              {/* Bottom Actions */}
              <div className="flex gap-3 justify-end border-t pt-4">
                <Button
                  onClick={handleSendEmail}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-send-invoice-bottom"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invoice
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  data-testid="button-close-bottom"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Email Composer Modal */}
      {createdInvoice && (
        <EmailComposerModal
          isOpen={showEmailComposer}
          onClose={() => {
            setShowEmailComposer(false);
            handleClose(); // Close invoice modal after sending
          }}
          job={job}
          customer={customer}
          documentType="invoice"
          documentData={{
            invoiceNumber: createdInvoice.invoiceNumber,
            amount: createdInvoice.amount,
            dueDate: createdInvoice.dueDate
          }}
        />
      )}
    </>
  );
}
