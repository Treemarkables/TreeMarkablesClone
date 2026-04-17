import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Clock,
  CheckCircle,
  X,
  Trash2,
  Users,
  Search,
  Receipt,
} from "lucide-react";

interface TimeEntry {
  id: string;
  date: string;
  staffId: string;
  staffName: string;
  rate: string;
  start: string;
  duration: number; // in hours (decimal)
  billed: boolean;
}

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
}

interface RecordedTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
}

// Generate time options in 15-minute increments (0.25 hour increments) up to 12 hours
const generateTimeOptions = () => {
  const options = [];
  for (let hours = 0.25; hours <= 12; hours += 0.25) {
    const hoursDisplay = Math.floor(hours);
    const minutes = Math.round((hours % 1) * 60);
    const label =
      minutes > 0 ? `${hoursDisplay}h ${minutes}m` : `${hoursDisplay}h`;
    options.push({ value: hours.toString(), label });
  }
  return options;
};

export function RecordedTimeModal({
  isOpen,
  onClose,
  jobId,
  jobNumber,
}: RecordedTimeModalProps) {
  const [pendingEntries, setPendingEntries] = useState<TimeEntry[]>([]);
  const [rounding, setRounding] = useState("none");
  const [travelTime, setTravelTime] = useState("included");
  const [useManualInput, setUseManualInput] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [newExpense, setNewExpense] = useState({ description: "", amount: "" });
  const [newEntry, setNewEntry] = useState({
    staffIds: [] as string[],
    duration: "1",
  });
  const [staffSearchQuery, setStaffSearchQuery] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch employees and their rates from materials & services
  const { data: employeesData, refetch: refetchEmployees } = useQuery({
    queryKey: ["/api/employees"],
    enabled: isOpen,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const { data: materialsServicesData, refetch: refetchMaterials } = useQuery({
    queryKey: ["/api/materials"],
    enabled: isOpen,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  // Fetch ALL existing time entries for this job (not just today's)
  const today = new Date().toISOString().split("T")[0];
  const { data: timeEntriesData, refetch: refetchTimeEntries } = useQuery({
    queryKey: ["time-entries", jobId],
    queryFn: async () => {
      const response = await fetch(`/api/time-entries/${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch time entries");
      const result = await response.json();
      return result;
    },
    enabled: isOpen && !!jobId,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const employees = ((employeesData as any)?.data || []).filter(
    (emp: any) => emp.isActive !== false,
  );
  const materialsAndServices = (materialsServicesData as any)?.data || [];
  const existingEntries = (timeEntriesData as any)?.data || [];

  // Get staff rates from materials & services catalog (without displaying the rate)
  const getStaffRates = () => {
    return materialsAndServices
      .filter((item: any) => {
        const price =
          typeof item.price === "string" ? parseFloat(item.price) : item.price;
        return item.category === "Labour" && price >= 0;
      })
      .map((item: any) => {
        const price =
          typeof item.price === "string" ? parseFloat(item.price) : item.price;
        return {
          value: `${item.itemNumber}`,
          label: `${item.itemNumber} - ${item.name}`, // Rate removed for privacy
          rate: price,
          itemNumber: item.itemNumber,
          name: item.name,
        };
      });
  };

  const availableRates = getStaffRates();
  const timeOptions = generateTimeOptions();

  // Refetch data when modal opens
  useEffect(() => {
    if (isOpen && jobId) {
      refetchTimeEntries();
      refetchMaterials();
      refetchEmployees();
    }
  }, [isOpen, jobId, refetchTimeEntries, refetchMaterials, refetchEmployees]);

  // Load current job data for additional costs
  const { data: jobData } = useQuery({
    queryKey: ["/api/jobs", jobId],
    enabled: isOpen && !!jobId,
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPendingEntries([]);
      setNewEntry({ staffIds: [], duration: "1" });
      setUseManualInput(false);
      setExpenses([]);
      setNewExpense({ description: "", amount: "" });
      setStaffSearchQuery("");
    }
  }, [isOpen]);

  const addToPendingList = () => {
    if (!newEntry.staffIds || newEntry.staffIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one staff member",
        variant: "destructive",
      });
      return;
    }

    if (!newEntry.duration || parseFloat(newEntry.duration) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid duration",
        variant: "destructive",
      });
      return;
    }

    // Warn if adding many entries at once
    if (newEntry.staffIds.length > 25) {
      toast({
        title: "Large Selection",
        description: `You're adding ${newEntry.staffIds.length} entries at once. This may take a moment.`,
      });
    }

    // Track staff without charge-out line items assigned
    const staffWithoutRates: string[] = [];

    // Create one pending entry for each selected staff member using their assigned line items
    const newTimeEntries: TimeEntry[] = newEntry.staffIds.map((staffId) => {
      const staff = employees.find((e: any) => e.id === staffId);

      // Use the staff member's assigned charge-out line item number
      const itemNumber = staff?.chargeOutLineItemNumber || "";

      if (!itemNumber) {
        staffWithoutRates.push(`${staff?.firstName} ${staff?.lastName}`);
      }

      return {
        id: `pending-${Date.now()}-${Math.random()}-${staffId}`,
        date: new Date().toLocaleDateString("en-GB"),
        staffId: staffId,
        staffName: `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim(),
        rate: itemNumber,
        start: "",
        duration: parseFloat(newEntry.duration),
        billed: true,
      };
    });

    setPendingEntries((prev) => [...prev, ...newTimeEntries]);

    // Show warning if some staff don't have a charge-out line item assigned
    if (staffWithoutRates.length > 0) {
      toast({
        title: "Warning",
        description: `${staffWithoutRates.join(", ")} ${staffWithoutRates.length === 1 ? "does" : "do"} not have a charge-out line item assigned. Please set one in Settings → Staff.`,
        variant: "destructive",
      });
    }

    // Reset form but keep it open for adding more entries
    setNewEntry({ staffIds: [], duration: "1" });
    setUseManualInput(false);
    setStaffSearchQuery("");
  };

  const removePendingEntry = (id: string) => {
    setPendingEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  // Delete saved time entry mutation
  const deleteTimeEntryMutation = useMutation({
    mutationFn: async ({
      entryId,
      index,
    }: {
      entryId: string;
      index: number;
    }) => {
      await apiRequest(
        "DELETE",
        `/api/time-entries/job/${entryId}?jobId=${jobId}&index=${index}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      refetchTimeEntries();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete time entry",
        variant: "destructive",
      });
    },
  });

  // Convert saved time entries to job line items
  const timeToLineItemsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/jobs/${jobId}/time-to-line-items`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["time-entries", jobId] });
      toast({
        title: "Labour added to job",
        description: data?.message || "Time entries have been added as line items.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add time entries to invoice",
        variant: "destructive",
      });
    },
  });

  const saveAllEntries = async () => {
    try {
      if (pendingEntries.length === 0 && expenses.length === 0) {
        toast({
          title: "No entries",
          description: "Please add time entries or expenses before saving",
          variant: "destructive",
        });
        return;
      }

      // Format existing entries to preserve them (mark as existing to skip diary creation)
      const formattedExistingEntries = existingEntries.map((entry: any) => ({
        jobId,
        jobNumber: jobNumber || "3317",
        employeeId: entry.employeeId,
        employeeName: entry.employeeName || "Unknown Staff",
        lineItemId: entry.lineItemId || "material-11",
        lineItemNumber: entry.lineItemNumber || "34",
        lineItemName: entry.lineItemName || "Labour",
        lineItemCategory: "Labour",
        entryDate: entry.date || today,
        hours: entry.hours,
        rate: entry.rate || 0,
        startTime: entry.startTime,
        billed: entry.billed !== false,
        roundingMode: entry.roundingMode || "none",
        travelTimeIncluded: entry.travelTimeIncluded || false,
        isExisting: true, // Mark as existing to skip diary entry creation
      }));

      // Prepare NEW entries with all required fields
      const formattedNewEntries = pendingEntries.map((entry) => {
        // Find the staff member
        const staff = employees.find((e: any) => e.id === entry.staffId);
        const staffName = staff
          ? `${staff.firstName} ${staff.lastName}`
          : "Unknown Staff";

        // Find the rate/material from catalog
        const rateItem = materialsAndServices.find(
          (item: any) =>
            item.itemNumber === entry.rate ||
            item.itemNumber === entry.rate.split(" ")[0],
        );

        return {
          // Basic job/employee info
          jobId,
          jobNumber: jobNumber || "3317",
          employeeId: entry.staffId,
          employeeName: staffName,

          // Line item connection (required for schema)
          lineItemId: rateItem?.id || "material-11",
          lineItemNumber: rateItem?.itemNumber || "34",
          lineItemName: rateItem?.name || "Labour",
          lineItemCategory: "Labour",

          // Time details
          entryDate: today,
          hours: entry.duration,
          rate: rateItem?.price || parseFloat(entry.rate.split(" ")[0]) || 75,
          costRate: (() => {
            const costLineItem = materialsAndServices.find(
              (item: any) => item.itemNumber === staff?.costLineItemNumber
            );
            return costLineItem
              ? parseFloat(costLineItem.price)
              : parseFloat(staff?.hourlyRate || "0") || 0;
          })(),
          startTime: entry.start,

          // ServiceM8 features
          billed: entry.billed !== false,
          roundingMode: rounding || "none",
          travelTimeIncluded: travelTime === "Included",
        };
      });

      // Combine existing + new entries to preserve all time records
      const formattedEntries = [
        ...formattedExistingEntries,
        ...formattedNewEntries,
      ];

      // Calculate total additional costs from expense items
      const totalAdditionalCosts = expenses.reduce(
        (sum, exp) => sum + exp.amount,
        0,
      );

      await apiRequest("POST", `/api/time-entries/${jobId}`, {
        entries: formattedEntries,
        rounding,
        travelTime,
        additionalCosts: totalAdditionalCosts,
        expenseItems: expenses, // Send individual expense items for tracking
      });

      // Invalidate related queries
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      await queryClient.invalidateQueries({
        queryKey: ["time-entries", jobId],
      });

      await refetchTimeEntries();

      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save time entries",
        variant: "destructive",
      });
    }
  };

  // Format duration for display
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-full h-[100dvh] overflow-y-auto sm:max-w-4xl sm:max-h-[90vh] sm:h-auto p-4 pt-safe"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute left-2 top-14 sm:top-2 h-10 w-10 z-10"
          data-testid="button-close-modal"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="space-y-4">
          {/* Add Time Form - Always Visible */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 space-y-3 pt-10">
            <h4 className="font-medium text-blue-900 text-sm sm:text-base">
              Add Staff Time Entry
            </h4>

            <div className="grid grid-cols-1 gap-3">
              {/* Staff Selection - Inline list for mobile compatibility */}
              <div>
                <label className="text-sm font-medium flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Staff ({newEntry.staffIds.length} selected)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() => {
                        const allIds = employees.map((e: any) => e.id);
                        setNewEntry((prev) => ({ ...prev, staffIds: allIds }));
                      }}
                      data-testid="button-select-all-staff"
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() =>
                        setNewEntry((prev) => ({ ...prev, staffIds: [] }))
                      }
                      data-testid="button-clear-staff"
                    >
                      Clear
                    </Button>
                  </div>
                </label>
                <div className="bg-white border rounded-lg p-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {employees.map((staff: any) => {
                    const isSelected = newEntry.staffIds.includes(staff.id);
                    return (
                      <label
                        key={staff.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer text-sm ${
                          isSelected
                            ? "bg-blue-100 border border-blue-300"
                            : "hover:bg-gray-50 border border-transparent"
                        }`}
                        data-testid={`staff-option-${staff.id}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            setNewEntry((prev) => ({
                              ...prev,
                              staffIds: checked
                                ? [...prev.staffIds, staff.id]
                                : prev.staffIds.filter((id) => id !== staff.id),
                            }));
                          }}
                        />
                        <span className="truncate">{staff.firstName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="bg-blue-100 border border-blue-200 rounded p-2">
                <p className="text-xs text-blue-800">
                  <strong>Auto-Rate Matching:</strong> Staff are matched to
                  billing rates: Dan→1, Josh→3, Kalsey→4, Jack→5, Jullian→14
                </p>
              </div>

              <div>
                <label className="text-sm font-medium flex items-center justify-between">
                  <span>Duration</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1 min-h-11 sm:min-h-0 sm:p-0 text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => setUseManualInput(!useManualInput)}
                    data-testid="button-toggle-manual"
                  >
                    {useManualInput ? "Use Dropdown" : "Manual Input"}
                  </Button>
                </label>
                {useManualInput ? (
                  <Input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="12"
                    value={newEntry.duration}
                    onChange={(e) =>
                      setNewEntry((prev) => ({
                        ...prev,
                        duration: e.target.value,
                      }))
                    }
                    placeholder="Hours (e.g. 1.5)"
                    className="min-h-11"
                    data-testid="input-duration-manual"
                  />
                ) : (
                  <Select
                    value={newEntry.duration}
                    onValueChange={(value) =>
                      setNewEntry((prev) => ({ ...prev, duration: value }))
                    }
                    data-testid="select-duration"
                  >
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={addToPendingList}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 w-full sm:w-auto min-h-11"
                data-testid="button-add-entry"
              >
                <Plus className="h-4 w-4" />
                Add to List
              </Button>
            </div>
          </div>

          {/* Pending Entries List */}
          {pendingEntries.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-1.5 py-1">
                <h4 className="font-medium text-gray-900 text-xs">
                  Pending Entries ({pendingEntries.length})
                </h4>
              </div>

              <div className="divide-y divide-gray-100">
                {pendingEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-1 hover:bg-gray-50 flex flex-col sm:flex-row gap-1 sm:items-center sm:justify-between"
                    data-testid={`entry-${entry.id}`}
                  >
                    <div className="flex-1 grid grid-cols-2 gap-1">
                      <div>
                        <div className="text-[8px] text-gray-500">Staff</div>
                        <div className="font-medium text-[10px]">
                          {entry.staffName}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] text-gray-500">Time</div>
                        <div className="text-[10px] font-medium">
                          {formatDuration(entry.duration)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePendingEntry(entry.id)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 h-6 px-1"
                      data-testid={`button-remove-${entry.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing Saved Entries */}
          {existingEntries.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-emerald-50 border-b border-emerald-200 px-1.5 py-1 flex items-center justify-between gap-2">
                <h4 className="font-medium text-emerald-900 text-xs">
                  Saved Today ({existingEntries.length})
                </h4>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => timeToLineItemsMutation.mutate()}
                  disabled={timeToLineItemsMutation.isPending}
                  className="h-7 text-xs px-2 gap-1"
                  data-testid="button-bill-time-to-invoice"
                >
                  <Receipt className="h-3 w-3" />
                  {timeToLineItemsMutation.isPending ? "Adding…" : "Add to Invoice"}
                </Button>
              </div>

              <div className="divide-y divide-gray-100">
                {existingEntries.map((entry: any, idx: number) => (
                  <div
                    key={entry.id || idx}
                    className="p-1 bg-white hover:bg-gray-50 flex flex-col sm:flex-row gap-1 sm:items-center sm:justify-between"
                    data-testid={`saved-entry-${entry.id}`}
                  >
                    <div className="flex-1 grid grid-cols-2 gap-1">
                      <div>
                        <div className="text-[8px] text-gray-500">Staff</div>
                        <div className="font-medium text-[10px]">
                          {entry.employeeName}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] text-gray-500">Time</div>
                        <div className="text-[10px] font-medium">
                          {formatDuration(entry.hours)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        deleteTimeEntryMutation.mutate({
                          entryId: entry.id,
                          index: entry.index ?? idx,
                        })
                      }
                      disabled={deleteTimeEntryMutation.isPending}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 h-6 px-1"
                      data-testid={`button-delete-${entry.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Costs / Expenses */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4 space-y-3">
            <h4 className="font-medium text-amber-900 text-sm sm:text-base">
              Additional Costs
            </h4>

            {/* Add Expense Form */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                value={newExpense.description}
                onChange={(e) =>
                  setNewExpense((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Description (e.g., Dump fees, Fuel)"
                className="min-h-11 flex-1"
                data-testid="input-expense-description"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newExpense.amount}
                onChange={(e) =>
                  setNewExpense((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="Amount ($)"
                className="min-h-11 w-full sm:w-32"
                data-testid="input-expense-amount"
              />
              <Button
                onClick={() => {
                  if (!newExpense.description.trim() || !newExpense.amount) {
                    toast({
                      title: "Missing info",
                      description: "Please enter description and amount",
                      variant: "destructive",
                    });
                    return;
                  }
                  const amount = parseFloat(newExpense.amount);
                  if (isNaN(amount) || amount <= 0) {
                    toast({
                      title: "Invalid amount",
                      description: "Please enter a valid amount",
                      variant: "destructive",
                    });
                    return;
                  }
                  setExpenses((prev) => [
                    ...prev,
                    {
                      id: `expense-${Date.now()}`,
                      description: newExpense.description.trim(),
                      amount,
                    },
                  ]);
                  setNewExpense({ description: "", amount: "" });
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white min-h-11"
                data-testid="button-add-expense"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {/* Expense List */}
            {expenses.length > 0 && (
              <div className="space-y-2 mt-3">
                <div className="text-sm font-medium text-amber-800">
                  Added Expenses ({expenses.length})
                </div>
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between bg-white rounded-md p-2 border border-amber-200"
                  >
                    <span className="text-sm">{expense.description}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        ${expense.amount.toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setExpenses((prev) =>
                            prev.filter((e) => e.id !== expense.id),
                          )
                        }
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        data-testid={`button-delete-expense-${expense.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-2 border-t border-amber-200">
                  <span className="text-sm font-medium text-amber-900">
                    Total: $
                    {expenses
                      .reduce((sum, exp) => sum + exp.amount, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-600">
              Track costs beyond staff time (materials, equipment rentals,
              permits, dump fees, etc.)
            </p>
          </div>

          {/* Save Button */}
          {(pendingEntries.length > 0 || expenses.length > 0) && (
            <div className="sticky bottom-0 bg-white border-t pt-4 flex justify-end gap-2">
              <Button
                onClick={saveAllEntries}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 w-full sm:w-auto min-h-11"
                data-testid="button-save-all"
              >
                <CheckCircle className="h-4 w-4" />
                Save All Entries
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
