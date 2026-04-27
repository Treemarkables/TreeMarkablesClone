import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import {
  Search,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  DollarSign,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  PhoneCall,
  FileText,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

interface FollowUpQuote {
  id: string;
  quoteNumber: string;
  amount: string;
  status: string;
  sentDate: string | null;
  validUntil: string | null;
  followUpStatus: string | null;
  followUpCount: number | null;
  lastFollowUpDate: string | null;
  nextFollowUpDate: string | null;
  followUpNotes: string | null;
  daysSinceSent: number | null;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  job: {
    id: string;
    jobNumber: string;
    title: string;
    address?: string;
    description?: string;
    status?: string;
  } | null;
}

// Get job status color (matching DispatchBoard)
const getJobStatusColor = (status?: string) => {
  switch (status?.toLowerCase()) {
    case "completed":
      return "#22c55e"; // green-500
    case "unsuccessful":
      return "#ef4444"; // red-500
    case "invoiced":
      return "#a855f7"; // purple-500
    case "archived":
      return "#6b7280"; // gray-500
    case "work_order":
      return "#3b82f6"; // blue-500
    case "work order":
      return "#3b82f6"; // blue-500
    case "scheduled":
      return "#3b82f6"; // blue-500
    case "quote":
      return "#f97316"; // orange-500
    case "lead":
      return "#ca8a04"; // yellow-600
    default:
      return "#f97316"; // orange-500 for proposals
  }
};

// Get status initials
const getStatusInitials = (status?: string) => {
  switch (status?.toLowerCase()) {
    case "quote":
      return "Q";
    case "lead":
      return "L";
    case "scheduled":
      return "S";
    case "work_order":
    case "work order":
      return "WO";
    case "completed":
      return "C";
    case "invoiced":
      return "I";
    case "archived":
      return "A";
    default:
      return "Q";
  }
};

const followUpStatusOptions = [
  { value: "pending", label: "Pending", color: "bg-gray-100 text-gray-800" },
  {
    value: "contacted",
    label: "Contacted",
    color: "bg-blue-100 text-blue-800",
  },
  {
    value: "voicemail",
    label: "Left Voicemail",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    value: "no_answer",
    label: "No Answer",
    color: "bg-orange-100 text-orange-800",
  },
  {
    value: "scheduled",
    label: "Callback Scheduled",
    color: "bg-purple-100 text-purple-800",
  },
  {
    value: "not_interested",
    label: "Not Interested",
    color: "bg-red-100 text-red-800",
  },
];

const contactMethodOptions = [
  { value: "phone", label: "Phone Call", icon: Phone },
  { value: "sms", label: "Text Message", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
];

export default function FollowUpQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedQuote, setSelectedQuote] = useState<FollowUpQuote | null>(
    null,
  );
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [contactMethod, setContactMethod] = useState("phone");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState("contacted");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobCardOpen, setJobCardOpen] = useState(false);

  const {
    data: quotesData,
    isLoading,
    refetch,
  } = useQuery<{ success: boolean; data: FollowUpQuote[] }>({
    queryKey: ["/api/quotes/follow-up-queue"],
  });

  const logFollowUpMutation = useMutation({
    mutationFn: async ({ quoteId, data }: { quoteId: string; data: any }) => {
      return apiRequest("POST", `/api/quotes/${quoteId}/follow-up`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/quotes/follow-up-queue"],
      });
      closeFollowUpDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log follow-up",
        variant: "destructive",
      });
    },
  });

  const quotes = quotesData?.data || [];

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      !searchTerm ||
      quote.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customer?.phone?.includes(searchTerm) ||
      quote.job?.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || quote.followUpStatus === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const openFollowUpDialog = (quote: FollowUpQuote) => {
    setSelectedQuote(quote);
    setContactMethod("phone");
    setFollowUpNotes("");
    setFollowUpStatus("contacted");
    setNextFollowUpDate("");
    setFollowUpDialogOpen(true);
  };

  const closeFollowUpDialog = () => {
    setFollowUpDialogOpen(false);
    setSelectedQuote(null);
    setFollowUpNotes("");
  };

  const openJobCard = (quote: FollowUpQuote) => {
    if (quote.job?.id) {
      setSelectedJobId(quote.job.id);
      setJobCardOpen(true);
    } else {
      toast({
        title: "No job linked",
        description: "This proposal is not linked to a job.",
        variant: "destructive",
      });
    }
  };

  const closeJobCard = () => {
    setJobCardOpen(false);
    setSelectedJobId(null);
    // Refresh the queue when job card closes (in case status changed)
    refetch();
  };

  const handleLogFollowUp = () => {
    if (!selectedQuote) return;

    logFollowUpMutation.mutate({
      quoteId: selectedQuote.id,
      data: {
        contactMethod,
        notes: followUpNotes,
        followUpStatus,
        nextFollowUpDate: nextFollowUpDate || null,
      },
    });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
    }).format(num || 0);
  };

  const getUrgencyBadge = (
    daysSinceSent: number | null,
    followUpCount: number | null,
  ) => {
    if (daysSinceSent === null) return null;
    const attempts = followUpCount || 0;

    if (daysSinceSent >= 14 && attempts < 2) {
      return <Badge className="bg-red-100 text-red-800">Urgent</Badge>;
    }
    if (daysSinceSent >= 7 && attempts < 2) {
      return (
        <Badge className="bg-orange-100 text-orange-800">High Priority</Badge>
      );
    }
    if (daysSinceSent >= 3) {
      return <Badge className="bg-yellow-100 text-yellow-800">Follow Up</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">Recent</Badge>;
  };

  const getStatusBadge = (status: string | null) => {
    const statusOption = followUpStatusOptions.find((s) => s.value === status);
    if (!statusOption) {
      return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
    return <Badge className={statusOption.color}>{statusOption.label}</Badge>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Follow-up Queue</h1>
            <p className="text-muted-foreground">
              Track and manage quote follow-ups
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quotes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-quotes"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger
                className="w-[160px]"
                data-testid="select-filter-status"
              >
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {followUpStatusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-queue"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredQuotes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">All caught up!</h3>
              <p className="text-muted-foreground">
                No quotes need follow-up at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-0">
            {filteredQuotes.map((quote) => (
              <div
                key={quote.id}
                className="p-4 border-b hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => openJobCard(quote)}
                data-testid={`card-quote-${quote.id}`}
              >
                <div className="flex items-start gap-3">
                  {/* Status Avatar Circle */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{
                        backgroundColor: getJobStatusColor(quote.job?.status),
                      }}
                    >
                      {getStatusInitials(quote.job?.status)}
                    </div>
                  </div>

                  {/* Job Content */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between mb-1 gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base truncate">
                          {quote.customer?.name || "Unknown Customer"}
                        </h3>
                      </div>
                      <div className="text-sm font-bold text-gray-700 dark:text-gray-300 flex-shrink-0">
                        #{quote.job?.jobNumber || quote.quoteNumber}
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-semibold truncate">
                      {quote.job?.address || "No address specified"}
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-500 mb-2 line-clamp-2 break-words">
                      {quote.job?.description || quote.job?.title || "\u00A0"}
                    </div>

                    {/* Follow-up Info Row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {getUrgencyBadge(
                        quote.daysSinceSent,
                        quote.followUpCount,
                      )}
                      <span className="text-muted-foreground">
                        {formatCurrency(quote.amount)}
                      </span>
                      {quote.daysSinceSent !== null && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {quote.daysSinceSent}d ago
                        </span>
                      )}
                      {quote.followUpCount && quote.followUpCount > 0 && (
                        <Badge variant="outline" className="text-xs py-0">
                          <PhoneCall className="h-3 w-3 mr-1" />
                          {quote.followUpCount}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1 items-center flex-shrink-0">
                    {quote.customer?.phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `tel:${quote.customer?.phone}`;
                        }}
                        data-testid={`button-call-${quote.id}`}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                    {quote.customer?.phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `sms:${quote.customer?.phone}`;
                        }}
                        data-testid={`button-sms-${quote.id}`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                    {quote.customer?.email && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `mailto:${quote.customer?.email}`;
                        }}
                        data-testid={`button-email-${quote.id}`}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFollowUpDialog(quote);
                      }}
                      data-testid={`button-log-followup-${quote.id}`}
                    >
                      Log Follow-up
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Follow-up</DialogTitle>
          </DialogHeader>

          {selectedQuote && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-medium">
                  Quote #{selectedQuote.quoteNumber}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedQuote.customer?.name} -{" "}
                  {formatCurrency(selectedQuote.amount)}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Contact Method</Label>
                <Select value={contactMethod} onValueChange={setContactMethod}>
                  <SelectTrigger data-testid="select-contact-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contactMethodOptions.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        <span className="flex items-center gap-2">
                          <method.icon className="h-4 w-4" />
                          {method.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Outcome</Label>
                <Select
                  value={followUpStatus}
                  onValueChange={setFollowUpStatus}
                >
                  <SelectTrigger data-testid="select-followup-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {followUpStatusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="What was discussed? Any next steps?"
                  rows={3}
                  data-testid="textarea-followup-notes"
                />
              </div>

              <div className="space-y-2">
                <Label>Schedule Next Follow-up (optional)</Label>
                <Input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  data-testid="input-next-followup-date"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeFollowUpDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleLogFollowUp}
              disabled={logFollowUpMutation.isPending}
              data-testid="button-submit-followup"
            >
              {logFollowUpMutation.isPending ? "Saving..." : "Log Follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Card Modal */}
      {jobCardOpen && selectedJobId && (
        <GlobalJobCard
          mode="edit"
          jobId={selectedJobId}
          isOpen={jobCardOpen}
          onClose={closeJobCard}
        />
      )}
    </div>
  );
}
