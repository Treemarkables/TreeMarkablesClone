import { Check } from "lucide-react";
import {
  Shield,
  ClipboardCheck,
  TriangleAlert,
  Clock,
  Star,
} from "lucide-react";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type ChecklistIcon = React.ComponentType<{ className?: string }>;

type ChecklistItem = {
  id: string;
  label: string;
  triggers: string[];
  completed: boolean;
  Icon: ChecklistIcon;
};

interface JobCompletionChecklistProps {
  items?: ChecklistItem[];
}

// ----------------------------------------------------------------------------
// Default data — replace with props from your job context
// ----------------------------------------------------------------------------

const DEFAULT_ITEMS: ChecklistItem[] = [
  {
    id: "risk-assessment",
    label: "Risk assessment",
    triggers: ["jha", "risk assessment", "ra done", "ra completed"],
    completed: true,
    Icon: Shield,
  },
  {
    id: "pre-start",
    label: "Pre-start",
    triggers: ["pre-start", "prestart", "pre start"],
    completed: true,
    Icon: ClipboardCheck,
  },
  {
    id: "signs-out",
    label: "Signs out",
    triggers: ["signs out", "signs placed", "signage"],
    completed: false,
    Icon: TriangleAlert,
  },
  {
    id: "time-tracking",
    label: "Time tracking",
    triggers: ["time tracking", "time entered", "hours logged"],
    completed: false,
    Icon: Clock,
  },
  {
    id: "review-requested",
    label: "Review requested",
    triggers: ["review"],
    completed: false,
    Icon: Star,
  },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function JobCompletionChecklist({
  items = DEFAULT_ITEMS,
}: JobCompletionChecklistProps) {
  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const percent =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  return (
    <div className="w-full">
      {/* Heading */}
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Job completion checklist
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Items tick off automatically when matching keywords appear in diary
          notes. Tap any item to add a note manually.
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
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Row
// ----------------------------------------------------------------------------

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const { label, triggers, completed, Icon } = item;

  return (
    <div className="flex items-start gap-3.5 p-4 bg-card border border-border rounded-lg transition-colors hover:bg-accent/30">
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

export default JobCompletionChecklist;
