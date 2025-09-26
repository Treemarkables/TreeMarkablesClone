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
  FileText,
  Hammer,
  Plus
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import type { Job, Customer } from "@shared/schema";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
  count?: number;
}

type SortColumn = 'date' | 'jobNumber' | 'customer' | 'address' | 'status' | 'value';
type SortDirection = 'asc' | 'desc';

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Job card modal state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isJobCardOpen, setIsJobCardOpen] = useState(false);

  // Fetch all jobs
  const { data: jobsResponse, isLoading: jobsLoading } = useQuery<ApiResponse<Job>>({
    queryKey: ['/api/jobs'],
  });

  // Fetch customers for job details
  const { data: customersResponse } = useQuery<ApiResponse<Customer>>({
    queryKey: ['/api/customers'],
  });

  const jobs = jobsResponse?.data || [];
  const customers = customersResponse?.data || [];

  // Create customer lookup map
  const customerMap = new Map(customers.map(customer => [customer.id, customer]));

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    const customer = customerMap.get(job.customerId || '');
    const customerName = customer?.name || '';
    const jobNumber = job.jobNumber || '';
    const address = job.address || '';
    
    const matchesSearch = 
      jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      address.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      statusFilter.split(',').includes(job.status || '');
    
    return matchesSearch && matchesStatus;
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

  // Sort jobs by selected column and direction
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    let valueA: any, valueB: any;
    
    switch (sortColumn) {
      case 'date':
        valueA = new Date(a.createdAt || 0).getTime();
        valueB = new Date(b.createdAt || 0).getTime();
        break;
      case 'jobNumber':
        valueA = a.jobNumber || '';
        valueB = b.jobNumber || '';
        break;
      case 'customer':
        const customerA = customerMap.get(a.customerId || '');
        const customerB = customerMap.get(b.customerId || '');
        valueA = customerA?.name || '';
        valueB = customerB?.name || '';
        break;
      case 'address':
        valueA = a.address || '';
        valueB = b.address || '';
        break;
      case 'status':
        valueA = a.status || '';
        valueB = b.status || '';
        break;
      case 'value':
        valueA = parseFloat(a.totalAmount as string || '0');
        valueB = parseFloat(b.totalAmount as string || '0');
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
  const totalPages = Math.ceil(sortedJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = sortedJobs.slice(startIndex, endIndex);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'work_order':
        return <Badge className="bg-green-100 text-green-800">Work Order</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'quote':
        return <Badge className="bg-gray-100 text-gray-800">Quote</Badge>;
      case 'unsuccessful':
        return <Badge className="bg-red-100 text-red-800">Unsuccessful</Badge>;
      case 'lead':
        return <Badge className="bg-yellow-100 text-yellow-800">Lead</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Quote</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format like ServiceM8
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return '$0.00';
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(num);
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return null;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />;
  };

  // Handle job row click
  const handleJobClick = (job: Job) => {
    setSelectedJobId(job.id);
    setIsJobCardOpen(true);
  };

  const handleCloseJobCard = () => {
    setIsJobCardOpen(false);
    setSelectedJobId(null);
  };

  const handleJobUpdated = () => {
    // Refresh jobs data when a job is updated
    // TanStack Query will automatically refetch
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-gray-600" />
          <h1 className="text-xl font-semibold text-gray-900">Job History</h1>
          <Badge className="bg-blue-100 text-blue-800 ml-2">
            {jobs.length} total jobs
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
            placeholder="Search jobs..."
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
              Filter Status
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              All Statuses
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('completed,work_order')}>
              Completed Jobs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('scheduled')}>
              Scheduled
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('quote,lead')}>
              Quotes & Leads
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('unsuccessful')}>
              Unsuccessful
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
            <DropdownMenuItem>Export to CSV</DropdownMenuItem>
            <DropdownMenuItem>Print List</DropdownMenuItem>
            <DropdownMenuItem>Email Report</DropdownMenuItem>
            <DropdownMenuItem>Archive Selected</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Jobs Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b">
              <TableHead className="w-24">
                <button
                  className="flex items-center gap-1 hover:text-blue-600 font-medium"
                  onClick={() => handleSort('date')}
                  data-testid="header-date"
                >
                  Date
                  {getSortIcon('date')}
                </button>
              </TableHead>
              <TableHead className="w-32">
                <button
                  className="flex items-center gap-1 hover:text-blue-600 font-medium"
                  onClick={() => handleSort('jobNumber')}
                  data-testid="header-job-number"
                >
                  Job Number
                  {getSortIcon('jobNumber')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-blue-600 font-medium"
                  onClick={() => handleSort('customer')}
                  data-testid="header-customer"
                >
                  Customer
                  {getSortIcon('customer')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-blue-600 font-medium"
                  onClick={() => handleSort('address')}
                  data-testid="header-address"
                >
                  Address
                  {getSortIcon('address')}
                </button>
              </TableHead>
              <TableHead>Service Type</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-blue-600 font-medium"
                  onClick={() => handleSort('status')}
                  data-testid="header-status"
                >
                  Status
                  {getSortIcon('status')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-blue-600 font-medium"
                  onClick={() => handleSort('value')}
                  data-testid="header-value"
                >
                  Value
                  {getSortIcon('value')}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobsLoading ? (
              // Loading skeleton rows
              [...Array(10)].map((_, i) => (
                <TableRow key={i} className="border-b">
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
            ) : paginatedJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Hammer className="h-8 w-8 text-gray-400" />
                    <span>No jobs found</span>
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
              paginatedJobs.map((job) => {
                const customer = customerMap.get(job.customerId || '');
                return (
                  <TableRow 
                    key={job.id} 
                    className="border-b hover:bg-gray-50 cursor-pointer" 
                    data-testid={`row-job-${job.id}`}
                    onClick={() => handleJobClick(job)}
                  >
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(job.createdAt ? job.createdAt.toString() : null)}
                    </TableCell>
                    <TableCell className="font-medium text-blue-600" data-testid={`text-job-number-${job.id}`}>
                      {job.jobNumber || ''}
                    </TableCell>
                    <TableCell className="text-sm" data-testid={`text-customer-${job.id}`}>
                      {customer?.name || 'Unknown Customer'}
                    </TableCell>
                    <TableCell className="text-sm max-w-48 truncate" data-testid={`text-address-${job.id}`}>
                      {job.address || ''}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {job.serviceType || 'General'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(job.status || '')}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(job.totalAmount as string)}
                    </TableCell>
                  </TableRow>
                );
              })
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
            {startIndex + 1} - {Math.min(endIndex, sortedJobs.length)} of {sortedJobs.length}
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

      {/* Global Job Card Modal */}
      <GlobalJobCard
        isOpen={isJobCardOpen}
        onClose={handleCloseJobCard}
        mode="edit"
        jobId={selectedJobId || undefined}
        onJobUpdated={handleJobUpdated}
      />
    </div>
  );
}