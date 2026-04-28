import React, { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare,
  Mail,
  FileText,
  StickyNote,
  Phone,
  Paperclip,
  Send,
  Plus,
  User,
  Clock,
  Settings,
  CheckCircle,
  Presentation,
  ExternalLink,
  MoreHorizontal,
  Edit,
  Save,
  X,
  Camera,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Receipt,
  Trash2,
  Eye,
  EyeOff,
  MousePointerClick,
  Reply,
  CalendarPlus,
  Images,
} from "lucide-react";
import { ProposalBuilder } from "@/components/ProposalBuilder";
import { PullToRefresh } from "@/components/PullToRefresh";
import WelcomeVideoModal from "@/components/WelcomeVideoModal";
import { BeforeAfterCaptureModal } from "@/components/BeforeAfterCaptureModal";
import { MdStickyNote2, MdEmail } from "react-icons/md";

// ── Email-thread helpers ────────────────────────────────────────────────────
// The diary stores sent and received emails as independent entries with no
// parent/child link in the database. These helpers let the renderer infer the
// direction of each email and stitch replies underneath their preceding sent
// email so the UI can show one consolidated thread card per conversation.

type EmailDirection = "sent" | "received" | "unknown";

function getEmailDirection(entry: { title: string; content: string }): EmailDirection {
  const titleLower = (entry.title || "").toLowerCase();
  const contentLower = (entry.content || "").toLowerCase();
  if (
    titleLower.includes("sent") ||
    contentLower.includes("email sent to") ||
    contentLower.includes("sms sent to")
  ) {
    return "sent";
  }
  if (titleLower.includes("reply") || titleLower.includes("from")) {
    return "received";
  }
  return "unknown";
}

function getEmailAddress(entry: { metadata?: any }): string | null {
  const m = entry.metadata || {};
  return m.emailAddress || m.recipient || m.fromEmail || null;
}

// True when there's a later outbound entry of the same kind (email/sms) to
// the same counterparty as `target`. Used to suppress the AI suggested-reply
// card once we've already replied — without this, the suggestion sits on the
// inbound message forever even though the conversation has moved on.
function hasOutboundReplyAfter(
  entries: Array<{
    id: string;
    type?: string;
    timestamp: string;
    title?: string;
    content?: string;
    metadata?: any;
  }>,
  target: { id: string; type?: string; timestamp: string; metadata?: any },
): boolean {
  const targetTime = new Date(target.timestamp).getTime();
  if (!Number.isFinite(targetTime)) return false;
  const targetAddr = getEmailAddress(target);
  const targetType = target.type;
  for (const e of entries) {
    if (e.id === target.id) continue;
    if (targetType && e.type && e.type !== targetType) continue;
    const t = new Date(e.timestamp).getTime();
    if (!Number.isFinite(t) || t <= targetTime) continue;
    const dir = getEmailDirection({
      title: e.title || "",
      content: e.content || "",
    });
    if (dir !== "sent") continue;
    const addr = getEmailAddress(e);
    if (!targetAddr || !addr || addr === targetAddr) return true;
  }
  return false;
}

function cleanEmailMessage(
  entry: { title: string; content: string },
  direction: EmailDirection,
): { text: string; recipient: string } {
  let messageText = entry.content || "";
  let recipientInfo = "";

  if (direction === "sent" && messageText.includes("Message:")) {
    const beforeMessage = messageText.split("Message:")[0];
    if (beforeMessage.includes("Email sent to")) {
      recipientInfo = beforeMessage.split("Email sent to")[1].trim();
    } else if (beforeMessage.includes("SMS sent to")) {
      recipientInfo = beforeMessage.split("SMS sent to")[1].trim();
    }
    messageText = messageText.split("Message:")[1].trim();
    messageText = messageText
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<p>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();
  } else if (direction === "received" && messageText.includes(":\n\n")) {
    messageText = messageText.split(":\n\n")[1].trim();
  }

  if (direction === "received") {
    messageText = messageText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<p>/gi, "")
      .replace(/<[^>]+>/g, "");
    const fromIndex = messageText.search(/\n+From:\s*.+?[@<]/i);
    if (fromIndex !== -1) messageText = messageText.substring(0, fromIndex);
    const sentIndex = messageText.search(/\n+Sent:\s*.+?\d{4}/i);
    if (sentIndex !== -1) messageText = messageText.substring(0, sentIndex);
    messageText = messageText.trim();
  }

  return { text: messageText, recipient: recipientInfo };
}

// Component to display email activity (opens/clicks)
function EmailActivity({ messageId }: { messageId: string }) {
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const response = await fetch(`/api/email-activity/${messageId}`);
        const data = await response.json();
        if (data.success) {
          setActivity(data.data);
        }
      } catch (error) {
        console.error("Error fetching email activity:", error);
      } finally {
        setLoading(false);
      }
    };

    if (messageId) {
      fetchActivity();
    } else {
      setLoading(false);
    }
  }, [messageId]);

  if (loading) {
    return (
      <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
        <Clock className="h-2.5 w-2.5 animate-spin" />
        <span>Checking...</span>
      </div>
    );
  }

  // Show "Not seen" if no opens/clicks yet
  if (!activity || (activity.opens === 0 && activity.clicks === 0)) {
    return (
      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <EyeOff className="h-2.5 w-2.5" />
        <span>Not seen yet</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[10px]">
      {activity.opens > 0 && (
        <div className="flex items-center gap-0.5 text-green-600">
          <Eye className="h-2.5 w-2.5" />
          <span>Seen {activity.opens}x</span>
        </div>
      )}
      {activity.clicks > 0 && (
        <div className="flex items-center gap-0.5 text-blue-600">
          <MousePointerClick className="h-2.5 w-2.5" />
          <span>
            {activity.clicks} click{activity.clicks > 1 ? "s" : ""}
          </span>
        </div>
      )}
      {activity.lastEventAt && (
        <div className="flex items-center gap-0.5 text-gray-500">
          <Clock className="h-2.5 w-2.5" />
          <span>
            {formatInTimeZone(
              new Date(activity.lastEventAt),
              "Pacific/Auckland",
              "MMM dd, h:mma",
            )}
          </span>
        </div>
      )}
    </div>
  );
}

