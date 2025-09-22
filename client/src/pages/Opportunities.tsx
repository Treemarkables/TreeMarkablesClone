import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Conversation, ConversationMessage } from '@shared/schema';
import {
  Mail,
  MessageSquare,
  Phone,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Search,
  Filter,
  Archive,
  Star,
  Reply,
  Forward,
  MoreHorizontal,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Hash,
  Calendar,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Conversation types imported from shared schema

const sourceConfig = {
  web_form: { icon: Mail, color: 'bg-blue-100 text-blue-700', name: 'Web Form' },
  phone: { icon: Phone, color: 'bg-green-100 text-green-700', name: 'Phone' },
  email: { icon: Mail, color: 'bg-blue-100 text-blue-700', name: 'Email' },
  social: { icon: MessageSquare, color: 'bg-pink-100 text-pink-700', name: 'Social Media' },
  referral: { icon: User, color: 'bg-purple-100 text-purple-700', name: 'Referral' },
  walk_in: { icon: MessageSquare, color: 'bg-gray-100 text-gray-700', name: 'Walk-in' }
};

const statusConfig = {
  open: { color: 'bg-green-100 text-green-700', name: 'Open' },
  qualified: { color: 'bg-blue-100 text-blue-700', name: 'Qualified' },
  converted: { color: 'bg-purple-100 text-purple-700', name: 'Converted' },
  closed: { color: 'bg-gray-100 text-gray-700', name: 'Closed' },
  archived: { color: 'bg-red-100 text-red-700', name: 'Archived' }
};

// Real conversation data will be fetched from backend APIs

export default function Opportunities() {
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<ConversationMessage[]>([]);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch conversations from backend
  const { data: conversationsResponse, isLoading, error } = useQuery({
    queryKey: ['/api/conversations', { 
      source: selectedSource !== 'all' ? selectedSource : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
      priority: selectedPriority !== 'all' ? selectedPriority : undefined,
      search: searchTerm || undefined
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSource !== 'all') params.append('source', selectedSource);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedPriority !== 'all') params.append('priority', selectedPriority);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/conversations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch conversations');
      return response.json();
    },
  });

  const conversations = conversationsResponse?.data || [];

  // Fetch conversation messages for selected conversation
  const { data: messagesResponse, isLoading: messagesLoading } = useQuery({
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

  // Get conversation stats (using unread count)
  const { data: unreadCountResponse } = useQuery({
    queryKey: ['/api/conversations/unread-count'],
    queryFn: async () => {
      const response = await fetch('/api/conversations/unread-count');
      if (!response.ok) throw new Error('Failed to fetch unread count');
      return response.json();
    },
  });

  const totalUnreadCount = unreadCountResponse?.data?.unreadCount || 0;

  // Calculate stats from conversations data
  const stats = useMemo(() => {
    const openConversations = conversations.filter(conv => conv.status === 'open').length;
    const qualifiedConversations = conversations.filter(conv => conv.status === 'qualified').length;
    const convertedConversations = conversations.filter(conv => conv.status === 'converted').length;
    const totalConversations = conversations.length;

    return {
      total: totalConversations,
      unread: totalUnreadCount,
      open: openConversations,
      qualified: qualifiedConversations,
      converted: convertedConversations
    };
  }, [conversations, totalUnreadCount]);

  // Mark conversation messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest('PATCH', `/api/conversations/${conversationId}/messages/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations/unread-count'] });
      toast({ title: 'Messages marked as read' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark messages as read', variant: 'destructive' });
    }
  });

  // Update conversation status mutation
  const updateConversationMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest('PATCH', `/api/conversations/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations/unread-count'] });
      toast({ title: 'Conversation updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update conversation', variant: 'destructive' });
    }
  });

  // Convert conversation to quote mutation
  const convertToQuoteMutation = useMutation({
    mutationFn: async ({ conversationId, quoteId }: { conversationId: string; quoteId: string }) => {
      return apiRequest('PATCH', `/api/conversations/${conversationId}/convert`, { quoteId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      setSelectedConversation(null);
      toast({ title: 'Conversation converted to quote' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to convert conversation', variant: 'destructive' });
    }
  });

  // Add conversation message mutation
  const addMessageMutation = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: string; message: any }) => {
      return apiRequest('POST', `/api/conversations/${conversationId}/messages`, message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', selectedConversation?.id, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({ title: 'Message sent' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    }
  });

  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      const matchesUnread = !showUnreadOnly || conv.unreadCount > 0;
      return matchesUnread && (conv.isActive ?? true);
    });
  }, [conversations, showUnreadOnly]);

  // Handle conversation click
  const handleConversationClick = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    // Mark messages as read if there are unread messages
    if (conversation.unreadCount > 0) {
      markAsReadMutation.mutate(conversation.id);
    }
  };

  // Handle priority change
  const handlePriorityChange = (conversation: Conversation, priority: string) => {
    updateConversationMutation.mutate({ 
      id: conversation.id, 
      updates: { priority } 
    });
  };

  // Handle status change
  const handleStatusChange = (conversation: Conversation, status: string) => {
    updateConversationMutation.mutate({ 
      id: conversation.id, 
      updates: { status } 
    });
  };

  // Handle assign conversation
  const handleAssignConversation = (conversation: Conversation, assignedTo: string) => {
    updateConversationMutation.mutate({ 
      id: conversation.id, 
      updates: { assignedTo } 
    });
  };

  // Handle convert to quote
  const handleConvertToQuote = (conversation: Conversation) => {
    // In a real app, this would open a quote creation dialog and then convert
    toast({ title: 'Feature coming soon', description: 'Quote conversion will be available soon.' });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Opportunities Hub</h1>
          <p className="text-gray-600">Centralized communication center for all your platforms</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading communications</h3>
            <p className="text-gray-600 mb-4">There was a problem loading your messages. Please try again.</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Conversations</h1>
        <p className="text-gray-600">Centralized pre-sales communication hub for lead qualification</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Conversations</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Unread Messages</p>
                <p className="text-2xl font-bold text-gray-900">{stats.unread}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Open</p>
                <p className="text-2xl font-bold text-gray-900">{stats.open}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Qualified</p>
                <p className="text-2xl font-bold text-gray-900">{stats.qualified}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Star className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Converted</p>
                <p className="text-2xl font-bold text-gray-900">{stats.converted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search conversations, contacts, or content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-conversations"
                />
              </div>
            </div>
            
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger className="w-48" data-testid="select-source-filter">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {Object.entries(sourceConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="w-40" data-testid="select-priority-filter">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showUnreadOnly ? "default" : "outline"}
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              data-testid="button-toggle-unread"
            >
              <Filter className="h-4 w-4 mr-2" />
              Unread Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Communication List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Conversations ({filteredConversations.length})</span>
                <Button variant="outline" size="sm" data-testid="button-refresh-conversations" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/conversations'] })}>
                  <Clock className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="space-y-1">
                  {filteredConversations.map((conv) => {
                    const SourceIcon = sourceConfig[conv.source]?.icon || MessageSquare;
                    const isSelected = selectedConversation?.id === conv.id;
                    
                    return (
                      <div
                        key={conv.id}
                        className={`p-4 cursor-pointer hover-elevate transition-colors border-l-4 ${
                          isSelected 
                            ? 'bg-orange-50 border-l-orange-500' 
                            : conv.unreadCount > 0 
                              ? 'border-l-orange-200 bg-orange-25 hover:bg-orange-50' 
                              : 'border-l-transparent hover:bg-gray-50'
                        }`}
                        onClick={() => handleConversationClick(conv)}
                        data-testid={`conversation-item-${conv.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src="" />
                            <AvatarFallback>
                              <User className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-medium ${conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                                {conv.title}
                              </span>
                              <Badge className={`${sourceConfig[conv.source]?.color || 'bg-gray-100 text-gray-700'} text-xs`}>
                                <SourceIcon className="h-3 w-3 mr-1" />
                                {sourceConfig[conv.source]?.name || conv.source}
                              </Badge>
                              <Badge className={`${statusConfig[conv.status]?.color || 'bg-gray-100 text-gray-700'} text-xs`}>
                                {statusConfig[conv.status]?.name || conv.status}
                              </Badge>
                              <Badge className={`${getPriorityColor(conv.priority)} text-xs`}>
                                {conv.priority}
                              </Badge>
                            </div>
                            
                            {conv.serviceType && (
                              <p className="text-sm mb-1 text-blue-600 font-medium">
                                {conv.serviceType.replace('_', ' ')}
                              </p>
                            )}
                            
                            {conv.estimatedValue && (
                              <p className="text-sm text-green-600 font-medium mb-1">
                                Est. ${parseFloat(conv.estimatedValue).toLocaleString()}
                              </p>
                            )}
                            
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(conv.lastMessageAt || conv.createdAt)}
                              </span>
                              <div className="flex items-center gap-1">
                                {conv.unreadCount > 0 && (
                                  <div className="flex items-center gap-1">
                                    <div className="h-2 w-2 bg-orange-500 rounded-full" />
                                    <span className="text-xs text-orange-600 font-medium">
                                      {conv.unreadCount}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {filteredConversations.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No conversations found</p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Conversation Detail Panel */}
        <div>
          {selectedConversation ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="" />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{selectedConversation.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`${sourceConfig[selectedConversation.source]?.color || 'bg-gray-100 text-gray-700'} text-xs`}>
                          {sourceConfig[selectedConversation.source]?.name || selectedConversation.source}
                        </Badge>
                        <Badge className={`${statusConfig[selectedConversation.status]?.color || 'bg-gray-100 text-gray-700'} text-xs`}>
                          {statusConfig[selectedConversation.status]?.name || selectedConversation.status}
                        </Badge>
                        <Badge className={`${getPriorityColor(selectedConversation.priority)} text-xs`}>
                          {selectedConversation.priority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem 
                        onClick={() => handleStatusChange(selectedConversation, 'qualified')}
                        disabled={updateConversationMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark as Qualified
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleConvertToQuote(selectedConversation)}
                        disabled={convertToQuoteMutation.isPending}
                      >
                        <Star className="h-4 w-4 mr-2" />
                        Convert to Quote
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Hash className="h-4 w-4 mr-2" />
                        Create Lead
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    {new Date(selectedConversation.lastMessageAt || selectedConversation.createdAt).toLocaleString()}
                  </div>
                  
                  {selectedConversation.serviceType && (
                    <div>
                      <h4 className="font-medium mb-2">Service Type</h4>
                      <p className="text-gray-900">{selectedConversation.serviceType.replace('_', ' ')}</p>
                    </div>
                  )}
                  
                  {selectedConversation.estimatedValue && (
                    <div>
                      <h4 className="font-medium mb-2">Estimated Value</h4>
                      <p className="text-green-600 font-medium">${parseFloat(selectedConversation.estimatedValue).toLocaleString()}</p>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-2">Message Thread</h4>
                    <ScrollArea className="h-[300px]">
                      {messagesLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : messages.length > 0 ? (
                        <div className="space-y-4">
                          {messages.map((message: any) => (
                            <div key={message.id} className={`p-3 rounded-lg ${
                              message.direction === 'outbound' 
                                ? 'bg-orange-50 border-l-4 border-orange-200 ml-8' 
                                : 'bg-gray-50 border-l-4 border-gray-200 mr-8'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">
                                  {message.direction === 'outbound' ? 'You' : message.sender || 'Customer'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatTimestamp(message.timestamp)}
                                </span>
                              </div>
                              <p className="text-gray-900 whitespace-pre-wrap">{message.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                          <p>No messages yet</p>
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button data-testid="button-reply">
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                    <Button variant="outline" data-testid="button-forward">
                      <Forward className="h-4 w-4 mr-2" />
                      Forward
                    </Button>
                    <Button 
                      variant="outline" 
                      data-testid="button-create-lead"
                      onClick={() => {
                        // In a real app, this would navigate to lead creation
                        toast({ title: 'Feature coming soon', description: 'Lead creation will be available soon.' });
                      }}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Create Lead
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        toast({ title: 'Feature coming soon', description: 'Conversation archiving will be available soon.' });
                      }}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
                <p className="text-gray-600">Choose a conversation from the list to view details and take action</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}