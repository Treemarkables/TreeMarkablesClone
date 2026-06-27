import { 
  type User, type InsertUser, type LeadSubmission, type InsertLeadSubmission,
  type Customer, type InsertCustomer, type CustomerImportBatch, type InsertCustomerImportBatch,
  type CommunicationPreferences, type InsertCommunicationPreferences,
  type Lead, type InsertLead,
  type Call, type InsertCall, type ApiKey, type InsertApiKey, type Quote, type InsertQuote,
  type Job, type InsertJob, type JobDiaryEntry, type InsertJobDiaryEntry,
  type Activity, type InsertActivity,
  type Review, type InsertReview, type Campaign, type InsertCampaign,
  type SocialPlan, type InsertSocialPlan, type CompetitorSignal, type InsertCompetitorSignal,
  type PriceRule, type InsertPriceRule, type CsvImportResult,
  type Notification, type InsertNotification, type UpdateNotification, type NotificationSummary, type NotificationWithDetails,
  type BusinessSettings, type InsertBusinessSettings, type UpdateBusinessSettings,
  type Communication, type InsertCommunication, type UpdateCommunication,
  type Equipment, type InsertEquipment, type UpdateEquipment,
  type EquipmentMaintenance, type InsertEquipmentMaintenance,
  type Inventory, type InsertInventory,
  type EquipmentCheckout, type InsertEquipmentCheckout,
  type InventoryTransaction, type InsertInventoryTransaction,
  type Material, type InsertMaterial,
  type Service, type InsertService,
  type Photo, type InsertPhoto, type UpdatePhoto, type PhotoSearch,
  videos, type Video, type InsertVideo, type UpdateVideo,
  helpArticles, type HelpArticle, type InsertHelpArticle, type UpdateHelpArticle,
  type Invoice, type InsertInvoice, type InvoiceSection, type InsertInvoiceSection, type UpdateInvoiceSection,
  type ServiceRequest, type InsertServiceRequest,
  type CustomerAuth, type InsertCustomerAuth,
  type XeroConnection, type InsertXeroConnection,
  // Business Intelligence types
  type BusinessReport, type InsertBusinessReport,
  type KpiMetric, type InsertKpiMetric,
  type PerformanceAnalytics, type InsertPerformanceAnalytics,
  type FinancialAnalytics, type InsertFinancialAnalytics,
  type DashboardConfig, type InsertDashboardConfig,
  type ReportAnalytics, type InsertReportAnalytics,
  // Safety Management types
  type SafetyIncident, type InsertSafetyIncident,
  type RiskAssessment, type InsertRiskAssessment,
  type ComplianceRequirement, type InsertComplianceRequirement,
  type ComplianceRecord, type InsertComplianceRecord,
  // Employee and Schedule Management
  type Employee, type InsertEmployee, type UpdateEmployee,
  type ScheduleEvent, type InsertScheduleEvent, type UpdateScheduleEvent,
  type JobStaffAssignment, type InsertJobStaffAssignment,
  // Job Templates and Proposals
  type JobTemplate, type InsertJobTemplate, type UpdateJobTemplate,
  // Email and SMS Templates
  type EmailTemplate, type InsertEmailTemplate, type UpdateEmailTemplate,
  type SmsTemplate, type InsertSmsTemplate, type UpdateSmsTemplate,
  type Proposal, type InsertProposal, type UpdateProposal,
  type ProposalSection, type InsertProposalSection, type UpdateProposalSection,
  type ProposalLineItem, type InsertProposalLineItem, type UpdateProposalLineItem,
  type ProposalLineItemChoice, type InsertProposalLineItemChoice, type UpdateProposalLineItemChoice,
  // Conversation Management types
  type Conversation, type InsertConversation, type UpdateConversation,
  type ConversationMessage, type InsertConversationMessage, type UpdateConversationMessage,
  // Document Template types
  type DocumentTemplate, type InsertDocumentTemplate,
  type TemplateSection, type InsertTemplateSection,
  type TemplateLineItem, type InsertTemplateLineItem,
  type TemplatePhoto, type InsertTemplatePhoto,
  type GeneratedDocument, type InsertGeneratedDocument,
  type GeneratedDocumentLineItem, type InsertGeneratedDocumentLineItem,
  type GeneratedDocumentPhoto, type InsertGeneratedDocumentPhoto,
  // Vehicle Inspection types
  type InspectionTemplate, type InsertInspectionTemplate, type UpdateInspectionTemplate,
  type InspectionChecklistItem, type InsertInspectionChecklistItem, type UpdateInspectionChecklistItem,
  type VehicleInspection, type InsertVehicleInspection, type UpdateVehicleInspection,
  type InspectionResponse, type InsertInspectionResponse,
  // Equipment Induction types
  type InductionTemplate, type InsertInductionTemplate, type UpdateInductionTemplate,
  type InductionChecklistItem, type InsertInductionChecklistItem, type UpdateInductionChecklistItem,
  type EquipmentInduction, type InsertEquipmentInduction, type UpdateEquipmentInduction,
  type InductionResponse, type InsertInductionResponse,
  // Marketing Campaign types
  type MarketingCampaign, type InsertMarketingCampaign,
  // Supplier Invoice types
  type SupplierInvoice, type InsertSupplierInvoice, type UpdateSupplierInvoice
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db, ownerDb } from "./db";
import { withTenant, currentBusinessId } from "./tenancy/tenantStore";
import { eq, ilike, and, or, gte, lte, lt, gt, ne, desc, asc, sql, inArray, isNull } from "drizzle-orm";
import * as schema from "@shared/schema";
import * as mailchimpService from "./services/mailchimpService";

// Compute an invoice's ex-GST revenue contribution.
//
// `invoice.amount` was historically populated inconsistently — for some invoices
// it holds the inc-GST customer-facing total, for others the ex-GST subtotal —
// so dividing it by 1.15 unconditionally double-strips GST on the latter set.
// `invoice.items[].amount` is reliably ex-GST (the line totals shown on the
// invoice template), so we sum those when present and only fall back to the
// /1.15 path when an invoice has no items.
export function invoiceRevenueExGst(invoice: { amount?: any; items?: any }): number {
  const items = Array.isArray(invoice.items) ? invoice.items : null;
  if (items && items.length > 0) {
    let sum = 0;
    let any = false;
    for (const it of items) {
      const v = parseFloat(String(it?.amount ?? '0'));
      if (!isNaN(v)) { sum += v; any = true; }
    }
    if (any) return sum;
  }
  return parseFloat(invoice.amount?.toString() || '0') / 1.15;
}

