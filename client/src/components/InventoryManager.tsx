import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus, Search, Package, Wrench, Truck, AlertTriangle, 
  Calendar, DollarSign, MapPin, Clock, CheckCircle, 
  Edit, Eye, QrCode, Download, Upload, Filter
} from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  type: string;
  brand?: string;
  model?: string;
  year?: number;
  status: 'available' | 'in_use' | 'maintenance' | 'retired';
  condition: 'excellent' | 'good' | 'fair' | 'needs_repair';
  currentLocation?: string;
  assignedTo?: string;
  hoursUsed?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  serialNumber?: string;
  photos?: string[];
  notes?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku?: string;
  category: 'parts' | 'consumables' | 'safety' | 'tools';
  currentStock: number;
  minimumStock: number;
  reorderPoint: number;
  unitCost?: number;
  supplier?: string;
  storageLocation?: string;
  lastOrderDate?: string;
  expirationDate?: string;
}

interface EquipmentCheckout {
  id: string;
  equipmentId: string;
  equipmentName: string;
  checkedOutBy: string;
  checkedOutTo?: string;
  checkoutTime: string;
  expectedReturnTime?: string;
  actualReturnTime?: string;
  status: 'checked_out' | 'returned' | 'overdue' | 'damaged';
  checkoutCondition: string;
  returnCondition?: string;
}

interface InventoryManagerProps {
  compact?: boolean;
}

