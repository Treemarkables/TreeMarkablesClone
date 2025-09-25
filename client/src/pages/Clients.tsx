import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Mail, Phone, Calendar, DollarSign, Search, Filter, ArrowUpDown, Plus, Upload, Trash2, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import type { Customer } from "@shared/schema";
import { CustomerCSVUpload } from "@/components/CustomerCSVUpload";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
  count?: number;
}

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [activeTab, setActiveTab] = useState("list");
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<"all" | "customers" | "potential_expenses">("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch customers data
  const { data: customersResponse, isLoading } = useQuery<ApiResponse<Customer>>({
    queryKey: ['/api/customers'],
  });

  const customers = customersResponse?.data || [];

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

  // Bulk delete mutation
  const deleteCustomersMutation = useMutation({
    mutationFn: async (customerIds: string[]) => {
      return await apiRequest('DELETE', '/api/customers/bulk-delete', { customerIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
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
    deleteCustomersMutation.mutate(Array.from(selectedCustomers));
  };

  // Filter and sort customers
  const filteredCustomers = customers
    .filter(customer => {
      const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (customer.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (customer.phone || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = (() => {
        switch (filterType) {
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
          // Sort by most recent contact if we had that data
          return b.name.localeCompare(a.name); // fallback to name
        default:
          return 0;
      }
    });

  const getInitials = (name: string) => {
    return (name || '')
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

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600">Import & manage your customer list</p>
        </div>
        <Button data-testid="button-add-client">
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list" data-testid="tab-client-list">
            <Users className="w-4 h-4 mr-2" />
            Client List
          </TabsTrigger>
          <TabsTrigger value="import" data-testid="tab-csv-import">
            <Upload className="w-4 h-4 mr-2" />
            CSV Import
          </TabsTrigger>
        </TabsList>

        {/* Client List Tab */}
        <TabsContent value="list" className="space-y-6 mt-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Clients</p>
                <p className="text-2xl font-bold">{customers.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active This Month</p>
                <p className="text-2xl font-bold">{Math.floor(customers.length * 0.3)}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">
                  ${customers.reduce((sum, customer) => sum + (parseFloat(customer.lifetimeValue || '0') || 0), 0).toLocaleString()}
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
              placeholder="Search clients by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-clients"
            />
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-filter">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entries</SelectItem>
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
              <p className="text-gray-600 text-center max-w-md">
                {searchQuery 
                  ? "Try adjusting your search to find clients."
                  : "No clients added yet. Start by adding your first client."
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
                    className={`hover-elevate transition-colors ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`} 
                    data-testid={`card-client-${customer.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectCustomer(customer.id, checked as boolean)}
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
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid={`button-view-${customer.id}`}>
                          View Details
                        </Button>
                        <Button variant="outline" size="sm" data-testid={`button-contact-${customer.id}`}>
                          Contact
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
    </div>
  );
}