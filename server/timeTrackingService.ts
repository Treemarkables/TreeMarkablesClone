import { randomUUID } from "crypto";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "./db";
import {
  dailyTimeEntries,
  jobTimeEntries,
  staffRates,
  type DailyTimeEntry, type InsertDailyTimeEntry,
  type JobTimeEntry, type InsertJobTimeEntry,
  type StaffRate, type InsertStaffRate,
  type EfficiencyMetrics, type StaffEfficiencyReport
} from "../shared/timeTracking";

/**
 * ServiceM8-style Time Tracking Service
 * Handles daily time entries, job time tracking, staff rates, and efficiency calculations
 */
export class TimeTrackingService {

  // ========================================
  // DAILY TIME ENTRY MANAGEMENT
  // ========================================

  async createDailyTimeEntry(entry: InsertDailyTimeEntry): Promise<DailyTimeEntry> {
    const [created] = await db.insert(dailyTimeEntries).values(entry).returning();
    return created;
  }

  async getDailyTimeEntry(employeeId: string, entryDate: string): Promise<DailyTimeEntry | undefined> {
    const [entry] = await db.select()
      .from(dailyTimeEntries)
      .where(and(eq(dailyTimeEntries.employeeId, employeeId), eq(dailyTimeEntries.entryDate, entryDate)))
      .limit(1);
    return entry;
  }