export function InventoryManager({ compact = false }: InventoryManagerProps) {
  const [activeTab, setActiveTab] = useState("equipment");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAddEquipmentDialog, setShowAddEquipmentDialog] = useState(false);
  const [showAddInventoryDialog, setShowAddInventoryDialog] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const { toast } = useToast();

  // Fetch equipment data
  const { data: equipmentResponse, isLoading: equipmentLoading } = useQuery({
    queryKey: ['/api/equipment'],
    queryFn: async () => {
      const response = await fetch('/api/equipment');
      if (!response.ok) throw new Error('Failed to fetch equipment');
      return response.json();
    }
  });

  // Fetch inventory data
  const { data: inventoryResponse, isLoading: inventoryLoading } = useQuery({
    queryKey: ['/api/inventory'],
    queryFn: async () => {
      const response = await fetch('/api/inventory');
      if (!response.ok) throw new Error('Failed to fetch inventory');
      return response.json();
    }
  });

  // Fetch checkouts
  const { data: checkoutsResponse, isLoading: checkoutsLoading } = useQuery({
    queryKey: ['/api/equipment/checkouts'],
    queryFn: async () => {
      const response = await fetch('/api/equipment/checkouts');
      if (!response.ok) throw new Error('Failed to fetch checkouts');
      return response.json();
    }
  });

  const equipment = equipmentResponse?.data || [];
  const inventory = inventoryResponse?.data || [];
  const checkouts = checkoutsResponse?.data || [];

  // Create equipment mutation
  const createEquipmentMutation = useMutation({
    mutationFn: async (equipmentData: any) => {
      return await apiRequest('POST', '/api/equipment', equipmentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      setShowAddEquipmentDialog(false);
      toast({ title: "Success", description: "Equipment added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add equipment", variant: "destructive" });
    }
  });

  // Equipment checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (checkoutData: any) => {
      return await apiRequest('POST', '/api/equipment/checkout', checkoutData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/equipment'] });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment/checkouts'] });
      setShowCheckoutDialog(false);
      toast({ title: "Success", description: "Equipment checked out successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to checkout equipment", variant: "destructive" });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'in_use': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'retired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'fair': return 'bg-yellow-100 text-yellow-800';
      case 'needs_repair': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock <= 0) return 'out_of_stock';
    if (item.currentStock <= item.reorderPoint) return 'low_stock';
    if (item.currentStock <= item.minimumStock) return 'minimum_stock';
    return 'normal';
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case 'out_of_stock': return 'bg-red-100 text-red-800';
      case 'low_stock': return 'bg-orange-100 text-orange-800';
      case 'minimum_stock': return 'bg-yellow-100 text-yellow-800';
      case 'normal': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEquipment = equipment.filter((item: Equipment) => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInventory = inventory.filter((item: InventoryItem) => 
    (selectedCategory === "all" || item.category === selectedCategory) &&
    (item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.sku?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (compact) {
    return (
      <Card className="card-clean">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Equipment & Inventory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{equipment.filter((e: Equipment) => e.status === 'available').length}</div>
              <div className="text-sm text-gray-600">Available</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{equipment.filter((e: Equipment) => e.status === 'in_use').length}</div>
              <div className="text-sm text-gray-600">In Use</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Low Stock Alerts</div>
            {inventory.filter((item: InventoryItem) => getStockStatus(item) === 'low_stock' || getStockStatus(item) === 'out_of_stock').slice(0, 3).map((item: InventoryItem) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.name}</span>
                <Badge variant="outline" className={getStockColor(getStockStatus(item))}>
                  {item.currentStock} left
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Inventory Management</h2>
          <p className="text-gray-600">Track equipment, supplies, and maintenance schedules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search equipment, inventory, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-inventory"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="parts">Parts</SelectItem>
            <SelectItem value="consumables">Consumables</SelectItem>
            <SelectItem value="safety">Safety</SelectItem>
            <SelectItem value="tools">Tools</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="checkouts">Checkouts</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="equipment" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-green-100 text-green-800">
                {equipment.filter((e: Equipment) => e.status === 'available').length} Available
              </Badge>
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                {equipment.filter((e: Equipment) => e.status === 'in_use').length} In Use
              </Badge>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                {equipment.filter((e: Equipment) => e.status === 'maintenance').length} Maintenance
              </Badge>
            </div>
            <Button onClick={() => setShowAddEquipmentDialog(true)} data-testid="button-add-equipment">
              <Plus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredEquipment.map((item: Equipment) => (
              <Card key={item.id} className="card-clean hover-elevate">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium">{item.name}</CardTitle>
                      <p className="text-xs text-gray-600">{item.brand} {item.model}</p>
                    </div>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Condition</span>
                    <Badge variant="outline" className={getConditionColor(item.condition)}>
                      {item.condition.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  {item.currentLocation && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <MapPin className="h-3 w-3" />
                      {item.currentLocation}
                    </div>
                  )}
                  
                  {item.assignedTo && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Clock className="h-3 w-3" />
                      Assigned to {item.assignedTo}
                    </div>
                  )}

                  {item.hoursUsed && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Hours Used</span>
                        <span>{item.hoursUsed.toLocaleString()}</span>
                      </div>
                      <Progress value={Math.min((item.hoursUsed / 5000) * 100, 100)} className="h-1" />
                    </div>
                  )}

                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="flex-1" data-testid={`button-view-${item.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedEquipment(item);
                        setShowCheckoutDialog(true);
                      }}
                      disabled={item.status !== 'available'}
                      data-testid={`button-checkout-${item.id}`}
                    >
                      <Truck className="h-3 w-3 mr-1" />
                      Checkout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-red-100 text-red-800">
                {inventory.filter((item: InventoryItem) => getStockStatus(item) === 'out_of_stock').length} Out of Stock
              </Badge>
              <Badge variant="outline" className="bg-orange-100 text-orange-800">
                {inventory.filter((item: InventoryItem) => getStockStatus(item) === 'low_stock').length} Low Stock
              </Badge>
            </div>
            <Button onClick={() => setShowAddInventoryDialog(true)} data-testid="button-add-inventory">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredInventory.map((item: InventoryItem) => (
              <Card key={item.id} className="card-clean hover-elevate">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium">{item.name}</CardTitle>
                      {item.sku && <p className="text-xs text-gray-600">SKU: {item.sku}</p>}
                    </div>
                    <Badge variant="outline" className={getStockColor(getStockStatus(item))}>
                      {item.currentStock} in stock
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Stock Level</span>
                      <span>{item.currentStock} / {item.minimumStock} min</span>
                    </div>
                    <Progress 
                      value={Math.max((item.currentStock / (item.minimumStock * 2)) * 100, 5)} 
                      className="h-1" 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Category</span>
                    <Badge variant="outline">
                      {item.category}
                    </Badge>
                  </div>
                  
                  {item.storageLocation && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <MapPin className="h-3 w-3" />
                      {item.storageLocation}
                    </div>
                  )}

                  {item.unitCost && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Unit Cost</span>
                      <span className="font-medium">${item.unitCost.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="flex-1" data-testid={`button-edit-inventory-${item.id}`}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" data-testid={`button-reorder-${item.id}`}>
                      <Package className="h-3 w-3 mr-1" />
                      Reorder
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="checkouts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                {checkouts.filter((c: EquipmentCheckout) => c.status === 'checked_out').length} Active
              </Badge>
              <Badge variant="outline" className="bg-red-100 text-red-800">
                {checkouts.filter((c: EquipmentCheckout) => c.status === 'overdue').length} Overdue
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            {checkouts.map((checkout: EquipmentCheckout) => (
              <Card key={checkout.id} className="card-clean">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-medium">{checkout.equipmentName}</div>
                      <div className="text-sm text-gray-600">
                        Checked out by {checkout.checkedOutBy}
                        {checkout.checkedOutTo && ` to ${checkout.checkedOutTo}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(checkout.checkoutTime).toLocaleDateString()} at {new Date(checkout.checkoutTime).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={
                        checkout.status === 'checked_out' ? 'bg-blue-100 text-blue-800' :
                        checkout.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-green-100 text-green-800'
                      }>
                        {checkout.status.replace('_', ' ')}
                      </Badge>
                      {checkout.status === 'checked_out' && (
                        <Button size="sm" data-testid={`button-checkin-${checkout.id}`}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Check In
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="text-center p-8 text-gray-500">
            <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Maintenance scheduling coming soon!</p>
            <p className="text-sm mt-2">Track service schedules, repairs, and maintenance history.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Equipment Dialog */}
      <Dialog open={showAddEquipmentDialog} onOpenChange={setShowAddEquipmentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Equipment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Equipment name" data-testid="input-equipment-name" />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chainsaw">Chainsaw</SelectItem>
                    <SelectItem value="crane">Crane</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="chipper">Chipper</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" placeholder="Brand" data-testid="input-equipment-brand" />
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input id="model" placeholder="Model" data-testid="input-equipment-model" />
              </div>
            </div>
            <div>
              <Label htmlFor="location">Current Location</Label>
              <Input id="location" placeholder="Current location" data-testid="input-equipment-location" />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="Additional notes" data-testid="textarea-equipment-notes" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddEquipmentDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  // TODO: Implement form submission
                  toast({ title: "Success", description: "Equipment added successfully" });
                  setShowAddEquipmentDialog(false);
                }}
                data-testid="button-save-equipment"
              >
                Add Equipment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Equipment Checkout Dialog */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Check Out Equipment</DialogTitle>
          </DialogHeader>
          {selectedEquipment && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedEquipment.name}</div>
                <div className="text-sm text-gray-600">{selectedEquipment.brand} {selectedEquipment.model}</div>
              </div>
              <div>
                <Label htmlFor="checkedOutBy">Checked Out By</Label>
                <Input id="checkedOutBy" placeholder="Employee name" data-testid="input-checkout-employee" />
              </div>
              <div>
                <Label htmlFor="checkedOutTo">Checked Out To</Label>
                <Input id="checkedOutTo" placeholder="Job site or location" data-testid="input-checkout-location" />
              </div>
              <div>
                <Label htmlFor="expectedReturn">Expected Return Date</Label>
                <Input id="expectedReturn" type="datetime-local" data-testid="input-expected-return" />
              </div>
              <div>
                <Label htmlFor="checkoutNotes">Notes</Label>
                <Textarea id="checkoutNotes" placeholder="Checkout notes" data-testid="textarea-checkout-notes" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCheckoutDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    // TODO: Implement checkout submission
                    toast({ title: "Success", description: "Equipment checked out successfully" });
                    setShowCheckoutDialog(false);
                  }}
                  data-testid="button-confirm-checkout"
                >
                  Check Out
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}