import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Send,
  Eye,
  Download,
  Plus,
  Calendar,
  User,
  Mail
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  jobId: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  description: string;
  lineItems: {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  notes?: string;
}

interface InvoiceManagerProps {
  compact?: boolean;
}

const mockInvoiceData: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    customerId: '1',
    customerName: 'Sarah Williams',
    jobId: '1',
    amount: 2400,
    status: 'sent',
    issueDate: '2024-12-15',
    dueDate: '2024-12-29',
    description: 'Large oak tree removal - residential property',
    lineItems: [
      { description: 'Tree removal (large oak)', quantity: 1, rate: 1800, amount: 1800 },
      { description: 'Stump grinding', quantity: 1, rate: 400, amount: 400 },
      { description: 'Site cleanup', quantity: 1, rate: 200, amount: 200 }
    ],
    notes: 'Payment due within 14 days. GST included.'
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    customerId: '2',
    customerName: 'Mike Chen',
    jobId: '2',
    amount: 850,
    status: 'paid',
    issueDate: '2024-12-10',
    dueDate: '2024-12-24',
    paidDate: '2024-12-18',
    description: 'Hedge trimming and tree pruning',
    lineItems: [
      { description: 'Hedge trimming (50m)', quantity: 50, rate: 8, amount: 400 },
      { description: 'Tree pruning (3 trees)', quantity: 3, rate: 150, amount: 450 }
    ]
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-003',
    customerId: '3',
    customerName: 'Auckland Council',
    jobId: '3',
    amount: 4200,
    status: 'overdue',
    issueDate: '2024-11-28',
    dueDate: '2024-12-12',
    description: 'Emergency storm cleanup - multiple locations',
    lineItems: [
      { description: 'Emergency callout', quantity: 1, rate: 500, amount: 500 },
      { description: 'Tree removal (storm damaged)', quantity: 6, rate: 450, amount: 2700 },
      { description: 'Branch cleanup and disposal', quantity: 1, rate: 1000, amount: 1000 }
    ],
    notes: 'Net 30 payment terms as per contract'
  },
  {
    id: '4',
    invoiceNumber: 'INV-2024-004',
    customerId: '4',
    customerName: 'Jennifer Davis',
    jobId: '4',
    amount: 1250,
    status: 'draft',
    issueDate: '2024-12-20',
    dueDate: '2024-01-03',
    description: 'Tree health assessment and pruning',
    lineItems: [
      { description: 'Arborist consultation', quantity: 2, rate: 125, amount: 250 },
      { description: 'Tree pruning (large maple)', quantity: 1, rate: 600, amount: 600 },
      { description: 'Health treatment application', quantity: 1, rate: 400, amount: 400 }
    ]
  }
];

