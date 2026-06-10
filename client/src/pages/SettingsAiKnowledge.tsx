import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, BookOpen } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BusinessSettings {
  id: string;
  aiKnowledge?: string | null;
}

interface SettingsResponse {
  success: boolean;
  data: BusinessSettings;
}

const MAX_CHARS = 20000;

const PLACEHOLDER = `e.g.

SERVICES: tree removal, pruning, hedge trimming, stump grinding, emergency storm work. We don't do palm removals or land clearing.

SERVICE AREA: Whangarei to Auckland. Nothing north of Whangarei.

POLICIES: site visit before every quote — never commit to a price sight-unseen. Always ask whether trees are near power lines. Fully insured; mention it if asked.

TIMING: site visits weekdays only. Emergency work — same day where possible.`;

export default function SettingsAiKnowledge() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["/api/business-settings"],
  });

  const settings = data?.data;

  const [knowledge, setKnowledge] = useState("");

  useEffect(() => {
    if (!settings) return;
    setKnowledge(settings.aiKnowledge ?? "");
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

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading settings…</div>;
  }

  const remaining = MAX_CHARS - knowledge.length;

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back-to-settings">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Knowledge</h1>
          <p className="text-sm text-gray-600">
            One document of business facts that every AI feature reads — write it once,
            it applies everywhere.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Knowledge document
          </CardTitle>
          <CardDescription>
            Used by the AI phone assistant, speech-to-quote, and future AI features.
            Cover what you do (and don't do), your service area, policies, and answers
            to common questions. Concise beats exhaustive — short labelled sections
            work best.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-knowledge">Business knowledge</Label>
            <Textarea
              id="ai-knowledge"
              value={knowledge}
              onChange={(e) => setKnowledge(e.target.value)}
              rows={18}
              maxLength={MAX_CHARS}
              placeholder={PLACEHOLDER}
              className="font-mono text-sm"
              data-testid="textarea-ai-knowledge"
            />
            <p className="text-xs text-muted-foreground">
              {remaining.toLocaleString()} characters remaining. The phone assistant
              reads the first ~8,000 characters, so put the most important facts at
              the top.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => saveMutation.mutate({ aiKnowledge: knowledge })}
              disabled={saveMutation.isPending}
              data-testid="button-save-ai-knowledge"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
