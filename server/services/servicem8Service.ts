import { type InsertCustomer, type InsertCustomerImportBatch } from "@shared/schema";
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

// Removed ServiceM8Job interface - no longer importing jobs

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

  async importCustomers(batchId?: string): Promise<{ success: boolean; imported: number; errors: string[] }> {
    let currentBatchId = batchId;
    
    try {
      console.log('🚀 Starting ServiceM8 customers import...');
      
      // Create import batch for tracking if not provided
      if (!currentBatchId) {
        const batchData: InsertCustomerImportBatch = {
          importType: 'servicem8_sync',
          status: 'processing',
          createdBy: 'system'
        };
        const importBatch = await storage.createCustomerImportBatch(batchData);
        currentBatchId = importBatch.id;
      }
      
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

          const customer: InsertCustomer = {
            name: customerName,
            email: company.email || null,
            phone: company.mobile || company.phone || null,
            address: company.address_line1 || null,
            city: company.address_city || null,
            region: company.address_state || null,
            notes: company.notes || null,
            source: 'referral', // Lead generation source
            importSource: 'servicem8_sync', // Import method
            importBatchId: currentBatchId, // Track which batch this came from
            externalId: company.uuid, // ServiceM8 UUID as external ID
            servicem8Uuid: company.uuid, // Keep for backward compatibility
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

      // Always update batch status regardless of who created it
      await storage.updateCustomerImportBatch(currentBatchId!, {
        status: 'completed',
        totalRecords: companies.length,
        successfulRecords: imported,
        failedRecords: errors.length,
        errorDetails: errors.length > 0 ? errors : null,
        completedAt: new Date()
      });

      console.log(`🎉 ServiceM8 customers import completed: ${imported} imported, ${errors.length} errors`);
      return { success: true, imported, errors };
    } catch (error) {
      console.error('❌ ServiceM8 customers import failed:', error);
      
      // Mark batch as failed if we have a batch ID
      if (currentBatchId) {
        try {
          await storage.updateCustomerImportBatch(currentBatchId, {
            status: 'failed',
            errorDetails: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
            completedAt: new Date()
          });
        } catch (batchUpdateError) {
          console.error('❌ Failed to update batch status:', batchUpdateError);
        }
      }
      
      return { 
        success: false, 
        imported: 0, 
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  // Job imports removed - focusing on customer list migration instead

  async syncExistingData(): Promise<{
    success: boolean;
    customers: { updated: number; errors: string[] };
    message: string;
  }> {
    console.log('🔄 Starting ServiceM8 customer data sync...');
    
    // Test connection first
    const connectionTest = await this.testConnection();
    if (!connectionTest.success) {
      return {
        success: false,
        customers: { updated: 0, errors: [] },
        message: connectionTest.message
      };
    }

    // Update existing customers with complete data
    const customersResult = await this.updateExistingCustomerNames();

    console.log(`🏁 ServiceM8 customer sync finished: ${customersResult.updated} customers updated, ${customersResult.errors.length} errors`);

    return {
      success: customersResult.updated > 0 || customersResult.errors.length === 0,
      customers: { updated: customersResult.updated, errors: customersResult.errors },
      message: `Customer sync completed: ${customersResult.updated} customers updated. ${customersResult.errors.length} errors.`
    };
  }

  // Job description updates removed - no longer managing job imports

  // Complete import method removed - now focusing only on customer management
}

export const servicem8Service = new ServiceM8Service();