/**
 * One person, several checklist roles on the same day.
 *
 * job_day_roles used to allow a single row per (employee, NZ date). The job-card
 * chips matched that: tapping a second role replaced the first, so a crew smaller
 * than the three roles could not cover them. A person now holds a set of roles.
 * Existing one-role rows are a set of size one and stay valid.
 *
 * Storage order follows ROLE_KEYS (Kaitiaki, then Kaiwhangai, then Kaitirotiro)
 * so the chips, the legacy single day_role mirror, and notifications agree.
 */
import { isRoleKey, ROLE_KEYS, ROLE_LABEL, type RoleKey } from "./crewRoles.ts";

export type { RoleKey };

export function sortRoles(roles: readonly RoleKey[]): RoleKey[] {
  const held = new Set(roles);
  return ROLE_KEYS.filter((key) => held.has(key));
}

export function toggleRole(current: readonly RoleKey[], role: RoleKey): RoleKey[] {
  const held = new Set(current);
  if (held.has(role)) held.delete(role);
  else held.add(role);
  return sortRoles(Array.from(held));
}

export function unionRoles(current: readonly RoleKey[], extra: readonly RoleKey[]): RoleKey[] {
  return sortRoles([...current, ...extra]);
}

/** The role written to the legacy single-value day_role column. */
export function primaryDayRole(roles: readonly RoleKey[]): RoleKey | null {
  return sortRoles(roles)[0] ?? null;
}

export function planDayRoleChanges(
  existing: readonly string[],
  desired: readonly RoleKey[],
): { insert: RoleKey[]; remove: RoleKey[] } {
  const have = new Set(existing.filter(isRoleKey));
  const want = new Set(desired);
  return {
    insert: sortRoles(Array.from(want).filter((role) => !have.has(role))),
    remove: sortRoles(Array.from(have).filter((role) => !want.has(role))),
  };
}

/**
 * Read a role array from a request body.
 * undefined = the field was omitted. null = it was present but not a list of A/B/C.
 * An empty array is valid (the caller decides whether that clears or no-ops).
 */
export function readRoleList(value: unknown): RoleKey[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  const roles: RoleKey[] = [];
  for (const item of value) {
    if (!isRoleKey(item)) return null;
    roles.push(item);
  }
  return sortRoles(roles);
}

/**
 * What PUT /api/staff-assignments/day-role should store.
 *
 * dayRoles replaces the set (the job-card chips send the chips that are on).
 * addRoles adds without removing (Add crew must not wipe a role set earlier today).
 * A lone dayRole still replaces the set with that one role, or clears it when null,
 * so a one-role save keeps doing what it did before.
 */
export function resolveDesiredDayRoles(input: {
  dayRole?: unknown;
  dayRoles?: unknown;
  addRoles?: unknown;
  existing?: readonly RoleKey[];
}): { ok: true; roles: RoleKey[] } | { ok: false; message: string } {
  const addRoles = readRoleList(input.addRoles);
  const dayRoles = readRoleList(input.dayRoles);
  if (addRoles === null) {
    return { ok: false, message: "addRoles must be an array of 'A', 'B', and 'C'" };
  }
  if (dayRoles === null) {
    return { ok: false, message: "dayRoles must be an array of 'A', 'B', and 'C'" };
  }
  if (addRoles !== undefined) {
    return { ok: true, roles: unionRoles(input.existing ?? [], addRoles) };
  }
  if (dayRoles !== undefined) {
    return { ok: true, roles: dayRoles };
  }
  if (input.dayRole === null) return { ok: true, roles: [] };
  if (isRoleKey(input.dayRole)) return { ok: true, roles: [input.dayRole] };
  return { ok: false, message: "dayRole must be 'A', 'B', 'C', or null" };
}

/**
 * Clock-in sends either one role (older clients) or the full chip set.
 * Null means "leave whatever they already hold" — an empty chip row included.
 */
export function parseClockInRoles(value: unknown): RoleKey[] | null {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const roles: RoleKey[] = [];
    for (const item of value) {
      if (!isRoleKey(item)) return null;
      roles.push(item);
    }
    return sortRoles(roles);
  }
  if (isRoleKey(value)) return [value];
  return null;
}

export function rolesFromDayRolePayload(row: {
  dayRoles?: readonly unknown[] | null;
  dayRole?: unknown;
}): RoleKey[] {
  if (Array.isArray(row.dayRoles)) {
    return sortRoles(row.dayRoles.filter(isRoleKey));
  }
  return isRoleKey(row.dayRole) ? [row.dayRole] : [];
}

