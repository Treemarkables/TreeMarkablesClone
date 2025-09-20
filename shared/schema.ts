import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, jsonb } from "drizzle-orm/pg-core";
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
  source: text("source"), // google, referral, facebook, etc
  lifetimeValue: decimal("lifetime_value", { precision: 10, scale: 2 }).default("0"),
  totalJobs: integer("total_jobs").default(0),
  lastContactDate: timestamp("last_contact_date"),
  preferredContactMethod: text("preferred_contact_method"), // phone, email, sms
  tags: text("tags").array(), // loyal, difficult, high-value, etc
  isActive: boolean("is_active").default(true),
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
  title: text("title").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  status: text("status").notNull(), // scheduled, in_progress, completed, cancelled, rescheduled
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
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }),
  weatherDependent: boolean("weather_dependent").default(false),
  permitRequired: boolean("permit_required").default(false),
  insuranceClaim: boolean("insurance_claim").default(false),
  rescheduledReason: text("rescheduled_reason"),
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

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCallSchema = createInsertSchema(calls).omit({ id: true, createdAt: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSocialPlanSchema = createInsertSchema(socialPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCompetitorSignalSchema = createInsertSchema(competitorSignals).omit({ id: true, detectedAt: true, createdAt: true });
export const insertPriceRuleSchema = createInsertSchema(priceRules).omit({ id: true, validFrom: true, createdAt: true, updatedAt: true });

// Select Types
export type Customer = typeof customers.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type SocialPlan = typeof socialPlans.$inferSelect;
export type CompetitorSignal = typeof competitorSignals.$inferSelect;
export type PriceRule = typeof priceRules.$inferSelect;

// Insert Types  
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type InsertCall = z.infer<typeof insertCallSchema>;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type InsertSocialPlan = z.infer<typeof insertSocialPlanSchema>;
export type InsertCompetitorSignal = z.infer<typeof insertCompetitorSignalSchema>;
export type InsertPriceRule = z.infer<typeof insertPriceRuleSchema>;
