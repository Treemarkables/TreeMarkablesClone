import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Mail,
  MessageSquare,
  Camera,
  StickyNote,
  FileText,
  CheckCircle,
  BellRing,
  Settings,
  User,
  DollarSign,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notificationService } from "@/lib/notificationService";

interface NotificationPreferences {
  browserNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  emailActivity: boolean;
  smsActivity: boolean;
  proposalActivity: boolean;
  photoActivity: boolean;
  noteActivity: boolean;
  quoteActivity: boolean;
  jobStatusChanges: boolean;
  leadActivity: boolean;
  paymentActivity: boolean;
  rescheduleRequests: boolean;
}

export default function NotificationPreferences() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    browserNotifications: notificationService.isEnabled(),
    emailNotifications: true,
    smsNotifications: true,
    emailActivity: true,
    smsActivity: true,
    proposalActivity: true,
    photoActivity: true,
    noteActivity: true,
    quoteActivity: true,
    jobStatusChanges: true,
    leadActivity: true,
    paymentActivity: true,
    rescheduleRequests: true,
  });

  // Load preferences from localStorage
  const loadPreferences = () => {
    const stored = localStorage.getItem("notificationPreferences");

    // Get browser permission status
    const permission = notificationService.getPermissionStatus();

    // Default browserNotifications based on permission status (matches NotificationBell logic)
    const defaultBrowserNotifications = permission === "granted";

    // Default preferences
    const defaultPreferences: NotificationPreferences = {
      browserNotifications: defaultBrowserNotifications,
      emailNotifications: true,
      smsNotifications: true,
      emailActivity: true,
      smsActivity: true,
      proposalActivity: true,
      photoActivity: true,
      noteActivity: true,
      quoteActivity: true,
      jobStatusChanges: true,
      leadActivity: true,
      paymentActivity: true,
      rescheduleRequests: true,
    };

    let parsedPreferences = defaultPreferences;

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all keys exist
        parsedPreferences = {
          ...defaultPreferences,
          ...parsed,
        };
      } catch (error) {
        console.error("Error loading notification preferences:", error);
      }
    }

    // Final browser notification state based on permission
    const browserEnabled =
      permission === "denied"
        ? false
        : permission === "granted"
          ? (parsedPreferences.browserNotifications ?? true)
          : false;

    setPreferences({
      ...parsedPreferences,
      browserNotifications: browserEnabled,
    });
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  // Listen for preference changes (same tab via custom event, cross-tab via storage event)
  useEffect(() => {
    const handlePreferenceChange = () => {
      loadPreferences();
    };

    // Same-tab changes
    window.addEventListener(
      "notificationPreferencesChanged",
      handlePreferenceChange,
    );
    // Cross-tab changes
    window.addEventListener("storage", handlePreferenceChange);

    return () => {
      window.removeEventListener(
        "notificationPreferencesChanged",
        handlePreferenceChange,
      );
      window.removeEventListener("storage", handlePreferenceChange);
    };
  }, []);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem("notificationPreferences", JSON.stringify(updated));

      // Notify other components in same tab
      window.dispatchEvent(new Event("notificationPreferencesChanged"));

      return updated;
    });
  };

  const handleEnableBrowserNotifications = async () => {
    const granted = await notificationService.requestPermission();

    if (granted) {
      setPreferences((prev) => {
        const updated = { ...prev, browserNotifications: true };
        localStorage.setItem(
          "notificationPreferences",
          JSON.stringify(updated),
        );

        // Notify other components in same tab
        window.dispatchEvent(new Event("notificationPreferencesChanged"));

        return updated;
      });
    } else {
      toast({
        title: "Permission denied",
        description: "Please enable notifications in your browser settings",
        variant: "destructive",
      });
    }
  };

  const permissionStatus = notificationService.getPermissionStatus();

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Notification Preferences</h1>
        <p className="text-muted-foreground">
          Control which events trigger notifications and how you receive them
        </p>
      </div>

      {/* Browser Notifications */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
              <BellRing className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>Browser Notifications</CardTitle>
              <CardDescription>
                Receive desktop notifications when you're using the app
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label htmlFor="browser-notifications" className="font-medium">
                  Enable desktop notifications
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {permissionStatus === "granted"
                    ? "Browser notifications are enabled"
                    : permissionStatus === "denied"
                      ? "Browser notifications are blocked. Please enable them in your browser settings."
                      : "Click to enable browser notifications"}
                </p>
              </div>
              {permissionStatus === "granted" ? (
                <Switch
                  id="browser-notifications"
                  checked={preferences.browserNotifications}
                  onCheckedChange={() => handleToggle("browserNotifications")}
                  data-testid="switch-browser-notifications"
                />
              ) : (
                <Button
                  onClick={handleEnableBrowserNotifications}
                  size="sm"
                  data-testid="button-enable-browser-notifications"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Enable
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diary Activity Notifications */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>Job Diary Activity</CardTitle>
              <CardDescription>
                These toggles also control what appears in the notification bell.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="email-activity" className="font-medium">
                    Email activity
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when emails are sent to customers
                  </p>
                </div>
              </div>
              <Switch
                id="email-activity"
                checked={preferences.emailActivity}
                onCheckedChange={() => handleToggle("emailActivity")}
                data-testid="switch-email-activity"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="sms-activity" className="font-medium">
                    SMS activity
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when SMS messages are sent to customers
                  </p>
                </div>
              </div>
              <Switch
                id="sms-activity"
                checked={preferences.smsActivity}
                onCheckedChange={() => handleToggle("smsActivity")}
                data-testid="switch-sms-activity"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="proposal-activity" className="font-medium">
                    Proposals sent
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when proposals are sent to customers
                  </p>
                </div>
              </div>
              <Switch
                id="proposal-activity"
                checked={preferences.proposalActivity}
                onCheckedChange={() => handleToggle("proposalActivity")}
                data-testid="switch-proposal-activity"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="photo-activity" className="font-medium">
                    Photos added
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when photos are added to jobs
                  </p>
                </div>
              </div>
              <Switch
                id="photo-activity"
                checked={preferences.photoActivity}
                onCheckedChange={() => handleToggle("photoActivity")}
                data-testid="switch-photo-activity"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StickyNote className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="note-activity" className="font-medium">
                    Notes added
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when notes are added to jobs
                  </p>
                </div>
              </div>
              <Switch
                id="note-activity"
                checked={preferences.noteActivity}
                onCheckedChange={() => handleToggle("noteActivity")}
                data-testid="switch-note-activity"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Status & Business Activity */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>Business Activity</CardTitle>
              <CardDescription>
                Important business events and job status changes
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="quote-activity" className="font-medium">
                    Quote activity
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify about quote acceptance, expiration, and status
                    changes
                  </p>
                </div>
              </div>
              <Switch
                id="quote-activity"
                checked={preferences.quoteActivity}
                onCheckedChange={() => handleToggle("quoteActivity")}
                data-testid="switch-quote-activity"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="job-status" className="font-medium">
                    Job status changes
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when job status changes (scheduled, completed, etc.)
                  </p>
                </div>
              </div>
              <Switch
                id="job-status"
                checked={preferences.jobStatusChanges}
                onCheckedChange={() => handleToggle("jobStatusChanges")}
                data-testid="switch-job-status"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="lead-activity" className="font-medium">
                    Lead activity
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    New leads, new conversations, and stale-lead reminders
                  </p>
                </div>
              </div>
              <Switch
                id="lead-activity"
                checked={preferences.leadActivity}
                onCheckedChange={() => handleToggle("leadActivity")}
                data-testid="switch-lead-activity"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="payment-activity" className="font-medium">
                    Payments &amp; invoicing
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Payments received, invoices paid, and uninvoiced-job reminders
                  </p>
                </div>
              </div>
              <Switch
                id="payment-activity"
                checked={preferences.paymentActivity}
                onCheckedChange={() => handleToggle("paymentActivity")}
                data-testid="switch-payment-activity"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="reschedule-requests" className="font-medium">
                    Scheduling &amp; reminders
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Reschedule requests, schedule proposals, stale quotes, and missing-crew alerts
                  </p>
                </div>
              </div>
              <Switch
                id="reschedule-requests"
                checked={preferences.rescheduleRequests}
                onCheckedChange={() => handleToggle("rescheduleRequests")}
                data-testid="switch-reschedule-requests"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Text */}
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Browser notifications require permission from
          your browser. You can change notification settings at any time. If
          you've blocked notifications, you'll need to enable them in your
          browser settings.
        </p>
      </div>
    </div>
  );
}
