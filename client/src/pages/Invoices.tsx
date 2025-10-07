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
import type { Job, Customer } from "@shared/schema";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
}

type JobWithCustomer = Job & {
  customer?: Customer;
};

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "sent">("all");
  const { toast } = useToast();

  const { data: jobsResponse, isLoading } = useQuery<ApiResponse<Job>>({
    queryKey: ['/api/jobs'],
  });

  const { data: customersResponse } = useQuery<ApiResponse<Customer>>({
    queryKey: ['/api/customers'],
  });

  const sendToXeroMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest('POST', '/api/xero/send-invoice', { jobId });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Success",
        description: data?.message || "Invoice sent to Xero successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invoice to Xero",
        variant: "destructive",
      });
    },
  });

  const jobs = jobsResponse?.data || [];
  const customers = customersResponse?.data || [];

  const completedJobs = jobs.filter(job => job.status === 'completed');

  const jobsWithCustomers: JobWithCustomer[] = completedJobs.map(job => ({
    ...job,
    customer: customers.find(c => c.id === job.customerId),
  }));

  const filteredJobs = jobsWithCustomers.filter(job => {
    const matchesSearch = 
      (job.title?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) ||
      (job.customer?.name?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) ||
      (job.address?.toLowerCase() ?? "").includes(searchQuery.toLowerCase()) ||
      (job.jobNumber?.toLowerCase() ?? "").includes(searchQuery.toLowerCase());

    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "pending" && (!job.xeroStatus || job.xeroStatus === 'pending')) ||
      (activeTab === "sent" && job.xeroStatus === 'sent');

    return matchesSearch && matchesTab;
  });

  const getStatusBadge = (xeroStatus?: string | null) => {
    if (!xeroStatus || xeroStatus === 'pending') {
      return (
        <Badge variant="outline" className="gap-1" data-testid={`badge-xero-status-pending`}>
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    }
    if (xeroStatus === 'sent') {
      return (
        <Badge className="gap-1 bg-green-100 text-green-800" data-testid={`badge-xero-status-sent`}>
          <CheckCircle className="h-3 w-3" />
          Sent to Xero
        </Badge>
      );
    }
    if (xeroStatus === 'error') {
      return (
        <Badge variant="destructive" className="gap-1" data-testid={`badge-xero-status-error`}>
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    }
    return null;
  };

  const formatCurrency = (amount?: string | null) => {
    if (!amount) return '$0.00';
    const num = parseFloat(amount);
    return `$${num.toFixed(2)}`;
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
        <TabsList className="grid w-full grid-cols-3 max-w-full" data-testid="tabs-invoice-filter">
          <TabsTrigger value="all" data-testid="tab-all-invoices">
            All ({completedJobs.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending-invoices">
            Pending ({completedJobs.filter(j => !j.xeroStatus || j.xeroStatus === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="sent" data-testid="tab-sent-invoices">
            Sent ({completedJobs.filter(j => j.xeroStatus === 'sent').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredJobs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium" data-testid="text-no-invoices">No invoices found</p>
                <p className="text-sm text-muted-foreground" data-testid="text-no-invoices-description">
                  {activeTab === "all" && "Complete jobs to create invoices"}
                  {activeTab === "pending" && "No pending invoices"}
                  {activeTab === "sent" && "No invoices sent to Xero yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 w-full max-w-full">
              {filteredJobs.map((job) => (
                <Card key={job.id} className="hover-elevate min-w-0" data-testid={`card-invoice-${job.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg truncate" data-testid={`text-job-number-${job.id}`}>
                        {job.jobNumber}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-customer-${job.id}`}>
                        {job.customer?.name || 'Unknown Customer'}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(job.xeroStatus)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-job-title-${job.id}`}>
                          {job.title || job.customer?.name || 'Untitled Job'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate" data-testid={`text-address-${job.id}`}>
                          {job.address || 'No address'}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Total Amount</span>
                        <span className="text-lg font-bold" data-testid={`text-amount-${job.id}`}>
                          {formatCurrency(job.totalIncludingGst || job.totalAmount)}
                        </span>
                      </div>

                      {job.sentToXeroDate && (
                        <p className="text-xs text-muted-foreground" data-testid={`text-sent-date-${job.id}`}>
                          Sent: {format(new Date(job.sentToXeroDate), 'MMM d, yyyy')}
                        </p>
                      )}

                      {job.xeroInvoiceId && (
                        <p className="text-xs text-muted-foreground truncate" data-testid={`text-xero-id-${job.id}`}>
                          Xero ID: {job.xeroInvoiceId}
                        </p>
                      )}
                    </div>

                    <Button
                      className="w-full gap-2"
                      onClick={() => handleSendToXero(job.id)}
                      disabled={job.xeroStatus === 'sent' || sendToXeroMutation.isPending}
                      data-testid={`button-send-to-xero-${job.id}`}
                    >
                      <Send className="h-4 w-4" />
                      {sendToXeroMutation.isPending ? 'Sending...' : 
                       job.xeroStatus === 'sent' ? 'Sent to Xero' : 'Send to Xero'}
                    </Button>
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
