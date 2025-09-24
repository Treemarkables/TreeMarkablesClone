import { type InsertCustomer, type InsertJob, type InsertQuote, type InsertLead } from "@shared/schema";
import { storage } from "../storage";

interface ServiceM8Config {
  baseUrl: string;
  apiKey: string;
}

interface ServiceM8Company {
  uuid: string;
  company_name: string;
  contact_first: string;
  contact_last: string;
  email: string;
  mobile: string;
  phone: string;
  address_line1: string;
  address_city: string;
  address_state: string;
  notes: string;
  date_created: string;
  date_modified: string;
}

interface ServiceM8Job {
  uuid: string;
  company_uuid: string;
  generated_job_id: string;
  status: string;
  job_description: string;
  job_address: string;
  job_location: string;
  total_cost: string;
  date_created: string;
  date_modified: string;
  time_created: string;
  priority: string;
  notes: string;
}

class ServiceM8Service {
  private config: ServiceM8Config;

  constructor() {
    this.config = {
      baseUrl: 'https://api.servicem8.com/api_1.0',
      apiKey: process.env.SERVICEM8_API_KEY || ''
    };
  }

  private validateApiKey(): void {
    if (!this.config.apiKey) {
      throw new Error('ServiceM8 API key not found in environment variables');
    }
  }

  private async makeRequest(endpoint: string): Promise<any> {
    this.validateApiKey();
    
    const url = `${this.config.baseUrl}${endpoint}`;
    console.log(`🔄 ServiceM8 API Request: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ServiceM8 API Error [${response.status}]:`, errorText);
        throw new Error(`ServiceM8 API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ ServiceM8 API Success: Retrieved ${Array.isArray(data) ? data.length : 1} items`);
      return data;
    } catch (error) {
      console.error('❌ ServiceM8 API Request Failed:', error);
      throw error;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.makeRequest('/company.json?$top=1');
      return { success: true, message: 'Successfully connected to ServiceM8 API' };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to connect to ServiceM8: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async importCustomers(): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      console.log('🚀 Starting ServiceM8 customers import...');
      const companies: ServiceM8Company[] = await this.makeRequest('/company.json');
      
      let imported = 0;
      const errors: string[] = [];

      for (const company of companies) {
        try {
          // Map ServiceM8 company to our customer schema
          const customer: InsertCustomer = {
            name: company.company_name || `${company.contact_first || ''} ${company.contact_last || ''}`.trim() || 'Unknown Customer',
            email: company.email || null,
            phone: company.mobile || company.phone || null,
            address: company.address_line1 || null,
            city: company.address_city || null,
            region: company.address_state || null,
            notes: company.notes || null,
            source: 'servicem8_import',
            isActive: true
          };

          await storage.createCustomer(customer);
          imported++;
          console.log(`✅ Imported customer: ${customer.name}`);
        } catch (error) {
          const errorMsg = `Failed to import customer ${company.company_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`🎉 ServiceM8 customers import completed: ${imported} imported, ${errors.length} errors`);
      return { success: true, imported, errors };
    } catch (error) {
      console.error('❌ ServiceM8 customers import failed:', error);
      return { 
        success: false, 
        imported: 0, 
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  async importJobs(): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      console.log('🚀 Starting ServiceM8 jobs import...');
      const jobs: ServiceM8Job[] = await this.makeRequest('/job.json');
      
      let imported = 0;
      const errors: string[] = [];

      // Get all customers to map company_uuid to customer IDs
      const customers = await storage.getAllCustomers();
      
      for (const job of jobs) {
        try {
          // Find the customer by looking for ServiceM8 source
          const customer = customers.find(c => c.source === 'servicem8_import');
          
          if (!customer) {
            errors.push(`No customer found for job ${job.generated_job_id}`);
            continue;
          }

          // Map ServiceM8 status to our job status
          const statusMap: { [key: string]: string } = {
            'Quote': 'quoted',
            'Scheduled': 'scheduled', 
            'In Progress': 'in_progress',
            'Completed': 'completed',
            'Cancelled': 'cancelled'
          };

          const mappedStatus = statusMap[job.status] || 'quoted';

          // Map ServiceM8 job to our job schema
          const newJob: InsertJob = {
            customerId: customer.id,
            title: job.job_description || `Job ${job.generated_job_id}`,
            description: job.notes || job.job_description || null,
            status: mappedStatus,
            priority: job.priority?.toLowerCase() || 'medium',
            address: job.job_address || job.job_location || null,
            estimatedValue: job.total_cost ? parseFloat(job.total_cost) : null,
            createdAt: job.date_created ? new Date(job.date_created) : new Date(),
            updatedAt: job.date_modified ? new Date(job.date_modified) : new Date()
          };

          await storage.createJob(newJob);
          imported++;
          console.log(`✅ Imported job: ${newJob.title}`);
        } catch (error) {
          const errorMsg = `Failed to import job ${job.generated_job_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`🎉 ServiceM8 jobs import completed: ${imported} imported, ${errors.length} errors`);
      return { success: true, imported, errors };
    } catch (error) {
      console.error('❌ ServiceM8 jobs import failed:', error);
      return { 
        success: false, 
        imported: 0, 
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  async importAll(): Promise<{
    success: boolean;
    customers: { imported: number; errors: string[] };
    jobs: { imported: number; errors: string[] };
    message: string;
  }> {
    console.log('🌟 Starting complete ServiceM8 data import...');
    
    // Test connection first
    const connectionTest = await this.testConnection();
    if (!connectionTest.success) {
      return {
        success: false,
        customers: { imported: 0, errors: [] },
        jobs: { imported: 0, errors: [] },
        message: connectionTest.message
      };
    }

    // Import customers first
    const customersResult = await this.importCustomers();
    
    // Then import jobs
    const jobsResult = await this.importJobs();

    const totalImported = customersResult.imported + jobsResult.imported;
    const totalErrors = customersResult.errors.length + jobsResult.errors.length;

    console.log(`🏁 ServiceM8 complete import finished: ${totalImported} total items imported, ${totalErrors} total errors`);

    return {
      success: totalImported > 0,
      customers: customersResult,
      jobs: jobsResult,
      message: `Import completed: ${customersResult.imported} customers, ${jobsResult.imported} jobs imported. ${totalErrors} errors.`
    };
  }
}

export const servicem8Service = new ServiceM8Service();