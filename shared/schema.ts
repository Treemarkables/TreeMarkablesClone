import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, jsonb, real, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ServiceM8 GST & Tax Types
export const TaxModeEnum = z.enum(['cost_markup', 'tax_inclusive', 'tax_exclusive']);
export type TaxMode = z.infer<typeof TaxModeEnum>;

// ServiceM8 Line Item Types
export const ServiceM8LineItemSchema = z.object({
  id: z.string(),
  itemCode: z.string().optional(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  unitCost: z.number(),
  totalCost: z.number(),
  costExGst: z.number().optional(),
  markup: z.number().optional(),
  priceExGst: z.number().optional(),
  totalExGst: z.number().optional(),
  taxRate: z.number().default(15), // New Zealand GST 15%
  priceIncludesTax: z.boolean().default(false), // GST inclusive/exclusive toggle
});

export type ServiceM8LineItem = z.infer<typeof ServiceM8LineItemSchema>;

// Proposal section schema for ServiceM8-style proposals
export const proposalSectionSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'media', 'lineItems']),
  title: z.string(),
  content: z.string().optional(), // Rich text HTML for text sections
  mediaUrls: z.array(z.string()).optional(), // Photo/video URLs for media sections
  order: z.number(),
});

export type ProposalSection = z.infer<typeof proposalSectionSchema>;

// Checklist item schema for jobs
export const checklistItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Checklist item cannot be empty"),
  completed: z.boolean().default(false),
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;

// Equipment checklist item schema for jobs
export const equipmentChecklistItemSchema = z.object({
  id: z.string(),
  equipment: z.string().min(1, "Equipment name cannot be empty"),
  checked: z.boolean().default(false),
  checkedAt: z.string().optional(),
  checkedBy: z.string().optional(),
  notes: z.string().optional(),
});

export type EquipmentChecklistItem = z.infer<typeof equipmentChecklistItemSchema>;

// GST Calculation Types
export interface GSTCalculation {
  subtotal: number;
  gstAmount: number;
  totalIncludingGst: number;
  taxMode: TaxMode;
  taxRate: number;
}

// ServiceM8 Billing Summary
export interface BillingSummary {
  subtotal: number;
  gst: number;
  total: number;
  paid: number;
  balanceDue: number;
}


// Lead Source Tracking Schema
export const leadSourceSchema = z.object({
  pagePath: z.string().max(512).optional(),
  pageUrl: z.string().max(512).optional(), 
  referrer: z.string().max(512).optional(),
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
  utmTerm: z.string().max(255).optional(),
  utmContent: z.string().max(255).optional(),
  gclid: z.string().max(255).optional(),
  gaClientId: z.string().max(255).optional(),
  firstTouchPagePath: z.string().max(512).optional(),
  firstTouchPageUrl: z.string().max(512).optional(),
  firstTouchReferrer: z.string().max(512).optional(),
  firstTouchUtmSource: z.string().max(255).optional(),
  firstTouchUtmMedium: z.string().max(255).optional(),
  firstTouchUtmCampaign: z.string().max(255).optional(),
});

// Contact Form Data Schema
export const contactFormSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255).transform(val => val.toLowerCase()),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  hearAbout: z.string().max(255).optional(),
  message: z.string().min(1).max(5000),
});

// Lead Submission Schema (combines contact form + lead source + server data)
export const leadSubmissionSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  // Contact form data
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  address: z.string().optional(),
  hearAbout: z.string().optional(),
  message: z.string(),
  // Lead source data
  leadSource: leadSourceSchema.optional(),
  // Server captured data
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});

export type LeadSource = z.infer<typeof leadSourceSchema>;
export type ContactFormData = z.infer<typeof contactFormSchema>;
export type LeadSubmission = z.infer<typeof leadSubmissionSchema>;
export type InsertLeadSubmission = Omit<LeadSubmission, 'id' | 'createdAt'>;

// ========================================
// COMPREHENSIVE BUSINESS SYSTEM SCHEMAS
// ========================================

// Job Status Enum
export const JobStatus = z.enum(['lead', 'quote', 'mulch', 'scheduled', 'work_order', 'completed', 'unsuccessful']);
export type JobStatusType = z.infer<typeof JobStatus>;

export const LeadSourceType = z.enum(['phone', 'website', 'referral', 'friend', 'saw_working', 'repeat', 'google', 'facebook', 'direct', 'advertisement', 'council', 'other']);
export type LeadSourceTypeType = z.infer<typeof LeadSourceType>;

// Team Management
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  teamLeaderId: varchar("team_leader_id"),
  members: text("members").array(), // Staff IDs
  specialties: text("specialties").array(), // crane operation, emergency response, etc
  maxCapacity: integer("max_capacity").default(4),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer Import Batches - Track import sessions
export const customerImportBatches = pgTable("customer_import_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  importType: text("import_type").notNull(), // csv_upload, manual_entry, servicem8_sync, api_import
  fileName: text("file_name"), // Original CSV filename if applicable
  totalRecords: integer("total_records").default(0),
  successfulRecords: integer("successful_records").default(0),
  failedRecords: integer("failed_records").default(0),
  duplicatesSkipped: integer("duplicates_skipped").default(0),
  errorDetails: jsonb("error_details"), // Array of error messages and line numbers
  importSettings: jsonb("import_settings"), // Column mappings, validation rules, etc
  status: text("status").notNull().default('pending'), // pending, processing, completed, failed
  createdBy: text("created_by"), // User who initiated the import
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Customer Management
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"), // Mobile phone number
  normalizedPhone: text("normalized_phone"), // Phone with all non-digits stripped for efficient matching
  address: text("address"),
  city: text("city"),
  region: text("region"),
  notes: text("notes"),
  source: text("source"), // google, referral, facebook, etc - lead generation source
  importSource: text("import_source").default('manual'), // manual, csv_import, servicem8_sync, api_import
  importBatchId: varchar("import_batch_id").references(() => customerImportBatches.id), // Which import batch this customer came from
  externalId: text("external_id"), // External system ID for mapping (ServiceM8 UUID, CRM ID, etc)
  servicem8Uuid: text("servicem8_uuid"), // ServiceM8 company UUID for import mapping
  lifetimeValue: decimal("lifetime_value", { precision: 10, scale: 2 }).default("0"),
  totalJobs: integer("total_jobs").default(0),
  lastContactDate: timestamp("last_contact_date"),
  preferredContactMethod: text("preferred_contact_method"), // phone, email, sms
  tags: text("tags").array(), // loyal, difficult, high-value, etc
  isActive: boolean("is_active").default(true),
  isVipMember: boolean("is_vip_member").default(false),
  vipMemberSince: timestamp("vip_member_since"),
  vipDiscountPercent: decimal("vip_discount_percent", { precision: 5, scale: 2 }),
  invoiceCcEmail: text("invoice_cc_email"), // Auto-CC this address on every invoice email
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  normalizedPhoneIdx: index("customers_normalized_phone_idx").on(table.normalizedPhone),
}));

// Customer Contacts — multiple people under one customer organisation.
// Used for clients like councils, real-estate agencies, and property
// managers where different departments/people book jobs with their own
// email/phone/role. Each job picks one contact via jobs.customerContactId,
// which auto-populates the per-job jobContact* override fields.
export const customerContacts = pgTable("customer_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role"), // e.g. "Roads Manager", "Parks Coordinator", "Property Manager"
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  normalizedPhone: text("normalized_phone"), // for matching, mirrors the customers table
  address: text("address"), // optional override; jobs default to the customer address
  notes: text("notes"),
  isPrimary: boolean("is_primary").default(false), // mark the default contact for this customer
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  customerIdx: index("customer_contacts_customer_id_idx").on(table.customerId),
  normalizedPhoneIdx: index("customer_contacts_normalized_phone_idx").on(table.normalizedPhone),
}));

// Customer Communication Preferences
export const communicationPreferences = pgTable("communication_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: 'cascade' }),
  emailEnabled: boolean("email_enabled").default(true),
  smsEnabled: boolean("sms_enabled").default(true),
  marketingOptIn: boolean("marketing_opt_in").default(false),
  jobNotifications: boolean("job_notifications").default(true),
  quoteNotifications: boolean("quote_notifications").default(true),
  reminderNotifications: boolean("reminder_notifications").default(true),
  emergencyNotifications: boolean("emergency_notifications").default(true),
  preferredNotificationTime: text("preferred_notification_time"), // morning, afternoon, evening
  quietHoursStart: text("quiet_hours_start"), // 22:00
  quietHoursEnd: text("quiet_hours_end"), // 08:00
  timezone: text("timezone").default("Pacific/Auckland"),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Lead Pipeline Management  
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  serviceRequested: text("service_requested"), // tree removal, hedge trimming, etc
  urgency: text("urgency"), // low, medium, high, emergency
  status: text("status").notNull(), // new, contacted, qualified, quoted, won, lost
  source: text("source"), // phone, website, referral, google, facebook
  notes: text("notes"),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  followUpDate: timestamp("follow_up_date"),
  lostReason: text("lost_reason"), // price, timing, competitor, scope, other
  lostReasonDetails: text("lost_reason_details"),
  assignedTo: text("assigned_to"), // team member
  leadSource: jsonb("lead_source"), // detailed tracking data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Call Recording & Management
export const calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
  customerId: varchar("customer_id").references(() => customers.id),
  phoneNumber: text("phone_number").notNull(),
  direction: text("direction").notNull(), // inbound, outbound
  status: text("status"), // answered, missed, busy, failed
  duration: integer("duration"), // seconds
  recordingUrl: text("recording_url"),
  transcriptText: text("transcript_text"),
  summary: text("summary"), // AI-generated call summary
  intent: text("intent"), // quote_request, emergency, follow_up, complaint
  sentiment: text("sentiment"), // positive, neutral, negative
  qualityScore: decimal("quality_score", { precision: 3, scale: 2 }), // AI quality rating
  actionItems: text("action_items").array(),
  callCost: decimal("call_cost", { precision: 6, scale: 4 }),
  twilioCallSid: text("twilio_call_sid"),
  createdAt: timestamp("created_at").defaultNow(),
});

// API Keys for Mobile App Authentication
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  createdBy: text("created_by").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Quote Management
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
  jobId: varchar("job_id").references(() => jobs.id),
  customerId: varchar("customer_id").references(() => customers.id),
  quoteNumber: text("quote_number").notNull().unique(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  validUntil: timestamp("valid_until"),
  status: text("status").notNull(), // draft, sent, viewed, accepted, rejected, expired
  sentDate: timestamp("sent_date"),
  viewedDate: timestamp("viewed_date"),
  responseDate: timestamp("response_date"),
  rejectionReason: text("rejection_reason"),
  competitorName: text("competitor_name"),
  competitorPrice: decimal("competitor_price", { precision: 10, scale: 2 }),
  priceAdjustmentReason: text("price_adjustment_reason"),
  lineItems: jsonb("line_items"), // detailed breakdown
  terms: text("terms"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Follow-up tracking
  followUpStatus: text("follow_up_status").default("pending"), // pending, contacted, no_answer, callback_scheduled, not_interested, converted
  followUpCount: integer("follow_up_count").default(0),
  lastFollowUpDate: timestamp("last_follow_up_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  followUpNotes: text("follow_up_notes"),
  // Presentation method tracking for conversion rate analysis
  presentationMethod: text("presentation_method"), // on-site, sent-later, phone
});

// Job Management
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id),
  // Optional pointer to a saved contact under the customer (see customerContacts).
  // When set, the job's jobContact* fields default from this contact but remain
  // independently editable so historical jobs aren't rewritten if the contact
  // record is later updated.
  customerContactId: varchar("customer_contact_id").references(() => customerContacts.id, { onDelete: "set null" }),
  quoteId: varchar("quote_id").references(() => quotes.id),
  jobNumber: text("job_number").notNull().unique(),
  title: text("title"),
  description: text("description"),
  includeDescriptionInQuotesProposals: boolean("include_description_in_quotes_proposals").default(true),
  leadSource: text("lead_source"), // phone, website, referral, google, facebook, direct, other
  address: text("address").notNull().default("Address not specified"),
  scheduledDate: timestamp("scheduled_date"),
  scheduledEndDate: timestamp("scheduled_end_date"), // For multi-day jobs — last day of the job
  scheduledStartTime: text("scheduled_start_time"), // e.g., "08:00"
  scheduledEndTime: text("scheduled_end_time"), // e.g., "10:00"
  completedDate: timestamp("completed_date"),
  workOrderAt: timestamp("work_order_at"), // Timestamp set when the job first transitions to status 'work_order' (i.e. quote accepted). Used by the Dispatch Board to FIFO-sort work orders by acceptance time; stable across subsequent edits.
  status: text("status").notNull().default('quote'), // lead, quote, mulch, scheduled, work_order, completed, unsuccessful
  priority: text("priority"), // low, medium, high, urgent
  assignedTeam: text("assigned_team").array(),
  assignedTo: text("assigned_to").array(), // Employee IDs for calendar display
  estimatedDuration: integer("estimated_duration"), // hours
  actualDuration: integer("actual_duration"), // hours
  equipment: text("equipment").array(),
  specialInstructions: text("special_instructions"),
  beforePhotos: text("before_photos").array(),
  afterPhotos: text("after_photos").array(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  costOfGoods: decimal("cost_of_goods", { precision: 10, scale: 2 }),
  laborCosts: decimal("labor_costs", { precision: 10, scale: 2 }),
  materialsCosts: decimal("materials_costs", { precision: 10, scale: 2 }),
  otherCosts: decimal("other_costs", { precision: 10, scale: 2 }),
  grossMargin: decimal("gross_margin", { precision: 5, scale: 2 }),
  grossMarginCalculated: boolean("gross_margin_calculated").default(false),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }),
  laborHours: decimal("labor_hours", { precision: 8, scale: 2 }),
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }),
  
  // Man-Hours Tracking & Estimation Accuracy
  estimatedManHours: decimal("estimated_man_hours", { precision: 8, scale: 2 }), // People × Scheduled Hours
  actualManHours: decimal("actual_man_hours", { precision: 8, scale: 2 }), // Sum of time tracking entries
  estimationAccuracy: decimal("estimation_accuracy", { precision: 5, scale: 2 }), // (1 - |estimated - actual| / estimated) × 100
  estimationVariance: decimal("estimation_variance", { precision: 8, scale: 2 }), // actual - estimated (positive = over, negative = under)
  
  // Enhanced Expense Tracking
  actualLaborCosts: decimal("actual_labor_costs", { precision: 10, scale: 2 }),
  actualMaterialsCosts: decimal("actual_materials_costs", { precision: 10, scale: 2 }),
  equipmentCosts: decimal("equipment_costs", { precision: 10, scale: 2 }),
  subcontractorCosts: decimal("subcontractor_costs", { precision: 10, scale: 2 }),
  permitCosts: decimal("permit_costs", { precision: 10, scale: 2 }),
  travelCosts: decimal("travel_costs", { precision: 10, scale: 2 }),
  disposalCosts: decimal("disposal_costs", { precision: 10, scale: 2 }),
  miscExpenses: decimal("misc_expenses", { precision: 10, scale: 2 }),
  
  // Expense Completion Status
  laborCostsComplete: boolean("labor_costs_complete").default(false),
  materialsCostsComplete: boolean("materials_costs_complete").default(false),
  equipmentCostsComplete: boolean("equipment_costs_complete").default(false),
  subcontractorCostsComplete: boolean("subcontractor_costs_complete").default(false),
  otherExpensesComplete: boolean("other_expenses_complete").default(false),
  allExpensesComplete: boolean("all_expenses_complete").default(false),
  
  // Staff Time Tracking
  staffTimeEntries: jsonb("staff_time_entries"), // [{"employeeId": "123", "hours": 8.5, "rate": 45.00, "date": "2024-12-22"}]
  totalStaffHours: decimal("total_staff_hours", { precision: 8, scale: 2 }),
  calculatedLaborCost: decimal("calculated_labor_cost", { precision: 10, scale: 2 }),
  
  // Staff Assignments for Profit Tracking
  assignedStaffIds: text("assigned_staff_ids").array(), // ["staff-id-1", "staff-id-2"]
  staffAssignments: jsonb("staff_assignments"), // [{"staffId": "123", "lineItemId": "abc", "hours": 4.5}]
  
  // Invoice Protection
  invoiceBlocked: boolean("invoice_blocked").default(true),
  marginMeetsThreshold: boolean("margin_meets_threshold").default(false),
  minimumMarginThreshold: decimal("minimum_margin_threshold", { precision: 5, scale: 2 }).default('25.00'),
  invoiceEligible: boolean("invoice_eligible").default(false),
  
  // Global Job Card Fields
  checklist: jsonb("checklist").$type<ChecklistItem[]>().notNull().default(sql`'[]'::jsonb`), // [{"id": "uuid", "text": "Task description", "completed": false}]
  equipmentChecklist: jsonb("equipment_checklist").$type<EquipmentChecklistItem[]>().notNull().default(sql`'[]'::jsonb`), // [{"id": "uuid", "equipment": "Chainsaw", "checked": false, "checkedAt": "timestamp", "checkedBy": "name"}]
  // Per-job role completion. Truth = presence of *CompletedAt timestamps. *CompletedBy is the employee id (nullable).
  roleACompletedAt: timestamp("role_a_completed_at"),
  roleACompletedBy: varchar("role_a_completed_by"),
  roleBCompletedAt: timestamp("role_b_completed_at"),
  roleBCompletedBy: varchar("role_b_completed_by"),
  notes: text("notes"), // Job notes and comments
  internalNotes: text("internal_notes"), // Staff-only internal notes — never shown to customers
  lineItems: jsonb("line_items").$type<ServiceM8LineItem[]>().notNull().default(sql`'[]'::jsonb`), // [{"id": "string", "description": "string", "quantity": number, "unitPrice": number, "total": number, "unitCost": number, "totalCost": number, "costExGst": number, "markup": number, "priceExGst": number, "totalExGst": number, "taxRate": number, "itemCode": string}]
  
  // ServiceM8-Style Proposal Sections
  proposalTitle: text("proposal_title"),
  proposalSections: jsonb("proposal_sections").notNull().default(sql`'[]'::jsonb`), // [{"id": "string", "type": "text" | "media" | "lineItems", "title": "string", "content": "string", "mediaUrls": ["string"], "order": number}]
  proposalSent: boolean("proposal_sent").default(false),
  proposalSentDate: timestamp("proposal_sent_date"),
  
  // Quote Presentation Method Tracking - on_site vs sent_later analytics
  quotePresentationMethod: text("quote_presentation_method"), // 'on_site' or 'sent_later'
  quotePresentedDate: timestamp("quote_presented_date"), // When the quote was presented to customer
  
  weatherDependent: boolean("weather_dependent").default(false),
  permitRequired: boolean("permit_required").default(false),
  insuranceClaim: boolean("insurance_claim").default(false),
  rescheduledReason: text("rescheduled_reason"),
  
  // Fresh Start Metrics - Only jobs created after implementation count toward business metrics
  metricsEligible: boolean("metrics_eligible").default(false),
  metricsStartDate: timestamp("metrics_start_date"), // Date when clean metrics tracking began
  
  // ServiceM8-Style Billing & GST Fields
  billingAddress: text("billing_address"),
  billingNameOverride: text("billing_name_override"), // Override customer name for invoicing (e.g., "Gisborne District Council" instead of contact name)
  city: text("city"),
  region: text("region"),
  invoiceDescription: text("invoice_description"),
  billingContactEmail: text("billing_contact_email"),
  billingContactPhone: text("billing_contact_phone"),
  billingContactMobile: text("billing_contact_mobile"),
  sameAsJobAddress: boolean("same_as_job_address").default(true),
  
  // Job Contact Information
  jobContactFirstName: text("job_contact_first_name"),
  jobContactLastName: text("job_contact_last_name"),
  jobContactEmail: text("job_contact_email"),
  jobContactPhone: text("job_contact_phone"),
  jobContactMobile: text("job_contact_mobile"),

  // Tenant Contact Information — used for properties where the customer is an
  // organisation (or absent owner) and a tenant lives on-site. Automations
  // continue to use Job Contact; this is an opt-in secondary recipient.
  tenantContactFirstName: text("tenant_contact_first_name"),
  tenantContactLastName: text("tenant_contact_last_name"),
  tenantContactEmail: text("tenant_contact_email"),
  tenantContactPhone: text("tenant_contact_phone"),
  tenantContactMobile: text("tenant_contact_mobile"),

  // GST/Tax System (New Zealand 15% GST)
  taxMode: text("tax_mode").default('tax_exclusive'), // cost_markup, tax_inclusive, tax_exclusive
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default('15.00'), // 15% GST
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default('0.00'),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).default('0.00'),
  totalIncludingGst: decimal("total_including_gst", { precision: 10, scale: 2 }).default('0.00'),
  
  // Payment Tracking
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default('0.00'),
  balanceDue: decimal("balance_due", { precision: 10, scale: 2 }).default('0.00'),
  
  // Xero Integration Tracking
  xeroInvoiceId: text("xero_invoice_id"),
  xeroStatus: text("xero_status"), // pending, sent, error
  sentToXeroDate: timestamp("sent_to_xero_date"),
  
  // Unsuccessful Job Tracking
  unsuccessfulReason: text("unsuccessful_reason"), // price_too_high, went_competitor, changed_mind, no_longer_needed, scheduling, other
  unsuccessfulNotes: text("unsuccessful_notes"), // Additional notes explaining why job was unsuccessful
  unsuccessfulDate: timestamp("unsuccessful_date"), // When the job was marked unsuccessful
  
  // Dispatch Queue
  inQueue: boolean("in_queue").default(false),
  queueReason: text("queue_reason"), // Weather Hold, Awaiting Permit, Customer Not Ready, Awaiting Quote Approval, Materials Needed, Crew Unavailable, Other

  // Loom Video
  loomVideoUrl: text("loom_video_url"),

  // Customer confirmation
  customerConfirmed: boolean("customer_confirmed").default(false),
  customerConfirmedAt: timestamp("customer_confirmed_at"),
  customerConfirmationMethod: text("customer_confirmation_method"), // 'manual' | 'sms' | 'email'
  etaNotificationRequested: boolean("eta_notification_requested").default(false),

  // Booking reminders — per-job opt-in. When true, the booking-reminder
  // service will create scheduled SMS/email reminders against this job's
  // scheduledDate using the offsets from business_settings.
  bookingRemindersEnabled: boolean("booking_reminders_enabled").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastActivityAt: timestamp("last_activity_at"),
});

