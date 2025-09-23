import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { 
  X, 
  Plus, 
  Clock, 
  CheckCircle, 
  Settings,
  Calendar,
  User
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Job, Employee } from "@shared/schema";

// Individual staff assignment schema
const staffAssignmentSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  employeeName: z.string().min(1, "Employee name is required"),
  lineItemId: z.string().min(1, "Line item is required"),
  lineItemNumber: z.string().min(1, "Line item number is required"),
  lineItemName: z.string().min(1, "Line item name is required"),
  lineItemCategory: z.string().min(1, "Line item category is required"),
  hours: z.string().min(1, "Hours are required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Hours must be a positive number"),
  startTime: z.string().optional(),
  billed: z.boolean().default(false),
});

// ServiceM8-style time entry form schema
const timeEntrySchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  staffAssignments: z.array(staffAssignmentSchema).min(1, "At least one staff assignment is required"),
});

const dailyTimeSchema = z.object({
  totalDayHours: z.string().min(1, "Total day hours required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Total hours must be positive"),
  maintenanceHours: z.string().default("0"),
  travelHours: z.string().default("0"),
  adminHours: z.string().default("0"),
  breakHours: z.string().default("0"),
  roundingMode: z.enum(["none", "15min", "30min", "1hour"]).default("none"),
  travelTimeMode: z.enum(["included", "excluded", "separate"]).default("included"),
});

type TimeEntryFormData = z.infer<typeof timeEntrySchema>;
type StaffAssignment = z.infer<typeof staffAssignmentSchema>;
type DailyTimeFormData = z.infer<typeof dailyTimeSchema>;

interface ServiceM8TimeRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber?: string;
  employeeId?: string;
  entryDate?: string;
}

interface TimeEntry {
  id?: string;
  jobId: string;
  jobNumber: string;
  employeeId: string;
  employeeName: string;
  lineItemId: string;
  lineItemNumber: string;
  lineItemName: string;
  lineItemCategory: string;
  hours: number;
  rate: number;
  startTime?: string;
  billed: boolean;
  amount: number;
}

interface MaterialServiceItem {
  id: string;
  itemNumber: string;
  name: string;
  price: number;
  category: string;
  type: "material" | "service";
}

