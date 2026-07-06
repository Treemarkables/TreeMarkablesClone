import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  Globe,
  Shield,
  Zap,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plus,
  RefreshCw,
  Key,
  Link,
  Unlink,
  Download,
  Loader2,
  Users,
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  category:
    | "email"
    | "messaging"
    | "calendar"
    | "crm"
    | "marketing"
    | "analytics"
    | "accounting";
  icon: any;
  status: "connected" | "disconnected" | "error" | "available";
  isEnabled: boolean;
  lastSync?: string;
  connectionCount?: number;
  features: string[];
  setupRequired?: boolean;
  tenantName?: string;
}

const availableIntegrations: Integration[] = [
  {
    id: "outlook",
    name: "Microsoft Outlook",
    description:
      "Connect your Outlook email and calendar for seamless communication management",
    category: "email",
    icon: Mail,
    status: "available",
    isEnabled: false,
    features: [
      "Email sync",
      "Calendar integration",
      "Contact management",
      "Meeting scheduling",
    ],
    setupRequired: true,
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Integrate with Gmail for comprehensive email management",
    category: "email",
    icon: Mail,
    status: "available",
    isEnabled: false,
    features: [
      "Email sync",
      "Label management",
      "Search integration",
      "Attachment handling",
    ],
    setupRequired: true,
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Email marketing automation and audience management platform",
    category: "marketing",
    icon: Zap,
    status: "available",
    isEnabled: false,
    features: [
      "Email campaigns",
      "Audience segmentation",
      "Automation workflows",
      "Analytics & reporting",
      "Landing pages",
    ],
    setupRequired: true,
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Send and receive SMS messages from customers",
    category: "messaging",
    icon: MessageSquare,
    status: "available",
    isEnabled: false,
    features: [
      "SMS messaging",
      "Phone verification",
      "Bulk messaging",
      "Message history",
    ],
    setupRequired: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Connect WhatsApp Business for customer communication",
    category: "messaging",
    icon: MessageSquare,
    status: "available",
    isEnabled: false,
    features: [
      "Message sync",
      "Media sharing",
      "Business profiles",
      "Quick replies",
    ],
    setupRequired: true,
  },
  {
    id: "facebook",
    name: "Facebook Pages",
    description: "Manage Facebook page messages and interactions",
    category: "messaging",
    icon: MessageSquare,
    status: "available",
    isEnabled: false,
    features: [
      "Page messages",
      "Comment management",
      "Review monitoring",
      "Post scheduling",
    ],
    setupRequired: true,
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sync appointments and scheduling with Google Calendar",
    category: "calendar",
    icon: Calendar,
    status: "available",
    isEnabled: false,
    features: [
      "Calendar sync",
      "Appointment booking",
      "Availability management",
      "Reminders",
    ],
    setupRequired: true,
  },
  {
    id: "xero",
    name: "Xero Accounting",
    description:
      "Sync invoices and financial data with Xero accounting software",
    category: "accounting",
    icon: Download,
    status: "available",
    isEnabled: false,
    features: [
      "Invoice sync",
      "Contact management",
      "GST handling",
      "Financial reporting",
    ],
    setupRequired: false,
  },
];

