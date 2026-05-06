import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Shield,
  Camera,
  PhoneCall,
  TriangleAlert,
  ClipboardCheck,
  Clock,
  Star,
  Users,
  MessageSquare,
  Bell,
  Mail,
  MapPin,
  Wrench,
  TreePine,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { compressImage } from "@/lib/imageCompression";
import { formatNZTime } from "@shared/dateUtils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { QuotingProcessStep, JobQuotingProcessCompletion } from "@shared/schema";

type IconComponent = React.ComponentType<{ className?: string }>;

const ICON_BY_NAME: Record<string, IconComponent> = {
  Check,
  Shield,
  Camera,
  PhoneCall,
  TriangleAlert,
  ClipboardCheck,
  Clock,
  Star,
  Users,
  MessageSquare,
  Bell,
  Mail,
  MapPin,
  Wrench,
  TreePine,
  AlertTriangle,
};

interface ToggleVars {
  itemId: string;
  completed: boolean;
  note?: string | null;
  photos?: string[] | null;
}

export function JobQuotingPanel({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isTempJob = jobId.startsWith("temp-");

  const { data: stepsResp, isLoading: stepsLoading } = useQuery<{
    success?: boolean;
    data?: QuotingProcessStep[];
  }>({
    queryKey: ["/api/quoting-process-steps"],
    staleTime: 60_000,
  });

  const { data: completionsResp, isLoading: completionsLoading } = useQuery<{
    success?: boolean;
    data?: JobQuotingProcessCompletion[];
  }>({
    queryKey: ["/api/jobs", jobId, "quoting-process"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/quoting-process`);
      if (!res.ok) throw new Error("Failed to load quoting process");
      return res.json();
    },
    enabled: !isTempJob,
    staleTime: 30_000,
  });

  const enabledSteps = useMemo(() => {
    const list = stepsResp?.data ?? [];
    return list
      .filter((s) => s.isEnabled)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [stepsResp]);

  const completionByItem = useMemo(() => {
    const map = new Map<string, JobQuotingProcessCompletion>();
    for (const c of completionsResp?.data ?? []) {
      map.set(c.itemId, c);
    }
    return map;
  }, [completionsResp]);

  const toggleMutation = useMutation({
    mutationFn: async (vars: ToggleVars) => {
      const body: Record<string, unknown> = { completed: vars.completed };
      if (vars.note !== undefined) body.note = vars.note;
      if (vars.photos !== undefined) body.photos = vars.photos;
      const res = await apiRequest(
        "POST",
        `/api/jobs/${jobId}/quoting-process/${vars.itemId}`,
        body,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "quoting-process"],
      });
    },
    onError: () =>
      toast({ title: "Failed to update step", variant: "destructive" }),
  });

  const completedCount = enabledSteps.filter((s) =>
    completionByItem.has(s.itemId),
  ).length;
  const totalCount = enabledSteps.length;
  const percent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  if (isTempJob) {
    return (
      <div className="p-4 w-full" data-testid="job-quoting-panel">
        <div className="text-xs text-muted-foreground py-2">
          Save the job before recording quoting steps.
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-4 w-full flex flex-col gap-5"
      data-testid="job-quoting-panel"
    >
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          On-site quoting process
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tick each step as you walk the customer through the quote. Add notes
          or photos against any step — your progress is saved automatically and
          will still be here when you come back.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/50 rounded-md">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground">Progress</span>
          <span className="text-sm font-semibold text-foreground">
            {completedCount} of {totalCount}
          </span>
        </div>
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${percent}%`, backgroundColor: "#39FF14" }}
          />
        </div>
        <span className="text-sm font-semibold text-muted-foreground shrink-0 min-w-[40px] text-right">
          {percent}%
        </span>
      </div>

      {stepsLoading || completionsLoading ? (
        <div className="text-xs text-muted-foreground py-2">
          Loading quoting steps…
        </div>
      ) : enabledSteps.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          No quoting steps configured yet. Add some in
          <span className="font-semibold"> Settings → Quoting Process</span>.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {enabledSteps.map((step) => {
            const completion = completionByItem.get(step.itemId) ?? null;
            return (
              <QuotingStepRow
                key={step.itemId}
                jobId={jobId}
                step={step}
                completion={completion}
                disabled={toggleMutation.isPending}
                onToggle={(completed) =>
                  toggleMutation.mutate({
                    itemId: step.itemId,
                    completed,
                    note: completion?.note ?? null,
                    photos: completion?.photos ?? null,
                  })
                }
                onSaveNote={(note) =>
                  toggleMutation.mutate({
                    itemId: step.itemId,
                    completed: true,
                    note,
                    photos: completion?.photos ?? null,
                  })
                }
                onSavePhotos={(photos) =>
                  toggleMutation.mutate({
                    itemId: step.itemId,
                    completed: true,
                    note: completion?.note ?? null,
                    photos,
                  })
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuotingStepRow({
  jobId,
  step,
  completion,
  disabled,
  onToggle,
  onSaveNote,
  onSavePhotos,
}: {
  jobId: string;
  step: QuotingProcessStep;
  completion: JobQuotingProcessCompletion | null;
  disabled: boolean;
  onToggle: (completed: boolean) => void;
  onSaveNote: (note: string | null) => void;
  onSavePhotos: (photos: string[]) => void;
}) {
  const completed = !!completion;
  const Icon = ICON_BY_NAME[step.iconName] ?? Check;
  const [expanded, setExpanded] = useState(false);
  const [noteDraft, setNoteDraft] = useState(completion?.note ?? "");
  const lastSavedNote = useRef(completion?.note ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Keep the local note in sync when the server completion changes (e.g.,
  // toggled off then back on).
  useEffect(() => {
    setNoteDraft(completion?.note ?? "");
    lastSavedNote.current = completion?.note ?? "";
  }, [completion?.id, completion?.note]);

  const photos = completion?.photos ?? [];

  const completedMeta = completion
    ? [
        completion.completedByName?.trim() || null,
        formatNZTime(completion.completedAt, "datetime"),
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const handleNoteBlur = () => {
    const next = noteDraft.trim() ? noteDraft : null;
    const last = lastSavedNote.current.trim() ? lastSavedNote.current : null;
    if (next === last) return;
    if (!completed) {
      // Save a note also marks the step complete (otherwise there's nothing
      // to attach the note to).
      onSaveNote(next);
    } else {
      onSaveNote(next);
    }
    lastSavedNote.current = noteDraft;
  };

  const handleAddPhotos = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} is larger than 5MB.`,
            variant: "destructive",
          });
          continue;
        }
        let toUpload: File | Blob = file;
        try {
          toUpload = await compressImage(file);
        } catch {
          toUpload = file;
        }
        const formData = new FormData();
        formData.append("photo", toUpload);
        const res = await fetch(
          `/api/jobs/${jobId}/quoting-process/photo-upload`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Upload failed");
        }
        const body = await res.json();
        if (body?.url) newUrls.push(body.url);
      }
      if (newUrls.length > 0) {
        onSavePhotos([...photos, ...newUrls]);
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = (url: string) => {
    onSavePhotos(photos.filter((p) => p !== url));
  };

  return (
    <Card
      className="overflow-hidden"
      data-testid={`quoting-step-${step.itemId}`}
    >
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          onClick={() => onToggle(!completed)}
          disabled={disabled}
          className="shrink-0 mt-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
          aria-pressed={completed}
          data-testid={`quoting-step-toggle-${step.itemId}`}
        >
          {completed ? (
            <div
              className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#39FF14" }}
            >
              <Check
                className="w-3 h-3"
                strokeWidth={3.5}
                style={{ color: "#000" }}
              />
            </div>
          ) : (
            <div className="w-[22px] h-[22px] rounded-full border-[1.5px] border-muted-foreground/40" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
          data-testid={`quoting-step-expand-${step.itemId}`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className="w-4 h-4 text-foreground shrink-0" />
            <span
              className={
                completed
                  ? "text-[15px] font-semibold line-through text-muted-foreground"
                  : "text-[15px] font-semibold text-foreground"
              }
            >
              {step.label}
            </span>
            {(completion?.note?.trim() || photos.length > 0) && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {completion?.note?.trim() ? "Note" : ""}
                {completion?.note?.trim() && photos.length > 0 ? " · " : ""}
                {photos.length > 0 ? `${photos.length} photo${photos.length === 1 ? "" : "s"}` : ""}
              </span>
            )}
          </div>
          {completedMeta && (
            <div className="text-xs text-muted-foreground mt-1">
              {completedMeta}
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 p-1 text-muted-foreground"
          aria-label={expanded ? "Collapse step" : "Expand step"}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-3">
          <div>
            <label
              className="text-xs font-medium text-muted-foreground mb-1 block"
              htmlFor={`note-${step.itemId}`}
            >
              Note (optional)
            </label>
            <Textarea
              id={`note-${step.itemId}`}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Anything worth remembering about this step…"
              rows={3}
              data-testid={`quoting-step-note-${step.itemId}`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">
                Photos
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                data-testid={`quoting-step-add-photo-${step.itemId}`}
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Plus className="w-3.5 h-3.5 mr-1" />
                )}
                Add photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleAddPhotos(e.target.files);
                }}
              />
            </div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((url) => (
                  <div
                    key={url}
                    className="relative group rounded-md overflow-hidden border border-border"
                  >
                    <img
                      src={url}
                      alt="Quoting step"
                      className="w-full h-20 object-cover"
                      onClick={() => window.open(url, "_blank")}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(url)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic">
                No photos yet.
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
