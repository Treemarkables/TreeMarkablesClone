import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertEquipmentCheckoutSchema, insertEquipmentMaintenanceSchema } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Truck,
  Wrench,
  MapPin,
  Calendar,
  DollarSign,
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  User,
  Eye,
  Edit,
  Settings,
  BarChart3,
  Package,
  LogOut,
  LogIn,
  History,
  Undo2,
  TrendingUp,
  PieChart,
  Table as TableIcon,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Equipment form schema
const equipmentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.number().optional(),
  status: z.enum(["available", "in_use", "maintenance", "retired"]).default("available"),
  condition: z.enum(["excellent", "good", "fair", "needs_repair"]).default("good"),
  currentLocation: z.string().optional(),
  purchasePrice: z.string().optional(),
  currentValue: z.string().optional(),
  dailyRentalCost: z.string().optional(),
  serialNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  notes: z.string().optional(),
});

// Checkout form schema using shared schema
const checkoutFormSchema = insertEquipmentCheckoutSchema.omit({
  equipmentId: true,
  checkoutTime: true,
  status: true
}).extend({
  checkedOutBy: z.string().min(1, "Employee name is required"),
  checkedOutTo: z.string().optional(),
  jobId: z.string().optional(),
  expectedReturnTime: z.string().optional(),
  checkoutCondition: z.enum(["excellent", "good", "fair", "damaged"]).default("good"),
  notes: z.string().optional()
});

// Checkin form schema
const checkinFormSchema = z.object({
  returnCondition: z.enum(["excellent", "good", "fair", "damaged"]).default("good"),
  hoursUsed: z.string().optional(),
  mileageEnd: z.string().optional(),
  fuelLevelEnd: z.string().optional(),
  damageReport: z.string().optional(),
  notes: z.string().optional()
});

// Maintenance form schema using shared schema
const maintenanceFormSchema = insertEquipmentMaintenanceSchema.omit({
  equipmentId: true
}).extend({
  maintenanceType: z.enum(["routine", "repair", "inspection", "calibration"]).default("routine"),
  description: z.string().min(1, "Description is required"),
  performedBy: z.string().optional(),
  cost: z.string().optional(),
  partsReplaced: z.array(z.string()).default([]),
  nextServiceDue: z.string().optional(),
  notes: z.string().optional(),
  invoiceNumber: z.string().optional(),
  warrantyInfo: z.string().optional()
});

type EquipmentFormData = z.infer<typeof equipmentFormSchema>;
type CheckoutFormData = z.infer<typeof checkoutFormSchema>;
type CheckinFormData = z.infer<typeof checkinFormSchema>;
type MaintenanceFormData = z.infer<typeof maintenanceFormSchema>;

// Equipment types for filtering
const equipmentTypes = [
  "bucket_truck",
  "chainsaw", 
  "chipper",
  "stump_grinder",
  "safety_gear",
  "crane",
  "dump_truck",
  "generator",
  "wood_splitter"
];

