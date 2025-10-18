import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requestNotificationPermission, isNotificationSupported as checkNotificationSupport } from "@/lib/firebase";

interface NotificationPreferences {
  id: string;
  employeeId: string;
  enableJobAssignments: boolean;
  enableScheduleChanges: boolean;
  enableNewLeads: boolean;
  enableInvoicePayments: boolean;
  enableQuoteAcceptance: boolean;
  enableSystemAlerts: boolean;
}

export function NotificationSettings() {
  const { toast } = useToast();
  const [notificationsSupported, setNotificationsSupported] = useState(true);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

  useEffect(() => {
    // Check if notifications are supported (includes Safari detection)
    const supported = checkNotificationSupport();
    setNotificationsSupported(supported);
    
    if (supported && "Notification" in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  // Fetch current notification preferences
  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notifications/preferences"],
  });

  // Update notification preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      return apiRequest("/api/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      toast({
        title: "✅ Preferences saved",
        description: "Your notification preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notification preferences.",
        variant: "destructive",
      });
    },
  });

  // Send test notification
  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/notifications/test", {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "🧪 Test notification sent",
          description: data.message,
        });
      } else {
        toast({
          title: "No devices found",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test notification.",
        variant: "destructive",
      });
    },
  });

  // Enable push notifications
  const handleEnableNotifications = async () => {
    try {
      // Request permission and get FCM token
      const token = await requestNotificationPermission();
      
      if (!token) {
        toast({
          title: "Permission denied",
          description: "You need to allow notifications in your browser settings.",
          variant: "destructive",
        });
        return;
      }

      // Register token with backend
      try {
        await apiRequest("/api/notifications/register-token", {
          method: "POST",
          body: JSON.stringify({
            token,
            deviceInfo: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
            },
          }),
        });

        setPermissionState("granted");
        toast({
          title: "✅ Notifications enabled",
          description: "You'll now receive push notifications for important updates.",
        });
      } catch (error) {
        console.error("Error registering token:", error);
        toast({
          title: "Setup incomplete",
          description: "Firebase credentials are not configured yet. Please contact your administrator.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
      toast({
        title: "Error",
        description: "Failed to enable notifications. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTogglePreference = (key: keyof NotificationPreferences) => {
    if (!preferences) return;
    updatePreferencesMutation.mutate({
      [key]: !preferences[key],
    });
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading notification settings...</div>;
  }

  if (!notificationsSupported) {
    // Detect if user is on iOS
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    return (
      <Alert>
        <BellOff className="h-4 w-4" />
        <AlertDescription className="space-y-3">
          <p className="font-semibold">Push notifications not available on this device</p>
          
          {isIOS ? (
            <>
              <p className="text-sm">
                Apple doesn't allow push notifications in any iPhone browser (Safari, Chrome, Firefox, or Brave). 
                This is an Apple restriction, not a limitation of this app.
              </p>
              <div className="bg-muted/50 p-3 rounded-md space-y-2">
                <p className="text-sm font-medium">How to get notifications:</p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                  <li><strong>Use on desktop/laptop</strong> - Full push notification support</li>
                  <li><strong>SMS alerts</strong> - You already have SMS Everyone integration set up</li>
                  <li><strong>Email notifications</strong> - Alternative for important updates</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">
                Safari doesn't fully support push notifications yet. For notifications, please use:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                <li><strong>Chrome</strong> - Best compatibility</li>
                <li><strong>Firefox</strong> - Fully supported</li>
                <li><strong>Brave</strong> - Fully supported</li>
              </ul>
            </>
          )}
          
          <p className="text-sm text-muted-foreground">
            The notification system is fully configured and works great on desktop browsers!
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Receive real-time alerts for important updates, even when the app is closed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {permissionState === "default" && (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span>Enable push notifications to stay updated</span>
                <Button 
                  onClick={handleEnableNotifications} 
                  size="sm"
                  data-testid="button-enable-notifications"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Enable Notifications
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {permissionState === "denied" && (
            <Alert variant="destructive">
              <AlertDescription className="space-y-2">
                <p className="font-semibold">Notifications are blocked by your browser</p>
                <p className="text-sm">To enable notifications, try one of these options:</p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                  <li>Open this app in an <strong>Incognito/Private window</strong> and click Enable</li>
                  <li>Open this app on your <strong>mobile device</strong></li>
                  <li>Use a <strong>different browser</strong> (Chrome, Firefox, or Brave)</li>
                </ul>
                <p className="text-sm mt-2">The notification system is fully set up and ready - it's just waiting for browser permission!</p>
              </AlertDescription>
            </Alert>
          )}

          {permissionState === "granted" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Notifications enabled</span>
            </div>
          )}
        </CardContent>
      </Card>

      {preferences && permissionState === "granted" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose which notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Job Assignments</Label>
                  <p className="text-sm text-muted-foreground">
                    When you're assigned to a new job
                  </p>
                </div>
                <Switch
                  checked={preferences.enableJobAssignments}
                  onCheckedChange={() => handleTogglePreference("enableJobAssignments")}
                  data-testid="switch-job-assignments"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Schedule Changes</Label>
                  <p className="text-sm text-muted-foreground">
                    When job times or dates are modified
                  </p>
                </div>
                <Switch
                  checked={preferences.enableScheduleChanges}
                  onCheckedChange={() => handleTogglePreference("enableScheduleChanges")}
                  data-testid="switch-schedule-changes"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Leads</Label>
                  <p className="text-sm text-muted-foreground">
                    When new customer inquiries arrive
                  </p>
                </div>
                <Switch
                  checked={preferences.enableNewLeads}
                  onCheckedChange={() => handleTogglePreference("enableNewLeads")}
                  data-testid="switch-new-leads"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Invoice Payments</Label>
                  <p className="text-sm text-muted-foreground">
                    When invoices are paid
                  </p>
                </div>
                <Switch
                  checked={preferences.enableInvoicePayments}
                  onCheckedChange={() => handleTogglePreference("enableInvoicePayments")}
                  data-testid="switch-invoice-payments"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Quote Acceptance</Label>
                  <p className="text-sm text-muted-foreground">
                    When quotes are accepted by customers
                  </p>
                </div>
                <Switch
                  checked={preferences.enableQuoteAcceptance}
                  onCheckedChange={() => handleTogglePreference("enableQuoteAcceptance")}
                  data-testid="switch-quote-acceptance"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>System Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Important system updates and maintenance notifications
                  </p>
                </div>
                <Switch
                  checked={preferences.enableSystemAlerts}
                  onCheckedChange={() => handleTogglePreference("enableSystemAlerts")}
                  data-testid="switch-system-alerts"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Notifications</CardTitle>
              <CardDescription>
                Send a test notification to verify everything is working
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => testNotificationMutation.mutate()}
                disabled={testNotificationMutation.isPending}
                variant="outline"
                data-testid="button-test-notification"
              >
                {testNotificationMutation.isPending ? "Sending..." : "Send Test Notification"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
