import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import {
  Mail,
  MessageSquare,
  Bell,
  Settings,
  Activity,
  BarChart3,
  TrendingUp,
  Send,
  MessageCircle,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Pause,
  Search,
  User,
  Loader2,
  CheckCircle,
  Clock,
} from "lucide-react";
import type { Call, Customer } from "@shared/schema";

export default function CommunicationsManagement() {
  const [activeTab, setActiveTab] = useState("calls");
  const [callSearchQuery, setCallSearchQuery] = useState("");
  const [callDirectionFilter, setCallDirectionFilter] = useState<string>("all");
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const { data: callsResponse, isLoading: isLoadingCalls } = useQuery<{
    success: boolean;
    data: Call[];
  }>({
    queryKey: ["/api/calls"],
    enabled: activeTab === "calls",
  });

  const { data: customersResponse } = useQuery<{
    success: boolean;
    data: Customer[];
  }>({
    queryKey: ["/api/customers"],
    enabled: activeTab === "calls",
  });

  const calls = callsResponse?.data ?? [];
  const customers = customersResponse?.data ?? [];

  const getCustomerName = (customerId: string | null | undefined) => {
    if (!customerId) return null;
    return customers.find((c) => c.id === customerId)?.name ?? null;
  };

  const filteredCalls = calls.filter((call) => {
    const customerName = getCustomerName(call.customerId);
    const matchesSearch =
      !callSearchQuery ||
      call.phoneNumber?.toLowerCase().includes(callSearchQuery.toLowerCase()) ||
      customerName?.toLowerCase().includes(callSearchQuery.toLowerCase()) ||
      call.transcriptText?.toLowerCase().includes(callSearchQuery.toLowerCase());

    const matchesDirection =
      callDirectionFilter === "all" || call.direction === callDirectionFilter;

    return matchesSearch && matchesDirection;
  });

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCallTime = (dateStr?: Date | string | null) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    return date.toLocaleString("en-NZ", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Mock data for the communication system status
  const { data: communicationStatus } = useQuery({
    queryKey: ["communication-status"],
    queryFn: async () => ({
      emailService: {
        configured: false,
        service: "SendGrid",
        status: "Mock Mode",
        lastSent: new Date().toISOString(),
      },
      smsService: {
        configured: false,
        service: "Twilio",
        status: "Mock Mode",
        lastSent: new Date().toISOString(),
      },
      notifications: {
        enabled: true,
        totalSent: 0,
        mockMode: true,
      },
      recentActivity: [
        {
          id: "1",
          type: "email",
          recipient: "sarah.johnson@email.com",
          subject: "Job Status Update: Tree Service Complete",
          status: "sent (mock)",
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        },
        {
          id: "2",
          type: "sms",
          recipient: "+64 21 555 0123",
          message: "Your tree service has been scheduled...",
          status: "sent (mock)",
          timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
        },
      ],
    }),
  });

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Communications Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage automated emails, SMS, and customer notifications
          </p>
        </div>
        <Button data-testid="button-communication-settings">
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="calls" data-testid="tab-calls">
            <Phone className="w-4 h-4 mr-2" />
            Calls
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <Mail className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="automation" data-testid="tab-automation">
            <Bell className="w-4 h-4 mr-2" />
            Automation
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Email Service
                </CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {communicationStatus?.emailService.configured ? (
                    <Badge className="bg-green-500">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Mock Mode</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {communicationStatus?.emailService.service} -{" "}
                  {communicationStatus?.emailService.status}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  SMS Service
                </CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {communicationStatus?.smsService.configured ? (
                    <Badge className="bg-green-500">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Mock Mode</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {communicationStatus?.smsService.service} -{" "}
                  {communicationStatus?.smsService.status}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Notifications Sent
                </CardTitle>
                <Send className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {communicationStatus?.notifications.totalSent || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {communicationStatus?.notifications.mockMode
                    ? "In mock mode"
                    : "This month"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Automation
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <Badge className="bg-blue-500">Running</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-notifications enabled
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Service Status
                </CardTitle>
                <CardDescription>
                  Communication services health check
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">SendGrid Email</span>
                  {communicationStatus?.emailService.configured ? (
                    <Badge className="bg-green-500">✓ Connected</Badge>
                  ) : (
                    <Badge variant="outline">⚠ Mock Mode</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Twilio SMS</span>
                  {communicationStatus?.smsService.configured ? (
                    <Badge className="bg-green-500">✓ Connected</Badge>
                  ) : (
                    <Badge variant="outline">⚠ Mock Mode</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Background Tasks</span>
                  <Badge className="bg-blue-500">✓ Running</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Job Notifications</span>
                  <Badge className="bg-green-500">✓ Active</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest communication events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {communicationStatus?.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    {activity.type === "email" ? (
                      <Mail className="w-4 h-4 text-blue-500" />
                    ) : (
                      <MessageCircle className="w-4 h-4 text-green-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {activity.type === "email"
                          ? activity.subject
                          : activity.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        To: {activity.recipient}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {activity.status}
                    </Badge>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No recent activity
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-green-500" />
                    Call History
                  </CardTitle>
                  <CardDescription>
                    View and manage all recorded calls
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search calls..."
                      value={callSearchQuery}
                      onChange={(e) => setCallSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-calls"
                    />
                  </div>
                  <Select
                    value={callDirectionFilter}
                    onValueChange={setCallDirectionFilter}
                  >
                    <SelectTrigger
                      className="w-full sm:w-32"
                      data-testid="select-call-direction"
                    >
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Calls</SelectItem>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCalls ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCalls.length === 0 ? (
                <div className="text-center py-8">
                  <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No call records yet</h3>
                  <p className="text-muted-foreground">
                    Recorded calls will appear here once customers start calling.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCalls.map((call) => {
                    const customerName = getCustomerName(call.customerId);
                    const isPlaying = playingCallId === call.id;
                    const isTranscriptOpen = expandedTranscript === call.id;
                    return (
                      <div
                        key={call.id}
                        className="flex flex-col gap-3 p-4 border rounded-lg"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="flex-shrink-0">
                            {call.direction === "inbound" ? (
                              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                <PhoneIncoming className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                <PhoneOutgoing className="w-5 h-5 text-green-600 dark:text-green-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className="text-sm font-medium">
                                {customerName ?? call.phoneNumber}
                              </h4>
                              {customerName && (
                                <span className="text-xs text-muted-foreground">{call.phoneNumber}</span>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {call.direction === "inbound" ? "Incoming" : "Outgoing"}
                              </Badge>
                              {call.sentiment && (
                                <Badge
                                  className={
                                    call.sentiment === "positive"
                                      ? "bg-green-500"
                                      : call.sentiment === "negative"
                                        ? "bg-red-500"
                                        : "bg-gray-500"
                                  }
                                >
                                  {call.sentiment}
                                </Badge>
                              )}
                              {call.customerId && (
                                <Badge variant="secondary" className="text-xs">
                                  Customer linked
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Duration: {formatDuration(call.duration)}
                              {call.status && ` • ${call.status}`}
                            </p>
                            {call.summary && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {call.summary}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                            <p className="text-xs text-muted-foreground">
                              {formatCallTime(call.createdAt)}
                            </p>
                            <div className="flex flex-wrap gap-2 justify-end">
                              {call.recordingUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setPlayingCallId(isPlaying ? null : call.id)
                                  }
                                  data-testid={`button-play-call-${call.id}`}
                                >
                                  {isPlaying ? (
                                    <Pause className="w-4 h-4 mr-1" />
                                  ) : (
                                    <Play className="w-4 h-4 mr-1" />
                                  )}
                                  {isPlaying ? "Pause" : "Play"}
                                </Button>
                              )}
                              {call.transcriptText && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setExpandedTranscript(isTranscriptOpen ? null : call.id)
                                  }
                                  data-testid={`button-transcript-${call.id}`}
                                >
                                  {isTranscriptOpen ? "Hide" : "Transcript"}
                                </Button>
                              )}
                              {call.customerId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/customers`)}
                                  data-testid={`button-view-customer-${call.id}`}
                                >
                                  <User className="w-4 h-4 mr-1" />
                                  Customer
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        {isPlaying && call.recordingUrl && (
                          <audio
                            controls
                            autoPlay
                            className="w-full"
                            src={call.recordingUrl}
                            onEnded={() => setPlayingCallId(null)}
                          />
                        )}
                        {isTranscriptOpen && call.transcriptText && (
                          <div className="p-3 bg-muted rounded-lg">
                            <h5 className="text-sm font-medium mb-1">Transcript</h5>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {call.transcriptText}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Communication Templates</CardTitle>
              <CardDescription>
                Manage email and SMS templates for automated notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg space-y-2">
                  <h3 className="font-medium">Job Status Updates</h3>
                  <p className="text-sm text-muted-foreground">
                    Automated notifications when job status changes
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline">Email</Badge>
                    <Badge variant="outline">SMS</Badge>
                  </div>
                </div>
                <div className="p-4 border rounded-lg space-y-2">
                  <h3 className="font-medium">Quote Sent</h3>
                  <p className="text-sm text-muted-foreground">
                    Notification when quotes are sent to customers
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline">Email</Badge>
                    <Badge variant="outline">SMS</Badge>
                  </div>
                </div>
                <div className="p-4 border rounded-lg space-y-2">
                  <h3 className="font-medium">Service Request Confirmation</h3>
                  <p className="text-sm text-muted-foreground">
                    Confirmation when customers submit service requests
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline">Email</Badge>
                    <Badge variant="outline">SMS</Badge>
                  </div>
                </div>
                <div className="p-4 border rounded-lg space-y-2">
                  <h3 className="font-medium">Job Reminders</h3>
                  <p className="text-sm text-muted-foreground">
                    Scheduled reminders and follow-ups
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline">Email</Badge>
                    <Badge variant="outline">SMS</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Communication Activity Log</CardTitle>
              <CardDescription>
                View all sent emails and SMS messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {communicationStatus?.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 p-4 border rounded-lg"
                  >
                    <div className="flex-shrink-0">
                      {activity.type === "email" ? (
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Mail className="w-4 h-4 text-blue-600" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <MessageCircle className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium">
                        {activity.type === "email"
                          ? activity.subject
                          : "SMS Notification"}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        To: {activity.recipient}
                      </p>
                      {activity.type === "sms" && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {activity.message}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <Badge variant="outline" className="mb-1">
                        {activity.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No activity yet
                    </h3>
                    <p className="text-muted-foreground">
                      Communication activity will appear here when notifications
                      are sent
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated Communication Rules</CardTitle>
              <CardDescription>
                Configure when and how customers are notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Job Status Changes</h3>
                    <Badge className="bg-green-500">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically notify customers when job status changes to
                    scheduled, in progress, or completed.
                  </p>
                  <div className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Email notifications</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">SMS notifications</span>
                  </div>
                </div>

                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      Service Request Confirmations
                    </h3>
                    <Badge className="bg-green-500">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Send confirmation when customers submit new service requests
                    through the portal.
                  </p>
                  <div className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Email confirmation</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">SMS confirmation</span>
                  </div>
                </div>

                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Quote Notifications</h3>
                    <Badge className="bg-green-500">Active</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Notify customers when quotes are ready for review and
                    acceptance.
                  </p>
                  <div className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Email with quote details</span>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">SMS notification</span>
                  </div>
                </div>

                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Background Monitoring</h3>
                    <Badge className="bg-blue-500">Running</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatic checks for overdue jobs and follow-up reminders.
                  </p>
                  <div className="flex gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Hourly overdue job checks</span>
                  </div>
                  <div className="flex gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">4-hour follow-up reminders</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
