import { type InsertCustomer, type InsertJob, type InsertQuote, type InsertLead } from "@shared/schema";
import { storage } from "../storage";

interface ServiceM8Config {
  baseUrl: string;
  apiKey: string;
}

interface ServiceM8Company {
  uuid: string;
  company_name: string;
  contact_first_name: string;
  contact_last_name: string;
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

  async updateExistingCustomerNames(): Promise<{ success: boolean; updated: number; errors: string[] }> {
    try {
      console.log('🔄 Starting ServiceM8 customer name updates...');
      // Request all company fields to get complete customer data including contact names
      const companies: ServiceM8Company[] = await this.makeRequest('/company.json?$select=uuid,company_name,contact_first_name,contact_last_name,email,mobile,phone,address_line1,address_city,address_state,notes,date_created,date_modified');
      
      let updated = 0;
      const errors: string[] = [];

      for (const company of companies) {
        try {
          // Find existing customer by ServiceM8 UUID
          const existingCustomer = await storage.getCustomerByServiceM8Uuid(company.uuid);
          if (!existingCustomer) {
            continue; // Skip if customer doesn't exist
          }

          // Apply improved name mapping logic with better data extraction
          let newCustomerName = '';
          
          // 1. Try company name (clean it up safely)
          if (company.company_name?.trim()) {
            newCustomerName = company.company_name.trim()
              .replace(/\s+/g, ' ')  // normalize spaces
              .trim();
          }
          // 2. Try contact names (handle various formats)
          else if (company.contact_first_name?.trim() || company.contact_last_name?.trim()) {
            const firstName = (company.contact_first_name || '').trim();
            const lastName = (company.contact_last_name || '').trim();
            newCustomerName = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
          }
          // 3. Try email (extract meaningful part)
          else if (company.email?.includes('@')) {
            const emailUser = company.email.split('@')[0];
            // Clean up email usernames
            newCustomerName = emailUser
              .replace(/[._-]/g, ' ')
              .replace(/\b\d+\b/g, '') // remove standalone numbers
              .trim()
              .replace(/\s+/g, ' ');
            if (newCustomerName.length < 2) {
              newCustomerName = `Customer (${company.email})`;
            }
          }
          // 4. Try phone with better formatting
          else if (company.mobile?.trim() || company.phone?.trim()) {
            const phoneNumber = (company.mobile?.trim() || company.phone?.trim())!;
            newCustomerName = `Customer (${phoneNumber})`;
          }
          // 5. Try address with better extraction
          else if (company.address_line1?.trim()) {
            let addressPart = company.address_line1.trim();
            // Extract house number and street name
            const match = addressPart.match(/^(\d+[a-z]?\s+)?([\w\s]+)/i);
            if (match && match[2]) {
              newCustomerName = `Customer at ${match[2].trim()}`;
            } else {
              newCustomerName = `Customer at ${addressPart}`;
            }
          }
          // 6. Last resort - use UUID but make it more consistent
          else {
            newCustomerName = `Customer-${company.uuid.slice(-8)}`;
          }
          
          // Clean up the final name
          if (newCustomerName && !newCustomerName.startsWith('Customer-')) {
            newCustomerName = newCustomerName
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 100); // Limit length
          }
          
          // Update if the name actually changed (including better placeholder names)
          if (newCustomerName !== existingCustomer.name) {
            await storage.updateCustomer(existingCustomer.id, { name: newCustomerName });
            updated++;
            console.log(`✅ Updated customer name: ${existingCustomer.name} → ${newCustomerName}`);
          }
        } catch (error) {
          const errorMsg = `Failed to update customer ${company.company_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`🎉 ServiceM8 customer name updates completed: ${updated} updated, ${errors.length} errors`);
      return { success: true, updated, errors };
    } catch (error) {
      console.error('❌ ServiceM8 customer name updates failed:', error);
      return { 
        success: false, 
        updated: 0, 
        errors: [`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  async importCustomers(): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      console.log('🚀 Starting ServiceM8 customers import...');
      // Request all company fields to get complete customer data including contact names
      const companies: ServiceM8Company[] = await this.makeRequest('/company.json?$select=uuid,company_name,contact_first_name,contact_last_name,email,mobile,phone,address_line1,address_city,address_state,notes,date_created,date_modified');
      
      let imported = 0;
      const errors: string[] = [];

      for (const company of companies) {
        try {
          // Check if customer already exists by ServiceM8 UUID
          const existingCustomer = await storage.getCustomerByServiceM8Uuid(company.uuid);
          if (existingCustomer) {
            console.log(`⏭️ Skipping existing customer: ${existingCustomer.name}`);
            continue;
          }

          // Map ServiceM8 company to our customer schema with better fallbacks
          let customerName = '';
          
          // Try company name first
          if (company.company_name?.trim()) {
            customerName = company.company_name.trim();
          }
          // Try contact name
          else if (company.contact_first_name?.trim() || company.contact_last_name?.trim()) {
            const firstName = (company.contact_first_name || '').trim();
            const lastName = (company.contact_last_name || '').trim();
            customerName = `${firstName} ${lastName}`.trim();
          }
          // Try email username
          else if (company.email?.includes('@')) {
            customerName = company.email.split('@')[0];
          }
          // Try phone number if available (mobile or landline)
          else if (company.mobile?.trim() || company.phone?.trim()) {
            const phoneNumber = company.mobile?.trim() || company.phone?.trim();
            customerName = `Customer (${phoneNumber})`;
          }
          // Use address if available
          else if (company.address_line1?.trim()) {
            customerName = `Customer at ${company.address_line1.trim()}`;
          }
          // Final fallback to UUID
          else {
            customerName = `Customer-${company.uuid.slice(-8)}`;
          }
          
          // Log the data we're getting to help debug
          console.log(`🔍 ServiceM8 customer data:`, {
            uuid: company.uuid.slice(-8),
            company_name: company.company_name,
            contact_first_name: company.contact_first_name,
            contact_last_name: company.contact_last_name,
            email: company.email,
            mobile: company.mobile,
            phone: company.phone,
            address_line1: company.address_line1,
            final_name: customerName,
            raw_company_keys: Object.keys(company).slice(0, 10) // Show first 10 keys to debug field names
          });

          const customer: InsertCustomer = {
            name: customerName,
            email: company.email || null,
            phone: company.mobile || company.phone || null,
            address: company.address_line1 || null,
            city: company.address_city || null,
            region: company.address_state || null,
            notes: company.notes || null,
            source: 'servicem8_import',
            servicem8Uuid: company.uuid, // Store ServiceM8 UUID for job mapping
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
      // Request all job fields to get complete job data including job_description
      const jobs: ServiceM8Job[] = await this.makeRequest('/job.json?$select=uuid,company_uuid,generated_job_id,status,job_description,job_address,job_location,total_cost,date_created,date_modified,time_created,priority,notes');
      
      let imported = 0;
      const errors: string[] = [];

      // Get all customers to map company_uuid to customer IDs
      const customers = await storage.getAllCustomers();
      
      for (const job of jobs) {
        try {
          const jobNumber = job.generated_job_id || `SM8-${job.uuid.slice(-8)}`;
          
          // Check if job already exists by job number
          const existingJob = await storage.getJobByJobNumber(jobNumber);
          if (existingJob) {
            console.log(`⏭️ Skipping existing job: ${jobNumber}`);
            continue;
          }

          // Find the customer by ServiceM8 UUID for correct mapping
          const customer = customers.find(c => c.servicem8Uuid === job.company_uuid);
          
          if (!customer) {
            errors.push(`No customer found for ServiceM8 company UUID ${job.company_uuid} (job ${job.generated_job_id})`);
            continue;
          }

          // Map ServiceM8 status to our job status
          const statusMap: { [key: string]: 'lead' | 'quote' | 'scheduled' | 'work_order' | 'completed' | 'unsuccessful' } = {
            'Quote': 'quote',
            'Scheduled': 'scheduled', 
            'In Progress': 'work_order',
            'Completed': 'completed',
            'Cancelled': 'unsuccessful'
          };

          const mappedStatus = statusMap[job.status] || 'quote';

          // Map ServiceM8 job to our job schema
          const newJob: InsertJob = {
            customerId: customer.id,
            jobNumber: jobNumber, // Use the same job number we checked for
            title: job.job_description || `Job ${job.generated_job_id}`,
            description: job.notes || job.job_description || null,
            status: mappedStatus,
            priority: job.priority?.toLowerCase() || 'medium',
            address: job.job_address || job.job_location || 'Address not specified',
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

  async syncExistingData(): Promise<{
    success: boolean;
    customers: { updated: number; errors: string[] };
    jobs: { updated: number; errors: string[] };
    message: string;
  }> {
    console.log('🔄 Starting ServiceM8 data sync to update existing records...');
    
    // Test connection first
    const connectionTest = await this.testConnection();
    if (!connectionTest.success) {
      return {
        success: false,
        customers: { updated: 0, errors: [] },
        jobs: { updated: 0, errors: [] },
        message: connectionTest.message
      };
    }

    // Update existing customers with complete data
    const customersResult = await this.updateExistingCustomerNames();
    
    // Update existing jobs with complete descriptions
    const jobsResult = await this.updateExistingJobDescriptions();

    const totalUpdated = customersResult.updated + jobsResult.updated;
    const totalErrors = customersResult.errors.length + jobsResult.errors.length;

    console.log(`🏁 ServiceM8 data sync finished: ${totalUpdated} total items updated, ${totalErrors} total errors`);

    return {
      success: totalUpdated > 0 || totalErrors === 0,
      customers: { updated: customersResult.updated, errors: customersResult.errors },
      jobs: { updated: jobsResult.updated, errors: jobsResult.errors },
      message: `Sync completed: ${customersResult.updated} customers, ${jobsResult.updated} jobs updated. ${totalErrors} errors.`
    };
  }

  async updateExistingJobDescriptions(): Promise<{ success: boolean; updated: number; errors: string[] }> {
    try {
      console.log('🔄 Starting ServiceM8 job description updates...');
      // Request all job fields to get complete job data including job_description  
      const jobs: ServiceM8Job[] = await this.makeRequest('/job.json?$select=uuid,company_uuid,generated_job_id,status,job_description,job_address,job_location,total_cost,date_created,date_modified,time_created,priority,notes');
      
      let updated = 0;
      const errors: string[] = [];

      for (const job of jobs) {
        try {
          const jobNumber = job.generated_job_id || `SM8-${job.uuid.slice(-8)}`;
          
          // Find existing job by job number
          const existingJob = await storage.getJobByJobNumber(jobNumber);
          if (!existingJob) {
            continue; // Skip if job doesn't exist
          }

          // Update description with real ServiceM8 data if available
          let newDescription = null;
          let newTitle = existingJob.title;
          
          if (job.job_description?.trim()) {
            newDescription = job.job_description.trim();
            // Also update title if it's currently generic
            if (existingJob.title?.startsWith('Job ') || !existingJob.title?.trim()) {
              newTitle = job.job_description.trim().substring(0, 100); // First 100 chars as title
            }
          } else if (job.notes?.trim()) {
            newDescription = job.notes.trim();
            if (existingJob.title?.startsWith('Job ') || !existingJob.title?.trim()) {
              newTitle = job.notes.trim().substring(0, 100);
            }
          }

          // Update if we have new description data
          if (newDescription && (existingJob.description !== newDescription || existingJob.title !== newTitle)) {
            await storage.updateJob(existingJob.id, { 
              description: newDescription,
              title: newTitle 
            });
            updated++;
            console.log(`✅ Updated job description: ${jobNumber} → "${newDescription.substring(0, 50)}..."`);
          }
        } catch (error) {
          const errorMsg = `Failed to update job ${job.generated_job_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(`🎉 ServiceM8 job description updates completed: ${updated} updated, ${errors.length} errors`);
      return { success: true, updated, errors };
    } catch (error) {
      console.error('❌ ServiceM8 job description updates failed:', error);
      return { 
        success: false, 
        updated: 0, 
        errors: [`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
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