import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, CheckCircle, X, Trash2 } from "lucide-react";

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
    const label = minutes > 0 
      ? `${hoursDisplay}h ${minutes}m` 
      : `${hoursDisplay}h`;
    options.push({ value: hours.toString(), label });
  }
  return options;
};

export function RecordedTimeModal({ isOpen, onClose, jobId, jobNumber }: RecordedTimeModalProps) {
  const [pendingEntries, setPendingEntries] = useState<TimeEntry[]>([]);
  const [rounding, setRounding] = useState("none");
  const [travelTime, setTravelTime] = useState("included");
  const [useManualInput, setUseManualInput] = useState(false);
  const [newEntry, setNewEntry] = useState({
    staffId: '',
    rate: '',
    start: '',
    duration: '1' // Default to 1 hour
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
  });

  // Fetch existing time entries for this job
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

  // Get staff rates from materials & services catalog (without displaying the rate)
  const getStaffRates = () => {
    return materialsAndServices.filter((item: any) => {
      const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      return item.category === 'Labour' && price >= 0;
    }).map((item: any) => {
      const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      return {
        value: `${item.itemNumber}`,
        label: `${item.itemNumber} - ${item.name}`, // Rate removed for privacy
        rate: price,
        itemNumber: item.itemNumber,
        name: item.name
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
    }
  }, [isOpen, jobId, refetchTimeEntries, refetchMaterials]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPendingEntries([]);
      setNewEntry({ staffId: '', rate: '', start: '', duration: '1' });
      setUseManualInput(false);
    }
  }, [isOpen]);

  const addToPendingList = () => {
    if (!newEntry.staffId || !newEntry.rate) {
      toast({
        title: "Validation Error",
        description: "Please select staff member and rate",
        variant: "destructive"
      });
      return;
    }

    if (!newEntry.duration || parseFloat(newEntry.duration) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid duration",
        variant: "destructive"
      });
      return;
    }

    const staff = employees.find((e: any) => e.id === newEntry.staffId);
    const rateItem = availableRates.find((r: any) => r.itemNumber === newEntry.rate);
    
    const newTimeEntry: TimeEntry = {
      id: `pending-${Date.now()}-${Math.random()}`,
      date: new Date().toLocaleDateString('en-GB'),
      staffId: newEntry.staffId,
      staffName: `${staff?.firstName || ''} ${staff?.lastName || ''}`.trim(),
      rate: newEntry.rate,
      start: newEntry.start,
      duration: parseFloat(newEntry.duration),
      billed: true
    };
    
    setPendingEntries(prev => [...prev, newTimeEntry]);
    
    // Reset form but keep it open for adding more entries
    setNewEntry({ staffId: '', rate: '', start: '', duration: '1' });
    setUseManualInput(false);
  };

  const removePendingEntry = (id: string) => {
    setPendingEntries(prev => prev.filter(entry => entry.id !== id));
  };

  const saveAllEntries = async () => {
    try {
      if (pendingEntries.length === 0) {
        toast({
          title: "No entries",
          description: "Please add time entries before saving",
          variant: "destructive"
        });
        return;
      }
      
      // Prepare entries with all required fields
      const formattedEntries = pendingEntries.map(entry => {
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
          lineItemId: rateItem?.id || 'material-11',
          lineItemNumber: rateItem?.itemNumber || '34',
          lineItemName: rateItem?.name || 'Labour',
          lineItemCategory: 'Labour',
          
          // Time details
          entryDate: today,
          hours: entry.duration,
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
      
      // Invalidate related queries
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      await queryClient.invalidateQueries({ queryKey: ['time-entries', jobId, today] });
      
      await refetchTimeEntries();
      
      toast({
        title: "Success",
        description: `${pendingEntries.length} time ${pendingEntries.length === 1 ? 'entry' : 'entries'} saved successfully`
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

  // Format duration for display
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">
            Job #{jobNumber} Recorded Time
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-modal">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Time Form - Always Visible */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-blue-900">Add Staff Time Entry</h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-sm font-medium">Staff</label>
                <Select value={newEntry.staffId} onValueChange={(value) => setNewEntry(prev => ({ ...prev, staffId: value }))} data-testid="select-staff">
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
                <label className="text-sm font-medium">Rate Type</label>
                <Select value={newEntry.rate} onValueChange={(value) => setNewEntry(prev => ({ ...prev, rate: value }))} data-testid="select-rate">
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
                        No labour rates available
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
                  data-testid="input-start-time"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium flex items-center justify-between">
                  <span>Duration</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => setUseManualInput(!useManualInput)}
                    data-testid="button-toggle-manual"
                  >
                    {useManualInput ? 'Use Dropdown' : 'Manual Input'}
                  </Button>
                </label>
                {useManualInput ? (
                  <Input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="12"
                    value={newEntry.duration}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="Hours (e.g. 1.5)"
                    data-testid="input-duration-manual"
                  />
                ) : (
                  <Select value={newEntry.duration} onValueChange={(value) => setNewEntry(prev => ({ ...prev, duration: value }))} data-testid="select-duration">
                    <SelectTrigger>
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
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
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
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                <h4 className="font-medium text-gray-900">
                  Pending Entries ({pendingEntries.length})
                </h4>
              </div>
              
              <div className="divide-y divide-gray-100">
                {pendingEntries.map((entry) => (
                  <div key={entry.id} className="p-4 hover:bg-gray-50 flex items-center justify-between" data-testid={`entry-${entry.id}`}>
                    <div className="flex-1 grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">Staff</div>
                        <div className="font-medium">{entry.staffName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Rate Type</div>
                        <div className="text-sm">{availableRates.find((r: any) => r.itemNumber === entry.rate)?.name || entry.rate}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Start Time</div>
                        <div className="text-sm">{entry.start || 'Not set'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Duration</div>
                        <div className="text-sm font-medium">{formatDuration(entry.duration)}</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePendingEntry(entry.id)}
                      className="ml-4 text-red-600 hover:text-red-800 hover:bg-red-50"
                      data-testid={`button-remove-${entry.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing Saved Entries */}
          {existingEntries.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3">
                <h4 className="font-medium text-emerald-900">
                  Saved Today ({existingEntries.length})
                </h4>
              </div>
              
              <div className="divide-y divide-gray-100">
                {existingEntries.map((entry: any) => (
                  <div key={entry.id} className="p-4 bg-white">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">Staff</div>
                        <div className="font-medium">{entry.employeeName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Rate Type</div>
                        <div className="text-sm">{entry.lineItemName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Start Time</div>
                        <div className="text-sm">{entry.startTime || 'Not set'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Duration</div>
                        <div className="text-sm font-medium">{formatDuration(entry.hours)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              <Button variant="outline" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                onClick={saveAllEntries} 
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={pendingEntries.length === 0}
                data-testid="button-save"
              >
                Save All ({pendingEntries.length})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
