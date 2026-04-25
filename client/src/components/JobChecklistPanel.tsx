import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import {
  ShieldCheck,
  ClipboardCheck,
  TrafficCone,
  Clock,
  Star,
  CheckCircle2,
  Circle,
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

// Each item is satisfied when a diary comment on the job contains any of its
// trigger keywords. Supervisors already write notes during the job, so we
// re-use that signal instead of building cross-system queries. Keyword
// matching uses word boundaries so a note about "previewed pricing" doesn't
// trigger the Review item.
const CHECKLIST_ITEMS: Array<{
  id: string;
  label: string;
  icon: typeof ShieldCheck;
  keywords: string[];
}> = [
  {
    id: "risk-assessment",
    label: "Risk assessment",
    icon: ShieldCheck,
    keywords: ["jha", "risk assessment", "ra done", "ra completed"],
  },
  {
    id: "pre-start",
    label: "Pre-start",
    icon: ClipboardCheck,
    keywords: ["pre-start", "prestart", "pre start"],
  },
  {
    id: "signs-out",
    label: "Signs out",
    icon: TrafficCone,
    keywords: ["signs out", "signs placed", "signage"],
  },
  {
    id: "time-tracking",
    label: "Time tracking",
    icon: Clock,
    keywords: ["time tracking", "time entered", "hours logged"],
  },
  {
    id: "review",
    label: "Review requested",
    icon: Star,
    keywords: ["review"],
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

interface MatchResult {
  entry: DiaryEntry;
  keyword: string;
  snippet: string;
}

function searchEntries(
  entries: DiaryEntry[],
  keywords: string[],
): MatchResult | null {
  const re = buildKeywordRegex(keywords);
  // Oldest first — represents the moment the action was first recorded.
  const ordered = [...entries].sort((a, b) => {
    const ta = new Date(a.createdAt ?? a.created_at ?? "").getTime();
    const tb = new Date(b.createdAt ?? b.created_at ?? "").getTime();
    return (isNaN(ta) ? 0 : ta) - (isNaN(tb) ? 0 : tb);
  });
  for (const entry of ordered) {
    const haystack = [
      entry.title ?? "",
      entry.description ?? "",
      entry.content ?? "",
    ]
      .join("\n")
      .trim();
    if (!haystack) continue;
    const match = haystack.match(re);
    if (match) {
      // match[2] is the keyword group (group 1 was the leading boundary char).
      const keyword = match[2];
      // Build a tight snippet around the match so the user can see context.
      const idx = haystack.toLowerCase().indexOf(keyword.toLowerCase());
      const start = Math.max(0, idx - 40);
      const end = Math.min(haystack.length, idx + keyword.length + 80);
      let snippet = haystack.slice(start, end);
      if (start > 0) snippet = "…" + snippet;
      if (end < haystack.length) snippet = snippet + "…";
      // Collapse newlines inside the snippet for a cleaner one-liner.
      snippet = snippet.replace(/\s+/g, " ").trim();
      return { entry, keyword, snippet };
    }
  }
  return null;
}

function highlight(snippet: string, keyword: string) {
  // Case-insensitive split keeping the matched text.
  const re = new RegExp(`(${escapeRegex(keyword)})`, "i");
  const parts = snippet.split(re);
  return parts.map((part, i) =>
    re.test(part) ? (
      <mark
        key={i}
        className="rounded bg-yellow-200 dark:bg-yellow-800/40 text-inherit px-0.5"
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
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

  const results = useMemo(
    () =>
      CHECKLIST_ITEMS.map((item) => ({
        item,
        match: searchEntries(entries, item.keywords),
      })),
    [entries],
  );

  const completed = results.filter((r) => r.match).length;
  const total = results.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="p-4 space-y-4" data-testid="job-checklist-panel">
      {/* Header / progress */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Compliance checklist
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {completed} of {total} complete
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-snug">
          Items tick automatically when a diary note contains the matching
          keyword. The supervisor can satisfy any item by adding a note in the
          right-hand diary.
        </p>
      </div>

      {/* Items */}
      <div className="space-y-2.5">
        {isLoading && entries.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            Loading diary…
          </div>
        ) : (
          results.map(({ item, match }) => {
            const Icon = item.icon;
            const done = !!match;
            const authorName =
              match?.entry.authorName ?? match?.entry.author_name ?? "Unknown";
            const ts = match?.entry.createdAt ?? match?.entry.created_at;
            return (
              <div
                key={item.id}
                className={`rounded-lg border p-3 flex gap-3 ${
                  done
                    ? "border-green-200 bg-green-50/60 dark:border-green-800 dark:bg-green-900/20"
                    : "border-gray-200 bg-gray-50/40 dark:border-gray-700 dark:bg-gray-800/40"
                }`}
                data-testid={`checklist-item-${item.id}`}
              >
                <div className="flex-shrink-0 pt-0.5">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        done
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        done
                          ? "text-green-900 dark:text-green-100"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  {done && match ? (
                    <div
                      className="mt-1.5 text-xs text-gray-700 dark:text-gray-300 leading-snug"
                      data-testid={`checklist-match-${item.id}`}
                    >
                      <span className="italic">
                        “{highlight(match.snippet, match.keyword)}”
                      </span>
                      <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {authorName}
                        {ts ? (
                          <>
                            {" · "}
                            {formatInTimeZone(
                              new Date(ts),
                              "Pacific/Auckland",
                              "MMM d, h:mm a",
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                      Add a diary note containing one of:{" "}
                      <span className="font-mono text-gray-600 dark:text-gray-300">
                        {item.keywords
                          .map((k) => `“${k}”`)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