export function ServiceM8TimeRecordingModal({
  isOpen,
  onClose,
  jobId,
  jobNumber = "#3292",
  employeeId,
  entryDate = new Date().toISOString().split('T')[0]
}: ServiceM8TimeRecordingModalProps) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<Employee[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [employeeLineItems, setEmployeeLineItems] = useState<Record<string, MaterialServiceItem[]>>({});
  const [showingStaffSelection, setShowingStaffSelection] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Forms
  const entryForm = useForm<TimeEntryFormData>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      jobId,
      staffAssignments: [],
    }
  });

  const dailyForm = useForm<DailyTimeFormData>({
    resolver: zodResolver(dailyTimeSchema),
    defaultValues: {
      totalDayHours: "8.0",
      maintenanceHours: "0",
      travelHours: "0", 
      adminHours: "0",
      breakHours: "0",
      roundingMode: "none",
      travelTimeMode: "included",
    }
  });

  // Fetch employees
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees'],
    enabled: isOpen,
  });

  // Fetch jobs for dropdown
  const { data: jobsData } = useQuery({
    queryKey: ['/api/jobs'],
    enabled: isOpen,
  });

  // Fetch Materials & Services line items
  const { data: materialsServicesData } = useQuery({
    queryKey: ['/api/materials-services'],
    enabled: isOpen,
  });

  // Get filtered line items for specific employees
  const getFilteredItemsForEmployee = async (employeeId: string): Promise<MaterialServiceItem[]> => {
    const response = await fetch(`/api/materials-services/filtered/${employeeId}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch filtered items for employee ${employeeId}: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    return result.data || [];
  };

  // Get rate for line item
  const getLineItemRate = (lineItemId: string): number => {
    const allItems = materialsServicesData?.data || [];
    const item = allItems.find((item: MaterialServiceItem) => item.id === lineItemId);
    return item?.price || 0;
  };

  // Fetch existing time entries for this job/date
  const { data: existingEntries, isLoading } = useQuery({
    queryKey: ['/api/time-entries', jobId, entryDate],
    queryFn: async () => {
      const response = await fetch(`/api/time-entries/${jobId}/${entryDate}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      return await response.json();
    },
    enabled: isOpen && !!jobId,
  });

  const employees = (employeesData as any)?.data || [];
  const jobs = (jobsData as any)?.data || [];
  const allLineItems = materialsServicesData?.data || [];

  // Add staff member for assignment with skill-based filtering
  const addStaffAssignment = async (employeeId: string) => {
    if (selectedStaffIds.includes(employeeId)) return;
    
    const employee = employees.find((e: any) => e.id === employeeId);
    if (!employee) return;
    
    // Fetch filtered line items for this specific employee
    try {
      const filteredItems = await getFilteredItemsForEmployee(employeeId);
      setEmployeeLineItems(prev => ({
        ...prev,
        [employeeId]: filteredItems
      }));
    } catch (error) {
      console.error('Failed to load filtered line items for employee:', error);
      // Fallback to all items if filtering fails
      setEmployeeLineItems(prev => ({
        ...prev,
        [employeeId]: allLineItems
      }));
      toast({
        title: "Warning",
        description: "Could not load skill-specific items. Showing all items instead.",
        variant: "destructive"
      });
    }
    
    setSelectedStaffIds(prev => [...prev, employeeId]);
    
    // Add to form staffAssignments
    const currentAssignments = entryForm.getValues("staffAssignments") || [];
    entryForm.setValue("staffAssignments", [
      ...currentAssignments,
      {
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        lineItemId: "",
        lineItemNumber: "",
        lineItemName: "",
        lineItemCategory: "",
        hours: "8.0",
        startTime: "08:00",
        billed: false,
      }
    ]);
  };
  
  // Remove staff assignment
  const removeStaffAssignment = (index: number) => {
    const currentAssignments = entryForm.getValues("staffAssignments") || [];
    const removedAssignment = currentAssignments[index];
    
    setSelectedStaffIds(prev => prev.filter(id => id !== removedAssignment.employeeId));
    
    const newAssignments = currentAssignments.filter((_, i) => i !== index);
    entryForm.setValue("staffAssignments", newAssignments);
  };

  // Calculate efficiency metrics
  const calculateEfficiency = () => {
    const totalDayHours = Number(dailyForm.watch("totalDayHours")) || 8;
    const billableHours = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const maintenanceHours = Number(dailyForm.watch("maintenanceHours")) || 0;
    const travelHours = Number(dailyForm.watch("travelHours")) || 0;
    const adminHours = Number(dailyForm.watch("adminHours")) || 0;
    const breakHours = Number(dailyForm.watch("breakHours")) || 0;

    const totalRecordedHours = billableHours + maintenanceHours + travelHours + adminHours + breakHours;
    const jobEfficiency = totalDayHours > 0 ? (billableHours / totalDayHours) * 100 : 0;
    const utilizationRate = totalDayHours > 0 ? ((billableHours + travelHours) / totalDayHours) * 100 : 0;
    const totalRevenue = timeEntries.reduce((sum, entry) => sum + entry.amount, 0);

    return {
      jobEfficiency: Math.round(jobEfficiency * 100) / 100,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      billableHours,
      totalDayHours,
      totalRevenue,
      totalRecordedHours,
      remainingHours: Math.max(0, totalDayHours - totalRecordedHours)
    };
  };

  const efficiency = calculateEfficiency();

  // Add new time entries from staff assignments  
  const handleAddEntry = (data: TimeEntryFormData) => {
    const jobs = (jobsData as any)?.data || jobsData || [];
    const job = jobs.find((j: any) => j.id === data.jobId);
    
    if (data.staffAssignments.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one staff assignment",
        variant: "destructive"
      });
      return;
    }

    const newEntries: TimeEntry[] = [];

    // Create a time entry for each staff assignment
    data.staffAssignments.forEach(assignment => {
      const hours = Number(assignment.hours);
      const rate = getLineItemRate(assignment.lineItemId);
      const amount = hours * rate;

      const newEntry: TimeEntry = {
        id: `temp-${Date.now()}-${assignment.employeeId}`,
        jobId: data.jobId,
        jobNumber: job?.jobNumber || jobNumber,
        employeeId: assignment.employeeId,
        employeeName: assignment.employeeName,
        lineItemId: assignment.lineItemId,
        lineItemNumber: assignment.lineItemNumber,
        lineItemName: assignment.lineItemName,
        lineItemCategory: assignment.lineItemCategory,
        hours,
        rate,
        startTime: assignment.startTime,
        billed: assignment.billed,
        amount
      };

      newEntries.push(newEntry);
    });

    setTimeEntries(prev => [...prev, ...newEntries]);
    setIsAddingEntry(false);
    entryForm.reset({
      jobId,
      staffAssignments: [],
    });
    setSelectedStaffIds([]);

    toast({
      title: "Time Entries Added", 
      description: `Time entries added for ${newEntries.length} staff assignment(s)`,
    });
  };

  // Toggle billing status
  const toggleBilled = (entryId: string) => {
    setTimeEntries(prev => 
      prev.map(entry => 
        entry.id === entryId 
          ? { ...entry, billed: !entry.billed }
          : entry
      )
    );
  };

  // Remove entry
  const removeEntry = (entryId: string) => {
    setTimeEntries(prev => prev.filter(entry => entry.id !== entryId));
  };


  // Save all entries
  const saveMutation = useMutation({
    mutationFn: async () => {
      const dailyData = dailyForm.getValues();
      const currentEmployeeId = employeeId || timeEntries[0]?.employeeId;
      const currentEmployeeName = timeEntries[0]?.employeeName || (
        employees.find((emp: any) => emp.id === currentEmployeeId) ? 
        `${employees.find((emp: any) => emp.id === currentEmployeeId).firstName} ${employees.find((emp: any) => emp.id === currentEmployeeId).lastName}` : 
        ''
      );
      
      const requestData = {
        jobId,
        employeeId: currentEmployeeId,
        employeeName: currentEmployeeName,
        entryDate,
        totalDayHours: Number(dailyData.totalDayHours),
        timeEntries: timeEntries.map(entry => ({
          jobId: entry.jobId,
          jobNumber: entry.jobNumber,
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          lineItemId: entry.lineItemId,
          lineItemNumber: entry.lineItemNumber,
          lineItemName: entry.lineItemName,
          lineItemCategory: entry.lineItemCategory,
          hours: entry.hours,
          rate: entry.rate,
          startTime: entry.startTime,
          billed: entry.billed,
        })),
        maintenanceHours: Number(dailyData.maintenanceHours),
        travelHours: Number(dailyData.travelHours),
        adminHours: Number(dailyData.adminHours),
        breakHours: Number(dailyData.breakHours),
        roundingMode: dailyData.roundingMode,
        travelTimeMode: dailyData.travelTimeMode,
        efficiency: efficiency,
      };

      return apiRequest('POST', '/api/time-entries/daily', requestData);
    },
    onSuccess: () => {
      toast({
        title: "Time Entries Saved",
        description: `Recorded ${timeEntries.length} job entries with ${efficiency.jobEfficiency}% efficiency`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error Saving Time Entries",
        description: error.message || "Failed to save time entries",
        variant: "destructive"
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="servicem8-time-modal">
        {/* ServiceM8-style header */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900" data-testid="modal-title">
              Job {jobNumber} Recorded Time
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {/* Add Time Button */}
          <div className="mb-6">
            <Button 
              onClick={() => setIsAddingEntry(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-add-time"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Time
            </Button>
          </div>

          {/* Time Entries Table - ServiceM8 Style */}
          <div className="mb-6 border rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b">
              <div className="grid grid-cols-7 gap-4 p-3 text-sm font-medium text-gray-700">
                <div data-testid="header-date">Date</div>
                <div data-testid="header-staff">Staff</div>
                <div data-testid="header-rate">Rate</div>
                <div data-testid="header-start">Start</div>
                <div data-testid="header-duration">Duration</div>
                <div data-testid="header-billed">Billed</div>
                <div data-testid="header-actions">Actions</div>
              </div>
            </div>
            
            <div className="divide-y">
              {timeEntries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-7 gap-4 p-3 items-center hover:bg-gray-50">
                  <div className="text-sm" data-testid={`entry-date-${entry.id}`}>
                    {entryDate}
                  </div>
                  <div className="text-sm font-medium" data-testid={`entry-staff-${entry.id}`}>
                    {entry.employeeName}
                  </div>
                  <div className="text-sm" data-testid={`entry-rate-${entry.id}`}>
                    {entry.lineItemNumber}
                  </div>
                  <div className="text-sm" data-testid={`entry-start-${entry.id}`}>
                    {entry.startTime || "-"}
                  </div>
                  <div className="text-sm" data-testid={`entry-hours-${entry.id}`}>
                    {entry.hours} hours
                  </div>
                  <div className="flex items-center" data-testid={`entry-billed-${entry.id}`}>
                    <button
                      onClick={() => toggleBilled(entry.id!)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        entry.billed 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {entry.billed && <CheckCircle className="w-4 h-4" />}
                    </button>
                  </div>
                  <div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeEntry(entry.id!)}
                      className="text-red-600 hover:text-red-700"
                      data-testid={`button-remove-${entry.id}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}

              {timeEntries.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No time entries recorded yet. Click "Add Time" to get started.
                </div>
              )}
            </div>
          </div>

          {/* Add Time Form */}
          {isAddingEntry && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Add Staff Time Entries</h3>
                
                {/* Available Staff Selection */}
                {(selectedStaffIds.length === 0 || showingStaffSelection) && (
                  <div>
                    <div className="text-base font-semibold">
                      {selectedStaffIds.length === 0 ? "Select Staff Members" : "Add Another Staff Member"}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {employees
                        .filter((employee: any) => !selectedStaffIds.includes(employee.id))
                        .map((employee: any) => (
                          <Button
                            key={employee.id}
                            type="button"
                            variant="outline"
                            onClick={() => {
                              addStaffAssignment(employee.id);
                              setShowingStaffSelection(false);
                            }}
                            className="justify-start"
                            data-testid={`button-add-staff-${employee.id}`}
                          >
                            <User className="w-4 h-4 mr-2" />
                            {employee.firstName} {employee.lastName}
                          </Button>
                        ))}
                    </div>
                    {selectedStaffIds.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowingStaffSelection(false)}
                        className="mt-2"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                )}

                {/* Individual Staff Assignments */}
                <Form {...entryForm}>
                  <form onSubmit={entryForm.handleSubmit(handleAddEntry)} className="space-y-6">
                    {entryForm.watch("staffAssignments").map((assignment, index) => (
                      <div key={assignment.employeeId} className="p-4 border rounded-lg bg-white">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {assignment.employeeName}
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStaffAssignment(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {/* Line Item Selection */}
                          <FormField
                            control={entryForm.control}
                            name={`staffAssignments.${index}.lineItemId`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Service/Line Item</FormLabel>
                                <Select 
                                  onValueChange={(value) => {
                                    const item = allLineItems.find((item: MaterialServiceItem) => item.id === value);
                                    if (item) {
                                      field.onChange(value);
                                      entryForm.setValue(`staffAssignments.${index}.lineItemNumber`, item.itemNumber);
                                      entryForm.setValue(`staffAssignments.${index}.lineItemName`, item.name);
                                      entryForm.setValue(`staffAssignments.${index}.lineItemCategory`, item.category);
                                    }
                                  }}
                                  value={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger data-testid={`select-line-item-${index}`}>
                                      <SelectValue placeholder="Select line item" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(employeeLineItems[assignment.employeeId] || allLineItems).map((item: MaterialServiceItem) => (
                                      <SelectItem key={item.id} value={item.id}>
                                        {item.itemNumber} - {item.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Hours */}
                          <FormField
                            control={entryForm.control}
                            name={`staffAssignments.${index}.hours`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Hours</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.25"
                                    min="0"
                                    placeholder="8.0"
                                    {...field}
                                    data-testid={`input-hours-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Start Time */}
                          <FormField
                            control={entryForm.control}
                            name={`staffAssignments.${index}.startTime`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Start Time</FormLabel>
                                <FormControl>
                                  <Input
                                    type="time"
                                    {...field}
                                    data-testid={`input-start-time-${index}`}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Billed */}
                          <FormField
                            control={entryForm.control}
                            name={`staffAssignments.${index}.billed`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid={`checkbox-billed-${index}`}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Billable</FormLabel>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Add More Staff Button */}
                    {selectedStaffIds.length > 0 && selectedStaffIds.length < employees.length && !showingStaffSelection && (
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const availableStaff = employees.filter((emp: any) => 
                              !selectedStaffIds.includes(emp.id)
                            );
                            if (availableStaff.length === 1) {
                              // If only one staff left, add them directly
                              addStaffAssignment(availableStaff[0].id);
                            } else {
                              // If multiple staff available, show selection interface
                              setShowingStaffSelection(true);
                            }
                          }}
                          className="w-full"
                          data-testid="button-add-another-staff"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Another Staff Member
                        </Button>
                      </div>
                    )}

                    {/* Form Actions */}
                    {selectedStaffIds.length > 0 && (
                      <div className="flex gap-3 pt-4 border-t">
                        <Button
                          type="submit"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid="button-save-time-entries"
                        >
                          Add Time Entries
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddingEntry(false);
                            setSelectedStaffIds([]);
                            setShowingStaffSelection(false);
                            entryForm.reset({
                              jobId,
                              staffAssignments: [],
                            });
                          }}
                          data-testid="button-cancel-time-entries"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </form>
                </Form>
              </div>
            </div>
          )}

          {/* Daily Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Time Breakdown */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Daily Time Summary</h3>
              
              <Form {...dailyForm}>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={dailyForm.control}
                    name="totalDayHours"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">Total Day Hours</label>
                        <FormControl>
                          <Input {...field} type="number" step="0.25" data-testid="input-total-hours" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={dailyForm.control}
                    name="maintenanceHours"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">Maintenance</label>
                        <FormControl>
                          <Input {...field} type="number" step="0.25" data-testid="input-maintenance-hours" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={dailyForm.control}
                    name="travelHours"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">Travel</label>
                        <FormControl>
                          <Input {...field} type="number" step="0.25" data-testid="input-travel-hours" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={dailyForm.control}
                    name="adminHours"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-sm font-medium">Admin</label>
                        <FormControl>
                          <Input {...field} type="number" step="0.25" data-testid="input-admin-hours" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </Form>
            </div>

            {/* Efficiency Metrics */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Efficiency Metrics</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Job Efficiency:</span>
                  <Badge 
                    variant={efficiency.jobEfficiency >= 60 ? "default" : "destructive"}
                    data-testid="badge-job-efficiency"
                  >
                    {efficiency.jobEfficiency.toFixed(1)}%
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Utilization Rate:</span>
                  <Badge 
                    variant={efficiency.utilizationRate >= 80 ? "default" : "secondary"}
                    data-testid="badge-utilization"
                  >
                    {efficiency.utilizationRate.toFixed(1)}%
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Billable Hours:</span>
                  <span className="text-sm font-medium" data-testid="text-billable-hours">
                    {efficiency.billableHours} / {efficiency.totalDayHours}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Revenue:</span>
                  <span className="text-sm font-medium text-green-600" data-testid="text-total-revenue">
                    ${efficiency.totalRevenue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ServiceM8-style Footer Settings */}
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <Form {...dailyForm}>
              <FormField
                control={dailyForm.control}
                name="roundingMode"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Rounding:</label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-rounding">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="15min">15 minutes</SelectItem>
                        <SelectItem value="30min">30 minutes</SelectItem>
                        <SelectItem value="1hour">1 hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={dailyForm.control}
                name="travelTimeMode"
                render={({ field }) => (
                  <FormItem>
                    <label className="text-sm font-medium">Travel Time:</label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-travel">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="included">Included</SelectItem>
                        <SelectItem value="excluded">Excluded</SelectItem>
                        <SelectItem value="separate">Separate</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </Form>
          </div>
        </div>

        {/* ServiceM8-style Footer Buttons */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-close-footer"
          >
            Close
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={timeEntries.length === 0 || saveMutation.isPending}
            data-testid="button-save"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}