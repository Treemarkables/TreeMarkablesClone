// Pointer-events drag-and-drop for the unified calendar — one code path for
// mouse AND touch (HTML5 drag events never fire on touch devices):
//   - mouse/pen: drag arms after 4px of movement, so plain clicks still work
//   - touch: drag arms after a 350ms long-press; scrolling before that
//     cancels the drag (pointercancel), so the calendar stays scrollable
// Drop targets are declared with data attributes:
//   data-drop-employee  — employee id (required)
//   data-drop-date      — NZ calendar date "yyyy-MM-dd" (required)
//   data-gantt-start / data-gantt-end — timeline hour bounds; when present the
//     drop hour is computed from the pointer's x-offset within the target,
//     otherwise the drop defaults to 8 AM (week-cell behaviour).
// Before persisting, the drop is checked against the loaded assignments via
// shared/scheduleConflicts; conflicts surface a confirm dialog (warn-and-allow)
// and the server re-checks with checkConflicts:true (409 unless overridden).
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { nzTimeToUTC, getJobScheduledNZDates } from "@shared/dateUtils";
import {
  findAssignmentConflicts,
  type ScheduleConflict,
} from "@shared/scheduleConflicts";
import type { CalendarData } from "./useCalendarData";

export interface DragItem {
  jobId: string;
  sourceEmployeeId: string; // "" when dragged from the unassigned lane
  assignmentId: string | null;
  durationHours: number;
  label: string; // shown in the floating ghost
}

export interface DropHover {
  employeeId: string;
  dateStr: string; // NZ yyyy-MM-dd
  hour: number;
}

export interface PendingDrop {
  item: DragItem;
  toEmployeeId: string;
  dateStr: string;
  hour: number;
  conflicts: ScheduleConflict[];
}

const TOUCH_LONG_PRESS_MS = 350;
const MOUSE_ARM_DISTANCE_PX = 4;
const TOUCH_CANCEL_DISTANCE_PX = 10;

