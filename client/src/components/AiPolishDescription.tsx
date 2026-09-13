import { useState } from "react";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AiPolishDescriptionProps {
  /** The current (rough) description text to tidy up. */
  text: string;
  /** Called when the user chooses to replace their text with the suggestion. */
  onApply: (polished: string) => void;
  className?: string;
}

/**
 * "Tidy up with AI" for the job-card description editors. Sends the current
 * text to /api/ai/polish-description and shows the professional rewrite as a
 * preview the user must explicitly accept — it never overwrites their text on
 * its own (see the auto-save data-loss history on job cards).
 */
export function AiPolishDescription({ text, onApply, className }: AiPolishDescriptionProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const requestPolish = async () => {
    const source = text.trim();
    if (!source || loading) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/polish-description", { text: source });
      const json = await res.json();
      const polished = json?.data?.polished;
      if (typeof polished !== "string" || !polished.trim()) {
        throw new Error(json?.message || "No suggestion returned");
      }
      setSuggestion(polished.trim());
    } catch (err) {
      toast({
        title: "Couldn't tidy up the description",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const hasText = !!text.trim();
  if (!hasText && !suggestion) return null;

  return (
    <div className={className}>
      {suggestion === null ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={requestPolish}
          disabled={loading}
          className="flex items-center gap-1.5"
          data-testid="ai-polish-description"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Tidying up…" : "Tidy up with AI"}
        </Button>
      ) : (
        <div
          className="rounded-lg border border-border bg-muted/40 p-3"
          data-testid="ai-polish-suggestion"
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Suggested rewrite — your text is untouched until you use it
          </div>
          <div className="whitespace-pre-wrap text-sm text-foreground">{suggestion}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApply(suggestion);
                setSuggestion(null);
              }}
              className="flex items-center gap-1.5"
              data-testid="ai-polish-apply"
            >
              <Check className="h-4 w-4" />
              Use this version
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={requestPolish}
              disabled={loading}
              className="flex items-center gap-1.5"
              data-testid="ai-polish-retry"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Try again
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSuggestion(null)}
              className="flex items-center gap-1.5"
              data-testid="ai-polish-dismiss"
            >
              <X className="h-4 w-4" />
              Keep mine
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
