import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, Search, Filter, ArrowUpDown, DollarSign, Truck, TreePine, Scissors, Wrench } from "lucide-react";
import { useState } from "react";

// Mock data for materials and services
const mockMaterials = [
  {
    id: "1",
    name: "Chainsaw - Stihl MS261",
    category: "Equipment",
    cost: 450.00,
    price: 120.00,
    unit: "per day",
    stock: 3,
    status: "available"
  },
  {
    id: "2", 
    name: "Wood Chipper - 6 inch",
    category: "Equipment",
    cost: 2800.00,
    price: 380.00,
    unit: "per day",
    stock: 2,
    status: "available"
  },
  {
    id: "3",
    name: "Mulch - Pine Bark",
    category: "Materials", 
    cost: 25.00,
    price: 45.00,
    unit: "per cubic meter",
    stock: 50,
    status: "low"
  },
  {
    id: "4",
    name: "Safety Cones",
    category: "Materials",
    cost: 8.00,
    price: 15.00,
    unit: "per set of 4",
    stock: 12,
    status: "available"
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

  const filteredMaterials = mockMaterials
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return b.price - a.price;
        case 'stock':
          return b.stock - a.stock;
        default:
          return 0;
      }
    });

  const filteredServices = mockServices
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
        <Button data-testid="button-add-item">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Materials</p>
                <p className="text-2xl font-bold">{mockMaterials.length}</p>
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
                <p className="text-2xl font-bold">{mockServices.length}</p>
              </div>
              <TreePine className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
                <p className="text-2xl font-bold">{mockMaterials.filter(m => m.status === 'low').length}</p>
              </div>
              <Truck className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Service Price</p>
                <p className="text-2xl font-bold">
                  ${Math.round(mockServices.reduce((sum, s) => sum + s.basePrice, 0) / mockServices.length)}
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
            <SelectItem value="Materials">Materials</SelectItem>
            <SelectItem value="Tree Services">Tree Services</SelectItem>
            <SelectItem value="Maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-sort">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="price">Price (High to Low)</SelectItem>
            <SelectItem value="stock">Stock (High to Low)</SelectItem>
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
          <div className="grid gap-4">
            {filteredMaterials.map((material) => (
              <Card key={material.id} className="hover-elevate" data-testid={`card-material-${material.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {getCategoryIcon(material.category)}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900" data-testid={`text-material-name-${material.id}`}>
                            {material.name}
                          </h3>
                          <Badge className={getStatusColor(material.status)}>
                            {material.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Category: {material.category}</span>
                          <span>Stock: {material.stock}</span>
                          <span>Unit: {material.unit}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Cost: ${material.cost}</span>
                          <span className="font-medium text-green-600">
                            Price: ${material.price} {material.unit}
                          </span>
                          <span className="font-medium">
                            Margin: {Math.round(((material.price - material.cost) / material.price) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid={`button-edit-${material.id}`}>
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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