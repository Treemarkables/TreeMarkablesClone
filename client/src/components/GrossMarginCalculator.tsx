import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calculator,
  DollarSign,
  Clock,
  Package,
  Wrench,
  CheckCircle,
  AlertCircle,
  Save,
  TrendingUp,
  Users,
  Trash2,
} from "lucide-react";

interface GrossMarginData {
  laborCosts?: number;
  materialsCosts?: number;
  otherCosts?: number;
  laborHours?: number;
  hourlyRate?: number;
  grossMargin?: string;
  grossMarginCalculated?: boolean;
  totalAmount?: string;
  assignedStaffIds?: string[];
  staffAssignments?: StaffAssignment[];
}

interface StaffAssignment {
  staffId: string;
  hours?: number;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface GrossMarginCalculatorProps {
  jobId: string;
  jobData?: any;
  compact?: boolean;
}

export function GrossMarginCalculator({
  jobId,
  jobData,
  compact = false,
}: GrossMarginCalculatorProps) {
  const [formData, setFormData] = useState<GrossMarginData>({});
  const [calculationMode, setCalculationMode] = useState<"manual" | "hourly">(
    "manual",
  );
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>(
    [],
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch job data to get current gross margin information
  const { data: jobResponse, isLoading } = useQuery({
    queryKey: ["/api/jobs", jobId],
    enabled: !!jobId,
  });

  // Fetch employees for staff selection
  const { data: employeesData } = useQuery({
    queryKey: ["/api/employees", "active"],
    enabled: !compact, // Only load when showing full calculator
  });

  // Fetch quotes data to get pricing information
  const { data: quotesResponse } = useQuery({
    queryKey: ["/api/quotes"],
  });

  // Fetch proposals data with sections to enable pricing calculation
  const { data: proposalsResponse } = useQuery({
    queryKey: ["/api/proposals", "with-sections"],
    queryFn: async () => {
      const response = await fetch("/api/proposals?includeSections=true");
      if (!response.ok) throw new Error("Failed to fetch proposals");
      return response.json();
    },
  });

  // Fetch invoices for this job to get invoice-based revenue
  const { data: invoicesResponse } = useQuery({
    queryKey: ["/api/invoices", "job", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?jobId=${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch invoices");
      return response.json();
    },
    enabled: !!jobId,
  });

  const job = (jobResponse as any)?.data;
  const employees = (employeesData as any)?.data || [];
  const quotes = (quotesResponse as any)?.data || [];
  const proposals = (proposalsResponse as any)?.data || [];
  const jobInvoices = (invoicesResponse as any)?.data || [];

  // Fetch ALL staff time entries from the new time tracking system
  const today = new Date().toISOString().split("T")[0];
  const { data: staffTimeData } = useQuery({
    queryKey: ["time-entries", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/time-entries/${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch staff time entries");
      return response.json();
    },
    enabled: !!jobId,
  });

  const hasStaffTimeEntries = (staffTimeData as any)?.data?.length > 0;
  const staffTimeEntries = (staffTimeData as any)?.data || [];
  const staffTimeLaborCost = staffTimeEntries.reduce(
    (sum: number, entry: any) => {
      const hours = Number(entry.hours) || 0;
      const costRate = Number(entry.costRate ?? entry.rate) || 0;
      return sum + hours * costRate;
    },
    0,
  );

  // Get bulk expense data from job object (not from /expenses endpoint which is for individual entries)
  const bulkExpenses = {
    actualLaborCosts: job?.actualLaborCosts || 0,
    actualMaterialsCosts: job?.actualMaterialsCosts || 0,
    equipmentCosts: job?.equipmentCosts || 0,
    subcontractorCosts: job?.subcontractorCosts || 0,
    permitCosts: job?.permitCosts || 0,
    travelCosts: job?.travelCosts || 0,
    disposalCosts: job?.disposalCosts || 0,
    miscExpenses: job?.miscExpenses || 0,
  };
  const totalExpenses = Object.values(bulkExpenses).reduce(
    (sum: number, amount: any) => {
      return sum + (typeof amount === "number" ? amount : 0);
    },
    0,
  );

  // Update form data when job data changes
  useEffect(() => {
    if (job) {
      setFormData({
        laborCosts: job.laborCosts ? parseFloat(job.laborCosts) : undefined,
        materialsCosts: job.materialsCosts
          ? parseFloat(job.materialsCosts)
          : undefined,
        otherCosts: job.otherCosts ? parseFloat(job.otherCosts) : undefined,
        laborHours: job.laborHours ? parseFloat(job.laborHours) : undefined,
        hourlyRate: job.hourlyRate ? parseFloat(job.hourlyRate) : undefined,
        grossMargin: job.grossMargin,
        grossMarginCalculated: job.grossMarginCalculated,
        totalAmount: job.totalAmount,
        assignedStaffIds: job.assignedStaffIds,
      });
      // Initialize selected staff from job data
      if (job.assignedStaffIds && Array.isArray(job.assignedStaffIds)) {
        setSelectedStaffIds(job.assignedStaffIds);
      } else {
        // Clear selected staff if no staff assigned to this job
        setSelectedStaffIds([]);
      }

      // Initialize staff assignments from job data
      if (job.staffAssignments && Array.isArray(job.staffAssignments)) {
        setStaffAssignments(job.staffAssignments);
      } else {
        // Clear staff assignments if none exist
        setStaffAssignments([]);
      }
    }
  }, [job]);

  // Update gross margin mutation
  const updateGrossMarginMutation = useMutation({
    mutationFn: async (data: GrossMarginData) => {
      // Don't send laborCosts if staff time entries exist (server will calculate)
      const payload = hasStaffTimeEntries
        ? { ...data, laborCosts: undefined }
        : data;
      return await apiRequest("PUT", `/api/jobs/${jobId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update gross margin",
        variant: "destructive",
      });
    },
  });

  // Delete line item mutation
  const deleteLineItemMutation = useMutation({
    mutationFn: async (lineItemId: string) => {
      const updatedLineItems = (job?.lineItems || []).filter(
        (item: any) => item.id !== lineItemId,
      );
      return await apiRequest("PUT", `/api/jobs/${jobId}`, {
        lineItems: updatedLineItems,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete line item",
        variant: "destructive",
      });
    },
  });

  // Calculate total revenue from job line items - read-only consumer
  const calculateJobLineItemsTotal = (jobLineItems: any[]): number => {
    if (!Array.isArray(jobLineItems)) return 0;
    return jobLineItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 0);
      const unitPrice = parseFloat(item.unitPrice || 0);
      return sum + quantity * unitPrice;
    }, 0);
  };

  // Calculate total costs from job line items cost fields
  const calculateJobLineItemsCosts = (jobLineItems: any[]): number => {
    if (!Array.isArray(jobLineItems)) return 0;
    return jobLineItems.reduce((sum, item) => {
      const totalCost = parseFloat(item.totalCost || 0);
      const unitCost = parseFloat(item.unitCost || 0);
      const quantity = parseFloat(item.quantity || 0);
      // Use totalCost if available, otherwise calculate from unitCost * quantity
      const itemCost = totalCost > 0 ? totalCost : unitCost * quantity;
      return sum + itemCost;
    }, 0);
  };

  // Helper function to calculate proposal total from line items
  const calculateProposalTotal = (proposal: any): number => {
    if (!proposal?.sections || !Array.isArray(proposal.sections)) {
      return 0;
    }

    let total = 0;
    proposal.sections.forEach((section: any) => {
      if (section.lineItems && Array.isArray(section.lineItems)) {
        section.lineItems.forEach((item: any) => {
          if (item.selected !== false) {
            // Include item if not explicitly unselected
            total += Number(item.totalPrice || 0);
          }
        });
      }
    });

    return total;
  };

  // Helper function to get job price from invoice, quote, or proposal
  const getJobPrice = (): number => {
    if (!job) return 0;

    // First check invoices - the most authoritative source of revenue (ex-GST amount)
    if (jobInvoices.length > 0) {
      const totalInvoiced = jobInvoices.reduce((sum: number, inv: any) => {
        return sum + (Number(inv.amount) || 0);
      }, 0);
      if (totalInvoiced > 0) {
        return totalInvoiced;
      }
    }

    // Then try to get price from linked quote
    if (job.quoteId) {
      const linkedQuote = quotes.find((q: any) => q.id === job.quoteId);
      if (linkedQuote?.amount) {
        return Number(linkedQuote.amount);
      }
    }

    // Then try to get price from the most recent proposal for this job
    const jobProposals = proposals.filter((p: any) => p.jobId === job.id);
    if (jobProposals.length > 0) {
      const sortedProposals = jobProposals.sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const latestProposal = sortedProposals[0];
      const proposalTotal = calculateProposalTotal(latestProposal);
      if (proposalTotal > 0) {
        return proposalTotal;
      }
    }

    // Fall back to job line items or job.totalAmount
    const jobLineItemsTotal = calculateJobLineItemsTotal(job?.lineItems || []);
    return jobLineItemsTotal > 0
      ? jobLineItemsTotal
      : job?.totalAmount
        ? parseFloat(job.totalAmount)
        : 0;
  };

  const jobLineItemsCosts = calculateJobLineItemsCosts(job?.lineItems || []);
  const jobLineItemsTotal = calculateJobLineItemsTotal(job?.lineItems || []);
  const totalAmount = getJobPrice();

  // Materials costs come from the actual cost fields in line items
  const materialsCosts = jobLineItemsCosts;

  // Separate staff costs from additional costs
  const staffCosts = staffTimeLaborCost;
  const additionalCosts = formData.laborCosts || 0;
  const otherCosts = formData.otherCosts || 0;
  const costOfGoods = job?.costOfGoods ? parseFloat(job.costOfGoods) : 0;
  // Include tracked expenses in total costs
  const totalCosts =
    staffCosts +
    additionalCosts +
    materialsCosts +
    otherCosts +
    costOfGoods +
    totalExpenses;
  const calculatedLaborCosts =
    (formData.laborHours || 0) * (formData.hourlyRate || 0);

  // Calculate gross margin in real-time
  const grossMarginPercent =
    totalAmount > 0 ? ((totalAmount - totalCosts) / totalAmount) * 100 : 0;
  const grossMarginAmount = totalAmount - totalCosts;

  const handleInputChange = (field: keyof GrossMarginData, value: string) => {
    const numericValue = value === "" ? undefined : parseFloat(value);
    setFormData((prev) => ({
      ...prev,
      [field]: numericValue,
    }));
  };

  // Helper functions for staff assignments
  const updateStaffAssignment = (
    staffId: string,
    field: keyof StaffAssignment,
    value: string | number,
  ) => {
    setStaffAssignments((prev) => {
      const existingIndex = prev.findIndex(
        (assignment) => assignment.staffId === staffId,
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], [field]: value };
        return updated;
      } else {
        return [...prev, { staffId, [field]: value }];
      }
    });
  };

  const getStaffAssignment = (staffId: string): StaffAssignment => {
    return (
      staffAssignments.find((assignment) => assignment.staffId === staffId) || {
        staffId,
      }
    );
  };

  const handleSave = () => {
    // ONLY save cost-related fields, don't touch revenue/line items
    const dataToSave: any = {
      materialsCosts: materialsCosts.toString(),
      grossMargin: null,
      grossMarginCalculated: false,
      assignedStaffIds: selectedStaffIds,
      staffAssignments: staffAssignments.filter((assignment) =>
        selectedStaffIds.includes(assignment.staffId),
      ),
    };

    // Add cost fields if they exist
    if (formData.otherCosts !== undefined) {
      dataToSave.otherCosts = formData.otherCosts.toString();
    }

    // If staff time entries exist, don't include laborCosts (server will calculate from entries)
    if (hasStaffTimeEntries) {
      // Server will calculate labor costs from time entries
    } else if (
      calculationMode === "hourly" &&
      formData.laborHours &&
      formData.hourlyRate
    ) {
      // If using hourly calculation mode, use calculated labor costs
      dataToSave.laborCosts = calculatedLaborCosts.toString();
      dataToSave.laborHours = formData.laborHours.toString();
      dataToSave.hourlyRate = formData.hourlyRate.toString();
    } else if (formData.laborCosts !== undefined) {
      dataToSave.laborCosts = formData.laborCosts.toString();
    }

    updateGrossMarginMutation.mutate(dataToSave);
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 30) return "text-green-600 bg-green-50";
    if (margin >= 20) return "text-yellow-600 bg-yellow-50";
    if (margin >= 10) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
  };

  const getMarginStatus = (margin: number) => {
    if (margin >= 30) return { text: "Excellent", icon: CheckCircle };
    if (margin >= 20) return { text: "Good", icon: TrendingUp };
    if (margin >= 10) return { text: "Fair", icon: AlertCircle };
    return { text: "Poor", icon: AlertCircle };
  };

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Gross Margin
            </div>
            {job?.grossMarginCalculated ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            ) : (
              <Badge className="bg-orange-100 text-orange-800">
                <AlertCircle className="h-3 w-3 mr-1" />
                Required
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {job?.grossMarginCalculated ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Gross Margin:</span>
                <span
                  className={`font-bold ${getMarginColor(parseFloat(job.grossMargin || "0"))}`}
                >
                  {job.grossMargin}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Margin Amount:</span>
                <span className="font-medium">
                  ${((totalAmount || 0) - (totalCosts || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              Complete cost calculation to generate invoice
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading gross margin data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* Job Revenue from Line Items */}
        {job?.lineItems && job.lineItems.length > 0 && (
          <div className="space-y-2">
            {job.lineItems.map((item: any, index: number) => (
              <Card key={index} className="p-3 bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{item.description}</div>
                    <div className="text-sm text-gray-600">
                      {item.quantity} × $
                      {parseFloat(item.unitPrice || 0).toFixed(2)} = $
                      {(
                        item.quantity * parseFloat(item.unitPrice || 0)
                      ).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    $
                    {(item.quantity * parseFloat(item.unitPrice || 0)).toFixed(
                      2,
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteLineItemMutation.mutate(item.id)}
                    disabled={deleteLineItemMutation.isPending}
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`button-delete-line-item-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
            <div className="text-right pt-2 border-t">
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="text-lg font-bold text-green-700">
                ${jobLineItemsTotal.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Staff Time Entries Indicator */}
        {hasStaffTimeEntries && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Staff Time Entries Logged</span>
            </div>
            <div className="text-sm text-blue-600 mt-1">
              {staffTimeEntries.length} time{" "}
              {staffTimeEntries.length === 1 ? "entry" : "entries"} detected •
              Labor costs automatically calculated: $
              {staffTimeLaborCost.toFixed(2)}
            </div>
          </div>
        )}

        {/* Cost Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-3">Cost Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between font-semibold text-green-700 border-b pb-2 mb-2">
              <span>Job Revenue:</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Staff Costs:</span>
              <span>${staffCosts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Additional Costs:</span>
              <span>${additionalCosts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Materials Costs:</span>
              <span>${materialsCosts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Other Costs:</span>
              <span>${otherCosts.toFixed(2)}</span>
            </div>
            {costOfGoods > 0 && (
              <div className="flex justify-between">
                <span>Cost of Goods:</span>
                <span>${costOfGoods.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t pt-2 font-semibold">
              <div className="flex justify-between">
                <span>Total Costs:</span>
                <span>${totalCosts.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gross Margin Results */}
        <div className={`p-4 rounded-lg ${getMarginColor(grossMarginPercent)}`}>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Gross Margin Analysis
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm opacity-75">Gross Margin %</div>
              <div className="text-2xl font-bold">
                {grossMarginPercent.toFixed(1)}%
              </div>
              <div className="text-sm flex items-center gap-1 mt-1">
                {React.createElement(getMarginStatus(grossMarginPercent).icon, {
                  className: "h-4 w-4",
                })}
                {getMarginStatus(grossMarginPercent).text}
              </div>
            </div>
            <div>
              <div className="text-sm opacity-75">Gross Margin $</div>
              <div className="text-2xl font-bold">
                ${grossMarginAmount.toFixed(2)}
              </div>
              <div className="text-sm mt-1">Revenue - Total Costs</div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={updateGrossMarginMutation.isPending}
            data-testid="button-save-gross-margin"
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {updateGrossMarginMutation.isPending
              ? "Saving..."
              : "Save Gross Margin"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
