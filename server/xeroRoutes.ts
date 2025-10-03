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
      const { jobId } = req.body;
      
      if (!jobId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Job ID is required' 
        });
      }
      
      // Get Xero client with valid token
      const client = await getValidXeroClient();
      if (!client) {
        return res.status(400).json({ 
          success: false, 
          message: 'Not connected to Xero. Please connect first.' 
        });
      }
      
      // Get job details
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ 
          success: false, 
          message: 'Job not found' 
        });
      }
      
      // Get customer details
      if (!job.customerId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Job has no customer assigned' 
        });
      }
      
      const customer = await storage.getCustomer(job.customerId);
      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          message: 'Customer not found' 
        });
      }
      
      console.log(`📤 Sending invoice to Xero for job ${job.id} (${job.title})`);
      
      // For Custom Connections, we use the tenant ID from the connection
      const connection = await storage.getActiveXeroConnection();
      const tenantId = connection!.tenantId;
      
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
      
      // Step 2: Create invoice in Xero
      try {
        // Convert job line items to Xero format
        const jobLineItems = job.lineItems || [];
        
        if (jobLineItems.length === 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'Job must have at least one line item to create an invoice' 
          });
        }
        
        const lineItems = jobLineItems.map((item: any) => ({
          description: item.description || 'Tree Service',
          quantity: item.quantity || 1,
          unitAmount: parseFloat(item.unitPrice || item.total || 0),
          accountCode: '200', // Sales account - adjust as needed
          taxType: 'OUTPUT2', // 15% GST for NZ - adjust based on your tax setup
        }));
        
        const invoice = {
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
          { invoices: [invoice] }
        );
        
        const xeroInvoice = invoiceResponse.body.invoices![0];
        console.log(`✅ Invoice created in Xero: ${xeroInvoice.invoiceID}`);
        
        // Update job with Xero invoice ID
        await storage.updateJob(jobId, {
          xeroInvoiceId: xeroInvoice.invoiceID || undefined,
          xeroStatus: 'sent',
          sentToXeroDate: new Date(),
        });
        
        // Create diary entry for Xero send
        await storage.createJobDiary({
          jobId,
          type: 'note',
          content: `Invoice #${xeroInvoice.invoiceNumber || xeroInvoice.invoiceID} sent to Xero successfully. Total: $${job.totalAmount || '0.00'}`,
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
      } catch (error) {
        console.error('Error creating Xero invoice:', error);
        
        // Update job with error status
        await storage.updateJob(jobId, {
          xeroStatus: 'error',
          sentToXeroDate: new Date(),
        });
        
        res.status(500).json({ 
          success: false, 
          message: 'Failed to create invoice in Xero' 
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
}
