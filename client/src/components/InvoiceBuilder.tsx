import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, X, Plus, Trash2, Calendar, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InvoiceTemplate } from '@/components/InvoiceTemplate';
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

export function InvoiceBuilder({ isOpen, onClose, job, customer, invoiceTemplate }: InvoiceBuilderProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize line items from job
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(() => {
    if (job.lineItems && job.lineItems.length > 0) {
      return job.lineItems.map((item: any) => ({
        id: item.id || Math.random().toString(),
        description: item.description || '',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        total: item.total || (item.quantity * item.unitPrice) || 0
      }));
    }
    return [{
      id: Math.random().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }];
  });

  // Invoice data
  const [invoiceData, setInvoiceData] = useState({
    address: job.address || customer.address || '',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    notes: job.notes || '',
    description: job.description || `Invoice for ${job.title || 'tree service'}`
  });

  // Calculate total
  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
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
    setLineItems(items => [...items, {
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
      setLineItems(items => items.filter(item => item.id !== id));
    }
  };

  // Create invoice
  const handleCreateInvoice = async () => {
    // Validate
    if (!invoiceData.address.trim()) {
      toast({
        title: "Address Required",
        description: "Please enter a service address for the invoice.",
        variant: "destructive"
      });
      return;
    }

    if (lineItems.length === 0 || lineItems.every(item => !item.description.trim())) {
      toast({
        title: "Line Items Required",
        description: "Please add at least one line item.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create invoice
      const response = await apiRequest('POST', `/api/jobs/${job.id}/convert-to-invoice`, {
        invoiceType: 'full',
        customData: {
          address: invoiceData.address,
          dueDate: invoiceData.dueDate,
          notes: invoiceData.notes,
          description: invoiceData.description,
          lineItems: lineItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            rate: item.unitPrice,
            amount: item.total
          }))
        }
      });

      if (response.success) {
        toast({
          title: "Invoice Created",
          description: "Invoice has been created successfully."
        });
        
        // Invalidate queries to refresh data
        await queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        await queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/invoices`] });
        await queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
        
        onClose();
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview invoice data
  const previewInvoice = {
    id: job.id,
    invoiceNumber: `INV-${job.jobNumber || '0000'}`,
    customerId: customer.id,
    amount: calculateTotal(),
    status: 'draft' as const,
    dueDate: new Date(invoiceData.dueDate).toISOString(),
    issueDate: new Date().toISOString(),
    paymentTerms: invoiceTemplate?.paymentTerms || 'Payment due within 30 days',
    notes: invoiceData.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-7xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Create Invoice</h2>
              <p className="text-sm text-muted-foreground">
                Review and edit invoice details before creating
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              data-testid="button-close-invoice-builder"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
          {/* Left side - Editor */}
          <div className="w-full sm:w-1/2 p-4 overflow-y-auto border-b sm:border-b-0 sm:border-r">
            <div className="space-y-4">
              {/* Address */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Service Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={invoiceData.address}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter service address..."
                    className="min-h-[80px]"
                    data-testid="textarea-invoice-address"
                  />
                </CardContent>
              </Card>

              {/* Due Date */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Due Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    type="date"
                    value={invoiceData.dueDate}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, dueDate: e.target.value }))}
                    data-testid="input-invoice-due-date"
                  />
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Line Items</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addLineItem}
                      data-testid="button-add-line-item"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Item {index + 1}</span>
                        {lineItems.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(item.id)}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            placeholder="Item description..."
                            data-testid={`input-item-description-${index}`}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              data-testid={`input-item-quantity-${index}`}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Price</Label>
                            <Input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              data-testid={`input-item-unit-price-${index}`}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Total</Label>
                            <Input
                              type="number"
                              value={item.total}
                              readOnly
                              className="bg-muted"
                              data-testid={`input-item-total-${index}`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center font-semibold">
                      <span>Subtotal (ex GST):</span>
                      <span data-testid="text-invoice-subtotal">
                        ${calculateTotal().toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>GST (15%):</span>
                      <span>${(calculateTotal() * 0.15).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold mt-1">
                      <span>Total (inc GST):</span>
                      <span data-testid="text-invoice-total">
                        ${(calculateTotal() * 1.15).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={invoiceData.notes}
                    onChange={(e) => setInvoiceData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any additional notes or payment instructions..."
                    className="min-h-[80px]"
                    data-testid="textarea-invoice-notes"
                  />
                </CardContent>
              </Card>

              {/* Create Button */}
              <Button
                onClick={handleCreateInvoice}
                disabled={isSubmitting}
                className="w-full"
                size="lg"
                data-testid="button-create-invoice"
              >
                {isSubmitting ? (
                  <>Creating Invoice...</>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Invoice
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Right side - Preview */}
          <div className="w-full sm:w-1/2 p-4 overflow-y-auto bg-muted/30">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Preview</h3>
            </div>
            <InvoiceTemplate
              template={invoiceTemplate}
              invoice={previewInvoice}
              customer={customer}
              jobAddress={invoiceData.address}
              description={invoiceData.description}
              lineItems={lineItems.map(item => ({
                ...item,
                unit: 'each',
                category: 'service',
                taxable: true
              }))}
              showActions={false}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
