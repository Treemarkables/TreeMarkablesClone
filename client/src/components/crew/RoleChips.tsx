/**
 * The three role chips (Kaitiaki / Kaiwhangai / Kaitirotiro) for one person.
 *
 * Shared by the job card's "Today's roles" rows and the clock-in dialog so a role
 * is allocated the same way wherever you happen to be standing. Each chip toggles
 * on its own: one person can hold more than one role. Tapping a chip that is
 * already on turns just that role off.
 */
import { ROLE_KEYS, ROLE_LABEL, type RoleKey } from "@/lib/crewRoles";
import { toggleRole } from "@shared/crewDayRoles";

export function RoleChips({
  value,
  onChange,
  disabled = false,
  size = "default",
  testIdPrefix,
}: {
  value: readonly RoleKey[];
  /** The full set after the tapped chip is toggled. */
  onChange: (roles: RoleKey[]) => void;
  disabled?: boolean;
  size?: "default" | "sm";
  testIdPrefix: string;
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const selected = new Set(value);
  return (
    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
      {ROLE_KEYS.map((r) => {
        const active = selected.has(r);
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(toggleRole(value, r))}
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
