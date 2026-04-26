import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Video } from "lucide-react";

interface WelcomeVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  customerName: string;
}

export default function WelcomeVideoModal({
  open,
  onOpenChange,
  jobId,
  customerName,
}: WelcomeVideoModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const invalidateRelated = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "diary"] }),
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "welcome-prompt-status"],
      }),
    ]);

  const handleSend = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/send-welcome-video`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send welcome video");
      }
      await invalidateRelated();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Could not send welcome video",
        description: e.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    setBusy(true);
    try {
      await fetch(`/api/jobs/${jobId}/dismiss-welcome-prompt`, {
        method: "POST",
      });
      await invalidateRelated();
    } finally {
      setBusy(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-welcome-video">
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Video className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle>Send welcome video to {customerName}?</DialogTitle>
          <DialogDescription>
            {customerName} just confirmed they'd like to schedule. They're a
            new customer — want to send the welcome video email now?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={busy}
            data-testid="button-skip-welcome-video"
          >
            Skip
          </Button>
          <Button
            onClick={handleSend}
            disabled={busy}
            data-testid="button-send-welcome-video"
          >
            {busy ? "Sending…" : "Send video"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
