import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Mail,
  MessageSquare,
  Phone,
  Search,
  Filter,
  Archive,
  Star,
  Reply,
  Forward,
  MoreHorizontal,
  Clock,
  CheckCircle,
  Paperclip,
  User,
  Calendar,
  Loader2,
  Settings,
  Plus,
  RefreshCw,
  Inbox as InboxIcon,
  Send,
  Trash2,
  Flag,
  Tag
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
import { Checkbox } from "@/components/ui/checkbox";

interface EmailMessage {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  content: string;
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  hasAttachments: boolean;
  attachmentCount?: number;
  labels: string[];
  folder: 'inbox' | 'sent' | 'draft' | 'trash' | 'spam';
}

const mockEmails: EmailMessage[] = [
  {
    id: "1",
    from: "Sarah Johnson",
    fromEmail: "sarah.j@email.com",
    subject: "Tree removal quote request - URGENT",
    content: "Hi, I need a quote for removing two large oak trees from my backyard. They are approximately 30 feet tall and located near my house. Can you provide an estimate? This is quite urgent as we're expecting storms next week.",
    receivedAt: "2024-12-20T09:30:00.000Z",
    isRead: false,
    isStarred: true,
    isArchived: false,
    hasAttachments: true,
    attachmentCount: 2,
    labels: ["urgent", "quote"],
    folder: 'inbox'
  },
  {
    id: "2",
    from: "Mike Chen",
    fromEmail: "mike.chen@example.com",
    subject: "Thank you for the excellent service",
    content: "Just wanted to thank you for the fantastic tree pruning work you did last week. The team was professional, efficient, and cleaned up perfectly. I'll definitely recommend you to my neighbors.",
    receivedAt: "2024-12-19T14:15:00.000Z",
    isRead: true,
    isStarred: false,
    isArchived: false,
    hasAttachments: false,
    labels: ["feedback", "positive"],
    folder: 'inbox'
  },
  {
    id: "3",
    from: "Emma Rodriguez",
    fromEmail: "emma.r@business.com",
    subject: "Follow-up on hedge trimming estimate",
    content: "Hi, I received your estimate for the hedge trimming work. The price looks good, but I'd like to schedule this for next month instead of this month. Would that work for you?",
    receivedAt: "2024-12-19T11:45:00.000Z",
    isRead: true,
    isStarred: false,
    isArchived: false,
    hasAttachments: false,
    labels: ["follow-up"],
    folder: 'inbox'
  },
  {
    id: "4",
    from: "David Wilson",
    fromEmail: "d.wilson@email.com",
    subject: "Emergency tree removal needed",
    content: "We have a large tree that fell across our driveway after last night's storm. We need immediate assistance to clear it so we can get our cars out. Please call as soon as possible.",
    receivedAt: "2024-12-18T07:22:00.000Z",
    isRead: false,
    isStarred: true,
    isArchived: false,
    hasAttachments: false,
    labels: ["emergency", "urgent"],
    folder: 'inbox'
  }
];