export function InvoiceManager({ compact = false }: InvoiceManagerProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showNewInvoiceDialog, setShowNewInvoiceDialog] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500';
      case 'sent': return 'bg-blue-500';
      case 'paid': return 'bg-green-500';
      case 'overdue': return 'bg-red-500';
      case 'cancelled': return 'bg-gray-400';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const isOverdue = (invoice: Invoice) => {
    return invoice.status !== 'paid' && new Date(invoice.dueDate) < new Date();
  };

  if (compact) {
    const totalOutstanding = mockInvoiceData
      .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + inv.amount, 0);
    
    const overdueCount = mockInvoiceData.filter(inv => isOverdue(inv)).length;
    const paidThisMonth = mockInvoiceData
      .filter(inv => inv.status === 'paid' && inv.paidDate && 
        new Date(inv.paidDate).getMonth() === new Date().getMonth())
      .reduce((sum, inv) => sum + inv.amount, 0);

    return (
      <Card data-testid="invoice-summary-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-sm">Outstanding</span>
              </div>
              <span className="font-bold text-lg" data-testid="outstanding-amount">
                {formatCurrency(totalOutstanding)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">This Month</span>
              </div>
              <span className="font-bold text-green-600" data-testid="paid-this-month">
                {formatCurrency(paidThisMonth)}
              </span>
            </div>

            {overdueCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Overdue</span>
                </div>
                <Badge className="bg-red-500 text-white" data-testid="overdue-count">
                  {overdueCount}
                </Badge>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full" data-testid="view-all-invoices">
              View All Invoices
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Management
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" data-testid="export-invoices">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Dialog open={showNewInvoiceDialog} onOpenChange={setShowNewInvoiceDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="new-invoice-button">
                    <Plus className="h-4 w-4 mr-2" />
                    New Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Invoice</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Select>
                      <SelectTrigger data-testid="select-customer">
                        <SelectValue placeholder="Select Customer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Sarah Williams</SelectItem>
                        <SelectItem value="2">Mike Chen</SelectItem>
                        <SelectItem value="3">Auckland Council</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select>
                      <SelectTrigger data-testid="select-job">
                        <SelectValue placeholder="Select Job" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Tree Removal - Oak</SelectItem>
                        <SelectItem value="2">Hedge Trimming</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input placeholder="Amount (NZD)" data-testid="input-amount" />
                    <Input type="date" placeholder="Due Date" data-testid="input-due-date" />
                    
                    <div className="flex gap-2">
                      <Button className="flex-1" data-testid="create-invoice">Create Invoice</Button>
                      <Button variant="outline" className="flex-1" data-testid="create-send-invoice">
                        Create & Send
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockInvoiceData.map((invoice) => (
              <Card key={invoice.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedInvoice(invoice)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold" data-testid={`invoice-number-${invoice.id}`}>
                        {invoice.invoiceNumber}
                      </h4>
                      <p className="text-sm text-muted-foreground" data-testid={`customer-name-${invoice.id}`}>
                        {invoice.customerName}
                      </p>
                    </div>
                    <Badge className={`${getStatusColor(invoice.status)} text-white`} data-testid={`status-${invoice.id}`}>
                      {getStatusText(invoice.status)}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Amount:</span>
                      <span className="font-bold" data-testid={`amount-${invoice.id}`}>
                        {formatCurrency(invoice.amount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Due:</span>
                      <span className={isOverdue(invoice) ? 'text-red-600' : ''} data-testid={`due-date-${invoice.id}`}>
                        {format(new Date(invoice.dueDate), 'MMM dd, yyyy')}
                      </span>
                    </div>

                    {invoice.paidDate && (
                      <div className="flex items-center justify-between">
                        <span>Paid:</span>
                        <span className="text-green-600" data-testid={`paid-date-${invoice.id}`}>
                          {format(new Date(invoice.paidDate), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2 truncate" data-testid={`description-${invoice.id}`}>
                      {invoice.description}
                    </p>
                  </div>

                  {isOverdue(invoice) && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xs">Overdue</span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex gap-1">
                    {invoice.status === 'draft' && (
                      <Button size="sm" variant="outline" className="flex-1" data-testid={`send-${invoice.id}`}>
                        <Send className="h-3 w-3 mr-1" />
                        Send
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="flex-1" data-testid={`view-${invoice.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle data-testid="invoice-detail-title">
                Invoice {selectedInvoice.invoiceNumber}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Customer Details</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{selectedInvoice.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>customer@email.com</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Invoice Details</h4>
                  <div className="space-y-1 text-sm">
                    <div>Issue Date: {format(new Date(selectedInvoice.issueDate), 'MMM dd, yyyy')}</div>
                    <div>Due Date: {format(new Date(selectedInvoice.dueDate), 'MMM dd, yyyy')}</div>
                    <div>Status: <Badge className={`${getStatusColor(selectedInvoice.status)} text-white ml-2`}>
                      {getStatusText(selectedInvoice.status)}
                    </Badge></div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Line Items</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Description</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-right p-2">Rate</th>
                        <th className="text-right p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.lineItems.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">{item.description}</td>
                          <td className="text-right p-2">{item.quantity}</td>
                          <td className="text-right p-2">{formatCurrency(item.rate)}</td>
                          <td className="text-right p-2 font-medium">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t bg-muted">
                      <tr>
                        <td colSpan={3} className="text-right p-2 font-semibold">Total:</td>
                        <td className="text-right p-2 font-bold text-lg">{formatCurrency(selectedInvoice.amount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.notes}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" data-testid="download-invoice">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                {selectedInvoice.status === 'draft' && (
                  <Button data-testid="send-invoice">
                    <Send className="h-4 w-4 mr-2" />
                    Send Invoice
                  </Button>
                )}
                {(selectedInvoice.status === 'sent' || selectedInvoice.status === 'overdue') && (
                  <Button data-testid="mark-paid">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Paid
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}