// Job Diary Entries
export const jobDiaryEntries = pgTable("job_diary_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  entryType: text("entry_type").notNull(), // note, progress, issue, milestone, weather, equipment, safety, completion, email
  title: text("title").notNull(),
  description: text("description").notNull(),
  content: text("content"), // Additional content for diary entries
  authorName: text("author_name").notNull(), // Name of person making entry
  authorRole: text("author_role"), // foreman, technician, supervisor, manager
  photos: text("photos").array(), // URLs/paths to related photos
  photoUrl: text("photo_url"), // Single photo URL for quick photo capture
  weatherConditions: text("weather_conditions"), // sunny, rainy, windy, etc
  equipmentUsed: text("equipment_used").array(), // Equipment used during this activity
  timeSpent: integer("time_spent"), // Minutes spent on this activity
  progress: integer("progress"), // Percentage completion (0-100)
  tags: text("tags").array(), // safety, urgent, customer-request, etc
  location: text("location"), // Specific location within job site
  isPrivate: boolean("is_private").default(false), // Internal notes only
  metadata: jsonb("metadata"), // Flexible metadata for proposals, emails, invoices, etc
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tasks — internal work that isn't a customer job: gear maintenance, admin,
// follow-ups, marketing, training. Lives separately from `jobs` (customer
// work). When a task is linked to a job and marked done, an entry is appended
// to that job's diary; recurring tasks auto-spawn the next instance on
// completion. Soft-delete via deletedAt — kept off the board view but
// retained for audit and so recurring chains remain traceable.
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  // equipment, vehicle, admin, sales, marketing, training, yard, compliance, personal
  category: text("category"),
  // urgent, high, normal, low
  priority: text("priority").default("normal"),
  // backlog, todo, in_progress, blocked, done
  status: text("status").notNull().default("todo"),
  blockedReason: text("blocked_reason"), // required when status = 'blocked'
  assigneeId: varchar("assignee_id").references(() => employees.id, { onDelete: "set null" }),
  createdBy: varchar("created_by").references(() => employees.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date"),
  linkedJobId: varchar("linked_job_id").references(() => jobs.id, { onDelete: "set null" }),
  linkedEquipmentId: varchar("linked_equipment_id").references(() => equipment.id, { onDelete: "set null" }),
  recurring: boolean("recurring").default(false),
  recurringIntervalDays: integer("recurring_interval_days"),
  parentTaskId: varchar("parent_task_id"), // self-FK declared below; Drizzle disallows inline self-references
  completedAt: timestamp("completed_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Indexes the kanban + filter views hit on every load.
  statusIdx: index("tasks_status_idx").on(table.status),
  assigneeIdx: index("tasks_assignee_idx").on(table.assigneeId),
  dueDateIdx: index("tasks_due_date_idx").on(table.dueDate),
  linkedJobIdx: index("tasks_linked_job_idx").on(table.linkedJobId),
}));

export const insertTaskSchema = createInsertSchema(tasks)
  .omit({ id: true, completedAt: true, deletedAt: true, createdAt: true, updatedAt: true })
  .extend({
    dueDate: z.union([z.string(), z.date()]).optional().nullable().transform(v =>
      v == null || v === "" ? null : (typeof v === "string" ? new Date(v) : v)
    ),
  });
export const updateTaskSchema = insertTaskSchema.partial();

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;

// Safety Incident Management
export const safetyIncidents = pgTable("safety_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentNumber: text("incident_number").notNull().unique(),
  type: text("type").notNull(), // near_miss, minor_injury, major_injury, property_damage, environmental, equipment_failure
  severity: text("severity").notNull(), // low, medium, high, critical
  status: text("status").notNull().default("reported"), // reported, investigating, resolved, closed
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  jobId: varchar("job_id").references(() => jobs.id),
  reportedBy: text("reported_by").notNull(),
  reportedAt: timestamp("reported_at").defaultNow(),
  involvedPersons: text("involved_persons").array().default([]),
  witnesses: text("witnesses").array().default([]),
  injuriesDescription: text("injuries_description"),
  immediateActions: text("immediate_actions").notNull(),
  rootCause: text("root_cause"),
  preventiveActions: text("preventive_actions"),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  assignedTo: text("assigned_to"),
  photos: text("photos").array().default([]),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  regulatoryNotification: boolean("regulatory_notification").default(false),
  regulatoryReference: text("regulatory_reference"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Risk Assessment Management  
export const riskAssessments = pgTable("risk_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id),
  assessmentDate: timestamp("assessment_date").defaultNow(),
  assessedBy: text("assessed_by").notNull(),
  overallRisk: text("overall_risk").notNull(), // low, medium, high, critical
  weatherRisk: text("weather_risk"), // safe, caution, unsafe, suspended
  equipmentRisk: text("equipment_risk"), // low, medium, high
  siteConditions: text("site_conditions").notNull(),
  hazards: text("hazards").array().default([]),
  controlMeasures: text("control_measures").array().default([]),
  requiredPPE: text("required_ppe").array().default([]),
  recommendations: text("recommendations"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Job Templates System - removed duplicate, will use the one below

// Proposal System
export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  proposalNumber: text("proposal_number").notNull().unique(),
  title: text("title").notNull(),
  introduction: text("introduction"),
  conclusion: text("conclusion"),
  status: text("status").notNull().default("draft"), // draft, sent, viewed, accepted, rejected
  deliveryMethod: text("delivery_method"), // email, sms, portal, print
  sentDate: timestamp("sent_date"),
  viewedDate: timestamp("viewed_date"),
  responseDate: timestamp("response_date"),
  expiryDate: timestamp("expiry_date"),
  customerSignature: text("customer_signature"),
  signedDate: timestamp("signed_date"),
  templateUsed: text("template_used"),
  branding: jsonb("branding"), // logo, colors, fonts
  blockConfig: jsonb("block_config"), // DocumentBlock[] — layout for the block-based renderer; null falls back to DEFAULT_PROPOSAL_BLOCKS
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0.00"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0.00"),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }).default("0.00"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("15.00"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0.00"),
  discountType: text("discount_type").default("fixed"), // fixed or percentage
  potentialValue: decimal("potential_value", { precision: 10, scale: 2 }).default("0.00"), // Total of ALL line items for metrics (regardless of selection)
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Sections
export const proposalSections = pgTable("proposal_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").references(() => proposals.id, { onDelete: 'cascade' }).notNull(),
  sectionType: text("section_type").notNull(), // intro, service_description, pricing, terms, photos, custom
  title: text("title").notNull(),
  content: text("content").notNull(),
  images: text("images").array().default([]),
  sortOrder: integer("sort_order").notNull(),
  isVisible: boolean("is_visible").default(true),
  styling: jsonb("styling"), // custom CSS or styling options
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Line Items
export const proposalLineItems = pgTable("proposal_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").references(() => proposals.id, { onDelete: 'cascade' }).notNull(),
  sectionId: varchar("section_id").references(() => proposalSections.id, { onDelete: 'cascade' }),
  sourceType: text("source_type", { enum: ['quote', 'template', 'fixed'] }).notNull(),
  sourceId: varchar("source_id"), // Reference to quote line item or template ID (nullable for fixed items)
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").default("each"), // each, hours, m2, linear_m, etc.
  category: text("category"), // labor, materials, equipment, permits, etc.
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  isOptional: boolean("is_optional").default(false),
  // New pricing fields
  pricingType: text("pricing_type", { enum: ['normal', 'choice', 'fixed'] }).notNull().default('normal'),
  selectedChoiceId: varchar("selected_choice_id").references(() => proposalLineItemChoices.id, { onDelete: 'set null' }), // FK to selected choice
  fixedPrice: decimal("fixed_price", { precision: 10, scale: 2 }), // For fixed pricing mode
  selected: boolean("selected").notNull().default(true), // Whether customer has selected this line item
  priceIncludesTax: boolean("price_includes_tax").default(false), // Whether unitPrice/totalPrice includes GST
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Line Item Choices (for multiple choice options)
export const proposalLineItemChoices = pgTable("proposal_line_item_choices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lineItemId: varchar("line_item_id").references(() => proposalLineItems.id, { onDelete: 'cascade' }).notNull(),
  label: text("label").notNull(), // "Basic", "Premium", "Emergency"
  description: text("description"), // Detailed description of this choice
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Price for this choice option
  isDefault: boolean("is_default").default(false), // Whether this is the default selection
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced Photo Management System
export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id),
  customerId: varchar("customer_id").references(() => customers.id),
  jobDiaryEntryId: varchar("job_diary_entry_id").references(() => jobDiaryEntries.id),
  proposalSectionId: varchar("proposal_section_id").references(() => proposalSections.id),
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name"),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  type: text("type").notNull(), // 'before', 'during', 'after', 'damage', 'safety', 'equipment', 'progress', 'final'
  category: text("category").default("general"), // 'progress', 'documentation', 'insurance', 'marketing', 'safety'
  capturedAt: timestamp("captured_at").notNull(),
  capturedBy: text("captured_by").notNull(),
  location: text("location"), // Address or description
  gpsLatitude: real("gps_latitude"),
  gpsLongitude: real("gps_longitude"),
  gpsAccuracy: real("gps_accuracy"), // In meters
  gpsAddress: text("gps_address"), // Reverse geocoded address
  notes: text("notes"),
  tags: text("tags").array().default([]),
  isPublic: boolean("is_public").default(false),
  isFeatured: boolean("is_featured").default(false),
  showToCustomer: boolean("show_to_customer").default(true),
  processingStatus: text("processing_status").default("uploaded"), // 'uploaded', 'processing', 'ready', 'error'
  thumbnailUrl: text("thumbnail_url"),
  mediumUrl: text("medium_url"), // Medium resolution for web viewing
  exifData: jsonb("exif_data"), // Camera settings, timestamp, etc.
  weatherConditions: text("weather_conditions"), // Weather when photo was taken
  equipmentVisible: text("equipment_visible").array().default([]), // Equipment IDs visible in photo
  safetyIssues: text("safety_issues").array().default([]), // Any safety concerns visible
  qualityScore: integer("quality_score"), // 1-5 automated quality assessment
  aiDescription: text("ai_description"), // AI-generated description of photo content
  beforeAfterPairId: varchar("before_after_pair_id"), // Groups before/after photos
  sequenceOrder: integer("sequence_order").default(0), // Order within a sequence
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Job Videos — native replacement for Loom. The video file itself lives in GCS
// object storage (same bucket as photos); this row only holds metadata + the
// object path (`url` like `/objects/videos/<file>`). showToCustomer gates
// whether the video surfaces on the customer-facing quote/proposal view.
export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // 'job' = customer-facing on-site walkthrough tied to a job; 'knowledge' =
  // how-to / training video for the subscriber-facing knowledge page (no job).
  kind: text("kind").notNull().default("job"),
  // For 'knowledge' videos: grouping on the knowledge page (e.g. 'Getting started',
  // 'Invoicing'). Null for job videos.
  category: text("category"),
  jobId: varchar("job_id").references(() => jobs.id), // nullable: standalone/knowledge videos have none
  customerId: varchar("customer_id").references(() => customers.id),
  proposalSectionId: varchar("proposal_section_id").references(() => proposalSections.id),
  jobDiaryEntryId: varchar("job_diary_entry_id").references(() => jobDiaryEntries.id),
  url: text("url").notNull(), // GCS object path served via GET /objects/videos/:filename
  filename: text("filename").notNull(), // stored object filename
  originalName: text("original_name"),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  durationSeconds: integer("duration_seconds"), // optional, populated by client if available
  title: text("title"),
  description: text("description"),
  uploadedBy: text("uploaded_by"), // staff name/id who uploaded
  showToCustomer: boolean("show_to_customer").default(true),
  thumbnailUrl: text("thumbnail_url"), // optional poster frame
  processingStatus: text("processing_status").default("ready"), // 'uploading', 'ready', 'error'
  sequenceOrder: integer("sequence_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  jobIdx: index("videos_job_id_idx").on(table.jobId),
}));

// Activity Log & Communication Tracking
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id),
  leadId: varchar("lead_id").references(() => leads.id),
  jobId: varchar("job_id").references(() => jobs.id),
  type: text("type").notNull(), // call, email, sms, note, meeting, quote_sent, job_completed
  direction: text("direction"), // inbound, outbound
  subject: text("subject"),
  content: text("content"),
  attachments: text("attachments").array(),
  outcome: text("outcome"), // connected, voicemail, bounce, delivered, opened, clicked
  scheduledFor: timestamp("scheduled_for"),
  completedAt: timestamp("completed_at"),
  createdBy: text("created_by"),
  automationId: varchar("automation_id"), // if triggered by automation
  createdAt: timestamp("created_at").defaultNow(),
});

