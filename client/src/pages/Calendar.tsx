// Unified calendar — Month (job span bars), Week (staff grid) and Day (gantt)
// views over a single shared data layer, with staff/status filters. The Day
// view mirrors the /dispatch gantt; both render from the same extracted
// modules in components/calendar/.
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import { JobCardErrorBoundary } from "@/components/JobCardErrorBoundary";
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid3x3,
  Plus,
  Reply,
} from "lucide-react";
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatNZTime, jobRunsOnNZDate } from "@shared/dateUtils";
import { useCalendarData, type CalendarFilter } from "@/components/calendar/useCalendarData";
import { useCalendarDnD } from "@/components/calendar/useCalendarDnD";
import { ConflictWarningDialog, DragGhost } from "@/components/calendar/ConflictWarningDialog";
import { CalendarFilterBar, loadStoredFilter } from "@/components/calendar/CalendarFilterBar";
import { MonthView } from "@/components/calendar/MonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { DayView } from "@/components/calendar/DayView";
import { DayDetailPanel, type JobWithCustomerInfo } from "@/components/calendar/DayDetailPanel";
import type { CalendarJob } from "@/components/calendar/calendarMath";

type ViewMode = "month" | "week" | "day";

const VIEW_STORAGE_KEY = "calendar-view-mode";

function loadStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY);
    if (v === "month" || v === "week" || v === "day") return v;
  } catch {
    // storage unavailable — default below
  }
  return "month";
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewModeState] = useState<ViewMode>(loadStoredViewMode);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filter, setFilter] = useState<CalendarFilter>(loadStoredFilter);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsJob, setSmsJob] = useState<JobWithCustomerInfo | null>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [jobToEditId, setJobToEditId] = useState<string | null>(null);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const { toast } = useToast();

  const data = useCalendarData(filter);
  const { isLoading, employees, allJobs, customerMap, jobPassesFilter, businessName } = data;
  const dnd = useCalendarDnD(data);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      // storage unavailable — view just won't persist
    }
  };

  // Appointments on a date — multi-day aware (jobRunsOnNZDate honours the
  // scheduledDates carve-out set AND fixes the old UTC-midnight bucketing bug).
  const getAppointmentsForDate = (date: Date): JobWithCustomerInfo[] => {
    return allJobs
      .filter(
        (job) =>
          job.scheduledDate &&
          job.status !== "unsuccessful" &&
          job.status !== "archived" &&
          jobPassesFilter(job) &&
          jobRunsOnNZDate(job, date),
      )
      .map((job) => ({
        ...job,
        customer: job.customerId ? customerMap.get(job.customerId) : undefined,
      }));
  };

  const selectedDateAppointments = selectedDate
    ? getAppointmentsForDate(selectedDate)
    : [];

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goToPrevious = () => {
    if (viewMode === "day") setCurrentDate((prev) => subDays(prev, 1));
    else if (viewMode === "week") setCurrentDate((prev) => subWeeks(prev, 1));
    else setCurrentDate((prev) => subMonths(prev, 1));
  };
  const goToNext = () => {
    if (viewMode === "day") setCurrentDate((prev) => addDays(prev, 1));
    else if (viewMode === "week") setCurrentDate((prev) => addWeeks(prev, 1));
    else setCurrentDate((prev) => addMonths(prev, 1));
  };
  const goToToday = () => setCurrentDate(new Date());

  const dateRangeLabel = useMemo(() => {
    if (viewMode === "day") return format(currentDate, "EEE d MMMM yyyy");
    if (viewMode === "week") {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  }, [currentDate, viewMode]);

  // ── SMS ────────────────────────────────────────────────────────────────────
  const sendSmsMutation = useMutation({
    mutationFn: async (payload: {
      phone: string;
      message: string;
      jobId?: string;
      customerId?: string;
    }) => {
      // apiRequest is (method, url, data) — the old page passed (url, options)
      // which fetched a junk URL, so the calendar SMS button silently failed.
      return apiRequest("POST", "/api/sms/send", payload);
    },
    onSuccess: () => {
      setSmsDialogOpen(false);
      setSmsMessage("");
      setSmsJob(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send SMS",
        description: error.message || "There was an error sending the SMS.",
        variant: "destructive",
      });
    },
  });

  const handleSendSms = (job: JobWithCustomerInfo, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSmsJob(job);
    const customerName = job.customer?.name || "Customer";
    const jobTitle = job.title || "your appointment";
    const scheduledTime = job.scheduledDate
      ? formatNZTime(
          typeof job.scheduledDate === "string"
            ? job.scheduledDate
            : (job.scheduledDate as Date).toISOString(),
          "full",
        )
      : "soon";
    setSmsMessage(
      `Hi ${customerName}, this is a reminder about ${jobTitle} scheduled for ${scheduledTime}.${businessName ? ` - ${businessName}` : ""}`,
    );
    setSmsDialogOpen(true);
  };

  const handleSendSmsConfirm = () => {
    if (!smsJob || !smsJob.customer?.phone) {
      toast({
        title: "No Phone Number",
        description: "This customer doesn't have a phone number on file.",
        variant: "destructive",
      });
      return;
    }
    if (smsMessage.length > 160) {
      toast({
        title: "Message Too Long",
        description: "SMS messages must be 160 characters or less.",
        variant: "destructive",
      });
      return;
    }
    sendSmsMutation.mutate({
      phone: smsJob.customer.phone,
      message: smsMessage,
      jobId: smsJob.id,
      customerId: smsJob.customerId || undefined,
    });
  };

  // ── Job card handlers ──────────────────────────────────────────────────────
  const handleJobClick = (job: CalendarJob) => setJobToEditId(job.id);
  const handleEditJob = (job: JobWithCustomerInfo) => setJobToEditId(job.id);
  const closeJobDialogs = () => {
    setJobToEditId(null);
    setShowCreateJob(false);
    queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs?limit=10000&offset=0"] });
    queryClient.invalidateQueries({ queryKey: ["/api/staff-assignments"] });
  };

  return (
    <div className="flex flex-col h-full bg-background w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 border-b w-full">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
          <h1
            className="text-xl sm:text-2xl font-bold"
            data-testid="text-calendar-title"
          >
            Calendar
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="rounded-r-none"
              data-testid="button-view-month"
            >
              <Grid3x3 className="h-4 w-4 mr-1" />
              Month
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="rounded-none"
              data-testid="button-view-week"
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              Week
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("day")}
              className="rounded-l-none"
              data-testid="button-view-day"
            >
              <Clock className="h-4 w-4 mr-1" />
              Day
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            data-testid="button-today"
          >
            Today
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateJob(true)}
            data-testid="button-new-appointment"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
      </div>

      {/* Calendar Navigation + Filters */}
      <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b flex-wrap">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevious}
            aria-label="Previous period"
            data-testid="button-previous-month"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2
            className="text-base sm:text-xl font-semibold min-w-[140px] sm:min-w-[220px] text-center"
            data-testid="text-current-month"
          >
            {dateRangeLabel}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            aria-label="Next period"
            data-testid="button-next-month"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <CalendarFilterBar
          employees={employees}
          filter={filter}
          onFilterChange={setFilter}
        />      </div>

      {/* Legend: explains confirmed vs awaiting-confirmation styling */}
      <div className="flex items-center gap-4 px-3 sm:px-4 py-1.5 border-b text-[11px] text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded bg-blue-500 text-white">
            <Check className="h-2.5 w-2.5" />
          </span>
          <span>Customer confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded bg-blue-500 text-white">
            <Reply className="h-2.5 w-2.5" />
          </span>
          <span>Reply sent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded bg-blue-500 border border-dashed border-white/70 opacity-70" />
          <span>Awaiting confirmation</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Active view */}
        <div className="flex-1 flex flex-col overflow-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : viewMode === "month" ? (
            <MonthView
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onJobClick={handleJobClick}
              data={data}
            />
          ) : viewMode === "week" ? (
            <WeekView
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onJobClick={handleJobClick}
              data={data}
              dnd={dnd}
            />
          ) : (
            <DayView
              currentDate={currentDate}
              onJobClick={handleJobClick}
              data={data}
              dnd={dnd}
            />
          )}
        </div>

        {/* Selected-date details (month/week — day view IS the detail) */}
        {viewMode !== "day" && (
          <DayDetailPanel
            variant="sidebar"
            selectedDate={selectedDate}
            appointments={selectedDateAppointments}
            onEditJob={handleEditJob}
            onSendSms={handleSendSms}
            onAddAppointment={() => setShowCreateJob(true)}
          />
        )}
      </div>

      {/* Mobile bottom sheet — below the flex row so it spans full width */}
      {viewMode !== "day" && (
        <DayDetailPanel
          variant="sheet"
          selectedDate={selectedDate}
          appointments={selectedDateAppointments}
          onEditJob={handleEditJob}
          onSendSms={handleSendSms}
          onAddAppointment={() => setShowCreateJob(true)}
        />
      )}

      {/* Drag ghost + double-booking dialog */}
      <DragGhost dnd={dnd} />
      <ConflictWarningDialog
        pendingDrop={dnd.pendingDrop}
        data={data}
        onConfirm={dnd.confirmPendingDrop}
        onCancel={dnd.cancelPendingDrop}
      />

      {/* SMS Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent
          className="sm:max-w-[500px]"
          data-testid="dialog-send-sms"
        >
          <DialogHeader>
            <DialogTitle>Send SMS to Customer</DialogTitle>
            <DialogDescription>
              Send a text message to {smsJob?.customer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone Number</Label>
              <div
                className="text-sm text-muted-foreground"
                data-testid="text-customer-phone"
              >
                {smsJob?.customer?.phone || "No phone number"}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms-message">
                Message ({smsMessage.length}/160)
              </Label>
              <Textarea
                id="sms-message"
                placeholder="Enter your message..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                maxLength={160}
                rows={4}
                data-testid="textarea-sms-message"
              />
              <p className="text-xs text-muted-foreground">
                SMS messages are limited to 160 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSmsDialogOpen(false)}
              data-testid="button-cancel-sms"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendSmsConfirm}
              disabled={
                !smsMessage ||
                smsMessage.length === 0 ||
                sendSmsMutation.isPending
              }
              data-testid="button-confirm-send-sms"
            >
              {sendSmsMutation.isPending ? "Sending..." : "Send SMS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Edit Dialog */}
      {jobToEditId && (
        <JobCardErrorBoundary onClose={closeJobDialogs}>
          <GlobalJobCard
            isOpen={!!jobToEditId}
            onClose={closeJobDialogs}
            mode="edit"
            jobId={jobToEditId}
            onJobUpdated={closeJobDialogs}
          />
        </JobCardErrorBoundary>
      )}

      {/* New Job Dialog */}
      {showCreateJob && (
        <JobCardErrorBoundary onClose={closeJobDialogs}>
          <GlobalJobCard
            isOpen={showCreateJob}
            onClose={closeJobDialogs}
            mode="create"
            onJobCreated={closeJobDialogs}
          />
        </JobCardErrorBoundary>
      )}
    </div>
  );
}
