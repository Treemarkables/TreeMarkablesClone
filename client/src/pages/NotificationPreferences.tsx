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
  BellOff,
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
  Clock,
  Wrench,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  requestNotificationPermission,
  isNotificationSupported,
  isActualSafari,
  isRunningAsStandalone,
} from "@/lib/firebase";
import {
  useBellPreferences,
  type NotificationType,
} from "@/lib/notificationFilter";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PrefSection {
  cardTitle: string;
  cardDescription: string;
  cardIcon: typeof Bell;
  iconBgClass: string;
  iconColorClass: string;
  toggles: {
    type: NotificationType;
    label: string;
    description: string;
    icon: typeof Bell;
  }[];
}

const PREF_SECTIONS: PrefSection[] = [
  {
    cardTitle: "Job Diary Activity",
    cardDescription: "Diary entries on a job — photos, notes, customer messages.",
    cardIcon: FileText,
    iconBgClass: "bg-blue-100",
    iconColorClass: "text-blue-600",
    toggles: [
      {
        type: "photo_added",
        label: "Photos added",
        description: "When photos are added to a job",
        icon: Camera,
      },
      {
        type: "note_added",
        label: "Notes added",
        description: "When notes are added to a job",
        icon: StickyNote,
      },
      {
        type: "email_reply",
        label: "Email reply from customer",
        description: "When a customer replies to an email about a job",
        icon: Mail,
      },
      {
        type: "email_received",
        label: "New email received",
        description: "When a new email arrives in the shared inbox",
        icon: Mail,
      },
      {
        type: "sms_reply",
        label: "SMS reply from customer",
        description: "When a customer replies via text",
        icon: MessageSquare,
      },
    ],
  },
  {
    cardTitle: "Customer Conversations",
    cardDescription: "New inbound conversation threads.",
    cardIcon: MessageSquare,
    iconBgClass: "bg-purple-100",
    iconColorClass: "text-purple-600",
    toggles: [
      {
        type: "new_conversation",
        label: "New customer conversation",
        description: "When a new conversation thread is created",
        icon: MessageSquare,
      },
    ],
  },
  {
    cardTitle: "Leads",
    cardDescription: "New leads and stale-lead reminders.",
    cardIcon: User,
    iconBgClass: "bg-yellow-100",
    iconColorClass: "text-yellow-700",
    toggles: [
      {
        type: "new_lead",
        label: "New lead",
        description: "When a new lead is created via the contact form or manually",
        icon: User,
      },
      {
        type: "reminder_stale_lead",
        label: "Stale lead reminder",
        description: "When a lead has been idle longer than the threshold",
        icon: Clock,
      },
    ],
  },
  {
    cardTitle: "Quotes & Proposals",
    cardDescription: "Quote and proposal lifecycle events.",
    cardIcon: FileText,
    iconBgClass: "bg-green-100",
    iconColorClass: "text-green-700",
    toggles: [
      {
        type: "quote_sent",
        label: "Quote sent",
        description: "When a quote email is sent to a customer",
        icon: FileText,
      },
      {
        type: "quote_accepted",
        label: "Quote accepted",
        description: "When a customer accepts a quote",
        icon: CheckCircle,
      },
      {
        type: "proposal_sent",
        label: "Proposal sent",
        description: "When a proposal email is sent to a customer",
        icon: FileText,
      },
      {
        type: "proposal_accepted",
        label: "Proposal accepted",
        description: "When a customer accepts a proposal",
        icon: CheckCircle,
      },
      {
        type: "reminder_stale_quote",
        label: "Stale quote reminder",
        description: "When a quote has been out unanswered",
        icon: Clock,
      },
    ],
  },
  {
    cardTitle: "Jobs",
    cardDescription: "Job status and lifecycle events.",
    cardIcon: Wrench,
    iconBgClass: "bg-orange-100",
    iconColorClass: "text-orange-600",
    toggles: [
      {
        type: "job_status_change",
        label: "Job status changed",
        description: "When a job moves between statuses (lead → quote → scheduled, etc.)",
        icon: TrendingUp,
      },
      {
        type: "job_scheduled",
        label: "Job scheduled",
        description: "When a job is given a scheduled date",
        icon: Calendar,
      },
      {
        type: "job_completed",
        label: "Job completed",
        description: "When a job is marked complete",
        icon: CheckCircle,
      },
    ],
  },
  {
    cardTitle: "Payments & Invoicing",
    cardDescription: "Invoice payments and reminders.",
    cardIcon: DollarSign,
    iconBgClass: "bg-emerald-100",
    iconColorClass: "text-emerald-700",
    toggles: [
      {
        type: "invoice_payment",
        label: "Invoice payment received",
        description: "When a customer pays an invoice",
        icon: DollarSign,
      },
      {
        type: "reminder_uninvoiced",
        label: "Uninvoiced job reminder",
        description: "When a completed job has not yet been invoiced",
        icon: Clock,
      },
    ],
  },
  {
    cardTitle: "Scheduling & Crew",
    cardDescription: "Reschedule requests, schedule proposals, and crew alerts.",
    cardIcon: Calendar,
    iconBgClass: "bg-indigo-100",
    iconColorClass: "text-indigo-700",
    toggles: [
      {
        type: "reschedule_request",
        label: "Reschedule request",
        description: "When a customer asks to reschedule",
        icon: Calendar,
      },
      {
        type: "schedule_proposal_ready",
        label: "Schedule proposal ready",
        description: "When an AI-suggested schedule is ready for review",
        icon: Settings,
      },
      {
        type: "reminder_no_crew",
        label: "No crew assigned",
        description: "When a scheduled job has no crew assigned",
        icon: Clock,
      },
    ],
  },
];

