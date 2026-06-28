import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  path: string;
  optional: boolean;
  done: boolean;
}

interface ChecklistData {
  items: ChecklistItem[];
  requiredDone: number;
  requiredTotal: number;
}

function Row({ item }: { item: ChecklistItem }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
      {item.done ? (
        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
      ) : (
        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`font-medium truncate ${item.done ? "text-muted-foreground line-through" : ""}`}>{item.label}</p>
          {item.optional && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">Optional</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
      </div>
      {!item.done && (
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link href={item.path} className="inline-flex items-center gap-1">
            Set up <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      )}
    </div>
  );
}

export default function SettingsSetup() {
  const { data, isLoading } = useQuery<{ success: boolean; data: ChecklistData }>({
    queryKey: ["/api/onboarding/checklist"],
  });

  const checklist = data?.data;
  const required = (checklist?.items ?? []).filter((i) => !i.optional);
  const optional = (checklist?.items ?? []).filter((i) => i.optional);
  const done = checklist?.requiredDone ?? 0;
  const total = checklist?.requiredTotal ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  return (
    <div className="pt-20 px-4 md:px-8 max-w-2xl mx-auto pb-16">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/settings" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold mb-1">Finish setting up</h1>
      <p className="text-muted-foreground mb-6">
        Complete these so your quotes, invoices and communications are fully branded as your business.
      </p>

      {isLoading ? (
        <div className="flex items-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <Card className="mb-6 border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">
                  {allDone ? "All set — nice work" : `${done} of ${total} essentials done`}
                </p>
                <p className="text-sm text-muted-foreground">{pct}%</p>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2 mb-6">
            {required.map((item) => (
              <Row key={item.key} item={item} />
            ))}
          </div>

          {optional.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Optional</p>
              <div className="space-y-2">
                {optional.map((item) => (
                  <Row key={item.key} item={item} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
