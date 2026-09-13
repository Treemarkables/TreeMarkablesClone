import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, User } from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatTime12Hour,
  nzTimeToUTC,
  utcToNZTime,
} from "@shared/dateUtils";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  isActive: boolean;
}

// Existing assignments used for the advisory busy-highlight (same
// non-blocking rule as GlobalJobCard's scheduling modal).
interface AdvisoryAssignment {
  jobId?: string | null;
  employeeId: string;
  startTime: string;
  endTime: string;
}

export interface QuickAssignResult {
  employeeIds: string[];
  durationHours: number;
  durationMinutes: number;
  sendClientNotification: boolean;
  sendProposalEmail: boolean;
  scheduleBookingReminders: boolean;
}

interface QuickAssignDialogProps {
  open: boolean;
  jobId: string;
  jobLabel: string;
  customerName?: string;
  address?: string;
  /** NZ calendar date (YYYY-MM-DD) of the drop target cell. */
  dateNZ: string;
  droppedHour: number;
  droppedEmployeeId: string;
  employees: Employee[];
  staffAssignments: AdvisoryAssignment[];
  defaultDurationHours: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (result: QuickAssignResult) => void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function QuickAssignDialog({
  open,
  jobId,
  jobLabel,
  customerName,
  address,
  dateNZ,
  droppedHour,
  droppedEmployeeId,
  employees,
  staffAssignments,
  defaultDurationHours,
  isSubmitting,
  onCancel,
  onConfirm,
}: QuickAssignDialogProps) {
  const initialHours = Math.max(0, Math.floor(defaultDurationHours));
  const initialMinutes = Math.round(
    Math.max(0, defaultDurationHours - initialHours) * 60,
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set([droppedEmployeeId]),
  );
  const [hours, setHours] = useState<number>(initialHours);
  const [minutes, setMinutes] = useState<number>(initialMinutes);
  const [sendClientNotification, setSendClientNotification] = useState(false);
  const [sendProposalEmail, setSendProposalEmail] = useState(false);
  const [scheduleBookingReminders, setScheduleBookingReminders] =
    useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set([droppedEmployeeId]));
    const h = Math.max(0, Math.floor(defaultDurationHours));
    const m = Math.round(Math.max(0, defaultDurationHours - h) * 60);
    setHours(h);
    setMinutes(m);
    setSendClientNotification(false);
    setSendProposalEmail(false);
    setScheduleBookingReminders(false);
  }, [open, droppedEmployeeId, defaultDurationHours]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.isActive),
    [employees],
  );

  const totalMinutes = hours * 60 + minutes;
  const endTotalMinutes = Math.min(droppedHour * 60 + totalMinutes, 23 * 60 + 59);
  const endH = Math.floor(endTotalMinutes / 60);
  const endM = endTotalMinutes % 60;

  // Advisory busy map: which employees already have an overlapping assignment
  // on another job during the dropped window. Doesn't block selection — just
  // highlights the row, mirroring the job-card scheduling modal.
  const busyEmployees = useMemo(() => {
    const map = new Map<string, { startTime: Date; endTime: Date }[]>();
    if (!dateNZ || totalMinutes <= 0 || staffAssignments.length === 0)
      return map;
    let windowStart: number;
    try {
      windowStart = nzTimeToUTC(dateNZ, `${pad2(droppedHour)}:00`).getTime();
    } catch {
      return map;
    }
    const windowEnd = windowStart + totalMinutes * 60_000;
    for (const a of staffAssignments) {
      if (a.jobId && a.jobId === jobId) continue;
      const aStart = new Date(a.startTime).getTime();
      const aEnd = new Date(a.endTime).getTime();
      if (Number.isNaN(aStart) || Number.isNaN(aEnd)) continue;
      if (!(aStart < windowEnd && aEnd > windowStart)) continue;
      const list = map.get(a.employeeId) ?? [];
      list.push({ startTime: new Date(aStart), endTime: new Date(aEnd) });
      map.set(a.employeeId, list);
    }
    return map;
  }, [dateNZ, droppedHour, totalMinutes, staffAssignments, jobId]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSave =
    selectedIds.size > 0 && totalMinutes > 0 && !isSubmitting;

  const handleSave = () => {
    if (!canSave) return;
    onConfirm({
      employeeIds: Array.from(selectedIds),
      durationHours: hours,
      durationMinutes: minutes,
      sendClientNotification,
      sendProposalEmail,
      scheduleBookingReminders,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isSubmitting) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Assign</DialogTitle>
          {jobLabel ? (
            <DialogDescription>{jobLabel}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {(customerName || address) && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 space-y-1">
              {customerName ? (
                <div className="flex items-start gap-2 text-sm">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{customerName}</span>
                </div>
              ) : null}
              {address ? (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{address}</span>
                </div>
              ) : null}
            </div>
          )}

          <div>
            <Label className="text-sm font-medium mb-2 block">Crew</Label>
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {activeEmployees.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">
                    No active employees available.
                  </p>
                ) : (
                  activeEmployees.map((e) => {
                    const checked = selectedIds.has(e.id);
                    const conflicts = busyEmployees.get(e.id);
                    const isBusy = !!conflicts && conflicts.length > 0;
                    const busyTooltip = isBusy
                      ? `Already booked: ${conflicts
                          .map((c) => {
                            const s = utcToNZTime(c.startTime).time;
                            const en = utcToNZTime(c.endTime).time;
                            return `${formatTime12Hour(s)}–${formatTime12Hour(en)}`;
                          })
                          .join(", ")}`
                      : undefined;
                    return (
                      <label
                        key={e.id}
                        className={`flex items-center gap-2 p-2 rounded-sm cursor-pointer ${
                          isBusy
                            ? "bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800"
                            : ""
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(e.id)}
                        />
                        <span className="text-sm flex-1">
                          {e.firstName} {e.lastName}
                          {isBusy && (
                            <span
                              className="ml-2 inline-flex items-center rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-300"
                              title={busyTooltip}
                              data-testid={`badge-qa-staff-busy-${e.id}`}
                            >
                              Busy
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {e.position}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Duration</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  min={0}
                  max={12}
                  value={hours}
                  onChange={(ev) => {
                    const v = parseInt(ev.target.value, 10);
                    setHours(Number.isFinite(v) ? Math.max(0, v) : 0);
                  }}
                  aria-label="Hours"
                />
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Hours
                </p>
              </div>
              <div className="flex-1">
                <Input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={minutes}
                  onChange={(ev) => {
                    const v = parseInt(ev.target.value, 10);
                    setMinutes(
                      Number.isFinite(v) ? Math.min(59, Math.max(0, v)) : 0,
                    );
                  }}
                  aria-label="Minutes"
                />
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Minutes
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Starts {pad2(droppedHour)}:00 → ends {pad2(endH)}:{pad2(endM)}
            </p>
          </div>

          {/* Automation options — same set as the job-card Schedule modal. */}
          <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
            <Checkbox
              id="qa-client-notification"
              checked={sendClientNotification}
              onCheckedChange={(checked) =>
                setSendClientNotification(checked === true)
              }
              data-testid="checkbox-qa-send-client-notification"
            />
            <label
              htmlFor="qa-client-notification"
              className="text-sm font-medium leading-none cursor-pointer select-none"
            >
              Send booking confirmation email to client with date and time
            </label>
          </div>

          {/* Proposal Email Option — asks the customer to confirm the proposed date/time.
              Uses the "Proposed Booking" template from Settings → Communication Templates
              when present; falls back to a built-in message otherwise. */}
          <div className="flex items-start space-x-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
            <Checkbox
              id="qa-proposal-email"
              checked={sendProposalEmail}
              onCheckedChange={(checked) =>
                setSendProposalEmail(checked === true)
              }
              data-testid="checkbox-qa-send-proposal-email"
              className="mt-0.5"
            />
            <div className="flex-1">
              <label
                htmlFor="qa-proposal-email"
                className="text-sm font-medium leading-none cursor-pointer select-none"
              >
                Send proposal email asking client to confirm this date and time
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Uses the "Proposed Booking" template from{" "}
                <Link
                  href="/settings/templates"
                  className="underline hover:text-foreground"
                >
                  Communication Templates
                </Link>
                . Variables: {"{firstName}"}, {"{scheduledDate}"},{" "}
                {"{scheduledTime}"}, {"{jobAddress}"}, {"{jobNumber}"}.
              </p>
            </div>
          </div>

          {/* Booking reminders toggle — opts the job into the configured
              reminder schedule (e.g. 24h before). Cadence and channel are
              set in Settings → Booking Reminders. */}
          <div className="flex items-start space-x-2 p-3 bg-emerald-50 dark:bg-emerald-950 rounded-md border border-emerald-200 dark:border-emerald-800">
            <Checkbox
              id="qa-schedule-booking-reminders"
              checked={scheduleBookingReminders}
              onCheckedChange={(checked) =>
                setScheduleBookingReminders(checked === true)
              }
              data-testid="checkbox-qa-schedule-booking-reminders"
              className="mt-0.5"
            />
            <div className="flex-1">
              <label
                htmlFor="qa-schedule-booking-reminders"
                className="text-sm font-medium leading-none cursor-pointer select-none"
              >
                Schedule automatic booking reminders for this job
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Sends email/SMS reminders at the offsets configured in{" "}
                <Link
                  href="/settings/booking-reminders"
                  className="underline hover:text-foreground"
                >
                  Booking Reminder Settings
                </Link>
                . Reschedules automatically if the job date changes.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={handleSave}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
