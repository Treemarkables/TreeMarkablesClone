/**
 * The three role chips (Kaitiaki / Kaiwhangai / Kaitirotiro) for one person.
 *
 * Shared by the job card's "Today's roles" rows and the clock-in dialog so a role
 * is allocated the same way wherever you happen to be standing. Tapping the chip
 * that's already active clears the role.
 */
import { ROLE_KEYS, ROLE_LABEL, type RoleKey } from "@/lib/crewRoles";

export function RoleChips({
  value,
  onSelect,
  disabled = false,
  size = "default",
  testIdPrefix,
}: {
  value: RoleKey | null;
  /** Receives the tapped role, or null when the active chip is tapped again. */
  onSelect: (role: RoleKey | null) => void;
  disabled?: boolean;
  size?: "default" | "sm";
  testIdPrefix: string;
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
      {ROLE_KEYS.map((r) => {
        const active = value === r;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onSelect(active ? null : r)}
            disabled={disabled}
            aria-pressed={active}
            data-testid={`${testIdPrefix}-${r}`}
            className={
              active
                ? `${pad} rounded-md font-semibold border border-foreground bg-foreground text-background disabled:opacity-60`
                : `${pad} rounded-md font-semibold border border-border bg-card text-foreground disabled:opacity-60`
            }
          >
            {ROLE_LABEL[r]}
          </button>
        );
      })}
    </div>
  );
}
