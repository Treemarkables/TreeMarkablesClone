/**
 * The three crew roles the job card's completion checklist is organised around.
 *
 * Shared so the server's clock-in notifications and the client's chips name the
 * roles identically. The keys are the stable storage values written to
 * job_day_roles.role_key (and the legacy job_staff_assignments.day_role); the
 * labels are what crew see.
 *
 * Kaitiaki leads, so it sits first everywhere it's rendered — hence ROLE_KEYS
 * being C, A, B rather than alphabetical. Risk assessment is last on purpose:
 * the legacy single day_role column stores ROLE_KEYS[0] of the set, and a
 * person who also holds the morning JHA should still mirror Kaitiaki (or
 * whichever crew role they already held) rather than the new role.
 *
 * The TASKS under each role are NOT here: they're per-tenant rows in
 * role_checklist_tasks, editable from Settings. The built-in Risk assessment
 * task belongs to R.
 */
export type RoleKey = "A" | "B" | "C" | "R";

export const ROLE_KEYS: RoleKey[] = ["C", "A", "B", "R"];

export const ROLE_LABEL: Record<RoleKey, string> = {
  A: "Kaiwhangai",
  B: "Kaitirotiro",
  C: "Kaitiaki",
  R: "Risk assessment",
};

export function isRoleKey(value: unknown): value is RoleKey {
  return value === "A" || value === "B" || value === "C" || value === "R";
}
