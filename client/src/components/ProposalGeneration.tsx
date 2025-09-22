import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Plus, 
  Edit, 
  Eye, 
  Send, 
  Check, 
  X, 
  FileText,
  Trash2,
  Download,
  MoreHorizontal,
  DragVertical,
  Upload,
  GripVertical,
  Image,
  Type,
  DollarSign,
  Package,
  ShoppingCart
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Quote, JobTemplate, Proposal, ProposalSection, ProposalLineItem } from '@shared/schema';

// Line item source types
type LineItemSource = 'quote' | 'template' | 'fixed';

interface LineItemFormData {
  sourceType: LineItemSource;
  sourceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  category?: string;
  notes?: string;
  isOptional: boolean;
}

// Proposal generation form schema
const proposalGenerationSchema = z.object({
  quoteId: z.string().min(1, 'Quote is required'),
  customerId: z.string().min(1, 'Customer is required'),
  title: z.string().min(1, 'Title is required'),
  introduction: z.string().optional(),
  conclusion: z.string().optional(),
  deliveryMethod: z.enum(['email', 'sms', 'portal', 'print']).default('email'),
  expiryDays: z.number().min(1).max(365).default(30),
});

type ProposalGenerationFormData = z.infer<typeof proposalGenerationSchema>;

interface ProposalGenerationProps {
  quoteId?: string;
  customerId?: string;
  onProposalCreated?: (proposal: Proposal) => void;
}

