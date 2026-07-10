import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanGate } from "@/components/PlanGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Search,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Pencil,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Job, Customer, Invoice } from "@shared/schema";
import { GlobalJobCard } from "@/components/GlobalJobCard";

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
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "notInXero">(
    "all",
  );
  const [sendingJobId, setSendingJobId] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] =
    useState<InvoiceWithRelations | null>(null);
  const [editFormData, setEditFormData] = useState({
    address: "",
    jobTitle: "",
    amount: "",
    notes: "",
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch all invoices with customer and job data
  const { data: invoicesResponse, isLoading } = useQuery<
    ApiResponse<InvoiceWithRelations>
  >({
    queryKey: ["/api/invoices"],
  });

  const sendToXeroMutation = useMutation({
    mutationFn: async (jobId: string) => {
      setSendingJobId(jobId);
      const response = await apiRequest("POST", "/api/xero/send-invoice", {
        jobId,
      });
      const data = await response.json();

      if (!response.ok) {
        throw { ...data, statusCode: response.status };
      }

      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setSendingJobId(null);
    },
    onError: (error: any) => {
      setSendingJobId(null);

      // If missing address, offer to edit invoice or job
      if (error.missingField === "address") {
        if (error.invoiceId) {
          const invoiceToEdit = invoices.find(
            (inv) => inv.id === error.invoiceId,
          );

          toast({
            title: "Missing Address",
            description: error.message || "Invoice needs a valid address",
            variant: "destructive",
            action: invoiceToEdit ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleEditInvoice(invoiceToEdit)}
                data-testid="button-toast-edit-address"
              >
                Fix Address
              </Button>
            ) : undefined,
          });
        } else {
          // No invoice exists yet - direct user to create invoice first
          toast({
            title: "Missing Address",
            description:
              "Please create an invoice for this job first, then add an address before sending to Xero.",
            variant: "destructive",
          });
        }
      } else if (error.errorCode === "DUPLICATE_INVOICE_NUMBER") {
        toast({
          title: `Invoice #${error.jobNumber ?? ""} already exists in Xero`,
          description:
            error.details?.suggestion ||
            "That invoice number is already in use in Xero (even voided/deleted invoices still reserve the number). Renumber the existing one in Xero, then resend.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.details?.suggestion || error.message || "Failed to send invoice to Xero",
          variant: "destructive",
        });
      }
    },
  });

  const [isSyncingPayments, setIsSyncingPayments] = useState(false);

  const syncPaymentsFromXero = async () => {
    setIsSyncingPayments(true);
    try {
      const response = await apiRequest(
        "POST",
        "/api/xero/sync-payment-status",
        { all: true },
      );
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch {
      toast({
        title: "Sync Failed",
        description:
          "Could not sync payment status from Xero. Check your Xero connection.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingPayments(false);
    }
  };

  const resetXeroSyncMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest(
        "POST",
        "/api/xero/reset-invoice-sync",
        { invoiceId },
      );
      const data = await response.json();
      if (!response.ok) throw data;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset Xero sync",
        variant: "destructive",
      });
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/invoices/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setEditingInvoice(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update invoice",
        variant: "destructive",
      });
    },
  });

  const invoices = invoicesResponse?.data || [];

  // Sent to the customer but never pushed to Xero. Status is the reliable
  // signal — legacy sends and the create-and-send path set status without
  // stamping sentDate. Paid counts as sent: it went out and still isn't in
  // Xero. Cancelled invoices don't need to reach Xero.
  const isSentNotInXero = (invoice: InvoiceWithRelations) =>
    !invoice.xeroInvoiceId &&
    (invoice.status === "sent" ||
      invoice.status === "paid" ||
      (!!invoice.sentDate && invoice.status !== "cancelled"));

  const handleEditInvoice = (invoice: InvoiceWithRelations) => {
    setEditingInvoice(invoice);
    setEditFormData({
      address: invoice.address || "",
      jobTitle: invoice.jobTitle || "",
      amount: invoice.amount?.toString() || "",
      notes: invoice.notes || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editingInvoice) return;

    // Validate address
    const trimmedAddress = editFormData.address.trim();
    if (!trimmedAddress || trimmedAddress.length < 5) {
      toast({
        title: "Validation Error",
        description: "Address must be at least 5 characters",
        variant: "destructive",
      });
      return;
    }

    // Validate amount if provided
    const amount = editFormData.amount.trim();
    if (amount && (isNaN(Number(amount)) || Number(amount) <= 0)) {
      toast({
        title: "Validation Error",
        description: "Amount must be a valid positive number greater than 0",
        variant: "destructive",
      });
      return;
    }

    updateInvoiceMutation.mutate({
      id: editingInvoice.id,
      data: {
        address: trimmedAddress,
        jobTitle: editFormData.jobTitle.trim(),
        amount: amount ? Number(amount) : Number(editingInvoice.amount),
        notes: editFormData.notes.trim(),
      },
    });
  };

  // Filter invoices based on search and tab
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      (invoice.jobTitle?.toLowerCase() ?? "").includes(
        searchQuery.toLowerCase(),
      ) ||
      (invoice.customer?.name?.toLowerCase() ?? "").includes(
        searchQuery.toLowerCase(),
      ) ||
      (invoice.address?.toLowerCase() ?? "").includes(
        searchQuery.toLowerCase(),
      ) ||
      (invoice.invoiceNumber?.toLowerCase() ?? "").includes(
        searchQuery.toLowerCase(),
      ) ||
      (invoice.job?.jobNumber?.toLowerCase() ?? "").includes(
        searchQuery.toLowerCase(),
      );

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "pending" && invoice.status === "pending") ||
      (activeTab === "notInXero" && isSentNotInXero(invoice));

    return matchesSearch && matchesTab;
  });

  const formatCurrency = (amount?: string | null) => {
    if (!amount) return "$0.00";
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
          <h1
            className="text-2xl sm:text-3xl font-bold truncate"
            data-testid="heading-invoices"
          >
            Invoices
          </h1>
        </div>
        <p
          className="text-sm text-muted-foreground"
          data-testid="text-invoices-description"
        >
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
        <PlanGate requires="plan:crew">
          <Button
            variant="outline"
            onClick={syncPaymentsFromXero}
            disabled={isSyncingPayments}
            data-testid="button-sync-xero-payments"
            className="shrink-0"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isSyncingPayments ? "animate-spin" : ""}`}
            />
            {isSyncingPayments ? "Syncing..." : "Sync from Xero"}
          </Button>
        </PlanGate>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as any)}
      >
        <TabsList
          className="grid w-full grid-cols-3 max-w-full"
          data-testid="tabs-invoice-filter"
        >
          <TabsTrigger value="all" data-testid="tab-all-invoices">
            All ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending-invoices">
            Pending ({invoices.filter((inv) => inv.status === "pending").length}
            )
          </TabsTrigger>
          <TabsTrigger value="notInXero" data-testid="tab-not-in-xero">
            Not in Xero ({invoices.filter(isSentNotInXero).length})
          </TabsTrigger>
        </TabsList>

        {/* All Invoices and Pending Tabs */}
        <TabsContent value={activeTab} className="mt-6">
          {filteredInvoices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p
                  className="text-lg font-medium"
                  data-testid="text-no-invoices"
                >
                  No invoices found
                </p>
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="text-no-invoices-description"
                >
                  {activeTab === "all" && "No invoices created yet"}
                  {activeTab === "pending" && "No pending invoices"}
                  {activeTab === "notInXero" &&
                    "Every sent invoice is in Xero"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 w-full max-w-full">
              {filteredInvoices.map((invoice) => (
                <Card
                  key={invoice.id}
                  className={`hover-elevate min-w-0 ${invoice.jobId ? "cursor-pointer" : ""}`}
                  data-testid={`card-invoice-${invoice.id}`}
                  onClick={() => {
                    if (invoice.jobId) setSelectedJobId(invoice.jobId);
                  }}
                  role={invoice.jobId ? "button" : undefined}
                  tabIndex={invoice.jobId ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (invoice.jobId && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      setSelectedJobId(invoice.jobId);
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle
                        className="text-base sm:text-lg truncate"
                        data-testid={`text-invoice-number-${invoice.id}`}
                      >
                        {invoice.invoiceNumber}
                      </CardTitle>
                      <p
                        className="text-sm text-muted-foreground truncate"
                        data-testid={`text-customer-${invoice.id}`}
                      >
                        {invoice.customer?.name || "Unknown Customer"}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {invoice.status === "paid" ? (
                        <Badge
                          variant="default"
                          className="gap-1"
                          data-testid={`badge-status-${invoice.id}`}
                        >
                          <CheckCircle className="h-3 w-3" />
                          Paid
                        </Badge>
                      ) : invoice.status === "pending" ? (
                        <Badge
                          variant="secondary"
                          className="gap-1"
                          data-testid={`badge-status-${invoice.id}`}
                        >
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          data-testid={`badge-status-${invoice.id}`}
                        >
                          {invoice.status}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 min-w-0">
                      <div className="min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          data-testid={`text-job-title-${invoice.id}`}
                        >
                          {invoice.jobTitle}
                        </p>
                        <p
                          className="text-sm text-muted-foreground truncate"
                          data-testid={`text-address-${invoice.id}`}
                        >
                          {invoice.address || "No address"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-muted-foreground">
                          Total Amount
                        </span>
                        <span
                          className="text-lg font-bold"
                          data-testid={`text-amount-${invoice.id}`}
                        >
                          {formatCurrency(invoice.amount?.toString())}
                        </span>
                      </div>

                      {invoice.sentDate && (
                        <p
                          className="text-xs text-muted-foreground"
                          data-testid={`text-customer-sent-date-${invoice.id}`}
                        >
                          Sent to customer:{" "}
                          {format(new Date(invoice.sentDate), "MMM d, yyyy")}
                        </p>
                      )}

                      {/* Only claim "Sent to Xero" when the Xero link (the id)
                          actually exists — legacy rows can carry a stale
                          xeroSyncedAt with no id and land in the Not in Xero
                          tab, where this line would contradict the filter. */}
                      {invoice.xeroSyncedAt && invoice.xeroInvoiceId && (
                        <p
                          className="text-xs text-muted-foreground"
                          data-testid={`text-sent-date-${invoice.id}`}
                        >
                          Sent to Xero:{" "}
                          {format(
                            new Date(invoice.xeroSyncedAt),
                            "MMM d, yyyy",
                          )}
                        </p>
                      )}

                      {invoice.xeroInvoiceId && (
                        <p
                          className="text-xs text-muted-foreground truncate"
                          data-testid={`text-xero-id-${invoice.id}`}
                        >
                          Xero ID: {invoice.xeroInvoiceId}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditInvoice(invoice)}
                        data-testid={`button-edit-invoice-${invoice.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {invoice.jobId && !invoice.xeroSyncedAt && (
                        <PlanGate requires="plan:crew">
                          <Button
                            className="flex-1 gap-2"
                            onClick={() => handleSendToXero(invoice.jobId!)}
                            disabled={sendingJobId === invoice.jobId}
                            data-testid={`button-send-to-xero-${invoice.id}`}
                          >
                            <Send className="h-4 w-4" />
                            {sendingJobId === invoice.jobId
                              ? "Sending..."
                              : "Send to Xero"}
                          </Button>
                        </PlanGate>
                      )}
                      {invoice.jobId && invoice.xeroSyncedAt && (
                        <Button
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={() => {
                            if (
                              confirm(
                                "This will reset the Xero sync so you can re-send this invoice. Make sure you have already voided the old invoice in Xero first.",
                              )
                            ) {
                              resetXeroSyncMutation.mutate(invoice.id);
                            }
                          }}
                          disabled={resetXeroSyncMutation.isPending}
                          data-testid={`button-resend-xero-${invoice.id}`}
                        >
                          <RotateCcw className="h-4 w-4" />
                          {resetXeroSyncMutation.isPending
                            ? "Resetting..."
                            : "Reset Xero Sync"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Invoice Dialog */}
      <Dialog
        open={!!editingInvoice}
        onOpenChange={(open) => !open && setEditingInvoice(null)}
      >
        <DialogContent data-testid="dialog-edit-invoice">
          <DialogHeader>
            <DialogTitle>Edit Invoice</DialogTitle>
            <DialogDescription>
              Update invoice details. Invoice number, customer, and job cannot
              be changed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="invoice-number">Invoice Number</Label>
              <Input
                id="invoice-number"
                value={editingInvoice?.invoiceNumber || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div>
              <Label htmlFor="edit-job-title">Job Title</Label>
              <Input
                id="edit-job-title"
                value={editFormData.jobTitle}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, jobTitle: e.target.value })
                }
                data-testid="input-edit-job-title"
              />
            </div>

            <div>
              <Label htmlFor="edit-address">Address *</Label>
              <Input
                id="edit-address"
                value={editFormData.address}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, address: e.target.value })
                }
                placeholder="Enter service address"
                data-testid="input-edit-address"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Address is required to send invoices to Xero
              </p>
            </div>

            <div>
              <Label htmlFor="edit-amount">Amount</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                value={editFormData.amount}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, amount: e.target.value })
                }
                data-testid="input-edit-amount"
              />
            </div>

            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editFormData.notes}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, notes: e.target.value })
                }
                rows={3}
                data-testid="input-edit-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingInvoice(null)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateInvoiceMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateInvoiceMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedJobId && (
        <GlobalJobCard
          isOpen={!!selectedJobId}
          onClose={() => setSelectedJobId(null)}
          mode="edit"
          jobId={selectedJobId}
        />
      )}
    </div>
  );
}
