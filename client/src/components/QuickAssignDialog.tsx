import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, User } from "lucide-react";
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

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  isActive: boolean;
}

export interface QuickAssignResult {
  employeeIds: string[];
  durationHours: number;
  durationMinutes: number;
}

interface QuickAssignDialogProps {
  open: boolean;
  jobLabel: string;
  customerName?: string;
  address?: string;
  droppedHour: number;
  droppedEmployeeId: string;
  employees: Employee[];
  defaultDurationHours: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (result: QuickAssignResult) => void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function QuickAssignDialog({
  open,
  jobLabel,
  customerName,
  address,
  droppedHour,
  droppedEmployeeId,
  employees,
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

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set([droppedEmployeeId]));
    const h = Math.max(0, Math.floor(defaultDurationHours));
    const m = Math.round(Math.max(0, defaultDurationHours - h) * 60);
    setHours(h);
    setMinutes(m);
  }, [open, droppedEmployeeId, defaultDurationHours]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.isActive),
    [employees],
  );

  const totalMinutes = hours * 60 + minutes;
  const endTotalMinutes = Math.min(droppedHour * 60 + totalMinutes, 23 * 60 + 59);
  const endH = Math.floor(endTotalMinutes / 60);
  const endM = endTotalMinutes % 60;

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
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isSubmitting) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
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
                    return (
                      <label
                        key={e.id}
                        className="flex items-center gap-2 p-2 rounded-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(e.id)}
                        />
                        <span className="text-sm flex-1">
                          {e.firstName} {e.lastName}
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
