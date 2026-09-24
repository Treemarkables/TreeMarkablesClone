import { eq, and, gte, lt, asc } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { withTenant } from "./tenancy/tenantStore";
import * as schema from "@shared/schema";
import { getNZDateString, jobRunsOnNZDate, nzTimeToUTC } from "@shared/dateUtils";
import {
  applyTodayView,
  assignJobsToCrews,
  colorForId,
  CREW_PALETTE,
  displayFirstName,
  formatBookedAmount,
  formatTimeRange,
  formatTodayHeading,
  initialsFor,
  jobBookedAmount,
  kitLabels,
  NO_CREW_ID,
  NO_CREW_NAME,
  parseClockToMinutes,
  PEOPLE_PALETTE,
  uniqueIds,
  type TodayCrewGroup,
  type TodayJobRow,
  type TodayNote,
  type TodayOverviewData,
  type TodayPerson,
  type TodayScope,
} from "@shared/todayPage";
import { loadEffectiveRiskLinksForJobs } from "./jhaJobRisk";
import type { JobRiskAssessmentLink } from "@shared/jhaJobRisk";

export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function personFromEmployee(
  employee: { id: string; firstName: string; lastName: string },
  firstNameCounts: Map<string, number>,
): TodayPerson {
  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    displayName: displayFirstName(employee, firstNameCounts),
    initials: initialsFor(employee.firstName, employee.lastName),
    color: colorForId(employee.id, PEOPLE_PALETTE),
  };
}

function nextNzDate(nzDate: string): string {
  const [year, month, day] = nzDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  return utc.toISOString().slice(0, 10);
}

