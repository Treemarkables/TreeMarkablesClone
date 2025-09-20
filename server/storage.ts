import { 
  type User, type InsertUser, type LeadSubmission, type InsertLeadSubmission,
  type Customer, type InsertCustomer, type Lead, type InsertLead,
  type Call, type InsertCall, type Quote, type InsertQuote,
  type Job, type InsertJob, type Activity, type InsertActivity,
  type Review, type InsertReview, type Campaign, type InsertCampaign,
  type SocialPlan, type InsertSocialPlan, type CompetitorSignal, type InsertCompetitorSignal,
  type PriceRule, type InsertPriceRule
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
}

export const storage = new MemStorage();
