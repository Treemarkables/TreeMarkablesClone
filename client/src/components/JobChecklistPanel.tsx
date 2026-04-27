import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Shield,
  ClipboardCheck,
  TriangleAlert,
  Clock,
  Star,
} from "lucide-react";

interface DiaryEntry {
  id: string;
  entryType?: string;
  entry_type?: string;
  title?: string | null;
  description?: string | null;
  content?: string | null;
  authorName?: string | null;
  author_name?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
}

type ChecklistIcon = React.ComponentType<{ className?: string }>;

interface ChecklistItem {
  id: string;
  label: string;
  triggers: string[];
  Icon: ChecklistIcon;
}

// Each item is satisfied when a diary comment on the job contains any of its
// trigger keywords. Supervisors already write notes during the job, so we
// re-use that signal instead of building cross-system queries. Keyword
// matching uses word boundaries so a note about "previewed pricing" doesn't
// trigger the Review item.
const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "risk-assessment",
    label: "Risk assessment",
    Icon: Shield,
    triggers: ["jha", "risk assessment", "ra done", "ra completed"],
  },
  {
    id: "pre-start",
    label: "Pre-start",
    Icon: ClipboardCheck,
    triggers: ["pre-start", "prestart", "pre start"],
  },
  {
    id: "signs-out",
    label: "Signs out",
    Icon: TriangleAlert,
    triggers: ["signs out", "signs placed", "signage"],
  },
  {
    id: "time-tracking",
    label: "Time tracking",
    Icon: Clock,
    triggers: ["time tracking", "time entered", "hours logged"],
  },
  {
    id: "review",
    label: "Review requested",
    Icon: Star,
    triggers: ["review"],
  },
];

// Escape regex specials in user-supplied keyword strings before composing
// the word-boundary regex.
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildKeywordRegex(keywords: string[]): RegExp {
  const escaped = keywords.map(escapeRegex).join("|");
  // \b doesn't fire on the - in pre-start, so allow either a word boundary or
  // a non-word char on either side. Adequate for plain-English diary notes.
  return new RegExp(`(^|\\W)(${escaped})(?=\\W|$)`, "i");
}

function entryMatches(entries: DiaryEntry[], keywords: string[]): boolean {
  const re = buildKeywordRegex(keywords);
  for (const entry of entries) {
    const haystack = [
      entry.title ?? "",
      entry.description ?? "",
      entry.content ?? "",
    ]
      .join("\n")
      .trim();
    if (!haystack) continue;
    if (re.test(haystack)) return true;
  }
  return false;
}

export function JobChecklistPanel({ jobId }: { jobId: string }) {
  const { data, isLoading } = useQuery<{
    success?: boolean;
    data?: DiaryEntry[];
  }>({
    queryKey: ["/api/jobs", jobId, "diary"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/diary`);
      if (!res.ok) throw new Error("Failed to load diary entries");
      return res.json();
    },
    staleTime: 30_000,
  });

  const entries = data?.data ?? [];

  const itemsWithStatus = useMemo(
    () =>
      CHECKLIST_ITEMS.map((item) => ({
        ...item,
        completed: entryMatches(entries, item.triggers),
      })),
    [entries],
  );

  const completedCount = itemsWithStatus.filter((i) => i.completed).length;
  const totalCount = itemsWithStatus.length;
  const percent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <div className="p-4 w-full" data-testid="job-checklist-panel">
      {/* Heading */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Job completion checklist
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Items tick off automatically when matching keywords appear in diary
          notes.
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/50 rounded-md mb-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground">Progress</span>
          <span className="text-sm font-semibold text-foreground">
            {completedCount} of {totalCount}
          </span>
        </div>
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${percent}%`,
              backgroundColor: "#39FF14",
            }}
          />
        </div>
        <span className="text-sm font-semibold text-muted-foreground shrink-0 min-w-[40px] text-right">
          {percent}%
        </span>
      </div>

      {/* Checklist items */}
      {isLoading && entries.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          Loading diary…
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {itemsWithStatus.map((item) => (
            <ChecklistRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
}: {
  item: ChecklistItem & { completed: boolean };
}) {
  const { id, label, triggers, completed, Icon } = item;

  return (
    <div
      className="flex items-start gap-3.5 p-4 bg-card border border-border rounded-lg transition-colors hover:bg-accent/30"
      data-testid={`checklist-item-${id}`}
    >
      {/* Tick circle */}
      <div className="shrink-0 mt-0.5">
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
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Icon className="w-4 h-4 text-foreground shrink-0" />
          <span
            className={
              completed
                ? "text-[15px] font-semibold line-through text-muted-foreground"
                : "text-[15px] font-semibold text-foreground"
            }
          >
            {label}
          </span>
          {completed && (
            <span className="ml-auto text-[11px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
              Auto-detected
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground leading-relaxed">
          <span>Triggers on: </span>
          <span className="inline-flex flex-wrap gap-1.5 align-middle">
            {triggers.map((trigger, idx) => (
              <code
                key={idx}
                className="font-mono text-[11px] px-1.5 py-0.5 bg-muted text-foreground/80 rounded"
              >
                {trigger}
              </code>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
