import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import type { Conversation, ConversationMessage } from '@shared/schema';
import {
  Menu,
  ChevronDown,
  Filter,
  Plus,
  Facebook,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function Opportunities() {
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [, setLocation] = useLocation();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const truncateMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  const handleConversationClick = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    // For now, open reply dialog - in future could navigate to detail view
    setShowReplyDialog(true);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" data-testid="button-menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold" data-testid="text-title">Treemarkables</h1>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </div>
            <p className="text-xs text-gray-500">Gisborne</p>
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 px-4 py-3 border-b overflow-x-auto">
        <Button 
          variant="outline" 
          size="sm"
          className="flex-shrink-0"
          data-testid="button-filter"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filter
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
        <Button 
          variant={filterType === 'internal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('internal')}
          className="flex-shrink-0"
          data-testid="button-internal-chat"
        >
          Internal Chat
        </Button>
        <Button 
          variant={filterType === 'recent' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('recent')}
          className="flex-shrink-0"
          data-testid="button-recent"
        >
          Recent
        </Button>
        <Button 
          variant={filterType === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('unread')}
          className="flex-shrink-0"
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
                className="flex items-center gap-3 px-4 py-3 hover-elevate active-elevate-2 cursor-pointer"
                onClick={() => handleConversationClick(conversation)}
                data-testid={`conversation-item-${conversation.id}`}
              >
                {/* Avatar with Badge */}
                <div className="relative flex-shrink-0">
                  <Avatar className="h-12 w-12 bg-gray-200">
                    <AvatarFallback className="text-gray-600 font-medium">
                      {getInitials(conversation.title)}
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 truncate" data-testid={`text-name-${conversation.id}`}>
                      {conversation.title}
                    </h3>
                    <span className="text-xs text-gray-500 flex-shrink-0" data-testid={`text-date-${conversation.id}`}>
                      {formatDate(conversation.lastMessageAt || conversation.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-sm text-gray-600 truncate" data-testid={`text-preview-${conversation.id}`}>
                      {truncateMessage(conversation.title)}
                    </p>
                    {conversation.unreadCount > 0 && (
                      <div 
                        className="flex-shrink-0 bg-green-500 text-white text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center"
                        data-testid={`badge-unread-${conversation.id}`}
                      >
                        {conversation.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Floating Action Button */}
      <Button
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
        data-testid="button-new-conversation"
        onClick={() => toast({ title: 'New conversation', description: 'Feature coming soon' })}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Reply to {selectedConversation?.title}</DialogTitle>
            <DialogDescription>
              Send a response via {messages.find(m => m.direction === 'inbound')?.platform || 'the original channel'}
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
    </div>
  );
}