export function groupRolesByEmployee(
  rows: readonly { employeeId: string; roleKey: string }[],
): Map<string, RoleKey[]> {
  const grouped = new Map<string, RoleKey[]>();
  for (const row of rows) {
    if (!isRoleKey(row.roleKey)) continue;
    const list = grouped.get(row.employeeId) ?? [];
    if (!list.includes(row.roleKey)) list.push(row.roleKey);
    grouped.set(row.employeeId, list);
  }
  for (const [employeeId, roles] of Array.from(grouped.entries())) {
    grouped.set(employeeId, sortRoles(roles));
  }
  return grouped;
}

export function joinRoleLabels(roles: readonly RoleKey[]): string {
  const labels = sortRoles(roles).map((role) => ROLE_LABEL[role]);
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * Roles to freeze when a job closes. A role held on the close date wins outright
 * (a one-role job still snapshots that one role). Otherwise every role from the
 * most recent day this job ran.
 */
export function selectRolesForDate(
  rows: readonly { nzDate: string; roleKey: string }[],
  closeDate: string,
): RoleKey[] {
  const valid = rows.filter((row): row is { nzDate: string; roleKey: RoleKey } => isRoleKey(row.roleKey));
  const onClose = valid.filter((row) => row.nzDate === closeDate);
  if (onClose.length > 0) return sortRoles(onClose.map((row) => row.roleKey));
  let best = "";
  for (const row of valid) {
    if (row.nzDate > best) best = row.nzDate;
  }
  if (!best) return [];
  return sortRoles(valid.filter((row) => row.nzDate === best).map((row) => row.roleKey));
}

export function outstandingForRoles(
  roles: readonly RoleKey[],
  tasks: readonly { itemId: string; label: string; roleKey: string; isEnabled?: boolean }[],
  doneIds: ReadonlySet<string>,
): Array<{ itemId: string; label: string; roleKey: RoleKey }> {
  const held = new Set(roles);
  const seen = new Set<string>();
  const outstanding: Array<{ itemId: string; label: string; roleKey: RoleKey }> = [];
  for (const task of tasks) {
    if (task.isEnabled === false) continue;
    if (!isRoleKey(task.roleKey) || !held.has(task.roleKey)) continue;
    if (doneIds.has(task.itemId) || seen.has(task.itemId)) continue;
    seen.add(task.itemId);
    outstanding.push({ itemId: task.itemId, label: task.label, roleKey: task.roleKey });
  }
  return outstanding;
}

export interface RoleCompletionSnapshot {
  employeeId: string;
  jobId: string;
  roleKey: string;
  itemsDone: number;
  itemsExpected: number;
}

export interface RoleCompletionAggregate {
  jobsCounted: number;
  jobsFullyComplete: number;
  itemsDone: number;
  itemsExpected: number;
  roleKeys: RoleKey[];
}

/**
 * One job counts once per person even when they held several roles on it.
 * It is finished only when every role list they held is finished. A historical
 * one-role snapshot is one row, so those totals stay the same.
 */
export function aggregateRoleSnapshots(
  rows: readonly RoleCompletionSnapshot[],
): Map<string, RoleCompletionAggregate> {
  const jobsByEmployee = new Map<string, Map<string, RoleCompletionSnapshot[]>>();
  for (const row of rows) {
    let jobs = jobsByEmployee.get(row.employeeId);
    if (!jobs) {
      jobs = new Map();
      jobsByEmployee.set(row.employeeId, jobs);
    }
    const snaps = jobs.get(row.jobId) ?? [];
    snaps.push(row);
    jobs.set(row.jobId, snaps);
  }

  const result = new Map<string, RoleCompletionAggregate>();
  for (const [employeeId, jobs] of Array.from(jobsByEmployee.entries())) {
    let jobsCounted = 0;
    let jobsFullyComplete = 0;
    let itemsDone = 0;
    let itemsExpected = 0;
    const roleSet = new Set<RoleKey>();
    for (const snaps of Array.from(jobs.values())) {
      jobsCounted += 1;
      if (snaps.every((snap) => snap.itemsExpected > 0 && snap.itemsDone >= snap.itemsExpected)) {
        jobsFullyComplete += 1;
      }
      for (const snap of snaps) {
        itemsDone += snap.itemsDone;
        itemsExpected += snap.itemsExpected;
        if (isRoleKey(snap.roleKey)) roleSet.add(snap.roleKey);
      }
    }
    result.set(employeeId, {
      jobsCounted,
      jobsFullyComplete,
      itemsDone,
      itemsExpected,
      roleKeys: sortRoles(Array.from(roleSet)),
    });
  }
  return result;
}
