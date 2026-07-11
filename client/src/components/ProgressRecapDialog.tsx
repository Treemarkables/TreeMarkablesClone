/**
 * AI progress recap — GPT-written customer update summarising the job's
 * diary so far. The owner reviews/edits, then copies it into an email or
 * text, and can log it to the diary. Opened from the job card (mobile
 * Actions sheet + desktop More menu). Metered as an AI action server-side.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function ProgressRecapDialog({
  isOpen,
  onClose,
  jobId,
}: {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [recap, setRecap] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/progress-recap`, {});
      return (await res.json()) as { data?: { recap?: string } };
    },
    onSuccess: (result) => setRecap(result?.data?.recap ?? ""),
    onError: (error: any) => {
      toast({
        title: "Couldn't generate recap",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      setRecap("");
      setCopied(false);
      generateMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recap);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Select the text and copy it manually.",
        variant: "destructive",
      });
    }
  };

  const saveToDiaryMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/jobs/${jobId}/diary`, {
        entryType: "note",
        title: "Progress recap",
        description: recap,
        authorName: "AI recap",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "diary-timeline"] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Couldn't save to diary",
        description: "The recap is still here — copy it instead.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Progress recap
          </DialogTitle>
          <DialogDescription>
            A customer-friendly summary of the job so far, written from the
            diary. Edit it, then copy into an email or text.
          </DialogDescription>
        </DialogHeader>

        {generateMutation.isPending ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Reading the job diary...
          </div>
        ) : (
          <Textarea
            value={recap}
            onChange={(e) => setRecap(e.target.value)}
            className="min-h-[220px] text-sm"
            data-testid="textarea-progress-recap"
          />
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => saveToDiaryMutation.mutate()}
            disabled={!recap.trim() || generateMutation.isPending || saveToDiaryMutation.isPending}
            data-testid="button-recap-save-diary"
          >
            {saveToDiaryMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save to diary"
            )}
          </Button>
          <Button
            onClick={handleCopy}
            disabled={!recap.trim() || generateMutation.isPending}
            data-testid="button-recap-copy"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1.5" />
                Copy
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
