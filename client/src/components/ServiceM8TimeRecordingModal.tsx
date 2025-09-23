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

// ServiceM8-style time entry form schema
const timeEntrySchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  selectedStaff: z.array(z.string()).min(1, "At least one staff member is required"),
  serviceType: z.string().min(1, "Service is required"),
  serviceName: z.string().min(1, "Service name is required"),
  hours: z.string().min(1, "Hours are required").refine(val => !isNaN(Number(val)) && Number(val) > 0, "Hours must be a positive number"),
  startTime: z.string().optional(),
  billed: z.boolean().default(false),
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
  serviceType: string;
  serviceName: string;
  hours: number;
  rate: number;
  startTime?: string;
  billed: boolean;
  amount: number;
}

interface ServiceOption {
  id: string;
  name: string;
  type: string;
  requiredSkills: string[];
  baseRate: number;
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Forms
  const entryForm = useForm<TimeEntryFormData>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      jobId,
      selectedStaff: employeeId ? [employeeId] : [],
      serviceType: "",
      serviceName: "",
      hours: "",
      startTime: "",
      billed: false,
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

  // Fetch staff rates for service pricing
  const { data: staffRatesData } = useQuery({
    queryKey: ['/api/staff-rates'],
    enabled: isOpen,
  });

  // Service options with skill requirements
  const serviceOptions: ServiceOption[] = [
    { id: "tree_removal", name: "Tree Removal", type: "tree_removal", requiredSkills: ["Tree Climbing", "Chainsaw Operation"], baseRate: 85 },
    { id: "pruning", name: "Tree Pruning", type: "pruning", requiredSkills: ["Tree Pruning", "Tree Climbing"], baseRate: 75 },
    { id: "hedge_trimming", name: "Hedge Trimming", type: "hedge_trimming", requiredSkills: ["Hedge Trimming"], baseRate: 65 },
    { id: "stump_grinding", name: "Stump Grinding", type: "stump_grinding", requiredSkills: ["Heavy Machinery"], baseRate: 90 },
    { id: "crane_operation", name: "Crane-Assisted Removal", type: "crane_operation", requiredSkills: ["Crane Operation", "Heavy Machinery"], baseRate: 120 },
    { id: "emergency_service", name: "Emergency Tree Service", type: "emergency_service", requiredSkills: ["Risk Assessment", "Chainsaw Operation"], baseRate: 150 },
    { id: "ground_support", name: "Ground Support", type: "ground_support", requiredSkills: ["Ground Support", "Basic Tree Care"], baseRate: 45 },
  ];

  // Filter available services based on selected staff skills
  const getAvailableServices = (selectedStaffIds: string[]): ServiceOption[] => {
    if (!selectedStaffIds.length || !employeesData) return [];
    
    const employees = (employeesData as any)?.data || employeesData || [];
    const selectedEmployees = employees.filter((emp: Employee) => 
      selectedStaffIds.includes(emp.id)
    );
    
    // Get combined skills of all selected staff
    const combinedSkills = new Set<string>();
    selectedEmployees.forEach((emp: Employee) => {
      emp.skills?.forEach(skill => combinedSkills.add(skill));
    });
    
    // Filter services that can be performed by selected staff
    return serviceOptions.filter(service => 
      service.requiredSkills.some(reqSkill => combinedSkills.has(reqSkill))
    );
  };

  // Get rate for staff member and service type
  const getStaffServiceRate = (employeeId: string, serviceType: string): number => {
    if (!staffRatesData) return 0;
    
    const rates = (staffRatesData as any)?.data || staffRatesData || [];
    const staffRate = rates.find((rate: any) => 
      rate.employeeId === employeeId && rate.serviceType === serviceType && rate.isActive
    );
    
    if (staffRate) return Number(staffRate.hourlyRate);
    
    // Fallback to service base rate
    const service = serviceOptions.find(s => s.type === serviceType);
    return service?.baseRate || 75;
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

  // Add new time entry
  const handleAddEntry = (data: TimeEntryFormData) => {
    const employees = (employeesData as any)?.data || employeesData || [];
    const jobs = (jobsData as any)?.data || jobsData || [];
    const job = jobs.find((j: any) => j.id === data.jobId);
    
    if (data.selectedStaff.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one staff member",
        variant: "destructive"
      });
      return;
    }

    const hours = Number(data.hours);
    const newEntries: TimeEntry[] = [];

