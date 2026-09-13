/**
 * Share Timeline dialog — get-or-creates the job's public photo-timeline
 * link and presents it with a copy button. Opened from the job card
 * (mobile Actions sheet + desktop More menu).
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function ShareTimelineDialog({
  isOpen,
  onClose,
  jobId,
}: {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const linkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/jobs/${jobId}/timeline-link`, {});
      return (await res.json()) as { data?: { url?: string } };
    },
    onSuccess: (result) => setUrl(result?.data?.url ?? null),
    onError: () => {
      toast({
        title: "Couldn't create timeline link",
        description: "Please try again.",
        variant: "destructive",
      });
      onClose();
    },
  });

  // Fetch (get-or-create) the link each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setUrl(null);
      setCopied(false);
      linkMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Long-press the link to copy it manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Share photo timeline
          </DialogTitle>
          <DialogDescription>
            Anyone with this link can see this job's photo feed (captions
            included, internal notes excluded). It updates live as new photos
            are added.
          </DialogDescription>
        </DialogHeader>

        {url ? (
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="text-xs" data-testid="input-timeline-url" />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              aria-label="Copy timeline link"
              data-testid="button-copy-timeline-link"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
