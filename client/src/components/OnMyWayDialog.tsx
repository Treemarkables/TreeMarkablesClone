/**
 * "On my way" one-tap text — lets the customer know a crew member is en
 * route to their job. Pick an ETA, tweak the message if needed, send.
 * Server side (POST /api/jobs/:id/on-my-way) sends the SMS and writes a
 * job-diary entry, so the send shows up in the timeline immediately.
 *
 * Shared by JobCardMobile (Actions sheet tile) and JobCardDesktop
 * (bottom action bar).
 */
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Navigation } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const ETA_OPTIONS = [10, 15, 20, 30, 45, 60];

interface OnMyWayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  /** Best SMS-able number for this job (mobile preferred). Null disables send. */
  phone: string | null;
  customerName?: string;
  /** Job address (falls back to customer address at the call site). */
  address?: string;
}

export function OnMyWayDialog({
  isOpen,
  onClose,
  jobId,
  phone,
  customerName,
  address,
}: OnMyWayDialogProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settingsResp } = useQuery<{ data?: { businessName?: string } }>({
    queryKey: ["/api/business-settings"],
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const [etaMinutes, setEtaMinutes] = useState(20);
  const [message, setMessage] = useState("");

  const buildMessage = useMemo(() => {
    return (eta: number) => {
      const firstName = customerName?.trim().split(/\s+/)[0];
      const staffName = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(" ");
      const businessName = settingsResp?.data?.businessName;
      const from = staffName
        ? businessName
          ? `${staffName} from ${businessName}`
          : staffName
        : businessName || "Our team";
      const destination = address?.trim() ? ` to ${address.trim()}` : "";
      return `Hi${firstName ? ` ${firstName}` : ""}, ${from} is on the way${destination} and should arrive in about ${eta} minutes.`;
    };
  }, [customerName, address, currentUser, settingsResp]);

  // Re-seed the message whenever the dialog opens or an ETA chip is tapped.
  // Manual edits persist until the next chip tap (which regenerates).
  useEffect(() => {
    if (isOpen) setMessage(buildMessage(etaMinutes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, buildMessage]);

  const pickEta = (eta: number) => {
    setEtaMinutes(eta);
    setMessage(buildMessage(eta));
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/on-my-way`, {
        phone,
        message,
        etaMinutes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "diary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "diary-timeline"] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Failed to send text",
        description: "The message could not be sent. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            On my way
          </DialogTitle>
          <DialogDescription>
            {phone
              ? `Text ${customerName || "the customer"} at ${phone} to say you're en route.`
              : "No phone number on this job or customer — add one to send an on-my-way text."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Arriving in about</Label>
            <div className="grid grid-cols-3 gap-2">
              {ETA_OPTIONS.map((eta) => (
                <Button
                  key={eta}
                  type="button"
                  variant={etaMinutes === eta ? "default" : "outline"}
                  onClick={() => pickEta(eta)}
                  data-testid={`button-eta-${eta}`}
                >
                  {eta} min
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="on-my-way-message">Message</Label>
            <Textarea
              id="on-my-way-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[90px]"
              maxLength={459}
              data-testid="textarea-on-my-way-message"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={sendMutation.isPending}
            data-testid="button-cancel-on-my-way"
          >
            Cancel
          </Button>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!phone || !message.trim() || sendMutation.isPending}
            data-testid="button-send-on-my-way"
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              "Send text"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
