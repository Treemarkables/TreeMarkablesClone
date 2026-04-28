import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, Plus, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Channel = "email" | "sms" | "both";

interface Offset {
  hoursBefore: number;
  label?: string;
  channel?: Channel;
}

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
}

interface SmsTemplate {
  id: string;
  name: string;
  category: string;
}

const PRESETS: Array<{ label: string; hoursBefore: number }> = [
  { label: "1 hour before", hoursBefore: 1 },
  { label: "2 hours before", hoursBefore: 2 },
  { label: "Night before (12 hours)", hoursBefore: 12 },
  { label: "24 hours before", hoursBefore: 24 },
  { label: "2 days before", hoursBefore: 48 },
  { label: "3 days before", hoursBefore: 72 },
  { label: "1 week before", hoursBefore: 168 },
];

export default function BookingReminderSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(false);
  const [defaultOn, setDefaultOn] = useState(false);
  const [channel, setChannel] = useState<Channel>("both");
  const [offsets, setOffsets] = useState<Offset[]>([
    { hoursBefore: 24, label: "24 hours before" },
  ]);
  const [emailTemplateId, setEmailTemplateId] = useState<string>("");
  const [smsTemplateId, setSmsTemplateId] = useState<string>("");

  const { data: settingsData } = useQuery<{ data: any }>({
    queryKey: ["/api/business-settings"],
  });

  const { data: emailTemplates } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const { data: smsTemplates } = useQuery<SmsTemplate[]>({
    queryKey: ["/api/sms-templates"],
  });

  useEffect(() => {
    const s = settingsData?.data;
    if (!s) return;
    setEnabled(!!s.bookingRemindersEnabled);
    setDefaultOn(!!s.bookingReminderDefaultOn);
    setChannel((s.bookingReminderChannel as Channel) || "both");
    if (Array.isArray(s.bookingReminderOffsets)) {
      setOffsets(s.bookingReminderOffsets);
    }
    setEmailTemplateId(s.bookingReminderEmailTemplateId || "");
    setSmsTemplateId(s.bookingReminderSmsTemplateId || "");
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        bookingRemindersEnabled: enabled,
        bookingReminderDefaultOn: defaultOn,
        bookingReminderChannel: channel,
        bookingReminderOffsets: offsets,
        bookingReminderEmailTemplateId: emailTemplateId || null,
        bookingReminderSmsTemplateId: smsTemplateId || null,
      };
      const res = await apiRequest("PUT", "/api/business-settings", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      toast({ title: "Saved", description: "Booking reminder settings updated." });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const addOffset = (hoursBefore: number, label?: string) => {
    if (offsets.some((o) => o.hoursBefore === hoursBefore)) return;
    const next = [...offsets, { hoursBefore, label }];
    next.sort((a, b) => b.hoursBefore - a.hoursBefore);
    setOffsets(next);
  };

  const removeOffset = (index: number) => {
    setOffsets(offsets.filter((_, i) => i !== index));
  };

  const updateOffsetHours = (index: number, value: string) => {
    const num = parseInt(value, 10);
    if (Number.isNaN(num) || num < 1) return;
    const next = [...offsets];
    next[index] = { ...next[index], hoursBefore: num };
    setOffsets(next);
  };

  const updateOffsetLabel = (index: number, value: string) => {
    const next = [...offsets];
    next[index] = { ...next[index], label: value };
    setOffsets(next);
  };

  const updateOffsetChannel = (index: number, value: Channel | "default") => {
    const next = [...offsets];
    if (value === "default") {
      const { channel: _omit, ...rest } = next[index];
      next[index] = rest;
    } else {
      next[index] = { ...next[index], channel: value };
    }
    setOffsets(next);
  };

  const reminderEmailTemplates = (emailTemplates || []).filter(
    (t) => t.category === "reminder" || t.category === "job_status",
  );
  const reminderSmsTemplates = (smsTemplates || []).filter(
    (t) => t.category === "reminder" || t.category === "confirmation",
  );

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="btn-back-to-settings">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6" />
              Booking Reminders
            </h1>
            <p className="text-sm text-muted-foreground">
              Customer-facing reminders sent before scheduled jobs
            </p>
          </div>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          data-testid="btn-save-booking-reminders"
        >
          {saveMutation.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>
            Master toggle for the booking reminder system. When off, scheduled
            reminders will not fire even if individual jobs have been opted in.
            The diary "Send reminder" button always works regardless.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enabled">Enable scheduled booking reminders</Label>
              <p className="text-xs text-muted-foreground">
                Globally enable or disable the reminder worker
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              data-testid="switch-booking-reminders-enabled"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="default-on">
                Default to "schedule reminders" when booking a job
              </Label>
              <p className="text-xs text-muted-foreground">
                Pre-tick the per-job toggle in the scheduling modal
              </p>
            </div>
            <Switch
              id="default-on"
              checked={defaultOn}
              onCheckedChange={setDefaultOn}
              data-testid="switch-booking-reminders-default-on"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="channel">Default channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
              <SelectTrigger id="channel" data-testid="select-booking-reminder-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email only</SelectItem>
                <SelectItem value="sms">SMS only</SelectItem>
                <SelectItem value="both">Email and SMS</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Each offset can override this with its own channel below.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When to send</CardTitle>
          <CardDescription>
            Add one entry per reminder you want to send before the booking. Each
            offset is "hours before the scheduled start time". Offsets that have
            already passed when a job is scheduled are skipped automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.hoursBefore}
                variant="outline"
                size="sm"
                onClick={() => addOffset(p.hoursBefore, p.label)}
                disabled={offsets.some((o) => o.hoursBefore === p.hoursBefore)}
                data-testid={`btn-add-preset-${p.hoursBefore}`}
              >
                <Plus className="w-3 h-3 mr-1" />
                {p.label}
              </Button>
            ))}
          </div>

          <Separator />

          {offsets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No reminder offsets configured. Add one from the presets above.
            </p>
          ) : (
            <div className="space-y-3">
              {offsets.map((offset, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-[120px_1fr_180px_auto] gap-3 items-end p-3 border rounded-md"
                  data-testid={`row-offset-${index}`}
                >
                  <div>
                    <Label className="text-xs">Hours before</Label>
                    <Input
                      type="number"
                      min={1}
                      value={offset.hoursBefore}
                      onChange={(e) => updateOffsetHours(index, e.target.value)}
                      data-testid={`input-offset-hours-${index}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Label (optional)</Label>
                    <Input
                      value={offset.label || ""}
                      onChange={(e) => updateOffsetLabel(index, e.target.value)}
                      placeholder="e.g. Night before"
                      data-testid={`input-offset-label-${index}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Channel override</Label>
                    <Select
                      value={offset.channel || "default"}
                      onValueChange={(v) =>
                        updateOffsetChannel(index, v as Channel | "default")
                      }
                    >
                      <SelectTrigger data-testid={`select-offset-channel-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Use default</SelectItem>
                        <SelectItem value="email">Email only</SelectItem>
                        <SelectItem value="sms">SMS only</SelectItem>
                        <SelectItem value="both">Email and SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOffset(index)}
                    data-testid={`btn-remove-offset-${index}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            Pick a template from your library, or leave blank for the built-in
            default. Variables available: {"{firstName}"}, {"{customerName}"},{" "}
            {"{scheduledDate}"}, {"{scheduledTime}"}, {"{jobAddress}"},{" "}
            {"{jobTitle}"}, {"{jobNumber}"}, {"{businessName}"},{" "}
            {"{businessPhone}"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-template">Email template</Label>
            <Select
              value={emailTemplateId || "default"}
              onValueChange={(v) => setEmailTemplateId(v === "default" ? "" : v)}
            >
              <SelectTrigger id="email-template" data-testid="select-email-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Built-in default</SelectItem>
                {reminderEmailTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Showing email templates with category "reminder" or "job_status".{" "}
              <Link href="/settings/templates" className="underline">
                Manage email templates
              </Link>
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="sms-template">SMS template</Label>
            <Select
              value={smsTemplateId || "default"}
              onValueChange={(v) => setSmsTemplateId(v === "default" ? "" : v)}
            >
              <SelectTrigger id="sms-template" data-testid="select-sms-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Built-in default</SelectItem>
                {reminderSmsTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Showing SMS templates with category "reminder" or "confirmation".{" "}
              <Link href="/settings/sms-templates" className="underline">
                Manage SMS templates
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
