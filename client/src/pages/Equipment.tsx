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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Equipment form schema
const equipmentFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
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

type EquipmentFormData = z.infer<typeof equipmentFormSchema>;

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
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);

  // Fetch equipment data
  const { data: equipmentData, isLoading } = useQuery({
    queryKey: ["/api/equipment"],
  });

  // Fetch equipment checkouts
  const { data: checkoutData } = useQuery({
    queryKey: ["/api/equipment/checkouts"],
  });

  const equipment = Array.isArray((equipmentData as any)?.data) ? (equipmentData as any).data : [];
  const checkouts = Array.isArray((checkoutData as any)?.data) ? (checkoutData as any).data : [];

  // Add equipment mutation
  const addEquipmentMutation = useMutation({
    mutationFn: (data: EquipmentFormData) => apiRequest("/api/equipment", "POST", data),
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

  // Equipment form
  const form = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      status: "available",
      condition: "good",
    },
  });

  const onSubmit = (data: EquipmentFormData) => {
    addEquipmentMutation.mutate(data);
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

  // Calculate stats
  const stats = {
    total: equipment.length,
    available: equipment.filter((e: any) => e.status === "available").length,
    inUse: equipment.filter((e: any) => e.status === "in_use").length,
    maintenance: equipment.filter((e: any) => e.status === "maintenance").length,
    retired: equipment.filter((e: any) => e.status === "retired").length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading equipment data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Equipment Management</h1>
          <p className="text-gray-600 mt-1">Track and manage your equipment inventory</p>
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
                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-3 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Equipment</p>
                <p className="text-2xl font-bold text-blue-900" data-testid="stat-total-equipment">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Available</p>
                <p className="text-2xl font-bold text-green-900" data-testid="stat-available-equipment">{stats.available}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">In Use</p>
                <p className="text-2xl font-bold text-blue-900" data-testid="stat-inuse-equipment">{stats.inUse}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Maintenance</p>
                <p className="text-2xl font-bold text-yellow-900" data-testid="stat-maintenance-equipment">{stats.maintenance}</p>
              </div>
              <Wrench className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-gray-50 to-gray-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Retired</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="stat-retired-equipment">{stats.retired}</p>
              </div>
              <XCircle className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

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
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                <div className="grid grid-cols-2 gap-3 text-sm">
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
                  <Button variant="outline" size="sm" data-testid={`button-view-${item.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" data-testid={`button-edit-${item.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" data-testid={`button-maintenance-${item.id}`}>
                      <Wrench className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}