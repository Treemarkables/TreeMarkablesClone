import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Conversation } from "@shared/schema";
import { insertLeadSchema } from "@shared/schema";
import {
  MessageSquare,
  Search,
  Loader2,
  RefreshCw,
  Mail,
  Phone,
  Video,
  MoreVertical,
  Briefcase,
  UserPlus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { LeadFormDialog } from "@/components/LeadFormDialog";

// Form schema extending insertLeadSchema with required validation
const createLeadFormSchema = insertLeadSchema.extend({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().default(""),
  status: z.string().default("new"),
  urgency: z
    .enum(["low", "medium", "high", "emergency"])
    .optional()
    .default("medium"),
});

export default function Inbox() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false);
  const [showCreateOpportunityDialog, setShowCreateOpportunityDialog] =
    useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Track which conversation is currently being AI-extracted
  const [extractingJobConvId, setExtractingJobConvId] = useState<string | null>(null);
  const [extractingOppConvId, setExtractingOppConvId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form for creating job as lead
  const jobForm = useForm<z.infer<typeof createLeadFormSchema>>({
    resolver: zodResolver(createLeadFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      serviceRequested: "",
      urgency: "medium",
      status: "new",
      notes: "",
    },
  });

  // Form for creating opportunity
  const opportunityForm = useForm<z.infer<typeof createLeadFormSchema>>({
    resolver: zodResolver(createLeadFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      serviceRequested: "",
      urgency: "medium",
      status: "new",
      notes: "",
    },
  });

  // Fetch conversations from backend - filter by source
  const {
    data: conversationsResponse,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "/api/conversations",
      {
        search: searchTerm || undefined,
        source: sourceFilter !== "all" ? sourceFilter : undefined,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      // Filter by source if not 'all'
      if (sourceFilter !== "all") {
        params.append("source", sourceFilter);
      }
      const response = await fetch(`/api/conversations?${params}`);
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
  });

  const conversations: Conversation[] = conversationsResponse?.data || [];

  // AI extraction helper — fetches conversation messages then calls the extract endpoint
  const extractLeadData = async (conversation: Conversation) => {
    try {
      const messagesRes = await fetch(`/api/conversations/${conversation.id}/messages`);
      const messagesData = await messagesRes.json();
      const messages: Array<{ content?: string }> = messagesData.data || [];

      const allText = [
        conversation.title ? `Subject: ${conversation.title}` : "",
        ...messages.map((m) => m.content || ""),
      ]
        .filter(Boolean)
        .join("\n\n");

      const extractRes = await apiRequest("POST", "/api/leads/extract-from-message", { message: allText });
      const parsed = await extractRes.json();
      return parsed.data || {};
    } catch {
      return {};
    }
  };

  // Create Opportunity mutation
  const createOpportunityMutation = useMutation({
    mutationFn: async (leadData: z.infer<typeof createLeadFormSchema> & { conversationId?: string }) => {
      return apiRequest("POST", "/api/leads", leadData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowCreateOpportunityDialog(false);
      opportunityForm.reset();
    },
    onError: () => {
      toast({
        title: "Failed to create opportunity",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create Job as Lead mutation
  const createJobMutation = useMutation({
    mutationFn: async (leadData: z.infer<typeof createLeadFormSchema> & { conversationId?: string }) => {
      const res = await apiRequest("POST", "/api/leads", { ...leadData, status: "new" });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowCreateJobDialog(false);
      jobForm.reset();
      const jobId = data?.data?.id;
      setLocation(jobId ? `/dispatch?job=${jobId}` : "/dispatch");
    },
    onError: () => {
      toast({
        title: "Failed to create job lead",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Opens the "Create Job as Lead" dialog with AI-extracted data pre-filled
  const handleExtractAndOpenJobDialog = async (conversation: Conversation) => {
    setExtractingJobConvId(conversation.id);
    try {
      const extracted = await extractLeadData(conversation);
      setSelectedConversation(conversation);
      jobForm.reset({
        name: extracted.name || conversation.title || "New Lead",
        email: extracted.email || "",
        phone: extracted.phone || "",
        address: extracted.address || "",
        serviceRequested: extracted.description || "",
        urgency: "medium",
        status: "new",
        notes: `Lead from conversation: ${conversation.title || ""}`,
      });
      setShowCreateJobDialog(true);
    } finally {
      setExtractingJobConvId(null);
    }
  };

  // Opens the "Create Opportunity" dialog with AI-extracted data pre-filled
  const handleExtractAndOpenOppDialog = async (conversation: Conversation) => {
    setExtractingOppConvId(conversation.id);
    try {
      const extracted = await extractLeadData(conversation);
      setSelectedConversation(conversation);
      opportunityForm.reset({
        name: extracted.name || conversation.title || "New Lead",
        email: extracted.email || "",
        phone: extracted.phone || "",
        address: extracted.address || "",
        serviceRequested: extracted.description || "",
        urgency: "medium",
        status: "new",
        notes: `Opportunity from conversation: ${conversation.title || ""}`,
      });
      setShowCreateOpportunityDialog(true);
    } finally {
      setExtractingOppConvId(null);
    }
  };

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/conversations/bulk", { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    },
    onError: () => {
      toast({
        title: "Failed to delete conversations",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Selection helpers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredConversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConversations.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  // Filter conversations based on status
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (statusFilter === "all") return true;
      return conv.status === statusFilter;
    });
  }, [conversations, statusFilter]);

  const unreadCount = filteredConversations.filter(
    (conv) => (conv.unreadCount || 0) > 0,
  ).length;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "closed":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "medium":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "low":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "phone":
        return <Phone className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col w-full overflow-x-hidden">
      {/* Header */}
      <div className="border-b p-3 sm:p-6 w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              Conversations
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} unread
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Messages from website, Facebook, email, and phone
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-conversations"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-quote-requests"
              />
            </div>
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-40" data-testid="select-source-filter">
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="quote_request">Website Quotes</SelectItem>
              <SelectItem value="social">Facebook</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions Bar */}
        {filteredConversations.length > 0 && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={
                  selectedIds.size === filteredConversations.length &&
                  filteredConversations.length > 0
                }
                onCheckedChange={toggleSelectAll}
                data-testid="checkbox-select-all"
              />
              <label
                htmlFor="select-all"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Select all ({filteredConversations.length})
              </label>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <AlertDialog
                  open={showDeleteConfirm}
                  onOpenChange={setShowDeleteConfirm}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Delete {selectedIds.size} conversations?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All selected conversations
                        and their messages will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleBulkDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={bulkDeleteMutation.isPending}
                      >
                        {bulkDeleteMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear selection
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                No conversations found
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm
                  ? "Try adjusting your search terms"
                  : "Messages from website, Facebook, and other channels will appear here"}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-4 hover-elevate active-elevate-2 ${
                  (conversation.unreadCount || 0) > 0 ? "bg-accent/50" : ""
                } ${selectedIds.has(conversation.id) ? "bg-primary/10" : ""}`}
                data-testid={`conversation-item-${conversation.id}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedIds.has(conversation.id)}
                    onCheckedChange={() => toggleSelectOne(conversation.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1"
                    data-testid={`checkbox-conversation-${conversation.id}`}
                  />
                  <Avatar
                    className="h-10 w-10 cursor-pointer"
                    onClick={() =>
                      setLocation(`/conversation/${conversation.id}`)
                    }
                  >
                    <AvatarFallback>
                      {conversation.title?.charAt(0).toUpperCase() || "C"}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() =>
                      setLocation(`/conversation/${conversation.id}`)
                    }
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {getSourceIcon(conversation.source || "email")}
                        <h3
                          className={`text-sm font-medium ${
                            (conversation.unreadCount || 0) > 0
                              ? "font-semibold"
                              : ""
                          }`}
                        >
                          {conversation.title}
                        </h3>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {conversation.lastMessageAt
                          ? formatDistanceToNow(
                              new Date(conversation.lastMessageAt),
                              { addSuffix: true },
                            )
                          : formatDistanceToNow(
                              new Date(conversation.createdAt || new Date()),
                              { addSuffix: true },
                            )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        className={getStatusBadgeColor(
                          conversation.status || "open",
                        )}
                        variant="secondary"
                      >
                        {conversation.status || "open"}
                      </Badge>
                      <Badge
                        className={getPriorityBadgeColor(
                          conversation.priority || "medium",
                        )}
                        variant="secondary"
                      >
                        {conversation.priority || "medium"}
                      </Badge>
                      {(conversation.unreadCount || 0) > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {conversation.unreadCount} new
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Action Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 h-8 w-8"
                        data-testid={`button-actions-${conversation.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtractAndOpenJobDialog(conversation);
                        }}
                        disabled={extractingJobConvId === conversation.id}
                        data-testid={`menuitem-create-job-${conversation.id}`}
                      >
                        {extractingJobConvId === conversation.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Briefcase className="h-4 w-4 mr-2" />
                        )}
                        {extractingJobConvId === conversation.id
                          ? "Extracting..."
                          : "Create Job as Lead"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExtractAndOpenOppDialog(conversation);
                        }}
                        disabled={extractingOppConvId === conversation.id}
                        data-testid={`menuitem-create-opportunity-${conversation.id}`}
                      >
                        {extractingOppConvId === conversation.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4 mr-2" />
                        )}
                        {extractingOppConvId === conversation.id
                          ? "Extracting..."
                          : "Create Opportunity"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Create Job as Lead Dialog */}
      <LeadFormDialog
        open={showCreateJobDialog}
        onOpenChange={setShowCreateJobDialog}
        title="Create Job as Lead"
        description="Review the extracted details and create a job lead"
        submitLabel="Create Job Lead"
        isSubmitting={createJobMutation.isPending}
        form={jobForm}
        onSubmit={(values) =>
          createJobMutation.mutate({
            ...values,
            status: "new",
            conversationId: selectedConversation?.id,
          } as z.infer<typeof createLeadFormSchema> & { conversationId?: string })
        }
        includeStatus={false}
        testIdPrefix="inbox-job"
      />

      {/* Create Opportunity Dialog */}
      <LeadFormDialog
        open={showCreateOpportunityDialog}
        onOpenChange={setShowCreateOpportunityDialog}
        title="Create Opportunity"
        description="Review the extracted details and add to your pipeline"
        submitLabel="Create Opportunity"
        isSubmitting={createOpportunityMutation.isPending}
        form={opportunityForm}
        onSubmit={(values) =>
          createOpportunityMutation.mutate({
            ...values,
            conversationId: selectedConversation?.id,
          } as z.infer<typeof createLeadFormSchema> & { conversationId?: string })
        }
        includeStatus={true}
        testIdPrefix="inbox-opportunity"
      />
    </div>
  );
}
