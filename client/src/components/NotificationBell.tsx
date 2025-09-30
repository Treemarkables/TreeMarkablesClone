import { useState, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  Trash2, 
  MoreVertical, 
  User, 
  TrendingUp, 
  Wrench, 
  FileText, 
  CheckCircle, 
  Clock, 
  Phone, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  Settings 
} from 'lucide-react';
import { useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface NotificationWithDetails {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  actionUrl?: string;
  userId?: string;
  leadId?: string;
  customerId?: string;
  jobId?: string;
  quoteId?: string;
  expiresAt?: string | null;
  leadName?: string;
  customerName?: string;
  jobTitle?: string;
  quoteNumber?: string;
}

interface NotificationSummary {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  recent: {
    id: string;
    title: string;
    type: string;
    priority: string;
    createdAt: string;
  }[];
}

const priorityColors = {
  urgent: 'bg-red-600 text-white border-red-700',
  high: 'bg-orange-600 text-white border-orange-700',
  medium: 'bg-blue-600 text-white border-blue-700',
  low: 'bg-gray-600 text-white border-gray-700',
};

const getTypeIcon = (type: string) => {
  const iconMap = {
    new_lead: User,
    lead_status_change: TrendingUp,
    job_status_change: Wrench,
    quote_sent: FileText,
    quote_accepted: CheckCircle,
    quote_expired: Clock,
    follow_up_due: Phone,
    follow_up_overdue: AlertCircle,
    job_scheduled: Calendar,
    job_completed: CheckCircle,
    payment_received: DollarSign,
    system_alert: Settings,
  };
  const IconComponent = iconMap[type as keyof typeof iconMap] || Bell;
  return <IconComponent className="h-4 w-4" />;
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Fetch notification summary for badge count
  const { data: summaryData } = useQuery({
    queryKey: ['/api/notifications/summary'],
    refetchInterval: 60000, // Poll every 60 seconds
  });

  // Fetch all notifications when dropdown is opened
  const { data: notificationsData, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ['/api/notifications'],
    enabled: isOpen,
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('PATCH', `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/summary'] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', '/api/notifications/read-all', { userId: undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/summary'] });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/summary'] });
    },
  });

  const summary: NotificationSummary = (summaryData as any)?.data || { 
    total: 0, 
    unread: 0, 
    byType: {}, 
    byPriority: {}, 
    recent: [] 
  };
  
  const notifications: NotificationWithDetails[] = (notificationsData as any)?.data || [];

  const handleNotificationClick = (notification: NotificationWithDetails) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    // Navigate to action URL if provided and it's an internal route
    if (notification.actionUrl && notification.actionUrl.startsWith('/')) {
      setLocation(notification.actionUrl);
      setIsOpen(false);
    } else {
      setIsOpen(false);
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    return priorityColors[priority as keyof typeof priorityColors] || priorityColors.medium;
  };


  const getRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Unknown time';
    }
  };

  const getEntityName = (notification: NotificationWithDetails) => {
    if (notification.leadName) return notification.leadName;
    if (notification.customerName) return notification.customerName;
    if (notification.jobTitle) return notification.jobTitle;
    if (notification.quoteNumber) return `Quote #${notification.quoteNumber}`;
    return '';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {summary.unread > 0 && (
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center animate-pulse">
              <span className="text-[10px] font-bold" data-testid="text-notification-count">
                {summary.unread > 99 ? '99+' : summary.unread}
              </span>
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" data-testid="dropdown-notifications">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold bg-gradient-to-r from-red-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                Notifications
              </CardTitle>
              {summary.unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  className="text-xs"
                  data-testid="button-mark-all-read"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
            {summary.total > 0 && (
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span data-testid="text-total-notifications">
                  {summary.total} total
                </span>
                {summary.unread > 0 && (
                  <span data-testid="text-unread-notifications">
                    • {summary.unread} unread
                  </span>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {isLoadingNotifications ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                  <p className="text-xs mt-1">You'll see updates about leads, jobs, and quotes here</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                        !notification.isRead 
                          ? 'bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-pink-50/50 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-pink-950/20 border-l-2 border-l-blue-500' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-item-${notification.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 via-red-500 to-pink-500 flex items-center justify-center text-white">
                            {getTypeIcon(notification.type)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm text-foreground" data-testid={`notification-title-${notification.id}`}>
                                {notification.title}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`notification-message-${notification.id}`}>
                                {notification.message}
                              </p>
                              {getEntityName(notification) && (
                                <p className="text-xs text-muted-foreground mt-1 font-medium" data-testid={`notification-entity-${notification.id}`}>
                                  {getEntityName(notification)}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge 
                                className={`text-xs px-2 py-0.5 ${getPriorityBadgeClass(notification.priority)}`}
                                data-testid={`notification-priority-${notification.id}`}
                              >
                                {notification.priority}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`button-notification-menu-${notification.id}`}
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {!notification.isRead && (
                                    <DropdownMenuItem
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markAsReadMutation.mutate(notification.id);
                                      }}
                                      data-testid={`button-mark-read-${notification.id}`}
                                    >
                                      <Check className="h-3 w-3 mr-2" />
                                      Mark as read
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNotificationMutation.mutate(notification.id);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                    data-testid={`button-delete-${notification.id}`}
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground" data-testid={`notification-time-${notification.id}`}>
                              {getRelativeTime(notification.createdAt)}
                            </span>
                            {!notification.isRead && (
                              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" data-testid={`notification-unread-indicator-${notification.id}`} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            {notifications.length > 0 && (
              <div className="p-3 border-t bg-muted/30">
                <div className="text-xs text-muted-foreground text-center">
                  Showing {notifications.length} of {summary.total} notifications
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}