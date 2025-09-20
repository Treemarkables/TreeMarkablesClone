import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Communication } from '@shared/schema';
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

// Communication type is imported from shared schema

const platformConfig = {
  email: { icon: Mail, color: 'bg-blue-100 text-blue-700', name: 'Email' },
  sms: { icon: MessageSquare, color: 'bg-green-100 text-green-700', name: 'SMS' },
  facebook: { icon: Facebook, color: 'bg-blue-100 text-blue-700', name: 'Facebook' },
  instagram: { icon: Instagram, color: 'bg-pink-100 text-pink-700', name: 'Instagram' },
  twitter: { icon: Twitter, color: 'bg-sky-100 text-sky-700', name: 'Twitter' },
  linkedin: { icon: Linkedin, color: 'bg-blue-100 text-blue-700', name: 'LinkedIn' },
  whatsapp: { icon: MessageSquare, color: 'bg-green-100 text-green-700', name: 'WhatsApp' },
  phone: { icon: Phone, color: 'bg-gray-100 text-gray-700', name: 'Phone' }
};

// Real data will be fetched from backend APIs

export default function Opportunities() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch communications from backend
  const { data: communicationsResponse, isLoading, error } = useQuery({
    queryKey: ['/api/communications', { 
      platform: selectedPlatform !== 'all' ? selectedPlatform : undefined,
      priority: selectedPriority !== 'all' ? selectedPriority : undefined,
      search: searchTerm || undefined,
      isArchived: false
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPlatform !== 'all') params.append('platform', selectedPlatform);
      if (selectedPriority !== 'all') params.append('priority', selectedPriority);
      if (searchTerm) params.append('search', searchTerm);
      params.append('isArchived', 'false');

      const response = await fetch(`/api/communications?${params}`);
      if (!response.ok) throw new Error('Failed to fetch communications');
      return response.json();
    },
  });

  const communications = communicationsResponse?.data || [];

  // Fetch communication stats
  const { data: statsResponse } = useQuery({
    queryKey: ['/api/communications/stats'],
    queryFn: async () => {
      const response = await fetch('/api/communications/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });

  const stats = statsResponse?.data || {
    total: 0,
    unread: 0,
    starred: 0,
    archived: 0
  };

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/communications/${id}/read`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/communications/stats'] });
      toast({ title: 'Message marked as read' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark message as read', variant: 'destructive' });
    }
  });

  // Star/unstar mutation
  const starMutation = useMutation({
    mutationFn: async ({ id, starred }: { id: string; starred: boolean }) => {
      return apiRequest(`/api/communications/${id}/star`, { 
        method: 'PATCH',
        body: { starred }
      });
    },
    onSuccess: (_, { starred }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/communications/stats'] });
      toast({ title: starred ? 'Message starred' : 'Message unstarred' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update star status', variant: 'destructive' });
    }
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/communications/${id}/archive`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/communications/stats'] });
      setSelectedCommunication(null);
      toast({ title: 'Message archived' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to archive message', variant: 'destructive' });
    }
  });

  const filteredCommunications = useMemo(() => {
    return communications.filter(comm => {
      const matchesRead = !showUnreadOnly || !comm.isRead;
      return matchesRead && !comm.isArchived;
    });
  }, [communications, showUnreadOnly]);

  // Handle communication click
  const handleCommunicationClick = (communication: Communication) => {
    setSelectedCommunication(communication);
    
    // Mark as read if not already read
    if (!communication.isRead) {
      markAsReadMutation.mutate(communication.id);
    }
  };

  // Handle star toggle
  const handleStarToggle = (communication: Communication, event: React.MouseEvent) => {
    event.stopPropagation();
    starMutation.mutate({ 
      id: communication.id, 
      starred: !communication.isStarred 
    });
  };

  // Handle archive
  const handleArchive = (communication: Communication) => {
    archiveMutation.mutate(communication.id);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Opportunities Hub</h1>
        <p className="text-gray-600">Centralized communication center for all your platforms</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Mail className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Messages</p>
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
                <p className="text-sm text-gray-600">Unread</p>
                <p className="text-2xl font-bold text-gray-900">{stats.unread}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Starred</p>
                <p className="text-2xl font-bold text-gray-900">{stats.starred}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Archived</p>
                <p className="text-2xl font-bold text-gray-900">{stats.archived}</p>
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
                  placeholder="Search messages, contacts, or content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-communications"
                />
              </div>
            </div>
            
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger className="w-48" data-testid="select-platform-filter">
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {Object.entries(platformConfig).map(([key, config]) => (
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
                <span>Communications ({filteredCommunications.length})</span>
                <Button variant="outline" size="sm" data-testid="button-refresh-communications">
                  <Clock className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="space-y-1">
                  {filteredCommunications.map((comm) => {
                    const PlatformIcon = platformConfig[comm.platform].icon;
                    const isSelected = selectedCommunication?.id === comm.id;
                    
                    return (
                      <div
                        key={comm.id}
                        className={`p-4 cursor-pointer hover-elevate transition-colors border-l-4 ${
                          isSelected 
                            ? 'bg-orange-50 border-l-orange-500' 
                            : comm.isRead 
                              ? 'border-l-transparent hover:bg-gray-50' 
                              : 'border-l-orange-200 bg-orange-25 hover:bg-orange-50'
                        }`}
                        onClick={() => handleCommunicationClick(comm)}
                        data-testid={`communication-item-${comm.id}`}
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
                              <span className={`font-medium ${!comm.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                                {comm.from}
                              </span>
                              <Badge className={`${platformConfig[comm.platform].color} text-xs`}>
                                <PlatformIcon className="h-3 w-3 mr-1" />
                                {platformConfig[comm.platform].name}
                              </Badge>
                              <Badge className={`${getPriorityColor(comm.priority)} text-xs`}>
                                {comm.priority}
                              </Badge>
                            </div>
                            
                            {comm.subject && (
                              <p className={`text-sm mb-1 ${!comm.isRead ? 'font-medium' : ''}`}>
                                {comm.subject}
                              </p>
                            )}
                            
                            <p className="text-sm text-gray-600 truncate">
                              {comm.content}
                            </p>
                            
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(comm.receivedAt)}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => handleStarToggle(comm, e)}
                                  className="p-1 hover:bg-gray-200 rounded"
                                  disabled={starMutation.isPending}
                                >
                                  <Star className={`h-3 w-3 ${comm.isStarred ? 'text-yellow-500 fill-current' : 'text-gray-400'}`} />
                                </button>
                                {!comm.isRead && (
                                  <div className="h-2 w-2 bg-orange-500 rounded-full" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {filteredCommunications.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No communications found</p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Message Detail Panel */}
        <div>
          {selectedCommunication ? (
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
                      <h3 className="font-semibold">{selectedCommunication.from}</h3>
                      {selectedCommunication.fromEmail && (
                        <p className="text-sm text-gray-600">{selectedCommunication.fromEmail}</p>
                      )}
                      {selectedCommunication.fromPhone && (
                        <p className="text-sm text-gray-600">{selectedCommunication.fromPhone}</p>
                      )}
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
                        onClick={() => handleStarToggle(selectedCommunication, {} as React.MouseEvent)}
                        disabled={starMutation.isPending}
                      >
                        <Star className="h-4 w-4 mr-2" />
                        {selectedCommunication.isStarred ? 'Unstar' : 'Star'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleArchive(selectedCommunication)}
                        disabled={archiveMutation.isPending}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
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
                    {new Date(selectedCommunication.receivedAt).toLocaleString()}
                  </div>
                  
                  {selectedCommunication.subject && (
                    <div>
                      <h4 className="font-medium mb-2">Subject</h4>
                      <p className="text-gray-900">{selectedCommunication.subject}</p>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-2">Message</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedCommunication.content}</p>
                    </div>
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
                      onClick={() => handleArchive(selectedCommunication)}
                      disabled={archiveMutation.isPending}
                    >
                      {archiveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Archive className="h-4 w-4 mr-2" />
                      )}
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a communication</h3>
                <p className="text-gray-600">Choose a message from the list to view details and take action</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}