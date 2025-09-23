import { z } from "zod";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";

// Daily Time Entry Schema - ServiceM8 Style
export const dailyTimeEntries = pgTable("daily_time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  entryDate: text("entry_date").notNull(), // YYYY-MM-DD format
  totalDayHours: decimal("total_day_hours", { precision: 4, scale: 2 }).notNull(), // 8.0, 7.5, etc
  
  // Job time breakdown
  billableHours: decimal("billable_hours", { precision: 4, scale: 2 }).default("0"),
  maintenanceHours: decimal("maintenance_hours", { precision: 4, scale: 2 }).default("0"),
  travelHours: decimal("travel_hours", { precision: 4, scale: 2 }).default("0"),
  adminHours: decimal("admin_hours", { precision: 4, scale: 2 }).default("0"),
  breakHours: decimal("break_hours", { precision: 4, scale: 2 }).default("0"),
  
  // Efficiency metrics (calculated)
  jobEfficiency: decimal("job_efficiency", { precision: 5, scale: 2 }), // Billable / Total * 100
  utilizationRate: decimal("utilization_rate", { precision: 5, scale: 2 }), // (Billable + Travel) / Total * 100
  productivityRate: decimal("productivity_rate", { precision: 5, scale: 2 }), // (Billable + Travel + Admin + Maintenance) / Total * 100
  
  // Xero integration
  xeroProjectId: text("xero_project_id"),
  syncedToXero: boolean("synced_to_xero").default(false),
  xeroSyncDate: timestamp("xero_sync_date"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual Time Entry for Jobs - ServiceM8 Style
export const jobTimeEntries = pgTable("job_time_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dailyEntryId: varchar("daily_entry_id").references(() => dailyTimeEntries.id).notNull(),
  jobId: varchar("job_id").notNull(),
  jobNumber: text("job_number").notNull(),
  employeeId: varchar("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  
  // Service-based tracking
  serviceType: text("service_type").notNull(), // tree_removal, pruning, stump_grinding, etc
  serviceName: text("service_name").notNull(), // Display name like "Tree Removal", "Hedge Trimming"
  
  // Time details
  entryDate: text("entry_date").notNull(), // YYYY-MM-DD
  startTime: text("start_time"), // HH:MM format, optional
  hours: decimal("hours", { precision: 4, scale: 2 }).notNull(),
  rate: decimal("rate", { precision: 6, scale: 2 }).notNull(), // Hourly rate for this service
  
  // Job line item creation tracking
  serviceLineItemCreated: boolean("service_line_item_created").default(false),
  laborLineItemCreated: boolean("labor_line_item_created").default(false),
  serviceLineItemId: text("service_line_item_id"), // Reference to created service line item
  laborLineItemId: text("labor_line_item_id"), // Reference to created labor line item
  
  // ServiceM8 features
  billed: boolean("billed").default(false),
  roundingMode: text("rounding_mode").default("none"), // none, 15min, 30min, 1hour
  travelTimeIncluded: boolean("travel_time_included").default(false),
  
  // Xero integration
  xeroTimeId: text("xero_time_id"), // Reference to Xero time entry
  syncedToXero: boolean("synced_to_xero").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staff Rate Matrix - Different rates per staff per service type
export const staffRates = pgTable("staff_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  serviceType: text("service_type").notNull(), // tree-removal, pruning, stump-grinding, etc
  hourlyRate: decimal("hourly_rate", { precision: 6, scale: 2 }).notNull(),
  effectiveDate: timestamp("effective_date").defaultNow(),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas for API validation
export const insertDailyTimeEntrySchema = createInsertSchema(dailyTimeEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJobTimeEntrySchema = createInsertSchema(jobTimeEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStaffRateSchema = createInsertSchema(staffRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Form validation schemas
export const dailyTimeFormSchema = z.object({
  totalDayHours: z.string().min(1, "Total hours required"),
  jobEntries: z.array(z.object({
    jobId: z.string().min(1, "Job required"),
    jobNumber: z.string().min(1, "Job number required"),
    employeeId: z.string().min(1, "Employee required"),
    employeeName: z.string().min(1, "Employee name required"),
    serviceType: z.string().min(1, "Service type required"),
    serviceName: z.string().min(1, "Service name required"),
    hours: z.string().min(1, "Hours required"),
    rate: z.string().min(1, "Rate required"),
    startTime: z.string().optional(),
    billed: z.boolean().default(false),
    roundingMode: z.enum(["none", "15min", "30min", "1hour"]).default("none"),
    travelTimeIncluded: z.boolean().default(false),
  })),
  maintenanceHours: z.string().default("0"),
  travelHours: z.string().default("0"),
  adminHours: z.string().default("0"),
  breakHours: z.string().default("0"),
});

export const staffRateFormSchema = z.object({
  employeeId: z.string().min(1, "Employee required"),
  serviceType: z.string().min(1, "Service type required"),
  hourlyRate: z.string().min(1, "Rate required"),
});

// Type exports
export type DailyTimeEntry = typeof dailyTimeEntries.$inferSelect;
export type InsertDailyTimeEntry = z.infer<typeof insertDailyTimeEntrySchema>;
export type JobTimeEntry = typeof jobTimeEntries.$inferSelect;
export type InsertJobTimeEntry = z.infer<typeof insertJobTimeEntrySchema>;
export type StaffRate = typeof staffRates.$inferSelect;
export type InsertStaffRate = z.infer<typeof insertStaffRateSchema>;
export type DailyTimeFormData = z.infer<typeof dailyTimeFormSchema>;
export type StaffRateFormData = z.infer<typeof staffRateFormSchema>;

// Efficiency calculation types
export interface EfficiencyMetrics {
  jobEfficiency: number; // Billable / Total * 100
  utilizationRate: number; // (Billable + Travel) / Total * 100
  productivityRate: number; // (Billable + Travel + Admin + Maintenance) / Total * 100
  billableHours: number;
  nonBillableHours: number;
  totalHours: number;
}

export interface StaffEfficiencyReport {
  employeeId: string;
  employeeName: string;
  period: string; // daily, weekly, monthly
  metrics: EfficiencyMetrics;
  jobBreakdown: Array<{
    jobId: string;
    jobNumber: string;
    hours: number;
    rate: number;
    revenue: number;
  }>;
  nonBillableBreakdown: {
    maintenance: number;
    travel: number;
    admin: number;
    breaks: number;
  };
}