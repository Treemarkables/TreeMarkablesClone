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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Users
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

export function GrossMarginCalculator({ jobId, jobData, compact = false }: GrossMarginCalculatorProps) {
  const [formData, setFormData] = useState<GrossMarginData>({});
  const [calculationMode, setCalculationMode] = useState<'manual' | 'hourly'>('manual');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch job data to get current gross margin information
  const { data: jobResponse, isLoading } = useQuery({
    queryKey: ['/api/jobs', jobId],
    enabled: !!jobId
  });

  // Fetch employees for staff selection
  const { data: employeesData } = useQuery({
    queryKey: ['/api/employees', 'active'],
    enabled: !compact // Only load when showing full calculator
  });

  
  const job = (jobResponse as any)?.data;
  const employees = (employeesData as any)?.data || [];

  // Fetch staff time entries from the new time tracking system
  const today = new Date().toISOString().split('T')[0];
  const { data: staffTimeData } = useQuery({
    queryKey: ['time-entries', jobId, today],
    queryFn: async () => {
      const response = await fetch(`/api/time-entries/${jobId}/${today}`);
      if (!response.ok) throw new Error('Failed to fetch staff time entries');
      return response.json();
    },
    enabled: !!jobId
  });
  
  const hasStaffTimeEntries = (staffTimeData as any)?.data?.length > 0;
  const staffTimeEntries = (staffTimeData as any)?.data || [];
  const staffTimeLaborCost = staffTimeEntries.reduce((sum: number, entry: any) => {
    const hours = Number(entry.hours) || 0;
    const rate = Number(entry.rate) || 0;
    return sum + (hours * rate);
  }, 0);
  
  // Get bulk expense data from job object (not from /expenses endpoint which is for individual entries)
  const bulkExpenses = {
    actualLaborCosts: job?.actualLaborCosts || 0,
    actualMaterialsCosts: job?.actualMaterialsCosts || 0,
    equipmentCosts: job?.equipmentCosts || 0,
    subcontractorCosts: job?.subcontractorCosts || 0,
    permitCosts: job?.permitCosts || 0,
    travelCosts: job?.travelCosts || 0,
    disposalCosts: job?.disposalCosts || 0,
    miscExpenses: job?.miscExpenses || 0
  };
  const totalExpenses = Object.values(bulkExpenses).reduce((sum: number, amount: any) => {
    return sum + (typeof amount === 'number' ? amount : 0);
  }, 0);

  // Update form data when job data changes
  useEffect(() => {
    if (job) {
      setFormData({
        laborCosts: job.laborCosts ? parseFloat(job.laborCosts) : undefined,
        materialsCosts: job.materialsCosts ? parseFloat(job.materialsCosts) : undefined,
        otherCosts: job.otherCosts ? parseFloat(job.otherCosts) : undefined,
        laborHours: job.laborHours ? parseFloat(job.laborHours) : undefined,
        hourlyRate: job.hourlyRate ? parseFloat(job.hourlyRate) : undefined,
        grossMargin: job.grossMargin,
        grossMarginCalculated: job.grossMarginCalculated,
        totalAmount: job.totalAmount,
        assignedStaffIds: job.assignedStaffIds
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
      const payload = hasStaffTimeEntries ? { ...data, laborCosts: undefined } : data;
      return await apiRequest('PUT', `/api/jobs/${jobId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Success",
        description: "Gross margin updated successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update gross margin",
        variant: "destructive"
      });
    }
  });

  // Calculate total revenue from job line items - read-only consumer
  const calculateJobLineItemsTotal = (jobLineItems: any[]): number => {
    if (!Array.isArray(jobLineItems)) return 0;
    return jobLineItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity || 0);
      const unitPrice = parseFloat(item.unitPrice || 0);
      return sum + (quantity * unitPrice);
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
      const itemCost = totalCost > 0 ? totalCost : (unitCost * quantity);
      return sum + itemCost;
    }, 0);
  };
  
  const jobLineItemsTotal = calculateJobLineItemsTotal(job?.lineItems || []);
  const jobLineItemsCosts = calculateJobLineItemsCosts(job?.lineItems || []);
  const totalAmount = jobLineItemsTotal > 0 ? jobLineItemsTotal : (job?.totalAmount ? parseFloat(job.totalAmount) : 0);
  
  // Materials costs come from the actual cost fields in line items
  const materialsCosts = jobLineItemsCosts;
  
  const laborCosts = hasStaffTimeEntries ? staffTimeLaborCost : (formData.laborCosts || 0);
  const otherCosts = formData.otherCosts || 0;
  const costOfGoods = job?.costOfGoods ? parseFloat(job.costOfGoods) : 0;
  // Include tracked expenses in total costs
  const totalCosts = laborCosts + materialsCosts + otherCosts + costOfGoods + totalExpenses;
  const calculatedLaborCosts = (formData.laborHours || 0) * (formData.hourlyRate || 0);
  
  // Calculate gross margin in real-time
  const grossMarginPercent = totalAmount > 0 ? ((totalAmount - totalCosts) / totalAmount) * 100 : 0;
  const grossMarginAmount = totalAmount - totalCosts;

  const handleInputChange = (field: keyof GrossMarginData, value: string) => {
    const numericValue = value === '' ? undefined : parseFloat(value);
    setFormData(prev => ({
      ...prev,
      [field]: numericValue
    }));
  };

  // Helper functions for staff assignments
  const updateStaffAssignment = (staffId: string, field: keyof StaffAssignment, value: string | number) => {
    setStaffAssignments(prev => {
      const existingIndex = prev.findIndex(assignment => assignment.staffId === staffId);
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
    return staffAssignments.find(assignment => assignment.staffId === staffId) || { staffId };
  };


  const handleSave = () => {
    const dataToSave = { 
      ...formData, 
      assignedStaffIds: selectedStaffIds,
      staffAssignments: staffAssignments.filter(assignment => selectedStaffIds.includes(assignment.staffId))
    };
  
    // Convert numeric values to strings for backend schema compatibility
    if (dataToSave.laborCosts !== undefined) {
      (dataToSave as any).laborCosts = dataToSave.laborCosts.toString();
    }
    // Use computed materials costs from job line items, not stale formData
    (dataToSave as any).materialsCosts = materialsCosts.toString();
    
    if (dataToSave.otherCosts !== undefined) {
      (dataToSave as any).otherCosts = dataToSave.otherCosts.toString();
    }
    if (dataToSave.laborHours !== undefined) {
      (dataToSave as any).laborHours = dataToSave.laborHours.toString();
    }
    if (dataToSave.hourlyRate !== undefined) {
      (dataToSave as any).hourlyRate = dataToSave.hourlyRate.toString();
    }
    // Use computed total amount from line items
    (dataToSave as any).totalAmount = totalAmount.toString();
    
    // If staff time entries exist, don't include laborCosts (server-calculated)
    if (hasStaffTimeEntries) {
      delete dataToSave.laborCosts;
      delete dataToSave.laborHours;
      delete dataToSave.hourlyRate;
    } else if (calculationMode === 'hourly' && formData.laborHours && formData.hourlyRate) {
      // If using hourly calculation mode, use calculated labor costs
      (dataToSave as any).laborCosts = calculatedLaborCosts.toString();
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
                <span className={`font-bold ${getMarginColor(parseFloat(job.grossMargin || '0'))}`}>
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
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Gross Margin Calculator
          </div>
          {job?.grossMarginCalculated ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-4 w-4 mr-1" />
              Complete
            </Badge>
          ) : (
            <Badge className="bg-orange-100 text-orange-800">
              <AlertCircle className="h-4 w-4 mr-1" />
              Required for Invoice
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Revenue Information */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Job Revenue
          </h3>
          <div className="text-2xl font-bold text-blue-800">
            ${totalAmount.toFixed(2)}
          </div>
        </div>

        {/* Job Revenue from Line Items - Read Only */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <h3 className="font-semibold">Job Line Items</h3>
            <Badge variant="outline" className="text-xs">
              {job?.lineItems?.length || 0} items
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 text-xs">
              Managed in Job Card
            </Badge>
          </div>

          {job?.lineItems && job.lineItems.length > 0 ? (
            <div className="space-y-2">
              {job.lineItems.map((item: any, index: number) => (
                <Card key={index} className="p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{item.description}</div>
                      <div className="text-sm text-gray-600">
                        {item.quantity} × ${parseFloat(item.unitPrice || 0).toFixed(2)} = ${(item.quantity * parseFloat(item.unitPrice || 0)).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      ${(item.quantity * parseFloat(item.unitPrice || 0)).toFixed(2)}
                    </div>
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
          ) : (
            <div className="text-center py-4 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No line items found</p>
              <p className="text-sm">Add pricing items in the Job Card to track revenue</p>
            </div>
          )}
        </div>

        {/* Labor Costs Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5" />
            <h3 className="font-semibold">Labor Costs</h3>
            {hasStaffTimeEntries && (
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                Auto from Staff Time
              </Badge>
            )}
          </div>
          
          {!hasStaffTimeEntries && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="calculation-mode">Calculation Method</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button"
                      variant={calculationMode === 'manual' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCalculationMode('manual')}
                      data-testid="button-manual-calculation"
                    >
                      Manual Entry
                    </Button>
                    <Button
                      type="button"
                      variant={calculationMode === 'hourly' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCalculationMode('hourly')}
                      data-testid="button-hourly-calculation"
                    >
                      Hours × Rate
                    </Button>
                  </div>
                </div>
              </div>

              {/* Staff Assignment for Labor Tracking */}
              {employees.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <Label>Assigned Staff</Label>
                    <Badge variant="outline" className="text-xs">
                      {selectedStaffIds.length} selected
                    </Badge>
                  </div>
                  
                  
                  <div className="space-y-3 max-h-64 overflow-y-auto bg-gray-50 p-3 rounded-md">
                    {employees.map((employee: any) => {
                      const assignment = getStaffAssignment(employee.id);
                      const isSelected = selectedStaffIds.includes(employee.id);
                      
                      return (
                        <div key={employee.id} className="space-y-2">
                          {/* Staff member row */}
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedStaffIds(prev => [...prev, employee.id]);
                                } else {
                                  setSelectedStaffIds(prev => prev.filter(id => id !== employee.id));
                                  // Remove assignment when unchecking
                                  setStaffAssignments(prev => prev.filter(a => a.staffId !== employee.id));
                                }
                              }}
                              data-testid={`checkbox-staff-${employee.id}`}
                            />
                            <Label className="text-sm font-medium">
                              {employee.firstName} {employee.lastName}
                            </Label>
                            <Badge variant="outline" className="text-xs">
                              {employee.position}
                            </Badge>
                          </div>
                          
                          {/* Time entry when selected */}
                          {isSelected && (
                            <div className="ml-6">
                              <div>
                                <Label className="text-xs">Hours</Label>
                                <Input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  max="24"
                                  value={assignment.hours || ''}
                                  onChange={(e) => updateStaffAssignment(employee.id, 'hours', parseFloat(e.target.value) || 0)}
                                  placeholder="0.0"
                                  className="h-8 text-xs"
                                  data-testid={`input-hours-${employee.id}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {hasStaffTimeEntries ? (
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-blue-900">Labor Costs (from Staff Time)</Label>
                <Badge className="bg-blue-200 text-blue-800">Read-only</Badge>
              </div>
              <div className="text-2xl font-bold text-blue-800 mb-3">
                ${staffTimeLaborCost.toFixed(2)}
              </div>
              <div className="text-sm text-blue-700">
                Calculated from {staffTimeEntries.length} staff time entries
              </div>
              <div className="text-xs text-blue-600 mt-1">
                Total Hours: {staffTimeEntries.reduce((sum: number, entry: any) => {
                  const hours = Number(entry.hours) || 0;
                  return sum + hours;
                }, 0).toFixed(2)}h
              </div>
            </div>
          ) : (
            <>
              {calculationMode === 'manual' ? (
                <div>
                  <Label htmlFor="laborCosts">Labor Costs ($)</Label>
                  <Input
                    id="laborCosts"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.laborCosts || ''}
                    onChange={(e) => handleInputChange('laborCosts', e.target.value)}
                    placeholder="Enter total labor costs"
                    data-testid="input-labor-costs"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="laborHours">Labor Hours</Label>
                    <Input
                      id="laborHours"
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.laborHours || ''}
                      onChange={(e) => handleInputChange('laborHours', e.target.value)}
                      placeholder="Hours worked"
                      data-testid="input-labor-hours"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.hourlyRate || ''}
                      onChange={(e) => handleInputChange('hourlyRate', e.target.value)}
                      placeholder="Rate per hour"
                      data-testid="input-hourly-rate"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {!hasStaffTimeEntries && calculationMode === 'hourly' && formData.laborHours && formData.hourlyRate && (
            <div className="bg-gray-50 p-3 rounded">
              <span className="text-sm text-gray-600">Calculated Labor Cost: </span>
              <span className="font-semibold">${calculatedLaborCosts.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Materials and Other Costs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="materialsCosts" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Materials Costs ($)
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                From Job Line Items
              </Badge>
            </Label>
            <Input
              id="materialsCosts"
              type="number"
              step="0.01"
              min="0"
              value={materialsCosts.toFixed(2)}
              placeholder="Calculated from line items"
              data-testid="input-materials-costs"
              readOnly
              className="bg-gray-50"
            />
          </div>
          <div>
            <Label htmlFor="otherCosts" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Other Costs ($)
            </Label>
            <Input
              id="otherCosts"
              type="number"
              step="0.01"
              min="0"
              value={formData.otherCosts || ''}
              onChange={(e) => handleInputChange('otherCosts', e.target.value)}
              placeholder="Equipment, permits, etc."
              data-testid="input-other-costs"
            />
          </div>
        </div>

        {/* Cost Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-3">Cost Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between font-semibold text-green-700 border-b pb-2 mb-2">
              <span>Job Revenue:</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Labor Costs:</span>
              <span>${(hasStaffTimeEntries ? staffTimeLaborCost : (calculationMode === 'hourly' ? calculatedLaborCosts : laborCosts)).toFixed(2)}</span>
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
              <div className="text-2xl font-bold">{grossMarginPercent.toFixed(1)}%</div>
              <div className="text-sm flex items-center gap-1 mt-1">
                {React.createElement(getMarginStatus(grossMarginPercent).icon, { className: "h-4 w-4" })}
                {getMarginStatus(grossMarginPercent).text}
              </div>
            </div>
            <div>
              <div className="text-sm opacity-75">Gross Margin $</div>
              <div className="text-2xl font-bold">${grossMarginAmount.toFixed(2)}</div>
              <div className="text-sm mt-1">
                Revenue - Total Costs
              </div>
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
            {updateGrossMarginMutation.isPending ? 'Saving...' : 'Save Gross Margin'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}