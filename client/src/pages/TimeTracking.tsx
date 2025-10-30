import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Clock, 
  Calendar, 
  Users, 
  TrendingUp, 
  DollarSign,
  Plus,
  Trash2,
  Edit,
  Save,
  X
} from "lucide-react";

interface DailyTimeEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  entryDate: string;
  totalDayHours: string;
  billableHours: string;
  maintenanceHours: string;
  travelHours: string;
  adminHours: string;
  breakHours: string;
  jobEfficiency: string;
  utilizationRate: string;
  productivityRate: string;
}

interface JobTimeEntry {
  id: string;
  jobId: string;
  jobNumber: string;
  employeeId: string;
  employeeName: string;
  entryDate: string;
  hours: string;
  rate: string;
  startTime?: string;
  billed: boolean;
  lineItemId?: string;
  lineItemNumber?: string;
  lineItemName?: string;
  lineItemCategory?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position?: string;
  hourlyRate?: number;
}

export default function TimeTracking() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'daily' | 'job'>('daily');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch employees
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees'],
  });

  const employees: Employee[] = employeesData?.data || [];

  // Fetch daily time entries
  const { data: dailyEntriesData, isLoading: isLoadingDaily } = useQuery({
    queryKey: ['/api/time-entries/daily', selectedEmployee, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedEmployee && selectedEmployee !== 'all') params.append('employeeId', selectedEmployee);
      if (selectedDate) params.append('fromDate', selectedDate);
      if (selectedDate) params.append('toDate', selectedDate);
      
      const response = await fetch(`/api/time-entries/daily?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch daily time entries');
      return response.json();
    }
  });

  const dailyEntries: DailyTimeEntry[] = dailyEntriesData?.data || [];

  // Calculate summary stats
  const totalHours = dailyEntries.reduce((sum, entry) => sum + parseFloat(entry.billableHours || '0'), 0);
  const totalRevenue = dailyEntries.reduce((sum, entry) => {
    const employee = employees.find(e => e.id === entry.employeeId);
    const rate = employee?.hourlyRate || 0;
    return sum + (parseFloat(entry.billableHours || '0') * rate);
  }, 0);
  const avgEfficiency = dailyEntries.length > 0 
    ? dailyEntries.reduce((sum, entry) => sum + parseFloat(entry.jobEfficiency || '0'), 0) / dailyEntries.length
    : 0;
  const avgUtilization = dailyEntries.length > 0
    ? dailyEntries.reduce((sum, entry) => sum + parseFloat(entry.utilizationRate || '0'), 0) / dailyEntries.length
    : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          <p className="text-sm text-gray-600 mt-1">Track staff hours and productivity metrics</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Billable Hours</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              {selectedDate ? format(new Date(selectedDate), 'MMM d, yyyy') : 'All time'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Based on hourly rates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Job Efficiency</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgEfficiency.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Time on billable vs total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Utilization</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgUtilization.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Productive time usage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-filter">Date</Label>
              <Input
                id="date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                data-testid="input-date-filter"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee-filter">Staff Member</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger id="employee-filter" data-testid="select-employee-filter">
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName} {employee.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>View Mode</Label>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'daily' ? 'default' : 'outline'}
                  onClick={() => setViewMode('daily')}
                  className="flex-1"
                  data-testid="button-view-daily"
                >
                  Daily Summary
                </Button>
                <Button
                  variant={viewMode === 'job' ? 'default' : 'outline'}
                  onClick={() => setViewMode('job')}
                  className="flex-1"
                  data-testid="button-view-job"
                >
                  By Job
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {viewMode === 'daily' ? 'Daily Time Entries' : 'Job Time Entries'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingDaily ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : dailyEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No time entries found</p>
              <p className="text-sm">Try selecting a different date or staff member</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-time-entries">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff Member
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Hours
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Billable
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Travel
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Maintenance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Efficiency
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilization
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dailyEntries.map((entry) => {
                    const employee = employees.find(e => e.id === entry.employeeId);
                    const efficiency = parseFloat(entry.jobEfficiency || '0');
                    const utilization = parseFloat(entry.utilizationRate || '0');
                    
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {entry.employeeName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {employee?.position || 'Staff'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(entry.entryDate), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          {parseFloat(entry.totalDayHours).toFixed(1)}h
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          {parseFloat(entry.billableHours).toFixed(1)}h
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                          {parseFloat(entry.travelHours).toFixed(1)}h
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                          {parseFloat(entry.maintenanceHours).toFixed(1)}h
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          <Badge 
                            variant={efficiency >= 80 ? 'default' : efficiency >= 60 ? 'secondary' : 'destructive'}
                            className="font-medium"
                          >
                            {efficiency.toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          <Badge 
                            variant={utilization >= 80 ? 'default' : utilization >= 60 ? 'secondary' : 'destructive'}
                            className="font-medium"
                          >
                            {utilization.toFixed(0)}%
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help text */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">How to track time</p>
              <p className="text-blue-700">
                Time entries are tracked within each job card. Open any job from the dispatch board 
                and navigate to the "Billing" tab to log staff hours. Those entries will automatically 
                appear here for reporting and analysis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