    // Create a time entry for each selected staff member
    data.selectedStaff.forEach(employeeId => {
      const employee = employees.find((e: any) => e.id === employeeId);
      if (!employee) return;

      const rate = getStaffServiceRate(employeeId, data.serviceType);
      const amount = hours * rate;

      const newEntry: TimeEntry = {
        id: `temp-${Date.now()}-${employeeId}`,
        jobId: data.jobId,
        jobNumber: job?.jobNumber || jobNumber,
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        serviceType: data.serviceType,
        serviceName: data.serviceName,
        hours,
        rate,
        startTime: data.startTime,
        billed: data.billed,
        amount
      };

      newEntries.push(newEntry);
    });

    setTimeEntries(prev => [...prev, ...newEntries]);
    setIsAddingEntry(false);
    entryForm.reset({
      jobId,
      selectedStaff: [],
      serviceType: "",
      serviceName: "",
      hours: "",
      startTime: "",
      billed: false,
    });

    toast({
      title: "Time Entries Added",
      description: `${hours} hours of ${data.serviceName} added for ${newEntries.length} staff member(s)`,
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
          serviceType: entry.serviceType,
          serviceName: entry.serviceName,
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
                    labour ${entry.rate}
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
              <Form {...entryForm}>
                <form onSubmit={entryForm.handleSubmit(handleAddEntry)} className="space-y-4">
                  
                  {/* Multi-Staff Selection */}
                  <FormField
                    control={entryForm.control}
                    name="selectedStaff"
                    render={() => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">Select Staff Members</FormLabel>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          {((employeesData as any)?.data || employeesData || []).map((employee: any) => (
                            <FormField
                              key={employee.id}
                              control={entryForm.control}
                              name="selectedStaff"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={employee.id}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(employee.id)}
                                        onCheckedChange={(checked) => {
                                          const current = field.value || [];
                                          if (checked) {
                                            field.onChange([...current, employee.id]);
                                          } else {
                                            field.onChange(current.filter((id: string) => id !== employee.id));
                                          }
                                        }}
                                        data-testid={`checkbox-staff-${employee.id}`}
                                      />
                                    </FormControl>
                                    <div className="space-y-1">
                                      <FormLabel className="text-sm font-normal cursor-pointer">
                                        {employee.firstName} {employee.lastName}
                                      </FormLabel>
                                      <p className="text-xs text-gray-500">
                                        {employee.skills?.slice(0, 2).join(", ")} {employee.skills?.length > 2 && "..."}
                                      </p>
                                    </div>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Service Selection (filtered by staff skills) */}
                  <FormField
                    control={entryForm.control}
                    name="serviceType"
                    render={({ field }) => {
                      const selectedStaff = entryForm.watch("selectedStaff") || [];
                      const availableServices = getAvailableServices(selectedStaff);
                      
                      return (
                        <FormItem>
                          <FormLabel>Service Type</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              const service = serviceOptions.find(s => s.type === value);
                              field.onChange(value);
                              entryForm.setValue("serviceName", service?.name || "");
                            }} 
                            value={field.value}
                            disabled={selectedStaff.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-service">
                                <SelectValue placeholder={
                                  selectedStaff.length === 0 
                                    ? "Select staff first..." 
                                    : "Select service..."
                                } />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableServices.map((service) => (
                                <SelectItem 
                                  key={service.id} 
                                  value={service.type}
                                  data-testid={`select-service-${service.id}`}
                                >
                                  <div className="flex flex-col">
                                    <span>{service.name}</span>
                                    <span className="text-xs text-gray-500">
                                      ${service.baseRate}/hr • Requires: {service.requiredSkills.join(", ")}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={entryForm.control}
                      name="hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hours</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="8.0" 
                              type="number" 
                              step="0.25"
                              data-testid="input-hours"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={entryForm.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="08:00" 
                              type="time"
                              data-testid="input-start-time"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <FormField
                      control={entryForm.control}
                      name="billed"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-billed"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">
                            Mark as billed
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" data-testid="button-save-entry">
                      Add Entry
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAddingEntry(false)}
                      data-testid="button-cancel-entry"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
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
                        <FormLabel className="text-sm">Total Day Hours</FormLabel>
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
                        <FormLabel className="text-sm">Maintenance</FormLabel>
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
                        <FormLabel className="text-sm">Travel</FormLabel>
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
                        <FormLabel className="text-sm">Admin</FormLabel>
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
                    <FormLabel className="text-sm font-medium">Rounding:</FormLabel>
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
                    <FormLabel className="text-sm font-medium">Travel Time:</FormLabel>
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