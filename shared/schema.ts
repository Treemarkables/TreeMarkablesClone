import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
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
