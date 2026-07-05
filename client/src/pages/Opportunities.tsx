import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Conversation, ConversationMessage } from "@shared/schema";
import { insertLeadSchema } from "@shared/schema";
import { SiFacebook } from "react-icons/si";
import {
  Menu,
  ChevronDown,
  Filter,
  Plus,
  Facebook,
  Loader2,
  MoreVertical,
  Briefcase,
  UserPlus,
  Trash2,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { LeadFormDialog } from "@/components/LeadFormDialog";

// Form schema extending insertLeadSchema with required validation
const createLeadFormSchema = insertLeadSchema.extend({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  status: z.string().default("new"),
  urgency: z
    .enum(["low", "medium", "high", "emergency"])
    .optional()
    .default("medium"),
});

export default function Opportunities() {
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [showCreateJobDialog, setShowCreateJobDialog] = useState(false);
  const [showCreateOpportunityDialog, setShowCreateOpportunityDialog] =
    useState(false);
  const [showFacebookPasteDialog, setShowFacebookPasteDialog] = useState(false);
  const [facebookPasteText, setFacebookPasteText] = useState("");
  const [isExtractingFacebook, setIsExtractingFacebook] = useState(false);
  const [, setLocation] = useLocation();

  // Bulk delete state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  // Fetch conversations from backend
  const { data: conversationsResponse, isLoading } = useQuery({
    queryKey: ["/api/conversations", { filterType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType === "unread") {
        params.append("unread", "true");
      } else if (filterType === "recent") {
        params.append("sortBy", "recent");
      }
      const response = await fetch(`/api/conversations?${params}`);
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
  });

  const conversations = conversationsResponse?.data || [];

  // Fetch conversation messages for selected conversation
  const { data: messagesResponse } = useQuery({
    queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
    queryFn: async () => {
      if (!selectedConversation?.id) return { data: [] };
      const response = await fetch(
        `/api/conversations/${selectedConversation.id}/messages`,
      );
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: !!selectedConversation?.id,
  });

  const messages = messagesResponse?.data || [];

  // Helper function to extract contact details from conversation and messages
  const extractContactDetails = (conversation: any, messages: any[]) => {
    const name = conversation.customerName || "";
    let email = conversation.customerEmail || "";
    let phone = conversation.customerPhone || "";
    let address = "";

    // If we don't have email/phone from customer record, try to extract from first message
    if ((!email || !phone || !address) && messages.length > 0) {
      const firstMessage = messages.find((m) => m.direction === "inbound");

      if (firstMessage) {
        // Get email from fromContact if it looks like an email
        if (
          !email &&
          firstMessage.fromContact &&
          firstMessage.fromContact.includes("@")
        ) {
          email = firstMessage.fromContact;
        }

        // Try to extract phone from message content
        if (!phone && firstMessage.content) {
          // Look for "Phone: " pattern in the message
          const phoneMatch = firstMessage.content.match(
            /Phone:\s*([0-9+\s\-()]+)/i,
          );
          if (phoneMatch) {
            phone = phoneMatch[1].trim();
          }
        }

        // Also check if fromContact is a phone number
        if (
          !phone &&
          firstMessage.fromContact &&
          /^[\d\s+\-()]+$/.test(firstMessage.fromContact)
        ) {
          phone = firstMessage.fromContact;
        }

        // Extract email from message content if not found yet
        if (!email && firstMessage.content) {
          const emailMatch = firstMessage.content.match(
            /Email:\s*([^\s\n]+@[^\s\n]+)/i,
          );
          if (emailMatch) {
            email = emailMatch[1].trim();
          }
        }

        // Extract address from message content
        if (!address && firstMessage.content) {
          // Look for common NZ address patterns:
          // - Number followed by street name (e.g., "28 De lautour Road")
          // - Can include unit/flat numbers
          const addressMatch = firstMessage.content.match(
            /(?:^|\n)(\d+[a-zA-Z]?\s+[A-Z][a-zA-Z\s]+(?:Road|Street|Avenue|Lane|Drive|Place|Terrace|Way|Court|Crescent|Close|Grove|Heights)(?:\s*,?\s*[A-Z][a-zA-Z\s]+)?)/im,
          );
          if (addressMatch) {
            address = addressMatch[1].trim();
          }
        }
      }
    }

    // Use senderContact as fallback for phone if it looks like a phone number
    if (
      !phone &&
      conversation.senderContact &&
      /^[\d\s+\-()]+$/.test(conversation.senderContact)
    ) {
      phone = conversation.senderContact;
    }

    return { name, email, phone, address };
  };

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/reply`, {
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", selectedConversation?.id, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setReplyContent("");
      setShowReplyDialog(false);
    },
    onError: () => {
      toast({
        title: "Failed to send reply",
        description: "Please try again or check your connection.",
        variant: "destructive",
      });
    },
  });

  // Create Opportunity mutation
  const createOpportunityMutation = useMutation({
    mutationFn: async (leadData: z.infer<typeof createLeadFormSchema>) => {
      return apiRequest("POST", "/api/leads", leadData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
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

  // Create Quote mutation (creates a job with status "quote")
  const createJobMutation = useMutation({
    mutationFn: async (leadData: z.infer<typeof createLeadFormSchema>) => {
      console.log("🔵 Starting job/quote creation with data:", leadData);

      // Capture the source conversation at mutation time so the closure below
      // (mark-as-converted) isn't racing with the dialog closing.
      const sourceConversationId = selectedConversation?.id;

      // First, create or find customer
      const customerRes = await apiRequest("POST", "/api/customers", {
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone,
        address: leadData.address,
      });
      const customerData = await customerRes.json();
      console.log("✅ Customer created:", customerData.data.id);
      const customerId = customerData.data.id;

      // Detect if phone is a mobile number (NZ mobiles start with 02, +642, etc.)
      const cleanPhone = (leadData.phone || "").replace(/\s/g, "");
      const isMobileNumber = /^(\+?64)?0?2[0-9]/.test(cleanPhone);

      // Create a job with status "quote" so it shows up on dispatch board.
      // conversationId threads through so the server can dedupe against an
      // already-converted conversation and avoid inserting a second job row.
      const jobData = {
        customerId: customerId,
        title: leadData.name,
        description:
          leadData.serviceRequested ||
          leadData.notes ||
          "Quote from conversation",
        address: leadData.address || "",
        status: "quote",
        priority: leadData.urgency || "medium",
        leadSource: "quote_request",
        totalAmount: "0.00",
        paidAmount: "0.00",
        jobContactPhone: isMobileNumber ? "" : leadData.phone || "",
        jobContactMobile: isMobileNumber ? leadData.phone || "" : "",
        conversationId: sourceConversationId,
      };

      console.log("🔵 Creating job with data:", jobData);
      const jobRes = await apiRequest("POST", "/api/jobs", jobData);
      const jobResponseData = await jobRes.json();
      console.log("✅ Job created:", jobResponseData);

      // Mark the source conversation as converted so the Create Job menu
      // item is disabled on re-entry — mirrors GlobalJobCard.tsx:1958-1982.
      if (sourceConversationId) {
        try {
          await apiRequest("PATCH", `/api/conversations/${sourceConversationId}`, {
            status: "converted",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        } catch (err) {
          console.error("Failed to mark conversation as converted:", err);
        }
      }

      return jobResponseData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowCreateJobDialog(false);
      jobForm.reset();
      setLocation("/dispatch");
    },
    onError: (error: any) => {
      console.error("❌ Quote creation error:", error);
      toast({
        title: "Failed to create quote",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Facebook message extraction handler
  const handleExtractFacebookMessage = async () => {
    if (!facebookPasteText.trim()) return;
    setIsExtractingFacebook(true);
    try {
      const res = await apiRequest("POST", "/api/ai/extract-facebook-message", {
        messageText: facebookPasteText,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const extracted = data.data;
      const firstName = extracted.firstName || "";
      const lastName = extracted.lastName || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || "";
      opportunityForm.reset({
        name: fullName,
        email: extracted.email || "",
        phone: extracted.phone || "",
        address: extracted.address || "",
        serviceRequested: extracted.description || "",
        urgency: "medium",
        status: "new",
        source: "facebook",
        notes: facebookPasteText,
      });
      setShowFacebookPasteDialog(false);
      setFacebookPasteText("");
      setShowCreateOpportunityDialog(true);
    } catch (err) {
      toast({
        title: "Could not extract details — please fill in manually",
        variant: "destructive",
      });
      setShowFacebookPasteDialog(false);
      opportunityForm.reset({
        name: "",
        email: "",
        phone: "",
        address: "",
        serviceRequested: "",
        urgency: "medium",
        status: "new",
        source: "facebook",
        notes: facebookPasteText,
      });
      setShowCreateOpportunityDialog(true);
    } finally {
      setIsExtractingFacebook(false);
    }
  };

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/conversations/bulk", { ids });
    },
    onSuccess: () => {
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

  // Toggle selection functions
  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === conversations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(conversations.map((c: Conversation) => c.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  // Helper functions
  const getInitials = (title: string) => {
    const words = title.split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.substring(0, 2).toUpperCase();
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  const truncateMessage = (message: string, maxLength: number = 80) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + "...";
  };

  const handleConversationClick = async (conversation: Conversation) => {
    // Mark messages as read before navigating
    if (conversation.unreadCount && conversation.unreadCount > 0) {
      try {
        await fetch(`/api/conversations/${conversation.id}/messages/read`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        });
        // Refresh conversations to update unread count
        queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    }
    // Navigate to conversation detail page
    setLocation(`/conversation/${conversation.id}`);
  };

  return (
    <div className="flex flex-col h-full bg-white w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b w-full gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            aria-label="Open menu"
            data-testid="button-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-2">
              <h1
                className="text-base sm:text-lg font-semibold truncate"
                data-testid="text-title"
              >
                Treemarkables
              </h1>
              <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">
                v13
              </span>
              <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
            </div>
            <p className="text-xs text-gray-500">Gisborne</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="flex-shrink-0 flex items-center gap-1.5 text-[#1877F2] border-[#1877F2]/30"
          onClick={() => {
            setFacebookPasteText("");
            setShowFacebookPasteDialog(true);
          }}
          data-testid="button-from-facebook"
        >
          <SiFacebook className="h-4 w-4" />
          <span className="hidden sm:inline">From Facebook</span>
        </Button>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b overflow-x-auto scrollbar-hide">
        <Button
          variant="outline"
          size="sm"
          className="flex-shrink-0 text-xs sm:text-sm"
          data-testid="button-filter"
        >
          <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Filter
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
        <Button
          variant={filterType === "internal" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("internal")}
          className="flex-shrink-0 text-xs sm:text-sm"
          data-testid="button-internal-chat"
        >
          Internal Chat
        </Button>
        <Button
          variant={filterType === "recent" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("recent")}
          className="flex-shrink-0 text-xs sm:text-sm"
          data-testid="button-recent"
        >
          Recent
        </Button>
        <Button
          variant={filterType === "unread" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterType("unread")}
          className="flex-shrink-0 text-xs sm:text-sm"
          data-testid="button-unread"
        >
          Unread
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {conversations.length > 0 && (
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={
                selectedIds.size === conversations.length &&
                conversations.length > 0
              }
              onCheckedChange={toggleSelectAll}
              data-testid="checkbox-select-all"
            />
            <label
              htmlFor="select-all"
              className="text-xs sm:text-sm text-muted-foreground cursor-pointer"
            >
              Select all ({conversations.length})
            </label>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium">
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
                    Delete
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
                Clear
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <p className="text-gray-500 text-sm">No conversations found</p>
            <p className="text-gray-400 text-xs mt-1">
              New conversations will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {console.log(
              "🔍 [v13 DEBUG] Rendering conversations:",
              conversations.length,
              conversations.map((c) => c.id),
            )}
            {conversations.map((conversation: Conversation) => {
              console.log(
                "🔍 [v13 DEBUG] Rendering conversation item:",
                conversation.id,
                conversation.title,
              );
              return (
                <div
                  key={conversation.id}
                  className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 hover-elevate active-elevate-2 ${selectedIds.has(conversation.id) ? "bg-primary/10" : ""}`}
                  data-testid={`conversation-item-${conversation.id}`}
                >
                  {/* Selection Checkbox */}
                  <Checkbox
                    checked={selectedIds.has(conversation.id)}
                    onCheckedChange={() => toggleSelectOne(conversation.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                    data-testid={`checkbox-conversation-${conversation.id}`}
                  />

                  {/* Avatar with Badge */}
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-11 w-11 sm:h-12 sm:w-12 bg-gray-200">
                      <AvatarFallback className="text-gray-600 font-medium">
                        {getInitials(
                          (conversation as any).customerName ||
                            conversation.title,
                        )}
                      </AvatarFallback>
                    </Avatar>
                    {conversation.source === "social" && (
                      <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
                        <div className="bg-blue-600 rounded-full p-0.5">
                          <Facebook
                            className="h-3 w-3 text-white"
                            fill="currentColor"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Conversation Info */}
                  <div
                    className="flex-1 min-w-0 overflow-hidden cursor-pointer"
                    onClick={() => handleConversationClick(conversation)}
                  >
                    <div className="flex items-baseline gap-1 sm:gap-2">
                      <h3
                        className="font-semibold text-sm sm:text-base text-gray-900 truncate flex-1 min-w-0"
                        data-testid={`text-name-${conversation.id}`}
                      >
                        {(conversation as any).customerName ||
                          conversation.title}
                      </h3>
                      <span
                        className="text-[10px] sm:text-xs text-gray-500 flex-shrink-0 ml-auto whitespace-nowrap"
                        data-testid={`text-date-${conversation.id}`}
                      >
                        {formatDate(
                          conversation.lastMessageAt ||
                            conversation.createdAt ||
                            new Date(),
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
                      <p
                        className="text-xs sm:text-sm text-gray-600 truncate flex-1 min-w-0"
                        data-testid={`text-preview-${conversation.id}`}
                      >
                        {truncateMessage(conversation.title)}
                      </p>
                      {(conversation as any).source ===
                        "facebook_messenger" && (
                        <Badge className="flex-shrink-0 bg-[#1877F2] text-white text-[9px] px-1.5 py-0 h-4 gap-0.5 no-default-active-elevate">
                          <SiFacebook className="h-2.5 w-2.5" />
                          Messenger
                        </Badge>
                      )}
                      {(conversation as any).source === "facebook" && (
                        <Badge className="flex-shrink-0 bg-[#1877F2] text-white text-[9px] px-1.5 py-0 h-4 gap-0.5 no-default-active-elevate">
                          <SiFacebook className="h-2.5 w-2.5" />
                          Facebook
                        </Badge>
                      )}
                      {conversation.unreadCount &&
                        conversation.unreadCount > 0 && (
                          <div
                            className="flex-shrink-0 bg-green-500 text-white text-[10px] sm:text-xs font-semibold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center ml-auto"
                            data-testid={`badge-unread-${conversation.id}`}
                          >
                            {conversation.unreadCount}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Action Menu - v13 DEBUG */}
                  <div className="flex-shrink-0 bg-red-500 p-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="flex-shrink-0 h-8 w-8 border-2 border-black bg-yellow-300"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Conversation actions"
                          data-testid={`button-actions-${conversation.id}`}
                        >
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={conversation.status === "converted"}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (conversation.status === "converted") return;
                            setSelectedConversation(conversation);

                            // Fetch messages for this conversation to extract contact details
                            let fetchedMessages: any[] = [];
                            try {
                              const response = await fetch(
                                `/api/conversations/${conversation.id}/messages`,
                              );
                              if (response.ok) {
                                const data = await response.json();
                                fetchedMessages = data.data || [];
                              }
                            } catch (error) {
                              console.error("Error fetching messages:", error);
                            }

                            // Extract contact details from conversation and messages
                            const { name, email, phone, address } =
                              extractContactDetails(
                                conversation,
                                fetchedMessages,
                              );

                            jobForm.reset({
                              name: name,
                              email: email,
                              phone: phone,
                              address: address,
                              serviceRequested: "",
                              urgency: "medium",
                              status: "new",
                              notes: `From conversation: ${conversation.title || ""}`,
                            });
                            setShowCreateJobDialog(true);
                          }}
                          data-testid={`menuitem-create-job-${conversation.id}`}
                        >
                          <Briefcase className="h-4 w-4 mr-2" />
                          Create Job from Lead
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async (e) => {
                            e.stopPropagation();
                            setSelectedConversation(conversation);

                            // Fetch messages for this conversation to extract contact details
                            let fetchedMessages: any[] = [];
                            try {
                              const response = await fetch(
                                `/api/conversations/${conversation.id}/messages`,
                              );
                              if (response.ok) {
                                const data = await response.json();
                                fetchedMessages = data.data || [];
                              }
                            } catch (error) {
                              console.error("Error fetching messages:", error);
                            }

                            // Extract contact details from conversation and messages
                            const { name, email, phone, address } =
                              extractContactDetails(
                                conversation,
                                fetchedMessages,
                              );

                            opportunityForm.reset({
                              name: name,
                              email: email,
                              phone: phone,
                              address: address,
                              serviceRequested: "",
                              urgency: "medium",
                              status: "new",
                              notes: `Converted from conversation: ${conversation.title || ""}`,
                            });
                            setShowCreateOpportunityDialog(true);
                          }}
                          data-testid={`menuitem-create-opportunity-${conversation.id}`}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Create Opportunity
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Reply Dialog */}
      <Dialog open={showReplyDialog} onOpenChange={setShowReplyDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Reply to {selectedConversation?.title}</DialogTitle>
            <DialogDescription>
              Send a response via{" "}
              {messages.find(
                (m: ConversationMessage) => m.direction === "inbound",
              )?.platform || "the original channel"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reply-content">Message</Label>
              <Textarea
                id="reply-content"
                data-testid="textarea-reply-content"
                placeholder="Type your reply here..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReplyDialog(false);
                setReplyContent("");
              }}
              data-testid="button-cancel-reply"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedConversation && replyContent.trim()) {
                  replyMutation.mutate({
                    conversationId: selectedConversation.id,
                    content: replyContent,
                  });
                }
              }}
              disabled={!replyContent.trim() || replyMutation.isPending}
              data-testid="button-send-reply"
            >
              {replyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reply"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Job Dialog */}
      <LeadFormDialog
        open={showCreateJobDialog}
        onOpenChange={setShowCreateJobDialog}
        title="Create Job from Lead"
        description="Create a new job from this conversation"
        submitLabel="Create Job"
        isSubmitting={createJobMutation.isPending}
        form={jobForm}
        onSubmit={(values) =>
          createJobMutation.mutate({ ...values, status: "new" })
        }
        includeStatus={false}
        testIdPrefix="job"
      />

      {/* Create Opportunity Dialog */}
      <LeadFormDialog
        open={showCreateOpportunityDialog}
        onOpenChange={setShowCreateOpportunityDialog}
        title="Create Opportunity"
        description="Add a new lead to your sales pipeline"
        submitLabel="Create Opportunity"
        isSubmitting={createOpportunityMutation.isPending}
        form={opportunityForm}
        onSubmit={(values) => createOpportunityMutation.mutate(values)}
        includeStatus={true}
        testIdPrefix="opportunity"
      />

      {/* Facebook Paste Dialog */}
      <Dialog
        open={showFacebookPasteDialog}
        onOpenChange={setShowFacebookPasteDialog}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiFacebook className="h-5 w-5 text-[#1877F2]" />
              Create Lead from Facebook Message
            </DialogTitle>
            <DialogDescription>
              Copy the conversation from your Facebook inbox and paste it below.
              AI will extract the customer's details and pre-fill the lead form.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder={
                "Paste the Facebook message conversation here...\n\nE.g.:\nHi, I need 3 large pine trees removed from my property at 24 Oak Street, Gisborne. Can you give me a quote? My number is 021 234 5678.\n— Sarah"
              }
              value={facebookPasteText}
              onChange={(e) => setFacebookPasteText(e.target.value)}
              rows={10}
              className="resize-none"
              data-testid="textarea-facebook-paste"
            />
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFacebookPasteDialog(false)}
              data-testid="button-facebook-paste-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExtractFacebookMessage}
              disabled={!facebookPasteText.trim() || isExtractingFacebook}
              className="bg-[#1877F2] text-white"
              data-testid="button-facebook-extract"
            >
              {isExtractingFacebook ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Extract Details
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