export function useCalendarDnD(data: CalendarData) {
  const { allAssignments, jobMap } = data;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dragState, setDragState] = useState<{ item: DragItem; x: number; y: number } | null>(null);
  const [dropHover, setDropHover] = useState<DropHover | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);

  // Mutable drag session — survives re-renders without re-binding listeners
  const session = useRef<{
    item: DragItem;
    startX: number;
    startY: number;
    armed: boolean;
    pointerType: string;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    blockTouchMove: ((e: TouchEvent) => void) | null;
    cleanup: () => void;
  } | null>(null);
  // True briefly after a drag completes so block onClick handlers can bail
  const dragJustEndedRef = useRef(false);

  const computeWindow = (item: DragItem, dateStr: string, hour: number) => {
    const endHour = Math.min(hour + item.durationHours, 23);
    const startUtc = nzTimeToUTC(dateStr, `${String(hour).padStart(2, "0")}:00`);
    const endUtc = nzTimeToUTC(dateStr, `${String(endHour).padStart(2, "0")}:00`);
    return { startUtc, endUtc };
  };

  // ── Persistence (ported reschedule sequence + conflict contract) ──────────
  const executeDrop = useCallback(
    async (item: DragItem, toEmployeeId: string, dateStr: string, hour: number, override: boolean) => {
      const job = jobMap.get(item.jobId);
      if (!job) return;
      const { startUtc, endUtc } = computeWindow(item, dateStr, hour);

      try {
        let res: Response;
        if (item.assignmentId) {
          res = await fetch(`/api/staff-assignments/${item.assignmentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              startTime: startUtc.toISOString(),
              endTime: endUtc.toISOString(),
              employeeId: toEmployeeId,
              checkConflicts: true,
              overrideConflicts: override,
            }),
          });
        } else {
          res = await fetch(`/api/jobs/${item.jobId}/staff-assignments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              staffAssignments: [
                {
                  employeeId: toEmployeeId,
                  startTime: startUtc.toISOString(),
                  endTime: endUtc.toISOString(),
                  notes: "",
                },
              ],
              sendNotifications: false,
              sendClientNotification: false,
              addOnly: true,
              checkConflicts: true,
              overrideConflicts: override,
            }),
          });
        }

        if (res.status === 409) {
          // Server saw a conflict the client missed (stale cache) — same dialog.
          const body = (await res.json()) as { conflicts?: ScheduleConflict[] };
          setPendingDrop({
            item,
            toEmployeeId,
            dateStr,
            hour,
            conflicts: (body.conflicts ?? []).map((c) => ({ ...c, kind: "assignment" as const })),
          });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // Moving one day of a multi-day job must NOT rewrite the job's start
        // date — only single-day jobs follow their assignment.
        if (getJobScheduledNZDates(job).length <= 1) {
          await fetch(`/api/jobs/${item.jobId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduledDate: startUtc.toISOString() }),
          });
        }

        queryClient.invalidateQueries({ queryKey: ["/api/staff-assignments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs?limit=10000&offset=0"] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      } catch {
        toast({
          title: "Reschedule failed",
          description: "Could not update the job time.",
          variant: "destructive",
        });
      }
    },
    [jobMap, queryClient, toast],
  );

  const attemptDrop = useCallback(
    (item: DragItem, hover: DropHover) => {
      const { startUtc, endUtc } = computeWindow(item, hover.dateStr, hover.hour);
      const conflicts = findAssignmentConflicts({
        employeeId: hover.employeeId,
        startUtc,
        endUtc,
        assignments: allAssignments,
        excludeJobId: item.jobId,
      });
      if (conflicts.length > 0) {
        setPendingDrop({
          item,
          toEmployeeId: hover.employeeId,
          dateStr: hover.dateStr,
          hour: hover.hour,
          conflicts,
        });
      } else {
        void executeDrop(item, hover.employeeId, hover.dateStr, hover.hour, false);
      }
    },
    [allAssignments, executeDrop],
  );

  const confirmPendingDrop = useCallback(() => {
    if (!pendingDrop) return;
    const { item, toEmployeeId, dateStr, hour } = pendingDrop;
    setPendingDrop(null);
    void executeDrop(item, toEmployeeId, dateStr, hour, true);
  }, [pendingDrop, executeDrop]);

  const cancelPendingDrop = useCallback(() => setPendingDrop(null), []);

  // ── Hit testing ────────────────────────────────────────────────────────────
  const hoverFromPoint = (item: DragItem, x: number, y: number): DropHover | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-employee]");
    if (!el) return null;
    const employeeId = el.dataset.dropEmployee;
    const dateStr = el.dataset.dropDate;
    if (!employeeId || !dateStr) return null;

    const ganttStart = el.dataset.ganttStart ? Number(el.dataset.ganttStart) : null;
    const ganttEnd = el.dataset.ganttEnd ? Number(el.dataset.ganttEnd) : null;
    let hour = 8;
    if (ganttStart !== null && ganttEnd !== null && ganttEnd > ganttStart) {
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      const mins = ganttStart * 60 + pct * (ganttEnd - ganttStart) * 60;
      hour = Math.max(ganttStart, Math.min(ganttEnd - 1, Math.floor(mins / 60)));
    }
    return { employeeId, dateStr, hour };
  };

  // ── Pointer lifecycle ──────────────────────────────────────────────────────
  const startPointerDrag = useCallback(
    (e: React.PointerEvent, item: DragItem) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (session.current) return; // one drag at a time

      const startX = e.clientX;
      const startY = e.clientY;
      const pointerType = e.pointerType;

      const onMove = (ev: PointerEvent) => {
        const s = session.current;
        if (!s) return;
        const dx = ev.clientX - s.startX;
        const dy = ev.clientY - s.startY;
        const dist = Math.hypot(dx, dy);

        if (!s.armed) {
          if (s.pointerType === "touch") {
            // Finger wandered before the long-press fired — this is a scroll.
            if (dist > TOUCH_CANCEL_DISTANCE_PX) s.cleanup();
          } else if (dist > MOUSE_ARM_DISTANCE_PX) {
            s.armed = true;
            setDragState({ item: s.item, x: ev.clientX, y: ev.clientY });
          }
          return;
        }

        ev.preventDefault();
        setDragState({ item: s.item, x: ev.clientX, y: ev.clientY });
        setDropHover(hoverFromPoint(s.item, ev.clientX, ev.clientY));
      };

      const onUp = (ev: PointerEvent) => {
        const s = session.current;
        if (!s) return;
        const wasArmed = s.armed;
        s.cleanup();
        if (wasArmed) {
          dragJustEndedRef.current = true;
          setTimeout(() => {
            dragJustEndedRef.current = false;
          }, 300);
          const hover = hoverFromPoint(s.item, ev.clientX, ev.clientY);
          if (hover) attemptDrop(s.item, hover);
        }
      };

      const onCancel = () => session.current?.cleanup();

      // Non-passive native listener: once the drag is armed on touch, kill the
      // browser's scroll gesture (React's synthetic touchmove can't preventDefault).
      const blockTouchMove =
        pointerType === "touch"
          ? (ev: TouchEvent) => {
              if (session.current?.armed) ev.preventDefault();
            }
          : null;
      if (blockTouchMove) {
        document.addEventListener("touchmove", blockTouchMove, { passive: false });
      }

      const cleanup = () => {
        const s = session.current;
        if (s?.longPressTimer) clearTimeout(s.longPressTimer);
        if (s?.blockTouchMove) document.removeEventListener("touchmove", s.blockTouchMove);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        session.current = null;
        setDragState(null);
        setDropHover(null);
      };

      session.current = {
        item,
        startX,
        startY,
        armed: false,
        pointerType,
        longPressTimer:
          pointerType === "touch"
            ? setTimeout(() => {
                const s = session.current;
                if (s && !s.armed) {
                  s.armed = true;
                  setDragState({ item: s.item, x: s.startX, y: s.startY });
                }
              }, TOUCH_LONG_PRESS_MS)
            : null,
        blockTouchMove,
        cleanup,
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    [attemptDrop],
  );

  /** Call at the top of a block's onClick — returns true if the click is the
   *  tail end of a drag and should be ignored. */
  const consumeDragClick = useCallback(() => dragJustEndedRef.current, []);

  return {
    startPointerDrag,
    consumeDragClick,
    dragState,
    dropHover,
    pendingDrop,
    confirmPendingDrop,
    cancelPendingDrop,
  };
}

export type CalendarDnD = ReturnType<typeof useCalendarDnD>;
