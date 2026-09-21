/**
 * Scrollable checkbox list of staff, shared by the clock-in dialog and the job
 * card's "Add crew" dialog so there's one implementation of the row rather than
 * two that drift apart.
 *
 * Callers supply their own trailing content per row (the timer shows "Clocked in"
 * / "On Job 1279" badges; the roles picker shows nothing) and, optionally,
 * content rendered under the name — which is where the role chips go.
 */
import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export interface StaffPickerEmployee {
  id: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
}

export function StaffPickerList({
  employees,
  selectedIds,
  onToggle,
  /** Rows that are checked and locked — e.g. already clocked in on this job. */
  lockedIds,
  renderTrailing,
  renderBelow,
  emptyLabel = "No active staff found",
  testIdPrefix = "picker-staff",
}: {
  employees: StaffPickerEmployee[];
  selectedIds: Set<string>;
  onToggle: (employeeId: string) => void;
  lockedIds?: Set<string>;
  renderTrailing?: (employee: StaffPickerEmployee) => ReactNode;
  renderBelow?: (employee: StaffPickerEmployee, selected: boolean) => ReactNode;
  emptyLabel?: string;
  testIdPrefix?: string;
}) {
  return (
    <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1">
      <ul className="space-y-1">
        {employees.map((emp) => {
          const locked = lockedIds?.has(emp.id) ?? false;
          const selected = locked || selectedIds.has(emp.id);
          const name = `${emp.firstName} ${emp.lastName}`.trim();
          const below = renderBelow?.(emp, selected);
          return (
            <li key={emp.id}>
              {/* Not a <label> around the Radix checkbox. A label click fires
                  onCheckedChange and then activates the control again, so the
                  row toggles twice and the selection (and its role chips)
                  disappears. One click on the row toggles once. */}
              <div
                role="checkbox"
                aria-checked={selected}
                aria-disabled={locked}
                tabIndex={locked ? -1 : 0}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 ${
                  locked ? "opacity-60" : "cursor-pointer hover:bg-muted/60"
                }`}
                data-testid={`${testIdPrefix}-${emp.id}`}
                onClick={() => {
                  if (!locked) onToggle(emp.id);
                }}
                onKeyDown={(e) => {
                  if (locked) return;
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onToggle(emp.id);
                  }
                }}
              >
                <Checkbox
                  checked={selected}
                  disabled={locked}
                  tabIndex={-1}
                  className="pointer-events-none"
                />
                <span className="text-sm font-medium flex-1 truncate">{name}</span>
                {renderTrailing?.(emp)}
              </div>
              {/* Outside the row so tapping a role chip doesn't also toggle the checkbox. */}
              {below ? <div className="pl-11 pr-3 pb-2">{below}</div> : null}
            </li>
          );
        })}
        {employees.length === 0 && (
          <li className="text-sm text-muted-foreground px-3 py-4 text-center">
            {emptyLabel}
          </li>
        )}
      </ul>
    </div>
  );
}
