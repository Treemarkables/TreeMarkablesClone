import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Plus, Search, Filter, ArrowUpDown, DollarSign, Truck, TreePine, Scissors, Wrench, Edit, Trash2, Upload, Download } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

// Form schema for adding/editing materials
const materialSchema = z.object({
  itemNumber: z.string().min(1, "Item number is required"),
  name: z.string().min(1, "Name is required"),
  price: z.string().min(1, "Price is required"),
  priceIncludesTax: z.boolean(),
  taxRate: z.string().min(1, "Tax rate is required"),
  category: z.string().min(1, "Category is required"),
});

// Form schema for adding/editing services
const serviceSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  category: z.string().min(1, "Category is required"),
  basePrice: z.string().min(1, "Base price is required"),
  unit: z.string().min(1, "Unit is required"),
  description: z.string().optional(),
});

type MaterialFormData = z.infer<typeof materialSchema>;
type ServiceFormData = z.infer<typeof serviceSchema>;

// Mock data for materials matching ServiceM8 screenshot
const mockMaterials = [
  {
    id: "1",
    itemNumber: "VIP",
    name: "10% discount with VIP membership",
    price: 0.00,
    priceIncludesTax: false,
    taxRate: "No GST",
    category: "Discount"
  },
  {
    id: "2", 
    itemNumber: "Admin Time",
    name: "Admin Time",
    price: 0.00,
    priceIncludesTax: false,
    taxRate: "15% GST on Income",
    category: "Labour"
  },
  {
    id: "3",
    itemNumber: "41",
    name: "Bandit chipper hire",
    price: 500.00,
    priceIncludesTax: false,
    taxRate: "15% GST on Income",
    category: "Equipment"
  },
  {
    id: "4",
    itemNumber: "17",
    name: "Bucket truck",
    price: 80.00,
    priceIncludesTax: false,
    taxRate: "15% GST on Income",
    category: "Equipment"
  },
  {
    id: "5",
    itemNumber: "11",
    name: "Call out",
    price: 100.00,
    priceIncludesTax: false,
    taxRate: "15% GST on Income",
    category: "Service"
  },
  {
    id: "6",
    itemNumber: "29 labour",
    name: "Dan labour",
    price: 0.00,
    priceIncludesTax: false,
    taxRate: "15% GST on Income",
    category: "Labour"
  },
  {
    id: "7",
    itemNumber: "SERVICEM8-36",
    name: "Day 1",
    price: 0.00,
    priceIncludesTax: false,
    taxRate: "15% GST on Income",
    category: "Service"
  },
  {
    id: "8",
    itemNumber: "SERVICEM8-54",
    name: "Day 1",
    price: 0.00,
    priceIncludesTax: false,
    taxRate: "15% GST on Income",
    category: "Service"
  },
  {
    id: "9",
    itemNumber: "67",
    name: "Digger and truck",
    price: 890.00,
    priceIncludesTax: false,
    taxRate: "15% GST on Income",
    category: "Equipment"
  },
  {
    id: "10",
    itemNumber: "39",
    name: "Disposal",
    price: 250.00,
    priceIncludesTax: false,
    taxRate: "15% GST on Income",
    category: "Service"
  }
];

const mockServices = [
  {
    id: "1",
    name: "Tree Removal - Small (under 5m)",
    category: "Tree Services",
    basePrice: 250.00,
    unit: "per tree",
    description: "Complete removal including stump grinding"
  },
  {
    id: "2",
    name: "Tree Removal - Medium (5-10m)", 
    category: "Tree Services",
    basePrice: 650.00,
    unit: "per tree",
    description: "Complete removal including stump grinding"
  },
  {
    id: "3",
    name: "Tree Removal - Large (10m+)",
    category: "Tree Services", 
    basePrice: 1250.00,
    unit: "per tree",
    description: "Complex removal with crane assistance if needed"
  },
  {
    id: "4",
    name: "Hedge Trimming",
    category: "Maintenance",
    basePrice: 85.00,
    unit: "per hour",
    description: "Professional hedge shaping and maintenance"
  },
  {
    id: "5",
    name: "Stump Grinding",
    category: "Tree Services",
    basePrice: 180.00,
    unit: "per stump",
    description: "Complete stump removal and cleanup"
  }
];

