import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { GlobalJobCard } from "@/components/GlobalJobCard";
import {
  TODAY_COPY,
  applyTodayView,
  jobsCountLabel,
  notesCountLabel,
  parsePickerValue,
  pickerValue,
  type TodayOverviewData,
  type TodayPerson,
  type TodayView,
} from "@shared/todayPage";

function PersonAvatar({ person, size = "md" }: { person: TodayPerson; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]";
  return (
    <span
      className={`${dim} rounded-full font-semibold text-white flex items-center justify-center shrink-0`}
      style={{ backgroundColor: person.color }}
      title={person.displayName}
    >
      {person.initials}
    </span>
  );
}

export default function TodayDashboard() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<TodayView>("all");
  const [picker, setPicker] = useState("");
  const [note, setNote] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isJobCardOpen, setIsJobCardOpen] = useState(false);
  const addBarRef = useRef<HTMLFormElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: TodayOverviewData }>({
    queryKey: ["/api/today-overview"],
    refetchInterval: 60_000,
  });

  const overview = useMemo(() => {
    const raw = data?.data;
    if (!raw) return null;
    const employeeId = currentUser?.id || raw.currentEmployeeId;
    return applyTodayView(raw, view, employeeId);
  }, [data, view, currentUser?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = parsePickerValue(picker);
      if (!parsed) throw new Error(TODAY_COPY.pickWhoNeeded);
      const trimmed = note.trim();
      if (!trimmed) throw new Error(TODAY_COPY.noteNeeded);
      const res = await apiRequest("POST", "/api/today-extra-instructions", {
        date: overview?.date,
        scope: parsed.scope,
        personId: parsed.scope === "person" ? parsed.id : undefined,
        crewId: parsed.scope === "crew" ? parsed.id : undefined,
        note: trimmed,
      });
      return res.json();
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/today-overview"] });
    },
    onError: (error: Error) => {
      toast({ title: error.message || TODAY_COPY.failedToSave, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/today-extra-instructions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/today-overview"] });
    },
    onError: () => {
      toast({ title: TODAY_COPY.failedToRemove, variant: "destructive" });
    },
  });

  const focusAddBar = () => {
    addBarRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    noteInputRef.current?.focus();
  };

  const openJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setIsJobCardOpen(true);
  };

  const counts = overview?.counts ?? {
    jobsToday: 0,
    crewsLive: 0,
    peopleOut: 0,
    bookedLabel: "$0",
    extraNotes: 0,
  };

  const summary = [
    { value: String(counts.jobsToday), label: TODAY_COPY.jobsToday, accent: true },
    { value: String(counts.crewsLive), label: TODAY_COPY.crewsLive },
    { value: String(counts.peopleOut), label: TODAY_COPY.peopleOut },
    { value: counts.bookedLabel, label: TODAY_COPY.booked },
    { value: String(counts.extraNotes), label: TODAY_COPY.extraNotes },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {overview ? (
              <>
                {overview.dateLabel}
                {overview.businessName ? ` · ${overview.businessName}` : ""}
              </>
            ) : (
              TODAY_COPY.loading
            )}
          </p>
        </div>
        <div
          className="inline-flex items-center self-start rounded-full bg-muted p-0.5"
          data-testid="today-view-toggle"
        >
          <Button
            size="sm"
            variant={view === "all" ? "default" : "ghost"}
            onClick={() => setView("all")}
            data-testid="today-view-all-crews"
          >
            {TODAY_COPY.allCrews}
          </Button>
          <Button
            size="sm"
            variant={view === "me" ? "default" : "ghost"}
            onClick={() => setView("me")}
            data-testid="today-view-just-me"
          >
            {TODAY_COPY.justMe}
          </Button>
        </div>
      </div>

      <div className="inflow-chrome overflow-hidden mb-4" data-testid="today-morning-summary">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {summary.map((item) => (
            <div
              key={item.label}
              className={`px-5 py-4 border-border/70 ${item.accent ? "border-l-4 border-l-brand-lime" : ""} sm:border-r sm:last:border-r-0`}
            >
              <p className="text-2xl font-semibold tracking-tight">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="inflow-chrome overflow-hidden mb-4" data-testid="today-notes-strip">
        <div className="flex items-center gap-3 bg-primary text-primary-foreground px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{TODAY_COPY.todayNotes}</p>
            <p className="text-xs text-primary-foreground/70 truncate">{TODAY_COPY.notesSubtitle}</p>
          </div>
          <Button
            size="sm"
            className="bg-brand-lime text-brand-lime-foreground border-brand-lime-border shrink-0"
            onClick={focusAddBar}
            data-testid="today-notes-add"
          >
            <Plus className="h-4 w-4" />
            {TODAY_COPY.add}
          </Button>
        </div>
        <div className="p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground px-1 py-2">{TODAY_COPY.loading}</p>
          ) : overview && overview.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1 py-2">{TODAY_COPY.noNotes}</p>
          ) : (
            overview?.notes.map((item) => (
              <div
                key={item.id}
                data-testid={`today-note-${item.id}`}
                className={`inflow-chrome-item relative px-3 py-3 ${
                  item.scope === "crew" ? "bg-brand-lime/40 border-brand-lime-border" : "bg-muted/60"
                }`}
              >
                <div className="flex items-start gap-2 pr-6">
                  {item.scope === "crew" ? (
                    <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <Truck className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span
                      className="h-7 w-7 rounded-full text-[11px] font-semibold text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.targetName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{item.targetName}</p>
                    <p className="text-sm text-foreground/80 leading-snug">{item.note}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-8 w-8"
                  aria-label="Remove extra instruction"
                  onClick={() => removeMutation.mutate(item.id)}
                  data-testid={`today-note-remove-${item.id}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="space-y-4 mb-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{TODAY_COPY.loading}</p>
        ) : !overview || overview.crews.length === 0 ? (
          <div className="inflow-chrome px-5 py-8 text-sm text-muted-foreground">
            {view === "me" ? TODAY_COPY.noJobsForYou : TODAY_COPY.noJobsToday}
          </div>
        ) : (
          overview.crews.map((crew) => (
            <section key={crew.id} className="inflow-chrome overflow-hidden" data-testid={`today-crew-${crew.id}`}>
              <div className="flex flex-wrap items-center gap-3 bg-primary text-primary-foreground px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: crew.color }} />
                <h2 className="font-semibold truncate">{crew.name}</h2>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {crew.members.map((member) => (
                    <span key={member.id} className="inline-flex items-center gap-1.5 min-w-0">
                      <PersonAvatar person={member} size="sm" />
                      <span className="text-sm truncate">{member.displayName}</span>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="rounded-full bg-brand-lime text-brand-lime-foreground text-xs font-medium px-2.5 py-0.5">
                    {notesCountLabel(crew.notesCount)}
                  </span>
                  <span className="rounded-full bg-brand-lime text-brand-lime-foreground text-xs font-medium px-2.5 py-0.5">
                    {jobsCountLabel(crew.jobs.length)}
                  </span>
                </div>
              </div>
              <ul>
                {crew.jobs.map((job, index) => (
                  <li key={job.id} className={index % 2 === 0 ? "bg-purple/10" : "bg-card"}>
                    <div
                      role="button"
                      tabIndex={0}
                      data-testid={`today-job-${job.id}`}
                      onClick={() => openJob(job.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openJob(job.id);
                        }
                      }}
                      className="grid grid-cols-1 lg:grid-cols-[9.5rem_minmax(0,1.4fr)_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 cursor-pointer hover-elevate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="text-sm font-medium text-muted-foreground">{job.timeLabel}</p>
                      <p className="text-sm font-semibold text-purple truncate">{job.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{job.address}</p>
                      <div className="flex items-center gap-1">
                        {job.people.map((person) => (
                          <PersonAvatar key={person.id} person={person} size="sm" />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {job.kit.map((item) => (
                          <span
                            key={item}
                            className="rounded-full bg-purple/15 text-purple text-xs font-medium px-2.5 py-0.5"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm font-semibold justify-self-end">{job.bookedLabel}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <form
        ref={addBarRef}
        className="inflow-chrome bg-brand-lime/35 border-brand-lime-border px-3 py-3 flex flex-col gap-3 lg:flex-row lg:items-center"
        data-testid="today-add-bar"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <Button
          type="button"
          variant="ghost"
          className="justify-start text-foreground shrink-0"
          onClick={focusAddBar}
          data-testid="today-add-instruction"
        >
          <Plus className="h-4 w-4" />
          {TODAY_COPY.addInstruction}
        </Button>
        <Select value={picker || undefined} onValueChange={setPicker}>
          <SelectTrigger className="bg-card lg:w-56" data-testid="today-pick-who">
            <SelectValue placeholder={TODAY_COPY.pickWho} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{TODAY_COPY.people}</SelectLabel>
              {(overview?.peopleOptions ?? []).map((person) => (
                <SelectItem key={person.id} value={pickerValue("person", person.id)}>
                  {person.displayName}
                </SelectItem>
              ))}
            </SelectGroup>
            {(overview?.crewOptions.length ?? 0) > 0 && (
              <SelectGroup>
                <SelectLabel>{TODAY_COPY.crews}</SelectLabel>
                {overview?.crewOptions.map((crew) => (
                  <SelectItem key={crew.id} value={pickerValue("crew", crew.id)}>
                    {crew.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <Input
          ref={noteInputRef}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={TODAY_COPY.pickWhoHint}
          className="bg-card flex-1"
          data-testid="today-note-input"
        />
        <Button
          type="submit"
          className="bg-brand-lime text-brand-lime-foreground border-brand-lime-border lg:w-24"
          disabled={saveMutation.isPending}
          data-testid="today-note-save"
        >
          {TODAY_COPY.save}
        </Button>
      </form>

      {selectedJobId && (
        <GlobalJobCard
          isOpen={isJobCardOpen}
          onClose={() => setIsJobCardOpen(false)}
          mode="edit"
          jobId={selectedJobId}
        />
      )}
    </div>
  );
}
