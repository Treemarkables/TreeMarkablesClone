import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
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
  X,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Call, Customer, PendingOutboundMessage } from "@shared/schema";
import { TwilioStatusCard } from "@/components/TwilioStatusCard";

export default function CommunicationsManagement() {
  const searchParams = new URLSearchParams(window.location.search);
  const defaultTab = searchParams.get("tab") || "calls";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [callSearchQuery, setCallSearchQuery] = useState("");
  const [callDirectionFilter, setCallDirectionFilter] = useState<string>("all");
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [, navigate] = useLocation();

  // Pending outbound messages
  const { data: pendingMsgsResponse, isLoading: pendingLoading } = useQuery<{
    success: boolean;
    data: PendingOutboundMessage[];
  }>({
    queryKey: ["/api/pending-messages"],
    refetchInterval: 30000,
  });
  const pendingMessages = pendingMsgsResponse?.data ?? [];
  const pendingCount = pendingMessages.filter(m => m.status === 'pending').length;

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/pending-messages/${id}/approve`, {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to send');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-messages"] });
      toast({ title: "Message sent", description: "The holding message has been sent to the customer." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not send", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/pending-messages/${id}/reject`, {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to dismiss');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-messages"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const res = await apiRequest('PATCH', `/api/pending-messages/${id}`, { message });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to save edit');
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pending-messages"] });
      setEditingMessageId(null);
      setEditingText("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createJobFromCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await apiRequest('POST', `/api/calls/${callId}/create-job`, {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to create job');
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      const jobId = data?.data?.job?.id;
      const jobNumber = data?.data?.job?.jobNumber;
      if (jobId) {
        navigate(`/dispatch?job=${jobId}`);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't create job", description: err.message, variant: "destructive" });
    },
  });

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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="pending" data-testid="tab-pending" className="relative">
            <AlertCircle className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Pending</span>
            {pendingCount > 0 && (
              <Badge className="ml-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-orange-500 text-white">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="calls" data-testid="tab-calls">
            <Phone className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Calls</span>
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <Mail className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <Activity className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
          <TabsTrigger value="automation" data-testid="tab-automation">
            <Bell className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Automation</span>
          </TabsTrigger>
        </TabsList>

        {/* Pending Approval Tab */}
        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                Messages Awaiting Your Approval
              </CardTitle>
              <CardDescription>
                Review each draft message before it sends to the customer. You can edit the text, approve to send, or dismiss.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingMessages.filter(m => m.status === 'pending').length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">All clear — no messages waiting</p>
                  <p className="text-sm mt-1">When a customer accepts a proposal, a holding message will appear here for your approval.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingMessages
                    .filter(m => m.status === 'pending')
                    .map(msg => (
                      <div key={msg.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-semibold text-sm">{msg.recipientName || 'Customer'}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <Badge variant="secondary" className="text-xs capitalize">{msg.channel}</Badge>
                              {msg.recipientPhone && <span className="text-xs text-muted-foreground">{msg.recipientPhone}</span>}
                              {msg.channel === 'email' && msg.recipientEmail && <span className="text-xs text-muted-foreground">{msg.recipientEmail}</span>}
                              {msg.proposalNumber && <span className="text-xs text-muted-foreground">Proposal #{msg.proposalNumber}</span>}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.createdAt).toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
                          </span>
                        </div>

                        {editingMessageId === msg.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingText}
                              onChange={e => setEditingText(e.target.value)}
                              rows={3}
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => editMutation.mutate({ id: msg.id, message: editingText })}
                                disabled={editMutation.isPending}
                              >
                                {editMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingMessageId(null); setEditingText(""); }}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-muted rounded-md px-3 py-2 text-sm">{msg.message}</div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => approveMutation.mutate(msg.id)}
                            disabled={approveMutation.isPending || editingMessageId === msg.id}
                          >
                            {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingMessageId(msg.id); setEditingText(msg.message); }}
                            disabled={editingMessageId === msg.id}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => rejectMutation.mutate(msg.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Reject
                          </Button>
                          {msg.jobId && (
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/jobs/${msg.jobId}`)}>
                              View job
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
          <TwilioStatusCard />
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
                              {call.transcriptText && !call.jobId && (
                                <Button
                                  size="sm"
                                  onClick={() => createJobFromCallMutation.mutate(call.id)}
                                  disabled={createJobFromCallMutation.isPending}
                                  data-testid={`button-create-job-${call.id}`}
                                >
                                  {createJobFromCallMutation.isPending &&
                                  createJobFromCallMutation.variables === call.id ? (
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  ) : null}
                                  Create Job
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
