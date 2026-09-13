/**
 * The three crew roles the job card's completion checklist is organised around.
 *
 * Shared so the server's clock-in notifications and the client's chips name the
 * roles identically. The keys are the stable storage values written to
 * job_day_roles.role_key (and the legacy job_staff_assignments.day_role); the
 * labels are what crew see.
 *
 * Kaitiaki leads, so it sits first everywhere it's rendered — hence ROLE_KEYS
 * being C, A, B rather than alphabetical.
 *
 * The TASKS under each role are NOT here: they're per-tenant rows in
 * role_checklist_tasks, editable from Settings.
 */
export type RoleKey = "A" | "B" | "C";

export const ROLE_KEYS: RoleKey[] = ["C", "A", "B"];

export const ROLE_LABEL: Record<RoleKey, string> = {
  A: "Kaiwhangai",
  B: "Kaitirotiro",
  C: "Kaitiaki",
};

export function isRoleKey(value: unknown): value is RoleKey {
  return value === "A" || value === "B" || value === "C";
}
