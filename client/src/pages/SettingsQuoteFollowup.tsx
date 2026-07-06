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

  useEffect(() => {
    if (!settings) return;
    setEnabled(!!settings.autoQuoteFollowupEnabled);
    setDays(settings.autoFollowUpDays ?? 3);
    setChannel((settings.quoteFollowupChannel ?? "sms") as "sms" | "email");
    setMaxAttempts(settings.quoteFollowupMaxAttempts ?? 2);
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
    saveMutation.mutate({
      autoQuoteFollowupEnabled: enabled,
      autoFollowUpDays: days,
      quoteFollowupChannel: channel,
      quoteFollowupMaxAttempts: maxAttempts,
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
          <h1 className="text-2xl font-bold text-gray-900">Quote Follow-up Automation</h1>
          <p className="text-sm text-gray-600">
            Auto-draft a follow-up message when a customer hasn't responded to a quote.
          </p>
        </div>
      </div>

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

          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-followup-settings"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
