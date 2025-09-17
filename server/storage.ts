import { type User, type InsertUser, type LeadSubmission, type InsertLeadSubmission } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Lead tracking methods
  saveLead(lead: InsertLeadSubmission): Promise<LeadSubmission>;
  getLeads(fromDate?: Date, toDate?: Date): Promise<LeadSubmission[]>;
  getLeadsByPagePath(): Promise<{ pagePath: string; count: number }[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private leads: LeadSubmission[];

  constructor() {
    this.users = new Map();
    this.leads = [];
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
}

export const storage = new MemStorage();
