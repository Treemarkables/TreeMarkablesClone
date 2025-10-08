import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Conversation, ConversationMessage } from '@shared/schema';
import { insertLeadSchema } from '@shared/schema';
import {
  Menu,
  ChevronDown,
  Filter,
  Plus,
  Facebook,
  Loader2,
  MoreVertical,
  Briefcase,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LeadFormDialog } from "@/components/LeadFormDialog";

// Form schema extending insertLeadSchema with required validation
const createLeadFormSchema = insertLeadSchema.extend({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  status: z.string().default('new'),
  urgency: z.enum(['low', 'medium', 'high', 'emergency']).optional().default('medium'),
});

export default function Opportunities() {
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false);
  const [showCreateOpportunityDialog, setShowCreateOpportunityDialog] = useState(false);
  const [, setLocation] = useLocation();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  // Fetch conversations from backend
  const { data: conversationsResponse, isLoading } = useQuery({
    queryKey: ['/api/conversations', { filterType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType === 'unread') {
        params.append('unread', 'true');
      } else if (filterType === 'recent') {
        params.append('sortBy', 'recent');
      }
      const response = await fetch(`/api/conversations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
  });

  const conversations = conversationsResponse?.data || [];

  // Fetch conversation messages for selected conversation
  const { data: messagesResponse } = useQuery({
    queryKey: ['/api/conversations', selectedConversation?.id, 'messages'],
    queryFn: async () => {
      if (!selectedConversation?.id) return { data: [] };
      const response = await fetch(`/api/conversations/${selectedConversation.id}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!selectedConversation?.id,
  });

  const messages = messagesResponse?.data || [];

  // Helper function to extract contact details from conversation and messages
  const extractContactDetails = (conversation: any, messages: any[]) => {
    const name = conversation.customerName || '';
    let email = conversation.customerEmail || '';
    let phone = conversation.customerPhone || '';

    // If we don't have email/phone from customer record, try to extract from first message
    if ((!email || !phone) && messages.length > 0) {
      const firstMessage = messages.find(m => m.direction === 'inbound');
      
      if (firstMessage) {
        // Get email from fromContact if it looks like an email
        if (!email && firstMessage.fromContact && firstMessage.fromContact.includes('@')) {
          email = firstMessage.fromContact;
        }
        
        // Try to extract phone from message content
        if (!phone && firstMessage.content) {
          // Look for "Phone: " pattern in the message
          const phoneMatch = firstMessage.content.match(/Phone:\s*([0-9+\s\-()]+)/i);
          if (phoneMatch) {
            phone = phoneMatch[1].trim();
          }
        }

        // Also check if fromContact is a phone number
        if (!phone && firstMessage.fromContact && /^[\d\s+\-()]+$/.test(firstMessage.fromContact)) {
          phone = firstMessage.fromContact;
        }

        // Extract email from message content if not found yet
        if (!email && firstMessage.content) {
          const emailMatch = firstMessage.content.match(/Email:\s*([^\s\n]+@[^\s\n]+)/i);
          if (emailMatch) {
            email = emailMatch[1].trim();
          }
        }
      }
    }

    // Use senderContact as fallback for phone if it looks like a phone number
    if (!phone && conversation.senderContact && /^[\d\s+\-()]+$/.test(conversation.senderContact)) {
      phone = conversation.senderContact;
    }

    return { name, email, phone };
  };

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      return apiRequest('POST', `/api/conversations/${conversationId}/reply`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', selectedConversation?.id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      setReplyContent('');
      setShowReplyDialog(false);
      toast({ title: 'Reply sent successfully' });
    },
    onError: () => {
      toast({ 
        title: 'Failed to send reply', 
        description: 'Please try again or check your connection.',
        variant: 'destructive'
      });
    }
  });

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

  // Create Quote mutation
  const createJobMutation = useMutation({
    mutationFn: async (leadData: z.infer<typeof createLeadFormSchema>) => {
      // First, create or find customer
      const customerResponse = await apiRequest('POST', '/api/customers', {
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone,
        address: leadData.address
      });
      const customerId = customerResponse.data.id;

      // Create the quote
      const quoteData = {
        customerId: customerId,
        description: leadData.serviceRequested || leadData.notes || 'Quote from conversation',
        amount: '0',
        status: 'draft',
        createdBy: 'admin'
      };
      
      return apiRequest('POST', '/api/quotes', quoteData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setShowCreateJobDialog(false);
      jobForm.reset();
      toast({ 
        title: 'Quote created successfully',
        description: 'The quote has been created and will appear in dispatch board'
      });
      setLocation('/dispatch');
    },
    onError: () => {
      toast({ 
        title: 'Failed to create quote', 
        description: 'Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Helper functions
  const getInitials = (title: string) => {
    const words = title.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  const truncateMessage = (message: string, maxLength: number = 80) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  const handleConversationClick = async (conversation: Conversation) => {
    // Mark messages as read before navigating
    if (conversation.unreadCount && conversation.unreadCount > 0) {
      try {
        await fetch(`/api/conversations/${conversation.id}/messages/read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });
        // Refresh conversations to update unread count
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    }
    // Navigate to conversation detail page
    setLocation(`/conversation/${conversation.id}`);
  };

  return (
    <div className="flex flex-col h-full bg-white w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b w-full">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="flex-shrink-0" data-testid="button-menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-2">
              <h1 className="text-base sm:text-lg font-semibold truncate" data-testid="text-title">Treemarkables</h1>
              <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
            </div>
            <p className="text-xs text-gray-500">Gisborne</p>
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b overflow-x-auto scrollbar-hide">
        <Button 
          variant="outline" 
          size="sm"
          className="flex-shrink-0 text-xs sm:text-sm"
          data-testid="button-filter"
        >
          <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Filter
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
        <Button 
          variant={filterType === 'internal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('internal')}
          className="flex-shrink-0 text-xs sm:text-sm"
          data-testid="button-internal-chat"
        >
          Internal Chat
        </Button>
        <Button 
          variant={filterType === 'recent' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('recent')}
          className="flex-shrink-0 text-xs sm:text-sm"
          data-testid="button-recent"
        >
          Recent
        </Button>
        <Button 
          variant={filterType === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('unread')}
          className="flex-shrink-0 text-xs sm:text-sm"
          data-testid="button-unread"
        >
          Unread
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <p className="text-gray-500 text-sm">No conversations found</p>
            <p className="text-gray-400 text-xs mt-1">New conversations will appear here</p>
          </div>
        ) : (
          <div className="divide-y">
            {conversations.map((conversation: Conversation) => (
              <div
                key={conversation.id}
                className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover-elevate active-elevate-2"
                data-testid={`conversation-item-${conversation.id}`}
              >
                {/* Avatar with Badge */}
                <div className="relative flex-shrink-0">
                  <Avatar className="h-11 w-11 sm:h-12 sm:w-12 bg-gray-200">
                    <AvatarFallback className="text-gray-600 font-medium">
                      {getInitials((conversation as any).customerName || conversation.title)}
                    </AvatarFallback>
                  </Avatar>
                  {conversation.source === 'social' && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
                      <div className="bg-blue-600 rounded-full p-0.5">
                        <Facebook className="h-3 w-3 text-white" fill="currentColor" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Conversation Info */}
                <div className="flex-1 min-w-0 overflow-hidden cursor-pointer" onClick={() => handleConversationClick(conversation)}>
                  <div className="flex items-baseline gap-1 sm:gap-2">
                    <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate flex-1 min-w-0" data-testid={`text-name-${conversation.id}`}>
                      {(conversation as any).customerName || conversation.title}
                    </h3>
                    <span className="text-[10px] sm:text-xs text-gray-500 flex-shrink-0 ml-auto whitespace-nowrap" data-testid={`text-date-${conversation.id}`}>
                      {formatDate(conversation.lastMessageAt || conversation.createdAt || new Date())}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
                    <p className="text-xs sm:text-sm text-gray-600 truncate flex-1 min-w-0" data-testid={`text-preview-${conversation.id}`}>
                      {truncateMessage(conversation.title)}
                    </p>
                    {conversation.unreadCount && conversation.unreadCount > 0 && (
                      <div 
                        className="flex-shrink-0 bg-green-500 text-white text-[10px] sm:text-xs font-semibold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center ml-auto"
                        data-testid={`badge-unread-${conversation.id}`}
                      >
                        {conversation.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Action Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="flex-shrink-0" 
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`button-actions-${conversation.id}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={async (e) => {
                        e.stopPropagation();
                        setSelectedConversation(conversation);
                        
                        // Fetch messages for this conversation to extract contact details
                        let fetchedMessages: any[] = [];
                        try {
                          const response = await fetch(`/api/conversations/${conversation.id}/messages`);
                          if (response.ok) {
                            const data = await response.json();
                            fetchedMessages = data.data || [];
                          }
                        } catch (error) {
                          console.error('Error fetching messages:', error);
                        }
                        
                        // Extract contact details from conversation and messages
                        const { name, email, phone } = extractContactDetails(conversation, fetchedMessages);
                        
                        jobForm.reset({
                          name: name,
                          email: email,
                          phone: phone,
                          address: '',
                          serviceRequested: '',
                          urgency: 'medium',
                          status: 'new',
                          notes: `From conversation: ${conversation.title || ''}`
                        });
                        setShowCreateJobDialog(true);
                      }}
                      data-testid={`menuitem-create-quote-${conversation.id}`}
                    >
                      <Briefcase className="h-4 w-4 mr-2" />
                      Create New Quote
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={async (e) => {
                        e.stopPropagation();
                        setSelectedConversation(conversation);
                        
                        // Fetch messages for this conversation to extract contact details
                        let fetchedMessages: any[] = [];
                        try {
                          const response = await fetch(`/api/conversations/${conversation.id}/messages`);
                          if (response.ok) {
                            const data = await response.json();
                            fetchedMessages = data.data || [];
                          }
                        } catch (error) {
                          console.error('Error fetching messages:', error);
                        }
                        
                        // Extract contact details from conversation and messages
                        const { name, email, phone } = extractContactDetails(conversation, fetchedMessages);
                        
                        opportunityForm.reset({
                          name: name,
                          email: email,
                          phone: phone,
                          address: '',
                          serviceRequested: '',
                          urgency: 'medium',
                          status: 'new',
                          notes: `Converted from conversation: ${conversation.title || ''}`
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
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Floating Action Button */}
      <Button
        size="icon"
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-50"
        data-testid="button-new-conversation"
        onClick={() => toast({ title: 'New conversation', description: 'Feature coming soon' })}
      >
        <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>

      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Reply to {selectedConversation?.title}</DialogTitle>
            <DialogDescription>
              Send a response via {messages.find((m: ConversationMessage) => m.direction === 'inbound')?.platform || 'the original channel'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reply-content">Message</Label>
              <Textarea
                id="reply-content"
                data-testid="textarea-reply-content"
                placeholder="Type your reply here..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowReplyDialog(false);
                setReplyContent('');
              }}
              data-testid="button-cancel-reply"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedConversation && replyContent.trim()) {
                  replyMutation.mutate({ 
                    conversationId: selectedConversation.id, 
                    content: replyContent 
                  });
                }
              }}
              disabled={!replyContent.trim() || replyMutation.isPending}
              data-testid="button-send-reply"
            >
              {replyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reply'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Quote Dialog */}
      <LeadFormDialog
        open={showCreateJobDialog}
        onOpenChange={setShowCreateJobDialog}
        title="Create New Quote"
        description="Create a quote from this conversation"
        submitLabel="Create Quote"
        isSubmitting={createJobMutation.isPending}
        form={jobForm}
        onSubmit={(values) => createJobMutation.mutate({ ...values, status: 'new' })}
        includeStatus={false}
        testIdPrefix="quote"
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
        testIdPrefix="opportunity"
      />
    </div>
  );
}
