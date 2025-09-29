import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Mail, Phone, Calendar, DollarSign, Search, Filter, ArrowUpDown, Plus, Upload, Trash2, AlertTriangle, Edit, X, Archive, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer } from "@shared/schema";
import { CustomerCSVUpload } from "@/components/CustomerCSVUpload";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
  count?: number;
}

const editCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
});

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [activeTab, setActiveTab] = useState("list");
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<"all" | "active" | "historical" | "customers" | "potential_expenses">("all");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active customers
  const { data: activeCustomersResponse, isLoading: activeLoading } = useQuery<ApiResponse<Customer>>({
    queryKey: ['/api/customers'],
  });

  // Fetch historical customers
  const { data: historicalCustomersResponse, isLoading: historicalLoading } = useQuery<ApiResponse<Customer>>({
    queryKey: ['/api/customers/historical'],
  });

  // Combine all customers
  const activeCustomers = activeCustomersResponse?.data || [];
  const historicalCustomers = historicalCustomersResponse?.data || [];
  const allCustomers = [...activeCustomers, ...historicalCustomers];
  const isLoading = activeLoading || historicalLoading;

  // Function to identify potential expense companies
  const isPotentialExpenseCompany = (customer: Customer): boolean => {
    const name = customer.name.toLowerCase();
    const expenseKeywords = [
      'equipment', 'supply', 'supplies', 'hardware', 'rental', 'hire', 'machinery',
      'tools', 'parts', 'warehouse', 'wholesale', 'distribution', 'fuel', 'gas',
      'materials', 'steel', 'timber', 'lumber', 'concrete', 'aggregate', 'transport',
      'logistics', 'delivery', 'freight', 'haulage', 'maintenance', 'repair',
      'service center', 'garage', 'workshop', 'automotive', 'spare parts',
      'industrial', 'chemical', 'safety', 'ppe', 'protective', 'insurance',
      'accountant', 'accounting', 'legal', 'solicitor', 'consultant', 'office supplies'
    ];
    
    return expenseKeywords.some(keyword => name.includes(keyword));
  };

  // Form for editing customer
  const editForm = useForm<z.infer<typeof editCustomerSchema>>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
    },
  });

  // Bulk delete mutation
  const deleteCustomersMutation = useMutation({
    mutationFn: async (customerIds: string[]) => {
      return await apiRequest('DELETE', '/api/customers/bulk-delete', { customerIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers/historical'] });
      setSelectedCustomers(new Set());
      toast({
        title: "Customers Deleted",
        description: `Successfully deleted ${selectedCustomers.size} customer entries`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete customers",
        variant: "destructive"
      });
    }
  });

  // Individual delete mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return await apiRequest('DELETE', `/api/customers/${customerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers/historical'] });
      toast({
        title: "Customer Deleted",
        description: "Customer has been successfully deleted"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete customer",
        variant: "destructive"
      });
    }
  });

  // Edit customer mutation
  const editCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof editCustomerSchema> }) => {
      return await apiRequest('PUT', `/api/customers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers/historical'] });
      setShowEditDialog(false);
      setEditingCustomer(null);
      editForm.reset();
      toast({
        title: "Customer Updated",
        description: "Customer information has been successfully updated"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update customer",
        variant: "destructive"
      });
    }
  });

  // Selection handlers
  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    const newSelected = new Set(selectedCustomers);
    if (checked) {
      newSelected.add(customerId);
    } else {
      newSelected.delete(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)));
    } else {
      setSelectedCustomers(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedCustomers.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedCustomers.size} selected customers? This action cannot be undone.`)) {
      deleteCustomersMutation.mutate(Array.from(selectedCustomers));
    }
  };

  // Individual customer handlers
  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    editForm.reset({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
    });
    setShowEditDialog(true);
  };

  const handleDeleteCustomer = (customerId: string) => {
    if (confirm("Are you sure you want to delete this customer? This action cannot be undone.")) {
      deleteCustomerMutation.mutate(customerId);
    }
  };

  const handleSubmitEdit = (data: z.infer<typeof editCustomerSchema>) => {
    if (!editingCustomer) return;
    editCustomerMutation.mutate({ id: editingCustomer.id, data });
  };

  const handleCustomerCardClick = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setShowCustomerModal(true);
  };

  const handleCustomerModalClose = () => {
    setShowCustomerModal(false);
    setSelectedCustomerId(null);
  };

  // Filter and sort customers
  const filteredCustomers = allCustomers
    .filter(customer => {
      const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (customer.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (customer.phone || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const isHistorical = customer.isActive === false;
      const isActive = customer.isActive !== false;
      
      const matchesFilter = (() => {
        switch (filterType) {
          case 'active':
            return isActive;
          case 'historical':
            return isHistorical;
          case 'customers':
            return !isPotentialExpenseCompany(customer);
          case 'potential_expenses':
            return isPotentialExpenseCompany(customer);
          default:
            return true;
        }
      })();

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'email':
          return (a.email || '').localeCompare(b.email || '');
        case 'recent':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default:
          return 0;
      }
    });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCustomerTier = (lifetimeValue: number) => {
    if (lifetimeValue >= 10000) return { label: 'Premium', color: 'bg-purple-100 text-purple-800' };
    if (lifetimeValue >= 5000) return { label: 'Gold', color: 'bg-yellow-100 text-yellow-800' };
    if (lifetimeValue >= 1000) return { label: 'Silver', color: 'bg-gray-100 text-gray-800' };
    return { label: 'Bronze', color: 'bg-orange-100 text-orange-800' };
  };

  const getCustomerStatusBadge = (customer: Customer) => {
    const isHistorical = customer.isActive === false;
    if (isHistorical) {
      return (
        <Badge className="bg-orange-100 text-orange-800">
          <Archive className="w-3 h-3 mr-1" />
          Historical
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-100 text-green-800">
        Active
      </Badge>
    );
  };

  const selectedCustomerDetails = selectedCustomerId ? 
    allCustomers.find(c => c.id === selectedCustomerId) : null;

  return (
    <div className="flex flex-col p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600">Manage your customer database</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab("import")} data-testid="button-import-csv">
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button data-testid="button-add-customer">
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list" data-testid="tab-customer-list">Customer List</TabsTrigger>
          <TabsTrigger value="import" data-testid="tab-import">Import Data</TabsTrigger>
        </TabsList>

        {/* Client List Tab */}
        <TabsContent value="list" className="space-y-6 mt-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold">{allCustomers.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Customers</p>
                <p className="text-2xl font-bold">{activeCustomers.length}</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Historical</p>
                <p className="text-2xl font-bold">{historicalCustomers.length}</p>
              </div>
              <Archive className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">
                  ${allCustomers.reduce((sum, customer) => sum + (parseFloat(customer.lifetimeValue || '0') || 0), 0).toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search customers by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-clients"
            />
          </div>

          <Select value={filterType} onValueChange={(value) => setFilterType(value as typeof filterType)}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="historical">Historical Only</SelectItem>
              <SelectItem value="customers">Customers Only</SelectItem>
              <SelectItem value="potential_expenses">Potential Expenses</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-sort">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name (A-Z)</SelectItem>
              <SelectItem value="email">Email (A-Z)</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedCustomers.size > 0 && (
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-800">
                {selectedCustomers.size} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCustomers(new Set())}
                data-testid="button-clear-selection"
              >
                Clear Selection
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleteCustomersMutation.isPending}
              data-testid="button-bulk-delete"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}
      </div>

      {/* Clients List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="grid gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
              <p className="text-gray-600 text-center max-w-md">
                {searchQuery 
                  ? "Try adjusting your search to find customers."
                  : "No customers added yet. Start by adding your first customer."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Select All Header */}
            {filteredCustomers.length > 0 && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
                <Checkbox
                  checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <span className="text-sm font-medium">
                  Select All ({filteredCustomers.length})
                </span>
                {filterType === 'potential_expenses' && (
                  <Badge variant="destructive" className="ml-auto">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Potential Expenses
                  </Badge>
                )}
              </div>
            )}

            {/* Customer List */}
            <div className="grid gap-4">
              {filteredCustomers.map((customer) => {
                const tier = getCustomerTier(parseFloat(customer.lifetimeValue || '0') || 0);
                const isExpense = isPotentialExpenseCompany(customer);
                const isSelected = selectedCustomers.has(customer.id);
                
                return (
                  <Card 
                    key={customer.id} 
                    className={`hover-elevate transition-colors cursor-pointer ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`} 
                    onClick={() => handleCustomerCardClick(customer.id)}
                    data-testid={`card-client-${customer.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectCustomer(customer.id, checked as boolean)}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-select-${customer.id}`}
                          />
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-amber-100 text-amber-800">
                            {getInitials(customer.name || '')}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900" data-testid={`text-client-name-${customer.id}`}>
                              {customer.name}
                            </h3>
                            <Badge className={tier.color}>{tier.label}</Badge>
                            {getCustomerStatusBadge(customer)}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              <span>{customer.email || 'No email'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              <span>{customer.phone || 'No phone'}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              <span>Lifetime Value: ${parseFloat(customer.lifetimeValue || '0').toLocaleString()}</span>
                            </div>
                            {customer.importSource && (
                              <div className="flex items-center gap-1">
                                <span>Source: {customer.importSource}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between gap-2 mt-4">
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleEditCustomer(customer);
                            }}
                            style={{ pointerEvents: 'auto', zIndex: 10 }}
                            data-testid={`button-edit-${customer.id}`}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleCustomerCardClick(customer.id);
                            }}
                            style={{ pointerEvents: 'auto', zIndex: 10 }}
                            data-testid={`button-view-${customer.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDeleteCustomer(customer.id);
                          }}
                          disabled={deleteCustomerMutation.isPending}
                          style={{ pointerEvents: 'auto', zIndex: 10 }}
                          data-testid={`button-delete-${customer.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          </div>
        )}
      </div>
        </TabsContent>

        {/* CSV Import Tab */}
        <TabsContent value="import" className="space-y-6 mt-6">
          <CustomerCSVUpload />
        </TabsContent>
      </Tabs>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleSubmitEdit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter customer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email address" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={editCustomerMutation.isPending}>
                  {editCustomerMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Customer Details Modal */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Customer Details
            </DialogTitle>
          </DialogHeader>
          {selectedCustomerDetails && (
            <div className="space-y-6">
              {/* Customer Header */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-amber-100 text-amber-800 text-lg">
                    {getInitials(selectedCustomerDetails.name || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{selectedCustomerDetails.name}</h2>
                    {getCustomerStatusBadge(selectedCustomerDetails)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      <span>{selectedCustomerDetails.email || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span>{selectedCustomerDetails.phone || 'No phone'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Contact Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Address:</strong> {selectedCustomerDetails.address || 'No address'}</p>
                    <p><strong>City:</strong> {selectedCustomerDetails.city || 'No city'}</p>
                    <p><strong>Region:</strong> {selectedCustomerDetails.region || 'No region'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Business Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Source:</strong> {selectedCustomerDetails.source || 'Unknown'}</p>
                    <p><strong>Import Source:</strong> {selectedCustomerDetails.importSource || 'Manual'}</p>
                    <p><strong>Lifetime Value:</strong> ${parseFloat(selectedCustomerDetails.lifetimeValue || '0').toLocaleString()}</p>
                    <p><strong>Total Jobs:</strong> {selectedCustomerDetails.totalJobs || 0}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedCustomerDetails.notes && (
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {selectedCustomerDetails.notes}
                  </p>
                </div>
              )}

              {/* Import Information */}
              {selectedCustomerDetails.importBatchId && (
                <div className="space-y-2">
                  <h3 className="font-medium text-gray-900">Import Information</h3>
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                    <p><strong>Import Batch ID:</strong> {selectedCustomerDetails.importBatchId}</p>
                    <p><strong>Created:</strong> {selectedCustomerDetails.createdAt ? new Date(selectedCustomerDetails.createdAt).toLocaleDateString() : 'Unknown'}</p>
                    <p><strong>Updated:</strong> {selectedCustomerDetails.updatedAt ? new Date(selectedCustomerDetails.updatedAt).toLocaleDateString() : 'Unknown'}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  onClick={() => {
                    setShowCustomerModal(false);
                    handleEditCustomer(selectedCustomerDetails);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Customer
                </Button>
                <Button variant="outline" onClick={handleCustomerModalClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}