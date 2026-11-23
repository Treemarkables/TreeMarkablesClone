import { useState } from "react";
import { DAILY_REVENUE_TARGET_GST_LABEL, parseDailyRevenueTarget } from "@shared/dailyRevenueTarget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDailyRevenueTarget } from "@/hooks/useDailyRevenueTarget";
import { formatNZD } from "@/components/calendar/calendarMath";

/**
 * Day-to-day editor for the Despatch daily revenue target.
 * Reads and writes the same per-business setting as Settings → Preferences.
 * Bundling UI should mount this (or `useDailyRevenueTarget`) rather than a constant.
 */
export function DailyRevenueTargetControl() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { target, isLoading, save, isSaving } = useDailyRevenueTarget();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const label = isLoading
    ? "Daily target"
    : target == null
      ? "Daily target not set"
      : `target ${formatNZD(target)} ${DAILY_REVENUE_TARGET_GST_LABEL}`;

  if (!editing) {
    if (!isAdmin) {
      return (
        <span
          className="text-xs text-muted-foreground whitespace-nowrap"
          data-testid="despatch-daily-revenue-target"
        >
          {label}
        </span>
      );
    }
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground"
        onClick={() => {
          setDraft(target == null ? "" : String(target));
          setEditing(true);
        }}
        data-testid="button-edit-daily-revenue-target"
      >
        {label}
      </Button>
    );
  }

  const commit = () => {
    const amount = parseDailyRevenueTarget(draft);
    if (amount == null) {
      toast({
        title: "Error",
        description: "Enter a daily revenue target greater than zero.",
        variant: "destructive",
      });
      return;
    }
    save(amount, { onSuccess: () => setEditing(false) });
  };

  return (
    <form
      className="flex items-center gap-1.5"
      data-testid="form-daily-revenue-target"
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <div className="relative w-24">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
        <Input
          type="number"
          min="1"
          step="100"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="h-7 pl-5 text-xs"
          aria-label={`Daily revenue target ${DAILY_REVENUE_TARGET_GST_LABEL}`}
          data-testid="input-despatch-daily-revenue-target"
          autoFocus
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {DAILY_REVENUE_TARGET_GST_LABEL}
      </span>
      <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setEditing(false)}
        disabled={isSaving}
      >
        Cancel
      </Button>
    </form>
  );
}
