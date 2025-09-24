import { 
  type User, type InsertUser, type LeadSubmission, type InsertLeadSubmission,
  type Customer, type InsertCustomer, type CommunicationPreferences, type InsertCommunicationPreferences,
  type Lead, type InsertLead,
  type Call, type InsertCall, type Quote, type InsertQuote,
  type Job, type InsertJob, type JobDiaryEntry, type InsertJobDiaryEntry,
  type Activity, type InsertActivity,
  type Review, type InsertReview, type Campaign, type InsertCampaign,
  type SocialPlan, type InsertSocialPlan, type CompetitorSignal, type InsertCompetitorSignal,
  type PriceRule, type InsertPriceRule, type CsvImportResult,
  type ServiceM8CustomerCsv, type ServiceM8JobCsv, type ServiceM8QuoteCsv,
  type Notification, type InsertNotification, type UpdateNotification, type NotificationSummary, type NotificationWithDetails,
  type BusinessSettings, type InsertBusinessSettings, type UpdateBusinessSettings,
  type Communication, type InsertCommunication, type UpdateCommunication,
  type Equipment, type InsertEquipment, type UpdateEquipment,
  type EquipmentMaintenance, type InsertEquipmentMaintenance,
  type Inventory, type InsertInventory,
  type EquipmentCheckout, type InsertEquipmentCheckout,
  type InventoryTransaction, type InsertInventoryTransaction,
  type Photo, type InsertPhoto, type UpdatePhoto, type PhotoSearch,
  type Invoice, type InsertInvoice, type ServiceRequest, type InsertServiceRequest,
  type CustomerAuth, type InsertCustomerAuth,
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
  // Job Templates and Proposals
  type JobTemplate, type InsertJobTemplate, type UpdateJobTemplate,
  // Email and SMS Templates
  type EmailTemplate, type InsertEmailTemplate, type UpdateEmailTemplate,
  type SmsTemplate, type InsertSmsTemplate, type UpdateSmsTemplate,
  type Proposal, type InsertProposal, type UpdateProposal,
  type ProposalSection, type InsertProposalSection, type UpdateProposalSection,
  type ProposalLineItem, type InsertProposalLineItem, type UpdateProposalLineItem,
  type ProposalLineItemChoice, type InsertProposalLineItemChoice, type UpdateProposalLineItemChoice,
  servicem8CustomerCsvSchema, servicem8JobCsvSchema, servicem8QuoteCsvSchema
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, ilike, and, gte, lte, desc, sql } from "drizzle-orm";
import * as schema from "@shared/schema";

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
  getCustomerByServiceM8Uuid(uuid: string): Promise<Customer | undefined>;
  updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer>;
  getAllCustomers(): Promise<Customer[]>;
  searchCustomers(query: string): Promise<Customer[]>;
  
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
  getCallsByLead(leadId: string): Promise<Call[]>;
  getAllCalls(limit?: number): Promise<Call[]>;
  
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
  getAllJobs(): Promise<Job[]>;
  
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
  getJobDiaryEntriesByJob(jobId: string): Promise<JobDiaryEntry[]>;
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

  getLeadSourceAnalysis(): Promise<{
    source: string;
    count: number;
    conversionRate: number;
    averageValue: number;
    roi: number;
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
  markNotificationAsRead(id: string): Promise<Notification>;
  markAllNotificationsAsRead(userId?: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  getNotificationSummary(userId?: string): Promise<NotificationSummary>;
  deleteExpiredNotifications(): Promise<void>;

  // Employee Management
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  getEmployee(id: string): Promise<Employee | undefined>;
  updateEmployee(id: string, updates: UpdateEmployee): Promise<Employee>;
  getAllEmployees(): Promise<Employee[]>;
  getActiveEmployees(): Promise<Employee[]>;
  getEmployeesByPosition(position: string): Promise<Employee[]>;
  getEmployeesBySkill(skill: string): Promise<Employee[]>;
  deleteEmployee(id: string): Promise<void>;

  // Schedule Management
  createScheduleEvent(event: InsertScheduleEvent): Promise<ScheduleEvent>;
  getScheduleEvent(id: string): Promise<ScheduleEvent | undefined>;
  updateScheduleEvent(id: string, updates: UpdateScheduleEvent): Promise<ScheduleEvent>;
  getAllScheduleEvents(startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]>;
  getScheduleEventsByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]>;
  getScheduleEventsByJob(jobId: string): Promise<ScheduleEvent[]>;
  deleteScheduleEvent(id: string): Promise<void>;

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
  getAllProposals(): Promise<Proposal[]>;
  deleteProposal(id: string): Promise<void>;

  // Proposal Section Management
  createProposalSection(section: InsertProposalSection): Promise<ProposalSection>;
  getProposalSection(id: string): Promise<ProposalSection | undefined>;
  updateProposalSection(id: string, updates: UpdateProposalSection): Promise<ProposalSection>;
  getProposalSectionsByProposal(proposalId: string): Promise<ProposalSection[]>;
  deleteProposalSection(id: string): Promise<void>;
  reorderProposalSections(proposalId: string, sectionIds: string[]): Promise<ProposalSection[]>;
  
  // Proposal Line Item Management
  createProposalLineItem(item: InsertProposalLineItem): Promise<ProposalLineItem>;
  getProposalLineItem(id: string): Promise<ProposalLineItem | undefined>;
  updateProposalLineItem(id: string, updates: UpdateProposalLineItem): Promise<ProposalLineItem>;
  getProposalLineItemsByProposal(proposalId: string): Promise<ProposalLineItem[]>;
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

  // Customer Portal Management
  authenticateCustomer(email: string, phone?: string): Promise<CustomerAuth | undefined>;
  createCustomerAuth(auth: InsertCustomerAuth): Promise<CustomerAuth>;
  getCustomerJobs(customerId: string): Promise<Job[]>;
  getCustomerInvoices(customerId: string): Promise<Invoice[]>;
  getCustomerPhotos(customerId: string, jobId?: string): Promise<Photo[]>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createServiceRequest(request: InsertServiceRequest): Promise<ServiceRequest>;
  getServiceRequest(id: string): Promise<ServiceRequest | undefined>;
  getServiceRequestsByCustomer(customerId: string): Promise<ServiceRequest[]>;

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
  
  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db.insert(schema.customers).values(customer).returning();
    return newCustomer;
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, id));
    return customer || undefined;
  }

  async getCustomerByServiceM8Uuid(uuid: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.servicem8Uuid, uuid));
    return customer || undefined;
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer> {
    const [customer] = await db.update(schema.customers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.customers.id, id))
      .returning();
    return customer;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(schema.customers).orderBy(desc(schema.customers.createdAt));
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const searchTerm = `%${query}%`;
    return await db.select().from(schema.customers)
      .where(
        sql`${schema.customers.name} ILIKE ${searchTerm} OR ${schema.customers.email} ILIKE ${searchTerm}`
      )
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

  // ========================================
  // JOB MANAGEMENT  
  // ========================================
  
  async createJob(job: InsertJob): Promise<Job> {
    const [newJob] = await db.insert(schema.jobs).values(job).returning();
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
    const [job] = await db.update(schema.jobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.jobs.id, id))
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

  async getAllJobs(): Promise<Job[]> {
    return await db.select().from(schema.jobs).orderBy(desc(schema.jobs.createdAt));
  }

  // ========================================
  // JOB TEMPLATE MANAGEMENT
  // ========================================
  
  async createJobTemplate(template: InsertJobTemplate): Promise<JobTemplate> {
    const [newTemplate] = await db.insert(schema.jobTemplates).values(template).returning();
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
    const [newLead] = await db.insert(schema.leads).values(lead).returning();
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
  async createCall(call: InsertCall): Promise<Call> { throw new Error("Not implemented"); }
  async getCall(id: string): Promise<Call | undefined> { return undefined; }
  async updateCall(id: string, updates: Partial<InsertCall>): Promise<Call> { throw new Error("Not implemented"); }
  async getCallsByCustomer(customerId: string): Promise<Call[]> { return []; }
  async getCallsByLead(leadId: string): Promise<Call[]> { return []; }
  async getAllCalls(limit?: number): Promise<Call[]> { return []; }

  // Quotes
  async createQuote(quote: InsertQuote): Promise<Quote> { throw new Error("Not implemented"); }
  async getQuote(id: string): Promise<Quote | undefined> { return undefined; }
  async updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote> { throw new Error("Not implemented"); }
  async getQuotesByCustomer(customerId: string): Promise<Quote[]> { return []; }
  async getQuotesByLead(leadId: string): Promise<Quote[]> { return []; }
  async getAllQuotes(): Promise<Quote[]> { return []; }

  // Job diary entries
  async createJobDiaryEntry(entry: InsertJobDiaryEntry): Promise<JobDiaryEntry> { throw new Error("Not implemented"); }
  async getJobDiaryEntry(id: string): Promise<JobDiaryEntry | undefined> { return undefined; }
  async updateJobDiaryEntry(id: string, updates: Partial<InsertJobDiaryEntry>): Promise<JobDiaryEntry> { throw new Error("Not implemented"); }
  async deleteJobDiaryEntry(id: string): Promise<boolean> { return false; }
  async getJobDiaryEntriesByJob(jobId: string): Promise<JobDiaryEntry[]> { return []; }
  async getJobDiaryEntriesByType(jobId: string, entryType: string): Promise<JobDiaryEntry[]> { return []; }
  async getAllJobDiaryEntries(): Promise<JobDiaryEntry[]> { return []; }

  // All other methods - return empty arrays/undefined or default values
  async updateJobGrossMargin(jobId: string, grossMarginData: any): Promise<Job> { throw new Error("Not implemented"); }
  async calculateAndUpdateGrossMargin(jobId: string): Promise<Job> { throw new Error("Not implemented"); }
  async validateGrossMarginComplete(jobId: string): Promise<boolean> { return false; }
  async updateJobExpenses(jobId: string, expenseData: any): Promise<Job> { throw new Error("Not implemented"); }
  async updateExpenseCompletionStatus(jobId: string, completionData: any): Promise<Job> { throw new Error("Not implemented"); }
  async updateJobStaffTime(jobId: string, staffTimeEntries: any[]): Promise<Job> { throw new Error("Not implemented"); }
  async addStaffTimeEntry(jobId: string, entry: any): Promise<Job> { throw new Error("Not implemented"); }
  async removeStaffTimeEntry(jobId: string, employeeId: string, date?: string): Promise<Job> { throw new Error("Not implemented"); }
  async calculateLaborCostFromStaffTime(jobId: string): Promise<number> { return 0; }
  async getJobStaffTimeEntries(jobId: string): Promise<any[]> { return []; }
  async createActivity(activity: InsertActivity): Promise<Activity> { throw new Error("Not implemented"); }
  async getActivity(id: string): Promise<Activity | undefined> { return undefined; }
  async getActivitiesByCustomer(customerId: string): Promise<Activity[]> { return []; }
  async getActivitiesByLead(leadId: string): Promise<Activity[]> { return []; }
  async getActivitiesByJob(jobId: string): Promise<Activity[]> { return []; }
  async getAllActivities(limit?: number): Promise<Activity[]> { return []; }
  async createReview(review: InsertReview): Promise<Review> { throw new Error("Not implemented"); }
  async getReview(id: string): Promise<Review | undefined> { return undefined; }
  async updateReview(id: string, updates: Partial<InsertReview>): Promise<Review> { throw new Error("Not implemented"); }
  async getReviewsByCustomer(customerId: string): Promise<Review[]> { return []; }
  async getAllReviews(): Promise<Review[]> { return []; }
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

  // Dashboard stats - return empty/default values
  async getDashboardStats(): Promise<any> {
    return {
      totalLeads: 0,
      totalCustomers: 0,
      totalJobs: 0,
      totalRevenue: 0,
      conversionRate: 0,
      averageQuoteValue: 0,
      missedCalls: 0,
      recentCalls: [],
      recentLeads: []
    };
  }

  async getRevenueStats(fromDate?: Date, toDate?: Date): Promise<any> {
    return {
      totalRevenue: 0,
      jobsCompleted: 0,
      averageJobValue: 0,
      monthlyTrend: []
    };
  }

  async getQuoteAnalytics(): Promise<any> {
    return {
      totalQuotes: 0,
      acceptedQuotes: 0,
      rejectedQuotes: 0,
      pendingQuotes: 0,
      averageResponseTime: 0,
      rejectionReasons: [],
      competitorAnalysis: []
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

  async getLeadSourceAnalysis(): Promise<any[]> { return []; }
  async importCustomersFromCsv(csvData: any[]): Promise<CsvImportResult> { throw new Error("Not implemented"); }
  async importJobsFromCsv(csvData: any[]): Promise<CsvImportResult> { throw new Error("Not implemented"); }
  async importQuotesFromCsv(csvData: any[]): Promise<CsvImportResult> { throw new Error("Not implemented"); }

  // All remaining methods return empty/default values
  async createNotification(notification: InsertNotification): Promise<Notification> { throw new Error("Not implemented"); }
  async getNotification(id: string): Promise<Notification | undefined> { return undefined; }
  async updateNotification(id: string, updates: UpdateNotification): Promise<Notification> { throw new Error("Not implemented"); }
  async getAllNotifications(userId?: string, limit?: number): Promise<NotificationWithDetails[]> { return []; }
  async getUnreadNotifications(userId?: string): Promise<NotificationWithDetails[]> { return []; }
  async markNotificationAsRead(id: string): Promise<Notification> { throw new Error("Not implemented"); }
  async markAllNotificationsAsRead(userId?: string): Promise<void> { }
  async deleteNotification(id: string): Promise<void> { }
  async getNotificationSummary(userId?: string): Promise<NotificationSummary> { 
    return { 
      total: 0, 
      unread: 0, 
      byType: {}, 
      byPriority: {},
      recent: []
    }; 
  }
  async deleteExpiredNotifications(): Promise<void> { }

  async createEmployee(employee: InsertEmployee): Promise<Employee> { throw new Error("Not implemented"); }
  async getEmployee(id: string): Promise<Employee | undefined> { return undefined; }
  async updateEmployee(id: string, updates: UpdateEmployee): Promise<Employee> { throw new Error("Not implemented"); }
  async getAllEmployees(): Promise<Employee[]> { return []; }
  async getActiveEmployees(): Promise<Employee[]> { return []; }
  async getEmployeesByPosition(position: string): Promise<Employee[]> { return []; }
  async getEmployeesBySkill(skill: string): Promise<Employee[]> { return []; }
  async deleteEmployee(id: string): Promise<void> { }

  async createScheduleEvent(event: InsertScheduleEvent): Promise<ScheduleEvent> { throw new Error("Not implemented"); }
  async getScheduleEvent(id: string): Promise<ScheduleEvent | undefined> { return undefined; }
  async updateScheduleEvent(id: string, updates: UpdateScheduleEvent): Promise<ScheduleEvent> { throw new Error("Not implemented"); }
  async getAllScheduleEvents(startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]> { return []; }
  async getScheduleEventsByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]> { return []; }
  async getScheduleEventsByJob(jobId: string): Promise<ScheduleEvent[]> { return []; }
  async deleteScheduleEvent(id: string): Promise<void> { }

  async createProposal(proposal: InsertProposal): Promise<Proposal> { throw new Error("Not implemented"); }
  async getProposal(id: string): Promise<Proposal | undefined> { return undefined; }
  async updateProposal(id: string, updates: UpdateProposal): Promise<Proposal> { throw new Error("Not implemented"); }
  async getProposalsByCustomer(customerId: string): Promise<Proposal[]> { return []; }
  async getProposalsByQuote(quoteId: string): Promise<Proposal[]> { return []; }
  async getAllProposals(): Promise<Proposal[]> { return []; }
  async deleteProposal(id: string): Promise<void> { }

  async createProposalSection(section: InsertProposalSection): Promise<ProposalSection> { throw new Error("Not implemented"); }
  async getProposalSection(id: string): Promise<ProposalSection | undefined> { return undefined; }
  async updateProposalSection(id: string, updates: UpdateProposalSection): Promise<ProposalSection> { throw new Error("Not implemented"); }
  async getProposalSectionsByProposal(proposalId: string): Promise<ProposalSection[]> { return []; }
  async deleteProposalSection(id: string): Promise<void> { }
  async reorderProposalSections(proposalId: string, sectionIds: string[]): Promise<ProposalSection[]> { return []; }

  async createProposalLineItem(item: InsertProposalLineItem): Promise<ProposalLineItem> { throw new Error("Not implemented"); }
  async getProposalLineItem(id: string): Promise<ProposalLineItem | undefined> { return undefined; }
  async updateProposalLineItem(id: string, updates: UpdateProposalLineItem): Promise<ProposalLineItem> { throw new Error("Not implemented"); }
  async getProposalLineItemsByProposal(proposalId: string): Promise<ProposalLineItem[]> { return []; }
  async deleteProposalLineItem(id: string): Promise<void> { }
  async reorderProposalLineItems(proposalId: string, itemIds: string[]): Promise<ProposalLineItem[]> { return []; }

  async createProposalLineItemChoice(choice: InsertProposalLineItemChoice): Promise<ProposalLineItemChoice> { throw new Error("Not implemented"); }
  async getProposalLineItemChoice(id: string): Promise<ProposalLineItemChoice | undefined> { return undefined; }
  async updateProposalLineItemChoice(id: string, updates: UpdateProposalLineItemChoice): Promise<ProposalLineItemChoice> { throw new Error("Not implemented"); }
  async getProposalLineItemChoicesByLineItem(lineItemId: string): Promise<ProposalLineItemChoice[]> { return []; }
  async deleteProposalLineItemChoice(id: string): Promise<void> { }
  async deleteProposalLineItemChoicesByLineItem(lineItemId: string): Promise<void> { }

  async createEquipment(equipment: InsertEquipment): Promise<Equipment> { throw new Error("Not implemented"); }
  async getEquipment(id: string): Promise<Equipment | undefined> { return undefined; }
  async updateEquipment(id: string, updates: UpdateEquipment): Promise<Equipment> { throw new Error("Not implemented"); }
  async getAllEquipment(): Promise<Equipment[]> { return []; }
  async getAvailableEquipment(): Promise<Equipment[]> { return []; }
  async getEquipmentByType(type: string): Promise<Equipment[]> { return []; }
  async getEquipmentByStatus(status: string): Promise<Equipment[]> { return []; }
  async deleteEquipment(id: string): Promise<void> { }

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

  async getBusinessSettings(): Promise<BusinessSettings> { throw new Error("Not implemented"); }
  async updateBusinessSettings(updates: UpdateBusinessSettings): Promise<BusinessSettings> { throw new Error("Not implemented"); }
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

  async authenticateCustomer(email: string, phone?: string): Promise<CustomerAuth | undefined> { return undefined; }
  async createCustomerAuth(auth: InsertCustomerAuth): Promise<CustomerAuth> { throw new Error("Not implemented"); }
  async getCustomerJobs(customerId: string): Promise<Job[]> {
    return await this.getJobsByCustomer(customerId);
  }
  async getCustomerInvoices(customerId: string): Promise<Invoice[]> { return []; }
  async getCustomerPhotos(customerId: string, jobId?: string): Promise<Photo[]> { return []; }
  async createInvoice(invoice: InsertInvoice): Promise<Invoice> { throw new Error("Not implemented"); }
  async getInvoice(id: string): Promise<Invoice | undefined> { return undefined; }
  async createServiceRequest(request: InsertServiceRequest): Promise<ServiceRequest> { throw new Error("Not implemented"); }
  async getServiceRequest(id: string): Promise<ServiceRequest | undefined> { return undefined; }
  async getServiceRequestsByCustomer(customerId: string): Promise<ServiceRequest[]> { return []; }

  async getSafetyIncidents(): Promise<SafetyIncident[]> { return []; }
  async getSafetyIncident(id: string): Promise<SafetyIncident | undefined> { return undefined; }
  async createSafetyIncident(incident: InsertSafetyIncident & { incidentNumber: string }): Promise<SafetyIncident> { throw new Error("Not implemented"); }
  async updateSafetyIncident(id: string, updates: Partial<InsertSafetyIncident>): Promise<SafetyIncident> { throw new Error("Not implemented"); }
  async deleteSafetyIncident(id: string): Promise<void> { }
  async getSafetyIncidentsByJob(jobId: string): Promise<SafetyIncident[]> { return []; }
  async getSafetyIncidentsByType(type: string): Promise<SafetyIncident[]> { return []; }
  async getSafetyIncidentsBySeverity(severity: string): Promise<SafetyIncident[]> { return []; }
  async getSafetyIncidentsByStatus(status: string): Promise<SafetyIncident[]> { return []; }

  async createRiskAssessment(assessment: InsertRiskAssessment): Promise<RiskAssessment> { throw new Error("Not implemented"); }
  async getRiskAssessment(id: string): Promise<RiskAssessment | undefined> { return undefined; }
  async updateRiskAssessment(id: string, updates: Partial<InsertRiskAssessment>): Promise<RiskAssessment> { throw new Error("Not implemented"); }
  async getRiskAssessmentsByJob(jobId: string): Promise<RiskAssessment[]> { return []; }
  async getAllRiskAssessments(): Promise<RiskAssessment[]> { return []; }

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

  async createEmailTemplate(templateData: InsertEmailTemplate): Promise<EmailTemplate> { throw new Error("Not implemented"); }
  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> { return undefined; }
  async updateEmailTemplate(id: string, updates: UpdateEmailTemplate): Promise<EmailTemplate> { throw new Error("Not implemented"); }
  async getAllEmailTemplates(): Promise<EmailTemplate[]> { return []; }
  async deleteEmailTemplate(id: string): Promise<void> { }

  async createSmsTemplate(templateData: InsertSmsTemplate): Promise<SmsTemplate> { throw new Error("Not implemented"); }
  async getSmsTemplate(id: string): Promise<SmsTemplate | undefined> { return undefined; }
  async updateSmsTemplate(id: string, updates: UpdateSmsTemplate): Promise<SmsTemplate> { throw new Error("Not implemented"); }
  async getAllSmsTemplates(): Promise<SmsTemplate[]> { return []; }
  async deleteSmsTemplate(id: string): Promise<void> { }
}

export const storage = new DatabaseStorage();