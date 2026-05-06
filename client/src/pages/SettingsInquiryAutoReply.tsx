import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Mail, MessageSquare } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Channel = "email" | "sms" | "both";

interface BusinessSettings {
  id: string;
  inquiryAutoReplyEnabled?: boolean | null;
  inquiryAutoReplyChannel?: Channel | null;
  inquiryAutoReplyEmailSubject?: string | null;
  inquiryAutoReplyEmailMessage?: string | null;
  inquiryAutoReplySmsMessage?: string | null;
}

interface SettingsResponse {
  success: boolean;
  data: BusinessSettings;
}

const DEFAULT_SUBJECT = "We've received your inquiry — Treemarkables";
const DEFAULT_EMAIL =
  "Hi {customerName},\n\nThanks for getting in touch with Treemarkables. We've received your inquiry and Jules will be in touch within 24 hours to schedule in your quote.\n\nIf it's urgent, feel free to reply to this email or give us a call.\n\nThanks,\nThe Treemarkables Team";
const DEFAULT_SMS =
  "Hi {firstName}, thanks for your inquiry with Treemarkables. Jules will be in touch within 24 hours to schedule in your quote.";

export default function SettingsInquiryAutoReply() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["/api/business-settings"],
  });

  const settings = data?.data;

  const [enabled, setEnabled] = useState(true);
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [emailMessage, setEmailMessage] = useState(DEFAULT_EMAIL);
  const [smsMessage, setSmsMessage] = useState(DEFAULT_SMS);

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.inquiryAutoReplyEnabled ?? true);
    setChannel((settings.inquiryAutoReplyChannel ?? "email") as Channel);
    setSubject(settings.inquiryAutoReplyEmailSubject ?? DEFAULT_SUBJECT);
    setEmailMessage(settings.inquiryAutoReplyEmailMessage ?? DEFAULT_EMAIL);
    setSmsMessage(settings.inquiryAutoReplySmsMessage ?? DEFAULT_SMS);
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
      inquiryAutoReplyEnabled: enabled,
      inquiryAutoReplyChannel: channel,
      inquiryAutoReplyEmailSubject: subject.trim() || DEFAULT_SUBJECT,
      inquiryAutoReplyEmailMessage: emailMessage,
      inquiryAutoReplySmsMessage: smsMessage,
    });
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading settings…</div>;
  }

  const showEmail = channel === "email" || channel === "both";
  const showSms = channel === "sms" || channel === "both";
  const smsRemaining = 306 - smsMessage.length;

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back-to-settings">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inquiry Auto-Reply</h1>
          <p className="text-sm text-gray-600">
            Sent automatically when someone submits a quote form on the website.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Confirmation message
          </CardTitle>
          <CardDescription>
            Customers get this immediately so they know the inquiry came through.
            Available variables:{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{customerName}"}</code>{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{firstName}"}</code>{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{businessName}"}</code>{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{businessPhone}"}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable auto-reply</Label>
              <p className="text-sm text-muted-foreground">
                When off, no confirmation is sent to the customer.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              data-testid="switch-inquiry-auto-reply-enabled"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-reply-channel">Send via</Label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as Channel)}
              disabled={!enabled}
            >
              <SelectTrigger
                id="auto-reply-channel"
                className="max-w-[220px]"
                data-testid="select-inquiry-auto-reply-channel"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email only</SelectItem>
                <SelectItem value="sms">SMS only</SelectItem>
                <SelectItem value="both">Email + SMS</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              SMS is only sent when the customer has provided a mobile number.
            </p>
          </div>

          {showEmail && (
            <div className="space-y-4 rounded-md border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="w-4 h-4" />
                Email
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto-reply-subject">Subject</Label>
                <Input
                  id="auto-reply-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={!enabled}
                  maxLength={200}
                  data-testid="input-inquiry-auto-reply-subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto-reply-email">Message</Label>
                <Textarea
                  id="auto-reply-email"
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  disabled={!enabled}
                  rows={9}
                  maxLength={5000}
                  data-testid="textarea-inquiry-auto-reply-email"
                />
              </div>
            </div>
          )}

          {showSms && (
            <div className="space-y-4 rounded-md border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="w-4 h-4" />
                SMS
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto-reply-sms">Message</Label>
                <Textarea
                  id="auto-reply-sms"
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  disabled={!enabled}
                  rows={4}
                  maxLength={306}
                  data-testid="textarea-inquiry-auto-reply-sms"
                />
                <p className="text-xs text-muted-foreground">
                  {smsRemaining} characters remaining (max 306).
                </p>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-inquiry-auto-reply"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
