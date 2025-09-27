import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, jsonb, real } from "drizzle-orm/pg-core";
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
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
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
export const JobStatus = z.enum(['lead', 'quote', 'scheduled', 'work_order', 'completed', 'unsuccessful']);
export type JobStatusType = z.infer<typeof JobStatus>;

export const LeadSourceType = z.enum(['phone', 'website', 'referral', 'google', 'facebook', 'direct', 'advertisement', 'other']);
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
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

// Quote Management
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
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
});

// Job Management
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => customers.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  jobNumber: text("job_number").notNull().unique(),
  title: text("title"),
  description: text("description"),
  leadSource: text("lead_source"), // phone, website, referral, google, facebook, direct, other
  address: text("address").notNull().default("Address not specified"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  status: text("status").notNull().default('lead'), // lead, quote, scheduled, work_order, completed, unsuccessful
  priority: text("priority"), // low, medium, high, urgent
  assignedTeam: text("assigned_team").array(),
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
  checklist: jsonb("checklist"), // [{"id": "uuid", "text": "Task description", "completed": false}]
  notes: text("notes"), // Job notes and comments
  lineItems: jsonb("line_items"), // [{"id": "string", "description": "string", "quantity": number, "unitPrice": number, "total": number}]
  
  weatherDependent: boolean("weather_dependent").default(false),
  permitRequired: boolean("permit_required").default(false),
  insuranceClaim: boolean("insurance_claim").default(false),
  rescheduledReason: text("rescheduled_reason"),
  
  // Fresh Start Metrics - Only jobs created after implementation count toward business metrics
  metricsEligible: boolean("metrics_eligible").default(false),
  metricsStartDate: timestamp("metrics_start_date"), // Date when clean metrics tracking began
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  weatherConditions: text("weather_conditions"), // sunny, rainy, windy, etc
  equipmentUsed: text("equipment_used").array(), // Equipment used during this activity
  timeSpent: integer("time_spent"), // Minutes spent on this activity
  progress: integer("progress"), // Percentage completion (0-100)
  tags: text("tags").array(), // safety, urgent, customer-request, etc
  location: text("location"), // Specific location within job site
  isPrivate: boolean("is_private").default(false), // Internal notes only
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  jobId: varchar("job_id").references(() => jobs.id).notNull(),
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
  quoteId: varchar("quote_id").references(() => quotes.id).notNull(),
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

// Checklist item schema for jobs
export const checklistItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Checklist item cannot be empty"),
  completed: z.boolean().default(false),
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const insertTeamSchema = createInsertSchema(teams).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerImportBatchSchema = createInsertSchema(customerImportBatches).omit({ id: true, createdAt: true });
export const updateCustomerImportBatchSchema = createInsertSchema(customerImportBatches).omit({ id: true, createdAt: true }).partial();
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCommunicationPreferencesSchema = createInsertSchema(communicationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCallSchema = createInsertSchema(calls).omit({ id: true, createdAt: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobSchema = createInsertSchema(jobs)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    status: JobStatus.optional().default('lead'),
    checklist: z.array(checklistItemSchema).optional().default([]),
    lineItems: z.array(z.object({
      id: z.string(),
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      total: z.number(),
      unitCost: z.number().optional().default(0),
      totalCost: z.number().optional().default(0)
    })).optional().default([]),
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
export type InsertCustomerImportBatch = z.infer<typeof insertCustomerImportBatchSchema>;
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
export type ServiceM8CustomerCsv = z.infer<typeof servicem8CustomerCsvSchema>;
export type ServiceM8JobCsv = z.infer<typeof servicem8JobCsvSchema>;  
export type ServiceM8QuoteCsv = z.infer<typeof servicem8QuoteCsvSchema>;
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
  
  // Integration Management
  servicem8Enabled: boolean("servicem8_enabled").default(false),
  servicem8ApiKey: text("servicem8_api_key").default(""),
  googleCalendarEnabled: boolean("google_calendar_enabled").default(false),
  emailIntegrationEnabled: boolean("email_integration_enabled").default(false),
  paymentGatewayEnabled: boolean("payment_gateway_enabled").default(false),
  paymentProvider: text("payment_provider").default("stripe"), // stripe, paypal, square
  
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
  // Add enum constraints for select fields
  leadAssignmentMethod: z.enum(['round_robin', 'skill_based', 'manual']).optional(),
  quotePricingModel: z.enum(['standard', 'dynamic', 'competitive']).optional(),
  backupFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  exportFormat: z.enum(['csv', 'excel', 'json']).optional(),
  paymentProvider: z.enum(['stripe', 'paypal', 'square']).optional(),
  locationAccuracy: z.enum(['low', 'medium', 'high']).optional(),
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
  // Metadata
  metadata: jsonb("metadata"), // Additional data for the notification
  actionUrl: text("action_url"), // URL to navigate when notification is clicked
  expiresAt: timestamp("expires_at"), // Optional expiration date
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"), // When notification was read
});

// Notification Insert Schema
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
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

// ========================================
// SCHEDULING & TEAM MANAGEMENT SCHEMAS
// ========================================

// Staff Role Enum
export const StaffRole = z.enum(['owner', 'office_staff', 'crew']);
export type StaffRoleType = z.infer<typeof StaffRole>;

// Employee/Team Member Schema
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  position: text("position").notNull(), // arborist, ground_crew, foreman, driver
  role: text("role").notNull().default("crew"), // owner, office_staff, crew
  status: text("status").notNull().default("active"), // active, inactive, on_leave
  skillLevel: text("skill_level").notNull().default("beginner"), // beginner, intermediate, expert
  certifications: text("certifications").array().default([]), // ISA, CTSP, etc.
  skills: text("skills").array().default([]), // chainsaw, bucket_truck, climbing, etc.
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  availableHours: text("available_hours"), // JSON: {"mon": "8-17", "tue": "8-17", ...}
  emergencyContact: text("emergency_contact"),
  emergencyContactPhone: text("emergency_contact_phone"),
  notes: text("notes"),
  hireDate: timestamp("hire_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertEmployeeSchema = createInsertSchema(employees);

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
  maxLength: integer("max_length").default(160),
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
}).refine((data) => {
  // Validate sourceId based on sourceType
  if (data.sourceType === 'fixed' && data.sourceId) {
    return false; // Fixed items should not have sourceId
  }
  if ((data.sourceType === 'quote' || data.sourceType === 'template') && !data.sourceId) {
    return false; // Quote/template items must have sourceId
  }
  
  // Validate pricing type constraints
  if (data.pricingType === 'choice' && !data.selectedChoiceId) {
    return false; // Choice items must have a selected choice
  }
  if (data.pricingType === 'fixed') {
    if (!data.fixedPrice) return false; // Fixed pricing items must have a fixed price
    if (data.selectedChoiceId) return false; // Fixed pricing should not have selected choices
  }
  if (data.pricingType === 'normal') {
    if (data.selectedChoiceId) return false; // Normal pricing should not have selected choices
    if (data.fixedPrice) return false; // Normal pricing should not have fixed price
  }
  
  // Validate totalPrice calculation based on pricing type
  if (data.pricingType === 'fixed') {
    // Fixed pricing: totalPrice should equal fixedPrice
    if (Math.abs(Number(data.totalPrice) - Number(data.fixedPrice || 0)) > 0.01) {
      return false;
    }
  } else if (data.pricingType === 'normal') {
    // Normal pricing: totalPrice should equal quantity × unitPrice
    const calculatedTotal = Number(data.quantity) * Number(data.unitPrice);
    if (Math.abs(calculatedTotal - Number(data.totalPrice)) > 0.01) {
      return false;
    }
  }
  // Choice pricing validation would need the actual choices data to validate totalPrice
  // This is enforced at the API/service layer where choices are available
  
  return true;
}, {
  message: "Invalid line item: pricing type constraints or calculation errors"
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
  type: text("type").notNull(), // vehicle, chainsaw, chipper, bucket_truck, stump_grinder, safety_gear
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
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(), // pending, paid, overdue, cancelled
  items: jsonb("items").notNull(), // Array of {description, quantity, rate, amount}
  notes: text("notes"),
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
  companyAddress: text("company_address").default("Hauroa rd\nGisborne, 4010"),
  companyEmail: text("company_email").default("quotes@treemarkables.nz"),
  companyPhone: text("company_phone").default("027 216 6882"),
  gstNumber: text("gst_number").default("131-047-592-GST004"),
  
  // Layout Configuration
  headerLayout: jsonb("header_layout"), // Logo position, company info layout
  footerText: text("footer_text"),
  paymentTerms: text("payment_terms").default("Payment due within 7 days"),
  
  // Template Styling
  primaryColor: text("primary_color").default("#f97316"), // Orange from Treemarkables brand
  secondaryColor: text("secondary_color").default("#3b82f6"), // Blue
  logoUrl: text("logo_url"), // Path to logo file
  
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
