import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DndContext, DragEndEvent, DragStartEvent, closestCorners,
  PointerSensor, useSensor, useSensors, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings2 } from "lucide-react";

interface Lane { id: string; name: string; color: string; sortOrder: number; archived: boolean }
interface Job {
  id: string; jobNumber?: string | number; title?: string | null; status?: string | null;
  laneId?: string | null; laneEnteredAt?: string | null;
  jobContactFirstName?: string | null; jobContactLastName?: string | null;
}

const NO_LANE = "__none__";

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead", quote: "Quote", mulch: "Mulch", work_order: "Work order",
  completed: "Completed", unsuccessful: "Unsuccessful",
};

function daysInLane(enteredAt?: string | null): number | null {
  if (!enteredAt) return null;
  const ms = Date.now() - new Date(enteredAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function contactName(job: Job): string {
  return [job.jobContactFirstName, job.jobContactLastName].filter(Boolean).join(" ").trim();
}

export default function LanesBoard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: isMobile ? { distance: 50, tolerance: 5, delay: 250 } : { distance: 3 },
  }));

  const JOBS_KEY = "/api/jobs?limit=500&offset=0&excludeCompleted=true&excludeArchived=true";

  const { data: lanes = [] } = useQuery<Lane[]>({
    queryKey: ["/api/lanes"],
    queryFn: async () => {
      const res = await fetch("/api/lanes");
      if (!res.ok) throw new Error("Failed to load lanes");
      return (await res.json()).data as Lane[];
    },
  });

  const { data: jobsData, isLoading } = useQuery<{ data: Job[] }>({ queryKey: [JOBS_KEY] });
  const jobs: Job[] = Array.isArray(jobsData?.data) ? jobsData!.data : [];

  const moveJob = useMutation({
    mutationFn: async ({ jobId, laneId }: { jobId: string; laneId: string | null }) =>
      apiRequest("PATCH", `/api/jobs/${jobId}/lane`, { laneId }),
    onMutate: async ({ jobId, laneId }) => {
      await queryClient.cancelQueries({ queryKey: [JOBS_KEY] });
      const previous = queryClient.getQueryData([JOBS_KEY]);
      queryClient.setQueryData([JOBS_KEY], (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((j: Job) =>
            j.id === jobId ? { ...j, laneId, laneEnteredAt: new Date().toISOString() } : j),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData([JOBS_KEY], ctx.previous);
      toast({ title: "Error", description: "Could not move the job", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [JOBS_KEY] }),
  });

  const activeLanes = lanes.filter((l) => !l.archived);
  const columns = [...activeLanes, { id: NO_LANE, name: "No lane", color: "#cbd5e1", sortOrder: 999, archived: false }];

  const jobsByLane = (laneId: string) =>
    jobs.filter((j) => (laneId === NO_LANE ? !j.laneId : j.laneId === laneId));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const jobId = active.id as string;
    const overId = over.id as string;

    // overId is either a column id or another job's id — resolve to the destination lane.
    let destLane: string | null;
    if (overId === NO_LANE || columns.some((c) => c.id === overId)) {
      destLane = overId === NO_LANE ? null : overId;
    } else {
      const overJob = jobs.find((j) => j.id === overId);
      if (!overJob) return;
      destLane = overJob.laneId ?? null;
    }

    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    if ((job.laneId ?? null) === destLane) return;
    moveJob.mutate({ jobId, laneId: destLane });
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Lanes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Drag jobs between lanes. A job keeps its status — the lane is an extra organising layer.
          </p>
        </div>
        <Link href="/settings/lanes">
          <Button variant="outline" size="sm" data-testid="link-lane-settings">
            <Settings2 className="h-4 w-4 mr-2" />
            Manage lanes
          </Button>
        </Link>
      </div>

      {activeLanes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-muted-foreground">You haven't created any lanes yet.</p>
            <Link href="/settings/lanes">
              <Button>Create your first lane</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
          onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {columns.map((lane) => {
              const laneJobs = jobsByLane(lane.id);
              return (
                <Card key={lane.id} data-testid={`lane-column-${lane.id}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate">
                        <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: lane.color }} />
                        <span className="truncate">{lane.name}</span>
                      </span>
                      <Badge variant="secondary" className="flex-shrink-0">{laneJobs.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <DroppableColumn id={lane.id}>
                    <SortableContext items={laneJobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
                      {laneJobs.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">Drop jobs here</p>
                      ) : (
                        laneJobs.map((job) => <JobCardChip key={job.id} job={job} dimmed={activeId === job.id} />)
                      )}
                    </SortableContext>
                  </DroppableColumn>
                </Card>
              );
            })}
          </div>
        </DndContext>
      )}
    </div>
  );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <CardContent ref={setNodeRef} className="space-y-2 min-h-[120px]">{children}</CardContent>;
}

function JobCardChip({ job, dimmed }: { job: Job; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || dimmed ? 0.5 : 1,
  };
  const name = contactName(job);
  const days = daysInLane(job.laneEnteredAt);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="rounded-md border bg-card hover-elevate cursor-grab active:cursor-grabbing p-2.5 space-y-1"
      data-testid={`lane-job-${job.id}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold truncate">
          #{job.jobNumber}{name ? ` · ${name}` : ""}
        </span>
        {job.status && (
          <Badge variant="outline" className="text-[10px] flex-shrink-0">
            {STATUS_LABELS[job.status] || job.status}
          </Badge>
        )}
      </div>
      {job.title && <p className="text-xs text-muted-foreground truncate">{job.title}</p>}
      {days !== null && (
        <p className="text-[10px] text-muted-foreground">{days === 0 ? "Added today" : `${days} day${days === 1 ? "" : "s"} in lane`}</p>
      )}
    </div>
  );
}
