import { Router, Request, Response } from 'express';
import { XeroClient } from 'xero-node';
import type { IStorage } from './storage';

const router = Router();

// Initialize Xero client
const xeroClient = new XeroClient({
  clientId: process.env.XERO_CLIENT_ID!,
  clientSecret: process.env.XERO_CLIENT_SECRET!,
  redirectUris: ['https://www.treemarkables.co.nz/api/xero/callback'],
  scopes: 'openid profile email accounting.settings accounting.transactions accounting.contacts offline_access'.split(' '),
  httpTimeout: 3000,
});

export function registerXeroRoutes(app: any, storage: IStorage) {
  // Initiate Xero OAuth connection
  app.get('/api/xero/connect', async (req: Request, res: Response) => {
    try {
      const consentUrl = await xeroClient.buildConsentUrl();
      res.redirect(consentUrl);
    } catch (error) {
      console.error('Error initiating Xero connection:', error);
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
  
  // Export the helper function for use in other routes
  app.locals.getValidXeroClient = getValidXeroClient;
}

export default router;
