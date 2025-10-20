import { Router, Request, Response } from 'express';
import { XeroClient } from 'xero-node';
import type { IStorage } from './storage';

const router = Router();

// For Custom Connections, we use client credentials grant
// No redirect URIs or OAuth callbacks needed
const xeroClient = new XeroClient({
  clientId: process.env.XERO_CLIENT_ID!,
  clientSecret: process.env.XERO_CLIENT_SECRET!,
  grantType: 'client_credentials',
});

export function registerXeroRoutes(app: any, storage: IStorage) {
  console.log('🔗 Xero Custom Connection mode enabled');
  
  // Connect to Xero using Custom Connection (client credentials)
  app.post('/api/xero/connect', async (req: Request, res: Response) => {
    try {
      console.log('🔐 Connecting to Xero using Custom Connection...');
      
      // Request access token using client credentials
      const tokenSet = await xeroClient.getClientCredentialsToken();
      
      console.log('✅ Access token received');
      
      // Set tokens on client
      await xeroClient.setTokenSet(tokenSet);
      
      // For Custom Connections, we use a fixed tenant ID since they connect to one org
      const tenantId = 'custom-connection'; // Fixed ID for custom connections
      const tenantName = 'Treemarkables Limited'; // Will be updated from API calls
      
      // Calculate expiry date (Custom Connection tokens expire in 30 minutes)
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokenSet.expires_in || 1800));
      
      // Check if connection already exists
      const existing = await storage.getXeroConnection(tenantId);
      
      if (existing) {
        // Update existing connection
        await storage.updateXeroConnection(tenantId, {
          tenantName,
          accessToken: tokenSet.access_token!,
          refreshToken: '', // Custom Connections don't use refresh tokens
          expiresAt,
          idToken: tokenSet.id_token || '',
          scope: tokenSet.scope,
          isActive: true,
          lastSyncedAt: new Date(),
        });
      } else {
        // Create new connection
        await storage.createXeroConnection({
          tenantId,
          tenantName,
          accessToken: tokenSet.access_token!,
          refreshToken: '', // Custom Connections don't use refresh tokens
          expiresAt,
          idToken: tokenSet.id_token || '',
          scope: tokenSet.scope,
          isActive: true,
          lastSyncedAt: new Date(),
        });
      }
      
      console.log('✅ Xero Custom Connection established');
      
      res.json({ 
        success: true, 
        message: 'Connected to Xero successfully',
        tenantName 
      });
    } catch (error) {
      console.error('❌ Error connecting to Xero:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to connect to Xero. Make sure you have authorized the Custom Connection.' 
      });
    }
  });

  // Get Xero connection status
  app.get('/api/xero/status', async (req: Request, res: Response) => {
    try {
      const connection = await storage.getActiveXeroConnection();
      
      if (!connection) {
        return res.json({ 
          success: true, 
          connected: false 
        });
      }
      
      res.json({
        success: true,
        connected: true,
        tenantName: connection.tenantName,
        tenantId: connection.tenantId,
        lastSynced: connection.lastSyncedAt,
      });
    } catch (error) {
      console.error('Error checking Xero status:', error);
      res.status(500).json({ success: false, message: 'Failed to check Xero status' });
    }
  });

  // Disconnect from Xero
  app.post('/api/xero/disconnect', async (req: Request, res: Response) => {
    try {
      const connection = await storage.getActiveXeroConnection();
      
      if (!connection) {
        return res.json({ success: true, message: 'No active connection' });
      }
      
      await storage.deleteXeroConnection(connection.tenantId);
      
      res.json({ success: true, message: 'Disconnected from Xero' });
    } catch (error) {
      console.error('Error disconnecting from Xero:', error);
      res.status(500).json({ success: false, message: 'Failed to disconnect from Xero' });
    }
  });

  // Helper function to get a valid Xero client with fresh token
  async function getValidXeroClient(): Promise<XeroClient | null> {
    const connection = await storage.getActiveXeroConnection();
    
    if (!connection) {
      return null;
    }
    
    // Check if token needs refresh (Custom Connection tokens expire in 30 min)
    const expiresIn = Math.floor((new Date(connection.expiresAt).getTime() - Date.now()) / 1000);
    
    if (expiresIn < 60) {
      // Token expired or expiring soon - get a new one
      console.log('🔄 Refreshing Xero access token...');
      
      const tokenSet = await xeroClient.getClientCredentialsToken();
      
      // Update in database
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (tokenSet.expires_in || 1800));
      
      await storage.updateXeroConnection(connection.tenantId, {
        accessToken: tokenSet.access_token!,
        expiresAt: newExpiresAt,
        lastSyncedAt: new Date(),
      });
      
      await xeroClient.setTokenSet(tokenSet);
      console.log('✅ Access token refreshed');
    } else {
      // Use existing token
      await xeroClient.setTokenSet({
        access_token: connection.accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
      });
    }
    
    return xeroClient;
  }
  
  // Send job invoice to Xero (used by Invoices page)
  app.post('/api/xero/send-invoice', async (req: Request, res: Response) => {
    try {
      console.log('📤 Xero send-invoice request received:', req.body);
      const { jobId } = req.body;
      
      if (!jobId) {
        console.error('❌ No job ID provided');
        return res.status(400).json({ 
          success: false, 
          message: 'Job ID is required' 
        });
      }
      
      console.log(`📤 Processing send-invoice for jobId: ${jobId}`);
      
      // Get Xero client with valid token
      const client = await getValidXeroClient();
      if (!client) {
        console.error('❌ Not connected to Xero');
        return res.status(400).json({ 
          success: false, 
          message: 'Not connected to Xero. Please connect first.' 
        });
      }
      
      console.log('✅ Xero client ready');
      
      // Get job details
      const job = await storage.getJob(jobId);
      if (!job) {
        console.error(`❌ Job not found: ${jobId}`);
        return res.status(404).json({ 
          success: false, 
          message: 'Job not found' 
        });
      }
      
      console.log(`✅ Job found: ${job.jobNumber} - ${job.title}`);
      
      // Get customer details
      if (!job.customerId) {
        console.error(`❌ Job ${jobId} has no customer assigned`);
        return res.status(400).json({ 
          success: false, 
          message: 'Job has no customer assigned' 
        });
      }
      
      const customer = await storage.getCustomer(job.customerId);
      if (!customer) {
        console.error(`❌ Customer not found: ${job.customerId}`);
        return res.status(404).json({ 
          success: false, 
          message: 'Customer not found' 
        });
      }
      
      console.log(`✅ Customer found: ${customer.name}`);
      console.log(`📤 Sending invoice to Xero for job ${job.jobNumber} (${job.title})`);
      
      // For Custom Connections, we use the tenant ID from the connection
      const connection = await storage.getActiveXeroConnection();
      if (!connection) {
        console.error('❌ No active Xero connection found');
        return res.status(400).json({ 
          success: false, 
          message: 'Not connected to Xero. Please connect first.' 
        });
      }
      const tenantId = connection.tenantId;
      
      // Step 1: Check if contact exists in Xero or create it
      let xeroContactId: string;
      
      try {
        // Search for existing contact by name
        const contactsResponse = await client.accountingApi.getContacts(
          tenantId,
          undefined, // IDs
          `Name="${customer.name}"` // where filter
        );
        
        if (contactsResponse.body.contacts && contactsResponse.body.contacts.length > 0) {
          xeroContactId = contactsResponse.body.contacts[0].contactID!;
          console.log(`✅ Found existing Xero contact: ${xeroContactId}`);
        } else {
          // Create new contact
          const newContact = {
            name: customer.name,
            emailAddress: customer.email || undefined,
            phones: customer.phone ? [{
              phoneType: 'DEFAULT' as any,
              phoneNumber: customer.phone,
            }] : undefined,
            addresses: customer.address ? [{
              addressType: 'STREET' as any,
              addressLine1: customer.address,
            }] : undefined,
          };
          
          const createResponse = await client.accountingApi.createContacts(
            tenantId,
            { contacts: [newContact] }
          );
          
          xeroContactId = createResponse.body.contacts![0].contactID!;
          console.log(`✅ Created new Xero contact: ${xeroContactId}`);
        }
      } catch (error) {
        console.error('Error managing Xero contact:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to create/find contact in Xero' 
        });
      }
      
      // Check if job has an address
      const jobInvoices = await storage.getInvoicesByJob(job.id);
      const jobInvoice = jobInvoices?.[0];
      
      const address = (jobInvoice?.address || job.address || '').trim();
      
      if (!address || address.length < 5) {
        console.error(`❌ Job ${job.jobNumber} has invalid or missing address`);
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot send to Xero: Job/Invoice must have a valid address (at least 5 characters). Please edit the invoice to add an address.',
          missingField: 'address',
          invoiceId: jobInvoice?.id
        });
      }
      
      // Get Xero settings for account code and tax type
      const xeroSettings = await storage.getXeroSettings();
      const accountCode = xeroSettings?.salesAccountCode || '200';
      const taxType = xeroSettings?.taxType || 'OUTPUT2';
      
      console.log(`📋 Using Xero settings - Account Code: ${accountCode}, Tax Type: ${taxType}`);
      
      // Step 2: Create invoice in Xero
      try {
        console.log(`🚀 XERO INVOICE: Starting invoice creation for job ${job.id}`);
        
        let invoiceLineItems: any[] = [];
        
        // PRIORITY 1: Check for existing invoice line items
        const invoices = await storage.getInvoicesByJob(job.id);
        const invoice = invoices?.[0]; // Get the first/latest invoice
        
        if (invoice) {
          console.log(`💰 Found invoice ${invoice.invoiceNumber} for job ${job.id}, amount: $${invoice.amount}`);
          
          // Invoice items are stored in the JSONB 'items' column
          const invoiceItems = (invoice.items as any[]) || [];
          console.log(`📋 Found ${invoiceItems.length} line item(s) in invoice`);
          
          for (const item of invoiceItems) {
            invoiceLineItems.push({
              description: item.description || 'Tree Service',
              quantity: Number(item.quantity) || 1,
              unitAmount: Number(item.rate || item.unitPrice) || 0,
              accountCode,
              taxType,
            });
          }
        }
        
        // PRIORITY 2: Check for proposal line items if no invoice found
        if (invoiceLineItems.length === 0) {
          const proposals = await storage.getProposalsByJob(job.id);
          const proposal = proposals?.[0]; // Get the first/latest proposal
          
          console.log(`📋 Found ${proposals.length} proposal(s) for job ${job.id}`);
          
          if (proposal) {
            const sections = await storage.getProposalSectionsByProposal(proposal.id);
            console.log(`📋 Found ${sections.length} section(s) for proposal ${proposal.id}`);
            
            const allLineItems = await storage.getProposalLineItemsByProposal(proposal.id);
            console.log(`📋 Found ${allLineItems.length} total line item(s) for proposal ${proposal.id}`);
            
            for (const item of allLineItems) {
              invoiceLineItems.push({
                description: item.description || 'Tree Service',
                quantity: Number(item.quantity) || 1,
                unitAmount: Number(item.unitPrice) || 0,
                accountCode,
                taxType,
              });
            }
          }
        }
        
        // PRIORITY 3: Fallback to job line items if nothing else found
        if (invoiceLineItems.length === 0) {
          const jobLineItems = job.lineItems || [];
          if (jobLineItems.length === 0) {
            return res.status(400).json({ 
              success: false, 
              message: 'Job must have at least one line item to create an invoice' 
            });
          }
          invoiceLineItems = jobLineItems.map((item: any) => ({
            description: item.description || 'Tree Service',
            quantity: item.quantity || 1,
            unitAmount: parseFloat(item.unitPrice || item.total || 0),
            accountCode,
            taxType,
          }));
        }
        
        const lineItems = invoiceLineItems;
        
        const xeroInvoicePayload = {
          type: 'ACCREC' as any, // Accounts Receivable (sales invoice)
          contact: {
            contactID: xeroContactId,
          },
          lineItems,
          date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days from now
          reference: `Job #${job.id}`,
          status: 'AUTHORISED' as any,
        };
        
        const invoiceResponse = await client.accountingApi.createInvoices(
          tenantId,
          { invoices: [xeroInvoicePayload] }
        );
        
        const xeroInvoice = invoiceResponse.body.invoices![0];
        console.log(`✅ Invoice created in Xero: ${xeroInvoice.invoiceID}`);
        
        // Update job with Xero invoice ID - keep status as 'completed'
        await storage.updateJob(jobId, {
          xeroInvoiceId: xeroInvoice.invoiceID || undefined,
          xeroStatus: 'sent',
          sentToXeroDate: new Date(),
        });
        
        // Update the invoice status to 'sent' so it disappears from Pending tab
        if (invoice) {
          await storage.updateInvoice(invoice.id, {
            status: 'sent',
            xeroInvoiceId: xeroInvoice.invoiceID || undefined,
            xeroSyncedAt: new Date(),
          });
          console.log(`✅ Updated invoice ${invoice.invoiceNumber} status to 'sent'`);
        }
        
        // Create diary entry for Xero send
        await storage.createJobDiaryEntry({
          jobId,
          entryType: 'note',
          title: 'Invoice Sent to Xero',
          description: `Invoice #${xeroInvoice.invoiceNumber || xeroInvoice.invoiceID} sent to Xero successfully. Total: $${job.totalAmount || '0.00'}`,
          authorName: 'System',
          authorRole: 'system',
          metadata: {
            xeroInvoiceId: xeroInvoice.invoiceID,
            xeroInvoiceNumber: xeroInvoice.invoiceNumber,
            action: 'sent_to_xero'
          }
        });
        
        res.json({ 
          success: true, 
          message: 'Invoice sent to Xero successfully',
          invoiceNumber: xeroInvoice.invoiceNumber,
          invoiceId: xeroInvoice.invoiceID,
        });
      } catch (error: any) {
        console.error('Error creating Xero invoice:', error);
        
        // Update job with error status
        await storage.updateJob(jobId, {
          xeroStatus: 'error',
          sentToXeroDate: new Date(),
        });
        
        // Provide detailed error message for Xero validation errors
        let errorMessage = 'Failed to create invoice in Xero';
        
        if (error?.response?.body?.Elements?.[0]?.ValidationErrors) {
          const validationErrors = error.response.body.Elements[0].ValidationErrors;
          const errorDetails = validationErrors.map((e: any) => e.Message).join('; ');
          errorMessage = `Xero validation error: ${errorDetails}. Please check your Xero settings (Account Code: ${accountCode}, Tax Type: ${taxType}) in Settings > Xero Configuration.`;
        } else if (error?.response?.body?.Message) {
          errorMessage = `Xero error: ${error.response.body.Message}. This may be caused by incorrect Account Code (${accountCode}) or Tax Type (${taxType}). Please verify these settings exist in your Xero chart of accounts.`;
        }
        
        res.status(500).json({ 
          success: false, 
          message: errorMessage,
          details: {
            accountCode,
            taxType,
            suggestion: 'If this error persists, please verify that the Account Code and Tax Type exist in your Xero organization. You can configure these in Settings > Xero Configuration.'
          }
        });
      }
    } catch (error) {
      console.error('Error in send-invoice:', error);
      res.status(500).json({ 
        success: false, 
        message: 'An error occurred while sending invoice to Xero' 
      });
    }
  });

  // Test Xero connection
  app.get('/api/xero/test', async (req: Request, res: Response) => {
    try {
      const client = await getValidXeroClient();
      if (!client) {
        return res.status(400).json({ 
          success: false, 
          message: 'Not connected to Xero' 
        });
      }
      
      const connection = await storage.getActiveXeroConnection();
      const tenantId = connection!.tenantId;
      
      // Get organization info
      const orgResponse = await client.accountingApi.getOrganisations(tenantId);
      const org = orgResponse.body.organisations![0];
      
      res.json({
        success: true,
        organization: {
          name: org.name,
          legalName: org.legalName,
          countryCode: org.countryCode,
          baseCurrency: org.baseCurrency,
        }
      });
    } catch (error) {
      console.error('Error testing Xero connection:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to test Xero connection' 
      });
    }
  });
  
  // Get Xero settings (account code and tax type)
  app.get('/api/xero/settings', async (req: Request, res: Response) => {
    try {
      const settings = await storage.getXeroSettings();
      
      if (!settings) {
        // Return defaults if no settings exist
        return res.json({
          success: true,
          data: {
            salesAccountCode: '200',
            taxType: 'OUTPUT2',
          }
        });
      }
      
      res.json({
        success: true,
        data: {
          salesAccountCode: settings.salesAccountCode,
          taxType: settings.taxType,
        }
      });
    } catch (error) {
      console.error('Error fetching Xero settings:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch Xero settings' 
      });
    }
  });
  
  // Update Xero settings (account code and tax type)
  app.put('/api/xero/settings', async (req: Request, res: Response) => {
    try {
      const { salesAccountCode, taxType } = req.body;
      
      if (!salesAccountCode || !taxType) {
        return res.status(400).json({
          success: false,
          message: 'Sales Account Code and Tax Type are required'
        });
      }
      
      const updated = await storage.updateXeroSettings({
        salesAccountCode,
        taxType,
      });
      
      res.json({
        success: true,
        data: {
          salesAccountCode: updated.salesAccountCode,
          taxType: updated.taxType,
        },
        message: 'Xero settings updated successfully'
      });
    } catch (error) {
      console.error('Error updating Xero settings:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update Xero settings' 
      });
    }
  });
}
