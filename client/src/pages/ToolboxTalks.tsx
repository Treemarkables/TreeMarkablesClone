import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Check, Trash2, Users, MapPin, CheckCircle2, Lock, Pencil, Settings2 } from "lucide-react";
import { format } from "date-fns";
import type { ToolboxTalk, ToolboxTalkTopic, ToolboxTalkAttendee } from "@shared/schema";
import SignaturePad from "@/components/SignaturePad";

// The list endpoint may include an attendee count alongside each talk.
type ToolboxTalkListItem = ToolboxTalk & { attendeeCount?: number };

// The detail endpoint extends a talk with its attendees.
type ToolboxTalkDetail = ToolboxTalk & { attendees: ToolboxTalkAttendee[] };

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

function todayISODate(): string {
  // yyyy-MM-dd for the native date input default.
  return format(new Date(), "yyyy-MM-dd");
}

function splitTalkingPoints(talkingPoints: string | null): string[] {
  if (!talkingPoints) return [];
  return talkingPoints
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export default function ToolboxTalks() {
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [selectedTalkId, setSelectedTalkId] = useState<string | null>(null);

  const talksQuery = useQuery<ApiResponse<ToolboxTalkListItem[]>>({
    queryKey: ["/api/toolbox-talks"],
  });

  const topicsQuery = useQuery<ApiResponse<ToolboxTalkTopic[]>>({
    queryKey: ["/api/toolbox-talk-topics"],
  });

  const talks = talksQuery.data?.data ?? [];
  const topics = topicsQuery.data?.data ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Toolbox Talks</h1>
          <p className="text-sm text-muted-foreground">
            Run and record on-site safety talks, capture who attended, and collect sign-off.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setTopicsOpen(true)}
            data-testid="button-manage-topics"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Topics
          </Button>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-new-talk">
            <Plus className="mr-2 h-4 w-4" />
            New toolbox talk
          </Button>
        </div>
      </div>

      {talksQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading toolbox talks...</p>
      ) : talks.length === 0 ? (
        <Card className="bg-card border border-border rounded-lg">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No toolbox talks yet. Tap "New toolbox talk" to run your first one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {talks.map((talk) => (
            <Card
              key={talk.id}
              className="bg-card border border-border rounded-lg cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => setSelectedTalkId(talk.id)}
              data-testid={`card-talk-${talk.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">
                        {talk.talkNumber}
                      </span>
                      <StatusBadge status={talk.status} />
                    </div>
                    <p className="font-semibold truncate">{talk.title}</p>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                      <span>{format(new Date(talk.conductedAt), "d MMM yyyy")}</span>
                      {talk.location ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {talk.location}
                        </span>
                      ) : null}
                      {typeof talk.attendeeCount === "number" ? (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {talk.attendeeCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTalkDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        topics={topics}
        onError={(title, description) =>
          toast({ variant: "destructive", title, description })
        }
      />

      <TalkDetailDialog
        talkId={selectedTalkId}
        onClose={() => setSelectedTalkId(null)}
        topics={topics}
        onError={(title, description) =>
          toast({ variant: "destructive", title, description })
        }
      />

      <TopicManagerDialog
        open={topicsOpen}
        onClose={() => setTopicsOpen(false)}
        topics={topics}
        onError={(title, description) =>
          toast({ variant: "destructive", title, description })
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Topic manager: built-in topics are read-only; custom topics belong to the
// business and are fully editable.
// ---------------------------------------------------------------------------
interface TopicDraft {
  title: string;
  category: string;
  talkingPoints: string;
}

function emptyTopicDraft(): TopicDraft {
  return { title: "", category: "", talkingPoints: "" };
}

function TopicManagerDialog({
  open,
  onClose,
  topics,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  topics: ToolboxTalkTopic[];
  onError: (title: string, description: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<TopicDraft>(emptyTopicDraft());

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/toolbox-talk-topics"] });

  const fail = (title: string) => (error: unknown) =>
    onError(title, error instanceof Error ? error.message : "Please try again.");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: draft.title.trim(),
        category: draft.category.trim() || undefined,
        talkingPoints: draft.talkingPoints.trim() || undefined,
      };
      const res =
        editingId === "new"
          ? await apiRequest("POST", "/api/toolbox-talk-topics", body)
          : await apiRequest("PUT", `/api/toolbox-talk-topics/${editingId}`, body);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
    onError: fail("Could not save topic"),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/toolbox-talk-topics/${id}`);
      return res.json();
    },
    onSuccess: invalidate,
    onError: fail("Could not remove topic"),
  });

  const beginEdit = (topic: ToolboxTalkTopic) => {
    setDraft({
      title: topic.title,
      category: topic.category ?? "",
      talkingPoints: topic.talkingPoints ?? "",
    });
    setEditingId(topic.id);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setEditingId(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {editingId ? (
          <>
            <DialogHeader>
              <DialogTitle>{editingId === "new" ? "New topic" : "Edit topic"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="e.g. Ladder safety"
                  data-testid="input-topic-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  placeholder="Optional grouping, e.g. Equipment"
                  data-testid="input-topic-category"
                />
              </div>
              <div className="space-y-2">
                <Label>Talking points (one per line)</Label>
                <Textarea
                  value={draft.talkingPoints}
                  onChange={(e) => setDraft({ ...draft, talkingPoints: e.target.value })}
                  rows={6}
                  data-testid="input-topic-points"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditingId(null)} data-testid="button-topic-cancel">
                Cancel
              </Button>
              <Button
                disabled={!draft.title.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                data-testid="button-topic-save"
              >
                Save topic
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Talk topics</DialogTitle>
              <DialogDescription>
                Built-in topics are read-only. Add your own topics for the talks your crew
                actually runs.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3"
                  data-testid={`row-topic-${topic.id}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{topic.title}</span>
                      {topic.isBuiltIn && (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Built-in
                        </Badge>
                      )}
                    </div>
                    {topic.category && (
                      <p className="text-xs text-muted-foreground">{topic.category}</p>
                    )}
                  </div>
                  {!topic.isBuiltIn && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => beginEdit(topic)}
                        aria-label={`Edit ${topic.title}`}
                        data-testid={`button-topic-edit-${topic.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeMutation.mutate(topic.id)}
                        disabled={removeMutation.isPending}
                        aria-label={`Remove ${topic.title}`}
                        data-testid={`button-topic-remove-${topic.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {topics.length === 0 && (
                <p className="text-sm text-muted-foreground">No topics yet.</p>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  setDraft(emptyTopicDraft());
                  setEditingId("new");
                }}
                data-testid="button-topic-new"
              >
                <Plus className="mr-2 h-4 w-4" />
                New topic
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-600" data-testid="badge-status">
        Completed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" data-testid="badge-status">
      Draft
    </Badge>
  );
}

interface CreateTalkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: ToolboxTalkTopic[];
  onError: (title: string, description: string) => void;
}

function CreateTalkDialog({ open, onOpenChange, topics, onError }: CreateTalkDialogProps) {
  const [topicId, setTopicId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [presenterName, setPresenterName] = useState("");
  const [notes, setNotes] = useState("");

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === topicId) ?? null,
    [topics, topicId],
  );
  const talkingPoints = useMemo(
    () => splitTalkingPoints(selectedTopic?.talkingPoints ?? null),
    [selectedTopic],
  );

  function resetForm() {
    setTopicId("");
    setTitle("");
    setLocation("");
    setDate(todayISODate());
    setPresenterName("");
    setNotes("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  function handleTopicChange(value: string) {
    setTopicId(value);
    const topic = topics.find((t) => t.id === value);
    if (topic && !title.trim()) {
      setTitle(topic.title);
    } else if (topic) {
      setTitle(topic.title);
    }
  }

  const createMutation = useMutation({
    mutationFn: async (status: "draft" | "completed") => {
      const conductedAt = date ? new Date(date).toISOString() : undefined;
      const res = await apiRequest("POST", "/api/toolbox-talks", {
        topicId: topicId || undefined,
        title: title.trim(),
        location: location.trim() || undefined,
        presenterName: presenterName.trim() || undefined,
        conductedAt,
        notes: notes.trim() || undefined,
        status,
      });
      return (await res.json()) as ApiResponse<ToolboxTalk>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/toolbox-talks"] });
      handleOpenChange(false);
    },
    onError: (error: Error) => {
      onError("Could not save toolbox talk", error.message);
    },
  });

  const canSave = title.trim().length > 0 && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New toolbox talk</DialogTitle>
          <DialogDescription>
            Pick a topic to load talking points, then record the details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Topic</Label>
            <Select value={topicId} onValueChange={handleTopicChange}>
              <SelectTrigger data-testid="select-topic">
                <SelectValue placeholder="Choose a topic (optional)" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.category ? `${topic.category} — ${topic.title}` : topic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {talkingPoints.length > 0 ? (
            <Card className="bg-card border border-border rounded-lg">
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-2">Talking points</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {talkingPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="talk-title">Title</Label>
            <Input
              id="talk-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Talk title"
              data-testid="input-title"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="talk-date">Date</Label>
              <Input
                id="talk-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="input-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="talk-location">Location</Label>
              <Input
                id="talk-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Job site / yard"
                data-testid="input-location"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="talk-presenter">Presenter name</Label>
            <Input
              id="talk-presenter"
              value={presenterName}
              onChange={(e) => setPresenterName(e.target.value)}
              placeholder="Who is running the talk"
              data-testid="input-presenter"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="talk-notes">Notes</Label>
            <Textarea
              id="talk-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Discussion notes, actions raised, hazards identified"
              rows={4}
              data-testid="input-notes"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            disabled={!canSave}
            onClick={() => createMutation.mutate("draft")}
            data-testid="button-save-draft"
          >
            Save as draft
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => createMutation.mutate("completed")}
            data-testid="button-save-completed"
          >
            Save as completed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TalkDetailDialogProps {
  talkId: string | null;
  onClose: () => void;
  topics: ToolboxTalkTopic[];
  onError: (title: string, description: string) => void;
}

function TalkDetailDialog({ talkId, onClose, topics, onError }: TalkDetailDialogProps) {
  const [attendeeName, setAttendeeName] = useState("");

  const detailQuery = useQuery<ApiResponse<ToolboxTalkDetail>>({
    queryKey: ["/api/toolbox-talks", talkId],
    enabled: !!talkId,
  });

  const talk = detailQuery.data?.data;
  const topic = useMemo(
    () => (talk?.topicId ? topics.find((t) => t.id === talk.topicId) ?? null : null),
    [topics, talk?.topicId],
  );
  const talkingPoints = useMemo(
    () => splitTalkingPoints(topic?.talkingPoints ?? null),
    [topic],
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/toolbox-talks"] });
  }

  const addAttendeeMutation = useMutation({
    mutationFn: async ({ name, signatureDataUrl }: { name: string; signatureDataUrl?: string }) => {
      if (!talkId) throw new Error("No talk selected");
      const res = await apiRequest("POST", `/api/toolbox-talks/${talkId}/attendees`, {
        name: name.trim(),
        signatureDataUrl,
      });
      return await res.json();
    },
    onSuccess: () => {
      setAttendeeName("");
      invalidate();
    },
    onError: (error: Error) => {
      onError("Could not add attendee", error.message);
    },
  });

  const removeAttendeeMutation = useMutation({
    mutationFn: async (attendeeId: string) => {
      const res = await apiRequest("DELETE", `/api/toolbox-talk-attendees/${attendeeId}`);
      return res;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (error: Error) => {
      onError("Could not remove attendee", error.message);
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!talkId) throw new Error("No talk selected");
      const res = await apiRequest("PUT", `/api/toolbox-talks/${talkId}`, {
        status: "completed",
      });
      return await res.json();
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (error: Error) => {
      onError("Could not update toolbox talk", error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!talkId) throw new Error("No talk selected");
      const res = await apiRequest("DELETE", `/api/toolbox-talks/${talkId}`);
      return res;
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (error: Error) => {
      onError("Could not delete toolbox talk", error.message);
    },
  });

  const attendees = talk?.attendees ?? [];

  return (
    <Dialog open={!!talkId} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {detailQuery.isLoading || !talk ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading toolbox talk...
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">
                  {talk.talkNumber}
                </span>
                <StatusBadge status={talk.status} />
              </div>
              <DialogTitle>{talk.title}</DialogTitle>
              <DialogDescription>
                {format(new Date(talk.conductedAt), "d MMM yyyy")}
                {talk.location ? ` · ${talk.location}` : ""}
                {talk.presenterName ? ` · ${talk.presenterName}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {talkingPoints.length > 0 ? (
                <Card className="bg-card border border-border rounded-lg">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium mb-2">Talking points</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                      {talkingPoints.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}

              {talk.notes ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {talk.notes}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <p className="text-sm font-medium">Attendees ({attendees.length})</p>
                </div>

                {attendees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No attendees recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {attendees.map((attendee) => (
                      <div
                        key={attendee.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
                        data-testid={`row-attendee-${attendee.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {attendee.signedAt || attendee.signatureDataUrl ? (
                            <Check className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <span className="h-4 w-4 shrink-0" />
                          )}
                          <span className="text-sm truncate">{attendee.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAttendeeMutation.mutate(attendee.id)}
                          disabled={removeAttendeeMutation.isPending}
                          aria-label="Remove attendee"
                          data-testid={`button-remove-attendee-${attendee.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Card className="bg-card border border-border rounded-lg">
                  <CardContent className="p-4 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="attendee-name">Add attendee</Label>
                      <Input
                        id="attendee-name"
                        value={attendeeName}
                        onChange={(e) => setAttendeeName(e.target.value)}
                        placeholder="Crew member name"
                        data-testid="input-attendee-name"
                      />
                    </div>

                    <SignaturePad
                      onSave={(signatureDataUrl) => {
                        if (!attendeeName.trim()) {
                          onError(
                            "Name required",
                            "Enter the attendee's name before saving their signature.",
                          );
                          return;
                        }
                        addAttendeeMutation.mutate({
                          name: attendeeName,
                          signatureDataUrl,
                        });
                      }}
                      disabled={addAttendeeMutation.isPending}
                    />

                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!attendeeName.trim() || addAttendeeMutation.isPending}
                      onClick={() => addAttendeeMutation.mutate({ name: attendeeName })}
                      data-testid="button-add-attendee-no-signature"
                    >
                      Add without signature
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              {talk.status === "draft" ? (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                  data-testid="button-delete-talk"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete draft
                </Button>
              ) : (
                <span />
              )}
              {talk.status === "draft" ? (
                <Button
                  disabled={completeMutation.isPending}
                  onClick={() => completeMutation.mutate()}
                  data-testid="button-mark-completed"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark completed
                </Button>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
