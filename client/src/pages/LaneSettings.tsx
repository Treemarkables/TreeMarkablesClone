import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, ChevronUp, ChevronDown, Zap, X } from "lucide-react";

interface Lane {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  archived: boolean;
}

interface LaneAutomation {
  id: string;
  laneId: string;
  type: "customer_nudge" | "staff_reminder" | "auto_move" | "create_task";
  trigger: "days_in_lane" | "on_enter" | "status_changed";
  triggerDays: number | null;
  enabled: boolean;
  config: Record<string, any>;
}

// A small fixed palette so lanes stay visually distinct without a full colour picker.
const LANE_COLORS = [
  "#64748b", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#0ea5e9",
];

const TYPE_LABELS: Record<LaneAutomation["type"], string> = {
  customer_nudge: "Nudge the customer",
  staff_reminder: "Remind staff",
  auto_move: "Move to another lane",
  create_task: "Create a task",
};

const TRIGGER_LABELS: Record<LaneAutomation["trigger"], string> = {
  days_in_lane: "After N days in the lane",
  on_enter: "As soon as it enters the lane",
  status_changed: "When the job's status changes",
};

export default function LaneSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newLaneName, setNewLaneName] = useState("");
  const [newLaneColor, setNewLaneColor] = useState(LANE_COLORS[6]);
  const [expandedLaneId, setExpandedLaneId] = useState<string | null>(null);

  const fail = (description: string) => toast({ title: "Error", description, variant: "destructive" });
  const invalidateLanes = () => queryClient.invalidateQueries({ queryKey: ["/api/lanes/all"] });

  const { data: lanes = [], isLoading } = useQuery<Lane[]>({
    queryKey: ["/api/lanes/all"],
    queryFn: async () => {
      const res = await fetch("/api/lanes?includeArchived=true");
      if (!res.ok) throw new Error("Failed to load lanes");
      return (await res.json()).data as Lane[];
    },
  });

  const createLane = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/lanes", {
      name: newLaneName.trim(), color: newLaneColor, sortOrder: lanes.length,
    }),
    onSuccess: () => { setNewLaneName(""); invalidateLanes(); },
    onError: () => fail("Could not create the lane"),
  });

  const updateLane = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lane> }) =>
      apiRequest("PATCH", `/api/lanes/${id}`, updates),
    onSuccess: invalidateLanes,
    onError: () => fail("Could not update the lane"),
  });

  const deleteLane = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/lanes/${id}`),
    onSuccess: invalidateLanes,
    onError: () => fail("Could not delete the lane"),
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => apiRequest("POST", "/api/lanes/reorder", { orderedIds }),
    onSuccess: invalidateLanes,
    onError: () => fail("Could not reorder lanes"),
  });

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= lanes.length) return;
    const ids = lanes.map((l) => l.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lanes</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Group jobs into your own buckets — like "Thinking it over" — on top of their normal status,
          and let each lane run automations.
        </p>
      </div>

      {/* Create */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a lane</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="new-lane-name">Name</Label>
            <Input
              id="new-lane-name"
              placeholder="e.g. Thinking it over"
              value={newLaneName}
              onChange={(e) => setNewLaneName(e.target.value)}
              data-testid="input-new-lane-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <ColorPicker value={newLaneColor} onChange={setNewLaneColor} />
          </div>
          <Button
            onClick={() => createLane.mutate()}
            disabled={!newLaneName.trim() || createLane.isPending}
            data-testid="button-add-lane"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add lane
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading lanes…</p>
      ) : lanes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No lanes yet. Add your first one above.</p>
      ) : (
        <div className="space-y-3">
          {lanes.map((lane, index) => (
            <Card key={lane.id} className={lane.archived ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <Button variant="ghost" size="icon" className="h-5 w-6" onClick={() => move(index, -1)}
                      disabled={index === 0} data-testid={`button-lane-up-${lane.id}`}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-6" onClick={() => move(index, 1)}
                      disabled={index === lanes.length - 1} data-testid={`button-lane-down-${lane.id}`}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <ColorPicker value={lane.color} onChange={(color) => updateLane.mutate({ id: lane.id, updates: { color } })} />
                  <Input
                    defaultValue={lane.name}
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name && name !== lane.name) updateLane.mutate({ id: lane.id, updates: { name } });
                    }}
                    className="flex-1"
                    data-testid={`input-lane-name-${lane.id}`}
                  />
                  {lane.archived && <Badge variant="secondary">Archived</Badge>}
                  <Button variant="ghost" size="sm"
                    onClick={() => updateLane.mutate({ id: lane.id, updates: { archived: !lane.archived } })}
                    data-testid={`button-lane-archive-${lane.id}`}>
                    {lane.archived ? "Restore" : "Archive"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-lane-delete-${lane.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{lane.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Jobs in this lane will simply leave it (their status is unaffected). The lane's
                          automations will be removed. This can't be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteLane.mutate(lane.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div>
                  <Button variant="outline" size="sm"
                    onClick={() => setExpandedLaneId(expandedLaneId === lane.id ? null : lane.id)}
                    data-testid={`button-lane-automations-${lane.id}`}>
                    <Zap className="h-3.5 w-3.5 mr-2" />
                    Automations
                  </Button>
                </div>

                {expandedLaneId === lane.id && (
                  <LaneAutomationsEditor laneId={lane.id} lanes={lanes} onError={fail} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {LANE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Colour ${c}`}
          onClick={() => onChange(c)}
          className={`h-5 w-5 rounded-full border-2 ${value === c ? "border-foreground" : "border-transparent"}`}
          style={{ backgroundColor: c }}
          data-testid={`color-${c}`}
        />
      ))}
    </div>
  );
}

