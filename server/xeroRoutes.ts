import { Router, Request, Response } from 'express';
import { XeroClient, PayrollNzApi, Configuration, Invoice, Payment } from 'xero-node';
import type { IStorage } from './storage';
import { TimeTrackingService } from './timeTrackingService';

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

  // Force refresh token - useful after updating scopes in Xero Developer portal
  app.post('/api/xero/refresh-token', async (req: Request, res: Response) => {
    try {
      const connection = await storage.getActiveXeroConnection();
      
      if (!connection) {
        return res.status(400).json({ success: false, message: 'No active Xero connection' });
      }
      
      console.log('🔄 Force refreshing Xero access token to get updated scopes...');
      
      // Get a fresh token from Xero (this will have any updated scopes from Developer portal)
      const tokenSet = await xeroClient.getClientCredentialsToken();
      
      // Decode and log the new token's scopes for debugging
      try {
        const tokenPayload = JSON.parse(Buffer.from(tokenSet.access_token!.split('.')[1], 'base64').toString());
        console.log('✅ New token scopes:', tokenPayload.scope);
      } catch (e) {
        console.log('Could not decode token for scope check');
      }
      
      // Update in database
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (tokenSet.expires_in || 1800));
      
      await storage.updateXeroConnection(connection.tenantId, {
        accessToken: tokenSet.access_token!,
        expiresAt: newExpiresAt,
        scope: tokenSet.scope,
        lastSyncedAt: new Date(),
      });
      
      await xeroClient.setTokenSet(tokenSet);
      console.log('✅ Access token force refreshed successfully');
      
      // Return the scopes in the response so user can see what's available
      let scopes: string[] = [];
      try {
        const tokenPayload = JSON.parse(Buffer.from(tokenSet.access_token!.split('.')[1], 'base64').toString());
        scopes = tokenPayload.scope || [];
      } catch (e) {
        scopes = tokenSet.scope?.split(' ') || [];
      }
      
      const hasPayrollScopes = scopes.some(s => s.includes('payroll'));
      
      res.json({ 
        success: true, 
        message: hasPayrollScopes 
          ? 'Token refreshed with payroll scopes - payroll features now available!' 
          : 'Token refreshed but no payroll scopes found. Please add payroll.employees and payroll.timesheets scopes in Xero Developer portal.',
        scopes,
        hasPayrollScopes
      });
    } catch (error: any) {
      console.error('Error refreshing Xero token:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to refresh Xero token: ' + (error.message || 'Unknown error')
      });
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
        // Search for existing contact by name - escape special characters
        const escapedName = customer.name.replace(/"/g, '\\"');
        console.log(`🔍 Searching for Xero contact: "${escapedName}"`);
        
        let contactsResponse;
        try {
          contactsResponse = await client.accountingApi.getContacts(
            tenantId,
            undefined, // IDs
            `Name="${escapedName}"` // where filter
          );
        } catch (searchError: any) {
          // If search fails, try without the where filter and search manually
          console.log(`⚠️ Xero contact search failed, trying fallback approach...`);
          const allContactsResponse = await client.accountingApi.getContacts(tenantId);
          const matchingContact = allContactsResponse.body.contacts?.find(
            c => c.name?.toLowerCase() === customer.name.toLowerCase()
          );
          contactsResponse = { 
            body: { 
              contacts: matchingContact ? [matchingContact] : [] 
            } 
          };
        }
        
        if (contactsResponse.body.contacts && contactsResponse.body.contacts.length > 0) {
          xeroContactId = contactsResponse.body.contacts[0].contactID!;
          console.log(`✅ Found existing Xero contact: ${xeroContactId}`);
        } else {
          // Create new contact
          console.log(`📝 Creating new Xero contact for: ${customer.name}`);
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
          
          if (!createResponse.body.contacts?.[0]?.contactID) {
            console.error('❌ Xero contact creation returned no ID:', createResponse.body);
            throw new Error('Xero returned empty contact response');
          }
          
          xeroContactId = createResponse.body.contacts![0].contactID!;
          console.log(`✅ Created new Xero contact: ${xeroContactId}`);
        }
      } catch (error: any) {
        console.error('Error managing Xero contact:', error);
        const errorMessage = error?.response?.body?.Message || error?.message || 'Unknown error';
        const errorDetails = error?.response?.body?.Elements?.[0]?.ValidationErrors || [];
        console.error('Xero error details:', errorMessage, errorDetails);
        return res.status(500).json({ 
          success: false, 
          message: `Failed to create/find contact in Xero: ${errorMessage}`,
          details: errorDetails
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
            const qty = Number(item.quantity) || 1;
            const unitAmt = Number(item.rate || item.unitPrice) > 0
              ? Number(item.rate || item.unitPrice)
              : (Number(item.total || item.amount || item.totalPrice) || 0) / qty;
            invoiceLineItems.push({
              description: item.description || 'Tree Service',
              quantity: qty,
              unitAmount: unitAmt,
              accountCode,
              taxType,
            });
          }

          // Fallback: invoice exists with a total amount but no itemised lines
          // (happens when a job is invoiced directly without a proposal or line-by-line breakdown)
          if (invoiceLineItems.length === 0 && Number(invoice.amount) > 0) {
            console.log(`💡 No invoice line items found — using invoice.amount ($${invoice.amount}) as single Xero line item`);
            invoiceLineItems.push({
              description: invoice.description || job.title || 'Tree Service',
              quantity: 1,
              unitAmount: Number(invoice.amount),
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
              if (item.selected === false) continue;
              const qty = Number(item.quantity) || 1;
              // Use unitPrice if set, otherwise derive from totalPrice (lump-sum entries)
              const unitAmt = Number(item.unitPrice) > 0
                ? Number(item.unitPrice)
                : (Number(item.totalPrice) || 0) / qty;
              invoiceLineItems.push({
                description: item.description || 'Tree Service',
                quantity: qty,
                unitAmount: unitAmt,
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
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
          invoiceNumber: String(job.jobNumber || job.id), // Match invoice number to job number
          reference: `Job #${job.jobNumber || job.id}`,
          status: 'AUTHORISED' as any,
        };
        
        const invoiceResponse = await client.accountingApi.createInvoices(
          tenantId,
          { invoices: [xeroInvoicePayload] }
        );
        
        const xeroInvoice = invoiceResponse.body.invoices![0];
        console.log(`✅ Invoice created in Xero: ${xeroInvoice.invoiceID}`);
        
        // Capture confirmed totals from Xero response
        const confirmedSubtotal = xeroInvoice.subTotal !== undefined ? parseFloat(xeroInvoice.subTotal.toString()) : null;
        const confirmedTotal = xeroInvoice.total !== undefined ? parseFloat(xeroInvoice.total.toString()) : null;

        // Update job with Xero invoice ID, mark as completed, and write back confirmed amounts
        await storage.updateJob(jobId, {
          status: 'completed',
          completedDate: new Date(),
          xeroInvoiceId: xeroInvoice.invoiceID || undefined,
          xeroStatus: 'sent',
          sentToXeroDate: new Date(),
          ...(confirmedSubtotal !== null && confirmedSubtotal > 0 && {
            subtotal: confirmedSubtotal.toFixed(2),
            totalAmount: (confirmedTotal ?? confirmedSubtotal).toFixed(2),
          }),
        });
        
        // Update the invoice status to 'sent' and write back confirmed amount
        if (invoice) {
          await storage.updateInvoice(invoice.id, {
            status: 'sent',
            xeroInvoiceId: xeroInvoice.invoiceID || undefined,
            xeroSyncedAt: new Date(),
            ...(confirmedTotal !== null && confirmedTotal > 0 && {
              amount: confirmedTotal.toFixed(2),
            }),
          });
          console.log(`✅ Updated invoice ${invoice.invoiceNumber} status to 'sent', amount: $${confirmedTotal}`);
        }
        
        // Create diary entry for Xero send - prefer Xero's confirmed total, then local invoice amount
        const xeroTotal = xeroInvoice.total ?? xeroInvoice.subTotal;
        const invoiceTotal = xeroTotal !== undefined && xeroTotal !== null
          ? parseFloat(xeroTotal.toString()).toFixed(2)
          : invoice?.amount
            ? parseFloat(invoice.amount.toString()).toFixed(2)
            : (job.totalAmount || '0.00');
        await storage.createJobDiaryEntry({
          jobId,
          entryType: 'note',
          title: 'Invoice Sent to Xero',
          description: `Invoice #${xeroInvoice.invoiceNumber || xeroInvoice.invoiceID} sent to Xero successfully. Total: $${invoiceTotal}`,
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

        // xero-node v13 rejects either with { response, body } (object form)
        // or with JSON.stringify({response,body}) (string form, depending on
        // the SDK code path). Normalise both into a plain object so we can
        // extract the validation errors uniformly.
        let errObj: any = error;
        if (typeof error === 'string') {
          try { errObj = JSON.parse(error); } catch { errObj = { message: error }; }
        }
        const rawBody = errObj?.body ?? errObj?.response?.body;
        const xeroBody = typeof rawBody === 'string'
          ? (() => { try { return JSON.parse(rawBody); } catch { return null; } })()
          : rawBody;
        const elementErrors: string[] =
          xeroBody?.Elements?.flatMap((el: any) =>
            (el?.ValidationErrors ?? []).map((v: any) => v?.Message).filter(Boolean)
          ) ?? [];

        let errorMessage = 'Failed to create invoice in Xero';
        if (elementErrors.length > 0) {
          errorMessage = `Xero rejected the invoice: ${elementErrors.join('; ')}`;
        } else if (xeroBody?.Message) {
          errorMessage = `Xero error: ${xeroBody.Message}`;
        } else if (errObj?.message) {
          errorMessage = `Xero error: ${errObj.message}`;
        }

        const isDuplicateNumber = elementErrors.some(m => /unique/i.test(m));
        const suggestion = isDuplicateNumber
          ? `Xero won't accept invoice #${job.jobNumber} because that number is already in use in Xero (a previous invoice with the same number — even if voided or deleted — still reserves it). In Xero, find invoice #${job.jobNumber}, edit it, and change its invoice number (e.g. ${job.jobNumber}-V) to free up the number, then send again.`
          : 'If this error persists, please verify that the Account Code and Tax Type exist in your Xero organization. You can configure these in Settings > Xero Configuration.';

        res.status(500).json({
          success: false,
          message: errorMessage,
          errorCode: isDuplicateNumber ? 'DUPLICATE_INVOICE_NUMBER' : undefined,
          jobNumber: job.jobNumber,
          details: {
            accountCode,
            taxType,
            suggestion,
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

  app.post('/api/xero/reset-invoice-sync', async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.body;
      
      if (!invoiceId) {
        return res.status(400).json({ success: false, message: 'Invoice ID is required' });
      }
      
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }
      
      await storage.updateInvoice(invoiceId, {
        xeroInvoiceId: null as any,
        xeroSyncedAt: null as any,
        status: 'pending',
      });
      
      if (invoice.jobId) {
        await storage.updateJob(invoice.jobId, {
          xeroInvoiceId: null as any,
          xeroStatus: null as any,
          sentToXeroDate: null as any,
        });
      }
      
      console.log(`🔄 Reset Xero sync for invoice ${invoice.invoiceNumber} (job ${invoice.jobId})`);
      
      if (invoice.jobId) {
        await storage.createJobDiaryEntry({
          jobId: invoice.jobId,
          entryType: 'note',
          title: 'Xero Invoice Reset',
          description: `Invoice #${invoice.invoiceNumber} Xero sync was reset to allow re-sending (previous invoice voided in Xero)`,
          authorName: 'System',
          authorRole: 'system',
          metadata: { action: 'xero_sync_reset' }
        });
      }
      
      res.json({ success: true, message: 'Invoice sync reset. You can now re-send to Xero.' });
    } catch (error) {
      console.error('Error resetting invoice sync:', error);
      res.status(500).json({ success: false, message: 'Failed to reset invoice sync' });
    }
  });

  // Reset Xero sync by job ID — use this after voiding an invoice in Xero to re-enable sending
  app.post('/api/xero/reset-job-sync', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.body;
      if (!jobId) {
        return res.status(400).json({ success: false, message: 'jobId is required' });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      // Clear Xero fields on the job
      await storage.updateJob(jobId, {
        xeroInvoiceId: null as any,
        xeroStatus: null as any,
        sentToXeroDate: null as any,
      });

      // Also reset any linked local invoice records so they can be re-synced
      const linkedInvoices = await storage.getInvoicesByJob(jobId);
      for (const invoice of linkedInvoices) {
        await storage.updateInvoice(invoice.id, {
          xeroInvoiceId: null as any,
          xeroSyncedAt: null as any,
          status: 'pending',
        });
      }

      console.log(`🔄 Reset Xero sync for job ${job.jobNumber || jobId} (${linkedInvoices.length} invoice(s) reset)`);

      await storage.createJobDiaryEntry({
        jobId,
        entryType: 'note',
        title: 'Xero Sync Reset',
        description: `Xero invoice sync was reset to allow re-sending. Previous Xero invoice should be voided before re-sending.`,
        authorName: 'System',
        authorRole: 'system',
        metadata: { action: 'xero_sync_reset' }
      });

      res.json({ success: true, message: 'Xero sync reset. You can now re-send to Xero.' });
    } catch (error) {
      console.error('Error resetting job Xero sync:', error);
      res.status(500).json({ success: false, message: 'Failed to reset Xero sync' });
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

  // Get Profit & Loss report from Xero
  app.get('/api/xero/profit-loss', async (req: Request, res: Response) => {
    try {
      const { fromDate, toDate } = req.query;
      
      // Get active connection
      const connection = await storage.getActiveXeroConnection();
      if (!connection) {
        return res.status(401).json({
          success: false,
          message: 'No active Xero connection. Please connect to Xero first.'
        });
      }

      // Refresh token if needed
      const now = new Date();
      if (connection.expiresAt && new Date(connection.expiresAt) < now) {
        console.log('🔄 Refreshing Xero access token...');
        const tokenSet = await xeroClient.getClientCredentialsToken();
        await xeroClient.setTokenSet(tokenSet);
        
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + (tokenSet.expires_in || 1800));
        
        await storage.updateXeroConnection(connection.tenantId, {
          accessToken: tokenSet.access_token!,
          expiresAt,
        });
      } else {
        await xeroClient.setTokenSet({
          access_token: connection.accessToken,
          token_type: 'Bearer',
        });
      }

      // Get the tenant ID - for Custom Connections, get it from organisations
      const orgsResponse = await xeroClient.accountingApi.getOrganisations('');
      const tenantId = orgsResponse.body.organisations?.[0]?.organisationID;
      
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Could not find Xero organisation'
        });
      }

      // Build date params for P&L report
      const from = fromDate ? String(fromDate) : undefined;
      const to = toDate ? String(toDate) : undefined;

      // Fetch Profit & Loss report
      const reportResponse = await xeroClient.accountingApi.getReportProfitAndLoss(
        tenantId,
        from,  // fromDate
        to,    // toDate
        undefined, // periods
        undefined, // timeframe
        undefined, // trackingCategoryID
        undefined, // trackingCategoryID2
        undefined, // trackingOptionID
        undefined, // trackingOptionID2
        undefined  // standardLayout
      );

      const report = reportResponse.body.reports?.[0];
      
      if (!report) {
        return res.json({
          success: true,
          data: {
            revenue: 0,
            expenses: 0,
            netProfit: 0,
            sections: []
          }
        });
      }

      // Parse the P&L report rows
      let totalRevenue = 0;
      let totalExpenses = 0;
      let netProfit = 0;
      const sections: { name: string; amount: number; type: 'revenue' | 'expense' }[] = [];

      // Process report rows
      for (const row of report.rows || []) {
        if (row.rowType === 'Section') {
          const sectionTitle = row.title || '';
          let sectionTotal = 0;

          // Get section total from rows
          for (const subRow of row.rows || []) {
            if (subRow.rowType === 'SummaryRow' || subRow.rowType === 'Row') {
              const cells = subRow.cells || [];
              const amountCell = cells[cells.length - 1]; // Last cell is usually the amount
              const amount = parseFloat(amountCell?.value || '0');
              
              if (subRow.rowType === 'SummaryRow') {
                sectionTotal = amount;
              }
            }
          }

          // Categorize sections
          if (sectionTitle.toLowerCase().includes('income') || sectionTitle.toLowerCase().includes('revenue')) {
            totalRevenue += Math.abs(sectionTotal);
            if (sectionTotal !== 0) {
              sections.push({ name: sectionTitle, amount: Math.abs(sectionTotal), type: 'revenue' });
            }
          } else if (sectionTitle.toLowerCase().includes('expense') || sectionTitle.toLowerCase().includes('cost')) {
            totalExpenses += Math.abs(sectionTotal);
            if (sectionTotal !== 0) {
              sections.push({ name: sectionTitle, amount: Math.abs(sectionTotal), type: 'expense' });
            }
          }
        }
      }

      netProfit = totalRevenue - totalExpenses;

      res.json({
        success: true,
        data: {
          revenue: totalRevenue,
          expenses: totalExpenses,
          netProfit,
          grossMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0,
          sections,
          reportDate: report.reportDate,
          fromDate: from,
          toDate: to
        }
      });
    } catch (error: any) {
      console.error('Error fetching Xero P&L:', error);
      
      // Check for auth errors
      if (error.response?.statusCode === 401 || error.response?.statusCode === 403) {
        return res.status(401).json({
          success: false,
          message: 'Xero authentication expired. Please reconnect to Xero.'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch Profit & Loss report from Xero'
      });
    }
  });

  // ========================================
  // PAYROLL NZ - EMPLOYEE TIMESHEETS & HOURS
  // ========================================

  // Get employees from Xero Payroll NZ
  app.get('/api/xero/payroll/employees', async (req: Request, res: Response) => {
    try {
      const client = await getValidXeroClient();
      if (!client) {
        return res.status(400).json({ 
          success: false, 
          message: 'Not connected to Xero' 
        });
      }

      const connection = await storage.getActiveXeroConnection();
      if (!connection) {
        return res.status(400).json({ success: false, message: 'No active Xero connection' });
      }

      // Get tenants to find the correct tenant ID
      const tenants = await client.updateTenants();
      if (!tenants || tenants.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No Xero organizations found' 
        });
      }

      const tenantId = tenants[0].tenantId;

      // Use Payroll NZ API to get employees
      const employeesResponse = await client.payrollNZApi.getEmployees(tenantId);
      const employees = employeesResponse.body.employees || [];

      res.json({
        success: true,
        data: employees.map((emp: any) => ({
          employeeId: emp.employeeID,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          status: emp.status,
          payrollCalendarId: emp.payrollCalendarID,
        }))
      });
    } catch (error: any) {
      console.error('Error fetching Xero payroll employees:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch employees from Xero Payroll' 
      });
    }
  });

  // Get timesheets from Xero Payroll NZ for a date range
  app.get('/api/xero/payroll/timesheets', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, employeeId, status } = req.query;

      const client = await getValidXeroClient();
      if (!client) {
        return res.status(400).json({ 
          success: false, 
          message: 'Not connected to Xero' 
        });
      }

      const connection = await storage.getActiveXeroConnection();
      if (!connection) {
        return res.status(400).json({ success: false, message: 'No active Xero connection' });
      }

      // Get tenants
      const tenants = await client.updateTenants();
      if (!tenants || tenants.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No Xero organizations found' 
        });
      }

      const tenantId = tenants[0].tenantId;

      // Fetch timesheets with optional filters
      const filter = employeeId ? `employeeId==${employeeId}` : undefined;
      const timesheetsResponse = await client.payrollNZApi.getTimesheets(
        tenantId,
        1, // page
        filter,
        status as string || undefined,
        startDate as string || undefined,
        endDate as string || undefined
      );

      const timesheets = timesheetsResponse.body.timesheets || [];

      // Calculate total hours per employee
      const employeeHours: Record<string, { 
        employeeId: string;
        totalHours: number;
        timesheets: any[];
      }> = {};

      for (const ts of timesheets) {
        const empId = ts.employeeID;
        if (!employeeHours[empId]) {
          employeeHours[empId] = {
            employeeId: empId,
            totalHours: 0,
            timesheets: []
          };
        }

        // Sum hours from timesheet lines
        let timesheetHours = 0;
        if (ts.timesheetLines) {
          for (const line of ts.timesheetLines) {
            timesheetHours += line.numberOfUnits || 0;
          }
        }

        employeeHours[empId].totalHours += timesheetHours;
        employeeHours[empId].timesheets.push({
          timesheetId: ts.timesheetID,
          startDate: ts.startDate,
          endDate: ts.endDate,
          status: ts.status,
          hours: timesheetHours
        });
      }

      res.json({
        success: true,
        data: {
          timesheets: Object.values(employeeHours),
          totalTimesheets: timesheets.length,
          dateRange: {
            from: startDate || 'all',
            to: endDate || 'all'
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching Xero timesheets:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch timesheets from Xero Payroll' 
      });
    }
  });

  // Get staff work days and hours for the month - tracks days actually worked
  app.get('/api/xero/payroll/work-days', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required'
        });
      }

      const client = await getValidXeroClient();
      if (!client) {
        return res.status(400).json({ 
          success: false, 
          message: 'Not connected to Xero' 
        });
      }

      // Get tenants
      const tenants = await client.updateTenants();
      if (!tenants || tenants.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No Xero organizations found' 
        });
      }

      const tenantId = tenants[0].tenantId;

      // Fetch all employees
      const employeesResponse = await client.payrollNZApi.getEmployees(tenantId);
      const employees = employeesResponse.body.employees || [];

      // Fetch all timesheets for the period with pagination
      const allTimesheets: any[] = [];
      let page = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        const timesheetsResponse = await client.payrollNZApi.getTimesheets(
          tenantId,
          page,
          undefined,
          'Approved',
          startDate as string,
          endDate as string
        );

        const pageTimesheets = timesheetsResponse.body.timesheets || [];
        allTimesheets.push(...pageTimesheets);
        
        if (pageTimesheets.length === 0 || pageTimesheets.length < 100) {
          hasMorePages = false;
        } else {
          page++;
        }
      }

      // Calculate hours and unique days worked per employee
      const employeeWorkData: Record<string, { 
        hours: number; 
        daysWorked: Set<string>;
        dailyHours: Record<string, number>;
      }> = {};

      for (const ts of allTimesheets) {
        const empId = ts.employeeID;
        if (!employeeWorkData[empId]) {
          employeeWorkData[empId] = { 
            hours: 0, 
            daysWorked: new Set(),
            dailyHours: {}
          };
        }
        
        if (ts.timesheetLines) {
          for (const line of ts.timesheetLines) {
            const units = line.numberOfUnits || 0;
            employeeWorkData[empId].hours += units;
            
            // Track unique days from the timesheet line date
            if (line.date) {
              const dateStr = new Date(line.date).toISOString().split('T')[0];
              employeeWorkData[empId].daysWorked.add(dateStr);
              
              // Track hours per day
              if (!employeeWorkData[empId].dailyHours[dateStr]) {
                employeeWorkData[empId].dailyHours[dateStr] = 0;
              }
              employeeWorkData[empId].dailyHours[dateStr] += units;
            }
          }
        }
        
        // Also check timesheet start/end dates if no line dates
        if (ts.startDate && ts.endDate) {
          const start = new Date(ts.startDate);
          const end = new Date(ts.endDate);
          // Add each day in the range (for timesheets without line-level dates)
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            employeeWorkData[empId].daysWorked.add(d.toISOString().split('T')[0]);
          }
        }
      }

      // Calculate working days in the period (weekdays only)
      const periodStart = new Date(startDate as string);
      const periodEnd = new Date(endDate as string);
      let totalWeekdays = 0;
      for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
          totalWeekdays++;
        }
      }

      // Get only ACTIVE staff from our system
      const ourActiveEmployees = await storage.getActiveEmployees();
      
      // Build work days data only for employees that match our active staff
      const workDaysData = [];

      for (const emp of employees) {
        // Try to match Xero employee to our active staff by name
        const xeroFirstName = (emp.firstName || '').toLowerCase().trim();
        const xeroLastName = (emp.lastName || '').toLowerCase().trim();
        const xeroFullName = `${xeroFirstName} ${xeroLastName}`;
        
        const matchedStaff = ourActiveEmployees.find(s => {
          const staffFirstName = (s.firstName || '').toLowerCase().trim();
          const staffLastName = (s.lastName || '').toLowerCase().trim();
          const staffFullName = `${staffFirstName} ${staffLastName}`;
          
          if (staffFullName === xeroFullName) return true;
          if (staffFirstName === xeroFirstName && staffLastName === xeroLastName) return true;
          if (staffFirstName === xeroFirstName) return true;
          if (xeroFirstName.startsWith(staffFirstName) || staffFirstName.startsWith(xeroFirstName)) {
            if (xeroLastName === staffLastName) return true;
          }
          if (emp.email && s.email && emp.email.toLowerCase() === s.email.toLowerCase()) return true;
          return false;
        });
        
        // Only include if matched to an active staff member in our system
        if (!matchedStaff) continue;
        
        const data = employeeWorkData[emp.employeeID] || { 
          hours: 0, 
          daysWorked: new Set(),
          dailyHours: {}
        };
        
        const daysWorked = data.daysWorked.size;
        const totalHours = data.hours;
        const avgHoursPerDay = daysWorked > 0 ? totalHours / daysWorked : 0;
        const attendanceRate = totalWeekdays > 0 ? (daysWorked / totalWeekdays) * 100 : 0;

        workDaysData.push({
          employeeId: emp.employeeID,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          totalHours: Math.round(totalHours * 100) / 100,
          daysWorked: daysWorked,
          avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
          attendanceRate: Math.round(attendanceRate * 100) / 100
        });
      }

      // Calculate totals
      const totals = workDaysData.reduce((acc, emp) => ({
        totalHours: acc.totalHours + emp.totalHours,
        totalDaysWorked: acc.totalDaysWorked + emp.daysWorked
      }), { totalHours: 0, totalDaysWorked: 0 });

      const activeEmployeeCount = workDaysData.length;
      const avgDaysPerEmployee = activeEmployeeCount > 0 
        ? totals.totalDaysWorked / activeEmployeeCount 
        : 0;
      const avgAttendance = activeEmployeeCount > 0
        ? workDaysData.reduce((sum, emp) => sum + emp.attendanceRate, 0) / activeEmployeeCount
        : 0;

      res.json({
        success: true,
        data: {
          employees: workDaysData.sort((a, b) => b.daysWorked - a.daysWorked),
          totals: {
            totalHours: Math.round(totals.totalHours * 100) / 100,
            totalDaysWorked: totals.totalDaysWorked,
            avgDaysPerEmployee: Math.round(avgDaysPerEmployee * 100) / 100,
            avgAttendance: Math.round(avgAttendance * 100) / 100,
            workingDaysInPeriod: totalWeekdays,
            activeEmployeeCount: activeEmployeeCount
          },
          period: {
            from: startDate,
            to: endDate
          }
        }
      });
    } catch (error: any) {
      console.error('Error calculating work days:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to calculate work days from Xero' 
      });
    }
  });

  // Get payroll paid hours summary - compares billable hours vs paid hours
  app.get('/api/xero/payroll/efficiency', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required'
        });
      }

      const client = await getValidXeroClient();
      if (!client) {
        return res.status(400).json({ 
          success: false, 
          message: 'Not connected to Xero' 
        });
      }

      // Get tenants
      const tenants = await client.updateTenants();
      if (!tenants || tenants.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No Xero organizations found' 
        });
      }

      const tenantId = tenants[0].tenantId;

      // Fetch all employees
      const employeesResponse = await client.payrollNZApi.getEmployees(tenantId);
      const employees = employeesResponse.body.employees || [];

      // Fetch all timesheets for the period with pagination
      const allTimesheets: any[] = [];
      let page = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        const timesheetsResponse = await client.payrollNZApi.getTimesheets(
          tenantId,
          page,
          undefined,
          'Approved', // Only approved timesheets
          startDate as string,
          endDate as string
        );

        const pageTimesheets = timesheetsResponse.body.timesheets || [];
        allTimesheets.push(...pageTimesheets);
        
        // Check if there are more pages (NZ Payroll API returns empty array when no more)
        if (pageTimesheets.length === 0 || pageTimesheets.length < 100) {
          hasMorePages = false;
        } else {
          page++;
        }
      }

      console.log(`📊 Fetched ${allTimesheets.length} timesheets across ${page} page(s)`);

      // Calculate paid hours per employee from Xero
      const xeroPaidHours: Record<string, number> = {};
      for (const ts of allTimesheets) {
        const empId = ts.employeeID;
        if (!xeroPaidHours[empId]) {
          xeroPaidHours[empId] = 0;
        }
        if (ts.timesheetLines) {
          for (const line of ts.timesheetLines) {
            xeroPaidHours[empId] += line.numberOfUnits || 0;
          }
        }
      }

      // Get billable hours from our job time tracking system
      // Query only ACTIVE staff/employees from our system
      const ourActiveEmployees = await storage.getActiveEmployees();
      const timeTrackingService = new TimeTrackingService();
      
      // Build efficiency data only for employees that match our active staff
      const efficiencyData = [];

      for (const emp of employees) {
        const xeroHours = xeroPaidHours[emp.employeeID] || 0;
        
        // Try to match Xero employee to our active staff by name
        const xeroFirstName = (emp.firstName || '').toLowerCase().trim();
        const xeroLastName = (emp.lastName || '').toLowerCase().trim();
        const xeroFullName = `${xeroFirstName} ${xeroLastName}`;
        
        const matchedStaff = ourActiveEmployees.find(s => {
          // Use firstName and lastName from our employee table
          const staffFirstName = (s.firstName || '').toLowerCase().trim();
          const staffLastName = (s.lastName || '').toLowerCase().trim();
          const staffFullName = `${staffFirstName} ${staffLastName}`;
          
          // Exact full name match
          if (staffFullName === xeroFullName) return true;
          
          // First name + last name match (handles different ordering)
          if (staffFirstName === xeroFirstName && staffLastName === xeroLastName) return true;
          
          // First name only match (for common names like "Josh" vs "Joshua")
          if (staffFirstName === xeroFirstName) return true;
          
          // Partial first name match (Josh vs Joshua, Dan vs Daniel)
          if (xeroFirstName.startsWith(staffFirstName) || staffFirstName.startsWith(xeroFirstName)) {
            if (xeroLastName === staffLastName) return true;
          }
          
          // Check if Xero email matches staff email (if available)
          if (emp.email && s.email && emp.email.toLowerCase() === s.email.toLowerCase()) return true;
          
          return false;
        });
        
        // Only include if matched to an active staff member in our system
        if (!matchedStaff) continue;

        let billableHours = 0;
        if (matchedStaff) {
          // Get billable hours from our time tracking for this staff member
          const jobTimeEntries = await timeTrackingService.getJobTimeEntriesByEmployee(
            matchedStaff.id.toString(),
            startDate as string,
            endDate as string
          );
          billableHours = jobTimeEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
        }

        const efficiencyRate = xeroHours > 0 ? (billableHours / xeroHours) * 100 : 0;

        efficiencyData.push({
          employeeId: emp.employeeID,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          staffId: matchedStaff?.id || null,
          paidHours: xeroHours,
          billableHours: billableHours,
          nonBillableHours: Math.max(0, xeroHours - billableHours),
          efficiencyRate: Math.round(efficiencyRate * 100) / 100,
          status: emp.status
        });
      }

      // Calculate totals
      const totals = efficiencyData.reduce((acc, emp) => ({
        totalPaidHours: acc.totalPaidHours + emp.paidHours,
        totalBillableHours: acc.totalBillableHours + emp.billableHours,
        totalNonBillableHours: acc.totalNonBillableHours + emp.nonBillableHours
      }), { totalPaidHours: 0, totalBillableHours: 0, totalNonBillableHours: 0 });

      const overallEfficiency = totals.totalPaidHours > 0 
        ? (totals.totalBillableHours / totals.totalPaidHours) * 100 
        : 0;

      res.json({
        success: true,
        data: {
          employees: efficiencyData.sort((a, b) => b.efficiencyRate - a.efficiencyRate),
          totals: {
            ...totals,
            overallEfficiencyRate: Math.round(overallEfficiency * 100) / 100
          },
          period: {
            from: startDate,
            to: endDate
          }
        }
      });
    } catch (error: any) {
      console.error('Error calculating payroll efficiency:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to calculate payroll efficiency' 
      });
    }
  });

  // Sync payment status from Xero — checks real invoice status and updates local DB if paid
  // POST /api/xero/sync-payment-status { jobId } — single job
  // POST /api/xero/sync-payment-status { all: true } — bulk sync all jobs with a Xero invoice
  app.post('/api/xero/sync-payment-status', async (req: Request, res: Response) => {
    try {
      const { jobId, all } = req.body;

      const client = await getValidXeroClient();
      if (!client) {
        return res.status(400).json({ success: false, message: 'Not connected to Xero. Please connect first.' });
      }

      const connection = await storage.getActiveXeroConnection();
      const tenantId = connection!.tenantId;

      if (all) {
        // Bulk sync — find all jobs that have a Xero invoice ID and aren't already marked paid
        const allJobs = await storage.getJobs();
        const xeroJobs = allJobs.filter((j: any) => j.xeroInvoiceId && j.xeroStatus !== 'paid');
        let synced = 0;
        let nowPaid = 0;

        for (const job of xeroJobs) {
          try {
            const xeroResp = await client.accountingApi.getInvoice(tenantId, job.xeroInvoiceId!);
            const xeroInvoice = xeroResp.body.invoices?.[0];
            if (!xeroInvoice) continue;

            if (xeroInvoice.status === 'PAID') {
              const paidDate = xeroInvoice.fullyPaidOnDate ? new Date(xeroInvoice.fullyPaidOnDate) : new Date();
              await storage.updateJob(job.id, { xeroStatus: 'paid' });
              const invoices = await storage.getInvoicesByJob(job.id);
              for (const inv of invoices) {
                await storage.updateInvoice(inv.id, {
                  status: 'paid',
                  paidAt: paidDate,
                  paidNotes: 'Payment confirmed via Xero sync',
                });
              }
              nowPaid++;
            }
            synced++;
          } catch (err) {
            console.warn(`⚠️ Could not sync Xero status for job ${job.jobNumber}:`, err);
          }
        }

        console.log(`✅ Xero bulk payment sync: checked ${synced} invoices, ${nowPaid} newly marked paid`);
        return res.json({ success: true, synced, nowPaid });
      }

      // Single job sync
      if (!jobId) {
        return res.status(400).json({ success: false, message: 'jobId is required' });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      if (!job.xeroInvoiceId) {
        return res.json({ success: true, status: null, message: 'Job has no Xero invoice' });
      }

      const xeroResp = await client.accountingApi.getInvoice(tenantId, job.xeroInvoiceId);
      const xeroInvoice = xeroResp.body.invoices?.[0];

      if (!xeroInvoice) {
        return res.json({ success: true, status: null, message: 'Invoice not found in Xero' });
      }

      const xeroStatus = xeroInvoice.status; // DRAFT, SUBMITTED, AUTHORISED, PAID, VOIDED, DELETED

      if (xeroStatus === 'PAID') {
        const paidDate = xeroInvoice.fullyPaidOnDate ? new Date(xeroInvoice.fullyPaidOnDate) : new Date();
        await storage.updateJob(jobId, { xeroStatus: 'paid' });
        const invoices = await storage.getInvoicesByJob(jobId);
        for (const inv of invoices) {
          await storage.updateInvoice(inv.id, {
            status: 'paid',
            paidAt: paidDate,
            paidNotes: 'Payment confirmed via Xero sync',
          });
        }
        console.log(`✅ Job ${job.jobNumber} marked as PAID via Xero sync`);
        return res.json({ success: true, status: 'paid', paidAt: paidDate });
      }

      // Not yet paid — return current Xero status for info
      console.log(`ℹ️ Job ${job.jobNumber} Xero invoice status: ${xeroStatus}`);
      return res.json({ success: true, status: xeroStatus?.toLowerCase() || 'sent' });

    } catch (error: any) {
      console.error('Error syncing payment status from Xero:', error);
      res.status(500).json({ success: false, message: 'Failed to sync payment status from Xero' });
    }
  });

  // ============================================================
  // RECONCILIATION ENDPOINTS
  // ============================================================

  // Shared precheck: validates Xero connectivity and resolved bank account code.
  // Returns { client, tenantId, bankAccountCode } on success or sends an error response and returns null.
  async function reconciliationPrecheck(
    req: Request,
    res: Response,
    requireBankCode: boolean,
    bodyBankCode?: string,
  ): Promise<{ client: XeroClient; tenantId: string; bankAccountCode: string | null } | null> {
    const client = await getValidXeroClient();
    if (!client) {
      res.status(400).json({ success: false, message: 'Not connected to Xero. Please connect first.' });
      return null;
    }

    const connection = await storage.getXeroConnection('custom-connection');
    if (!connection) {
      res.status(400).json({ success: false, message: 'No active Xero connection found.' });
      return null;
    }

    let bankAccountCode: string | null = bodyBankCode ?? null;
    if (!bankAccountCode) {
      const settings = await storage.getBusinessSettings();
      bankAccountCode = settings?.xeroDefaultBankAccountCode ?? null;
    }

    if (requireBankCode && !bankAccountCode) {
      res.status(400).json({
        success: false,
        message: 'No bank account code configured. Set xeroDefaultBankAccountCode in Business Settings or pass bankAccountCode in the request body.',
      });
      return null;
    }

    return { client, tenantId: connection.tenantId, bankAccountCode };
  }

  // GET /api/reconciliation/xero-sales
  // Returns AUTHORISED ACCREC invoices from Xero for reconciliation matching
  app.get('/api/reconciliation/xero-sales', async (req: Request, res: Response) => {
    if (!req.session.employeeId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
      const pre = await reconciliationPrecheck(req, res, true);
      if (!pre) return;
      const { client, tenantId } = pre;

      const response = await client.accountingApi.getInvoices(
        tenantId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['AUTHORISED'],
      );

      const allInvoices: Invoice[] = response.body.invoices ?? [];
      const salesInvoices = allInvoices.filter(
        (inv) => inv.type === Invoice.TypeEnum.ACCREC,
      );

      const data = salesInvoices.map((inv) => ({
        invoiceId: inv.invoiceID ?? null,
        invoiceNumber: inv.invoiceNumber ?? null,
        reference: inv.reference ?? null,
        contactName: inv.contact?.name ?? null,
        amountDue: inv.amountDue != null ? Number(inv.amountDue) : null,
        subtotal: inv.subTotal != null ? Number(inv.subTotal) : null,
        total: inv.total != null ? Number(inv.total) : null,
        date: inv.date ?? null,
        dueDate: inv.dueDate ?? null,
        status: inv.status ?? null,
      }));

      return res.json({ success: true, data });
    } catch (error: unknown) {
      console.error('Error fetching Xero sales invoices:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch Xero invoices.' });
    }
  });

  // GET /api/reconciliation/vibe-jobs
  // Returns completed jobs with customer names for reconciliation matching.
  // Requires Xero connectivity and a configured bank account code so all
  // reconciliation endpoints fail consistently when the integration is not ready.
  app.get('/api/reconciliation/vibe-jobs', async (req: Request, res: Response) => {
    if (!req.session.employeeId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
      const pre = await reconciliationPrecheck(req, res, true);
      if (!pre) return;

      const jobs = await storage.getCompletedJobsWithCustomerNames();

      const data = jobs.map((job) => {
        // Prefer the job's own subtotal (exc GST). If it's null/zero but an
        // invoice exists for this job, back out the 15% NZ GST from the
        // invoice total to derive the exc-GST subtotal.
        let subtotal: number | null = job.subtotal != null ? Number(job.subtotal) : null;
        if ((subtotal == null || subtotal === 0) && job.invoiceAmountIncGst != null && job.invoiceAmountIncGst > 0) {
          subtotal = Math.round((job.invoiceAmountIncGst / 1.15) * 100) / 100;
        }

        return {
          jobId: job.id,
          jobNumber: job.jobNumber ?? null,
          customerName: job.customerName ?? null,
          title: job.title ?? null,
          address: job.address ?? null,
          subtotal,
          totalAmount: job.totalAmount != null ? Number(job.totalAmount) : null,
          scheduledDate: job.scheduledDate ? job.scheduledDate.toISOString() : null,
          completedDate: job.completedDate ? job.completedDate.toISOString() : null,
          status: job.status ?? null,
        };
      });

      return res.json({ success: true, data });
    } catch (error: unknown) {
      console.error('Error fetching completed jobs for reconciliation:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch completed jobs.' });
    }
  });

  // POST /api/reconciliation/commit
  // Creates Xero payments for each confirmed invoice–job match
  app.post('/api/reconciliation/commit', async (req: Request, res: Response) => {
    if (!req.session.employeeId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
      const body = req.body as {
        matches: Array<{ xeroInvoiceId: string; jobId: string; amount: number; bankAccountCode?: string }>;
        bankAccountCode?: string;
      };
      const { matches, bankAccountCode: bodyBankCode } = body;

      if (!Array.isArray(matches) || matches.length === 0) {
        return res.status(400).json({ success: false, message: 'matches array is required and must not be empty.' });
      }

      const pre = await reconciliationPrecheck(req, res, true, bodyBankCode);
      if (!pre) return;
      const { client, tenantId, bankAccountCode: resolvedBankCode } = pre;

      const today = new Date().toISOString().slice(0, 10);

      type MatchResult = { xeroInvoiceId: string; jobId: string; success: boolean; message: string; paymentId?: string };
      const results: MatchResult[] = [];

      for (const match of matches) {
        const perMatchBankCode = match.bankAccountCode ?? resolvedBankCode ?? '';
        const payment: Payment = {
          invoice: { invoiceID: match.xeroInvoiceId },
          account: { code: perMatchBankCode },
          amount: match.amount,
          date: today,
        };
        try {
          const paymentResponse = await client.accountingApi.createPayment(tenantId, payment);
          // xero-node wraps the response in a Payments object; extract the first record
          const created: Payment | undefined = (paymentResponse.body as { payments?: Payment[] }).payments?.[0];
          results.push({
            xeroInvoiceId: match.xeroInvoiceId,
            jobId: match.jobId,
            success: true,
            message: 'Payment created in Xero',
            paymentId: created?.paymentID,
          });
        } catch (matchErr: unknown) {
          const err = matchErr as { response?: { body?: { Elements?: Array<{ ValidationErrors?: Array<{ Message?: string }> }> } } } & Error;
          const errMsg = err?.response?.body?.Elements?.[0]?.ValidationErrors?.[0]?.Message ?? err?.message ?? 'Unknown error';
          results.push({ xeroInvoiceId: match.xeroInvoiceId, jobId: match.jobId, success: false, message: errMsg });
        }
      }

      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      return res.json({ success: failed === 0, summary: { succeeded, failed, total: results.length }, results });
    } catch (error: unknown) {
      console.error('Error committing reconciliation payments:', error);
      res.status(500).json({ success: false, message: 'Failed to commit reconciliation payments.' });
    }
  });
}
