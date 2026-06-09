import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Phone, Bot } from "lucide-react";
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

interface BusinessSettings {
  id: string;
  voiceAgentEnabled?: boolean | null;
  voiceAgentGreeting?: string | null;
  voiceAgentVoice?: string | null;
  voiceAgentExtraInstructions?: string | null;
  voiceAgentMaxMinutes?: number | null;
}

interface SettingsResponse {
  success: boolean;
  data: BusinessSettings;
}

const DEFAULT_GREETING =
  "Thanks for calling {businessName}. For a quick quote with our A.I. assistant, press 1. To speak to {ownerName}, press 2.";

const VOICE_OPTIONS = [
  { value: "marin", label: "Marin" },
  { value: "cedar", label: "Cedar" },
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "shimmer", label: "Shimmer" },
];

export default function SettingsVoiceAgent() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["/api/business-settings"],
  });

  const settings = data?.data;

  const [enabled, setEnabled] = useState(false);
  const [greeting, setGreeting] = useState(DEFAULT_GREETING);
  const [voice, setVoice] = useState("marin");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [maxMinutes, setMaxMinutes] = useState(10);

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.voiceAgentEnabled ?? false);
    setGreeting(settings.voiceAgentGreeting ?? DEFAULT_GREETING);
    setVoice(settings.voiceAgentVoice ?? "marin");
    setExtraInstructions(settings.voiceAgentExtraInstructions ?? "");
    setMaxMinutes(settings.voiceAgentMaxMinutes ?? 10);
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
      voiceAgentEnabled: enabled,
      voiceAgentGreeting: greeting.trim() || DEFAULT_GREETING,
      voiceAgentVoice: voice,
      voiceAgentExtraInstructions: extraInstructions,
      voiceAgentMaxMinutes: Math.min(Math.max(maxMinutes || 10, 2), 30),
    });
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back-to-settings">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Phone Assistant</h1>
          <p className="text-sm text-gray-600">
            Answers inbound calls with a menu — callers can get a quick quote with the
            AI assistant or ring through to you as usual.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Call menu
          </CardTitle>
          <CardDescription>
            With the assistant off, calls ring straight through exactly as they do today.
            Available variables:{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{businessName}"}</code>{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{ownerName}"}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable AI phone assistant</Label>
              <p className="text-sm text-muted-foreground">
                Callers hear the menu below; pressing 2 (or not pressing anything)
                rings through to you as normal.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              data-testid="switch-voice-agent-enabled"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-agent-greeting">Menu greeting</Label>
            <Textarea
              id="voice-agent-greeting"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              disabled={!enabled}
              rows={3}
              maxLength={500}
              data-testid="textarea-voice-agent-greeting"
            />
            <p className="text-xs text-muted-foreground">
              Spoken when the call connects. Keep "press 1" and "press 2" in the wording —
              the menu routes on those digits.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Assistant behaviour
          </CardTitle>
          <CardDescription>
            The assistant gathers the caller's name, address, job details, access, urgency
            and timing, then creates a lead for you. It never gives prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="voice-agent-voice">Voice</Label>
            <Select value={voice} onValueChange={setVoice} disabled={!enabled}>
              <SelectTrigger
                id="voice-agent-voice"
                className="max-w-[220px]"
                data-testid="select-voice-agent-voice"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-agent-max-minutes">Maximum call length (minutes)</Label>
            <Input
              id="voice-agent-max-minutes"
              type="number"
              min={2}
              max={30}
              value={maxMinutes}
              onChange={(e) => setMaxMinutes(parseInt(e.target.value, 10) || 10)}
              disabled={!enabled}
              className="max-w-[120px]"
              data-testid="input-voice-agent-max-minutes"
            />
            <p className="text-xs text-muted-foreground">
              The assistant wraps up politely when time runs out. Caps the cost of any
              single call.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-agent-extra">Extra instructions (optional)</Label>
            <Textarea
              id="voice-agent-extra"
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              disabled={!enabled}
              rows={4}
              maxLength={2000}
              placeholder="e.g. We don't service properties north of Whangarei. Always ask whether the trees are near power lines."
              data-testid="textarea-voice-agent-extra"
            />
            <p className="text-xs text-muted-foreground">
              Added to the assistant's brief — use it for service-area limits, extra
              questions to ask, or anything else it should know.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-voice-agent"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
