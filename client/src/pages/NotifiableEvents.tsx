import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle,
  Check,
  Clock,
  Plus,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { format, differenceInHours } from "date-fns";
import type { NotifiableEvent } from "@shared/schema";

const EVENT_TYPE_LABELS: Record<string, string> = {
  death: "Death",
  notifiable_injury: "Notifiable injury",
  notifiable_illness: "Notifiable illness",
  notifiable_incident: "Notifiable incident",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  notified: "Notified",
  investigating: "Investigating",
  closed: "Closed",
};

type EventType = NotifiableEvent["eventType"];

type Classification = {
  eventType: EventType;
  worksafeNotifiable: boolean;
  answers: Record<string, boolean>;
};

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "open") return "destructive";
  if (status === "closed") return "secondary";
  return "default";
}

// Converts a Date | string | null into the value a datetime-local input expects.
function toDateTimeLocal(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function DeadlineBanner({ event }: { event: NotifiableEvent }) {
  if (!event.worksafeNotifiable) return null;
  if (event.worksafeNotified) {
    return (
      <div className="rounded-md border border-border bg-muted/40 p-3 flex items-start gap-2">
        <Check className="h-5 w-5 shrink-0 text-green-600" />
        <div className="text-sm">
          <p className="font-medium">Notified to WorkSafe</p>
          {event.worksafeReference ? (
            <p className="text-muted-foreground">
              Reference: {event.worksafeReference}
            </p>
          ) : null}
          {event.worksafeNotifiedAt ? (
            <p className="text-muted-foreground">
              {format(new Date(event.worksafeNotifiedAt), "d MMM yyyy HH:mm")}
              {event.notificationMethod ? ` · ${event.notificationMethod}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const due = event.notifyDueBy ? new Date(event.notifyDueBy) : null;
  const hoursLeft = due ? differenceInHours(due, new Date()) : null;
  const overdue = hoursLeft !== null && hoursLeft < 0;

  return (
    <div
      className={`rounded-md border p-3 space-y-1 ${
        overdue
          ? "border-destructive bg-destructive/10"
          : "border-border bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <Clock
          className={`h-5 w-5 shrink-0 ${overdue ? "text-destructive" : ""}`}
        />
        <p
          className={`font-medium ${overdue ? "text-destructive" : ""}`}
        >
          48-hour WorkSafe notification deadline
        </p>
      </div>
      {due ? (
        <p className="text-sm text-muted-foreground">
          Due by {format(due, "d MMM yyyy HH:mm")}
        </p>
      ) : null}
      {hoursLeft !== null ? (
        <p
          className={`text-sm font-semibold ${
            overdue ? "text-destructive" : ""
          }`}
        >
          {overdue
            ? `Overdue by ${Math.abs(hoursLeft)} hour${
                Math.abs(hoursLeft) === 1 ? "" : "s"
              }`
            : `${hoursLeft} hour${hoursLeft === 1 ? "" : "s"} remaining`}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Notify online at worksafe.govt.nz or call 0800 030 040.
      </p>
    </div>
  );
}

function NotifyForm({
  event,
  onDone,
}: {
  event: NotifiableEvent;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [method, setMethod] = useState<"online" | "phone">("online");
  const [reference, setReference] = useState("");
  const [notifiedAt, setNotifiedAt] = useState(toDateTimeLocal(new Date()));

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/notifiable-events/${event.id}/notify`,
        {
          notificationMethod: method,
          worksafeReference: reference || undefined,
          worksafeNotifiedAt: notifiedAt
            ? new Date(notifiedAt).toISOString()
            : undefined,
        },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifiable-events"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/notifiable-events/${event.id}`],
      });
      onDone();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not mark as notified",
        description: error.message,
      });
    },
  });

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="font-medium">Mark as notified</p>
      <div className="space-y-2">
        <Label>Notification method</Label>
        <Select
          value={method}
          onValueChange={(v) => setMethod(v as "online" | "phone")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="online">Online (worksafe.govt.nz)</SelectItem>
            <SelectItem value="phone">Phone (0800 030 040)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="worksafe-ref">WorkSafe reference (optional)</Label>
        <Input
          id="worksafe-ref"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notified-at">Notified at</Label>
        <Input
          id="notified-at"
          type="datetime-local"
          value={notifiedAt}
          onChange={(e) => setNotifiedAt(e.target.value)}
        />
      </div>
      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        Confirm notification
      </Button>
    </div>
  );
}

function ClassifierWizard({
  onClassified,
}: {
  onClassified: (c: Classification) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({
    death: undefined,
    injury: undefined,
    incident: undefined,
  });

  const answer = (key: string, value: boolean) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);

    if (key === "death" && value) {
      onClassified({
        eventType: "death",
        worksafeNotifiable: true,
        answers: { death: true },
      });
      return;
    }
    if (key === "injury" && value) {
      onClassified({
        eventType: "notifiable_injury",
        worksafeNotifiable: true,
        answers: { death: false, injury: true },
      });
      return;
    }
    if (key === "incident" && value) {
      onClassified({
        eventType: "notifiable_incident",
        worksafeNotifiable: true,
        answers: { death: false, injury: false, incident: true },
      });
      return;
    }
    // "incident" answered no, and all prior answered no → non-notifiable record.
    if (key === "incident" && !value) {
      onClassified({
        eventType: "notifiable_incident",
        worksafeNotifiable: false,
        answers: { death: false, injury: false, incident: false },
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border border-border rounded-lg">
        <CardContent className="p-4 space-y-2">
          <p className="font-medium">Did the event result in a death?</p>
          <div className="flex gap-2">
            <Button
              variant={answers.death === true ? "default" : "outline"}
              onClick={() => answer("death", true)}
            >
              Yes
            </Button>
            <Button
              variant={answers.death === false ? "default" : "outline"}
              onClick={() => answer("death", false)}
            >
              No
            </Button>
          </div>
        </CardContent>
      </Card>

      {answers.death === false ? (
        <Card className="bg-card border border-border rounded-lg">
          <CardContent className="p-4 space-y-2">
            <p className="font-medium">
              Did it cause a notifiable injury or illness?
            </p>
            <p className="text-sm text-muted-foreground">
              For example: amputation; serious head or spinal injury; serious
              burns; loss of consciousness; any injury needing immediate
              hospital in-patient treatment.
            </p>
            <div className="flex gap-2">
              <Button
                variant={answers.injury === true ? "default" : "outline"}
                onClick={() => answer("injury", true)}
              >
                Yes
              </Button>
              <Button
                variant={answers.injury === false ? "default" : "outline"}
                onClick={() => answer("injury", false)}
              >
                No
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {answers.death === false && answers.injury === false ? (
        <Card className="bg-card border border-border rounded-lg">
          <CardContent className="p-4 space-y-2">
            <p className="font-medium">
              Was it a notifiable incident / serious near-miss?
            </p>
            <p className="text-sm text-muted-foreground">
              For example: uncontrolled fall from height; electric shock /
              contact with a live conductor; dangerous escape of a substance;
              structure or plant collapse.
            </p>
            <div className="flex gap-2">
              <Button
                variant={answers.incident === true ? "default" : "outline"}
                onClick={() => answer("incident", true)}
              >
                Yes
              </Button>
              <Button
                variant={answers.incident === false ? "default" : "outline"}
                onClick={() => answer("incident", false)}
              >
                No
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-sm text-muted-foreground">
        This is guidance to help you decide, not legal advice. If in doubt,
        notify WorkSafe.
      </p>
    </div>
  );
}

function EventForm({
  classification,
  onDone,
}: {
  classification: Classification;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [occurredAt, setOccurredAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [immediateActions, setImmediateActions] = useState("");
  const [scenePreserved, setScenePreserved] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifiable-events", {
        eventType: classification.eventType,
        classification: classification.answers,
        occurredAt: new Date(occurredAt).toISOString(),
        location: location || undefined,
        description,
        immediateActions: immediateActions || undefined,
        worksafeNotifiable: classification.worksafeNotifiable,
        scenePreserved,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifiable-events"] });
      onDone();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not record event",
        description: error.message,
      });
    },
  });

  const canSave = occurredAt && description.trim().length > 0;

  return (
    <div className="space-y-4">
      <div
        className={`rounded-md border p-3 flex items-start gap-2 ${
          classification.worksafeNotifiable
            ? "border-destructive bg-destructive/10"
            : "border-border bg-muted/40"
        }`}
      >
        {classification.worksafeNotifiable ? (
          <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
        ) : (
          <Check className="h-5 w-5 shrink-0" />
        )}
        <div className="text-sm">
          <p className="font-medium">
            {EVENT_TYPE_LABELS[classification.eventType]}
          </p>
          <p
            className={
              classification.worksafeNotifiable
                ? "text-destructive font-semibold"
                : "text-muted-foreground"
            }
          >
            {classification.worksafeNotifiable
              ? "Notifiable to WorkSafe — record and notify within 48 hours."
              : "Not notifiable to WorkSafe — recorded for your own records."}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="occurred-at">When did it occur?</Label>
        <Input
          id="occurred-at"
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="immediate-actions">Immediate actions taken</Label>
        <Textarea
          id="immediate-actions"
          value={immediateActions}
          onChange={(e) => setImmediateActions(e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <Checkbox
            id="scene-preserved"
            checked={scenePreserved}
            onCheckedChange={(v) => setScenePreserved(v === true)}
          />
          <Label htmlFor="scene-preserved" className="font-normal">
            Scene preserved
          </Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Do not disturb the site until WorkSafe allows — except to help an
          injured person, make the site safe, or as directed by WorkSafe.
        </p>
      </div>

      <DialogFooter>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!canSave || mutation.isPending}
        >
          Save event
        </Button>
      </DialogFooter>
    </div>
  );
}

function RecordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [classification, setClassification] = useState<Classification | null>(
    null,
  );

  const reset = () => setClassification(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record an event</DialogTitle>
          <DialogDescription>
            {classification
              ? "Enter the event details."
              : "Answer a few questions to classify the event."}
          </DialogDescription>
        </DialogHeader>
        {classification ? (
          <EventForm
            classification={classification}
            onDone={() => {
              reset();
              onOpenChange(false);
            }}
          />
        ) : (
          <ClassifierWizard onClassified={setClassification} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data } = useQuery<{ success: boolean; data: NotifiableEvent }>({
    queryKey: [`/api/notifiable-events/${eventId}`],
  });
  const event = data?.data;

  const [findings, setFindings] = useState<string | null>(null);
  const [rootCause, setRootCause] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/notifiable-events/${eventId}`, {
        investigationFindings:
          findings ?? event?.investigationFindings ?? undefined,
        rootCause: rootCause ?? event?.rootCause ?? undefined,
        status: status ?? event?.status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifiable-events"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/notifiable-events/${eventId}`],
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not update event",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "DELETE",
        `/api/notifiable-events/${eventId}`,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifiable-events"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not delete event",
        description: error.message,
      });
    },
  });

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {!event ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {event.eventNumber}
                <Badge variant={statusVariant(event.status)}>
                  {STATUS_LABELS[event.status] ?? event.status}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
              </DialogDescription>
            </DialogHeader>

            <DeadlineBanner event={event} />

            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Occurred:</span>{" "}
                {format(new Date(event.occurredAt), "d MMM yyyy HH:mm")}
              </p>
              {event.location ? (
                <p>
                  <span className="font-medium">Location:</span>{" "}
                  {event.location}
                </p>
              ) : null}
              <p>
                <span className="font-medium">Description:</span>{" "}
                {event.description}
              </p>
              {event.immediateActions ? (
                <p>
                  <span className="font-medium">Immediate actions:</span>{" "}
                  {event.immediateActions}
                </p>
              ) : null}
              <p>
                <span className="font-medium">Scene preserved:</span>{" "}
                {event.scenePreserved ? "Yes" : "No"}
              </p>
              {event.retentionUntil ? (
                <p className="text-muted-foreground">
                  Retain until{" "}
                  {format(new Date(event.retentionUntil), "d MMM yyyy")}
                </p>
              ) : null}
            </div>

            {event.worksafeNotifiable && !event.worksafeNotified ? (
              <NotifyForm event={event} onDone={() => {}} />
            ) : null}

            <Card className="bg-card border border-border rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">Investigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="findings">Investigation findings</Label>
                  <Textarea
                    id="findings"
                    rows={3}
                    value={findings ?? event.investigationFindings ?? ""}
                    onChange={(e) => setFindings(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="root-cause">Root cause</Label>
                  <Textarea
                    id="root-cause"
                    rows={2}
                    value={rootCause ?? event.rootCause ?? ""}
                    onChange={(e) => setRootCause(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={status ?? event.status}
                    onValueChange={setStatus}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="notified">Notified</SelectItem>
                      <SelectItem value="investigating">
                        Investigating
                      </SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                >
                  Save investigation
                </Button>
              </CardContent>
            </Card>

            {!event.worksafeNotified ? (
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete event
                </Button>
              </DialogFooter>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function NotifiableEvents() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const listUrl =
    statusFilter === "all"
      ? "/api/notifiable-events"
      : `/api/notifiable-events?status=${statusFilter}`;

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: NotifiableEvent[];
  }>({
    queryKey: [listUrl],
  });

  const events = data?.data ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notifiable Events</h1>
        <Button onClick={() => setRecordOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Record an event
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Classify workplace events under WorkSafe NZ rules. Notifiable events
        must be reported within 48 hours and records kept for 5 years. Notify
        online at worksafe.govt.nz or call 0800 030 040.
      </p>

      <div className="w-full sm:w-56">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="notified">Notified</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <Card className="bg-card border border-border rounded-lg">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No events recorded.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <Card
              key={event.id}
              className="bg-card border border-border rounded-lg cursor-pointer"
              onClick={() => setSelectedId(event.id)}
            >
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{event.eventNumber}</span>
                    <span className="text-sm text-muted-foreground">
                      {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(event.occurredAt), "d MMM yyyy HH:mm")}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {event.worksafeNotifiable ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Notifiable
                    </Badge>
                  ) : null}
                  {event.worksafeNotified ? (
                    <Badge variant="secondary">
                      <Check className="h-3 w-3 mr-1" />
                      Notified
                    </Badge>
                  ) : null}
                  <Badge variant={statusVariant(event.status)}>
                    {STATUS_LABELS[event.status] ?? event.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RecordDialog open={recordOpen} onOpenChange={setRecordOpen} />

      {selectedId ? (
        <DetailDialog
          eventId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
