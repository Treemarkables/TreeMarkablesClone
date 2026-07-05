import { useState, useEffect } from "react";
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
  Settings,
  Mail,
  MessageSquare,
  Camera,
  StickyNote,
  BellRing,
} from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { notificationService } from "@/lib/notificationService";
import { useToast } from "@/hooks/use-toast";
import {
  useBellPreferences,
  isNotificationVisible,
} from "@/lib/notificationFilter";

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
  proposalId?: string;
  expiresAt?: string | null;
  leadName?: string;
  customerName?: string;
  jobTitle?: string;
  quoteNumber?: string;
  metadata?: any;
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
  urgent: "bg-red-600 text-white border-red-700",
  high: "bg-orange-600 text-white border-orange-700",
  medium: "bg-blue-600 text-white border-blue-700",
  low: "bg-gray-600 text-white border-gray-700",
};

const getTypeIcon = (type: string) => {
  const iconMap = {
    new_lead: User,
    new_conversation: MessageSquare,
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
    email_reply: Mail,
    sms_reply: MessageSquare,
    proposal_sent: FileText,
    photo_added: Camera,
    note_added: StickyNote,
  };
  const IconComponent = iconMap[type as keyof typeof iconMap] || Bell;
  return <IconComponent className="h-4 w-4" />;
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check both browser permission AND user preference from localStorage
  const getUserPreference = () => {
    const permission = notificationService.getPermissionStatus();

    // If permission is denied, notifications are disabled regardless of preference
    if (permission === "denied") {
      return false;
    }

    // If permission not granted yet, notifications are disabled
    if (permission !== "granted") {
      return false;
    }

    // Permission is granted - check user preference
    const stored = localStorage.getItem("notificationPreferences");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.browserNotifications ?? true; // Default to enabled if permission granted
      } catch {
        return true; // Default to enabled if permission granted
      }
    }
    return true; // Default to enabled if permission granted
  };

  const [pushEnabled, setPushEnabled] = useState(getUserPreference());
  const [lastNotificationCount, setLastNotificationCount] = useState(0);
  const { prefs } = useBellPreferences();

  // browserNotifications is still localStorage-driven (per-device OS permission),
  // so keep listening for cross-tab changes to keep pushEnabled in sync.
  useEffect(() => {
    const refresh = () => {
      setPushEnabled(getUserPreference());
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("notificationPreferencesChanged", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("notificationPreferencesChanged", refresh);
    };
  }, []);

  // Fetch notification summary for badge count. Poll every 20s (was 60s, which
  // left the bell looking dead for up to a minute after a reply arrived) and
  // refetch the moment the window regains focus / the tab becomes visible — so
  // returning to the app lights the bell up immediately instead of on the next
  // tick. Keep polling while the tab is in the background so a backgrounded PWA
  // still surfaces the count on return.
  const { data: summaryData } = useQuery({
    queryKey: ["/api/notifications/summary"],
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
  });

  // Always fetch the list (same cadence as the summary) so the badge count
  // can be filtered client-side against the user's bell preferences.
  const { data: notificationsData, isLoading: isLoadingNotifications } =
    useQuery({
      queryKey: ["/api/notifications"],
      refetchInterval: 20000,
      refetchOnWindowFocus: true,
    });

  // Check for new notifications and show browser notification
  useEffect(() => {
    if (!summaryData) return;

    const summary: NotificationSummary = (summaryData as any)?.data || {
      total: 0,
      unread: 0,
      byType: {},
      byPriority: {},
      recent: [],
    };

    // If we have new unread notifications and browser notifications are enabled
    // Show notification whenever unread count increases (including 0→1)
    if (pushEnabled && summary.unread > lastNotificationCount) {
      const newCount = summary.unread - lastNotificationCount;

      // Fetch specific notification by ID to get actionUrl
      if (summary.recent && summary.recent.length > 0) {
        const latestNotificationSummary = summary.recent[0];

        // Skip push if this notification type is muted in the bell filter
        if (!isNotificationVisible(latestNotificationSummary.type, prefs)) {
          if (summary.unread !== lastNotificationCount) {
            setLastNotificationCount(summary.unread);
          }
          return;
        }

        // Fetch the specific notification by ID using queryClient with a fetcher
        queryClient
          .fetchQuery({
            queryKey: ["/api/notifications", latestNotificationSummary.id],
            queryFn: async () => {
              const response = await fetch(
                `/api/notifications/${latestNotificationSummary.id}`,
              );
              if (!response.ok) {
                throw new Error("Failed to fetch notification");
              }
              return response.json();
            },
          })
          .then((data: any) => {
            const latestNotification: NotificationWithDetails | undefined =
              data?.data;

            // Build the URL based on notification details
            let targetUrl = "/dispatch"; // Default fallback

            if (latestNotification) {
              const diaryTypes = [
                "email_reply",
                "sms_reply",
                "proposal_sent",
                "photo_added",
                "note_added",
                "holding_message_pending",
              ];
              // Diary-activity notifications always open the diary tab — even
              // when an older row carries a stale actionUrl (e.g. '/dispatch?
              // job=X' with no '&tab=diary'). Add '&entry=' when we know the
              // diary entry so the message is scrolled to and highlighted.
              if (
                diaryTypes.includes(latestNotification.type) &&
                latestNotification.jobId
              ) {
                targetUrl = `/dispatch?job=${latestNotification.jobId}&tab=diary${latestNotification.diaryEntryId ? `&entry=${latestNotification.diaryEntryId}` : ""}`;
              } else if (latestNotification.actionUrl) {
                targetUrl = latestNotification.actionUrl;
              } else if (latestNotification.jobId) {
                targetUrl = `/dispatch?job=${latestNotification.jobId}`;
              } else if (latestNotification.proposalId) {
                targetUrl = `/proposal/${latestNotification.proposalId}?preview=true`;
              } else if (latestNotification.quoteId) {
                targetUrl = `/quote/${latestNotification.quoteId}`;
              } else if (latestNotification.leadId) {
                targetUrl = `/opportunities?lead=${latestNotification.leadId}`;
              } else if (latestNotification.customerId) {
                targetUrl = `/clients?customer=${latestNotification.customerId}`;
              }
            }

            // Always show notification with title and URL (even if fallback)
            notificationService.showNotification(
              latestNotificationSummary.title,
              {
                body: `${newCount} new notification${newCount > 1 ? "s" : ""}`,
                tag: "diary-activity",
                data: { url: targetUrl },
                requireInteraction: false,
              },
            );
          })
          .catch((err) => {
            console.error("Failed to fetch notification details:", err);
            // Fallback: still show notification with basic info and default URL
            notificationService.showNotification(
              latestNotificationSummary.title,
              {
                body: `${newCount} new notification${newCount > 1 ? "s" : ""}`,
                tag: "diary-activity",
                data: { url: "/dispatch" },
                requireInteraction: false,
              },
            );
          });
      }
    }

    // Update last count
    if (summary.unread !== lastNotificationCount) {
      setLastNotificationCount(summary.unread);
    }
  }, [summaryData, pushEnabled, lastNotificationCount, queryClient, prefs]);

  // Handle browser notification permission request
  const handleEnablePushNotifications = async () => {
    const granted = await notificationService.requestPermission();

    if (granted) {
      // Save preference to localStorage - merge with existing preferences
      const stored = localStorage.getItem("notificationPreferences");
      const existingPreferences = stored
        ? JSON.parse(stored)
        : {
            emailNotifications: true,
            smsNotifications: true,
            emailActivity: true,
            smsActivity: true,
            proposalActivity: true,
            photoActivity: true,
            noteActivity: true,
            quoteActivity: true,
            jobStatusChanges: true,
          };

      const updatedPreferences = {
        ...existingPreferences,
        browserNotifications: true,
      };

      localStorage.setItem(
        "notificationPreferences",
        JSON.stringify(updatedPreferences),
      );

      // Update local state
      setPushEnabled(true);

      // Notify other components in same tab
      window.dispatchEvent(new Event("notificationPreferencesChanged"));
    } else {
      // Save denied state to localStorage
      const stored = localStorage.getItem("notificationPreferences");
      const existingPreferences = stored ? JSON.parse(stored) : {};
      const updatedPreferences = {
        ...existingPreferences,
        browserNotifications: false,
      };
      localStorage.setItem(
        "notificationPreferences",
        JSON.stringify(updatedPreferences),
      );

      // Notify other components
      window.dispatchEvent(new Event("notificationPreferencesChanged"));

      toast({
        title: "Permission denied",
        description: "Please enable notifications in your browser settings",
        variant: "destructive",
      });
    }
  };

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/notifications/summary"],
      });
    },
  });

  // Mark all VISIBLE notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) => apiRequest("PATCH", `/api/notifications/${id}/read`)),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/notifications/summary"],
      });
    },
  });

  // Delete all VISIBLE notifications
  const deleteAllNotificationsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) => apiRequest("DELETE", `/api/notifications/${id}`)),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/notifications/summary"],
      });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/notifications/summary"],
      });
    },
  });

  const summary: NotificationSummary = (summaryData as any)?.data || {
    total: 0,
    unread: 0,
    byType: {},
    byPriority: {},
    recent: [],
  };

  const rawNotifications: NotificationWithDetails[] =
    (notificationsData as any)?.data || [];
  const notifications = rawNotifications.filter((n) =>
    isNotificationVisible(n.type, prefs),
  );

  const visibleUnread = notifications.filter((n) => !n.isRead).length;
  const visibleTotal = notifications.length;

  const handleNotificationClick = (notification: NotificationWithDetails) => {
    console.log("🔔 Notification clicked:", {
      id: notification.id,
      type: notification.type,
      proposalId: notification.proposalId,
      jobId: notification.jobId,
      quoteId: notification.quoteId,
      leadId: notification.leadId,
      customerId: notification.customerId,
      actionUrl: notification.actionUrl,
    });

    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    // Close popover first to ensure clean navigation
    setIsOpen(false);

    // Diary-activity notifications (email/SMS replies, photos, notes,
    // proposals, holding messages) always belong on the job's diary tab. Many
    // older rows in the DB carry a stale actionUrl from before the in-diary
    // deep-link existed — e.g. '/dispatch?job=X' with no '&tab=diary', or
    // '/communications?tab=pending'. Override those here so legacy
    // notifications also land on the diary (and scroll to the entry when we
    // know it) without needing a DB backfill. The diary-URL builder below
    // adds '&entry=' when diaryEntryId is present.
    const diaryTypes = [
      "email_reply",
      "sms_reply",
      "proposal_sent",
      "photo_added",
      "note_added",
      "holding_message_pending",
    ];
    const overrideToJobDiary =
      !!notification.jobId && diaryTypes.includes(notification.type);

    // Navigate to action URL if provided and it's an internal route
    if (
      !overrideToJobDiary &&
      notification.actionUrl &&
      notification.actionUrl.startsWith("/")
    ) {
      console.log("🔀 Navigating via actionUrl:", notification.actionUrl);

      // Use setTimeout to ensure popover closes before navigation
      setTimeout(() => {
        setLocation(notification.actionUrl!);

        // Dispatch custom event to notify components of URL change
        window.dispatchEvent(
          new CustomEvent("notification-navigation", {
            detail: { url: notification.actionUrl },
          }),
        );
      }, 50);
      return;
    }

    // Check metadata for conversationId (for older notifications or alternative storage)
    if (notification.metadata?.conversationId) {
      const url = `/conversation/${notification.metadata.conversationId}`;
      console.log("🔀 Navigating via conversationId:", url);
      setLocation(url);

      // Dispatch custom event to notify components of URL change
      window.dispatchEvent(
        new CustomEvent("notification-navigation", {
          detail: { url },
        }),
      );

      setIsOpen(false);
      return;
    }

    // PRIORITY: If notification has a jobId, always open the job card modal
    // This ensures all job-related notifications open the job card, regardless of type
    if (notification.jobId) {
      // Diary-related notifications open the diary tab (see diaryTypes above).
      if (diaryTypes.includes(notification.type)) {
        const url = `/dispatch?job=${notification.jobId}&tab=diary${notification.diaryEntryId ? `&entry=${notification.diaryEntryId}` : ""}`;
        console.log("🔀 Navigating to job card with diary tab:", url);
        setLocation(url);

        // Dispatch custom event to notify DispatchBoard
        window.dispatchEvent(
          new CustomEvent("notification-navigation", {
            detail: { url },
          }),
        );

        setIsOpen(false);
        return;
      }

      // Default: open job card without specific tab
      const url = `/dispatch?job=${notification.jobId}`;
      console.log("🔀 Navigating to job card:", url);
      setLocation(url);

      // Dispatch custom event to notify DispatchBoard
      window.dispatchEvent(
        new CustomEvent("notification-navigation", {
          detail: { url },
        }),
      );

      setIsOpen(false);
      return;
    }

    // Handle proposal notifications (only if no jobId)
    if (notification.proposalId) {
      const url = `/proposal/${notification.proposalId}?preview=true`;
      console.log("🔀 Navigating to proposal:", url);
      setLocation(url);
      setIsOpen(false);
      return;
    }

    // Handle quote notifications (only if no jobId)
    if (notification.quoteId) {
      const url = `/quote/${notification.quoteId}`;
      console.log("🔀 Navigating to quote:", url);
      setLocation(url);
      setIsOpen(false);
      return;
    }

    // Handle lead notifications
    if (notification.leadId) {
      const url = `/opportunities?lead=${notification.leadId}`;
      console.log("🔀 Navigating to lead:", url);
      setLocation(url);
      setIsOpen(false);
      return;
    }

    // Handle customer notifications
    if (notification.customerId) {
      const url = `/clients?customer=${notification.customerId}`;
      console.log("🔀 Navigating to customer:", url);
      setLocation(url);
      setIsOpen(false);
      return;
    }

    // If no navigation target, just close
    console.log("⚠️ No navigation target found for notification");
    setIsOpen(false);
  };

  const getPriorityBadgeClass = (priority: string) => {
    return (
      priorityColors[priority as keyof typeof priorityColors] ||
      priorityColors.medium
    );
  };

  const getRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Unknown time";
    }
  };

  const getEntityName = (notification: NotificationWithDetails) => {
    if (notification.leadName) return notification.leadName;
    if (notification.customerName) return notification.customerName;
    if (notification.jobTitle) return notification.jobTitle;
    if (notification.quoteNumber) return `Quote #${notification.quoteNumber}`;
    return "";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative [&_svg]:!size-8"
          data-testid="button-notifications"
          aria-label="Notifications"
        >
          <Bell
            className={`fill-yellow-500 stroke-yellow-600 stroke-[1.5] ${visibleUnread > 0 ? "animate-pulse" : ""}`}
          />
          {visibleUnread > 0 && (
            <div className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white text-xs flex items-center justify-center shadow-lg border-2 border-white">
              <span
                className="text-[11px] font-bold"
                data-testid="text-notification-count"
              >
                {visibleUnread > 99 ? "99+" : visibleUnread}
              </span>
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0"
        align="end"
        data-testid="dropdown-notifications"
      >
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-lg font-semibold text-foreground">
                Notifications
              </CardTitle>
              <div className="flex items-center gap-2">
                {!pushEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnablePushNotifications}
                    className="text-xs"
                    data-testid="button-enable-push"
                  >
                    <BellRing className="h-3 w-3 mr-1" />
                    Enable Alerts
                  </Button>
                )}
                {visibleUnread > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      markAllAsReadMutation.mutate(
                        notifications.filter((n) => !n.isRead).map((n) => n.id),
                      )
                    }
                    disabled={markAllAsReadMutation.isPending}
                    className="text-xs"
                    data-testid="button-mark-all-read"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      deleteAllNotificationsMutation.mutate(
                        notifications.map((n) => n.id),
                      )
                    }
                    disabled={deleteAllNotificationsMutation.isPending}
                    className="text-xs text-destructive hover:text-destructive"
                    data-testid="button-delete-all-notifications"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>
            </div>
            {visibleTotal > 0 && (
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span data-testid="text-total-notifications">
                  {visibleTotal} total
                </span>
                {visibleUnread > 0 && (
                  <span data-testid="text-unread-notifications">
                    • {visibleUnread} unread
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
                  <p className="text-xs mt-1">
                    You'll see updates about leads, jobs, and quotes here
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                        !notification.isRead
                          ? "bg-gradient-to-r from-blue-50/50 via-purple-50/30 to-pink-50/50 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-pink-950/20 border-l-2 border-l-blue-500"
                          : "hover:bg-muted/50"
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
                              <p
                                className="font-medium text-sm text-foreground"
                                data-testid={`notification-title-${notification.id}`}
                              >
                                {notification.title}
                              </p>
                              <p
                                className="text-sm text-muted-foreground mt-1 line-clamp-2"
                                data-testid={`notification-message-${notification.id}`}
                              >
                                {notification.message}
                              </p>
                              {getEntityName(notification) && (
                                <p
                                  className="text-xs text-muted-foreground mt-1 font-medium"
                                  data-testid={`notification-entity-${notification.id}`}
                                >
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
                                        markAsReadMutation.mutate(
                                          notification.id,
                                        );
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
                                      deleteNotificationMutation.mutate(
                                        notification.id,
                                      );
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
                            <span
                              className="text-xs text-muted-foreground"
                              data-testid={`notification-time-${notification.id}`}
                            >
                              {getRelativeTime(notification.createdAt)}
                            </span>
                            {!notification.isRead && (
                              <div
                                className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"
                                data-testid={`notification-unread-indicator-${notification.id}`}
                              />
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
                  Showing {notifications.length} of {visibleTotal}{" "}
                  notifications
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
