import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Archive, 
  Search, 
  Filter, 
  MoreHorizontal, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Users,
  FileText
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Customer } from "@shared/schema";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
  count?: number;
}

type SortColumn = 'name' | 'email' | 'source' | 'importDate';
type SortDirection = 'asc' | 'desc';

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortColumn, setSortColumn] = useState<SortColumn>('importDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Fetch historical customers
  const { data: customersResponse, isLoading: customersLoading } = useQuery<ApiResponse<Customer>>({
    queryKey: ['/api/customers/historical'],
  });

  const customers = customersResponse?.data || [];

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    const name = customer.name || '';
    const email = customer.email || '';
    const source = customer.importSource || '';
    
    const matchesSearch = 
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customer.address || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSource = sourceFilter === 'all' || 
      source === sourceFilter;
    
    return matchesSearch && matchesSource;
  });

  // Handle column sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Sort customers by selected column and direction
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let valueA: any, valueB: any;
    
    switch (sortColumn) {
      case 'name':
        valueA = a.name || '';
        valueB = b.name || '';
        break;
      case 'email':
        valueA = a.email || '';
        valueB = b.email || '';
        break;
      case 'source':
        valueA = a.importSource || '';
        valueB = b.importSource || '';
        break;
      case 'importDate':
        valueA = new Date(a.createdAt || 0).getTime();
        valueB = new Date(b.createdAt || 0).getTime();
        break;
      default:
        valueA = '';
        valueB = '';
    }

    // Compare values
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    } else {
      const strA = String(valueA).toLowerCase();
      const strB = String(valueB).toLowerCase();
      if (sortDirection === 'asc') {
        return strA.localeCompare(strB);
      } else {
        return strB.localeCompare(strA);
      }
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCustomers = sortedCustomers.slice(startIndex, endIndex);

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'csv_upload':
        return <Badge className="bg-blue-100 text-blue-800">CSV Import</Badge>;
      case 'servicem8':
        return <Badge className="bg-orange-100 text-orange-800">ServiceM8</Badge>;
      case 'manual':
        return <Badge className="bg-green-100 text-green-800">Manual Entry</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Import</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format like ServiceM8
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return null;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-gray-600" />
          <h1 className="text-xl font-semibold text-gray-900">Historical Customers</h1>
          <Badge className="bg-blue-100 text-blue-800 ml-2">
            {customersResponse?.count || customers.length} records
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            className="bg-white"
            data-testid="button-export-csv"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-3 p-4 border-b bg-gray-50">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white"
            data-testid="input-search"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-white" data-testid="button-filter">
              <Filter className="h-4 w-4 mr-2" />
              Filter Source
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSourceFilter('all')}>
              All Sources
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSourceFilter('csv_upload')}>
              CSV Import
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSourceFilter('servicem8')}>
              ServiceM8
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSourceFilter('manual')}>
              Manual Entry
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-white" data-testid="button-actions">
              Actions
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Restore Selected</DropdownMenuItem>
            <DropdownMenuItem>Export to CSV</DropdownMenuItem>
            <DropdownMenuItem>Print List</DropdownMenuItem>
            <DropdownMenuItem>Delete Permanently</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Customer Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b">
              <TableHead className="w-8">
                <input type="checkbox" className="rounded" />
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-blue-600 font-medium"
                  onClick={() => handleSort('name')}
                  data-testid="header-name"
                >
                  Customer Name
                  {getSortIcon('name')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-blue-600 font-medium"
                  onClick={() => handleSort('email')}
                  data-testid="header-email"
                >
                  Email
                  {getSortIcon('email')}
                </button>
              </TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-blue-600 font-medium"
                  onClick={() => handleSort('source')}
                  data-testid="header-source"
                >
                  Source
                  {getSortIcon('source')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-blue-600 font-medium"
                  onClick={() => handleSort('importDate')}
                  data-testid="header-import-date"
                >
                  Import Date
                  {getSortIcon('importDate')}
                </button>
              </TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customersLoading ? (
              // Loading skeleton rows
              [...Array(10)].map((_, i) => (
                <TableRow key={i} className="border-b">
                  <TableCell>
                    <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  </TableCell>
                </TableRow>
              ))
            ) : paginatedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-gray-400" />
                    <span>No historical customers found</span>
                    {searchQuery && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSearchQuery('')}
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedCustomers.map((customer) => (
                <TableRow key={customer.id} className="border-b hover:bg-gray-50" data-testid={`row-customer-${customer.id}`}>
                  <TableCell>
                    <input type="checkbox" className="rounded" />
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-name-${customer.id}`}>
                    {customer.name || 'No name'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600" data-testid={`text-email-${customer.id}`}>
                    {customer.email || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600" data-testid={`text-phone-${customer.id}`}>
                    {customer.phone || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-48 truncate" data-testid={`text-address-${customer.id}`}>
                    {customer.address || '-'}
                  </TableCell>
                  <TableCell>
                    {getSourceBadge(customer.importSource || 'import')}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(customer.createdAt ? customer.createdAt.toString() : null)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`button-actions-${customer.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Restore Customer</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">Delete Permanently</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between p-4 border-t bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">View</span>
          <Select value={itemsPerPage.toString()} onValueChange={(value) => {
            setItemsPerPage(parseInt(value));
            setCurrentPage(1);
          }}>
            <SelectTrigger className="w-20 h-8 bg-white" data-testid="select-items-per-page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-600">per page</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {startIndex + 1} - {Math.min(endIndex, sortedCustomers.length)} of {sortedCustomers.length}
          </span>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}