import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { 
  Plus, 
  Edit, 
  Eye, 
  Send, 
  Check, 
  X, 
  Calendar as CalendarIcon,
  DollarSign,
  FileText,
  Trash2,
  Download,
  MoreHorizontal
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Quote, DocumentTemplate, Customer } from '@shared/schema';
import { ProposalGeneration } from '@/components/ProposalGeneration';
import { QuoteTemplate } from '@/components/QuoteTemplate';

// Line item structure for quotes
interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Quote form schema
const quoteFormSchema = z.object({
  leadId: z.string().optional(),
  customerId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  amount: z.string().min(1, 'Amount is required'),
  validUntil: z.date().optional(),
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']),
  terms: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number()
  })).optional()
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

interface QuoteManagementProps {
  compact?: boolean;
}

export default function QuoteManagement({ compact = false }: QuoteManagementProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [previewingQuote, setPreviewingQuote] = useState<Quote | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const { toast } = useToast();

  // Fetch quotes
  const { data: quotes, isLoading } = useQuery({
    queryKey: ['/api/quotes'],
    queryFn: async () => {
      const response = await fetch('/api/quotes');
      const result = await response.json();
      return result.data as Quote[];
    }
  });

  // Fetch leads and customers for quote creation
  const { data: leads } = useQuery({
    queryKey: ['/api/leads'],
    queryFn: async () => {
      const response = await fetch('/api/leads');
      const result = await response.json();
      return Array.isArray(result.data) ? result.data : [];
    }
  });

  const { data: customers } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: async () => {
      const response = await fetch('/api/customers');
      const result = await response.json();
      return Array.isArray(result.data) ? result.data : [];
    }
  });

  // Fetch quote templates
  const { data: templates } = useQuery({
    queryKey: ['/api/templates'],
    queryFn: async () => {
      const response = await fetch('/api/templates?type=quote');
      const result = await response.json();
      return Array.isArray(result.data) ? result.data : [];
    }
  });

  // Get default quote template or first available template
  const defaultTemplate = templates?.find((t: DocumentTemplate) => t.isDefault && t.type === 'quote') || templates?.[0];

  // Create quote mutation
  const createQuoteMutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      // Calculate amount from line items if not provided or if line items exist
      const calculatedAmount = lineItems.length > 0 ? calculateTotal() : parseFloat(data.amount || '0');
      
      const quoteData = {
        ...data,
        quoteNumber: `Q-${Date.now()}`,
        amount: calculatedAmount.toString(),
        lineItems: lineItems.length > 0 ? lineItems : undefined
      };
      
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create quote');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Quote created successfully'
      });
    },
    onError: (error: any) => {
      console.error('Quote creation error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create quote',
        variant: 'destructive'
      });
    }
  });

  // Update quote mutation
  const updateQuoteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<QuoteFormData> }) => {
      const response = await fetch(`/api/quotes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          amount: data.amount ? parseFloat(data.amount) : undefined
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      setEditingQuote(null);
      toast({
        title: 'Success',
        description: 'Quote updated successfully'
      });
    }
  });

  // Convert to job mutation  
  const convertToJobMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await fetch(`/api/quotes/${quoteId}/convert-to-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: 'Success',
        description: 'Quote converted to job successfully'
      });
    }
  });

  // Form setup
  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      status: 'draft',
      description: '',
      amount: '',
      terms: ''
    }
  });

  const resetForm = () => {
    form.reset();
    setLineItems([]);
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Auto-calculate total
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.total, 0);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: 'outline' as const, label: 'Draft', className: '' },
      sent: { variant: 'default' as const, label: 'Sent', className: '' },
      viewed: { variant: 'secondary' as const, label: 'Viewed', className: '' },
      accepted: { variant: 'default' as const, label: 'Accepted', className: 'bg-green-500' },
      rejected: { variant: 'destructive' as const, label: 'Rejected', className: '' },
      expired: { variant: 'outline' as const, label: 'Expired', className: '' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const onSubmit = (data: QuoteFormData) => {
    if (editingQuote) {
      updateQuoteMutation.mutate({ id: editingQuote.id, data });
    } else {
      // Update amount with calculated total if line items exist
      if (lineItems.length > 0) {
        data.amount = calculateTotal().toString();
      }
      createQuoteMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading quotes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quote Management</h2>
          <p className="text-muted-foreground">Create and manage customer quotes</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-quote">
              <Plus className="w-4 h-4 mr-2" />
              Create Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingQuote ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="leadId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-lead">
                              <SelectValue placeholder="Select lead" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(leads) && leads.length > 0 ? leads.map((lead: any) => (
                              <SelectItem key={lead.id} value={lead.id}>
                                {lead.name}
                              </SelectItem>
                            )) : (
                              <SelectItem value="no-leads" disabled>
                                No leads available
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="sent">Sent</SelectItem>
                            <SelectItem value="viewed">Viewed</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                          </SelectContent>
                        </Select>
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
                          placeholder="Quote description..." 
                          {...field}
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Line Items Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Line Items</Label>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={addLineItem}
                      data-testid="button-add-line-item"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </Button>
                  </div>

                  {lineItems.length > 0 && (
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-24">Qty</TableHead>
                            <TableHead className="w-32">Unit Price</TableHead>
                            <TableHead className="w-32">Total</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Input
                                  value={item.description}
                                  onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                                  placeholder="Item description"
                                  data-testid={`input-line-item-description-${item.id}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                  data-testid={`input-line-item-quantity-${item.id}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  data-testid={`input-line-item-price-${item.id}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="font-medium" data-testid={`text-line-item-total-${item.id}`}>
                                  ${item.total.toFixed(2)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeLineItem(item.id)}
                                  data-testid={`button-remove-line-item-${item.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {lineItems.length > 0 && (
                        <div className="p-4 border-t bg-muted/50">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">Total:</span>
                            <span className="text-lg font-bold" data-testid="text-quote-total">
                              ${calculateTotal().toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {lineItems.length === 0 && (
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            {...field}
                            data-testid="input-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terms & Conditions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Terms and conditions..." 
                          {...field}
                          data-testid="input-terms"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setEditingQuote(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createQuoteMutation.isPending || updateQuoteMutation.isPending}
                    data-testid="button-save-quote"
                  >
                    {editingQuote ? 'Update Quote' : 'Create Quote'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quotes List */}
      <Card>
        <CardHeader>
          <CardTitle>All Quotes</CardTitle>
        </CardHeader>
        <CardContent>
          {quotes && quotes.length > 0 ? (
            <div className="space-y-4">
              {quotes.map((quote) => (
                <div 
                  key={quote.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`quote-card-${quote.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium" data-testid={`quote-number-${quote.id}`}>
                        {quote.quoteNumber}
                      </h4>
                      {getStatusBadge(quote.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1" data-testid={`quote-description-${quote.id}`}>
                      {quote.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(quote.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <div className="text-xl font-bold" data-testid={`quote-amount-${quote.id}`}>
                      ${parseFloat(quote.amount).toLocaleString()}
                    </div>
                    <div className="space-x-2">
                      <ProposalGeneration 
                        quoteId={quote.id}
                        customerId={quote.customerId || undefined}
                        onProposalCreated={(proposal) => {
                          toast({
                            title: "Success",
                            description: `Proposal ${proposal.proposalNumber} created successfully`,
                          });
                        }}
                      />
                      {quote.status === 'accepted' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => convertToJobMutation.mutate(quote.id)}
                          disabled={convertToJobMutation.isPending}
                          data-testid={`button-convert-to-job-${quote.id}`}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Convert to Job
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewingQuote(quote)}
                        data-testid={`button-preview-quote-${quote.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingQuote(quote);
                          setIsCreateDialogOpen(true);
                          form.reset({
                            description: quote.description,
                            amount: quote.amount,
                            status: quote.status as any,
                            terms: quote.terms || ''
                          });
                        }}
                        data-testid={`button-edit-quote-${quote.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4" />
              <p data-testid="text-no-quotes">No quotes found</p>
              <p className="text-sm">Create your first quote to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Preview Dialog */}
      {previewingQuote && defaultTemplate && (
        <Dialog open={!!previewingQuote} onOpenChange={() => setPreviewingQuote(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quote Preview - #{previewingQuote.quoteNumber}</DialogTitle>
            </DialogHeader>
            <QuoteTemplate
              template={defaultTemplate}
              quote={previewingQuote}
              customer={Array.isArray(customers) ? customers.find((c: Customer) => c.id === previewingQuote.customerId) : undefined}
              lineItems={previewingQuote.lineItems ? JSON.parse(JSON.stringify(previewingQuote.lineItems)) : []}
              showActions={true}
              onEmail={() => {
                toast({
                  title: "Email Functionality",
                  description: "Email functionality will be implemented next.",
                });
              }}
              onDownload={() => {
                toast({
                  title: "PDF Generation",
                  description: "PDF generation functionality will be implemented next.",
                });
              }}
              onCopy={() => {
                toast({
                  title: "Quote Copied",
                  description: "Quote template copied to clipboard.",
                });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}