export default function MaterialsServices() {
  const [activeTab, setActiveTab] = useState("materials");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [materials, setMaterials] = useState(mockMaterials);
  const [services, setServices] = useState(mockServices);
  const [showAddMaterialDialog, setShowAddMaterialDialog] = useState(false);
  const [showEditMaterialDialog, setShowEditMaterialDialog] = useState(false);
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false);
  const [showEditServiceDialog, setShowEditServiceDialog] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [editingService, setEditingService] = useState<any>(null);
  const { toast } = useToast();

  const materialForm = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      itemNumber: "",
      name: "",
      price: "",
      priceIncludesTax: false,
      taxRate: "15% GST on Income",
      category: "",
    },
  });

  const serviceForm = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      category: "",
      basePrice: "",
      unit: "",
      description: "",
    },
  });

  const onAddMaterial = (data: MaterialFormData) => {
    try {
      const newMaterial = {
        id: Date.now().toString(),
        itemNumber: data.itemNumber,
        name: data.name,
        price: parseFloat(data.price),
        priceIncludesTax: data.priceIncludesTax,
        taxRate: data.taxRate,
        category: data.category,
      };
      
      setMaterials(prev => [...prev, newMaterial]);
      setShowAddMaterialDialog(false);
      materialForm.reset();
      
      toast({
        title: "Material Added",
        description: `${data.name} has been added successfully.`,
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add material. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onEditMaterial = (data: MaterialFormData) => {
    try {
      const updatedMaterial = {
        ...editingMaterial,
        itemNumber: data.itemNumber,
        name: data.name,
        price: parseFloat(data.price),
        priceIncludesTax: data.priceIncludesTax,
        taxRate: data.taxRate,
        category: data.category,
      };
      
      setMaterials(prev => prev.map(m => m.id === editingMaterial.id ? updatedMaterial : m));
      setShowEditMaterialDialog(false);
      setEditingMaterial(null);
      materialForm.reset();
      
      toast({
        title: "Material Updated",
        description: `${data.name} has been updated successfully.`,
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update material. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onAddService = (data: ServiceFormData) => {
    try {
      const newService = {
        id: Date.now().toString(),
        name: data.name,
        category: data.category,
        basePrice: parseFloat(data.basePrice),
        unit: data.unit,
        description: data.description || "",
      };
      
      setServices(prev => [...prev, newService]);
      setShowAddServiceDialog(false);
      serviceForm.reset();
      
      toast({
        title: "Service Added",
        description: `${data.name} has been added successfully.`,
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add service. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onEditService = (data: ServiceFormData) => {
    try {
      const updatedService = {
        ...editingService,
        name: data.name,
        category: data.category,
        basePrice: parseFloat(data.basePrice),
        unit: data.unit,
        description: data.description || "",
      };
      
      setServices(prev => prev.map(s => s.id === editingService.id ? updatedService : s));
      setShowEditServiceDialog(false);
      setEditingService(null);
      serviceForm.reset();
      
      toast({
        title: "Service Updated",
        description: `${data.name} has been updated successfully.`,
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update service. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMaterial = (id: string) => {
    setMaterials(materials.filter(m => m.id !== id));
    toast({
      title: "Material Removed",
      description: "Material has been removed successfully.",
    });
  };

  const handleEditMaterial = (material: any) => {
    setEditingMaterial(material);
    materialForm.reset({
      itemNumber: material.itemNumber,
      name: material.name,
      price: material.price.toString(),
      priceIncludesTax: material.priceIncludesTax,
      taxRate: material.taxRate,
      category: material.category,
    });
    setShowEditMaterialDialog(true);
  };

  const handleRemoveService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
    toast({
      title: "Service Removed",
      description: "Service has been removed successfully.",
    });
  };

  const handleEditService = (service: any) => {
    setEditingService(service);
    serviceForm.reset({
      name: service.name,
      category: service.category,
      basePrice: service.basePrice.toString(),
      unit: service.unit,
      description: service.description || "",
    });
    setShowEditServiceDialog(true);
  };

  const filteredMaterials = materials
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           item.itemNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return b.price - a.price;
        case 'itemNumber':
          return a.itemNumber.localeCompare(b.itemNumber);
        default:
          return 0;
      }
    });

  const filteredServices = services
    .filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || service.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return b.basePrice - a.basePrice;
        default:
          return 0;
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'low': return 'bg-yellow-100 text-yellow-800';
      case 'out-of-stock': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Equipment': return <Wrench className="w-5 h-5" />;
      case 'Materials': return <Package className="w-5 h-5" />;
      case 'Tree Services': return <TreePine className="w-5 h-5" />;
      case 'Maintenance': return <Scissors className="w-5 h-5" />;
      default: return <Package className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Materials & Services</h1>
          <p className="text-gray-600">Import & manage items you sell</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "materials" ? (
            <Dialog open={showAddMaterialDialog} onOpenChange={setShowAddMaterialDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-material">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Material
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Material</DialogTitle>
              </DialogHeader>
              <Form {...materialForm}>
                <form onSubmit={materialForm.handleSubmit(onAddMaterial, (errors) => {
                  console.error("Form validation errors:", errors);
                  toast({
                    title: "Validation Error",
                    description: "Please check all required fields and try again.",
                    variant: "destructive",
                  });
                })} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={materialForm.control}
                      name="itemNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Number</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 41" {...field} data-testid="input-item-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={materialForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-material-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Equipment">Equipment</SelectItem>
                              <SelectItem value="Labour">Labour</SelectItem>
                              <SelectItem value="Service">Service</SelectItem>
                              <SelectItem value="Materials">Materials</SelectItem>
                              <SelectItem value="Discount">Discount</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={materialForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Bandit chipper hire" {...field} data-testid="input-material-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={materialForm.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-material-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={materialForm.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Rate</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-tax-rate">
                                <SelectValue placeholder="Select tax rate" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="15% GST on Income">15% GST on Income</SelectItem>
                              <SelectItem value="No GST">No GST</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={materialForm.control}
                    name="priceIncludesTax"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-price-includes-tax"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Price includes taxes</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowAddMaterialDialog(false)} data-testid="button-cancel-material">
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="button-save-material">
                      Add Material
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          ) : (
            <Dialog open={showAddServiceDialog} onOpenChange={setShowAddServiceDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-service">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Service</DialogTitle>
              </DialogHeader>
              <Form {...serviceForm}>
                <form onSubmit={serviceForm.handleSubmit(onAddService)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={serviceForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Tree Removal" {...field} data-testid="input-service-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={serviceForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-service-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Tree Services">Tree Services</SelectItem>
                              <SelectItem value="Maintenance">Maintenance</SelectItem>
                              <SelectItem value="Emergency">Emergency</SelectItem>
                              <SelectItem value="Consultation">Consultation</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={serviceForm.control}
                      name="basePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Price</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-service-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={serviceForm.control}
                      name="unit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., per tree, per hour" {...field} data-testid="input-service-unit" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={serviceForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Service description..." {...field} data-testid="textarea-service-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowAddServiceDialog(false)} data-testid="button-cancel-service">
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="button-save-service">
                      Add Service
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          )}
          
          <Button variant="outline" data-testid="button-bulk-import">
            <Upload className="w-4 h-4 mr-2" />
            Bulk Import
          </Button>
          
          <Button variant="outline" data-testid="button-export-items">
            <Download className="w-4 h-4 mr-2" />
            Export Items
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Materials</p>
                <p className="text-2xl font-bold">{materials.length}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Services</p>
                <p className="text-2xl font-bold">{services.length}</p>
              </div>
              <TreePine className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Equipment Items</p>
                <p className="text-2xl font-bold">{materials.filter(m => m.category === 'Equipment').length}</p>
              </div>
              <Truck className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Material Price</p>
                <p className="text-2xl font-bold">
                  ${Math.round(materials.filter(m => m.price > 0).reduce((sum, m) => sum + m.price, 0) / Math.max(materials.filter(m => m.price > 0).length, 1))}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search materials and services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-items"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-category-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Equipment">Equipment</SelectItem>
            <SelectItem value="Labour">Labour</SelectItem>
            <SelectItem value="Service">Service</SelectItem>
            <SelectItem value="Materials">Materials</SelectItem>
            <SelectItem value="Discount">Discount</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-sort">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="itemNumber">Item Number</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="price">Price (High to Low)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="materials" data-testid="tab-materials">
            Materials & Equipment
          </TabsTrigger>
          <TabsTrigger value="services" data-testid="tab-services">
            Services
          </TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="flex-1 overflow-auto mt-6">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Actions</TableHead>
                  <TableHead className="w-[120px]">Item Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[100px]">Price</TableHead>
                  <TableHead className="w-[150px]">Price Includes Taxes</TableHead>
                  <TableHead className="w-[150px]">Tax Rate</TableHead>
                  <TableHead className="w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((material) => (
                  <TableRow key={material.id} data-testid={`row-material-${material.id}`}>
                    <TableCell>
                      <Checkbox data-testid={`checkbox-select-${material.id}`} />
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-item-number-${material.id}`}>
                      {material.itemNumber}
                    </TableCell>
                    <TableCell data-testid={`text-material-name-${material.id}`}>
                      {material.name}
                    </TableCell>
                    <TableCell data-testid={`text-price-${material.id}`}>
                      ${material.price.toFixed(2)}
                    </TableCell>
                    <TableCell data-testid={`text-price-includes-tax-${material.id}`}>
                      {material.priceIncludesTax ? "Yes" : "No"}
                    </TableCell>
                    <TableCell data-testid={`text-tax-rate-${material.id}`}>
                      {material.taxRate}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEditMaterial(material)}
                          data-testid={`button-edit-${material.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleRemoveMaterial(material.id)}
                          data-testid={`button-remove-${material.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMaterials.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No materials found matching your search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="services" className="flex-1 overflow-auto mt-6">
          <div className="grid gap-4">
            {filteredServices.map((service) => (
              <Card key={service.id} className="hover-elevate" data-testid={`card-service-${service.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {getCategoryIcon(service.category)}
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-gray-900" data-testid={`text-service-name-${service.id}`}>
                          {service.name}
                        </h3>
                        
                        <p className="text-sm text-gray-600">
                          {service.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Category: {service.category}</span>
                          <span className="font-medium text-green-600">
                            ${service.basePrice} {service.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid={`button-edit-service-${service.id}`}>
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}