interface DeviceBrowserPrefs {
  browserNotifications: boolean;
}

export default function NotificationPreferences() {
  const { toast } = useToast();
  const { prefs: bellPrefs, isLoading, setPref } = useBellPreferences();

  // Browser permission/visibility is per-device (OS permission state), so it
  // stays in localStorage rather than on the server.
  const [deviceBrowserPrefs, setDeviceBrowserPrefs] = useState<DeviceBrowserPrefs>(
    () => ({
      browserNotifications:
        typeof Notification !== "undefined" &&
        Notification.permission === "granted",
    }),
  );
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    () =>
      typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  const [pushSupported, setPushSupported] = useState(true);
  const [enabling, setEnabling] = useState(false);

  const loadDeviceBrowserPrefs = () => {
    const permission =
      typeof Notification !== "undefined" ? Notification.permission : "denied";
    setPermissionStatus(permission);
    const stored = localStorage.getItem("notificationPreferences");
    let storedBrowser: boolean | undefined;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (typeof parsed?.browserNotifications === "boolean") {
          storedBrowser = parsed.browserNotifications;
        }
      } catch {
        // ignore
      }
    }
    const browserEnabled =
      permission === "denied"
        ? false
        : permission === "granted"
          ? (storedBrowser ?? true)
          : false;
    setDeviceBrowserPrefs({ browserNotifications: browserEnabled });
  };

  useEffect(() => {
    setPushSupported(isNotificationSupported());
    loadDeviceBrowserPrefs();
  }, []);

  useEffect(() => {
    const handler = () => loadDeviceBrowserPrefs();
    window.addEventListener("notificationPreferencesChanged", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("notificationPreferencesChanged", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setLocalBrowserNotifications = (value: boolean) => {
    const stored = localStorage.getItem("notificationPreferences");
    let parsed: Record<string, unknown> = {};
    if (stored) {
      try {
        parsed = JSON.parse(stored) || {};
      } catch {
        parsed = {};
      }
    }
    parsed.browserNotifications = value;
    localStorage.setItem("notificationPreferences", JSON.stringify(parsed));
    window.dispatchEvent(new Event("notificationPreferencesChanged"));
    setDeviceBrowserPrefs((p) => ({ ...p, browserNotifications: value }));
  };

  const handleEnableBrowserNotifications = async () => {
    setEnabling(true);
    try {
      const token = await requestNotificationPermission();
      if (!token) {
        setPermissionStatus(
          typeof Notification !== "undefined"
            ? Notification.permission
            : "denied",
        );
        toast({
          title: "Permission denied",
          description: "Please enable notifications in your browser settings",
          variant: "destructive",
        });
        return;
      }

      const res = await apiRequest("POST", "/api/notifications/register-token", {
        token,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
      });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;
      if (!body?.success) {
        toast({
          title: "Setup incomplete",
          description: body?.message ?? "Failed to register this device",
          variant: "destructive",
        });
        return;
      }

      setPermissionStatus("granted");
      setLocalBrowserNotifications(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to enable notifications";
      toast({
        title: "Couldn't enable notifications",
        description: message,
        variant: "destructive",
      });
    } finally {
      setEnabling(false);
    }
  };

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/test");
      return (await res.json()) as {
        success: boolean;
        message?: string;
        devicesNotified?: number;
      };
    },
    onSuccess: (data) => {
      if (!data.success) {
        toast({
          title: "No devices registered",
          description: data.message ?? "Enable notifications first",
          variant: "destructive",
        });
      }
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to send test notification";
      toast({
        title: "Test failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const safariInTab = isActualSafari() && !isRunningAsStandalone();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Browser Notifications — per-device, OS permission + FCM token */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
              <BellRing className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>Browser Notifications</CardTitle>
              <CardDescription>
                OS-level desktop / mobile push when notifications fire. This
                setting is per-device.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!pushSupported ? (
            safariInTab ? (
              <Alert>
                <Bell className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="font-semibold">
                    Install to home screen to enable push
                  </p>
                  <p className="text-sm">
                    iOS Safari needs this app installed to the home screen
                    before push notifications work (iOS 16.4+). Tap the Share
                    button, then "Add to Home Screen", then open the app from
                    the new icon and come back here.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <BellOff className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="font-semibold">
                    Push not supported in this browser
                  </p>
                  <p className="text-sm">
                    Try Chrome, Firefox, or Brave on desktop, or install this
                    app to your iOS home screen.
                  </p>
                </AlertDescription>
              </Alert>
            )
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="browser-notifications" className="font-medium">
                    Enable desktop notifications
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {permissionStatus === "granted"
                      ? "Browser notifications are enabled on this device"
                      : permissionStatus === "denied"
                        ? "Browser notifications are blocked. Enable them in your browser settings to receive push alerts."
                        : "Click to enable browser notifications on this device"}
                  </p>
                </div>
                {permissionStatus === "granted" ? (
                  <Switch
                    id="browser-notifications"
                    checked={deviceBrowserPrefs.browserNotifications}
                    onCheckedChange={(value) =>
                      setLocalBrowserNotifications(value)
                    }
                    data-testid="switch-browser-notifications"
                  />
                ) : (
                  <Button
                    onClick={handleEnableBrowserNotifications}
                    size="sm"
                    disabled={enabling || permissionStatus === "denied"}
                    data-testid="button-enable-browser-notifications"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    {enabling ? "Enabling…" : "Enable"}
                  </Button>
                )}
              </div>

              {permissionStatus === "granted" && (
                <div className="pt-2 border-t border-border flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="font-medium">Send test notification</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Confirm push delivery to this device.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testMutation.mutate()}
                    disabled={testMutation.isPending}
                    data-testid="button-test-notification"
                  >
                    {testMutation.isPending ? "Sending…" : "Send test"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bell preference sections — synced across devices via server */}
      {PREF_SECTIONS.map((section) => (
        <Card key={section.cardTitle} className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${section.iconBgClass} ${section.iconColorClass}`}
              >
                <section.cardIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle>{section.cardTitle}</CardTitle>
                <CardDescription>{section.cardDescription}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {section.toggles.map((toggle, index) => {
                const checked = bellPrefs[toggle.type] !== false;
                const Icon = toggle.icon;
                return (
                  <div key={toggle.type}>
                    {index > 0 && <Separator className="mb-4" />}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label
                            htmlFor={`pref-${toggle.type}`}
                            className="font-medium"
                          >
                            {toggle.label}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {toggle.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id={`pref-${toggle.type}`}
                        checked={checked}
                        disabled={isLoading}
                        onCheckedChange={(value) => setPref(toggle.type, value)}
                        data-testid={`switch-${toggle.type}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Heads up:</strong> Notification preferences are now synced
          across your devices — toggle once on any device and it applies
          everywhere. Browser notifications, above, are still per-device
          because they depend on each browser's OS permission.
        </p>
      </div>
    </div>
  );
}
