// Warn-and-allow double-booking dialog. Shown when a drop overlaps an existing
// assignment (client pre-check or server 409); "Schedule anyway" re-submits
// with overrideConflicts.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatNZTime } from "@shared/dateUtils";
import type { ScheduleConflict } from "@shared/scheduleConflicts";
import type { CalendarData } from "./useCalendarData";
import type { PendingDrop } from "./useCalendarDnD";

interface ConflictWarningDialogProps {
  pendingDrop: PendingDrop | null;
  data: CalendarData;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConflictWarningDialog({
  pendingDrop,
  data,
  onConfirm,
  onCancel,
}: ConflictWarningDialogProps) {
  const { employees, jobMap, getCustomerName } = data;

  const employeeName = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : "This crew member";
  };

  const describe = (c: ScheduleConflict) => {
    const window = `${formatNZTime(c.startTime, "time")}–${formatNZTime(c.endTime, "time")}`;
    if (c.kind === "busy") {
      return `Busy in Google Calendar${c.summary ? `: "${c.summary}"` : ""} ${window}`;
    }
    const job = c.jobId ? jobMap.get(c.jobId) : undefined;
    const jobLabel = job
      ? `#${job.jobNumber} ${getCustomerName(job)}`
      : "another job";
    return `${window} — ${jobLabel}`;
  };

  return (
    <AlertDialog open={!!pendingDrop} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent data-testid="dialog-schedule-conflict">
        <AlertDialogHeader>
          <AlertDialogTitle>Double booking</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="mb-2">
                {pendingDrop ? employeeName(pendingDrop.toEmployeeId) : ""} is already
                booked during this time:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                {pendingDrop?.conflicts.map((c, i) => (
                  <li key={i} data-testid={`conflict-item-${i}`}>
                    {describe(c)}
                  </li>
                ))}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} data-testid="button-conflict-cancel">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} data-testid="button-conflict-override">
            Schedule anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Floating label that follows the pointer while a block is being dragged. */
export function DragGhost({ dnd }: { dnd: { dragState: { item: { label: string }; x: number; y: number } | null } }) {
  if (!dnd.dragState) return null;
  const { item, x, y } = dnd.dragState;
  return (
    <div
      className="fixed z-50 pointer-events-none bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded shadow-lg whitespace-nowrap"
      style={{ left: x + 12, top: y - 28 }}
      data-testid="drag-ghost"
    >
      {item.label}
    </div>
  );
}