// Hoisted confirmation-reply card shown at the top of the diary whenever a
// job has customerConfirmed=true and no 'confirmation-reply-sent' diary entry
// exists yet. Three actions: Send now (one-click), Edit first (opens the
// composer pre-filled), Dismiss (session-only hide).
function JobConfirmationReplyCard({
  jobId,
  customerEmail,
  isSending,
  onSendNow,
  onEditFirst,
  onDismiss,
}: {
  jobId: string;
  customerEmail: string;
  isSending: boolean;
  onSendNow: (draft: { subject: string; body: string }) => void;
  onEditFirst: (draft: { subject: string; body: string }) => void;
  onDismiss: () => void;
}) {
  const { data, isLoading, error, refetch, isFetching } = useQuery<{
    subject: string;
    body: string;
  }>({
    queryKey: ["confirmation-reply-draft", "job", jobId],
    queryFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/jobs/${jobId}/draft-confirmation-reply`,
      );
      const json = await res.json();
      if (!json?.success || !json?.data?.body) {
        throw new Error(json?.message || "Failed to draft reply");
      }
      return json.data;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  return (
    <div
      className="mx-2 mb-2 mt-1 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-950/30 p-3"
      data-testid="card-confirmation-reply"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          <span className="text-xs font-semibold text-green-800 dark:text-green-200">
            Customer confirmed — send acknowledgement?
          </span>
        </div>
        {data && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1 text-[10px] text-muted-foreground hover:text-foreground"
            disabled={isFetching || isSending}
            onClick={() => refetch()}
            data-testid="button-regen-confirmation-reply"
          >
            <RefreshCw
              className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3 animate-spin" /> Drafting a reply…
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-red-600 dark:text-red-400">
            Couldn't draft a reply.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2"
            onClick={() => refetch()}
            data-testid="button-retry-confirmation-reply"
          >
            Retry
          </Button>
        </div>
      ) : data ? (
        <>
          <p
            className="text-xs leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300 border-l-2 border-green-300 dark:border-green-700 pl-2 mb-2"
            style={{ wordBreak: "break-word" }}
          >
            {data.body}
          </p>
          <div className="flex items-center justify-end gap-1 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] px-2 text-gray-600 dark:text-gray-400"
              disabled={isSending}
              onClick={onDismiss}
              data-testid="button-dismiss-confirmation-reply"
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-2"
              disabled={isSending || !data}
              onClick={() => onEditFirst(data)}
              data-testid="button-edit-first-confirmation-reply"
            >
              <Edit className="w-3 h-3 mr-1" /> Edit first
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-7 text-[11px] px-2"
              disabled={isSending || !data || !customerEmail}
              onClick={() => onSendNow(data)}
              data-testid="button-send-now-confirmation-reply"
            >
              <Send className="w-3 h-3 mr-1" />
              {isSending ? "Sending…" : "Send now"}
            </Button>
          </div>
          {!customerEmail && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              No email address on file for this customer.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

// Inline AI-drafted reply shown beneath an inbound customer SMS/email diary
// entry. Fetches a context-aware suggestion from the server (using the
// customer's actual message + the most recent thing we sent them), then
// hands it to the enclosing composer via onEditAndSend — the user tweaks and
// sends it.
function SuggestedReplyDraft({
  entry,
  jobId,
  onEditAndSend,
  onDismiss,
  isDismissing,
}: {
  entry: DiaryEntry;
  jobId: string;
  onEditAndSend: (
    draft: { subject: string; body: string },
    entryId: string,
  ) => void;
  onDismiss: (entryId: string) => void;
  isDismissing: boolean;
}) {
  const { data, isLoading, error, refetch, isFetching } = useQuery<{
    subject: string;
    body: string;
  }>({
    queryKey: ["suggested-reply-draft", entry.id],
    queryFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/jobs/${jobId}/draft-reply-to-entry`,
        { entryId: entry.id },
      );
      const json = await res.json();
      if (!json?.success || !json?.data?.body) {
        throw new Error(json?.message || "Failed to draft reply");
      }
      return json.data;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  return (
    <div className="border-t border-purple-200 dark:border-purple-800 px-3 py-2 bg-white/60 dark:bg-black/20">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1">
          <Reply className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">
            Suggested reply
          </span>
        </div>
        {data && (
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-1 text-[10px] text-muted-foreground hover:text-foreground"
            disabled={isFetching}
            onClick={() => refetch()}
            data-testid={`button-regen-reply-${entry.id}`}
          >
            <RefreshCw
              className={`w-2.5 h-2.5 ${isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3 animate-spin" /> Drafting a reply…
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-red-600 dark:text-red-400">
            Couldn't draft a reply.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2"
            onClick={() => refetch()}
            data-testid={`button-retry-reply-${entry.id}`}
          >
            Retry
          </Button>
        </div>
      ) : data ? (
        <>
          <p
            className="text-xs leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300 border-l-2 border-purple-300 dark:border-purple-700 pl-2"
            style={{ wordBreak: "break-word" }}
          >
            {data.body}
          </p>
          <div className="flex gap-1 mt-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-gray-600 dark:text-gray-400"
              disabled={isDismissing}
              onClick={() => onDismiss(entry.id)}
              data-testid={`button-dismiss-reply-${entry.id}`}
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => onEditAndSend(data, entry.id)}
              data-testid={`button-edit-send-reply-${entry.id}`}
            >
              <Edit className="w-3 h-3 mr-0.5" /> Edit &amp; send
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ServiceM8 API response types (matches server/services/servicem8-api.ts)
interface ServiceM8DiaryEntry {
  id: string;
  jobUuid: string;
  staffUuid: string | null;
  entryType: string | null;
  note: string | null;
  objectUuid: string | null;
  entryDate: Date | null;
  createdAt: Date | null;
  active: boolean;
}

// Types for diary entries
interface DiaryEntry {
  id: string;
  type: "note" | "sms" | "email" | "job_event" | "proposal" | "call" | "photo";
  title: string;
  content: string;
  author: string;
  timestamp: string;
  photoUrl?: string;
  tags?: string[];
  metadata?: {
    phoneNumber?: string;
    emailAddress?: string;
    proposalNumber?: string;
    eventType?: string;
    status?: string;
    viewedDate?: string;
    replyAcknowledged?: boolean;
    recipient?: string;
    sendgridMessageId?: string;
    [key: string]: any;
  };
}

// Form schemas
const noteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
  isPrivate: z.boolean().optional(),
});

const smsSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  message: z.string().min(1, "Message content is required"),
});

const emailSchema = z.object({
  to: z.string().email("Valid email address is required"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message content is required"),
});

type NoteFormData = z.infer<typeof noteSchema>;
type SMSFormData = z.infer<typeof smsSchema>;
type EmailFormData = z.infer<typeof emailSchema>;

interface JobDiarySectionProps {
  jobId: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  className?: string;
  onQuoteClick?: (quoteNumber: string) => void;
  onInvoiceClick?: (invoiceNumber: string) => void;
  onProposalClick?: (proposalNumber: string) => void;
}

export function JobDiarySection({
  jobId,
  customerId,
  customerEmail,
  customerPhone,
  className,
  onQuoteClick,
  onInvoiceClick,
  onProposalClick,
}: JobDiarySectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const [activeComposer, setActiveComposer] = useState<
    "note" | "sms" | "email" | null
  >(null);
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    null,
  );
  const [isBeforeAfterModalOpen, setIsBeforeAfterModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [viewingPhotoIndex, setViewingPhotoIndex] = useState<number | null>(
    null,
  );
  const [diaryTab, setDiaryTab] = useState<"timeline" | "photos">("timeline");
  const quickNoteInputRef = React.useRef<HTMLTextAreaElement>(null);
  const [replyToEmail, setReplyToEmail] = useState<string>("");
  const [replyToPhone, setReplyToPhone] = useState<string>("");
  // Pre-filled body when opening the email composer from an AI-drafted
  // confirmation reply. Separate from replySubject so we can pre-populate
  // the message field without clobbering the subject-only reply flow.
  const [replyBody, setReplyBody] = useState<string>("");
  // When the user opens the composer from a confirmation entry's suggested
  // reply, we track the entry id so we can mark it as acknowledged after
  // the email is sent.
  const [confirmationReplyEntryId, setConfirmationReplyEntryId] = useState<
    string | null
  >(null);

  // Calendar booking state
  const [calendarBookingOpen, setCalendarBookingOpen] = useState(false);
  const [calendarBookingEntry, setCalendarBookingEntry] =
    useState<DiaryEntry | null>(null);
  const [calendarBookingDate, setCalendarBookingDate] = useState<string>("");
  const [calendarBookingTime, setCalendarBookingTime] =
    useState<string>("08:00");
  const [calendarBookingDuration, setCalendarBookingDuration] =
    useState<string>("30");
  const [calendarBookingTitle, setCalendarBookingTitle] = useState<string>("");
  const [replySubject, setReplySubject] = useState<string>("");
  const [selectedEmailTemplate, setSelectedEmailTemplate] =
    useState<string>("none");
  const [selectedSmsTemplate, setSelectedSmsTemplate] = useState<string>("");

  // Welcome video prompt — surfaces when a NEW customer replies affirmatively
  // to a quote-scheduling email and we have a "Welcome video" template ready
  // to fire. Auto-opens once per session per job; the dismiss/sent state is
  // tracked server-side via diary entries so it doesn't re-prompt on reload.
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [welcomeAutoOpened, setWelcomeAutoOpened] = useState(false);
  const { data: welcomeStatus } = useQuery<{
    success?: boolean;
    shouldPrompt?: boolean;
    customerName?: string;
    templateAvailable?: boolean;
  }>({
    queryKey: ["/api/jobs", jobId, "welcome-prompt-status"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/welcome-prompt-status`);
      if (!res.ok) throw new Error("Failed to load welcome prompt status");
      return res.json();
    },
    enabled: !!jobId,
    staleTime: 30_000,
  });
  useEffect(() => {
    if (welcomeStatus?.shouldPrompt && !welcomeAutoOpened) {
      setWelcomeModalOpen(true);
      setWelcomeAutoOpened(true);
    }
  }, [welcomeStatus?.shouldPrompt, welcomeAutoOpened]);

  // Hoisted confirmation-reply card: session-only dismiss. The persistent
  // Dismissal is now persisted per-job in localStorage. The earlier "session
  // only" behaviour meant the same suggestion popped back every time the job
  // card was re-opened — a single Dismiss should kill it for that job.
  const confirmationCardDismissedKey = `diary-confirmation-card-dismissed:${jobId}`;
  const [confirmationCardDismissed, setConfirmationCardDismissedRaw] =
    useState<boolean>(() => {
      try {
        return localStorage.getItem(confirmationCardDismissedKey) === "1";
      } catch {
        return false;
      }
    });
  const setConfirmationCardDismissed = useCallback(
    (next: boolean) => {
      setConfirmationCardDismissedRaw(next);
      try {
        if (next) localStorage.setItem(confirmationCardDismissedKey, "1");
        else localStorage.removeItem(confirmationCardDismissedKey);
      } catch {
        /* localStorage may be unavailable (private mode); state-only is fine */
      }
    },
    [confirmationCardDismissedKey],
  );

  // Touch swipe state for photo gallery
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const extractTimeFromText = (text: string): string => {
    // Normalise dotted abbreviations: "a.m." → "am", "p.m." → "pm"
    const normalised = text
      .replace(/\ba\.m\./gi, "am")
      .replace(/\bp\.m\./gi, "pm");
    const patterns = [
      /(\d{1,2}):(\d{2}):\d{2}\s*(am|pm)/i, // "10:30:00 am" (with seconds)
      /(\d{1,2})[.:](\d{2})\s*(am|pm)/i, // "10:30 am" or "10.30 am"
      /(\d{1,2})\s*(am|pm)/i, // "10 am"
      /(\d{1,2}):(\d{2}):\d{2}(?!\s*[ap]m)/i, // "10:30:00" 24-hour with seconds
      /\b([01]?\d|2[0-3]):([0-5]\d)\b/, // "10:30" 24-hour plain
    ];
    for (const pat of patterns) {
      const m = normalised.match(pat);
      if (m) {
        let hours = parseInt(m[1]);
        const minutes =
          m[2] && /^\d+$/.test(m[2]) ? m[2].padStart(2, "0") : "00";
        const meridiem = (m[3] || m[2] || "").toLowerCase();
        if (meridiem === "pm" && hours < 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, "0")}:${minutes}`;
      }
    }
    return "08:00";
  };

  // Format a Date as YYYY-MM-DD using local (browser) time, not UTC.
  // toISOString() always returns UTC — in NZ (UTC+12/+13) this gives yesterday's date.
  const localDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const extractDateFromText = (text: string): string | null => {
    const lower = text.toLowerCase();
    const today = new Date();
    if (lower.includes("tomorrow")) {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      return localDateStr(d);
    }
    if (lower.includes("today")) {
      return localDateStr(today);
    }
    // Day-name matching — find the next occurrence of the named day from today
    const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    for (let i = 0; i < dayNames.length; i++) {
      if (lower.includes(dayNames[i])) {
        const todayDow = today.getDay(); // 0=Sun … 6=Sat
        let daysAhead = i - todayDow;
        if (daysAhead <= 0) daysAhead += 7; // always go forward
        const d = new Date(today);
        d.setDate(d.getDate() + daysAhead);
        return localDateStr(d);
      }
    }
    const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, "0");
      const month = dateMatch[2].padStart(2, "0");
      const year =
        dateMatch[3].length === 2 ? "20" + dateMatch[3] : dateMatch[3];
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  // Forms
  const noteForm = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: { content: "", isPrivate: false },
  });

  const smsForm = useForm<SMSFormData>({
    resolver: zodResolver(smsSchema),
    defaultValues: { phoneNumber: customerPhone || "", message: "" },
  });

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { to: customerEmail || "", subject: "", message: "" },
  });

  // Pre-fill forms when opening composer via reply
  useEffect(() => {
    if (activeComposer === "email" && replyToEmail) {
      emailForm.setValue("to", replyToEmail);
      // Auto-populate subject with "Re: " prefix
      if (replySubject) {
        const subject = replySubject.startsWith("Re: ")
          ? replySubject
          : `Re: ${replySubject}`;
        emailForm.setValue("subject", subject);
      }
      if (replyBody) {
        emailForm.setValue("message", replyBody);
      }
    } else if (activeComposer === "email" && !replyToEmail) {
      // Reset to default customer email when not replying
      emailForm.setValue("to", customerEmail || "");
      emailForm.setValue("subject", "");
    }
  }, [
    activeComposer,
    replyToEmail,
    replySubject,
    replyBody,
    emailForm,
    customerEmail,
  ]);

  useEffect(() => {
    if (activeComposer === "sms" && replyToPhone) {
      smsForm.setValue("phoneNumber", replyToPhone);
    } else if (activeComposer === "sms" && !replyToPhone) {
      // Reset to default customer phone when not replying
      smsForm.setValue("phoneNumber", customerPhone || "");
    }
  }, [activeComposer, replyToPhone, smsForm, customerPhone]);

  // Clear reply state and template selections when composer closes
  useEffect(() => {
    if (activeComposer === null) {
      setReplyToEmail("");
      setReplyToPhone("");
      setReplySubject("");
      setReplyBody("");
      setConfirmationReplyEntryId(null);
      setSelectedEmailTemplate("");
      setSelectedSmsTemplate("");
    }
  }, [activeComposer]);

  // Force cache invalidation on mobile devices to prevent stale data
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    if (isMobile) {
      // On mobile, aggressively invalidate all diary caches on mount
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
      queryClient.removeQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
    }
  }, [isMobile, jobId, queryClient]);

  // Check for bootstrap data (from index.html pre-fetch)
  // DISABLED: Bootstrap cache causes issues with email entries
  const bootstrapData = undefined; //(window as any).__DIARY_BOOTSTRAP__;
  const hasBootstrap = false; //bootstrapData?.jobId === jobId && bootstrapData?.data;

  useEffect(() => {
    if (hasBootstrap) {
      console.log(
        "✅ Using bootstrap diary data:",
        bootstrapData.data.length,
        "entries",
      );
    }
  }, [hasBootstrap, bootstrapData]);

  // Fetch job data for variable replacement
  const { data: jobData } = useQuery({
    queryKey: ["/api/jobs", jobId],
    select: (response: any) => response.data || response,
  });

  // Suppress AI suggested-reply drafts on jobs that are done — no point
  // drafting a follow-up to a customer when the job is closed out.
  const isJobClosed =
    jobData?.status === "completed" ||
    jobData?.status === "archived" ||
    jobData?.status === "unsuccessful";

  // Fetch customer record so the Book button always has the customer's name,
  // even when jobContactFirstName/jobContactLastName are empty (e.g. lead-status jobs
  // created by selecting an existing customer rather than entering new contact details).
  const effectiveCustomerId = customerId || jobData?.customerId;
  const { data: customerRecord } = useQuery({
    queryKey: ["/api/customers", effectiveCustomerId],
    enabled: !!effectiveCustomerId,
    select: (response: any) => response.data || response,
  });

  // Fetch email templates
  const { data: emailTemplates = [] } = useQuery({
    queryKey: ["/api/email-templates"],
    select: (response: any) => response.data || [],
  });

  // Fetch SMS templates
  const { data: smsTemplates = [] } = useQuery({
    queryKey: ["/api/sms-templates"],
    select: (response: any) => response.data || [],
  });

  // Variable replacement function
  const replaceTemplateVariables = (template: string) => {
    const customerName = customerRecord?.name || "";
    const address = jobData?.jobAddress || jobData?.address || "";
    const phone = jobData?.customerPhone || customerPhone || "";
    const email = jobData?.customerEmail || customerEmail || "";

    // Extract first name from customer name
    let firstName = "";
    if (customerName) {
      // Handle "LastName, FirstName" format
      if (customerName.includes(",")) {
        const parts = customerName.split(",").map((p) => p.trim());
        firstName = parts.length === 2 ? parts[1] : customerName.split(" ")[0];
      } else {
        firstName = customerName.split(" ")[0];
      }
    }

    // Build a map of all variable aliases → value
    // Supports both {camelCase} and {snake_case} as well as {{double_braces}}
    const vars: Record<string, string> = {
      customerName,
      customer_name: customerName,
      firstName,
      first_name: firstName,
      jobNumber: String(jobData?.jobNumber || jobId || ""),
      job_number: String(jobData?.jobNumber || jobId || ""),
      address,
      customer_address: address,
      phone,
      customer_phone: phone,
      email,
      customer_email: email,
    };

    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      // Replace {{key}} (double-brace) and {key} (single-brace), case-insensitive key match
      result = result
        .replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), value)
        .replace(new RegExp(`\\{\\s*${key}\\s*\\}`, "gi"), value);
    }
    return result;
  };

  // Handle template selection for email
  const handleEmailTemplateSelect = (templateId: string) => {
    setSelectedEmailTemplate(templateId);
    if (templateId === "none") {
      return;
    }

    const template = emailTemplates.find((t: any) => t.id === templateId);
    if (template) {
      const message = replaceTemplateVariables(
        template.htmlContent || template.textContent || "",
      );
      const subject = replaceTemplateVariables(template.subject);
      emailForm.setValue("message", message);
      emailForm.setValue("subject", subject);
    }
  };

  // Handle template selection for SMS
  const handleSmsTemplateSelect = (templateId: string) => {
    setSelectedSmsTemplate(templateId);
    if (templateId === "none") {
      return;
    }

    const template = smsTemplates.find((t: any) => t.id === templateId);
    if (template) {
      const message = replaceTemplateVariables(template.message);
      smsForm.setValue("message", message);
    }
  };

  // Fetch diary entries (combining local and ServiceM8 sources)
  const {
    data: diaryEntries = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/jobs", jobId, "diary-timeline"],
    // DISABLED: Bootstrap cache was using old data format
    // Use bootstrap data as initial data if available
    initialData: false
      ? (() => {
          console.log("🚀 Seeding React Query with bootstrap data");
          // Transform bootstrap data to DiaryEntry format
          return bootstrapData.data.map((entry: any) => ({
            id: entry.id,
            type: entry.entryType || "note",
            title: entry.title,
            content: entry.description,
            author: entry.authorName || "System",
            timestamp: entry.createdAt,
            photoUrl: entry.photoUrl || (entry.photos && entry.photos[0]),
            metadata: entry.metadata || {},
          }));
        })()
      : undefined,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache in memory
    refetchOnMount: "always", // Always refetch on mount
    refetchOnWindowFocus: true, // Refetch when window regains focus
    networkMode: "always", // CRITICAL: Force query on iOS PWAs that falsely report offline
    retry: true,
    retryOnMount: true,
    queryFn: async (): Promise<DiaryEntry[]> => {
      // Add cache-busting timestamp to force fresh data
      const timestamp = Date.now();

      const [localResponse, servicem8Response, scheduleResponse] =
        await Promise.all([
          // Fetch local diary data (original endpoints)
          Promise.all([
            apiRequest("GET", `/api/jobs/${jobId}/diary?_t=${timestamp}`).then(
              (res) => res.json(),
            ),
            apiRequest(
              "GET",
              `/api/communications?jobId=${jobId}&_t=${timestamp}`,
            ).then((res) => res.json()),
            apiRequest(
              "GET",
              `/api/proposals?jobId=${jobId}&_t=${timestamp}`,
            ).then((res) => res.json()),
          ]),
          // Fetch ServiceM8 diary data (with error handling)
          apiRequest(
            "GET",
            `/api/servicem8/jobs/${jobId}/diary?_t=${timestamp}`,
          )
            .then((res) => res.json())
            .catch(() => ({ data: [] })),
          // Fetch job staff assignments (upcoming bookings)
          apiRequest(
            "GET",
            `/api/jobs/${jobId}/staff-assignments?_t=${timestamp}`,
          )
            .then((res) => res.json())
            .catch(() => ({ data: [] })),
        ]);

      const [diaryResponse, communicationsResponse, proposalsResponse] =
        localResponse;
      const entries: DiaryEntry[] = [];

      // Add local diary entries
      if (diaryResponse.data) {
        console.log(
          "🔍 RAW API RESPONSE:",
          JSON.stringify(diaryResponse.data, null, 2),
        );
        diaryResponse.data.forEach((entry: any) => {
          // CRITICAL FIX: Use entry.photoUrl directly (it's a string, not an array)
          // The database column is photo_url, which comes through as photoUrl in the API response
          const photoUrl = entry.photoUrl || undefined;

          // Support both snake_case (entry_type) and camelCase (entryType)
          const entryType = entry.entryType || entry.entry_type;
          console.log(
            "🔍 Processing entry:",
            entry.id,
            "entryType:",
            entryType,
            "entry:",
            entry,
          );

          entries.push({
            id: entry.id,
            type:
              entryType === "note"
                ? "note"
                : entryType === "proposal"
                  ? "proposal"
                  : entryType === "photo"
                    ? "photo"
                    : entryType === "email"
                      ? "email"
                      : entryType === "sms"
                        ? "sms"
                        : entryType === "call"
                          ? "call"
                          : "job_event",
            title: entry.title,
            content: entry.description,
            author: entry.authorName || entry.author_name || "System",
            timestamp: entry.createdAt || entry.created_at,
            photoUrl: photoUrl,
            tags: entry.tags || undefined,
            metadata: {
              ...entry.metadata, // Preserve existing metadata (email, phone, etc.)
              eventType: entryType,
              proposalNumber:
                entryType === "proposal"
                  ? entry.title.replace("Proposal Created: ", "")
                  : undefined,
            },
          });
        });
      }

      // Add local communications
      if (communicationsResponse.data) {
        communicationsResponse.data.forEach((comm: any) => {
          entries.push({
            id: comm.id,
            type: comm.type === "email" ? "email" : "sms",
            title: comm.subject || `${comm.type.toUpperCase()} Message`,
            content: comm.content || comm.message,
            author: comm.sender || "System",
            timestamp: comm.createdAt || comm.timestamp,
            metadata: {
              phoneNumber: comm.phoneNumber,
              emailAddress: comm.emailAddress,
            },
          });
        });
      }

      // Add local proposals
      if (proposalsResponse.data) {
        proposalsResponse.data.forEach((proposal: any) => {
          entries.push({
            id: proposal.id,
            type: "proposal",
            title: `Proposal Created: ${proposal.proposalNumber}`,
            content: proposal.title || proposal.description,
            author: proposal.createdBy || "System",
            timestamp: proposal.createdAt,
            metadata: {
              proposalNumber: proposal.proposalNumber,
              status: proposal.status,
              viewedDate: proposal.viewedDate,
              isDeletable: false, // Proposals from proposals table cannot be deleted via diary endpoint
            },
          });
        });
      }

      // Add ServiceM8 diary entries if available
      if (servicem8Response.data && servicem8Response.data.length > 0) {
        servicem8Response.data.forEach((entry: ServiceM8DiaryEntry) => {
          const entryDate = entry.entryDate ? new Date(entry.entryDate) : null;

          entries.push({
            id: `servicem8-${entry.id}`, // Prefix to avoid ID conflicts
            type:
              entry.entryType === "Note"
                ? "note"
                : entry.entryType === "Scheduled"
                  ? "job_event"
                  : entry.entryType === "Completed"
                    ? "job_event"
                    : entry.entryType === "CallLog"
                      ? "call"
                      : "note",
            title:
              entry.entryType === "Note"
                ? "ServiceM8 Note"
                : entry.entryType === "Scheduled"
                  ? "ServiceM8 Scheduled"
                  : entry.entryType === "Completed"
                    ? "ServiceM8 Completed"
                    : entry.entryType === "CallLog"
                      ? "ServiceM8 Call"
                      : "ServiceM8 Entry",
            content: entry.note || "No content",
            author: "ServiceM8 User",
            timestamp:
              entryDate?.toISOString() ||
              (entry.createdAt
                ? new Date(entry.createdAt).toISOString()
                : new Date().toISOString()),
            metadata: {
              eventType: entry.entryType || undefined,
              status: entry.active ? "active" : "inactive",
            },
          });
        });
      }

      // Add job staff assignments (upcoming bookings) if available
      // Group by same time slot to show as single entry
      if (scheduleResponse.data && scheduleResponse.data.length > 0) {
        // Group assignments by start/end time
        const timeSlotGroups = new Map<string, any[]>();

        scheduleResponse.data.forEach((assignment: any) => {
          const key = `${assignment.startTime || ""}-${assignment.endTime || ""}`;
          if (!timeSlotGroups.has(key)) {
            timeSlotGroups.set(key, []);
          }
          timeSlotGroups.get(key)!.push(assignment);
        });

        // Create a single entry per time slot with all staff names
        timeSlotGroups.forEach((assignments, _key) => {
          const firstAssignment = assignments[0];
          const startTime = firstAssignment.startTime
            ? new Date(firstAssignment.startTime)
            : null;
          const endTime = firstAssignment.endTime
            ? new Date(firstAssignment.endTime)
            : null;

          // Collect all staff names for this time slot
          const staffNames = assignments.map(
            (a: any) =>
              a.employeeName ||
              (a.employee
                ? `${a.employee.firstName} ${a.employee.lastName}`
                : "Staff"),
          );

          // Format time for display
          const timeStr = startTime
            ? formatInTimeZone(startTime, "Pacific/Auckland", "h:mm a")
            : "";
          const dateStr = startTime
            ? formatInTimeZone(startTime, "Pacific/Auckland", "dd/MM/yyyy")
            : "";
          const endTimeStr = endTime
            ? formatInTimeZone(endTime, "Pacific/Auckland", "h:mm a")
            : "";

          // Format staff list nicely
          const staffList =
            staffNames.length === 1
              ? staffNames[0]
              : staffNames.slice(0, -1).join(", ") +
                " & " +
                staffNames[staffNames.length - 1];

          entries.push({
            id: `booking-${assignments.map((a: any) => a.id).join("-")}`,
            type: "job_event",
            title: "Staff Scheduled",
            content: `${staffList} scheduled for ${dateStr} at ${timeStr}${endTimeStr ? ` - ${endTimeStr}` : ""}`,
            author: "System",
            timestamp:
              firstAssignment.createdAt ||
              startTime?.toISOString() ||
              new Date().toISOString(),
            metadata: {
              eventType: "staff_booking",
              assignmentIds: assignments.map((a: any) => a.id),
              employeeIds: assignments.map((a: any) => a.employeeId),
              staffNames: staffNames,
              startTime: firstAssignment.startTime,
              endTime: firstAssignment.endTime,
              status: firstAssignment.status,
            },
          });
        });
      }

      // Deduplicate: if two entries share the same messageId (e.g. a Gmail reply captured
      // twice due to a polling race), keep only the first occurrence seen.
      const seenMessageIds = new Set<string>();
      const seenDbIds = new Set<string | number>();
      const uniqueEntries = entries.filter(entry => {
        // Dedup by DB id (catches any entry duplicated at source-merge level)
        if (entry.id !== undefined && entry.id !== null) {
          const idKey = String(entry.id);
          if (seenDbIds.has(idKey)) return false;
          seenDbIds.add(idKey);
        }
        // Dedup by email messageId in metadata (catches same email inserted twice in DB)
        const msgId = entry.metadata?.messageId;
        if (msgId) {
          if (seenMessageIds.has(msgId)) return false;
          seenMessageIds.add(msgId);
        }
        return true;
      });

      // Sort by timestamp (newest first) — NaN-safe so invalid timestamps go to bottom
      return uniqueEntries.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        if (isNaN(tb) && isNaN(ta)) return 0;
        if (isNaN(tb)) return 1;
        if (isNaN(ta)) return -1;
        return tb - ta;
      });
    },
  });

  // Collect all photos from diary entries for gallery view
  const allPhotos = React.useMemo(() => {
    const photos: string[] = [];
    diaryEntries.forEach((entry) => {
      if (entry.photoUrl) {
        photos.push(entry.photoUrl);
      }
    });
    return photos;
  }, [diaryEntries]);

  // Photo entries with metadata, used by the Photos tab grid so each tile
  // can show its timestamp and author and link back to the right gallery
  // index on click.
  const photoEntries = React.useMemo<
    Array<{ url: string; timestamp: string; author: string; id: string }>
  >(() => {
    return diaryEntries
      .filter((entry: DiaryEntry) => !!entry.photoUrl)
      .map((entry: DiaryEntry) => ({
        url: entry.photoUrl as string,
        timestamp: entry.timestamp,
        author: entry.author,
        id: entry.id,
      }));
  }, [diaryEntries]);

  // Group consecutive photo entries for compact display, and stitch
  // sent emails together with the replies they received into a single
  // email_thread group.
  interface GroupedEntry {
    type: "single" | "photo_group" | "email_thread";
    entries: DiaryEntry[];
    timestamp: string;
    author: string;
    parent?: DiaryEntry;
    replies?: DiaryEntry[];
  }

  const groupedEntries = React.useMemo(() => {
    const groups: GroupedEntry[] = [];
    let currentPhotoGroup: DiaryEntry[] = [];
    // Email threading: group every email entry by counterparty address into
    // a single thread for this job. Earlier this only paired received emails
    // with a *preceding* sent email — which broke when the customer started
    // the conversation (their inbound email + our reply rendered as two
    // separate cards). Address-keyed grouping handles both directions.
    const emailThreadByAddr = new Map<string, GroupedEntry>();
    // Stable address key: an empty/missing address shouldn't collide entries
    // from unrelated correspondents into one thread, so each missing-address
    // entry gets its own bucket.
    let missingAddrCounter = 0;

    const flushPhotoGroup = () => {
      if (currentPhotoGroup.length > 0) {
        groups.push({
          type: "photo_group",
          entries: [...currentPhotoGroup],
          timestamp: currentPhotoGroup[0].timestamp,
          author: currentPhotoGroup[0].author,
        });
        currentPhotoGroup = [];
      }
    };

    diaryEntries.forEach((entry, index) => {
      const isPhotoEntry =
        entry.type === "photo" ||
        (entry.photoUrl && entry.content.toLowerCase().includes("photo"));

      if (isPhotoEntry) {
        currentPhotoGroup.push(entry);

        // Check if next entry is also a photo (within 5 minutes)
        const nextEntry = diaryEntries[index + 1];
        const nextIsPhoto =
          nextEntry &&
          (nextEntry.type === "photo" ||
            (nextEntry.photoUrl &&
              nextEntry.content.toLowerCase().includes("photo")));
        const withinTimeWindow =
          nextEntry &&
          Math.abs(
            new Date(entry.timestamp).getTime() -
              new Date(nextEntry.timestamp).getTime(),
          ) <
            5 * 60 * 1000;

        if (!nextIsPhoto || !withinTimeWindow) {
          flushPhotoGroup();
        }
        return;
      }

      // Email threading — group every email by counterparty address, regardless
      // of direction. SMS keeps the existing per-entry rendering.
      if (entry.type === "email") {
        flushPhotoGroup();
        const addr = getEmailAddress(entry);
        const key = addr || `__missing_${missingAddrCounter++}__`;
        const existing = emailThreadByAddr.get(key);
        if (existing) {
          existing.entries.push(entry);
        } else {
          // Reserve a thread group slot in `groups`. We finalise its parent /
          // replies / timestamp / author after the walk so we can sort by
          // chronological order without re-traversing.
          const newGroup: GroupedEntry = {
            type: "email_thread",
            entries: [entry],
            timestamp: entry.timestamp,
            author: entry.author,
            parent: undefined,
            replies: [],
          };
          emailThreadByAddr.set(key, newGroup);
          groups.push(newGroup);
        }
        return;
      }

      // Non-email, non-photo entry: flush photo group, keep pendingReplies
      // (they may still be matched to an even older sent email further down
      // in the timeline). Standalone single entry.
      flushPhotoGroup();
      groups.push({
        type: "single",
        entries: [entry],
        timestamp: entry.timestamp,
        author: entry.author,
      });
    });

    // Flush any remaining photo group
    flushPhotoGroup();

    // Finalise each email thread now that we've collected every entry for it.
    // Sort entries chronologically (oldest first) so the thread reads top-to-
    // bottom in conversation order. Parent = oldest entry; replies = the rest.
    // Group timestamp uses latest activity so a fresh reply pulls the whole
    // thread to the top of the diary in the sort below.
    for (const group of emailThreadByAddr.values()) {
      group.entries.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return (isNaN(ta) ? 0 : ta) - (isNaN(tb) ? 0 : tb);
      });
      const [parent, ...rest] = group.entries;
      group.parent = parent;
      group.replies = rest;
      group.author = parent?.author ?? group.author;
      const latest = group.entries.reduce((acc, e) => {
        const t = new Date(e.timestamp).getTime();
        return isNaN(t) ? acc : Math.max(acc, t);
      }, 0);
      if (latest > 0) group.timestamp = new Date(latest).toISOString();
    }

    // Re-sort all groups by their effective timestamp so threads with a fresh
    // reply float to the top of the diary instead of staying anchored at the
    // original sent email's date.
    groups.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      if (isNaN(tb) && isNaN(ta)) return 0;
      if (isNaN(tb)) return 1;
      if (isNaN(ta)) return -1;
      return tb - ta;
    });

    return groups;
  }, [diaryEntries]);

  // Function to handle opening invoices from diary entries
  const handleOpenInvoice = (invoiceNumber: string) => {
    if (onInvoiceClick) {
      onInvoiceClick(invoiceNumber);
    } else {
      toast({
        title: "Invoice",
        description: `Invoice ${invoiceNumber} — open the Billing tab to view.`,
      });
    }
  };

  // Function to handle opening proposals from diary entries
  const handleOpenProposal = async (proposalNumber: string) => {
    if (onProposalClick) {
      onProposalClick(proposalNumber);
      return;
    }

    try {
      // Fallback: Fetch all proposals and find the one with matching proposal number
      const response = await apiRequest("GET", "/api/proposals").then((res) =>
        res.json(),
      );
      const proposal = response.data?.find(
        (p: any) => p.proposalNumber === proposalNumber,
      );

      if (proposal) {
        setSelectedProposalId(proposal.id);
        setProposalDialogOpen(true);
      } else {
        toast({
          title: "Error",
          description: "Proposal not found",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error finding proposal:", error);
      toast({
        title: "Error",
        description: "Failed to open proposal",
        variant: "destructive",
      });
    }
  };

  // Helper function to extract document numbers from diary entries
  const extractDocumentInfo = (entry: DiaryEntry) => {
    const content = `${entry.title} ${entry.content}`.toLowerCase();

    // Check for quote
    const quoteMatch = (entry.title + " " + entry.content).match(/QTE-\d+/i);
    if ((content.includes("quote") || content.includes("qte-")) && quoteMatch) {
      return { type: "quote", number: quoteMatch[0] };
    }

    // Check for invoice - match full invoice number format INV-YYYY-MM-XXXXXX or metadata
    const invoiceMatch =
      (entry.title + " " + entry.content).match(/INV-\d{4}-\d{2}-\d{6}/i) ||
      (entry.title + " " + entry.content).match(/INV-[\d-]+/i);

    // Also check plain "Invoice NNNN created" pattern and metadata
    const plainInvoiceCreatedMatch = (entry.title + " " + entry.content).match(/invoice\s+(\d+)\s+created/i);

    if (
      entry.metadata?.invoiceId ||
      entry.metadata?.action === "invoice_created" ||
      entry.metadata?.documentType === "invoice" ||
      invoiceMatch ||
      plainInvoiceCreatedMatch ||
      content.includes("invoice sent") ||
      content.includes("invoice created")
    ) {
      const invoiceNumber = invoiceMatch
        ? invoiceMatch[0]
        : plainInvoiceCreatedMatch
          ? plainInvoiceCreatedMatch[1]
          : entry.metadata?.invoiceNumber ||
            entry.metadata?.documentNumber ||
            "latest";
      return { type: "invoice", number: invoiceNumber, invoiceId: entry.metadata?.invoiceId };
    }

    // Check for proposal
    if (entry.type === "proposal" && entry.metadata?.proposalNumber) {
      return { type: "proposal", number: entry.metadata.proposalNumber };
    }

    return null;
  };

  // Mutations
  const createNoteMutation = useMutation({
    mutationFn: async (data: NoteFormData) => {
      return apiRequest("POST", `/api/jobs/${jobId}/diary`, {
        entryType: "note",
        title: "Job Note",
        description: data.content,
        authorName: currentUser?.name || "System",
        isPrivate: data.isPrivate,
      });
    },
    onSuccess: async () => {
      noteForm.reset();
      setActiveComposer(null);
      await queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      await queryClient.refetchQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add note",
        variant: "destructive",
      });
    },
  });

  const sendSMSMutation = useMutation({
    mutationFn: async (data: SMSFormData) => {
      // This would integrate with your existing SMS service
      return apiRequest("POST", "/api/communications/sms", {
        jobId,
        customerId,
        to: data.phoneNumber,
        message: data.message,
      });
    },
    onSuccess: () => {
      smsForm.reset();
      setActiveComposer(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send SMS",
        variant: "destructive",
      });
    },
  });

  // Mark a customer-confirmation diary entry as having been acknowledged so
  // the AI-drafted reply section hides from it. Existing metadata is merged
  // client-side because the server's update replaces the jsonb column wholesale.
  const acknowledgeConfirmationReplyMutation = useMutation({
    mutationFn: async ({
      entryId,
      existingMetadata,
    }: {
      entryId: string;
      existingMetadata: DiaryEntry["metadata"];
    }) => {
      const mergedMetadata = {
        ...(existingMetadata || {}),
        replyAcknowledged: true,
      };
      // eventType is a client-only synthetic field — don't persist it back.
      delete (mergedMetadata as any).eventType;
      return apiRequest("PUT", `/api/diary/${entryId}`, {
        metadata: mergedMetadata,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error?.message || "Couldn't dismiss the suggested reply.",
        variant: "destructive",
      });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: EmailFormData) => {
      return apiRequest("POST", "/api/communications/email", {
        jobId,
        customerId,
        to: data.to,
        subject: data.subject,
        message: data.message,
        ...(confirmationReplyEntryId && {
          tags: ["confirmation-reply-sent"],
        }),
      });
    },
    onSuccess: (_res, _variables) => {
      // If this send originated from a customer-confirmation suggested reply,
      // mark that entry as acknowledged so the draft section hides. The
      // server-created diary entry (tagged 'confirmation-reply-sent') is
      // what hides the hoisted confirmation-reply card on next render.
      if (confirmationReplyEntryId) {
        // Only call per-entry acknowledge for real diary entries — the
        // hoisted card uses a sentinel id that doesn't exist on the server.
        if (confirmationReplyEntryId !== "__hoisted-card__") {
          const entry = diaryEntries?.find(
            (e: DiaryEntry) => e.id === confirmationReplyEntryId,
          );
          acknowledgeConfirmationReplyMutation.mutate({
            entryId: confirmationReplyEntryId,
            existingMetadata: entry?.metadata,
          });
        }
        setConfirmationReplyEntryId(null);
      }
      emailForm.reset();
      setActiveComposer(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      // Calendars use full-URL query keys (e.g. "/api/jobs?limit=...",
      // "/api/jobs/for-date") that don't match the prefix above. Catch them all
      // so the new "Reply sent" indicator shows up without waiting for the 30s
      // refetch.
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey?.[0];
          return typeof k === "string" && k.startsWith("/api/jobs");
        },
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    },
  });

  // One-click: send the exact draft the user is looking at via the existing
  // communications endpoint, and log a 'confirmation-reply-sent' diary entry
  // so the hoisted card hides itself on next render. The draft must be
  // passed in — never regenerate here, otherwise GPT non-determinism makes
  // the sent message diverge from what the card displayed.
  const sendConfirmationReplyNow = useMutation({
    mutationFn: async (draft: { subject: string; body: string }) => {
      const subject = draft?.subject?.trim();
      const body = draft?.body?.trim();
      if (!subject || !body) {
        throw new Error("Couldn't send reply — draft is empty");
      }
      const to =
        customerEmail ||
        jobData?.customerEmail ||
        customerRecord?.email ||
        "";
      if (!to) {
        throw new Error("No customer email on file");
      }
      await apiRequest("POST", "/api/communications/email", {
        jobId,
        customerId,
        to,
        subject,
        message: body,
        tags: ["confirmation-reply-sent"],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey?.[0];
          return typeof k === "string" && k.startsWith("/api/jobs");
        },
      });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't send confirmation reply",
        description: err?.message || "Please try Edit first instead.",
        variant: "destructive",
      });
    },
  });

  // Handlers for the inline AI-drafted confirmation reply section.
  const handleEditAndSendConfirmationReply = (
    draft: { subject: string; body: string },
    entryId: string,
  ) => {
    setConfirmationReplyEntryId(entryId);
    setReplyToEmail(customerEmail || "");
    setReplySubject(draft.subject);
    setReplyBody(draft.body);
    setActiveComposer("email");
  };

  const handleDismissConfirmationReply = (entryId: string) => {
    const entry = diaryEntries?.find((e: DiaryEntry) => e.id === entryId);
    acknowledgeConfirmationReplyMutation.mutate({
      entryId,
      existingMetadata: entry?.metadata,
    });
  };

  const updateNoteMutation = useMutation({
    mutationFn: async ({
      entryId,
      content,
    }: {
      entryId: string;
      content: string;
    }) => {
      return apiRequest("PUT", `/api/diary/${entryId}`, {
        description: content,
      });
    },
    onSuccess: () => {
      setEditingEntryId(null);
      setEditingContent("");
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update note",
        variant: "destructive",
      });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest("DELETE", `/api/diary/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "diary-timeline"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete entry",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const getEntryIcon = (
    type: DiaryEntry["type"],
    docInfo?: { type: string; number: string } | null,
  ) => {
    // Special case: invoice emails get invoice icon
    if (type === "email" && docInfo?.type === "invoice") {
      return <Receipt className="w-7 h-7 text-green-600" />;
    }

    switch (type) {
      case "note":
        return <MdStickyNote2 className="w-7 h-7 text-yellow-400" />;
      case "sms":
        return <MessageSquare className="w-7 h-7 text-blue-500" />;
      case "email":
        return <MdEmail className="w-7 h-7 text-blue-600" />;
      case "job_event":
        return <CheckCircle className="w-7 h-7 text-green-500" />;
      case "proposal":
        return <Presentation className="w-7 h-7 text-indigo-500" />;
      case "call":
        return <Phone className="w-7 h-7 text-orange-500" />;
      case "photo":
        return <Camera className="w-7 h-7 text-purple-500" />;
      default:
        return <FileText className="w-7 h-7 text-gray-500" />;
    }
  };

  const getEntryColor = (type: DiaryEntry["type"]) => {
    // No background needed - icons are now colored
    return "";
  };

  const formatPhoneNumber = (phone: string) => {
    // Format phone number for display
    if (phone.length === 13 && phone.startsWith("+64")) {
      return `${phone.substring(0, 3)} ${phone.substring(3, 5)} ${phone.substring(5, 8)} ${phone.substring(8)}`;
    }
    return phone;
  };

  const cleanDiaryContent = (
    content: string | null | undefined,
    type: DiaryEntry["type"],
  ) => {
    // Return empty string if content is null or undefined
    if (!content) return "";

    // Remove redundant prefixes from diary content
    let cleaned = content;

    // Remove "SMS sent to [name]" prefix
    cleaned = cleaned.replace(/^SMS sent to [^\n]+\n\n/i, "");

    // Remove "Email sent to [email]" prefix
    cleaned = cleaned.replace(/^Email sent to [^\n]+\n\n/i, "");

    // Remove "Message:" prefix
    cleaned = cleaned.replace(/^Message:\s*/i, "");

    // Remove email reply headers and quoted text for email type
    if (type === "email") {
      // Remove the "On [date] at [time] [name] <[email]> wrote:" pattern that appears AFTER the message
      // This pattern matches the quoted reply footer
      cleaned = cleaned.replace(/\n*On .+? at .+? .+? <.+?> wrote:\s*$/is, "");
      // Also handle pattern without email: "On [date] [name] wrote:"
      cleaned = cleaned.replace(/\n*On .+? wrote:\s*$/is, "");
      // Remove any trailing quoted content that starts with "On" at the end
      cleaned = cleaned.replace(/\n+On\s+.+$/is, "");
    }

    return cleaned.trim();
  };

  // Swipe handlers for photo gallery navigation
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (viewingPhotoIndex !== null) {
      if (isLeftSwipe && viewingPhotoIndex < allPhotos.length - 1) {
        // Swipe left - show next photo
        setViewingPhotoIndex(viewingPhotoIndex + 1);
      }
      if (isRightSwipe && viewingPhotoIndex > 0) {
        // Swipe right - show previous photo
        setViewingPhotoIndex(viewingPhotoIndex - 1);
      }
    }
  };

  // Pull to refresh handler
  const handleRefresh = async () => {
    queryClient.removeQueries({
      queryKey: ["/api/jobs", jobId, "diary-timeline"],
    });
    await refetch();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} enabled={false}>
      <div className={`h-full flex flex-col ${className}`}>
        {/* Header */}
        <div className="flex-shrink-0 p-2 border-b bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Job Diary
            </h3>
            <div className="flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleRefresh}
                data-testid="button-refresh-diary"
                className="h-7 w-7"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
              >
                <Settings className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Quick Note Input */}
          <div className="flex gap-1 items-start">
            <div className="flex-1 relative">
              <MdStickyNote2 className="absolute left-2.5 top-2.5 w-4 h-4 text-yellow-400" />
              <Textarea
                ref={quickNoteInputRef}
                placeholder="Add note..."
                rows={1}
                className="pl-9 pr-9 py-2 text-sm min-h-9 resize-none"
                data-testid="input-quick-note"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1 h-7 w-7"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>
            <Button
              type="button"
              size="icon"
              className="h-9 w-20 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => {
                const input = quickNoteInputRef.current;
                if (input && input.value.trim()) {
                  // Submit the quick note if there's content
                  createNoteMutation.mutate({ content: input.value.trim() });
                  input.value = "";
                } else {
                  // Open composer modal if no content
                  setActiveComposer("note");
                }
              }}
              data-testid="button-add-note"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>

          {/* Diary view tabs — Timeline shows the chronological feed; Photos
              gives crew quick access to every uploaded image at a glance. */}
          <div className="mt-2 flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 -mx-2 px-2">
            <button
              type="button"
              onClick={() => setDiaryTab("timeline")}
              data-testid="tab-diary-timeline"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                diaryTab === "timeline"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setDiaryTab("photos")}
              data-testid="tab-diary-photos"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                diaryTab === "photos"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Photos
              {photoEntries.length > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[1.25rem] h-4 px-1 rounded-full text-[10px] ${
                    diaryTab === "photos"
                      ? "bg-primary/15 text-primary"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {photoEntries.length}
                </span>
              )}
            </button>
            {/* Before/After capture — kept inline with the tabs because crew
                often want to fire it right after toggling between Timeline
                and Photos. It opens a modal rather than switching the view. */}
            <button
              type="button"
              onClick={() => setIsBeforeAfterModalOpen(true)}
              data-testid="button-before-after"
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <Images className="w-3.5 h-3.5" />
              Before/After
            </button>
          </div>
        </div>

        {/* Confirmation-reply card: hoisted above the timeline so it shows
            for every confirmed job (including manual ticks), not just
            auto-detected email/SMS confirmations. Hides once a
            'confirmation-reply-sent' diary entry exists. */}
        {jobData?.customerConfirmed &&
          !confirmationCardDismissed &&
          !diaryEntries.some((e: DiaryEntry) =>
            e.tags?.includes("confirmation-reply-sent"),
          ) && (
            <JobConfirmationReplyCard
              jobId={jobId}
              customerEmail={
                customerEmail || jobData?.customerEmail || customerRecord?.email || ""
              }
              isSending={sendConfirmationReplyNow.isPending}
              onSendNow={(draft) => sendConfirmationReplyNow.mutate(draft)}
              onEditFirst={(draft) => {
                setReplyToEmail(
                  customerEmail ||
                    jobData?.customerEmail ||
                    customerRecord?.email ||
                    "",
                );
                setReplySubject(draft.subject);
                setReplyBody(draft.body);
                // Sentinel marker so sendEmailMutation.onSuccess also writes
                // a 'confirmation-reply-sent' entry for the Edit-first path.
                setConfirmationReplyEntryId("__hoisted-card__");
                setActiveComposer("email");
              }}
              onDismiss={() => setConfirmationCardDismissed(true)}
            />
          )}

        {/* Photos tab: grid of every uploaded photo on this job, click any
            tile to open the existing fullscreen viewer (with swipe navigation). */}
        {diaryTab === "photos" && (
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="text-xs text-muted-foreground">Loading...</div>
              </div>
            ) : photoEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Camera className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" />
                <div className="text-sm text-muted-foreground">
                  No photos uploaded yet
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Photos added to the diary will appear here.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 pr-4">
                {photoEntries.map((photo, idx) => {
                  const galleryIdx = allPhotos.indexOf(photo.url);
                  return (
                    <button
                      key={photo.id ?? `${photo.url}-${idx}`}
                      type="button"
                      onClick={() =>
                        setViewingPhotoIndex(galleryIdx >= 0 ? galleryIdx : 0)
                      }
                      className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover-elevate active-elevate-2"
                      data-testid={`photo-tile-${photo.id ?? idx}`}
                    >
                      <img
                        src={photo.url}
                        alt={`Diary photo ${idx + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="text-[10px] text-white whitespace-nowrap truncate">
                          {formatInTimeZone(
                            new Date(photo.timestamp),
                            "Pacific/Auckland",
                            "MMM d, h:mm a",
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}

        {/* Timeline */}
        {diaryTab === "timeline" && (
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="text-xs text-muted-foreground">Loading...</div>
            </div>
          ) : diaryEntries.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <div className="text-xs text-muted-foreground">
                No entries yet
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-2 pr-4">
              {groupedEntries.map((group, groupIndex) => {
                // Email thread rendering — one consolidated card containing the
                // parent (sent) email plus all received replies stacked below.
                if (group.type === "email_thread") {
                  const parent = group.parent;
                  const replies = group.replies ?? [];

                  const openCalendarBookingFromEntry = (entry: DiaryEntry) => {
                    const content = entry.content || "";
                    const custName =
                      jobData?.jobContactFirstName &&
                      jobData?.jobContactLastName
                        ? `${jobData.jobContactFirstName} ${jobData.jobContactLastName}`
                        : jobData?.jobContactFirstName ||
                          customerRecord?.name ||
                          "Customer";
                    const extractedTime = extractTimeFromText(content);
                    const extractedDate = extractDateFromText(content);
                    const fallbackDate = new Date();
                    fallbackDate.setDate(fallbackDate.getDate() + 1);
                    const dateStr =
                      extractedDate || localDateStr(fallbackDate);

                    setCalendarBookingEntry(entry);
                    setCalendarBookingTitle(custName);
                    setCalendarBookingDate(dateStr);
                    setCalendarBookingTime(extractedTime);
                    setCalendarBookingDuration("30");
                    setCalendarBookingOpen(true);
                  };

                  const startReplyFromEntry = (entry: DiaryEntry) => {
                    const replyEmail =
                      entry.metadata?.emailAddress ||
                      entry.metadata?.recipient ||
                      entry.metadata?.fromEmail ||
                      "";
                    const originalSubject = (
                      entry.content ||
                      entry.title
                        .replace("Email from ", "")
                        .replace("Email sent: ", "")
                    )
                      .replace(/[\r\n]+/g, " ")
                      .substring(0, 100);
                    setReplyToEmail(replyEmail);
                    setReplySubject(originalSubject);
                    setActiveComposer("email");
                  };

                  const parentDirection = parent
                    ? getEmailDirection(parent)
                    : "unknown";
                  const parentMsg = parent
                    ? cleanEmailMessage(parent, parentDirection)
                    : { text: "", recipient: "" };
                  const parentRecipient =
                    parentMsg.recipient ||
                    parent?.metadata?.emailAddress ||
                    parent?.metadata?.recipient ||
                    "";

                  // All entries in chronological order so the thread reads
                  // top-to-bottom like a chat. Each row is direction-aware
                  // (incoming = purple, outgoing = blue) so it's obvious who
                  // wrote what without scanning the labels.
                  const threadEntries = parent ? [parent, ...replies] : replies;
                  const counterpartyAddr =
                    threadEntries
                      .map((e) => getEmailAddress(e))
                      .find((a): a is string => !!a) || "";
                  return (
                    <div
                      key={`email-thread-${groupIndex}`}
                      className="group"
                      data-testid="diary-email-thread"
                    >
                      <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                        {/* Thread header */}
                        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <MdEmail className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                              Email thread
                            </span>
                            {counterpartyAddr && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                with {counterpartyAddr}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {threadEntries.length}{" "}
                            {threadEntries.length === 1 ? "message" : "messages"}
                          </span>
                        </div>

                        {/* Chronological message list */}
                        <div className="px-3 py-3 space-y-3">
                          {threadEntries.map((msg) => {
                            const direction = getEmailDirection(msg);
                            const cleaned = cleanEmailMessage(msg, direction);
                            const isOutgoing = direction === "sent";
                            const senderLabel = isOutgoing
                              ? `to ${cleaned.recipient || msg.metadata?.emailAddress || msg.metadata?.recipient || counterpartyAddr || "customer"}`
                              : `from ${
                                  msg.author && msg.author !== "System"
                                    ? msg.author
                                    : msg.metadata?.fromEmail ||
                                      msg.metadata?.emailAddress ||
                                      counterpartyAddr ||
                                      "customer"
                                }`;
                            const accent = isOutgoing
                              ? "border-blue-400 dark:border-blue-500"
                              : "border-purple-400 dark:border-purple-500";
                            const bubbleBg = isOutgoing
                              ? "bg-blue-50 dark:bg-blue-900/30"
                              : "bg-purple-50 dark:bg-purple-900/30";
                            const bubbleText = isOutgoing
                              ? "text-blue-900 dark:text-blue-100"
                              : "text-purple-900 dark:text-purple-100";
                            const labelText = isOutgoing
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-purple-700 dark:text-purple-300";
                            const iconColor = isOutgoing
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-purple-600 dark:text-purple-400";
                            return (
                              <div
                                key={msg.id}
                                className={`border-l-2 pl-3 ml-1 ${accent}`}
                                data-testid={`email-thread-msg-${msg.id}`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                    {isOutgoing ? (
                                      <Send className={`w-3 h-3 flex-shrink-0 ${iconColor}`} />
                                    ) : (
                                      <Reply className={`w-3 h-3 flex-shrink-0 ${iconColor}`} />
                                    )}
                                    <span className={`text-xs font-medium ${labelText}`}>
                                      {isOutgoing ? "You sent" : "Reply received"}
                                    </span>
                                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                      {senderLabel}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap text-right">
                                      {formatInTimeZone(
                                        new Date(msg.timestamp),
                                        "Pacific/Auckland",
                                        "h:mm a dd/MM/yy",
                                      )}
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm("Delete this email?")) {
                                          deleteEntryMutation.mutate(msg.id);
                                        }
                                      }}
                                      data-testid={`button-delete-thread-msg-${msg.id}`}
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </Button>
                                  </div>
                                </div>
                                <div className={`rounded-md px-3 py-2 ${bubbleBg}`}>
                                  <p
                                    className={`text-xs leading-relaxed whitespace-pre-wrap break-words ${bubbleText}`}
                                    style={{ wordBreak: "break-word" }}
                                  >
                                    {cleaned.text}
                                  </p>
                                </div>
                                {!isOutgoing && (
                                  <div className="mt-1.5 flex items-center justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[10px] px-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        startReplyFromEntry(msg);
                                      }}
                                      data-testid={`button-reply-${msg.id}`}
                                    >
                                      <Reply className="w-3 h-3 mr-0.5" /> Reply
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[10px] px-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCalendarBookingFromEntry(msg);
                                      }}
                                      data-testid={`button-calendar-book-${msg.id}`}
                                    >
                                      <CalendarPlus className="w-3 h-3 mr-0.5" /> Book
                                    </Button>
                                  </div>
                                )}
                                {isOutgoing && msg.metadata?.sendgridMessageId && (
                                  <div className="mt-1.5 flex items-center justify-end">
                                    <EmailActivity
                                      messageId={msg.metadata.sendgridMessageId}
                                    />
                                  </div>
                                )}
                                {!isOutgoing &&
                                  !isJobClosed &&
                                  !(
                                    msg.metadata as
                                      | { replyAcknowledged?: boolean }
                                      | undefined
                                  )?.replyAcknowledged &&
                                  !hasOutboundReplyAfter(diaryEntries, msg) && (
                                    <div className="mt-2 rounded-md border border-purple-200 dark:border-purple-800 overflow-hidden">
                                      <SuggestedReplyDraft
                                        entry={msg}
                                        jobId={jobId}
                                        onEditAndSend={handleEditAndSendConfirmationReply}
                                        onDismiss={handleDismissConfirmationReply}
                                        isDismissing={
                                          acknowledgeConfirmationReplyMutation.isPending
                                        }
                                      />
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Photo group rendering
                if (group.type === "photo_group") {
                  const photos = group.entries.filter((e) => e.photoUrl);
                  return (
                    <div
                      key={`photo-group-${groupIndex}`}
                      className="group"
                      data-testid="diary-photo-group"
                    >
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                              <Camera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                {photos.length} Photo
                                {photos.length > 1 ? "s" : ""} added
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                <Clock className="w-2.5 h-2.5" />
                                {formatInTimeZone(
                                  new Date(group.timestamp),
                                  "Pacific/Auckland",
                                  "h:mm a dd/MM/yy",
                                )}
                                <span className="mx-0.5">·</span>
                                <User className="w-2.5 h-2.5" />
                                {group.author}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  `Delete ${photos.length} photo${photos.length > 1 ? "s" : ""}?`,
                                )
                              ) {
                                photos.forEach((p) =>
                                  deleteEntryMutation.mutate(p.id),
                                );
                              }
                            }}
                            data-testid="button-delete-photo-group"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        {/* Photo Grid */}
                        <div
                          className={`p-2 grid gap-1.5 max-w-[50%] ${
                            photos.length === 1
                              ? "grid-cols-1"
                              : photos.length === 2
                                ? "grid-cols-2"
                                : photos.length <= 4
                                  ? "grid-cols-2"
                                  : "grid-cols-3"
                          }`}
                        >
                          {photos.map((photo, photoIndex) => (
                            <div
                              key={photo.id}
                              className={`relative rounded-lg overflow-hidden cursor-pointer hover-elevate ${
                                photos.length === 1
                                  ? ""
                                  : photos.length === 3 && photoIndex === 0
                                    ? "row-span-2 aspect-square"
                                    : "aspect-square"
                              }`}
                              onClick={() => {
                                const idx = allPhotos.indexOf(
                                  photo.photoUrl || "",
                                );
                                setViewingPhotoIndex(idx >= 0 ? idx : 0);
                              }}
                            >
                              <img
                                src={photo.photoUrl}
                                alt="Job photo"
                                className={
                                  photos.length === 1
                                    ? "w-full h-auto max-h-48 object-contain"
                                    : "w-full h-full object-cover"
                                }
                                onError={(e) =>
                                  (e.currentTarget.style.display = "none")
                                }
                              />
                              {photos.length > 4 &&
                                photoIndex === 3 &&
                                photos.length > 4 && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <span className="text-white font-semibold text-lg">
                                      +{photos.length - 4}
                                    </span>
                                  </div>
                                )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Single entry rendering
                const entry = group.entries[0];
                const docInfo = extractDocumentInfo(entry);
                const isClickable =
                  docInfo &&
                  ((docInfo.type === "quote" && onQuoteClick) ||
                    (docInfo.type === "invoice" && onInvoiceClick) ||
                    (docInfo.type === "proposal" && (onProposalClick || true)));

                const handleEntryClick = () => {
                  if (!docInfo) return;

                  if (docInfo.type === "quote" && onQuoteClick) {
                    onQuoteClick(docInfo.number);
                  } else if (docInfo.type === "invoice" && onInvoiceClick) {
                    onInvoiceClick(docInfo.number);
                  } else if (docInfo.type === "proposal") {
                    handleOpenProposal(docInfo.number);
                  }
                };

                // Special rendering for SMS and Email entries (chat-style bubbles)
                if (entry.type === "sms" || entry.type === "email") {
                  // Check both title and content for better detection
                  const titleLower = entry.title.toLowerCase();
                  const contentLower = entry.content.toLowerCase();
                  const isSent =
                    titleLower.includes("sent") ||
                    contentLower.includes("email sent to") ||
                    contentLower.includes("sms sent to");
                  const isReceived =
                    titleLower.includes("reply") || titleLower.includes("from");

                  // Extract message text
                  let messageText = entry.content;
                  let recipientInfo = "";

                  if (isSent && messageText.includes("Message:")) {
                    // Extract recipient email/phone before "Message:"
                    const beforeMessage = messageText.split("Message:")[0];
                    if (beforeMessage.includes("Email sent to")) {
                      recipientInfo = beforeMessage
                        .split("Email sent to")[1]
                        .trim();
                    } else if (beforeMessage.includes("SMS sent to")) {
                      recipientInfo = beforeMessage
                        .split("SMS sent to")[1]
                        .trim();
                    }

                    // Extract message and strip HTML tags
                    messageText = messageText.split("Message:")[1].trim();

                    // Strip HTML tags and convert to plain text
                    messageText = messageText
                      .replace(/<br\s*\/?>/gi, "\n") // Convert <br> to newlines
                      .replace(/<\/p>/gi, "\n") // Convert </p> to newlines
                      .replace(/<p>/gi, "") // Remove <p> tags
                      .replace(/<[^>]+>/g, "") // Remove any other HTML tags
                      .trim();
                  } else if (isReceived && messageText.includes(":\n\n")) {
                    messageText = messageText.split(":\n\n")[1].trim();
                  }

                  // Clean up received messages: remove email metadata that appears after message content
                  if (isReceived) {
                    // Normalize line endings and HTML formatting first
                    messageText = messageText
                      .replace(/\r\n/g, "\n")
                      .replace(/\r/g, "\n")
                      .replace(/<br\s*\/?>/gi, "\n") // Convert <br> to newlines
                      .replace(/<\/p>/gi, "\n") // Convert </p> to newlines
                      .replace(/<p>/gi, "") // Remove <p> tags
                      .replace(/<[^>]+>/g, ""); // Remove any other HTML tags

                    // Remove email metadata blocks that typically appear at the end
                    // These usually start with "From:" and include Sent:, To:, Subject:, etc.
                    // Look for the pattern: newline + "From:" followed by email metadata
                    const fromIndex = messageText.search(/\n+From:\s*.+?[@<]/i);
                    if (fromIndex !== -1) {
                      // Truncate everything from "From:" onwards
                      messageText = messageText.substring(0, fromIndex);
                    }

                    // Also check for "Sent:" as an alternative starting point
                    const sentIndex =
                      messageText.search(/\n+Sent:\s*.+?\d{4}/i);
                    if (sentIndex !== -1) {
                      messageText = messageText.substring(0, sentIndex);
                    }

                    // Final cleanup: trim and remove excessive whitespace
                    messageText = messageText.trim();
                  }

                  return (
                    <div key={entry.id} className="group">
                      <div
                        className={`rounded-xl overflow-hidden shadow-sm ${
                          isSent
                            ? "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                            : "bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800"
                        }`}
                      >
                        {/* Header */}
                        <div
                          className={`flex items-center justify-between px-3 py-1.5 ${
                            isSent
                              ? "border-b border-gray-200 dark:border-gray-700"
                              : "border-b border-purple-200 dark:border-purple-800"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {entry.type === "email" ? (
                              <MdEmail
                                className={`w-3.5 h-3.5 ${isSent ? "text-gray-500 dark:text-gray-400" : "text-purple-600 dark:text-purple-400"}`}
                              />
                            ) : (
                              <MessageSquare
                                className={`w-3.5 h-3.5 ${isSent ? "text-gray-500 dark:text-gray-400" : "text-purple-600 dark:text-purple-400"}`}
                              />
                            )}
                            <span
                              className={`text-[10px] font-medium ${isSent ? "text-gray-600 dark:text-gray-300" : "text-purple-600 dark:text-purple-400"}`}
                            >
                              {entry.type === "sms" ? "SMS" : "Email"}
                            </span>
                            <span
                              className={`text-[10px] ${isSent ? "text-gray-500 dark:text-gray-400" : "text-purple-600 dark:text-purple-400"}`}
                            >
                              {isSent
                                ? recipientInfo
                                  ? `to ${recipientInfo}`
                                  : ""
                                : "received"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`text-[10px] whitespace-nowrap ${isSent ? "text-gray-400 dark:text-gray-500" : "text-purple-500 dark:text-purple-400"}`}
                            >
                              {formatInTimeZone(
                                new Date(entry.timestamp),
                                "Pacific/Auckland",
                                "h:mm a dd/MM/yy",
                              )}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={`h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity ${
                                isSent
                                  ? "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                  : "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Delete this message?")) {
                                  deleteEntryMutation.mutate(entry.id);
                                }
                              }}
                              data-testid={`button-delete-${entry.type}-${entry.id}`}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        </div>
                        {/* Content */}
                        <div
                          className={`px-3 py-2 min-w-0 overflow-hidden ${isClickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                          onClick={isClickable ? handleEntryClick : undefined}
                        >
                          <p
                            className={`text-xs leading-relaxed whitespace-pre-wrap break-words w-full ${
                              isSent
                                ? "text-gray-700 dark:text-gray-300"
                                : "text-purple-900 dark:text-purple-100"
                            } ${isClickable ? "underline underline-offset-2 decoration-dashed" : ""}`}
                            style={{ wordBreak: "break-word" }}
                          >
                            {messageText}
                          </p>
                        </div>
                        {/* Footer with tracking and reply */}
                        <div
                          className={`px-3 py-1.5 flex items-center justify-between gap-2 ${
                            isSent
                              ? "border-t border-gray-200 dark:border-gray-700"
                              : "border-t border-purple-200 dark:border-purple-800"
                          }`}
                        >
                          {/* Email tracking for sent emails */}
                          {isSent && entry.type === "email" ? (
                            entry.metadata?.sendgridMessageId ? (
                              <EmailActivity
                                messageId={entry.metadata.sendgridMessageId}
                              />
                            ) : (
                              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <CheckCircle className="h-2.5 w-2.5" />
                                <span>Sent</span>
                              </div>
                            )
                          ) : (
                            <div />
                          )}

                          {/* Reply/Follow-up button for all messages */}
                          <div className="flex items-center gap-1">
                            {entry.type === "email" &&
                              (entry.metadata?.emailAddress ||
                                entry.metadata?.recipient) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={`h-6 text-[10px] px-2 ${
                                    isSent
                                      ? "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                      : "text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800"
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const replyEmail =
                                      entry.metadata?.emailAddress ||
                                      entry.metadata?.recipient ||
                                      "";
                                    const originalSubject = (
                                      entry.content ||
                                      entry.title
                                        .replace("Email from ", "")
                                        .replace("Email sent: ", "")
                                    )
                                      .replace(/[\r\n]+/g, " ")
                                      .substring(0, 100);
                                    setReplyToEmail(replyEmail);
                                    setReplySubject(originalSubject);
                                    setActiveComposer("email");
                                  }}
                                  data-testid={`button-reply-email-${entry.id}`}
                                >
                                  <Reply className="w-3 h-3 mr-0.5" />
                                  {isSent ? "Follow up" : "Reply"}
                                </Button>
                              )}
                            {/* Calendar booking button for emails */}
                            {entry.type === "email" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] px-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const content = entry.content || "";
                                  const custName =
                                    jobData?.jobContactFirstName &&
                                    jobData?.jobContactLastName
                                      ? `${jobData.jobContactFirstName} ${jobData.jobContactLastName}`
                                      : jobData?.jobContactFirstName ||
                                        customerRecord?.name ||
                                        "Customer";
                                  const extractedTime =
                                    extractTimeFromText(content);
                                  const extractedDate =
                                    extractDateFromText(content);
                                  const fallbackDate = new Date();
                                  fallbackDate.setDate(
                                    fallbackDate.getDate() + 1,
                                  );
                                  const dateStr =
                                    extractedDate ||
                                    localDateStr(fallbackDate);

                                  setCalendarBookingEntry(entry);
                                  setCalendarBookingTitle(custName);
                                  setCalendarBookingDate(dateStr);
                                  setCalendarBookingTime(extractedTime);
                                  setCalendarBookingDuration("30");
                                  setCalendarBookingOpen(true);
                                }}
                                data-testid={`button-calendar-book-${entry.id}`}
                              >
                                <CalendarPlus className="w-3 h-3 mr-0.5" />
                                Book
                              </Button>
                            )}
                            {entry.type === "sms" &&
                              entry.metadata?.phoneNumber && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`h-6 text-[10px] px-2 ${
                                      isSent
                                        ? "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                        : "text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-800"
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const replyPhone =
                                        entry.metadata?.phoneNumber || "";
                                      setReplyToPhone(replyPhone);
                                      setActiveComposer("sms");
                                    }}
                                    data-testid={`button-reply-sms-${entry.id}`}
                                  >
                                    <Reply className="w-3 h-3 mr-0.5" />
                                    {isSent ? "Follow up" : "Reply"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] px-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-800"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const content = entry.content || "";
                                      const custName =
                                        jobData?.jobContactFirstName &&
                                        jobData?.jobContactLastName
                                          ? `${jobData.jobContactFirstName} ${jobData.jobContactLastName}`
                                          : jobData?.jobContactFirstName ||
                                            customerRecord?.name ||
                                            "Customer";
                                      const extractedTime =
                                        extractTimeFromText(content);
                                      const extractedDate =
                                        extractDateFromText(content);
                                      const fallbackDate = new Date();
                                      fallbackDate.setDate(
                                        fallbackDate.getDate() + 1,
                                      );
                                      const dateStr =
                                        extractedDate ||
                                        localDateStr(fallbackDate);

                                      setCalendarBookingEntry(entry);
                                      setCalendarBookingTitle(custName);
                                      setCalendarBookingDate(dateStr);
                                      setCalendarBookingTime(extractedTime);
                                      setCalendarBookingDuration("30");
                                      setCalendarBookingOpen(true);
                                    }}
                                    data-testid={`button-calendar-book-sms-${entry.id}`}
                                  >
                                    <CalendarPlus className="w-3 h-3 mr-0.5" />
                                    Book
                                  </Button>
                                </>
                              )}
                          </div>
                        </div>
                      </div>
                      {isReceived &&
                        !isJobClosed &&
                        !(entry.metadata as { replyAcknowledged?: boolean } | undefined)
                          ?.replyAcknowledged &&
                        !hasOutboundReplyAfter(diaryEntries, entry) && (
                        <SuggestedReplyDraft
                          entry={entry}
                          jobId={jobId}
                          onEditAndSend={handleEditAndSendConfirmationReply}
                          onDismiss={handleDismissConfirmationReply}
                          isDismissing={
                            acknowledgeConfirmationReplyMutation.isPending
                          }
                        />
                      )}
                    </div>
                  );
                }

                // Get entry-specific styling
                const getEntryStyle = (type: string) => {
                  switch (type) {
                    case "note":
                      return {
                        bg: "bg-yellow-50 dark:bg-yellow-900/20",
                        border: "border-yellow-200 dark:border-yellow-800",
                        icon: "bg-yellow-100 dark:bg-yellow-900/50",
                      };
                    case "proposal":
                      return {
                        bg: "bg-indigo-50 dark:bg-indigo-900/20",
                        border: "border-indigo-200 dark:border-indigo-800",
                        icon: "bg-indigo-100 dark:bg-indigo-900/50",
                      };
                    case "job_event":
                      return {
                        bg: "bg-green-50 dark:bg-green-900/20",
                        border: "border-green-200 dark:border-green-800",
                        icon: "bg-green-100 dark:bg-green-900/50",
                      };
                    case "call":
                      return {
                        bg: "bg-orange-50 dark:bg-orange-900/20",
                        border: "border-orange-200 dark:border-orange-800",
                        icon: "bg-orange-100 dark:bg-orange-900/50",
                      };
                    default:
                      return {
                        bg: "bg-gray-50 dark:bg-gray-800",
                        border: "border-gray-200 dark:border-gray-700",
                        icon: "bg-gray-100 dark:bg-gray-900/50",
                      };
                  }
                };
                const entryStyle = getEntryStyle(entry.type);

                return (
                  <div
                    key={entry.id}
                    className="group"
                    data-testid={`diary-entry-${entry.type}`}
                  >
                    <div
                      className={`rounded-xl overflow-hidden shadow-sm border ${entryStyle.border} ${entryStyle.bg} ${isClickable ? "cursor-pointer hover-elevate active-elevate-2" : ""}`}
                      onClick={isClickable ? handleEntryClick : undefined}
                    >
                      {/* Header */}
                      <div
                        className={`flex items-center justify-between px-3 py-2 border-b ${entryStyle.border}`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full ${entryStyle.icon} flex items-center justify-center flex-shrink-0`}
                          >
                            {entry.type === "note" && (
                              <MdStickyNote2 className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                            )}
                            {entry.type === "proposal" && (
                              <Presentation className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            )}
                            {entry.type === "job_event" && (
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                            )}
                            {entry.type === "call" && (
                              <Phone className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                            )}
                            {![
                              "note",
                              "proposal",
                              "job_event",
                              "call",
                            ].includes(entry.type) && (
                              <FileText className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                              {entry.type === "note"
                                ? "Note"
                                : entry.type === "proposal"
                                  ? "Proposal"
                                  : entry.type === "job_event"
                                    ? "Event"
                                    : entry.type === "call"
                                      ? "Call"
                                      : "Entry"}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                              <Clock className="w-2.5 h-2.5" />
                              {formatInTimeZone(
                                new Date(entry.timestamp),
                                "Pacific/Auckland",
                                "h:mm a dd/MM/yy",
                              )}
                              <span className="mx-0.5">·</span>
                              <User className="w-2.5 h-2.5" />
                              {entry.author}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {entry.type === "note" &&
                            editingEntryId !== entry.id && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEntryId(entry.id);
                                  setEditingContent(entry.content);
                                }}
                                data-testid={`button-edit-entry-${entry.id}`}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                            )}
                          {editingEntryId !== entry.id &&
                            entry.metadata?.isDeletable !== false && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    confirm(
                                      "Are you sure you want to delete this entry?",
                                    )
                                  ) {
                                    deleteEntryMutation.mutate(entry.id);
                                  }
                                }}
                                data-testid={`button-delete-entry-${entry.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="px-3 py-2 min-w-0 overflow-hidden">
                        {editingEntryId === entry.id ? (
                          <div
                            className="space-y-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Textarea
                              value={editingContent}
                              onChange={(e) =>
                                setEditingContent(e.target.value)
                              }
                              className="text-xs min-h-[60px]"
                              placeholder="Edit note content..."
                              data-testid="textarea-edit-note"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateNoteMutation.mutate({
                                    entryId: entry.id,
                                    content: editingContent,
                                  });
                                }}
                                disabled={
                                  updateNoteMutation.isPending ||
                                  !editingContent.trim()
                                }
                                data-testid="button-save-edit"
                              >
                                <Save className="w-3 h-3 mr-1" />
                                {updateNoteMutation.isPending
                                  ? "Saving..."
                                  : "Save"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEntryId(null);
                                  setEditingContent("");
                                }}
                                data-testid="button-cancel-edit"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Special handling for invoice emails */}
                            {entry.type === "email" &&
                            docInfo?.type === "invoice" ? (
                              <div className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <span>Invoice sent</span>
                                <Button
                                  size="sm"
                                  variant="link"
                                  className="h-auto p-0 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onInvoiceClick) {
                                      onInvoiceClick(docInfo.number);
                                    }
                                  }}
                                  data-testid="button-view-invoice-link"
                                >
                                  Invoice #{docInfo.number}
                                </Button>
                              </div>
                            ) : entry.type === "email" &&
                              (() => {
                                // Check if this is a proposal email
                                const match =
                                  entry.title.match(/PROP-\d+|DRAFT-\d+/);
                                return match ? match[0] : null;
                              })() ? (
                              <div
                                className="text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-800 dark:hover:text-blue-300 whitespace-pre-line break-words overflow-hidden transition-colors w-full"
                                style={{ wordBreak: "break-word" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const match =
                                    entry.title.match(/PROP-\d+|DRAFT-\d+/);
                                  if (match) {
                                    handleOpenProposal(match[0]);
                                  }
                                }}
                                data-testid="link-proposal-message"
                              >
                                {cleanDiaryContent(entry.content, entry.type)}
                              </div>
                            ) : (
                              <div
                                className={`${entry.type === "email" ? "text-sm font-bold" : "text-xs"} text-gray-700 dark:text-gray-300 whitespace-pre-line break-words overflow-hidden w-full`}
                                style={{ wordBreak: "break-word" }}
                              >
                                {cleanDiaryContent(entry.content, entry.type)}
                              </div>
                            )}

                            {entry.photoUrl && (
                              <div className="mt-2">
                                <img
                                  src={entry.photoUrl}
                                  alt="Job photo"
                                  className="max-w-full h-auto max-h-64 rounded-lg cursor-pointer hover-elevate object-contain"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const photoIndex = allPhotos.indexOf(
                                      entry.photoUrl || "",
                                    );
                                    setViewingPhotoIndex(
                                      photoIndex >= 0 ? photoIndex : 0,
                                    );
                                  }}
                                  onError={(e) => {
                                    console.error(
                                      "Image failed to load:",
                                      entry.photoUrl,
                                    );
                                    e.currentTarget.style.display = "none";
                                  }}
                                  onLoad={() => {
                                    console.log(
                                      "Image loaded successfully:",
                                      entry.photoUrl,
                                    );
                                  }}
                                  data-testid="img-diary-photo"
                                />
                              </div>
                            )}

                            {/* Audio player for call recordings */}
                            {entry.type === "call" &&
                              entry.metadata?.recordingUrl && (
                                <div className="mt-2 space-y-2">
                                  <audio
                                    controls
                                    className="w-full h-8"
                                    src={entry.metadata.recordingUrl}
                                    preload="metadata"
                                  />
                                  {entry.metadata?.transcription && (
                                    <details className="text-xs">
                                      <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                                        View transcription
                                      </summary>
                                      <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                        {entry.metadata.transcription}
                                      </div>
                                    </details>
                                  )}
                                  {entry.metadata?.sentiment && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground">
                                        Sentiment:
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] ${
                                          entry.metadata.sentiment ===
                                          "positive"
                                            ? "border-green-500 text-green-600"
                                            : entry.metadata.sentiment ===
                                                "negative"
                                              ? "border-red-500 text-red-600"
                                              : "border-gray-500 text-gray-600"
                                        }`}
                                      >
                                        {entry.metadata.sentiment}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              )}
                          </>
                        )}

                        {/* Reply buttons for email and SMS */}
                        {editingEntryId !== entry.id &&
                          (() => {
                            console.log(
                              "🔍 Checking reply button for entry:",
                              entry.id,
                              "type:",
                              entry.type,
                              "metadata:",
                              entry.metadata,
                            );
                            return null;
                          })()}
                        {editingEntryId !== entry.id && (
                          <>
                            {entry.type === "email" &&
                              (entry.metadata?.emailAddress ||
                                entry.metadata?.recipient) && (
                                <div className="mt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log(
                                        "📧 Email reply metadata:",
                                        entry.metadata,
                                      );
                                      const replyEmail =
                                        entry.metadata?.emailAddress ||
                                        entry.metadata?.recipient ||
                                        "";
                                      // Extract subject from email title or content field - sanitize newlines
                                      const originalSubject = (
                                        entry.content ||
                                        entry.title
                                          .replace("Email from ", "")
                                          .replace("Email sent: ", "")
                                      )
                                        .replace(/[\r\n]+/g, " ")
                                        .substring(0, 100);
                                      setReplyToEmail(replyEmail);
                                      setReplySubject(originalSubject);
                                      setActiveComposer("email");
                                    }}
                                    data-testid={`button-reply-email-${entry.id}`}
                                  >
                                    <Mail className="w-3 h-3 mr-1" />
                                    Reply
                                  </Button>
                                </div>
                              )}
                            {entry.type === "sms" &&
                              entry.metadata?.phoneNumber && (
                                <div className="mt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log(
                                        "📱 SMS reply metadata:",
                                        entry.metadata,
                                      );
                                      setReplyToPhone(
                                        entry.metadata?.phoneNumber || "",
                                      );
                                      setActiveComposer("sms");
                                    }}
                                    data-testid={`button-reply-sms-${entry.id}`}
                                  >
                                    <MessageSquare className="w-3 h-3 mr-1" />
                                    Reply
                                  </Button>
                                </div>
                              )}
                          </>
                        )}

                        {(() => {
                          // Extract proposal number from title if not in metadata (for old entries)
                          let proposalNumber = entry.metadata?.proposalNumber;
                          if (
                            (entry.type === "email" || entry.type === "sms") &&
                            !proposalNumber &&
                            entry.title
                          ) {
                            const match =
                              entry.title.match(/PROP-\d+|DRAFT-\d+/);
                            if (match) {
                              proposalNumber = match[0];
                            }
                          }

                          const shouldShowButton =
                            entry.type === "proposal" ||
                            ((entry.type === "email" || entry.type === "sms") &&
                              proposalNumber);
                          if (!shouldShowButton) return null;

                          return (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              {entry.type === "proposal" && (
                                <Badge
                                  variant="outline"
                                  className="text-xs whitespace-nowrap"
                                >
                                  {entry.metadata?.status || "draft"}
                                </Badge>
                              )}
                              {entry.type === "proposal" &&
                                entry.metadata?.viewedDate && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs whitespace-nowrap bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    Viewed
                                  </Badge>
                                )}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-xs h-6 whitespace-nowrap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (proposalNumber) {
                                    handleOpenProposal(proposalNumber);
                                  }
                                }}
                                data-testid="button-view-proposal"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View Proposal
                              </Button>
                            </div>
                          );
                        })()}

                        {(() => {
                          // Show "View Invoice" button for invoice diary entries
                          const invoiceNumber =
                            entry.metadata?.invoiceNumber ||
                            entry.metadata?.documentNumber ||
                            docInfo?.number;
                          const isInvoiceEntry =
                            entry.metadata?.documentType === "invoice" ||
                            docInfo?.type === "invoice";
                          if (!isInvoiceEntry || !invoiceNumber) return null;

                          return (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              {entry.metadata?.status && (
                                <Badge
                                  variant="outline"
                                  className="text-xs whitespace-nowrap"
                                >
                                  {entry.metadata.status}
                                </Badge>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-xs h-6 whitespace-nowrap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenInvoice(invoiceNumber);
                                }}
                                data-testid="button-view-invoice"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                View Invoice
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        )}

        {/* Quick Actions row removed — SMS, Email, Call already live up top
            on the job card; Before/After moved into the diary tab row above. */}

        <BeforeAfterCaptureModal
          isOpen={isBeforeAfterModalOpen}
          onClose={() => setIsBeforeAfterModalOpen(false)}
          jobId={jobId}
        />


        {/* Composer Dialogs */}
        <Dialog
          open={activeComposer === "note"}
          onOpenChange={() => setActiveComposer(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Job Note</DialogTitle>
              <DialogDescription>
                Add a detailed note to the job diary
              </DialogDescription>
            </DialogHeader>
            <Form {...noteForm}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  noteForm.handleSubmit((data) =>
                    createNoteMutation.mutate(data),
                  )(e);
                }}
                className="space-y-4"
              >
                <FormField
                  control={noteForm.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Note</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter your note here..."
                          rows={4}
                          data-testid="textarea-note-content"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveComposer(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createNoteMutation.isPending}
                    data-testid="button-save-note"
                  >
                    {createNoteMutation.isPending ? "Adding..." : "Add Note"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={activeComposer === "sms"}
          onOpenChange={() => setActiveComposer(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Send SMS</DialogTitle>
              <DialogDescription>
                Send an SMS message to the customer
              </DialogDescription>
            </DialogHeader>
            <Form {...smsForm}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  smsForm.handleSubmit((data) => sendSMSMutation.mutate(data))(
                    e,
                  );
                }}
                className="space-y-4"
              >
                <div>
                  <FormLabel>Template</FormLabel>
                  <Select
                    value={selectedSmsTemplate}
                    onValueChange={handleSmsTemplateSelect}
                  >
                    <SelectTrigger
                      className="text-base md:text-sm"
                      data-testid="select-sms-template"
                    >
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      {smsTemplates.map((template: any) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FormField
                  control={smsForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="+64 21 000 0000"
                          data-testid="input-sms-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={smsForm.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter your message..."
                          rows={3}
                          maxLength={160}
                          data-testid="textarea-sms-message"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveComposer(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={sendSMSMutation.isPending}
                    data-testid="button-send-sms-submit"
                  >
                    {sendSMSMutation.isPending ? "Sending..." : "Send SMS"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={activeComposer === "email"}
          onOpenChange={() => setActiveComposer(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Send Email</DialogTitle>
              <DialogDescription>
                Send an email to {customerRecord?.name || "the customer"}
              </DialogDescription>
            </DialogHeader>
            <Form {...emailForm}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  emailForm.handleSubmit((data) =>
                    sendEmailMutation.mutate(data),
                  )(e);
                }}
                className="space-y-4"
              >
                <div>
                  <FormLabel>Template</FormLabel>
                  <Select
                    value={selectedEmailTemplate}
                    onValueChange={handleEmailTemplateSelect}
                  >
                    <SelectTrigger
                      className="text-base md:text-sm"
                      data-testid="select-email-template"
                    >
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      {emailTemplates.map((template: any) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <FormField
                  control={emailForm.control}
                  name="to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="customer@example.com"
                          type="email"
                          data-testid="input-email-to"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Job Update"
                          data-testid="input-email-subject"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter your message..."
                          rows={6}
                          data-testid="textarea-email-message"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveComposer(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={sendEmailMutation.isPending}
                    data-testid="button-send-email-submit"
                  >
                    {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Proposal Builder Dialog */}
        {selectedProposalId && (
          <ProposalBuilder
            isOpen={proposalDialogOpen}
            onClose={() => {
              setProposalDialogOpen(false);
              setSelectedProposalId(null);
            }}
            jobId={jobId}
            customerId={customerId}
            mode="edit"
            proposalId={selectedProposalId}
          />
        )}

        {/* Photo Viewer Modal with Gallery Navigation */}
        <Dialog
          open={viewingPhotoIndex !== null}
          onOpenChange={(open) => !open && setViewingPhotoIndex(null)}
        >
          <DialogContent className="max-w-6xl w-full p-0 h-[90vh] flex flex-col">
            <DialogHeader className="p-4 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>Job Photos</DialogTitle>
                  <DialogDescription>
                    {viewingPhotoIndex !== null &&
                      `Photo ${viewingPhotoIndex + 1} of ${allPhotos.length}`}
                  </DialogDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingPhotoIndex(null)}
                  data-testid="button-close-photo"
                >
                  Close
                </Button>
              </div>
            </DialogHeader>

            {viewingPhotoIndex !== null && allPhotos[viewingPhotoIndex] && (
              <div
                className="flex-1 flex items-center justify-center p-4 relative overflow-hidden touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {/* Previous Button */}
                {allPhotos.length > 1 && viewingPhotoIndex > 0 && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white"
                    onClick={() => setViewingPhotoIndex(viewingPhotoIndex - 1)}
                    data-testid="button-previous-photo"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>
                )}

                {/* Photo */}
                <img
                  src={allPhotos[viewingPhotoIndex]}
                  alt={`Job photo ${viewingPhotoIndex + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg select-none"
                  data-testid="img-photo-viewer"
                  draggable="false"
                />

                {/* Next Button */}
                {allPhotos.length > 1 &&
                  viewingPhotoIndex < allPhotos.length - 1 && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white"
                      onClick={() =>
                        setViewingPhotoIndex(viewingPhotoIndex + 1)
                      }
                      data-testid="button-next-photo"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  )}
              </div>
            )}

            <div className="p-4 border-t flex-shrink-0 flex gap-2">
              <Button
                className="flex-1"
                onClick={async () => {
                  if (
                    viewingPhotoIndex === null ||
                    !allPhotos[viewingPhotoIndex]
                  ) {
                    return;
                  }
                  const url = allPhotos[viewingPhotoIndex];
                  const filename = `job-photo-${viewingPhotoIndex + 1}-${Date.now()}.jpg`;
                  try {
                    const response = await fetch(url, { credentials: "include" });
                    const rawBlob = await response.blob();
                    const blob =
                      rawBlob.type && rawBlob.type.startsWith("image/")
                        ? rawBlob
                        : new Blob([rawBlob], { type: "image/jpeg" });
                    const file = new File([blob], filename, { type: blob.type });
                    if (
                      typeof navigator.canShare === "function" &&
                      navigator.canShare({ files: [file] })
                    ) {
                      try {
                        await navigator.share({ files: [file] });
                        return;
                      } catch (shareErr: any) {
                        if (shareErr?.name === "AbortError") return;
                      }
                    }
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = blobUrl;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                  } catch {
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                data-testid="button-download-photo"
              >
                Download Photo
              </Button>

              {/* Photo Counter and Navigation Dots */}
              {allPhotos.length > 1 && (
                <div className="flex items-center gap-2 px-4">
                  {allPhotos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setViewingPhotoIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === viewingPhotoIndex
                          ? "bg-primary w-6"
                          : "bg-gray-300 hover:bg-gray-400"
                      }`}
                      data-testid={`button-photo-dot-${index}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Calendar Booking Dialog */}
        <Dialog
          open={calendarBookingOpen}
          onOpenChange={setCalendarBookingOpen}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-green-600" />
                Book to Calendar
              </DialogTitle>
              <DialogDescription>
                Create a calendar event for this appointment
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={calendarBookingTitle}
                  onChange={(e) => setCalendarBookingTitle(e.target.value)}
                  placeholder="Quote appointment"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={calendarBookingDate}
                    onChange={(e) => setCalendarBookingDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time</label>
                  <Input
                    type="time"
                    value={calendarBookingTime}
                    onChange={(e) => setCalendarBookingTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duration</label>
                <Select
                  value={calendarBookingDuration}
                  onValueChange={setCalendarBookingDuration}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCalendarBookingOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!calendarBookingDate || !calendarBookingTime) {
                    toast({
                      title: "Missing information",
                      description: "Please select a date and time",
                      variant: "destructive",
                    });
                    return;
                  }

                  try {
                    const startTime = new Date(
                      `${calendarBookingDate}T${calendarBookingTime}:00`,
                    );
                    const endTime = new Date(
                      startTime.getTime() +
                        parseInt(calendarBookingDuration) * 60000,
                    );

                    // Get customer name from job contact fields or customer record
                    const customerName =
                      jobData?.jobContactFirstName &&
                      jobData?.jobContactLastName
                        ? `${jobData.jobContactFirstName} ${jobData.jobContactLastName}`
                        : jobData?.jobContactFirstName ||
                          customerRecord?.name ||
                          "Customer";
                    const jobAddress =
                      jobData?.jobAddress || jobData?.address || "";
                    const custPhone =
                      jobData?.billingContactMobile ||
                      jobData?.jobContactPhone ||
                      jobData?.customerPhone ||
                      "";

                    const response = await apiRequest(
                      "POST",
                      "/api/calendar/quick-book",
                      {
                        jobId,
                        title: calendarBookingTitle,
                        description: `Customer: ${customerName}\nAddress: ${jobAddress}\nPhone: ${custPhone}\n\nJob ID: ${jobId}`,
                        location: jobAddress,
                        startTime: startTime.toISOString(),
                        endTime: endTime.toISOString(),
                        customerEmail: customerEmail || undefined,
                      },
                    );

                    const data = await response.json();

                    if (data.success) {
                      setCalendarBookingOpen(false);
                      queryClient.invalidateQueries({
                        queryKey: ["/api/jobs", jobId, "diary"],
                      });
                    } else {
                      throw new Error(
                        data.message || "Failed to create calendar event",
                      );
                    }
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description:
                        error.message || "Failed to book calendar event",
                      variant: "destructive",
                    });
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Add to Calendar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {welcomeStatus?.customerName && (
          <WelcomeVideoModal
            open={welcomeModalOpen}
            onOpenChange={setWelcomeModalOpen}
            jobId={jobId}
            customerName={welcomeStatus.customerName}
          />
        )}
      </div>
    </PullToRefresh>
  );
}
