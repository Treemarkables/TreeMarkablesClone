import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Clock, 
  Plus, 
  Trash2, 
  Calculator,
  CheckCircle,
  AlertCircle,
  Save
} from "lucide-react";

interface StaffTimeEntry {
  employeeId: string;
  hours: number;
  rate: number;
  date?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  hourlyRate?: number;
  position?: string;
}

interface StaffTimeTrackerProps {
  jobId: string;
  compact?: boolean;
  onLaborCostChange?: (totalCost: number) => void;
}

export function StaffTimeTracker({ jobId, compact = false, onLaborCostChange }: StaffTimeTrackerProps) {
  console.log('StaffTimeTracker rendering with jobId:', jobId, 'compact:', compact);
  
  const [staffEntries, setStaffEntries] = useState<StaffTimeEntry[]>([]);
  const [newEntry, setNewEntry] = useState({
    employeeId: '',
    hours: '',
    rate: '',
    date: new Date().toISOString().split('T')[0]
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch employees for selection
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const response = await fetch('/api/employees');
      if (!response.ok) throw new Error('Failed to fetch employees');
      return response.json();
    }
  });

  const employees: Employee[] = employeesData?.data || [];
  console.log('Debug StaffTimeTracker employees data:', employeesData, 'employees array:', employees, 'employees length:', employees.length);

  // Fetch existing staff time entries for this job
  const { data: staffTimeData, isLoading } = useQuery({
    queryKey: ['staff-time', jobId],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${jobId}/staff-time`);
      if (!response.ok) throw new Error('Failed to fetch staff time entries');
      return response.json();
    },
    enabled: !!jobId
  });

  // Update local state when data changes
  useEffect(() => {
    if (staffTimeData?.data) {
      setStaffEntries(staffTimeData.data);
    }
  }, [staffTimeData]);

  // Calculate total labor cost and notify parent
  const totalLaborCost = staffEntries.reduce((sum, entry) => sum + (entry.hours * entry.rate), 0);
  
  useEffect(() => {
    if (onLaborCostChange) {
      onLaborCostChange(totalLaborCost);
    }
  }, [totalLaborCost, onLaborCostChange]);

  // Add staff time entry mutation
  const addStaffTimeMutation = useMutation({
    mutationFn: async (entry: Omit<StaffTimeEntry, 'date'> & { date?: string }) => {
      return await apiRequest('POST', `/api/jobs/${jobId}/staff-time`, entry);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-time', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      setNewEntry({
        employeeId: '',
        hours: '',
        rate: '',
        date: new Date().toISOString().split('T')[0]
      });
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
    mutationFn: async ({ employeeId, date }: { employeeId: string; date?: string }) => {
      const url = `/api/jobs/${jobId}/staff-time/${employeeId}${date ? `?date=${date}` : ''}`;
      return await apiRequest('DELETE', url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-time', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
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

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    setNewEntry(prev => ({
      ...prev,
      employeeId,
      rate: employee?.hourlyRate?.toString() || prev.rate
    }));
  };

  const handleAddEntry = () => {
    if (!newEntry.employeeId || !newEntry.hours || !newEntry.rate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const hours = parseFloat(newEntry.hours);
    const rate = parseFloat(newEntry.rate);

    if (isNaN(hours) || isNaN(rate) || hours <= 0 || rate <= 0) {
      toast({
        title: "Validation Error", 
        description: "Hours and rate must be positive numbers",
        variant: "destructive"
      });
      return;
    }

    addStaffTimeMutation.mutate({
      employeeId: newEntry.employeeId,
      hours,
      rate,
      date: newEntry.date
    });
  };

  const handleRemoveEntry = (employeeId: string, date?: string) => {
    removeStaffTimeMutation.mutate({ employeeId, date });
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee ? `${employee.firstName} ${employee.lastName}` : `Employee ${employeeId}`;
  };

  const getEmployeePosition = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.position || '';
  };

  const totalHours = staffEntries.reduce((sum, entry) => sum + entry.hours, 0);

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Time ({staffEntries.length} entries)
            </div>
            {totalHours > 0 ? (
              <Badge className="bg-blue-100 text-blue-800">
                <Clock className="h-3 w-3 mr-1" />
                {totalHours}h
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-800">
                <Clock className="h-3 w-3 mr-1" />
                No time logged
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Hours:</span>
              <span className="font-medium">{totalHours.toFixed(2)}h</span>
            </div>
            <div className="flex justify-between">
              <span>Labor Cost:</span>
              <span className="font-bold text-blue-600">
                ${totalLaborCost.toFixed(2)}
              </span>
            </div>
            {staffEntries.length > 0 && (
              <div className="text-xs text-gray-500 mt-2">
                {staffEntries.map(entry => (
                  <div key={`${entry.employeeId}-${entry.date}`} className="flex justify-between">
                    <span>{getEmployeeName(entry.employeeId)}</span>
                    <span>{entry.hours}h × ${entry.rate}/h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading staff time data...</p>
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
            <Users className="h-6 w-6" />
            Staff Time Tracking
          </div>
          <div className="flex items-center gap-2">
            {totalHours > 0 && (
              <Badge className="bg-blue-100 text-blue-800">
                <Clock className="h-4 w-4 mr-1" />
                {totalHours.toFixed(1)} hours
              </Badge>
            )}
            {totalLaborCost > 0 && (
              <Badge className="bg-green-100 text-green-800">
                <Calculator className="h-4 w-4 mr-1" />
                ${totalLaborCost.toFixed(2)}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Staff Time Entry */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Staff Time Entry
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="employee-select">Staff Member</Label>
              <Select 
                value={newEntry.employeeId} 
                onValueChange={handleEmployeeSelect}
              >
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName} {employee.position && `(${employee.position})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="hours-input">Hours Worked</Label>
              <Input
                id="hours-input"
                type="number"
                step="0.25"
                min="0"
                value={newEntry.hours}
                onChange={(e) => setNewEntry(prev => ({ ...prev, hours: e.target.value }))}
                placeholder="8.0"
                data-testid="input-hours"
              />
            </div>
            
            <div>
              <Label htmlFor="rate-input">Hourly Rate ($)</Label>
              <Input
                id="rate-input"
                type="number"
                step="0.01"
                min="0"
                value={newEntry.rate}
                onChange={(e) => setNewEntry(prev => ({ ...prev, rate: e.target.value }))}
                placeholder="25.00"
                data-testid="input-rate"
              />
            </div>
            
            <div>
              <Label htmlFor="date-input">Date</Label>
              <Input
                id="date-input"
                type="date"
                value={newEntry.date}
                onChange={(e) => setNewEntry(prev => ({ ...prev, date: e.target.value }))}
                data-testid="input-date"
              />
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            {newEntry.hours && newEntry.rate && (
              <div className="text-sm text-blue-700">
                Cost: <span className="font-semibold">
                  ${(parseFloat(newEntry.hours || '0') * parseFloat(newEntry.rate || '0')).toFixed(2)}
                </span>
              </div>
            )}
            
            <Button
              onClick={handleAddEntry}
              disabled={addStaffTimeMutation.isPending}
              data-testid="button-add-staff-time"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {addStaffTimeMutation.isPending ? 'Adding...' : 'Add Entry'}
            </Button>
          </div>
        </div>

        {/* Existing Staff Time Entries */}
        {staffEntries.length > 0 && (
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Entries ({staffEntries.length})
            </h3>
            
            <div className="space-y-3">
              {staffEntries.map((entry, index) => (
                <div 
                  key={`${entry.employeeId}-${entry.date}-${index}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">{getEmployeeName(entry.employeeId)}</div>
                      {getEmployeePosition(entry.employeeId) && (
                        <div className="text-sm text-gray-500">{getEmployeePosition(entry.employeeId)}</div>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      {entry.date && entry.date !== new Date().toISOString().split('T')[0] && (
                        <div>{new Date(entry.date).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium">
                        {entry.hours}h × ${entry.rate}/h
                      </div>
                      <div className="text-sm font-semibold text-green-600">
                        ${(entry.hours * entry.rate).toFixed(2)}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEntry(entry.employeeId, entry.date)}
                      disabled={removeStaffTimeMutation.isPending}
                      data-testid={`button-remove-entry-${entry.employeeId}`}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {staffEntries.length > 0 && (
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Labor Cost Summary
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-green-700">Total Hours:</div>
                <div className="text-2xl font-bold text-green-800">{totalHours.toFixed(2)}h</div>
              </div>
              <div>
                <div className="text-green-700">Total Labor Cost:</div>
                <div className="text-2xl font-bold text-green-800">${totalLaborCost.toFixed(2)}</div>
              </div>
            </div>
            
            <div className="mt-3 text-xs text-green-600">
              This amount will be used for gross margin calculations
            </div>
          </div>
        )}

        {staffEntries.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No staff time entries recorded yet</p>
            <p className="text-sm">Add entries above to track labor costs</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}