  async updateDailyTimeEntry(id: string, updates: Partial<InsertDailyTimeEntry>): Promise<DailyTimeEntry> {
    const [updated] = await db.update(dailyTimeEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dailyTimeEntries.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Daily time entry with id ${id} not found`);
    }
    return updated;
  }

  async getDailyTimeEntries(
    employeeId?: string, 
    fromDate?: string, 
    toDate?: string
  ): Promise<DailyTimeEntry[]> {
    const conditions = [];
    
    if (employeeId) {
      conditions.push(eq(dailyTimeEntries.employeeId, employeeId));
    }
    if (fromDate && !toDate) {
      // Single date query
      conditions.push(eq(dailyTimeEntries.entryDate, fromDate));
    } else if (fromDate && toDate) {
      // Date range query
      conditions.push(gte(dailyTimeEntries.entryDate, fromDate));
      conditions.push(lte(dailyTimeEntries.entryDate, toDate));
    } else if (!fromDate && toDate) {
      // Upper bound only
      conditions.push(lte(dailyTimeEntries.entryDate, toDate));
    }

    const entries = await db.select()
      .from(dailyTimeEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(dailyTimeEntries.entryDate);
    
    return entries;
  }

  // ========================================
  // JOB TIME ENTRY MANAGEMENT
  // ========================================

  async createJobTimeEntry(entry: InsertJobTimeEntry): Promise<JobTimeEntry> {
    const [created] = await db.insert(jobTimeEntries).values(entry).returning();
    return created;
  }

  async getJobTimeEntries(jobId: string, entryDate?: string): Promise<JobTimeEntry[]> {
    const conditions = [eq(jobTimeEntries.jobId, jobId)];
    
    if (entryDate) {
      conditions.push(eq(jobTimeEntries.entryDate, entryDate));
    }

    const entries = await db.select()
      .from(jobTimeEntries)
      .where(and(...conditions))
      .orderBy(jobTimeEntries.createdAt);
    
    return entries;
  }

  async updateJobTimeEntry(id: string, updates: Partial<InsertJobTimeEntry>): Promise<JobTimeEntry> {
    const [updated] = await db.update(jobTimeEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobTimeEntries.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Job time entry with id ${id} not found`);
    }
    return updated;
  }

  async deleteJobTimeEntry(id: string): Promise<boolean> {
    const result = await db.delete(jobTimeEntries)
      .where(eq(jobTimeEntries.id, id));
    return result.rowCount > 0;
  }

  /**
   * Get job time entries by employee within a date range
   * Used for calculating billable hours vs Xero paid hours
   */
  async getJobTimeEntriesByEmployee(
    employeeId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<JobTimeEntry[]> {
    const conditions = [eq(jobTimeEntries.employeeId, employeeId)];

    if (fromDate) {
      conditions.push(gte(jobTimeEntries.entryDate, fromDate));
    }
    if (toDate) {
      conditions.push(lte(jobTimeEntries.entryDate, toDate));
    }

    const entries = await db.select()
      .from(jobTimeEntries)
      .where(and(...conditions))
      .orderBy(jobTimeEntries.entryDate);

    return entries;
  }

  // ========================================
  // STAFF RATE MANAGEMENT
  // ========================================

  async createStaffRate(rate: InsertStaffRate): Promise<StaffRate> {
    const [created] = await db.insert(staffRates).values(rate).returning();
    return created;
  }

  async getStaffRates(employeeId?: string, serviceType?: string): Promise<StaffRate[]> {
    const conditions = [eq(staffRates.isActive, true)];

    if (employeeId) {
      conditions.push(eq(staffRates.employeeId, employeeId));
    }

    if (serviceType) {
      conditions.push(eq(staffRates.serviceType, serviceType));
    }

    const rates = await db.select()
      .from(staffRates)
      .where(and(...conditions))
      .orderBy(staffRates.effectiveDate);
    
    return rates;
  }

  async getActiveStaffRate(employeeId: string, serviceType: string): Promise<StaffRate | undefined> {
    const [rate] = await db.select()
      .from(staffRates)
      .where(and(
        eq(staffRates.employeeId, employeeId),
        eq(staffRates.serviceType, serviceType),
        eq(staffRates.isActive, true)
      ))
      .orderBy(staffRates.effectiveDate)
      .limit(1);
    return rate;
  }

  async updateStaffRate(id: string, updates: Partial<InsertStaffRate>): Promise<StaffRate> {
    const [updated] = await db.update(staffRates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(staffRates.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Staff rate with id ${id} not found`);
    }
    return updated;
  }

  // ========================================
  // EFFICIENCY CALCULATIONS
  // ========================================

  calculateEfficiencyMetrics(
    totalDayHours: number,
    billableHours: number,
    travelHours: number = 0,
    maintenanceHours: number = 0,
    adminHours: number = 0
  ): EfficiencyMetrics {
    const nonBillableHours = travelHours + maintenanceHours + adminHours;
    const jobEfficiency = totalDayHours > 0 ? (billableHours / totalDayHours) * 100 : 0;
    const utilizationRate = totalDayHours > 0 ? ((billableHours + travelHours) / totalDayHours) * 100 : 0;
    const productivityRate = totalDayHours > 0 ? ((billableHours + travelHours + adminHours + maintenanceHours) / totalDayHours) * 100 : 0;

    return {
      jobEfficiency: Math.round(jobEfficiency * 100) / 100,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      productivityRate: Math.round(productivityRate * 100) / 100,
      billableHours,
      nonBillableHours,
      totalHours: totalDayHours,
    };
  }

  async calculateStaffEfficiency(employeeId: string, fromDate: string, toDate: string): Promise<StaffEfficiencyReport> {
    const dailyEntries = await this.getDailyTimeEntries(employeeId, fromDate, toDate);
    const jobEntries = await db.select()
      .from(jobTimeEntries)
      .where(and(
        eq(jobTimeEntries.employeeId, employeeId),
        gte(jobTimeEntries.entryDate, fromDate),
        lte(jobTimeEntries.entryDate, toDate)
      ));

    // Calculate totals
    const totalHours = dailyEntries.reduce((sum, entry) => sum + Number(entry.totalDayHours), 0);
    const billableHours = dailyEntries.reduce((sum, entry) => sum + Number(entry.billableHours), 0);
    const maintenanceHours = dailyEntries.reduce((sum, entry) => sum + Number(entry.maintenanceHours), 0);
    const travelHours = dailyEntries.reduce((sum, entry) => sum + Number(entry.travelHours), 0);
    const adminHours = dailyEntries.reduce((sum, entry) => sum + Number(entry.adminHours), 0);

    const metrics = this.calculateEfficiencyMetrics(
      totalHours,
      billableHours,
      travelHours,
      maintenanceHours,
      adminHours
    );

    // Job breakdown
    const jobBreakdown = jobEntries.map(entry => ({
      jobId: entry.jobId,
      jobNumber: entry.jobNumber,
      hours: Number(entry.hours),
      rate: Number(entry.rate),
      revenue: Number(entry.hours) * Number(entry.rate),
    }));

    const nonBillableBreakdown = {
      maintenance: maintenanceHours,
      travel: travelHours,
      admin: adminHours,
      breaks: Math.max(0, totalHours - billableHours - maintenanceHours - travelHours - adminHours),
    };

    return {
      employeeId,
      employeeName: dailyEntries[0]?.employeeName || "Unknown",
      period: `${fromDate} to ${toDate}`,
      metrics,
      jobBreakdown,
      nonBillableBreakdown,
    };
  }

  async getEfficiencyReports(fromDate: string, toDate: string): Promise<StaffEfficiencyReport[]> {
    // Get unique employee IDs from daily entries in date range
    const entries = await this.getDailyTimeEntries(undefined, fromDate, toDate);
    const employeeIds = Array.from(new Set(
      entries.map(entry => entry.employeeId)
    ));

    const reports = await Promise.all(
      employeeIds.map(employeeId => this.calculateStaffEfficiency(employeeId, fromDate, toDate))
    );

    return reports.sort((a, b) => b.metrics.jobEfficiency - a.metrics.jobEfficiency);
  }

  // ========================================
  // BULK OPERATIONS FOR ServiceM8-STYLE DAILY ENTRY
  // ========================================

  async saveDailyTimeEntry(data: {
    jobId: string;
    employeeId: string;
    employeeName: string;
    entryDate: string;
    totalDayHours: number;
    timeEntries: Array<{
      jobId: string;
      jobNumber: string;
      employeeId: string;
      employeeName: string;
      lineItemId: string;
      lineItemNumber: string;
      lineItemName: string;
      lineItemCategory: string;
      hours: number;
      rate: number;
      startTime?: string;
      billed: boolean;
    }>;
    maintenanceHours: number;
    travelHours: number;
    adminHours: number;
    breakHours: number;
    roundingMode: "none" | "15min" | "30min" | "1hour";
    travelTimeMode: "included" | "excluded" | "separate";
    efficiency?: any;
  }): Promise<{ dailyEntry: DailyTimeEntry; jobEntries: JobTimeEntry[] }> {
    
    // Calculate totals
    const billableHours = data.timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    
    // Calculate efficiency metrics
    const metrics = this.calculateEfficiencyMetrics(
      data.totalDayHours,
      billableHours,
      data.travelHours,
      data.maintenanceHours,
      data.adminHours
    );

    // Create or update daily time entry
    let dailyEntry = await this.getDailyTimeEntry(data.employeeId, data.entryDate);
    
    if (dailyEntry) {
      dailyEntry = await this.updateDailyTimeEntry(dailyEntry.id, {
        totalDayHours: data.totalDayHours.toString(),
        billableHours: billableHours.toString(),
        maintenanceHours: data.maintenanceHours.toString(),
        travelHours: data.travelHours.toString(),
        adminHours: data.adminHours.toString(),
        breakHours: data.breakHours.toString(),
        jobEfficiency: metrics.jobEfficiency.toString(),
        utilizationRate: metrics.utilizationRate.toString(),
        productivityRate: metrics.productivityRate.toString(),
      });
    } else {
      dailyEntry = await this.createDailyTimeEntry({
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        entryDate: data.entryDate,
        totalDayHours: data.totalDayHours.toString(),
        billableHours: billableHours.toString(),
        maintenanceHours: data.maintenanceHours.toString(),
        travelHours: data.travelHours.toString(),
        adminHours: data.adminHours.toString(),
        breakHours: data.breakHours.toString(),
        jobEfficiency: metrics.jobEfficiency.toString(),
        utilizationRate: metrics.utilizationRate.toString(),
        productivityRate: metrics.productivityRate.toString(),
        syncedToXero: false,
      });
    }

    // Create job time entries
    const jobEntries: JobTimeEntry[] = [];
    for (const timeEntry of data.timeEntries) {
      const jobEntry = await this.createJobTimeEntry({
        dailyEntryId: dailyEntry.id,
        jobId: timeEntry.jobId,
        jobNumber: timeEntry.jobNumber,
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        entryDate: data.entryDate,
        lineItemId: timeEntry.lineItemId,
        lineItemNumber: timeEntry.lineItemNumber,
        lineItemName: timeEntry.lineItemName,
        lineItemCategory: timeEntry.lineItemCategory,
        hours: timeEntry.hours.toString(),
        rate: timeEntry.rate.toString(),
        startTime: timeEntry.startTime,
        billed: timeEntry.billed,
        roundingMode: data.roundingMode,
        travelTimeIncluded: data.travelTimeMode === "included",
        syncedToXero: false,
      });
      jobEntries.push(jobEntry);
    }

    return { dailyEntry, jobEntries };
  }

  // ========================================
  // SAMPLE DATA INITIALIZATION
  // ========================================

  async initializeSampleData(): Promise<void> {
    console.log("🕐 Initializing sample time tracking data...");

    // Sample staff rates
    const sampleRates = [
      { employeeId: "d428f28e-95fa-4a85-8c73-9ba123456789", employeeName: "Daniel Thompson", serviceType: "tree-removal", hourlyRate: "45.00" },
      { employeeId: "d428f28e-95fa-4a85-8c73-9ba123456789", employeeName: "Daniel Thompson", serviceType: "pruning", hourlyRate: "40.00" },
      { employeeId: "e529g39f-06gb-5b96-9d84-0cb234567890", employeeName: "Michael Johnson", serviceType: "tree-removal", hourlyRate: "42.00" },
      { employeeId: "e529g39f-06gb-5b96-9d84-0cb234567890", employeeName: "Michael Johnson", serviceType: "stump-grinding", hourlyRate: "38.00" },
    ];

    for (const rate of sampleRates) {
      await this.createStaffRate({
        ...rate,
        isActive: true,
        effectiveDate: new Date(),
      });
    }

    // Sample daily time entries
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await this.saveDailyTimeEntry({
      jobId: "5",
      employeeId: "d428f28e-95fa-4a85-8c73-9ba123456789",
      employeeName: "Daniel Thompson",
      entryDate: today,
      totalDayHours: 8.0,
      timeEntries: [
        { 
          jobId: "5", 
          jobNumber: "#3291", 
          employeeId: "d428f28e-95fa-4a85-8c73-9ba123456789", 
          employeeName: "Daniel Thompson",
          lineItemId: "1",
          lineItemNumber: "11",
          lineItemName: "Call out",
          lineItemCategory: "Labour",
          hours: 4.5, 
          rate: 45.00, 
          startTime: "08:00", 
          billed: true 
        },
        { 
          jobId: "5", 
          jobNumber: "#3291", 
          employeeId: "d428f28e-95fa-4a85-8c73-9ba123456789", 
          employeeName: "Daniel Thompson",
          lineItemId: "2",
          lineItemNumber: "15",
          lineItemName: "Tree Pruning",
          lineItemCategory: "Labour",
          hours: 2.0, 
          rate: 75.00, 
          startTime: "13:00", 
          billed: false 
        },
      ],
      maintenanceHours: 1.0,
      travelHours: 0.5,
      adminHours: 0,
      breakHours: 0,
      roundingMode: "15min",
      travelTimeMode: "included",
    });

    console.log("✅ Sample time tracking data initialized");
  }
}

// Export singleton instance
export const timeTrackingService = new TimeTrackingService();