// Status color mapping
const getStatusColor = (status: string) => {
  switch (status) {
    case "available": return "bg-green-100 text-green-800";
    case "in_use": return "bg-blue-100 text-blue-800";
    case "maintenance": return "bg-yellow-100 text-yellow-800";
    case "retired": return "bg-gray-100 text-gray-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

// Condition color mapping
const getConditionColor = (condition: string) => {
  switch (condition) {
    case "excellent": return "bg-green-100 text-green-800";
    case "good": return "bg-blue-100 text-blue-800";
    case "fair": return "bg-yellow-100 text-yellow-800";
    case "needs_repair": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
};

// Status icons
const getStatusIcon = (status: string) => {
  switch (status) {
    case "available": return <CheckCircle className="h-4 w-4" />;
    case "in_use": return <Clock className="h-4 w-4" />;
    case "maintenance": return <Wrench className="h-4 w-4" />;
    case "retired": return <XCircle className="h-4 w-4" />;
    default: return <AlertTriangle className="h-4 w-4" />;
  }
};

export default function Equipment() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [selectedCheckout, setSelectedCheckout] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [partsInput, setPartsInput] = useState("");

  // Fetch equipment data
  const { data: equipmentData, isLoading } = useQuery({
    queryKey: ["/api/equipment"],
  });

  // Fetch equipment checkouts
  const { data: checkoutData } = useQuery({
    queryKey: ["/api/equipment/checkouts"],
  });

  // Fetch maintenance records for all equipment
  const { data: maintenanceData, isLoading: isMaintenanceLoading } = useQuery({
    queryKey: ["/api/equipment/maintenance"],
  });

  const equipment = Array.isArray((equipmentData as any)?.data) ? (equipmentData as any).data : [];
  const checkouts = Array.isArray((checkoutData as any)?.data) ? (checkoutData as any).data : [];
  const maintenanceRecords = Array.isArray((maintenanceData as any)?.data) ? (maintenanceData as any).data : [];

  // Add equipment mutation
  const addEquipmentMutation = useMutation({
    mutationFn: (data: EquipmentFormData) => apiRequest("POST", "/api/equipment", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setIsAddEquipmentOpen(false);
      toast({
        title: "Success",
        description: "Equipment added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add equipment",
        variant: "destructive",
      });
    },
  });

  // Checkout equipment mutation
  const checkoutMutation = useMutation({
    mutationFn: (data: CheckoutFormData & { equipmentId: string }) => 
      apiRequest("POST", "/api/equipment/checkout", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/checkouts"] });
      setIsCheckoutOpen(false);
      setSelectedEquipment(null);
      toast({
        title: "Success",
        description: "Equipment checked out successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to checkout equipment",
        variant: "destructive",
      });
    },
  });

  // Checkin equipment mutation
  const checkinMutation = useMutation({
    mutationFn: (data: CheckinFormData & { checkoutId: string }) => {
      const { checkoutId, ...checkinData } = data;
      return apiRequest("PUT", `/api/equipment/checkin/${checkoutId}`, checkinData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment/checkouts"] });
      setIsCheckinOpen(false);
      setSelectedCheckout(null);
      toast({
        title: "Success",
        description: "Equipment checked in successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to checkin equipment",
        variant: "destructive",
      });
    },
  });

  // Add maintenance record mutation
  const maintenanceMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest("POST", "/api/equipment/maintenance", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      setIsMaintenanceOpen(false);
      setSelectedEquipment(null);
      setPartsInput("");
      maintenanceForm.reset();
      toast({
        title: "Success",
        description: "Maintenance record added successfully",
      });
    },
    onError: (error: any) => {
      console.error('Maintenance error:', error);
      toast({
        title: "Error",
        description: "Failed to add maintenance record",
        variant: "destructive",
      });
    },
  });

  // Delete equipment mutation
  const deleteEquipmentMutation = useMutation({
    mutationFn: (equipmentId: string) => 
      apiRequest("DELETE", `/api/equipment/${equipmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "Success",
        description: "Equipment deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete equipment",
        variant: "destructive",
      });
    },
  });

  // Equipment form
  const form = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      status: "available",
      condition: "good",
    },
  });

  // Checkout form
  const checkoutForm = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      checkoutCondition: "good",
    },
  });

  // Checkin form
  const checkinForm = useForm<CheckinFormData>({
    resolver: zodResolver(checkinFormSchema),
    defaultValues: {
      returnCondition: "good",
    },
  });

  // Maintenance form
  const maintenanceForm = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: {
      maintenanceType: "routine",
      partsReplaced: [],
    },
  });

  const onSubmit = (data: EquipmentFormData) => {
    addEquipmentMutation.mutate(data);
  };

  const onCheckout = (data: CheckoutFormData) => {
    if (selectedEquipment) {
      checkoutMutation.mutate({ ...data, equipmentId: selectedEquipment.id });
    }
  };

  const onCheckin = (data: CheckinFormData) => {
    if (selectedCheckout) {
      checkinMutation.mutate({ ...data, checkoutId: selectedCheckout.id });
    }
  };

  const onMaintenance = (data: MaintenanceFormData) => {
    if (selectedEquipment) {
      // Convert and format data properly
      const formattedData = {
        ...data,
        equipmentId: selectedEquipment.id,
        cost: data.cost ? parseFloat(data.cost) : undefined,
        partsReplaced: partsInput ? partsInput.split(',').map(p => p.trim()).filter(p => p) : [],
        nextServiceDue: data.nextServiceDue ? new Date(data.nextServiceDue).toISOString() : undefined,
      };
      maintenanceMutation.mutate(formattedData);
    }
  };

  // Filter equipment
  const filteredEquipment = equipment.filter((item: any) => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.model?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Get overdue maintenance equipment (for now, using lastMaintenanceDate + intervalDays)
  const getOverdueMaintenance = () => {
    const now = new Date();
    return equipment.filter((item: any) => {
      if (!item.lastMaintenanceDate || !item.maintenanceIntervalDays) return false;
      const lastMaintenance = new Date(item.lastMaintenanceDate);
      const nextDue = new Date(lastMaintenance.getTime() + (item.maintenanceIntervalDays * 24 * 60 * 60 * 1000));
      return nextDue < now;
    });
  };

  const overdueMaintenance = getOverdueMaintenance();

  // Get active checkouts for display
  const activeCheckouts = checkouts.filter((checkout: any) => !checkout.actualReturnTime);
  const overdueCheckouts = activeCheckouts.filter((checkout: any) => {
    if (!checkout.expectedReturnTime) return false;
    return new Date(checkout.expectedReturnTime) < new Date();
  });

  // Calculate stats
  const stats = {
    total: equipment.length,
    available: equipment.filter((e: any) => e.status === "available").length,
    inUse: equipment.filter((e: any) => e.status === "in_use").length,
    maintenance: equipment.filter((e: any) => e.status === "maintenance").length,
    retired: equipment.filter((e: any) => e.status === "retired").length,
    activeCheckouts: activeCheckouts.length,
    overdueCheckouts: overdueCheckouts.length,
    overdueMaintenance: overdueMaintenance.length,
    maintenanceRecords: maintenanceRecords.length,
  };

  // Handle checkout/checkin/maintenance actions
  const handleCheckout = (equipmentItem: any) => {
    setSelectedEquipment(equipmentItem);
    setIsCheckoutOpen(true);
    checkoutForm.reset();
  };

  const handleCheckin = (checkout: any) => {
    setSelectedCheckout(checkout);
    setIsCheckinOpen(true);
    checkinForm.reset();
  };

  const handleMaintenance = (equipmentItem: any) => {
    setSelectedEquipment(equipmentItem);
    setIsMaintenanceOpen(true);
    maintenanceForm.reset();
    setPartsInput("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading equipment data...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Equipment Management</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Track and manage your equipment inventory</p>
          {(overdueCheckouts.length > 0 || overdueMaintenance.length > 0) && (
            <div className="mt-2 space-y-1">
              {overdueCheckouts.length > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {overdueCheckouts.length} overdue checkout{overdueCheckouts.length > 1 ? 's' : ''}
                </Badge>
              )}
              {overdueMaintenance.length > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  <Wrench className="h-3 w-3 mr-1" />
                  {overdueMaintenance.length} overdue maintenance
                </Badge>
              )}
            </div>
          )}
        </div>
        
        <Dialog open={isAddEquipmentOpen} onOpenChange={setIsAddEquipmentOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-equipment">
              <Plus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Equipment</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipment Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Bucket Truck #1" {...field} data-testid="input-equipment-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-equipment-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {equipmentTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brand</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Altec" {...field} data-testid="input-equipment-brand" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., AT37G" {...field} data-testid="input-equipment-model" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="2020"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            data-testid="input-equipment-year"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-equipment-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="in_use">In Use</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-equipment-condition">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="needs_repair">Needs Repair</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="currentLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Location</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Main Depot" {...field} data-testid="input-equipment-location" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Equipment serial number" {...field} data-testid="input-equipment-serial" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional notes about the equipment..."
                          {...field}
                          data-testid="textarea-equipment-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddEquipmentOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={addEquipmentMutation.isPending}
                    data-testid="button-save-equipment"
                  >
                    {addEquipmentMutation.isPending ? "Adding..." : "Add Equipment"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600">Total Equipment</p>
                <p className="text-lg font-bold text-blue-900" data-testid="stat-total-equipment">{stats.total}</p>
              </div>
              <Package className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-600">Available</p>
                <p className="text-lg font-bold text-green-900" data-testid="stat-available-equipment">{stats.available}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600">In Use</p>
                <p className="text-lg font-bold text-blue-900" data-testid="stat-inuse-equipment">{stats.inUse}</p>
              </div>
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-yellow-600">Maintenance</p>
                <p className="text-lg font-bold text-yellow-900" data-testid="stat-maintenance-equipment">{stats.maintenance}</p>
              </div>
              <Wrench className="h-5 w-5 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-gray-50 to-gray-100">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Retired</p>
                <p className="text-lg font-bold text-gray-900" data-testid="stat-retired-equipment">{stats.retired}</p>
              </div>
              <XCircle className="h-5 w-5 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600">Active Checkouts</p>
                <p className="text-lg font-bold text-blue-900" data-testid="stat-active-checkouts">{stats.activeCheckouts}</p>
              </div>
              <LogOut className="h-5 w-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-r ${overdueCheckouts.length > 0 ? 'from-red-50 to-red-100' : 'from-gray-50 to-gray-100'}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-medium ${overdueCheckouts.length > 0 ? 'text-red-600' : 'text-gray-600'}`}>Overdue</p>
                <p className={`text-lg font-bold ${overdueCheckouts.length > 0 ? 'text-red-900' : 'text-gray-900'}`} data-testid="stat-overdue-checkouts">{stats.overdueCheckouts}</p>
              </div>
              <AlertTriangle className={`h-5 w-5 ${overdueCheckouts.length > 0 ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-r ${overdueMaintenance.length > 0 ? 'from-orange-50 to-orange-100' : 'from-gray-50 to-gray-100'}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-medium ${overdueMaintenance.length > 0 ? 'text-orange-600' : 'text-gray-600'}`}>Overdue Maintenance</p>
                <p className={`text-lg font-bold ${overdueMaintenance.length > 0 ? 'text-orange-900' : 'text-gray-900'}`} data-testid="stat-overdue-maintenance">{stats.overdueMaintenance}</p>
              </div>
              <Wrench className={`h-5 w-5 ${overdueMaintenance.length > 0 ? 'text-orange-600' : 'text-gray-600'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">Equipment Overview</TabsTrigger>
          <TabsTrigger value="checkouts" data-testid="tab-checkouts">Active Checkouts ({activeCheckouts.length})</TabsTrigger>
          <TabsTrigger value="maintenance" data-testid="tab-maintenance">Maintenance ({stats.overdueMaintenance})</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search equipment..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-equipment"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-filter-status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="in_use">In Use</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger data-testid="select-filter-type">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {equipmentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Equipment List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredEquipment.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Equipment Found</h3>
                <p className="text-gray-600 mb-4">
                  {equipment.length === 0 
                    ? "Add your first piece of equipment to get started."
                    : "No equipment matches your current filters."
                  }
                </p>
                {equipment.length === 0 && (
                  <Button onClick={() => setIsAddEquipmentOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Equipment
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredEquipment.map((item: any) => (
            <Card key={item.id} className="hover-elevate" data-testid={`equipment-card-${item.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg" data-testid={`equipment-name-${item.id}`}>
                      {item.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {item.brand} {item.model} {item.year && `(${item.year})`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(item.status)}>
                      {getStatusIcon(item.status)}
                      <span className="ml-1">{item.status?.replace(/_/g, ' ')}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-gray-400" />
                    <span>Type:</span>
                    <span className="font-medium">{item.type?.replace(/_/g, ' ')}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={getConditionColor(item.condition)} variant="outline">
                      {item.condition?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  
                  {item.currentLocation && (
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>{item.currentLocation}</span>
                    </div>
                  )}
                  
                  {item.assignedTo && (
                    <div className="flex items-center gap-2 col-span-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>Assigned to: {item.assignedTo}</span>
                    </div>
                  )}
                </div>

                {item.notes && (
                  <div className="text-sm text-gray-600 pt-2 border-t">
                    <p className="line-clamp-2">{item.notes}</p>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t">
                  {item.status === "available" ? (
                    <Button 
                      variant="default" 
                      size={isMobile ? "default" : "sm"}
                      className={isMobile ? "h-11" : ""}
                      onClick={() => handleCheckout(item)}
                      data-testid={`button-checkout-${item.id}`}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Check Out
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      size={isMobile ? "default" : "sm"}
                      className={isMobile ? "h-11" : ""}
                      data-testid={`button-view-${item.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size={isMobile ? "icon" : "sm"}
                      className={isMobile ? "h-11 w-11" : ""}
                      data-testid={`button-edit-${item.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size={isMobile ? "icon" : "sm"}
                      className={isMobile ? "h-11 w-11" : ""}
                      onClick={() => handleMaintenance(item)}
                      data-testid={`button-maintenance-${item.id}`}
                    >
                      <Wrench className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size={isMobile ? "icon" : "sm"}
                      className={isMobile ? "h-11 w-11" : ""}
                      onClick={() => deleteEquipmentMutation.mutate(item.id)}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
        </TabsContent>

        <TabsContent value="checkouts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                Active Checkouts ({activeCheckouts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeCheckouts.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Checkouts</h3>
                  <p className="text-gray-600">All equipment is currently available.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeCheckouts.map((checkout: any) => (
                    <Card key={checkout.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{checkout.equipmentName || 'Equipment'}</h4>
                            <p className="text-sm text-gray-600">Checked out to: {checkout.checkedOutTo || checkout.checkedOutBy}</p>
                            <p className="text-sm text-gray-500">Since: {new Date(checkout.checkoutTime).toLocaleDateString()}</p>
                            {checkout.expectedReturnTime && (
                              <p className="text-sm text-gray-500">Expected return: {new Date(checkout.expectedReturnTime).toLocaleDateString()}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size={isMobile ? "default" : "sm"}
                              className={isMobile ? "h-11" : ""}
                              onClick={() => handleCheckin(checkout)}
                              data-testid={`button-checkin-${checkout.id}`}
                            >
                              <LogIn className="h-4 w-4 mr-2" />
                              Check In
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Analytics Overview Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Equipment Value</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="stat-total-value">
                      ${equipment.reduce((sum: number, item: any) => {
                        const price = parseFloat(item.purchasePrice?.toString() || "0");
                        return sum + (isNaN(price) ? 0 : price);
                      }, 0).toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Utilization Rate</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="stat-utilization-rate">
                      {stats.total > 0 ? Math.round((stats.inUse / stats.total) * 100) : 0}%
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg. Equipment Age</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="stat-avg-age">
                      {equipment.length > 0 ? 
                        Math.round(equipment.reduce((sum: number, item: any) => {
                          const age = item.purchaseDate ? 
                            (new Date().getFullYear() - new Date(item.purchaseDate).getFullYear()) : 0;
                          return sum + age;
                        }, 0) / equipment.length) : 0} years
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Maintenance Cost</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="stat-maintenance-cost">
                      ${maintenanceRecords.reduce((sum: number, record: any) => {
                        const cost = parseFloat(record.cost?.toString() || "0");
                        return sum + (isNaN(cost) ? 0 : cost);
                      }, 0).toLocaleString()}
                    </p>
                  </div>
                  <Wrench className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Equipment Utilization Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Equipment Utilization by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(Array.from(new Set(equipment.map((item: any) => item.type).filter(Boolean))) as string[]).map((type: string) => {
                  const typeEquipment = equipment.filter((item: any) => item.type === type);
                  const inUseCount = typeEquipment.filter((item: any) => item.status === 'in_use').length;
                  const utilizationRate = typeEquipment.length > 0 ? (inUseCount / typeEquipment.length) * 100 : 0;
                  
                  return (
                    <div key={type} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize">{type?.replace('_', ' ')}</span>
                        <span className="text-gray-600">{inUseCount}/{typeEquipment.length} ({Math.round(utilizationRate)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${utilizationRate}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Equipment Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableIcon className="h-5 w-5" />
                Equipment Performance Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Equipment</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Age</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Total Checkouts</th>
                      <th className="text-left p-3 font-medium">Current Usage</th>
                      <th className="text-left p-3 font-medium">Last Maintenance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((item: any) => {
                      const itemCheckouts = checkouts.filter((checkout: any) => checkout.equipmentId === item.id);
                      const currentCheckout = itemCheckouts.find((checkout: any) => !checkout.actualReturnTime);
                      const age = item.purchaseDate ? 
                        (new Date().getFullYear() - new Date(item.purchaseDate).getFullYear()) : 'Unknown';
                      
                      return (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-gray-600 text-xs">{item.brand} {item.model}</div>
                            </div>
                          </td>
                          <td className="p-3 capitalize">{item.type?.replace('_', ' ')}</td>
                          <td className="p-3">{age} {age !== 'Unknown' && 'years'}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                              {getStatusIcon(item.status)}
                              <span className="ml-1 capitalize">{item.status?.replace('_', ' ')}</span>
                            </span>
                          </td>
                          <td className="p-3 text-center" data-testid={`equipment-checkouts-${item.id}`}>{itemCheckouts.length}</td>
                          <td className="p-3">
                            {currentCheckout ? (
                              <div className="text-sm">
                                <div className="font-medium">{currentCheckout.customerName}</div>
                                <div className="text-gray-600">Since {new Date(currentCheckout.checkoutTime).toLocaleDateString()}</div>
                              </div>
                            ) : (
                              <span className="text-gray-500">Not in use</span>
                            )}
                          </td>
                          <td className="p-3">
                            {item.lastMaintenanceDate ? 
                              new Date(item.lastMaintenanceDate).toLocaleDateString() : 
                              <span className="text-gray-500">Never</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Cost Analysis */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Equipment Value by Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {['available', 'in_use', 'maintenance', 'retired'].map((status) => {
                  const statusEquipment = equipment.filter((item: any) => item.status === status);
                  const statusValue = statusEquipment.reduce((sum: number, item: any) => {
                    const price = parseFloat(item.purchasePrice?.toString() || "0");
                    return sum + (isNaN(price) ? 0 : price);
                  }, 0);
                  const totalValue = equipment.reduce((sum: number, item: any) => {
                    const price = parseFloat(item.purchasePrice?.toString() || "0");
                    return sum + (isNaN(price) ? 0 : price);
                  }, 0);
                  const percentage = totalValue > 0 ? (statusValue / totalValue) * 100 : 0;
                  
                  return (
                    <div key={status} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize flex items-center gap-2">
                          {getStatusIcon(status)}
                          {status.replace('_', ' ')}
                        </span>
                        <span className="text-gray-600">${statusValue.toLocaleString()} ({Math.round(percentage)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(status).includes('green') ? 'bg-green-500' : 
                            getStatusColor(status).includes('blue') ? 'bg-blue-500' : 
                            getStatusColor(status).includes('yellow') ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Equipment Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Most Utilized Equipment:</span>
                    <span className="text-sm font-medium">
                      {equipment.length > 0 ? 
                        equipment
                          .map((item: any) => ({
                            ...item,
                            checkoutCount: checkouts.filter((c: any) => c.equipmentId === item.id).length
                          }))
                          .sort((a: any, b: any) => b.checkoutCount - a.checkoutCount)[0]?.name || 'N/A'
                        : 'N/A'
                      }
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Oldest Equipment:</span>
                    <span className="text-sm font-medium">
                      {equipment.length > 0 ? 
                        equipment
                          .filter((item: any) => item.purchaseDate)
                          .sort((a: any, b: any) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime())[0]?.name || 'N/A'
                        : 'N/A'
                      }
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Most Expensive:</span>
                    <span className="text-sm font-medium">
                      {equipment.length > 0 ? 
                        equipment
                          .sort((a: any, b: any) => (b.purchasePrice || 0) - (a.purchasePrice || 0))[0]?.name || 'N/A'
                        : 'N/A'
                      }
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Equipment Needing Attention:</span>
                    <span className="text-sm font-medium text-red-600">
                      {overdueMaintenance.length + stats.maintenance} items
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Checkout History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {checkouts.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Checkout History</h3>
                  <p className="text-gray-600">Equipment checkout history will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {checkouts.map((checkout: any) => (
                    <Card key={checkout.id} className={`${checkout.actualReturnTime ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-blue-500'}`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{checkout.equipmentName || 'Equipment'}</h4>
                            <p className="text-sm text-gray-600">Checked out to: {checkout.checkedOutTo || checkout.checkedOutBy}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 text-sm text-gray-500">
                              <div>
                                <span className="font-medium">Checked out:</span> {new Date(checkout.checkoutTime).toLocaleDateString()}
                              </div>
                              {checkout.actualReturnTime && (
                                <div>
                                  <span className="font-medium">Returned:</span> {new Date(checkout.actualReturnTime).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge className={checkout.actualReturnTime ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                            {checkout.actualReturnTime ? 'Returned' : 'Active'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Maintenance Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueMaintenance.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-red-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Overdue Maintenance ({overdueMaintenance.length})
                  </h3>
                  <div className="space-y-3">
                    {overdueMaintenance.map((item: any) => (
                      <Card key={item.id} className="border-l-4 border-l-red-500">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold">{item.name}</h4>
                              <p className="text-sm text-gray-600">{item.brand} {item.model}</p>
                              <p className="text-sm text-red-600">Last maintenance: {item.lastMaintenanceDate ? new Date(item.lastMaintenanceDate).toLocaleDateString() : 'Never'}</p>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => handleMaintenance(item)}
                              data-testid={`button-maintenance-overdue-${item.id}`}
                            >
                              <Wrench className="h-4 w-4 mr-2" />
                              Schedule Maintenance
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Maintenance Records</h3>
                {maintenanceRecords.length === 0 ? (
                  <div className="text-center py-8">
                    <Wrench className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Maintenance Records</h3>
                    <p className="text-gray-600">Equipment maintenance history will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {maintenanceRecords.slice(0, 10).map((record: any) => (
                      <Card key={record.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold">{record.equipmentName || 'Equipment'}</h4>
                              <p className="text-sm text-gray-600">Type: {record.maintenanceType}</p>
                              <p className="text-sm text-gray-600">{record.description}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 text-sm text-gray-500">
                                <div>
                                  <span className="font-medium">Performed by:</span> {record.performedBy || 'N/A'}
                                </div>
                                <div>
                                  <span className="font-medium">Date:</span> {new Date(record.createdAt).toLocaleDateString()}
                                </div>
                                {record.cost && (
                                  <div>
                                    <span className="font-medium">Cost:</span> ${record.cost}
                                  </div>
                                )}
                                {record.nextServiceDue && (
                                  <div>
                                    <span className="font-medium">Next service:</span> {new Date(record.nextServiceDue).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Badge className="bg-blue-100 text-blue-800">
                              {record.maintenanceType}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Checkout Equipment Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Check Out Equipment</DialogTitle>
          </DialogHeader>
          
          {selectedEquipment && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold">{selectedEquipment.name}</h4>
                <p className="text-sm text-gray-600">{selectedEquipment.brand} {selectedEquipment.model}</p>
              </div>

              <Form {...checkoutForm}>
                <form onSubmit={checkoutForm.handleSubmit(onCheckout)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={checkoutForm.control}
                      name="checkedOutBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Checked Out By</FormLabel>
                          <FormControl>
                            <Input placeholder="Employee name" {...field} data-testid="input-checked-out-by" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={checkoutForm.control}
                      name="checkedOutTo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Checked Out To</FormLabel>
                          <FormControl>
                            <Input placeholder="Job site or crew member" {...field} data-testid="input-checked-out-to" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={checkoutForm.control}
                      name="expectedReturnTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Return Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-expected-return" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={checkoutForm.control}
                      name="checkoutCondition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-checkout-condition">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="excellent">Excellent</SelectItem>
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="fair">Fair</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={checkoutForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Additional notes..."
                            {...field}
                            data-testid="textarea-checkout-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCheckoutOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={checkoutMutation.isPending}
                      data-testid="button-confirm-checkout"
                    >
                      {checkoutMutation.isPending ? "Checking Out..." : "Check Out Equipment"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkin Equipment Dialog */}
      <Dialog open={isCheckinOpen} onOpenChange={setIsCheckinOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Check In Equipment</DialogTitle>
          </DialogHeader>
          
          {selectedCheckout && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold">{selectedCheckout.equipmentName || 'Equipment'}</h4>
                <p className="text-sm text-gray-600">Checked out to: {selectedCheckout.checkedOutTo}</p>
                <p className="text-sm text-gray-500">Since: {new Date(selectedCheckout.checkoutTime).toLocaleDateString()}</p>
              </div>

              <Form {...checkinForm}>
                <form onSubmit={checkinForm.handleSubmit(onCheckin)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={checkinForm.control}
                      name="returnCondition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Return Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-return-condition">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="excellent">Excellent</SelectItem>
                              <SelectItem value="good">Good</SelectItem>
                              <SelectItem value="fair">Fair</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={checkinForm.control}
                      name="hoursUsed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hours Used</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" placeholder="0.0" {...field} data-testid="input-hours-used" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={checkinForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Return Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any issues or observations..."
                            {...field}
                            data-testid="textarea-checkin-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={checkinForm.control}
                    name="damageReport"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Damage Report (if any)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe any damage or issues..."
                            {...field}
                            data-testid="textarea-damage-report"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCheckinOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={checkinMutation.isPending}
                      data-testid="button-confirm-checkin"
                    >
                      {checkinMutation.isPending ? "Checking In..." : "Check In Equipment"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Maintenance Record Dialog */}
      <Dialog open={isMaintenanceOpen} onOpenChange={setIsMaintenanceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Maintenance Record</DialogTitle>
          </DialogHeader>
          
          {selectedEquipment && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold">{selectedEquipment.name}</h4>
                <p className="text-sm text-gray-600">{selectedEquipment.brand} {selectedEquipment.model}</p>
              </div>

              <Form {...maintenanceForm}>
                <form onSubmit={maintenanceForm.handleSubmit(onMaintenance)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={maintenanceForm.control}
                      name="maintenanceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maintenance Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-maintenance-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="routine">Routine</SelectItem>
                              <SelectItem value="repair">Repair</SelectItem>
                              <SelectItem value="inspection">Inspection</SelectItem>
                              <SelectItem value="calibration">Calibration</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={maintenanceForm.control}
                      name="performedBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Performed By</FormLabel>
                          <FormControl>
                            <Input placeholder="Technician name" {...field} data-testid="input-performed-by" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={maintenanceForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the maintenance performed..."
                            {...field}
                            data-testid="textarea-maintenance-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={maintenanceForm.control}
                      name="cost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-maintenance-cost" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={maintenanceForm.control}
                      name="nextServiceDue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Next Service Due</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-next-service" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={maintenanceForm.control}
                      name="invoiceNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Number</FormLabel>
                          <FormControl>
                            <Input placeholder="INV-001" {...field} data-testid="input-invoice-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parts Replaced (comma-separated)
                    </label>
                    <Input
                      placeholder="Oil filter, spark plug, air filter"
                      value={partsInput}
                      onChange={(e) => setPartsInput(e.target.value)}
                      data-testid="input-parts-replaced"
                    />
                  </div>

                  <FormField
                    control={maintenanceForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Additional notes about the maintenance..."
                            {...field}
                            data-testid="textarea-maintenance-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={maintenanceForm.control}
                    name="warrantyInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Information</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Warranty details for parts or service..."
                            {...field}
                            data-testid="textarea-warranty-info"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsMaintenanceOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={maintenanceMutation.isPending}
                      data-testid="button-confirm-maintenance"
                    >
                      {maintenanceMutation.isPending ? "Adding..." : "Add Maintenance Record"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}