import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Mail, MessageSquare, Pencil, Send, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PendingOutboundMessage } from "@shared/schema";

interface PendingMessagesCardProps {
  jobId: string;
}

export function PendingMessagesCard({ jobId }: PendingMessagesCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  const { data: response, isLoading } = useQuery<{
    success: boolean;
    data: PendingOutboundMessage[];
  }>({
    queryKey: ["/api/pending-messages", { jobId }],
    queryFn: async () => {
      const res = await fetch(
        `/api/pending-messages?jobId=${encodeURIComponent(jobId)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load pending messages");
      return res.json();
    },
    enabled: !!jobId,
    refetchInterval: 30000,
  });

  const pending = (response?.data ?? []).filter((m) => m.status === "pending");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/pending-messages", { jobId }] });
    queryClient.invalidateQueries({ queryKey: ["/api/pending-messages"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "diary-timeline"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/pending-messages/${id}/approve`, {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to send");
      return json;
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err: Error) => {
      toast({ title: "Could not send", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/pending-messages/${id}/reject`, {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to dismiss");
      return json;
    },
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const res = await apiRequest("PATCH", `/api/pending-messages/${id}`, { message });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to save");
      return json;
    },
    onSuccess: () => {
      invalidateAll();
      setEditingId(null);
      setEditingText("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const channelMutation = useMutation({
    mutationFn: async ({ id, channel }: { id: string; channel: "sms" | "email" }) => {
      const res = await apiRequest("PATCH", `/api/pending-messages/${id}`, { channel });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to switch channel");
      return json;
    },
    onSuccess: () => invalidateAll(),
    onError: (err: Error) => {
      toast({ title: "Could not switch channel", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || pending.length === 0) return null;

  return (
    <div className="space-y-2 p-2 pr-4">
      {pending.map((msg) => (
        <div
          key={msg.id}
          className="rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/60 dark:bg-orange-950/20 p-3 space-y-2"
          data-testid={`pending-message-${msg.id}`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-orange-900 dark:text-orange-200">
              Draft awaiting your approval
            </span>
            {(() => {
              const canSms = !!msg.recipientPhone;
              const canEmail = !!msg.recipientEmail;
              const switching = channelMutation.isPending;
              if (canSms && canEmail) {
                return (
                  <div className="inline-flex rounded-md border border-input overflow-hidden">
                    <button
                      type="button"
                      disabled={switching || msg.channel === "sms"}
                      onClick={() => channelMutation.mutate({ id: msg.id, channel: "sms" })}
                      className={`px-2 py-0.5 text-[10px] font-medium inline-flex items-center gap-1 ${
                        msg.channel === "sms"
                          ? "bg-orange-200/70 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100"
                          : "bg-background text-muted-foreground"
                      } disabled:opacity-100`}
                      data-testid={`pending-message-channel-sms-${msg.id}`}
                    >
                      <MessageSquare className="w-3 h-3" /> SMS
                    </button>
                    <button
                      type="button"
                      disabled={switching || msg.channel === "email"}
                      onClick={() => channelMutation.mutate({ id: msg.id, channel: "email" })}
                      className={`px-2 py-0.5 text-[10px] font-medium inline-flex items-center gap-1 border-l border-input ${
                        msg.channel === "email"
                          ? "bg-orange-200/70 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100"
                          : "bg-background text-muted-foreground"
                      } disabled:opacity-100`}
                      data-testid={`pending-message-channel-email-${msg.id}`}
                    >
                      <Mail className="w-3 h-3" /> Email
                    </button>
                  </div>
                );
              }
              return (
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {msg.channel}
                </Badge>
              );
            })()}
            {msg.recipientName && (
              <span className="text-xs text-muted-foreground">to {msg.recipientName}</span>
            )}
            {msg.channel === "sms" && msg.recipientPhone && (
              <span className="text-xs text-muted-foreground">{msg.recipientPhone}</span>
            )}
            {msg.channel === "email" && msg.recipientEmail && (
              <span className="text-xs text-muted-foreground">{msg.recipientEmail}</span>
            )}
          </div>

          {editingId === msg.id ? (
            <div className="space-y-2">
              <Textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                rows={3}
                className="text-sm bg-background"
                data-testid={`pending-message-edit-${msg.id}`}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => editMutation.mutate({ id: msg.id, message: editingText })}
                  disabled={editMutation.isPending}
                >
                  {editMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(null);
                    setEditingText("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-background/80 px-3 py-2 text-sm whitespace-pre-wrap">
              {msg.message}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => approveMutation.mutate(msg.id)}
              disabled={approveMutation.isPending || editingId === msg.id}
              data-testid={`pending-message-approve-${msg.id}`}
            >
              {approveMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Send className="w-3 h-3 mr-1" />
              )}
              Approve &amp; send
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingId(msg.id);
                setEditingText(msg.message);
              }}
              disabled={editingId === msg.id}
              data-testid={`pending-message-edit-btn-${msg.id}`}
            >
              <Pencil className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => rejectMutation.mutate(msg.id)}
              disabled={rejectMutation.isPending}
              data-testid={`pending-message-reject-${msg.id}`}
            >
              <X className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
