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
  Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from 'date-fns';

export default function ConversationDetail() {
  const [, params] = useRoute('/conversation/:id');
  const [, setLocation] = useLocation();
  const conversationId = params?.id;
  const [replyContent, setReplyContent] = useState('');
  
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

  const handleSendReply = () => {
    if (!replyContent.trim()) return;
    replyMutation.mutate({ content: replyContent });
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
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation('/job-dashboard')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10 bg-gray-200 flex-shrink-0">
            <AvatarFallback className="text-gray-600 font-medium">
              {getInitials(conversation.title)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 truncate" data-testid="text-conversation-title">
              {conversation.title}
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {conversation.source}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" data-testid="button-call">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-video">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-more">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4">
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
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    message.direction === 'outbound'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
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
      <div className="border-t bg-white px-4 py-3">
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
            className="min-h-[44px] max-h-[120px] resize-none"
            data-testid="textarea-message-input"
          />
          <Button
            size="icon"
            onClick={handleSendReply}
            disabled={!replyContent.trim() || replyMutation.isPending}
            className="flex-shrink-0 h-11 w-11 bg-blue-600 hover:bg-blue-700"
            data-testid="button-send"
          >
            {replyMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
