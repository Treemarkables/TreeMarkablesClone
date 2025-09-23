import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Clock, User, Edit2, Trash2, Save, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Staff time entry schema
const staffTimeEntrySchema = z.object({
  employeeId: z.string().min(1, "Please select a staff member"),
  hours: z.string().min(1, "Hours are required"),
  rate: z.string().min(1, "Rate is required"),
  date: z.string().min(1, "Date is required"),
});

type StaffTimeEntryFormData = z.infer<typeof staffTimeEntrySchema>;

interface StaffTimeEntry {
  id?: string;
  employeeId: string;
  hours: number;
  rate: number;
  date: string;
  employeeName?: string;
}

interface StaffTimeManagerProps {
  jobId: string;
  compact?: boolean;
}

export function StaffTimeManager({ jobId, compact = false }: StaffTimeManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<StaffTimeEntry | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch employees
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees'],
    enabled: isAddDialogOpen || !!editingEntry,
  });

  // Fetch staff time entries for the job
  const { data: staffTimeData, isLoading } = useQuery({
    queryKey: ['/api/jobs', jobId, 'staff-time'],
    enabled: !!jobId,
  });

  const employees = (employeesData as any)?.data || [];
  const staffTimeEntries = (staffTimeData as any)?.data || [];

  // Form for adding/editing staff time entries
  const form = useForm<StaffTimeEntryFormData>({
    resolver: zodResolver(staffTimeEntrySchema),
    defaultValues: {
      employeeId: "",
      hours: "",
      rate: "",
      date: new Date().toISOString().split('T')[0], // Today's date
    },
  });

  // Reset form when editing entry changes
  useEffect(() => {
    if (editingEntry) {
      form.reset({
        employeeId: editingEntry.employeeId,
        hours: editingEntry.hours?.toString() || '',
        rate: editingEntry.rate?.toString() || '',
        date: editingEntry.date,
      });
    } else {
      form.reset({
        employeeId: "",
        hours: "",
        rate: "",
        date: new Date().toISOString().split('T')[0],
      });
    }
  }, [editingEntry, form]);

  // Auto-fill rate when employee is selected
  const handleEmployeeChange = (employeeId: string) => {
    const employee = employees.find((emp: any) => emp.id === employeeId);
    if (employee && employee.hourlyRate) {
      form.setValue('rate', employee.hourlyRate.toString());
    }
  };

  // Add staff time entry mutation
  const addStaffTimeMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', `/api/jobs/${jobId}/staff-time`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'staff-time'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setIsAddDialogOpen(false);
      setEditingEntry(null);
      form.reset();
      toast({
        title: "Success",
        description: "Staff time entry added successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to add staff time entry",
        variant: "destructive"
      });
    }
  });

  // Remove staff time entry mutation
  const removeStaffTimeMutation = useMutation({
    mutationFn: async (entryIndex: number) => {
      return await apiRequest('DELETE', `/api/jobs/${jobId}/staff-time/${entryIndex}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'staff-time'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Success",
        description: "Staff time entry removed successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove staff time entry",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: StaffTimeEntryFormData) => {
    const employee = employees.find((emp: any) => emp.id === data.employeeId);
    const entryData = {
      employeeId: data.employeeId,
      hours: parseFloat(data.hours),
      rate: parseFloat(data.rate),
      date: data.date,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee'
    };

    addStaffTimeMutation.mutate(entryData);
  };

  const handleRemoveEntry = (index: number) => {
    removeStaffTimeMutation.mutate(index);
  };

  const getTotalHours = () => {
    return staffTimeEntries.reduce((sum: number, entry: any) => sum + entry.hours, 0);
  };

  const getTotalCost = () => {
    return staffTimeEntries.reduce((sum: number, entry: any) => sum + (entry.hours * entry.rate), 0);
  };

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Staff Time ({staffTimeEntries.length})
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
              data-testid="button-add-staff-time"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {staffTimeEntries.length > 0 ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Hours:</span>
                <span className="font-medium">{getTotalHours().toFixed(2)}h</span>
              </div>
              <div className="flex justify-between">
                <span>Total Cost:</span>
                <span className="font-bold">${getTotalCost().toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No staff time entries yet
            </div>
          )}
        </CardContent>

        {/* Add/Edit Staff Time Dialog */}
        <Dialog open={isAddDialogOpen || !!editingEntry} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingEntry(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? 'Edit Staff Time Entry' : 'Add Staff Time Entry'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff Member</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleEmployeeChange(value);
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-employee">
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((employee: any) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.firstName} {employee.lastName} - {employee.position}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours Worked</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.25"
                            min="0"
                            placeholder="8.0"
                            data-testid="input-hours"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate ($)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="45.00"
                            data-testid="input-rate"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          data-testid="input-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setEditingEntry(null);
                    }}
                    data-testid="button-cancel-staff-time"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addStaffTimeMutation.isPending}
                    data-testid="button-save-staff-time"
                  >
                    {addStaffTimeMutation.isPending ? 'Saving...' : 'Save Entry'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading staff time entries...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Staff Time Management
          </div>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            data-testid="button-add-staff-time"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Staff Time
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-blue-600 text-sm font-medium">Total Hours</div>
            <div className="text-2xl font-bold text-blue-800">{getTotalHours().toFixed(2)}h</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-green-600 text-sm font-medium">Total Cost</div>
            <div className="text-2xl font-bold text-green-800">${getTotalCost().toFixed(2)}</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-orange-600 text-sm font-medium">Staff Members</div>
            <div className="text-2xl font-bold text-orange-800">{new Set(staffTimeEntries.map((entry: any) => entry.employeeId)).size}</div>
          </div>
        </div>

        {/* Staff Time Entries List */}
        {staffTimeEntries.length > 0 ? (
          <div className="space-y-3">
            <h3 className="font-semibold">Time Entries</h3>
            {staffTimeEntries.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">{entry.employeeName || 'Unknown Employee'}</div>
                    <div className="text-sm text-gray-600">
                      {entry.hours}h @ ${entry.rate}/hr • {entry.date}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">${(entry.hours * entry.rate).toFixed(2)}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingEntry({ ...entry, id: index.toString() })}
                    data-testid={`button-edit-staff-time-${index}`}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveEntry(index)}
                    disabled={removeStaffTimeMutation.isPending}
                    data-testid={`button-remove-staff-time-${index}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No staff time entries yet</p>
            <p className="text-sm">Add time entries to track labor costs</p>
          </div>
        )}

        {/* Add/Edit Staff Time Dialog */}
        <Dialog open={isAddDialogOpen || !!editingEntry} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingEntry(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? 'Edit Staff Time Entry' : 'Add Staff Time Entry'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff Member</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleEmployeeChange(value);
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-employee">
                            <SelectValue placeholder="Select staff member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((employee: any) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.firstName} {employee.lastName} - {employee.position}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours Worked</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.25"
                            min="0"
                            placeholder="8.0"
                            data-testid="input-hours"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hourly Rate ($)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="45.00"
                            data-testid="input-rate"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          data-testid="input-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setEditingEntry(null);
                    }}
                    data-testid="button-cancel-staff-time"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addStaffTimeMutation.isPending}
                    data-testid="button-save-staff-time"
                  >
                    {addStaffTimeMutation.isPending ? 'Saving...' : 'Save Entry'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}