// Review Management
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id),
  jobId: varchar("job_id").references(() => jobs.id),
  platform: text("platform").notNull(), // google, facebook, yelp
  rating: integer("rating").notNull(), // 1-5 stars
  reviewText: text("review_text"),
  reviewerName: text("reviewer_name"),
  reviewDate: timestamp("review_date"),
  response: text("response"), // business response
  responseDate: timestamp("response_date"),
  sentiment: text("sentiment"), // positive, neutral, negative
  keywords: text("keywords").array(),
  isPublic: boolean("is_public").default(true),
  platformReviewId: text("platform_review_id"),
  photoUrls: text("photo_urls").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marketing Campaign Management
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // email, sms, social, google_ads, facebook_ads
  status: text("status"), // draft, active, paused, completed
  platform: text("platform"), // facebook, instagram, google, email, sms
  budget: decimal("budget", { precision: 10, scale: 2 }),
  spent: decimal("spent", { precision: 10, scale: 2 }).default("0"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  targetAudience: jsonb("target_audience"),
  content: jsonb("content"), // ad copy, images, etc
  metrics: jsonb("metrics"), // impressions, clicks, conversions, etc
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  leadGenerated: integer("leads_generated").default(0),
  costPerLead: decimal("cost_per_lead", { precision: 10, scale: 2 }),
  roi: decimal("roi", { precision: 8, scale: 2 }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Social Media Planning
export const socialPlans = pgTable("social_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: text("platform").notNull(), // facebook, instagram, tiktok
  contentType: text("content_type"), // before_after, tip, promo, testimonial, seasonal
  caption: text("caption"),
  hashtags: text("hashtags").array(),
  imageUrl: text("image_url"),
  scheduledDate: timestamp("scheduled_date"),
  publishedDate: timestamp("published_date"),
  status: text("status"), // draft, scheduled, published, failed
  engagement: jsonb("engagement"), // likes, comments, shares, etc
  reach: integer("reach"),
  impressions: integer("impressions"),
  clicks: integer("clicks"),
  platformPostId: text("platform_post_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Competitor Intelligence
export const competitorSignals = pgTable("competitor_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  competitorName: text("competitor_name").notNull(),
  signal: text("signal").notNull(), // price_change, new_service, ad_spotted, review_trend
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  service: text("service"),
  source: text("source"), // manual, scraper, customer_report
  impact: text("impact"), // low, medium, high
  actionRequired: boolean("action_required").default(false),
  actionTaken: text("action_taken"),
  data: jsonb("data"), // structured data specific to signal type
  detectedAt: timestamp("detected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pricing Rules Engine
export const priceRules = pgTable("price_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceName: text("service_name").notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  priceUnit: text("price_unit"), // per_hour, per_tree, per_sqm, fixed
  complexity: text("complexity"), // simple, medium, complex, extreme
  urgencyMultiplier: decimal("urgency_multiplier", { precision: 4, scale: 2 }).default("1.0"),
  seasonalMultiplier: decimal("seasonal_multiplier", { precision: 4, scale: 2 }).default("1.0"),
  equipmentCost: decimal("equipment_cost", { precision: 8, scale: 2 }).default("0"),
  laborHours: decimal("labor_hours", { precision: 5, scale: 2 }),
  materialCost: decimal("material_cost", { precision: 8, scale: 2 }).default("0"),
  profitMarginTarget: decimal("profit_margin_target", { precision: 5, scale: 2 }).default("25.0"),
  competitiveAdjustment: decimal("competitive_adjustment", { precision: 5, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ========================================
// INSERT SCHEMAS & TYPES
// ========================================

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerImportBatchSchema = createInsertSchema(customerImportBatches).omit({ id: true, createdAt: true });
export const updateCustomerImportBatchSchema = createInsertSchema(customerImportBatches).omit({ id: true, createdAt: true }).partial();
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  email: z.string().optional().transform(val => val ? val.toLowerCase() : val),
});
export const insertCustomerContactSchema = createInsertSchema(customerContacts).omit({ id: true, normalizedPhone: true, createdAt: true, updatedAt: true }).extend({
  email: z.string().optional().nullable().transform(val => val ? val.toLowerCase() : val),
});
export const updateCustomerContactSchema = insertCustomerContactSchema.partial();
export const insertCommunicationPreferencesSchema = createInsertSchema(communicationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  email: z.string().optional().transform(val => val ? val.toLowerCase() : val),
});
export const insertCallSchema = createInsertSchema(calls).omit({ id: true, createdAt: true });
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true, lastUsedAt: true });
export const insertQuoteSchema = createInsertSchema(quotes)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    validUntil: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional(),
  });
export const insertJobSchema = createInsertSchema(jobs)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    status: JobStatus.optional().default('lead'),
    checklist: z.array(checklistItemSchema).optional().default([]),
    equipmentChecklist: z.array(equipmentChecklistItemSchema).optional().default([]),
    lineItems: z.array(ServiceM8LineItemSchema).optional().default([]),
  });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSocialPlanSchema = createInsertSchema(socialPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCompetitorSignalSchema = createInsertSchema(competitorSignals).omit({ id: true, detectedAt: true, createdAt: true });
export const insertPriceRuleSchema = createInsertSchema(priceRules).omit({ id: true, validFrom: true, createdAt: true, updatedAt: true });
export const insertJobDiaryEntrySchema = createInsertSchema(jobDiaryEntries).omit({ id: true, createdAt: true, updatedAt: true });

// Select Types
export type Team = typeof teams.$inferSelect;
export type CustomerImportBatch = typeof customerImportBatches.$inferSelect;
export type InsertCustomerImportBatch = z.infer<typeof insertCustomerImportBatchSchema>;
export type UpdateCustomerImportBatch = z.infer<typeof updateCustomerImportBatchSchema>;
export type Customer = typeof customers.$inferSelect;
export type CustomerContact = typeof customerContacts.$inferSelect;
export type InsertCustomerContact = z.infer<typeof insertCustomerContactSchema>;
export type UpdateCustomerContact = z.infer<typeof updateCustomerContactSchema>;
export type CommunicationPreferences = typeof communicationPreferences.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobDiaryEntry = typeof jobDiaryEntries.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type SocialPlan = typeof socialPlans.$inferSelect;
export type CompetitorSignal = typeof competitorSignals.$inferSelect;
export type PriceRule = typeof priceRules.$inferSelect;

// Insert Types
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

// Safety Incident Types & Schemas
export const safetyIncidentInsertSchema = createInsertSchema(safetyIncidents).omit({
  id: true,
  incidentNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const riskAssessmentInsertSchema = createInsertSchema(riskAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Compliance Monitoring System
export const complianceRequirements = pgTable("compliance_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // safety, environmental, regulatory, internal, certification
  type: text("type").notNull(), // inspection, audit, training, certification, documentation
  frequency: text("frequency").notNull(), // daily, weekly, monthly, quarterly, annual, one_time
  regulatoryBody: text("regulatory_body"), // OSHA, EPA, local authority, etc.
  dueDate: timestamp("due_date").notNull(),
  lastCompleted: timestamp("last_completed"),
  nextDue: timestamp("next_due").notNull(),
  priority: text("priority").notNull().default("medium"), // low, medium, high, critical
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, overdue, exempt
  assignedTo: text("assigned_to").notNull(),
  requirements: text("requirements").array().default([]),
  attachments: text("attachments").array().default([]),
  notes: text("notes"),
  complianceScore: integer("compliance_score"), // 0-100
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const complianceRecords = pgTable("compliance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requirementId: varchar("requirement_id").references(() => complianceRequirements.id).notNull(),
  completedBy: text("completed_by").notNull(),
  completedAt: timestamp("completed_at").notNull(),
  status: text("status").notNull(), // passed, failed, partial, deferred
  score: integer("score"), // 0-100
  findings: text("findings").array().default([]),
  corrective_actions: text("corrective_actions").array().default([]),
  evidence: text("evidence").array().default([]), // file URLs or references
  nextReviewDate: timestamp("next_review_date"),
  notes: text("notes"),
  auditorNotes: text("auditor_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const complianceRequirementInsertSchema = createInsertSchema(complianceRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const complianceRecordInsertSchema = createInsertSchema(complianceRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SafetyIncident = typeof safetyIncidents.$inferSelect;
export type InsertSafetyIncident = z.infer<typeof safetyIncidentInsertSchema>;
export type RiskAssessment = typeof riskAssessments.$inferSelect;
export type InsertRiskAssessment = z.infer<typeof riskAssessmentInsertSchema>;
export type ComplianceRequirement = typeof complianceRequirements.$inferSelect;
export type InsertComplianceRequirement = z.infer<typeof complianceRequirementInsertSchema>;
export type ComplianceRecord = typeof complianceRecords.$inferSelect;
export type InsertComplianceRecord = z.infer<typeof complianceRecordInsertSchema>;
export type InsertCommunicationPreferences = z.infer<typeof insertCommunicationPreferencesSchema>;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type InsertCall = z.infer<typeof insertCallSchema>;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type InsertJobDiaryEntry = z.infer<typeof insertJobDiaryEntrySchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type InsertSocialPlan = z.infer<typeof insertSocialPlanSchema>;
export type InsertCompetitorSignal = z.infer<typeof insertCompetitorSignalSchema>;
export type InsertPriceRule = z.infer<typeof insertPriceRuleSchema>;

// CSV Import Result Schema
export const csvImportResultSchema = z.object({
  success: z.boolean(),
  totalRows: z.number(),
  successfulImports: z.number(),
  errors: z.array(z.object({
    row: z.number(),
    error: z.string(),
    data: z.record(z.any()).optional(),
  })),
  importedIds: z.array(z.string()),
});

// CSV Import Types
// TODO: Define servicem8 CSV schemas when needed
// export type ServiceM8CustomerCsv = z.infer<typeof servicem8CustomerCsvSchema>;
// export type ServiceM8JobCsv = z.infer<typeof servicem8JobCsvSchema>;  
// export type ServiceM8QuoteCsv = z.infer<typeof servicem8QuoteCsvSchema>;
export type CsvImportResult = z.infer<typeof csvImportResultSchema>;

// ========================================
// BUSINESS SETTINGS SYSTEM SCHEMAS
// ========================================

// Business Settings Table - Comprehensive settings management
export const businessSettings = pgTable("business_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Business Information
  businessName: text("business_name").notNull().default("Treemarkables"),
  businessAddress: text("business_address").default(""),
  businessPhone: text("business_phone").default(""),
  businessEmail: text("business_email").default(""),
  businessWebsite: text("business_website").default(""),
  businessLogo: text("business_logo").default(""),
  
  // Business Rules & Workflow
  leadAssignmentMethod: text("lead_assignment_method").default("round_robin"), // round_robin, skill_based, manual
  autoFollowUpDays: integer("auto_follow_up_days").default(3),
  autoQuoteFollowupEnabled: boolean("auto_quote_followup_enabled").default(false),
  quoteFollowupChannel: text("quote_followup_channel").default("sms"), // sms, email
  quoteFollowupMaxAttempts: integer("quote_followup_max_attempts").default(2),
  quotePricingModel: text("quote_pricing_model").default("standard"), // standard, dynamic, competitive
  quoteValidityDays: integer("quote_validity_days").default(30),
  autoQuoteApproval: boolean("auto_quote_approval").default(false),
  jobAutoScheduling: boolean("job_auto_scheduling").default(false),
  jobBufferTime: integer("job_buffer_time").default(30), // minutes
  
  // Data Management & Backup
  cloudSyncEnabled: boolean("cloud_sync_enabled").default(true),
  backupFrequency: text("backup_frequency").default("daily"), // daily, weekly, monthly
  dataRetentionDays: integer("data_retention_days").default(365),
  autoBackupTime: text("auto_backup_time").default("02:00"), // 24hr format
  exportFormat: text("export_format").default("csv"), // csv, excel, json
  metricsStartDate: timestamp("metrics_start_date"), // Jobs created before this date are excluded from metrics
  
  // Integration Management
  servicem8Enabled: boolean("servicem8_enabled").default(false),
  servicem8ApiKey: text("servicem8_api_key").default(""),
  googleCalendarEnabled: boolean("google_calendar_enabled").default(false),
  emailIntegrationEnabled: boolean("email_integration_enabled").default(false),
  paymentGatewayEnabled: boolean("payment_gateway_enabled").default(false),
  paymentProvider: text("payment_provider").default("stripe"), // stripe, paypal, square
  
  // Mailchimp Integration
  mailchimpEnabled: boolean("mailchimp_enabled").default(false),
  mailchimpApiKey: text("mailchimp_api_key").default(""),
  mailchimpAudienceId: text("mailchimp_audience_id").default(""),
  mailchimpAutoSync: boolean("mailchimp_auto_sync").default(true), // Auto-sync new customers
  
  // Performance & Optimization
  cacheDuration: integer("cache_duration").default(300), // seconds
  imageQuality: integer("image_quality").default(80), // 1-100
  realTimeUpdatesInterval: integer("real_time_updates_interval").default(30), // seconds
  autoRefreshEnabled: boolean("auto_refresh_enabled").default(true),
  maxConcurrentJobs: integer("max_concurrent_jobs").default(50),
  
  // Mobile & Field Operations
  offlineModeEnabled: boolean("offline_mode_enabled").default(true),
  gpsTrackingEnabled: boolean("gps_tracking_enabled").default(true),
  locationAccuracy: text("location_accuracy").default("high"), // low, medium, high
  mobileDataSync: boolean("mobile_data_sync").default(true),
  fieldPhotoQuality: integer("field_photo_quality").default(85),
  
  // Security & Access Control
  twoFactorRequired: boolean("two_factor_required").default(false),
  sessionTimeout: integer("session_timeout").default(480), // minutes
  passwordExpiration: integer("password_expiration").default(90), // days
  auditLogging: boolean("audit_logging").default(true),
  
  // Analytics Defaults
  defaultGrossMarginPct: decimal("default_gross_margin_pct", { precision: 5, scale: 2 }).notNull().default("0"),

  // AI Dispatch Settings
  dailyRevenueTarget: decimal("daily_revenue_target", { precision: 10, scale: 2 }).default("3500"),

  // Invoice Settings
  invoicePaymentDays: integer("invoice_payment_days").default(7),

  // Xero Integration
  xeroDefaultBankAccountCode: text("xero_default_bank_account_code"),

  // Booking Reminders (customer-facing job reminders)
  // Master toggle and channel apply when an operator opts a job in via the
  // scheduling modal or the settings default. Offsets is an array of
  // {hoursBefore:number, label?:string} entries — one row per offset is
  // created in booking_reminders when scheduling reminders for a job.
  bookingRemindersEnabled: boolean("booking_reminders_enabled").default(false),
  bookingReminderChannel: text("booking_reminder_channel").default("both"), // 'email' | 'sms' | 'both'
  bookingReminderOffsets: jsonb("booking_reminder_offsets").default(sql`'[{"hoursBefore":24,"label":"24 hours before"}]'::jsonb`),
  bookingReminderEmailTemplateId: varchar("booking_reminder_email_template_id"),
  bookingReminderSmsTemplateId: varchar("booking_reminder_sms_template_id"),
  bookingReminderDefaultOn: boolean("booking_reminder_default_on").default(false), // Pre-tick the per-job toggle when scheduling

  // Inquiry auto-reply (sent to the customer immediately on website form submission)
  // The default copy follows what Jules asked for: "Hey, we have received your
  // inquiry. Jules will be in touch within 24 hours to schedule in your quote."
  inquiryAutoReplyEnabled: boolean("inquiry_auto_reply_enabled").default(true),
  inquiryAutoReplyChannel: text("inquiry_auto_reply_channel").default("email"), // 'email' | 'sms' | 'both'
  inquiryAutoReplyEmailSubject: text("inquiry_auto_reply_email_subject").default("We've received your inquiry — Treemarkables"),
  inquiryAutoReplyEmailMessage: text("inquiry_auto_reply_email_message").default("Hi {customerName},\n\nThanks for getting in touch with Treemarkables. We've received your inquiry and Jules will be in touch within 24 hours to schedule in your quote.\n\nIf it's urgent, feel free to reply to this email or give us a call.\n\nThanks,\nThe Treemarkables Team"),
  inquiryAutoReplySmsMessage: text("inquiry_auto_reply_sms_message").default("Hi {firstName}, thanks for your inquiry with Treemarkables. Jules will be in touch within 24 hours to schedule in your quote."),

  // Metadata
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Business Settings Insert Schema with validation constraints
export const insertBusinessSettingsSchema = createInsertSchema(businessSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Add validation constraints for numeric fields
  autoFollowUpDays: z.number().int().min(1).max(30).optional(),
  quoteValidityDays: z.number().int().min(1).max(365).optional(),
  jobBufferTime: z.number().int().min(0).max(120).optional(), // 0-120 minutes
  dataRetentionDays: z.number().int().min(30).max(2555).optional(), // 30 days to 7 years
  cacheDuration: z.number().int().min(60).max(3600).optional(), // 1 minute to 1 hour
  imageQuality: z.number().int().min(1).max(100).optional(),
  realTimeUpdatesInterval: z.number().int().min(5).max(300).optional(), // 5 seconds to 5 minutes
  maxConcurrentJobs: z.number().int().min(1).max(200).optional(),
  fieldPhotoQuality: z.number().int().min(1).max(100).optional(),
  sessionTimeout: z.number().int().min(30).max(1440).optional(), // 30 minutes to 24 hours
  passwordExpiration: z.number().int().min(30).max(365).optional(), // 30 days to 1 year
  quoteFollowupMaxAttempts: z.number().int().min(1).max(5).optional(),
  // Add enum constraints for select fields
  leadAssignmentMethod: z.enum(['round_robin', 'skill_based', 'manual']).optional(),
  quoteFollowupChannel: z.enum(['sms', 'email']).optional(),
  quotePricingModel: z.enum(['standard', 'dynamic', 'competitive']).optional(),
  backupFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  exportFormat: z.enum(['csv', 'excel', 'json']).optional(),
  paymentProvider: z.enum(['stripe', 'paypal', 'square']).optional(),
  locationAccuracy: z.enum(['low', 'medium', 'high']).optional(),
  bookingReminderChannel: z.enum(['email', 'sms', 'both']).optional(),
  bookingReminderOffsets: z.array(z.object({
    hoursBefore: z.number().int().min(1).max(720),
    label: z.string().optional(),
    channel: z.enum(['email', 'sms', 'both']).optional(),
  })).optional(),
  inquiryAutoReplyChannel: z.enum(['email', 'sms', 'both']).optional(),
  inquiryAutoReplyEmailSubject: z.string().max(200).optional(),
  inquiryAutoReplyEmailMessage: z.string().max(5000).optional(),
  inquiryAutoReplySmsMessage: z.string().max(306).optional(),
});

// Business Settings Update Schema - partial with same constraints
export const updateBusinessSettingsSchema = insertBusinessSettingsSchema.partial();

// Settings Types
export type BusinessSettings = typeof businessSettings.$inferSelect;
export type InsertBusinessSettings = z.infer<typeof insertBusinessSettingsSchema>;
export type UpdateBusinessSettings = z.infer<typeof updateBusinessSettingsSchema>;

// ========================================
// NOTIFICATION SYSTEM SCHEMAS
// ========================================

// Notification Types Enum
export const notificationTypes = [
  'new_lead',           // New lead received
  'lead_status_change', // Lead status updated
  'job_status_change',  // Job status updated  
  'quote_sent',         // Quote sent to customer
  'quote_accepted',     // Quote accepted by customer
  'quote_expired',      // Quote expired
  'follow_up_due',      // Follow-up is due
  'follow_up_overdue',  // Follow-up is overdue
  'job_scheduled',      // Job scheduled
  'job_completed',      // Job completed
  'payment_received',   // Payment received
  'system_alert',       // System alert/message
  'email_reply',        // Email reply received in diary
  'sms_reply',          // SMS reply received in diary
  'proposal_sent',      // Proposal sent (diary activity)
  'photo_added',        // Photo added to job diary
  'note_added',         // Note added to job diary
] as const;

export type NotificationType = typeof notificationTypes[number];

// Notification Priority Levels
export const notificationPriorities = [
  'low',
  'medium', 
  'high',
  'urgent'
] as const;

export type NotificationPriority = typeof notificationPriorities[number];

// Notifications Table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // NotificationType
  priority: text("priority").notNull().default('medium'), // NotificationPriority
  isRead: boolean("is_read").default(false).notNull(),
  userId: varchar("user_id"), // Optional - for user-specific notifications
  // Related entity references
  leadId: varchar("lead_id"), // Reference to lead if notification is lead-related
  jobId: varchar("job_id"), // Reference to job if notification is job-related
  customerId: varchar("customer_id"), // Reference to customer if notification is customer-related
  quoteId: varchar("quote_id"), // Reference to quote if notification is quote-related
  proposalId: varchar("proposal_id"), // Reference to proposal if notification is proposal-related
  diaryEntryId: varchar("diary_entry_id"), // Reference to diary entry for activity notifications
  // Metadata
  metadata: jsonb("metadata"), // Additional data for the notification
  actionUrl: text("action_url"), // URL to navigate when notification is clicked
  expiresAt: timestamp("expires_at"), // Optional expiration date
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"), // When notification was read
  archived: boolean("archived").default(false).notNull(), // Archived (hidden) but kept for de-dup
});

// Notification Insert Schema
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
  archived: true,
});

// Notification Update Schema (for marking as read, etc.)
export const updateNotificationSchema = insertNotificationSchema.partial();

// Notification Types
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type UpdateNotification = z.infer<typeof updateNotificationSchema>;

// Notification with related data type (for API responses)
export type NotificationWithDetails = Notification & {
  leadName?: string;
  customerName?: string;
  jobTitle?: string;
  quoteNumber?: string;
};

// Notification Summary Schema (for dashboard/counter)
export const notificationSummarySchema = z.object({
  total: z.number(),
  unread: z.number(),
  byType: z.record(z.string(), z.number()),
  byPriority: z.record(z.string(), z.number()),
  recent: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    priority: z.string(),
    createdAt: z.string(),
  })),
});