export default function Integrations() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [location] = useLocation();
  const { toast } = useToast();

  // Mailchimp configuration state
  const [showMailchimpDialog, setShowMailchimpDialog] = useState(false);
  const [mailchimpApiKey, setMailchimpApiKey] = useState("");
  const [mailchimpAudienceId, setMailchimpAudienceId] = useState("");
  const [mailchimpAudiences, setMailchimpAudiences] = useState<
    { id: string; name: string; memberCount: number }[]
  >([]);
  const [isSyncingMailchimp, setIsSyncingMailchimp] = useState(false);

  // Check for Xero / Google Calendar connection success/error from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("xero_connected") === "true") {
      window.history.replaceState({}, "", "/integrations");
    } else if (params.get("error")) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Xero. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/integrations");
    }
    if (params.get("gcal_connected") === "true") {
      queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/status"] });
      window.history.replaceState({}, "", "/integrations");
    } else if (params.get("gcal_error")) {
      toast({
        title: "Google Calendar Connection Failed",
        description: "Could not connect to Google Calendar. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/integrations");
    }
  }, [location]);

  // Get Xero status
  const { data: xeroStatus, isLoading } = useQuery({
    queryKey: ["/api/xero/status"],
  });

  // Get Facebook status
  const { data: facebookStatus } = useQuery({
    queryKey: ["/api/facebook/status"],
  });

  // Get Google Calendar status
  const { data: googleCalendarStatus } = useQuery({
    queryKey: ["/api/google-calendar/status"],
  });

  // Get Gmail status
  const { data: gmailStatus } = useQuery({
    queryKey: ["/api/gmail/status"],
  });

  // Get business settings for Mailchimp status
  const { data: businessSettings } = useQuery({
    queryKey: ["/api/business-settings"],
  });

  // Connect to Xero mutation (Custom Connection)
  const connectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/xero/connect", {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description:
          error.message ||
          "Make sure you have authorized the Custom Connection in Xero first.",
        variant: "destructive",
      });
    },
  });

  // Disconnect from Xero mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/xero/disconnect", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/status"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect from Xero",
        variant: "destructive",
      });
    },
  });

  // Build integrations list with real Xero, Facebook, Gmail, and Google Calendar status
  const integrations = availableIntegrations.map((integration) => {
    if (integration.id === "xero" && xeroStatus?.connected) {
      return {
        ...integration,
        status: "connected" as const,
        isEnabled: true,
        lastSync: xeroStatus.lastSynced,
        tenantName: xeroStatus.tenantName,
      };
    }
    if (integration.id === "facebook" && facebookStatus?.connected) {
      return {
        ...integration,
        status: "connected" as const,
        isEnabled: true,
        pageName: facebookStatus.pageName,
      };
    }
    if (integration.id === "gmail" && gmailStatus?.connected) {
      return {
        ...integration,
        status: "connected" as const,
        isEnabled: true,
        email: gmailStatus.email,
      };
    }
    if (
      integration.id === "google-calendar" &&
      googleCalendarStatus?.connected
    ) {
      return {
        ...integration,
        status: "connected" as const,
        isEnabled: true,
        calendarEmail: googleCalendarStatus.calendarEmail,
      };
    }
    if (
      integration.id === "mailchimp" &&
      businessSettings?.data?.mailchimpEnabled &&
      businessSettings?.data?.mailchimpApiKey
    ) {
      return {
        ...integration,
        status: "connected" as const,
        isEnabled: true,
        audienceId: businessSettings.data.mailchimpAudienceId,
      };
    }
    return integration;
  });

  const filteredIntegrations = integrations.filter(
    (integration) =>
      selectedCategory === "all" || integration.category === selectedCategory,
  );

  const connectedCount = integrations.filter(
    (i) => i.status === "connected",
  ).length;
  const errorCount = integrations.filter((i) => i.status === "error").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "text-green-600 bg-green-100";
      case "error":
        return "text-red-600 bg-red-100";
      case "disconnected":
        return "text-yellow-600 bg-yellow-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return CheckCircle;
      case "error":
        return AlertCircle;
      default:
        return Shield;
    }
  };

  const handleConnect = (integrationId: string) => {
    if (integrationId === "xero") {
      connectMutation.mutate();
    } else if (integrationId === "mailchimp") {
      setShowMailchimpDialog(true);
    } else if (integrationId === "google-calendar") {
      // OAuth redirect — server builds the consent URL and redirects back to /integrations
      window.location.href = "/api/google-calendar/auth";
    } else {
      console.log("Connecting to:", integrationId);
    }
  };

  const handleFetchMailchimpAudiences = async () => {
    if (!mailchimpApiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your Mailchimp API key first",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest("POST", "/api/mailchimp/audiences", {
        apiKey: mailchimpApiKey,
      });
      const result = await response.json();
      const audiences = result?.data || [];
      setMailchimpAudiences(audiences);
    } catch (error: any) {
      toast({
        title: "Failed to Load Audiences",
        description: error.message || "Check your API key",
        variant: "destructive",
      });
    }
  };

  const handleSaveMailchimp = async () => {
    if (!mailchimpApiKey || !mailchimpAudienceId) {
      toast({
        title: "Missing Configuration",
        description: "Please provide both API key and select an audience",
        variant: "destructive",
      });
      return;
    }

    try {
      const testResponse = await apiRequest("POST", "/api/mailchimp/test", {
        apiKey: mailchimpApiKey,
        audienceId: mailchimpAudienceId,
      });
      const testResult = await testResponse.json();

      await apiRequest("PUT", "/api/business-settings", {
        mailchimpEnabled: true,
        mailchimpApiKey: mailchimpApiKey,
        mailchimpAudienceId: mailchimpAudienceId,
        mailchimpAutoSync: true,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      setShowMailchimpDialog(false);
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Mailchimp",
        variant: "destructive",
      });
    }
  };

  const handleSyncMailchimp = async () => {
    setIsSyncingMailchimp(true);
    try {
      const response = await apiRequest("POST", "/api/mailchimp/sync", {});
      const result = await response.json();
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync customers",
        variant: "destructive",
      });
    } finally {
      setIsSyncingMailchimp(false);
    }
  };

  const handleDisconnectMailchimp = async () => {
    try {
      await apiRequest("PUT", "/api/business-settings", {
        mailchimpEnabled: false,
        mailchimpApiKey: "",
        mailchimpAudienceId: "",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      setMailchimpApiKey("");
      setMailchimpAudienceId("");
      setMailchimpAudiences([]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disconnect Mailchimp",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (integrationId === "xero") {
      disconnectMutation.mutate();
    } else if (integrationId === "mailchimp") {
      handleDisconnectMailchimp();
    } else if (integrationId === "google-calendar") {
      try {
        await apiRequest("DELETE", "/api/google-calendar/connection", undefined);
        queryClient.invalidateQueries({ queryKey: ["/api/google-calendar/status"] });
      } catch (error: any) {
        toast({
          title: "Disconnect Failed",
          description: error.message || "Could not disconnect Google Calendar",
          variant: "destructive",
        });
      }
    } else {
      console.log("Disconnecting from:", integrationId);
    }
  };

  const handleToggle = (integrationId: string, enabled: boolean) => {
    // TODO: Implement enable/disable logic
    console.log("Toggling integration:", integrationId, enabled);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/xero/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/gmail/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/facebook/status"] });
    queryClient.invalidateQueries({
      queryKey: ["/api/google-calendar/status"],
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
                <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 flex-shrink-0" />
                <span className="truncate">Integrations</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Connect and manage your external service integrations
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                data-testid="button-refresh-integrations"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-browse-integrations"
              >
                <Plus className="h-4 w-4 mr-1" />
                Browse More
              </Button>
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {connectedCount} Connected
              </span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {errorCount} Need Attention
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 md:p-6">
        {/* Category Filter */}
        <Tabs
          value={selectedCategory}
          onValueChange={setSelectedCategory}
          className="mb-4 sm:mb-6"
        >
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1">
            <TabsTrigger value="all" data-testid="tab-all">
              All
            </TabsTrigger>
            <TabsTrigger value="accounting" data-testid="tab-accounting">
              Accounting
            </TabsTrigger>
            <TabsTrigger value="email" data-testid="tab-email">
              Email
            </TabsTrigger>
            <TabsTrigger value="messaging" data-testid="tab-messaging">
              Messaging
            </TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar">
              Calendar
            </TabsTrigger>
            <TabsTrigger value="marketing" data-testid="tab-marketing">
              Marketing
            </TabsTrigger>
            <TabsTrigger value="crm" data-testid="tab-crm">
              CRM
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Integrations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 w-full max-w-full">
          {filteredIntegrations.map((integration) => {
            const StatusIcon = getStatusIcon(integration.status);

            return (
              <Card key={integration.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg">
                        <integration.icon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {integration.name}
                        </CardTitle>
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="secondary"
                            className={`mt-1 text-xs ${getStatusColor(integration.status)}`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {integration.status.charAt(0).toUpperCase() +
                              integration.status.slice(1)}
                          </Badge>
                          {(integration.tenantName ||
                            integration.pageName ||
                            integration.calendarEmail ||
                            (integration as any).email) && (
                            <span className="text-xs text-gray-500">
                              {integration.tenantName ||
                                integration.pageName ||
                                integration.calendarEmail ||
                                (integration as any).email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {integration.status === "connected" && (
                      <Switch
                        checked={integration.isEnabled}
                        onCheckedChange={(enabled) =>
                          handleToggle(integration.id, enabled)
                        }
                        data-testid={`switch-${integration.id}`}
                      />
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {integration.description}
                  </p>

                  {/* Features */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Features
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {integration.features.map((feature) => (
                        <Badge
                          key={feature}
                          variant="outline"
                          className="text-xs"
                        >
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Connection Info */}
                  {integration.lastSync && (
                    <div className="text-xs text-gray-500">
                      Last sync:{" "}
                      {new Date(integration.lastSync).toLocaleString()}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    {integration.status === "connected" ? (
                      integration.id === "mailchimp" ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={handleSyncMailchimp}
                            disabled={isSyncingMailchimp}
                            data-testid="button-sync-mailchimp"
                          >
                            {isSyncingMailchimp ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Users className="h-4 w-4 mr-1" />
                            )}
                            {isSyncingMailchimp
                              ? "Syncing..."
                              : "Sync Customers"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(integration.id)}
                            data-testid={`button-disconnect-${integration.id}`}
                          >
                            <Unlink className="h-4 w-4 mr-1" />
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            data-testid={`button-configure-${integration.id}`}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Configure
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(integration.id)}
                            data-testid={`button-disconnect-${integration.id}`}
                          >
                            <Unlink className="h-4 w-4 mr-1" />
                            Disconnect
                          </Button>
                        </>
                      )
                    ) : integration.status === "error" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-red-600 border-red-200"
                          data-testid={`button-fix-${integration.id}`}
                        >
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Fix Connection
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnect(integration.id)}
                          data-testid={`button-remove-${integration.id}`}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        className="flex-1"
                        size="sm"
                        onClick={() => handleConnect(integration.id)}
                        data-testid={`button-connect-${integration.id}`}
                      >
                        <Link className="h-4 w-4 mr-1" />
                        {integration.setupRequired ? "Setup" : "Connect"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Help Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-orange-600" />
              Need Help Setting Up Integrations?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Email Integration</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Connect your email accounts to centralize all customer
                  communications in one inbox.
                </p>
                <Button
                  variant="ghost"
                  className="p-0 h-auto text-orange-600 hover:text-orange-700"
                >
                  View Email Setup Guide{" "}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>

              <div>
                <h4 className="font-medium mb-2">Marketing Automation</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Connect Mailchimp to manage email campaigns, audience
                  segmentation, and marketing automation.
                </p>
                <Button
                  variant="ghost"
                  className="p-0 h-auto text-orange-600 hover:text-orange-700"
                >
                  View Mailchimp Setup Guide{" "}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mailchimp Configuration Dialog */}
      <Dialog open={showMailchimpDialog} onOpenChange={setShowMailchimpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-600" />
              Connect Mailchimp
            </DialogTitle>
            <DialogDescription>
              Enter your Mailchimp API key and select an audience to sync your
              customers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mailchimp-api-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="mailchimp-api-key"
                  type="password"
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us1"
                  value={mailchimpApiKey}
                  onChange={(e) => setMailchimpApiKey(e.target.value)}
                  data-testid="input-mailchimp-api-key"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchMailchimpAudiences}
                  disabled={!mailchimpApiKey}
                  data-testid="button-fetch-audiences"
                >
                  Load
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Find your API key in Mailchimp under Account → Extras → API keys
              </p>
            </div>

            {mailchimpAudiences && mailchimpAudiences.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="mailchimp-audience">Select Audience</Label>
                <div className="space-y-2">
                  {mailchimpAudiences.map((audience) => (
                    <div
                      key={audience.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        mailchimpAudienceId === audience.id
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                          : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                      }`}
                      onClick={() => setMailchimpAudienceId(audience.id)}
                      data-testid={`audience-${audience.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{audience.name}</p>
                          <p className="text-xs text-gray-500">
                            {audience.memberCount} members
                          </p>
                        </div>
                        {mailchimpAudienceId === audience.id && (
                          <CheckCircle className="h-5 w-5 text-orange-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMailchimpDialog(false)}
              data-testid="button-cancel-mailchimp"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMailchimp}
              disabled={!mailchimpApiKey || !mailchimpAudienceId}
              data-testid="button-save-mailchimp"
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
