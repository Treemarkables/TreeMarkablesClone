import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BellRing, Plus, X } from "lucide-react";

const PRESETS = [30, 14, 7, 3, 1];
const MAX_OFFSETS = 6;

interface BusinessSettings {
  complianceRemindersEnabled?: boolean;
  complianceReminderOffsets?: number[];
}

// Settings panel for vehicle compliance expiry reminders (rego / CoF / service).
// Lives on the Vehicle Inspection settings page. A daily backend scan reads these
// values and notifies admins when a vehicle's expiry crosses one of the lead times.
export default function ExpiryReminderSettings() {
  const { toast } = useToast();
  const { data } = useQuery<{ success: boolean; data: BusinessSettings }>({
    queryKey: ["/api/business-settings"],
  });
  const settings = data?.data;

  const [enabled, setEnabled] = useState(true);
  const [offsets, setOffsets] = useState<number[]>([30, 7]);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.complianceRemindersEnabled !== false);
    if (Array.isArray(settings.complianceReminderOffsets) && settings.complianceReminderOffsets.length) {
      setOffsets([...settings.complianceReminderOffsets].sort((a, b) => b - a));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload: { complianceRemindersEnabled: boolean; complianceReminderOffsets: number[] }) =>
      apiRequest("PUT", "/api/business-settings", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] }),
    onError: () =>
      toast({
        variant: "destructive",
        title: "Couldn't save reminder settings",
        description: "Please try again.",
      }),
  });

  const addOffset = (n: number) => {
    if (!Number.isInteger(n) || n < 1 || n > 365 || offsets.includes(n) || offsets.length >= MAX_OFFSETS) return;
    setOffsets([...offsets, n].sort((a, b) => b - a));
  };
  const removeOffset = (n: number) => setOffsets(offsets.filter((o) => o !== n));

  const addCustom = () => {
    const n = parseInt(custom, 10);
    addOffset(n);
    setCustom("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="w-4 h-4" />
          Expiry reminders
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Get notified before a vehicle's registration, Certificate of Fitness or scheduled service is due.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Send expiry reminders</Label>
            <p className="text-xs text-muted-foreground">
              A daily check notifies admins (in-app and push) as each due date approaches.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="switch-compliance-reminders" />
        </div>

        <div className={enabled ? "" : "opacity-50 pointer-events-none"}>
          <Label className="text-sm font-medium">Remind me this far ahead</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Add one or more lead times — e.g. a month and a week before expiry. You're always alerted once it's overdue.
          </p>

          <div className="flex flex-wrap gap-2 mb-3" data-testid="list-reminder-offsets">
            {offsets.length === 0 && (
              <span className="text-sm text-muted-foreground">No lead times set — you'll only be alerted once overdue.</span>
            )}
            {offsets.map((n) => (
              <Badge key={n} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1.5 text-sm">
                {n} {n === 1 ? "day" : "days"} before
                <button
                  type="button"
                  onClick={() => removeOffset(n)}
                  className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                  aria-label={`Remove ${n} day reminder`}
                  data-testid={`button-remove-offset-${n}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.filter((p) => !offsets.includes(p)).map((p) => (
              <Button
                key={p}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addOffset(p)}
                disabled={offsets.length >= MAX_OFFSETS}
                data-testid={`button-add-offset-${p}`}
              >
                <Plus className="w-3 h-3 mr-1" />
                {p}d
              </Button>
            ))}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={365}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Custom"
                className="w-24"
                disabled={offsets.length >= MAX_OFFSETS}
                data-testid="input-custom-offset"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate({ complianceRemindersEnabled: enabled, complianceReminderOffsets: offsets })}
            disabled={saveMutation.isPending}
            data-testid="button-save-reminder-settings"
          >
            {saveMutation.isPending ? "Saving…" : "Save reminders"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
