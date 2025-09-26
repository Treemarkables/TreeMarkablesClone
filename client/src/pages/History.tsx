import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Hammer, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Job, Customer } from "@shared/schema";

interface ApiResponse<T> {
  success: boolean;
  data: T[];
  message?: string;
  count?: number;
}

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch jobs and customers data
  const { data: jobsResponse, isLoading: jobsLoading } = useQuery<ApiResponse<Job>>({
    queryKey: ['/api/jobs'],
  });

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
    
    const matchesSearch = 
      jobNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.address || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      statusFilter.split(',').includes(job.status || '');
    
    return matchesSearch && matchesStatus;
  });

  // Sort jobs by date (newest first)
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
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

  const getCustomerDetails = (customerId: string) => {
    const customer = customerMap.get(customerId);
    if (!customer) return { name: '', firstName: '', lastName: '' };
    
    const name = customer.name || '';
    const nameParts = name.split(' ');
    return {
      name,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || ''
    };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <Hammer className="h-5 w-5 text-gray-600" />
          <h1 className="text-xl font-semibold text-gray-900">Jobs</h1>
        </div>
        
        <Button 
          className="bg-green-600 hover:bg-green-700 text-white"
          data-testid="button-new-job"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-3 p-4 border-b bg-gray-50">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search..."
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
              Filter
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              All Statuses
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('work_order,completed,scheduled')}>
              Work Orders
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('quote,lead')}>
              Quotes
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
            <DropdownMenuItem>Email List</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Jobs Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b">
              <TableHead className="w-24">Date</TableHead>
              <TableHead className="w-32">Job Number</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact First</TableHead>
              <TableHead>Contact Last</TableHead>
              <TableHead>Job Status</TableHead>
              <TableHead className="w-48">Actions</TableHead>
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
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              paginatedJobs.map((job) => {
                const customer = getCustomerDetails(job.customerId || '');
                return (
                  <TableRow key={job.id} className="border-b hover:bg-gray-50" data-testid={`row-job-${job.id}`}>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(job.createdAt ? job.createdAt.toString() : null)}
                    </TableCell>
                    <TableCell className="font-medium text-blue-600" data-testid={`text-job-number-${job.id}`}>
                      {job.jobNumber || ''}
                    </TableCell>
                    <TableCell className="text-sm" data-testid={`text-company-${job.id}`}>
                      {customer.name}
                    </TableCell>
                    <TableCell className="text-sm" data-testid={`text-first-name-${job.id}`}>
                      {customer.firstName}
                    </TableCell>
                    <TableCell className="text-sm" data-testid={`text-last-name-${job.id}`}>
                      {customer.lastName}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(job.status || '')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          data-testid={`button-open-job-${job.id}`}
                        >
                          Open Job
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          data-testid={`button-remove-${job.id}`}
                        >
                          Remove
                        </Button>
                      </div>
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
    </div>
  );
}