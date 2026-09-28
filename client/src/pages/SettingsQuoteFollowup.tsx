import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BusinessSettings {
  id: string;
  autoQuoteFollowupEnabled?: boolean | null;
  autoFollowUpDays?: number | null;
  quoteFollowupChannel?: "sms" | "email" | null;
  quoteFollowupMaxAttempts?: number | null;
  quoteFollowupWorkflowEnabled?: boolean | null;
  quoteFollowupNudgeDays?: number[] | null;
}

interface SettingsResponse {
  success: boolean;
  data: BusinessSettings;
}

export default function SettingsQuoteFollowup() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["/api/business-settings"],
  });

  const settings = data?.data;

  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState(3);
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [workflowEnabled, setWorkflowEnabled] = useState(true);
  const [nudgeDays, setNudgeDays] = useState("3, 7, 14");

  useEffect(() => {
    if (!settings) return;
    setEnabled(!!settings.autoQuoteFollowupEnabled);
    setDays(settings.autoFollowUpDays ?? 3);
    setChannel((settings.quoteFollowupChannel ?? "sms") as "sms" | "email");
    setMaxAttempts(settings.quoteFollowupMaxAttempts ?? 2);
    setWorkflowEnabled(settings.quoteFollowupWorkflowEnabled !== false);
    const stored = settings.quoteFollowupNudgeDays;
    setNudgeDays(Array.isArray(stored) && stored.length > 0 ? stored.join(", ") : "3, 7, 14");
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<BusinessSettings>) => {
      const res = await apiRequest("PUT", "/api/business-settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't save settings",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const parsedDays = nudgeDays
      .split(/[^0-9]+/)
      .map((part) => parseInt(part, 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 90);
    const uniqueDays = Array.from(new Set(parsedDays)).sort((a, b) => a - b).slice(0, 5);
    if (workflowEnabled && uniqueDays.length === 0) {
      toast({
        title: "Couldn't save settings",
        description: "Enter at least one nudge day between 1 and 90.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate({
      autoQuoteFollowupEnabled: enabled,
      autoFollowUpDays: days,
      quoteFollowupChannel: channel,
      quoteFollowupMaxAttempts: maxAttempts,
      quoteFollowupWorkflowEnabled: workflowEnabled,
      quoteFollowupNudgeDays: uniqueDays.length > 0 ? uniqueDays : [3, 7, 14],
    });
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Back to settings" data-testid="button-back-to-settings">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quote follow-ups</h1>
          <p className="text-sm text-gray-600">
            Draft a check-in when a sent quote goes quiet, and a fresh quote when it passes its valid date. Nothing is sent until you approve it.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Follow-up queue</CardTitle>
          <CardDescription>
            Waiting drafts show on Today, Despatch, and Quote follow-ups. You can edit the message, snooze it, or mark the quote lost.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Draft follow-ups automatically</Label>
              <p className="text-sm text-muted-foreground">
                On by default. Turning this off stops new drafts. It never sends on its own.
              </p>
            </div>
            <Switch
              checked={workflowEnabled}
              onCheckedChange={setWorkflowEnabled}
              data-testid="switch-quote-followup-workflow"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nudge-days">Nudge after these days</Label>
            <Input
              id="nudge-days"
              value={nudgeDays}
              onChange={(e) => setNudgeDays(e.target.value)}
              disabled={!workflowEnabled}
              className="max-w-[240px]"
              data-testid="input-nudge-days"
            />
            <p className="text-xs text-muted-foreground">
              Default is 3, 7 and 14. A quote only gets one draft per step, and a customer reply, accept, or decline stops the rest.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="queue-channel">Preferred channel</Label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as "sms" | "email")}
              disabled={!workflowEnabled}
            >
              <SelectTrigger id="queue-channel" className="max-w-[200px]" data-testid="select-queue-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Uses the job contact, then the customer. Falls back if that detail isn't on file.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Drafting
          </CardTitle>
          <CardDescription>
            Drafts appear in Communications Management for your approval. Nothing is sent
            without your sign-off — you can edit, send, or skip each one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable automatic follow-up drafts</Label>
              <p className="text-sm text-muted-foreground">
                When off, only internal staff reminders are created.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              data-testid="switch-auto-quote-followup-enabled"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="followup-days">Days after quote sent before drafting</Label>
            <Input
              id="followup-days"
              type="number"
              min={1}
              max={30}
              value={days}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n)) setDays(Math.max(1, Math.min(30, n)));
              }}
              disabled={!enabled}
              className="max-w-[120px]"
              data-testid="input-followup-days"
            />
            <p className="text-xs text-muted-foreground">
              Range 1–30. The hourly checker queues a draft once the quote has been sitting
              this long with no customer response.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="followup-channel">Send via</Label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as "sms" | "email")}
              disabled={!enabled}
            >
              <SelectTrigger id="followup-channel" className="max-w-[200px]" data-testid="select-followup-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Falls back to the other channel if the customer has no record on file for the
              chosen one.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="followup-max">Max follow-ups per quote</Label>
            <Input
              id="followup-max"
              type="number"
              min={1}
              max={5}
              value={maxAttempts}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n)) setMaxAttempts(Math.max(1, Math.min(5, n)));
              }}
              disabled={!enabled}
              className="max-w-[120px]"
              data-testid="input-followup-max-attempts"
            />
            <p className="text-xs text-muted-foreground">
              Range 1–5. Once a quote has been followed up this many times, no more drafts
              will be queued for it.
            </p>
          </div>

        </CardContent>
      </Card>

      <div>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save-followup-settings"
        >
          {saveMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