export type NotificationSummary = z.infer<typeof notificationSummarySchema>;

// Notification Queue Table (for scheduled email/SMS notifications)
export const notificationQueue = pgTable("notification_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientId: varchar("recipient_id").notNull(), // Employee ID
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  notificationType: text("notification_type").notNull(), // 'email', 'sms', 'both'
  subject: text("subject"),
  message: text("message").notNull(),
  metadata: jsonb("metadata"), // Additional data (job details, assignment info, etc.)
  sendAt: timestamp("send_at").notNull(), // When to send the notification
  status: text("status").notNull().default('pending'), // 'pending', 'sent', 'failed'
  sentAt: timestamp("sent_at"),
  error: text("error"), // Error message if failed
  jobId: varchar("job_id"), // Reference to job if job-related
  assignmentId: varchar("assignment_id"), // Reference to staff assignment
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationQueueSchema = createInsertSchema(notificationQueue).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export type NotificationQueueItem = typeof notificationQueue.$inferSelect;
export type InsertNotificationQueueItem = z.infer<typeof insertNotificationQueueSchema>;

// ========================================
// BOOKING REMINDERS
// ========================================
// Customer-facing reminders sent before a scheduled job (e.g. "24 hours
// before", "night before at 18:00"). Distinct from notification_queue,
// which is internal/staff. Rows are created when an operator opts a job
// into scheduled reminders or sends a manual one from the diary; the
// booking-reminder worker tick processes any row where status='pending'
// and scheduled_for <= now.
export const bookingReminders = pgTable("booking_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(), // FK to jobs.id, no cascade — kept for audit if job is deleted
  scheduledFor: timestamp("scheduled_for").notNull(), // When to send (NULL when manual=true and already sent)
  channel: text("channel").notNull(), // 'email' | 'sms' | 'both'
  status: text("status").notNull().default("pending"), // 'pending' | 'sent' | 'failed' | 'cancelled'
  manual: boolean("manual").notNull().default(false), // True when triggered by the diary "Send reminder now" button
  offsetHours: integer("offset_hours"), // The configured offset that produced this row (for audit)
  recipientEmail: text("recipient_email"), // Snapshotted at schedule time
  recipientPhone: text("recipient_phone"),
  subject: text("subject"),
  emailBody: text("email_body"),
  smsBody: text("sms_body"),
  sentAt: timestamp("sent_at"),
  emailSent: boolean("email_sent").default(false),
  smsSent: boolean("sms_sent").default(false),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  jobIdx: index("booking_reminders_job_id_idx").on(table.jobId),
  pendingIdx: index("booking_reminders_pending_idx").on(table.status, table.scheduledFor),
}));

export const insertBookingReminderSchema = createInsertSchema(bookingReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
});

export type BookingReminder = typeof bookingReminders.$inferSelect;
export type InsertBookingReminder = z.infer<typeof insertBookingReminderSchema>;

// Validation for the bookingReminderOffsets JSON in business_settings
export const bookingReminderOffsetSchema = z.object({
  hoursBefore: z.number().int().min(1).max(24 * 30), // up to 30 days before
  label: z.string().optional(),
  channel: z.enum(['email', 'sms', 'both']).optional(), // Per-offset channel override
});
export type BookingReminderOffset = z.infer<typeof bookingReminderOffsetSchema>;

// ========================================
// SCHEDULING & TEAM MANAGEMENT SCHEMAS
// ========================================

// Staff Role Enum
export const StaffRole = z.enum(['admin', 'crew']);
export type StaffRoleType = z.infer<typeof StaffRole>;

// Role Tiers (named permission presets that can be assigned to staff)
export const roleTiers = pgTable("role_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Stable identifier for system-seeded tiers ('owner', 'manager', etc.); null for user-created tiers
  key: text("key"),
  name: text("name").notNull(),
  description: text("description"),
  // Array of permission keys; ['*'] means "all permissions"
  permissions: jsonb("permissions").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // System tiers are seeded by the app and can't be deleted (but can be renamed/edited)
  isSystem: boolean("is_system").notNull().default(false),
  // Exactly one tier should be the default — assigned to new staff if no tier picked
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertRoleTierSchema = createInsertSchema(roleTiers).extend({
  permissions: z.array(z.string()).default([]),
});
export const updateRoleTierSchema = insertRoleTierSchema.partial();
export type RoleTier = typeof roleTiers.$inferSelect;
export type InsertRoleTier = z.infer<typeof insertRoleTierSchema>;
export type UpdateRoleTier = z.infer<typeof updateRoleTierSchema>;

// Per-staff overrides on top of tier permissions: { grant: [...], deny: [...] }
export const permissionOverridesSchema = z.object({
  grant: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
});
export type PermissionOverridesShape = z.infer<typeof permissionOverridesSchema>;

// Employee/Team Member Schema
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  password: text("password"), // Passwords should be hashed with bcrypt before storing
  position: text("position").notNull(), // arborist, ground_crew, foreman, driver
  role: text("role").notNull().default("crew"), // admin, crew — legacy field, kept for backwards compat
  // Assigned role tier; permissions come from this tier's `permissions` set
  roleTierId: varchar("role_tier_id").references(() => roleTiers.id, { onDelete: 'set null' }),
  // Per-staff overrides applied on top of the tier: { grant: [...], deny: [...] }
  permissionOverrides: jsonb("permission_overrides").$type<PermissionOverridesShape>().default(sql`'{"grant":[],"deny":[]}'::jsonb`),
  status: text("status").notNull().default("active"), // active, inactive, on_leave
  skillLevel: text("skill_level").notNull().default("beginner"), // beginner, intermediate, expert
  certifications: text("certifications").array().default([]), // ISA, CTSP, etc.
  licences: text("licences").array().default([]), // EWP Ticket, Class 2 Licence, Chainsaw Unit Standard, etc.
  skills: text("skills").array().default([]), // chainsaw, bucket_truck, climbing, etc.
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }), // Internal cost rate
  chargeOutRate: decimal("charge_out_rate", { precision: 10, scale: 2 }), // Rate billed to customers
  costLineItemNumber: text("cost_line_item_number"), // itemNumber of Labour catalog item used for cost tracking
  chargeOutLineItemNumber: text("charge_out_line_item_number"), // itemNumber of Labour catalog item used for invoicing
  availableHours: text("available_hours"), // JSON: {"mon": "8-17", "tue": "8-17", ...}
  emergencyContact: text("emergency_contact"),
  emergencyContactPhone: text("emergency_contact_phone"),
  notes: text("notes"),
  hireDate: timestamp("hire_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertEmployeeSchema = createInsertSchema(employees).extend({
  email: z.string().optional().transform(val => val ? val.toLowerCase() : val),
  password: z.string().min(8).optional(),
  hireDate: z.string().optional().or(z.date().optional()),
  roleTierId: z.string().nullable().optional(),
  permissionOverrides: permissionOverridesSchema.optional(),
});

export const updateEmployeeSchema = insertEmployeeSchema.partial();

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type UpdateEmployee = z.infer<typeof updateEmployeeSchema>;

// Schedule/Calendar Events Schema
export const scheduleEvents = pgTable("schedule_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // job, meeting, training, maintenance, break
  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  allDay: boolean("all_day").notNull().default(false),
  
  // Related entities
  jobId: varchar("job_id"), // FK to jobs
  customerId: varchar("customer_id"), // FK to customers
  leadId: varchar("lead_id"), // FK to pipeline_leads
  
  // Resource assignments
  assignedEmployees: text("assigned_employees").array().default([]), // Employee IDs
  requiredSkills: text("required_skills").array().default([]),
  equipment: text("equipment").array().default([]), // Equipment/vehicle IDs
  
  // Location and logistics
  location: text("location"),
  address: text("address"),
  travelTime: integer("travel_time"), // minutes
  estimatedDuration: integer("estimated_duration"), // minutes
  
  // Priority and planning
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  weatherDependent: boolean("weather_dependent").notNull().default(true),
  
  // Metadata
  color: text("color").default("#3B82F6"), // For calendar display
  notes: text("notes"),
  createdBy: varchar("created_by"),
  
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertScheduleEventSchema = createInsertSchema(scheduleEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Override date fields to accept flexible datetime formats
  startDate: z.union([
    z.date(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{3})?Z?$/)
  ]).transform(val => {
    if (typeof val === 'string') {
      // Add seconds if missing (for datetime-local input format)
      const dateStr = val.includes(':') && val.split(':').length === 2 ? `${val}:00` : val;
      return new Date(dateStr);
    }
    return val;
  }),
  endDate: z.union([
    z.date(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{3})?Z?$/)
  ]).transform(val => {
    if (typeof val === 'string') {
      // Add seconds if missing (for datetime-local input format)
      const dateStr = val.includes(':') && val.split(':').length === 2 ? `${val}:00` : val;
      return new Date(dateStr);
    }
    return val;
  }),
});

export const updateScheduleEventSchema = insertScheduleEventSchema.partial();

export type ScheduleEvent = typeof scheduleEvents.$inferSelect;
export type InsertScheduleEvent = z.infer<typeof insertScheduleEventSchema>;
export type UpdateScheduleEvent = z.infer<typeof updateScheduleEventSchema>;

