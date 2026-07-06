import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Pause,
  Search,
  Loader2,
  Trash2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Call, Customer } from "@shared/schema";
import { VoicemailGreetingCard } from "@/components/VoicemailGreetingCard";

// Match the last 8 digits of a phone number, the same heuristic the Twilio
// answer webhook uses for caller-ID enrichment (handles +64 vs 0 prefixes).
const last8 = (value?: string | null) =>
  (value ?? "").replace(/\D/g, "").slice(-8);

export default function Calls() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null);
  const [callToDelete, setCallToDelete] = useState<Call | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: callsResponse, isLoading } = useQuery<{
    success: boolean;
    data: Call[];
  }>({
    queryKey: ["/api/calls"],
  });

  const { data: customersResponse } = useQuery<{
    success: boolean;
    data: Customer[];
  }>({
    queryKey: ["/api/customers"],
  });

  const calls = callsResponse?.data ?? [];
  const customers = customersResponse?.data ?? [];

  // Index customers by the last 8 digits of either phone field so a call from a
  // known number resolves to a name even when the call was never linked to a
  // customer record (most recorded inbound calls only store the raw number).
  const phoneIndex = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) {
      for (const candidate of [c.phone, c.mobile]) {
        const key = last8(candidate);
        if (key.length === 8 && !map.has(key)) map.set(key, c);
      }
    }
    return map;
  }, [customers]);

  const resolveCustomerName = (call: Call): string | null => {
    if (call.customerId) {
      const byId = customers.find((c) => c.id === call.customerId)?.name;
      if (byId) return byId;
    }
    const key = last8(call.phoneNumber);
    if (key.length === 8) return phoneIndex.get(key)?.name ?? null;
    return null;
  };

  const createJobFromCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await apiRequest("POST", `/api/calls/${callId}/create-job`, {});
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create job");
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      const jobId = data?.data?.job?.id;
      if (jobId) navigate(`/dispatch?job=${jobId}`);
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't create job",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await apiRequest("DELETE", `/api/calls/${callId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to delete call");
      return json;
    },
    onSuccess: (_data, callId) => {
      if (playingCallId === callId) setPlayingCallId(null);
      if (expandedTranscript === callId) setExpandedTranscript(null);
      setCallToDelete(null);
      setSelectedIds((prev) => {
        if (!prev.has(callId)) return prev;
        const next = new Set(prev);
        next.delete(callId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
    },
    onError: (err: Error) => {
      setCallToDelete(null);
      toast({
        title: "Couldn't delete call",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/calls/bulk-delete", { ids });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to delete calls");
      return json as { deleted: number; failed: string[] };
    },
    onSuccess: (data) => {
      setBulkDeleteOpen(false);
      setSelectedIds(new Set(data.failed ?? []));
      setPlayingCallId(null);
      setExpandedTranscript(null);
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      if (data.failed?.length) {
        toast({
          title: "Some calls weren't deleted",
          description: `${data.failed.length} of ${
            data.deleted + data.failed.length
          } calls couldn't be deleted. They're still selected — try again.`,
          variant: "destructive",
        });
      }
    },
    onError: (err: Error) => {
      setBulkDeleteOpen(false);
      toast({
        title: "Couldn't delete calls",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const toggleSelected = (callId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  };

  const filteredCalls = calls.filter((call) => {
    const customerName = resolveCustomerName(call);
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      call.phoneNumber?.toLowerCase().includes(q) ||
      customerName?.toLowerCase().includes(q) ||
      call.transcriptText?.toLowerCase().includes(q);
    const matchesDirection =
      directionFilter === "all" || call.direction === directionFilter;
    return matchesSearch && matchesDirection;
  });

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCallTime = (dateStr?: Date | string | null) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleString("en-NZ", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full overflow-x-hidden">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calls</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Every recorded call, with the caller's name when they're a known customer
        </p>
      </div>

      <VoicemailGreetingCard />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-green-500" />
                Call History
              </CardTitle>
              <CardDescription>
                Play recordings, read transcripts, and turn calls into jobs
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search calls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-calls"
                />
              </div>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger
                  className="w-full sm:w-32"
                  data-testid="select-call-direction"
                >
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Calls</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No call records yet</h3>
              <p className="text-muted-foreground">
                Recorded calls will appear here once customers start calling.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={
                      filteredCalls.length > 0 &&
                      filteredCalls.every((c) => selectedIds.has(c.id))
                    }
                    onCheckedChange={(checked) =>
                      setSelectedIds(
                        checked
                          ? new Set(filteredCalls.map((c) => c.id))
                          : new Set(),
                      )
                    }
                    data-testid="checkbox-select-all-calls"
                  />
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : "Select all"}
                </label>
                {selectedIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={bulkDeleteMutation.isPending}
                    data-testid="button-bulk-delete-calls"
                  >
                    {bulkDeleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-1" />
                    )}
                    Delete {selectedIds.size}
                  </Button>
                )}
              </div>
              {filteredCalls.map((call) => {
                const customerName = resolveCustomerName(call);
                const isPlaying = playingCallId === call.id;
                const isTranscriptOpen = expandedTranscript === call.id;
                return (
                  <div
                    key={call.id}
                    className="flex flex-col gap-3 p-4 border rounded-lg"
                    data-testid={`call-row-${call.id}`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex-shrink-0 flex items-center gap-3">
                        <Checkbox
                          checked={selectedIds.has(call.id)}
                          onCheckedChange={() => toggleSelected(call.id)}
                          data-testid={`checkbox-select-call-${call.id}`}
                        />
                        {call.direction === "inbound" ? (
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <PhoneIncoming className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <PhoneOutgoing className="w-5 h-5 text-green-600 dark:text-green-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium">
                            {customerName ?? call.phoneNumber}
                          </h4>
                          {customerName && (
                            <span className="text-xs text-muted-foreground">
                              {call.phoneNumber}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {call.direction === "inbound" ? "Incoming" : "Outgoing"}
                          </Badge>
                          {call.sentiment && (
                            <Badge
                              className={
                                call.sentiment === "positive"
                                  ? "bg-green-500"
                                  : call.sentiment === "negative"
                                    ? "bg-red-500"
                                    : "bg-gray-500"
                              }
                            >
                              {call.sentiment}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Duration: {formatDuration(call.duration)}
                          {call.status && ` • ${call.status}`}
                        </p>
                        {call.summary && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {call.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                        <p className="text-xs text-muted-foreground">
                          {formatCallTime(call.createdAt)}
                        </p>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {call.recordingUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPlayingCallId(isPlaying ? null : call.id)
                              }
                              data-testid={`button-play-call-${call.id}`}
                            >
                              {isPlaying ? (
                                <Pause className="w-4 h-4 mr-1" />
                              ) : (
                                <Play className="w-4 h-4 mr-1" />
                              )}
                              {isPlaying ? "Pause" : "Play"}
                            </Button>
                          )}
                          {call.transcriptText && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setExpandedTranscript(
                                  isTranscriptOpen ? null : call.id,
                                )
                              }
                              data-testid={`button-transcript-${call.id}`}
                            >
                              {isTranscriptOpen ? "Hide" : "Transcript"}
                            </Button>
                          )}
                          {call.transcriptText && !call.jobId && (
                            <Button
                              size="sm"
                              onClick={() =>
                                createJobFromCallMutation.mutate(call.id)
                              }
                              disabled={createJobFromCallMutation.isPending}
                              data-testid={`button-create-job-${call.id}`}
                            >
                              {createJobFromCallMutation.isPending &&
                              createJobFromCallMutation.variables === call.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : null}
                              Create Job
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCallToDelete(call)}
                            disabled={
                              deleteCallMutation.isPending &&
                              deleteCallMutation.variables === call.id
                            }
                            data-testid={`button-delete-call-${call.id}`}
                          >
                            {deleteCallMutation.isPending &&
                            deleteCallMutation.variables === call.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    {isPlaying && call.recordingUrl && (
                      <audio
                        controls
                        autoPlay
                        className="w-full"
                        src={call.recordingUrl}
                        onEnded={() => setPlayingCallId(null)}
                      />
                    )}
                    {isTranscriptOpen && call.transcriptText && (
                      <div className="p-3 bg-muted rounded-lg">
                        <h5 className="text-sm font-medium mb-1">Transcript</h5>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {call.transcriptText}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!callToDelete}
        onOpenChange={(open) => {
          if (!open) setCallToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this call?</AlertDialogTitle>
            <AlertDialogDescription>
              {callToDelete &&
                `The call from ${
                  resolveCustomerName(callToDelete) ?? callToDelete.phoneNumber
                } on ${formatCallTime(callToDelete.createdAt)}`}
              {" "}will be permanently removed, including its recording and
              transcript. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (callToDelete) deleteCallMutation.mutate(callToDelete.id);
              }}
              data-testid="button-confirm-delete-call"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "call" : "calls"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The selected calls will be permanently removed, including their
              recordings and transcripts. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              data-testid="button-confirm-bulk-delete-calls"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