export function ProposalGeneration({ 
  quoteId, 
  customerId, 
  onProposalCreated 
}: ProposalGenerationProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLineItems, setSelectedLineItems] = useState<ProposalLineItem[]>([]);
  const [proposalSections, setProposalSections] = useState<ProposalSection[]>([]);
  const [activeTab, setActiveTab] = useState('basic');

  // Form setup
  const form = useForm<ProposalGenerationFormData>({
    resolver: zodResolver(proposalGenerationSchema),
    defaultValues: {
      quoteId: quoteId || '',
      customerId: customerId || '',
      title: '',
      introduction: '',
      conclusion: '',
      deliveryMethod: 'email',
      expiryDays: 30,
    },
  });

  // Fetch quote data for line item selection
  const { data: quote } = useQuery({
    queryKey: ['/api/quotes', quoteId],
    enabled: !!quoteId,
  });

  // Fetch job templates for line item templates
  const { data: jobTemplatesResponse } = useQuery<{ success: boolean; data: JobTemplate[] }>({
    queryKey: ['/api/job-templates'],
  });

  const jobTemplates = jobTemplatesResponse?.data || [];

  // Create proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: async (data: ProposalGenerationFormData) => {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + data.expiryDays);

      const proposalData = {
        quoteId: data.quoteId,
        customerId: data.customerId,
        proposalNumber: `PROP-${Date.now()}`,
        title: data.title,
        introduction: data.introduction,
        conclusion: data.conclusion,
        deliveryMethod: data.deliveryMethod,
        expiryDate: expiryDate,
        createdBy: 'current-user', // TODO: Get from auth context
      };

      // Create the proposal first
      const proposalResponse = await apiRequest('POST', '/api/proposals', proposalData);
      const proposalResult = await proposalResponse.json();
      
      if (!proposalResult.success) {
        throw new Error('Failed to create proposal');
      }

      const proposalId = proposalResult.data.id;

      // Save all selected line items
      const lineItemPromises = selectedLineItems.map(async (item) => {
        const lineItemData = {
          proposalId,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          totalPrice: (item.quantity * item.unitPrice).toString(), // Compute server-side
          unit: item.unit,
          category: item.category,
          notes: item.notes,
          sortOrder: item.sortOrder,
          isOptional: item.isOptional,
        };
        
        const response = await apiRequest('POST', `/api/proposals/${proposalId}/lineitems`, lineItemData);
        return response.json();
      });

      await Promise.all(lineItemPromises);

      return proposalResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Proposal Created",
          description: `Proposal ${result.data.proposalNumber} with ${selectedLineItems.length} line items created successfully.`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
        onProposalCreated?.(result.data);
        
        // Reset form state
        setSelectedLineItems([]);
        setProposalSections([]);
        setIsDialogOpen(false);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create proposal. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Add line item from quote
  const addQuoteLineItem = (quoteLineItem: any) => {
    const newItem: ProposalLineItem = {
      id: `temp-${Date.now()}`,
      proposalId: '', // Will be set when proposal is created
      sourceType: 'quote',
      sourceId: quoteLineItem.id,
      description: quoteLineItem.description,
      quantity: quoteLineItem.quantity,
      unitPrice: quoteLineItem.unitPrice,
      totalPrice: quoteLineItem.total,
      unit: 'each',
      category: 'service',
      notes: '',
      sortOrder: selectedLineItems.length + 1,
      isOptional: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSelectedLineItems([...selectedLineItems, newItem]);
  };

  // Add line item from template
  const addTemplateLineItem = (template: JobTemplate) => {
    const unitPrice = parseFloat(template.basePrice || '0');
    const quantity = 1;
    
    const newItem: ProposalLineItem = {
      id: `temp-${Date.now()}`,
      proposalId: '',
      sourceType: 'template',
      sourceId: template.id,
      description: `${template.name} - ${template.description}`,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      unit: 'hours',
      category: template.category,
      notes: `Estimated duration: ${template.estimatedDuration} hours`,
      sortOrder: selectedLineItems.length + 1,
      isOptional: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSelectedLineItems([...selectedLineItems, newItem]);
  };

  // Add fixed/custom line item
  const addFixedLineItem = (itemData: LineItemFormData) => {
    const totalPrice = itemData.quantity * itemData.unitPrice;
    
    const newItem: ProposalLineItem = {
      id: `temp-${Date.now()}`,
      proposalId: '',
      sourceType: 'fixed',
      sourceId: null,
      description: itemData.description,
      quantity: itemData.quantity,
      unitPrice: itemData.unitPrice,
      totalPrice,
      unit: itemData.unit,
      category: itemData.category,
      notes: itemData.notes,
      sortOrder: selectedLineItems.length + 1,
      isOptional: itemData.isOptional,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSelectedLineItems([...selectedLineItems, newItem]);
  };

  // Remove line item
  const removeLineItem = (itemId: string) => {
    setSelectedLineItems(selectedLineItems.filter(item => item.id !== itemId));
  };

  // Calculate totals
  const subtotal = selectedLineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = subtotal * 0.15; // 15% GST
  const total = subtotal + tax;

  const onSubmit = (data: ProposalGenerationFormData) => {
    createProposalMutation.mutate(data);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2"
          data-testid="button-generate-proposal"
        >
          <FileText className="h-4 w-4" />
          Generate Proposal
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Professional Proposal</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic" data-testid="tab-proposal-basic">Basic Info</TabsTrigger>
                <TabsTrigger value="lineitems" data-testid="tab-proposal-lineitems">Line Items</TabsTrigger>
                <TabsTrigger value="sections" data-testid="tab-proposal-sections">Sections</TabsTrigger>
                <TabsTrigger value="preview" data-testid="tab-proposal-preview">Preview</TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proposal Title</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Professional Tree Services Proposal"
                            data-testid="input-proposal-title"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-delivery-method">
                              <SelectValue placeholder="Select delivery method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="portal">Customer Portal</SelectItem>
                            <SelectItem value="print">Print</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="introduction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Introduction</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Thank you for considering our professional tree services..."
                          data-testid="textarea-proposal-introduction"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="conclusion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conclusion</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="We look forward to working with you..."
                          data-testid="textarea-proposal-conclusion"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Line Items Tab */}
              <TabsContent value="lineitems" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {/* Quote Line Items */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        From Quote
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {quote?.items?.map((item: any, index: number) => (
                        <div 
                          key={index} 
                          className="p-3 border rounded-lg hover-elevate cursor-pointer"
                          onClick={() => addQuoteLineItem(item)}
                          data-testid={`quote-item-${index}`}
                        >
                          <div className="font-medium text-sm">{item.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.quantity} × ${item.unitPrice} = ${item.total}
                          </div>
                        </div>
                      )) || (
                        <div className="text-sm text-muted-foreground">No quote items available</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Template Line Items */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        From Templates
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {jobTemplates.map((template) => (
                        <div 
                          key={template.id} 
                          className="p-3 border rounded-lg hover-elevate cursor-pointer"
                          onClick={() => addTemplateLineItem(template)}
                          data-testid={`template-item-${template.id}`}
                        >
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ${template.basePrice} • {template.estimatedDuration}h
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Custom Line Item */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Custom Item
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CustomLineItemForm onAdd={addFixedLineItem} />
                    </CardContent>
                  </Card>
                </div>

                {/* Selected Line Items */}
                <Card>
                  <CardHeader>
                    <CardTitle>Selected Line Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedLineItems.length > 0 ? (
                      <div className="space-y-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedLineItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.description}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>${item.unitPrice.toFixed(2)}</TableCell>
                                <TableCell>${item.totalPrice.toFixed(2)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{item.sourceType}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => removeLineItem(item.id)}
                                    data-testid={`remove-item-${item.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        <div className="border-t pt-4 space-y-2">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>${subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>GST (15%):</span>
                            <span>${tax.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-lg">
                            <span>Total:</span>
                            <span>${total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No line items selected. Add items from the sections above.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sections Tab */}
              <TabsContent value="sections" className="space-y-4">
                <div className="text-center text-muted-foreground py-8">
                  Visual sections editor will be implemented in the next step.
                  This will allow adding custom sections, images, and formatting.
                </div>
              </TabsContent>

              {/* Preview Tab */}
              <TabsContent value="preview" className="space-y-4">
                <div className="text-center text-muted-foreground py-8">
                  Professional proposal preview will be shown here.
                  This will display the formatted proposal as it will appear to customers.
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between pt-6 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                data-testid="button-cancel-proposal"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createProposalMutation.isPending || selectedLineItems.length === 0}
                data-testid="button-create-proposal"
              >
                {createProposalMutation.isPending ? "Creating..." : "Create Proposal"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Custom Line Item Form Component
function CustomLineItemForm({ onAdd }: { onAdd: (item: LineItemFormData) => void }) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [unit, setUnit] = useState('each');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [isOptional, setIsOptional] = useState(false);

  const handleAdd = () => {
    if (!description || quantity <= 0 || unitPrice <= 0) return;

    onAdd({
      sourceType: 'fixed',
      description,
      quantity,
      unitPrice,
      unit,
      category,
      notes,
      isOptional,
    });

    // Reset form
    setDescription('');
    setQuantity(1);
    setUnitPrice(0);
    setUnit('each');
    setCategory('');
    setNotes('');
    setIsOptional(false);
  };

  return (
    <div className="space-y-3">
      <Input
        placeholder="Item description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        data-testid="input-custom-description"
      />
      
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          placeholder="Qty"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          data-testid="input-custom-quantity"
        />
        <Input
          type="number"
          placeholder="Unit Price"
          value={unitPrice}
          onChange={(e) => setUnitPrice(Number(e.target.value))}
          data-testid="input-custom-price"
        />
      </div>

      <Select value={unit} onValueChange={setUnit}>
        <SelectTrigger data-testid="select-custom-unit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="each">Each</SelectItem>
          <SelectItem value="hours">Hours</SelectItem>
          <SelectItem value="m2">Square Meters</SelectItem>
          <SelectItem value="linear_m">Linear Meters</SelectItem>
          <SelectItem value="tons">Tons</SelectItem>
        </SelectContent>
      </Select>

      <Button 
        onClick={handleAdd}
        disabled={!description || quantity <= 0 || unitPrice <= 0}
        className="w-full"
        data-testid="button-add-custom-item"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Item
      </Button>
    </div>
  );
}