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
  type Proposal, type InsertProposal, type UpdateProposal,
  type ProposalSection, type InsertProposalSection, type UpdateProposalSection,
  type ProposalLineItem, type InsertProposalLineItem, type UpdateProposalLineItem,
  servicem8CustomerCsvSchema, servicem8JobCsvSchema, servicem8QuoteCsvSchema
} from "@shared/schema";
import { randomUUID } from "crypto";

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
  updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer>;
  getAllCustomers(): Promise<Customer[]>;
  searchCustomers(query: string): Promise<Customer[]>;
  
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
  convertConversationToQuote(conversationId: string, quoteId: string): Promise<Conversation>;
  
  // Conversation Message Management
  createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getConversationMessage(id: string): Promise<ConversationMessage | undefined>;
  updateConversationMessage(id: string, updates: UpdateConversationMessage): Promise<ConversationMessage>;
  deleteConversationMessage(id: string): Promise<void>;
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  markConversationMessagesAsRead(conversationId: string, beforeTimestamp?: Date): Promise<void>;
  getUnreadConversationCount(conversationId?: string): Promise<number>;

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private leads: LeadSubmission[];
  private customers: Map<string, Customer>;
  private communicationPreferences: Map<string, CommunicationPreferences>;
  private pipelineLeads: Map<string, Lead>;
  private calls: Map<string, Call>;
  private quotes: Map<string, Quote>;
  private jobs: Map<string, Job>;
  private jobDiaryEntries: Map<string, JobDiaryEntry>;
  private activities: Map<string, Activity>;
  private reviews: Map<string, Review>;
  private campaigns: Map<string, Campaign>;
  private socialPlans: Map<string, SocialPlan>;
  private competitorSignals: Map<string, CompetitorSignal>;
  private priceRules: Map<string, PriceRule>;
  private notifications: Map<string, Notification>;
  private employees: Map<string, Employee>;
  private scheduleEvents: Map<string, ScheduleEvent>;
  private jobTemplates: Map<string, JobTemplate>;
  private equipment: Map<string, Equipment>;
  private inventory: Map<string, Inventory>;
  private equipmentCheckouts: Map<string, EquipmentCheckout>;
  private equipmentMaintenance: Map<string, EquipmentMaintenance>;
  private inventoryTransactions: Map<string, InventoryTransaction>;
  private photos: Map<string, Photo>;
  private businessSettings: BusinessSettings;
  private communications: Communication[];
  
  // Customer Portal Storage
  private invoices: Map<string, Invoice>;
  private serviceRequests: Map<string, ServiceRequest>;
  private customerAuth: Map<string, CustomerAuth>;
  
  // Safety Management Storage
  private safetyIncidents: Map<string, SafetyIncident>;
  private riskAssessments: Map<string, RiskAssessment>;
  private complianceRequirements: Map<string, ComplianceRequirement>;
  private complianceRecords: Map<string, ComplianceRecord>;

  // Proposal System Storage
  private proposals: Map<string, Proposal>;
  private proposalSections: Map<string, ProposalSection>;
  private proposalLineItems: Map<string, ProposalLineItem>;

  // Conversation Management Storage
  private conversations: Map<string, Conversation>;
  private conversationMessages: Map<string, ConversationMessage>;

  constructor() {
    this.users = new Map();
    this.leads = [];
    this.customers = new Map();
    this.communicationPreferences = new Map();
    this.pipelineLeads = new Map();
    this.calls = new Map();
    this.quotes = new Map();
    this.jobs = new Map();
    this.jobDiaryEntries = new Map();
    this.activities = new Map();
    this.reviews = new Map();
    this.campaigns = new Map();
    this.socialPlans = new Map();
    this.competitorSignals = new Map();
    this.priceRules = new Map();
    this.notifications = new Map();
    this.employees = new Map();
    this.scheduleEvents = new Map();
    this.jobTemplates = new Map();
    this.equipment = new Map();
    this.inventory = new Map();
    this.equipmentCheckouts = new Map();
    this.equipmentMaintenance = new Map();
    this.inventoryTransactions = new Map();
    this.photos = new Map();
    
    // Initialize Customer Portal storage
    this.invoices = new Map();
    this.serviceRequests = new Map();
    this.customerAuth = new Map();
    
    // Initialize Safety Management storage
    this.safetyIncidents = new Map();
    this.riskAssessments = new Map();
    this.complianceRequirements = new Map();
    this.complianceRecords = new Map();

    // Proposal System Storage
    this.proposals = new Map();
    this.proposalSections = new Map();
    this.proposalLineItems = new Map();

    // Conversation Management Storage
    this.conversations = new Map();
    this.conversationMessages = new Map();
    
    // Initialize business settings with defaults
    this.businessSettings = {
      id: '1',
      businessName: 'Treemarkables',
      businessAddress: '123 Arborist Lane, Auckland, New Zealand',
      businessPhone: '+64 9 123 4567',
      businessEmail: 'info@treemarkables.co.nz',
      businessWebsite: 'https://treemarkables.co.nz',
      businessLogo: '',
      leadAssignmentMethod: 'round_robin',
      autoFollowUpDays: 3,
      quotePricingModel: 'standard',
      quoteValidityDays: 30,
      autoQuoteApproval: false,
      jobAutoScheduling: false,
      jobBufferTime: 30,
      cloudSyncEnabled: true,
      backupFrequency: 'daily',
      dataRetentionDays: 365,
      autoBackupTime: '02:00',
      exportFormat: 'csv',
      servicem8Enabled: false,
      servicem8ApiKey: '',
      googleCalendarEnabled: false,
      emailIntegrationEnabled: false,
      paymentGatewayEnabled: false,
      paymentProvider: 'stripe',
      cacheDuration: 300,
      imageQuality: 80,
      realTimeUpdatesInterval: 30,
      autoRefreshEnabled: true,
      maxConcurrentJobs: 50,
      offlineModeEnabled: true,
      gpsTrackingEnabled: true,
      locationAccuracy: 'high',
      mobileDataSync: true,
      fieldPhotoQuality: 85,
      twoFactorRequired: false,
      sessionTimeout: 480,
      passwordExpiration: 90,
      auditLogging: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Initialize communications
    this.communications = [];
    
    // Initialize with sample inventory and equipment data
    this.initializeSampleInventoryData();
    
    // Add sample data for demo purposes
    this.initializeSampleData();
  }
  
  private initializeSampleData() {
    // Enhanced sample customers with realistic data
    const customer1 = { 
      id: '1', name: 'Sarah Johnson', email: 'sarah.johnson@email.com', phone: '(555) 123-4567', 
      address: '123 Maple Street, Remuera, Auckland 1050', city: 'Auckland', region: 'Auckland', 
      notes: 'VIP customer with multiple properties. Prefers morning appointments and detailed quotes. Has a landscaping budget of $15,000 annually.', 
      source: 'Google Ads', lifetimeValue: '8500.00', totalJobs: 12, isActive: true, 
      lastContactDate: new Date('2024-12-18'), preferredContactMethod: 'phone',
      tags: ['vip', 'high-value', 'multiple-properties'],
      createdAt: new Date('2024-01-15'), updatedAt: new Date('2024-12-18') 
    };
    const customer2 = { 
      id: '2', name: 'Mike Chen', email: 'mike.chen@email.com', phone: '(555) 987-6543',
      address: '456 Pine Avenue, Mt Victoria, Wellington 6011', city: 'Wellington', region: 'Wellington',
      notes: 'Commercial property manager for several office buildings. Requires safety certificates and detailed documentation for all work.', 
      source: 'Facebook', lifetimeValue: '12400.00', totalJobs: 8, isActive: true, 
      lastContactDate: new Date('2024-12-20'), preferredContactMethod: 'email',
      tags: ['commercial', 'property-manager', 'documentation-required'],
      createdAt: new Date('2024-03-10'), updatedAt: new Date('2024-12-20') 
    };
    const customer3 = { 
      id: '3', name: 'Emma Wilson', email: 'emma.wilson@email.com', phone: '(555) 456-7890',
      address: '789 Cedar Lane, Fendalton, Christchurch 8041', city: 'Christchurch', region: 'Canterbury',
      notes: 'Regular maintenance customer with quarterly service agreement. Environmentally conscious - prefers sustainable practices.', 
      source: 'Website', lifetimeValue: '3200.00', totalJobs: 15, isActive: true, 
      lastContactDate: new Date('2024-11-25'), preferredContactMethod: 'phone',
      tags: ['maintenance-contract', 'eco-friendly', 'quarterly-service'],
      createdAt: new Date('2024-02-08'), updatedAt: new Date('2024-11-25') 
    };
    const customer4 = { 
      id: '4', name: 'David Rodriguez', email: 'david.rodriguez@email.com', phone: '(555) 321-9876',
      address: '246 Oak Drive, Hamilton East, Hamilton 3216', city: 'Hamilton', region: 'Waikato',
      notes: 'New customer interested in large-scale land clearing project. Budget-conscious but quality-focused.', 
      source: 'Referral', lifetimeValue: '6800.00', totalJobs: 3, isActive: true, 
      lastContactDate: new Date('2024-12-15'), preferredContactMethod: 'sms',
      tags: ['new-customer', 'land-clearing', 'budget-conscious'],
      createdAt: new Date('2024-11-20'), updatedAt: new Date('2024-12-15') 
    };
    const customer5 = { 
      id: '5', name: 'Jennifer Thompson', email: 'jennifer.thompson@email.com', phone: '(555) 654-3210',
      address: '135 Birch Road, Mount Eden, Auckland 1024', city: 'Auckland', region: 'Auckland',
      notes: 'Insurance work specialist. Handles storm damage claims and requires detailed photos and reports for insurance companies.', 
      source: 'Insurance Partner', lifetimeValue: '15600.00', totalJobs: 22, isActive: true, 
      lastContactDate: new Date('2024-12-22'), preferredContactMethod: 'email',
      tags: ['insurance-work', 'storm-damage', 'high-volume'],
      createdAt: new Date('2023-09-12'), updatedAt: new Date('2024-12-22') 
    };
    const customer6 = { 
      id: '6', name: 'Robert Kim', email: 'robert.kim@business.com', phone: '(555) 111-2222',
      address: '88 Corporate Plaza, Newmarket, Auckland 1023', city: 'Auckland', region: 'Auckland',
      notes: 'Corporate client with multiple retail locations. Requires scheduling outside business hours and branded uniforms for staff visibility.', 
      source: 'Website', lifetimeValue: '9200.00', totalJobs: 6, isActive: true, 
      lastContactDate: new Date('2024-12-10'), preferredContactMethod: 'email',
      tags: ['corporate', 'multiple-locations', 'after-hours'],
      createdAt: new Date('2024-05-14'), updatedAt: new Date('2024-12-10') 
    };
    const customer7 = { 
      id: '7', name: 'Lisa Anderson', email: 'lisa.anderson@email.com', phone: '(555) 777-8888',
      address: '95 Elm Street, Riccarton, Christchurch 8011', city: 'Christchurch', region: 'Canterbury',
      notes: 'Elderly customer who has been with us for 5+ years. Requires gentle communication and flexible payment terms.', 
      source: 'Referral', lifetimeValue: '4100.00', totalJobs: 18, isActive: false, 
      lastContactDate: new Date('2024-08-14'), preferredContactMethod: 'phone',
      tags: ['long-term', 'senior-customer', 'flexible-payment'],
      createdAt: new Date('2019-04-20'), updatedAt: new Date('2024-08-14') 
    };
    
    this.customers.set('1', customer1);
    this.customers.set('2', customer2); 
    this.customers.set('3', customer3);
    this.customers.set('4', customer4);
    this.customers.set('5', customer5);
    this.customers.set('6', customer6);
    this.customers.set('7', customer7);
    
    // Sample pipeline leads
    const lead1 = {
      id: '1', name: 'David Thompson', email: 'david.thompson@email.com', phone: '(555) 222-3333',
      source: 'Google Ads', status: 'new', priority: 'medium', leadSource: null, address: null,
      notes: 'Interested in tree pruning services for commercial property', serviceRequested: 'Tree Pruning',
      budget: null, urgency: null, followUpDate: new Date('2024-12-22'), lastContactDate: null,
      customerId: null, assignedTo: null, leadScore: null,
      createdAt: new Date('2024-12-19'), updatedAt: new Date('2024-12-19')
    };
    const lead2 = {
      id: '2', name: 'Lisa Rodriguez', email: 'lisa.rodriguez@email.com', phone: '(555) 444-5555', 
      source: 'Facebook', status: 'contacted', priority: 'high', leadSource: null, address: null,
      notes: 'Urgent tree removal needed. Has budget approved.', serviceRequested: 'Tree Removal',
      budget: null, urgency: null, followUpDate: new Date('2024-12-21'), lastContactDate: null,
      customerId: null, assignedTo: null, leadScore: null,
      createdAt: new Date('2024-12-18'), updatedAt: new Date('2024-12-20')
    };
    const lead3 = {
      id: '3', name: 'Robert Kim', email: 'robert.kim@email.com', phone: '(555) 777-8888',
      source: 'Website', status: 'qualified', priority: 'low', leadSource: null, address: null,
      notes: 'Looking for regular maintenance contract', serviceRequested: 'Maintenance',
      budget: null, urgency: null, followUpDate: new Date('2024-12-23'), lastContactDate: null,
      customerId: null, assignedTo: null, leadScore: null,
      createdAt: new Date('2024-12-16'), updatedAt: new Date('2024-12-19')
    };
    
    this.pipelineLeads.set('1', lead1);
    this.pipelineLeads.set('2', lead2);
    this.pipelineLeads.set('3', lead3);
    
    // Sample jobs
    const job1 = {
      id: '1', customerId: '1', title: 'Large Oak Tree Removal', description: 'Remove dangerous oak tree leaning toward house. Tree shows signs of disease and structural weakness.',
      status: 'completed', priority: 'high', scheduledDate: new Date('2024-12-18'), completedDate: new Date('2024-12-18'),
      estimatedDuration: 8, actualDuration: 9, totalAmount: '2500.00', address: '123 Maple Street, Auckland, NZ',
      serviceType: 'Tree Removal', leadSource: 'website', assignedTeam: ['John Smith', 'Mike Johnson'],
      equipment: ['Chainsaw', 'Wood Chipper', 'Crane', 'Safety Harness'], specialInstructions: 'Coordinate with power company before starting',
      weatherDependent: true, permitRequired: true, insuranceClaim: false,
      laborCosts: '1400.00', materialsCosts: '300.00', otherCosts: '200.00', costOfGoods: '600.00',
      grossMargin: '76.00', profitMargin: '24.00', laborHours: '18.00', hourlyRate: '77.78',
      notes: 'Required additional safety equipment due to power lines', beforePhotos: ['/api/photos/oak_before_1.jpg', '/api/photos/oak_before_2.jpg'],
      afterPhotos: ['/api/photos/oak_after_1.jpg', '/api/photos/oak_after_2.jpg'], jobNumber: 'JOB-001',
      quoteId: '1', leadId: null, assignedCrew: null, equipmentRequired: null,
      safetyNotes: null, rescheduledFrom: null, rescheduledReason: null,
      createdAt: new Date('2024-12-15'), updatedAt: new Date('2024-12-18')
    };
    const job2 = {
      id: '2', customerId: '2', title: 'Storm Damage Tree Removal', description: 'Emergency removal of storm-damaged pine tree blocking access road. Insurance claim approved.',
      status: 'completed', priority: 'high', scheduledDate: new Date('2024-12-20'), completedDate: new Date('2024-12-20'),
      estimatedDuration: 6, actualDuration: 5, totalAmount: '1200.00', address: '456 Pine Avenue, Wellington, NZ',
      serviceType: 'Emergency Tree Removal', leadSource: 'phone', assignedTeam: ['Sarah Wilson', 'Tom Brown'],
      equipment: ['Chainsaw', 'Bucket Truck', 'Safety Equipment'], specialInstructions: 'Emergency response - fast cleanup required',
      weatherDependent: false, permitRequired: true, insuranceClaim: true,
      laborCosts: '700.00', materialsCosts: '150.00', otherCosts: '100.00', costOfGoods: '250.00',
      grossMargin: '79.17', profitMargin: '29.17', laborHours: '10.00', hourlyRate: '70.00',
      notes: 'Completed successfully, permits obtained', beforePhotos: ['/api/photos/storm_before_1.jpg'],
      afterPhotos: ['/api/photos/storm_after_1.jpg'], jobNumber: 'JOB-002', quoteId: '2', leadId: null, assignedCrew: null, equipmentRequired: null,
      safetyNotes: null, rescheduledFrom: null,
      rescheduledReason: null, createdAt: new Date('2024-12-10'), updatedAt: new Date('2024-12-20')
    };
    
    const job3 = {
      id: '3', customerId: '3', title: 'Commercial Hedge Trimming', description: 'Monthly hedge maintenance for office complex. Part of annual maintenance contract.',
      status: 'completed', priority: 'medium', scheduledDate: new Date('2024-12-15'), completedDate: new Date('2024-12-15'),
      estimatedDuration: 4, actualDuration: 4, totalAmount: '800.00', address: '789 Business Park, Auckland, NZ',
      serviceType: 'Hedge Trimming', leadSource: 'referral', assignedTeam: ['Lisa Chen', 'Mark Davis'],
      equipment: ['Hedge Trimmer', 'Ladder', 'Cleanup Equipment'], specialInstructions: 'Work during business hours only',
      weatherDependent: true, permitRequired: false, insuranceClaim: false,
      laborCosts: '480.00', materialsCosts: '80.00', otherCosts: '40.00', costOfGoods: '120.00',
      grossMargin: '85.00', profitMargin: '35.00', laborHours: '8.00', hourlyRate: '60.00',
      notes: 'Regular maintenance contract completed', beforePhotos: ['/api/photos/hedge_before_1.jpg'],
      afterPhotos: ['/api/photos/hedge_after_1.jpg'], jobNumber: 'JOB-003', quoteId: null, leadId: null, assignedCrew: null, equipmentRequired: null,
      safetyNotes: null, rescheduledFrom: null,
      rescheduledReason: null, createdAt: new Date('2024-12-12'), updatedAt: new Date('2024-12-15')
    };
    
    const job4 = {
      id: '4', customerId: '1', title: 'Fruit Tree Pruning', description: 'Seasonal pruning of apple and pear trees to improve fruit production and tree health.',
      status: 'work_order', priority: 'low', scheduledDate: new Date('2024-12-25'), completedDate: null,
      estimatedDuration: 3, actualDuration: null, totalAmount: '450.00', address: '123 Maple Street, Auckland, NZ',
      serviceType: 'Tree Pruning', leadSource: 'direct', assignedTeam: ['Emma Garcia'],
      equipment: ['Pruning Shears', 'Ladder', 'Collection Bags'], specialInstructions: 'Focus on shape and health, remove diseased branches',
      weatherDependent: true, permitRequired: false, insuranceClaim: false,
      laborCosts: '300.00', materialsCosts: '50.00', otherCosts: '25.00', costOfGoods: '75.00',
      grossMargin: '83.33', profitMargin: '27.78', laborHours: '6.00', hourlyRate: '50.00',
      notes: 'Scheduled for next week', beforePhotos: [], afterPhotos: [], jobNumber: 'JOB-004', 
      quoteId: null, leadId: null, assignedCrew: null, equipmentRequired: null,
      safetyNotes: null, rescheduledFrom: null,
      rescheduledReason: null, createdAt: new Date('2024-12-20'), updatedAt: new Date('2024-12-20')
    };
    
    // Add some lead jobs for testing drag functionality
    const job5 = {
      id: '5', customerId: '4', title: 'Large Rimu Tree Assessment', description: 'Initial assessment for possible tree removal. Customer concerned about tree stability near property structures.',
      status: 'lead', priority: 'medium', scheduledDate: null, completedDate: null,
      estimatedDuration: 2, actualDuration: null, totalAmount: null, address: '246 Oak Drive, Hamilton, NZ',
      serviceType: 'Tree Assessment', leadSource: 'google', assignedTeam: [],
      equipment: ['Assessment Tools', 'Measuring Equipment'], specialInstructions: 'Requires power company coordination',
      weatherDependent: true, permitRequired: true, insuranceClaim: false,
      laborCosts: null, materialsCosts: null, otherCosts: null, costOfGoods: null,
      grossMargin: null, profitMargin: null, laborHours: null, hourlyRate: null,
      notes: 'Customer called about large rimu tree near power lines', beforePhotos: [], afterPhotos: [], jobNumber: 'JOB-005',
      quoteId: null, leadId: '1', assignedCrew: null, equipmentRequired: null,
      safetyNotes: 'High voltage lines nearby', rescheduledFrom: null,
      rescheduledReason: null, createdAt: new Date('2024-12-22'), updatedAt: new Date('2024-12-22')
    };
    
    const job6 = {
      id: '6', customerId: '5', title: 'Storm Damage Quote', description: 'Quote for multiple storm-damaged trees after severe weather event. Three large trees damaged, blocking driveway.',
      status: 'quote', priority: 'high', scheduledDate: null, completedDate: null,
      estimatedDuration: 6, actualDuration: null, totalAmount: '3200.00', address: '135 Birch Road, Auckland, NZ',
      serviceType: 'Storm Damage Assessment', leadSource: 'facebook', assignedTeam: ['John Smith', 'Sarah Wilson'],
      equipment: ['Chainsaw', 'Crane', 'Safety Equipment', 'Cleanup Tools'], specialInstructions: 'Insurance documentation required',
      weatherDependent: false, permitRequired: false, insuranceClaim: true,
      laborCosts: '2000.00', materialsCosts: '400.00', otherCosts: '300.00', costOfGoods: '700.00',
      grossMargin: '78.13', profitMargin: '34.38', laborHours: '12.00', hourlyRate: '166.67',
      notes: 'Insurance claim - urgent assessment needed', beforePhotos: [], afterPhotos: [], jobNumber: 'JOB-006',
      quoteId: null, leadId: '2', assignedCrew: null, equipmentRequired: null,
      safetyNotes: 'Multiple trees unstable', rescheduledFrom: null,
      rescheduledReason: null, createdAt: new Date('2024-12-22'), updatedAt: new Date('2024-12-22')
    };
    
    const job7 = {
      id: '7', customerId: '6', title: 'Corporate Landscaping Consultation', description: 'Consultation for ongoing maintenance contract. Large corporate campus with extensive grounds requiring monthly service.',
      status: 'quote', priority: 'low', scheduledDate: null, completedDate: null,
      estimatedDuration: 1, actualDuration: null, totalAmount: '12000.00', address: '88 Corporate Plaza, Auckland, NZ',
      serviceType: 'Consultation', leadSource: 'advertisement', assignedTeam: ['Emma Garcia'],
      equipment: ['Assessment Tools', 'Measuring Equipment'], specialInstructions: 'Present professional appearance',
      weatherDependent: false, permitRequired: false, insuranceClaim: false,
      laborCosts: '8000.00', materialsCosts: '2000.00', otherCosts: '500.00', costOfGoods: '2500.00',
      grossMargin: '79.17', profitMargin: '29.17', laborHours: '40.00', hourlyRate: '200.00',
      notes: 'Potential high-value maintenance contract', beforePhotos: [], afterPhotos: [], jobNumber: 'JOB-007',
      quoteId: null, leadId: '3', assignedCrew: null, equipmentRequired: null,
      safetyNotes: 'Office hours only', rescheduledFrom: null,
      rescheduledReason: null, createdAt: new Date('2024-12-22'), updatedAt: new Date('2024-12-22')
    };

    this.jobs.set('1', job1);
    this.jobs.set('2', job2);
    this.jobs.set('3', job3);
    this.jobs.set('4', job4);
    this.jobs.set('5', job5);
    this.jobs.set('6', job6);
    this.jobs.set('7', job7);

    // Sample invoices for Customer Portal
    const invoice1 = {
      id: 'inv-1',
      customerId: '1',
      jobId: '1',
      invoiceNumber: 'INV-2024-001',
      jobTitle: 'Large Oak Tree Removal',
      issueDate: new Date('2024-12-18'),
      dueDate: new Date('2025-01-18'),
      amount: '2500.00',
      status: 'pending',
      items: [
        { description: 'Tree removal', quantity: 1, rate: 1800, amount: 1800 },
        { description: 'Stump grinding', quantity: 1, rate: 500, amount: 500 },
        { description: 'Debris cleanup', quantity: 1, rate: 200, amount: 200 }
      ],
      notes: 'Payment due within 30 days. Thank you for choosing Treemarkables.',
      createdAt: new Date('2024-12-18'),
      updatedAt: new Date('2024-12-18')
    };

    const invoice2 = {
      id: 'inv-2',
      customerId: '2',
      jobId: '2',
      invoiceNumber: 'INV-2024-002',
      jobTitle: 'Storm Damage Tree Removal',
      issueDate: new Date('2024-12-20'),
      dueDate: new Date('2025-01-20'),
      amount: '1200.00',
      status: 'pending',
      items: [
        { description: 'Emergency tree removal', quantity: 1, rate: 900, amount: 900 },
        { description: 'Safety assessment', quantity: 1, rate: 200, amount: 200 },
        { description: 'Debris removal', quantity: 1, rate: 100, amount: 100 }
      ],
      notes: 'Emergency service - payment due within 15 days.',
      createdAt: new Date('2024-12-20'),
      updatedAt: new Date('2024-12-20')
    };

    const invoice3 = {
      id: 'inv-3',
      customerId: '1',
      jobId: null,
      invoiceNumber: 'INV-2024-003',
      jobTitle: 'Hedge Trimming & Garden Maintenance',
      issueDate: new Date('2024-12-19'),
      dueDate: new Date('2025-01-19'),
      amount: '450.00',
      status: 'paid',
      items: [
        { description: 'Hedge trimming', quantity: 3, rate: 120, amount: 360 },
        { description: 'Garden cleanup', quantity: 1, rate: 90, amount: 90 }
      ],
      notes: 'Quarterly maintenance service completed. Next service due March 2025.',
      createdAt: new Date('2024-12-19'),
      updatedAt: new Date('2024-12-19')
    };

    this.invoices.set('inv-1', invoice1);
    this.invoices.set('inv-2', invoice2);
    this.invoices.set('inv-3', invoice3);

    // Sample customer auth for demo access
    this.customerAuth.set('auth-1', {
      id: 'auth-1',
      customerId: '1',
      email: 'sarah.johnson@email.com',
      phone: '021 555 0123',
      createdAt: new Date('2024-12-15'),
      lastLoginAt: null
    });
    
    // Sample quotes
    const quote1 = {
      id: '1', customerId: '1', jobTitle: 'Large Oak Tree Removal', description: 'Complete removal of 25ft oak tree with stump grinding',
      status: 'accepted', amount: '2500.00', validUntil: new Date('2025-01-15'), quoteNumber: 'Q-001',
      leadId: null, items: [
        { description: 'Tree removal', quantity: 1, unitPrice: 1800.00, total: 1800.00 },
        { description: 'Stump grinding', quantity: 1, unitPrice: 500.00, total: 500.00 },
        { description: 'Debris cleanup', quantity: 1, unitPrice: 200.00, total: 200.00 }
      ], terms: null, taxAmount: null, discountAmount: null, acceptanceDate: null, rejectionReason: null, 
      followUpDate: null, sentDate: null, viewedDate: null, createdBy: null,
      createdAt: new Date('2024-12-12'), updatedAt: new Date('2024-12-15')
    };
    const quote2 = {
      id: '2', customerId: '2', jobTitle: 'Emergency Storm Damage Removal', description: 'Emergency removal of fallen pine tree',
      status: 'pending', amount: '1200.00', validUntil: new Date('2024-12-30'), quoteNumber: 'Q-002',
      leadId: null, items: [
        { description: 'Emergency tree removal', quantity: 1, unitPrice: 1000.00, total: 1000.00 },
        { description: 'Site cleanup', quantity: 1, unitPrice: 200.00, total: 200.00 }
      ], terms: null, taxAmount: null, discountAmount: null, acceptanceDate: null, rejectionReason: null,
      followUpDate: null, sentDate: null, viewedDate: null, createdBy: null,
      createdAt: new Date('2024-12-10'), updatedAt: new Date('2024-12-10')
    };
    
    this.quotes.set('1', quote1);
    this.quotes.set('2', quote2);
    
    // Sample activities
    const activity1 = {
      id: '1', type: 'call', customerId: '1', leadId: null, direction: 'outbound', subject: 'Initial consultation call',
      description: 'Discussed oak tree removal requirements and scheduled site visit', outcome: 'positive',
      duration: 15, jobId: '1', createdBy: null, metadata: null, automationId: null,
      createdAt: new Date('2024-12-15')
    };
    
    this.activities.set('1', activity1);
    
    // Sample notifications
    const sampleNotifications = [
      {
        type: 'new_lead',
        priority: 'high',
        title: 'New Lead Received',
        message: 'David Thompson submitted a new lead for tree pruning services',
        isRead: false,
        actionUrl: '/job-dashboard?tab=leads',
        leadId: '1',
      },
      {
        type: 'follow_up_overdue',
        priority: 'urgent',
        title: 'Follow-up Overdue',
        message: 'Lisa Rodriguez follow-up is 2 days overdue',
        isRead: false,
        actionUrl: '/job-dashboard?tab=leads',
        leadId: '2',
      },
      {
        type: 'job_completed',
        priority: 'medium',
        title: 'Job Completed',
        message: 'Oak tree removal job has been completed successfully',
        isRead: true,
        actionUrl: '/job-dashboard?tab=jobs',
        jobId: '1',
        customerId: '1',
      },
      {
        type: 'quote_sent',
        priority: 'medium',
        title: 'Quote Sent',
        message: 'Quote #Q-2024-001 has been sent to customer',
        isRead: false,
        actionUrl: '/job-dashboard?tab=quotes',
        quoteId: '1',
        customerId: '1',
      },
      {
        type: 'payment_received',
        priority: 'low',
        title: 'Payment Received',
        message: 'Payment of $3,500 received from Sarah Johnson',
        isRead: true,
        actionUrl: '/job-dashboard?tab=jobs',
        customerId: '1',
      },
      {
        type: 'system_alert',
        priority: 'medium',
        title: 'System Alert',
        message: 'Your monthly revenue has increased by 25% compared to last month',
        isRead: false,
        actionUrl: '/job-dashboard?tab=analytics',
      }
    ];

    // Add notifications to storage
    sampleNotifications.forEach((notificationData) => {
      this.createNotification(notificationData);
    });

    // Sample employees  
    const sampleEmployees = [
      {
        firstName: 'Jake',
        lastName: 'Morrison',
        email: 'jake.morrison@treemarkables.co.nz',
        phone: '(555) 111-2222',
        position: 'foreman',
        skillLevel: 'expert',
        skills: ['chainsaw', 'climbing', 'bucket_truck', 'safety_management'],
        certifications: ['ISA Certified Arborist', 'CTSP'],
        hourlyRate: '45.00',
        availableHours: '{"mon": "7-17", "tue": "7-17", "wed": "7-17", "thu": "7-17", "fri": "7-17"}',
        hireDate: new Date('2020-03-15'),
      },
      {
        firstName: 'Maria',
        lastName: 'Silva',
        email: 'maria.silva@treemarkables.co.nz',
        phone: '(555) 333-4444',
        position: 'arborist',
        skillLevel: 'intermediate',
        skills: ['chainsaw', 'climbing', 'pruning'],
        certifications: ['ISA Certified Arborist'],
        hourlyRate: '38.00',
        availableHours: '{"mon": "8-17", "tue": "8-17", "wed": "8-17", "thu": "8-17", "fri": "8-17"}',
        hireDate: new Date('2021-06-01'),
      },
      {
        firstName: 'Tom',
        lastName: 'Bradley',
        email: 'tom.bradley@treemarkables.co.nz',
        phone: '(555) 555-6666',
        position: 'ground_crew',
        skillLevel: 'beginner',
        skills: ['chipper_operation', 'cleanup'],
        certifications: [],
        hourlyRate: '22.00',
        availableHours: '{"mon": "8-17", "tue": "8-17", "wed": "8-17", "thu": "8-17", "fri": "8-17"}',
        hireDate: new Date('2023-01-10'),
      },
    ];

    // Add employees to storage
    sampleEmployees.forEach((employeeData) => {
      this.createEmployee(employeeData);
    });

    // Sample job templates
    const sampleJobTemplates = [
      {
        name: 'Large Tree Removal',
        category: 'tree_removal',
        description: 'Complete removal of large trees (>50cm diameter) including stump grinding',
        basePrice: '2500.00',
        pricePerHour: '120.00',
        materialCosts: '200.00',
        estimatedDuration: 480, // 8 hours
        requiredSkills: ['chainsaw', 'climbing', 'bucket_truck'],
        requiredEquipment: ['chainsaw', 'bucket_truck', 'chipper', 'safety_gear'],
        crewSize: 3,
        safetyRequirements: ['Traffic management', 'Power line clearance', 'Property protection'],
        riskLevel: 'high',
        preJobChecklist: ['Site inspection', 'Hazard assessment', 'Equipment check', 'Permits verified'],
        postJobChecklist: ['Site cleanup', 'Equipment maintenance', 'Customer walkthrough'],
      },
      {
        name: 'Tree Pruning - Standard',
        category: 'pruning',
        description: 'Standard tree pruning for health and aesthetics',
        basePrice: '450.00',
        pricePerHour: '85.00',
        materialCosts: '50.00',
        estimatedDuration: 240, // 4 hours
        requiredSkills: ['climbing', 'pruning'],
        requiredEquipment: ['chainsaw', 'pruning_tools', 'safety_gear'],
        crewSize: 2,
        safetyRequirements: ['Property protection', 'Ladder safety'],
        riskLevel: 'medium',
        preJobChecklist: ['Tree health assessment', 'Equipment check'],
        postJobChecklist: ['Debris cleanup', 'Customer consultation'],
      },
      {
        name: 'Emergency Tree Removal',
        category: 'emergency',
        description: 'Emergency removal of hazardous or storm-damaged trees',
        basePrice: '1800.00',
        pricePerHour: '150.00',
        materialCosts: '150.00',
        estimatedDuration: 360, // 6 hours
        requiredSkills: ['chainsaw', 'climbing', 'emergency_response'],
        requiredEquipment: ['chainsaw', 'bucket_truck', 'safety_gear', 'generator'],
        crewSize: 3,
        safetyRequirements: ['Emergency protocols', 'Power line assessment', 'Traffic control'],
        riskLevel: 'extreme',
        preJobChecklist: ['Emergency assessment', 'Safety perimeter', 'Authority notification'],
        postJobChecklist: ['Area secured', 'Damage documentation', 'Follow-up inspection'],
      },
    ];

    // Add job templates to storage
    sampleJobTemplates.forEach((templateData) => {
      this.createJobTemplate(templateData);
    });

    // Sample equipment
    const sampleEquipment = [
      {
        name: 'Bucket Truck #1',
        type: 'bucket_truck',
        brand: 'Altec',
        model: 'AT37G',
        year: 2019,
        status: 'available',
        condition: 'good',
        currentLocation: 'Main Depot',
        purchasePrice: '125000.00',
        currentValue: '95000.00',
        lastMaintenanceDate: new Date('2024-11-15'),
        nextMaintenanceDate: new Date('2025-02-15'),
        maintenanceIntervalDays: 90,
        serialNumber: 'AT37G-2019-001',
        registrationNumber: 'TM-BT-001',
      },
      {
        name: 'Chainsaw - Stihl MS461',
        type: 'chainsaw',
        brand: 'Stihl',
        model: 'MS461',
        year: 2022,
        status: 'available',
        condition: 'excellent',
        currentLocation: 'Shop',
        purchasePrice: '1200.00',
        currentValue: '950.00',
        lastMaintenanceDate: new Date('2024-12-01'),
        nextMaintenanceDate: new Date('2025-01-01'),
        maintenanceIntervalDays: 30,
        serialNumber: 'ST461-2022-003',
      },
      {
        name: 'Wood Chipper - Vermeer BC1000XL',
        type: 'chipper',
        brand: 'Vermeer',
        model: 'BC1000XL',
        year: 2020,
        status: 'in_use',
        condition: 'good',
        currentLocation: 'Job Site - Auckland',
        assignedTo: 'emp-1', // Jake Morrison
        purchasePrice: '85000.00',
        currentValue: '65000.00',
        lastMaintenanceDate: new Date('2024-10-20'),
        nextMaintenanceDate: new Date('2025-01-20'),
        maintenanceIntervalDays: 90,
        serialNumber: 'VER-BC1000-2020-002',
      },
    ];

    // Add equipment to storage
    sampleEquipment.forEach((equipmentData) => {
      this.createEquipment(equipmentData);
    });

    // Sample schedule events
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const sampleScheduleEvents = [
      {
        title: 'Oak Tree Removal - Sarah Johnson',
        description: 'Large oak tree removal at residential property',
        type: 'job',
        startDate: tomorrow.toISOString(),
        endDate: new Date(tomorrow.getTime() + 8 * 60 * 60 * 1000).toISOString(), // 8 hours later
        jobId: '1',
        customerId: '1',
        assignedEmployees: ['emp-1', 'emp-2'],
        requiredSkills: ['chainsaw', 'climbing', 'bucket_truck'],
        equipment: ['eq-1', 'eq-2'], // Bucket truck and chainsaw
        location: 'Auckland',
        address: '123 Maple Street, Auckland, NZ',
        estimatedDuration: 480,
        priority: 'high',
        weatherDependent: true,
        color: '#EF4444', // Red for tree removal
      },
      {
        title: 'Team Safety Meeting',
        description: 'Monthly safety training and equipment review',
        type: 'meeting',
        startDate: nextWeek.toISOString(),
        endDate: new Date(nextWeek.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours later
        assignedEmployees: ['emp-1', 'emp-2', 'emp-3'],
        location: 'Main Office',
        estimatedDuration: 120,
        priority: 'medium',
        weatherDependent: false,
        color: '#3B82F6', // Blue for meetings
      },
      {
        title: 'Equipment Maintenance',
        description: 'Scheduled maintenance for Bucket Truck #1',
        type: 'maintenance',
        startDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
        endDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(), // 4 hours later
        assignedEmployees: ['emp-1'],
        equipment: ['eq-1'],
        location: 'Service Center',
        estimatedDuration: 240,
        priority: 'medium',
        weatherDependent: false,
        color: '#F59E0B', // Orange for maintenance
      },
    ];

    // Add schedule events to storage
    sampleScheduleEvents.forEach((eventData) => {
      this.createScheduleEvent(eventData);
    });
    
    // Sample communications
    const communications = [
      {
        id: '1',
        platform: 'email',
        type: 'message',
        threadId: null,
        externalId: 'email-001',
        from: 'Sarah Johnson',
        fromEmail: 'sarah.j@email.com',
        fromPhone: null,
        fromHandle: null,
        subject: 'Tree removal quote request',
        content: 'Hi, I need a quote for removing two large oak trees from my backyard. They are approximately 30 feet tall and located near my house. Can you provide an estimate?',
        contentType: 'text',
        to: ['info@treemarkables.co.nz'],
        cc: [],
        bcc: [],
        attachments: [],
        mediaUrls: [],
        isRead: false,
        isStarred: false,
        isArchived: false,
        priority: 'high',
        status: 'new',
        direction: 'inbound',
        category: 'sales',
        tags: ['quote', 'tree-removal'],
        leadId: '1',
        customerId: '1',
        jobId: null,
        assignedTo: null,
        handledBy: null,
        responseRequired: true,
        responseDeadline: new Date('2024-12-23T17:00:00Z'),
        lastResponseAt: null,
        followUpDate: new Date('2024-12-21T10:00:00Z'),
        platformData: {},
        sentAt: new Date('2024-12-20T09:30:00Z'),
        receivedAt: new Date('2024-12-20T09:30:00Z'),
        processedAt: null,
        isActive: true,
        createdAt: new Date('2024-12-20T09:30:00Z'),
        updatedAt: new Date('2024-12-20T09:30:00Z')
      },
      {
        id: '2',
        platform: 'facebook',
        type: 'message',
        threadId: 'fb-thread-001',
        externalId: 'fb-msg-002',
        from: 'Mike Chen',
        fromEmail: null,
        fromPhone: null,
        fromHandle: '@mike.chen.nz',
        subject: 'Hedge trimming inquiry',
        content: 'Saw your Facebook page. Do you do hedge trimming? I have a large hedge that needs professional attention.',
        contentType: 'text',
        to: ['@treemarkables'],
        cc: [],
        bcc: [],
        attachments: [],
        mediaUrls: [],
        isRead: true,
        isStarred: true,
        isArchived: false,
        priority: 'medium',
        status: 'replied',
        direction: 'inbound',
        category: 'inquiry',
        tags: ['hedge-trimming', 'facebook'],
        leadId: '2',
        customerId: '2',
        jobId: null,
        assignedTo: 'emp-001',
        handledBy: 'emp-001',
        responseRequired: false,
        responseDeadline: null,
        lastResponseAt: new Date('2024-12-20T10:15:00Z'),
        followUpDate: null,
        platformData: { messageId: 'fb-msg-002', threadId: 'fb-thread-001' },
        sentAt: new Date('2024-12-20T08:15:00Z'),
        receivedAt: new Date('2024-12-20T08:15:00Z'),
        processedAt: new Date('2024-12-20T10:15:00Z'),
        isActive: true,
        createdAt: new Date('2024-12-20T08:15:00Z'),
        updatedAt: new Date('2024-12-20T10:15:00Z')
      },
      {
        id: '3',
        platform: 'sms',
        type: 'message',
        threadId: null,
        externalId: 'sms-003',
        from: 'Lisa Rodriguez',
        fromEmail: null,
        fromPhone: '+64 21 444 5555',
        fromHandle: null,
        subject: null,
        content: 'Emergency! Large tree fell on my driveway after the storm. Need immediate assistance.',
        contentType: 'text',
        to: ['+64 9 123 4567'],
        cc: [],
        bcc: [],
        attachments: [],
        mediaUrls: [],
        isRead: false,
        isStarred: false,
        isArchived: false,
        priority: 'urgent',
        status: 'new',
        direction: 'inbound',
        category: 'emergency',
        tags: ['emergency', 'storm-damage'],
        leadId: '3',
        customerId: null,
        jobId: null,
        assignedTo: null,
        handledBy: null,
        responseRequired: true,
        responseDeadline: new Date('2024-12-20T12:00:00Z'),
        lastResponseAt: null,
        followUpDate: new Date('2024-12-20T11:00:00Z'),
        platformData: {},
        sentAt: new Date('2024-12-20T07:45:00Z'),
        receivedAt: new Date('2024-12-20T07:45:00Z'),
        processedAt: null,
        isActive: true,
        createdAt: new Date('2024-12-20T07:45:00Z'),
        updatedAt: new Date('2024-12-20T07:45:00Z')
      },
      {
        id: '4',
        platform: 'instagram',
        type: 'dm',
        threadId: 'ig-thread-001',
        externalId: 'ig-dm-004',
        from: 'garden_lover_2024',
        fromEmail: null,
        fromPhone: null,
        fromHandle: '@garden_lover_2024',
        subject: null,
        content: 'Love your recent tree work! Can you help with stump grinding?',
        contentType: 'text',
        to: ['@treemarkables_nz'],
        cc: [],
        bcc: [],
        attachments: [],
        mediaUrls: [],
        isRead: true,
        isStarred: false,
        isArchived: false,
        priority: 'low',
        status: 'new',
        direction: 'inbound',
        category: 'inquiry',
        tags: ['stump-grinding', 'instagram'],
        leadId: null,
        customerId: null,
        jobId: null,
        assignedTo: null,
        handledBy: null,
        responseRequired: true,
        responseDeadline: new Date('2024-12-22T17:00:00Z'),
        lastResponseAt: null,
        followUpDate: new Date('2024-12-21T14:00:00Z'),
        platformData: { userId: 'garden_lover_2024', threadId: 'ig-thread-001' },
        sentAt: new Date('2024-12-19T16:20:00Z'),
        receivedAt: new Date('2024-12-19T16:20:00Z'),
        processedAt: null,
        isActive: true,
        createdAt: new Date('2024-12-19T16:20:00Z'),
        updatedAt: new Date('2024-12-19T16:20:00Z')
      },
      {
        id: '5',
        platform: 'phone',
        type: 'call',
        threadId: null,
        externalId: 'call-005',
        from: 'David Thompson',
        fromEmail: null,
        fromPhone: '+64 21 222 3333',
        fromHandle: null,
        subject: null,
        content: 'Missed call - voicemail: Interested in tree pruning services for commercial property',
        contentType: 'text',
        to: ['+64 9 123 4567'],
        cc: [],
        bcc: [],
        attachments: [],
        mediaUrls: [],
        isRead: false,
        isStarred: false,
        isArchived: false,
        priority: 'medium',
        status: 'new',
        direction: 'inbound',
        category: 'sales',
        tags: ['commercial', 'tree-pruning'],
        leadId: '4',
        customerId: null,
        jobId: null,
        assignedTo: null,
        handledBy: null,
        responseRequired: true,
        responseDeadline: new Date('2024-12-21T17:00:00Z'),
        lastResponseAt: null,
        followUpDate: new Date('2024-12-20T15:00:00Z'),
        platformData: { callDuration: 0, voicemailDuration: 35 },
        sentAt: new Date('2024-12-19T14:30:00Z'),
        receivedAt: new Date('2024-12-19T14:30:00Z'),
        processedAt: null,
        isActive: true,
        createdAt: new Date('2024-12-19T14:30:00Z'),
        updatedAt: new Date('2024-12-19T14:30:00Z')
      }
    ];
    
    this.communications = communications;

    console.log('Sample data initialized successfully');
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async saveLead(leadData: InsertLeadSubmission): Promise<LeadSubmission> {
    const id = randomUUID();
    const createdAt = new Date();
    const lead: LeadSubmission = { 
      ...leadData, 
      id, 
      createdAt 
    };
    this.leads.push(lead);
    
    // Log for grep-able lead tracking
    console.log('LEAD_SUBMISSION', JSON.stringify({
      id: lead.id,
      createdAt: lead.createdAt.toISOString(),
      pagePath: lead.leadSource?.pagePath,
      pageUrl: lead.leadSource?.pageUrl,
      referrer: lead.leadSource?.referrer,
      utmSource: lead.leadSource?.utmSource,
      utmMedium: lead.leadSource?.utmMedium,
      utmCampaign: lead.leadSource?.utmCampaign,
      email: lead.email,
      name: lead.name,
      ip: lead.ip
    }));
    
    return lead;
  }

  async getLeads(fromDate?: Date, toDate?: Date): Promise<LeadSubmission[]> {
    let filteredLeads = this.leads;
    
    if (fromDate) {
      filteredLeads = filteredLeads.filter(lead => lead.createdAt >= fromDate);
    }
    
    if (toDate) {
      filteredLeads = filteredLeads.filter(lead => lead.createdAt <= toDate);
    }
    
    return filteredLeads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getLeadsByPagePath(): Promise<{ pagePath: string; count: number }[]> {
    const pagePathCounts = new Map<string, number>();
    
    this.leads.forEach(lead => {
      const pagePath = lead.leadSource?.pagePath || 'Unknown Page';
      pagePathCounts.set(pagePath, (pagePathCounts.get(pagePath) || 0) + 1);
    });
    
    return Array.from(pagePathCounts.entries())
      .map(([pagePath, count]) => ({ pagePath, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ========================================
  // CUSTOMER MANAGEMENT IMPLEMENTATIONS
  // ========================================

  async createCustomer(customerData: InsertCustomer): Promise<Customer> {
    const id = randomUUID();
    const now = new Date();
    const customer: Customer = {
      ...customerData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.customers.set(id, customer);
    
    console.log('CUSTOMER_CREATED', JSON.stringify({
      id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      source: customer.source
    }));
    
    return customer;
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer> {
    const existing = this.customers.get(id);
    if (!existing) {
      throw new Error(`Customer with id ${id} not found`);
    }
    
    const updated: Customer = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.customers.set(id, updated);
    return updated;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.customers.values())
      .filter(customer =>
        customer.name.toLowerCase().includes(lowercaseQuery) ||
        customer.email?.toLowerCase().includes(lowercaseQuery) ||
        customer.phone?.includes(query) ||
        customer.address?.toLowerCase().includes(lowercaseQuery)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ========================================
  // COMMUNICATION PREFERENCES MANAGEMENT IMPLEMENTATIONS
  // ========================================

  async createCommunicationPreferences(preferences: InsertCommunicationPreferences): Promise<CommunicationPreferences> {
    const id = randomUUID();
    const now = new Date();
    const newPreferences: CommunicationPreferences = {
      ...preferences,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.communicationPreferences.set(preferences.customerId, newPreferences);
    return newPreferences;
  }

  async getCommunicationPreferences(customerId: string): Promise<CommunicationPreferences | undefined> {
    return this.communicationPreferences.get(customerId);
  }

  async updateCommunicationPreferences(customerId: string, updates: Partial<InsertCommunicationPreferences>): Promise<CommunicationPreferences> {
    const existing = this.communicationPreferences.get(customerId);
    
    if (!existing) {
      // UPSERT: Create new preferences if they don't exist (idempotent operation)
      console.log(`[STORAGE] Creating new communication preferences for customer: ${customerId}`);
      const defaultPreferences: InsertCommunicationPreferences = {
        customerId,
        emailEnabled: true,
        smsEnabled: true,
        marketingOptIn: false,
        jobNotifications: true,
        quoteNotifications: true,
        reminderNotifications: true,
        emergencyNotifications: true,
        preferredNotificationTime: 'morning',
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'Pacific/Auckland',
        language: 'en',
        ...updates, // Apply the updates to the defaults
      };
      return this.createCommunicationPreferences(defaultPreferences);
    }

    // UPDATE: Merge updates with existing preferences
    console.log(`[STORAGE] Updating existing communication preferences for customer: ${customerId}`);
    const updated: CommunicationPreferences = {
      ...existing,
      ...updates,
      customerId, // Ensure customerId doesn't change
      updatedAt: new Date(),
    };
    this.communicationPreferences.set(customerId, updated);
    console.log(`[STORAGE] Updated preferences saved:`, updated);
    return updated;
  }

  async deleteCommunicationPreferences(customerId: string): Promise<boolean> {
    return this.communicationPreferences.delete(customerId);
  }

  // ========================================
  // PIPELINE LEAD MANAGEMENT IMPLEMENTATIONS
  // ========================================

  async createPipelineLead(leadData: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const now = new Date();
    const lead: Lead = {
      ...leadData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.pipelineLeads.set(id, lead);
    
    console.log('PIPELINE_LEAD_CREATED', JSON.stringify({
      id,
      name: lead.name,
      phone: lead.phone,
      serviceRequested: lead.serviceRequested,
      status: lead.status,
      source: lead.source
    }));
    
    return lead;
  }

  async getPipelineLead(id: string): Promise<Lead | undefined> {
    return this.pipelineLeads.get(id);
  }

  async updatePipelineLead(id: string, updates: Partial<InsertLead>): Promise<Lead> {
    const existing = this.pipelineLeads.get(id);
    if (!existing) {
      throw new Error(`Pipeline lead with id ${id} not found`);
    }
    
    const updated: Lead = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.pipelineLeads.set(id, updated);
    return updated;
  }

  async getAllPipelineLeads(): Promise<Lead[]> {
    return Array.from(this.pipelineLeads.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPipelineLeadsByStatus(status: string): Promise<Lead[]> {
    return Array.from(this.pipelineLeads.values())
      .filter(lead => lead.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ========================================
  // CALL MANAGEMENT IMPLEMENTATIONS
  // ========================================

  async createCall(callData: InsertCall): Promise<Call> {
    const id = randomUUID();
    const call: Call = {
      ...callData,
      id,
      createdAt: new Date()
    };
    this.calls.set(id, call);
    
    console.log('CALL_CREATED', JSON.stringify({
      id,
      phoneNumber: call.phoneNumber,
      direction: call.direction,
      status: call.status,
      duration: call.duration,
      leadId: call.leadId,
      customerId: call.customerId
    }));
    
    return call;
  }

  async getCall(id: string): Promise<Call | undefined> {
    return this.calls.get(id);
  }

  async updateCall(id: string, updates: Partial<InsertCall>): Promise<Call> {
    const existing = this.calls.get(id);
    if (!existing) {
      throw new Error(`Call with id ${id} not found`);
    }
    
    const updated: Call = {
      ...existing,
      ...updates
    };
    this.calls.set(id, updated);
    return updated;
  }

  async getCallsByCustomer(customerId: string): Promise<Call[]> {
    return Array.from(this.calls.values())
      .filter(call => call.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCallsByLead(leadId: string): Promise<Call[]> {
    return Array.from(this.calls.values())
      .filter(call => call.leadId === leadId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllCalls(limit?: number): Promise<Call[]> {
    const calls = Array.from(this.calls.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return limit ? calls.slice(0, limit) : calls;
  }

  // ========================================
  // QUOTE MANAGEMENT IMPLEMENTATIONS
  // ========================================

  async createQuote(quoteData: InsertQuote): Promise<Quote> {
    const id = randomUUID();
    const now = new Date();
    const quote: Quote = {
      ...quoteData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.quotes.set(id, quote);
    
    console.log('QUOTE_CREATED', JSON.stringify({
      id,
      quoteNumber: quote.quoteNumber,
      amount: quote.amount,
      status: quote.status,
      customerId: quote.customerId,
      leadId: quote.leadId
    }));
    
    return quote;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    return this.quotes.get(id);
  }

  async updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote> {
    const existing = this.quotes.get(id);
    if (!existing) {
      throw new Error(`Quote with id ${id} not found`);
    }
    
    const updated: Quote = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.quotes.set(id, updated);
    return updated;
  }

  async getQuotesByCustomer(customerId: string): Promise<Quote[]> {
    return Array.from(this.quotes.values())
      .filter(quote => quote.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getQuotesByLead(leadId: string): Promise<Quote[]> {
    return Array.from(this.quotes.values())
      .filter(quote => quote.leadId === leadId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllQuotes(): Promise<Quote[]> {
    return Array.from(this.quotes.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ========================================
  // JOB MANAGEMENT IMPLEMENTATIONS
  // ========================================

  async createJob(jobData: InsertJob): Promise<Job> {
    const id = randomUUID();
    const now = new Date();
    const job: Job = {
      ...jobData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(id, job);
    
    console.log('JOB_CREATED', JSON.stringify({
      id,
      jobNumber: job.jobNumber,
      title: job.title,
      status: job.status,
      scheduledDate: job.scheduledDate,
      totalAmount: job.totalAmount,
      customerId: job.customerId
    }));
    
    return job;
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job> {
    const existing = this.jobs.get(id);
    if (!existing) {
      throw new Error(`Job with id ${id} not found`);
    }
    
    const updated: Job = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async getJobsByCustomer(customerId: string): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter(job => job.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getJobsByStatus(status: string): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter(job => job.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ========================================
  // GROSS MARGIN MANAGEMENT IMPLEMENTATIONS
  // ========================================

  async updateJobGrossMargin(jobId: string, grossMarginData: {
    laborCosts?: number;
    materialsCosts?: number;
    otherCosts?: number;
    laborHours?: number;
    hourlyRate?: number;
  }): Promise<Job> {
    const existing = this.jobs.get(jobId);
    if (!existing) {
      throw new Error(`Job with id ${jobId} not found`);
    }

    // Calculate labor costs if hours and rate provided
    let calculatedLaborCosts = grossMarginData.laborCosts;
    if (grossMarginData.laborHours && grossMarginData.hourlyRate) {
      calculatedLaborCosts = grossMarginData.laborHours * grossMarginData.hourlyRate;
    }

    const updates = {
      ...grossMarginData,
      laborCosts: calculatedLaborCosts?.toString(),
      updatedAt: new Date()
    };

    const updated = { ...existing, ...updates };
    this.jobs.set(jobId, updated);

    // Automatically calculate gross margin after updating costs
    return await this.calculateAndUpdateGrossMargin(jobId);
  }

  async calculateAndUpdateGrossMargin(jobId: string): Promise<Job> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job with id ${jobId} not found`);
    }

    const totalAmount = job.totalAmount ? parseFloat(job.totalAmount) : 0;
    const laborCosts = job.laborCosts ? parseFloat(job.laborCosts) : 0;
    const materialsCosts = job.materialsCosts ? parseFloat(job.materialsCosts) : 0;
    const otherCosts = job.otherCosts ? parseFloat(job.otherCosts) : 0;
    const costOfGoods = job.costOfGoods ? parseFloat(job.costOfGoods) : 0;

    // Total costs = labor + materials + other + cost of goods
    const totalCosts = laborCosts + materialsCosts + otherCosts + costOfGoods;
    
    // Gross margin calculation: (Revenue - COGS) / Revenue * 100
    const grossMargin = totalAmount > 0 ? ((totalAmount - totalCosts) / totalAmount) * 100 : 0;
    
    // Check if gross margin calculation is complete
    const grossMarginCalculated = totalAmount > 0 && (laborCosts > 0 || materialsCosts > 0 || otherCosts > 0);

    const updated: Job = {
      ...job,
      grossMargin: grossMargin.toFixed(2),
      grossMarginCalculated,
      updatedAt: new Date()
    };

    this.jobs.set(jobId, updated);

    console.log('GROSS_MARGIN_CALCULATED', JSON.stringify({
      jobId,
      totalAmount,
      totalCosts,
      grossMargin: grossMargin.toFixed(2),
      grossMarginCalculated
    }));

    return updated;
  }

  async validateGrossMarginComplete(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // Check if gross margin has been calculated and job has revenue
    const hasRevenue = job.totalAmount && parseFloat(job.totalAmount) > 0;
    const hasCosts = (job.laborCosts && parseFloat(job.laborCosts) > 0) ||
                     (job.materialsCosts && parseFloat(job.materialsCosts) > 0) ||
                     (job.otherCosts && parseFloat(job.otherCosts) > 0);
    
    return hasRevenue && hasCosts && job.grossMarginCalculated === true;
  }

  // Job Diary Management
  async createJobDiaryEntry(entryData: InsertJobDiaryEntry): Promise<JobDiaryEntry> {
    const id = randomUUID();
    const now = new Date();
    const entry: JobDiaryEntry = {
      ...entryData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.jobDiaryEntries.set(id, entry);
    
    console.log('JOB_DIARY_ENTRY_CREATED', JSON.stringify({
      id,
      jobId: entry.jobId,
      entryType: entry.entryType,
      title: entry.title,
      authorName: entry.authorName
    }));
    
    return entry;
  }

  async getJobDiaryEntry(id: string): Promise<JobDiaryEntry | undefined> {
    return this.jobDiaryEntries.get(id);
  }

  async updateJobDiaryEntry(id: string, updates: Partial<InsertJobDiaryEntry>): Promise<JobDiaryEntry> {
    const existing = this.jobDiaryEntries.get(id);
    if (!existing) {
      throw new Error(`Job diary entry with id ${id} not found`);
    }
    
    const updated: JobDiaryEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.jobDiaryEntries.set(id, updated);
    return updated;
  }

  async deleteJobDiaryEntry(id: string): Promise<boolean> {
    return this.jobDiaryEntries.delete(id);
  }

  async getJobDiaryEntriesByJob(jobId: string): Promise<JobDiaryEntry[]> {
    return Array.from(this.jobDiaryEntries.values())
      .filter(entry => entry.jobId === jobId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getJobDiaryEntriesByType(jobId: string, entryType: string): Promise<JobDiaryEntry[]> {
    return Array.from(this.jobDiaryEntries.values())
      .filter(entry => entry.jobId === jobId && entry.entryType === entryType)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllJobDiaryEntries(): Promise<JobDiaryEntry[]> {
    return Array.from(this.jobDiaryEntries.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ========================================
  // ACTIVITY TRACKING IMPLEMENTATIONS
  // ========================================

  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const activity: Activity = {
      ...activityData,
      id,
      createdAt: new Date()
    };
    this.activities.set(id, activity);
    
    console.log('ACTIVITY_CREATED', JSON.stringify({
      id,
      type: activity.type,
      subject: activity.subject,
      customerId: activity.customerId,
      leadId: activity.leadId,
      jobId: activity.jobId
    }));
    
    return activity;
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    return this.activities.get(id);
  }

  async getActivitiesByCustomer(customerId: string): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .filter(activity => activity.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActivitiesByLead(leadId: string): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .filter(activity => activity.leadId === leadId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActivitiesByJob(jobId: string): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .filter(activity => activity.jobId === jobId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllActivities(limit?: number): Promise<Activity[]> {
    const activities = Array.from(this.activities.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return limit ? activities.slice(0, limit) : activities;
  }

  // ========================================
  // REVIEW MANAGEMENT IMPLEMENTATIONS
  // ========================================

  async createReview(reviewData: InsertReview): Promise<Review> {
    const id = randomUUID();
    const review: Review = {
      ...reviewData,
      id,
      createdAt: new Date()
    };
    this.reviews.set(id, review);
    
    console.log('REVIEW_CREATED', JSON.stringify({
      id,
      platform: review.platform,
      rating: review.rating,
      customerId: review.customerId,
      jobId: review.jobId
    }));
    
    return review;
  }

  async getReview(id: string): Promise<Review | undefined> {
    return this.reviews.get(id);
  }

  async updateReview(id: string, updates: Partial<InsertReview>): Promise<Review> {
    const existing = this.reviews.get(id);
    if (!existing) {
      throw new Error(`Review with id ${id} not found`);
    }
    
    const updated: Review = {
      ...existing,
      ...updates
    };
    this.reviews.set(id, updated);
    return updated;
  }

  async getReviewsByCustomer(customerId: string): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .filter(review => review.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllReviews(): Promise<Review[]> {
    return Array.from(this.reviews.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ========================================
  // CAMPAIGN MANAGEMENT IMPLEMENTATIONS
  // ========================================

  async createCampaign(campaignData: InsertCampaign): Promise<Campaign> {
    const id = randomUUID();
    const now = new Date();
    const campaign: Campaign = {
      ...campaignData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.campaigns.set(id, campaign);
    
    console.log('CAMPAIGN_CREATED', JSON.stringify({
      id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      budget: campaign.budget
    }));
    
    return campaign;
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async updateCampaign(id: string, updates: Partial<InsertCampaign>): Promise<Campaign> {
    const existing = this.campaigns.get(id);
    if (!existing) {
      throw new Error(`Campaign with id ${id} not found`);
    }
    
    const updated: Campaign = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.campaigns.set(id, updated);
    return updated;
  }

  async getAllCampaigns(): Promise<Campaign[]> {
    return Array.from(this.campaigns.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ========================================
  // SOCIAL MEDIA PLANNING IMPLEMENTATIONS
  // ========================================

  async createSocialPlan(planData: InsertSocialPlan): Promise<SocialPlan> {
    const id = randomUUID();
    const now = new Date();
    const plan: SocialPlan = {
      ...planData,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.socialPlans.set(id, plan);
    
    console.log('SOCIAL_PLAN_CREATED', JSON.stringify({
      id,
      platform: plan.platform,
      contentType: plan.contentType,
      scheduledDate: plan.scheduledDate
    }));
    
    return plan;
  }

  async getSocialPlan(id: string): Promise<SocialPlan | undefined> {
    return this.socialPlans.get(id);
  }

  async updateSocialPlan(id: string, updates: Partial<InsertSocialPlan>): Promise<SocialPlan> {
    const existing = this.socialPlans.get(id);
    if (!existing) {
      throw new Error(`Social plan with id ${id} not found`);
    }
    
    const updated: SocialPlan = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.socialPlans.set(id, updated);
    return updated;
  }

  async getAllSocialPlans(): Promise<SocialPlan[]> {
    return Array.from(this.socialPlans.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getSocialPlansByStatus(status: string): Promise<SocialPlan[]> {
    return Array.from(this.socialPlans.values())
      .filter(plan => plan.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ========================================
  // COMPETITOR INTELLIGENCE IMPLEMENTATIONS
  // ========================================

  async createCompetitorSignal(signalData: InsertCompetitorSignal): Promise<CompetitorSignal> {
    const id = randomUUID();
    const now = new Date();
    const signal: CompetitorSignal = {
      ...signalData,
      id,
      detectedAt: now,
      createdAt: now
    };
    this.competitorSignals.set(id, signal);
    
    console.log('COMPETITOR_SIGNAL_CREATED', JSON.stringify({
      id,
      competitorName: signal.competitorName,
      signal: signal.signal,
      impact: signal.impact,
      actionRequired: signal.actionRequired
    }));
    
    return signal;
  }

  async getCompetitorSignal(id: string): Promise<CompetitorSignal | undefined> {
    return this.competitorSignals.get(id);
  }

  async updateCompetitorSignal(id: string, updates: Partial<InsertCompetitorSignal>): Promise<CompetitorSignal> {
    const existing = this.competitorSignals.get(id);
    if (!existing) {
      throw new Error(`Competitor signal with id ${id} not found`);
    }
    
    const updated: CompetitorSignal = {
      ...existing,
      ...updates
    };
    this.competitorSignals.set(id, updated);
    return updated;
  }

  async getAllCompetitorSignals(): Promise<CompetitorSignal[]> {
    return Array.from(this.competitorSignals.values())
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  async getCompetitorSignalsByCompetitor(competitorName: string): Promise<CompetitorSignal[]> {
    return Array.from(this.competitorSignals.values())
      .filter(signal => signal.competitorName === competitorName)
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  // ========================================
  // PRICING RULES IMPLEMENTATIONS
  // ========================================

  async createPriceRule(ruleData: InsertPriceRule): Promise<PriceRule> {
    const id = randomUUID();
    const now = new Date();
    const rule: PriceRule = {
      ...ruleData,
      id,
      validFrom: now,
      createdAt: now,
      updatedAt: now
    };
    this.priceRules.set(id, rule);
    
    console.log('PRICE_RULE_CREATED', JSON.stringify({
      id,
      serviceName: rule.serviceName,
      basePrice: rule.basePrice,
      priceUnit: rule.priceUnit
    }));
    
    return rule;
  }

  async getPriceRule(id: string): Promise<PriceRule | undefined> {
    return this.priceRules.get(id);
  }

  async updatePriceRule(id: string, updates: Partial<InsertPriceRule>): Promise<PriceRule> {
    const existing = this.priceRules.get(id);
    if (!existing) {
      throw new Error(`Price rule with id ${id} not found`);
    }
    
    const updated: PriceRule = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.priceRules.set(id, updated);
    return updated;
  }

  async getAllPriceRules(): Promise<PriceRule[]> {
    return Array.from(this.priceRules.values())
      .filter(rule => rule.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPriceRulesByService(serviceName: string): Promise<PriceRule[]> {
    return Array.from(this.priceRules.values())
      .filter(rule => rule.serviceName === serviceName && rule.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ========================================
  // BUSINESS INTELLIGENCE IMPLEMENTATIONS
  // ========================================

  async getDashboardStats(): Promise<{
    totalLeads: number;
    totalCustomers: number;
    totalJobs: number;
    totalRevenue: number;
    conversionRate: number;
    averageQuoteValue: number;
    missedCalls: number;
    recentCalls: Call[];
    recentLeads: Lead[];
  }> {
    const leads = Array.from(this.pipelineLeads.values());
    const customers = Array.from(this.customers.values());
    const jobs = Array.from(this.jobs.values());
    const quotes = Array.from(this.quotes.values());
    const calls = Array.from(this.calls.values());
    
    const completedJobs = jobs.filter(job => job.status === 'completed');
    const totalRevenue = completedJobs.reduce((sum, job) => sum + (Number(job.totalAmount) || 0), 0);
    
    const acceptedQuotes = quotes.filter(quote => quote.status === 'accepted');
    const conversionRate = leads.length > 0 ? (acceptedQuotes.length / leads.length) * 100 : 0;
    
    const averageQuoteValue = quotes.length > 0 
      ? quotes.reduce((sum, quote) => sum + (Number(quote.amount) || 0), 0) / quotes.length 
      : 0;
      
    const missedCalls = calls.filter(call => call.status === 'missed').length;
    
    const recentCalls = calls
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);
      
    const recentLeads = leads
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);
    
    return {
      totalLeads: leads.length,
      totalCustomers: customers.length,
      totalJobs: jobs.length,
      totalRevenue,
      conversionRate,
      averageQuoteValue,
      missedCalls,
      recentCalls,
      recentLeads
    };
  }

  async getRevenueStats(fromDate?: Date, toDate?: Date): Promise<{
    totalRevenue: number;
    jobsCompleted: number;
    averageJobValue: number;
    monthlyTrend: { month: string; revenue: number; jobs: number }[];
  }> {
    let jobs = Array.from(this.jobs.values()).filter(job => job.status === 'completed');
    
    if (fromDate) {
      jobs = jobs.filter(job => job.completedDate && job.completedDate >= fromDate);
    }
    if (toDate) {
      jobs = jobs.filter(job => job.completedDate && job.completedDate <= toDate);
    }
    
    const totalRevenue = jobs.reduce((sum, job) => sum + (Number(job.totalAmount) || 0), 0);
    const averageJobValue = jobs.length > 0 ? totalRevenue / jobs.length : 0;
    
    // Group by month for trend analysis
    const monthlyData = new Map<string, { revenue: number; jobs: number }>();
    jobs.forEach(job => {
      if (job.completedDate) {
        const monthKey = job.completedDate.toISOString().substring(0, 7); // YYYY-MM
        const existing = monthlyData.get(monthKey) || { revenue: 0, jobs: 0 };
        existing.revenue += Number(job.totalAmount) || 0;
        existing.jobs += 1;
        monthlyData.set(monthKey, existing);
      }
    });
    
    const monthlyTrend = Array.from(monthlyData.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
    
    return {
      totalRevenue,
      jobsCompleted: jobs.length,
      averageJobValue,
      monthlyTrend
    };
  }

  async getQuoteAnalytics(): Promise<{
    totalQuotes: number;
    acceptedQuotes: number;
    rejectedQuotes: number;
    pendingQuotes: number;
    averageResponseTime: number;
    rejectionReasons: { reason: string; count: number }[];
    competitorAnalysis: { competitor: string; averagePrice: number; winRate: number }[];
  }> {
    const quotes = Array.from(this.quotes.values());
    
    const acceptedQuotes = quotes.filter(quote => quote.status === 'accepted').length;
    const rejectedQuotes = quotes.filter(quote => quote.status === 'rejected').length;
    const pendingQuotes = quotes.filter(quote => quote.status === 'sent' || quote.status === 'viewed').length;
    
    // Calculate average response time
    const responseTimes = quotes
      .filter(quote => quote.sentDate && quote.responseDate)
      .map(quote => {
        const sent = quote.sentDate!.getTime();
        const responded = quote.responseDate!.getTime();
        return (responded - sent) / (1000 * 60 * 60 * 24); // days
      });
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    
    // Rejection reasons analysis
    const rejectionReasonCounts = new Map<string, number>();
    quotes.filter(quote => quote.rejectionReason).forEach(quote => {
      const reason = quote.rejectionReason!;
      rejectionReasonCounts.set(reason, (rejectionReasonCounts.get(reason) || 0) + 1);
    });
    
    const rejectionReasons = Array.from(rejectionReasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
    
    // Competitor analysis
    const competitorData = new Map<string, { prices: number[]; wins: number; total: number }>();
    quotes.filter(quote => quote.competitorName).forEach(quote => {
      const name = quote.competitorName!;
      const existing = competitorData.get(name) || { prices: [], wins: 0, total: 0 };
      
      if (quote.competitorPrice) {
        existing.prices.push(Number(quote.competitorPrice));
      }
      if (quote.status === 'accepted') {
        existing.wins += 1;
      }
      existing.total += 1;
      competitorData.set(name, existing);
    });
    
    const competitorAnalysis = Array.from(competitorData.entries())
      .map(([competitor, data]) => ({
        competitor,
        averagePrice: data.prices.length > 0 ? data.prices.reduce((sum, price) => sum + price, 0) / data.prices.length : 0,
        winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0
      }))
      .sort((a, b) => b.winRate - a.winRate);
    
    return {
      totalQuotes: quotes.length,
      acceptedQuotes,
      rejectedQuotes,
      pendingQuotes,
      averageResponseTime,
      rejectionReasons,
      competitorAnalysis
    };
  }

  // ========================================
  // ENHANCED LEAD ANALYTICS IMPLEMENTATIONS  
  // ========================================

  async getLeadScoring(): Promise<(Lead & { score: number; priority: 'hot' | 'warm' | 'cold' })[]> {
    const leads = Array.from(this.pipelineLeads.values());
    const activities = Array.from(this.activities.values());
    
    return leads.map(lead => {
      let score = 0;
      
      // Urgency scoring
      switch (lead.urgency) {
        case 'emergency': score += 40; break;
        case 'high': score += 30; break;
        case 'medium': score += 20; break;
        case 'low': score += 10; break;
      }
      
      // Estimated value scoring
      const value = Number(lead.estimatedValue) || 0;
      if (value > 5000) score += 30;
      else if (value > 2000) score += 20;
      else if (value > 1000) score += 10;
      
      // Recent activity scoring
      const leadActivities = activities.filter(a => a.leadId === lead.id);
      const recentActivity = leadActivities.find(a => 
        a.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );
      if (recentActivity) score += 15;
      
      // Source quality scoring
      switch (lead.source) {
        case 'referral': score += 25; break;
        case 'google': score += 20; break;
        case 'website': score += 15; break;
        case 'facebook': score += 10; break;
        case 'phone': score += 20; break;
      }
      
      // Age penalty (older leads lose priority)
      const daysSinceCreated = Math.floor((Date.now() - lead.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSinceCreated > 14) score -= 20;
      else if (daysSinceCreated > 7) score -= 10;
      
      // Status bonus/penalty
      switch (lead.status) {
        case 'new': score += 10; break;
        case 'contacted': score += 5; break;
        case 'qualified': score += 20; break;
        case 'quoted': score += 15; break;
        case 'lost': score = 0; break;
      }
      
      // Determine priority
      let priority: 'hot' | 'warm' | 'cold';
      if (score >= 70) priority = 'hot';
      else if (score >= 40) priority = 'warm';
      else priority = 'cold';
      
      return { ...lead, score, priority };
    }).sort((a, b) => b.score - a.score);
  }

  async getConversionFunnel(): Promise<{
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
  }> {
    const leads = Array.from(this.pipelineLeads.values());
    
    const statusCounts = {
      leads: leads.length,
      contacted: leads.filter(l => ['contacted', 'qualified', 'quoted', 'won'].includes(l.status)).length,
      qualified: leads.filter(l => ['qualified', 'quoted', 'won'].includes(l.status)).length,
      quoted: leads.filter(l => ['quoted', 'won'].includes(l.status)).length,
      won: leads.filter(l => l.status === 'won').length
    };
    
    const conversionRates = {
      leadToContact: statusCounts.leads > 0 ? (statusCounts.contacted / statusCounts.leads) * 100 : 0,
      contactToQualified: statusCounts.contacted > 0 ? (statusCounts.qualified / statusCounts.contacted) * 100 : 0,
      qualifiedToQuote: statusCounts.qualified > 0 ? (statusCounts.quoted / statusCounts.qualified) * 100 : 0,
      quoteToWin: statusCounts.quoted > 0 ? (statusCounts.won / statusCounts.quoted) * 100 : 0,
      overallConversion: statusCounts.leads > 0 ? (statusCounts.won / statusCounts.leads) * 100 : 0
    };
    
    const dropOffAnalysis = [
      { stage: 'Lead to Contact', count: statusCounts.leads - statusCounts.contacted, percentage: 100 - conversionRates.leadToContact },
      { stage: 'Contact to Qualified', count: statusCounts.contacted - statusCounts.qualified, percentage: 100 - conversionRates.contactToQualified },
      { stage: 'Qualified to Quote', count: statusCounts.qualified - statusCounts.quoted, percentage: 100 - conversionRates.qualifiedToQuote },
      { stage: 'Quote to Win', count: statusCounts.quoted - statusCounts.won, percentage: 100 - conversionRates.quoteToWin }
    ];
    
    return {
      ...statusCounts,
      conversionRates,
      dropOffAnalysis
    };
  }
  
  async getFollowUpQueue(): Promise<{
    overdue: Lead[];
    today: Lead[];
    thisWeek: Lead[];
    total: number;
  }> {
    const leads = Array.from(this.pipelineLeads.values())
      .filter(lead => lead.followUpDate && !['won', 'lost'].includes(lead.status));
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const overdue = leads.filter(lead => lead.followUpDate! < today);
    const todayFollowUps = leads.filter(lead => {
      const followUp = new Date(lead.followUpDate!);
      return followUp >= today && followUp < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    });
    const thisWeek = leads.filter(lead => {
      const followUp = new Date(lead.followUpDate!);
      return followUp >= today && followUp <= weekFromNow && !todayFollowUps.includes(lead);
    });
    
    return {
      overdue: overdue.sort((a, b) => a.followUpDate!.getTime() - b.followUpDate!.getTime()),
      today: todayFollowUps.sort((a, b) => a.followUpDate!.getTime() - b.followUpDate!.getTime()),
      thisWeek: thisWeek.sort((a, b) => a.followUpDate!.getTime() - b.followUpDate!.getTime()),
      total: leads.length
    };
  }

  async getLeadSourceAnalysis(): Promise<{
    source: string;
    count: number;
    conversionRate: number;
    averageValue: number;
    roi: number;
  }[]> {
    const leads = Array.from(this.pipelineLeads.values());
    const jobs = Array.from(this.jobs.values());
    const campaigns = Array.from(this.campaigns.values());
    
    const sourceMap = new Map<string, {
      count: number;
      won: number;
      totalValue: number;
      cost: number;
    }>();
    
    // Initialize source data
    leads.forEach(lead => {
      const source = lead.source || 'unknown';
      const existing = sourceMap.get(source) || { count: 0, won: 0, totalValue: 0, cost: 0 };
      existing.count += 1;
      
      if (lead.status === 'won') {
        existing.won += 1;
        // Find associated job for actual value
        const job = jobs.find(j => j.customerId === lead.customerId);
        if (job && job.totalAmount) {
          existing.totalValue += Number(job.totalAmount);
        }
      }
      
      sourceMap.set(source, existing);
    });
    
    // Add campaign costs
    campaigns.forEach(campaign => {
      if (campaign.channel && campaign.totalSpent) {
        const existing = sourceMap.get(campaign.channel) || { count: 0, won: 0, totalValue: 0, cost: 0 };
        existing.cost += Number(campaign.totalSpent);
        sourceMap.set(campaign.channel, existing);
      }
    });
    
    return Array.from(sourceMap.entries()).map(([source, data]) => ({
      source,
      count: data.count,
      conversionRate: data.count > 0 ? (data.won / data.count) * 100 : 0,
      averageValue: data.won > 0 ? data.totalValue / data.won : 0,
      roi: data.cost > 0 ? ((data.totalValue - data.cost) / data.cost) * 100 : 0
    })).sort((a, b) => b.count - a.count);
  }

  // ========================================
  // CSV IMPORT IMPLEMENTATIONS
  // ========================================

  async importCustomersFromCsv(csvData: any[]): Promise<CsvImportResult> {
    const result: CsvImportResult = {
      success: true,
      totalRows: csvData.length,
      successfulImports: 0,
      errors: [],
      importedIds: [],
    };

    for (let i = 0; i < csvData.length; i++) {
      try {
        const row = csvData[i];
        
        // Validate and parse the CSV row
        const validatedData = servicem8CustomerCsvSchema.parse(row);
        
        // Map ServiceM8 fields to our Customer schema
        const customerData: InsertCustomer = {
          name: validatedData.Name,
          email: validatedData.Email || undefined,
          phone: validatedData.Phone || undefined,
          address: validatedData.Address || undefined,
          city: validatedData.City || undefined,
          region: validatedData.State || undefined,
          notes: validatedData.Notes || undefined,
          source: "servicem8_import",
          tags: ["imported", "servicem8"],
          isActive: true,
        };

        // Create the customer
        const customer = await this.createCustomer(customerData);
        
        result.successfulImports++;
        result.importedIds.push(customer.id);
        
      } catch (error) {
        result.success = false;
        result.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : "Unknown error",
          data: csvData[i],
        });
      }
    }

    return result;
  }

  async importJobsFromCsv(csvData: any[]): Promise<CsvImportResult> {
    const result: CsvImportResult = {
      success: true,
      totalRows: csvData.length,
      successfulImports: 0,
      errors: [],
      importedIds: [],
    };

    // First pass: collect all customer names to create customers if needed
    const customerNames = new Set(csvData.map(row => row["Customer Name"]).filter(Boolean));
    const customerMap = new Map<string, Customer>();
    
    // Get existing customers or create new ones
    for (const customerName of customerNames) {
      try {
        const existingCustomers = await this.searchCustomers(customerName);
        let customer = existingCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        
        if (!customer) {
          // Create a basic customer record for the import
          customer = await this.createCustomer({
            name: customerName,
            source: "servicem8_import",
            tags: ["imported", "servicem8"],
            isActive: true,
          });
        }
        
        customerMap.set(customerName, customer);
      } catch (error) {
        // If customer creation fails, we'll handle it during job processing
        console.error(`Failed to process customer ${customerName}:`, error);
      }
    }

    // Second pass: process jobs
    for (let i = 0; i < csvData.length; i++) {
      try {
        const row = csvData[i];
        
        // Validate and parse the CSV row
        const validatedData = servicem8JobCsvSchema.parse(row);
        
        // Find the customer
        const customer = customerMap.get(validatedData["Customer Name"]);
        if (!customer) {
          throw new Error(`Customer not found: ${validatedData["Customer Name"]}`);
        }

        // Parse dates
        const scheduledDate = validatedData["Scheduled Date"] ? new Date(validatedData["Scheduled Date"]) : undefined;
        const completedDate = validatedData["Completed Date"] ? new Date(validatedData["Completed Date"]) : undefined;
        
        // Map status from ServiceM8 to our system
        const statusMap: Record<string, string> = {
          'quote': 'scheduled',
          'scheduled': 'scheduled', 
          'in_progress': 'in_progress',
          'completed': 'completed',
          'cancelled': 'cancelled',
        };
        const status = statusMap[validatedData.Status?.toLowerCase() || ''] || 'scheduled';

        // Map ServiceM8 fields to our Job schema
        const jobData: InsertJob = {
          customerId: customer.id,
          jobNumber: validatedData["Job Number"],
          description: validatedData.Description || undefined,
          status: status,
          priority: "medium",
          serviceType: "tree_removal", // Default for tree service
          scheduledDate: scheduledDate,
          completedDate: completedDate,
          address: validatedData["Job Address"] || customer.address || undefined,
          totalAmount: validatedData["Job Value"] ? parseFloat(validatedData["Job Value"].replace(/[^\d.-]/g, '')) : undefined,
          notes: validatedData.Notes || undefined,
          assignedTo: validatedData["Assigned Staff"] || undefined,
          source: "servicem8_import",
        };

        // Create the job
        const job = await this.createJob(jobData);
        
        result.successfulImports++;
        result.importedIds.push(job.id);
        
      } catch (error) {
        result.success = false;
        result.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : "Unknown error",
          data: csvData[i],
        });
      }
    }

    return result;
  }

  async importQuotesFromCsv(csvData: any[]): Promise<CsvImportResult> {
    const result: CsvImportResult = {
      success: true,
      totalRows: csvData.length,
      successfulImports: 0,
      errors: [],
      importedIds: [],
    };

    // First pass: collect all customer names to create customers if needed
    const customerNames = new Set(csvData.map(row => row["Customer Name"]).filter(Boolean));
    const customerMap = new Map<string, Customer>();
    
    // Get existing customers or create new ones
    for (const customerName of customerNames) {
      try {
        const existingCustomers = await this.searchCustomers(customerName);
        let customer = existingCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        
        if (!customer) {
          // Create a basic customer record for the import
          customer = await this.createCustomer({
            name: customerName,
            source: "servicem8_import",
            tags: ["imported", "servicem8"],
            isActive: true,
          });
        }
        
        customerMap.set(customerName, customer);
      } catch (error) {
        console.error(`Failed to process customer ${customerName}:`, error);
      }
    }

    // Second pass: process quotes
    for (let i = 0; i < csvData.length; i++) {
      try {
        const row = csvData[i];
        
        // Validate and parse the CSV row
        const validatedData = servicem8QuoteCsvSchema.parse(row);
        
        // Find the customer
        const customer = customerMap.get(validatedData["Customer Name"]);
        if (!customer) {
          throw new Error(`Customer not found: ${validatedData["Customer Name"]}`);
        }

        // Parse dates
        const quoteDate = validatedData["Quote Date"] ? new Date(validatedData["Quote Date"]) : new Date();
        const expiryDate = validatedData["Expiry Date"] ? new Date(validatedData["Expiry Date"]) : undefined;
        const responseDate = validatedData["Response Date"] ? new Date(validatedData["Response Date"]) : undefined;
        
        // Map status from ServiceM8 to our system
        const statusMap: Record<string, string> = {
          'draft': 'draft',
          'sent': 'sent', 
          'approved': 'approved',
          'declined': 'declined',
          'expired': 'expired',
        };
        const status = statusMap[validatedData.Status?.toLowerCase() || ''] || 'draft';

        // Parse quote amount
        const quoteAmount = validatedData["Quote Amount"] ? parseFloat(validatedData["Quote Amount"].replace(/[^\d.-]/g, '')) : 0;

        // Map ServiceM8 fields to our Quote schema
        const quoteData: InsertQuote = {
          customerId: customer.id,
          quoteNumber: validatedData["Quote Number"],
          description: validatedData.Description || undefined,
          totalAmount: quoteAmount.toString(),
          status: status,
          validUntil: expiryDate,
          notes: validatedData.Notes || undefined,
          terms: validatedData["Terms and Conditions"] || undefined,
          source: "servicem8_import",
          lineItems: [], // Will be parsed from Line Items if available
        };

        // Parse line items if provided
        if (validatedData["Line Items"]) {
          try {
            // Try to parse as JSON first
            const lineItems = JSON.parse(validatedData["Line Items"]);
            if (Array.isArray(lineItems)) {
              quoteData.lineItems = lineItems;
            }
          } catch {
            // If not JSON, split by common delimiters and create simple line items
            const items = validatedData["Line Items"].split(/[,;|\n]/).filter(Boolean);
            quoteData.lineItems = items.map((item, idx) => ({
              id: `item_${idx + 1}`,
              description: item.trim(),
              quantity: 1,
              unitPrice: quoteAmount / items.length, // Distribute total evenly
              total: quoteAmount / items.length,
            }));
          }
        }

        // Create the quote
        const quote = await this.createQuote(quoteData);
        
        result.successfulImports++;
        result.importedIds.push(quote.id);
        
      } catch (error) {
        result.success = false;
        result.errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : "Unknown error",
          data: csvData[i],
        });
      }
    }

    return result;
  }

  // ========================================
  // NOTIFICATION METHODS
  // ========================================

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const notification: Notification = {
      id: randomUUID(),
      ...notificationData,
      createdAt: new Date(),
      readAt: null,
    };
    
    this.notifications.set(notification.id, notification);
    return notification;
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async updateNotification(id: string, updates: UpdateNotification): Promise<Notification> {
    const existing = this.notifications.get(id);
    if (!existing) {
      throw new Error('Notification not found');
    }

    const updated: Notification = {
      ...existing,
      ...updates,
    };
    
    this.notifications.set(id, updated);
    return updated;
  }

  async getAllNotifications(userId?: string, limit?: number): Promise<NotificationWithDetails[]> {
    let notifications = Array.from(this.notifications.values());
    
    // Filter by user if provided
    if (userId) {
      notifications = notifications.filter(n => !n.userId || n.userId === userId);
    }
    
    // Sort by creation date (newest first)
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Apply limit if provided
    if (limit) {
      notifications = notifications.slice(0, limit);
    }
    
    // Enrich with related data
    return await Promise.all(notifications.map(notification => this.enrichNotificationWithDetails(notification)));
  }

  async getUnreadNotifications(userId?: string): Promise<NotificationWithDetails[]> {
    let notifications = Array.from(this.notifications.values()).filter(n => !n.isRead);
    
    // Filter by user if provided
    if (userId) {
      notifications = notifications.filter(n => !n.userId || n.userId === userId);
    }
    
    // Sort by creation date (newest first)
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Enrich with related data
    return await Promise.all(notifications.map(notification => this.enrichNotificationWithDetails(notification)));
  }

  async markNotificationAsRead(id: string): Promise<Notification> {
    const notification = this.notifications.get(id);
    if (!notification) {
      throw new Error('Notification not found');
    }

    const updated: Notification = {
      ...notification,
      isRead: true,
      readAt: new Date(),
    };
    
    this.notifications.set(id, updated);
    return updated;
  }

  async markAllNotificationsAsRead(userId?: string): Promise<void> {
    for (const [id, notification] of this.notifications) {
      if (!notification.isRead && (!userId || !notification.userId || notification.userId === userId)) {
        const updated: Notification = {
          ...notification,
          isRead: true,
          readAt: new Date(),
        };
        this.notifications.set(id, updated);
      }
    }
  }

  async deleteNotification(id: string): Promise<void> {
    this.notifications.delete(id);
  }

  async getNotificationSummary(userId?: string): Promise<NotificationSummary> {
    let notifications = Array.from(this.notifications.values());
    
    // Filter by user if provided
    if (userId) {
      notifications = notifications.filter(n => !n.userId || n.userId === userId);
    }
    
    const total = notifications.length;
    const unread = notifications.filter(n => !n.isRead).length;
    
    // Group by type
    const byType: Record<string, number> = {};
    notifications.forEach(n => {
      byType[n.type] = (byType[n.type] || 0) + 1;
    });
    
    // Group by priority
    const byPriority: Record<string, number> = {};
    notifications.forEach(n => {
      byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
    });
    
    // Get recent notifications (last 5)
    const recent = notifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(n => ({
        id: n.id,
        title: n.title,
        type: n.type,
        priority: n.priority,
        createdAt: n.createdAt.toISOString(),
      }));
    
    return {
      total,
      unread,
      byType,
      byPriority,
      recent,
    };
  }

  async deleteExpiredNotifications(): Promise<void> {
    const now = new Date();
    for (const [id, notification] of this.notifications) {
      if (notification.expiresAt && notification.expiresAt < now) {
        this.notifications.delete(id);
      }
    }
  }

  // Helper method to enrich notifications with related entity details
  private async enrichNotificationWithDetails(notification: Notification): Promise<NotificationWithDetails> {
    const enriched: NotificationWithDetails = { ...notification };
    
    // Add lead name if notification is lead-related
    if (notification.leadId) {
      const lead = this.pipelineLeads.get(notification.leadId);
      if (lead) {
        enriched.leadName = lead.name;
      }
    }
    
    // Add customer name if notification is customer-related
    if (notification.customerId) {
      const customer = this.customers.get(notification.customerId);
      if (customer) {
        enriched.customerName = customer.name;
      }
    }
    
    // Add job title if notification is job-related
    if (notification.jobId) {
      const job = this.jobs.get(notification.jobId);
      if (job) {
        enriched.jobTitle = job.title;
      }
    }
    
    // Add quote number if notification is quote-related
    if (notification.quoteId) {
      const quote = this.quotes.get(notification.quoteId);
      if (quote) {
        enriched.quoteNumber = quote.quoteNumber;
      }
    }
    
    return enriched;
  }

  // Helper method to create notifications for business events
  async createBusinessEventNotification(
    type: string, 
    entityId: string, 
    entityType: 'lead' | 'job' | 'customer' | 'quote',
    customMessage?: string
  ): Promise<void> {
    const notification: InsertNotification = {
      type,
      priority: this.getNotificationPriorityForType(type),
      title: this.getNotificationTitleForType(type, entityType),
      message: customMessage || this.getNotificationMessageForType(type, entityType),
      isRead: false,
      actionUrl: `/job-dashboard?tab=${this.getTabForEntityType(entityType)}`,
    };
    
    // Set the appropriate entity reference
    switch (entityType) {
      case 'lead':
        notification.leadId = entityId;
        break;
      case 'job':
        notification.jobId = entityId;
        break;
      case 'customer':
        notification.customerId = entityId;
        break;
      case 'quote':
        notification.quoteId = entityId;
        break;
    }
    
    await this.createNotification(notification);
  }

  private getNotificationPriorityForType(type: string): string {
    const priorities: Record<string, string> = {
      'new_lead': 'high',
      'follow_up_overdue': 'urgent',
      'quote_expired': 'high',
      'job_completed': 'medium',
      'payment_received': 'low',
      'system_alert': 'medium',
    };
    return priorities[type] || 'medium';
  }

  private getNotificationTitleForType(type: string, entityType: string): string {
    const titles: Record<string, string> = {
      'new_lead': 'New Lead Received',
      'lead_status_change': 'Lead Status Updated',
      'job_status_change': 'Job Status Updated',
      'quote_sent': 'Quote Sent',
      'quote_accepted': 'Quote Accepted',
      'quote_expired': 'Quote Expired',
      'follow_up_due': 'Follow-up Due',
      'follow_up_overdue': 'Follow-up Overdue',
      'job_scheduled': 'Job Scheduled',
      'job_completed': 'Job Completed',
      'payment_received': 'Payment Received',
      'system_alert': 'System Alert',
    };
    return titles[type] || 'Notification';
  }

  private getNotificationMessageForType(type: string, entityType: string): string {
    const messages: Record<string, string> = {
      'new_lead': `A new ${entityType} has been added to your pipeline.`,
      'lead_status_change': `A ${entityType} status has been updated.`,
      'job_status_change': `A ${entityType} status has been updated.`,
      'quote_sent': `A ${entityType} has been sent to the customer.`,
      'quote_accepted': `A ${entityType} has been accepted by the customer.`,
      'quote_expired': `A ${entityType} has expired and needs attention.`,
      'follow_up_due': `A follow-up is due for this ${entityType}.`,
      'follow_up_overdue': `A follow-up is overdue for this ${entityType}.`,
      'job_scheduled': `A ${entityType} has been scheduled.`,
      'job_completed': `A ${entityType} has been completed.`,
      'payment_received': `Payment has been received for this ${entityType}.`,
      'system_alert': 'System notification.',
    };
    return messages[type] || 'You have a new notification.';
  }

  private getTabForEntityType(entityType: string): string {
    const tabs: Record<string, string> = {
      'lead': 'leads',
      'job': 'jobs',
      'customer': 'customers',
      'quote': 'quotes',
    };
    return tabs[entityType] || 'overview';
  }

  // ========================================
  // EMPLOYEE MANAGEMENT METHODS
  // ========================================

  async createEmployee(employeeData: InsertEmployee): Promise<Employee> {
    const employee: Employee = {
      id: randomUUID(),
      ...employeeData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.employees.set(employee.id, employee);
    return employee;
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    return this.employees.get(id);
  }

  async updateEmployee(id: string, updates: UpdateEmployee): Promise<Employee> {
    const existing = this.employees.get(id);
    if (!existing) {
      throw new Error('Employee not found');
    }

    const updated: Employee = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.employees.set(id, updated);
    return updated;
  }

  async getAllEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }

  async getActiveEmployees(): Promise<Employee[]> {
    return Array.from(this.employees.values()).filter(emp => emp.isActive);
  }

  async getEmployeesByPosition(position: string): Promise<Employee[]> {
    return Array.from(this.employees.values()).filter(emp => emp.position === position);
  }

  async getEmployeesBySkill(skill: string): Promise<Employee[]> {
    return Array.from(this.employees.values()).filter(emp => 
      emp.skills && emp.skills.includes(skill)
    );
  }

  async deleteEmployee(id: string): Promise<void> {
    this.employees.delete(id);
  }

  // ========================================
  // SCHEDULE MANAGEMENT METHODS
  // ========================================

  async createScheduleEvent(eventData: InsertScheduleEvent): Promise<ScheduleEvent> {
    const event: ScheduleEvent = {
      id: randomUUID(),
      ...eventData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.scheduleEvents.set(event.id, event);
    return event;
  }

  async getScheduleEvent(id: string): Promise<ScheduleEvent | undefined> {
    return this.scheduleEvents.get(id);
  }

  async updateScheduleEvent(id: string, updates: UpdateScheduleEvent): Promise<ScheduleEvent> {
    const existing = this.scheduleEvents.get(id);
    if (!existing) {
      throw new Error('Schedule event not found');
    }

    const updated: ScheduleEvent = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.scheduleEvents.set(id, updated);
    return updated;
  }

  async getAllScheduleEvents(startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]> {
    let events = Array.from(this.scheduleEvents.values());
    
    if (startDate) {
      events = events.filter(event => new Date(event.startDate) >= startDate);
    }
    
    if (endDate) {
      events = events.filter(event => new Date(event.endDate) <= endDate);
    }
    
    return events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  async getScheduleEventsByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<ScheduleEvent[]> {
    let events = Array.from(this.scheduleEvents.values()).filter(event =>
      event.assignedEmployees && event.assignedEmployees.includes(employeeId)
    );
    
    if (startDate) {
      events = events.filter(event => new Date(event.startDate) >= startDate);
    }
    
    if (endDate) {
      events = events.filter(event => new Date(event.endDate) <= endDate);
    }
    
    return events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  async getScheduleEventsByJob(jobId: string): Promise<ScheduleEvent[]> {
    return Array.from(this.scheduleEvents.values()).filter(event => event.jobId === jobId);
  }

  async deleteScheduleEvent(id: string): Promise<void> {
    this.scheduleEvents.delete(id);
  }

  // ========================================
  // JOB TEMPLATE MANAGEMENT METHODS
  // ========================================

  async createJobTemplate(templateData: InsertJobTemplate): Promise<JobTemplate> {
    const template: JobTemplate = {
      id: randomUUID(),
      ...templateData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.jobTemplates.set(template.id, template);
    return template;
  }

  async getJobTemplate(id: string): Promise<JobTemplate | undefined> {
    return this.jobTemplates.get(id);
  }

  async updateJobTemplate(id: string, updates: UpdateJobTemplate): Promise<JobTemplate> {
    const existing = this.jobTemplates.get(id);
    if (!existing) {
      throw new Error('Job template not found');
    }

    const updated: JobTemplate = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.jobTemplates.set(id, updated);
    return updated;
  }

  async getAllJobTemplates(): Promise<JobTemplate[]> {
    return Array.from(this.jobTemplates.values()).filter(template => template.isActive);
  }

  async getJobTemplatesByCategory(category: string): Promise<JobTemplate[]> {
    return Array.from(this.jobTemplates.values()).filter(template => 
      template.category === category && template.isActive
    );
  }

  async deleteJobTemplate(id: string): Promise<void> {
    this.jobTemplates.delete(id);
  }

  // ========================================
  // PROPOSAL MANAGEMENT METHODS
  // ========================================

  async createProposal(proposalData: InsertProposal): Promise<Proposal> {
    const proposalNumber = `PROP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const proposal: Proposal = {
      id: randomUUID(),
      ...proposalData,
      proposalNumber,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.proposals.set(proposal.id, proposal);
    return proposal;
  }

  async getProposal(id: string): Promise<Proposal | undefined> {
    return this.proposals.get(id);
  }

  async updateProposal(id: string, updates: UpdateProposal): Promise<Proposal> {
    const existing = this.proposals.get(id);
    if (!existing) {
      throw new Error('Proposal not found');
    }

    const updated: Proposal = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.proposals.set(id, updated);
    return updated;
  }

  async getProposalsByCustomer(customerId: string): Promise<Proposal[]> {
    return Array.from(this.proposals.values()).filter(proposal => proposal.customerId === customerId);
  }

  async getProposalsByQuote(quoteId: string): Promise<Proposal[]> {
    return Array.from(this.proposals.values()).filter(proposal => proposal.quoteId === quoteId);
  }

  async getAllProposals(): Promise<Proposal[]> {
    return Array.from(this.proposals.values());
  }

  async deleteProposal(id: string): Promise<void> {
    // Also delete associated sections
    const sections = Array.from(this.proposalSections.values()).filter(section => section.proposalId === id);
    sections.forEach(section => this.proposalSections.delete(section.id));
    
    this.proposals.delete(id);
  }

  // ========================================
  // PROPOSAL SECTION MANAGEMENT METHODS
  // ========================================

  async createProposalSection(sectionData: InsertProposalSection): Promise<ProposalSection> {
    const section: ProposalSection = {
      id: randomUUID(),
      ...sectionData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.proposalSections.set(section.id, section);
    return section;
  }

  async getProposalSection(id: string): Promise<ProposalSection | undefined> {
    return this.proposalSections.get(id);
  }

  async updateProposalSection(id: string, updates: UpdateProposalSection): Promise<ProposalSection> {
    const existing = this.proposalSections.get(id);
    if (!existing) {
      throw new Error('Proposal section not found');
    }

    const updated: ProposalSection = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.proposalSections.set(id, updated);
    return updated;
  }

  async getProposalSectionsByProposal(proposalId: string): Promise<ProposalSection[]> {
    return Array.from(this.proposalSections.values())
      .filter(section => section.proposalId === proposalId && section.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async deleteProposalSection(id: string): Promise<void> {
    this.proposalSections.delete(id);
  }

  async reorderProposalSections(proposalId: string, sectionIds: string[]): Promise<ProposalSection[]> {
    const sections = await this.getProposalSectionsByProposal(proposalId);
    
    // Update sort order for each section
    sectionIds.forEach((sectionId, index) => {
      const section = this.proposalSections.get(sectionId);
      if (section && section.proposalId === proposalId) {
        const updated = {
          ...section,
          sortOrder: index + 1,
          updatedAt: new Date(),
        };
        this.proposalSections.set(sectionId, updated);
      }
    });

    return await this.getProposalSectionsByProposal(proposalId);
  }

  // ========================================
  // PROPOSAL LINE ITEM MANAGEMENT METHODS
  // ========================================

  async createProposalLineItem(itemData: InsertProposalLineItem): Promise<ProposalLineItem> {
    // Auto-assign sortOrder if not provided
    const existingItems = await this.getProposalLineItemsByProposal(itemData.proposalId);
    const nextSortOrder = itemData.sortOrder ?? (existingItems.length + 1);
    
    const item: ProposalLineItem = {
      id: randomUUID(),
      ...itemData,
      sortOrder: nextSortOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.proposalLineItems.set(item.id, item);
    return item;
  }

  async getProposalLineItem(id: string): Promise<ProposalLineItem | undefined> {
    return this.proposalLineItems.get(id);
  }

  async updateProposalLineItem(id: string, updates: UpdateProposalLineItem): Promise<ProposalLineItem> {
    const existing = this.proposalLineItems.get(id);
    if (!existing) {
      throw new Error('Proposal line item not found');
    }

    const updated: ProposalLineItem = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.proposalLineItems.set(id, updated);
    return updated;
  }

  async getProposalLineItemsByProposal(proposalId: string): Promise<ProposalLineItem[]> {
    return Array.from(this.proposalLineItems.values())
      .filter(item => item.proposalId === proposalId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async deleteProposalLineItem(id: string): Promise<void> {
    this.proposalLineItems.delete(id);
  }

  async reorderProposalLineItems(proposalId: string, itemIds: string[]): Promise<ProposalLineItem[]> {
    // Update sort order for each item
    itemIds.forEach((itemId, index) => {
      const item = this.proposalLineItems.get(itemId);
      if (item && item.proposalId === proposalId) {
        const updated = {
          ...item,
          sortOrder: index + 1,
          updatedAt: new Date(),
        };
        this.proposalLineItems.set(itemId, updated);
      }
    });

    return await this.getProposalLineItemsByProposal(proposalId);
  }

  // ========================================
  // EQUIPMENT MANAGEMENT METHODS
  // ========================================

  async createEquipment(equipmentData: InsertEquipment): Promise<Equipment> {
    const equipment: Equipment = {
      id: randomUUID(),
      ...equipmentData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.equipment.set(equipment.id, equipment);
    return equipment;
  }

  async getEquipment(id: string): Promise<Equipment | undefined> {
    return this.equipment.get(id);
  }

  async updateEquipment(id: string, updates: UpdateEquipment): Promise<Equipment> {
    const existing = this.equipment.get(id);
    if (!existing) {
      throw new Error('Equipment not found');
    }

    const updated: Equipment = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.equipment.set(id, updated);
    return updated;
  }

  async getAllEquipment(): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter(item => item.isActive);
  }

  async getAvailableEquipment(): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter(item => 
      item.status === 'available' && item.isActive
    );
  }

  async getEquipmentByType(type: string): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter(item => 
      item.type === type && item.isActive
    );
  }

  async getEquipmentByStatus(status: string): Promise<Equipment[]> {
    return Array.from(this.equipment.values()).filter(item => item.status === status);
  }

  async deleteEquipment(id: string): Promise<void> {
    this.equipment.delete(id);
  }

  private initializeSampleInventoryData() {
    // Sample inventory items
    const sampleInventory: Inventory[] = [
      {
        id: '1',
        name: 'Safety Helmet',
        category: 'Safety Equipment',
        sku: 'SAFE-001',
        currentStock: 15,
        reorderPoint: 5,
        unitPrice: '45.00',
        supplier: 'Safety First Co.',
        location: 'Warehouse A',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
      },
      {
        id: '2', 
        name: 'Chainsaw Oil',
        category: 'Consumables',
        sku: 'OIL-002',
        currentStock: 3,
        reorderPoint: 10,
        unitPrice: '24.99',
        supplier: 'Equipment Plus',
        location: 'Storage Room',
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-01'),
      },
      {
        id: '3',
        name: 'Work Gloves',
        category: 'Safety Equipment', 
        sku: 'SAFE-003',
        currentStock: 25,
        reorderPoint: 8,
        unitPrice: '12.50',
        supplier: 'Safety First Co.',
        location: 'Warehouse A',
        createdAt: new Date('2024-02-10'),
        updatedAt: new Date('2024-02-10'),
      }
    ];

    sampleInventory.forEach(item => this.inventory.set(item.id, item));

    // Sample equipment checkout
    const sampleCheckout: EquipmentCheckout = {
      id: '1',
      equipmentId: '1',
      checkedOutBy: 'John Smith',
      checkedOutAt: new Date('2024-12-18T08:00:00.000Z'),
      expectedReturnDate: new Date('2024-12-20T17:00:00.000Z'),
      checkedInAt: null,
      initialCondition: 'Good',
      actualReturnCondition: null,
      notes: 'Regular job site checkout',
    };

    this.equipmentCheckouts.set(sampleCheckout.id, sampleCheckout);

    // Sample maintenance record
    const sampleMaintenance: EquipmentMaintenance = {
      id: '1',
      equipmentId: '1', 
      type: 'Scheduled',
      description: 'Oil change and blade sharpening',
      scheduledDate: new Date('2024-12-25T09:00:00.000Z'),
      completedDate: null,
      cost: '75.00',
      technician: 'Mike Wilson',
      status: 'Scheduled',
      notes: 'Annual maintenance check',
      createdAt: new Date('2024-12-15'),
      updatedAt: new Date('2024-12-15'),
    };

    this.equipmentMaintenance.set(sampleMaintenance.id, sampleMaintenance);
  }

  // ========================================
  // INVENTORY MANAGEMENT METHODS
  // ========================================

  async getAllInventory(): Promise<Inventory[]> {
    return Array.from(this.inventory.values());
  }

  async getInventoryByCategory(category: string): Promise<Inventory[]> {
    return Array.from(this.inventory.values()).filter(item => item.category === category);
  }

  async getLowStockItems(): Promise<Inventory[]> {
    return Array.from(this.inventory.values()).filter(item => item.currentStock <= item.reorderPoint);
  }

  async createInventoryItem(data: InsertInventory): Promise<Inventory> {
    const id = (this.inventory.size + 1).toString();
    const item: Inventory = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.inventory.set(id, item);
    return item;
  }

  async updateInventoryItem(id: string, updates: Partial<Inventory>): Promise<Inventory> {
    const item = this.inventory.get(id);
    if (!item) {
      throw new Error(`Inventory item with id ${id} not found`);
    }
    const updatedItem = { ...item, ...updates, updatedAt: new Date() };
    this.inventory.set(id, updatedItem);
    return updatedItem;
  }

  // ========================================
  // EQUIPMENT CHECKOUT METHODS
  // ========================================

  async checkoutEquipment(data: InsertEquipmentCheckout): Promise<EquipmentCheckout> {
    const id = (this.equipmentCheckouts.size + 1).toString();
    const checkout: EquipmentCheckout = {
      ...data,
      id,
      checkedOutAt: new Date(),
      checkedInAt: null,
      actualReturnCondition: null,
      notes: data.notes || null,
    };
    this.equipmentCheckouts.set(id, checkout);
    return checkout;
  }

  async checkinEquipment(checkoutId: string, data: { actualReturnCondition?: string; notes?: string }): Promise<EquipmentCheckout> {
    const checkout = this.equipmentCheckouts.get(checkoutId);
    if (!checkout) {
      throw new Error(`Checkout record with id ${checkoutId} not found`);
    }
    const updatedCheckout = {
      ...checkout,
      checkedInAt: new Date(),
      actualReturnCondition: data.actualReturnCondition || null,
      notes: data.notes || checkout.notes,
    };
    this.equipmentCheckouts.set(checkoutId, updatedCheckout);
    return updatedCheckout;
  }

  async getActiveCheckouts(): Promise<EquipmentCheckout[]> {
    return Array.from(this.equipmentCheckouts.values()).filter(checkout => !checkout.checkedInAt);
  }

  async getOverdueCheckouts(): Promise<EquipmentCheckout[]> {
    const now = new Date();
    return Array.from(this.equipmentCheckouts.values()).filter(checkout => {
      if (checkout.checkedInAt || !checkout.expectedReturnDate) return false;
      return new Date(checkout.expectedReturnDate) < now;
    });
  }

  async getCheckoutHistory(equipmentId?: string): Promise<EquipmentCheckout[]> {
    let checkouts = Array.from(this.equipmentCheckouts.values());
    if (equipmentId) {
      checkouts = checkouts.filter(checkout => checkout.equipmentId === equipmentId);
    }
    return checkouts.sort((a, b) => new Date(b.checkedOutAt).getTime() - new Date(a.checkedOutAt).getTime());
  }

  // ========================================
  // EQUIPMENT MAINTENANCE METHODS
  // ========================================

  async createEquipmentMaintenance(data: InsertEquipmentMaintenance): Promise<EquipmentMaintenance> {
    const id = (this.equipmentMaintenance.size + 1).toString();
    const maintenance: EquipmentMaintenance = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.equipmentMaintenance.set(id, maintenance);
    return maintenance;
  }

  async getMaintenanceByEquipment(equipmentId: string): Promise<EquipmentMaintenance[]> {
    return Array.from(this.equipmentMaintenance.values())
      .filter(maintenance => maintenance.equipmentId === equipmentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllMaintenanceRecords(): Promise<EquipmentMaintenance[]> {
    return Array.from(this.equipmentMaintenance.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ========================================
  // INVENTORY TRANSACTION METHODS
  // ========================================

  async createInventoryTransaction(data: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const id = (this.inventoryTransactions.size + 1).toString();
    const transaction: InventoryTransaction = {
      ...data,
      id,
      createdAt: new Date(),
    };
    this.inventoryTransactions.set(id, transaction);
    return transaction;
  }

  async getInventoryTransactions(inventoryId: string): Promise<InventoryTransaction[]> {
    return Array.from(this.inventoryTransactions.values())
      .filter(transaction => transaction.inventoryId === inventoryId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getTransactionsByType(type: string): Promise<InventoryTransaction[]> {
    return Array.from(this.inventoryTransactions.values())
      .filter(transaction => transaction.type === type)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ========================================
  // ENHANCED PHOTO MANAGEMENT METHODS
  // ========================================

  async createPhoto(data: InsertPhoto): Promise<Photo> {
    const id = (this.photos.size + 1).toString();
    const photo: Photo = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.photos.set(id, photo);
    console.log(`Stored photo ${id} in MemStorage. Total photos: ${this.photos.size}`);
    console.log(`Photo details:`, { id, isPublic: photo.isPublic, jobId: photo.jobId, type: photo.type });
    return photo;
  }

  async getPhoto(id: string): Promise<Photo | undefined> {
    return this.photos.get(id);
  }

  async updatePhoto(id: string, updates: UpdatePhoto): Promise<Photo> {
    const photo = this.photos.get(id);
    if (!photo) {
      throw new Error(`Photo with id ${id} not found`);
    }
    const updatedPhoto = { ...photo, ...updates, updatedAt: new Date() };
    this.photos.set(id, updatedPhoto);
    return updatedPhoto;
  }

  async deletePhoto(id: string): Promise<void> {
    this.photos.delete(id);
  }

  async getPhotosByJob(jobId: string, filters?: { type?: string; category?: string }): Promise<Photo[]> {
    let photos = Array.from(this.photos.values()).filter(photo => photo.jobId === jobId);
    
    if (filters?.type) {
      photos = photos.filter(photo => photo.type === filters.type);
    }
    if (filters?.category) {
      photos = photos.filter(photo => photo.category === filters.category);
    }
    
    return photos.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }

  async getPhotosByCustomer(customerId: string): Promise<Photo[]> {
    return Array.from(this.photos.values())
      .filter(photo => photo.customerId === customerId)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }

  async getPublicPhotos(limit: number = 20, offset: number = 0): Promise<Photo[]> {
    const allPhotos = Array.from(this.photos.values());
    console.log(`getPublicPhotos: Total photos in storage: ${allPhotos.length}`);
    console.log(`getPublicPhotos: Photos with isPublic=true: ${allPhotos.filter(p => p.isPublic).length}`);
    
    const publicPhotos = allPhotos
      .filter(photo => photo.isPublic)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
    
    return publicPhotos.slice(offset, offset + limit);
  }

  async getFeaturedPhotos(limit: number = 10): Promise<Photo[]> {
    return Array.from(this.photos.values())
      .filter(photo => photo.isFeatured && photo.isPublic)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
      .slice(0, limit);
  }

  async getPhotosByType(type: string, jobId?: string): Promise<Photo[]> {
    let photos = Array.from(this.photos.values()).filter(photo => photo.type === type);
    
    if (jobId) {
      photos = photos.filter(photo => photo.jobId === jobId);
    }
    
    return photos.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }

  async getBeforeAfterPairs(jobId: string): Promise<Photo[][]> {
    const beforePhotos = await this.getPhotosByType('before', jobId);
    const afterPhotos = await this.getPhotosByType('after', jobId);
    const pairs: Photo[][] = [];

    // Group photos by beforeAfterPairId or by sequence
    const pairedPhotos = new Map<string, { before?: Photo; after?: Photo }>();
    
    beforePhotos.forEach(photo => {
      const pairId = photo.beforeAfterPairId || `seq-${photo.sequenceOrder}`;
      if (!pairedPhotos.has(pairId)) {
        pairedPhotos.set(pairId, {});
      }
      pairedPhotos.get(pairId)!.before = photo;
    });

    afterPhotos.forEach(photo => {
      const pairId = photo.beforeAfterPairId || `seq-${photo.sequenceOrder}`;
      if (!pairedPhotos.has(pairId)) {
        pairedPhotos.set(pairId, {});
      }
      pairedPhotos.get(pairId)!.after = photo;
    });

    pairedPhotos.forEach(pair => {
      if (pair.before && pair.after) {
        pairs.push([pair.before, pair.after]);
      }
    });

    return pairs;
  }

  async searchPhotos(filters: PhotoSearch): Promise<Photo[]> {
    let photos = Array.from(this.photos.values());

    if (filters.jobId) {
      photos = photos.filter(p => p.jobId === filters.jobId);
    }
    if (filters.customerId) {
      photos = photos.filter(p => p.customerId === filters.customerId);
    }
    if (filters.type) {
      photos = photos.filter(p => p.type === filters.type);
    }
    if (filters.category) {
      photos = photos.filter(p => p.category === filters.category);
    }
    if (filters.capturedBy) {
      photos = photos.filter(p => p.capturedBy.toLowerCase().includes(filters.capturedBy!.toLowerCase()));
    }
    if (filters.isPublic !== undefined) {
      photos = photos.filter(p => p.isPublic === filters.isPublic);
    }
    if (filters.isFeatured !== undefined) {
      photos = photos.filter(p => p.isFeatured === filters.isFeatured);
    }
    if (filters.hasGps) {
      photos = photos.filter(p => p.gpsLatitude !== null && p.gpsLongitude !== null);
    }
    if (filters.minQualityScore) {
      photos = photos.filter(p => p.qualityScore && p.qualityScore >= filters.minQualityScore!);
    }
    if (filters.tags && filters.tags.length > 0) {
      photos = photos.filter(p => 
        filters.tags!.some(tag => p.tags.includes(tag))
      );
    }

    // Date filtering
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      photos = photos.filter(p => new Date(p.capturedAt) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      photos = photos.filter(p => new Date(p.capturedAt) <= toDate);
    }

    // Sort by capture time (newest first)
    photos.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());

    // Apply pagination
    return photos.slice(filters.offset, filters.offset + filters.limit);
  }

  // ========================================
  // BUSINESS SETTINGS MANAGEMENT METHODS
  // ========================================

  async getBusinessSettings(): Promise<BusinessSettings> {
    return this.businessSettings;
  }

  async updateBusinessSettings(updates: UpdateBusinessSettings): Promise<BusinessSettings> {
    this.businessSettings = {
      ...this.businessSettings,
      ...updates,
      updatedAt: new Date(),
    };
    return this.businessSettings;
  }

  async resetBusinessSettings(): Promise<BusinessSettings> {
    this.businessSettings = {
      id: '1',
      businessName: 'Treemarkables',
      businessAddress: '123 Arborist Lane, Auckland, New Zealand',
      businessPhone: '+64 9 123 4567',
      businessEmail: 'info@treemarkables.co.nz',
      businessWebsite: 'https://treemarkables.co.nz',
      businessLogo: '',
      leadAssignmentMethod: 'round_robin',
      autoFollowUpDays: 3,
      quotePricingModel: 'standard',
      quoteValidityDays: 30,
      autoQuoteApproval: false,
      jobAutoScheduling: false,
      jobBufferTime: 30,
      cloudSyncEnabled: true,
      backupFrequency: 'daily',
      dataRetentionDays: 365,
      autoBackupTime: '02:00',
      exportFormat: 'csv',
      servicem8Enabled: false,
      servicem8ApiKey: '',
      googleCalendarEnabled: false,
      emailIntegrationEnabled: false,
      paymentGatewayEnabled: false,
      paymentProvider: 'stripe',
      cacheDuration: 300,
      imageQuality: 80,
      realTimeUpdatesInterval: 30,
      autoRefreshEnabled: true,
      maxConcurrentJobs: 50,
      offlineModeEnabled: true,
      gpsTrackingEnabled: true,
      locationAccuracy: 'high',
      mobileDataSync: true,
      fieldPhotoQuality: 85,
      twoFactorRequired: false,
      sessionTimeout: 480,
      passwordExpiration: 90,
      auditLogging: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.businessSettings;
  }

  // Communication Management Methods
  async createCommunication(communication: InsertCommunication): Promise<Communication> {
    const id = randomUUID();
    const now = new Date();
    const newCommunication: Communication = {
      id,
      ...communication,
      receivedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.communications.push(newCommunication);
    return newCommunication;
  }

  async getCommunication(id: string): Promise<Communication | undefined> {
    return this.communications.find(c => c.id === id && c.isActive);
  }

  async updateCommunication(id: string, updates: UpdateCommunication): Promise<Communication> {
    const index = this.communications.findIndex(c => c.id === id && c.isActive);
    if (index === -1) {
      throw new Error(`Communication with id ${id} not found`);
    }
    
    this.communications[index] = {
      ...this.communications[index],
      ...updates,
      updatedAt: new Date(),
    };
    return this.communications[index];
  }

  async getAllCommunications(filters?: {
    platform?: string;
    priority?: string;
    isRead?: boolean;
    isArchived?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Communication[]> {
    let filtered = this.communications.filter(c => c.isActive);

    if (filters) {
      if (filters.platform && filters.platform !== 'all') {
        filtered = filtered.filter(c => c.platform === filters.platform);
      }
      if (filters.priority && filters.priority !== 'all') {
        filtered = filtered.filter(c => c.priority === filters.priority);
      }
      if (filters.isRead !== undefined) {
        filtered = filtered.filter(c => c.isRead === filters.isRead);
      }
      if (filters.isArchived !== undefined) {
        filtered = filtered.filter(c => c.isArchived === filters.isArchived);
      }
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filtered = filtered.filter(c => 
          c.from.toLowerCase().includes(searchTerm) ||
          c.content.toLowerCase().includes(searchTerm) ||
          (c.subject && c.subject.toLowerCase().includes(searchTerm))
        );
      }
    }

    // Sort by receivedAt descending (newest first)
    filtered.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    // Apply pagination
    if (filters?.offset) {
      filtered = filtered.slice(filters.offset);
    }
    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  async getCommunicationsByCustomer(customerId: string): Promise<Communication[]> {
    return this.communications.filter(c => c.customerId === customerId && c.isActive);
  }

  async getCommunicationsByLead(leadId: string): Promise<Communication[]> {
    return this.communications.filter(c => c.leadId === leadId && c.isActive);
  }

  async getCommunicationsByJob(jobId: string): Promise<Communication[]> {
    return this.communications.filter(c => c.jobId === jobId && c.isActive);
  }

  async markCommunicationAsRead(id: string): Promise<Communication> {
    return this.updateCommunication(id, { isRead: true });
  }

  async starCommunication(id: string, starred: boolean): Promise<Communication> {
    return this.updateCommunication(id, { isStarred: starred });
  }

  async archiveCommunication(id: string): Promise<Communication> {
    return this.updateCommunication(id, { isArchived: true });
  }

  async getCommunicationStats(): Promise<{
    total: number;
    unread: number;
    starred: number;
    archived: number;
    byPlatform: { platform: string; count: number }[];
    byPriority: { priority: string; count: number }[];
  }> {
    const activeCommunications = this.communications.filter(c => c.isActive);
    
    const unreadCommunications = activeCommunications.filter(c => !c.isRead && !c.isArchived);
    const starredCommunications = activeCommunications.filter(c => c.isStarred && !c.isArchived);
    const archivedCommunications = activeCommunications.filter(c => c.isArchived);

    // Platform statistics
    const platformCounts = new Map<string, number>();
    activeCommunications.forEach(c => {
      if (!c.isArchived) {
        platformCounts.set(c.platform, (platformCounts.get(c.platform) || 0) + 1);
      }
    });
    const byPlatform = Array.from(platformCounts.entries()).map(([platform, count]) => ({
      platform,
      count
    }));

    // Priority statistics
    const priorityCounts = new Map<string, number>();
    activeCommunications.forEach(c => {
      if (!c.isArchived) {
        priorityCounts.set(c.priority, (priorityCounts.get(c.priority) || 0) + 1);
      }
    });
    const byPriority = Array.from(priorityCounts.entries()).map(([priority, count]) => ({
      priority,
      count
    }));

    return {
      total: activeCommunications.filter(c => !c.isArchived).length,
      unread: unreadCommunications.length,
      starred: starredCommunications.length,
      archived: archivedCommunications.length,
      byPlatform,
      byPriority
    };
  }

  // ========================================
  // CONVERSATION MANAGEMENT METHODS
  // ========================================

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const now = new Date();
    const newConversation: Conversation = {
      id,
      ...conversation,
      unreadCount: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(id, newConversation);
    return newConversation;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async updateConversation(id: string, updates: UpdateConversation): Promise<Conversation> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new Error(`Conversation with id ${id} not found`);
    }
    
    const updatedConversation: Conversation = {
      ...conversation,
      ...updates,
      updatedAt: new Date(),
    };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }

  async deleteConversation(id: string): Promise<void> {
    // Also delete all messages in this conversation
    const messages = Array.from(this.conversationMessages.values())
      .filter(msg => msg.conversationId === id);
    messages.forEach(msg => this.conversationMessages.delete(msg.id));
    
    this.conversations.delete(id);
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
    let conversations = Array.from(this.conversations.values())
      .filter(conv => conv.isActive);

    // Apply filters
    if (filters?.status) {
      conversations = conversations.filter(conv => conv.status === filters.status);
    }
    if (filters?.priority) {
      conversations = conversations.filter(conv => conv.priority === filters.priority);
    }
    if (filters?.assignedTo) {
      conversations = conversations.filter(conv => conv.assignedTo === filters.assignedTo);
    }
    if (filters?.source) {
      conversations = conversations.filter(conv => conv.source === filters.source);
    }
    if (filters?.serviceType) {
      conversations = conversations.filter(conv => conv.serviceType === filters.serviceType);
    }
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      conversations = conversations.filter(conv => 
        conv.title.toLowerCase().includes(searchLower) ||
        conv.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Sort by last message date (most recent first)
    conversations.sort((a, b) => {
      const aTime = a.lastMessageAt ? a.lastMessageAt.getTime() : a.createdAt.getTime();
      const bTime = b.lastMessageAt ? b.lastMessageAt.getTime() : b.createdAt.getTime();
      return bTime - aTime;
    });

    // Apply pagination
    const offset = filters?.offset || 0;
    const limit = filters?.limit || conversations.length;
    return conversations.slice(offset, offset + limit);
  }

  async getConversationsByLead(leadId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(conv => conv.leadId === leadId && conv.isActive)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getConversationsByCustomer(customerId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(conv => conv.customerId === customerId && conv.isActive)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async convertConversationToQuote(conversationId: string, quoteId: string): Promise<Conversation> {
    return this.updateConversation(conversationId, {
      status: 'converted',
      convertedToQuoteId: quoteId,
      conversionDate: new Date(),
    });
  }

  // Conversation Message Management
  async createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const id = randomUUID();
    const now = new Date();
    const newMessage: ConversationMessage = {
      id,
      ...message,
      isRead: false,
      createdAt: now,
      updatedAt: now,
    };
    this.conversationMessages.set(id, newMessage);

    // Update conversation with last message info
    const conversation = this.conversations.get(message.conversationId);
    if (conversation) {
      await this.updateConversation(message.conversationId, {
        lastMessageAt: now,
        lastMessageBy: message.direction === 'inbound' ? 'customer' : 'staff',
        unreadCount: message.direction === 'inbound' ? conversation.unreadCount + 1 : conversation.unreadCount,
      });
    }

    return newMessage;
  }

  async getConversationMessage(id: string): Promise<ConversationMessage | undefined> {
    return this.conversationMessages.get(id);
  }

  async updateConversationMessage(id: string, updates: UpdateConversationMessage): Promise<ConversationMessage> {
    const message = this.conversationMessages.get(id);
    if (!message) {
      throw new Error(`Conversation message with id ${id} not found`);
    }
    
    const updatedMessage: ConversationMessage = {
      ...message,
      ...updates,
      updatedAt: new Date(),
    };
    this.conversationMessages.set(id, updatedMessage);
    return updatedMessage;
  }

  async deleteConversationMessage(id: string): Promise<void> {
    this.conversationMessages.delete(id);
  }

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    return Array.from(this.conversationMessages.values())
      .filter(msg => msg.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async markConversationMessagesAsRead(conversationId: string, beforeTimestamp?: Date): Promise<void> {
    const messages = Array.from(this.conversationMessages.values())
      .filter(msg => msg.conversationId === conversationId && !msg.isRead);

    let unreadCount = 0;
    for (const message of messages) {
      if (!beforeTimestamp || message.createdAt <= beforeTimestamp) {
        await this.updateConversationMessage(message.id, {
          isRead: true,
          readAt: new Date(),
        });
      } else {
        unreadCount++;
      }
    }

    // Update conversation unread count
    await this.updateConversation(conversationId, { unreadCount });
  }

  async getUnreadConversationCount(conversationId?: string): Promise<number> {
    if (conversationId) {
      const conversation = this.conversations.get(conversationId);
      return conversation?.unreadCount || 0;
    }
    
    // Return total unread messages across all conversations
    return Array.from(this.conversationMessages.values())
      .filter(msg => !msg.isRead && msg.direction === 'inbound').length;
  }

  // ========================================
  // CUSTOMER PORTAL METHODS
  // ========================================

  async authenticateCustomer(email: string, phone?: string): Promise<CustomerAuth | undefined> {
    // Find customer auth by email and optionally phone
    for (const auth of this.customerAuth.values()) {
      if (auth.email === email && (!phone || auth.phone === phone)) {
        // Update last login
        const updatedAuth = { ...auth, lastLoginAt: new Date() };
        this.customerAuth.set(auth.id, updatedAuth);
        return updatedAuth;
      }
    }
    return undefined;
  }

  async createCustomerAuth(auth: InsertCustomerAuth): Promise<CustomerAuth> {
    const newAuth: CustomerAuth = {
      id: randomUUID(),
      ...auth,
      createdAt: new Date(),
      lastLoginAt: null,
    };
    
    this.customerAuth.set(newAuth.id, newAuth);
    return newAuth;
  }

  async getCustomerJobs(customerId: string): Promise<Job[]> {
    return Array.from(this.jobs.values())
      .filter(job => job.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getCustomerInvoices(customerId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values())
      .filter(invoice => invoice.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getCustomerPhotos(customerId: string, jobId?: string): Promise<Photo[]> {
    let photos = Array.from(this.photos.values())
      .filter(photo => photo.customerId === customerId && photo.showToCustomer);
    
    if (jobId) {
      photos = photos.filter(photo => photo.jobId === jobId);
    }
    
    return photos.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const newInvoice: Invoice = {
      id: randomUUID(),
      ...invoice,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.invoices.set(newInvoice.id, newInvoice);
    return newInvoice;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async createServiceRequest(request: InsertServiceRequest): Promise<ServiceRequest> {
    const newRequest: ServiceRequest = {
      id: randomUUID(),
      ...request,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.serviceRequests.set(newRequest.id, newRequest);
    return newRequest;
  }

  async getServiceRequest(id: string): Promise<ServiceRequest | undefined> {
    return this.serviceRequests.get(id);
  }

  async getServiceRequestsByCustomer(customerId: string): Promise<ServiceRequest[]> {
    return Array.from(this.serviceRequests.values())
      .filter(request => request.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  // ========================================
  // Safety Incident Management Implementation
  // ========================================

  async getSafetyIncidents(): Promise<SafetyIncident[]> {
    return Array.from(this.safetyIncidents.values()).sort((a, b) => 
      new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
    );
  }

  async getSafetyIncident(id: string): Promise<SafetyIncident | undefined> {
    return this.safetyIncidents.get(id);
  }

  async createSafetyIncident(incident: InsertSafetyIncident & { incidentNumber: string }): Promise<SafetyIncident> {
    const id = randomUUID();
    const now = new Date();
    
    const newIncident: SafetyIncident = {
      ...incident,
      id,
      createdAt: now,
      updatedAt: now,
      reportedAt: now,
    };

    this.safetyIncidents.set(id, newIncident);
    return newIncident;
  }

  async updateSafetyIncident(id: string, updates: Partial<InsertSafetyIncident>): Promise<SafetyIncident> {
    const existing = this.safetyIncidents.get(id);
    if (!existing) {
      throw new Error('Safety incident not found');
    }

    const updated: SafetyIncident = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.safetyIncidents.set(id, updated);
    return updated;
  }

  async deleteSafetyIncident(id: string): Promise<void> {
    this.safetyIncidents.delete(id);
  }

  async getSafetyIncidentsByJob(jobId: string): Promise<SafetyIncident[]> {
    return Array.from(this.safetyIncidents.values())
      .filter(incident => incident.jobId === jobId)
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }

  async getSafetyIncidentsByType(type: string): Promise<SafetyIncident[]> {
    return Array.from(this.safetyIncidents.values())
      .filter(incident => incident.type === type)
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }

  async getSafetyIncidentsBySeverity(severity: string): Promise<SafetyIncident[]> {
    return Array.from(this.safetyIncidents.values())
      .filter(incident => incident.severity === severity)
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }

  async getSafetyIncidentsByStatus(status: string): Promise<SafetyIncident[]> {
    return Array.from(this.safetyIncidents.values())
      .filter(incident => incident.status === status)
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }

  // ========================================
  // Risk Assessment Management Implementation
  // ========================================

  async createRiskAssessment(assessment: InsertRiskAssessment): Promise<RiskAssessment> {
    const id = randomUUID();
    const now = new Date();
    
    const newAssessment: RiskAssessment = {
      ...assessment,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.riskAssessments.set(id, newAssessment);
    return newAssessment;
  }

  async getRiskAssessment(id: string): Promise<RiskAssessment | undefined> {
    return this.riskAssessments.get(id);
  }

  async updateRiskAssessment(id: string, updates: Partial<InsertRiskAssessment>): Promise<RiskAssessment> {
    const existing = this.riskAssessments.get(id);
    if (!existing) {
      throw new Error('Risk assessment not found');
    }

    const updated: RiskAssessment = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.riskAssessments.set(id, updated);
    return updated;
  }

  async getRiskAssessmentsByJob(jobId: string): Promise<RiskAssessment[]> {
    return Array.from(this.riskAssessments.values())
      .filter(assessment => assessment.jobId === jobId)
      .sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime());
  }

  async getAllRiskAssessments(): Promise<RiskAssessment[]> {
    return Array.from(this.riskAssessments.values())
      .sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime());
  }

  // ========================================
  // Compliance Monitoring Management Implementation
  // ========================================

  async createComplianceRequirement(requirement: InsertComplianceRequirement): Promise<ComplianceRequirement> {
    const id = randomUUID();
    const now = new Date();
    
    const newRequirement: ComplianceRequirement = {
      ...requirement,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    this.complianceRequirements.set(id, newRequirement);
    return newRequirement;
  }

  async getComplianceRequirement(id: string): Promise<ComplianceRequirement | undefined> {
    return this.complianceRequirements.get(id);
  }

  async updateComplianceRequirement(id: string, updates: Partial<InsertComplianceRequirement>): Promise<ComplianceRequirement> {
    const existing = this.complianceRequirements.get(id);
    if (!existing) {
      throw new Error('Compliance requirement not found');
    }
    
    const updated: ComplianceRequirement = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.complianceRequirements.set(id, updated);
    return updated;
  }

  async getAllComplianceRequirements(): Promise<ComplianceRequirement[]> {
    return Array.from(this.complianceRequirements.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createComplianceRecord(record: InsertComplianceRecord): Promise<ComplianceRecord> {
    const id = randomUUID();
    const now = new Date();
    
    const newRecord: ComplianceRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    this.complianceRecords.set(id, newRecord);
    
    // Update the related requirement's last completed date and status if this record shows completion
    if (record.status === 'passed' || record.status === 'partial') {
      const requirement = this.complianceRequirements.get(record.requirementId);
      if (requirement) {
        requirement.lastCompleted = record.completedAt;
        requirement.status = 'completed';
        this.complianceRequirements.set(requirement.id, requirement);
      }
    }
    
    return newRecord;
  }

  async getAllComplianceRecords(): Promise<ComplianceRecord[]> {
    return Array.from(this.complianceRecords.values())
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  async getComplianceAnalytics(): Promise<{
    totalRequirements: number;
    overdueRequirements: number;
    upcomingRequirements: number;
    averageComplianceScore: number;
  }> {
    const requirements = Array.from(this.complianceRequirements.values());
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const totalRequirements = requirements.length;
    
    const overdueRequirements = requirements.filter(req => 
      req.isActive && new Date(req.nextDue) < now && req.status !== 'completed'
    ).length;

    const upcomingRequirements = requirements.filter(req => 
      req.isActive && 
      new Date(req.nextDue) >= now && 
      new Date(req.nextDue) <= thirtyDaysFromNow &&
      req.status !== 'completed'
    ).length;

    const requirementsWithScores = requirements.filter(req => 
      req.complianceScore !== undefined && req.complianceScore !== null
    );
    
    const averageComplianceScore = requirementsWithScores.length > 0
      ? Math.round(requirementsWithScores.reduce((sum, req) => sum + (req.complianceScore || 0), 0) / requirementsWithScores.length)
      : 0;

    return {
      totalRequirements,
      overdueRequirements,
      upcomingRequirements,
      averageComplianceScore
    };
  }
}

export const storage = new MemStorage();
