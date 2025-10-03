import { Router, Request, Response } from 'express';
import { XeroClient } from 'xero-node';
import type { IStorage } from './storage';

const router = Router();

// Initialize Xero client
// Get the base URL from environment or construct from Replit domain
const getRedirectUri = () => {
  if (process.env.XERO_REDIRECT_URI) {
    return process.env.XERO_REDIRECT_URI;
  }
  // For Replit environments
  if (process.env.REPLIT_DOMAINS) {
    const domain = process.env.REPLIT_DOMAINS.split(',')[0];
    return `https://${domain}/api/xero/callback`;
  }
  // Fallback to production domain
  return 'https://www.treemarkables.co.nz/api/xero/callback';
};

const xeroClient = new XeroClient({
  clientId: process.env.XERO_CLIENT_ID!,
  clientSecret: process.env.XERO_CLIENT_SECRET!,
  redirectUris: [getRedirectUri()],
  scopes: 'openid profile email offline_access accounting.transactions'.split(' '),
  httpTimeout: 3000,
});

export function registerXeroRoutes(app: any, storage: IStorage) {
  // Log the redirect URI being used
  const redirectUri = getRedirectUri();
  console.log('🔗 Xero OAuth Redirect URI:', redirectUri);
  
  // Endpoint to get redirect URI (for debugging)
  app.get('/api/xero/redirect-uri', (req: Request, res: Response) => {
    res.json({
      success: true,
      redirectUri,
      message: 'Add this redirect URI to your Xero app configuration'
    });
  });
  
  // Initiate Xero OAuth connection
  app.get('/api/xero/connect', async (req: Request, res: Response) => {
    try {
      console.log('🔐 Initiating Xero OAuth with redirect URI:', redirectUri);
      const consentUrl = await xeroClient.buildConsentUrl();
      console.log('✅ Consent URL generated:', consentUrl);
      res.redirect(consentUrl);
    } catch (error) {
      console.error('❌ Error initiating Xero connection:', error);
      res.status(500).json({ success: false, message: 'Failed to initiate Xero connection' });
    }
  });

  // OAuth callback handler
  app.get('/api/xero/callback', async (req: Request, res: Response) => {
    try {
      // Exchange authorization code for tokens
      const tokenSet = await xeroClient.apiCallback(req.url);
      
      // Set tokens on client
      await xeroClient.setTokenSet(tokenSet);
      
      // Get tenant information
      await xeroClient.updateTenants();
      const tenants = xeroClient.tenants;
      
      if (!tenants || tenants.length === 0) {
        return res.redirect('/?error=no_tenants');
      }
      
      // Use the first tenant (most users have only one organization)
      const tenant = tenants[0];
      
      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenSet.expires_in);
      
      // Check if connection already exists
      const existing = await storage.getXeroConnection(tenant.tenantId);
      
      if (existing) {
        // Update existing connection
        await storage.updateXeroConnection(tenant.tenantId, {
          tenantName: tenant.tenantName,
          accessToken: tokenSet.access_token,
          refreshToken: tokenSet.refresh_token,
          expiresAt,
          idToken: tokenSet.id_token || '',
          scope: tokenSet.scope,
          isActive: true,
          lastSyncedAt: new Date(),
        });
      } else {
        // Create new connection
        await storage.createXeroConnection({
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          accessToken: tokenSet.access_token,
          refreshToken: tokenSet.refresh_token,
          expiresAt,
          idToken: tokenSet.id_token || '',
          scope: tokenSet.scope,
          isActive: true,
          lastSyncedAt: new Date(),
        });
      }
      
      // Redirect to integrations page with success message
      res.redirect('/integrations?xero_connected=true');
    } catch (error) {
      console.error('Error in Xero callback:', error);
      res.redirect('/integrations?error=connection_failed');
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

  // Helper function to refresh token if needed
  async function getValidXeroClient(): Promise<{ client: XeroClient; tenantId: string } | null> {
    const connection = await storage.getActiveXeroConnection();
    
    if (!connection) {
      return null;
    }
    
    // Set existing tokens
    await xeroClient.setTokenSet({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      expires_in: Math.floor((new Date(connection.expiresAt).getTime() - Date.now()) / 1000),
      token_type: 'Bearer',
    });
    
    // Check if token needs refresh (refresh if expires in less than 5 minutes)
    const expiresIn = Math.floor((new Date(connection.expiresAt).getTime() - Date.now()) / 1000);
    
    if (expiresIn < 300) {
      // Refresh token
      const newTokenSet = await xeroClient.refreshToken();
      
      // Update in database
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + newTokenSet.expires_in);
      
      await storage.updateXeroConnection(connection.tenantId, {
        accessToken: newTokenSet.access_token,
        refreshToken: newTokenSet.refresh_token,
        expiresAt: newExpiresAt,
        lastSyncedAt: new Date(),
      });
    }
    
    return {
      client: xeroClient,
      tenantId: connection.tenantId,
    };
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
      
      // Get Xero client
      const xeroSetup = await getValidXeroClient();
      if (!xeroSetup) {
        return res.status(400).json({ 
          success: false, 
          message: 'Not connected to Xero. Please connect first.' 
        });
      }
      
      const { client, tenantId } = xeroSetup;
      
      // Get job from database
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ 
          success: false, 
          message: 'Job not found' 
        });
      }
      
      // Check if already synced
      if (job.xeroInvoiceId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invoice already synced to Xero',
          xeroInvoiceId: job.xeroInvoiceId 
        });
      }
      
      // Get customer
      const customer = await storage.getCustomer(job.customerId);
      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          message: 'Customer not found' 
        });
      }
      
      // Find or create contact in Xero
      let xeroContactId: string;
      
      try {
        // Search for existing contact by email
        const contactsResponse = await client.accountingApi.getContacts(
          tenantId,
          undefined, // modifiedAfter
          `EmailAddress="${customer.email}"`,
          undefined,
          1
        );
        
        if (contactsResponse.body.contacts && contactsResponse.body.contacts.length > 0) {
          xeroContactId = contactsResponse.body.contacts[0].contactID!;
        } else {
          // Create new contact
          const newContact = {
            name: customer.name,
            emailAddress: customer.email,
            phones: customer.phone ? [{
              phoneType: 'MOBILE' as const,
              phoneNumber: customer.phone,
            }] : [],
            addresses: customer.address ? [{
              addressType: 'STREET' as const,
              addressLine1: customer.address,
            }] : [],
          };
          
          const createResponse = await client.accountingApi.createContacts(
            tenantId,
            { contacts: [newContact] }
          );
          
          xeroContactId = createResponse.body.contacts![0].contactID!;
        }
      } catch (error) {
        console.error('Error with Xero contact:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to create/find contact in Xero' 
        });
      }
      
      // Map job line items to Xero format
      const lineItems = (job.lineItems as any[] || []).map((item: any) => ({
        description: item.description || 'Service',
        quantity: item.quantity || 1,
        unitAmount: item.unitPrice || item.priceExGst || 0,
        accountCode: '200', // Default revenue account
        taxType: item.priceIncludesTax ? 'NONE' : 'OUTPUT', // GST handling
      }));
      
      // If no line items, create a single line item from job total
      if (lineItems.length === 0 && job.subtotal) {
        lineItems.push({
          description: job.title || job.description || 'Tree removal service',
          quantity: 1,
          unitAmount: parseFloat(job.subtotal),
          accountCode: '200',
          taxType: 'OUTPUT',
        });
      }
      
      // Create invoice in Xero
      try {
        const invoiceDate = job.completedDate || new Date();
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms
        
        const xeroInvoice = {
          type: 'ACCREC' as const, // Accounts Receivable (sales invoice)
          contact: {
            contactID: xeroContactId,
          },
          lineItems,
          date: invoiceDate.toISOString().split('T')[0],
          dueDate: dueDate.toISOString().split('T')[0],
          reference: job.jobNumber,
          status: 'AUTHORISED' as const, // Approved and ready to send
          lineAmountTypes: 'Exclusive' as const, // Tax exclusive amounts
        };
        
        const invoiceResponse = await client.accountingApi.createInvoices(
          tenantId,
          { invoices: [xeroInvoice] }
        );
        
        const createdInvoice = invoiceResponse.body.invoices![0];
        const xeroInvoiceId = createdInvoice.invoiceID!;
        
        // Update job with Xero info
        await storage.updateJob(jobId, {
          xeroInvoiceId,
          xeroStatus: 'sent',
          sentToXeroDate: new Date(),
        });
        
        res.json({
          success: true,
          message: 'Invoice sent to Xero successfully',
          xeroInvoiceId,
          xeroInvoiceNumber: createdInvoice.invoiceNumber,
        });
      } catch (error: any) {
        console.error('Error creating invoice in Xero:', error);
        
        // Update job with error status
        await storage.updateJob(jobId, {
          xeroStatus: 'error',
        });
        
        const errorMessage = error.response?.body?.Elements?.[0]?.ValidationErrors?.[0]?.Message 
          || error.message 
          || 'Failed to create invoice in Xero';
        
        res.status(500).json({ 
          success: false, 
          message: errorMessage 
        });
      }
    } catch (error) {
      console.error('Error sending job invoice to Xero:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send invoice to Xero' 
      });
    }
  });
  
  // Send separate invoice record to Xero (for future use)
  app.post('/api/xero/send-invoice/:invoiceId', async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params;
      
      // Get Xero client
      const xeroSetup = await getValidXeroClient();
      if (!xeroSetup) {
        return res.status(400).json({ 
          success: false, 
          message: 'Not connected to Xero. Please connect first.' 
        });
      }
      
      const { client, tenantId } = xeroSetup;
      
      // Get invoice from database
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ 
          success: false, 
          message: 'Invoice not found' 
        });
      }
      
      // Check if already synced
      if (invoice.xeroInvoiceId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invoice already synced to Xero',
          xeroInvoiceId: invoice.xeroInvoiceId 
        });
      }
      
      // Get customer
      const customer = await storage.getCustomer(invoice.customerId);
      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          message: 'Customer not found' 
        });
      }
      
      // Find or create contact in Xero
      let xeroContactId: string;
      
      try {
        // Search for existing contact by name
        const contactsResponse = await client.accountingApi.getContacts(
          tenantId,
          undefined, // modifiedAfter
          `Name.Contains("${customer.name.replace(/"/g, '')}") OR Name.Contains("${customer.email.replace(/"/g, '')}") OR EmailAddress="${customer.email}"`,
          undefined,
          1
        );
        
        if (contactsResponse.body.contacts && contactsResponse.body.contacts.length > 0) {
          xeroContactId = contactsResponse.body.contacts[0].contactID!;
        } else {
          // Create new contact
          const newContact = {
            name: customer.name,
            emailAddress: customer.email,
            phones: customer.phone ? [{
              phoneType: 'MOBILE' as const,
              phoneNumber: customer.phone,
            }] : [],
            addresses: customer.address ? [{
              addressType: 'STREET' as const,
              addressLine1: customer.address,
            }] : [],
          };
          
          const createResponse = await client.accountingApi.createContacts(
            tenantId,
            { contacts: [newContact] }
          );
          
          xeroContactId = createResponse.body.contacts![0].contactID!;
        }
      } catch (error) {
        console.error('Error with Xero contact:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to create/find contact in Xero' 
        });
      }
      
      // Map invoice line items to Xero format
      const lineItems = (invoice.items as any[]).map((item: any) => ({
        description: item.description || 'Service',
        quantity: item.quantity || 1,
        unitAmount: item.rate || item.amount || 0,
        accountCode: '200', // Default revenue account - can be customized
        taxType: 'OUTPUT', // GST for New Zealand
      }));
      
      // Create invoice in Xero
      try {
        const xeroInvoice = {
          type: 'ACCREC' as const, // Accounts Receivable (sales invoice)
          contact: {
            contactID: xeroContactId,
          },
          lineItems,
          date: new Date(invoice.issueDate).toISOString().split('T')[0],
          dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
          reference: invoice.invoiceNumber,
          status: 'AUTHORISED' as const, // Approved and ready to send
          lineAmountTypes: 'Exclusive' as const, // Tax exclusive amounts
        };
        
        const invoiceResponse = await client.accountingApi.createInvoices(
          tenantId,
          { invoices: [xeroInvoice] }
        );
        
        const createdInvoice = invoiceResponse.body.invoices![0];
        const xeroInvoiceId = createdInvoice.invoiceID!;
        
        // Update local invoice with Xero ID
        await storage.updateInvoice(invoiceId, {
          xeroInvoiceId,
          xeroSyncedAt: new Date(),
        });
        
        res.json({
          success: true,
          message: 'Invoice sent to Xero successfully',
          xeroInvoiceId,
          xeroInvoiceNumber: createdInvoice.invoiceNumber,
        });
      } catch (error: any) {
        console.error('Error creating invoice in Xero:', error);
        const errorMessage = error.response?.body?.Elements?.[0]?.ValidationErrors?.[0]?.Message 
          || error.message 
          || 'Failed to create invoice in Xero';
        
        res.status(500).json({ 
          success: false, 
          message: errorMessage 
        });
      }
    } catch (error) {
      console.error('Error sending invoice to Xero:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send invoice to Xero' 
      });
    }
  });
  
  // Export the helper function for use in other routes
  app.locals.getValidXeroClient = getValidXeroClient;
}

export default router;
