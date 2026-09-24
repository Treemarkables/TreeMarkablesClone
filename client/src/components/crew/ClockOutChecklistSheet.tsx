/**
 * "Before you go" prompt shown AFTER a timer has stopped.
 *
 * The clock is already stopped and the time entry already written by the time this
 * renders — this never gates the stop. Gating it would only change when people press
 * stop (early at the truck, late at the yard), and that drift quietly poisons
 * back-costing. Tick what's done, or dismiss; either way the timer stays stopped.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
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
import type { RoleKey } from "@/lib/crewRoles";
import { joinRoleLabels, sortRoles } from "@shared/crewDayRoles";

export interface OutstandingItem {
  itemId: string;
  label: string;
  roleKey: RoleKey;
}

export function ClockOutChecklistSheet({
  jobId,
  items,
  onDismiss,
}: {
  jobId: string;
  /** Empty or null closes the sheet — nothing outstanding is nothing to say. */
  items: OutstandingItem[] | null;
  onDismiss: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const tick = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/checklist/${itemId}`, {
        completed: true,
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }
      return json;
    },
    onSuccess: (_data, itemId) => {
      setTicked((prev) => new Set(prev).add(itemId));
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "checklist"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't tick that off",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const open = !!items && items.length > 0;
  const roleLabel = joinRoleLabels(sortRoles((items ?? []).map((item) => item.roleKey)));

  const dismiss = () => {
    setTicked(new Set());
    onDismiss();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Before you go</DialogTitle>
          <DialogDescription>
            {items?.length ?? 0} of your{roleLabel ? ` ${roleLabel}` : ""} tasks
            aren't ticked. Your time is already logged — this is just a reminder.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {(items ?? []).map((item) => {
            const isTicking = tick.isPending && tick.variables === item.itemId;
            const done = ticked.has(item.itemId);
            return (
              <li
                key={item.itemId}
                className="flex items-center justify-between gap-3 px-3 py-2.5 bg-card border border-border rounded-md"
                data-testid={`clockout-item-${item.itemId}`}
              >
                <span className="text-sm font-medium text-foreground truncate">
                  {item.label}
                </span>
                <Button
                  size="sm"
                  variant={done ? "ghost" : "default"}
                  className="h-7 px-3 text-xs shrink-0"
                  disabled={tick.isPending || done}
                  onClick={() => tick.mutate(item.itemId)}
                  data-testid={`clockout-tick-${item.itemId}`}
                >
                  {isTicking ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    "Tick"
                  )}
                </Button>
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button variant="ghost" onClick={dismiss} data-testid="clockout-dismiss">
            Not done — dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
