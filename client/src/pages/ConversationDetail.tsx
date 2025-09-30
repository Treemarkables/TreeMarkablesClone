import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Conversation, ConversationMessage } from '@shared/schema';
import {
  ArrowLeft,
  Send,
  Loader2,
  MoreVertical,
  Phone,
  Video,
  Calendar,
  UserPlus,
  Star,
  Activity,
  MessageSquare,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from 'date-fns';

export default function ConversationDetail() {
  const [, params] = useRoute('/conversation/:id');
  const [, setLocation] = useLocation();
  const conversationId = params?.id;
  const [replyContent, setReplyContent] = useState('');
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showCreateOpportunity, setShowCreateOpportunity] = useState(false);
  
  // Create Opportunity form state
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    serviceRequested: '',
    urgency: 'medium' as 'low' | 'medium' | 'high' | 'emergency',
    status: 'new' as 'new' | 'contacted' | 'qualified' | 'quoted' | 'won' | 'lost',
    notes: ''
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch conversation details
  const { data: conversationResponse, isLoading: isLoadingConversation } = useQuery({
    queryKey: ['/api/conversations', conversationId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${conversationId}`);
      if (!response.ok) throw new Error('Failed to fetch conversation');
      return response.json();
    },
    enabled: !!conversationId,
  });

  const conversation: Conversation | undefined = conversationResponse?.data;

  // Fetch conversation messages
  const { data: messagesResponse, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['/api/conversations', conversationId, 'messages'],
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!conversationId,
  });

  const messages: ConversationMessage[] = messagesResponse?.data || [];

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      return apiRequest('POST', `/api/conversations/${conversationId}/reply`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', conversationId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      setReplyContent('');
      toast({ title: 'Message sent successfully' });
    },
    onError: () => {
      toast({ 
        title: 'Failed to send message', 
        description: 'Please try again or check your connection.',
        variant: 'destructive'
      });
    }
  });

  // Create Opportunity mutation
  const createOpportunityMutation = useMutation({
    mutationFn: async (leadData: typeof leadForm) => {
      return apiRequest('POST', '/api/leads', leadData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      setShowCreateOpportunity(false);
      setLeadForm({
        name: '',
        email: '',
        phone: '',
        address: '',
        serviceRequested: '',
        urgency: 'medium',
        status: 'new',
        notes: ''
      });
      toast({ 
        title: 'Opportunity created successfully',
        description: 'The lead has been added to your pipeline'
      });
      setLocation('/job-dashboard?tab=leads');
    },
    onError: () => {
      toast({ 
        title: 'Failed to create opportunity', 
        description: 'Please try again.',
        variant: 'destructive'
      });
    }
  });

  const handleSendReply = () => {
    if (!replyContent.trim()) return;
    replyMutation.mutate({ content: replyContent });
  };

  const handleCreateOpportunity = () => {
    if (!leadForm.name.trim() || !leadForm.phone.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Name and phone are required',
        variant: 'destructive'
      });
      return;
    }
    createOpportunityMutation.mutate(leadForm);
  };

  const getInitials = (title: string) => {
    const words = title.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.substring(0, 2).toUpperCase();
  };

  const formatMessageTime = (dateString: string | Date) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return '';
    }
  };

  if (isLoadingConversation || isLoadingMessages) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-gray-500">Conversation not found</p>
        <Button 
          variant="outline" 
          onClick={() => setLocation('/job-dashboard')}
          className="mt-4"
        >
          Back to Conversations
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-4 border-b bg-white">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button 
            variant="ghost" 
            size="icon"
            className="flex-shrink-0"
            onClick={() => setLocation('/job-dashboard')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg sm:text-xl text-gray-900 truncate" data-testid="text-conversation-title">
              {conversation.title}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate capitalize">
              {conversation.source}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          className="flex-shrink-0"
          onClick={() => setShowManageMenu(true)}
          data-testid="button-more"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 sm:px-4 py-3 sm:py-4">
        <div className="space-y-3 sm:space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-400 text-sm">No messages yet</p>
            </div>
          ) : (
            messages.map((message: ConversationMessage) => (
              <div
                key={message.id}
                className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${message.id}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 ${
                    message.direction === 'outbound'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm sm:text-base whitespace-pre-wrap break-words">{message.content}</p>
                  <p
                    className={`text-[10px] sm:text-xs mt-1 ${
                      message.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {formatMessageTime(message.createdAt || new Date())}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t bg-white px-3 sm:px-4 py-2 sm:py-3">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="Type a message..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
            className="min-h-[40px] sm:min-h-[44px] max-h-[100px] sm:max-h-[120px] resize-none text-sm sm:text-base"
            data-testid="textarea-message-input"
          />
          <Button
            size="icon"
            onClick={handleSendReply}
            disabled={!replyContent.trim() || replyMutation.isPending}
            className="flex-shrink-0 h-10 w-10 sm:h-11 sm:w-11 bg-blue-600 hover:bg-blue-700"
            data-testid="button-send"
          >
            {replyMutation.isPending ? (
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Manage Menu Sheet */}
      <Sheet open={showManageMenu} onOpenChange={setShowManageMenu}>
        <SheetContent side="bottom" className="h-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-center text-lg font-semibold">Manage</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-1">
            {/* Schedule Appointment */}
            <button
              onClick={() => {
                setShowManageMenu(false);
                setLocation('/calendar');
              }}
              className="w-full flex items-center gap-4 px-4 py-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-schedule-appointment"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-medium text-gray-900">Schedule Appointment</span>
            </button>

            {/* Create Opportunity */}
            <button
              onClick={() => {
                setShowManageMenu(false);
                setShowCreateOpportunity(true);
                setLeadForm({
                  name: conversation?.title || '',
                  email: '',
                  phone: '',
                  address: '',
                  serviceRequested: '',
                  urgency: 'medium',
                  status: 'new',
                  notes: `Converted from conversation: ${conversation?.title || ''}`
                });
              }}
              className="w-full flex items-center gap-4 px-4 py-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-create-opportunity"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-medium text-gray-900">Create Opportunity</span>
            </button>

            {/* Send Review Request */}
            <button
              onClick={() => {
                setShowManageMenu(false);
                toast({ title: 'Send Review Request', description: 'Feature coming soon' });
              }}
              className="w-full flex items-center gap-4 px-4 py-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-send-review-request"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                <Star className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-medium text-gray-900">Send Review Request</span>
            </button>

            {/* Show Activity */}
            <div className="w-full flex items-center justify-between gap-4 px-4 py-4 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <span className="text-base font-medium text-gray-900">Show Activity</span>
              </div>
              <Switch
                checked={showActivity}
                onCheckedChange={setShowActivity}
                data-testid="switch-show-activity"
              />
            </div>

            {/* Add Internal Comments */}
            <button
              onClick={() => {
                setShowManageMenu(false);
                toast({ title: 'Add Internal Comments', description: 'Feature coming soon' });
              }}
              className="w-full flex items-center gap-4 px-4 py-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-add-internal-comments"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-medium text-gray-900">Add Internal Comments</span>
            </button>

            <Separator className="my-2" />

            {/* Delete Conversation */}
            <button
              onClick={() => {
                setShowManageMenu(false);
                toast({ 
                  title: 'Delete Conversation', 
                  description: 'Feature coming soon',
                  variant: 'destructive'
                });
              }}
              className="w-full flex items-center gap-4 px-4 py-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-delete-conversation"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-500 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-medium text-red-600">Delete Conversation</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Opportunity Dialog */}
      <Dialog open={showCreateOpportunity} onOpenChange={setShowCreateOpportunity}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Opportunity</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={leadForm.name}
                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                placeholder="Customer name"
                data-testid="input-lead-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={leadForm.phone}
                onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                placeholder="Phone number"
                data-testid="input-lead-phone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={leadForm.email}
                onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                placeholder="Email address"
                data-testid="input-lead-email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={leadForm.address}
                onChange={(e) => setLeadForm({ ...leadForm, address: e.target.value })}
                placeholder="Service address"
                data-testid="input-lead-address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="service">Service Requested</Label>
              <Input
                id="service"
                value={leadForm.serviceRequested}
                onChange={(e) => setLeadForm({ ...leadForm, serviceRequested: e.target.value })}
                placeholder="e.g., Tree removal, hedge trimming"
                data-testid="input-lead-service"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="urgency">Urgency</Label>
              <Select
                value={leadForm.urgency}
                onValueChange={(value: any) => setLeadForm({ ...leadForm, urgency: value })}
              >
                <SelectTrigger data-testid="select-lead-urgency">
                  <SelectValue placeholder="Select urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Pipeline Stage</Label>
              <Select
                value={leadForm.status}
                onValueChange={(value: any) => setLeadForm({ ...leadForm, status: value })}
              >
                <SelectTrigger data-testid="select-lead-status">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                placeholder="Additional notes or context"
                className="min-h-[80px]"
                data-testid="textarea-lead-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateOpportunity(false)}
              disabled={createOpportunityMutation.isPending}
              data-testid="button-cancel-opportunity"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOpportunity}
              disabled={createOpportunityMutation.isPending}
              data-testid="button-submit-opportunity"
            >
              {createOpportunityMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Opportunity'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
