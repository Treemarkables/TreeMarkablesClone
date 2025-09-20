import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Calendar
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

interface Communication {
  id: string;
  platform: 'email' | 'sms' | 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'whatsapp' | 'phone';
  type: 'message' | 'comment' | 'mention' | 'dm' | 'call';
  from: string;
  fromEmail?: string;
  fromPhone?: string;
  subject?: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  priority: 'low' | 'medium' | 'high';
  attachments?: Array<{
    name: string;
    type: string;
    url: string;
  }>;
  threadId?: string;
  leadId?: string;
  customerId?: string;
}

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

// Sample data - in a real app, this would come from various API integrations
const sampleCommunications: Communication[] = [
  {
    id: '1',
    platform: 'email',
    type: 'message',
    from: 'Sarah Johnson',
    fromEmail: 'sarah.j@email.com',
    subject: 'Tree removal quote request',
    content: 'Hi, I need a quote for removing two large oak trees from my backyard. They are approximately 30 feet tall and located near my house. Can you provide an estimate?',
    timestamp: '2024-12-20T09:30:00Z',
    isRead: false,
    isStarred: false,
    isArchived: false,
    priority: 'high',
    leadId: '1'
  },
  {
    id: '2',
    platform: 'facebook',
    type: 'message',
    from: 'Mike Chen',
    subject: 'Hedge trimming inquiry',
    content: 'Saw your Facebook page. Do you do hedge trimming? I have a large hedge that needs professional attention.',
    timestamp: '2024-12-20T08:15:00Z',
    isRead: true,
    isStarred: true,
    isArchived: false,
    priority: 'medium',
    leadId: '2'
  },
  {
    id: '3',
    platform: 'sms',
    type: 'message',
    from: 'Lisa Rodriguez',
    fromPhone: '+1 (555) 444-5555',
    content: 'Emergency! Large tree fell on my driveway after the storm. Need immediate assistance.',
    timestamp: '2024-12-20T07:45:00Z',
    isRead: false,
    isStarred: false,
    isArchived: false,
    priority: 'high',
    leadId: '3'
  },
  {
    id: '4',
    platform: 'instagram',
    type: 'dm',
    from: 'garden_lover_2024',
    content: 'Love your recent tree work! Can you help with stump grinding?',
    timestamp: '2024-12-19T16:20:00Z',
    isRead: true,
    isStarred: false,
    isArchived: false,
    priority: 'low'
  },
  {
    id: '5',
    platform: 'phone',
    type: 'call',
    from: 'David Thompson',
    fromPhone: '+1 (555) 222-3333',
    content: 'Missed call - voicemail: Interested in tree pruning services for commercial property',
    timestamp: '2024-12-19T14:30:00Z',
    isRead: false,
    isStarred: false,
    isArchived: false,
    priority: 'medium',
    leadId: '4'
  }
];

export default function Opportunities() {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null);

  // In a real app, this would fetch from multiple API endpoints
  const { data: communications = [], isLoading } = useQuery({
    queryKey: ['/api/communications'],
    queryFn: () => Promise.resolve(sampleCommunications),
  });

  const filteredCommunications = useMemo(() => {
    return communications.filter(comm => {
      const matchesPlatform = selectedPlatform === 'all' || comm.platform === selectedPlatform;
      const matchesPriority = selectedPriority === 'all' || comm.priority === selectedPriority;
      const matchesSearch = searchTerm === '' || 
        comm.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comm.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (comm.subject && comm.subject.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesRead = !showUnreadOnly || !comm.isRead;
      
      return matchesPlatform && matchesPriority && matchesSearch && matchesRead && !comm.isArchived;
    });
  }, [communications, selectedPlatform, selectedPriority, searchTerm, showUnreadOnly]);

  const unreadCount = communications.filter(c => !c.isRead && !c.isArchived).length;
  const starredCount = communications.filter(c => c.isStarred && !c.isArchived).length;

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
      <div className="p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
        </div>
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
                <p className="text-2xl font-bold text-gray-900">{communications.length}</p>
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
                <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
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
                <p className="text-2xl font-bold text-gray-900">{starredCount}</p>
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
                <p className="text-sm text-gray-600">Today's Responses</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
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
                        onClick={() => setSelectedCommunication(comm)}
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
                                {formatTimestamp(comm.timestamp)}
                              </span>
                              <div className="flex items-center gap-1">
                                {comm.isStarred && (
                                  <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                )}
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
                      <DropdownMenuItem>
                        <Star className="h-4 w-4 mr-2" />
                        {selectedCommunication.isStarred ? 'Unstar' : 'Star'}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
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
                    {new Date(selectedCommunication.timestamp).toLocaleString()}
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
                    <Button variant="outline" data-testid="button-create-lead">
                      <User className="h-4 w-4 mr-2" />
                      Create Lead
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