function LaneAutomationsEditor({
  laneId, lanes, onError,
}: { laneId: string; lanes: Lane[]; onError: (m: string) => void }) {
  const queryClient = useQueryClient();
  const key = ["/api/lanes", laneId, "automations"];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const { data: automations = [], isLoading } = useQuery<LaneAutomation[]>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/lanes/${laneId}/automations`);
      if (!res.ok) throw new Error("Failed to load automations");
      return (await res.json()).data as LaneAutomation[];
    },
  });

  const create = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/lanes/${laneId}/automations`, {
      type: "staff_reminder", trigger: "days_in_lane", triggerDays: 3, enabled: true,
      config: { recipients: "owner", message: "" },
    }),
    onSuccess: invalidate,
    onError: () => onError("Could not add the automation"),
  });

  const update = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LaneAutomation> }) =>
      apiRequest("PATCH", `/api/lane-automations/${id}`, updates),
    onSuccess: invalidate,
    onError: () => onError("Could not update the automation"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/lane-automations/${id}`),
    onSuccess: invalidate,
    onError: () => onError("Could not delete the automation"),
  });

  return (
    <div className="border-t pt-3 space-y-3">
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading automations…</p>
      ) : automations.length === 0 ? (
        <p className="text-muted-foreground text-sm">No automations on this lane yet.</p>
      ) : (
        automations.map((a) => (
          <AutomationRow
            key={a.id}
            automation={a}
            lanes={lanes}
            onChange={(updates) => update.mutate({ id: a.id, updates })}
            onDelete={() => remove.mutate(a.id)}
          />
        ))
      )}
      <Button variant="outline" size="sm" onClick={() => create.mutate()} disabled={create.isPending}
        data-testid={`button-add-automation-${laneId}`}>
        <Plus className="h-3.5 w-3.5 mr-2" />
        Add automation
      </Button>
    </div>
  );
}

function AutomationRow({
  automation, lanes, onChange, onDelete,
}: {
  automation: LaneAutomation;
  lanes: Lane[];
  onChange: (updates: Partial<LaneAutomation>) => void;
  onDelete: () => void;
}) {
  const cfg = automation.config || {};
  const setConfig = (patch: Record<string, any>) => onChange({ config: { ...cfg, ...patch } });

  // Staff list for the "specific people" picker — only fetched for staff reminders.
  const { data: employees = [] } = useQuery<Array<{ id: string; firstName?: string; lastName?: string }>>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to load staff");
      return (await res.json()).data;
    },
    enabled: automation.type === "staff_reminder",
  });

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3" data-testid={`automation-${automation.id}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Switch checked={automation.enabled} onCheckedChange={(enabled) => onChange({ enabled })}
          data-testid={`switch-automation-${automation.id}`} />
        <Select value={automation.type} onValueChange={(type) => onChange({ type: type as LaneAutomation["type"] })}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={automation.trigger} onValueChange={(trigger) => onChange({ trigger: trigger as LaneAutomation["trigger"] })}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TRIGGER_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {automation.trigger === "days_in_lane" && (
          <div className="flex items-center gap-1.5">
            <Input type="number" min={0} className="w-20"
              value={automation.triggerDays ?? 0}
              onChange={(e) => onChange({ triggerDays: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              data-testid={`input-days-${automation.id}`} />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        )}
        <Button variant="ghost" size="icon" className="ml-auto" onClick={onDelete}
          data-testid={`button-delete-automation-${automation.id}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Cadence: repeat the days_in_lane automation until the job leaves the lane */}
      {automation.trigger === "days_in_lane" && (
        <div className="flex items-center gap-2 flex-wrap pl-1">
          <Switch checked={!!cfg.repeat} onCheckedChange={(repeat) => setConfig({ repeat })}
            data-testid={`switch-repeat-${automation.id}`} />
          <span className="text-xs text-muted-foreground">Keep reminding</span>
          {cfg.repeat && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">every</span>
              <Input type="number" min={1} className="w-16 h-8"
                value={cfg.repeatEveryDays ?? 1}
                onChange={(e) => setConfig({ repeatEveryDays: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                data-testid={`input-repeat-days-${automation.id}`} />
              <span className="text-xs text-muted-foreground">days until it leaves the lane</span>
            </div>
          )}
        </div>
      )}

      {/* Type-specific config */}
      {automation.type === "customer_nudge" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Label className="text-xs w-16">Channel</Label>
            <Select value={cfg.channel || "sms"} onValueChange={(channel) => setConfig({ channel })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 ml-2">
              <Switch checked={!!cfg.requireApproval} onCheckedChange={(requireApproval) => setConfig({ requireApproval })} />
              <span className="text-xs text-muted-foreground">Hold for my approval before sending</span>
            </div>
          </div>
          <Textarea
            placeholder="Message to the customer. Use {firstName}, {jobNumber} as placeholders."
            value={cfg.template || ""}
            onChange={(e) => setConfig({ template: e.target.value })}
            rows={2}
            data-testid={`textarea-nudge-${automation.id}`}
          />
        </div>
      )}

      {automation.type === "staff_reminder" && (
        <div className="space-y-3">
          <div className="flex items-center gap-5 flex-wrap">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={cfg.notifyOwner ?? (cfg.recipients === "owner" || cfg.recipients === "both")}
                onCheckedChange={(notifyOwner) => setConfig({ notifyOwner })} />
              Owner / admins
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={cfg.notifyAssigned ?? (cfg.recipients === "assigned" || cfg.recipients === "both")}
                onCheckedChange={(notifyAssigned) => setConfig({ notifyAssigned })} />
              Assigned staff
            </label>
          </div>

          {/* Specific team members — tap to toggle */}
          {employees.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Specific people</Label>
              <div className="flex flex-wrap gap-1.5">
                {employees.map((e) => {
                  const name = [e.firstName, e.lastName].filter(Boolean).join(" ") || e.id;
                  const selected = ((cfg.staffIds as string[]) || []).includes(e.id);
                  return (
                    <button key={e.id} type="button"
                      onClick={() => {
                        const cur: string[] = (cfg.staffIds as string[]) || [];
                        setConfig({ staffIds: selected ? cur.filter((x) => x !== e.id) : [...cur, e.id] });
                      }}
                      className={`text-xs rounded-full border px-2.5 py-1 ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                      data-testid={`staff-chip-${automation.id}-${e.id}`}>
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <TokenList label="Email anyone (one address per add)" placeholder="name@email.com"
            values={(cfg.emails as string[]) || []} onChange={(emails) => setConfig({ emails })} />
          <TokenList label="Text anyone (mobile number)" placeholder="021 234 5678"
            values={(cfg.phones as string[]) || []} onChange={(phones) => setConfig({ phones })} />

          <Textarea
            placeholder="Reminder message (optional)."
            value={cfg.message || ""}
            onChange={(e) => setConfig({ message: e.target.value })}
            rows={2}
            data-testid={`textarea-reminder-${automation.id}`}
          />
        </div>
      )}

      {automation.type === "auto_move" && (
        <div className="flex items-center gap-3">
          <Label className="text-xs w-20">Move to</Label>
          <Select value={cfg.targetLaneId || ""} onValueChange={(targetLaneId) => setConfig({ targetLaneId })}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Choose a lane" /></SelectTrigger>
            <SelectContent>
              {lanes.filter((l) => l.id !== automation.laneId && !l.archived).map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {automation.type === "create_task" && (
        <div className="space-y-2">
          <Input
            placeholder="Task title (e.g. Call to confirm decision)"
            value={cfg.title || ""}
            onChange={(e) => setConfig({ title: e.target.value })}
            data-testid={`input-task-title-${automation.id}`}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs">Due in</Label>
            <Input type="number" min={0} className="w-20"
              value={cfg.dueInDays ?? 0}
              onChange={(e) => setConfig({ dueInDays: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
            <span className="text-xs text-muted-foreground">days (0 = no due date)</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Add/remove list of free-text tokens (emails or phone numbers). Enter or "Add" commits.
function TokenList({ label, placeholder, values, onChange }: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input value={draft} placeholder={placeholder} className="h-8 text-xs"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button type="button" variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="text-xs rounded-full border bg-background px-2 py-0.5 flex items-center gap-1">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
