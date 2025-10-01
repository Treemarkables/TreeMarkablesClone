import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Conversation } from '@shared/schema';
import { insertLeadSchema } from '@shared/schema';
import {
  MessageSquare,
  Search,
  Loader2,
  RefreshCw,
  Mail,
  Phone,
  Video,
  MoreVertical,
  Briefcase,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';
import { LeadFormDialog } from "@/components/LeadFormDialog";

// Form schema extending insertLeadSchema with required validation
const createLeadFormSchema = insertLeadSchema.extend({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  status: z.string().default('new'),
  urgency: z.enum(['low', 'medium', 'high', 'emergency']).optional().default('medium'),
});

export default function Inbox() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false);
  const [showCreateOpportunityDialog, setShowCreateOpportunityDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form for creating job as lead
  const jobForm = useForm<z.infer<typeof createLeadFormSchema>>({
    resolver: zodResolver(createLeadFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      serviceRequested: '',
      urgency: 'medium',
      status: 'new',
      notes: ''
    }
  });

  // Form for creating opportunity
  const opportunityForm = useForm<z.infer<typeof createLeadFormSchema>>({
    resolver: zodResolver(createLeadFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      serviceRequested: '',
      urgency: 'medium',
      status: 'new',
      notes: ''
    }
  });

  // Fetch conversations from backend - ONLY quote requests from website
  const { data: conversationsResponse, isLoading, refetch } = useQuery({
    queryKey: ['/api/conversations', { search: searchTerm || undefined, source: 'quote_request' }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      // Only show quote requests from website in inbox
      params.append('source', 'quote_request');
      const response = await fetch(`/api/conversations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    }
  });

  const conversations: Conversation[] = conversationsResponse?.data || [];

  // Create Opportunity mutation
  const createOpportunityMutation = useMutation({
    mutationFn: async (leadData: z.infer<typeof createLeadFormSchema>) => {
      return apiRequest('POST', '/api/leads', leadData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      setShowCreateOpportunityDialog(false);
      opportunityForm.reset();
      toast({ 
        title: 'Opportunity created successfully',
        description: 'The lead has been added to your pipeline'
      });
    },
    onError: () => {
      toast({ 
        title: 'Failed to create opportunity', 
        description: 'Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Create Job as Lead mutation
  const createJobMutation = useMutation({
    mutationFn: async (leadData: z.infer<typeof createLeadFormSchema>) => {
      return apiRequest('POST', '/api/leads', { ...leadData, status: 'new' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      setShowCreateJobDialog(false);
      jobForm.reset();
      toast({ 
        title: 'Job lead created successfully',
        description: 'The job lead has been sent to dispatch'
      });
      setLocation('/dispatch');
    },
    onError: () => {
      toast({ 
        title: 'Failed to create job lead', 
        description: 'Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Filter conversations based on status
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      if (statusFilter === 'all') return true;
      return conv.status === statusFilter;
    });
  }, [conversations, statusFilter]);

  const unreadCount = filteredConversations.filter(conv => (conv.unreadCount || 0) > 0).length;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              Quote Requests
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} unread
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Quote requests from your website
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-conversations"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quote requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-quote-requests"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No quote requests found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? 'Try adjusting your search terms' : 'Quote requests from your website will appear here'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-4 hover-elevate active-elevate-2 ${
                  (conversation.unreadCount || 0) > 0 ? 'bg-accent/50' : ''
                }`}
                data-testid={`conversation-item-${conversation.id}`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 cursor-pointer" onClick={() => setLocation(`/conversation/${conversation.id}`)}>
                    <AvatarFallback>
                      {conversation.title?.charAt(0).toUpperCase() || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setLocation(`/conversation/${conversation.id}`)}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {getSourceIcon(conversation.source || 'email')}
                        <h3 className={`text-sm font-medium ${
                          (conversation.unreadCount || 0) > 0 ? 'font-semibold' : ''
                        }`}>
                          {conversation.title}
                        </h3>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {conversation.lastMessageAt 
                          ? formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })
                          : formatDistanceToNow(new Date(conversation.createdAt || new Date()), { addSuffix: true })
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={getStatusBadgeColor(conversation.status || 'open')} variant="secondary">
                        {conversation.status || 'open'}
                      </Badge>
                      <Badge className={getPriorityBadgeColor(conversation.priority || 'medium')} variant="secondary">
                        {conversation.priority || 'medium'}
                      </Badge>
                      {(conversation.unreadCount || 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {conversation.unreadCount} new
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Action Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="flex-shrink-0 h-8 w-8"
                        data-testid={`button-actions-${conversation.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConversation(conversation);
                          jobForm.reset({
                            name: conversation.title || '',
                            email: '',
                            phone: '',
                            address: '',
                            serviceRequested: '',
                            urgency: 'medium',
                            status: 'new',
                            notes: `From quote request: ${conversation.title || ''}`
                          });
                          setShowCreateJobDialog(true);
                        }}
                        data-testid={`menuitem-create-job-${conversation.id}`}
                      >
                        <Briefcase className="h-4 w-4 mr-2" />
                        Create Job as Lead
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConversation(conversation);
                          opportunityForm.reset({
                            name: conversation.title || '',
                            email: '',
                            phone: '',
                            address: '',
                            serviceRequested: '',
                            urgency: 'medium',
                            status: 'new',
                            notes: `Converted from quote request: ${conversation.title || ''}`
                          });
                          setShowCreateOpportunityDialog(true);
                        }}
                        data-testid={`menuitem-create-opportunity-${conversation.id}`}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create Opportunity
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Create Job as Lead Dialog */}
      <LeadFormDialog
        open={showCreateJobDialog}
        onOpenChange={setShowCreateJobDialog}
        title="Create Job as Lead"
        description="Create a new job lead that will be sent to dispatch"
        submitLabel="Create Job Lead"
        isSubmitting={createJobMutation.isPending}
        form={jobForm}
        onSubmit={(values) => createJobMutation.mutate({ ...values, status: 'new' })}
        includeStatus={false}
        testIdPrefix="inbox-job"
      />

      {/* Create Opportunity Dialog */}
      <LeadFormDialog
        open={showCreateOpportunityDialog}
        onOpenChange={setShowCreateOpportunityDialog}
        title="Create Opportunity"
        description="Add a new lead to your sales pipeline"
        submitLabel="Create Opportunity"
        isSubmitting={createOpportunityMutation.isPending}
        form={opportunityForm}
        onSubmit={(values) => createOpportunityMutation.mutate(values)}
        includeStatus={true}
        testIdPrefix="inbox-opportunity"
      />
    </div>
  );
}
