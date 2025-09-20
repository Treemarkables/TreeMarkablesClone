import { 
  type User, type InsertUser, type LeadSubmission, type InsertLeadSubmission,
  type Customer, type InsertCustomer, type Lead, type InsertLead,
  type Call, type InsertCall, type Quote, type InsertQuote,
  type Job, type InsertJob, type Activity, type InsertActivity,
  type Review, type InsertReview, type Campaign, type InsertCampaign,
  type SocialPlan, type InsertSocialPlan, type CompetitorSignal, type InsertCompetitorSignal,
  type PriceRule, type InsertPriceRule, type CsvImportResult,
  type ServiceM8CustomerCsv, type ServiceM8JobCsv, type ServiceM8QuoteCsv,
  type Notification, type InsertNotification, type UpdateNotification, type NotificationSummary, type NotificationWithDetails,
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

  // Equipment Management
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  getEquipment(id: string): Promise<Equipment | undefined>;
  updateEquipment(id: string, updates: UpdateEquipment): Promise<Equipment>;
  getAllEquipment(): Promise<Equipment[]>;
  getAvailableEquipment(): Promise<Equipment[]>;
  getEquipmentByType(type: string): Promise<Equipment[]>;
  getEquipmentByStatus(status: string): Promise<Equipment[]>;
  deleteEquipment(id: string): Promise<void>;
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
  private notifications: Map<string, Notification>;
  private employees: Map<string, Employee>;
  private scheduleEvents: Map<string, ScheduleEvent>;
  private jobTemplates: Map<string, JobTemplate>;
  private equipment: Map<string, Equipment>;

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
    this.notifications = new Map();
    this.employees = new Map();
    this.scheduleEvents = new Map();
    this.jobTemplates = new Map();
    this.equipment = new Map();
    
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
}

export const storage = new MemStorage();
