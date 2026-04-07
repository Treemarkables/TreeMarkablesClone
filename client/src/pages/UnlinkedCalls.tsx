import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Clock, Mic, Link2, AlertCircle, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CallRecord = {
  id: string;
  direction: string;
  status: string;
  fromNumber: string;
  toNumber: string;
  duration: number | null;
  recordingUrl: string | null;
  transcription: string | null;
  transcriptionSummary: string | null;
  callerName: string | null;
  jobId: string | null;
  customerId: string | null;
  callStartedAt: string | null;
  createdAt: string;
};

type Job = {
  id: string;
  jobNumber: string;
  title: string;
  address: string;
  status: string;
  customerName?: string;
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CallCard({
  call,
  onLinkJob,
  onCreateJob,
}: {
  call: CallRecord;
  onLinkJob: (call: CallRecord) => void;
  onCreateJob: (call: CallRecord) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const callTime = call.callStartedAt || call.createdAt;

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <Phone className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {call.callerName || call.fromNumber}
              </p>
              {call.callerName && (
                <p className="text-xs text-muted-foreground">{call.fromNumber}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{formatDuration(call.duration)}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {callTime ? format(new Date(callTime), "dd/MM HH:mm") : "—"}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onLinkJob(call)}
            >
              <Link2 className="w-3 h-3 mr-1" />
              Link to Job
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => onCreateJob(call)}
            >
              <Plus className="w-3 h-3 mr-1" />
              New Job
            </Button>
          </div>
        </div>

        {call.transcriptionSummary && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {call.transcriptionSummary}
          </p>
        )}

        {call.recordingUrl && (
          <div className="mt-2">
            <audio
              controls
              className="w-full h-8"
              src={call.recordingUrl}
              preload="metadata"
            />
          </div>
        )}

        {call.transcription && (
          <div className="mt-2">
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setExpanded(!expanded)}
            >
              <Mic className="w-3 h-3" />
              {expanded ? (
                <>Hide transcript <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>View transcript <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
            {expanded && (
              <div className="mt-1 p-2 bg-muted rounded text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                {call.transcription}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LinkJobDialog({
  call,
  open,
  onClose,
}: {
  call: CallRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs", { limit: 100 }],
    queryFn: () => fetch("/api/jobs?limit=100").then(r => r.json()),
    enabled: open,
  });

  const jobs: Job[] = (jobsData as any)?.data || [];

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!call || !selectedJobId) throw new Error("Missing data");
      const res = await apiRequest("POST", `/api/call-records/${call.id}/link-job`, {
        jobId: selectedJobId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-records/unlinked"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      onClose();
      setSelectedJobId("");
    },
    onError: () => {
      toast({ title: "Failed to link call", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSelectedJobId(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Call to Job</DialogTitle>
          <DialogDescription>
            Select the job this call from {call?.callerName || call?.fromNumber} belongs to.
          </DialogDescription>
        </DialogHeader>

        {call?.transcriptionSummary && (
          <div className="p-3 bg-muted rounded text-sm text-muted-foreground">
            <strong className="text-foreground">Call summary:</strong> {call.transcriptionSummary}
          </div>
        )}

        <div className="space-y-4">
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger>
              <SelectValue placeholder={jobsLoading ? "Loading jobs…" : "Select a job"} />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  #{job.jobNumber} — {job.customerName || "Unknown"} — {job.address || "No address"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { onClose(); setSelectedJobId(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => linkMutation.mutate()}
              disabled={!selectedJobId || linkMutation.isPending}
            >
              {linkMutation.isPending ? "Linking…" : "Link to Job"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateJobDialog({
  call,
  open,
  onClose,
}: {
  call: CallRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  // Reset form fields whenever a new call is opened
  useEffect(() => {
    if (open && call) {
      setTitle(
        call.transcriptionSummary
          ? call.transcriptionSummary.substring(0, 80)
          : call.callerName
          ? `Call from ${call.callerName}`
          : "New job from inbound call"
      );
      setAddress("");
      setDescription(
        call.transcriptionSummary ? `Customer called: ${call.transcriptionSummary}` : ""
      );
    }
  }, [call?.id, open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!call) throw new Error("No call selected");

      // Create the job
      const jobRes = await apiRequest("POST", "/api/jobs", {
        title: title.trim() || (call.callerName ? `Call from ${call.callerName}` : "New job from inbound call"),
        address: address.trim() || undefined,
        description: description.trim() || undefined,
        status: "enquiry",
        source: "phone",
        phoneNumber: call.fromNumber,
        contactName: call.callerName || undefined,
      });
      const jobData = await jobRes.json();
      const newJobId: string = jobData?.data?.id || jobData?.id;

      if (!newJobId) throw new Error("Job creation failed");

      // Link the call record to the new job
      await apiRequest("POST", `/api/call-records/${call.id}/link-job`, {
        jobId: newJobId,
      });

      return newJobId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/call-records/unlinked"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to create job", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Job from Call</DialogTitle>
          <DialogDescription>
            A new job will be created and this call recording will be linked to it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="p-3 bg-muted rounded text-sm">
            <span className="text-muted-foreground">Caller: </span>
            <span className="font-medium">{call?.callerName || call?.fromNumber}</span>
            {call?.callerName && (
              <span className="text-muted-foreground ml-1">({call.fromNumber})</span>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="job-title">Job title</Label>
            <Input
              id="job-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tree removal — 12 Main St"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="job-address">Address</Label>
            <Input
              id="job-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Job site address"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="job-description">Notes</Label>
            <Textarea
              id="job-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Initial notes from the call"
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create Job"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UnlinkedCalls() {
  const [linkingCall, setLinkingCall] = useState<CallRecord | null>(null);
  const [creatingJobCall, setCreatingJobCall] = useState<CallRecord | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/call-records/unlinked"],
  });

  const calls: CallRecord[] = (data as any)?.data || [];

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
          <Phone className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Unlinked Calls</h1>
          <p className="text-sm text-muted-foreground">
            Inbound call recordings not yet matched to a job
          </p>
        </div>
        {calls.length > 0 && (
          <Badge variant="outline" className="ml-auto">
            {calls.length} unlinked
          </Badge>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-4 flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Failed to load unlinked calls</span>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && calls.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No unlinked calls</p>
            <p className="text-sm mt-1">
              All recorded calls have been linked to jobs, or no calls have been recorded yet.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading &&
        calls.map((call) => (
          <CallCard
            key={call.id}
            call={call}
            onLinkJob={(c) => setLinkingCall(c)}
            onCreateJob={(c) => setCreatingJobCall(c)}
          />
        ))}

      <LinkJobDialog
        call={linkingCall}
        open={!!linkingCall}
        onClose={() => setLinkingCall(null)}
      />

      <CreateJobDialog
        call={creatingJobCall}
        open={!!creatingJobCall}
        onClose={() => setCreatingJobCall(null)}
      />
    </div>
  );
}