// Job Staff Assignments - tracks which staff are assigned to which jobs with timing
export const jobStaffAssignments = pgTable("job_staff_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  scheduleEventId: varchar("schedule_event_id"), // Link to calendar event
  
  // Timing details
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  
  // Assignment details
  role: text("role"), // lead, operator, ground_crew, driver
  dayRole: text("day_role"), // 'A' | 'B' | null — set once per (employeeId, NZ-date), propagated to every assignment row that day
  status: text("status").notNull().default("assigned"), // assigned, confirmed, in_progress, completed, cancelled
  notificationSent: boolean("notification_sent").notNull().default(false),
  notificationSentAt: timestamp("notification_sent_at"),
  confirmed: boolean("confirmed").notNull().default(false),
  confirmedAt: timestamp("confirmed_at"),
  
  // Metadata
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertJobStaffAssignmentSchema = createInsertSchema(jobStaffAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateJobStaffAssignmentSchema = insertJobStaffAssignmentSchema.partial();

export type JobStaffAssignment = typeof jobStaffAssignments.$inferSelect;
export type InsertJobStaffAssignment = z.infer<typeof insertJobStaffAssignmentSchema>;
export type UpdateJobStaffAssignment = z.infer<typeof updateJobStaffAssignmentSchema>;

// Job Template Schema  
export const jobTemplates = pgTable("job_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // tree_removal, pruning, stump_grinding, emergency, maintenance
  description: text("description"),
  serviceType: text("service_type").notNull(), // tree_removal, hedge_trimming, stump_grinding, etc
  defaultTitle: text("default_title").notNull(),
  defaultDescription: text("default_description"),
  
  // Default pricing
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  pricePerHour: decimal("price_per_hour", { precision: 10, scale: 2 }),
  materialCosts: decimal("material_costs", { precision: 10, scale: 2 }),
  priceModel: text("price_model").default("fixed"), // fixed, hourly, per_tree, custom
  
  // Resource requirements
  estimatedDuration: integer("estimated_duration"), // minutes
  requiredSkills: text("required_skills").array().default([]),
  requiredEquipment: text("required_equipment").array().default([]),
  crewSize: integer("crew_size").default(2),
  defaultPriority: text("default_priority").default("medium"),
  
  // Safety and procedures
  safetyRequirements: text("safety_requirements").array().default([]),
  procedures: text("procedures"),
  riskLevel: text("risk_level").notNull().default("medium"), // low, medium, high, extreme
  specialInstructions: text("special_instructions"),
  requiredPermits: boolean("required_permits").default(false),
  weatherDependent: boolean("weather_dependent").default(true),
  
  // Checklist items
  preJobChecklist: text("pre_job_checklist").array().default([]),
  postJobChecklist: text("post_job_checklist").array().default([]),
  equipmentChecklist: text("equipment_checklist").array().default([]),
  categoryTags: text("category_tags").array().default([]),
  
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertJobTemplateSchema = createInsertSchema(jobTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateJobTemplateSchema = insertJobTemplateSchema.partial();

export type JobTemplate = typeof jobTemplates.$inferSelect;
export type InsertJobTemplate = z.infer<typeof insertJobTemplateSchema>;
export type UpdateJobTemplate = z.infer<typeof updateJobTemplateSchema>;

// ========================================
// EMAIL TEMPLATE SCHEMAS
// ========================================

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // job_status, quote, invoice, reminder, welcome
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  variables: text("variables").array().default([]), // customerName, jobTitle, amount, etc.
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  attachInvoicePdf: boolean("attach_invoice_pdf").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateEmailTemplateSchema = insertEmailTemplateSchema.partial();

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type UpdateEmailTemplate = z.infer<typeof updateEmailTemplateSchema>;

// ========================================
// SMS TEMPLATE SCHEMAS
// ========================================

export const smsTemplates = pgTable("sms_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // job_status, quote, reminder, confirmation
  message: text("message").notNull(),
  variables: text("variables").array().default([]), // customerName, jobTitle, amount, etc.
  description: text("description"),
  maxLength: integer("max_length").default(306),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertSmsTemplateSchema = createInsertSchema(smsTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSmsTemplateSchema = insertSmsTemplateSchema.partial();

export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type InsertSmsTemplate = z.infer<typeof insertSmsTemplateSchema>;
export type UpdateSmsTemplate = z.infer<typeof updateSmsTemplateSchema>;

// Proposal Schema Exports
export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  quoteId: true, // Remove the required quoteId from base schema
  proposalNumber: true, // Remove the required proposalNumber from base schema
}).extend({
  expiryDate: z.union([z.date(), z.string()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ).optional(),
  quoteId: z.string().optional(), // Make optional for standalone proposals
  proposalNumber: z.string().optional(), // Auto-generate if not provided
});

export const updateProposalSchema = insertProposalSchema.partial();

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type UpdateProposal = z.infer<typeof updateProposalSchema>;

// Proposal Section Schema Exports
export const insertProposalSectionSchema = createInsertSchema(proposalSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  images: z.array(z.string()).optional(), // Accept any string path, not just URLs
});

export const updateProposalSectionSchema = insertProposalSectionSchema.partial();

export type ProposalSection = typeof proposalSections.$inferSelect;
export type InsertProposalSection = z.infer<typeof insertProposalSectionSchema>;
export type UpdateProposalSection = z.infer<typeof updateProposalSectionSchema>;

// Proposal Line Item Schema Exports with enhanced validation for pricing types
export const insertProposalLineItemSchema = createInsertSchema(proposalLineItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProposalLineItemSchema = createInsertSchema(proposalLineItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type ProposalLineItem = typeof proposalLineItems.$inferSelect;
export type InsertProposalLineItem = z.infer<typeof insertProposalLineItemSchema>;
export type UpdateProposalLineItem = z.infer<typeof updateProposalLineItemSchema>;

// Proposal Line Item Choice Schema Exports
export const insertProposalLineItemChoiceSchema = createInsertSchema(proposalLineItemChoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProposalLineItemChoiceSchema = insertProposalLineItemChoiceSchema.partial();

export type ProposalLineItemChoice = typeof proposalLineItemChoices.$inferSelect;
export type InsertProposalLineItemChoice = z.infer<typeof insertProposalLineItemChoiceSchema>;
export type UpdateProposalLineItemChoice = z.infer<typeof updateProposalLineItemChoiceSchema>;

// Equipment/Resource Schema
export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type"), // vehicle, chainsaw, chipper, bucket_truck, stump_grinder, safety_gear
  brand: text("brand"),
  model: text("model"),
  year: integer("year"),
  
  // Status and availability
  status: text("status").notNull().default("available"), // available, in_use, maintenance, retired
  condition: text("condition").notNull().default("good"), // excellent, good, fair, needs_repair
  
  // Maintenance and tracking
  lastMaintenanceDate: timestamp("last_maintenance_date"),
  nextMaintenanceDate: timestamp("next_maintenance_date"),
  maintenanceIntervalDays: integer("maintenance_interval_days").default(90),
  hoursUsed: decimal("hours_used", { precision: 10, scale: 2 }).default("0"),
  
  // Financial
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  dailyRentalCost: decimal("daily_rental_cost", { precision: 10, scale: 2 }),
  
  // Location and assignments
  currentLocation: text("current_location"),
  assignedTo: varchar("assigned_to"), // Employee ID
  
  // Documentation
  serialNumber: text("serial_number"),
  registrationNumber: text("registration_number"),
  insurancePolicyNumber: text("insurance_policy_number"),
  notes: text("notes"),
  photos: text("photos").array().default([]),
  
  // Vehicle-specific compliance dates
  registrationExpiryDate: timestamp("registration_expiry_date"),
  cofExpiryDate: timestamp("cof_expiry_date"), // Certificate of Fitness
  
  // Inspection template assignment
  defaultInspectionTemplateId: varchar("default_inspection_template_id"),
  
  // Licence/ticket required to operate this equipment
  licenceRequired: text("licence_required"), // e.g. "EWP Ticket", "Class 2 Licence", "Chainsaw Unit Standard"
  
  // Whether this equipment requires a pre-start inspection (e.g. vehicles with motors)
  requiresPreStart: boolean("requires_pre_start").notNull().default(false),
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertEquipmentSchema = createInsertSchema(equipment);

export const updateEquipmentSchema = insertEquipmentSchema.partial();

export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type UpdateEquipment = z.infer<typeof updateEquipmentSchema>;

// Equipment Maintenance Records
export const equipmentMaintenance = pgTable("equipment_maintenance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id").references(() => equipment.id).notNull(),
  maintenanceType: text("maintenance_type").notNull(), // routine, repair, inspection, calibration
  description: text("description").notNull(),
  performedBy: text("performed_by"), // technician name
  cost: decimal("cost", { precision: 10, scale: 2 }),
  partsReplaced: text("parts_replaced").array().default([]),
  nextServiceDue: timestamp("next_service_due"),
  notes: text("notes"),
  photos: text("photos").array().default([]),
  invoiceNumber: text("invoice_number"),
  warrantyInfo: text("warranty_info"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Parts and Supplies Inventory
export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sku: text("sku").unique(),
  category: text("category").notNull(), // parts, consumables, safety, tools
  description: text("description"),
  compatibleEquipment: text("compatible_equipment").array().default([]),
  
  // Inventory levels
  currentStock: integer("current_stock").notNull().default(0),
  minimumStock: integer("minimum_stock").notNull().default(1),
  maximumStock: integer("maximum_stock").notNull().default(100),
  reorderPoint: integer("reorder_point").notNull().default(5),
  
  // Pricing and suppliers
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  supplier: text("supplier"),
  supplierPartNumber: text("supplier_part_number"),
  
  // Physical properties
  unit: text("unit").default("each"), // each, kg, liter, meter
  weight: decimal("weight", { precision: 8, scale: 2 }),
  dimensions: text("dimensions"), // L x W x H
  storageLocation: text("storage_location"),
  
  // Tracking
  lastOrderDate: timestamp("last_order_date"),
  lastUsedDate: timestamp("last_used_date"),
  expirationDate: timestamp("expiration_date"),
  notes: text("notes"),
  photos: text("photos").array().default([]),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Equipment Check-in/Check-out System
export const equipmentCheckouts = pgTable("equipment_checkouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id").references(() => equipment.id).notNull(),
  checkedOutBy: text("checked_out_by").notNull(), // employee name
  checkedOutTo: text("checked_out_to"), // job site or employee
  jobId: varchar("job_id").references(() => jobs.id),
  
  checkoutTime: timestamp("checkout_time").defaultNow(),
  expectedReturnTime: timestamp("expected_return_time"),
  actualReturnTime: timestamp("actual_return_time"),
  
  checkoutCondition: text("checkout_condition").default("good"), // excellent, good, fair, damaged
  returnCondition: text("return_condition"), 
  
  // Usage tracking
  hoursUsed: decimal("hours_used", { precision: 8, scale: 2 }),
  mileageStart: integer("mileage_start"),
  mileageEnd: integer("mileage_end"),
  fuelLevelStart: integer("fuel_level_start"), // percentage
  fuelLevelEnd: integer("fuel_level_end"),
  
  notes: text("notes"),
  damageReport: text("damage_report"),
  photos: text("photos").array().default([]),
  
  status: text("status").default("checked_out"), // checked_out, returned, overdue, damaged
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory Transactions  
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inventoryId: varchar("inventory_id").references(() => inventory.id).notNull(),
  transactionType: text("transaction_type").notNull(), // purchase, usage, adjustment, return, waste
  quantity: integer("quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  
  // Transaction context
  jobId: varchar("job_id").references(() => jobs.id),
  equipmentId: varchar("equipment_id").references(() => equipment.id),
  employeeName: text("employee_name"),
  supplier: text("supplier"),
  invoiceNumber: text("invoice_number"),
  
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for new tables
export const insertEquipmentMaintenanceSchema = createInsertSchema(equipmentMaintenance).omit({ id: true, createdAt: true });
export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEquipmentCheckoutSchema = createInsertSchema(equipmentCheckouts).omit({ id: true, createdAt: true });
export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({ id: true, createdAt: true });

// Types for new tables
export type EquipmentMaintenance = typeof equipmentMaintenance.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type EquipmentCheckout = typeof equipmentCheckouts.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;

export type InsertEquipmentMaintenance = z.infer<typeof insertEquipmentMaintenanceSchema>;
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InsertEquipmentCheckout = z.infer<typeof insertEquipmentCheckoutSchema>;
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;

// ========================================
// VEHICLE PRE-START INSPECTION SYSTEM
// ========================================

// Inspection Templates - Customizable checklists per vehicle type
export const inspectionTemplates = pgTable("inspection_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "Standard Vehicle Inspection", "Truck with Trailer", etc.
  vehicleType: text("vehicle_type"), // vehicle, truck, van, chipper, bucket_truck - maps to equipment.type
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false), // One default template per vehicle type
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Checklist Items - Individual questions in each template
export const inspectionChecklistItems = pgTable("inspection_checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => inspectionTemplates.id, { onDelete: 'cascade' }).notNull(),
  question: text("question").notNull(), // "Are the wheel nuts tight?"
  requiresComment: boolean("requires_comment").notNull().default(false), // Force comment if answered NO
  requiresPhoto: boolean("requires_photo").notNull().default(false), // Force photo if answered NO
  sortOrder: integer("sort_order").notNull().default(0), // For ordering items
  category: text("category"), // "Safety", "Mechanical", "Documentation" for grouping
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vehicle Inspections - Completed inspection records
export const vehicleInspections = pgTable("vehicle_inspections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").references(() => equipment.id).notNull(),
  vehicleName: text("vehicle_name").notNull(), // Denormalized for reporting
  vehicleRegistration: text("vehicle_registration"), // Denormalized
  templateId: varchar("template_id").references(() => inspectionTemplates.id),
  templateName: text("template_name"), // Denormalized
  
  // Inspection details
  inspectionDate: timestamp("inspection_date").notNull().defaultNow(),
  inspectedBy: varchar("inspected_by").notNull(), // Employee ID or name
  inspectorName: text("inspector_name").notNull(),
  speedometerReading: integer("speedometer_reading"),
  
  // Results
  status: text("status").notNull().default("pass"), // pass, fail, conditional_pass
  overallNotes: text("overall_notes"),
  signature: text("signature"), // Base64 signature image
  
  // Metadata
  deviceInfo: text("device_info"), // Device used for inspection
  location: text("location"), // GPS coordinates if available
  photos: text("photos").array().default([]), // General inspection photos
  
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Inspection Responses - Individual YES/NO/N/A answers
export const inspectionResponses = pgTable("inspection_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inspectionId: varchar("inspection_id").references(() => vehicleInspections.id, { onDelete: 'cascade' }).notNull(),
  checklistItemId: varchar("checklist_item_id").references(() => inspectionChecklistItems.id, { onDelete: 'set null' }), // SET NULL to preserve historic responses
  
  // Denormalized fields for historical record preservation (doesn't change if template is edited)
  question: text("question").notNull(),
  category: text("category"), // Snapshot of category at inspection time
  requiresComment: boolean("requires_comment").notNull().default(false),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0), // Preserves original order
  
  // Response
  response: text("response").notNull(), // YES, NO, N/A
  comment: text("comment"), // Optional comment, max 200 chars
  photos: text("photos").array().default([]), // Photos for this specific item
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one response per checklist item per inspection
  uniqueInspectionItem: unique().on(table.inspectionId, table.checklistItemId),
}));

// Insert schemas
export const insertInspectionTemplateSchema = createInsertSchema(inspectionTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInspectionChecklistItemSchema = createInsertSchema(inspectionChecklistItems).omit({
  id: true,
  createdAt: true,
});

export const insertVehicleInspectionSchema = createInsertSchema(vehicleInspections).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertInspectionResponseSchema = createInsertSchema(inspectionResponses).omit({
  id: true,
  createdAt: true,
});

// Update schemas
export const updateInspectionTemplateSchema = insertInspectionTemplateSchema.partial();
export const updateInspectionChecklistItemSchema = insertInspectionChecklistItemSchema.partial();
export const updateVehicleInspectionSchema = insertVehicleInspectionSchema.partial();

// Types
export type InspectionTemplate = typeof inspectionTemplates.$inferSelect;
export type InsertInspectionTemplate = z.infer<typeof insertInspectionTemplateSchema>;
export type UpdateInspectionTemplate = z.infer<typeof updateInspectionTemplateSchema>;

export type InspectionChecklistItem = typeof inspectionChecklistItems.$inferSelect;
export type InsertInspectionChecklistItem = z.infer<typeof insertInspectionChecklistItemSchema>;
export type UpdateInspectionChecklistItem = z.infer<typeof updateInspectionChecklistItemSchema>;

export type VehicleInspection = typeof vehicleInspections.$inferSelect;
export type InsertVehicleInspection = z.infer<typeof insertVehicleInspectionSchema>;
export type UpdateVehicleInspection = z.infer<typeof updateVehicleInspectionSchema>;

export type InspectionResponse = typeof inspectionResponses.$inferSelect;
export type InsertInspectionResponse = z.infer<typeof insertInspectionResponseSchema>;

// ========================================
// EQUIPMENT INDUCTION SYSTEM
// ========================================

// Induction Templates - Customizable induction checklists per equipment type
export const inductionTemplates = pgTable("induction_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  equipmentType: text("equipment_type"),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const inductionChecklistItems = pgTable("induction_checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => inductionTemplates.id, { onDelete: 'cascade' }).notNull(),
  step: text("step").notNull(),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  category: text("category"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const equipmentInductions = pgTable("equipment_inductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  equipmentType: text("equipment_type"),
  templateId: varchar("template_id").references(() => inductionTemplates.id),
  templateName: text("template_name"),

  inductionDate: timestamp("induction_date").notNull().defaultNow(),
  inductedBy: varchar("inducted_by").notNull(),
  inductorName: text("inductor_name").notNull(),

  notes: text("notes"),
  employeeSignature: text("employee_signature"),
  trainerSignature: text("trainer_signature"),

  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const inductionResponses = pgTable("induction_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inductionId: varchar("induction_id").references(() => equipmentInductions.id, { onDelete: 'cascade' }).notNull(),
  checklistItemId: varchar("checklist_item_id").references(() => inductionChecklistItems.id, { onDelete: 'set null' }),

  step: text("step").notNull(),
  category: text("category"),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),

  acknowledged: boolean("acknowledged").notNull().default(false),
  notes: text("notes"),
  photos: text("photos").array().default([]),

  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueInductionItem: unique().on(table.inductionId, table.checklistItemId),
}));

export const insertInductionTemplateSchema = createInsertSchema(inductionTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInductionChecklistItemSchema = createInsertSchema(inductionChecklistItems).omit({
  id: true,
  createdAt: true,
});

export const insertEquipmentInductionSchema = createInsertSchema(equipmentInductions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertInductionResponseSchema = createInsertSchema(inductionResponses).omit({
  id: true,
  createdAt: true,
});

export const updateInductionTemplateSchema = insertInductionTemplateSchema.partial();
export const updateInductionChecklistItemSchema = insertInductionChecklistItemSchema.partial();
export const updateEquipmentInductionSchema = insertEquipmentInductionSchema.partial();

export type InductionTemplate = typeof inductionTemplates.$inferSelect;
export type InsertInductionTemplate = z.infer<typeof insertInductionTemplateSchema>;
export type UpdateInductionTemplate = z.infer<typeof updateInductionTemplateSchema>;

export type InductionChecklistItem = typeof inductionChecklistItems.$inferSelect;
export type InsertInductionChecklistItem = z.infer<typeof insertInductionChecklistItemSchema>;
export type UpdateInductionChecklistItem = z.infer<typeof updateInductionChecklistItemSchema>;

export type EquipmentInduction = typeof equipmentInductions.$inferSelect;
export type InsertEquipmentInduction = z.infer<typeof insertEquipmentInductionSchema>;
export type UpdateEquipmentInduction = z.infer<typeof updateEquipmentInductionSchema>;

export type InductionResponse = typeof inductionResponses.$inferSelect;
export type InsertInductionResponse = z.infer<typeof insertInductionResponseSchema>;

// ========================================
// COMMUNICATIONS SYSTEM SCHEMAS
// ========================================

// Communications & Message Management
export const communications = pgTable("communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Platform and source information
  platform: text("platform").notNull(), // email, sms, facebook, instagram, twitter, linkedin, whatsapp, phone
  type: text("type").notNull(), // message, comment, mention, dm, call, review
  threadId: varchar("thread_id"), // For grouping related messages
  externalId: text("external_id"), // ID from the source platform
  
  // Sender information
  from: text("from").notNull(),
  fromEmail: text("from_email"),
  fromPhone: text("from_phone"),
  fromHandle: text("from_handle"), // Social media handle
  
  // Message content
  subject: text("subject"),
  content: text("content").notNull(),
  contentType: text("content_type").default("text"), // text, html, json
  
  // Recipients and targeting
  to: text("to").array().default([]),
  cc: text("cc").array().default([]),
  bcc: text("bcc").array().default([]),
  
  // Attachments and media
  attachments: jsonb("attachments").default([]), // Array of {name, type, url, size}
  mediaUrls: text("media_urls").array().default([]),
  
  // Status and metadata
  isRead: boolean("is_read").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  status: text("status").notNull().default("new"), // new, replied, forwarded, closed
  
  // Direction and categorization
  direction: text("direction").notNull().default("inbound"), // inbound, outbound
  category: text("category"), // inquiry, complaint, support, sales, followup
  tags: text("tags").array().default([]),
  
  // Business relationships
  leadId: varchar("lead_id").references(() => leads.id),
  customerId: varchar("customer_id").references(() => customers.id),
  jobId: varchar("job_id").references(() => jobs.id),
  
  // Assignment and handling
  assignedTo: varchar("assigned_to"), // Employee ID
  handledBy: varchar("handled_by"), // Employee ID who processed
  
  // Response and follow-up
  responseRequired: boolean("response_required").default(false),
  responseDeadline: timestamp("response_deadline"),
  lastResponseAt: timestamp("last_response_at"),
  followUpDate: timestamp("follow_up_date"),
  
  // Platform-specific metadata
  platformData: jsonb("platform_data").default({}), // Platform-specific fields
  
  // Timestamps
  sentAt: timestamp("sent_at").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Email tracking events (opens, clicks, bounces from Resend webhooks)
export const emailEvents = pgTable("email_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: text("message_id").notNull(), // Resend message ID
  eventType: text("event_type").notNull(), // opened, clicked, delivered, bounced, complained, unsubscribed
  recipient: text("recipient"), // Email recipient
  timestamp: timestamp("timestamp").notNull(), // When the event occurred
  userAgent: text("user_agent"), // Browser/client info for opens
  ipAddress: text("ip_address"), // IP address for opens
  linkUrl: text("link_url"), // URL clicked (for click events)
  rawPayload: jsonb("raw_payload"), // Full webhook payload for debugging
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Communication templates for responses
export const communicationTemplates = pgTable("communication_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // email, sms, facebook, etc.
  type: text("type").notNull(), // welcome, quote_response, follow_up, etc.
  subject: text("subject"), // For email templates
  content: text("content").notNull(),
  variables: text("variables").array().default([]), // Available template variables
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Communication rules and automation
export const communicationRules = pgTable("communication_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  platform: text("platform"), // null = all platforms
  
  // Trigger conditions
  triggerConditions: jsonb("trigger_conditions").notNull(), // JSON rules for when to trigger
  
  // Actions to take
  actions: jsonb("actions").notNull(), // Auto-assign, tag, categorize, respond, etc.
  
  // Priority and ordering
  priority: integer("priority").default(0),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertCommunicationSchema = createInsertSchema(communications).omit({ 
  id: true, 
  receivedAt: true,
  createdAt: true, 
  updatedAt: true 
});

export const updateCommunicationSchema = insertCommunicationSchema.partial();

export const insertCommunicationTemplateSchema = createInsertSchema(communicationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCommunicationRuleSchema = createInsertSchema(communicationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// ========================================
// CONVERSATION MANAGEMENT SCHEMAS
// ========================================

// Conversations table for centralized pre-sales communication management
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Lead/Customer relationship
  leadId: varchar("lead_id").references(() => leads.id),
  customerId: varchar("customer_id").references(() => customers.id),
  
  // Conversation details
  title: text("title").notNull(), // Derived from first message or manually set
  status: text("status").notNull().default("open"), // open, qualified, converted, closed, archived
  priority: text("priority").default("medium"), // low, medium, high, urgent
  source: text("source").notNull(), // web_form, phone, email, social, referral, walk_in
  
  // Lead qualification
  serviceType: text("service_type"), // tree_removal, pruning, emergency, etc.
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  urgency: text("urgency"), // immediate, within_week, within_month, planning
  propertyType: text("property_type"), // residential, commercial, council
  
  // Conversation state
  lastMessageAt: timestamp("last_message_at"),
  lastMessageBy: text("last_message_by"), // customer, staff
  unreadCount: integer("unread_count").default(0),
  tags: text("tags").array().default([]), // interested, budget_conscious, emergency, etc.
  
  // Assignment and tracking
  assignedTo: varchar("assigned_to"), // Staff member handling the conversation
  convertedToQuoteId: varchar("converted_to_quote_id").references(() => quotes.id),
  conversionDate: timestamp("conversion_date"),
  
  // Metadata
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages within conversations
export const conversationMessages = pgTable("conversation_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  
  // Message details
  type: text("type").notNull(), // message, note, phone_call, email, sms, system
  content: text("content").notNull(),
  direction: text("direction").notNull(), // inbound, outbound
  
  // Sender/Recipient information
  fromName: text("from_name"),
  fromContact: text("from_contact"), // email or phone
  toName: text("to_name"),
  toContact: text("to_contact"),
  
  // Staff who handled/sent the message
  staffId: varchar("staff_id"), // For outbound messages or notes
  
  // Message metadata
  subject: text("subject"), // For emails
  platform: text("platform"), // email, sms, phone, web_form, in_person
  externalId: text("external_id"), // Reference to external system message ID
  
  // Message status and tracking
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  deliveryStatus: text("delivery_status"), // sent, delivered, failed, pending
  
  // Attachments and additional data
  attachments: text("attachments").array().default([]), // File URLs or references
  metadata: jsonb("metadata"), // Additional platform-specific data
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Conversation insert schemas
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  lastMessageAt: true,
  unreadCount: true,
  createdAt: true,
  updatedAt: true
});

export const updateConversationSchema = insertConversationSchema.partial();

export const insertConversationMessageSchema = createInsertSchema(conversationMessages).omit({
  id: true,
  isRead: true,
  readAt: true,
  createdAt: true,
  updatedAt: true
});

export const updateConversationMessageSchema = insertConversationMessageSchema.partial();

// ========================================
// ENHANCED PHOTO MANAGEMENT SCHEMAS
// ========================================

export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const updatePhotoSchema = insertPhotoSchema.partial();

// Additional specific schemas for photo operations
export const photoUploadSchema = z.object({
  jobId: z.string().optional(),
  customerId: z.string().optional(),
  jobDiaryEntryId: z.string().optional(),
  type: z.enum(['before', 'during', 'after', 'damage', 'safety', 'equipment', 'progress', 'final']),
  category: z.enum(['progress', 'documentation', 'insurance', 'marketing', 'safety', 'general']).default('general'),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  location: z.string().optional(),
  capturedBy: z.string().min(1, "Captured by is required"),
  isPublic: z.boolean().default(false),
  showToCustomer: z.boolean().default(true),
  weatherConditions: z.string().optional(),
  equipmentVisible: z.array(z.string()).default([]),
  safetyIssues: z.array(z.string()).default([]),
});

export const gpsLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  address: z.string().optional(),
});

export const beforeAfterPairSchema = z.object({
  beforePhotoId: z.string(),
  afterPhotoId: z.string(),
  jobId: z.string(),
  location: z.string().optional(),
  description: z.string().optional(),
});

// Job video insert schema + types (see `videos` table above).
export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateVideoSchema = insertVideoSchema.partial();
export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type UpdateVideo = z.infer<typeof updateVideoSchema>;

export const photoSearchSchema = z.object({
  jobId: z.string().optional(),
  customerId: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  capturedBy: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  isPublic: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  hasGps: z.boolean().optional(),
  minQualityScore: z.number().min(1).max(5).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

// Type exports for photos
export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type UpdatePhoto = z.infer<typeof updatePhotoSchema>;
export type PhotoUpload = z.infer<typeof photoUploadSchema>;
export type GpsLocation = z.infer<typeof gpsLocationSchema>;
export type BeforeAfterPair = z.infer<typeof beforeAfterPairSchema>;
export type PhotoSearch = z.infer<typeof photoSearchSchema>;

// ========================================
// CUSTOMER PORTAL SPECIFIC SCHEMAS  
// ========================================

// Invoice Management for Customer Portal
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  jobId: varchar("job_id").references(() => jobs.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  jobTitle: text("job_title").notNull(),
  address: text("address"), // Billing address for the invoice
  contactName: text("contact_name"), // Contact person name (e.g., "Sam Frasier" for Gisborne District Council)
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(), // pending, paid, overdue, cancelled
  items: jsonb("items").notNull(), // Array of {description, quantity, rate, amount}
  description: text("description"), // General description shown on the invoice
  notes: text("notes"),
  paidAt: timestamp("paid_at"), // When payment was received
  paidNotes: text("paid_notes"), // Notes about how payment was received
  sentDate: timestamp("sent_date"), // When invoice email was sent to customer
  xeroInvoiceId: text("xero_invoice_id"), // Xero invoice ID for synced invoices
  xeroSyncedAt: timestamp("xero_synced_at"), // When invoice was last synced to Xero
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice Sections — mirror of proposalSections, lets invoices carry photos +
// narrative sections rendered on the customer-facing invoice page.
export const invoiceSections = pgTable("invoice_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  sectionType: text("section_type").notNull(), // intro, photos, notes, terms, custom
  title: text("title").notNull(),
  content: text("content").default(""),
  images: text("images").array().default([]),
  sortOrder: integer("sort_order").notNull(),
  isVisible: boolean("is_visible").default(true),
  styling: jsonb("styling"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice Line Items - proper line items with labor type support
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").default("each"), // each, hours, m2, linear_m, etc.
  category: text("category"), // labor_fixed, labor_chargeout, materials, equipment, disposal, etc.
  laborType: text("labor_type", { enum: ['fixed', 'chargeout'] }), // For labor items: fixed price or charge-out rate
  employeeId: varchar("employee_id").references(() => employees.id), // Link to employee for labor items
  serviceId: varchar("service_id"), // Link to service for margin tracking (e.g., "Stump Grinding")
  materialId: varchar("material_id"), // Link to material for margin tracking
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }), // Cost per unit for margin calculation
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Xero OAuth2 Integration
export const xeroConnections = pgTable("xero_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().unique(), // Xero organization/tenant ID
  tenantName: text("tenant_name"), // Organization name for display
  accessToken: text("access_token").notNull(), // OAuth2 access token
  refreshToken: text("refresh_token").notNull(), // OAuth2 refresh token
  expiresAt: timestamp("expires_at").notNull(), // When access token expires
  idToken: text("id_token"), // OpenID Connect ID token
  scope: text("scope"), // Granted scopes
  isActive: boolean("is_active").default(true), // Connection status
  lastSyncedAt: timestamp("last_synced_at"), // Last successful API call
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Xero Settings - Configurable account codes and tax types
export const xeroSettings = pgTable("xero_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  salesAccountCode: text("sales_account_code").notNull().default("200"), // Default sales account code
  taxType: text("tax_type").notNull().default("OUTPUT2"), // Default tax type (OUTPUT2 = 15% GST for NZ)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Requests from Customer Portal
export const serviceRequests = pgTable("service_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  serviceType: text("service_type").notNull(),
  description: text("description").notNull(),
  address: text("address").notNull(),
  preferredDate: timestamp("preferred_date"),
  urgency: text("urgency").notNull(), // low, medium, high, urgent
  status: text("status").notNull().default("pending"), // pending, contacted, quoted, scheduled, completed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer Authentication for Portal
export const customerAuth = pgTable("customer_auth", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for Customer Portal
export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateInvoiceSchema = insertInvoiceSchema.partial().omit({
  invoiceNumber: true, // Cannot change invoice number
  customerId: true,    // Cannot change customer
  jobId: true,         // Cannot change job
}).strict(); // Reject unknown fields

export const insertXeroConnectionSchema = createInsertSchema(xeroConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertXeroSettingsSchema = createInsertSchema(xeroSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceRequestSchema = createInsertSchema(serviceRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
}).extend({
  preferredDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

export const insertCustomerAuthSchema = createInsertSchema(customerAuth).omit({
  id: true,
  createdAt: true,
});

// Types for Customer Portal
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type UpdateInvoice = z.infer<typeof updateInvoiceSchema>;

// Invoice Line Item Schema Exports
export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateInvoiceLineItemSchema = insertInvoiceLineItemSchema.partial();

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type UpdateInvoiceLineItem = z.infer<typeof updateInvoiceLineItemSchema>;

// Invoice Section Schema Exports
export const insertInvoiceSectionSchema = createInsertSchema(invoiceSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  images: z.array(z.string()).optional(),
  content: z.string().optional(),
});

export const updateInvoiceSectionSchema = insertInvoiceSectionSchema.partial();

export type InvoiceSection = typeof invoiceSections.$inferSelect;
export type InsertInvoiceSection = z.infer<typeof insertInvoiceSectionSchema>;
export type UpdateInvoiceSection = z.infer<typeof updateInvoiceSectionSchema>;

export type XeroConnection = typeof xeroConnections.$inferSelect;
export type InsertXeroConnection = z.infer<typeof insertXeroConnectionSchema>;
export type XeroSettings = typeof xeroSettings.$inferSelect;
export type InsertXeroSettings = z.infer<typeof insertXeroSettingsSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
export type CustomerAuth = typeof customerAuth.$inferSelect;
export type InsertCustomerAuth = z.infer<typeof insertCustomerAuthSchema>;

export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;
export type UpdateCommunication = z.infer<typeof updateCommunicationSchema>;

export type CommunicationTemplate = typeof communicationTemplates.$inferSelect;
export type InsertCommunicationTemplate = z.infer<typeof insertCommunicationTemplateSchema>;

export type CommunicationRule = typeof communicationRules.$inferSelect;
export type InsertCommunicationRule = z.infer<typeof insertCommunicationRuleSchema>;

// ========================================
// ADVANCED REPORTING & BUSINESS INTELLIGENCE SCHEMAS
// ========================================

// Business Intelligence Reports
export const businessReports = pgTable("business_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  reportType: text("report_type").notNull(), // revenue, performance, customer, operational, financial
  configuration: jsonb("configuration").notNull(), // Filter criteria, date ranges, metrics
  visualizationType: text("visualization_type").notNull(), // chart, table, dashboard, kpi
  isPublic: boolean("is_public").default(false),
  createdBy: varchar("created_by").notNull(),
  schedule: text("schedule"), // daily, weekly, monthly, quarterly
  recipients: text("recipients").array(), // Email list for scheduled reports
  lastGenerated: timestamp("last_generated"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Key Performance Indicators (KPIs)
export const kpiMetrics = pgTable("kpi_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // financial, operational, customer, efficiency
  calculation: text("calculation").notNull(), // Formula or calculation method
  dataSource: text("data_source").notNull(), // jobs, customers, quotes, equipment
  targetValue: decimal("target_value", { precision: 10, scale: 2 }),
  warningThreshold: decimal("warning_threshold", { precision: 10, scale: 2 }),
  criticalThreshold: decimal("critical_threshold", { precision: 10, scale: 2 }),
  unit: text("unit"), // currency, percentage, count, hours
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Performance Analytics Data
export const performanceAnalytics = pgTable("performance_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricDate: timestamp("metric_date").notNull(),
  period: text("period").notNull(), // daily, weekly, monthly, quarterly, yearly
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  totalJobs: integer("total_jobs").default(0),
  totalQuotes: integer("total_quotes").default(0),
  quotesAccepted: integer("quotes_accepted").default(0),
  quotesRejected: integer("quotes_rejected").default(0),
  averageJobValue: decimal("average_job_value", { precision: 10, scale: 2 }).default("0"),
  averageQuoteValue: decimal("average_quote_value", { precision: 10, scale: 2 }).default("0"),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0"),
  customerAcquisitionCost: decimal("customer_acquisition_cost", { precision: 10, scale: 2 }).default("0"),
  customerLifetimeValue: decimal("customer_lifetime_value", { precision: 10, scale: 2 }).default("0"),
  grossMargin: decimal("gross_margin", { precision: 5, scale: 2 }).default("0"),
  netMargin: decimal("net_margin", { precision: 5, scale: 2 }).default("0"),
  equipmentUtilization: decimal("equipment_utilization", { precision: 5, scale: 2 }).default("0"),
  averageResponseTime: decimal("average_response_time", { precision: 8, scale: 2 }).default("0"), // hours
  customerSatisfactionScore: decimal("customer_satisfaction_score", { precision: 3, scale: 1 }).default("0"),
  repeatCustomerRate: decimal("repeat_customer_rate", { precision: 5, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Financial Analytics
export const financialAnalytics = pgTable("financial_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  periodType: text("period_type").notNull(), // monthly, quarterly, yearly
  totalIncome: decimal("total_income", { precision: 12, scale: 2 }).default("0"),
  totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 }).default("0"),
  laborCosts: decimal("labor_costs", { precision: 12, scale: 2 }).default("0"),
  materialCosts: decimal("material_costs", { precision: 12, scale: 2 }).default("0"),
  equipmentCosts: decimal("equipment_costs", { precision: 12, scale: 2 }).default("0"),
  operationalCosts: decimal("operational_costs", { precision: 12, scale: 2 }).default("0"),
  marketingCosts: decimal("marketing_costs", { precision: 12, scale: 2 }).default("0"),
  grossProfit: decimal("gross_profit", { precision: 12, scale: 2 }).default("0"),
  netProfit: decimal("net_profit", { precision: 12, scale: 2 }).default("0"),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }).default("0"),
  cashFlow: decimal("cash_flow", { precision: 12, scale: 2 }).default("0"),
  accountsReceivable: decimal("accounts_receivable", { precision: 12, scale: 2 }).default("0"),
  accountsPayable: decimal("accounts_payable", { precision: 12, scale: 2 }).default("0"),
  outstandingInvoices: integer("outstanding_invoices").default(0),
  averageCollectionPeriod: decimal("average_collection_period", { precision: 8, scale: 2 }).default("0"), // days
  createdAt: timestamp("created_at").defaultNow(),
});

// Dashboard Configurations
export const dashboardConfigs = pgTable("dashboard_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  userId: varchar("user_id"), // For user-specific dashboards
  isDefault: boolean("is_default").default(false),
  layout: jsonb("layout").notNull(), // Widget positions and sizes
  widgets: jsonb("widgets").notNull(), // Widget configurations
  filters: jsonb("filters"), // Global dashboard filters
  refreshInterval: integer("refresh_interval").default(300), // seconds
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Report Analytics Tracking
export const reportAnalytics = pgTable("report_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => businessReports.id),
  viewedBy: varchar("viewed_by"),
  viewedAt: timestamp("viewed_at").notNull(),
  exportFormat: text("export_format"), // pdf, csv, excel
  executionTime: decimal("execution_time", { precision: 8, scale: 3 }), // seconds
  dataPointsReturned: integer("data_points_returned"),
  userAgent: text("user_agent"),
});

// Insert schemas for Business Intelligence
export const insertBusinessReportSchema = createInsertSchema(businessReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastGenerated: true,
});

export const insertKpiMetricSchema = createInsertSchema(kpiMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformanceAnalyticsSchema = createInsertSchema(performanceAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertFinancialAnalyticsSchema = createInsertSchema(financialAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertDashboardConfigSchema = createInsertSchema(dashboardConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReportAnalyticsSchema = createInsertSchema(reportAnalytics).omit({
  id: true,
});

// Validation schemas for report configurations
export const reportConfigSchema = z.object({
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
    period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  }),
  filters: z.object({
    customerIds: z.array(z.string()).optional(),
    jobStatuses: z.array(z.string()).optional(),
    teamIds: z.array(z.string()).optional(),
    equipmentIds: z.array(z.string()).optional(),
    serviceTypes: z.array(z.string()).optional(),
  }).optional(),
  metrics: z.array(z.string()),
  groupBy: z.array(z.string()).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const dashboardWidgetSchema = z.object({
  id: z.string(),
  type: z.enum(['kpi', 'chart', 'table', 'metric', 'gauge', 'progress']),
  title: z.string(),
  dataSource: z.string(),
  configuration: z.record(z.any()),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  refreshInterval: z.number().optional(),
});

// Types for Business Intelligence
export type BusinessReport = typeof businessReports.$inferSelect;
export type InsertBusinessReport = z.infer<typeof insertBusinessReportSchema>;
export type KpiMetric = typeof kpiMetrics.$inferSelect;
export type InsertKpiMetric = z.infer<typeof insertKpiMetricSchema>;
export type PerformanceAnalytics = typeof performanceAnalytics.$inferSelect;
export type InsertPerformanceAnalytics = z.infer<typeof insertPerformanceAnalyticsSchema>;
export type FinancialAnalytics = typeof financialAnalytics.$inferSelect;
export type InsertFinancialAnalytics = z.infer<typeof insertFinancialAnalyticsSchema>;
export type DashboardConfig = typeof dashboardConfigs.$inferSelect;
export type InsertDashboardConfig = z.infer<typeof insertDashboardConfigSchema>;
export type ReportAnalytics = typeof reportAnalytics.$inferSelect;
export type InsertReportAnalytics = z.infer<typeof insertReportAnalyticsSchema>;
export type ReportConfiguration = z.infer<typeof reportConfigSchema>;
export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;

// Types for Conversation Management
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type UpdateConversation = z.infer<typeof updateConversationSchema>;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
export type UpdateConversationMessage = z.infer<typeof updateConversationMessageSchema>;

// ========================================
// DOCUMENT TEMPLATE SCHEMAS
// ========================================

// Document Templates (Quote, Proposal, Invoice)
export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "Standard Quote", "Tree Removal Proposal", "Tax Invoice"
  type: text("type").notNull(), // "quote", "proposal", "invoice"
  description: text("description"),
  isDefault: boolean("is_default").default(false), // Default template for this type
  isActive: boolean("is_active").default(true),
  
  // Company Branding
  companyName: text("company_name").default("Treemarkables LTD"),
  companyAddress: text("company_address").default("213 Stanley road, Gisborne"),
  companyEmail: text("company_email").default("quotes@treemarkables.nz"),
  companyPhone: text("company_phone").default("027 216 6882"),
  gstNumber: text("gst_number").default("131-047-592-GST004"),
  
  // Layout Configuration
  headerLayout: jsonb("header_layout"), // Logo position, company info layout
  footerText: text("footer_text"),
  paymentTerms: text("payment_terms").default("Payment due within 7 days"),
  // Section visibility and ordering config (invoice/quote/proposal)
  sectionConfig: jsonb("section_config"),
  // Block-based visual builder config (replaces sectionConfig for invoice templates)
  blockConfig: jsonb("block_config"),
  
  // Template Styling
  primaryColor: text("primary_color").default("#f97316"), // Orange from Treemarkables brand
  secondaryColor: text("secondary_color").default("#3b82f6"), // Blue
  logoUrl: text("logo_url"), // Path to logo file
  logoSize: integer("logo_size").default(40), // Logo height in px (20-200)
  logoAlignment: text("logo_alignment").default("left"), // 'left' | 'center' | 'right'
  headerColor: text("header_color").default("#ffffff"), // Header background colour
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Template Sections (for Proposals with multiple options)
export const templateSections = pgTable("template_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => documentTemplates.id).notNull(),
  sectionType: text("section_type").notNull(), // "option", "terms", "description"
  title: text("title").notNull(), // "Option 1", "Option 2", "Terms and Conditions"
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isVisible: boolean("is_visible").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Template Line Items (services, materials, labor)
export const templateLineItems = pgTable("template_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => documentTemplates.id),
  sectionId: varchar("section_id").references(() => templateSections.id), // Optional: belongs to specific section
  itemType: text("item_type").notNull(), // "service", "material", "labor", "equipment"
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  unit: text("unit").default("each"), // "each", "hour", "m²", "tonne"
  sortOrder: integer("sort_order").default(0),
  isOptional: boolean("is_optional").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Template Photos (for Proposals)
export const templatePhotos = pgTable("template_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => documentTemplates.id),
  sectionId: varchar("section_id").references(() => templateSections.id), // Which proposal section
  photoUrl: text("photo_url").notNull(),
  thumbnailUrl: text("thumbnail_url"), // WebP thumbnail for fast mobile loading (~120KB vs 2MB+)
  caption: text("caption"),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").default(0),
  isVisible: boolean("is_visible").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Generated Documents (instances created from templates)
export const generatedDocuments = pgTable("generated_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => documentTemplates.id).notNull(),
  jobId: varchar("job_id").references(() => jobs.id),
  customerId: varchar("customer_id").references(() => customers.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  
  documentType: text("document_type").notNull(), // "quote", "proposal", "invoice"
  documentNumber: text("document_number").notNull().unique(), // Quote #1234, Proposal #5678
  status: text("status").default("draft"), // "draft", "sent", "viewed", "accepted", "rejected"
  
  // Customer Information (captured at generation time)
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  
  // Document Content
  title: text("title"), // "Tree Removal Proposal for 24 Hauroa Road"
  description: text("description"),
  
  // Financial Totals
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }),
  gstAmount: decimal("gst_amount", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  
  // Generated Files
  pdfUrl: text("pdf_url"), // Path to generated PDF
  pdfGenerated: boolean("pdf_generated").default(false),
  
  // Tracking
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  
  // Valid until (for quotes/proposals)
  validUntil: timestamp("valid_until"),
  
  // Notes and follow-up
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Generated Document Line Items (specific items for this document instance)
export const generatedDocumentLineItems = pgTable("generated_document_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  generatedDocumentId: varchar("generated_document_id").references(() => generatedDocuments.id).notNull(),
  sectionTitle: text("section_title"), // "Option 1", "Option 2" for proposals
  
  itemType: text("item_type").notNull(), // "service", "material", "labor"
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").default("each"),
  
  sortOrder: integer("sort_order").default(0),
  isSelected: boolean("is_selected").default(false), // For proposal options
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Generated Document Photos (photos for specific document instance)
export const generatedDocumentPhotos = pgTable("generated_document_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  generatedDocumentId: varchar("generated_document_id").references(() => generatedDocuments.id).notNull(),
  sectionTitle: text("section_title"), // Which proposal section
  
  photoUrl: text("photo_url").notNull(),
  caption: text("caption"),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod Schemas for Document Templates
export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateSectionSchema = createInsertSchema(templateSections).omit({
  id: true,
  createdAt: true,
});

export const insertTemplateLineItemSchema = createInsertSchema(templateLineItems).omit({
  id: true,
  createdAt: true,
});

export const insertTemplatePhotoSchema = createInsertSchema(templatePhotos).omit({
  id: true,
  createdAt: true,
});

export const insertGeneratedDocumentSchema = createInsertSchema(generatedDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGeneratedDocumentLineItemSchema = createInsertSchema(generatedDocumentLineItems).omit({
  id: true,
  createdAt: true,
});

export const insertGeneratedDocumentPhotoSchema = createInsertSchema(generatedDocumentPhotos).omit({
  id: true,
  createdAt: true,
});

// Section config type for invoice/quote/proposal templates
export interface InvoiceSectionConfig {
  id: string;
  label: string;
  visible: boolean;
  locked: boolean; // if true, cannot be hidden
}

// =====================================
// DOCUMENT BLOCK BUILDER TYPES
// =====================================

export type DocumentBlockType =
  | 'header'
  | 'companyInfo'
  | 'billTo'
  | 'invoiceMeta'
  | 'jobDescription'
  | 'lineItems'
  | 'totals'
  | 'payment'
  | 'divider'
  | 'customText'
  | 'footer'
  | 'proposalMeta'
  | 'lineItemsWithChoices'
  | 'photoGallery'
  | 'acceptance';

export interface DocumentBlockConfigHeader {
  logoAlignment: 'left' | 'center' | 'right';
  headerColor: string;
  showCompanyName: boolean;
}

export interface DocumentBlockConfigCompanyInfo {
  showName: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showGST: boolean;
}

export interface DocumentBlockConfigBillTo {
  label: string;
  showEmail: boolean;
  showAddress: boolean;
}

export interface DocumentBlockConfigInvoiceMeta {
  showInvoiceNumber: boolean;
  showIssueDate: boolean;
  showDueDate: boolean;
  showJobNumber: boolean;
  labelInvoice: string;
  labelIssueDate: string;
  labelDueDate: string;
}

export interface DocumentBlockConfigJobDescription {
  label: string;
}

export interface DocumentBlockConfigLineItems {
  labelDescription: string;
  labelQty: string;
  labelRate: string;
  labelAmount: string;
  showQty: boolean;
  showRate: boolean;
  descColPct?: number;
}

export interface DocumentBlockConfigTotals {
  showSubtotal: boolean;
  showGST: boolean;
  labelSubtotal: string;
  labelGST: string;
  labelTotal: string;
}

export interface DocumentBlockConfigPayment {
  label: string;
  showBank: boolean;
  showAccountNumber: boolean;
  showAccountName: boolean;
  showDueDate: boolean;
  showTerms: boolean;
}

export interface DocumentBlockConfigDivider {
  color: string;
  thickness: number; // px
}

export interface DocumentBlockConfigCustomText {
  text: string;
  fontSize: 'xs' | 'sm' | 'base';
  align: 'left' | 'center' | 'right';
}

export interface DocumentBlockConfigFooter {
  showCompanyName: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showGST: boolean;
  showPaymentTerms: boolean;
}

// Proposal-flavoured block configs. Data (numbers, line items, photos,
// signatures) comes from the render context at render time; these configs
// only hold labels and toggles the builder exposes.

export interface DocumentBlockConfigProposalMeta {
  showProposalNumber: boolean;
  showIssueDate: boolean;
  showExpiryDate: boolean;
  showJobNumber: boolean;
  labelProposal: string;
  labelIssueDate: string;
  labelExpiryDate: string;
}

export interface DocumentBlockConfigLineItemsWithChoices {
  labelDescription: string;
  labelQty: string;
  labelRate: string;
  labelAmount: string;
  showQty: boolean;
  showRate: boolean;
  showOptionalToggle: boolean;
  showChoiceSelector: boolean;
  descColPct?: number;
}

export interface DocumentBlockConfigPhotoGallery {
  label: string;
  layout: 'grid' | 'single' | 'slideshow';
  columns: 1 | 2 | 3 | 4;
  showCaptions: boolean;
  aspectRatio: 'square' | '4:3' | '16:9' | 'auto';
}

export interface DocumentBlockConfigAcceptance {
  label: string;
  buttonText: string;
  requireSignature: boolean;
  signaturePromptText: string;
  termsText?: string;
  showAcceptedStamp: boolean;
}

export type DocumentBlockConfig =
  | DocumentBlockConfigHeader
  | DocumentBlockConfigCompanyInfo
  | DocumentBlockConfigBillTo
  | DocumentBlockConfigInvoiceMeta
  | DocumentBlockConfigJobDescription
  | DocumentBlockConfigLineItems
  | DocumentBlockConfigTotals
  | DocumentBlockConfigPayment
  | DocumentBlockConfigDivider
  | DocumentBlockConfigCustomText
  | DocumentBlockConfigFooter
  | DocumentBlockConfigProposalMeta
  | DocumentBlockConfigLineItemsWithChoices
  | DocumentBlockConfigPhotoGallery
  | DocumentBlockConfigAcceptance;

export interface DocumentBlock {
  id: string;
  type: DocumentBlockType;
  order: number;
  visible: boolean;
  config: DocumentBlockConfig;
}

export const DEFAULT_INVOICE_BLOCKS: DocumentBlock[] = [
  { id: 'header-default', type: 'header', order: 0, visible: true, config: { logoAlignment: 'left', headerColor: '#ffffff', showCompanyName: true } },
  { id: 'companyInfo-default', type: 'companyInfo', order: 1, visible: true, config: { showName: true, showAddress: true, showPhone: true, showEmail: true, showGST: true } },
  { id: 'invoiceMeta-default', type: 'invoiceMeta', order: 2, visible: true, config: { showInvoiceNumber: true, showIssueDate: true, showDueDate: true, showJobNumber: true, labelInvoice: 'Invoice #', labelIssueDate: 'Issue Date', labelDueDate: 'Due Date' } },
  { id: 'billTo-default', type: 'billTo', order: 3, visible: true, config: { label: 'Bill To', showEmail: true, showAddress: true } },
  { id: 'jobDescription-default', type: 'jobDescription', order: 4, visible: true, config: { label: 'Description' } },
  { id: 'lineItems-default', type: 'lineItems', order: 5, visible: true, config: { labelDescription: 'Service', labelQty: 'Qty', labelRate: 'Rate', labelAmount: 'Price', showQty: true, showRate: true, descColPct: 60 } },
  { id: 'totals-default', type: 'totals', order: 6, visible: true, config: { showSubtotal: true, showGST: true, labelSubtotal: 'Subtotal (excl GST)', labelGST: 'GST (15%)', labelTotal: 'Total Amount' } },
  { id: 'payment-default', type: 'payment', order: 7, visible: true, config: { label: 'Payment Information', showBank: true, showAccountNumber: true, showAccountName: true, showDueDate: true, showTerms: true } },
  { id: 'footer-default', type: 'footer', order: 8, visible: true, config: { showCompanyName: true, showAddress: true, showPhone: true, showEmail: true, showGST: true, showPaymentTerms: true } },
];

export const DEFAULT_PROPOSAL_BLOCKS: DocumentBlock[] = [
  { id: 'header-default', type: 'header', order: 0, visible: true, config: { logoAlignment: 'left', headerColor: '#ffffff', showCompanyName: true } },
  { id: 'companyInfo-default', type: 'companyInfo', order: 1, visible: true, config: { showName: true, showAddress: true, showPhone: true, showEmail: true, showGST: true } },
  { id: 'proposalMeta-default', type: 'proposalMeta', order: 2, visible: true, config: { showProposalNumber: true, showIssueDate: true, showExpiryDate: true, showJobNumber: true, labelProposal: 'Proposal #', labelIssueDate: 'Issue Date', labelExpiryDate: 'Valid Until' } },
  { id: 'billTo-default', type: 'billTo', order: 3, visible: true, config: { label: 'Prepared For', showEmail: true, showAddress: true } },
  { id: 'jobDescription-default', type: 'jobDescription', order: 4, visible: true, config: { label: 'Overview' } },
  { id: 'photoGallery-default', type: 'photoGallery', order: 5, visible: true, config: { label: 'Site Photos', layout: 'grid', columns: 2, showCaptions: true, aspectRatio: '4:3' } },
  { id: 'lineItemsWithChoices-default', type: 'lineItemsWithChoices', order: 6, visible: true, config: { labelDescription: 'Service', labelQty: 'Qty', labelRate: 'Rate', labelAmount: 'Price', showQty: true, showRate: true, showOptionalToggle: true, showChoiceSelector: true, descColPct: 60 } },
  { id: 'totals-default', type: 'totals', order: 7, visible: true, config: { showSubtotal: true, showGST: true, labelSubtotal: 'Subtotal (excl GST)', labelGST: 'GST (15%)', labelTotal: 'Total Amount' } },
  { id: 'customText-default', type: 'customText', order: 8, visible: true, config: { text: 'Terms & Conditions', fontSize: 'sm', align: 'left' } },
  { id: 'acceptance-default', type: 'acceptance', order: 9, visible: true, config: { label: 'Accept This Proposal', buttonText: 'Accept & Sign', requireSignature: true, signaturePromptText: 'By signing below you agree to the above scope and pricing.', showAcceptedStamp: true } },
  { id: 'footer-default', type: 'footer', order: 10, visible: true, config: { showCompanyName: true, showAddress: true, showPhone: true, showEmail: true, showGST: true, showPaymentTerms: false } },
];

// TypeScript Types
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

export type InsertTemplateSection = z.infer<typeof insertTemplateSectionSchema>;
export type TemplateSection = typeof templateSections.$inferSelect;

export type InsertTemplateLineItem = z.infer<typeof insertTemplateLineItemSchema>;
export type TemplateLineItem = typeof templateLineItems.$inferSelect;

export type InsertTemplatePhoto = z.infer<typeof insertTemplatePhotoSchema>;
export type TemplatePhoto = typeof templatePhotos.$inferSelect;

export type InsertGeneratedDocument = z.infer<typeof insertGeneratedDocumentSchema>;
export type GeneratedDocument = typeof generatedDocuments.$inferSelect;

export type InsertGeneratedDocumentLineItem = z.infer<typeof insertGeneratedDocumentLineItemSchema>;
export type GeneratedDocumentLineItem = typeof generatedDocumentLineItems.$inferSelect;

export type InsertGeneratedDocumentPhoto = z.infer<typeof insertGeneratedDocumentPhotoSchema>;
export type GeneratedDocumentPhoto = typeof generatedDocumentPhotos.$inferSelect;

// Document Type Enums
export const DocumentType = z.enum(["quote", "proposal", "invoice"]);
export const DocumentStatus = z.enum(["draft", "sent", "viewed", "accepted", "rejected"]);
export const SectionType = z.enum(["option", "terms", "description", "summary"]);
export const ItemType = z.enum(["service", "material", "labor", "equipment", "travel", "disposal"]);

export type DocumentTypeType = z.infer<typeof DocumentType>;
export type DocumentStatusType = z.infer<typeof DocumentStatus>;
export type SectionTypeType = z.infer<typeof SectionType>;
export type ItemTypeType = z.infer<typeof ItemType>;

// Materials and Services Catalog Tables
export const materials = pgTable("materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemNumber: text("item_number").notNull(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0.00"),
  priceIncludesTax: boolean("price_includes_tax").default(false),
  taxRate: text("tax_rate").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  baseCost: decimal("base_cost", { precision: 10, scale: 2 }).default("0.00"),
  unit: text("unit").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert Schemas
export const insertMaterialSchema = createInsertSchema(materials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// TypeScript Types
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

// Review Management Tables
export const reviewRequests = pgTable("review_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  
  // Unique token for public review link
  token: varchar("token", { length: 64 }).notNull().unique(),
  
  // Request tracking
  status: text("status").notNull().default("pending"), // pending, sent, submitted, skipped
  sentAt: timestamp("sent_at"),
  sentBy: text("sent_by"), // Staff member who sent it
  sentVia: text("sent_via"), // sms, email, both
  
  // Customer info (snapshot at time of request)
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  jobNumber: text("job_number"),
  jobAddress: text("job_address"),
  
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const reviewSubmissions = pgTable("review_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").references(() => reviewRequests.id).notNull(),
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
  customerId: varchar("customer_id").references(() => customers.id).notNull(),
  
  // Review content
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  
  // Posting status
  postedToGoogle: boolean("posted_to_google").default(false),
  postedToFacebook: boolean("posted_to_facebook").default(false),
  googlePostStatus: text("google_post_status"), // pending, posted, failed, held
  facebookPostStatus: text("facebook_post_status"), // pending, posted, failed, held
  googlePostedAt: timestamp("google_posted_at"),
  facebookPostedAt: timestamp("facebook_posted_at"),
  
  // Internal tracking
  internalStatus: text("internal_status").default("pending_review"), // pending_review, approved, held, rejected
  reviewedBy: text("reviewed_by"), // Staff member who reviewed
  reviewedAt: timestamp("reviewed_at"),
  internalNotes: text("internal_notes"),
  
  submittedAt: timestamp("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Review Schemas
export const insertReviewRequestSchema = createInsertSchema(reviewRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewSubmissionSchema = createInsertSchema(reviewSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type InsertReviewRequest = z.infer<typeof insertReviewRequestSchema>;

export type ReviewSubmission = typeof reviewSubmissions.$inferSelect;
export type InsertReviewSubmission = z.infer<typeof insertReviewSubmissionSchema>;

// Job Hazard Analysis (JHA) System
export const jhaHazardTemplates = pgTable("jha_hazard_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "Falling Debris", "Tree Felling"
  description: text("description"),
  category: text("category"), // e.g., "Tree Work", "Equipment", "Environmental"
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const jhaControlMeasureTemplates = pgTable("jha_control_measure_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hazardTemplateId: varchar("hazard_template_id").references(() => jhaHazardTemplates.id),
  description: text("description").notNull(), // e.g., "Wear the correct P.P.E. for the job"
  hierarchyLevel: integer("hierarchy_level").notNull().default(3), // 1=Elimination, 2=Substitution, 3=Engineering, 4=Administrative, 5=PPE
  riskReduction: integer("risk_reduction").default(1), // How much this reduces risk (1-5)
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const jhaAssessments = pgTable("jha_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id),
  assessmentNumber: text("assessment_number").unique(),
  
  // Job details
  date: timestamp("date").notNull().default(sql`CURRENT_TIMESTAMP`),
  location: text("location"),
  gpsCoordinates: text("gps_coordinates"),
  activityDescription: text("activity_description"), // "Activity taking place"
  ppeRequired: text("ppe_required").array(),
  teamLeader: text("team_leader"),
  teamLeaderId: varchar("team_leader_id").references(() => employees.id),
  
  // Summary
  summary: text("summary"), // Auto-generated formatted summary
  
  // Overall assessment
  overallRiskRating: integer("overall_risk_rating"), // Highest risk from all steps
  status: text("status").notNull().default("draft"), // draft, completed, archived
  
  // Photos
  photos: text("photos").array().default([]),
  
  // Comments
  comments: text("comments"),
  
  createdBy: varchar("created_by").references(() => employees.id),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const jhaSteps = pgTable("jha_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").references(() => jhaAssessments.id).notNull(),
  stepNumber: integer("step_number").notNull(), // Order of steps
  
  // Hazard info
  stepName: text("step_name"), // Optional step/task name
  hazardName: text("hazard_name").notNull(), // e.g., "Falling Debris"
  hazardDescription: text("hazard_description"),
  hazardTemplateId: varchar("hazard_template_id").references(() => jhaHazardTemplates.id),
  
  // Risk ratings (1-5 scale based on risk matrix)
  initialRiskRating: integer("initial_risk_rating").notNull(), // Risk with no controls
  residualRiskRating: integer("residual_risk_rating"), // Risk after controls applied
  
  // Risk Control (hierarchy of controls)
  riskControl: text("risk_control"), // elimination, substitution, engineering, administrative, ppe
  
  // Responsibility
  responsiblePerson: text("responsible_person"),
  responsiblePersonId: varchar("responsible_person_id").references(() => employees.id),
  
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const jhaStepControls = pgTable("jha_step_controls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stepId: varchar("step_id").references(() => jhaSteps.id).notNull(),
  controlMeasureTemplateId: varchar("control_measure_template_id").references(() => jhaControlMeasureTemplates.id),
  
  // Control measure details
  description: text("description").notNull(), // Control measure text
  hierarchyLevel: integer("hierarchy_level").default(3), // 1-5 hierarchy of controls
  isImplemented: boolean("is_implemented").notNull().default(true), // Checkbox state
  
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const jhaSignatures = pgTable("jha_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id").references(() => jhaAssessments.id).notNull(),
  
  // Signer info
  workerName: text("worker_name").notNull(),
  workerId: varchar("worker_id").references(() => employees.id),
  
  // Signature
  signatureDataUrl: text("signature_data_url").notNull(), // Base64 signature image
  signedAt: timestamp("signed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const jhaRiskControlTemplates = pgTable("jha_risk_control_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "Elimination", "Substitution", "Engineering Controls"
  description: text("description"), // Optional description of when to use this control type
  hierarchyLevel: integer("hierarchy_level").notNull(), // 1=Elimination (most effective), 5=PPE (least effective)
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// JHA Schemas
export const insertJhaHazardTemplateSchema = createInsertSchema(jhaHazardTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJhaControlMeasureTemplateSchema = createInsertSchema(jhaControlMeasureTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJhaAssessmentSchema = createInsertSchema(jhaAssessments).omit({
  id: true,
  assessmentNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJhaStepSchema = createInsertSchema(jhaSteps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJhaStepControlSchema = createInsertSchema(jhaStepControls).omit({
  id: true,
  createdAt: true,
});

export const insertJhaSignatureSchema = createInsertSchema(jhaSignatures).omit({
  id: true,
  createdAt: true,
});

export const insertJhaRiskControlTemplateSchema = createInsertSchema(jhaRiskControlTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// JHA Types
export type JhaHazardTemplate = typeof jhaHazardTemplates.$inferSelect;
export type InsertJhaHazardTemplate = z.infer<typeof insertJhaHazardTemplateSchema>;

export type JhaControlMeasureTemplate = typeof jhaControlMeasureTemplates.$inferSelect;
export type InsertJhaControlMeasureTemplate = z.infer<typeof insertJhaControlMeasureTemplateSchema>;

export type JhaAssessment = typeof jhaAssessments.$inferSelect;
export type InsertJhaAssessment = z.infer<typeof insertJhaAssessmentSchema>;

export type JhaStep = typeof jhaSteps.$inferSelect;
export type InsertJhaStep = z.infer<typeof insertJhaStepSchema>;

export type JhaStepControl = typeof jhaStepControls.$inferSelect;
export type InsertJhaStepControl = z.infer<typeof insertJhaStepControlSchema>;

export type JhaSignature = typeof jhaSignatures.$inferSelect;
export type InsertJhaSignature = z.infer<typeof insertJhaSignatureSchema>;

export type JhaRiskControlTemplate = typeof jhaRiskControlTemplates.$inferSelect;
export type InsertJhaRiskControlTemplate = z.infer<typeof insertJhaRiskControlTemplateSchema>;

// Marketing Campaigns
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Campaign basics
  name: text("name").notNull(),
  type: text("type").notNull(), // 'ad' or 'review_post'
  platform: text("platform").notNull(), // 'facebook', 'instagram', or 'both'
  status: text("status").notNull().default('draft'), // 'draft', 'scheduled', 'published', 'failed'
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at"),
  
  // Ad campaign specific
  objective: text("objective"), // 'awareness', 'traffic', 'engagement', 'leads', 'sales'
  budget: decimal("budget", { precision: 10, scale: 2 }),
  budgetType: text("budget_type"), // 'daily' or 'lifetime'
  adCreative: jsonb("ad_creative"), // {headline, text, imageUrl, ctaText, ctaUrl}
  targeting: jsonb("targeting"), // {location, age, interests, etc}
  
  // Review post specific
  reviewId: text("review_id"), // Reference to Google/Facebook review
  reviewText: text("review_text"),
  reviewAuthor: text("review_author"),
  reviewRating: integer("review_rating"),
  reviewSource: text("review_source"), // 'google' or 'facebook'
  
  // Performance tracking
  metaCampaignId: text("meta_campaign_id"), // Facebook/Instagram campaign ID
  metaAdSetId: text("meta_ad_set_id"),
  metaAdId: text("meta_ad_id"),
  metaPostId: text("meta_post_id"), // For review posts
  
  reach: integer("reach").default(0),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  engagement: integer("engagement").default(0),
  spent: decimal("spent", { precision: 10, scale: 2 }).default('0'),
  conversions: integer("conversions").default(0),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Marketing campaign insert schema
export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Marketing campaign types
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;

// ========================================
// PUSH NOTIFICATIONS - FCM Tokens
// ========================================

// FCM (Firebase Cloud Messaging) notification tokens
export const fcmTokens = pgTable("fcm_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  token: text("token").notNull().unique(),
  deviceInfo: text("device_info"), // Browser/device information
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Notification preferences for each employee
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }).unique(),
  
  // Job-related notifications
  jobAssignments: boolean("job_assignments").notNull().default(true),
  scheduleChanges: boolean("schedule_changes").notNull().default(true),
  jobStatusUpdates: boolean("job_status_updates").notNull().default(false),
  
  // Business notifications
  newLeads: boolean("new_leads").notNull().default(false), // Admin only
  invoicePayments: boolean("invoice_payments").notNull().default(false), // Admin only
  quoteAccepted: boolean("quote_accepted").notNull().default(false), // Admin only
  
  // Communication notifications
  customerMessages: boolean("customer_messages").notNull().default(true),
  teamMessages: boolean("team_messages").notNull().default(true),

  // In-app bell preferences — per notification type. Key = notifications.type
  // string (e.g. 'photo_added'), value = boolean visible. Missing key defaults
  // to visible. The FCM-push fields above are a separate axis (delivery
  // channel), not duplicated here.
  bellPreferences: jsonb("bell_preferences").$type<Record<string, boolean>>().notNull().default(sql`'{}'::jsonb`),

  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// FCM tokens schemas
export const insertFcmTokenSchema = createInsertSchema(fcmTokens).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type FcmToken = typeof fcmTokens.$inferSelect;
export type InsertFcmToken = z.infer<typeof insertFcmTokenSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;

// ========================================
// CALL RECORDS
// ========================================

export const callRecords = pgTable("call_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Call details
  direction: text("direction").notNull(), // 'inbound' or 'outbound'
  status: text("status").notNull().default('completed'), // 'ringing', 'in_progress', 'completed', 'missed', 'failed'
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  duration: integer("duration"), // Duration in seconds
  
  // Recording and transcription
  recordingUrl: text("recording_url"),
  transcription: text("transcription"),
  transcriptionSummary: text("transcription_summary"), // AI-generated summary
  sentiment: text("sentiment"), // 'positive', 'neutral', 'negative'
  
  // Linking to entities
  jobId: varchar("job_id").references(() => jobs.id),
  customerId: varchar("customer_id").references(() => customers.id),
  leadId: varchar("lead_id").references(() => leads.id),
  employeeId: varchar("employee_id").references(() => employees.id), // Staff member who made/received call
  jobDiaryEntryId: varchar("job_diary_entry_id").references(() => jobDiaryEntries.id),
  
  // Contact info (cached for quick display)
  callerName: text("caller_name"),
  callerEmail: text("caller_email"),
  
  // Metadata
  notes: text("notes"), // Manual notes added by staff
  tags: text("tags").array(), // Tags like 'follow-up', 'urgent', 'complaint'
  isArchived: boolean("is_archived").default(false),
  
  // Timestamps
  callStartedAt: timestamp("call_started_at"),
  callEndedAt: timestamp("call_ended_at"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  jobIdIdx: index("call_records_job_id_idx").on(table.jobId),
  customerIdIdx: index("call_records_customer_id_idx").on(table.customerId),
  leadIdIdx: index("call_records_lead_id_idx").on(table.leadId),
  fromNumberIdx: index("call_records_from_number_idx").on(table.fromNumber),
  toNumberIdx: index("call_records_to_number_idx").on(table.toNumber),
  createdAtIdx: index("call_records_created_at_idx").on(table.createdAt),
}));

// Call records schemas
export const insertCallRecordSchema = createInsertSchema(callRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCallRecordSchema = insertCallRecordSchema.partial();

// Call record types
export type CallRecord = typeof callRecords.$inferSelect;
export type InsertCallRecord = z.infer<typeof insertCallRecordSchema>;
export type UpdateCallRecord = z.infer<typeof updateCallRecordSchema>;

// Tree location markers for job site mapping
export const treeMarkers = pgTable("tree_markers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  label: text("label"), // e.g., "Large oak - remove"
  notes: text("notes"), // Additional notes about the tree
  markerType: text("marker_type").default('tree'), // tree, stump, hazard, etc.
  color: text("color").default('#22c55e'), // Marker color (green default)
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  jobIdIdx: index("tree_markers_job_id_idx").on(table.jobId),
}));

// Tree markers schemas
export const insertTreeMarkerSchema = createInsertSchema(treeMarkers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTreeMarkerSchema = insertTreeMarkerSchema.partial();

// Tree marker types
export type TreeMarker = typeof treeMarkers.$inferSelect;
export type InsertTreeMarker = z.infer<typeof insertTreeMarkerSchema>;
export type UpdateTreeMarker = z.infer<typeof updateTreeMarkerSchema>;

// ─── Mulch Drops ────────────────────────────────────────────────────────────
export const mulchDrops = pgTable("mulch_drops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(''),
  address: text("address").notNull().default(''),
  dropNotes: text("drop_notes"),           // where exactly on the property
  status: text("status").notNull().default('pending'), // pending | delivered | cancelled
  photos: text("photos").array().default([]),
  notes: text("notes"),                    // general internal notes
  source: text("source").default('manual'), // manual | facebook
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertMulchDropSchema = createInsertSchema(mulchDrops).omit({ id: true, createdAt: true, updatedAt: true });
export const updateMulchDropSchema = insertMulchDropSchema.partial();

export type MulchDrop = typeof mulchDrops.$inferSelect;
export type InsertMulchDrop = z.infer<typeof insertMulchDropSchema>;
export type UpdateMulchDrop = z.infer<typeof updateMulchDropSchema>;

// Daily Briefing tables
export const dailyBriefings = pgTable("daily_briefings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull().unique(), // YYYY-MM-DD
  content: text("content").notNull().default(''),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dailyJobNotes = pgTable("daily_job_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  date: text("date").notNull(), // YYYY-MM-DD
  note: text("note").notNull(),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const checklistTemplates = pgTable("checklist_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplates).omit({ id: true, createdAt: true });
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;

// Per-role checklist tasks rendered in the Job Card Diary's Kaitiaki / Kaiwhangai /
// Kaitirotiro panels. Replaces the hardcoded ROLE_ITEMS constant in
// JobChecklistPanel.tsx so subscribers can toggle, edit, reorder, or add tasks
// from Settings. Built-in tasks (the seven seeded defaults) can be disabled but
// not deleted; user-added ones are fully editable.
export const roleChecklistTasks = pgTable("role_checklist_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleKey: varchar("role_key").notNull(), // 'A' | 'B' | 'C'
  itemId: text("item_id").notNull().unique(), // slug used by completions table
  label: text("label").notNull(),
  iconName: text("icon_name").notNull().default("Check"), // lucide icon name
  sortOrder: integer("sort_order").notNull().default(0),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isBuiltIn: boolean("is_built_in").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertRoleChecklistTaskSchema = createInsertSchema(roleChecklistTasks).omit({ id: true, createdAt: true, updatedAt: true });
export type RoleChecklistTask = typeof roleChecklistTasks.$inferSelect;
export type InsertRoleChecklistTask = z.infer<typeof insertRoleChecklistTaskSchema>;

export const insertDailyBriefingSchema = createInsertSchema(dailyBriefings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDailyJobNoteSchema = createInsertSchema(dailyJobNotes).omit({ id: true, createdAt: true });
export type DailyBriefing = typeof dailyBriefings.$inferSelect;
export type InsertDailyBriefing = z.infer<typeof insertDailyBriefingSchema>;
export type DailyJobNote = typeof dailyJobNotes.$inferSelect;
export type InsertDailyJobNote = z.infer<typeof insertDailyJobNoteSchema>;

// AI Assistant Messages
export const assistantMessages = pgTable("assistant_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  employeeId: varchar("employee_id").notNull(), // owner — enforced on read/delete
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAssistantMessageSchema = createInsertSchema(assistantMessages).omit({ id: true, createdAt: true });
export type AssistantMessage = typeof assistantMessages.$inferSelect;
export type InsertAssistantMessage = z.infer<typeof insertAssistantMessageSchema>;

// ========================================
// PENDING OUTBOUND MESSAGES
// Draft customer messages awaiting owner approval before sending
// ========================================
export const pendingOutboundMessages = pgTable("pending_outbound_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => jobs.id),
  customerId: varchar("customer_id").references(() => customers.id),
  proposalId: varchar("proposal_id"),
  proposalNumber: text("proposal_number"),
  recipientName: text("recipient_name"),
  recipientPhone: text("recipient_phone"),
  recipientEmail: text("recipient_email"),
  message: text("message").notNull(),
  channel: text("channel").notNull().default('sms'), // 'sms' or 'email'
  status: text("status").notNull().default('pending'), // 'pending', 'approved', 'rejected', 'sent'
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPendingOutboundMessageSchema = createInsertSchema(pendingOutboundMessages).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export type PendingOutboundMessage = typeof pendingOutboundMessages.$inferSelect;
export type InsertPendingOutboundMessage = z.infer<typeof insertPendingOutboundMessageSchema>;

// ==========================================
// Near Miss Reporting Module
// ==========================================
// Lightweight incident-precursor capture flow under the JHA system.
// Distinct from `safetyIncidents` above, which records actual incidents/injuries;
// near-miss is the "almost happened" pre-event log used for proactive control
// review and toolbox talks.

export const nearMissReports = pgTable("near_miss_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportNumber: text("report_number").notNull().unique(), // NM-YYYY-####
  reporterUserId: varchar("reporter_user_id").references(() => employees.id).notNull(),
  status: text("status").notNull().default("draft"), // draft, submitted, in_review, actioned, closed
  jobId: varchar("job_id").references(() => jobs.id),
  locationAddress: text("location_address"),
  locationLat: decimal("location_lat", { precision: 10, scale: 7 }),
  locationLng: decimal("location_lng", { precision: 10, scale: 7 }),
  incidentDatetime: timestamp("incident_datetime").notNull(),
  category: text("category").notNull(), // struck_by, fall_from_height, electrical, cut_laceration, vehicle, public_safety, drop_zone_breach, equipment_failure, manual_handling, other
  potentialSeverity: text("potential_severity").notNull(), // low, medium, high, critical
  description: text("description").notNull(),
  immediateActionTaken: text("immediate_action_taken"),
  equipmentInvolved: text("equipment_involved").array().default([]),
  contributingFactors: text("contributing_factors").array().default([]), // communication, fatigue, weather, planning, training, equipment, other
  peopleInvolved: jsonb("people_involved").default([]), // [{userId?, name}]
  toolboxTalkFlag: boolean("toolbox_talk_flag").default(true),
  proposedControl: text("proposed_control"),
  reporterSignatureSvg: text("reporter_signature_svg"), // SVG — reporter / person involved sign-off
  reporterSignedAt: timestamp("reporter_signed_at"),
  submittedAt: timestamp("submitted_at"),
  effectivenessReviewDate: timestamp("effectiveness_review_date"), // submittedAt + 30 days
  effectivenessReviewComplete: boolean("effectiveness_review_complete").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const nearMissAttachments = pgTable("near_miss_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => nearMissReports.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // photo, voice_note
  filePath: text("file_path").notNull(),
  uploadedBy: varchar("uploaded_by").references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const nearMissWitnesses = pgTable("near_miss_witnesses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => nearMissReports.id, { onDelete: "cascade" }).notNull(),
  witnessUserId: varchar("witness_user_id").references(() => employees.id), // null for non-staff witnesses
  witnessName: text("witness_name"), // free-text for non-users
  status: text("status").notNull().default("pending"), // pending, signed, declined, no_witness
  signatureSvg: text("signature_svg"), // SVG path data (not base64)
  witnessComment: text("witness_comment"),
  signedAt: timestamp("signed_at"),
  signedLat: decimal("signed_lat", { precision: 10, scale: 7 }),
  signedLng: decimal("signed_lng", { precision: 10, scale: 7 }),
  signedDevice: text("signed_device"), // user agent string
  reportHashAtSigning: text("report_hash_at_signing"), // SHA-256 of report content at signing time — detects post-sign tampering
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const nearMissActions = pgTable("near_miss_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => nearMissReports.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  controlType: text("control_type"), // engineering, admin, ppe, substitution, elimination
  assignedToUserId: varchar("assigned_to_user_id").references(() => employees.id),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("open"), // open, in_progress, complete
  linkedSopId: varchar("linked_sop_id"), // forward-compat: no FK constraint until sops table exists
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNearMissReportSchema = createInsertSchema(nearMissReports).omit({
  id: true,
  reportNumber: true, // server generates
  createdAt: true,
  updatedAt: true,
});
export const updateNearMissReportSchema = insertNearMissReportSchema.partial();

export const insertNearMissAttachmentSchema = createInsertSchema(nearMissAttachments).omit({
  id: true,
  createdAt: true,
});

export const insertNearMissWitnessSchema = createInsertSchema(nearMissWitnesses).omit({
  id: true,
  createdAt: true,
});
export const updateNearMissWitnessSchema = insertNearMissWitnessSchema.partial();

export const insertNearMissActionSchema = createInsertSchema(nearMissActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateNearMissActionSchema = insertNearMissActionSchema.partial();

export type NearMissReport = typeof nearMissReports.$inferSelect;
export type InsertNearMissReport = z.infer<typeof insertNearMissReportSchema>;
export type UpdateNearMissReport = z.infer<typeof updateNearMissReportSchema>;
export type NearMissAttachment = typeof nearMissAttachments.$inferSelect;
export type InsertNearMissAttachment = z.infer<typeof insertNearMissAttachmentSchema>;
export type NearMissWitness = typeof nearMissWitnesses.$inferSelect;
export type InsertNearMissWitness = z.infer<typeof insertNearMissWitnessSchema>;
export type UpdateNearMissWitness = z.infer<typeof updateNearMissWitnessSchema>;
export type NearMissAction = typeof nearMissActions.$inferSelect;
export type InsertNearMissAction = z.infer<typeof insertNearMissActionSchema>;
export type UpdateNearMissAction = z.infer<typeof updateNearMissActionSchema>;

// ==========================================
// JOB COMPLETION CHECKLIST (manual ticks)
// ==========================================
// One row per (jobId, itemId) when an operator marks the item complete.
// Absence of a row means "not done". Toggling off deletes the row.
export const jobChecklistCompletions = pgTable("job_checklist_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  itemId: text("item_id").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
  completedByEmployeeId: varchar("completed_by_employee_id").references(() => employees.id),
  completedByName: text("completed_by_name"),
}, (table) => ({
  jobItemUnique: unique("job_checklist_completions_job_item_unique").on(table.jobId, table.itemId),
  jobIdx: index("job_checklist_completions_job_idx").on(table.jobId),
}));

export const insertJobChecklistCompletionSchema = createInsertSchema(jobChecklistCompletions).omit({
  id: true,
  completedAt: true,
});

export type JobChecklistCompletion = typeof jobChecklistCompletions.$inferSelect;
export type InsertJobChecklistCompletion = z.infer<typeof insertJobChecklistCompletionSchema>;

// ==========================================
// ON-SITE QUOTING PROCESS
// ==========================================
// Configurable list of steps the quoter walks through during an on-site quote.
// Mirrors the role_checklist_tasks pattern: built-ins seeded once, users can
// disable/edit/reorder them or add their own from Settings. The itemId slug
// is the stable key referenced by completions, so it stays put even if the
// label is renamed.
export const quotingProcessSteps = pgTable("quoting_process_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: text("item_id").notNull().unique(),
  label: text("label").notNull(),
  iconName: text("icon_name").notNull().default("Check"),
  sortOrder: integer("sort_order").notNull().default(0),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isBuiltIn: boolean("is_built_in").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertQuotingProcessStepSchema = createInsertSchema(quotingProcessSteps).omit({ id: true, createdAt: true, updatedAt: true });
export type QuotingProcessStep = typeof quotingProcessSteps.$inferSelect;
export type InsertQuotingProcessStep = z.infer<typeof insertQuotingProcessStepSchema>;

// One row per (jobId, itemId) when a step is ticked off during the visit.
// Absence of a row means "not done". Toggling off deletes the row, which also
// clears the captured note/photos — same convention as job_checklist_completions.
export const jobQuotingProcessCompletions = pgTable("job_quoting_process_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  itemId: text("item_id").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
  completedByEmployeeId: varchar("completed_by_employee_id").references(() => employees.id),
  completedByName: text("completed_by_name"),
  note: text("note"),
  photos: text("photos").array(),
}, (table) => ({
  jobItemUnique: unique("job_quoting_process_completions_job_item_unique").on(table.jobId, table.itemId),
  jobIdx: index("job_quoting_process_completions_job_idx").on(table.jobId),
}));

export const insertJobQuotingProcessCompletionSchema = createInsertSchema(jobQuotingProcessCompletions).omit({
  id: true,
  completedAt: true,
});
export type JobQuotingProcessCompletion = typeof jobQuotingProcessCompletions.$inferSelect;
export type InsertJobQuotingProcessCompletion = z.infer<typeof insertJobQuotingProcessCompletionSchema>;

// Export time tracking tables from timeTracking.ts
export * from './timeTracking';
