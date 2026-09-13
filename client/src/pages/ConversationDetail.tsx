import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Conversation, ConversationMessage, Job } from "@shared/schema";
import {
  ArrowLeft,
  Send,
  Loader2,
  MoreVertical,
  Phone,
  Video,
  Calendar,
  Star,
  Activity,
  MessageSquare,
  Trash2,
  Briefcase,
  Copy,
  Check,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { MicrophoneButton } from "@/components/MicrophoneButton";

// Component to render a contact field with copy button
function ContactField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-500">{label}:</span>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        data-testid={`button-copy-${label.toLowerCase().replace(/\s/g, "-")}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

// Parse contact form message
function parseContactForm(content: string) {
  const nameMatch = content.match(/Name:\s*([^\n]+)/i);
  const emailMatch = content.match(/Email:\s*([^\n]+)/i);
  const phoneMatch = content.match(/Phone:\s*([^\n]+)/i);
  const hearAboutMatch = content.match(/How they heard about us:\s*([^\n]+)/i);
  const messageMatch = content.match(/Message:\s*\n?([\s\S]+?)$/i);

  return {
    isContactForm: !!(nameMatch || emailMatch || phoneMatch),
    name: nameMatch?.[1]?.trim(),
    email: emailMatch?.[1]?.trim(),
    phone: phoneMatch?.[1]?.trim(),
    hearAbout: hearAboutMatch?.[1]?.trim(),
    message: messageMatch?.[1]?.trim(),
  };
}

export default function ConversationDetail() {
  const [, params] = useRoute("/conversation/:id");
  const [, setLocation] = useLocation();
  const conversationId = params?.id;
  const [replyContent, setReplyContent] = useState("");
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  // Create Job form state
  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    serviceRequested: "",
    urgency: "medium" as "low" | "medium" | "high" | "emergency",
    status: "new_lead" as
      | "new_lead"
      | "quote_scheduled"
      | "proposal_sent"
      | "closed",
    notes: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch conversation details
  const { data: conversationResponse, isLoading: isLoadingConversation } =
    useQuery({
      queryKey: ["/api/conversations", conversationId],
      queryFn: async () => {
        const response = await fetch(`/api/conversations/${conversationId}`);
        if (!response.ok) throw new Error("Failed to fetch conversation");
        return response.json();
      },
      enabled: !!conversationId,
    });

  const conversation: Conversation | undefined = conversationResponse?.data;

  // Fetch conversation messages
  const { data: messagesResponse, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["/api/conversations", conversationId, "messages"],
    queryFn: async () => {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
      );
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: !!conversationId,
  });

  const messages: ConversationMessage[] = messagesResponse?.data || [];

  // Derive the sender display name — use the first inbound message's fromName,
  // or fall back to extracting it from the conversation title ("Email from X" → "X")
  const firstInboundMessage = messages.find((m) => m.direction === "inbound");
  const senderEmail = firstInboundMessage?.fromContact || null;

  const senderDisplayName = (() => {
    if (firstInboundMessage?.fromName) return firstInboundMessage.fromName;
    if (conversation?.title) {
      const match = conversation.title.match(
        /^(?:Email from|SMS from|Message from)\s+(.+)$/i,
      );
      if (match) return match[1];
    }
    return null;
  })();

  // Look up any existing jobs that have this sender's email as the contact email
  const { data: linkedJobsResponse } = useQuery({
    queryKey: ["/api/jobs/by-contact-email", senderEmail],
    queryFn: async () => {
      const res = await fetch(
        `/api/jobs/by-contact-email?email=${encodeURIComponent(senderEmail!)}`,
      );
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: !!senderEmail && senderEmail.includes("@"),
    staleTime: 30000,
  });
  const linkedJobs: Array<{
    id: string;
    jobNumber: number;
    title: string | null;
    address: string | null;
    status: string;
  }> = linkedJobsResponse?.data || [];

  // Helper function to extract contact details from conversation and messages
  const extractContactDetails = () => {
    let name = "";
    let email = "";
    let phone = "";
    let address = "";
    let description = "";
    let leadSource = "";

    // Debug: Log the full conversation object to see what the API returns
    console.log("🔍 Full conversation object:", conversation);

    // First priority: Extract customer data from joined API response
    if ((conversation as any)?.customerName) {
      name = (conversation as any).customerName.trim();
    }
    if ((conversation as any)?.customerPhone) {
      phone = (conversation as any).customerPhone;
    }
    if ((conversation as any)?.customerEmail) {
      email = (conversation as any).customerEmail;
    }
    if ((conversation as any)?.customerAddress) {
      address = (conversation as any).customerAddress;
    }

    // Extract contact details from messages (using parseContactForm patterns)
    messages.forEach((msg) => {
      const content = msg.content || "";

      // Extract "Message:" field for full description (priority)
      if (!description) {
        const messageMatch = content.match(
          /Message:\s*([\s\S]*?)(?=(?:Name:|Email:|Phone:|How they heard|$))/i,
        );
        if (messageMatch && messageMatch[1]) {
          description = messageMatch[1].trim();
        }
      }
    });

    // Fallback: Use full first customer message as description if no Message: field found
    if (!description && messages.length > 0) {
      const firstCustomerMessage = messages.find(
        (m) => m.direction === "inbound",
      );
      if (firstCustomerMessage?.content) {
        // Get content after stripping form fields
        let content = firstCustomerMessage.content;
        // Remove form field patterns to get the actual message
        content = content.replace(/Name:\s*[^\n]+\n?/gi, "");
        content = content.replace(/Email:\s*[^\n]+\n?/gi, "");
        content = content.replace(/Phone:\s*[^\n]+\n?/gi, "");
        content = content.replace(/How they heard about us:\s*[^\n]+\n?/gi, "");
        description = content.trim();
      }
    }

    // Final fallback: Use conversation title (may be truncated)
    if (!description && conversation?.title) {
      description = conversation.title;
    }

    // Extract contact details from messages (using parseContactForm patterns)
    messages.forEach((msg) => {
      const content = msg.content || "";

      // Extract Name from "Name: ..." pattern in message content
      if (!name) {
        const nameMatch = content.match(/Name:\s*([^\n]+)/i);
        if (nameMatch && nameMatch[1]) {
          name = nameMatch[1].trim();
        }
      }

      // Extract Email from "Email: ..." pattern in message content
      if (!email) {
        const emailLabelMatch = content.match(/Email:\s*([^\n]+)/i);
        if (emailLabelMatch && emailLabelMatch[1]) {
          email = emailLabelMatch[1].trim();
        }
      }

      // Extract Phone from "Phone: ..." pattern in message content
      if (!phone) {
        const phoneLabelMatch = content.match(/Phone:\s*([^\n]+)/i);
        if (phoneLabelMatch && phoneLabelMatch[1]) {
          phone = phoneLabelMatch[1].trim();
        }
      }

      // Extract "How they heard about us" - lead source
      if (!leadSource) {
        const hearAboutMatch = content.match(
          /How they heard about us:\s*([^\n]+)/i,
        );
        if (hearAboutMatch) {
          const source = hearAboutMatch[1].trim();
          // Map common answers to lead source values
          const sourceMap: Record<string, string> = {
            google: "google",
            "google search": "google",
            "google ads": "ppc",
            ppc: "ppc",
            "google maps": "google_maps",
            seo: "seo",
            organic: "seo",
            facebook: "facebook",
            instagram: "instagram",
            friend: "referral",
            referral: "referral",
            "word of mouth": "referral",
            advertisement: "advertisement",
            ad: "advertisement",
            website: "website",
            repeat: "repeat",
            "previous customer": "repeat",
            council: "council",
            direct: "direct",
            phone: "phone",
            "saw you working": "saw_working",
            other: "other",
          };

          const sourceLower = source.toLowerCase();
          leadSource = sourceMap[sourceLower] || "website";
        }
      }

      // Fallback: Extract email from any email pattern - only if not already set
      if (!email) {
        const emailMatch = content.match(
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        );
        if (emailMatch) {
          email = emailMatch[0];
        }
      }

      // Fallback: Extract phone (NZ format) - only if not already set
      if (!phone) {
        const phonePatterns = [
          /\+64\s?\d{1,3}\s?\d{3,4}\s?\d{4}/, // +64 21 123 4567
          /\b0\d{1,3}[-\s]?\d{3,4}[-\s]?\d{4}\b/, // 021-123-4567, 021 123 4567
          /\(\d{2,3}\)\s?\d{3,4}[-\s]?\d{4}/, // (021) 123-4567
        ];

        for (const pattern of phonePatterns) {
          const phoneMatch = content.match(pattern);
          if (phoneMatch) {
            phone = phoneMatch[0].replace(/\s+/g, " ").trim();
            break;
          }
        }
      }

      // Extract address (NZ patterns) - only if not already set
      if (!address) {
        const addressPatterns = [
          /\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Place|Pl|Way|Terrace|Tce|Crescent|Cres|Court|Ct|Close|Highway|Hwy)[,\s]+[A-Z][a-z]+/i,
          /\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr)/i,
        ];

        for (const pattern of addressPatterns) {
          const addressMatch = content.match(pattern);
          if (addressMatch) {
            address = addressMatch[0].trim();
            break;
          }
        }
      }
    });

    // For SMS/phone conversations: use fromContact of first inbound message as phone/email
    if (!phone && !email) {
      const firstInboundMsg = messages.find((m) => m.direction === "inbound");
      const contact = firstInboundMsg?.fromContact || "";
      if (contact) {
        if (contact.includes("@")) {
          email = contact;
        } else {
          phone = contact;
        }
      }
    } else if (!phone) {
      const firstInboundMsg = messages.find((m) => m.direction === "inbound");
      const contact = firstInboundMsg?.fromContact || "";
      if (contact && !contact.includes("@")) {
        phone = contact;
      }
    }

    // Also use fromName of first inbound message as name fallback
    if (!name) {
      const firstInboundMsg = messages.find((m) => m.direction === "inbound");
      if (firstInboundMsg?.fromName) {
        name = firstInboundMsg.fromName.trim();
      }
    }

    // Last resort: If name is still empty but we have email, extract name from email
    if (!name && email) {
      const emailParts = email.split("@")[0]; // Get part before @
      const nameParts = emailParts.split(/[._-]/); // Split on dots, underscores, hyphens

      // Capitalize each part
      const capitalizedParts = nameParts.map(
        (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
      );

      name = capitalizedParts.join(" ").trim();
    }

    // Extract first name and last name from full name
    let firstName = "";
    let lastName = "";
    if (name) {
      const nameParts = name.trim().split(/\s+/);
      if (nameParts.length === 1) {
        firstName = nameParts[0];
      } else if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      }
    }

    console.log("🔍 Extracted contact details:", {
      name,
      firstName,
      lastName,
      email,
      phone,
      address,
      leadSource,
      description: description.substring(0, 100),
    });

    return {
      name,
      firstName,
      lastName,
      email,
      phone,
      address,
      leadSource,
      description, // Return full description without truncation
    };
  };

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/reply`, {
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", conversationId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setReplyContent("");
    },
    onError: () => {
      toast({
        title: "Failed to send message",
        description: "Please try again or check your connection.",
        variant: "destructive",
      });
    },
  });

  // Create Job mutation — actually creates a job and redirects to it
  const createJobMutation = useMutation<Job, Error, typeof leadForm>({
    mutationFn: async (formValues) => {
      // First, create or find customer using values from the dialog form
      const customerRes = await apiRequest("POST", "/api/customers", {
        name: formValues.name,
        email: formValues.email,
        phone: formValues.phone,
        address: formValues.address,
      });
      const customerData = (await customerRes.json()) as {
        data: { id: string };
      };
      const customerId = customerData.data.id;

      // Detect if phone is a mobile number (NZ mobiles start with 02, +642, etc.)
      const cleanPhone = (formValues.phone || "").replace(/\s/g, "");
      const isMobileNumber = /^(\+?64)?0?2[0-9]/.test(cleanPhone);

      // Carry leadSource through from the original conversation extraction so
      // the new job records where the inquiry came from.
      const extractedSource = extractContactDetails().leadSource || "website";

      const jobData = {
        customerId,
        title: formValues.name || "Lead from conversation",
        description:
          formValues.serviceRequested || formValues.notes || "",
        address: formValues.address || "",
        status: "lead",
        priority: formValues.urgency || "medium",
        leadSource: extractedSource,
        totalAmount: "0.00",
        paidAmount: "0.00",
        jobContactPhone: isMobileNumber ? "" : formValues.phone || "",
        jobContactMobile: isMobileNumber ? formValues.phone || "" : "",
        conversationId: conversationId,
      };

      const jobRes = await apiRequest("POST", "/api/jobs", jobData);
      const jobResponseData = (await jobRes.json()) as { data: Job };
      const job = jobResponseData.data;

      // Mark the conversation as converted so the "Already Converted" state
      // shows correctly on revisit. The job has already been created, so
      // failure here is best-effort: surface a warning toast but still
      // redirect the user to their new job rather than encouraging a retry
      // that would create a duplicate job.
      if (conversationId) {
        try {
          await apiRequest("PATCH", `/api/conversations/${conversationId}`, {
            status: "converted",
            conversionDate: new Date().toISOString(),
          });
        } catch (err) {
          console.error("Failed to mark conversation converted:", err);
          toast({
            title: "Job created",
            description:
              "Couldn't update conversation status; you may see this conversation as unconverted.",
            variant: "destructive",
          });
        }
      }

      return job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/conversations", conversationId],
      });
      setShowCreateJob(false);
      setLocation(job?.id ? `/dispatch?job=${job.id}` : "/dispatch");
    },
    onError: (error) => {
      toast({
        title: "Failed to create job",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete Conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/conversations/${conversationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setLocation("/opportunities");
    },
    onError: () => {
      toast({
        title: "Failed to delete conversation",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSendReply = () => {
    if (!replyContent.trim()) return;
    replyMutation.mutate({ content: replyContent });
  };

  const getInitials = (title: string) => {
    const words = title.split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.substring(0, 2).toUpperCase();
  };

  const formatMessageTime = (dateString: string | Date) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "";
    }
  };

  if (isLoadingConversation || isLoadingMessages) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-gray-500">Conversation not found</p>
        <Button
          variant="outline"
          onClick={() => setLocation("/opportunities")}
          className="mt-4"
        >
          Back to Conversations
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col absolute top-0 left-0 right-0 bottom-20 bg-white dark:bg-gray-950 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-3 sm:px-4 py-3 sm:py-4 border-b bg-white dark:bg-gray-950 flex-shrink-0 w-full gap-2 sm:gap-4">
        <div className="flex items-start gap-1.5 sm:gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 mt-1"
            onClick={() => setLocation("/opportunities")}
            aria-label="Back to opportunities"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1
              className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 break-words line-clamp-2 leading-snug"
              title={conversation.title}
              data-testid="text-conversation-title"
            >
              {conversation.title}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 capitalize mt-0.5 truncate">
              {conversation.source}
              {senderDisplayName && (
                <span className="normal-case">
                  {" "}
                  · From:{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {senderDisplayName}
                  </span>
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
          {conversation.status !== "converted" &&
            !conversation.conversionDate && (
              <Button
                size="sm"
                onClick={() => {
                  const extracted = extractContactDetails();
                  setLeadForm({
                    name: extracted.name || conversation?.title || "New Lead",
                    email: extracted.email || "",
                    phone: extracted.phone || "",
                    address: extracted.address || "",
                    serviceRequested: extracted.description || "",
                    urgency: "medium",
                    status: "new_lead",
                    notes: `Lead from conversation: ${conversation?.title || ""}`,
                  });
                  setShowCreateJob(true);
                }}
                data-testid="button-create-job-header"
              >
                <Briefcase className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Create job card</span>
                <span className="sm:hidden">Job card</span>
              </Button>
            )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowManageMenu(true)}
            aria-label="Manage conversation"
            data-testid="button-more"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Linked jobs banner — shown when the sender's email matches a job contact */}
      {linkedJobs.length > 0 && (
        <div className="flex-shrink-0 border-b border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 sm:px-4 py-2">
          <div className="flex items-start gap-2">
            <Link2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 leading-snug">
                This sender is already a contact on{" "}
                {linkedJobs.length === 1
                  ? "a job"
                  : `${linkedJobs.length} jobs`}
                :
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {linkedJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => setLocation(`/jobs/${job.id}`)}
                    className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 rounded px-2 py-0.5 hover-elevate font-medium truncate max-w-[200px]"
                    title={job.address || job.title || `Job #${job.jobNumber}`}
                  >
                    #{job.jobNumber}
                    {job.address
                      ? ` · ${job.address}`
                      : job.title
                        ? ` · ${job.title}`
                        : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 sm:px-4 py-2">
        <div className="space-y-2 sm:space-y-3">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                No messages yet
              </p>
            </div>
          ) : (
            messages.map((message: ConversationMessage) => {
              const contactForm = parseContactForm(message.content || "");

              return (
                <div
                  key={message.id}
                  className={`flex w-full ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${message.id}`}
                >
                  <div className="max-w-[85%] sm:max-w-[75%]">
                    {message.direction === "inbound" && message.fromName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 px-1 font-medium">
                        {message.fromName}
                      </p>
                    )}
                    <div
                      className={`rounded-lg px-3 py-2 ${
                        message.direction === "outbound"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {contactForm.isContactForm ? (
                        <div className="space-y-1">
                          {contactForm.name && (
                            <ContactField
                              label="Name"
                              value={contactForm.name}
                            />
                          )}
                          {contactForm.email && (
                            <ContactField
                              label="Email"
                              value={contactForm.email}
                            />
                          )}
                          {contactForm.phone && (
                            <ContactField
                              label="Phone"
                              value={contactForm.phone}
                            />
                          )}
                          {contactForm.hearAbout && (
                            <ContactField
                              label="How they heard about us"
                              value={contactForm.hearAbout}
                            />
                          )}
                          {contactForm.message && (
                            <div className="pt-2 mt-2 border-t border-gray-200">
                              <span className="text-xs text-gray-500">
                                Message:
                              </span>
                              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed mt-1">
                                {contactForm.message}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {message.content}
                        </p>
                      )}
                      <p
                        className={`text-xs mt-1 ${
                          message.direction === "outbound"
                            ? "text-blue-100"
                            : "text-gray-500"
                        }`}
                      >
                        {formatMessageTime(message.createdAt || new Date())}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t bg-white dark:bg-gray-950 px-3 sm:px-4 py-2 sm:py-3 flex-shrink-0 mb-4 w-full">
        <div className="flex items-end gap-1.5 sm:gap-2 w-full">
          <Textarea
            placeholder="Type a message..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="flex-1 min-w-0 min-h-[40px] sm:min-h-[44px] max-h-[100px] sm:max-h-[120px] resize-none text-sm sm:text-base"
            data-testid="textarea-message-input"
          />
          <MicrophoneButton
            onTranscript={(transcript) => {
              setReplyContent((prev) =>
                prev ? `${prev} ${transcript}` : transcript,
              );
            }}
            className="flex-shrink-0 h-9 w-9 sm:h-11 sm:w-11"
          />
          <Button
            size="icon"
            onClick={handleSendReply}
            disabled={!replyContent.trim() || replyMutation.isPending}
            aria-label="Send reply"
            className="flex-shrink-0 h-9 w-9 sm:h-11 sm:w-11 bg-blue-600 hover:bg-blue-700"
            data-testid="button-send"
          >
            {replyMutation.isPending ? (
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Manage Menu Sheet */}
      <Sheet open={showManageMenu} onOpenChange={setShowManageMenu}>
        <SheetContent side="bottom" className="h-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-center text-lg font-semibold">
              Manage
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-1">
            {/* Schedule Appointment */}
            <button
              onClick={() => {
                setShowManageMenu(false);
                setLocation("/calendar");
              }}
              className="w-full flex items-center gap-4 px-4 py-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-schedule-appointment"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-medium text-gray-900">
                Schedule Appointment
              </span>
            </button>

            {/* Create Job from Lead - disabled if already converted */}
            {conversation?.status === "converted" ||
            conversation?.conversionDate ? (
              <div
                className="w-full flex items-center gap-4 px-4 py-4 rounded-lg opacity-50 cursor-not-allowed"
                data-testid="button-create-job-disabled"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-400 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <span className="text-base font-medium text-gray-500">
                  Already Converted to Job
                </span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowManageMenu(false);
                  const extracted = extractContactDetails();
                  setLeadForm({
                    name: extracted.name || conversation?.title || "New Lead",
                    email: extracted.email || "",
                    phone: extracted.phone || "",
                    address: extracted.address || "",
                    serviceRequested: extracted.description || "",
                    urgency: "medium",
                    status: "new",
                    notes: `Lead from conversation: ${conversation?.title || ""}`,
                  });
                  setShowCreateJob(true);
                }}
                className="w-full flex items-center gap-4 px-4 py-4 hover-elevate active-elevate-2 rounded-lg"
                data-testid="button-create-job"
              >
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <span className="text-base font-medium text-gray-900">
                  Create Job from Lead
                </span>
              </button>
            )}

            {/* Send Review Request */}
            <button
              onClick={() => {
                setShowManageMenu(false);
                toast({
                  title: "Send Review Request",
                  description: "Feature coming soon",
                });
              }}
              className="w-full flex items-center gap-4 px-4 py-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-send-review-request"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                <Star className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-medium text-gray-900">
                Send Review Request
              </span>
            </button>

            {/* Show Activity */}
            <div className="w-full flex items-center justify-between gap-4 px-4 py-4 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <span className="text-base font-medium text-gray-900">
                  Show Activity
                </span>
              </div>
              <Switch
                checked={showActivity}
                onCheckedChange={setShowActivity}
                data-testid="switch-show-activity"
              />
            </div>

            {/* Add Internal Comments */}
            <button
              onClick={() => {
                setShowManageMenu(false);
                toast({
                  title: "Add Internal Comments",
                  description: "Feature coming soon",
                });
              }}
              className="w-full flex items-center gap-4 px-4 py-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-add-internal-comments"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-medium text-gray-900">
                Add Internal Comments
              </span>
            </button>

            <Separator className="my-2" />

            {/* Delete Conversation */}
            <button
              onClick={() => {
                setShowManageMenu(false);
                setShowDeleteConfirm(true);
              }}
              className="w-full flex items-center gap-4 px-4 py-4 hover-elevate active-elevate-2 rounded-lg"
              data-testid="button-delete-conversation"
            >
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-500 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-medium text-red-600">
                Delete Conversation
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Job Dialog */}
      <Dialog open={showCreateJob} onOpenChange={setShowCreateJob}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Job from Lead</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="job-name">Name</Label>
              <Input
                id="job-name"
                value={leadForm.name}
                onChange={(e) =>
                  setLeadForm({ ...leadForm, name: e.target.value })
                }
                placeholder="Customer name"
                data-testid="input-job-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-phone">Phone</Label>
              <Input
                id="job-phone"
                value={leadForm.phone}
                onChange={(e) =>
                  setLeadForm({ ...leadForm, phone: e.target.value })
                }
                placeholder="Phone number"
                data-testid="input-job-phone"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-email">Email</Label>
              <Input
                id="job-email"
                type="email"
                value={leadForm.email}
                onChange={(e) =>
                  setLeadForm({ ...leadForm, email: e.target.value })
                }
                placeholder="Email address"
                data-testid="input-job-email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-address">Address</Label>
              <Input
                id="job-address"
                value={leadForm.address}
                onChange={(e) =>
                  setLeadForm({ ...leadForm, address: e.target.value })
                }
                placeholder="Property address"
                data-testid="input-job-address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-service">Service Requested</Label>
              <Textarea
                id="job-service"
                value={leadForm.serviceRequested}
                onChange={(e) =>
                  setLeadForm({ ...leadForm, serviceRequested: e.target.value })
                }
                placeholder="Describe the work needed"
                className="min-h-[80px]"
                data-testid="textarea-job-service"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-notes">Notes</Label>
              <Textarea
                id="job-notes"
                value={leadForm.notes}
                onChange={(e) =>
                  setLeadForm({ ...leadForm, notes: e.target.value })
                }
                placeholder="Additional notes or context"
                className="min-h-[80px]"
                data-testid="textarea-job-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateJob(false)}
              data-testid="button-cancel-job"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createJobMutation.mutate(leadForm)}
              disabled={createJobMutation.isPending}
              data-testid="button-submit-job"
            >
              {createJobMutation.isPending ? "Creating..." : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Conversation?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this conversation? This action
              cannot be undone and all messages will be permanently removed.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteConversationMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConversationMutation.mutate()}
              disabled={deleteConversationMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteConversationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Conversation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