function countFirstNames(employees: Array<{ firstName: string }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const employee of employees) {
    const key = employee.firstName.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export async function buildTodayOverview(employeeId: string): Promise<TodayOverviewData> {
  const todayStr = getNZDateString(new Date());
  const [jobsAround, employees, teams, settings, extraNotes, assignments] = await Promise.all([
    storage.getJobsScheduledAroundNZDate(todayStr),
    storage.getAllEmployees(),
    db.select().from(schema.teams),
    storage.getBusinessSettings(),
    db
      .select()
      .from(schema.dailyOpsNotes)
      .where(eq(schema.dailyOpsNotes.date, todayStr))
      .orderBy(asc(schema.dailyOpsNotes.createdAt)),
    db
      .select()
      .from(schema.jobStaffAssignments)
      .where(
        and(
          gte(schema.jobStaffAssignments.startTime, nzTimeToUTC(todayStr, "00:00")),
          lt(schema.jobStaffAssignments.startTime, nzTimeToUTC(nextNzDate(todayStr), "00:00")),
        ),
      ),
  ]);

  const jobsToday = jobsAround
    .filter((job) => jobRunsOnNZDate(job, todayStr))
    .sort((a, b) =>
      (a.scheduledStartTime || "99:99").localeCompare(b.scheduledStartTime || "99:99"),
    );

  let riskLinks = new Map<string, JobRiskAssessmentLink>();
  try {
    riskLinks = await loadEffectiveRiskLinksForJobs(
      jobsToday.map((job) => job.id),
      todayStr,
    );
  } catch (err) {
    console.error("Error loading morning risk status for today:", err);
  }

  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const firstNameCounts = countFirstNames(employees);
  const personFor = (id: string): TodayPerson | null => {
    const employee = employeeById.get(id);
    if (!employee) return null;
    return personFromEmployee(employee, firstNameCounts);
  };

  const assignmentPeople = new Map<string, string[]>();
  for (const assignment of assignments) {
    const list = assignmentPeople.get(assignment.jobId) ?? [];
    list.push(assignment.employeeId);
    assignmentPeople.set(assignment.jobId, list);
  }

  const activeTeams = teams.filter((team) => team.isActive !== false);

  const jobPeopleIds = new Map<string, string[]>();
  const jobRowsById = new Map<string, TodayJobRow>();
  for (const job of jobsToday) {
    const peopleIds = uniqueIds(
      job.assignedTeam,
      job.assignedTo,
      job.assignedStaffIds,
      assignmentPeople.get(job.id),
    );
    jobPeopleIds.set(job.id, peopleIds);
    const people = peopleIds.map(personFor).filter((person): person is TodayPerson => person !== null);
    const bookedAmount = jobBookedAmount(job);
    jobRowsById.set(job.id, {
      id: job.id,
      title: job.title?.trim() || job.jobNumber || "Job",
      address: job.address?.trim() || "",
      timeLabel: formatTimeRange(job.scheduledStartTime, job.scheduledEndTime),
      people,
      kit: kitLabels(job.equipment),
      bookedLabel: formatBookedAmount(bookedAmount),
      bookedAmount,
      riskAssessmentStatus: riskLinks.get(job.id)?.riskAssessmentStatus ?? "none",
      riskAssessmentId: riskLinks.get(job.id)?.riskAssessmentId ?? null,
    });
  }

  const groups = assignJobsToCrews(
    jobsToday.map((job) => ({
      id: job.id,
      peopleIds: jobPeopleIds.get(job.id) ?? [],
      startMinutes: parseClockToMinutes(job.scheduledStartTime),
    })),
    activeTeams.map((team) => ({
      id: team.id,
      name: team.name,
      memberIds: team.members ?? [],
    })),
  );

  const teamById = new Map(activeTeams.map((team) => [team.id, team]));
  const notes: TodayNote[] = extraNotes.map((row) => {
    const scope: TodayScope = row.scope === "crew" ? "crew" : "person";
    if (scope === "crew") {
      const team = row.crewId ? teamById.get(row.crewId) : undefined;
      return {
        id: row.id,
        scope,
        targetId: row.crewId || "",
        targetName: team?.name || "Crew",
        note: row.note,
        color: colorForId(row.crewId || row.id, CREW_PALETTE),
      };
    }
    const person = row.personId ? personFor(row.personId) : null;
    return {
      id: row.id,
      scope,
      targetId: row.personId || "",
      targetName: person?.displayName || "Person",
      note: row.note,
      color: person?.color || colorForId(row.personId || row.id, PEOPLE_PALETTE),
    };
  });

  const crews: TodayCrewGroup[] = groups.map((group) => {
    const jobs = group.jobIds
      .map((id) => jobRowsById.get(id))
      .filter((job): job is TodayJobRow => job !== undefined);
    const peopleOnJobs = uniqueIds(...jobs.map((job) => job.people.map((person) => person.id)));
    if (group.crewId === NO_CREW_ID) {
      const members = peopleOnJobs.map(personFor).filter((person): person is TodayPerson => person !== null);
      return {
        id: NO_CREW_ID,
        name: NO_CREW_NAME,
        color: colorForId(NO_CREW_ID, CREW_PALETTE),
        members,
        notesCount: 0,
        jobs,
      };
    }
    const team = teamById.get(group.crewId);
    const rosterIds = uniqueIds(team?.members ?? [], peopleOnJobs).filter((id) => peopleOnJobs.includes(id));
    const members = rosterIds.map(personFor).filter((person): person is TodayPerson => person !== null);
    return {
      id: group.crewId,
      name: team?.name || "Crew",
      color: colorForId(group.crewId, CREW_PALETTE),
      members,
      notesCount: 0,
      jobs,
    };
  });

  for (const crew of crews) {
    const memberIds = new Set(crew.members.map((member) => member.id));
    crew.notesCount = notes.filter((note) => {
      if (note.scope === "crew") return note.targetId === crew.id;
      return memberIds.has(note.targetId);
    }).length;
  }

  const allJobs = crews.flatMap((crew) => crew.jobs);
  const peopleOut = new Set(allJobs.flatMap((job) => job.people.map((person) => person.id)));
  const booked = allJobs.reduce((sum, job) => sum + job.bookedAmount, 0);

  const peopleOptions = employees
    .filter((employee) => employee.isActive !== false)
    .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName))
    .map((employee) => personFromEmployee(employee, firstNameCounts));

  const crewOptions = activeTeams
    .map((team) => ({ id: team.id, name: team.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const overview: TodayOverviewData = {
    date: todayStr,
    dateLabel: formatTodayHeading(todayStr),
    businessName: settings.businessName?.trim() || "",
    currentEmployeeId: employeeId,
    counts: {
      jobsToday: allJobs.length,
      crewsLive: crews.length,
      peopleOut: peopleOut.size,
      bookedLabel: formatBookedAmount(booked),
      extraNotes: notes.length,
    },
    notes,
    crews,
    peopleOptions,
    crewOptions,
  };

  return applyTodayView(overview, "all", employeeId);
}

export async function createTodayExtraInstruction(input: {
  employeeId: string;
  date?: string;
  scope: TodayScope;
  personId?: string;
  crewId?: string;
  note: string;
}): Promise<schema.DailyOpsNote> {
  const date = input.date || getNZDateString(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError("date must be YYYY-MM-DD", 400);
  }
  const note = input.note.trim();
  if (!note) {
    throw new HttpError("note is required", 400);
  }
  if (input.scope === "person") {
    if (!input.personId) {
      throw new HttpError("personId is required", 400);
    }
  } else if (input.scope === "crew") {
    if (!input.crewId) {
      throw new HttpError("crewId is required", 400);
    }
  } else {
    throw new HttpError("scope must be person or crew", 400);
  }

  const [row] = await db
    .insert(schema.dailyOpsNotes)
    .values(
      withTenant({
        date,
        scope: input.scope,
        personId: input.scope === "person" ? input.personId : null,
        crewId: input.scope === "crew" ? input.crewId : null,
        note,
        createdBy: input.employeeId,
      }),
    )
    .returning();
  return row;
}

export async function deleteTodayExtraInstruction(id: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.dailyOpsNotes)
    .where(eq(schema.dailyOpsNotes.id, id))
    .returning({ id: schema.dailyOpsNotes.id });
  return deleted.length > 0;
}