// ── jobRevenueExGst ─────────────────────────────────────────────────────────
//
// Canonical job-amount lookup, ex-GST. Same hierarchy the client surfaces
// converged on after PRs #28 / #30 / #36 fixed the same blind spot in four
// places (Live Roster, Dispatch Board, /all-jobs, /history):
//
//   line items (ex-GST: totalExGst → priceExGst × quantity → total)
//   → job.subtotal           (ex-GST by definition of the column)
//   → job.totalIncludingGst / 1.15
//   → job.totalAmount / 1.15 (inc-GST per project convention)
//
// Without the line-items step, a job sourced from an accepted proposal
// (lineItems populated but no rolled-up subtotal / totalAmount yet)
// returns 0 — exactly the symptom PR #28 surfaced on the Live Roster.
//
// Returns ex-GST because the two known server callers (gross-margin
// calculation, quote-presentation analytics) compare against ex-GST cost
// fields; callers that want the customer-facing inc-GST value gross up
// by * 1.15 at the callsite.
export function jobRevenueExGst(job: { lineItems?: any; subtotal?: any; totalIncludingGst?: any; totalAmount?: any }): number {
  const toNum = (v: unknown): number => {
    if (v == null) return 0;
    const n = typeof v === 'string' ? parseFloat(v) : (v as number);
    return Number.isFinite(n) ? n : 0;
  };
  const items = Array.isArray(job.lineItems) ? job.lineItems : null;
  if (items && items.length > 0) {
    const lineItemsTotal = items.reduce((sum: number, li: any) => {
      const exGst =
        toNum(li?.totalExGst) ||
        (li?.priceExGst != null ? toNum(li.priceExGst) * toNum(li.quantity || 1) : 0);
      return sum + (exGst || toNum(li?.total));
    }, 0);
    if (lineItemsTotal > 0) return lineItemsTotal;
  }
  const sub = parseFloat(job.subtotal?.toString() || '0');
  if (sub > 0) return sub;
  const incGst = parseFloat(job.totalIncludingGst?.toString() || '0');
  if (incGst > 0) return incGst / 1.15;
  return parseFloat(job.totalAmount?.toString() || '0') / 1.15;
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Lead form submissions (legacy)
  saveLead(lead: InsertLeadSubmission): Promise<LeadSubmission>;
  getLeads(fromDate?: Date, toDate?: Date): Promise<LeadSubmission[]>;
  getLeadsByPagePath(): Promise<{ pagePath: string; count: number }[]>;
  
  // Customer Management
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  getCustomer(id: string): Promise<Customer | undefined>;
  findCustomerByPhone(phone: string): Promise<Customer | undefined>;
  findCustomerByPhoneLast8(last8: string): Promise<Customer | undefined>;
  findCustomerByEmail(email: string): Promise<Customer | undefined>;
  findCustomerByName(name: string): Promise<Customer | undefined>;
  updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<boolean>;
  getAllCustomers(): Promise<Customer[]>;
  clearAllCustomers(): Promise<number>;
  searchCustomers(query: string): Promise<Customer[]>;

  // Customer contacts (multi-contact under one customer org)
  getCustomerContacts(customerId: string): Promise<schema.CustomerContact[]>;
  getCustomerContact(id: string): Promise<schema.CustomerContact | undefined>;
  createCustomerContact(input: schema.InsertCustomerContact): Promise<schema.CustomerContact>;
  updateCustomerContact(id: string, updates: schema.UpdateCustomerContact): Promise<schema.CustomerContact>;
  deleteCustomerContact(id: string): Promise<boolean>;

  // Complete database wipe methods
  clearAllQuotes(): Promise<number>;
  clearAllLeads(): Promise<number>;
  clearAllCommunications(): Promise<number>;
  clearAllActivities(): Promise<number>;
  clearAllJobDiaryEntries(): Promise<number>;
  clearAllProposals(): Promise<number>;
  clearAllInvoices(): Promise<number>;
  clearAllPhotos(): Promise<number>;
  clearAllCalls(): Promise<number>;
  completeDataWipe(): Promise<{ [key: string]: number }>;
  
  // Customer Import Batch Management
  createCustomerImportBatch(batch: InsertCustomerImportBatch): Promise<CustomerImportBatch>;
  getCustomerImportBatch(id: string): Promise<CustomerImportBatch | undefined>;
  updateCustomerImportBatch(id: string, updates: Partial<InsertCustomerImportBatch>): Promise<CustomerImportBatch>;
  getAllCustomerImportBatches(): Promise<CustomerImportBatch[]>;
  getCustomersByImportBatch(batchId: string): Promise<Customer[]>;
  
  // CSV Import and Bulk Updates
  bulkUpdateCustomers(updates: Array<{id: string; updates: Partial<InsertCustomer>}>): Promise<{updated: number; failed: number; errors: string[]}>;
  matchCustomersFromCSV(csvData: any[]): Promise<{
    matches: Array<{
      csvRow: number;
      csvData: any;
      existingCustomer?: Customer;
      matchType: 'uuid' | 'email' | 'phone' | 'none';
      matchConfidence: 'high' | 'medium' | 'low';
      proposedName: string;
      willUpdate: boolean;
    }>;
    totalRows: number;
    matchableRows: number;
    highConfidenceMatches: number;
    willUpdateCount: number;
  }>;
  
  // Communication Preferences Management
  createCommunicationPreferences(preferences: InsertCommunicationPreferences): Promise<CommunicationPreferences>;
  getCommunicationPreferences(customerId: string): Promise<CommunicationPreferences | undefined>;
  updateCommunicationPreferences(customerId: string, updates: Partial<InsertCommunicationPreferences>): Promise<CommunicationPreferences>;
  deleteCommunicationPreferences(customerId: string): Promise<boolean>;
  
  // Lead Pipeline Management
  createPipelineLead(lead: InsertLead): Promise<Lead>;
  getPipelineLead(id: string): Promise<Lead | undefined>;
  updatePipelineLead(id: string, updates: Partial<InsertLead>): Promise<Lead>;
  getAllPipelineLeads(): Promise<Lead[]>;
  getPipelineLeadsByStatus(status: string): Promise<Lead[]>;
  
  // Call Management  
  createCall(call: InsertCall): Promise<Call>;
  getCall(id: string): Promise<Call | undefined>;
  updateCall(id: string, updates: Partial<InsertCall>): Promise<Call>;
  getCallsByCustomer(customerId: string): Promise<Call[]>;
  getCallsByJobId(jobId: string): Promise<Call[]>;
  getCallsByLead(leadId: string): Promise<Call[]>;
  getAllCalls(limit?: number): Promise<Call[]>;
  deleteCall(id: string): Promise<boolean>;

  // API Key Management
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  getAllApiKeys(): Promise<ApiKey[]>;
  deleteApiKey(id: string): Promise<boolean>;
  
  // Quote Management
  createQuote(quote: InsertQuote): Promise<Quote>;
  getQuote(id: string): Promise<Quote | undefined>;
  updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote>;
  getQuotesByCustomer(customerId: string): Promise<Quote[]>;
  getQuotesByLead(leadId: string): Promise<Quote[]>;
  getAllQuotes(): Promise<Quote[]>;
  
  // Job Management
  createJob(job: InsertJob): Promise<Job>;
  getJob(id: string): Promise<Job | undefined>;
  getJobByJobNumber(jobNumber: string): Promise<Job | undefined>;
  updateJob(id: string, updates: Partial<InsertJob>): Promise<Job>;
  getJobsByCustomer(customerId: string): Promise<Job[]>;
  getJobsByStatus(status: string): Promise<Job[]>;
  getCompletedJobsWithCustomerNames(): Promise<Array<Job & { customerName: string | null; invoiceAmountIncGst: number | null }>>;
  getAllJobs(options?: { limit?: number; offset?: number; status?: string; excludeCompleted?: boolean; excludeArchived?: boolean }): Promise<{ jobs: Job[]; total: number }>;
  searchJobs(query: string, options?: { limit?: number; offset?: number; excludeArchived?: boolean }): Promise<{ jobs: Job[]; total: number }>;
  createJobFromCall(params: {
    callId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAddress?: string;
    jobTitle: string;
    jobDescription?: string;
    jobAddress?: string;
    call: Call;
  }): Promise<{ job: Job; customer: Customer; call: Call }>;
  clearAllJobs(): Promise<number>;
  deleteJob(id: string): Promise<boolean>;
  bulkDeleteJobs(jobIds: string[]): Promise<{deleted: number; failed: number; errors: string[]}>;
  
  // Sequential Job Number Management
  getNextJobNumber(): Promise<string>;
  
  // Sequential Quote Number Management
  getNextQuoteNumber(): Promise<string>;
  
  // Gross Margin Management
  updateJobGrossMargin(jobId: string, grossMarginData: {
    laborCosts?: number;
    materialsCosts?: number;
    otherCosts?: number;
    laborHours?: number;
    hourlyRate?: number;
  }): Promise<Job>;
  calculateAndUpdateGrossMargin(jobId: string): Promise<Job>;
  validateGrossMarginComplete(jobId: string): Promise<boolean>;
  
  // Job Diary Management
  createJobDiaryEntry(entry: InsertJobDiaryEntry): Promise<JobDiaryEntry>;
  getJobDiaryEntry(id: string): Promise<JobDiaryEntry | undefined>;
  updateJobDiaryEntry(id: string, updates: Partial<InsertJobDiaryEntry>): Promise<JobDiaryEntry>;
  deleteJobDiaryEntry(id: string): Promise<boolean>;
  getJobDiaryEntriesByJob(jobId: string, limit?: number): Promise<JobDiaryEntry[]>;
  getJobDiaryEntriesByType(jobId: string, entryType: string): Promise<JobDiaryEntry[]>;
  getAllJobDiaryEntries(): Promise<JobDiaryEntry[]>;
  
  // Enhanced Expense Tracking
  updateJobExpenses(jobId: string, expenseData: {
    actualLaborCosts?: number;
    actualMaterialsCosts?: number;
    equipmentCosts?: number;
    subcontractorCosts?: number;
    permitCosts?: number;
    travelCosts?: number;
    disposalCosts?: number;
    miscExpenses?: number;
  }): Promise<Job>;
  updateExpenseCompletionStatus(jobId: string, completionData: {
    laborCostsComplete?: boolean;
    materialsCostsComplete?: boolean;
    equipmentCostsComplete?: boolean;
    subcontractorCostsComplete?: boolean;
    otherExpensesComplete?: boolean;
  }): Promise<Job>;
  
  // Staff Time Tracking
  updateJobStaffTime(jobId: string, staffTimeEntries: Array<{
    employeeId: string;
    hours: number;
    rate: number;
    date?: string;
  }>): Promise<Job>;
  addStaffTimeEntry(jobId: string, entry: {
    employeeId: string;
    hours: number;
    rate: number;
    costRate?: number;
    date?: string;
  }): Promise<Job>;
  removeStaffTimeEntry(jobId: string, employeeId: string, date?: string): Promise<Job>;
  calculateLaborCostFromStaffTime(jobId: string): Promise<number>;
  getJobStaffTimeEntries(jobId: string): Promise<Array<{
    employeeId: string;
    hours: number;
    rate: number;
    date: string;
  }>>;
  
  // Xero Integration
  sendJobToXero(jobId: string, xeroInvoiceId: string): Promise<Job>;
  
  // Activity Tracking
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivity(id: string): Promise<Activity | undefined>;
  getActivitiesByCustomer(customerId: string): Promise<Activity[]>;
  getActivitiesByLead(leadId: string): Promise<Activity[]>;
  getActivitiesByJob(jobId: string): Promise<Activity[]>;
  getAllActivities(limit?: number): Promise<Activity[]>;
  
  // Review Management
  createReview(review: InsertReview): Promise<Review>;
  getReview(id: string): Promise<Review | undefined>;
  updateReview(id: string, updates: Partial<InsertReview>): Promise<Review>;
  deleteReview(id: string): Promise<void>;
  getReviewsByCustomer(customerId: string): Promise<Review[]>;
  getAllReviews(): Promise<Review[]>;
  
  // Campaign Management
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  updateCampaign(id: string, updates: Partial<InsertCampaign>): Promise<Campaign>;
  getAllCampaigns(): Promise<Campaign[]>;
  
  // Social Media Planning
  createSocialPlan(plan: InsertSocialPlan): Promise<SocialPlan>;
  getSocialPlan(id: string): Promise<SocialPlan | undefined>;
  updateSocialPlan(id: string, updates: Partial<InsertSocialPlan>): Promise<SocialPlan>;
  getAllSocialPlans(): Promise<SocialPlan[]>;
  getSocialPlansByStatus(status: string): Promise<SocialPlan[]>;
  
  // Competitor Intelligence
  createCompetitorSignal(signal: InsertCompetitorSignal): Promise<CompetitorSignal>;
  getCompetitorSignal(id: string): Promise<CompetitorSignal | undefined>;
  updateCompetitorSignal(id: string, updates: Partial<InsertCompetitorSignal>): Promise<CompetitorSignal>;
  getAllCompetitorSignals(): Promise<CompetitorSignal[]>;
  getCompetitorSignalsByCompetitor(competitorName: string): Promise<CompetitorSignal[]>;
  
  // Pricing Rules
  createPriceRule(rule: InsertPriceRule): Promise<PriceRule>;
  getPriceRule(id: string): Promise<PriceRule | undefined>;
  updatePriceRule(id: string, updates: Partial<InsertPriceRule>): Promise<PriceRule>;
  getAllPriceRules(): Promise<PriceRule[]>;
  getPriceRulesByService(serviceName: string): Promise<PriceRule[]>;
  
  // Business Intelligence Queries
  getDashboardStats(): Promise<{
    totalLeads: number;
    totalCustomers: number;
    totalJobs: number;
    totalRevenue: number;
    conversionRate: number;
    averageQuoteValue: number;
    missedCalls: number;
    recentCalls: Call[];
    recentLeads: Lead[];
  }>;
  
  getRevenueStats(fromDate?: Date, toDate?: Date): Promise<{
    totalRevenue: number;
    jobsCompleted: number;
    averageJobValue: number;
    totalCosts: number;
    grossMargin: number;
    monthlyTrend: { month: string; revenue: number; jobs: number }[];
  }>;
  
  getQuoteAnalytics(): Promise<{
    totalQuotes: number;
    acceptedQuotes: number;
    rejectedQuotes: number;
    pendingQuotes: number;
    averageResponseTime: number;
    rejectionReasons: { reason: string; count: number }[];
    competitorAnalysis: { competitor: string; averagePrice: number; winRate: number }[];
  }>;
  
  getQuoteMethodAnalytics(fromDate?: Date, toDate?: Date): Promise<{
    hasData: boolean;
    onSite: { total: number; accepted: number; rejected: number; pending: number; acceptanceRate: number; avgAcceptedValue: number; totalAcceptedValue: number };
    sentLater: { total: number; accepted: number; rejected: number; pending: number; acceptanceRate: number; avgAcceptedValue: number; totalAcceptedValue: number };
    comparison: { rateAdvantage: number; valueAdvantage: number; winningMethod: string };
  }>;

  // Enhanced Lead Analytics
  getLeadScoring(): Promise<(Lead & { score: number; priority: 'hot' | 'warm' | 'cold' })[]>;
  getConversionFunnel(): Promise<{
    leads: number;
    contacted: number;
    qualified: number;
    quoted: number;
    won: number;
    conversionRates: {
      leadToContact: number;
      contactToQualified: number;
      qualifiedToQuote: number;
      quoteToWin: number;
      overallConversion: number;
    };
    dropOffAnalysis: {
      stage: string;
      count: number;
      percentage: number;
    }[];
  }>;
  
  getFollowUpQueue(): Promise<{
    overdue: Lead[];
    today: Lead[];
    thisWeek: Lead[];
    total: number;
  }>;

  getLeadSourceAnalysis(fromDate?: Date, toDate?: Date): Promise<{
    source: string;
    count: number;
    quotedCount: number;
    wonCount: number;
    conversionRate: number;
    quoteConversionRate: number;
    totalRevenue: number;
    averageValue: number;
    averageProfitMargin: number;
    totalProfit: number;
    roi: number;
  }[]>;

  getQuotePresentationAnalysis(fromDate?: Date, toDate?: Date): Promise<{
    method: string;
    label: string;
    totalQuotes: number;
    acceptedQuotes: number;
    rejectedQuotes: number;
    pendingQuotes: number;
    conversionRate: number;
    totalValue: number;
    acceptedValue: number;
    averageValue: number;
  }[]>;

  // CSV Import Methods
  importCustomersFromCsv(csvData: any[]): Promise<CsvImportResult>;
  importJobsFromCsv(csvData: any[]): Promise<CsvImportResult>;
  importQuotesFromCsv(csvData: any[]): Promise<CsvImportResult>;

  // Notification Management
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotification(id: string): Promise<Notification | undefined>;
  updateNotification(id: string, updates: UpdateNotification): Promise<Notification>;
  getAllNotifications(userId?: string, limit?: number): Promise<NotificationWithDetails[]>;
  getUnreadNotifications(userId?: string): Promise<NotificationWithDetails[]>;
  getNotificationsCreatedSince(since: Date): Promise<Notification[]>;
  markNotificationAsRead(id: string): Promise<Notification>;
  markAllNotificationsAsRead(userId?: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  deleteAllNotifications(userId?: string): Promise<void>;
  getNotificationSummary(userId?: string): Promise<NotificationSummary>;
  deleteExpiredNotifications(): Promise<void>;

  // Notification Queue Management
  createNotificationQueueItem(item: schema.InsertNotificationQueueItem): Promise<schema.NotificationQueueItem>;
  getPendingNotifications(beforeTime?: Date): Promise<schema.NotificationQueueItem[]>;
  markNotificationSent(id: string): Promise<void>;
  markNotificationFailed(id: string, error: string): Promise<void>;

  // Pending Outbound Messages (holding messages awaiting owner approval)
  createPendingOutboundMessage(msg: schema.InsertPendingOutboundMessage): Promise<schema.PendingOutboundMessage>;
  getPendingOutboundMessages(status?: string): Promise<schema.PendingOutboundMessage[]>;
  getPendingOutboundMessage(id: string): Promise<schema.PendingOutboundMessage | undefined>;
  updatePendingOutboundMessage(id: string, updates: Partial<schema.PendingOutboundMessage>): Promise<schema.PendingOutboundMessage>;

  // Employee Management
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  getEmployee(id: string): Promise<Employee | undefined>;
  getEmployeeByEmail(email: string): Promise<Employee | undefined>;
  updateEmployee(id: string, updates: UpdateEmployee): Promise<Employee>;
  getAllEmployees(): Promise<Employee[]>;
  getActiveEmployees(): Promise<Employee[]>;
  getEmployeesByPosition(position: string): Promise<Employee[]>;
  getEmployeesBySkill(skill: string): Promise<Employee[]>;
  deleteEmployee(id: string): Promise<void>;
  anonymizeEmployeeForDeletion(id: string): Promise<void>;

  // Role Tier Management
  createRoleTier(tier: schema.InsertRoleTier): Promise<schema.RoleTier>;
  getRoleTier(id: string): Promise<schema.RoleTier | undefined>;
  getRoleTierByKey(key: string): Promise<schema.RoleTier | undefined>;
  getAllRoleTiers(): Promise<schema.RoleTier[]>;
  updateRoleTier(id: string, updates: schema.UpdateRoleTier): Promise<schema.RoleTier>;
  deleteRoleTier(id: string): Promise<void>;
  getDefaultRoleTier(): Promise<schema.RoleTier | undefined>;

  // Schedule Management
  createScheduleEvent(event: InsertScheduleEvent): Promise<ScheduleEvent>;
  getScheduleEvent(id: string): Promise<ScheduleEvent | undefined>;
  updateScheduleEvent(id: string, updates: UpdateScheduleEvent): Promise<ScheduleEvent>;
  getAllScheduleEvents(startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]>;
  getScheduleEventsByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]>;
  getScheduleEventsByJob(jobId: string): Promise<ScheduleEvent[]>;
  deleteScheduleEvent(id: string): Promise<void>;
  deleteScheduleEventsByJob(jobId: string): Promise<void>;

  // Job Staff Assignment Management
  createJobStaffAssignment(assignment: InsertJobStaffAssignment): Promise<JobStaffAssignment>;
  getJobStaffAssignment(id: string): Promise<JobStaffAssignment | undefined>;
  getAllJobStaffAssignments(): Promise<JobStaffAssignment[]>;
  getJobStaffAssignmentsByJob(jobId: string): Promise<JobStaffAssignment[]>;
  getJobStaffAssignmentsByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<JobStaffAssignment[]>;
  checkStaffConflicts(employeeIds: string[], startTime: Date, endTime: Date, excludeJobId?: string): Promise<{employeeId: string; conflicts: JobStaffAssignment[]}[]>;
  updateJobStaffAssignment(id: string, updates: Partial<InsertJobStaffAssignment>): Promise<JobStaffAssignment>;
  deleteJobStaffAssignment(id: string): Promise<void>;
  deleteJobStaffAssignmentsByJob(jobId: string): Promise<void>;

  // Job Template Management
  createJobTemplate(template: InsertJobTemplate): Promise<JobTemplate>;
  getJobTemplate(id: string): Promise<JobTemplate | undefined>;
  updateJobTemplate(id: string, updates: UpdateJobTemplate): Promise<JobTemplate>;
  getAllJobTemplates(): Promise<JobTemplate[]>;
  getJobTemplatesByCategory(category: string): Promise<JobTemplate[]>;
  deleteJobTemplate(id: string): Promise<void>;

  // Proposal Management
  createProposal(proposal: InsertProposal): Promise<Proposal>;
  getProposal(id: string): Promise<Proposal | undefined>;
  updateProposal(id: string, updates: UpdateProposal): Promise<Proposal>;
  getProposalsByCustomer(customerId: string): Promise<Proposal[]>;
  getProposalsByQuote(quoteId: string): Promise<Proposal[]>;
  getProposalsByJob(jobId: string): Promise<Proposal[]>;
  getAllProposals(): Promise<Proposal[]>;
  deleteProposal(id: string): Promise<void>;

  // Proposal Section Management
  createProposalSection(section: InsertProposalSection): Promise<ProposalSection>;
  getProposalSection(id: string): Promise<ProposalSection | undefined>;
  updateProposalSection(id: string, updates: UpdateProposalSection): Promise<ProposalSection>;
  getProposalSectionsByProposal(proposalId: string): Promise<ProposalSection[]>;
  getProposalSectionsByProposalIds(proposalIds: string[]): Promise<ProposalSection[]>;
  deleteProposalSection(id: string): Promise<void>;
  reorderProposalSections(proposalId: string, sectionIds: string[]): Promise<ProposalSection[]>;
  
  // Proposal Line Item Management
  createProposalLineItem(item: InsertProposalLineItem): Promise<ProposalLineItem>;
  getProposalLineItem(id: string): Promise<ProposalLineItem | undefined>;
  updateProposalLineItem(id: string, updates: UpdateProposalLineItem): Promise<ProposalLineItem>;
  getProposalLineItemsByProposal(proposalId: string): Promise<ProposalLineItem[]>;
  getProposalLineItemsByProposalIds(proposalIds: string[]): Promise<ProposalLineItem[]>;
  deleteProposalLineItem(id: string): Promise<void>;
  reorderProposalLineItems(proposalId: string, itemIds: string[]): Promise<ProposalLineItem[]>;

  // Proposal Line Item Choice Management
  createProposalLineItemChoice(choice: InsertProposalLineItemChoice): Promise<ProposalLineItemChoice>;
  getProposalLineItemChoice(id: string): Promise<ProposalLineItemChoice | undefined>;
  updateProposalLineItemChoice(id: string, updates: UpdateProposalLineItemChoice): Promise<ProposalLineItemChoice>;
  getProposalLineItemChoicesByLineItem(lineItemId: string): Promise<ProposalLineItemChoice[]>;
  deleteProposalLineItemChoice(id: string): Promise<void>;
  deleteProposalLineItemChoicesByLineItem(lineItemId: string): Promise<void>;

  // Equipment Management
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  getEquipment(id: string): Promise<Equipment | undefined>;
  updateEquipment(id: string, updates: UpdateEquipment): Promise<Equipment>;
  getAllEquipment(): Promise<Equipment[]>;
  getAvailableEquipment(): Promise<Equipment[]>;
  getEquipmentByType(type: string): Promise<Equipment[]>;
  getEquipmentByStatus(status: string): Promise<Equipment[]>;
  deleteEquipment(id: string): Promise<void>;
  
  // Equipment Maintenance Management
  createEquipmentMaintenance(maintenance: InsertEquipmentMaintenance): Promise<EquipmentMaintenance>;
  getEquipmentMaintenance(id: string): Promise<EquipmentMaintenance | undefined>;
  getMaintenanceByEquipment(equipmentId: string): Promise<EquipmentMaintenance[]>;
  getAllMaintenanceRecords(): Promise<EquipmentMaintenance[]>;
  
  // Inventory Management
  createInventoryItem(item: InsertInventory): Promise<Inventory>;
  getInventoryItem(id: string): Promise<Inventory | undefined>;
  updateInventoryItem(id: string, updates: Partial<InsertInventory>): Promise<Inventory>;
  getAllInventory(): Promise<Inventory[]>;
  getLowStockItems(): Promise<Inventory[]>;
  getInventoryByCategory(category: string): Promise<Inventory[]>;
  
  // Equipment Checkout System
  checkoutEquipment(checkout: InsertEquipmentCheckout): Promise<EquipmentCheckout>;
  checkinEquipment(checkoutId: string, returnData: { returnCondition?: string; hoursUsed?: number; mileageEnd?: number; fuelLevelEnd?: number; notes?: string; damageReport?: string }): Promise<EquipmentCheckout>;
  getActiveCheckouts(): Promise<EquipmentCheckout[]>;
  getOverdueCheckouts(): Promise<EquipmentCheckout[]>;
  getCheckoutHistory(equipmentId?: string): Promise<EquipmentCheckout[]>;
  
  // Inventory Transactions
  createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction>;
  getInventoryTransactions(inventoryId: string): Promise<InventoryTransaction[]>;
  getTransactionsByType(type: string): Promise<InventoryTransaction[]>;

  // Vehicle Pre-Start Inspection System
  // Inspection Templates
  createInspectionTemplate(template: InsertInspectionTemplate): Promise<InspectionTemplate>;
  getInspectionTemplate(id: string): Promise<InspectionTemplate | undefined>;
  updateInspectionTemplate(id: string, updates: UpdateInspectionTemplate): Promise<InspectionTemplate>;
  deleteInspectionTemplate(id: string): Promise<void>;
  getAllInspectionTemplates(): Promise<InspectionTemplate[]>;
  getDefaultTemplate(vehicleType?: string): Promise<InspectionTemplate | undefined>;
  setDefaultTemplate(id: string): Promise<InspectionTemplate>;
  
  // Inspection Checklist Items
  createChecklistItem(item: InsertInspectionChecklistItem): Promise<InspectionChecklistItem>;
  getChecklistItem(id: string): Promise<InspectionChecklistItem | undefined>;
  updateChecklistItem(id: string, updates: UpdateInspectionChecklistItem): Promise<InspectionChecklistItem>;
  deleteChecklistItem(id: string): Promise<void>;
  getChecklistItemsByTemplate(templateId: string): Promise<InspectionChecklistItem[]>;
  reorderChecklistItems(templateId: string, itemIds: string[]): Promise<void>;
  
  // Vehicle Inspections
  createVehicleInspection(inspection: InsertVehicleInspection): Promise<VehicleInspection>;
  getVehicleInspection(id: string): Promise<VehicleInspection | undefined>;
  updateVehicleInspection(id: string, updates: UpdateVehicleInspection): Promise<VehicleInspection>;
  getAllVehicleInspections(filters?: { vehicleId?: string; status?: string; dateFrom?: Date; dateTo?: Date }): Promise<VehicleInspection[]>;
  getVehicleInspectionsByVehicle(vehicleId: string): Promise<VehicleInspection[]>;
  getLatestInspection(vehicleId: string): Promise<VehicleInspection | undefined>;
  
  // Inspection Responses
  createInspectionResponse(response: InsertInspectionResponse): Promise<InspectionResponse>;
  getInspectionResponses(inspectionId: string): Promise<InspectionResponse[]>;

  // Equipment Induction System
  createInductionTemplate(template: InsertInductionTemplate): Promise<InductionTemplate>;
  getInductionTemplate(id: string): Promise<InductionTemplate | undefined>;
  updateInductionTemplate(id: string, updates: UpdateInductionTemplate): Promise<InductionTemplate>;
  deleteInductionTemplate(id: string): Promise<void>;
  getAllInductionTemplates(): Promise<InductionTemplate[]>;
  getInductionTemplatesByType(equipmentType: string): Promise<InductionTemplate[]>;

  createInductionChecklistItem(item: InsertInductionChecklistItem): Promise<InductionChecklistItem>;
  getInductionChecklistItem(id: string): Promise<InductionChecklistItem | undefined>;
  updateInductionChecklistItem(id: string, updates: UpdateInductionChecklistItem): Promise<InductionChecklistItem>;
  deleteInductionChecklistItem(id: string): Promise<void>;
  getInductionChecklistItemsByTemplate(templateId: string): Promise<InductionChecklistItem[]>;
  reorderInductionChecklistItems(templateId: string, itemIds: string[]): Promise<void>;

  createEquipmentInduction(induction: InsertEquipmentInduction): Promise<EquipmentInduction>;
  getEquipmentInduction(id: string): Promise<EquipmentInduction | undefined>;
  updateEquipmentInduction(id: string, updates: UpdateEquipmentInduction): Promise<EquipmentInduction>;
  getAllEquipmentInductions(filters?: { employeeId?: string; equipmentType?: string }): Promise<EquipmentInduction[]>;
  getEquipmentInductionsByEmployee(employeeId: string): Promise<EquipmentInduction[]>;
  getInductionStatusForEmployee(employeeId: string): Promise<Array<{ templateId: string; templateName: string; equipmentType: string | null; completedAt: Date | null; inductionId: string | null }>>;

  createInductionResponse(response: InsertInductionResponse): Promise<InductionResponse>;
  getInductionResponses(inductionId: string): Promise<InductionResponse[]>;

  // Registration & COF Expiry Checks
  getVehiclesWithExpiringDocs(daysAhead: number): Promise<Equipment[]>;
  getExpiredVehicles(): Promise<Equipment[]>;

  // Materials Catalog Management
  createMaterial(material: InsertMaterial): Promise<Material>;
  getMaterial(id: string): Promise<Material | undefined>;
  updateMaterial(id: string, updates: Partial<InsertMaterial>): Promise<Material>;
  deleteMaterial(id: string): Promise<void>;
  getAllMaterials(): Promise<Material[]>;
  getMaterialsByCategory(category: string): Promise<Material[]>;
  
  // Services Catalog Management
  createService(service: InsertService): Promise<Service>;
  getService(id: string): Promise<Service | undefined>;
  updateService(id: string, updates: Partial<InsertService>): Promise<Service>;
  deleteService(id: string): Promise<void>;
  getAllServices(): Promise<Service[]>;
  getServicesByCategory(category: string): Promise<Service[]>;

  // Business Settings Management
  getBusinessSettings(): Promise<BusinessSettings>;
  updateBusinessSettings(updates: UpdateBusinessSettings): Promise<BusinessSettings>;
  resetBusinessSettings(): Promise<BusinessSettings>;
  
  // Communication Management
  createCommunication(communication: InsertCommunication): Promise<Communication>;
  getCommunication(id: string): Promise<Communication | undefined>;
  updateCommunication(id: string, updates: UpdateCommunication): Promise<Communication>;
  getAllCommunications(filters?: {
    platform?: string;
    priority?: string;
    isRead?: boolean;
    isArchived?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Communication[]>;
  getCommunicationsByCustomer(customerId: string): Promise<Communication[]>;
  getCommunicationsByLead(leadId: string): Promise<Communication[]>;
  getCommunicationsByJob(jobId: string): Promise<Communication[]>;
  markCommunicationAsRead(id: string): Promise<Communication>;
  starCommunication(id: string, starred: boolean): Promise<Communication>;
  archiveCommunication(id: string): Promise<Communication>;
  getCommunicationStats(): Promise<{
    total: number;
    unread: number;
    starred: number;
    archived: number;
    byPlatform: { platform: string; count: number }[];
    byPriority: { priority: string; count: number }[];
  }>;

  // Email Event Tracking
  createEmailEvent(event: {
    messageId: string;
    eventType: string;
    recipient?: string;
    timestamp: Date;
    userAgent?: string;
    ipAddress?: string;
    linkUrl?: string;
    rawPayload?: any;
  }): Promise<any>;
  getEmailEventsByMessageId(messageId: string): Promise<any[]>;
  getEmailActivitySummary(messageId: string): Promise<{ opens: number; clicks: number; events: any[]; lastEventAt: Date | null }>;

  // Conversation Management
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | undefined>;
  updateConversation(id: string, updates: UpdateConversation): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;
  getAllConversations(filters?: {
    status?: string;
    priority?: string;
    assignedTo?: string;
    source?: string;
    serviceType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]>;
  getConversationsByLead(leadId: string): Promise<Conversation[]>;
  getConversationsByCustomer(customerId: string): Promise<Conversation[]>;
  convertConversationToQuote(id: string, quoteId: string): Promise<Conversation>;
  getUnreadConversationsCount(userId?: string): Promise<number>;

  // Conversation Message Management
  createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getConversationMessage(id: string): Promise<ConversationMessage | undefined>;
  updateConversationMessage(id: string, updates: UpdateConversationMessage): Promise<ConversationMessage>;
  deleteConversationMessage(id: string): Promise<void>;
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  markConversationMessagesAsRead(conversationId: string, readBy: string): Promise<void>;

  // Enhanced Photo Management
  createPhoto(data: InsertPhoto): Promise<Photo>;
  getPhoto(id: string): Promise<Photo | undefined>;
  updatePhoto(id: string, updates: UpdatePhoto): Promise<Photo>;
  deletePhoto(id: string): Promise<void>;
  getPhotosByJob(jobId: string, filters?: { type?: string; category?: string }): Promise<Photo[]>;
  getPhotosByCustomer(customerId: string): Promise<Photo[]>;
  getPublicPhotos(limit?: number, offset?: number): Promise<Photo[]>;
  getFeaturedPhotos(limit?: number): Promise<Photo[]>;
  getPhotosByType(type: string, jobId?: string): Promise<Photo[]>;
  getBeforeAfterPairs(jobId: string): Promise<Photo[][]>;
  searchPhotos(filters: PhotoSearch): Promise<Photo[]>;

  // Job Videos (Loom replacement)
  createVideo(data: InsertVideo): Promise<Video>;
  getVideo(id: string): Promise<Video | undefined>;
  updateVideo(id: string, updates: UpdateVideo): Promise<Video>;
  deleteVideo(id: string): Promise<void>;
  getVideosByJob(jobId: string): Promise<Video[]>;
  getCustomerVisibleVideosByJob(jobId: string): Promise<Video[]>;
  getVideos(filter?: { kind?: string; unassigned?: boolean }): Promise<Video[]>;

  // Help articles (subscriber-facing /help page)
  createHelpArticle(data: InsertHelpArticle): Promise<HelpArticle>;
  getHelpArticle(id: string): Promise<HelpArticle | undefined>;
  getHelpArticleBySlug(slug: string): Promise<HelpArticle | undefined>;
  updateHelpArticle(id: string, updates: UpdateHelpArticle): Promise<HelpArticle>;
  deleteHelpArticle(id: string): Promise<void>;
  getHelpArticles(filter?: { publishedOnly?: boolean }): Promise<HelpArticle[]>;

  // Customer Portal Management
  authenticateCustomer(email: string, phone?: string): Promise<CustomerAuth | undefined>;
  createCustomerAuth(auth: InsertCustomerAuth): Promise<CustomerAuth>;
  getCustomerJobs(customerId: string): Promise<Job[]>;
  getCustomerInvoices(customerId: string): Promise<Invoice[]>;
  getCustomerPhotos(customerId: string, jobId?: string): Promise<Photo[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoicesByJob(jobId: string): Promise<Invoice[]>;
  getAllInvoices(): Promise<Invoice[]>;
  updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;

  // Supplier Invoice Management (bills FROM suppliers attached to a job)
  createSupplierInvoice(invoice: InsertSupplierInvoice): Promise<SupplierInvoice>;
  getSupplierInvoice(id: string): Promise<SupplierInvoice | undefined>;
  getSupplierInvoicesByJob(jobId: string): Promise<SupplierInvoice[]>;
  updateSupplierInvoice(id: string, updates: UpdateSupplierInvoice): Promise<SupplierInvoice>;
  deleteSupplierInvoice(id: string): Promise<void>;
  getSupplierNames(): Promise<string[]>;

  // Invoice Section Management
  createInvoiceSection(section: InsertInvoiceSection): Promise<InvoiceSection>;
  getInvoiceSection(id: string): Promise<InvoiceSection | undefined>;
  updateInvoiceSection(id: string, updates: UpdateInvoiceSection): Promise<InvoiceSection>;
  getInvoiceSectionsByInvoice(invoiceId: string): Promise<InvoiceSection[]>;
  deleteInvoiceSection(id: string): Promise<void>;
  reorderInvoiceSections(invoiceId: string, sectionIds: string[]): Promise<InvoiceSection[]>;

  createServiceRequest(request: InsertServiceRequest): Promise<ServiceRequest>;
  getServiceRequest(id: string): Promise<ServiceRequest | undefined>;
  getServiceRequestsByCustomer(customerId: string): Promise<ServiceRequest[]>;
  
  // Xero Integration
  createXeroConnection(connection: InsertXeroConnection): Promise<XeroConnection>;
  getXeroConnection(tenantId: string): Promise<XeroConnection | undefined>;
  getActiveXeroConnection(): Promise<XeroConnection | undefined>;
  updateXeroConnection(tenantId: string, updates: Partial<InsertXeroConnection>): Promise<XeroConnection>;
  deleteXeroConnection(tenantId: string): Promise<void>;
  
  // Xero Settings
  getXeroSettings(): Promise<XeroSettings | undefined>;
  updateXeroSettings(updates: Partial<InsertXeroSettings>): Promise<XeroSettings>;

  // Safety Incident Management
  getSafetyIncidents(): Promise<SafetyIncident[]>;
  getSafetyIncident(id: string): Promise<SafetyIncident | undefined>;
  createSafetyIncident(incident: InsertSafetyIncident & { incidentNumber: string }): Promise<SafetyIncident>;
  updateSafetyIncident(id: string, updates: Partial<InsertSafetyIncident>): Promise<SafetyIncident>;
  deleteSafetyIncident(id: string): Promise<void>;
  getSafetyIncidentsByJob(jobId: string): Promise<SafetyIncident[]>;
  getSafetyIncidentsByType(type: string): Promise<SafetyIncident[]>;
  getSafetyIncidentsBySeverity(severity: string): Promise<SafetyIncident[]>;
  getSafetyIncidentsByStatus(status: string): Promise<SafetyIncident[]>;

  // Risk Assessment Management
  createRiskAssessment(assessment: InsertRiskAssessment): Promise<RiskAssessment>;
  getRiskAssessment(id: string): Promise<RiskAssessment | undefined>;
  updateRiskAssessment(id: string, updates: Partial<InsertRiskAssessment>): Promise<RiskAssessment>;
  getRiskAssessmentsByJob(jobId: string): Promise<RiskAssessment[]>;
  getAllRiskAssessments(): Promise<RiskAssessment[]>;

  // Compliance Monitoring Management
  createComplianceRequirement(requirement: InsertComplianceRequirement): Promise<ComplianceRequirement>;
  getComplianceRequirement(id: string): Promise<ComplianceRequirement | undefined>;
  updateComplianceRequirement(id: string, updates: Partial<InsertComplianceRequirement>): Promise<ComplianceRequirement>;
  getAllComplianceRequirements(): Promise<ComplianceRequirement[]>;
  createComplianceRecord(record: InsertComplianceRecord): Promise<ComplianceRecord>;
  getAllComplianceRecords(): Promise<ComplianceRecord[]>;
  getComplianceAnalytics(): Promise<{
    totalRequirements: number;
    overdueRequirements: number;
    upcomingRequirements: number;
    averageComplianceScore: number;
  }>;

  // Email Template Management
  createEmailTemplate(templateData: InsertEmailTemplate): Promise<EmailTemplate>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  updateEmailTemplate(id: string, updates: UpdateEmailTemplate): Promise<EmailTemplate>;
  getAllEmailTemplates(): Promise<EmailTemplate[]>;
  deleteEmailTemplate(id: string): Promise<void>;

  // SMS Template Management
  createSmsTemplate(templateData: InsertSmsTemplate): Promise<SmsTemplate>;
  getSmsTemplate(id: string): Promise<SmsTemplate | undefined>;
  updateSmsTemplate(id: string, updates: UpdateSmsTemplate): Promise<SmsTemplate>;
  getAllSmsTemplates(): Promise<SmsTemplate[]>;
  deleteSmsTemplate(id: string): Promise<void>;

  // ServiceM8 Integration Management
  createServicem8Config(config: InsertServicem8Config): Promise<Servicem8Config>;
  getServicem8Config(): Promise<Servicem8Config | undefined>;
  updateServicem8Config(id: string, updates: Partial<InsertServicem8Config>): Promise<Servicem8Config>;
  deleteServicem8Config(id: string): Promise<void>;

  // ServiceM8 Data Import Management
  createServicem8Job(job: InsertServicem8Job): Promise<Servicem8Job>;
  getServicem8Job(id: string): Promise<Servicem8Job | undefined>;
  getServicem8JobByUuid(uuid: string): Promise<Servicem8Job | undefined>;
  updateServicem8Job(id: string, updates: Partial<InsertServicem8Job>): Promise<Servicem8Job>;
  getAllServicem8Jobs(): Promise<Servicem8Job[]>;
  
  createServicem8DiaryEntry(entry: InsertServicem8DiaryEntry): Promise<Servicem8DiaryEntry>;
  getServicem8DiaryEntry(id: string): Promise<Servicem8DiaryEntry | undefined>;
  getServicem8DiaryEntriesByJob(jobUuid: string): Promise<Servicem8DiaryEntry[]>;
  
  createServicem8Quote(quote: InsertServicem8Quote): Promise<Servicem8Quote>;
  getServicem8Quote(id: string): Promise<Servicem8Quote | undefined>;
  getServicem8QuoteByUuid(uuid: string): Promise<Servicem8Quote | undefined>;
  
  createServicem8Company(company: InsertServicem8Company): Promise<Servicem8Company>;
  getServicem8Company(id: string): Promise<Servicem8Company | undefined>;
  getServicem8CompanyByUuid(uuid: string): Promise<Servicem8Company | undefined>;
  
  createServicem8Invoice(invoice: InsertServicem8Invoice): Promise<Servicem8Invoice>;
  getServicem8Invoice(id: string): Promise<Servicem8Invoice | undefined>;
  getServicem8InvoiceByJobUuid(jobUuid: string): Promise<Servicem8Invoice | undefined>;
  
  createServicem8Material(material: InsertServicem8Material): Promise<Servicem8Material>;
  getServicem8MaterialsByJob(jobUuid: string): Promise<Servicem8Material[]>;

  // Document Template Management
  createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate>;
  getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined>;
  updateDocumentTemplate(id: string, updates: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate>;
  deleteDocumentTemplate(id: string): Promise<void>;
  getAllDocumentTemplates(): Promise<DocumentTemplate[]>;
  getDocumentTemplatesByType(type: string): Promise<DocumentTemplate[]>;
  getDefaultDocumentTemplate(type: string): Promise<DocumentTemplate | undefined>;
  getDefaultDocumentTemplateForBusiness(businessId: string | null | undefined, type: string): Promise<DocumentTemplate | undefined>;

  // Template Sections Management
  createTemplateSection(section: InsertTemplateSection): Promise<TemplateSection>;
  getTemplateSection(id: string): Promise<TemplateSection | undefined>;
  updateTemplateSection(id: string, updates: Partial<InsertTemplateSection>): Promise<TemplateSection>;
  deleteTemplateSection(id: string): Promise<void>;
  getTemplateSectionsByTemplate(templateId: string): Promise<TemplateSection[]>;
  
  // Template Line Items Management
  createTemplateLineItem(lineItem: InsertTemplateLineItem): Promise<TemplateLineItem>;
  getTemplateLineItem(id: string): Promise<TemplateLineItem | undefined>;
  updateTemplateLineItem(id: string, updates: Partial<InsertTemplateLineItem>): Promise<TemplateLineItem>;
  deleteTemplateLineItem(id: string): Promise<void>;
  getTemplateLineItemsByTemplate(templateId: string): Promise<TemplateLineItem[]>;
  getTemplateLineItemsBySection(sectionId: string): Promise<TemplateLineItem[]>;
  
  // Template Photos Management
  createTemplatePhoto(photo: InsertTemplatePhoto): Promise<TemplatePhoto>;
  getTemplatePhoto(id: string): Promise<TemplatePhoto | undefined>;
  updateTemplatePhoto(id: string, updates: Partial<InsertTemplatePhoto>): Promise<TemplatePhoto>;
  deleteTemplatePhoto(id: string): Promise<void>;
  getTemplatePhotosByTemplate(templateId: string): Promise<TemplatePhoto[]>;
  getTemplatePhotosBySection(sectionId: string): Promise<TemplatePhoto[]>;
  
  // Generated Documents Management
  createGeneratedDocument(document: InsertGeneratedDocument): Promise<GeneratedDocument>;
  getGeneratedDocument(id: string): Promise<GeneratedDocument | undefined>;
  updateGeneratedDocument(id: string, updates: Partial<InsertGeneratedDocument>): Promise<GeneratedDocument>;
  deleteGeneratedDocument(id: string): Promise<void>;
  getAllGeneratedDocuments(): Promise<GeneratedDocument[]>;
  getGeneratedDocumentsByJob(jobId: string): Promise<GeneratedDocument[]>;
  getGeneratedDocumentsByCustomer(customerId: string): Promise<GeneratedDocument[]>;
  getGeneratedDocumentsByType(type: string): Promise<GeneratedDocument[]>;
  getGeneratedDocumentsByStatus(status: string): Promise<GeneratedDocument[]>;
  generateDocumentNumber(type: string): Promise<string>;
  
  // Generated Document Line Items Management
  createGeneratedDocumentLineItem(lineItem: InsertGeneratedDocumentLineItem): Promise<GeneratedDocumentLineItem>;
  getGeneratedDocumentLineItem(id: string): Promise<GeneratedDocumentLineItem | undefined>;
  updateGeneratedDocumentLineItem(id: string, updates: Partial<InsertGeneratedDocumentLineItem>): Promise<GeneratedDocumentLineItem>;
  deleteGeneratedDocumentLineItem(id: string): Promise<void>;
  getGeneratedDocumentLineItemsByDocument(documentId: string): Promise<GeneratedDocumentLineItem[]>;
  
  // Generated Document Photos Management
  createGeneratedDocumentPhoto(photo: InsertGeneratedDocumentPhoto): Promise<GeneratedDocumentPhoto>;
  getGeneratedDocumentPhoto(id: string): Promise<GeneratedDocumentPhoto | undefined>;
  updateGeneratedDocumentPhoto(id: string, updates: Partial<InsertGeneratedDocumentPhoto>): Promise<GeneratedDocumentPhoto>;
  deleteGeneratedDocumentPhoto(id: string): Promise<void>;
  getGeneratedDocumentPhotosByDocument(documentId: string): Promise<GeneratedDocumentPhoto[]>;

  // Job Hazard Analysis (JHA)
  getAllJhaHazardTemplates(): Promise<schema.JhaHazardTemplate[]>;
  getJhaHazardTemplate(id: string): Promise<schema.JhaHazardTemplate | undefined>;
  createJhaHazardTemplate(template: schema.InsertJhaHazardTemplate): Promise<schema.JhaHazardTemplate>;
  updateJhaHazardTemplate(id: string, updates: Partial<schema.InsertJhaHazardTemplate>): Promise<schema.JhaHazardTemplate>;
  deleteJhaHazardTemplate(id: string): Promise<void>;

  getAllJhaRiskControlTemplates(): Promise<schema.JhaRiskControlTemplate[]>;
  getJhaRiskControlTemplate(id: string): Promise<schema.JhaRiskControlTemplate | undefined>;
  createJhaRiskControlTemplate(template: schema.InsertJhaRiskControlTemplate): Promise<schema.JhaRiskControlTemplate>;
  updateJhaRiskControlTemplate(id: string, updates: Partial<schema.InsertJhaRiskControlTemplate>): Promise<schema.JhaRiskControlTemplate>;
  deleteJhaRiskControlTemplate(id: string): Promise<void>;

  getAllJhaControlMeasures(hazardTemplateId?: string): Promise<schema.JhaControlMeasureTemplate[]>;
  getJhaControlMeasure(id: string): Promise<schema.JhaControlMeasureTemplate | undefined>;
  createJhaControlMeasure(measure: schema.InsertJhaControlMeasureTemplate): Promise<schema.JhaControlMeasureTemplate>;
  updateJhaControlMeasure(id: string, updates: Partial<schema.InsertJhaControlMeasureTemplate>): Promise<schema.JhaControlMeasureTemplate>;
  deleteJhaControlMeasure(id: string): Promise<void>;

  getAllJhaAssessments(jobId?: string, status?: string): Promise<any[]>;
  getJhaAssessment(id: string, includeSteps?: boolean, includeSignatures?: boolean): Promise<schema.JhaAssessment | undefined>;
  createJhaAssessment(assessment: schema.InsertJhaAssessment): Promise<schema.JhaAssessment>;
  updateJhaAssessment(id: string, updates: Partial<schema.InsertJhaAssessment>): Promise<schema.JhaAssessment>;
  deleteJhaAssessment(id: string): Promise<void>;

  getJhaSteps(assessmentId: string): Promise<schema.JhaStep[]>;
  createJhaStep(step: schema.InsertJhaStep): Promise<schema.JhaStep>;
  updateJhaStep(id: string, updates: Partial<schema.InsertJhaStep>): Promise<schema.JhaStep>;
  deleteJhaStep(id: string): Promise<void>;

  getJhaStepControls(stepId: string): Promise<schema.JhaStepControl[]>;
  createJhaStepControl(control: schema.InsertJhaStepControl): Promise<schema.JhaStepControl>;
  updateJhaStepControl(id: string, updates: Partial<schema.InsertJhaStepControl>): Promise<schema.JhaStepControl>;
  deleteJhaStepControl(id: string): Promise<void>;

  getJhaSignatures(assessmentId: string): Promise<schema.JhaSignature[]>;
  createJhaSignature(signature: schema.InsertJhaSignature): Promise<schema.JhaSignature>;
  deleteJhaSignature(id: string): Promise<void>;

  // Marketing Campaigns
  createMarketingCampaign(campaign: schema.InsertMarketingCampaign): Promise<schema.MarketingCampaign>;
  getMarketingCampaign(id: string): Promise<schema.MarketingCampaign | undefined>;
  getAllMarketingCampaigns(): Promise<schema.MarketingCampaign[]>;
  getMarketingCampaignsByStatus(status: string): Promise<schema.MarketingCampaign[]>;
  getScheduledMarketingCampaigns(): Promise<schema.MarketingCampaign[]>;
  updateMarketingCampaign(id: string, updates: Partial<schema.InsertMarketingCampaign>): Promise<schema.MarketingCampaign>;
  deleteMarketingCampaign(id: string): Promise<void>;
  
  // Marketing Settings
  getMarketingSettings(): Promise<{ autoPostReviews: boolean; autoPostDelay: number; minReviewRating: number } | null>;
  updateMarketingSettings(updates: Partial<{ autoPostReviews: boolean; autoPostDelay: number; minReviewRating: number }>): Promise<{ autoPostReviews: boolean; autoPostDelay: number; minReviewRating: number }>;

  // Push Notifications - FCM Tokens
  createFcmToken(token: schema.InsertFcmToken): Promise<schema.FcmToken>;
  getFcmToken(id: string): Promise<schema.FcmToken | undefined>;
  getFcmTokensByEmployee(employeeId: string): Promise<schema.FcmToken[]>;
  getFcmTokenByToken(token: string): Promise<schema.FcmToken | undefined>;
  updateFcmToken(id: string, updates: Partial<schema.InsertFcmToken>): Promise<schema.FcmToken>;
  deleteFcmToken(id: string): Promise<void>;
  deleteFcmTokenByToken(token: string): Promise<void>;
  getActiveFcmTokens(employeeId: string): Promise<schema.FcmToken[]>;
  markFcmTokenAsUsed(token: string): Promise<void>;
  
  // Push Notifications - Preferences
  createNotificationPreferences(prefs: schema.InsertNotificationPreferences): Promise<schema.NotificationPreferences>;
  getNotificationPreferences(employeeId: string): Promise<schema.NotificationPreferences | undefined>;
  updateNotificationPreferences(employeeId: string, updates: Partial<schema.InsertNotificationPreferences>): Promise<schema.NotificationPreferences>;

  // Job completion checklist (manual ticks)
  getJobChecklistCompletions(jobId: string): Promise<schema.JobChecklistCompletion[]>;
  setJobChecklistItem(jobId: string, itemId: string, employeeId: string | null, employeeName: string | null): Promise<schema.JobChecklistCompletion>;
  clearJobChecklistItem(jobId: string, itemId: string): Promise<void>;

  // Call Records
  createCallRecord(record: schema.InsertCallRecord): Promise<schema.CallRecord>;
  getCallRecord(id: string): Promise<schema.CallRecord | null>;
  updateCallRecord(id: string, updates: Partial<schema.InsertCallRecord>): Promise<schema.CallRecord>;
  getCallRecords(filters?: {
    jobId?: string;
    customerId?: string;
    leadId?: string;
    direction?: string;
    limit?: number;
  }): Promise<schema.CallRecord[]>;
  getCallRecordsByJob(jobId: string): Promise<schema.CallRecord[]>;
  getCallRecordsByCustomer(customerId: string): Promise<schema.CallRecord[]>;
  deleteCallRecord(id: string): Promise<boolean>;

  // Tree Markers - Job Site Mapping
  createTreeMarker(marker: schema.InsertTreeMarker): Promise<schema.TreeMarker>;
  getTreeMarker(id: string): Promise<schema.TreeMarker | null>;
  updateTreeMarker(id: string, updates: schema.UpdateTreeMarker): Promise<schema.TreeMarker>;
  deleteTreeMarker(id: string): Promise<boolean>;
  getTreeMarkersByJob(jobId: string): Promise<schema.TreeMarker[]>;

  // Mulch Drops
  createMulchDrop(drop: schema.InsertMulchDrop): Promise<schema.MulchDrop>;
  reorderMulchDrops(orderedIds: string[]): Promise<void>;
  getMulchDrop(id: string): Promise<schema.MulchDrop | null>;
  getMulchDrops(status?: string): Promise<schema.MulchDrop[]>;
  updateMulchDrop(id: string, updates: schema.UpdateMulchDrop): Promise<schema.MulchDrop>;
  deleteMulchDrop(id: string): Promise<boolean>;

  // AI Assistant Messages
  createAssistantMessage(message: schema.InsertAssistantMessage): Promise<schema.AssistantMessage>;
  getAssistantMessages(sessionId: string, employeeId: string, limit?: number): Promise<schema.AssistantMessage[]>;
  deleteAssistantSession(sessionId: string, employeeId: string): Promise<void>;
}

// Database Storage Implementation
class DatabaseStorage implements IStorage {
  // ========================================
  // USER MANAGEMENT
  // ========================================
  
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  // ========================================
  // CUSTOMER MANAGEMENT
  // ========================================
  
  // Helper function to normalize phone numbers (strip all non-digits)
  private normalizePhone(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const normalized = phone.replace(/\D/g, '');
    return normalized || null;
  }
  
  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    // Automatically populate normalizedPhone when creating customer
    const customerData = {
      ...customer,
      normalizedPhone: this.normalizePhone(customer.phone)
    };
    const [newCustomer] = await db.insert(schema.customers).values(withTenant(customerData)).returning();
    
    // Auto-sync to Mailchimp if enabled
    this.syncCustomerToMailchimpBackground(newCustomer).catch(err => {
      console.error('Mailchimp auto-sync failed for new customer:', err);
    });
    
    return newCustomer;
  }
  
  private async syncCustomerToMailchimpBackground(customer: Customer): Promise<void> {
    try {
      // Get business settings to check if Mailchimp is enabled
      const settings = await this.getBusinessSettings();
      
      if (settings?.mailchimpEnabled && settings.mailchimpApiKey && settings.mailchimpAudienceId && settings.mailchimpAutoSync) {
        // Only sync if customer has an email
        if (customer.email) {
          await mailchimpService.syncCustomerToMailchimp(customer, {
            apiKey: settings.mailchimpApiKey,
            audienceId: settings.mailchimpAudienceId
          });
          console.log(`Auto-synced customer ${customer.id} to Mailchimp`);
        }
      }
    } catch (error) {
      console.error('Error syncing customer to Mailchimp:', error);
      // Don't throw - this is a background operation
    }
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
    return customer || undefined;
  }

  async findCustomerByPhone(phone: string): Promise<Customer | undefined> {
    // Normalize phone number: remove all non-digit characters
    const normalizedInput = this.normalizePhone(phone);

    if (!normalizedInput) {
      return undefined;
    }

    // Use indexed normalizedPhone column for efficient lookup
    const [customer] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.normalizedPhone, normalizedInput))
      .limit(1);

    return customer || undefined;
  }

  async findCustomerByPhoneLast8(last8: string): Promise<Customer | undefined> {
    // Match on the last 8 digits of either phone field, DB-side, so we don't
    // haul the whole customer table into memory on every inbound call. The
    // last-8 heuristic ignores +64 vs 0 country-code differences. Strips
    // non-digits in SQL with a POSIX class ([^0-9]) to avoid backslash-escape
    // pitfalls in the query template.
    const key = (last8 || '').replace(/\D/g, '').slice(-8);
    if (key.length < 7) return undefined;
    // Twilio webhooks run on the RLS-bypassing owner connection, so this query
    // would otherwise search EVERY tenant's customers — leaking another
    // business's customer name onto the caller-ID screen. Scope to the ambient
    // tenant when one is set (webhook requests stamp it — same context that
    // sets businessId on the call record).
    const businessId = currentBusinessId();
    const phoneMatch = sql`(right(regexp_replace(coalesce(${schema.customers.phone}, ''), '[^0-9]', '', 'g'), 8) = ${key}
            or right(regexp_replace(coalesce(${schema.customers.mobile}, ''), '[^0-9]', '', 'g'), 8) = ${key})`;
    const [customer] = await db
      .select()
      .from(schema.customers)
      .where(businessId ? and(eq(schema.customers.businessId, businessId), phoneMatch) : phoneMatch)
      // Deterministic pick if several records share a number (imports often
      // duplicate contacts): oldest record wins instead of plan-dependent luck.
      .orderBy(asc(schema.customers.createdAt))
      .limit(1);
    return customer || undefined;
  }

  async findCustomerByEmail(email: string): Promise<Customer | undefined> {
    const normalized = (email ?? '').trim().toLowerCase();
    if (!normalized) return undefined;

    const [customer] = await db
      .select()
      .from(schema.customers)
      .where(sql`LOWER(${schema.customers.email}) = ${normalized}`)
      .limit(1);

    return customer || undefined;
  }

  async findCustomerByName(name: string): Promise<Customer | undefined> {
    const normalized = (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalized) return undefined;

    // Case- and whitespace-insensitive match on customers.name. Prefer an
    // active record; fall back to any match so the caller can reactivate
    // rather than duplicate. Whitespace collapsing matches the grouping
    // logic used by the bulk dedupe job.
    const nameExpr = sql`TRIM(LOWER(REGEXP_REPLACE(${schema.customers.name}, '\s+', ' ', 'g')))`;

    const [active] = await db
      .select()
      .from(schema.customers)
      .where(sql`${nameExpr} = ${normalized} AND ${schema.customers.isActive} IS DISTINCT FROM FALSE`)
      .limit(1);
    if (active) return active;

    const [any] = await db
      .select()
      .from(schema.customers)
      .where(sql`${nameExpr} = ${normalized}`)
      .limit(1);
    return any || undefined;
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer> {
    // Automatically update normalizedPhone if phone is being updated
    const updateData = { ...updates, updatedAt: new Date() };
    if (updates.phone !== undefined) {
      updateData.normalizedPhone = this.normalizePhone(updates.phone);
    }
    
    const [customer] = await db.update(schema.customers)
      .set(updateData)
      .where(eq(schema.customers.id, id))
      .returning();
    return customer;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(schema.customers).where(eq(schema.customers.id, id));
    return result.rowCount! > 0;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(schema.customers).orderBy(asc(schema.customers.name));
  }

  async clearAllCustomers(): Promise<number> {
    const result = await db.delete(schema.customers);
    return result.rowCount || 0;
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const searchTerm = `%${query}%`;
    return await db.select().from(schema.customers)
      .where(
        sql`${schema.customers.name} ILIKE ${searchTerm} OR ${schema.customers.email} ILIKE ${searchTerm}`
      )
      .orderBy(asc(schema.customers.name));
  }

  // ========================================
  // CUSTOMER CONTACTS (multi-contact under one customer org)
  // ========================================

  async getCustomerContacts(customerId: string): Promise<schema.CustomerContact[]> {
    return await db
      .select()
      .from(schema.customerContacts)
      .where(eq(schema.customerContacts.customerId, customerId))
      .orderBy(desc(schema.customerContacts.isPrimary), asc(schema.customerContacts.firstName));
  }

  async getCustomerContact(id: string): Promise<schema.CustomerContact | undefined> {
    const [c] = await db.select().from(schema.customerContacts).where(eq(schema.customerContacts.id, id)).limit(1);
    return c || undefined;
  }

  async createCustomerContact(input: schema.InsertCustomerContact): Promise<schema.CustomerContact> {
    const phoneForNorm = input.mobile?.trim() || input.phone?.trim() || '';
    const normalizedPhone = this.normalizePhone(phoneForNorm);
    if (input.isPrimary) {
      // Demote any existing primary so there's only one per customer
      await db.update(schema.customerContacts)
        .set({ isPrimary: false })
        .where(eq(schema.customerContacts.customerId, input.customerId));
    }
    const [created] = await db
      .insert(schema.customerContacts)
      .values({ ...input, normalizedPhone })
      .returning();
    return created;
  }

  async updateCustomerContact(id: string, updates: schema.UpdateCustomerContact): Promise<schema.CustomerContact> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    if ('phone' in updates || 'mobile' in updates) {
      const existing = await this.getCustomerContact(id);
      const newMobile = (updates as any).mobile ?? existing?.mobile ?? '';
      const newPhone = (updates as any).phone ?? existing?.phone ?? '';
      updateData.normalizedPhone = this.normalizePhone(newMobile || newPhone || '');
    }
    if (updates.isPrimary) {
      const existing = await this.getCustomerContact(id);
      if (existing) {
        await db.update(schema.customerContacts)
          .set({ isPrimary: false })
          .where(eq(schema.customerContacts.customerId, existing.customerId));
      }
    }
    const [updated] = await db
      .update(schema.customerContacts)
      .set(updateData)
      .where(eq(schema.customerContacts.id, id))
      .returning();
    return updated;
  }

  async deleteCustomerContact(id: string): Promise<boolean> {
    const result = await db.delete(schema.customerContacts).where(eq(schema.customerContacts.id, id));
    return (result.rowCount || 0) > 0;
  }

  // ========================================
  // CUSTOMER IMPORT BATCH MANAGEMENT
  // ========================================

  async createCustomerImportBatch(batch: InsertCustomerImportBatch): Promise<CustomerImportBatch> {
    const [newBatch] = await db.insert(schema.customerImportBatches).values(withTenant(batch)).returning();
    return newBatch;
  }

  async getCustomerImportBatch(id: string): Promise<CustomerImportBatch | undefined> {
    const [batch] = await db.select().from(schema.customerImportBatches).where(eq(schema.customerImportBatches.id, id));
    return batch || undefined;
  }

  async updateCustomerImportBatch(id: string, updates: Partial<InsertCustomerImportBatch>): Promise<CustomerImportBatch> {
    const [batch] = await db.update(schema.customerImportBatches)
      .set({ ...updates })
      .where(eq(schema.customerImportBatches.id, id))
      .returning();
    return batch;
  }

  async getAllCustomerImportBatches(): Promise<CustomerImportBatch[]> {
    return await db.select().from(schema.customerImportBatches).orderBy(desc(schema.customerImportBatches.createdAt));
  }

  async getCustomersByImportBatch(batchId: string): Promise<Customer[]> {
    return await db.select().from(schema.customers)
      .where(eq(schema.customers.importBatchId, batchId))
      .orderBy(desc(schema.customers.createdAt));
  }

  // CSV Import and Bulk Update Methods
  async bulkUpdateCustomers(updates: Array<{id: string; updates: Partial<InsertCustomer>}>): Promise<{updated: number; failed: number; errors: string[]}> {
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const update of updates) {
      try {
        await this.updateCustomer(update.id, update.updates);
        updated++;
      } catch (error) {
        failed++;
        const errorMsg = `Failed to update customer ${update.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error('❌ Bulk update error:', errorMsg);
      }
    }

    return { updated, failed, errors };
  }

  async matchCustomersFromCSV(csvData: any[]): Promise<{
    matches: Array<{
      csvRow: number;
      csvData: any;
      existingCustomer?: Customer;
      matchType: 'uuid' | 'email' | 'phone' | 'none';
      matchConfidence: 'high' | 'medium' | 'low';
      proposedName: string;
      willUpdate: boolean;
    }>;
    totalRows: number;
    matchableRows: number;
    highConfidenceMatches: number;
    willUpdateCount: number;
  }> {
    const allCustomers = await this.getAllCustomers();
    const matches: any[] = [];
    let matchableRows = 0;
    let highConfidenceMatches = 0;
    let willUpdateCount = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const csvRow = i + 1; // 1-based row numbering
      
      // Normalize field names (handle common variations)
      const normalizedRow = this.normalizeCSVRow(row);
      
      // Skip rows without any useful data
      if (!this.hasMatchableData(normalizedRow)) {
        continue;
      }
      
      matchableRows++;
      
      // Try to match by different strategies
      const matchResult = this.findCustomerMatch(normalizedRow, allCustomers);
      
      // Generate proposed name
      const proposedName = this.generateProposedName(normalizedRow);
      
      // Determine if we should update this customer
      const willUpdate = this.shouldUpdateCustomer(matchResult.customer, proposedName);
      
      if (willUpdate) {
        willUpdateCount++;
      }
      
      if (matchResult.matchType !== 'none' && matchResult.confidence === 'high') {
        highConfidenceMatches++;
      }
      
      matches.push({
        csvRow,
        csvData: normalizedRow,
        existingCustomer: matchResult.customer,
        matchType: matchResult.matchType,
        matchConfidence: matchResult.confidence,
        proposedName,
        willUpdate
      });
    }

    return {
      matches,
      totalRows: csvData.length,
      matchableRows,
      highConfidenceMatches,
      willUpdateCount
    };
  }

  // Helper methods for CSV matching
  private normalizeCSVRow(row: any): any {
    const normalized: any = {};
    
    // Map common field variations to standard names, including exact ServiceM8 headers
    const fieldMappings: { [key: string]: string[] } = {
      'name': ['name', 'customer_name', 'company_name', 'full_name', 'Name'],
      'email': ['email', 'email_address', 'contact_email', 'Email Address'],
      'phone': ['phone', 'mobile', 'phone_number', 'contact_phone', 'Mobile Number', 'mobile_number'],
      'servicem8Uuid': ['uuid', 'servicem8_uuid', 'servicem8uuid', 'customer_uuid'],
      'address': ['address', 'address_line1', 'street_address', 'Company Address'],
      'contact_first': ['contact_first', 'first_name', 'firstname', 'Contact First', 'Billing Contact First'],
      'contact_last': ['contact_last', 'last_name', 'lastname', 'Contact Last', 'Billing Contact Last'],
      'billing_email': ['billing_email', 'billing_email_address', 'Billing Email Address'],
      'telephone': ['telephone', 'telephone_number', 'Telephone Number'],
      'billing_phone': ['billing_phone', 'billing_mobile', 'Billing Mobile Number']
    };

    for (const [standardField, variations] of Object.entries(fieldMappings)) {
      for (const variation of variations) {
        const value = row[variation] || row[variation.toLowerCase()] || row[variation.toUpperCase()];
        if (value && typeof value === 'string' && value.trim()) {
          normalized[standardField] = value.trim();
          break;
        }
      }
    }

    // Combine first and last names if no company name and name field isn't available
    if (!normalized.name && !normalized.company_name) {
      const firstName = normalized.contact_first || '';
      const lastName = normalized.contact_last || '';
      if (firstName || lastName) {
        normalized.name = `${firstName} ${lastName}`.trim();
      }
    }

    // Use company_name as name if available and no name is set
    if (!normalized.name && normalized.company_name) {
      normalized.name = normalized.company_name;
    }

    return normalized;
  }

  private hasMatchableData(row: any): boolean {
    return !!(row.name || row.email || row.phone || row.servicem8Uuid || row.contact_first || row.contact_last);
  }

  private findCustomerMatch(csvRow: any, allCustomers: Customer[]): {
    customer?: Customer;
    matchType: 'uuid' | 'email' | 'phone' | 'none';
    confidence: 'high' | 'medium' | 'low';
  } {
    // Strategy 1: ServiceM8 UUID (highest priority)
    if (csvRow.servicem8Uuid) {
      const match = allCustomers.find(c => c.servicem8Uuid === csvRow.servicem8Uuid);
      if (match) {
        return { customer: match, matchType: 'uuid', confidence: 'high' };
      }
    }

    // Strategy 2: Email (high confidence)
    if (csvRow.email) {
      const match = allCustomers.find(c => 
        c.email && c.email.toLowerCase() === csvRow.email.toLowerCase()
      );
      if (match) {
        return { customer: match, matchType: 'email', confidence: 'high' };
      }
    }

    // Strategy 3: Phone number (medium confidence)
    if (csvRow.phone) {
      // Normalize phone numbers for comparison
      const normalizedCsvPhone = this.normalizePhoneNumber(csvRow.phone);
      const match = allCustomers.find(c => {
        if (!c.phone) return false;
        const normalizedCustomerPhone = this.normalizePhoneNumber(c.phone);
        return normalizedCsvPhone === normalizedCustomerPhone;
      });
      if (match) {
        return { customer: match, matchType: 'phone', confidence: 'medium' };
      }
    }

    return { matchType: 'none', confidence: 'low' };
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters and normalize format
    return phone.replace(/\D/g, '').replace(/^0/, ''); // Remove leading 0 for NZ numbers
  }

  private generateProposedName(csvRow: any): string {
    // Priority 1: Full name if available and looks like a real name (not phone number or ID)
    if (csvRow.name && !csvRow.name.startsWith('Customer-') && this.isValidCustomerName(csvRow.name)) {
      return this.cleanupName(csvRow.name);
    }

    // Priority 2: Construct from first/last name
    if (csvRow.contact_first || csvRow.contact_last) {
      const firstName = csvRow.contact_first || '';
      const lastName = csvRow.contact_last || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName && this.isValidCustomerName(fullName)) {
        return this.cleanupName(fullName);
      }
    }

    // Priority 3: If name field contains what looks like a phone number, try other fields
    if (csvRow.name && !this.isValidCustomerName(csvRow.name)) {
      // Check if there's a better name in other fields
      if (csvRow.contact_first || csvRow.contact_last) {
        const firstName = csvRow.contact_first || '';
        const lastName = csvRow.contact_last || '';
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName && this.isValidCustomerName(fullName)) {
          return this.cleanupName(fullName);
        }
      }
    }

    // Priority 4: Use email username if it looks like a name
    if (csvRow.email && csvRow.email.includes('@')) {
      const username = csvRow.email.split('@')[0];
      const cleanUsername = username.replace(/[._-]/g, ' ');
      if (this.isValidCustomerName(cleanUsername)) {
        return this.formatNameFromEmail(cleanUsername);
      }
    }

    // Priority 5: Use phone as identifier if that's all we have
    if (csvRow.phone) {
      return `Customer (${csvRow.phone})`;
    }

    // Priority 6: Use name field even if it looks like phone/ID (data quality issues)
    if (csvRow.name) {
      return csvRow.name;
    }

    // Fallback
    return 'Customer (Unknown)';
  }

  private isValidCustomerName(name: string): boolean {
    if (!name || name.trim().length < 2) return false;
    
    // Check if it's likely a phone number
    const phonePattern = /^[\d\s\-\+\(\)]{7,}$/;
    if (phonePattern.test(name.trim())) return false;
    
    // Check if it's likely an ID or UUID
    const idPattern = /^[\d\-]+\s*DF$/;
    if (idPattern.test(name.trim())) return false;
    
    // Check if it starts with just numbers (likely address or phone)
    const startsWithNumberPattern = /^\d+\s/;
    if (startsWithNumberPattern.test(name.trim())) return false;
    
    return true;
  }

  private cleanupName(name: string): string {
    // Remove extra quotes that might be in ServiceM8 export
    return name.replace(/^["']+|["']+$/g, '').trim();
  }

  private formatNameFromEmail(username: string): string {
    // Convert underscores/dots to spaces and capitalize words
    return username
      .replace(/[._]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private shouldUpdateCustomer(existingCustomer?: Customer, proposedName?: string): boolean {
    if (!existingCustomer || !proposedName) return false;
    
    // Update if current name is a placeholder/generic name
    if (existingCustomer.name.startsWith('Customer-') || 
        existingCustomer.name.startsWith('Customer #')) {
      return true;
    }

    // Update if the proposed name is significantly better
    if (proposedName.length > existingCustomer.name.length && 
        !proposedName.startsWith('Customer')) {
      return true;
    }

    return false;
  }

  async importCustomersFromCSV(
    csvData: any[], 
    batchId: string, 
    importSource: string = 'csv_upload'
  ): Promise<{
    success: boolean;
    imported: number;
    updated: number;
    skipped: number;
    errors: string[];
    totalProcessed: number;
  }> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      console.log(`🚀 Starting CSV import for batch ${batchId}...`);
      
      // First, get the matching analysis
      const matchResults = await this.matchCustomersFromCSV(csvData);
      
      // Process each match
      for (const match of matchResults.matches) {
        try {
          if (match.matchType === 'none') {
            // Create new customer
            const customerData: InsertCustomer = {
              name: match.proposedName,
              email: match.csvData.email || match.csvData.billing_email || null,
              phone: match.csvData.phone || match.csvData.mobile || match.csvData.telephone || match.csvData.billing_phone || null,
              address: match.csvData.address || null,
              source: 'import', // Lead generation source
              importSource, // Import method
              importBatchId: batchId, // Track which batch this came from
              externalId: match.csvData.servicem8Uuid || null, // External system ID
              servicem8Uuid: match.csvData.servicem8Uuid || null, // ServiceM8 specific
              isActive: true
            };

            await this.createCustomer(customerData);
            imported++;
            console.log(`✅ Imported new customer: ${customerData.name}`);
          } else if (match.willUpdate && match.existingCustomer) {
            // Update existing customer with better data
            const updates: Partial<InsertCustomer> = {
              name: match.proposedName,
              importSource, // Track this update source
              importBatchId: batchId // Track which batch updated this
            };

            // Only update fields that have new data
            if (match.csvData.email && !match.existingCustomer.email) {
              updates.email = match.csvData.email;
            }
            if (match.csvData.phone && !match.existingCustomer.phone) {
              updates.phone = match.csvData.phone;
            }
            if (match.csvData.address && !match.existingCustomer.address) {
              updates.address = match.csvData.address;
            }

            await this.updateCustomer(match.existingCustomer.id, updates);
            updated++;
            console.log(`🔄 Updated customer: ${match.proposedName}`);
          } else {
            // Skip - existing customer with no updates needed
            skipped++;
            console.log(`⏭️ Skipped customer: ${match.existingCustomer?.name || match.proposedName}`);
          }
        } catch (error) {
          const errorMsg = `Failed to process customer row ${match.csvRow}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      // Update batch status with final results
      await this.updateCustomerImportBatch(batchId, {
        status: 'completed',
        totalRecords: csvData.length,
        successfulRecords: imported + updated,
        failedRecords: errors.length,
        errorDetails: errors.length > 0 ? errors : null,
        completedAt: new Date()
      });

      const totalProcessed = imported + updated + skipped;
      console.log(`🎉 CSV import completed: ${imported} imported, ${updated} updated, ${skipped} skipped, ${errors.length} errors`);
      
      return {
        success: true,
        imported,
        updated,
        skipped,
        errors,
        totalProcessed
      };
    } catch (error) {
      console.error('❌ CSV import failed:', error);
      
      // Mark batch as failed
      await this.updateCustomerImportBatch(batchId, {
        status: 'failed',
        errorDetails: [`CSV import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        completedAt: new Date()
      });

      return {
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [`CSV import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        totalProcessed: 0
      };
    }
  }

  // ========================================
  // JOB MANAGEMENT  
  // ========================================
  
  async createJob(job: InsertJob): Promise<Job> {
    // Stamp workOrderAt when a job is created directly at work_order status
    // (e.g. from proposal acceptance paths that skip the lead/quote stages).
    if (job.status === 'work_order' && !(job as any).workOrderAt) {
      (job as any).workOrderAt = new Date();
    }
    const [newJob] = await db.insert(schema.jobs).values(withTenant(job)).returning();
    return newJob;
  }

  async getJob(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id));
    return job || undefined;
  }

  async getJobByJobNumber(jobNumber: string): Promise<Job | undefined> {
    const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.jobNumber, jobNumber));
    return job || undefined;
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job> {
    // Stamp workOrderAt once, the first time a job transitions to 'work_order'.
    // Only set if the caller hasn't provided one and the job doesn't already have it.
    const finalUpdates: Partial<InsertJob> = { ...updates };
    if (updates.status === 'work_order' && !(updates as any).workOrderAt) {
      const existingRows = await db.select({ workOrderAt: schema.jobs.workOrderAt })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, id));
      const existing = Array.isArray(existingRows) ? existingRows[0] : undefined;
      if (!existing?.workOrderAt) {
        (finalUpdates as any).workOrderAt = new Date();
      }
    }
    // Stamp lane_entered_at whenever the lane changes — this is the clock the "N days in lane"
    // automations and the UI badge read. Clear it when the job leaves all lanes. Only touch it
    // when the caller actually changed laneId, so unrelated edits don't reset the clock.
    if ('laneId' in updates && !(updates as any).laneEnteredAt) {
      const [existing] = await db.select({ laneId: schema.jobs.laneId })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, id));
      const newLaneId = (updates as any).laneId ?? null;
      if (existing && existing.laneId !== newLaneId) {
        (finalUpdates as any).laneEnteredAt = newLaneId ? new Date() : null;
      }
    }
    const [job] = await db.update(schema.jobs)
      .set({ ...finalUpdates, updatedAt: new Date() })
      .where(eq(schema.jobs.id, id))
      .returning();
    return job;
  }

  async updateInvoiceEligibility(jobId: string, eligible: boolean): Promise<Job> {
    const [job] = await db.update(schema.jobs)
      .set({ 
        invoiceEligible: eligible, 
        updatedAt: new Date() 
      })
      .where(eq(schema.jobs.id, jobId))
      .returning();
    return job;
  }

  async getJobsByCustomer(customerId: string): Promise<Job[]> {
    return await db.select().from(schema.jobs)
      .where(eq(schema.jobs.customerId, customerId))
      .orderBy(desc(schema.jobs.createdAt));
  }

  async getJobsByStatus(status: string): Promise<Job[]> {
    return await db.select().from(schema.jobs)
      .where(eq(schema.jobs.status, status))
      .orderBy(desc(schema.jobs.createdAt));
  }

  async getCompletedJobsWithCustomerNames(): Promise<Array<Job & { customerName: string | null; invoiceAmountIncGst: number | null }>> {
    const rows = await db.select({
      job: schema.jobs,
      customerName: schema.customers.name,
      invoiceAmountIncGst: schema.invoices.amount,
    })
      .from(schema.jobs)
      .leftJoin(schema.customers, eq(schema.jobs.customerId, schema.customers.id))
      .leftJoin(schema.invoices, eq(schema.invoices.jobId, schema.jobs.id))
      .where(eq(schema.jobs.status, 'completed'))
      .orderBy(desc(schema.jobs.createdAt));
    return rows.map((row) => ({
      ...row.job,
      customerName: row.customerName ?? null,
      invoiceAmountIncGst: row.invoiceAmountIncGst != null ? Number(row.invoiceAmountIncGst) : null,
    }));
  }

  async getAllJobs(options?: { limit?: number; offset?: number; status?: string; excludeCompleted?: boolean; excludeArchived?: boolean }): Promise<{ jobs: Job[]; total: number }> {
    const limit = options?.limit ?? 10; // Default to 10 jobs
    const offset = options?.offset ?? 0;
    
    // Build WHERE conditions
    const conditions: any[] = [];
    if (options?.status) {
      conditions.push(eq(schema.jobs.status, options.status));
    }
    if (options?.excludeCompleted) {
      conditions.push(ne(schema.jobs.status, 'completed'));
      conditions.push(ne(schema.jobs.status, 'invoiced'));
    }
    if (options?.excludeArchived) {
      conditions.push(ne(schema.jobs.status, 'archived'));
      conditions.push(ne(schema.jobs.status, 'unsuccessful'));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Reply timestamps used to be inline correlated subqueries on every row.
    // Without an index on job_diary_entries.job_id, each subquery scanned the
    // full diary table — for a 500-job page that meant 1000 full table scans
    // and 5–10s response times. Now we fetch them once as an aggregate (one
    // pass over the diary table) and merge in JS below. This is the single
    // biggest reason /api/jobs response time dropped from ~10s to <500ms.

    // Query with LEFT JOIN to include customer phone data
    const baseSelect = {
      job: schema.jobs,
      customerName: schema.customers.name,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      customerMobile: schema.customers.mobile,
    };
    const jobsQuery = whereClause
      ? db.select(baseSelect)
        .from(schema.jobs)
        .leftJoin(schema.customers, eq(schema.jobs.customerId, schema.customers.id))
        .where(whereClause)
        .orderBy(desc(schema.jobs.createdAt))
        .limit(limit)
        .offset(offset)
      : db.select(baseSelect)
        .from(schema.jobs)
        .leftJoin(schema.customers, eq(schema.jobs.customerId, schema.customers.id))
        .orderBy(desc(schema.jobs.createdAt))
        .limit(limit)
        .offset(offset);

    // Get total count (for pagination)
    const countQuery = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(schema.jobs).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(schema.jobs);

    // Aggregate diary timestamps in a single pass instead of one correlated
    // subquery per returned job. Filtered aggregates collapse the two we need
    // ('confirmation-reply-sent' = our acknowledgement, 'customer-reply' =
    // inbound natural-language reply) into one diary scan.
    const diaryTimestampsQuery = db.execute<{
      job_id: string;
      reply_sent_at: Date | null;
      customer_reply_at: Date | null;
    }>(sql`
      SELECT
        job_id,
        MAX(created_at) FILTER (WHERE tags @> ARRAY['confirmation-reply-sent']::text[]) AS reply_sent_at,
        MAX(created_at) FILTER (WHERE tags @> ARRAY['customer-reply']::text[]) AS customer_reply_at
      FROM job_diary_entries
      WHERE tags && ARRAY['confirmation-reply-sent', 'customer-reply']::text[]
      GROUP BY job_id
    `);

    const [results, totalResult, diaryRes] = await Promise.all([
      jobsQuery,
      countQuery,
      diaryTimestampsQuery,
    ]);

    const diaryByJob = new Map<string, { replySentAt: Date | null; customerReplyAt: Date | null }>();
    for (const row of (diaryRes as any).rows as any[]) {
      diaryByJob.set(row.job_id, {
        replySentAt: row.reply_sent_at,
        customerReplyAt: row.customer_reply_at,
      });
    }

    // Transform results to include customer data in job object
    const jobs = results.map((row: any) => {
      const diary = diaryByJob.get(row.job.id);
      return {
        ...row.job,
        customerName: row.customerName,
        customerEmail: row.customerEmail,
        customerPhone: row.customerPhone || row.customerMobile,
        confirmationReplySentAt: diary?.replySentAt ?? null,
        customerReplyReceivedAt: diary?.customerReplyAt ?? null,
      };
    });
    
    const total = Number(totalResult[0]?.count) || 0;

    return { jobs, total };
  }

  /**
   * Fast path for analytics/reporting that only need raw job rows. Skips the
   * customer LEFT JOIN and the two correlated diary-entry subqueries that
   * `getAllJobs` does — those make a full-table scan ~10× slower at 3k+ jobs
   * and 4k+ diary rows. Optional createdAt date range filters at the SQL
   * level so the analytics methods don't pull rows they're going to throw
   * away in JS anyway.
   */
  async getJobsForAnalytics(options?: { fromDate?: Date; toDate?: Date }): Promise<Job[]> {
    const conditions: any[] = [];
    if (options?.fromDate) conditions.push(gte(schema.jobs.createdAt, options.fromDate));
    if (options?.toDate) conditions.push(lte(schema.jobs.createdAt, options.toDate));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const q = whereClause
      ? db.select().from(schema.jobs).where(whereClause).orderBy(desc(schema.jobs.createdAt))
      : db.select().from(schema.jobs).orderBy(desc(schema.jobs.createdAt));
    return await q;
  }

  async searchJobs(query: string, options?: { limit?: number; offset?: number; excludeArchived?: boolean }): Promise<{ jobs: any[]; total: number }> {
    const limit = options?.limit ?? 100; // Default to 100 results for search
    const offset = options?.offset ?? 0;
    const excludeArchived = options?.excludeArchived ?? true;
    
    const searchTerm = `%${query.toLowerCase()}%`;
    
    // Build WHERE clause conditions including customer name search via raw SQL
    const searchConditions = or(
      sql`LOWER(${schema.jobs.jobNumber}) LIKE ${searchTerm}`,
      sql`LOWER(${schema.jobs.title}) LIKE ${searchTerm}`,
      sql`LOWER(${schema.jobs.description}) LIKE ${searchTerm}`,
      sql`LOWER(${schema.jobs.address}) LIKE ${searchTerm}`,
      sql`LOWER(${schema.jobs.notes}) LIKE ${searchTerm}`,
      sql`LOWER(${schema.jobs.specialInstructions}) LIKE ${searchTerm}`,
      sql`EXISTS (SELECT 1 FROM customers WHERE customers.id = ${schema.jobs.customerId} AND (LOWER(customers.name) LIKE ${searchTerm} OR LOWER(customers.email) LIKE ${searchTerm}))`
    );
    
    // Add archived filter if needed
    const whereClause = excludeArchived
      ? and(searchConditions, sql`${schema.jobs.status} != 'archived'`)
      : searchConditions;
    
    // Execute search query with LEFT JOIN to include customer data
    const results = await db
      .select({
        job: schema.jobs,
        customerName: schema.customers.name,
        customerEmail: schema.customers.email,
        customerPhone: schema.customers.phone,
        customerMobile: schema.customers.mobile,
      })
      .from(schema.jobs)
      .leftJoin(schema.customers, eq(schema.jobs.customerId, schema.customers.id))
      .where(whereClause)
      .orderBy(desc(schema.jobs.createdAt))
      .limit(limit)
      .offset(offset);
    
    // Transform results to include customer data in job object
    const jobs = results.map(row => ({
      ...row.job,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone || row.customerMobile,
    }));
    
    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.jobs)
      .where(whereClause);
    
    const total = Number(totalResult[0]?.count) || 0;
    
    return { jobs, total };
  }

  async clearAllJobs(): Promise<number> {
    const result = await db.delete(schema.jobs);
    return result.rowCount || 0;
  }

  async deleteJob(id: string): Promise<boolean> {
    try {
      // Clear every table that FK-references jobs.id before deleting the job
      await db.delete(schema.jobDiaryEntries).where(eq(schema.jobDiaryEntries.jobId, id));
      await db.delete(schema.proposals).where(eq(schema.proposals.jobId, id));
      await db.delete(schema.jobStaffAssignments).where(eq(schema.jobStaffAssignments.jobId, id));
      await db.delete(schema.communications).where(eq(schema.communications.jobId, id));
      await db.delete(schema.activities).where(eq(schema.activities.jobId, id));
      await db.delete(schema.callRecords).where(eq(schema.callRecords.jobId, id));
      await db.delete(schema.dailyJobNotes).where(eq(schema.dailyJobNotes.jobId, id));
      await db.delete(schema.equipmentCheckouts).where(eq(schema.equipmentCheckouts.jobId, id));
      await db.delete(schema.generatedDocuments).where(eq(schema.generatedDocuments.jobId, id));
      await db.delete(schema.inventoryTransactions).where(eq(schema.inventoryTransactions.jobId, id));
      await db.delete(schema.invoices).where(eq(schema.invoices.jobId, id));
      await db.delete(schema.jhaAssessments).where(eq(schema.jhaAssessments.jobId, id));
      await db.delete(schema.photos).where(eq(schema.photos.jobId, id));
      await db.delete(schema.quotes).where(eq(schema.quotes.jobId, id));
      await db.delete(schema.reviewRequests).where(eq(schema.reviewRequests.jobId, id));
      await db.delete(schema.reviewSubmissions).where(eq(schema.reviewSubmissions.jobId, id));
      await db.delete(schema.reviews).where(eq(schema.reviews.jobId, id));
      await db.delete(schema.riskAssessments).where(eq(schema.riskAssessments.jobId, id));
      await db.delete(schema.safetyIncidents).where(eq(schema.safetyIncidents.jobId, id));
      await db.delete(schema.treeMarkers).where(eq(schema.treeMarkers.jobId, id));

      const result = await db.delete(schema.jobs).where(eq(schema.jobs.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting job:', error);
      return false;
    }
  }

  async bulkDeleteJobs(jobIds: string[]): Promise<{deleted: number; failed: number; errors: string[]}> {
    let deleted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const jobId of jobIds) {
      try {
        const success = await this.deleteJob(jobId);
        if (success) {
          deleted++;
        } else {
          failed++;
          errors.push(`Failed to delete job with ID: ${jobId}`);
        }
      } catch (error) {
        failed++;
        errors.push(`Error deleting job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { deleted, failed, errors };
  }

  // ========================================
  // STAFF TIME TRACKING METHODS
  // ========================================
  
  async getJobStaffTimeEntries(jobId: string): Promise<Array<{
    employeeId: string;
    hours: number;
    rate: number;
    date?: string;
  }>> {
    const job = await this.getJob(jobId);
    if (!job || !job.staffTimeEntries) return [];
    
    // staffTimeEntries is stored as JSON in the jobs table
    const entries = job.staffTimeEntries as any[];
    return entries || [];
  }
  
  async addStaffTimeEntry(jobId: string, entry: {
    employeeId: string;
    hours: number;
    rate: number;
    costRate?: number;
    date?: string;
  }): Promise<Job> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');
    
    // Get existing entries or initialize empty array
    const existingEntries = (job.staffTimeEntries as any[]) || [];
    
    // Add the new entry with a unique ID
    const entryWithId = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    };
    const updatedEntries = [...existingEntries, entryWithId];
    
    // Update the job with new entries
    const [updatedJob] = await db.update(schema.jobs)
      .set({ 
        staffTimeEntries: updatedEntries,
        updatedAt: new Date()
      })
      .where(eq(schema.jobs.id, jobId))
      .returning();
    
    return updatedJob;
  }
  
  async updateJobStaffTime(jobId: string, staffTimeEntries: Array<{
    employeeId: string;
    hours: number;
    rate: number;
    date?: string;
  }>): Promise<Job> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');
    
    // Replace all entries with the new array
    const [updatedJob] = await db.update(schema.jobs)
      .set({ 
        staffTimeEntries: staffTimeEntries,
        updatedAt: new Date()
      })
      .where(eq(schema.jobs.id, jobId))
      .returning();
    
    return updatedJob;
  }
  
  async removeStaffTimeEntry(jobId: string, employeeId: string, date?: string): Promise<Job> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error('Job not found');
    
    const existingEntries = (job.staffTimeEntries as any[]) || [];
    
    // Filter out the matching entry
    const updatedEntries = existingEntries.filter((entry: any) => {
      if (date) {
        // If date provided, match both employeeId and date
        return !(entry.employeeId === employeeId && entry.date === date);
      } else {
        // Otherwise just match employeeId
        return entry.employeeId !== employeeId;
      }
    });
    
    const [updatedJob] = await db.update(schema.jobs)
      .set({ 
        staffTimeEntries: updatedEntries,
        updatedAt: new Date()
      })
      .where(eq(schema.jobs.id, jobId))
      .returning();
    
    return updatedJob;
  }

  async createJobFromCall(params: {
    callId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    customerAddress?: string;
    jobTitle: string;
    jobDescription?: string;
    jobAddress?: string;
    call: Call;
  }): Promise<{ job: Job; customer: Customer; call: Call }> {
    // Sequential because the neon-http driver does not support db.transaction().
    // Each step is independently safe to retry — a partial failure leaves the
    // call attached to whatever it was last linked to, and the next call to
    // this method will re-find the customer (idempotent on phone match) and
    // create a fresh job.
    let customer;
    if (params.customerPhone) {
      const normalizedPhone = this.normalizePhone(params.customerPhone);
      if (normalizedPhone) {
        const [existingCustomer] = await db
          .select()
          .from(schema.customers)
          .where(eq(schema.customers.normalizedPhone, normalizedPhone))
          .limit(1);
        customer = existingCustomer;
      }
    }

    if (!customer) {
      const [newCustomer] = await db.insert(schema.customers).values(withTenant({
        name: params.customerName,
        phone: params.customerPhone || null,
        normalizedPhone: this.normalizePhone(params.customerPhone),
        email: params.customerEmail || null,
        address: params.customerAddress || null,
        source: 'phone',
      })).returning();
      customer = newCustomer;
    }

    await db.update(schema.calls)
      .set({ customerId: customer.id })
      .where(eq(schema.calls.id, params.callId));

    const [job] = await db.insert(schema.jobs).values(withTenant({
      customerId: customer.id,
      title: params.jobTitle,
      description: params.jobDescription || `Job created from call on ${new Date().toLocaleString()}`,
      address: params.jobAddress || params.customerAddress || customer.address || 'Address not specified',
      leadSource: 'phone',
      status: 'quote',
    })).returning();

    const [updatedCall2] = await db.update(schema.calls)
      .set({ jobId: job.id })
      .where(eq(schema.calls.id, params.callId))
      .returning();

    const diaryContent = params.call.transcript
      ? `Call recording and transcript from ${params.call.phoneNumber}\n\nTranscript:\n${params.call.transcript}`
      : `Call recording from ${params.call.phoneNumber}`;

    await db.insert(schema.jobDiaryEntries).values(withTenant({
      jobId: job.id,
      entryType: 'note',
      title: `Phone Call - ${new Date(params.call.createdAt).toLocaleString()}`,
      description: diaryContent,
      authorName: 'Mobile App',
      authorRole: 'system',
    }));

    return {
      job,
      customer,
      call: updatedCall2
    };
  }

  // Complete database wipe methods for Option A
  async clearAllQuotes(): Promise<number> {
    const result = await db.delete(schema.quotes);
    return result.rowCount || 0;
  }

  async clearAllLeads(): Promise<number> {
    const result = await db.delete(schema.leads);
    return result.rowCount || 0;
  }

  async clearAllCommunications(): Promise<number> {
    const result = await db.delete(schema.communications);
    return result.rowCount || 0;
  }

  async clearAllActivities(): Promise<number> {
    const result = await db.delete(schema.activities);
    return result.rowCount || 0;
  }

  async clearAllJobDiaryEntries(): Promise<number> {
    const result = await db.delete(schema.jobDiaryEntries);
    return result.rowCount || 0;
  }

  async clearAllProposals(): Promise<number> {
    // Clear related tables first (foreign key constraints)
    await db.delete(schema.proposalLineItemChoices);
    await db.delete(schema.proposalLineItems);
    await db.delete(schema.proposalSections);
    const result = await db.delete(schema.proposals);
    return result.rowCount || 0;
  }

  async clearAllInvoices(): Promise<number> {
    const result = await db.delete(schema.invoices);
    return result.rowCount || 0;
  }

  async clearAllPhotos(): Promise<number> {
    const result = await db.delete(schema.photos);
    return result.rowCount || 0;
  }

  async clearAllCalls(): Promise<number> {
    const result = await db.delete(schema.calls);
    return result.rowCount || 0;
  }


  // Complete database wipe - Option A implementation
  async completeDataWipe(): Promise<{ [key: string]: number }> {
    const results = {
      proposals: 0,
      photos: 0,
      invoices: 0,
      calls: 0,
      jobDiaryEntries: 0,
      activities: 0,
      communications: 0,
      jobs: 0,
      quotes: 0,
      leads: 0,
      customers: 0
    };

    try {
      console.log('🧹 Starting complete database wipe (Option A)...');
      
      // Clear business data in dependency order (foreign key constraints)

      // Clear related data in dependency order (foreign key constraints)
      results.proposals = await this.clearAllProposals();
      results.photos = await this.clearAllPhotos();
      results.invoices = await this.clearAllInvoices();
      results.calls = await this.clearAllCalls();
      results.jobDiaryEntries = await this.clearAllJobDiaryEntries();
      results.activities = await this.clearAllActivities();
      results.communications = await this.clearAllCommunications();
      
      // Clear main business data
      results.jobs = await this.clearAllJobs();
      results.quotes = await this.clearAllQuotes();
      results.leads = await this.clearAllLeads();
      results.customers = await this.clearAllCustomers();

      console.log('🎉 Complete database wipe finished successfully:', results);
      return results;
    } catch (error) {
      console.error('❌ Error during complete database wipe:', error);
      throw error;
    }
  }

  // Sequential Job Number Generation
  private static jobNumberCounter: number = 3312;
  
  async getNextJobNumber(): Promise<string> {
    try {
      // Job numbers are GLOBALLY unique (one sequence across all tenants), so the max
      // MUST be read from the owner connection. Reading via the RLS-scoped `db` returns
      // only the current tenant's max, so a new tenant would generate low numbers that
      // collide with another tenant's existing job numbers → unique-constraint violation
      // → "Error creating job". Use ownerDb (BYPASSRLS) for the global max.
      const result = await ownerDb.select({
        maxJobNumber: sql<number>`CAST(MAX(CAST(${schema.jobs.jobNumber} AS INTEGER)) AS INTEGER)`
      })
      .from(schema.jobs)
      .where(sql`${schema.jobs.jobNumber} ~ '^[0-9]+$'`); // Only numeric job numbers
      
      if (result.length > 0 && result[0].maxJobNumber !== null) {
        const maxJobNumber = result[0].maxJobNumber;
        // Ensure our counter is at least as high as the maximum in database
        DatabaseStorage.jobNumberCounter = Math.max(DatabaseStorage.jobNumberCounter, maxJobNumber + 1);
      }
      
      const nextNumber = DatabaseStorage.jobNumberCounter;
      DatabaseStorage.jobNumberCounter++;
      return nextNumber.toString();
    } catch (error) {
      // Fallback to counter-only approach if database query fails
      console.error('Database query failed for job number, using fallback:', error);
      const nextNumber = DatabaseStorage.jobNumberCounter;
      DatabaseStorage.jobNumberCounter++;
      return nextNumber.toString();
    }
  }

  // Sequential Quote Number Generation
  private static quoteNumberCounter: number = 1000;
  
  async getNextQuoteNumber(): Promise<string> {
    try {
      // Quote numbers are globally unique too — read the max from the owner connection,
      // not the RLS-scoped `db`, so new tenants don't generate colliding quote numbers.
      const result = await ownerDb.select({
        maxQuoteNumber: sql<number>`CAST(MAX(CAST(${schema.quotes.quoteNumber} AS INTEGER)) AS INTEGER)`
      })
      .from(schema.quotes)
      .where(sql`${schema.quotes.quoteNumber} ~ '^[0-9]+$'`); // Only numeric quote numbers
      
      if (result.length > 0 && result[0].maxQuoteNumber !== null) {
        const maxQuoteNumber = result[0].maxQuoteNumber;
        // Ensure our counter is at least as high as the maximum in database
        DatabaseStorage.quoteNumberCounter = Math.max(DatabaseStorage.quoteNumberCounter, maxQuoteNumber + 1);
      }
      
      const nextNumber = DatabaseStorage.quoteNumberCounter;
      DatabaseStorage.quoteNumberCounter++;
      return nextNumber.toString();
    } catch (error) {
      // Fallback to counter-only approach if database query fails
      console.error('Database query failed for quote number, using fallback:', error);
      const nextNumber = DatabaseStorage.quoteNumberCounter;
      DatabaseStorage.quoteNumberCounter++;
      return nextNumber.toString();
    }
  }

  // ========================================
  // JOB TEMPLATE MANAGEMENT
  // ========================================
  
  async createJobTemplate(template: InsertJobTemplate): Promise<JobTemplate> {
    const [newTemplate] = await db.insert(schema.jobTemplates).values(withTenant(template)).returning();
    return newTemplate;
  }

  async getJobTemplate(id: string): Promise<JobTemplate | undefined> {
    const [template] = await db.select().from(schema.jobTemplates).where(eq(schema.jobTemplates.id, id));
    return template || undefined;
  }

  async updateJobTemplate(id: string, updates: UpdateJobTemplate): Promise<JobTemplate> {
    const [template] = await db.update(schema.jobTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.jobTemplates.id, id))
      .returning();
    return template;
  }

  async getAllJobTemplates(): Promise<JobTemplate[]> {
    return await db.select().from(schema.jobTemplates).orderBy(desc(schema.jobTemplates.createdAt));
  }

  async getJobTemplatesByCategory(category: string): Promise<JobTemplate[]> {
    return await db.select().from(schema.jobTemplates)
      .where(eq(schema.jobTemplates.category, category))
      .orderBy(desc(schema.jobTemplates.createdAt));
  }

  async deleteJobTemplate(id: string): Promise<void> {
    await db.delete(schema.jobTemplates).where(eq(schema.jobTemplates.id, id));
  }

  // ========================================
  // LEAD MANAGEMENT
  // ========================================
  
  async createPipelineLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(schema.leads).values(withTenant(lead)).returning();
    return newLead;
  }

  async getPipelineLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, id));
    return lead || undefined;
  }

  async updatePipelineLead(id: string, updates: Partial<InsertLead>): Promise<Lead> {
    const [lead] = await db.update(schema.leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.leads.id, id))
      .returning();
    return lead;
  }

  async getAllPipelineLeads(): Promise<Lead[]> {
    return await db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt));
  }

  async getPipelineLeadsByStatus(status: string): Promise<Lead[]> {
    return await db.select().from(schema.leads)
      .where(eq(schema.leads.status, status))
      .orderBy(desc(schema.leads.createdAt));
  }

  // ========================================
  // STUB IMPLEMENTATIONS 
  // All other methods return empty arrays or throw "not implemented" errors
  // ========================================
  
  // Legacy lead submissions
  async saveLead(lead: InsertLeadSubmission): Promise<LeadSubmission> {
    throw new Error("Legacy lead submissions not implemented in database storage");
  }
  async getLeads(fromDate?: Date, toDate?: Date): Promise<LeadSubmission[]> { return []; }
  async getLeadsByPagePath(): Promise<{ pagePath: string; count: number }[]> { return []; }

  // Communication preferences
  async createCommunicationPreferences(preferences: InsertCommunicationPreferences): Promise<CommunicationPreferences> { throw new Error("Not implemented"); }
  async getCommunicationPreferences(customerId: string): Promise<CommunicationPreferences | undefined> { return undefined; }
  async updateCommunicationPreferences(customerId: string, updates: Partial<InsertCommunicationPreferences>): Promise<CommunicationPreferences> { throw new Error("Not implemented"); }
  async deleteCommunicationPreferences(customerId: string): Promise<boolean> { return false; }

  // Calls
  async createCall(call: InsertCall): Promise<Call> {
    const [createdCall] = await db.insert(schema.calls).values(withTenant(call)).returning();
    return createdCall;
  }
  
  async getCall(id: string): Promise<Call | undefined> {
    const calls = await db.select().from(schema.calls).where(eq(schema.calls.id, id));
    return calls[0];
  }
  
  async updateCall(id: string, updates: Partial<InsertCall>): Promise<Call> {
    const [updatedCall] = await db.update(schema.calls)
      .set(updates)
      .where(eq(schema.calls.id, id))
      .returning();
    return updatedCall;
  }
  
  async getCallsByCustomer(customerId: string): Promise<Call[]> {
    return await db.select().from(schema.calls).where(eq(schema.calls.customerId, customerId)).orderBy(desc(schema.calls.createdAt));
  }
  
  async getCallsByJobId(jobId: string): Promise<Call[]> {
    return await db.select().from(schema.calls).where(eq(schema.calls.jobId, jobId)).orderBy(desc(schema.calls.createdAt));
  }
  
  async getCallsByLead(leadId: string): Promise<Call[]> {
    return await db.select().from(schema.calls).where(eq(schema.calls.leadId, leadId)).orderBy(desc(schema.calls.createdAt));
  }

  async getAllCalls(limit: number = 100): Promise<Call[]> {
    return await db.select().from(schema.calls).orderBy(desc(schema.calls.createdAt)).limit(limit);
  }

  async deleteCall(id: string): Promise<boolean> {
    const deleted = await db.delete(schema.calls)
      .where(eq(schema.calls.id, id))
      .returning();
    return deleted.length > 0;
  }

  // API Keys
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [createdKey] = await db.insert(schema.apiKeys).values(withTenant(apiKey)).returning();
    return createdKey;
  }
  
  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const keys = await db.select().from(schema.apiKeys)
      .where(eq(schema.apiKeys.keyHash, keyHash));
    return keys[0];
  }
  
  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db.update(schema.apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.apiKeys.id, id));
  }
  
  async getAllApiKeys(): Promise<ApiKey[]> {
    return await db.select().from(schema.apiKeys);
  }
  
  async deleteApiKey(id: string): Promise<boolean> {
    const deleted = await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, id)).returning();
    return deleted.length > 0;
  }

  // Quotes
  async createQuote(quote: InsertQuote): Promise<Quote> {
    const [createdQuote] = await db.insert(schema.quotes).values(withTenant(quote)).returning();
    return createdQuote;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const quotes = await db.select().from(schema.quotes).where(eq(schema.quotes.id, id));
    return quotes[0];
  }

  async updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote> {
    const [updatedQuote] = await db.update(schema.quotes)
      .set(updates)
      .where(eq(schema.quotes.id, id))
      .returning();
    return updatedQuote;
  }

  async getQuotesByCustomer(customerId: string): Promise<Quote[]> {
    return await db.select().from(schema.quotes)
      .where(eq(schema.quotes.customerId, customerId))
      .orderBy(desc(schema.quotes.createdAt));
  }

  async getQuotesByLead(leadId: string): Promise<Quote[]> {
    return await db.select().from(schema.quotes)
      .where(eq(schema.quotes.leadId, leadId))
      .orderBy(desc(schema.quotes.createdAt));
  }

  async getAllQuotes(): Promise<Quote[]> {
    return await db.select().from(schema.quotes)
      .orderBy(desc(schema.quotes.createdAt));
  }

  // Job diary entries
  async createJobDiaryEntry(entry: InsertJobDiaryEntry): Promise<JobDiaryEntry> {
    const [diaryEntry] = await db.insert(schema.jobDiaryEntries).values(withTenant(entry)).returning();
    return diaryEntry;
  }
  async getJobDiaryEntry(id: string): Promise<JobDiaryEntry | undefined> { 
    const [entry] = await db.select().from(schema.jobDiaryEntries).where(eq(schema.jobDiaryEntries.id, id));
    return entry;
  }
  async updateJobDiaryEntry(id: string, updates: Partial<InsertJobDiaryEntry>): Promise<JobDiaryEntry> { 
    const [updated] = await db.update(schema.jobDiaryEntries)
      .set(updates)
      .where(eq(schema.jobDiaryEntries.id, id))
      .returning();
    if (!updated) {
      throw new Error('Diary entry not found');
    }
    return updated;
  }
  async deleteJobDiaryEntry(id: string): Promise<boolean> {
    // photos.jobDiaryEntryId and callRecords.jobDiaryEntryId reference this row
    // without ON DELETE CASCADE, so the parent delete fails with a FK violation
    // whenever a child exists (e.g. before/after composites insert a photos
    // row at upload time). Null the references first so the parent delete
    // succeeds; both children are independent records and survive without it.
    // (Sequential rather than transactional because the neon-http driver does
    // not support db.transaction(); a partial failure leaves orphan NULL refs,
    // which is the desired end state anyway.)
    await db.update(schema.photos)
      .set({ jobDiaryEntryId: null })
      .where(eq(schema.photos.jobDiaryEntryId, id));
    await db.update(schema.callRecords)
      .set({ jobDiaryEntryId: null })
      .where(eq(schema.callRecords.jobDiaryEntryId, id));
    const result = await db.delete(schema.jobDiaryEntries)
      .where(eq(schema.jobDiaryEntries.id, id))
      .returning();
    return result.length > 0;
  }
  async getJobDiaryEntriesByJob(jobId: string, limit?: number): Promise<JobDiaryEntry[]> {
    const base = db.select().from(schema.jobDiaryEntries)
      .where(eq(schema.jobDiaryEntries.jobId, jobId))
      .orderBy(desc(schema.jobDiaryEntries.createdAt));
    if (typeof limit === 'number' && limit > 0) {
      return await base.limit(limit);
    }
    return await base;
  }
  async getJobDiaryEntriesByType(jobId: string, entryType: string): Promise<JobDiaryEntry[]> { return []; }
  async getAllJobDiaryEntries(): Promise<JobDiaryEntry[]> { return []; }

  // Expense and Margin Tracking implementations
  async updateJobGrossMargin(jobId: string, grossMarginData: any): Promise<Job> {
    const [result] = await db.update(schema.jobs)
      .set({
        grossMargin: grossMarginData.grossMargin?.toString(),
        grossMarginCalculated: grossMarginData.grossMarginCalculated ?? true,
      })
      .where(eq(schema.jobs.id, jobId))
      .returning();
    return result;
  }

  async calculateAndUpdateGrossMargin(jobId: string): Promise<Job> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error("Job not found");

    // Ex-GST revenue compared against ex-GST cost fields (otherwise the
    // margin gets inflated by the GST component, which is owed to IRD,
    // not revenue). jobRevenueExGst pulls from lineItems first so jobs
    // sourced from accepted proposals (lineItems-only, no rolled-up
    // subtotal/totalAmount yet) aren't treated as $0 revenue, which would
    // make their gross-margin readout report 0%.
    const totalRevenue = jobRevenueExGst(job);

    const laborCosts = parseFloat(job.actualLaborCosts?.toString() || job.laborCosts?.toString() || "0");
    const materialsCosts = parseFloat(job.actualMaterialsCosts?.toString() || job.materialsCosts?.toString() || "0");
    const equipmentCosts = parseFloat(job.equipmentCosts?.toString() || "0");
    const subcontractorCosts = parseFloat(job.subcontractorCosts?.toString() || "0");
    const otherCosts = parseFloat(job.otherCosts?.toString() || "0");

    const totalCosts = laborCosts + materialsCosts + equipmentCosts + subcontractorCosts + otherCosts;
    const grossProfit = totalRevenue - totalCosts;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    
    const [result] = await db.update(schema.jobs)
      .set({
        grossMargin: grossMargin.toFixed(2),
        grossMarginCalculated: true,
      })
      .where(eq(schema.jobs.id, jobId))
      .returning();
    return result;
  }

  async validateGrossMarginComplete(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) return false;
    return job.grossMarginCalculated === true;
  }

  async updateJobExpenses(jobId: string, expenseData: any): Promise<Job> {
    const updates: any = {};
    if (expenseData.actualLaborCosts !== undefined) updates.actualLaborCosts = expenseData.actualLaborCosts.toString();
    if (expenseData.actualMaterialsCosts !== undefined) updates.actualMaterialsCosts = expenseData.actualMaterialsCosts.toString();
    if (expenseData.equipmentCosts !== undefined) updates.equipmentCosts = expenseData.equipmentCosts.toString();
    if (expenseData.subcontractorCosts !== undefined) updates.subcontractorCosts = expenseData.subcontractorCosts.toString();
    if (expenseData.permitCosts !== undefined) updates.permitCosts = expenseData.permitCosts.toString();
    if (expenseData.travelCosts !== undefined) updates.travelCosts = expenseData.travelCosts.toString();
    if (expenseData.disposalCosts !== undefined) updates.disposalCosts = expenseData.disposalCosts.toString();
    if (expenseData.miscExpenses !== undefined) updates.miscExpenses = expenseData.miscExpenses.toString();
    if (expenseData.additionalCosts !== undefined) updates.otherCosts = expenseData.additionalCosts.toString();
    
    const [result] = await db.update(schema.jobs)
      .set(updates)
      .where(eq(schema.jobs.id, jobId))
      .returning();
    return result;
  }

  async updateExpenseCompletionStatus(jobId: string, completionData: any): Promise<Job> {
    const updates: any = {};
    if (completionData.laborCostsComplete !== undefined) updates.laborCostsComplete = completionData.laborCostsComplete;
    if (completionData.materialsCostsComplete !== undefined) updates.materialsCostsComplete = completionData.materialsCostsComplete;
    if (completionData.equipmentCostsComplete !== undefined) updates.equipmentCostsComplete = completionData.equipmentCostsComplete;
    if (completionData.subcontractorCostsComplete !== undefined) updates.subcontractorCostsComplete = completionData.subcontractorCostsComplete;
    if (completionData.otherExpensesComplete !== undefined) updates.otherExpensesComplete = completionData.otherExpensesComplete;
    
    const [result] = await db.update(schema.jobs)
      .set(updates)
      .where(eq(schema.jobs.id, jobId))
      .returning();
    return result;
  }
  // Staff time tracking methods - delegated to implementations at lines 1694-1782
  async clearJobStaffTimeEntries(jobId: string): Promise<void> {
    // Clear all staff time entries for a job
    const job = await this.getJob(jobId);
    if (job) {
      await db.update(schema.jobs)
        .set({ staffTimeEntries: [] })
        .where(eq(schema.jobs.id, jobId));
    }
  }
  async deleteStaffTimeEntry(entryId: string): Promise<void> {
    // Delete a specific time entry - this is a no-op in the current schema since entries are stored in job JSON
    console.log('deleteStaffTimeEntry called for:', entryId);
  }
  
  async sendJobToXero(jobId: string, xeroInvoiceId: string): Promise<Job> {
    const [updatedJob] = await db.update(schema.jobs)
      .set({
        xeroInvoiceId: xeroInvoiceId,
        xeroStatus: 'sent',
        sentToXeroDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.jobs.id, jobId))
      .returning();
    return updatedJob;
  }
  
  async createActivity(activity: InsertActivity): Promise<Activity> { throw new Error("Not implemented"); }
  async getActivity(id: string): Promise<Activity | undefined> { return undefined; }
  async getActivitiesByCustomer(customerId: string): Promise<Activity[]> { return []; }
  async getActivitiesByLead(leadId: string): Promise<Activity[]> { return []; }
  async getActivitiesByJob(jobId: string): Promise<Activity[]> { return []; }
  async getAllActivities(limit?: number): Promise<Activity[]> { return []; }
  async createReview(review: InsertReview): Promise<Review> {
    const [row] = await db.insert(schema.reviews).values(withTenant(review)).returning();
    return row;
  }
  async getReview(id: string): Promise<Review | undefined> {
    const [row] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, id));
    return row;
  }
  async updateReview(id: string, updates: Partial<InsertReview>): Promise<Review> {
    const [row] = await db.update(schema.reviews).set(updates).where(eq(schema.reviews.id, id)).returning();
    return row;
  }
  async deleteReview(id: string): Promise<void> {
    await db.delete(schema.reviews).where(eq(schema.reviews.id, id));
  }
  async getReviewsByCustomer(customerId: string): Promise<Review[]> {
    return await db.select().from(schema.reviews).where(eq(schema.reviews.customerId, customerId));
  }
  async getAllReviews(): Promise<Review[]> {
    return await db.select().from(schema.reviews);
  }
  async createCampaign(campaign: InsertCampaign): Promise<Campaign> { throw new Error("Not implemented"); }
  async getCampaign(id: string): Promise<Campaign | undefined> { return undefined; }
  async updateCampaign(id: string, updates: Partial<InsertCampaign>): Promise<Campaign> { throw new Error("Not implemented"); }
  async getAllCampaigns(): Promise<Campaign[]> { return []; }
  async createSocialPlan(plan: InsertSocialPlan): Promise<SocialPlan> { throw new Error("Not implemented"); }
  async getSocialPlan(id: string): Promise<SocialPlan | undefined> { return undefined; }
  async updateSocialPlan(id: string, updates: Partial<InsertSocialPlan>): Promise<SocialPlan> { throw new Error("Not implemented"); }
  async getAllSocialPlans(): Promise<SocialPlan[]> { return []; }
  async getSocialPlansByStatus(status: string): Promise<SocialPlan[]> { return []; }
  async createCompetitorSignal(signal: InsertCompetitorSignal): Promise<CompetitorSignal> { throw new Error("Not implemented"); }
  async getCompetitorSignal(id: string): Promise<CompetitorSignal | undefined> { return undefined; }
  async updateCompetitorSignal(id: string, updates: Partial<InsertCompetitorSignal>): Promise<CompetitorSignal> { throw new Error("Not implemented"); }
  async getAllCompetitorSignals(): Promise<CompetitorSignal[]> { return []; }
  async getCompetitorSignalsByCompetitor(competitorName: string): Promise<CompetitorSignal[]> { return []; }
  async createPriceRule(rule: InsertPriceRule): Promise<PriceRule> { throw new Error("Not implemented"); }
  async getPriceRule(id: string): Promise<PriceRule | undefined> { return undefined; }
  async updatePriceRule(id: string, updates: Partial<InsertPriceRule>): Promise<PriceRule> { throw new Error("Not implemented"); }
  async getAllPriceRules(): Promise<PriceRule[]> { return []; }
  async getPriceRulesByService(serviceName: string): Promise<PriceRule[]> { return []; }

  async getDashboardStats(fromDate?: Date, toDate?: Date): Promise<any> {
    // Use the slim analytics fetch — this method aggregates over jobs but
    // doesn't need customer name/phone or diary-reply timestamps. Pass the
    // date range so SQL filters at the DB level instead of pulling 3k+ jobs
    // and discarding most in JS. All six fetches are independent — run them
    // in parallel so the endpoint is bounded by the slowest single query
    // rather than the sum.
    const [allJobs, allCustomers, allLeads, allQuotes, allProposals, allInvoices] = await Promise.all([
      this.getJobsForAnalytics({ fromDate, toDate }),
      this.getAllCustomers(),
      this.getLeads(),
      this.getAllQuotes(),
      this.getAllProposals(),
      this.getAllInvoices(),
    ]);
    
    // Filter leads by date if provided
    let filteredLeads = allLeads;
    if (fromDate || toDate) {
      filteredLeads = allLeads.filter(lead => {
        if (!lead.createdAt) return false;
        const leadDate = new Date(lead.createdAt);
        if (fromDate && leadDate < fromDate) return false;
        if (toDate && leadDate > toDate) return false;
        return true;
      });
    }
    
    // Filter jobs by creation date for job count
    let filteredJobs = allJobs;
    if (fromDate || toDate) {
      filteredJobs = allJobs.filter(job => {
        if (!job.createdAt) return false;
        const jobDate = new Date(job.createdAt);
        if (fromDate && jobDate < fromDate) return false;
        if (toDate && jobDate > toDate) return false;
        return true;
      });
    }
    
    // Filter quotes and proposals by date (for Avg Quote Value)
    let filteredQuotes = allQuotes.filter(q => q.status !== 'draft');
    let filteredProposals = allProposals.filter(p => p.status !== 'draft');
    if (fromDate || toDate) {
      filteredQuotes = filteredQuotes.filter(q => {
        if (!q.createdAt) return false;
        const quoteDate = new Date(q.createdAt);
        if (fromDate && quoteDate < fromDate) return false;
        if (toDate && quoteDate > toDate) return false;
        return true;
      });
      filteredProposals = filteredProposals.filter(p => {
        if (!p.createdAt) return false;
        const proposalDate = new Date(p.createdAt);
        if (fromDate && proposalDate < fromDate) return false;
        if (toDate && proposalDate > toDate) return false;
        return true;
      });
    }
    
    // Calculate average quote value from actual quotes and proposals sent
    let totalQuoteValue = 0;
    let quotesWithValue = 0;
    
    for (const quote of filteredQuotes) {
      const quoteValue = parseFloat(quote.totalAmount?.toString() || '0');
      if (quoteValue > 0) {
        totalQuoteValue += quoteValue;
        quotesWithValue++;
      }
    }
    
    for (const proposal of filteredProposals) {
      const proposalValue = parseFloat(proposal.totalAmount?.toString() || '0');
      if (proposalValue > 0) {
        totalQuoteValue += proposalValue;
        quotesWithValue++;
      }
    }
    
    const averageQuoteValue = quotesWithValue > 0 ? totalQuoteValue / quotesWithValue : 0;
    
    // INVOICE-FIRST: Revenue for the period = invoices whose issueDate falls in the window.
    // This ensures the Revenue card always matches "what was invoiced this week/month".
    const periodInvoices = allInvoices.filter(inv => {
      if (inv.status === 'cancelled' || !inv.jobId) return false;
      if (!fromDate && !toDate) return true;
      const anchor = inv.issueDate ? new Date(inv.issueDate) :
                     inv.createdAt ? new Date(inv.createdAt) : null;
      if (!anchor) return false;
      if (fromDate && anchor < fromDate) return false;
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setDate(endOfDay.getDate() + 1);
        if (anchor >= endOfDay) return false;
      }
      return true;
    });
    const periodInvoiceJobIds = new Set(periodInvoices.map(inv => inv.jobId!));
    let completedJobsForRevenue = allJobs.filter(job => periodInvoiceJobIds.has(job.id));
    
    // Build a set of completed job IDs for the period
    const completedJobIds = new Set(completedJobsForRevenue.map(job => job.id));
    
    // Sum invoice amounts directly from the period invoices (already date-filtered above).
    // Internal metrics show ex-GST per business rule. invoice.amount has historically
    // held inc-GST on some rows and ex-GST on others — invoiceRevenueExGst() prefers
    // the always-ex-GST items[].amount sum and only falls back to amount/1.15 for
    // rows without items.
    let totalRevenue = 0;
    for (const inv of periodInvoices) {
      totalRevenue += invoiceRevenueExGst(inv);
    }
    const completedJobs = filteredJobs.filter(job => job.status === 'completed' || job.status === 'invoiced');
    
    // Still track invoices for the count display
    let filteredInvoices = allInvoices.filter(inv => inv.status !== 'cancelled');
    if (fromDate || toDate) {
      filteredInvoices = filteredInvoices.filter(inv => {
        if (!inv.issueDate) return false;
        const invoiceDate = new Date(inv.issueDate);
        if (fromDate && invoiceDate < fromDate) return false;
        if (toDate && invoiceDate > toDate) return false;
        return true;
      });
    }
    const leadsCount = filteredLeads.length;
    
    // For customer count and retention, we use all customers (not filtered by date)
    const customersCount = allCustomers.length;
    
    // Exclude archived jobs from total count
    const activeJobs = filteredJobs.filter(job => job.status !== 'archived');
    
    // Conversion rate: (completed jobs / total leads) * 100
    const conversionRate = leadsCount > 0 ? (completedJobs.length / leadsCount) * 100 : 0;
    
    // Calculate customer retention (repeat customers) - exclude archived jobs
    const customerJobCounts = new Map<string, number>();
    allJobs.filter(job => job.status !== 'archived').forEach(job => {
      if (job.customerId) {
        customerJobCounts.set(job.customerId, (customerJobCounts.get(job.customerId) || 0) + 1);
      }
    });
    
    const repeatCustomers = Array.from(customerJobCounts.values()).filter(count => count > 1).length;
    const customerRetention = customersCount > 0 
      ? Math.round((repeatCustomers / customersCount) * 100) 
      : 0;
    
    // Calculate returning customer % for COMPLETED jobs in the selected timeframe
    // A "returning customer" is one who had a job BEFORE the start of this period
    let returningCustomerJobCount = 0;
    // Only use completed jobs with customers, filtered by completion date
    const completedJobsInPeriod = completedJobsForRevenue.filter(job => job.customerId);
    
    if (fromDate && completedJobsInPeriod.length > 0) {
      // Get all jobs that occurred BEFORE the start of the date range
      const jobsBeforePeriod = allJobs.filter(job => {
        if (!job.customerId || job.status === 'archived') return false;
        const jobDate = job.completedDate ? new Date(job.completedDate) :
                        job.scheduledDate ? new Date(job.scheduledDate) : 
                        job.createdAt ? new Date(job.createdAt) : null;
        return jobDate && jobDate < fromDate;
      });
      
      // Build a set of customer IDs who had jobs before this period
      const customersWithPriorJobs = new Set<string>();
      jobsBeforePeriod.forEach(job => {
        if (job.customerId) customersWithPriorJobs.add(job.customerId);
      });
      
      // Count how many completed jobs in current period are from returning customers
      returningCustomerJobCount = completedJobsInPeriod.filter(job => 
        customersWithPriorJobs.has(job.customerId!)
      ).length;
    }
    
    const returningCustomerPercentage = completedJobsInPeriod.length > 0
      ? Math.round((returningCustomerJobCount / completedJobsInPeriod.length) * 100)
      : 0;
    
    return {
      totalLeads: leadsCount,
      totalCustomers: customersCount,
      totalJobs: activeJobs.length,
      totalRevenue,
      invoicesCount: filteredInvoices.length,
      conversionRate: Math.round(conversionRate * 100) / 100,
      averageQuoteValue: Math.round(averageQuoteValue * 100) / 100,
      customerRetention,
      returningCustomerPercentage,
      missedCalls: 0,
      recentCalls: [],
      recentLeads: filteredLeads.slice(0, 5)
    };
  }

  async getRevenueStats(fromDate?: Date, toDate?: Date): Promise<any> {
    // INVOICE-FIRST APPROACH: Revenue is recognised when an invoice is issued.
    // We filter by invoice issueDate so that "This Week" revenue exactly matches
    // invoices sent this week — regardless of when the job was originally scheduled.
    // NOTE: jobs are fetched WITHOUT a createdAt filter because we need to look
    // up cost data for any job that has an invoice in the window, even if the
    // job itself was created earlier. The set is then narrowed to jobIdSet below.
    // Run the three fetches in parallel — they're independent.
    const [allJobs, allInvoices, allEmployees] = await Promise.all([
      this.getJobsForAnalytics(),
      this.getAllInvoices(),
      // Load employees so staff-time-entry COST aggregation can use the canonical
      // employee cost rate (employees.hourlyRate) rather than whatever number was
      // typed into entry.rate at creation — those can be charge-out rates that
      // would inflate the cost side of margin and depress profit unrealistically.
      this.getAllEmployees().catch(() => [] as any[]),
    ]);
    const employeeRateById = new Map<string, number>();
    for (const e of allEmployees as any[]) {
      const r = parseFloat((e.hourlyRate ?? '0').toString());
      if (!isNaN(r)) employeeRateById.set(e.id, r);
    }

    // Step 1: select invoices that fall in the requested date window.
    const activeInvoices = allInvoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      if (!inv.jobId) return false;
      if (!fromDate && !toDate) return true; // "all time" — include everything
      // Anchor on issueDate; fall back to createdAt so invoices without an issueDate still count.
      const anchor = inv.issueDate ? new Date(inv.issueDate) :
                     inv.createdAt ? new Date(inv.createdAt) : null;
      if (!anchor) return false;
      if (fromDate && anchor < fromDate) return false;
      // toDate is end-of-day inclusive: add 1 day so same-day invoices are not excluded.
      if (toDate) {
        const endOfDay = new Date(toDate);
        endOfDay.setDate(endOfDay.getDate() + 1);
        if (anchor >= endOfDay) return false;
      }
      return true;
    });

    // Step 2: build revenue and job-id maps from those invoices.
    // Internal metrics show ex-GST per business rule. See invoiceRevenueExGst()
    // for why we don't just divide invoice.amount by 1.15 (some invoices stored
    // amount as ex-GST, which would be double-stripped).
    const jobInvoiceMap = new Map<string, number>(); // jobId → total invoiced amount (ex-GST)
    for (const inv of activeInvoices) {
      const amount = invoiceRevenueExGst(inv);
      jobInvoiceMap.set(inv.jobId!, (jobInvoiceMap.get(inv.jobId!) || 0) + amount);
    }

    // Step 3: collect the matching jobs (for cost calculations).
    const jobIdSet = new Set(jobInvoiceMap.keys());
    const filteredJobs = allJobs.filter(job => jobIdSet.has(job.id));
    
    // Calculate totals for ALL jobs (for revenue/job count)
    let totalRevenue = 0;
    let totalCosts = 0;
    let jobsWithRevenue = 0;
    
    // Separate totals for jobs WITH profit tracking (for margin calculation)
    let marginRevenue = 0;
    let marginCosts = 0;
    let jobsWithProfitTracking = 0;
    
    for (const job of filteredJobs) {
      // Get revenue from invoice amount (instead of line items)
      const jobRevenue = jobInvoiceMap.get(job.id) || 0;
      totalRevenue += jobRevenue;
      
      // Count jobs that have revenue (invoiced)
      if (jobRevenue > 0) {
        jobsWithRevenue++;
      }
      
      // Calculate costs: line item costs + calculated labor cost + staff time entries + additional costs
      const itemCosts = (job.lineItems || []).reduce((sum: number, item: any) => {
        return sum + (item.totalCost || 0);
      }, 0);
      
      const calculatedLabor = parseFloat(job.calculatedLaborCost?.toString() || '0');
      const additionalLabor = parseFloat(job.laborCosts?.toString() || '0');
      const materialsCost = parseFloat(job.materialsCosts?.toString() || '0');
      const otherCost = parseFloat(job.otherCosts?.toString() || '0');
      
      // Include staff time entry costs. Use the employee's canonical cost
      // rate (employees.hourlyRate). entry.rate is only a last-resort fallback
      // because the user-entered rate on a time entry is sometimes a
      // charge-out figure rather than a true cost — we don't want that to
      // inflate the cost side of the margin calculation.
      const staffTimeEntries = (job.staffTimeEntries as any[]) || [];
      const staffTimeCost = staffTimeEntries.reduce((sum: number, entry: any) => {
        const hours = Number(entry.hours) || 0;
        const empRate = entry.employeeId ? employeeRateById.get(entry.employeeId) : undefined;
        const rate = Number(entry.costRate) || empRate || Number(entry.rate) || 0;
        return sum + (hours * rate);
      }, 0);
      
      // Include bulk expense fields
      const equipmentCosts = parseFloat(job.equipmentCosts?.toString() || '0');
      const subcontractorCosts = parseFloat(job.subcontractorCosts?.toString() || '0');
      const permitCosts = parseFloat(job.permitCosts?.toString() || '0');
      const travelCosts = parseFloat(job.travelCosts?.toString() || '0');
      const disposalCosts = parseFloat(job.disposalCosts?.toString() || '0');
      const miscExpenses = parseFloat(job.miscExpenses?.toString() || '0');
      const costOfGoods = parseFloat(job.costOfGoods?.toString() || '0');
      
      const jobCosts = itemCosts + calculatedLabor + staffTimeCost + additionalLabor + materialsCost + otherCost + equipmentCosts + subcontractorCosts + permitCosts + travelCosts + disposalCosts + miscExpenses + costOfGoods;
      totalCosts += jobCosts;
      
      // Only include in margin calculation if job has BOTH invoice revenue AND some cost data
      const hasCostData = itemCosts > 0 || calculatedLabor > 0 || staffTimeCost > 0 || additionalLabor > 0 || materialsCost > 0 || otherCost > 0 || equipmentCosts > 0 || subcontractorCosts > 0 || costOfGoods > 0;
      if (jobRevenue > 0 && hasCostData) {
        marginRevenue += jobRevenue;
        marginCosts += jobCosts;
        jobsWithProfitTracking++;
      }
    }
    
    // Calculate gross margin only from jobs with complete profit tracking
    const grossMargin = marginRevenue > 0 
      ? ((marginRevenue - marginCosts) / marginRevenue) * 100 
      : 0;
    
    return {
      totalRevenue,
      jobsCompleted: filteredJobs.length,
      jobsWithInvoices: jobsWithRevenue,
      averageJobValue: jobsWithRevenue > 0 ? totalRevenue / jobsWithRevenue : 0,
      totalCosts,
      grossMargin,
      jobsWithProfitTracking,
      marginRevenue,
      marginCosts,
      monthlyTrend: []
    };
  }

  async getQuoteAnalytics(fromDate?: Date, toDate?: Date): Promise<any> {
    // Slim fetch — analytics over the jobs table only, no joins/subqueries.
    const allJobs = await this.getJobsForAnalytics({ fromDate, toDate });
    
    // Get all proposals that have been sent (status = 'sent' or 'accepted' or 'viewed', or has sent_date)
    const proposals = await db.select().from(schema.proposals);
    
    // Create a map of jobId to sent date for filtering
    const sentProposalsByJobId = new Map<string, Date>();
    proposals.forEach(p => {
      if (p.jobId && (p.status === 'sent' || p.status === 'accepted' || p.status === 'viewed' || p.sentDate)) {
        const sentDate = p.sentDate ? new Date(p.sentDate) : null;
        if (sentDate) {
          // Keep the earliest sent date for each job
          const existing = sentProposalsByJobId.get(p.jobId);
          if (!existing || sentDate < existing) {
            sentProposalsByJobId.set(p.jobId, sentDate);
          }
        }
      }
    });
    
    const sentProposalJobIds = new Set(sentProposalsByJobId.keys());
    
    // Filter jobs - exclude archived
    let filteredJobs = allJobs.filter(j => !j.archived);
    
    // Quote Acceptance based on JOB STATUS:
    // - Accepted = jobs with status: completed, invoiced, work_order (customer said yes)
    // - Rejected = jobs with status: unsuccessful (customer said no)
    // - Pending = jobs with status: quote (waiting for response)
    // - ONLY include jobs that have a proposal sent (not draft)
    // ('scheduled' retired 2026-05 — those jobs now live as work_order.)

    const acceptedStatuses = ['completed', 'invoiced', 'work_order'];
    const rejectedStatuses = ['unsuccessful'];
    const pendingStatuses = ['quote'];
    
    // Only count jobs that have been quoted AND have a proposal sent
    const activeJobs = filteredJobs.filter(j => 
      j.status !== 'archived' && 
      j.status !== 'lead'
    );
    
    // Filter by date based on QUOTE SENT DATE (not job creation date)
    // This ensures "Quotes Sent" reflects when quotes were actually sent
    const filterByQuoteSentDate = (job: any) => {
      if (!fromDate && !toDate) return true;
      
      const sentDate = sentProposalsByJobId.get(job.id);
      if (!sentDate) return false; // No sent date means no proposal sent
      
      if (fromDate && sentDate < fromDate) return false;
      if (toDate && sentDate > toDate) return false;
      return true;
    };
    
    // Jobs with accepted status (customer said yes) - filter by quote sent date
    const acceptedJobs = activeJobs.filter(j => 
      acceptedStatuses.includes(j.status || '') && 
      sentProposalJobIds.has(j.id) &&
      filterByQuoteSentDate(j)
    );
    
    // Jobs with rejected status (customer said no) - filter by quote sent date
    const rejectedJobs = activeJobs.filter(j => 
      rejectedStatuses.includes(j.status || '') && 
      sentProposalJobIds.has(j.id) &&
      filterByQuoteSentDate(j)
    );
    
    // Jobs with pending status - ONLY include if proposal was actually sent and within date range
    const pendingJobs = activeJobs.filter(j => 
      pendingStatuses.includes(j.status || '') && 
      sentProposalJobIds.has(j.id) &&
      filterByQuoteSentDate(j)
    );
    
    // Total quotes = accepted + rejected + pending (only jobs with proposals sent in date range)
    const totalQuotes = acceptedJobs.length + rejectedJobs.length + pendingJobs.length;
    
    return {
      totalQuotes,
      acceptedQuotes: acceptedJobs.length,
      rejectedQuotes: rejectedJobs.length,
      pendingQuotes: pendingJobs.length,
      acceptedJobCards: acceptedJobs.map(j => j.jobNumber).filter(Boolean).sort((a, b) => parseInt(a || '0') - parseInt(b || '0')),
      rejectedJobCards: rejectedJobs.map(j => j.jobNumber).filter(Boolean).sort((a, b) => parseInt(a || '0') - parseInt(b || '0')),
      pendingJobCards: pendingJobs.map(j => j.jobNumber).filter(Boolean).sort((a, b) => parseInt(a || '0') - parseInt(b || '0')),
      averageResponseTime: 0,
      rejectionReasons: [],
      competitorAnalysis: []
    };
  }

  async getQuoteMethodAnalytics(fromDate?: Date, toDate?: Date): Promise<any> {
    // Slim fetch — only the jobs table; we don't need customer joins or diary
    // subqueries. Date filtering happens at the SQL level.
    const allJobs = await this.getJobsForAnalytics({ fromDate, toDate });
    
    // Filter by date if provided
    let filteredJobs = allJobs.filter(j => !j.archived);
    
    if (fromDate || toDate) {
      filteredJobs = filteredJobs.filter(j => {
        if (!j.createdAt) return false;
        const jobDate = new Date(j.createdAt);
        if (fromDate && jobDate < fromDate) return false;
        if (toDate && jobDate > toDate) return false;
        return true;
      });
    }
    
    // Status definitions ('scheduled' retired 2026-05).
    const acceptedStatuses = ['completed', 'invoiced', 'work_order'];
    const rejectedStatuses = ['unsuccessful'];

    // Filter jobs that have quote presentation method set
    // Include both 'lead' and 'quote' status — the presentation method is set during the quoting process
    const jobsWithMethod = filteredJobs.filter(j =>
      (j as any).quotePresentationMethod &&
      j.status !== 'archived'
    );
    
    // On-site quotes analytics
    const onSiteJobs = jobsWithMethod.filter(j => (j as any).quotePresentationMethod === 'on_site');
    const onSiteAccepted = onSiteJobs.filter(j => acceptedStatuses.includes(j.status || ''));
    const onSiteRejected = onSiteJobs.filter(j => rejectedStatuses.includes(j.status || ''));
    const onSitePending = onSiteJobs.filter(j => j.status === 'quote' || j.status === 'lead');
    const onSiteTotal = onSiteAccepted.length + onSiteRejected.length;
    const onSiteAcceptanceRate = onSiteTotal > 0 ? (onSiteAccepted.length / onSiteTotal) * 100 : 0;
    
    // Sent-later quotes analytics
    const sentLaterJobs = jobsWithMethod.filter(j => (j as any).quotePresentationMethod === 'sent_later');
    const sentLaterAccepted = sentLaterJobs.filter(j => acceptedStatuses.includes(j.status || ''));
    const sentLaterRejected = sentLaterJobs.filter(j => rejectedStatuses.includes(j.status || ''));
    const sentLaterPending = sentLaterJobs.filter(j => j.status === 'quote' || j.status === 'lead');
    const sentLaterTotal = sentLaterAccepted.length + sentLaterRejected.length;
    const sentLaterAcceptanceRate = sentLaterTotal > 0 ? (sentLaterAccepted.length / sentLaterTotal) * 100 : 0;
    
    // Calculate average + total values. Output is inc-GST (× 1.15 from the
    // ex-GST helper) because this surface reports customer-facing quote
    // totals — what the customer was quoted and accepted — not internal
    // ex-GST revenue. Matches the original semantics of reading totalAmount
    // (project convention: that column stores inc-GST).
    const onSiteAcceptedTotal = onSiteAccepted.reduce((sum, j) => sum + jobRevenueExGst(j) * 1.15, 0);
    const sentLaterAcceptedTotal = sentLaterAccepted.reduce((sum, j) => sum + jobRevenueExGst(j) * 1.15, 0);
    const onSiteAvgValue = onSiteAccepted.length > 0 ? onSiteAcceptedTotal / onSiteAccepted.length : 0;
    const sentLaterAvgValue = sentLaterAccepted.length > 0 ? sentLaterAcceptedTotal / sentLaterAccepted.length : 0;

    return {
      hasData: jobsWithMethod.length > 0,
      onSite: {
        total: onSiteJobs.length,
        accepted: onSiteAccepted.length,
        rejected: onSiteRejected.length,
        pending: onSitePending.length,
        acceptanceRate: Math.round(onSiteAcceptanceRate * 10) / 10,
        avgAcceptedValue: Math.round(onSiteAvgValue * 100) / 100,
        totalAcceptedValue: onSiteAcceptedTotal
      },
      sentLater: {
        total: sentLaterJobs.length,
        accepted: sentLaterAccepted.length,
        rejected: sentLaterRejected.length,
        pending: sentLaterPending.length,
        acceptanceRate: Math.round(sentLaterAcceptanceRate * 10) / 10,
        avgAcceptedValue: Math.round(sentLaterAvgValue * 100) / 100,
        totalAcceptedValue: sentLaterAcceptedTotal
      },
      comparison: {
        rateAdvantage: Math.round((onSiteAcceptanceRate - sentLaterAcceptanceRate) * 10) / 10,
        valueAdvantage: Math.round((onSiteAvgValue - sentLaterAvgValue) * 100) / 100,
        winningMethod: onSiteAcceptanceRate > sentLaterAcceptanceRate ? 'on_site' : 
                       sentLaterAcceptanceRate > onSiteAcceptanceRate ? 'sent_later' : 'equal'
      }
    };
  }

  async getLeadScoring(): Promise<any[]> { return []; }
  async getConversionFunnel(): Promise<any> {
    return {
      leads: 0,
      contacted: 0,
      qualified: 0,
      quoted: 0,
      won: 0,
      conversionRates: {
        leadToContact: 0,
        contactToQualified: 0,
        qualifiedToQuote: 0,
        quoteToWin: 0,
        overallConversion: 0
      },
      dropOffAnalysis: []
    };
  }

  async getFollowUpQueue(): Promise<any> {
    return {
      overdue: [],
      today: [],
      thisWeek: [],
      total: 0
    };
  }

  async getLeadSourceAnalysis(fromDate?: Date, toDate?: Date): Promise<any[]> {
    try {
      // Date filtering strategy:
      // - If a job has completedDate set, filter by that (most accurate)
      // - For completed jobs without completedDate: use updatedAt as proxy (updateJob always stamps it)
      // - For other jobs without completedDate: fall back to scheduledDate then createdAt
      const jobConditions: any[] = [sql`${schema.jobs.status} != 'archived'`];
      if (fromDate && toDate) {
        jobConditions.push(sql`(
          (${schema.jobs.completedDate} IS NOT NULL AND ${schema.jobs.completedDate} >= ${fromDate} AND ${schema.jobs.completedDate} <= ${toDate})
          OR
          (${schema.jobs.completedDate} IS NULL AND ${schema.jobs.status} = 'completed' AND ${schema.jobs.updatedAt} >= ${fromDate} AND ${schema.jobs.updatedAt} <= ${toDate})
          OR
          (${schema.jobs.completedDate} IS NULL AND COALESCE(${schema.jobs.scheduledDate}, ${schema.jobs.createdAt}) >= ${fromDate} AND COALESCE(${schema.jobs.scheduledDate}, ${schema.jobs.createdAt}) <= ${toDate})
        )`);
      } else if (fromDate) {
        jobConditions.push(sql`COALESCE(${schema.jobs.completedDate}, ${schema.jobs.updatedAt}, ${schema.jobs.scheduledDate}, ${schema.jobs.createdAt}) >= ${fromDate}`);
      } else if (toDate) {
        jobConditions.push(sql`COALESCE(${schema.jobs.completedDate}, ${schema.jobs.updatedAt}, ${schema.jobs.scheduledDate}, ${schema.jobs.createdAt}) <= ${toDate}`);
      }

      // Phase 1: three independent queries — run in parallel.
      //   (a) business settings (for default margin fallback)
      //   (b) jobs in the date window (drives counts/revenue)
      //   (c) all completed/invoiced jobs ever (drives the all-time margin fallback)
      // ── All-time margin pass ──────────────────────────────────────────────
      // Gross margin is a historical benchmark: we fetch ALL completed/invoiced jobs
      // (no date filter) so that the margin column is always populated regardless of
      // which date window the user is viewing. Counts/revenue still use the date window.
      const [bizSettingsRows, jobs, allCompletedJobs] = await Promise.all([
        db.select().from(schema.businessSettings).limit(1),
        db.select().from(schema.jobs).where(and(...jobConditions)),
        db.select().from(schema.jobs).where(and(
          sql`${schema.jobs.status} IN ('completed', 'invoiced')`,
          sql`${schema.jobs.status} != 'archived'`
        )),
      ]);
      const bizSettings = bizSettingsRows[0];
      const defaultMarginPct = parseFloat(bizSettings?.defaultGrossMarginPct?.toString() || '0') || 0;

      const completedJobsInRange = jobs.filter(j => j.status === 'completed' || j.status === 'invoiced');

      // Phase 2: four dependent queries — all depend on phase 1, but are independent of
      // each other, so run in parallel. Previously these were four sequential awaits.
      const allCompletedIds = allCompletedJobs.map(j => j.id);
      const qualifyingJobIds = jobs.map(j => j.id);
      const [allTimeInvoices, allTimeProposals, allInvoices, proposals] = await Promise.all([
        allCompletedIds.length > 0
          ? db.select().from(schema.invoices).where(and(
              sql`${schema.invoices.status} != 'cancelled'`,
              inArray(schema.invoices.jobId, allCompletedIds)
            ))
          : Promise.resolve([] as any[]),
        allCompletedIds.length > 0
          ? db.select().from(schema.proposals).where(inArray(schema.proposals.jobId, allCompletedIds))
          : Promise.resolve([] as any[]),
        qualifyingJobIds.length > 0
          ? db.select().from(schema.invoices).where(and(
              sql`${schema.invoices.status} != 'cancelled'`,
              inArray(schema.invoices.jobId, qualifyingJobIds)
            ))
          : Promise.resolve([] as any[]),
        qualifyingJobIds.length > 0
          ? db.select().from(schema.proposals).where(inArray(schema.proposals.jobId, qualifyingJobIds))
          : Promise.resolve([] as any[]),
      ]);
      // Internal metrics show ex-GST per business rule. Use invoiceRevenueExGst()
      // because invoice.amount is inconsistently stored (inc-GST on some rows,
      // ex-GST on others); the helper prefers items[].amount which is always ex-GST.
      const allTimeInvoiceMap = new Map<string, number>();
      for (const inv of allTimeInvoices) {
        if (inv.jobId) {
          allTimeInvoiceMap.set(inv.jobId, (allTimeInvoiceMap.get(inv.jobId) || 0) + invoiceRevenueExGst(inv));
        }
      }

      // Proposal amounts for all completed jobs (for revenue fallback) — fetched above in phase 2.
      // proposal.totalAmount is inc-GST (customer-facing total); strip GST for internal metrics.
      const allTimeProposalMap = new Map<string, number>();
      for (const p of allTimeProposals) {
        if (p.jobId && p.totalAmount) {
          const amt = parseFloat(p.totalAmount?.toString() || '0') / 1.15;
          if (amt > (allTimeProposalMap.get(p.jobId) || 0)) allTimeProposalMap.set(p.jobId, amt);
        }
      }

      // Build all-time margin totals per lead source
      type MarginAccum = { revenueWithCostData: number; profitWithCostData: number };
      const allTimeMarginMap = new Map<string, MarginAccum>();
      for (const job of allCompletedJobs) {
        const source = job.leadSource || 'other';
        if (!allTimeMarginMap.has(source)) allTimeMarginMap.set(source, { revenueWithCostData: 0, profitWithCostData: 0 });
        const acc = allTimeMarginMap.get(source)!;

        const invoiceRev = allTimeInvoiceMap.get(job.id) || 0;
        // job.totalAmount is inc-GST; strip GST so the margin % is consistent with the ex-GST revenue column.
        const revenueForMargin =
          invoiceRev > 0 ? invoiceRev
          : (parseFloat(job.totalAmount?.toString() || '0') / 1.15) || 0
          || (allTimeProposalMap.get(job.id) || 0);

        if (revenueForMargin <= 0) continue;

        const lineItems = (job.lineItems as any[]) || [];
        let lineItemCosts = 0;
        for (const item of lineItems) {
          const c = parseFloat(item.totalCost?.toString() || item.costExGst?.toString() || '0') || 0;
          if (c > 0) lineItemCosts += c;
          else if (item.unitCost && item.quantity) lineItemCosts += (parseFloat(item.unitCost.toString()) || 0) * (parseFloat(item.quantity.toString()) || 1);
        }
        const laborCosts = parseFloat(job.laborCosts || '0') || 0;
        const calcLabor = parseFloat(job.calculatedLaborCost?.toString() || '0');
        const materialsCosts = parseFloat(job.materialsCosts || '0') || 0;
        const otherCosts = parseFloat(job.otherCosts || '0') || 0;
        const costOfGoods = parseFloat(job.costOfGoods || '0') || 0;
        const manualCosts = laborCosts + calcLabor + materialsCosts + otherCosts + costOfGoods;
        const totalCosts = lineItemCosts > 0 ? lineItemCosts : manualCosts;

        const storedMarginPct = parseFloat(job.grossMargin?.toString() || '0') || 0;
        if (storedMarginPct > 0) {
          acc.revenueWithCostData += revenueForMargin;
          acc.profitWithCostData += revenueForMargin * (storedMarginPct / 100);
        } else if (totalCosts > 0) {
          acc.revenueWithCostData += revenueForMargin;
          acc.profitWithCostData += (revenueForMargin - totalCosts);
        } else if (defaultMarginPct > 0) {
          acc.revenueWithCostData += revenueForMargin;
          acc.profitWithCostData += revenueForMargin * (defaultMarginPct / 100);
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // Invoices for these qualifying jobs (not date-filtered — we want the real
      // revenue for jobs worked on in the period) — fetched above in phase 2.

      // Map job IDs → total invoiced amount (ex-GST).
      // See invoiceRevenueExGst() for why we don't just divide invoice.amount by
      // 1.15 (it's inconsistently stored across rows).
      const jobInvoiceMap = new Map<string, number>();
      for (const invoice of allInvoices) {
        if (invoice.jobId) {
          const existingAmount = jobInvoiceMap.get(invoice.jobId) || 0;
          const invoiceAmount = invoiceRevenueExGst(invoice);
          jobInvoiceMap.set(invoice.jobId, existingAmount + invoiceAmount);
        }
      }

      // Proposals for these qualifying jobs — fetched above in phase 2.

      // Create a map of job IDs that have proposals in the date range
      const jobsWithProposals = new Set<string>();
      proposals.forEach(proposal => {
        if (proposal.jobId) {
          jobsWithProposals.add(proposal.jobId);
        }
      });

      // Create a map of job IDs to their highest proposal amounts (for quoted value).
      // proposal.totalAmount is inc-GST; strip GST for internal metrics.
      const jobProposalAmountMap = new Map<string, number>();
      for (const proposal of proposals) {
        if (proposal.jobId && proposal.totalAmount) {
          const proposalAmount = parseFloat(proposal.totalAmount?.toString() || '0') / 1.15;
          const existingAmount = jobProposalAmountMap.get(proposal.jobId) || 0;
          // Use the highest proposal amount for each job
          if (proposalAmount > existingAmount) {
            jobProposalAmountMap.set(proposal.jobId, proposalAmount);
          }
        }
      }

      // Group jobs by lead source
      const sourceMap = new Map<string, {
        count: number;
        quotedCount: number;
        wonCount: number;
        totalRevenue: number;
        totalQuotedValue: number;
        totalCosts: number;
        totalProfit: number;
        jobIds: Set<string>;
        quotedJobIds: Set<string>;
        jobsWithCostData: number;
        revenueWithCostData: number;
        profitWithCostData: number;
      }>();

      // Initialize all possible lead sources
      const leadSources = ['website', 'phone', 'referral', 'friend', 'saw_working', 'repeat', 'google', 'facebook', 'direct', 'advertisement', 'council', 'other'];
      leadSources.forEach(source => {
        sourceMap.set(source, {
          count: 0,
          quotedCount: 0,
          wonCount: 0,
          totalRevenue: 0,
          totalQuotedValue: 0,
          totalCosts: 0,
          totalProfit: 0,
          jobIds: new Set(),
          quotedJobIds: new Set(),
          jobsWithCostData: 0,
          revenueWithCostData: 0,
          profitWithCostData: 0
        });
      });

      // Process jobs — all returned jobs fall within the date window (pre-filtered by scheduledDate).
      jobs.forEach(job => {
        const source = job.leadSource || 'other';
        const existing = sourceMap.get(source) || {
          count: 0,
          quotedCount: 0,
          wonCount: 0,
          totalRevenue: 0,
          totalQuotedValue: 0,
          totalCosts: 0,
          totalProfit: 0,
          jobIds: new Set(),
          quotedJobIds: new Set(),
          jobsWithCostData: 0,
          revenueWithCostData: 0,
          profitWithCostData: 0
        };

        // Every job in this period is counted in the "jobs" column
        existing.jobIds.add(job.id);

        const invoiceRevenue = jobInvoiceMap.get(job.id) || 0;
        const hasProposal = jobsWithProposals.has(job.id);

        // Count as quoted if a proposal exists OR if status is quote/work_order/completed.
        // ('scheduled' retired 2026-05.)
        if (hasProposal || ['quote', 'work_order', 'completed'].includes(job.status || '')) {
          existing.quotedJobIds.add(job.id);
          const proposalAmount = jobProposalAmountMap.get(job.id) || 0;
          if (proposalAmount > 0) {
            existing.totalQuotedValue += proposalAmount;
          }
        }

        // Count completed jobs as "won"
        if (job.status === 'completed') {
          existing.wonCount++;
          existing.totalRevenue += invoiceRevenue;

          // Cost priority order:
          // 1. Line item totalCost fields (most accurate — set during quoting)
          // 2. Manual cost fields (laborCosts, materialsCosts, etc.)
          // 3. Stored grossMargin % on the job
          // 4. Business-wide default gross margin

          // Priority 1: line item costs
          let lineItemCosts = 0;
          const lineItems = (job.lineItems as any[]) || [];
          for (const item of lineItems) {
            const itemCost = parseFloat(item.totalCost?.toString() || item.costExGst?.toString() || '0') || 0;
            if (itemCost > 0) {
              lineItemCosts += itemCost;
            } else if (item.unitCost && item.quantity) {
              lineItemCosts += (parseFloat(item.unitCost.toString()) || 0) * (parseFloat(item.quantity.toString()) || 1);
            }
          }

          // Priority 2: manual cost fields
          const laborCosts = parseFloat(job.laborCosts || '0') || 0;
          const calculatedLabor = parseFloat(job.calculatedLaborCost?.toString() || '0');
          const materialsCosts = parseFloat(job.materialsCosts || '0') || 0;
          const otherCosts = parseFloat(job.otherCosts || '0') || 0;
          const costOfGoods = parseFloat(job.costOfGoods || '0') || 0;
          const manualCosts = laborCosts + calculatedLabor + materialsCosts + otherCosts + costOfGoods;

          const totalCosts = lineItemCosts > 0 ? lineItemCosts : manualCosts;

          existing.totalCosts += totalCosts;
          existing.totalProfit += (invoiceRevenue - totalCosts);

          // Revenue fallback chain for margin calculation (all ex-GST):
          // 1. Invoice amount (most accurate — what was actually billed)
          // 2. job.totalAmount (synced from invoice when created) — stored inc-GST, strip GST
          // 3. Highest proposal amount (quote value — already stripped above)
          const revenueForMargin =
            invoiceRevenue > 0 ? invoiceRevenue
            : (parseFloat(job.totalAmount?.toString() || '0') / 1.15) || 0
            || (jobProposalAmountMap.get(job.id) || 0);

          if (revenueForMargin > 0) {
            // Margin priority:
            // 1. Stored grossMargin % on the job (entered under Profit in the job card) — most explicit
            // 2. Calculated from line item or manual cost fields
            // 3. Business-wide default gross margin %
            const storedMarginPct = parseFloat(job.grossMargin?.toString() || '0') || 0;
            if (storedMarginPct > 0) {
              const impliedProfit = revenueForMargin * (storedMarginPct / 100);
              existing.jobsWithCostData++;
              existing.revenueWithCostData += revenueForMargin;
              existing.profitWithCostData += impliedProfit;
            } else if (totalCosts > 0) {
              existing.jobsWithCostData++;
              existing.revenueWithCostData += revenueForMargin;
              existing.profitWithCostData += (revenueForMargin - totalCosts);
            } else if (defaultMarginPct > 0) {
              const impliedProfit = revenueForMargin * (defaultMarginPct / 100);
              existing.jobsWithCostData++;
              existing.revenueWithCostData += revenueForMargin;
              existing.profitWithCostData += impliedProfit;
            }
          }
        }

        sourceMap.set(source, existing);
      });

      // Count proposals per job for better conversion tracking
      const proposalsByJob = new Map<string, number>();
      proposals.forEach(proposal => {
        if (proposal.jobId) {
          const count = proposalsByJob.get(proposal.jobId) || 0;
          proposalsByJob.set(proposal.jobId, count + 1);
        }
      });

      // Calculate metrics for each source
      const result = Array.from(sourceMap.entries()).map(([source, data]) => {
        const count = data.jobIds.size; // Count of unique jobs with invoices in period
        const quotedCount = data.quotedJobIds.size; // Count of unique jobs with proposals in period
        const wonCount = data.wonCount;
        const totalRevenue = data.totalRevenue;
        const totalQuotedValue = data.totalQuotedValue;
        const totalProfit = data.totalProfit;

        // Conversion rates
        const conversionRate = count > 0 ? (wonCount / count) * 100 : 0;
        const quoteConversionRate = quotedCount > 0 ? (wonCount / quotedCount) * 100 : 0;

        // Average values
        const averageValue = wonCount > 0 ? totalRevenue / wonCount : 0;
        const averageQuoteValue = quotedCount > 0 ? totalQuotedValue / quotedCount : 0;
        // Gross margin: prefer period-specific cost data when available, then fall back
        // to all-time historical margin for this lead source. This ensures the margin
        // column always shows even when viewing a narrow date window with no cost data.
        const revenueWithCostData = data.revenueWithCostData || 0;
        const profitWithCostData = data.profitWithCostData || 0;
        let averageProfitMargin = 0;
        if (revenueWithCostData > 0) {
          averageProfitMargin = (profitWithCostData / revenueWithCostData) * 100;
        } else {
          const allTimeAcc = allTimeMarginMap.get(source);
          if (allTimeAcc && allTimeAcc.revenueWithCostData > 0) {
            averageProfitMargin = (allTimeAcc.profitWithCostData / allTimeAcc.revenueWithCostData) * 100;
          }
        }

        // ROI calculation (assuming some marketing cost - this can be made configurable)
        const estimatedMarketingCost = count * 10; // $10 per lead as placeholder
        const roi = estimatedMarketingCost > 0 ? ((totalProfit - estimatedMarketingCost) / estimatedMarketingCost) * 100 : 0;

        return {
          source,
          count,
          quotedCount,
          wonCount,
          conversionRate: Math.round(conversionRate * 100) / 100,
          quoteConversionRate: Math.round(quoteConversionRate * 100) / 100,
          totalQuotedValue: Math.round(totalQuotedValue * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          averageQuoteValue: Math.round(averageQuoteValue * 100) / 100,
          averageValue: Math.round(averageValue * 100) / 100,
          averageProfitMargin: Math.round(averageProfitMargin * 100) / 100,
          totalProfit: Math.round(totalProfit * 100) / 100,
          roi: Math.round(roi * 100) / 100
        };
      });

      // Sort by total revenue descending
      return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } catch (error) {
      console.error('Error in getLeadSourceAnalysis:', error);
      return [];
    }
  }

  async getQuotePresentationAnalysis(fromDate?: Date, toDate?: Date): Promise<{
    method: string;
    label: string;
    totalQuotes: number;
    acceptedQuotes: number;
    rejectedQuotes: number;
    pendingQuotes: number;
    conversionRate: number;
    totalValue: number;
    acceptedValue: number;
    averageValue: number;
  }[]> {
    try {
      // Build date conditions for JOBS table (using job's quotePresentationMethod)
      const conditions = [];
      if (fromDate) {
        conditions.push(sql`${schema.jobs.createdAt} >= ${fromDate}`);
      }
      if (toDate) {
        conditions.push(sql`${schema.jobs.createdAt} <= ${toDate}`);
      }
      // Exclude only archived jobs — lead and quote status are both valid quoting stages
      conditions.push(sql`${schema.jobs.status} NOT IN ('archived')`);

      // Get all jobs with optional date filtering
      const jobs = await db
        .select()
        .from(schema.jobs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // Define presentation methods with labels (matching job card dropdown values)
      const methodLabels: Record<string, string> = {
        'on_site': 'On-Site (presented in person)',
        'sent_later': 'Sent Later (email/text)',
        'unspecified': 'Not Specified'
      };

      // Status definitions for conversion tracking ('scheduled' retired 2026-05).
      const acceptedStatuses = ['completed', 'invoiced', 'work_order'];
      const rejectedStatuses = ['unsuccessful'];
      const pendingStatuses = ['quote', 'lead'];

      // Group jobs by presentation method
      const methodStats = new Map<string, {
        totalQuotes: number;
        acceptedQuotes: number;
        rejectedQuotes: number;
        pendingQuotes: number;
        totalValue: number;
        acceptedValue: number;
      }>();

      // Initialize all methods
      for (const method of Object.keys(methodLabels)) {
        methodStats.set(method, {
          totalQuotes: 0,
          acceptedQuotes: 0,
          rejectedQuotes: 0,
          pendingQuotes: 0,
          totalValue: 0,
          acceptedValue: 0
        });
      }

      // Process each job
      for (const job of jobs) {
        const method = job.quotePresentationMethod || 'unspecified';
        const stats = methodStats.get(method) || methodStats.get('unspecified')!;

        stats.totalQuotes++;
        const amount = parseFloat(job.totalAmount?.toString() || '0');
        stats.totalValue += amount;

        if (acceptedStatuses.includes(job.status || '')) {
          stats.acceptedQuotes++;
          stats.acceptedValue += amount;
        } else if (rejectedStatuses.includes(job.status || '')) {
          stats.rejectedQuotes++;
        } else if (pendingStatuses.includes(job.status || '')) {
          stats.pendingQuotes++;
        }

        methodStats.set(method === 'unspecified' ? 'unspecified' : method, stats);
      }

      // Build result array
      const result = Array.from(methodStats.entries())
        .filter(([_, stats]) => stats.totalQuotes > 0) // Only include methods with jobs
        .map(([method, stats]) => ({
          method,
          label: methodLabels[method] || method,
          totalQuotes: stats.totalQuotes,
          acceptedQuotes: stats.acceptedQuotes,
          rejectedQuotes: stats.rejectedQuotes,
          pendingQuotes: stats.pendingQuotes,
          conversionRate: stats.totalQuotes > 0 
            ? Math.round((stats.acceptedQuotes / stats.totalQuotes) * 100 * 100) / 100 
            : 0,
          totalValue: Math.round(stats.totalValue * 100) / 100,
          acceptedValue: Math.round(stats.acceptedValue * 100) / 100,
          averageValue: stats.totalQuotes > 0 
            ? Math.round((stats.totalValue / stats.totalQuotes) * 100) / 100 
            : 0
        }));

      // Sort by conversion rate descending
      return result.sort((a, b) => b.conversionRate - a.conversionRate);
    } catch (error) {
      console.error('Error in getQuotePresentationAnalysis:', error);
      return [];
    }
  }

  async importCustomersFromCsv(csvData: any[]): Promise<CsvImportResult> {
    console.log('🚀 Starting CSV customer import...', { totalRows: csvData.length });
    
    let successfulImports = 0;
    let failedImports = 0;
    const errors: Array<{ row: number; error: string; data?: Record<string, any> }> = [];
    const importedIds: string[] = [];
    
    // Header mapping for ServiceM8 CSV exports to our internal schema
    const headerMap: { [key: string]: string } = {
      'Company Name': 'name',
      'company_name': 'name',
      'name': 'name',
      'Company': 'name',
      'Contact First': 'firstName',
      'contact_first': 'firstName',
      'first_name': 'firstName',
      'Contact Last': 'lastName', 
      'contact_last': 'lastName',
      'last_name': 'lastName',
      'Email': 'email',
      'email': 'email',
      'Email Address': 'email',
      'Phone': 'phone',
      'phone': 'phone',
      'Mobile': 'mobile',
      'mobile': 'mobile',
      'Mobile Phone': 'mobile',
      'Address': 'address',
      'address': 'address',
      'Address Line 1': 'address',
      'address_line1': 'address',
      'City': 'city',
      'city': 'city',
      'State': 'region',
      'state': 'region',
      'region': 'region',
      'Province': 'region',
      'Notes': 'notes',
      'notes': 'notes',
      'UUID': 'servicem8Uuid',
      'uuid': 'servicem8Uuid',
      'Company UUID': 'servicem8Uuid'
    };

    for (let i = 0; i < csvData.length; i++) {
      try {
        const row = csvData[i];
        
        // Normalize headers to our expected format
        const normalizedRow: any = {};
        for (const [csvKey, value] of Object.entries(row)) {
          const mappedKey = headerMap[csvKey.trim()] || csvKey.toLowerCase().replace(/\s+/g, '_');
          normalizedRow[mappedKey] = value && typeof value === 'string' ? value.trim() : value;
        }
        
        console.log(`🔍 Row ${i + 1} normalized data:`, {
          original: Object.keys(row),
          normalized: normalizedRow,
          name: normalizedRow.name,
          email: normalizedRow.email,
          phone: normalizedRow.phone || normalizedRow.mobile
        });

        // Generate customer name with fallback logic
        let customerName = '';
        
        if (normalizedRow.name?.trim()) {
          customerName = normalizedRow.name.trim();
        } else if (normalizedRow.firstName?.trim() || normalizedRow.lastName?.trim()) {
          const firstName = (normalizedRow.firstName || '').trim();
          const lastName = (normalizedRow.lastName || '').trim();
          customerName = `${firstName} ${lastName}`.trim();
        } else if (normalizedRow.email?.includes('@')) {
          customerName = normalizedRow.email.split('@')[0];
        } else if (normalizedRow.mobile?.trim() || normalizedRow.phone?.trim()) {
          const phoneNumber = normalizedRow.mobile?.trim() || normalizedRow.phone?.trim();
          customerName = `Customer (${phoneNumber})`;
        } else if (normalizedRow.address?.trim()) {
          customerName = `Customer at ${normalizedRow.address.trim()}`;
        } else {
          customerName = `Customer-${Date.now()}-${i}`;
        }

        // Check if customer already exists by ServiceM8 UUID or email
        let existingCustomer;
        if (normalizedRow.servicem8Uuid) {
          existingCustomer = await this.getCustomerByServiceM8Uuid(normalizedRow.servicem8Uuid);
        }
        if (!existingCustomer && normalizedRow.email) {
          const customers = await this.getAllCustomers();
          existingCustomer = customers.find(c => c.email === normalizedRow.email);
        }

        if (existingCustomer) {
          console.log(`⏭️ Skipping existing customer: ${existingCustomer.name}`);
          continue;
        }

        const customerData: InsertCustomer = {
          name: customerName,
          email: normalizedRow.email || null,
          phone: normalizedRow.mobile || normalizedRow.phone || null,
          address: normalizedRow.address || null,
          city: normalizedRow.city || null,
          region: normalizedRow.region || null,
          notes: normalizedRow.notes || null,
          source: 'ServiceM8 Import',
          servicem8Uuid: normalizedRow.servicem8Uuid || null,
          isActive: true
        };

        const customer = await this.createCustomer(customerData);
        successfulImports++;
        importedIds.push(customer.id);
        console.log(`✅ Imported customer: ${customer.name} (email: ${customer.email}, phone: ${customer.phone})`);
        
      } catch (error) {
        failedImports++;
        const errorMsg = `${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('❌ Customer import error:', errorMsg);
        errors.push({ row: i + 1, error: errorMsg, data: csvData[i] });
      }
    }

    console.log(`🎉 CSV customer import completed: ${successfulImports} successful, ${failedImports} failed`);
    
    return {
      success: successfulImports > 0,
      totalRows: csvData.length,
      successfulImports,
      errors,
      importedIds
    };
  }

  async importJobsFromCsv(csvData: any[]): Promise<CsvImportResult> {
    console.log('🚀 Starting CSV job import...', { totalRows: csvData.length });
    
    let successfulImports = 0;
    let failedImports = 0;
    const errors: Array<{ row: number; error: string; data?: Record<string, any> }> = [];
    const importedIds: string[] = [];

    // Header mapping for ServiceM8 CSV exports to our internal schema
    const headerMap: { [key: string]: string } = {
      'Job Number': 'jobNumber',
      'job_number': 'jobNumber',
      'generated_job_id': 'jobNumber',
      'Job ID': 'jobNumber',
      'Job Description': 'description',
      'job_description': 'description',
      'description': 'description',
      'Title': 'description',
      'Job Address': 'address',
      'job_address': 'address',
      'address': 'address',
      'Location': 'address',
      'Job Location': 'address',
      'Status': 'status',
      'status': 'status',
      'Priority': 'priority',
      'priority': 'priority',
      'Total Cost': 'totalAmount',
      'total_cost': 'totalAmount',
      'amount': 'totalAmount',
      'value': 'totalAmount',
      'Company UUID': 'companyUuid',
      'company_uuid': 'companyUuid',
      'Customer UUID': 'companyUuid',
      'Date Created': 'dateCreated',
      'date_created': 'dateCreated',
      'created_date': 'dateCreated',
      'Notes': 'notes',
      'notes': 'notes'
    };

    // Get all customers for UUID mapping
    const customers = await this.getAllCustomers();

    for (let i = 0; i < csvData.length; i++) {
      try {
        const row = csvData[i];
        
        // Normalize headers to our expected format
        const normalizedRow: any = {};
        for (const [csvKey, value] of Object.entries(row)) {
          const mappedKey = headerMap[csvKey.trim()] || csvKey.toLowerCase().replace(/\s+/g, '_');
          normalizedRow[mappedKey] = value && typeof value === 'string' ? value.trim() : value;
        }

        console.log(`🔍 Job row ${i + 1} normalized data:`, {
          jobNumber: normalizedRow.jobNumber,
          description: normalizedRow.description,
          address: normalizedRow.address,
          status: normalizedRow.status,
          companyUuid: normalizedRow.companyUuid
        });

        // Find customer by ServiceM8 UUID
        const customer = customers.find(c => c.servicem8Uuid === normalizedRow.companyUuid);
        if (!customer) {
          errors.push({ row: i + 1, error: `No customer found for ServiceM8 UUID ${normalizedRow.companyUuid}`, data: csvData[i] });
          failedImports++;
          continue;
        }

        // Generate job number if missing
        const jobNumber = normalizedRow.jobNumber || `J-${Date.now()}-${i}`;

        // Check if job already exists
        const existingJob = await this.getJobByJobNumber(jobNumber);
        if (existingJob) {
          console.log(`⏭️ Skipping existing job: ${jobNumber}`);
          continue;
        }

        // Map ServiceM8 status to our format
        const statusMap: { [key: string]: string } = {
          'Quote': 'quote',
          'Quoted': 'quote',
          'Scheduled': 'work_order',
          'In Progress': 'work_order',
          'Work Order': 'work_order',
          'Completed': 'completed',
          'Cancelled': 'unsuccessful',
          'Lead': 'lead'
        };
        
        const mappedStatus = statusMap[normalizedRow.status] || 'lead';

        // Parse total amount
        let totalAmount = null;
        if (normalizedRow.totalAmount) {
          const cleanAmount = normalizedRow.totalAmount.toString().replace(/[^0-9.-]/g, '');
          totalAmount = parseFloat(cleanAmount) || null;
        }

        const jobData: InsertJob = {
          customerId: customer.id,
          jobNumber: jobNumber,
          title: normalizedRow.description || `Job ${jobNumber}`,
          description: normalizedRow.notes || normalizedRow.description || null,
          address: normalizedRow.address || 'Address not specified',
          status: mappedStatus as any,
          priority: normalizedRow.priority?.toLowerCase() || 'medium',
          totalAmount: totalAmount?.toString() || null,
          serviceType: 'Tree Services',
          leadSource: 'ServiceM8 Import',
          updatedAt: new Date()
        };

        const job = await this.createJob(jobData);
        successfulImports++;
        importedIds.push(job.id);
        console.log(`✅ Imported job: ${job.title} for customer ${customer.name}`);
        
      } catch (error) {
        failedImports++;
        const errorMsg = `${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('❌ Job import error:', errorMsg);
        errors.push({ row: i + 1, error: errorMsg, data: csvData[i] });
      }
    }

    console.log(`🎉 CSV job import completed: ${successfulImports} successful, ${failedImports} failed`);
    
    return {
      success: successfulImports > 0,
      totalRows: csvData.length,
      successfulImports,
      errors,
      importedIds
    };
  }

  async importQuotesFromCsv(csvData: any[]): Promise<CsvImportResult> { throw new Error("Not implemented"); }

  // All remaining methods return empty/default values
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(schema.notifications).values(withTenant(notification)).returning();
    return newNotification;
  }
  async getNotification(id: string): Promise<Notification | undefined> {
    const [notification] = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id));
    return notification || undefined;
  }
  async updateNotification(id: string, updates: UpdateNotification): Promise<Notification> {
    const [updatedNotification] = await db.update(schema.notifications)
      .set(updates)
      .where(eq(schema.notifications.id, id))
      .returning();
    return updatedNotification;
  }
  async getAllNotifications(userId?: string, limit?: number): Promise<NotificationWithDetails[]> {
    let query = db.select().from(schema.notifications);
    const conditions = [eq(schema.notifications.archived, false)];
    if (userId) {
      conditions.push(eq(schema.notifications.userId, userId));
    }
    query = query.where(and(...conditions)) as any;
    if (limit) {
      query = query.limit(limit) as any;
    }
    const notifications = await query.orderBy(desc(schema.notifications.createdAt));
    
    // Filter out notifications for completed jobs
    const filteredNotifications = await this.filterCompletedJobNotifications(notifications);
    return filteredNotifications as NotificationWithDetails[];
  }
  
  private async filterCompletedJobNotifications(notifications: any[]): Promise<any[]> {
    if (notifications.length === 0) return notifications;
    
    const jobIds = [...new Set(notifications.filter(n => n.jobId).map(n => n.jobId))];
    
    if (jobIds.length === 0) return notifications;
    
    const jobs = await db.select({ id: schema.jobs.id, status: schema.jobs.status })
      .from(schema.jobs)
      .where(inArray(schema.jobs.id, jobIds as string[]));
    
    const completedJobIds = new Set(
      jobs.filter(j => j.status === 'completed').map(j => j.id)
    );
    
    const alwaysShowTypes = new Set([
      'email_reply', 'sms_reply', 'payment_received', 'invoice_paid',
      'reminder_uninvoiced', 'reminder_no_crew', 'reminder_stale_quote', 'reminder_stale_lead',
    ]);
    
    return notifications.filter(n => 
      !n.jobId || 
      !completedJobIds.has(n.jobId) || 
      alwaysShowTypes.has(n.type)
    );
  }
  async getUnreadNotifications(userId?: string): Promise<NotificationWithDetails[]> {
    const conditions = [eq(schema.notifications.isRead, false), eq(schema.notifications.archived, false)];
    if (userId) {
      conditions.push(eq(schema.notifications.userId, userId));
    }
    const notifications = await db.select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt));
    
    // Filter out notifications for completed jobs
    const filteredNotifications = await this.filterCompletedJobNotifications(notifications);
    return filteredNotifications as NotificationWithDetails[];
  }
  async getNotificationsCreatedSince(since: Date): Promise<Notification[]> {
    const notifications = await db.select()
      .from(schema.notifications)
      .where(gte(schema.notifications.createdAt, since))
      .orderBy(desc(schema.notifications.createdAt));
    return notifications;
  }
  async markNotificationAsRead(id: string): Promise<Notification> {
    const [updatedNotification] = await db.update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(schema.notifications.id, id))
      .returning();
    return updatedNotification;
  }
  async markAllNotificationsAsRead(userId?: string): Promise<void> {
    const conditions = [eq(schema.notifications.archived, false)];
    if (userId) {
      conditions.push(eq(schema.notifications.userId, userId));
    }
    await db.update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(...conditions));
  }
  async deleteNotification(id: string): Promise<void> {
    // Archive instead of delete — keeps the record for reminder de-dup so the
    // same reminder isn't immediately recreated on the next hourly check.
    await db.update(schema.notifications)
      .set({ archived: true })
      .where(eq(schema.notifications.id, id));
  }
  async deleteAllNotifications(userId?: string): Promise<void> {
    // Archive instead of delete — keeps records for reminder de-dup so the
    // same reminders aren't immediately recreated on the next hourly check.
    const conditions = [eq(schema.notifications.archived, false)];
    if (userId) {
      conditions.push(eq(schema.notifications.userId, userId));
    }
    await db.update(schema.notifications)
      .set({ archived: true })
      .where(and(...conditions));
  }
  async getNotificationSummary(userId?: string): Promise<NotificationSummary> {
    // Get all non-archived notifications for the user (or all if no userId)
    const conditions = [eq(schema.notifications.archived, false)];
    if (userId) {
      conditions.push(eq(schema.notifications.userId, userId));
    }
    const rawNotifications = await db.select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt));
    
    // Filter out notifications for completed jobs
    const allNotifications = await this.filterCompletedJobNotifications(rawNotifications);
    
    // Count unread notifications
    const unreadCount = allNotifications.filter((n: any) => !n.isRead).length;
    
    // Group by type
    const byType: Record<string, number> = {};
    allNotifications.forEach((n: any) => {
      byType[n.type] = (byType[n.type] || 0) + 1;
    });
    
    // Group by priority
    const byPriority: Record<string, number> = {};
    allNotifications.forEach((n: any) => {
      byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
    });
    
    // Get recent notifications (up to 5)
    const recent = allNotifications.slice(0, 5).map((n: any) => ({
      id: n.id,
      title: n.title,
      type: n.type,
      priority: n.priority,
      createdAt: n.createdAt.toISOString(),
    }));
    
    return {
      total: allNotifications.length,
      unread: unreadCount,
      byType,
      byPriority,
      recent,
    };
  }
  async deleteExpiredNotifications(): Promise<void> { }

  // Notification Queue Management
  async createNotificationQueueItem(item: schema.InsertNotificationQueueItem): Promise<schema.NotificationQueueItem> {
    const [created] = await db.insert(schema.notificationQueue).values(withTenant(item)).returning();
    return created;
  }

  async getPendingNotifications(beforeTime?: Date): Promise<schema.NotificationQueueItem[]> {
    const queryTime = beforeTime || new Date();
    return await db
      .select()
      .from(schema.notificationQueue)
      .where(
        and(
          eq(schema.notificationQueue.status, 'pending'),
          lte(schema.notificationQueue.sendAt, queryTime)
        )
      )
      .orderBy(schema.notificationQueue.sendAt);
  }

  async markNotificationSent(id: string): Promise<void> {
    await db
      .update(schema.notificationQueue)
      .set({
        status: 'sent',
        sentAt: new Date()
      })
      .where(eq(schema.notificationQueue.id, id));
  }

  async markNotificationFailed(id: string, error: string): Promise<void> {
    await db
      .update(schema.notificationQueue)
      .set({
        status: 'failed',
        error
      })
      .where(eq(schema.notificationQueue.id, id));
  }

  // Pending Outbound Messages
  async createPendingOutboundMessage(msg: schema.InsertPendingOutboundMessage): Promise<schema.PendingOutboundMessage> {
    const [created] = await db.insert(schema.pendingOutboundMessages).values(withTenant(msg)).returning();
    return created;
  }

  async getPendingOutboundMessages(status?: string): Promise<schema.PendingOutboundMessage[]> {
    if (status) {
      return await db.select().from(schema.pendingOutboundMessages)
        .where(eq(schema.pendingOutboundMessages.status, status))
        .orderBy(desc(schema.pendingOutboundMessages.createdAt));
    }
    return await db.select().from(schema.pendingOutboundMessages)
      .orderBy(desc(schema.pendingOutboundMessages.createdAt));
  }

  async getPendingOutboundMessage(id: string): Promise<schema.PendingOutboundMessage | undefined> {
    const [msg] = await db.select().from(schema.pendingOutboundMessages)
      .where(eq(schema.pendingOutboundMessages.id, id));
    return msg || undefined;
  }

  async updatePendingOutboundMessage(id: string, updates: Partial<schema.PendingOutboundMessage>): Promise<schema.PendingOutboundMessage> {
    const [updated] = await db.update(schema.pendingOutboundMessages)
      .set(updates)
      .where(eq(schema.pendingOutboundMessages.id, id))
      .returning();
    return updated;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(schema.employees).values(withTenant(employee)).returning();
    return newEmployee;
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(schema.employees).where(eq(schema.employees.id, id));
    return employee || undefined;
  }

  async getEmployeeByEmail(email: string): Promise<Employee | undefined> {
    // Order by role to prioritize admin over crew in case of duplicate emails
    const [employee] = await db.select()
      .from(schema.employees)
      .where(sql`lower(${schema.employees.email}) = lower(${email})`)
      .orderBy(sql`CASE WHEN ${schema.employees.role} = 'admin' THEN 0 WHEN ${schema.employees.role} = 'crew' THEN 1 ELSE 2 END`)
      .limit(1);
    return employee || undefined;
  }

  async updateEmployee(id: string, updates: UpdateEmployee): Promise<Employee> {
    const [updatedEmployee] = await db.update(schema.employees)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.employees.id, id))
      .returning();
    return updatedEmployee;
  }

  async getAllEmployees(): Promise<Employee[]> {
    return await db.select().from(schema.employees).orderBy(schema.employees.firstName, schema.employees.lastName);
  }

  async getActiveEmployees(): Promise<Employee[]> {
    return await db.select().from(schema.employees)
      .where(eq(schema.employees.isActive, true))
      .orderBy(schema.employees.firstName, schema.employees.lastName);
  }

  async getEmployeesByPosition(position: string): Promise<Employee[]> {
    return await db.select().from(schema.employees)
      .where(eq(schema.employees.position, position))
      .orderBy(schema.employees.firstName, schema.employees.lastName);
  }

  async getEmployeesBySkill(skill: string): Promise<Employee[]> {
    return await db.select().from(schema.employees)
      .where(sql`${schema.employees.skills} @> ${[skill]}`)
      .orderBy(schema.employees.firstName, schema.employees.lastName);
  }

  async deleteEmployee(id: string): Promise<void> {
    await db.delete(schema.employees).where(eq(schema.employees.id, id));
  }

  // Account deletion (App Store Guideline 5.1.1(v)). A hard row-delete would
  // violate the 20+ FK references to employees.id that have no ON DELETE rule,
  // so instead we irreversibly scrub the personal data and sever the login: the
  // account can no longer be authenticated and carries no PII. Operational
  // records the staff member touched (jobs, timesheets) keep referential
  // integrity but are de-identified. Also drops their push tokens.
  async anonymizeEmployeeForDeletion(id: string): Promise<void> {
    await db.update(schema.employees)
      .set({
        firstName: 'Deleted',
        lastName: 'User',
        email: null,
        phone: null,
        password: null,
        emergencyContact: null,
        emergencyContactPhone: null,
        notes: null,
        permissionOverrides: { grant: [], deny: [] },
        status: 'inactive',
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.employees.id, id));

    // Remove device push tokens so notifications stop reaching the old account.
    const tokens = await this.getFcmTokensByEmployee(id);
    for (const t of tokens) {
      await this.deleteFcmToken(t.id);
    }
  }

  // Role Tier Management
  async createRoleTier(tier: schema.InsertRoleTier): Promise<schema.RoleTier> {
    const [newTier] = await db.insert(schema.roleTiers).values(withTenant(tier as any)).returning();
    return newTier;
  }

  async getRoleTier(id: string): Promise<schema.RoleTier | undefined> {
    const [tier] = await db.select().from(schema.roleTiers).where(eq(schema.roleTiers.id, id));
    return tier || undefined;
  }

  async getRoleTierByKey(key: string): Promise<schema.RoleTier | undefined> {
    const [tier] = await db.select().from(schema.roleTiers).where(eq(schema.roleTiers.key, key));
    return tier || undefined;
  }

  async getAllRoleTiers(): Promise<schema.RoleTier[]> {
    return await db.select().from(schema.roleTiers).orderBy(schema.roleTiers.sortOrder, schema.roleTiers.name);
  }

  async updateRoleTier(id: string, updates: schema.UpdateRoleTier): Promise<schema.RoleTier> {
    const [updated] = await db.update(schema.roleTiers)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(schema.roleTiers.id, id))
      .returning();
    return updated;
  }

  async deleteRoleTier(id: string): Promise<void> {
    await db.delete(schema.roleTiers).where(eq(schema.roleTiers.id, id));
  }

  async getDefaultRoleTier(): Promise<schema.RoleTier | undefined> {
    const [tier] = await db.select().from(schema.roleTiers).where(eq(schema.roleTiers.isDefault, true)).limit(1);
    return tier || undefined;
  }

  async createScheduleEvent(event: InsertScheduleEvent): Promise<ScheduleEvent> {
    const [newEvent] = await db.insert(schema.scheduleEvents).values(withTenant(event)).returning();
    return newEvent;
  }
  
  async getScheduleEvent(id: string): Promise<ScheduleEvent | undefined> {
    const [event] = await db.select().from(schema.scheduleEvents).where(eq(schema.scheduleEvents.id, id));
    return event;
  }
  
  async updateScheduleEvent(id: string, updates: UpdateScheduleEvent): Promise<ScheduleEvent> {
    const [updated] = await db.update(schema.scheduleEvents)
      .set(updates)
      .where(eq(schema.scheduleEvents.id, id))
      .returning();
    return updated;
  }
  
  async getAllScheduleEvents(startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]> {
    let query = db.select().from(schema.scheduleEvents);
    if (startDate && endDate) {
      return await db.select().from(schema.scheduleEvents)
        .where(and(
          gte(schema.scheduleEvents.startTime, startDate),
          lte(schema.scheduleEvents.endTime, endDate)
        ))
        .orderBy(schema.scheduleEvents.startTime);
    }
    return await db.select().from(schema.scheduleEvents).orderBy(schema.scheduleEvents.startTime);
  }
  
  async getScheduleEventsByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]> {
    if (startDate && endDate) {
      return await db.select().from(schema.scheduleEvents)
        .where(and(
          eq(schema.scheduleEvents.employeeId, employeeId),
          gte(schema.scheduleEvents.startTime, startDate),
          lte(schema.scheduleEvents.endTime, endDate)
        ))
        .orderBy(schema.scheduleEvents.startTime);
    }
    return await db.select().from(schema.scheduleEvents)
      .where(eq(schema.scheduleEvents.employeeId, employeeId))
      .orderBy(schema.scheduleEvents.startTime);
  }
  
  async getScheduleEventsByJob(jobId: string): Promise<ScheduleEvent[]> {
    return await db.select().from(schema.scheduleEvents)
      .where(eq(schema.scheduleEvents.jobId, jobId))
      .orderBy(schema.scheduleEvents.startTime);
  }
  
  async deleteScheduleEvent(id: string): Promise<void> {
    await db.delete(schema.scheduleEvents).where(eq(schema.scheduleEvents.id, id));
  }

  async deleteScheduleEventsByJob(jobId: string): Promise<void> {
    await db.delete(schema.scheduleEvents).where(eq(schema.scheduleEvents.jobId, jobId));
  }

  async createJobStaffAssignment(assignment: InsertJobStaffAssignment): Promise<JobStaffAssignment> {
    const [newAssignment] = await db.insert(schema.jobStaffAssignments).values(withTenant(assignment)).returning();
    return newAssignment;
  }

  async getJobStaffAssignment(id: string): Promise<JobStaffAssignment | undefined> {
    const [assignment] = await db.select().from(schema.jobStaffAssignments).where(eq(schema.jobStaffAssignments.id, id));
    return assignment;
  }

  async getAllJobStaffAssignments(): Promise<JobStaffAssignment[]> {
    return await db.select().from(schema.jobStaffAssignments)
      .orderBy(schema.jobStaffAssignments.startTime);
  }

  async getJobStaffAssignmentsByJob(jobId: string): Promise<JobStaffAssignment[]> {
    return await db.select().from(schema.jobStaffAssignments)
      .where(eq(schema.jobStaffAssignments.jobId, jobId))
      .orderBy(schema.jobStaffAssignments.startTime);
  }

  async getJobStaffAssignmentsByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<JobStaffAssignment[]> {
    let query = db.select().from(schema.jobStaffAssignments)
      .where(eq(schema.jobStaffAssignments.employeeId, employeeId));

    if (startDate && endDate) {
      query = query.where(
        and(
          gte(schema.jobStaffAssignments.startTime, startDate),
          lte(schema.jobStaffAssignments.endTime, endDate)
        )
      );
    }

    return await query.orderBy(schema.jobStaffAssignments.startTime);
  }

  async checkStaffConflicts(employeeIds: string[], startTime: Date, endTime: Date, excludeJobId?: string): Promise<{employeeId: string; conflicts: JobStaffAssignment[]}[]> {
    const conflicts: {employeeId: string; conflicts: JobStaffAssignment[]}[] = [];
    
    for (const employeeId of employeeIds) {
      // Build conditions array for proper time overlap detection
      const conditions = [
        eq(schema.jobStaffAssignments.employeeId, employeeId),
        // Check for time overlap: assignment starts before requested end AND ends after requested start
        lt(schema.jobStaffAssignments.startTime, endTime),
        gt(schema.jobStaffAssignments.endTime, startTime),
        // Only include active assignments
        ne(schema.jobStaffAssignments.status, 'cancelled' as any)
      ];

      // Add exclude condition if provided
      if (excludeJobId) {
        conditions.push(ne(schema.jobStaffAssignments.jobId, excludeJobId));
      }

      // Find assignments that overlap with the requested time period
      const employeeConflicts = await db.select()
        .from(schema.jobStaffAssignments)
        .where(and(...conditions));
      
      if (employeeConflicts.length > 0) {
        conflicts.push({ employeeId, conflicts: employeeConflicts });
      }
    }

    return conflicts;
  }

  async updateJobStaffAssignment(id: string, updates: Partial<InsertJobStaffAssignment>): Promise<JobStaffAssignment> {
    const [updated] = await db.update(schema.jobStaffAssignments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.jobStaffAssignments.id, id))
      .returning();
    return updated;
  }

  async deleteJobStaffAssignment(id: string): Promise<void> {
    await db.delete(schema.jobStaffAssignments).where(eq(schema.jobStaffAssignments.id, id));
  }

  async deleteJobStaffAssignmentsByJob(jobId: string): Promise<void> {
    await db.delete(schema.jobStaffAssignments).where(eq(schema.jobStaffAssignments.jobId, jobId));
  }

  async createProposal(proposal: InsertProposal): Promise<Proposal> {
    const [created] = await db.insert(schema.proposals).values(withTenant(proposal)).returning();
    return created;
  }
  async getProposal(id: string): Promise<Proposal | undefined> {
    const [proposal] = await db.select().from(schema.proposals).where(eq(schema.proposals.id, id));
    return proposal || undefined;
  }
  
  async updateProposal(id: string, updates: UpdateProposal): Promise<Proposal> {
    const [updated] = await db.update(schema.proposals)
      .set(updates)
      .where(eq(schema.proposals.id, id))
      .returning();
    return updated;
  }
  
  async getProposalsByCustomer(customerId: string): Promise<Proposal[]> {
    const proposals = await db.select().from(schema.proposals)
      .where(eq(schema.proposals.customerId, customerId));
    return proposals;
  }
  
  async getProposalsByQuote(quoteId: string): Promise<Proposal[]> {
    const proposals = await db.select().from(schema.proposals)
      .where(eq(schema.proposals.quoteId, quoteId));
    return proposals;
  }
  
  async getProposalsByJob(jobId: string): Promise<Proposal[]> {
    const proposals = await db.select().from(schema.proposals)
      .where(eq(schema.proposals.jobId, jobId));
    return proposals;
  }
  
  async getAllProposals(): Promise<Proposal[]> {
    const proposals = await db.select().from(schema.proposals);
    return proposals;
  }
  
  async deleteProposal(id: string): Promise<void> {
    await db.delete(schema.proposals).where(eq(schema.proposals.id, id));
  }

  async createProposalSection(section: InsertProposalSection): Promise<ProposalSection> {
    const [newSection] = await db.insert(schema.proposalSections).values(withTenant(section)).returning();
    return newSection;
  }
  
  async getProposalSection(id: string): Promise<ProposalSection | undefined> {
    const [section] = await db.select().from(schema.proposalSections).where(eq(schema.proposalSections.id, id));
    return section;
  }
  
  async updateProposalSection(id: string, updates: UpdateProposalSection): Promise<ProposalSection> {
    const [updated] = await db.update(schema.proposalSections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.proposalSections.id, id))
      .returning();
    return updated;
  }
  
  async getProposalSectionsByProposal(proposalId: string): Promise<ProposalSection[]> {
    const sections = await db.select()
      .from(schema.proposalSections)
      .where(eq(schema.proposalSections.proposalId, proposalId))
      .orderBy(schema.proposalSections.sortOrder);
    return sections;
  }

  async getProposalSectionsByProposalIds(proposalIds: string[]): Promise<ProposalSection[]> {
    if (proposalIds.length === 0) return [];
    const sections = await db.select()
      .from(schema.proposalSections)
      .where(inArray(schema.proposalSections.proposalId, proposalIds))
      .orderBy(schema.proposalSections.proposalId, schema.proposalSections.sortOrder);
    return sections;
  }
  
  async deleteProposalSection(id: string): Promise<void> {
    await db.delete(schema.proposalSections).where(eq(schema.proposalSections.id, id));
  }
  
  async reorderProposalSections(proposalId: string, sectionIds: string[]): Promise<ProposalSection[]> {
    for (let i = 0; i < sectionIds.length; i++) {
      await db.update(schema.proposalSections)
        .set({ sortOrder: i })
        .where(eq(schema.proposalSections.id, sectionIds[i]));
    }
    return this.getProposalSectionsByProposal(proposalId);
  }

  async createProposalLineItem(item: InsertProposalLineItem): Promise<ProposalLineItem> {
    const [newItem] = await db.insert(schema.proposalLineItems).values(withTenant(item)).returning();
    return newItem;
  }
  
  async getProposalLineItem(id: string): Promise<ProposalLineItem | undefined> {
    const [item] = await db.select().from(schema.proposalLineItems).where(eq(schema.proposalLineItems.id, id));
    return item;
  }
  
  async updateProposalLineItem(id: string, updates: UpdateProposalLineItem): Promise<ProposalLineItem> {
    const [updated] = await db.update(schema.proposalLineItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.proposalLineItems.id, id))
      .returning();
    return updated;
  }
  
  async getProposalLineItemsByProposal(proposalId: string): Promise<ProposalLineItem[]> {
    const items = await db.select()
      .from(schema.proposalLineItems)
      .where(eq(schema.proposalLineItems.proposalId, proposalId))
      .orderBy(schema.proposalLineItems.sortOrder);
    return items;
  }

  async getProposalLineItemsByProposalIds(proposalIds: string[]): Promise<ProposalLineItem[]> {
    if (proposalIds.length === 0) return [];
    const items = await db.select()
      .from(schema.proposalLineItems)
      .where(inArray(schema.proposalLineItems.proposalId, proposalIds))
      .orderBy(schema.proposalLineItems.proposalId, schema.proposalLineItems.sortOrder);
    return items;
  }
  
  async deleteProposalLineItem(id: string): Promise<void> {
    await db.delete(schema.proposalLineItems).where(eq(schema.proposalLineItems.id, id));
  }
  
  async reorderProposalLineItems(proposalId: string, itemIds: string[]): Promise<ProposalLineItem[]> {
    for (let i = 0; i < itemIds.length; i++) {
      await db.update(schema.proposalLineItems)
        .set({ sortOrder: i })
        .where(eq(schema.proposalLineItems.id, itemIds[i]));
    }
    return this.getProposalLineItemsByProposal(proposalId);
  }

  async createProposalLineItemChoice(choice: InsertProposalLineItemChoice): Promise<ProposalLineItemChoice> {
    const [newChoice] = await db.insert(schema.proposalLineItemChoices).values(withTenant(choice)).returning();
    return newChoice;
  }
  
  async getProposalLineItemChoice(id: string): Promise<ProposalLineItemChoice | undefined> {
    const [choice] = await db.select().from(schema.proposalLineItemChoices).where(eq(schema.proposalLineItemChoices.id, id));
    return choice;
  }
  
  async updateProposalLineItemChoice(id: string, updates: UpdateProposalLineItemChoice): Promise<ProposalLineItemChoice> {
    const [updated] = await db.update(schema.proposalLineItemChoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.proposalLineItemChoices.id, id))
      .returning();
    return updated;
  }
  
  async getProposalLineItemChoicesByLineItem(lineItemId: string): Promise<ProposalLineItemChoice[]> {
    const choices = await db.select()
      .from(schema.proposalLineItemChoices)
      .where(eq(schema.proposalLineItemChoices.lineItemId, lineItemId))
      .orderBy(schema.proposalLineItemChoices.sortOrder);
    return choices;
  }
  
  async deleteProposalLineItemChoice(id: string): Promise<void> {
    await db.delete(schema.proposalLineItemChoices).where(eq(schema.proposalLineItemChoices.id, id));
  }
  
  async deleteProposalLineItemChoicesByLineItem(lineItemId: string): Promise<void> {
    await db.delete(schema.proposalLineItemChoices).where(eq(schema.proposalLineItemChoices.lineItemId, lineItemId));
  }

  async createEquipment(equipment: InsertEquipment): Promise<Equipment> {
    const [newEquipment] = await db.insert(schema.equipment).values(withTenant(equipment)).returning();
    return newEquipment;
  }
  
  async getEquipment(id: string): Promise<Equipment | undefined> {
    const [equipment] = await db.select().from(schema.equipment).where(eq(schema.equipment.id, id));
    return equipment;
  }
  
  async updateEquipment(id: string, updates: UpdateEquipment): Promise<Equipment> {
    const [updated] = await db.update(schema.equipment)
      .set(updates)
      .where(eq(schema.equipment.id, id))
      .returning();
    return updated;
  }
  
  async getAllEquipment(): Promise<Equipment[]> {
    return await db.select().from(schema.equipment).orderBy(desc(schema.equipment.createdAt));
  }
  
  async getAvailableEquipment(): Promise<Equipment[]> {
    return await db.select().from(schema.equipment)
      .where(eq(schema.equipment.status, 'available'))
      .orderBy(desc(schema.equipment.createdAt));
  }
  
  async getEquipmentByType(type: string): Promise<Equipment[]> {
    return await db.select().from(schema.equipment)
      .where(eq(schema.equipment.type, type))
      .orderBy(desc(schema.equipment.createdAt));
  }
  
  async getEquipmentByStatus(status: string): Promise<Equipment[]> {
    return await db.select().from(schema.equipment)
      .where(eq(schema.equipment.status, status))
      .orderBy(desc(schema.equipment.createdAt));
  }
  
  async deleteEquipment(id: string): Promise<void> {
    await db.delete(schema.equipment).where(eq(schema.equipment.id, id));
  }

  async createEquipmentMaintenance(maintenance: InsertEquipmentMaintenance): Promise<EquipmentMaintenance> { throw new Error("Not implemented"); }
  async getEquipmentMaintenance(id: string): Promise<EquipmentMaintenance | undefined> { return undefined; }
  async getMaintenanceByEquipment(equipmentId: string): Promise<EquipmentMaintenance[]> { return []; }
  async getAllMaintenanceRecords(): Promise<EquipmentMaintenance[]> { return []; }

  async createInventoryItem(item: InsertInventory): Promise<Inventory> { throw new Error("Not implemented"); }
  async getInventoryItem(id: string): Promise<Inventory | undefined> { return undefined; }
  async updateInventoryItem(id: string, updates: Partial<InsertInventory>): Promise<Inventory> { throw new Error("Not implemented"); }
  async getAllInventory(): Promise<Inventory[]> { return []; }
  async getLowStockItems(): Promise<Inventory[]> { return []; }
  async getInventoryByCategory(category: string): Promise<Inventory[]> { return []; }

  async checkoutEquipment(checkout: InsertEquipmentCheckout): Promise<EquipmentCheckout> { throw new Error("Not implemented"); }
  async checkinEquipment(checkoutId: string, returnData: any): Promise<EquipmentCheckout> { throw new Error("Not implemented"); }
  async getActiveCheckouts(): Promise<EquipmentCheckout[]> { return []; }
  async getOverdueCheckouts(): Promise<EquipmentCheckout[]> { return []; }
  async getCheckoutHistory(equipmentId?: string): Promise<EquipmentCheckout[]> { return []; }

  async createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction> { throw new Error("Not implemented"); }
  async getInventoryTransactions(inventoryId: string): Promise<InventoryTransaction[]> { return []; }
  async getTransactionsByType(type: string): Promise<InventoryTransaction[]> { return []; }

  // Vehicle Pre-Start Inspection System Implementation
  // Inspection Templates
  async createInspectionTemplate(template: InsertInspectionTemplate): Promise<InspectionTemplate> {
    const [result] = await db.insert(schema.inspectionTemplates).values(withTenant(template)).returning();
    return result;
  }

  async getInspectionTemplate(id: string): Promise<InspectionTemplate | undefined> {
    const [result] = await db.select().from(schema.inspectionTemplates).where(eq(schema.inspectionTemplates.id, id));
    return result;
  }

  async updateInspectionTemplate(id: string, updates: UpdateInspectionTemplate): Promise<InspectionTemplate> {
    const [result] = await db.update(schema.inspectionTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.inspectionTemplates.id, id))
      .returning();
    return result;
  }

  async deleteInspectionTemplate(id: string): Promise<void> {
    await db.delete(schema.inspectionTemplates).where(eq(schema.inspectionTemplates.id, id));
  }

  async getAllInspectionTemplates(): Promise<InspectionTemplate[]> {
    return await db.select().from(schema.inspectionTemplates)
      .where(eq(schema.inspectionTemplates.isActive, true))
      .orderBy(desc(schema.inspectionTemplates.createdAt));
  }

  async getDefaultTemplate(vehicleType?: string): Promise<InspectionTemplate | undefined> {
    const query = db.select().from(schema.inspectionTemplates)
      .where(and(
        eq(schema.inspectionTemplates.isDefault, true),
        eq(schema.inspectionTemplates.isActive, true),
        vehicleType ? eq(schema.inspectionTemplates.vehicleType, vehicleType) : sql`true`
      ));
    const [result] = await query;
    return result;
  }

  async setDefaultTemplate(id: string): Promise<InspectionTemplate> {
    const template = await this.getInspectionTemplate(id);
    if (!template) throw new Error("Template not found");

    // Single global default — unset any other template currently flagged as
    // default. (Templates used to be scoped by vehicleType, but the field has
    // been retired so the default is one-per-list.)
    await db.update(schema.inspectionTemplates)
      .set({ isDefault: false })
      .where(eq(schema.inspectionTemplates.isDefault, true));

    return await this.updateInspectionTemplate(id, { isDefault: true });
  }

  // Inspection Checklist Items
  async createChecklistItem(item: InsertInspectionChecklistItem): Promise<InspectionChecklistItem> {
    const [result] = await db.insert(schema.inspectionChecklistItems).values(withTenant(item)).returning();
    return result;
  }

  async getChecklistItem(id: string): Promise<InspectionChecklistItem | undefined> {
    const [result] = await db.select().from(schema.inspectionChecklistItems)
      .where(eq(schema.inspectionChecklistItems.id, id));
    return result;
  }

  async updateChecklistItem(id: string, updates: UpdateInspectionChecklistItem): Promise<InspectionChecklistItem> {
    const [result] = await db.update(schema.inspectionChecklistItems)
      .set(updates)
      .where(eq(schema.inspectionChecklistItems.id, id))
      .returning();
    return result;
  }

  async deleteChecklistItem(id: string): Promise<void> {
    await db.delete(schema.inspectionChecklistItems).where(eq(schema.inspectionChecklistItems.id, id));
  }

  async getChecklistItemsByTemplate(templateId: string): Promise<InspectionChecklistItem[]> {
    return await db.select().from(schema.inspectionChecklistItems)
      .where(and(
        eq(schema.inspectionChecklistItems.templateId, templateId),
        eq(schema.inspectionChecklistItems.isActive, true)
      ))
      .orderBy(schema.inspectionChecklistItems.sortOrder);
  }

  async reorderChecklistItems(templateId: string, itemIds: string[]): Promise<void> {
    // Update sort order for each item
    for (let i = 0; i < itemIds.length; i++) {
      await db.update(schema.inspectionChecklistItems)
        .set({ sortOrder: i })
        .where(eq(schema.inspectionChecklistItems.id, itemIds[i]));
    }
  }

  // Vehicle Inspections
  async createVehicleInspection(inspection: InsertVehicleInspection): Promise<VehicleInspection> {
    const [result] = await db.insert(schema.vehicleInspections).values(withTenant(inspection)).returning();
    return result;
  }

  async getVehicleInspection(id: string): Promise<VehicleInspection | undefined> {
    const [result] = await db.select().from(schema.vehicleInspections)
      .where(eq(schema.vehicleInspections.id, id));
    return result;
  }

  async updateVehicleInspection(id: string, updates: UpdateVehicleInspection): Promise<VehicleInspection> {
    const [result] = await db.update(schema.vehicleInspections)
      .set(updates)
      .where(eq(schema.vehicleInspections.id, id))
      .returning();
    return result;
  }

  async getAllVehicleInspections(filters?: { vehicleId?: string; status?: string; dateFrom?: Date; dateTo?: Date }): Promise<VehicleInspection[]> {
    let query = db.select().from(schema.vehicleInspections);
    
    const conditions = [];
    if (filters?.vehicleId) {
      conditions.push(eq(schema.vehicleInspections.vehicleId, filters.vehicleId));
    }
    if (filters?.status) {
      conditions.push(eq(schema.vehicleInspections.status, filters.status));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(schema.vehicleInspections.inspectionDate, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(schema.vehicleInspections.inspectionDate, filters.dateTo));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(schema.vehicleInspections.inspectionDate));
  }

  async getVehicleInspectionsByVehicle(vehicleId: string): Promise<VehicleInspection[]> {
    return await db.select().from(schema.vehicleInspections)
      .where(eq(schema.vehicleInspections.vehicleId, vehicleId))
      .orderBy(desc(schema.vehicleInspections.inspectionDate));
  }

  async getLatestInspection(vehicleId: string): Promise<VehicleInspection | undefined> {
    const [result] = await db.select().from(schema.vehicleInspections)
      .where(eq(schema.vehicleInspections.vehicleId, vehicleId))
      .orderBy(desc(schema.vehicleInspections.inspectionDate))
      .limit(1);
    return result;
  }

  // Inspection Responses
  async createInspectionResponse(response: InsertInspectionResponse): Promise<InspectionResponse> {
    const [result] = await db.insert(schema.inspectionResponses).values(withTenant(response)).returning();
    return result;
  }

  async getInspectionResponses(inspectionId: string): Promise<InspectionResponse[]> {
    return await db.select().from(schema.inspectionResponses)
      .where(eq(schema.inspectionResponses.inspectionId, inspectionId))
      .orderBy(schema.inspectionResponses.sortOrder);
  }

  // Equipment Induction System Implementation
  async createInductionTemplate(template: InsertInductionTemplate): Promise<InductionTemplate> {
    const [result] = await db.insert(schema.inductionTemplates).values(withTenant(template)).returning();
    return result;
  }

  async getInductionTemplate(id: string): Promise<InductionTemplate | undefined> {
    const [result] = await db.select().from(schema.inductionTemplates)
      .where(eq(schema.inductionTemplates.id, id));
    return result;
  }

  async updateInductionTemplate(id: string, updates: UpdateInductionTemplate): Promise<InductionTemplate> {
    const [result] = await db.update(schema.inductionTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.inductionTemplates.id, id))
      .returning();
    return result;
  }

  async deleteInductionTemplate(id: string): Promise<void> {
    await db.delete(schema.inductionTemplates).where(eq(schema.inductionTemplates.id, id));
  }

  async getAllInductionTemplates(): Promise<InductionTemplate[]> {
    return await db.select().from(schema.inductionTemplates)
      .where(eq(schema.inductionTemplates.isActive, true))
      .orderBy(desc(schema.inductionTemplates.createdAt));
  }

  async getInductionTemplatesByType(equipmentType: string): Promise<InductionTemplate[]> {
    return await db.select().from(schema.inductionTemplates)
      .where(and(
        eq(schema.inductionTemplates.isActive, true),
        eq(schema.inductionTemplates.equipmentType, equipmentType),
      ))
      .orderBy(desc(schema.inductionTemplates.createdAt));
  }

  async createInductionChecklistItem(item: InsertInductionChecklistItem): Promise<InductionChecklistItem> {
    const [result] = await db.insert(schema.inductionChecklistItems).values(withTenant(item)).returning();
    return result;
  }

  async getInductionChecklistItem(id: string): Promise<InductionChecklistItem | undefined> {
    const [result] = await db.select().from(schema.inductionChecklistItems)
      .where(eq(schema.inductionChecklistItems.id, id));
    return result;
  }

  async updateInductionChecklistItem(id: string, updates: UpdateInductionChecklistItem): Promise<InductionChecklistItem> {
    const [result] = await db.update(schema.inductionChecklistItems)
      .set(updates)
      .where(eq(schema.inductionChecklistItems.id, id))
      .returning();
    return result;
  }

  async deleteInductionChecklistItem(id: string): Promise<void> {
    await db.delete(schema.inductionChecklistItems).where(eq(schema.inductionChecklistItems.id, id));
  }

  async getInductionChecklistItemsByTemplate(templateId: string): Promise<InductionChecklistItem[]> {
    return await db.select().from(schema.inductionChecklistItems)
      .where(and(
        eq(schema.inductionChecklistItems.templateId, templateId),
        eq(schema.inductionChecklistItems.isActive, true),
      ))
      .orderBy(schema.inductionChecklistItems.sortOrder);
  }

  async reorderInductionChecklistItems(templateId: string, itemIds: string[]): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      await db.update(schema.inductionChecklistItems)
        .set({ sortOrder: i })
        .where(eq(schema.inductionChecklistItems.id, itemIds[i]));
    }
  }

  async createEquipmentInduction(induction: InsertEquipmentInduction): Promise<EquipmentInduction> {
    const [result] = await db.insert(schema.equipmentInductions).values(withTenant(induction)).returning();
    return result;
  }

  async getEquipmentInduction(id: string): Promise<EquipmentInduction | undefined> {
    const [result] = await db.select().from(schema.equipmentInductions)
      .where(eq(schema.equipmentInductions.id, id));
    return result;
  }

  async updateEquipmentInduction(id: string, updates: UpdateEquipmentInduction): Promise<EquipmentInduction> {
    const [result] = await db.update(schema.equipmentInductions)
      .set(updates)
      .where(eq(schema.equipmentInductions.id, id))
      .returning();
    return result;
  }

  async getAllEquipmentInductions(filters?: { employeeId?: string; equipmentType?: string }): Promise<EquipmentInduction[]> {
    const conditions = [];
    if (filters?.employeeId) {
      conditions.push(eq(schema.equipmentInductions.employeeId, filters.employeeId));
    }
    if (filters?.equipmentType) {
      conditions.push(eq(schema.equipmentInductions.equipmentType, filters.equipmentType));
    }

    let query = db.select().from(schema.equipmentInductions);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    return await query.orderBy(desc(schema.equipmentInductions.inductionDate));
  }

  async getEquipmentInductionsByEmployee(employeeId: string): Promise<EquipmentInduction[]> {
    return await db.select().from(schema.equipmentInductions)
      .where(eq(schema.equipmentInductions.employeeId, employeeId))
      .orderBy(desc(schema.equipmentInductions.inductionDate));
  }

  async getInductionStatusForEmployee(employeeId: string): Promise<Array<{ templateId: string; templateName: string; equipmentType: string | null; completedAt: Date | null; inductionId: string | null }>> {
    const templates = await db.select().from(schema.inductionTemplates)
      .where(eq(schema.inductionTemplates.isActive, true))
      .orderBy(desc(schema.inductionTemplates.createdAt));

    const inductions = await db.select().from(schema.equipmentInductions)
      .where(eq(schema.equipmentInductions.employeeId, employeeId))
      .orderBy(desc(schema.equipmentInductions.inductionDate));

    return templates.map((t) => {
      const latest = inductions.find((i) => i.templateId === t.id);
      return {
        templateId: t.id,
        templateName: t.name,
        equipmentType: t.equipmentType,
        completedAt: latest?.completedAt ?? latest?.inductionDate ?? null,
        inductionId: latest?.id ?? null,
      };
    });
  }

  async createInductionResponse(response: InsertInductionResponse): Promise<InductionResponse> {
    const [result] = await db.insert(schema.inductionResponses).values(withTenant(response)).returning();
    return result;
  }

  async getInductionResponses(inductionId: string): Promise<InductionResponse[]> {
    return await db.select().from(schema.inductionResponses)
      .where(eq(schema.inductionResponses.inductionId, inductionId))
      .orderBy(schema.inductionResponses.sortOrder);
  }

  // Registration & COF Expiry Checks
  async getVehiclesWithExpiringDocs(daysAhead: number): Promise<Equipment[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const today = new Date();
    
    return await db.select().from(schema.equipment)
      .where(and(
        eq(schema.equipment.type, 'vehicle'),
        eq(schema.equipment.isActive, true),
        sql`(${schema.equipment.registrationExpiryDate} BETWEEN ${today} AND ${futureDate} 
             OR ${schema.equipment.cofExpiryDate} BETWEEN ${today} AND ${futureDate})`
      ))
      .orderBy(schema.equipment.registrationExpiryDate);
  }

  async getExpiredVehicles(): Promise<Equipment[]> {
    const today = new Date();
    
    return await db.select().from(schema.equipment)
      .where(and(
        eq(schema.equipment.type, 'vehicle'),
        eq(schema.equipment.isActive, true),
        sql`(${schema.equipment.registrationExpiryDate} < ${today} 
             OR ${schema.equipment.cofExpiryDate} < ${today})`
      ))
      .orderBy(schema.equipment.registrationExpiryDate);
  }

  async getBusinessSettings(): Promise<BusinessSettings> {
    // Try to get existing business settings from database.
    // Deterministic ordering guards against stray duplicate rows for a tenant:
    // prefer the canonical id='default' row, then the oldest. Without this,
    // LIMIT 1 returned an arbitrary row and a tenant's name/contact details
    // could silently flip to a junk duplicate's values.
    const [existing] = await db
      .select()
      .from(schema.businessSettings)
      .orderBy(sql`(${schema.businessSettings.id} = 'default') DESC`, asc(schema.businessSettings.createdAt))
      .limit(1);
    if (existing) {
      return existing;
    }
    
    // Create default settings if none exist. NOTE: do NOT hardcode id — each tenant needs
    // its own row (the id column defaults to gen_random_uuid()). Hardcoding 'default' caused
    // a primary-key clash for the 2nd tenant. Generic placeholders; the tenant edits these.
    const [created] = await db.insert(schema.businessSettings).values(withTenant({
      businessName: 'My Business',
      businessEmail: '',
      businessPhone: '',
      businessAddress: '',
    })).returning();
    
    return created;
  }
  
  async updateBusinessSettings(updates: UpdateBusinessSettings): Promise<BusinessSettings> {
    // Ensure we have a settings record first
    const existing = await this.getBusinessSettings();
    
    // Update the settings
    const [updated] = await db.update(schema.businessSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.businessSettings.id, existing.id))
      .returning();
    
    return updated;
  }
  async resetBusinessSettings(): Promise<BusinessSettings> { throw new Error("Not implemented"); }

  async createCommunication(communication: InsertCommunication): Promise<Communication> { throw new Error("Not implemented"); }
  async getCommunication(id: string): Promise<Communication | undefined> { return undefined; }
  async updateCommunication(id: string, updates: UpdateCommunication): Promise<Communication> { throw new Error("Not implemented"); }
  async getAllCommunications(filters?: any): Promise<Communication[]> { return []; }
  async getCommunicationsByCustomer(customerId: string): Promise<Communication[]> { return []; }
  async getCommunicationsByLead(leadId: string): Promise<Communication[]> { return []; }
  async getCommunicationsByJob(jobId: string): Promise<Communication[]> { return []; }
  async markCommunicationAsRead(id: string): Promise<Communication> { throw new Error("Not implemented"); }
  async starCommunication(id: string, starred: boolean): Promise<Communication> { throw new Error("Not implemented"); }
  async archiveCommunication(id: string): Promise<Communication> { throw new Error("Not implemented"); }
  async getCommunicationStats(): Promise<any> {
    return {
      total: 0,
      unread: 0,
      starred: 0,
      archived: 0,
      byPlatform: [],
      byPriority: []
    };
  }

  // ========================================
  // EMAIL EVENT TRACKING
  // ========================================

  async createEmailEvent(event: {
    messageId: string;
    eventType: string;
    recipient?: string;
    timestamp: Date;
    userAgent?: string;
    ipAddress?: string;
    linkUrl?: string;
    rawPayload?: any;
  }): Promise<any> {
    const [newEvent] = await db.insert(schema.emailEvents).values(withTenant({
      messageId: event.messageId,
      eventType: event.eventType,
      recipient: event.recipient,
      timestamp: event.timestamp,
      userAgent: event.userAgent,
      ipAddress: event.ipAddress,
      linkUrl: event.linkUrl,
      rawPayload: event.rawPayload
    })).returning();
    return newEvent;
  }

  async getEmailEventsByMessageId(messageId: string): Promise<any[]> {
    const events = await db.select()
      .from(schema.emailEvents)
      .where(eq(schema.emailEvents.messageId, messageId))
      .orderBy(desc(schema.emailEvents.timestamp));
    return events;
  }

  async getEmailActivitySummary(messageId: string): Promise<{ opens: number; clicks: number; events: any[]; lastEventAt: Date | null }> {
    const events = await this.getEmailEventsByMessageId(messageId);
    
    const opens = events.filter(e => e.eventType === 'email.opened').length;
    const clicks = events.filter(e => e.eventType === 'email.clicked').length;
    const lastEventAt = events.length > 0 ? events[0].timestamp : null;
    
    return { opens, clicks, events, lastEventAt };
  }

  // ========================================
  // CONVERSATION MANAGEMENT
  // ========================================
  
  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db.insert(schema.conversations).values(withTenant(conversation)).returning();
    return newConversation;
  }

  async getConversation(id: string): Promise<any> {
    // Get the conversation first
    const [conversation] = await db.select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, id));
    
    if (!conversation) return undefined;
    
    // If there's a customerId, fetch customer data separately
    if (conversation.customerId) {
      const [customer] = await db.select()
        .from(schema.customers)
        .where(eq(schema.customers.id, conversation.customerId));
      
      if (customer) {
        return {
          ...conversation,
          customerName: customer.name || undefined,
          customerPhone: customer.phone || customer.mobile,
          customerEmail: customer.email,
          customerAddress: customer.address
        };
      }
    }
    
    // Return conversation without customer data
    return conversation;
  }

  async updateConversation(id: string, updates: UpdateConversation): Promise<Conversation> {
    const [conversation] = await db.update(schema.conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.conversations.id, id))
      .returning();
    return conversation;
  }

  async deleteConversation(id: string): Promise<void> {
    await db.delete(schema.conversations).where(eq(schema.conversations.id, id));
  }

  async getAllConversations(filters?: {
    status?: string;
    priority?: string;
    assignedTo?: string;
    source?: string;
    serviceType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Conversation[]> {
    const conditions: any[] = [];
    
    if (filters) {
      if (filters.status) conditions.push(eq(schema.conversations.status, filters.status));
      if (filters.priority) conditions.push(eq(schema.conversations.priority, filters.priority));
      if (filters.assignedTo) conditions.push(eq(schema.conversations.assignedTo, filters.assignedTo));
      if (filters.source) conditions.push(eq(schema.conversations.source, filters.source));
      if (filters.serviceType) conditions.push(eq(schema.conversations.serviceType, filters.serviceType));
      if (filters.search) {
        conditions.push(
          sql`${schema.conversations.title} ILIKE ${'%' + filters.search + '%'}`
        );
      }
    }
    
    // Subquery to get the first message's contact info for each conversation
    const firstMessageSubquery = db
      .select({
        conversationId: schema.conversationMessages.conversationId,
        fromName: schema.conversationMessages.fromName,
        fromContact: schema.conversationMessages.fromContact,
        rowNum: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${schema.conversationMessages.conversationId} ORDER BY ${schema.conversationMessages.createdAt} ASC)`.as('row_num')
      })
      .from(schema.conversationMessages)
      .where(eq(schema.conversationMessages.direction, 'inbound'))
      .as('first_message');
    
    let baseQuery = db
      .select({
        conversations: schema.conversations,
        customerName: schema.customers.name,
        customerEmail: schema.customers.email,
        customerPhone: schema.customers.phone,
        customerMobile: schema.customers.mobile,
        senderName: firstMessageSubquery.fromName,
        senderContact: firstMessageSubquery.fromContact
      })
      .from(schema.conversations)
      .leftJoin(schema.customers, eq(schema.conversations.customerId, schema.customers.id))
      .leftJoin(
        firstMessageSubquery,
        and(
          eq(schema.conversations.id, firstMessageSubquery.conversationId),
          eq(firstMessageSubquery.rowNum, 1)
        )
      );
    
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions)) as any;
    }
    
    baseQuery = baseQuery.orderBy(desc(schema.conversations.lastMessageAt)) as any;
    
    if (filters?.limit) {
      baseQuery = baseQuery.limit(filters.limit) as any;
    }
    
    if (filters?.offset) {
      baseQuery = baseQuery.offset(filters.offset) as any;
    }
    
    const results = await baseQuery;
    
    // Map results to include customer/sender contact info in the conversation object
    return results.map((row: any) => ({
      ...row.conversations,
      customerName: row.customerName || row.senderName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone || row.customerMobile,
      senderContact: row.senderContact
    })) as Conversation[];
  }

  async getConversationsByLead(leadId: string): Promise<Conversation[]> {
    return await db.select().from(schema.conversations)
      .where(eq(schema.conversations.leadId, leadId))
      .orderBy(desc(schema.conversations.lastMessageAt));
  }

  async getConversationsByCustomer(customerId: string): Promise<Conversation[]> {
    return await db.select().from(schema.conversations)
      .where(eq(schema.conversations.customerId, customerId))
      .orderBy(desc(schema.conversations.lastMessageAt));
  }

  async convertConversationToQuote(id: string, quoteId: string): Promise<Conversation> {
    const [conversation] = await db.update(schema.conversations)
      .set({ 
        convertedToQuoteId: quoteId, 
        conversionDate: new Date(),
        status: 'converted',
        updatedAt: new Date()
      })
      .where(eq(schema.conversations.id, id))
      .returning();
    return conversation;
  }

  async getUnreadConversationsCount(userId?: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(schema.conversations)
      .where(
        and(
          sql`${schema.conversations.unreadCount} > 0`,
          userId ? eq(schema.conversations.assignedTo, userId) : sql`true`
        )
      );
    return result[0]?.count || 0;
  }

  // ========================================
  // CONVERSATION MESSAGE MANAGEMENT
  // ========================================
  
  async createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const [newMessage] = await db.insert(schema.conversationMessages).values(withTenant(message)).returning();
    
    // Update conversation's last message info
    await db.update(schema.conversations)
      .set({
        lastMessageAt: new Date(),
        lastMessageBy: message.direction === 'inbound' ? 'customer' : 'staff',
        unreadCount: message.direction === 'inbound' ? sql`${schema.conversations.unreadCount} + 1` : schema.conversations.unreadCount,
        updatedAt: new Date()
      })
      .where(eq(schema.conversations.id, message.conversationId));
    
    return newMessage;
  }

  async getConversationMessage(id: string): Promise<ConversationMessage | undefined> {
    const [message] = await db.select().from(schema.conversationMessages).where(eq(schema.conversationMessages.id, id));
    return message || undefined;
  }

  async updateConversationMessage(id: string, updates: UpdateConversationMessage): Promise<ConversationMessage> {
    const [message] = await db.update(schema.conversationMessages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.conversationMessages.id, id))
      .returning();
    return message;
  }

  async deleteConversationMessage(id: string): Promise<void> {
    await db.delete(schema.conversationMessages).where(eq(schema.conversationMessages.id, id));
  }

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    return await db.select().from(schema.conversationMessages)
      .where(eq(schema.conversationMessages.conversationId, conversationId))
      .orderBy(schema.conversationMessages.createdAt);
  }

  async markConversationMessagesAsRead(conversationId: string, readBy: string): Promise<void> {
    // Mark all unread messages as read
    await db.update(schema.conversationMessages)
      .set({ 
        isRead: true, 
        readAt: new Date(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(schema.conversationMessages.conversationId, conversationId),
          eq(schema.conversationMessages.isRead, false)
        )
      );
    
    // Reset unread count on conversation
    await db.update(schema.conversations)
      .set({ 
        unreadCount: 0,
        updatedAt: new Date()
      })
      .where(eq(schema.conversations.id, conversationId));
  }

  async createPhoto(data: InsertPhoto): Promise<Photo> { throw new Error("Not implemented"); }
  async getPhoto(id: string): Promise<Photo | undefined> { return undefined; }
  async updatePhoto(id: string, updates: UpdatePhoto): Promise<Photo> { throw new Error("Not implemented"); }
  async deletePhoto(id: string): Promise<void> { }
  async getPhotosByJob(jobId: string, filters?: any): Promise<Photo[]> { return []; }
  async getPhotosByCustomer(customerId: string): Promise<Photo[]> { return []; }
  async getPublicPhotos(limit?: number, offset?: number): Promise<Photo[]> { return []; }
  async getFeaturedPhotos(limit?: number): Promise<Photo[]> { return []; }
  async getPhotosByType(type: string, jobId?: string): Promise<Photo[]> { return []; }
  async getBeforeAfterPairs(jobId: string): Promise<Photo[][]> { return []; }
  async searchPhotos(filters: PhotoSearch): Promise<Photo[]> { return []; }

  // Job Videos (Loom replacement) — real implementations against the videos table.
  async createVideo(data: InsertVideo): Promise<Video> {
    const [row] = await db.insert(videos).values(withTenant(data)).returning();
    return row;
  }
  async getVideo(id: string): Promise<Video | undefined> {
    const [row] = await db.select().from(videos).where(eq(videos.id, id));
    return row || undefined;
  }
  async updateVideo(id: string, updates: UpdateVideo): Promise<Video> {
    const [row] = await db.update(videos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    return row;
  }
  async deleteVideo(id: string): Promise<void> {
    await db.delete(videos).where(eq(videos.id, id));
  }
  async getVideosByJob(jobId: string): Promise<Video[]> {
    return await db.select().from(videos)
      .where(eq(videos.jobId, jobId))
      .orderBy(asc(videos.sequenceOrder), asc(videos.createdAt));
  }
  async getCustomerVisibleVideosByJob(jobId: string): Promise<Video[]> {
    return await db.select().from(videos)
      .where(and(eq(videos.jobId, jobId), eq(videos.showToCustomer, true)))
      .orderBy(asc(videos.sequenceOrder), asc(videos.createdAt));
  }
  async getVideos(filter?: { kind?: string; unassigned?: boolean }): Promise<Video[]> {
    const conditions = [];
    if (filter?.kind) conditions.push(eq(videos.kind, filter.kind));
    if (filter?.unassigned) conditions.push(isNull(videos.jobId));
    const query = db.select().from(videos);
    const rows = conditions.length
      ? await query.where(and(...conditions)).orderBy(desc(videos.createdAt))
      : await query.orderBy(desc(videos.createdAt));
    return rows;
  }

  // Help articles — subscriber-facing /help page. Sort: 'Getting started'
  // sequenced (asc sequenceOrder), then other categories alpha by title.
  async createHelpArticle(data: InsertHelpArticle): Promise<HelpArticle> {
    const [row] = await db.insert(helpArticles).values(data).returning();
    return row;
  }
  async getHelpArticle(id: string): Promise<HelpArticle | undefined> {
    const [row] = await db.select().from(helpArticles).where(eq(helpArticles.id, id));
    return row || undefined;
  }
  async getHelpArticleBySlug(slug: string): Promise<HelpArticle | undefined> {
    const [row] = await db.select().from(helpArticles).where(eq(helpArticles.slug, slug));
    return row || undefined;
  }
  async updateHelpArticle(id: string, updates: UpdateHelpArticle): Promise<HelpArticle> {
    const [row] = await db.update(helpArticles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(helpArticles.id, id))
      .returning();
    return row;
  }
  async deleteHelpArticle(id: string): Promise<void> {
    await db.delete(helpArticles).where(eq(helpArticles.id, id));
  }
  async getHelpArticles(filter?: { publishedOnly?: boolean }): Promise<HelpArticle[]> {
    const query = db.select().from(helpArticles);
    const rows = filter?.publishedOnly
      ? await query.where(eq(helpArticles.published, true))
      : await query;
    // Sort in JS so we can apply per-category ordering (sequenceOrder for
    // 'Getting started', alpha title elsewhere) without a complex SQL CASE.
    return rows.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.category === 'Getting started') {
        return (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0);
      }
      return a.title.localeCompare(b.title);
    });
  }

  async authenticateCustomer(email: string, phone?: string): Promise<CustomerAuth | undefined> { return undefined; }
  async createCustomerAuth(auth: InsertCustomerAuth): Promise<CustomerAuth> { throw new Error("Not implemented"); }
  async getCustomerJobs(customerId: string): Promise<Job[]> {
    return await this.getJobsByCustomer(customerId);
  }
  async getCustomerInvoices(customerId: string): Promise<Invoice[]> { return []; }
  async getCustomerPhotos(customerId: string, jobId?: string): Promise<Photo[]> { return []; }
  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [result] = await db.insert(schema.invoices).values(withTenant(invoice)).returning();
    return result;
  }
  async getInvoice(id: string): Promise<Invoice | undefined> { 
    const [invoice] = await db.select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, id))
      .limit(1);
    return invoice;
  }
  async getInvoicesByJob(jobId: string): Promise<Invoice[]> {
    const invoices = await db.select()
      .from(schema.invoices)
      .where(eq(schema.invoices.jobId, jobId))
      .orderBy(desc(schema.invoices.createdAt));
    return invoices;
  }
  async getAllInvoices(): Promise<Invoice[]> {
    const invoices = await db.select()
      .from(schema.invoices)
      .orderBy(desc(schema.invoices.createdAt));
    return invoices;
  }
  async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice> {
    const [result] = await db.update(schema.invoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.invoices.id, id))
      .returning();
    return result;
  }
  async deleteInvoice(id: string): Promise<void> {
    await db.delete(schema.invoices)
      .where(eq(schema.invoices.id, id));
  }

  async createSupplierInvoice(invoice: InsertSupplierInvoice): Promise<SupplierInvoice> {
    const [result] = await db.insert(schema.supplierInvoices).values(withTenant(invoice)).returning();
    return result;
  }
  async getSupplierInvoice(id: string): Promise<SupplierInvoice | undefined> {
    const [row] = await db.select()
      .from(schema.supplierInvoices)
      .where(eq(schema.supplierInvoices.id, id))
      .limit(1);
    return row;
  }
  async getSupplierInvoicesByJob(jobId: string): Promise<SupplierInvoice[]> {
    return await db.select()
      .from(schema.supplierInvoices)
      .where(eq(schema.supplierInvoices.jobId, jobId))
      .orderBy(desc(schema.supplierInvoices.createdAt));
  }
  async updateSupplierInvoice(id: string, updates: UpdateSupplierInvoice): Promise<SupplierInvoice> {
    const [result] = await db.update(schema.supplierInvoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.supplierInvoices.id, id))
      .returning();
    return result;
  }
  async deleteSupplierInvoice(id: string): Promise<void> {
    await db.delete(schema.supplierInvoices)
      .where(eq(schema.supplierInvoices.id, id));
  }
  // Distinct supplier names previously used by this tenant, for autocomplete.
  // RLS scopes the rows to the tenant when running as the 'authenticated' role.
  async getSupplierNames(): Promise<string[]> {
    const rows = await db.selectDistinct({ name: schema.supplierInvoices.supplierName })
      .from(schema.supplierInvoices)
      .orderBy(asc(schema.supplierInvoices.supplierName));
    return rows.map(r => r.name).filter((n): n is string => !!n);
  }

  async createInvoiceSection(section: InsertInvoiceSection): Promise<InvoiceSection> {
    const [created] = await db.insert(schema.invoiceSections).values(withTenant(section)).returning();
    return created;
  }

  async getInvoiceSection(id: string): Promise<InvoiceSection | undefined> {
    const [section] = await db.select().from(schema.invoiceSections).where(eq(schema.invoiceSections.id, id));
    return section;
  }

  async updateInvoiceSection(id: string, updates: UpdateInvoiceSection): Promise<InvoiceSection> {
    const [updated] = await db.update(schema.invoiceSections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.invoiceSections.id, id))
      .returning();
    if (!updated) throw new Error("Invoice section not found");
    return updated;
  }

  async getInvoiceSectionsByInvoice(invoiceId: string): Promise<InvoiceSection[]> {
    return await db.select()
      .from(schema.invoiceSections)
      .where(eq(schema.invoiceSections.invoiceId, invoiceId))
      .orderBy(schema.invoiceSections.sortOrder);
  }

  async deleteInvoiceSection(id: string): Promise<void> {
    await db.delete(schema.invoiceSections).where(eq(schema.invoiceSections.id, id));
  }

  async reorderInvoiceSections(invoiceId: string, sectionIds: string[]): Promise<InvoiceSection[]> {
    for (let i = 0; i < sectionIds.length; i++) {
      await db.update(schema.invoiceSections)
        .set({ sortOrder: i })
        .where(eq(schema.invoiceSections.id, sectionIds[i]));
    }
    return this.getInvoiceSectionsByInvoice(invoiceId);
  }

  async createServiceRequest(request: InsertServiceRequest): Promise<ServiceRequest> { throw new Error("Not implemented"); }
  async getServiceRequest(id: string): Promise<ServiceRequest | undefined> { return undefined; }
  async getServiceRequestsByCustomer(customerId: string): Promise<ServiceRequest[]> { return []; }
  
  // Xero Integration Implementation
  async createXeroConnection(connection: InsertXeroConnection): Promise<XeroConnection> {
    const [result] = await db.insert(schema.xeroConnections).values(withTenant(connection)).returning();
    return result;
  }
  
  async getXeroConnection(tenantId: string): Promise<XeroConnection | undefined> {
    const [result] = await db.select()
      .from(schema.xeroConnections)
      .where(eq(schema.xeroConnections.tenantId, tenantId))
      .limit(1);
    return result;
  }
  
  async getActiveXeroConnection(): Promise<XeroConnection | undefined> {
    const [result] = await db.select()
      .from(schema.xeroConnections)
      .where(eq(schema.xeroConnections.isActive, true))
      .limit(1);
    return result;
  }
  
  async updateXeroConnection(tenantId: string, updates: Partial<InsertXeroConnection>): Promise<XeroConnection> {
    const [result] = await db.update(schema.xeroConnections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.xeroConnections.tenantId, tenantId))
      .returning();
    return result;
  }
  
  async deleteXeroConnection(tenantId: string): Promise<void> {
    await db.delete(schema.xeroConnections)
      .where(eq(schema.xeroConnections.tenantId, tenantId));
  }
  
  // Xero Settings Implementation
  async getXeroSettings(): Promise<XeroSettings | undefined> {
    const [result] = await db.select()
      .from(schema.xeroSettings)
      .limit(1);
    return result;
  }
  
  async updateXeroSettings(updates: Partial<InsertXeroSettings>): Promise<XeroSettings> {
    // Get existing settings or create if not exists
    const existing = await this.getXeroSettings();
    
    if (existing) {
      const [result] = await db.update(schema.xeroSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.xeroSettings.id, existing.id))
        .returning();
      return result;
    } else {
      // Create new settings if none exist
      const [result] = await db.insert(schema.xeroSettings)
        .values(withTenant({ ...updates }))
        .returning();
      return result;
    }
  }

  async getSafetyIncidents(): Promise<SafetyIncident[]> { return []; }
  async getSafetyIncident(id: string): Promise<SafetyIncident | undefined> { return undefined; }
  async createSafetyIncident(incident: InsertSafetyIncident & { incidentNumber: string }): Promise<SafetyIncident> { throw new Error("Not implemented"); }
  async updateSafetyIncident(id: string, updates: Partial<InsertSafetyIncident>): Promise<SafetyIncident> { throw new Error("Not implemented"); }
  async deleteSafetyIncident(id: string): Promise<void> { }
  async getSafetyIncidentsByJob(jobId: string): Promise<SafetyIncident[]> { return []; }
  async getSafetyIncidentsByType(type: string): Promise<SafetyIncident[]> { return []; }
  async getSafetyIncidentsBySeverity(severity: string): Promise<SafetyIncident[]> { return []; }
  async getSafetyIncidentsByStatus(status: string): Promise<SafetyIncident[]> { return []; }

  async createRiskAssessment(assessment: InsertRiskAssessment): Promise<RiskAssessment> {
    const [result] = await db.insert(schema.riskAssessments).values(withTenant(assessment)).returning();
    return result;
  }
  async getRiskAssessment(id: string): Promise<RiskAssessment | undefined> {
    const [result] = await db.select().from(schema.riskAssessments).where(eq(schema.riskAssessments.id, id));
    return result;
  }
  async updateRiskAssessment(id: string, updates: Partial<InsertRiskAssessment>): Promise<RiskAssessment> {
    const [result] = await db.update(schema.riskAssessments).set({ ...updates, updatedAt: new Date() }).where(eq(schema.riskAssessments.id, id)).returning();
    return result;
  }
  async getRiskAssessmentsByJob(jobId: string): Promise<RiskAssessment[]> {
    return await db.select().from(schema.riskAssessments).where(eq(schema.riskAssessments.jobId, jobId)).orderBy(desc(schema.riskAssessments.createdAt));
  }
  async getAllRiskAssessments(): Promise<RiskAssessment[]> {
    return await db.select().from(schema.riskAssessments).orderBy(desc(schema.riskAssessments.createdAt));
  }

  async createComplianceRequirement(requirement: InsertComplianceRequirement): Promise<ComplianceRequirement> { throw new Error("Not implemented"); }
  async getComplianceRequirement(id: string): Promise<ComplianceRequirement | undefined> { return undefined; }
  async updateComplianceRequirement(id: string, updates: Partial<InsertComplianceRequirement>): Promise<ComplianceRequirement> { throw new Error("Not implemented"); }
  async getAllComplianceRequirements(): Promise<ComplianceRequirement[]> { return []; }
  async createComplianceRecord(record: InsertComplianceRecord): Promise<ComplianceRecord> { throw new Error("Not implemented"); }
  async getAllComplianceRecords(): Promise<ComplianceRecord[]> { return []; }
  async getComplianceAnalytics(): Promise<any> {
    return {
      totalRequirements: 0,
      overdueRequirements: 0,
      upcomingRequirements: 0,
      averageComplianceScore: 0
    };
  }

  async createEmailTemplate(templateData: InsertEmailTemplate): Promise<EmailTemplate> {
    const [template] = await db.insert(schema.emailTemplates).values(withTenant(templateData)).returning();
    return template;
  }
  
  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, id));
    return template || undefined;
  }
  
  async updateEmailTemplate(id: string, updates: UpdateEmailTemplate): Promise<EmailTemplate> {
    const [updated] = await db.update(schema.emailTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.emailTemplates.id, id))
      .returning();
    return updated;
  }
  
  async getAllEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(schema.emailTemplates).orderBy(schema.emailTemplates.createdAt);
  }
  
  async deleteEmailTemplate(id: string): Promise<void> {
    await db.delete(schema.emailTemplates).where(eq(schema.emailTemplates.id, id));
  }

  async createSmsTemplate(templateData: InsertSmsTemplate): Promise<SmsTemplate> {
    const [template] = await db.insert(schema.smsTemplates).values(withTenant(templateData)).returning();
    return template;
  }
  
  async getSmsTemplate(id: string): Promise<SmsTemplate | undefined> {
    const [template] = await db.select().from(schema.smsTemplates).where(eq(schema.smsTemplates.id, id));
    return template || undefined;
  }
  
  async updateSmsTemplate(id: string, updates: UpdateSmsTemplate): Promise<SmsTemplate> {
    const [updated] = await db.update(schema.smsTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.smsTemplates.id, id))
      .returning();
    return updated;
  }
  
  async getAllSmsTemplates(): Promise<SmsTemplate[]> {
    return await db.select().from(schema.smsTemplates).orderBy(schema.smsTemplates.createdAt);
  }
  
  async deleteSmsTemplate(id: string): Promise<void> {
    await db.delete(schema.smsTemplates).where(eq(schema.smsTemplates.id, id));
  }

  // ServiceM8 Integration Management
  async createServicem8Config(config: InsertServicem8Config): Promise<Servicem8Config> {
    const [servicem8Config] = await db.insert(schema.servicem8Config).values(config).returning();
    return servicem8Config;
  }

  async getServicem8Config(): Promise<Servicem8Config | undefined> {
    const [config] = await db.select().from(schema.servicem8Config).limit(1);
    return config || undefined;
  }

  async updateServicem8Config(id: string, updates: Partial<InsertServicem8Config>): Promise<Servicem8Config> {
    const [updatedConfig] = await db.update(schema.servicem8Config)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.servicem8Config.id, id))
      .returning();
    return updatedConfig;
  }

  async deleteServicem8Config(id: string): Promise<void> {
    await db.delete(schema.servicem8Config).where(eq(schema.servicem8Config.id, id));
  }

  // ServiceM8 Data Import Management - Stub implementations
  async createServicem8Job(job: InsertServicem8Job): Promise<Servicem8Job> { throw new Error("Not implemented"); }
  async getServicem8Job(id: string): Promise<Servicem8Job | undefined> { return undefined; }
  async getServicem8JobByUuid(uuid: string): Promise<Servicem8Job | undefined> { return undefined; }
  async updateServicem8Job(id: string, updates: Partial<InsertServicem8Job>): Promise<Servicem8Job> { throw new Error("Not implemented"); }
  async getAllServicem8Jobs(): Promise<Servicem8Job[]> { return []; }

  async createServicem8DiaryEntry(entry: InsertServicem8DiaryEntry): Promise<Servicem8DiaryEntry> { throw new Error("Not implemented"); }
  async getServicem8DiaryEntry(id: string): Promise<Servicem8DiaryEntry | undefined> { return undefined; }
  async getServicem8DiaryEntriesByJob(servicem8JobUuid: string): Promise<Servicem8DiaryEntry[]> { return []; }
  async updateServicem8DiaryEntry(id: string, updates: Partial<InsertServicem8DiaryEntry>): Promise<Servicem8DiaryEntry> { throw new Error("Not implemented"); }
  async getAllServicem8DiaryEntries(): Promise<Servicem8DiaryEntry[]> { return []; }

  async createServicem8Quote(quote: InsertServicem8Quote): Promise<Servicem8Quote> { throw new Error("Not implemented"); }
  async getServicem8Quote(id: string): Promise<Servicem8Quote | undefined> { return undefined; }
  async getServicem8QuoteByUuid(uuid: string): Promise<Servicem8Quote | undefined> { return undefined; }
  async updateServicem8Quote(id: string, updates: Partial<InsertServicem8Quote>): Promise<Servicem8Quote> { throw new Error("Not implemented"); }
  async getAllServicem8Quotes(): Promise<Servicem8Quote[]> { return []; }

  async createServicem8Company(company: InsertServicem8Company): Promise<Servicem8Company> { throw new Error("Not implemented"); }
  async getServicem8Company(id: string): Promise<Servicem8Company | undefined> { return undefined; }
  async getServicem8CompanyByUuid(uuid: string): Promise<Servicem8Company | undefined> { return undefined; }
  async updateServicem8Company(id: string, updates: Partial<InsertServicem8Company>): Promise<Servicem8Company> { throw new Error("Not implemented"); }
  async getAllServicem8Companies(): Promise<Servicem8Company[]> { return []; }

  async createServicem8Invoice(invoice: InsertServicem8Invoice): Promise<Servicem8Invoice> { throw new Error("Not implemented"); }
  async getServicem8Invoice(id: string): Promise<Servicem8Invoice | undefined> { return undefined; }
  async getServicem8InvoiceByUuid(uuid: string): Promise<Servicem8Invoice | undefined> { return undefined; }
  async getServicem8InvoiceByJobUuid(jobUuid: string): Promise<Servicem8Invoice | undefined> { return undefined; }
  async updateServicem8Invoice(id: string, updates: Partial<InsertServicem8Invoice>): Promise<Servicem8Invoice> { throw new Error("Not implemented"); }
  async getAllServicem8Invoices(): Promise<Servicem8Invoice[]> { return []; }

  async createServicem8Material(material: InsertServicem8Material): Promise<Servicem8Material> { throw new Error("Not implemented"); }
  async getServicem8Material(id: string): Promise<Servicem8Material | undefined> { return undefined; }
  async getServicem8MaterialsByJob(jobUuid: string): Promise<Servicem8Material[]> { return []; }
  async updateServicem8Material(id: string, updates: Partial<InsertServicem8Material>): Promise<Servicem8Material> { throw new Error("Not implemented"); }
  async getAllServicem8Materials(): Promise<Servicem8Material[]> { return []; }

  // ========================================
  // DOCUMENT TEMPLATE MANAGEMENT
  // ========================================

  async createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate> {
    const [documentTemplate] = await db.insert(schema.documentTemplates).values(withTenant(template)).returning();
    return documentTemplate;
  }

  async getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined> {
    const [documentTemplate] = await db.select().from(schema.documentTemplates).where(eq(schema.documentTemplates.id, id));
    return documentTemplate;
  }

  async updateDocumentTemplate(id: string, updates: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate> {
    const [documentTemplate] = await db
      .update(schema.documentTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.documentTemplates.id, id))
      .returning();
    return documentTemplate;
  }

  async deleteDocumentTemplate(id: string): Promise<void> {
    await db.delete(schema.documentTemplates).where(eq(schema.documentTemplates.id, id));
  }

  async getAllDocumentTemplates(): Promise<DocumentTemplate[]> {
    return await db.select().from(schema.documentTemplates).orderBy(schema.documentTemplates.type, schema.documentTemplates.name);
  }

  async getDocumentTemplatesByType(type: string): Promise<DocumentTemplate[]> {
    return await db.select().from(schema.documentTemplates)
      .where(and(eq(schema.documentTemplates.type, type), eq(schema.documentTemplates.isActive, true)))
      .orderBy(schema.documentTemplates.name);
  }

  async getDefaultDocumentTemplate(type: string): Promise<DocumentTemplate | undefined> {
    const [template] = await db.select().from(schema.documentTemplates)
      .where(and(
        eq(schema.documentTemplates.type, type),
        eq(schema.documentTemplates.isDefault, true),
        eq(schema.documentTemplates.isActive, true)
      ));
    return template;
  }

  // Resolve the default document template for a SPECIFIC tenant. Public document
  // routes (proposal/invoice viewers) are session-less and run on the owner
  // connection, so the unscoped getDefaultDocumentTemplate above returns an
  // arbitrary (Treemarkables) tenant's template — a cross-tenant branding leak.
  // This scopes by the document's businessId (queried on ownerDb so it works with
  // no tenant context). Falls back to the unscoped default when the business has
  // none — e.g. legacy Treemarkables rows whose business_id was never backfilled —
  // so TM's output is unchanged.
  async getDefaultDocumentTemplateForBusiness(businessId: string | null | undefined, type: string): Promise<DocumentTemplate | undefined> {
    if (businessId) {
      const [template] = await ownerDb.select().from(schema.documentTemplates)
        .where(and(
          eq(schema.documentTemplates.businessId, businessId),
          eq(schema.documentTemplates.type, type),
          eq(schema.documentTemplates.isDefault, true),
          eq(schema.documentTemplates.isActive, true)
        ));
      if (template) return template;
    }
    return this.getDefaultDocumentTemplate(type);
  }

  // Template Sections Management
  async createTemplateSection(section: InsertTemplateSection): Promise<TemplateSection> {
    const [templateSection] = await db.insert(schema.templateSections).values(withTenant(section)).returning();
    return templateSection;
  }

  async getTemplateSection(id: string): Promise<TemplateSection | undefined> {
    const [templateSection] = await db.select().from(schema.templateSections).where(eq(schema.templateSections.id, id));
    return templateSection;
  }

  async updateTemplateSection(id: string, updates: Partial<InsertTemplateSection>): Promise<TemplateSection> {
    const [templateSection] = await db
      .update(schema.templateSections)
      .set(updates)
      .where(eq(schema.templateSections.id, id))
      .returning();
    return templateSection;
  }

  async deleteTemplateSection(id: string): Promise<void> {
    await db.delete(schema.templateSections).where(eq(schema.templateSections.id, id));
  }

  async getTemplateSectionsByTemplate(templateId: string): Promise<TemplateSection[]> {
    return await db.select().from(schema.templateSections)
      .where(eq(schema.templateSections.templateId, templateId))
      .orderBy(schema.templateSections.sortOrder);
  }

  // Template Line Items Management
  async createTemplateLineItem(lineItem: InsertTemplateLineItem): Promise<TemplateLineItem> {
    const [templateLineItem] = await db.insert(schema.templateLineItems).values(withTenant(lineItem)).returning();
    return templateLineItem;
  }

  async getTemplateLineItem(id: string): Promise<TemplateLineItem | undefined> {
    const [templateLineItem] = await db.select().from(schema.templateLineItems).where(eq(schema.templateLineItems.id, id));
    return templateLineItem;
  }

  async updateTemplateLineItem(id: string, updates: Partial<InsertTemplateLineItem>): Promise<TemplateLineItem> {
    const [templateLineItem] = await db
      .update(schema.templateLineItems)
      .set(updates)
      .where(eq(schema.templateLineItems.id, id))
      .returning();
    return templateLineItem;
  }

  async deleteTemplateLineItem(id: string): Promise<void> {
    await db.delete(schema.templateLineItems).where(eq(schema.templateLineItems.id, id));
  }

  async getTemplateLineItemsByTemplate(templateId: string): Promise<TemplateLineItem[]> {
    return await db.select().from(schema.templateLineItems)
      .where(eq(schema.templateLineItems.templateId, templateId))
      .orderBy(schema.templateLineItems.sortOrder);
  }

  async getTemplateLineItemsBySection(sectionId: string): Promise<TemplateLineItem[]> {
    return await db.select().from(schema.templateLineItems)
      .where(eq(schema.templateLineItems.sectionId, sectionId))
      .orderBy(schema.templateLineItems.sortOrder);
  }

  // Template Photos Management
  async createTemplatePhoto(photo: InsertTemplatePhoto): Promise<TemplatePhoto> {
    const [templatePhoto] = await db.insert(schema.templatePhotos).values(withTenant(photo)).returning();
    return templatePhoto;
  }

  async getTemplatePhoto(id: string): Promise<TemplatePhoto | undefined> {
    const [templatePhoto] = await db.select().from(schema.templatePhotos).where(eq(schema.templatePhotos.id, id));
    return templatePhoto;
  }

  async updateTemplatePhoto(id: string, updates: Partial<InsertTemplatePhoto>): Promise<TemplatePhoto> {
    const [templatePhoto] = await db
      .update(schema.templatePhotos)
      .set(updates)
      .where(eq(schema.templatePhotos.id, id))
      .returning();
    return templatePhoto;
  }

  async deleteTemplatePhoto(id: string): Promise<void> {
    await db.delete(schema.templatePhotos).where(eq(schema.templatePhotos.id, id));
  }

  async getTemplatePhotosByTemplate(templateId: string): Promise<TemplatePhoto[]> {
    return await db.select().from(schema.templatePhotos)
      .where(eq(schema.templatePhotos.templateId, templateId))
      .orderBy(schema.templatePhotos.sortOrder);
  }

  async getTemplatePhotosBySection(sectionId: string): Promise<TemplatePhoto[]> {
    return await db.select().from(schema.templatePhotos)
      .where(eq(schema.templatePhotos.sectionId, sectionId))
      .orderBy(schema.templatePhotos.sortOrder);
  }

  // Generated Documents Management
  async createGeneratedDocument(document: InsertGeneratedDocument): Promise<GeneratedDocument> {
    const [generatedDocument] = await db.insert(schema.generatedDocuments).values(withTenant(document)).returning();
    return generatedDocument;
  }

  async getGeneratedDocument(id: string): Promise<GeneratedDocument | undefined> {
    const [generatedDocument] = await db.select().from(schema.generatedDocuments).where(eq(schema.generatedDocuments.id, id));
    return generatedDocument;
  }

  async updateGeneratedDocument(id: string, updates: Partial<InsertGeneratedDocument>): Promise<GeneratedDocument> {
    const [generatedDocument] = await db
      .update(schema.generatedDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.generatedDocuments.id, id))
      .returning();
    return generatedDocument;
  }

  async deleteGeneratedDocument(id: string): Promise<void> {
    await db.delete(schema.generatedDocuments).where(eq(schema.generatedDocuments.id, id));
  }

  async getAllGeneratedDocuments(): Promise<GeneratedDocument[]> {
    return await db.select().from(schema.generatedDocuments).orderBy(desc(schema.generatedDocuments.createdAt));
  }

  async getGeneratedDocumentsByJob(jobId: string): Promise<GeneratedDocument[]> {
    return await db.select().from(schema.generatedDocuments)
      .where(eq(schema.generatedDocuments.jobId, jobId))
      .orderBy(desc(schema.generatedDocuments.createdAt));
  }

  async getGeneratedDocumentsByCustomer(customerId: string): Promise<GeneratedDocument[]> {
    return await db.select().from(schema.generatedDocuments)
      .where(eq(schema.generatedDocuments.customerId, customerId))
      .orderBy(desc(schema.generatedDocuments.createdAt));
  }

  async getGeneratedDocumentsByType(type: string): Promise<GeneratedDocument[]> {
    return await db.select().from(schema.generatedDocuments)
      .where(eq(schema.generatedDocuments.documentType, type))
      .orderBy(desc(schema.generatedDocuments.createdAt));
  }

  async getGeneratedDocumentsByStatus(status: string): Promise<GeneratedDocument[]> {
    return await db.select().from(schema.generatedDocuments)
      .where(eq(schema.generatedDocuments.status, status))
      .orderBy(desc(schema.generatedDocuments.createdAt));
  }

  async generateDocumentNumber(type: string): Promise<string> {
    // Get the latest document number for this type
    const [latest] = await db.select({ documentNumber: schema.generatedDocuments.documentNumber })
      .from(schema.generatedDocuments)
      .where(ilike(schema.generatedDocuments.documentNumber, `${type.toUpperCase()}%`))
      .orderBy(desc(schema.generatedDocuments.createdAt))
      .limit(1);

    if (!latest?.documentNumber) {
      return `${type.toUpperCase()}#1001`;
    }

    // Extract number from document number (e.g., "QUOTE#1001" -> 1001)
    const match = latest.documentNumber.match(/#(\d+)$/);
    const currentNumber = match ? parseInt(match[1]) : 1000;
    const nextNumber = currentNumber + 1;
    
    return `${type.toUpperCase()}#${nextNumber}`;
  }

  // Generated Document Line Items Management
  async createGeneratedDocumentLineItem(lineItem: InsertGeneratedDocumentLineItem): Promise<GeneratedDocumentLineItem> {
    const [generatedDocumentLineItem] = await db.insert(schema.generatedDocumentLineItems).values(withTenant(lineItem)).returning();
    return generatedDocumentLineItem;
  }

  async getGeneratedDocumentLineItem(id: string): Promise<GeneratedDocumentLineItem | undefined> {
    const [generatedDocumentLineItem] = await db.select().from(schema.generatedDocumentLineItems).where(eq(schema.generatedDocumentLineItems.id, id));
    return generatedDocumentLineItem;
  }

  async updateGeneratedDocumentLineItem(id: string, updates: Partial<InsertGeneratedDocumentLineItem>): Promise<GeneratedDocumentLineItem> {
    const [generatedDocumentLineItem] = await db
      .update(schema.generatedDocumentLineItems)
      .set(updates)
      .where(eq(schema.generatedDocumentLineItems.id, id))
      .returning();
    return generatedDocumentLineItem;
  }

  async deleteGeneratedDocumentLineItem(id: string): Promise<void> {
    await db.delete(schema.generatedDocumentLineItems).where(eq(schema.generatedDocumentLineItems.id, id));
  }

  async getGeneratedDocumentLineItemsByDocument(documentId: string): Promise<GeneratedDocumentLineItem[]> {
    return await db.select().from(schema.generatedDocumentLineItems)
      .where(eq(schema.generatedDocumentLineItems.generatedDocumentId, documentId))
      .orderBy(schema.generatedDocumentLineItems.sortOrder);
  }

  // Generated Document Photos Management
  async createGeneratedDocumentPhoto(photo: InsertGeneratedDocumentPhoto): Promise<GeneratedDocumentPhoto> {
    const [generatedDocumentPhoto] = await db.insert(schema.generatedDocumentPhotos).values(withTenant(photo)).returning();
    return generatedDocumentPhoto;
  }

  async getGeneratedDocumentPhoto(id: string): Promise<GeneratedDocumentPhoto | undefined> {
    const [generatedDocumentPhoto] = await db.select().from(schema.generatedDocumentPhotos).where(eq(schema.generatedDocumentPhotos.id, id));
    return generatedDocumentPhoto;
  }

  async updateGeneratedDocumentPhoto(id: string, updates: Partial<InsertGeneratedDocumentPhoto>): Promise<GeneratedDocumentPhoto> {
    const [generatedDocumentPhoto] = await db
      .update(schema.generatedDocumentPhotos)
      .set(updates)
      .where(eq(schema.generatedDocumentPhotos.id, id))
      .returning();
    return generatedDocumentPhoto;
  }

  async deleteGeneratedDocumentPhoto(id: string): Promise<void> {
    await db.delete(schema.generatedDocumentPhotos).where(eq(schema.generatedDocumentPhotos.id, id));
  }

  async getGeneratedDocumentPhotosByDocument(documentId: string): Promise<GeneratedDocumentPhoto[]> {
    return await db.select().from(schema.generatedDocumentPhotos)
      .where(eq(schema.generatedDocumentPhotos.generatedDocumentId, documentId))
      .orderBy(schema.generatedDocumentPhotos.sortOrder);
  }

  // In-memory storage for materials and services (for immediate functionality)
  private materials: Material[] = [
    {
      id: "1",
      itemNumber: "VIP",
      name: "10% discount with VIP membership",
      price: "0.00",
      cost: "0.00",
      priceIncludesTax: false,
      taxRate: "No GST",
      category: "Discount",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "2", 
      itemNumber: "Admin Time",
      name: "Admin Time",
      price: "0.00",
      cost: "0.00",
      priceIncludesTax: false,
      taxRate: "15% GST on Income",
      category: "Labour",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "3",
      itemNumber: "41",
      name: "Wood chipper rental",
      price: "400.00",
      cost: "280.00",
      priceIncludesTax: false,
      taxRate: "15% GST on Income",
      category: "Equipment",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  private services: Service[] = [
    {
      id: "1",
      name: "Tree Removal - Small (under 5m)",
      category: "Tree Services",
      basePrice: "250.00",
      baseCost: "150.00",
      unit: "per tree",
      description: "Complete removal for trees under 5 meters",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "2",
      name: "Tree Removal - Medium (5-10m)",
      category: "Tree Services",
      basePrice: "650.00",
      baseCost: "400.00",
      unit: "per tree",
      description: "Complete removal including stump grinding",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Materials Catalog Management
  async createMaterial(material: InsertMaterial): Promise<Material> {
    const [newMaterial] = await db.insert(schema.materials)
      .values(withTenant(material))
      .returning();
    return newMaterial;
  }

  async getMaterial(id: string): Promise<Material | undefined> {
    const [material] = await db.select()
      .from(schema.materials)
      .where(eq(schema.materials.id, id));
    return material;
  }

  async updateMaterial(id: string, updates: Partial<InsertMaterial>): Promise<Material> {
    const [updated] = await db.update(schema.materials)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.materials.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Material with id ${id} not found`);
    }
    
    return updated;
  }

  async deleteMaterial(id: string): Promise<void> {
    await db.delete(schema.materials)
      .where(eq(schema.materials.id, id));
  }

  async getAllMaterials(): Promise<Material[]> {
    return await db.select()
      .from(schema.materials)
      .orderBy(desc(schema.materials.createdAt));
  }

  async getMaterialsByCategory(category: string): Promise<Material[]> {
    return await db.select()
      .from(schema.materials)
      .where(eq(schema.materials.category, category))
      .orderBy(desc(schema.materials.createdAt));
  }

  // Services Catalog Management
  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(schema.services)
      .values(withTenant(service))
      .returning();
    return newService;
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db.select()
      .from(schema.services)
      .where(eq(schema.services.id, id));
    return service;
  }

  async updateService(id: string, updates: Partial<InsertService>): Promise<Service> {
    const [updated] = await db.update(schema.services)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.services.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Service with id ${id} not found`);
    }
    
    return updated;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(schema.services)
      .where(eq(schema.services.id, id));
  }

  async getAllServices(): Promise<Service[]> {
    return await db.select()
      .from(schema.services)
      .orderBy(desc(schema.services.createdAt));
  }

  async getServicesByCategory(category: string): Promise<Service[]> {
    return await db.select()
      .from(schema.services)
      .where(eq(schema.services.category, category))
      .orderBy(desc(schema.services.createdAt));
  }

  // ==========================================
  // REVIEW MANAGEMENT METHODS
  // ==========================================

  async getCompletedJobsForReviews(): Promise<any[]> {
    return await db.select({
      id: schema.jobs.id,
      jobNumber: schema.jobs.jobNumber,
      customerId: schema.jobs.customerId,
      customerName: sql<string>`COALESCE(${schema.customers.firstName}, '') || ' ' || COALESCE(${schema.customers.lastName}, '')`,
      customerEmail: schema.customers.email,
      customerPhone: schema.customers.phone,
      address: schema.jobs.address,
      completedDate: schema.jobs.completedDate,
      reviewRequestId: schema.reviewRequests.id,
      reviewRequestStatus: schema.reviewRequests.status,
      reviewSubmissionId: schema.reviewSubmissions.id,
      reviewRating: schema.reviewSubmissions.rating
    })
      .from(schema.jobs)
      .leftJoin(schema.customers, eq(schema.jobs.customerId, schema.customers.id))
      .leftJoin(schema.reviewRequests, eq(schema.jobs.id, schema.reviewRequests.jobId))
      .leftJoin(schema.reviewSubmissions, eq(schema.reviewRequests.id, schema.reviewSubmissions.requestId))
      .where(eq(schema.jobs.status, 'completed'))
      .orderBy(desc(schema.jobs.completedDate));
  }

  async createReviewRequest(data: any): Promise<any> {
    const [newRequest] = await db.insert(schema.reviewRequests)
      .values(withTenant(data))
      .returning();
    return newRequest;
  }

  async updateReviewRequestStatus(requestId: string, status: string): Promise<any> {
    const [updated] = await db.update(schema.reviewRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.reviewRequests.id, requestId))
      .returning();
    return updated;
  }

  async getReviewRequestByToken(token: string): Promise<any> {
    const [request] = await db.select()
      .from(schema.reviewRequests)
      .where(eq(schema.reviewRequests.token, token));
    return request;
  }

  async getAllReviewRequests(): Promise<any[]> {
    return await db.select({
      id: schema.reviewRequests.id,
      jobId: schema.reviewRequests.jobId,
      customerId: schema.reviewRequests.customerId,
      token: schema.reviewRequests.token,
      status: schema.reviewRequests.status,
      sentAt: schema.reviewRequests.sentAt,
      sentBy: schema.reviewRequests.sentBy,
      sentVia: schema.reviewRequests.sentVia,
      customerName: schema.reviewRequests.customerName,
      customerEmail: schema.reviewRequests.customerEmail,
      customerPhone: schema.reviewRequests.customerPhone,
      jobNumber: schema.reviewRequests.jobNumber,
      jobAddress: schema.reviewRequests.jobAddress,
      createdAt: schema.reviewRequests.createdAt,
      updatedAt: schema.reviewRequests.updatedAt,
      // Join review submission if exists
      submissionId: schema.reviewSubmissions.id,
      rating: schema.reviewSubmissions.rating,
      comment: schema.reviewSubmissions.comment,
      submittedAt: schema.reviewSubmissions.submittedAt
    })
      .from(schema.reviewRequests)
      .leftJoin(schema.reviewSubmissions, eq(schema.reviewRequests.id, schema.reviewSubmissions.requestId))
      .orderBy(desc(schema.reviewRequests.sentAt));
  }

  async createReviewSubmission(data: any): Promise<any> {
    const [newSubmission] = await db.insert(schema.reviewSubmissions)
      .values(withTenant(data))
      .returning();
    return newSubmission;
  }

  async updateReviewSubmission(submissionId: string, updates: any): Promise<any> {
    const [updated] = await db.update(schema.reviewSubmissions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.reviewSubmissions.id, submissionId))
      .returning();
    return updated;
  }

  async getAllReviewSubmissions(): Promise<any[]> {
    return await db.select({
      id: schema.reviewSubmissions.id,
      rating: schema.reviewSubmissions.rating,
      comment: schema.reviewSubmissions.comment,
      postedToGoogle: schema.reviewSubmissions.postedToGoogle,
      postedToFacebook: schema.reviewSubmissions.postedToFacebook,
      googlePostStatus: schema.reviewSubmissions.googlePostStatus,
      facebookPostStatus: schema.reviewSubmissions.facebookPostStatus,
      internalStatus: schema.reviewSubmissions.internalStatus,
      submittedAt: schema.reviewSubmissions.submittedAt,
      jobNumber: schema.jobs.jobNumber,
      customerName: sql<string>`COALESCE(${schema.customers.firstName}, '') || ' ' || COALESCE(${schema.customers.lastName}, '')`,
      jobAddress: schema.jobs.address
    })
      .from(schema.reviewSubmissions)
      .leftJoin(schema.jobs, eq(schema.reviewSubmissions.jobId, schema.jobs.id))
      .leftJoin(schema.customers, eq(schema.reviewSubmissions.customerId, schema.customers.id))
      .orderBy(desc(schema.reviewSubmissions.submittedAt));
  }

  async getReviewStats(): Promise<any> {
    const totalRequests = await db.select({ count: sql<number>`count(*)` })
      .from(schema.reviewRequests);
    
    const totalSubmissions = await db.select({ count: sql<number>`count(*)` })
      .from(schema.reviewSubmissions);
    
    const avgRating = await db.select({ avg: sql<number>`avg(rating)` })
      .from(schema.reviewSubmissions);
    
    const sent = totalRequests[0]?.count || 0;
    const received = totalSubmissions[0]?.count || 0;
    const conversionRate = sent > 0 ? ((received / sent) * 100).toFixed(1) : '0.0';

    return {
      totalSent: sent,
      totalReceived: received,
      conversionRate: parseFloat(conversionRate),
      averageRating: avgRating[0]?.avg ? parseFloat(avgRating[0].avg.toFixed(1)) : 0
    };
  }

  // ==========================================
  // JOB HAZARD ANALYSIS (JHA) METHODS
  // ==========================================

  // Hazard Templates
  async getAllJhaHazardTemplates(): Promise<schema.JhaHazardTemplate[]> {
    const templates = await db.select()
      .from(schema.jhaHazardTemplates)
      .where(eq(schema.jhaHazardTemplates.isActive, true))
      .orderBy(schema.jhaHazardTemplates.sortOrder, schema.jhaHazardTemplates.name);
    
    // Fetch control measures for each template
    const templatesWithControls = await Promise.all(
      templates.map(async (template) => {
        const controlMeasures = await db.select()
          .from(schema.jhaControlMeasureTemplates)
          .where(and(
            eq(schema.jhaControlMeasureTemplates.hazardTemplateId, template.id),
            eq(schema.jhaControlMeasureTemplates.isActive, true)
          ))
          .orderBy(schema.jhaControlMeasureTemplates.sortOrder);
        
        return {
          ...template,
          controlMeasures
        };
      })
    );
    
    return templatesWithControls;
  }

  async getJhaHazardTemplate(id: string): Promise<schema.JhaHazardTemplate | undefined> {
    const [template] = await db.select()
      .from(schema.jhaHazardTemplates)
      .where(eq(schema.jhaHazardTemplates.id, id));
    return template;
  }

  async createJhaHazardTemplate(template: schema.InsertJhaHazardTemplate): Promise<schema.JhaHazardTemplate> {
    const [result] = await db.insert(schema.jhaHazardTemplates)
      .values(withTenant(template))
      .returning();
    return result;
  }

  async updateJhaHazardTemplate(id: string, updates: Partial<schema.InsertJhaHazardTemplate>): Promise<schema.JhaHazardTemplate> {
    const [result] = await db.update(schema.jhaHazardTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.jhaHazardTemplates.id, id))
      .returning();
    return result;
  }

  async deleteJhaHazardTemplate(id: string): Promise<void> {
    await db.update(schema.jhaHazardTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.jhaHazardTemplates.id, id));
  }

  // Risk Control Templates
  async getAllJhaRiskControlTemplates(): Promise<schema.JhaRiskControlTemplate[]> {
    return await db.select()
      .from(schema.jhaRiskControlTemplates)
      .where(eq(schema.jhaRiskControlTemplates.isActive, true))
      .orderBy(schema.jhaRiskControlTemplates.sortOrder, schema.jhaRiskControlTemplates.hierarchyLevel);
  }

  async getJhaRiskControlTemplate(id: string): Promise<schema.JhaRiskControlTemplate | undefined> {
    const [template] = await db.select()
      .from(schema.jhaRiskControlTemplates)
      .where(eq(schema.jhaRiskControlTemplates.id, id));
    return template;
  }

  async createJhaRiskControlTemplate(template: schema.InsertJhaRiskControlTemplate): Promise<schema.JhaRiskControlTemplate> {
    const [result] = await db.insert(schema.jhaRiskControlTemplates)
      .values(withTenant(template))
      .returning();
    return result;
  }

  async updateJhaRiskControlTemplate(id: string, updates: Partial<schema.InsertJhaRiskControlTemplate>): Promise<schema.JhaRiskControlTemplate> {
    const [result] = await db.update(schema.jhaRiskControlTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.jhaRiskControlTemplates.id, id))
      .returning();
    return result;
  }

  async deleteJhaRiskControlTemplate(id: string): Promise<void> {
    await db.update(schema.jhaRiskControlTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.jhaRiskControlTemplates.id, id));
  }

  // Control Measure Templates
  async getAllJhaControlMeasures(hazardTemplateId?: string): Promise<schema.JhaControlMeasureTemplate[]> {
    let query = db.select().from(schema.jhaControlMeasureTemplates);
    
    if (hazardTemplateId) {
      query = query.where(and(
        eq(schema.jhaControlMeasureTemplates.hazardTemplateId, hazardTemplateId),
        eq(schema.jhaControlMeasureTemplates.isActive, true)
      )) as any;
    } else {
      query = query.where(eq(schema.jhaControlMeasureTemplates.isActive, true)) as any;
    }
    
    return await query.orderBy(schema.jhaControlMeasureTemplates.sortOrder);
  }

  async getJhaControlMeasure(id: string): Promise<schema.JhaControlMeasureTemplate | undefined> {
    const [measure] = await db.select()
      .from(schema.jhaControlMeasureTemplates)
      .where(eq(schema.jhaControlMeasureTemplates.id, id));
    return measure;
  }

  async createJhaControlMeasure(measure: schema.InsertJhaControlMeasureTemplate): Promise<schema.JhaControlMeasureTemplate> {
    const [result] = await db.insert(schema.jhaControlMeasureTemplates)
      .values(withTenant(measure))
      .returning();
    return result;
  }

  async updateJhaControlMeasure(id: string, updates: Partial<schema.InsertJhaControlMeasureTemplate>): Promise<schema.JhaControlMeasureTemplate> {
    const [result] = await db.update(schema.jhaControlMeasureTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.jhaControlMeasureTemplates.id, id))
      .returning();
    return result;
  }

  async deleteJhaControlMeasure(id: string): Promise<void> {
    await db.update(schema.jhaControlMeasureTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.jhaControlMeasureTemplates.id, id));
  }

  // JHA Assessments
  async getAllJhaAssessments(jobId?: string, status?: string): Promise<any[]> {
    let query = db.select().from(schema.jhaAssessments);
    
    const conditions = [];
    if (jobId) {
      conditions.push(eq(schema.jhaAssessments.jobId, jobId));
    }
    if (status) {
      conditions.push(eq(schema.jhaAssessments.status, status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const assessments = await query.orderBy(desc(schema.jhaAssessments.date));
    
    // Add counts for each assessment
    const assessmentsWithCounts = await Promise.all(assessments.map(async (assessment) => {
      // Count steps (hazards)
      const stepCount = await db.select({ count: sql<number>`count(*)` })
        .from(schema.jhaSteps)
        .where(eq(schema.jhaSteps.assessmentId, assessment.id));
      
      // Count total control measures
      const controlCount = await db.execute(
        sql`SELECT COUNT(*) as count FROM jha_step_controls 
            WHERE step_id IN (SELECT id FROM jha_steps WHERE assessment_id = ${assessment.id})`
      );
      
      // Count signatures
      const signatureCount = await db.select({ count: sql<number>`count(*)` })
        .from(schema.jhaSignatures)
        .where(eq(schema.jhaSignatures.assessmentId, assessment.id));
      
      return {
        ...assessment,
        hazardCount: Number(stepCount[0]?.count || 0),
        controlMeasureCount: Number(controlCount.rows[0]?.count || 0),
        signatureCount: Number(signatureCount[0]?.count || 0)
      };
    }));
    
    return assessmentsWithCounts;
  }

  async getJhaAssessment(id: string, includeSteps?: boolean, includeSignatures?: boolean): Promise<schema.JhaAssessment | undefined> {
    const [assessment] = await db.select()
      .from(schema.jhaAssessments)
      .where(eq(schema.jhaAssessments.id, id));
    
    if (!assessment) return undefined;

    const result: any = { ...assessment };

    if (includeSteps) {
      result.steps = await this.getJhaSteps(id);
      // Get control measures for each step using raw SQL for proper join
      for (const step of result.steps) {
        const controls = await db.execute(
          sql`SELECT sc.id, sc.step_id, sc.control_measure_template_id,
              sc.description, sc.hierarchy_level, sc.is_implemented,
              sc.sort_order, sc.created_at, cm.description as control_measure
          FROM jha_step_controls sc
          LEFT JOIN jha_control_measure_templates cm
            ON sc.control_measure_template_id = cm.id
          WHERE sc.step_id = ${step.id}
          ORDER BY sc.sort_order`
        );

        // Return objects (not bare strings) so the edit form can round-trip
        // controlMeasureTemplateId and description when re-saving — e.g. when
        // adding an extra signature to an already-saved JHA.
        step.controlMeasures = controls.rows.map((c: any) => ({
          id: c.id,
          stepId: c.step_id,
          controlMeasureTemplateId: c.control_measure_template_id,
          description: c.control_measure || c.description || '',
          hierarchyLevel: c.hierarchy_level,
          isImplemented: c.is_implemented,
          sortOrder: c.sort_order,
        }));
      }
    }

    if (includeSignatures) {
      result.signatures = await this.getJhaSignatures(id);
    }

    return result;
  }

  async createJhaAssessment(assessment: schema.InsertJhaAssessment): Promise<schema.JhaAssessment> {
    // Get count of existing JHAs to generate sequential number
    const existingCount = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.jhaAssessments);
    const nextNumber = (existingCount[0]?.count || 0) + 1;
    const assessmentNumber = `${nextNumber}`;
    
    const [result] = await db.insert(schema.jhaAssessments)
      .values(withTenant({ ...assessment, assessmentNumber }))
      .returning();
    return result;
  }

  async updateJhaAssessment(id: string, updates: Partial<schema.InsertJhaAssessment>): Promise<schema.JhaAssessment> {
    const [result] = await db.update(schema.jhaAssessments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.jhaAssessments.id, id))
      .returning();
    return result;
  }

  async deleteJhaAssessment(id: string): Promise<void> {
    await db.delete(schema.jhaStepControls)
      .where(sql`step_id IN (SELECT id FROM jha_steps WHERE assessment_id = ${id})`);
    await db.delete(schema.jhaSteps)
      .where(eq(schema.jhaSteps.assessmentId, id));
    await db.delete(schema.jhaSignatures)
      .where(eq(schema.jhaSignatures.assessmentId, id));
    await db.delete(schema.jhaAssessments)
      .where(eq(schema.jhaAssessments.id, id));
  }

  // JHA Steps
  async getJhaSteps(assessmentId: string): Promise<schema.JhaStep[]> {
    return await db.select()
      .from(schema.jhaSteps)
      .where(eq(schema.jhaSteps.assessmentId, assessmentId))
      .orderBy(schema.jhaSteps.stepNumber);
  }

  async createJhaStep(step: schema.InsertJhaStep): Promise<schema.JhaStep> {
    const [result] = await db.insert(schema.jhaSteps)
      .values(withTenant(step))
      .returning();
    return result;
  }

  async updateJhaStep(id: string, updates: Partial<schema.InsertJhaStep>): Promise<schema.JhaStep> {
    const [result] = await db.update(schema.jhaSteps)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.jhaSteps.id, id))
      .returning();
    return result;
  }

  async deleteJhaStep(id: string): Promise<void> {
    await db.delete(schema.jhaStepControls)
      .where(eq(schema.jhaStepControls.stepId, id));
    await db.delete(schema.jhaSteps)
      .where(eq(schema.jhaSteps.id, id));
  }

  // JHA Step Controls
  async getJhaStepControls(stepId: string): Promise<schema.JhaStepControl[]> {
    return await db.select()
      .from(schema.jhaStepControls)
      .where(eq(schema.jhaStepControls.stepId, stepId))
      .orderBy(schema.jhaStepControls.sortOrder);
  }

  async createJhaStepControl(control: schema.InsertJhaStepControl): Promise<schema.JhaStepControl> {
    const [result] = await db.insert(schema.jhaStepControls)
      .values(withTenant(control))
      .returning();
    return result;
  }

  async updateJhaStepControl(id: string, updates: Partial<schema.InsertJhaStepControl>): Promise<schema.JhaStepControl> {
    const [result] = await db.update(schema.jhaStepControls)
      .set(updates)
      .where(eq(schema.jhaStepControls.id, id))
      .returning();
    return result;
  }

  async deleteJhaStepControl(id: string): Promise<void> {
    await db.delete(schema.jhaStepControls)
      .where(eq(schema.jhaStepControls.id, id));
  }

  // JHA Signatures
  async getJhaSignatures(assessmentId: string): Promise<schema.JhaSignature[]> {
    return await db.select()
      .from(schema.jhaSignatures)
      .where(eq(schema.jhaSignatures.assessmentId, assessmentId))
      .orderBy(schema.jhaSignatures.signedAt);
  }

  async createJhaSignature(signature: schema.InsertJhaSignature): Promise<schema.JhaSignature> {
    const [result] = await db.insert(schema.jhaSignatures)
      .values(withTenant(signature))
      .returning();
    return result;
  }

  async deleteJhaSignature(id: string): Promise<void> {
    await db.delete(schema.jhaSignatures)
      .where(eq(schema.jhaSignatures.id, id));
  }

  // Marketing Campaigns
  async createMarketingCampaign(campaign: schema.InsertMarketingCampaign): Promise<schema.MarketingCampaign> {
    const [result] = await db.insert(schema.marketingCampaigns)
      .values(withTenant(campaign))
      .returning();
    return result;
  }

  async getMarketingCampaign(id: string): Promise<schema.MarketingCampaign | undefined> {
    const [result] = await db.select()
      .from(schema.marketingCampaigns)
      .where(eq(schema.marketingCampaigns.id, id));
    return result;
  }

  async getAllMarketingCampaigns(): Promise<schema.MarketingCampaign[]> {
    return await db.select()
      .from(schema.marketingCampaigns)
      .orderBy(desc(schema.marketingCampaigns.createdAt));
  }

  async getMarketingCampaignsByStatus(status: string): Promise<schema.MarketingCampaign[]> {
    return await db.select()
      .from(schema.marketingCampaigns)
      .where(eq(schema.marketingCampaigns.status, status))
      .orderBy(desc(schema.marketingCampaigns.createdAt));
  }

  async getScheduledMarketingCampaigns(): Promise<schema.MarketingCampaign[]> {
    return await db.select()
      .from(schema.marketingCampaigns)
      .where(
        and(
          eq(schema.marketingCampaigns.status, 'scheduled'),
          lte(schema.marketingCampaigns.scheduledFor, new Date())
        )
      );
  }

  async updateMarketingCampaign(id: string, updates: Partial<schema.InsertMarketingCampaign>): Promise<schema.MarketingCampaign> {
    const [result] = await db.update(schema.marketingCampaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.marketingCampaigns.id, id))
      .returning();
    return result;
  }

  async deleteMarketingCampaign(id: string): Promise<void> {
    await db.delete(schema.marketingCampaigns)
      .where(eq(schema.marketingCampaigns.id, id));
  }

  // Marketing Settings - in-memory storage
  private marketingSettings: { autoPostReviews: boolean; autoPostDelay: number; minReviewRating: number } = {
    autoPostReviews: false,
    autoPostDelay: 24,
    minReviewRating: 4
  };

  async getMarketingSettings(): Promise<{ autoPostReviews: boolean; autoPostDelay: number; minReviewRating: number } | null> {
    return this.marketingSettings;
  }

  async updateMarketingSettings(updates: Partial<{ autoPostReviews: boolean; autoPostDelay: number; minReviewRating: number }>): Promise<{ autoPostReviews: boolean; autoPostDelay: number; minReviewRating: number }> {
    this.marketingSettings = { ...this.marketingSettings, ...updates };
    return this.marketingSettings;
  }

  // ========================================
  // PUSH NOTIFICATIONS - FCM TOKENS
  // ========================================

  async createFcmToken(token: schema.InsertFcmToken): Promise<schema.FcmToken> {
    const [result] = await db.insert(schema.fcmTokens)
      .values(withTenant(token))
      .returning();
    return result;
  }

  async getFcmToken(id: string): Promise<schema.FcmToken | undefined> {
    const [result] = await db.select()
      .from(schema.fcmTokens)
      .where(eq(schema.fcmTokens.id, id));
    return result;
  }

  async getFcmTokensByEmployee(employeeId: string): Promise<schema.FcmToken[]> {
    return await db.select()
      .from(schema.fcmTokens)
      .where(eq(schema.fcmTokens.employeeId, employeeId))
      .orderBy(desc(schema.fcmTokens.lastUsedAt));
  }

  async getFcmTokenByToken(token: string): Promise<schema.FcmToken | undefined> {
    const [result] = await db.select()
      .from(schema.fcmTokens)
      .where(eq(schema.fcmTokens.token, token));
    return result;
  }

  async updateFcmToken(id: string, updates: Partial<schema.InsertFcmToken>): Promise<schema.FcmToken> {
    const [result] = await db.update(schema.fcmTokens)
      .set(updates)
      .where(eq(schema.fcmTokens.id, id))
      .returning();
    return result;
  }

  async deleteFcmToken(id: string): Promise<void> {
    await db.delete(schema.fcmTokens)
      .where(eq(schema.fcmTokens.id, id));
  }

  async deleteFcmTokenByToken(token: string): Promise<void> {
    await db.delete(schema.fcmTokens)
      .where(eq(schema.fcmTokens.token, token));
  }

  async getActiveFcmTokens(employeeId: string): Promise<schema.FcmToken[]> {
    return await db.select()
      .from(schema.fcmTokens)
      .where(
        and(
          eq(schema.fcmTokens.employeeId, employeeId),
          eq(schema.fcmTokens.isActive, true)
        )
      )
      .orderBy(desc(schema.fcmTokens.lastUsedAt));
  }

  async markFcmTokenAsUsed(token: string): Promise<void> {
    await db.update(schema.fcmTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.fcmTokens.token, token));
  }

  // ========================================
  // PUSH NOTIFICATIONS - PREFERENCES
  // ========================================

  async createNotificationPreferences(prefs: schema.InsertNotificationPreferences): Promise<schema.NotificationPreferences> {
    const [result] = await db.insert(schema.notificationPreferences)
      .values(withTenant(prefs))
      .returning();
    return result;
  }

  async getNotificationPreferences(employeeId: string): Promise<schema.NotificationPreferences | undefined> {
    const [result] = await db.select()
      .from(schema.notificationPreferences)
      .where(eq(schema.notificationPreferences.employeeId, employeeId));
    return result;
  }

  async updateNotificationPreferences(employeeId: string, updates: Partial<schema.InsertNotificationPreferences>): Promise<schema.NotificationPreferences> {
    const [result] = await db.update(schema.notificationPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.notificationPreferences.employeeId, employeeId))
      .returning();
    return result;
  }

  // ========================================
  // JOB COMPLETION CHECKLIST (manual ticks)
  // ========================================

  async getJobChecklistCompletions(jobId: string): Promise<schema.JobChecklistCompletion[]> {
    return await db.select()
      .from(schema.jobChecklistCompletions)
      .where(eq(schema.jobChecklistCompletions.jobId, jobId));
  }

  async setJobChecklistItem(
    jobId: string,
    itemId: string,
    employeeId: string | null,
    employeeName: string | null,
  ): Promise<schema.JobChecklistCompletion> {
    const [result] = await db.insert(schema.jobChecklistCompletions)
      .values(withTenant({
        jobId,
        itemId,
        completedByEmployeeId: employeeId,
        completedByName: employeeName,
      }))
      .onConflictDoUpdate({
        target: [schema.jobChecklistCompletions.jobId, schema.jobChecklistCompletions.itemId],
        set: {
          completedAt: new Date(),
          completedByEmployeeId: employeeId,
          completedByName: employeeName,
        },
      })
      .returning();
    return result;
  }

  async clearJobChecklistItem(jobId: string, itemId: string): Promise<void> {
    await db.delete(schema.jobChecklistCompletions)
      .where(
        and(
          eq(schema.jobChecklistCompletions.jobId, jobId),
          eq(schema.jobChecklistCompletions.itemId, itemId),
        ),
      );
  }

  // ========================================
  // CALL RECORDS - HERO INTERNET INTEGRATION
  // ========================================

  async createCallRecord(record: schema.InsertCallRecord): Promise<schema.CallRecord> {
    const [result] = await db.insert(schema.callRecords)
      .values(withTenant(record))
      .returning();
    return result;
  }

  async getCallRecord(id: string): Promise<schema.CallRecord | null> {
    const [result] = await db.select()
      .from(schema.callRecords)
      .where(eq(schema.callRecords.id, id));
    return result || null;
  }

  async updateCallRecord(id: string, updates: Partial<schema.InsertCallRecord>): Promise<schema.CallRecord> {
    const [result] = await db.update(schema.callRecords)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.callRecords.id, id))
      .returning();
    return result;
  }

  async getCallRecords(filters?: {
    jobId?: string;
    customerId?: string;
    leadId?: string;
    direction?: string;
    limit?: number;
  }): Promise<schema.CallRecord[]> {
    const conditions = [];
    
    if (filters?.jobId) {
      conditions.push(eq(schema.callRecords.jobId, filters.jobId));
    }
    if (filters?.customerId) {
      conditions.push(eq(schema.callRecords.customerId, filters.customerId));
    }
    if (filters?.leadId) {
      conditions.push(eq(schema.callRecords.leadId, filters.leadId));
    }
    if (filters?.direction) {
      conditions.push(eq(schema.callRecords.direction, filters.direction));
    }
    
    let query = db.select()
      .from(schema.callRecords)
      .orderBy(desc(schema.callRecords.createdAt));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as typeof query;
    }
    
    return await query;
  }

  async getCallRecordsByJob(jobId: string): Promise<schema.CallRecord[]> {
    return await db.select()
      .from(schema.callRecords)
      .where(eq(schema.callRecords.jobId, jobId))
      .orderBy(desc(schema.callRecords.createdAt));
  }

  async getCallRecordsByCustomer(customerId: string): Promise<schema.CallRecord[]> {
    return await db.select()
      .from(schema.callRecords)
      .where(eq(schema.callRecords.customerId, customerId))
      .orderBy(desc(schema.callRecords.createdAt));
  }

  async deleteCallRecord(id: string): Promise<boolean> {
    const result = await db.delete(schema.callRecords)
      .where(eq(schema.callRecords.id, id));
    return true;
  }

  // ========================================
  // TREE MARKERS - JOB SITE MAPPING
  // ========================================

  async createTreeMarker(marker: schema.InsertTreeMarker): Promise<schema.TreeMarker> {
    const [result] = await db.insert(schema.treeMarkers).values(withTenant(marker)).returning();
    return result;
  }

  async getTreeMarker(id: string): Promise<schema.TreeMarker | null> {
    const [result] = await db.select()
      .from(schema.treeMarkers)
      .where(eq(schema.treeMarkers.id, id));
    return result || null;
  }

  async updateTreeMarker(id: string, updates: schema.UpdateTreeMarker): Promise<schema.TreeMarker> {
    const [result] = await db.update(schema.treeMarkers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.treeMarkers.id, id))
      .returning();
    return result;
  }

  async deleteTreeMarker(id: string): Promise<boolean> {
    await db.delete(schema.treeMarkers)
      .where(eq(schema.treeMarkers.id, id));
    return true;
  }

  async getTreeMarkersByJob(jobId: string): Promise<schema.TreeMarker[]> {
    return await db.select()
      .from(schema.treeMarkers)
      .where(eq(schema.treeMarkers.jobId, jobId))
      .orderBy(schema.treeMarkers.createdAt);
  }

  // ─── Mulch Drops ──────────────────────────────────────────────────────────
  async createMulchDrop(drop: schema.InsertMulchDrop): Promise<schema.MulchDrop> {
    const [created] = await db.insert(schema.mulchDrops).values(withTenant(drop)).returning();
    return created;
  }

  async getMulchDrop(id: string): Promise<schema.MulchDrop | null> {
    const [drop] = await db.select().from(schema.mulchDrops).where(eq(schema.mulchDrops.id, id));
    return drop ?? null;
  }

  async getMulchDrops(status?: string): Promise<schema.MulchDrop[]> {
    const query = db.select().from(schema.mulchDrops);
    if (status) {
      return query.where(eq(schema.mulchDrops.status, status)).orderBy(schema.mulchDrops.sortOrder, schema.mulchDrops.createdAt);
    }
    return query.orderBy(schema.mulchDrops.sortOrder, schema.mulchDrops.createdAt);
  }

  async reorderMulchDrops(orderedIds: string[]): Promise<void> {
    if (!orderedIds.length) return;
    // Pull all drops sorted as currently displayed
    const all = await db.select().from(schema.mulchDrops);
    const byId = new Map(all.map(d => [d.id, d]));
    const sorted = [...all].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    // Walk current order; when we hit an item from orderedIds, slot in the next from the new order.
    // This preserves the position of items not in the reordered set (e.g. items hidden by a status filter).
    const movingSet = new Set(orderedIds);
    let nextIdx = 0;
    const newOrder = sorted.map(d => {
      if (movingSet.has(d.id)) {
        const replacementId = orderedIds[nextIdx++];
        return byId.get(replacementId) ?? d;
      }
      return d;
    });
    for (let i = 0; i < newOrder.length; i++) {
      if (newOrder[i].sortOrder === i) continue;
      await db.update(schema.mulchDrops)
        .set({ sortOrder: i })
        .where(eq(schema.mulchDrops.id, newOrder[i].id));
    }
  }

  async updateMulchDrop(id: string, updates: schema.UpdateMulchDrop): Promise<schema.MulchDrop> {
    const [updated] = await db.update(schema.mulchDrops)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.mulchDrops.id, id))
      .returning();
    if (!updated) throw new Error(`Mulch drop ${id} not found`);
    return updated;
  }

  async deleteMulchDrop(id: string): Promise<boolean> {
    const result = await db.delete(schema.mulchDrops).where(eq(schema.mulchDrops.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createAssistantMessage(message: schema.InsertAssistantMessage): Promise<schema.AssistantMessage> {
    const [created] = await db.insert(schema.assistantMessages).values(withTenant(message)).returning();
    return created;
  }

  async getAssistantMessages(sessionId: string, employeeId: string, limit = 50): Promise<schema.AssistantMessage[]> {
    return await db.select()
      .from(schema.assistantMessages)
      .where(and(
        eq(schema.assistantMessages.sessionId, sessionId),
        eq(schema.assistantMessages.employeeId, employeeId),
      ))
      .orderBy(asc(schema.assistantMessages.createdAt))
      .limit(limit);
  }

  async deleteAssistantSession(sessionId: string, employeeId: string): Promise<void> {
    await db.delete(schema.assistantMessages).where(and(
      eq(schema.assistantMessages.sessionId, sessionId),
      eq(schema.assistantMessages.employeeId, employeeId),
    ));
  }

  // ========================================
  // TASKS — internal Kanban work (not customer jobs)
  // ========================================

  async getTasks(filters: {
    status?: string;
    assigneeId?: string;
    category?: string;
    dueBefore?: Date;
    linkedJobId?: string;
    overdue?: boolean;
  } = {}): Promise<schema.Task[]> {
    const conditions: any[] = [
      sql`${schema.tasks.deletedAt} IS NULL`,
    ];
    if (filters.status) conditions.push(eq(schema.tasks.status, filters.status));
    if (filters.assigneeId) conditions.push(eq(schema.tasks.assigneeId, filters.assigneeId));
    if (filters.category) conditions.push(eq(schema.tasks.category, filters.category));
    if (filters.linkedJobId) conditions.push(eq(schema.tasks.linkedJobId, filters.linkedJobId));
    if (filters.dueBefore) conditions.push(lt(schema.tasks.dueDate, filters.dueBefore));
    if (filters.overdue) {
      conditions.push(lt(schema.tasks.dueDate, new Date()));
      conditions.push(ne(schema.tasks.status, 'done'));
    }
    return await db.select().from(schema.tasks).where(and(...conditions)).orderBy(desc(schema.tasks.createdAt));
  }

  async getTask(id: string): Promise<schema.Task | undefined> {
    const [t] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    return t || undefined;
  }

  async getTasksBoard(): Promise<Record<string, schema.Task[]>> {
    const all = await db.select().from(schema.tasks)
      .where(sql`${schema.tasks.deletedAt} IS NULL`)
      .orderBy(desc(schema.tasks.createdAt));
    const buckets: Record<string, schema.Task[]> = {
      backlog: [], todo: [], in_progress: [], blocked: [], done: [],
    };
    for (const t of all) {
      const s = (t.status || 'todo').toLowerCase();
      (buckets[s] ||= []).push(t);
    }
    return buckets;
  }

  async createTask(input: schema.InsertTask): Promise<schema.Task> {
    const [created] = await db.insert(schema.tasks).values(withTenant(input)).returning();
    return created;
  }

  /**
   * Update a task. When the status transitions to 'done':
   *   1. Stamp completedAt
   *   2. If linkedJobId is set, append a diary entry on that job
   *   3. If recurring, spawn the next instance with parentTaskId pointing back
   * Returns { task, spawned } so the caller can show "next one queued" UX.
   */
  async updateTask(id: string, updates: schema.UpdateTask): Promise<{ task: schema.Task; spawned?: schema.Task }> {
    const before = await this.getTask(id);
    if (!before) throw new Error('Task not found');

    const isCompleting =
      updates.status === 'done' && before.status !== 'done';

    const patch: any = { ...updates, updatedAt: new Date() };
    if (isCompleting) patch.completedAt = new Date();
    // Re-opening a done task clears completedAt so reporting stays consistent.
    if (updates.status && updates.status !== 'done' && before.status === 'done') {
      patch.completedAt = null;
    }

    const [updated] = await db.update(schema.tasks)
      .set(patch)
      .where(eq(schema.tasks.id, id))
      .returning();

    let spawned: schema.Task | undefined;
    if (isCompleting) {
      // Side-effect 1: log to job diary if linked. Best-effort — failure here
      // shouldn't roll back the task update.
      if (updated.linkedJobId) {
        try {
          const assignee = updated.assigneeId
            ? await this.getEmployee(updated.assigneeId).catch(() => null)
            : null;
          const authorName = assignee
            ? `${assignee.firstName} ${assignee.lastName}`.trim() || 'System'
            : 'System';
          await this.createJobDiaryEntry({
            jobId: updated.linkedJobId,
            entryType: 'milestone',
            title: `Task completed: ${updated.title}`,
            description: updated.description || `Internal task '${updated.title}' was marked done.`,
            authorName,
            authorRole: assignee ? 'staff' : 'system',
            tags: ['task-completed'],
            metadata: { taskId: updated.id, category: updated.category },
          } as any);
        } catch (diaryErr) {
          console.error('Failed to log task completion to job diary:', diaryErr);
        }
      }

      // Side-effect 2: spawn the next recurring instance.
      if (updated.recurring && updated.recurringIntervalDays && updated.recurringIntervalDays > 0) {
        const baseDue = updated.dueDate ? new Date(updated.dueDate as any) : new Date();
        const nextDue = new Date(baseDue);
        nextDue.setDate(nextDue.getDate() + updated.recurringIntervalDays);
        const [next] = await db.insert(schema.tasks).values(withTenant({
          title: updated.title,
          description: updated.description,
          category: updated.category,
          priority: updated.priority,
          status: 'todo',
          assigneeId: updated.assigneeId,
          createdBy: updated.createdBy,
          dueDate: nextDue,
          linkedJobId: updated.linkedJobId,
          linkedEquipmentId: updated.linkedEquipmentId,
          recurring: true,
          recurringIntervalDays: updated.recurringIntervalDays,
          parentTaskId: updated.id,
        } as any)).returning();
        spawned = next;
      }
    }

    return { task: updated, spawned };
  }

  async deleteTask(id: string): Promise<boolean> {
    // Soft-delete to preserve recurring chains and audit history.
    const [updated] = await db.update(schema.tasks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.tasks.id, id), sql`${schema.tasks.deletedAt} IS NULL`))
      .returning();
    return !!updated;
  }

  // ─── Lanes ──────────────────────────────────────────────────────────────
  // Per-business buckets a job can optionally sit in (orthogonal to status). Request-path
  // methods rely on RLS / withTenant for tenant scoping. The *Global readers are used by the
  // lane-automation cron, which runs with NO tenant context (db falls back to the owner role),
  // so they intentionally return rows across all businesses; the cron groups them itself.

  async getLanes(opts: { includeArchived?: boolean } = {}): Promise<schema.Lane[]> {
    const conditions: any[] = [];
    if (!opts.includeArchived) conditions.push(eq(schema.lanes.archived, false));
    const q = db.select().from(schema.lanes);
    const rows = conditions.length
      ? await q.where(and(...conditions)).orderBy(asc(schema.lanes.sortOrder), asc(schema.lanes.createdAt))
      : await q.orderBy(asc(schema.lanes.sortOrder), asc(schema.lanes.createdAt));
    return rows;
  }

  async getLane(id: string): Promise<schema.Lane | undefined> {
    const [l] = await db.select().from(schema.lanes).where(eq(schema.lanes.id, id)).limit(1);
    return l || undefined;
  }

  async createLane(input: schema.InsertLane): Promise<schema.Lane> {
    const [created] = await db.insert(schema.lanes).values(withTenant(input)).returning();
    return created;
  }

  async updateLane(id: string, updates: schema.UpdateLane): Promise<schema.Lane | undefined> {
    const [updated] = await db.update(schema.lanes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.lanes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteLane(id: string): Promise<boolean> {
    // Hard delete: lane_automations cascade (FK ON DELETE CASCADE) and jobs.lane_id is nulled
    // (FK ON DELETE SET NULL), so jobs survive and simply leave the lane.
    const [deleted] = await db.delete(schema.lanes).where(eq(schema.lanes.id, id)).returning();
    return !!deleted;
  }

  async reorderLanes(orderedIds: string[]): Promise<void> {
    // Persist the new column order. Sequential awaits keep each update inside the caller's
    // tenant scope; the list is short (a handful of lanes) so this is cheap.
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(schema.lanes)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(schema.lanes.id, orderedIds[i]));
    }
  }

  async getLaneAutomations(laneId: string): Promise<schema.LaneAutomation[]> {
    return await db.select().from(schema.laneAutomations)
      .where(eq(schema.laneAutomations.laneId, laneId))
      .orderBy(asc(schema.laneAutomations.createdAt));
  }

  async getLaneAutomation(id: string): Promise<schema.LaneAutomation | undefined> {
    const [a] = await db.select().from(schema.laneAutomations)
      .where(eq(schema.laneAutomations.id, id)).limit(1);
    return a || undefined;
  }

  async createLaneAutomation(input: schema.InsertLaneAutomation): Promise<schema.LaneAutomation> {
    const [created] = await db.insert(schema.laneAutomations).values(withTenant(input)).returning();
    return created;
  }

  async updateLaneAutomation(id: string, updates: schema.UpdateLaneAutomation): Promise<schema.LaneAutomation | undefined> {
    const [updated] = await db.update(schema.laneAutomations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.laneAutomations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteLaneAutomation(id: string): Promise<boolean> {
    const [deleted] = await db.delete(schema.laneAutomations)
      .where(eq(schema.laneAutomations.id, id)).returning();
    return !!deleted;
  }

  /** Thin assign/move helper. lane_entered_at is stamped centrally in updateJob. */
  async assignJobToLane(jobId: string, laneId: string | null): Promise<Job> {
    return await this.updateJob(jobId, { laneId } as Partial<InsertJob>);
  }

  // --- Cron-only global readers (no tenant filter; see note above) ---

  async getJobsInLanesGlobal(): Promise<Job[]> {
    return await db.select().from(schema.jobs)
      .where(sql`${schema.jobs.laneId} IS NOT NULL`);
  }

  async getActiveLaneAutomationsGlobal(): Promise<schema.LaneAutomation[]> {
    return await db.select().from(schema.laneAutomations)
      .where(eq(schema.laneAutomations.enabled, true));
  }

  /** De-dup: has this automation already fired for this job during its current lane stay? */
  async hasLaneAutomationFiredSince(jobId: string, automationId: string, since: Date): Promise<boolean> {
    const [row] = await db.select({ id: schema.laneAutomationRuns.id })
      .from(schema.laneAutomationRuns)
      .where(and(
        eq(schema.laneAutomationRuns.jobId, jobId),
        eq(schema.laneAutomationRuns.automationId, automationId),
        gte(schema.laneAutomationRuns.firedAt, since),
      ))
      .limit(1);
    return !!row;
  }

  async recordLaneAutomationRun(input: { jobId: string; laneId: string; automationId: string }): Promise<void> {
    await db.insert(schema.laneAutomationRuns).values(withTenant(input)).returning();
  }

  // ─── Payments ───────────────────────────────────────────────────────────
  // Lightweight ledger for customer-received payments (today: Stripe-only
  // deposits at proposal acceptance). The schema is provider-agnostic so we
  // can extend to manual bank-transfer entries without migration.

  async createPayment(payment: schema.InsertPayment): Promise<schema.Payment> {
    const [created] = await db.insert(schema.payments).values(withTenant(payment)).returning();
    return created;
  }

  async getPaymentBySessionId(sessionId: string): Promise<schema.Payment | undefined> {
    const [row] = await db.select().from(schema.payments).where(eq(schema.payments.providerSessionId, sessionId));
    return row || undefined;
  }

  async getPaymentsByProposal(proposalId: string): Promise<schema.Payment[]> {
    return db.select().from(schema.payments).where(eq(schema.payments.proposalId, proposalId));
  }

  async getPaymentsByJob(jobId: string): Promise<schema.Payment[]> {
    return db.select().from(schema.payments).where(eq(schema.payments.jobId, jobId));
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<schema.Payment[]> {
    return db.select().from(schema.payments).where(eq(schema.payments.invoiceId, invoiceId));
  }
}

export const storage = new DatabaseStorage();