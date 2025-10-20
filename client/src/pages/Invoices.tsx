import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Search, Send, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Job, Customer, Invoice } from "@shared/schema";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
}

type InvoiceWithRelations = Invoice & {
  customer?: Customer;
  job?: Job;
};

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");
  const [sendingJobId, setSendingJobId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch all invoices with customer and job data
  const { data: invoicesResponse, isLoading } = useQuery<ApiResponse<InvoiceWithRelations>>({
    queryKey: ['/api/invoices'],
  });

  const sendToXeroMutation = useMutation({
    mutationFn: async (jobId: string) => {
      setSendingJobId(jobId);
      const response = await apiRequest('POST', '/api/xero/send-invoice', { jobId });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setSendingJobId(null);
      toast({
        title: "Success",
        description: data?.message || "Invoice sent to Xero successfully",
      });
    },
    onError: (error: any) => {
      setSendingJobId(null);
      toast({
        title: "Error",
        description: error.message || "Failed to send invoice to Xero",
        variant: "destructive",
      });
    },
  });

  const invoices = invoicesResponse?.data || [];

  // Filter invoices based on search and tab
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      (invoice.jobTitle?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) ||
      (invoice.customer?.name?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) ||
      (invoice.address?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) ||
      (invoice.invoiceNumber?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) ||
      (invoice.job?.jobNumber?.toLowerCase() ?? "").includes(searchQuery.toLowerCase());

    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "pending" && invoice.status === 'pending');

    return matchesSearch && matchesTab;
  });

  const formatCurrency = (amount?: string | null) => {
    console.log(`💵 formatCurrency input: "${amount}" (type: ${typeof amount})`);
    if (!amount) {
      console.log(`  → Returning $0.00 (falsy value)`);
      return '$0.00';
    }
    const num = parseFloat(amount);
    const result = `$${num.toFixed(2)}`;
    console.log(`  → Returning ${result}`);
    return result;
  };

  const handleSendToXero = (jobId: string) => {
    sendToXeroMutation.mutate(jobId);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
          <h1 className="text-2xl sm:text-3xl font-bold truncate" data-testid="heading-invoices">Invoices</h1>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-invoices-description">
          Manage and send completed job invoices to Xero
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by job number, customer, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full"
            data-testid="input-search-invoices"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-2 max-w-full" data-testid="tabs-invoice-filter">
          <TabsTrigger value="all" data-testid="tab-all-invoices">
            All ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending-invoices">
            Pending ({invoices.filter(inv => inv.status === 'pending').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredInvoices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium" data-testid="text-no-invoices">No invoices found</p>
                <p className="text-sm text-muted-foreground" data-testid="text-no-invoices-description">
                  {activeTab === "all" && "No invoices created yet"}
                  {activeTab === "pending" && "No pending invoices"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 w-full max-w-full">
              {filteredInvoices.map((invoice) => (
                <Card key={invoice.id} className="hover-elevate min-w-0" data-testid={`card-invoice-${invoice.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg truncate" data-testid={`text-invoice-number-${invoice.id}`}>
                        {invoice.invoiceNumber}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-customer-${invoice.id}`}>
                        {invoice.customer?.name || 'Unknown Customer'}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {invoice.status === 'paid' ? (
                        <Badge variant="default" className="gap-1" data-testid={`badge-status-${invoice.id}`}>
                          <CheckCircle className="h-3 w-3" />
                          Paid
                        </Badge>
                      ) : invoice.status === 'pending' ? (
                        <Badge variant="secondary" className="gap-1" data-testid={`badge-status-${invoice.id}`}>
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      ) : (
                        <Badge variant="outline" data-testid={`badge-status-${invoice.id}`}>
                          {invoice.status}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-job-title-${invoice.id}`}>
                          {invoice.jobTitle}
                        </p>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`text-address-${invoice.id}`}>
                          {invoice.address || 'No address'}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Total Amount</span>
                        <span className="text-lg font-bold" data-testid={`text-amount-${invoice.id}`}>
                          {formatCurrency(invoice.amount?.toString())}
                        </span>
                      </div>

                      {invoice.xeroSyncedAt && (
                        <p className="text-xs text-muted-foreground" data-testid={`text-sent-date-${invoice.id}`}>
                          Sent to Xero: {format(new Date(invoice.xeroSyncedAt), 'MMM d, yyyy')}
                        </p>
                      )}

                      {invoice.xeroInvoiceId && (
                        <p className="text-xs text-muted-foreground truncate" data-testid={`text-xero-id-${invoice.id}`}>
                          Xero ID: {invoice.xeroInvoiceId}
                        </p>
                      )}
                    </div>

                    {invoice.jobId && (
                      <Button
                        className="w-full gap-2"
                        onClick={() => handleSendToXero(invoice.jobId!)}
                        disabled={!!invoice.xeroSyncedAt || sendingJobId === invoice.jobId}
                        data-testid={`button-send-to-xero-${invoice.id}`}
                      >
                        <Send className="h-4 w-4" />
                        {sendingJobId === invoice.jobId ? 'Sending...' : 
                         invoice.xeroSyncedAt ? 'Sent to Xero' : 'Send to Xero'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
