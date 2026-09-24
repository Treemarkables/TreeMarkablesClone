/**
 * "Add crew" for the job card's Today's roles section.
 *
 * Adds people to TODAY's crew on this job and optionally gives them their role in
 * the same pass, so allocating a role never means a trip to Settings or the
 * dispatch board. Roles are a per-person-per-day fact, so a role set here shows up
 * on every job that person touches today.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getNZDateString } from "@shared/dateUtils";
import type { RoleKey } from "@/lib/crewRoles";
import { RoleChips } from "./RoleChips";
import { StaffPickerList, type StaffPickerEmployee } from "./StaffPickerList";

export function CrewPickerDialog({
  jobId,
  open,
  onOpenChange,
  /** Already on today's crew — shown locked so they can't be added twice. */
  existingCrewIds,
  /** Pre-select this role for everyone picked (the per-role "Assign" entry point). */
  defaultRole = null,
}: {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCrewIds: Set<string>;
  defaultRole?: RoleKey | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<Record<string, RoleKey[]>>({});

  const { data: employeesResp } = useQuery<{ data: StaffPickerEmployee[] }>({
    queryKey: ["/api/employees"],
    staleTime: 60_000,
  });

  const employees = useMemo(
    () =>
      (employeesResp?.data ?? [])
        .filter((e) => e.isActive !== false)
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
        ),
    [employeesResp],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setRoles((r) => (r[id] === undefined ? { ...r, [id]: defaultRole ? [defaultRole] : [] } : r));
      }
      return next;
    });
  };

  const reset = () => {
    setSelectedIds(new Set());
    setRoles({});
  };

  const addCrew = useMutation({
    mutationFn: async () => {
      const employeeIds = Array.from(selectedIds);
      await apiRequest("POST", `/api/jobs/${jobId}/crew-today`, { employeeIds });
      const date = getNZDateString(new Date());
      // Roles are independent of the assignment write, so a failure here shouldn't
      // silently drop the person from the crew — they're added either way.
      for (const employeeId of employeeIds) {
        const dayRoles = roles[employeeId] ?? [];
        if (dayRoles.length === 0) continue;
        // Add, don't replace: they may already hold a role from earlier today,
        // and these chips don't show that set.
        await apiRequest("PUT", "/api/staff-assignments/day-role", {
          employeeId,
          date,
          addRoles: dayRoles,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "crew-today"] });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey)
          && q.queryKey[0] === "/api/jobs"
          && q.queryKey[2] === "staff-assignments",
      });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't add crew",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add crew
          </DialogTitle>
          <DialogDescription>
            Pick who's on this job today. One person can hold more than one role.
            Roles carry across every job that person works today.
          </DialogDescription>
        </DialogHeader>

        <StaffPickerList
          employees={employees}
          selectedIds={selectedIds}
          onToggle={toggleSelected}
          lockedIds={existingCrewIds}
          testIdPrefix="crew-picker-staff"
          renderTrailing={(emp) =>
            existingCrewIds.has(emp.id) ? (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                On this job
              </span>
            ) : null
          }
          renderBelow={(emp, selected) =>
            selected && !existingCrewIds.has(emp.id) ? (
              <RoleChips
                size="sm"
                value={roles[emp.id] ?? []}
                onChange={(next) => setRoles((r) => ({ ...r, [emp.id]: next }))}
                disabled={addCrew.isPending}
                testIdPrefix={`crew-picker-role-${emp.id}`}
              />
            ) : null
          }
        />

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={addCrew.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => addCrew.mutate()}
            disabled={selectedIds.size === 0 || addCrew.isPending}
            data-testid="crew-picker-confirm"
          >
            {addCrew.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Add ${selectedIds.size || ""}`.trim()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