export default function Inbox() {
  const [selectedFolder, setSelectedFolder] = useState<string>('inbox');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string>('all');
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch emails from backend (using mock data for now)
  const { data: emailsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/emails', { 
      folder: selectedFolder,
      search: searchTerm || undefined,
      label: selectedLabel !== 'all' ? selectedLabel : undefined
    }],
    queryFn: async () => {
      // TODO: Replace with real API call
      return { success: true, data: mockEmails };
    }
  });

  const emails = emailsResponse?.data || [];

  // Filter emails based on current criteria
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      const matchesFolder = email.folder === selectedFolder;
      const matchesSearch = !searchTerm || 
        email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLabel = selectedLabel === 'all' || email.labels.includes(selectedLabel);
      
      return matchesFolder && matchesSearch && matchesLabel;
    });
  }, [emails, selectedFolder, searchTerm, selectedLabel]);

  // Email mutations
  const markAsReadMutation = useMutation({
    mutationFn: async (emailIds: string[]) => {
      return apiRequest('PATCH', '/api/emails/mark-read', { emailIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
      toast({ title: 'Emails marked as read' });
    }
  });

  const starMutation = useMutation({
    mutationFn: async ({ emailIds, starred }: { emailIds: string[]; starred: boolean }) => {
      return apiRequest('PATCH', '/api/emails/star', { emailIds, starred });
    },
    onSuccess: (_, { starred }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
      toast({ title: starred ? 'Emails starred' : 'Emails unstarred' });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: async (emailIds: string[]) => {
      return apiRequest('PATCH', '/api/emails/archive', { emailIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
      setSelectedEmails([]);
      toast({ title: 'Emails archived' });
    }
  });

  const handleSelectEmail = (emailId: string) => {
    setSelectedEmails(prev => 
      prev.includes(emailId) 
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEmails.length === filteredEmails.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(filteredEmails.map(email => email.id));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 168) { // Within a week
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const unreadCount = filteredEmails.filter(email => !email.isRead).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading inbox...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <InboxIcon className="h-6 w-6 text-orange-600" />
                Inbox
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount} unread
                  </Badge>
                )}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage all your emails and messages in one place
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
                data-testid="button-refresh-emails"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-compose-email"
              >
                <Plus className="h-4 w-4 mr-1" />
                Compose
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-email-settings"
              >
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-4 space-y-4">
            {/* Folders */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Folders</h3>
              <div className="space-y-1">
                {[
                  { id: 'inbox', label: 'Inbox', icon: InboxIcon, count: unreadCount },
                  { id: 'sent', label: 'Sent', icon: Send, count: 0 },
                  { id: 'draft', label: 'Drafts', icon: Clock, count: 2 },
                  { id: 'trash', label: 'Trash', icon: Trash2, count: 0 },
                  { id: 'spam', label: 'Spam', icon: Flag, count: 0 }
                ].map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-md text-sm ${
                      selectedFolder === folder.id
                        ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    data-testid={`folder-${folder.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <folder.icon className="h-4 w-4" />
                      <span>{folder.label}</span>
                    </div>
                    {folder.count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {folder.count}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Labels */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Labels</h3>
              <Select value={selectedLabel} onValueChange={setSelectedLabel}>
                <SelectTrigger className="w-full" data-testid="select-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Labels</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Search and Actions */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedEmails.length === filteredEmails.length && filteredEmails.length > 0}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedEmails.length > 0 ? `${selectedEmails.length} selected` : 'Select all'}
                </span>
              </div>
              
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search emails..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-emails"
                  />
                </div>
              </div>

              {selectedEmails.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAsReadMutation.mutate(selectedEmails)}
                    data-testid="button-mark-read"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark Read
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => starMutation.mutate({ emailIds: selectedEmails, starred: true })}
                    data-testid="button-star-emails"
                  >
                    <Star className="h-4 w-4 mr-1" />
                    Star
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => archiveMutation.mutate(selectedEmails)}
                    data-testid="button-archive-emails"
                  >
                    <Archive className="h-4 w-4 mr-1" />
                    Archive
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex">
            {/* Email List */}
            <div className="flex-1 border-r border-gray-200 dark:border-gray-700">
              <ScrollArea className="h-full">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredEmails.map((email) => (
                    <div
                      key={email.id}
                      className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        selectedEmail?.id === email.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      } ${!email.isRead ? 'bg-blue-25 dark:bg-blue-950/20' : ''}`}
                      onClick={() => setSelectedEmail(email)}
                      data-testid={`email-item-${email.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedEmails.includes(email.id)}
                          onCheckedChange={() => handleSelectEmail(email.id)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-email-${email.id}`}
                        />
                        
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {email.from.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${!email.isRead ? 'font-semibold' : 'font-medium'}`}>
                                {email.from}
                              </span>
                              {email.isStarred && (
                                <Star className="h-3 w-3 text-yellow-400 fill-current" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {email.hasAttachments && (
                                <Paperclip className="h-3 w-3 text-gray-400" />
                              )}
                              <span className="text-xs text-gray-500">
                                {formatDate(email.receivedAt)}
                              </span>
                            </div>
                          </div>
                          
                          <div className={`text-sm mb-1 ${!email.isRead ? 'font-medium' : ''}`}>
                            {email.subject}
                          </div>
                          
                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {email.content}
                          </div>
                          
                          <div className="flex items-center gap-1 mt-2">
                            {email.labels.map((label) => (
                              <Badge key={label} variant="secondary" className="text-xs">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Email Preview */}
            {selectedEmail ? (
              <div className="w-96 bg-white dark:bg-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-lg">{selectedEmail.subject}</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>
                          <Reply className="h-4 w-4 mr-2" />
                          Reply
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Forward className="h-4 w-4 mr-2" />
                          Forward
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {selectedEmail.from.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{selectedEmail.from}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {selectedEmail.fromEmail}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 mb-3">
                    {new Date(selectedEmail.receivedAt).toLocaleString()}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {selectedEmail.labels.map((label) => (
                      <Badge key={label} variant="secondary" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <ScrollArea className="flex-1 p-4">
                  <div className="text-sm whitespace-pre-wrap">
                    {selectedEmail.content}
                  </div>
                  
                  {selectedEmail.hasAttachments && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        Attachments ({selectedEmail.attachmentCount})
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <Paperclip className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">property_photos.zip</span>
                          <span className="text-xs text-gray-500">(2.4 MB)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <Paperclip className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">tree_measurements.pdf</span>
                          <span className="text-xs text-gray-500">(1.2 MB)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </ScrollArea>
                
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" data-testid="button-reply">
                      <Reply className="h-4 w-4 mr-1" />
                      Reply
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-forward">
                      <Forward className="h-4 w-4 mr-1" />
                      Forward
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-96 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select an email to view</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}