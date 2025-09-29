import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, CheckCircle, X } from "lucide-react";

interface TimeEntry {
  id: string;
  date: string;
  staffId: string;
  staffName: string;
  rate: string;
  start: string;
  duration: number; // in minutes
  billed: boolean;
}

interface RecordedTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobNumber: string;
}

export function RecordedTimeModal({ isOpen, onClose, jobId, jobNumber }: RecordedTimeModalProps) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isAddingTime, setIsAddingTime] = useState(false);
  const [rounding, setRounding] = useState("none");
  const [travelTime, setTravelTime] = useState("included");
  const [newEntry, setNewEntry] = useState({
    staffId: '',
    rate: '',
    start: '',
    duration: 0
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch employees and their rates from materials & services
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees'],
    enabled: isOpen,
  });

  const { data: materialsServicesData, refetch: refetchMaterials } = useQuery({
    queryKey: ['/api/materials'],
    enabled: isOpen,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    staleTime: 0,
    cacheTime: 0,
  });

  // Fetch existing time entries for this job - align with profit tracker API
  const today = new Date().toISOString().split('T')[0];
  const { data: timeEntriesData, refetch: refetchTimeEntries } = useQuery({
    queryKey: ['time-entries', jobId, today],
    queryFn: async () => {
      const response = await fetch(`/api/time-entries/${jobId}/${today}`);
      if (!response.ok) throw new Error('Failed to fetch time entries');
      const result = await response.json();
      return result;
    },
    enabled: isOpen && !!jobId,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const employees = (employeesData as any)?.data || [];
  const materialsAndServices = (materialsServicesData as any)?.data || [];
  const existingEntries = (timeEntriesData as any)?.data || [];

  // Get staff rates from materials & services catalog
  const getStaffRates = () => {
    // Get all labour items from the catalog
    return materialsAndServices.filter((item: any) => {
      const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      return item.category === 'Labour' && price >= 0;
    }).map((item: any) => {
      const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      return {
        value: `${item.itemNumber}`,
        label: `${item.itemNumber} - ${item.name} ($${price.toFixed(2)}/hr)`,
        rate: price,
        itemNumber: item.itemNumber,
        name: item.name
      };
    });
  };
  
  const availableRates = getStaffRates();

  // Refetch data when modal opens
  useEffect(() => {
    if (isOpen && jobId) {
      refetchTimeEntries();
      refetchMaterials();
    }
  }, [isOpen, jobId, refetchTimeEntries, refetchMaterials]);

  // Initialize time entries from real data only (but don't reset if user has added entries)
  const [hasInitialized, setHasInitialized] = useState(false);
  
  useEffect(() => {
    // Only initialize on first open, don't reset if user has added entries
    if (!hasInitialized && isOpen) {
      if (existingEntries.length > 0) {
        const formattedEntries = existingEntries.map((entry: any) => ({
          id: entry.id,
          date: new Date(entry.entryDate).toLocaleDateString('en-GB'), // Use entryDate from server
          staffId: entry.employeeId, // Use employeeId from server
          staffName: entry.employeeName || 'Unknown', // Use employeeName from server
          rate: entry.lineItemNumber || '34', // Use lineItemNumber as rate reference
          start: entry.startTime || '', // Use startTime from server
          duration: Math.round((entry.hours || 0) * 60), // Convert hours to minutes
          billed: entry.billed !== false
        }));
        setTimeEntries(formattedEntries);
      } else {
        // Start with empty entries - no dummy data
        setTimeEntries([]);
      }
      setHasInitialized(true);
    }
  }, [existingEntries, employees, availableRates, isOpen, hasInitialized]);
  
  // Reset initialization flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen]);

  const addTimeEntry = () => {
    if (!newEntry.staffId || !newEntry.rate) {
      toast({
        title: "Validation Error",
        description: "Please select staff member and rate",
        variant: "destructive"
      });
      return;
    }

    const staff = employees.find((e: any) => e.id === newEntry.staffId);
    const newTimeEntry: TimeEntry = {
      id: `entry-${Date.now()}`,
      date: new Date().toLocaleDateString('en-GB'),
      staffId: newEntry.staffId,
      staffName: `${staff?.firstName || ''} ${staff?.lastName || ''}`.trim(),
      rate: newEntry.rate,
      start: newEntry.start,
      duration: newEntry.duration,
      billed: true
    };
    
    setTimeEntries(prev => [...prev, newTimeEntry]);
    
    setNewEntry({ staffId: '', rate: '', start: '', duration: 0 });
    setIsAddingTime(false);
    
    toast({
      title: "Success",
      description: "Time entry added successfully"
    });
  };

  const updateTimeEntry = (id: string, field: keyof TimeEntry, value: any) => {
    setTimeEntries(prev => prev.map(entry => 
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  const deleteTimeEntry = (id: string) => {
    setTimeEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const saveTimeEntries = async () => {
    try {
      if (timeEntries.length === 0) {
        toast({
          title: "No entries",
          description: "Please add time entries before saving",
          variant: "destructive"
        });
        return;
      }
      
      // Prepare entries with all required fields
      const formattedEntries = timeEntries.map(entry => {
        // Find the staff member
        const staff = employees.find((e: any) => e.id === entry.staffId);
        const staffName = staff ? `${staff.firstName} ${staff.lastName}` : 'Unknown Staff';
        
        // Find the rate/material from catalog
        const rateItem = materialsAndServices.find((item: any) => 
          item.itemNumber === entry.rate || item.itemNumber === entry.rate.split(' ')[0]
        );
        
        return {
          // Basic job/employee info
          jobId,
          jobNumber: jobNumber || '3317',
          employeeId: entry.staffId,
          employeeName: staffName,
          
          // Line item connection (required for schema)
          lineItemId: rateItem?.id || 'material-11', // Default to "34" Labour item
          lineItemNumber: rateItem?.itemNumber || '34',
          lineItemName: rateItem?.name || 'Labour',
          lineItemCategory: 'Labour',
          
          // Time details
          entryDate: today,
          hours: entry.duration / 60, // Convert minutes to hours
          rate: rateItem?.price || parseFloat(entry.rate.split(' ')[0]) || 75,
          startTime: entry.start,
          
          // ServiceM8 features
          billed: entry.billed !== false,
          roundingMode: rounding || 'none',
          travelTimeIncluded: travelTime === 'Included'
        };
      });
      
      await apiRequest('POST', `/api/time-entries/${jobId}`, {
        entries: formattedEntries,
        rounding,
        travelTime
      });
      
      // Invalidate related queries using the same query keys as profit tracker
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      await queryClient.invalidateQueries({ queryKey: ['time-entries', jobId, today] });
      
      // Also refetch the data to make sure it's fresh
      await refetchTimeEntries();
      
      toast({
        title: "Success",
        description: "Time entries saved successfully"
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save time entries",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            Job #{jobNumber} Recorded Time
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Time Button */}
          <div className="flex justify-start">
            <Button
              onClick={() => setIsAddingTime(true)}
              className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 hover:bg-green-100"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              Add Time
            </Button>
          </div>

          {/* Add Time Form */}
          {isAddingTime && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Add New Time Entry</h4>
                <Button variant="ghost" size="sm" onClick={() => setIsAddingTime(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-sm font-medium">Staff</label>
                  <Select value={newEntry.staffId} onValueChange={(value) => setNewEntry(prev => ({ ...prev, staffId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((staff: any) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.firstName} {staff.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Rate</label>
                  <Select value={newEntry.rate} onValueChange={(value) => setNewEntry(prev => ({ ...prev, rate: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRates.length > 0 ? (
                        availableRates.map((rate: any) => (
                          <SelectItem key={rate.itemNumber} value={rate.itemNumber}>
                            {rate.label}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No labour rates available - add them in Materials & Services
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <Input
                    type="time"
                    value={newEntry.start}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Duration (mins)</label>
                  <Input
                    type="number"
                    min="0"
                    value={newEntry.duration}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={addTimeEntry} className="bg-orange-500 hover:bg-orange-600 text-white">
                  Add Entry
                </Button>
              </div>
            </div>
          )}

          {/* Time Entries Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-6 gap-4 p-3 text-sm font-medium text-gray-700">
                <div>Date</div>
                <div>Staff</div>
                <div>Rate</div>
                <div>Start</div>
                <div>Duration</div>
                <div>Billed</div>
              </div>
            </div>
            
            <div className="bg-white">
              {timeEntries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-6 gap-4 p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                  <div className="text-sm">{entry.date}</div>
                  <div className="text-sm font-medium">{entry.staffName}</div>
                  <div className="text-sm">{entry.rate}</div>
                  <div className="text-sm">
                    <Input
                      type="time"
                      value={entry.start}
                      onChange={(e) => updateTimeEntry(entry.id, 'start', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="text-sm">
                    <Input
                      type="number"
                      min="0"
                      value={entry.duration}
                      onChange={(e) => updateTimeEntry(entry.id, 'duration', parseInt(e.target.value) || 0)}
                      className="h-7 text-xs"
                      placeholder="0 mins"
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    {entry.billed ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <div className="h-4 w-4 rounded border border-gray-300" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Rounding:</span>
                <Select value={rounding} onValueChange={setRounding}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="15min">15 min</SelectItem>
                    <SelectItem value="30min">30 min</SelectItem>
                    <SelectItem value="1hour">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Travel Time:</span>
                <Select value={travelTime} onValueChange={setTravelTime}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="included">Included</SelectItem>
                    <SelectItem value="excluded">Excluded</SelectItem>
                    <SelectItem value="separate">Separate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={saveTimeEntries} className="bg-orange-500 hover:bg-orange-600 text-white">
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}