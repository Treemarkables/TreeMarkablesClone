import { 
  type User, type InsertUser, type LeadSubmission, type InsertLeadSubmission,
  type Customer, type InsertCustomer, type Lead, type InsertLead,
  type Call, type InsertCall, type Quote, type InsertQuote,
  type Job, type InsertJob, type Activity, type InsertActivity,
  type Review, type InsertReview, type Campaign, type InsertCampaign,
  type SocialPlan, type InsertSocialPlan, type CompetitorSignal, type InsertCompetitorSignal,
  type PriceRule, type InsertPriceRule, type CsvImportResult,
  type ServiceM8CustomerCsv, type ServiceM8JobCsv, type ServiceM8QuoteCsv,
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private leads: LeadSubmission[];
  private customers: Map<string, Customer>;
  private pipelineLeads: Map<string, Lead>;
  private calls: Map<string, Call>;
  private quotes: Map<string, Quote>;
  private jobs: Map<string, Job>;
  private activities: Map<string, Activity>;
  private reviews: Map<string, Review>;
  private campaigns: Map<string, Campaign>;
  private socialPlans: Map<string, SocialPlan>;
  private competitorSignals: Map<string, CompetitorSignal>;
  private priceRules: Map<string, PriceRule>;

  constructor() {
    this.users = new Map();
    this.leads = [];
    this.customers = new Map();
    this.pipelineLeads = new Map();
    this.calls = new Map();
    this.quotes = new Map();
    this.jobs = new Map();
    this.activities = new Map();
    this.reviews = new Map();
    this.campaigns = new Map();
    this.socialPlans = new Map();
    this.competitorSignals = new Map();
    this.priceRules = new Map();
    
    // Add sample data for demo purposes
    this.initializeSampleData();
  }
  
  private initializeSampleData() {
    // Sample customers
    const customer1 = { 
      id: '1', name: 'Sarah Johnson', email: 'sarah.johnson@email.com', phone: '(555) 123-4567', 
      address: '123 Maple Street, Auckland, NZ', city: 'Auckland', region: 'Auckland', 
      notes: 'Has large oak tree requiring removal. Previous customer.', source: 'Google Ads', 
      leadId: null, isActive: true, totalSpent: null, lastContactDate: null, preferredContactMethod: 'phone',
      createdAt: new Date('2024-12-15'), updatedAt: new Date('2024-12-15') 
    };
    const customer2 = { 
      id: '2', name: 'Mike Chen', email: 'mike.chen@email.com', phone: '(555) 987-6543',
      address: '456 Pine Avenue, Wellington, NZ', city: 'Wellington', region: 'Wellington',
      notes: 'Storm damaged tree removal needed urgently.', source: 'Facebook', 
      leadId: null, isActive: true, totalSpent: null, lastContactDate: null, preferredContactMethod: 'email',
      createdAt: new Date('2024-12-10'), updatedAt: new Date('2024-12-10') 
    };
    const customer3 = { 
      id: '3', name: 'Emma Wilson', email: 'emma.wilson@email.com', phone: '(555) 456-7890',
      address: '789 Cedar Lane, Christchurch, NZ', city: 'Christchurch', region: 'Canterbury',
      notes: 'Regular maintenance customer. Quarterly pruning.', source: 'Website',
      leadId: null, isActive: true, totalSpent: null, lastContactDate: null, preferredContactMethod: 'phone',
      createdAt: new Date('2024-12-08'), updatedAt: new Date('2024-12-08') 
    };
    
    this.customers.set('1', customer1);
    this.customers.set('2', customer2); 
    this.customers.set('3', customer3);
    
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
      id: '1', customerId: '1', title: 'Large Oak Tree Removal', description: 'Remove dangerous oak tree leaning toward house',
      status: 'completed', priority: 'high', scheduledDate: new Date('2024-12-18'), completedDate: new Date('2024-12-18'),
      estimatedHours: 8, actualHours: 9, totalAmount: '2500.00', address: '123 Maple Street, Auckland, NZ',
      notes: 'Required additional safety equipment due to power lines', beforePhotos: ['/api/photos/oak_before_1.jpg', '/api/photos/oak_before_2.jpg'],
      afterPhotos: ['/api/photos/oak_after_1.jpg', '/api/photos/oak_after_2.jpg'], jobNumber: 'JOB-001',
      quoteId: '1', leadId: null, assignedCrew: null, equipmentRequired: null, specialInstructions: null,
      weatherDependent: null, permitRequired: null, safetyNotes: null, rescheduledFrom: null, rescheduledReason: null,
      createdAt: new Date('2024-12-15'), updatedAt: new Date('2024-12-18')
    };
    const job2 = {
      id: '2', customerId: '2', title: 'Storm Damage Tree Removal', description: 'Emergency removal of storm-damaged pine tree',
      status: 'in_progress', priority: 'high', scheduledDate: new Date('2024-12-21'), completedDate: null,
      estimatedHours: 6, actualHours: null, totalAmount: '1200.00', address: '456 Pine Avenue, Wellington, NZ',
      notes: 'Waiting for city permits before proceeding', beforePhotos: ['/api/photos/storm_before_1.jpg'],
      afterPhotos: [], jobNumber: 'JOB-002', quoteId: '2', leadId: null, assignedCrew: null, equipmentRequired: null,
      specialInstructions: null, weatherDependent: null, permitRequired: null, safetyNotes: null, rescheduledFrom: null,
      rescheduledReason: null, createdAt: new Date('2024-12-10'), updatedAt: new Date('2024-12-20')
    };
    
    this.jobs.set('1', job1);
    this.jobs.set('2', job2);
    
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
}

export const storage = new MemStorage();
