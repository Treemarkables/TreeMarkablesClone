import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PendingOutboundMessage } from "@shared/schema";
import {
  createHoldingSendLock,
  sendHoldingMessageFromNotification,
  type HoldingSendStep,
} from "@shared/holdingMessageApproval";

interface HoldingMessageNotificationActionsProps {
  notificationId: string;
  pending: PendingOutboundMessage | null;
  isLoading: boolean;
  onOpenJob: () => void;
  onDismiss: () => void;
  onFinished: () => void;
}

export function HoldingMessageNotificationActions({
  notificationId,
  pending,
  isLoading,
  onOpenJob,
  onDismiss,
  onFinished,
}: HoldingMessageNotificationActionsProps) {
  const { toast } = useToast();
  const lockRef = useRef(createHoldingSendLock());
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<"sent" | "already_handled" | null>(null);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (pending && draft === null) setDraft(pending.message);
  }, [pending, draft]);

  const text = draft ?? pending?.message ?? "";
  const canSend = !!pending && pending.status === "pending" && text.trim().length > 0 && !sending;

  const stopRowClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  const handleSend = async () => {
    if (!pending || sending) return;
    setSending(true);
    setErrorText("");
    try {
      const result = await sendHoldingMessageFromNotification(
        {
          notificationId,
          pendingMessageId: pending.id,
          savedMessage: pending.message,
          draftMessage: text,
        },
        {
          request: async (step: HoldingSendStep) => {
            await apiRequest(step.method, step.path, step.body);
          },
          markRead: async () => {
            onFinished();
          },
        },
        lockRef.current,
      );
      if (result.ok) {
        setOutcome(result.outcome);
        return;
      }
      if ("skipped" in result && result.skipped) return;
      const message = "message" in result ? result.message : "Could not send";
      setErrorText(message);
      toast({
        title: "Could not send",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="mt-2 space-y-2"
      onClick={stopRowClick}
      onPointerDown={stopRowClick}
      data-testid={`holding-message-actions-${notificationId}`}
    >
      {outcome ? (
        <p
          className="text-sm font-medium text-green-700 dark:text-green-400"
          data-testid={`holding-message-sent-${notificationId}`}
        >
          {outcome === "sent" ? "Message sent" : "Already sent"}
        </p>
      ) : isLoading && !pending ? (
        <p className="text-xs text-muted-foreground">Loading message…</p>
      ) : !pending || pending.status !== "pending" ? (
        <p className="text-xs text-muted-foreground" data-testid={`holding-message-unavailable-${notificationId}`}>
          This draft is no longer waiting to send.
        </p>
      ) : (
        <>
          {expanded ? (
            <Textarea
              value={text}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
              className="text-base md:text-sm"
              disabled={sending}
              data-testid={`holding-message-editor-${notificationId}`}
            />
          ) : (
            <p
              className="rounded-md bg-background/80 px-2 py-1.5 text-sm whitespace-pre-wrap break-words line-clamp-3"
              data-testid={`holding-message-preview-${notificationId}`}
            >
              {text}
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setExpanded((open) => !open)}
            data-testid={`holding-message-expand-${notificationId}`}
          >
            {expanded ? "Show less" : "Show full message"}
          </Button>
        </>
      )}

      {errorText && (
        <p className="text-xs text-destructive" data-testid={`holding-message-error-${notificationId}`}>
          {errorText}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {pending && pending.status === "pending" && !outcome && (
          <Button
            type="button"
            size="sm"
            className="min-h-11 flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto"
            onClick={handleSend}
            disabled={sending || !canSend}
            data-testid={`holding-message-send-${notificationId}`}
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? "Sending…" : "Send"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto"
          onClick={onOpenJob}
          data-testid={`holding-message-open-job-${notificationId}`}
        >
          Open job
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 flex-1 basis-[calc(50%-0.25rem)] sm:basis-auto"
          onClick={onDismiss}
          data-testid={`holding-message-dismiss-${notificationId}`}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
