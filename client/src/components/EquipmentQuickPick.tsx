import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * EquipmentQuickPick — a "click to insert" list of the tenant's equipment
 * for free-text fields (job card internal notes on desktop + mobile).
 *
 * Reads `/api/equipment` (shared query key with the billing tab and the
 * schedule modal, so it's cached). The route is Crew-plan gated — a 403
 * surfaces as a query error and the picker hides itself rather than
 * showing an empty menu to a tenant who doesn't have the fleet module.
 */

type EquipmentRow = {
  id: string;
  name: string;
  type?: string | null;
  status?: string | null;
};

type EquipmentResponse = { success?: boolean; data?: EquipmentRow[] };

function typeLabel(type: string | null | undefined): string {
  if (!type) return "Other";
  return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Insert `text` into `current` at the textarea's caret (or replacing its
 * selection), padding with a single space on either side where needed so the
 * result reads naturally mid-sentence. Falls back to appending when there is
 * no textarea. Returns the new value and where the caret should land.
 */
export function insertAtCaret(
  current: string,
  text: string,
  ta: HTMLTextAreaElement | null,
): { next: string; caret: number } {
  const start = ta?.selectionStart ?? current.length;
  const end = ta?.selectionEnd ?? current.length;
  const before = current.slice(0, start);
  const after = current.slice(end);
  const pad = (before.length > 0 && !/\s$/.test(before) ? " " : "") + text;
  const token = pad + (after.length > 0 && !/^\s/.test(after) ? " " : "");
  return { next: before + token + after, caret: before.length + token.length };
}

export function EquipmentQuickPick({
  onPick,
  className,
}: {
  onPick: (name: string) => void;
  className?: string;
}) {
  const { data, isError } = useQuery<EquipmentResponse>({
    queryKey: ["/api/equipment"],
    staleTime: 5 * 60_000,
    retry: false,
  });

  const groups = useMemo(() => {
    const rows = Array.isArray(data?.data) ? data.data : [];
    const byType = new Map<string, EquipmentRow[]>();
    for (const row of rows) {
      if (!row?.name || row.status === "retired") continue;
      const key = typeLabel(row.type);
      const list = byType.get(key) ?? [];
      list.push(row);
      byType.set(key, list);
    }
    return Array.from(byType.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({
        label,
        items: items.slice().sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [data]);

  // Plan-gated (403) or not loaded yet — stay out of the way.
  if (isError || !data) return null;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={className ?? "h-7 px-2 text-amber-700"}
          data-testid="button-equipment-quick-pick"
        >
          <Wrench className="h-4 w-4 mr-1" />
          <span className="text-xs">Equipment</span>
          <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-72 overflow-y-auto min-w-[12rem]"
        // Don't bounce focus back to the trigger — the caller decides whether
        // to return the caret to the textarea (desktop) or leave the keyboard
        // down (mobile).
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {groups.length === 0 ? (
          <DropdownMenuItem disabled>No equipment in your fleet yet</DropdownMenuItem>
        ) : (
          groups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {group.label}
              </DropdownMenuLabel>
              {group.items.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => onPick(item.name)}
                  data-testid={`equipment-quick-pick-${item.id}`}
                >
                  {item.name}
                </DropdownMenuItem>
              ))}
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
