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
  type GeneratedDocumentPhoto, type InsertGeneratedDocumentPhoto
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, ilike, and, gte, lte, lt, gt, ne, desc, sql } from "drizzle-orm";
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
  findCustomerByPhone(phone: string): Promise<Customer | undefined>;
  updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<boolean>;
  getAllCustomers(): Promise<Customer[]>;
  clearAllCustomers(): Promise<number>;
  searchCustomers(query: string): Promise<Customer[]>;
  
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
  getAllJobs(): Promise<Job[]>;
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
  getEmployeeByEmail(email: string): Promise<Employee | undefined>;
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
  getDefaultTemplate(type: string): Promise<DocumentTemplate | undefined>;
  
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
    const [newCustomer] = await db.insert(schema.customers).values(customerData).returning();
    return newCustomer;
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
    return await db.select().from(schema.customers).orderBy(desc(schema.customers.createdAt));
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
      .orderBy(desc(schema.customers.createdAt));
  }

  // ========================================
  // CUSTOMER IMPORT BATCH MANAGEMENT
  // ========================================
  
  async createCustomerImportBatch(batch: InsertCustomerImportBatch): Promise<CustomerImportBatch> {
    const [newBatch] = await db.insert(schema.customerImportBatches).values(batch).returning();
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

  async getAllJobs(): Promise<Job[]> {
    return await db.select().from(schema.jobs).orderBy(desc(schema.jobs.createdAt));
  }

  async clearAllJobs(): Promise<number> {
    const result = await db.delete(schema.jobs);
    return result.rowCount || 0;
  }

  async deleteJob(id: string): Promise<boolean> {
    try {
      // Delete all related records first (in order to avoid foreign key constraints)
      
      // 1. Delete diary entries
      await db.delete(schema.jobDiaryEntries).where(eq(schema.jobDiaryEntries.jobId, id));
      
      // 2. Delete proposals
      await db.delete(schema.proposals).where(eq(schema.proposals.jobId, id));
      
      // 3. Delete staff assignments
      await db.delete(schema.jobStaffAssignments).where(eq(schema.jobStaffAssignments.jobId, id));
      
      // 4. Delete communications
      await db.delete(schema.communications).where(eq(schema.communications.jobId, id));
      
      // Finally, delete the job itself
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
    // Use transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Find or create customer
      let customer;
      if (params.customerPhone) {
        const normalizedPhone = this.normalizePhone(params.customerPhone);
        if (normalizedPhone) {
          const [existingCustomer] = await tx
            .select()
            .from(schema.customers)
            .where(eq(schema.customers.normalizedPhone, normalizedPhone))
            .limit(1);
          customer = existingCustomer;
        }
      }
      
      if (!customer) {
        // Create new customer
        const [newCustomer] = await tx.insert(schema.customers).values({
          name: params.customerName,
          phone: params.customerPhone || null,
          normalizedPhone: this.normalizePhone(params.customerPhone),
          email: params.customerEmail || null,
          address: params.customerAddress || null,
          source: 'phone',
        }).returning();
        customer = newCustomer;
      }

      // Link call to customer
      const [updatedCall1] = await tx.update(schema.calls)
        .set({ customerId: customer.id })
        .where(eq(schema.calls.id, params.callId))
        .returning();

      // Create job
      const [job] = await tx.insert(schema.jobs).values({
        customerId: customer.id,
        title: params.jobTitle,
        description: params.jobDescription || `Job created from call on ${new Date().toLocaleString()}`,
        address: params.jobAddress || params.customerAddress || customer.address || 'Address not specified',
        leadSource: 'phone',
        status: 'quote',
      }).returning();

      // Link call to job
      const [updatedCall2] = await tx.update(schema.calls)
        .set({ jobId: job.id })
        .where(eq(schema.calls.id, params.callId))
        .returning();

      // Create job diary entry for the call
      const diaryContent = params.call.transcript 
        ? `Call recording and transcript from ${params.call.phoneNumber}\n\nTranscript:\n${params.call.transcript}`
        : `Call recording from ${params.call.phoneNumber}`;
      
      await tx.insert(schema.jobDiaryEntries).values({
        jobId: job.id,
        entryType: 'note',
        title: `Phone Call - ${new Date(params.call.createdAt).toLocaleString()}`,
        description: diaryContent,
        authorName: 'Mobile App',
        authorRole: 'system',
      });

      return {
        job,
        customer,
        call: updatedCall2
      };
    });
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
      // Query to get the maximum job number using SQL CAST to handle numeric sorting
      const result = await db.select({ 
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
  async createCall(call: InsertCall): Promise<Call> {
    const [createdCall] = await db.insert(schema.calls).values(call).returning();
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
    return await db.select().from(schema.calls).where(eq(schema.calls.customerId, customerId));
  }
  
  async getCallsByJobId(jobId: string): Promise<Call[]> {
    return await db.select().from(schema.calls).where(eq(schema.calls.jobId, jobId)).orderBy(desc(schema.calls.createdAt));
  }
  
  async getCallsByLead(leadId: string): Promise<Call[]> {
    return await db.select().from(schema.calls).where(eq(schema.calls.leadId, leadId));
  }
  
  async getAllCalls(limit: number = 100): Promise<Call[]> {
    return await db.select().from(schema.calls).limit(limit);
  }

  // API Keys
  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [createdKey] = await db.insert(schema.apiKeys).values(apiKey).returning();
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
    const [createdQuote] = await db.insert(schema.quotes).values(quote).returning();
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
    const [diaryEntry] = await db.insert(schema.jobDiaryEntries).values(entry).returning();
    return diaryEntry;
  }
  async getJobDiaryEntry(id: string): Promise<JobDiaryEntry | undefined> { return undefined; }
  async updateJobDiaryEntry(id: string, updates: Partial<InsertJobDiaryEntry>): Promise<JobDiaryEntry> { throw new Error("Not implemented"); }
  async deleteJobDiaryEntry(id: string): Promise<boolean> { return false; }
  async getJobDiaryEntriesByJob(jobId: string): Promise<JobDiaryEntry[]> {
    return await db.select().from(schema.jobDiaryEntries)
      .where(eq(schema.jobDiaryEntries.jobId, jobId))
      .orderBy(desc(schema.jobDiaryEntries.createdAt));
  }
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
    const [newNotification] = await db.insert(schema.notifications).values(notification).returning();
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
    if (userId) {
      query = query.where(eq(schema.notifications.userId, userId)) as any;
    }
    if (limit) {
      query = query.limit(limit) as any;
    }
    const notifications = await query.orderBy(desc(schema.notifications.createdAt));
    return notifications as NotificationWithDetails[];
  }
  async getUnreadNotifications(userId?: string): Promise<NotificationWithDetails[]> {
    const conditions = [eq(schema.notifications.isRead, false)];
    if (userId) {
      conditions.push(eq(schema.notifications.userId, userId));
    }
    const notifications = await db.select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt));
    return notifications as NotificationWithDetails[];
  }
  async markNotificationAsRead(id: string): Promise<Notification> {
    const [updatedNotification] = await db.update(schema.notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(schema.notifications.id, id))
      .returning();
    return updatedNotification;
  }
  async markAllNotificationsAsRead(userId?: string): Promise<void> {
    if (userId) {
      await db.update(schema.notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(eq(schema.notifications.userId, userId));
    } else {
      await db.update(schema.notifications)
        .set({ isRead: true, readAt: new Date() });
    }
  }
  async deleteNotification(id: string): Promise<void> {
    await db.delete(schema.notifications).where(eq(schema.notifications.id, id));
  }
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

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(schema.employees).values(employee).returning();
    return newEmployee;
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(schema.employees).where(eq(schema.employees.id, id));
    return employee || undefined;
  }

  async getEmployeeByEmail(email: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(schema.employees).where(eq(schema.employees.email, email));
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
      .where(eq(schema.employees.status, 'active'))
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

  async createScheduleEvent(event: InsertScheduleEvent): Promise<ScheduleEvent> { throw new Error("Not implemented"); }
  async getScheduleEvent(id: string): Promise<ScheduleEvent | undefined> { return undefined; }
  async updateScheduleEvent(id: string, updates: UpdateScheduleEvent): Promise<ScheduleEvent> { throw new Error("Not implemented"); }
  async getAllScheduleEvents(startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]> { return []; }
  async getScheduleEventsByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]> { return []; }
  async getScheduleEventsByJob(jobId: string): Promise<ScheduleEvent[]> { return []; }
  async deleteScheduleEvent(id: string): Promise<void> { }

  async createJobStaffAssignment(assignment: InsertJobStaffAssignment): Promise<JobStaffAssignment> {
    const [newAssignment] = await db.insert(schema.jobStaffAssignments).values(assignment).returning();
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
    const [created] = await db.insert(schema.proposals).values(proposal).returning();
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

  async createEquipment(equipment: InsertEquipment): Promise<Equipment> {
    const [newEquipment] = await db.insert(schema.equipment).values(equipment).returning();
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

  // ========================================
  // CONVERSATION MANAGEMENT
  // ========================================
  
  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db.insert(schema.conversations).values(conversation).returning();
    return newConversation;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, id));
    return conversation || undefined;
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
    
    // Subquery to get the first message's fromName for each conversation
    const firstMessageSubquery = db
      .select({
        conversationId: schema.conversationMessages.conversationId,
        fromName: schema.conversationMessages.fromName,
        rowNum: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${schema.conversationMessages.conversationId} ORDER BY ${schema.conversationMessages.createdAt} ASC)`.as('row_num')
      })
      .from(schema.conversationMessages)
      .where(eq(schema.conversationMessages.direction, 'inbound'))
      .as('first_message');
    
    let baseQuery = db
      .select({
        conversations: schema.conversations,
        customerName: schema.customers.name,
        senderName: firstMessageSubquery.fromName
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
    
    // Map results to include customerName or senderName in the conversation object
    return results.map((row: any) => ({
      ...row.conversations,
      customerName: row.customerName || row.senderName
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
    const [newMessage] = await db.insert(schema.conversationMessages).values(message).returning();
    
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

  async authenticateCustomer(email: string, phone?: string): Promise<CustomerAuth | undefined> { return undefined; }
  async createCustomerAuth(auth: InsertCustomerAuth): Promise<CustomerAuth> { throw new Error("Not implemented"); }
  async getCustomerJobs(customerId: string): Promise<Job[]> {
    return await this.getJobsByCustomer(customerId);
  }
  async getCustomerInvoices(customerId: string): Promise<Invoice[]> { return []; }
  async getCustomerPhotos(customerId: string, jobId?: string): Promise<Photo[]> { return []; }
  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [result] = await db.insert(schema.invoices).values(invoice).returning();
    return result;
  }
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
    const [documentTemplate] = await db.insert(schema.documentTemplates).values(template).returning();
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

  async getDefaultTemplate(type: string): Promise<DocumentTemplate | undefined> {
    const [template] = await db.select().from(schema.documentTemplates)
      .where(and(
        eq(schema.documentTemplates.type, type),
        eq(schema.documentTemplates.isDefault, true),
        eq(schema.documentTemplates.isActive, true)
      ));
    return template;
  }

  // Template Sections Management
  async createTemplateSection(section: InsertTemplateSection): Promise<TemplateSection> {
    const [templateSection] = await db.insert(schema.templateSections).values(section).returning();
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
    const [templateLineItem] = await db.insert(schema.templateLineItems).values(lineItem).returning();
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
    const [templatePhoto] = await db.insert(schema.templatePhotos).values(photo).returning();
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
    const [generatedDocument] = await db.insert(schema.generatedDocuments).values(document).returning();
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
    const [generatedDocumentLineItem] = await db.insert(schema.generatedDocumentLineItems).values(lineItem).returning();
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
    const [generatedDocumentPhoto] = await db.insert(schema.generatedDocumentPhotos).values(photo).returning();
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
      .values(material)
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
      .values(service)
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
}

export const storage = new DatabaseStorage();