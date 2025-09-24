import { Router } from 'express';
import { z } from 'zod';
import { ServiceM8AuthService, SERVICEM8_OAUTH_CONFIG } from '../services/servicem8-auth';
import type { IStorage } from '../storage';

const router = Router();

// ServiceM8 OAuth Configuration Schema
const ConfigureServiceM8Schema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client Secret is required'),
});

const CallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
});

export function createServiceM8Routes(storage: IStorage) {
  
  // ===================================
  // OAuth Configuration
  // ===================================
  
  /**
   * Configure ServiceM8 OAuth credentials
   * POST /api/servicem8/configure
   */
  router.post('/configure', async (req, res) => {
    try {
      const { clientId, clientSecret } = ConfigureServiceM8Schema.parse(req.body);
      
      // Encrypt and store credentials
      const encryptedCredentials = ServiceM8AuthService.encryptCredentials({
        clientSecret,
      });

      // Check if config already exists
      const existingConfig = await storage.getServicem8Config();
      
      if (existingConfig) {
        // Update existing configuration
        const updatedConfig = await storage.updateServicem8Config(existingConfig.id, {
          clientId,
          clientSecretEncrypted: encryptedCredentials.clientSecretEncrypted,
          encryptionKeyId: encryptedCredentials.encryptionKeyId,
          updatedAt: new Date(),
        });

        res.json({
          success: true,
          message: 'ServiceM8 configuration updated successfully',
          data: {
            clientId: updatedConfig.clientId,
            configured: true,
            lastSync: updatedConfig.lastSyncAt,
          },
        });
      } else {
        // Create new configuration
        const newConfig = await storage.createServicem8Config({
          clientId,
          clientSecretEncrypted: encryptedCredentials.clientSecretEncrypted,
          encryptionKeyId: encryptedCredentials.encryptionKeyId,
        });

        res.json({
          success: true,
          message: 'ServiceM8 configuration created successfully',
          data: {
            clientId: newConfig.clientId,
            configured: true,
            lastSync: null,
          },
        });
      }
    } catch (error) {
      console.error('ServiceM8 configuration error:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid configuration data',
          errors: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to configure ServiceM8 integration',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

  /**
   * Get ServiceM8 configuration status
   * GET /api/servicem8/config
   */
  router.get('/config', async (req, res) => {
    try {
      const config = await storage.getServicem8Config();
      
      if (!config) {
        res.json({
          success: true,
          data: {
            configured: false,
            connected: false,
            message: 'ServiceM8 not configured',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          configured: true,
          connected: !!config.accessTokenEncrypted,
          clientId: config.clientId,
          lastSync: config.lastSyncAt,
          syncEnabled: config.syncEnabled,
          accountInfo: config.accountInfo,
        },
      });
    } catch (error) {
      console.error('ServiceM8 config retrieval error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve ServiceM8 configuration',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ===================================
  // OAuth Authorization Flow
  // ===================================

  /**
   * Start OAuth authorization flow
   * GET /api/servicem8/auth/start
   */
  router.get('/auth/start', async (req, res) => {
    try {
      const config = await storage.getServicem8Config();
      
      if (!config) {
        res.status(400).json({
          success: false,
          message: 'ServiceM8 not configured. Please configure your OAuth credentials first.',
        });
        return;
      }

      // Decrypt credentials
      const credentials = ServiceM8AuthService.decryptCredentials({
        clientSecretEncrypted: config.clientSecretEncrypted,
        encryptionKeyId: config.encryptionKeyId,
      });

      const authService = new ServiceM8AuthService({
        clientId: config.clientId,
        clientSecret: credentials.clientSecret,
      });

      const userId = req.query.userId as string || undefined; // Optional user context
      const { authUrl, state } = authService.generateAuthUrl(userId);

      res.json({
        success: true,
        data: {
          authUrl,
          state, // Return state to client for tracking
          message: 'Click the authorization URL to connect to ServiceM8',
        },
      });
    } catch (error) {
      console.error('ServiceM8 auth start error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start ServiceM8 authorization',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Handle OAuth callback
   * POST /api/servicem8/auth/callback
   */
  router.post('/auth/callback', async (req, res) => {
    try {
      const { code, state } = CallbackSchema.parse(req.body);
      
      // Validate state parameter for CSRF protection
      if (!state || !ServiceM8AuthService.validateOAuthState(state)) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OAuth state parameter. Please restart the authorization process.',
        });
        return;
      }
      
      const config = await storage.getServicem8Config();
      if (!config) {
        res.status(400).json({
          success: false,
          message: 'ServiceM8 not configured',
        });
        return;
      }

      // Decrypt credentials
      const credentials = ServiceM8AuthService.decryptCredentials({
        clientSecretEncrypted: config.clientSecretEncrypted,
        encryptionKeyId: config.encryptionKeyId,
      });

      const authService = new ServiceM8AuthService({
        clientId: config.clientId,
        clientSecret: credentials.clientSecret,
      });

      // Exchange code for tokens
      const tokenResponse = await authService.exchangeCodeForToken(code);
      
      // Test the connection
      const connectionTest = await authService.testConnection(tokenResponse.accessToken);
      
      if (!connectionTest.success) {
        res.status(400).json({
          success: false,
          message: 'Failed to connect to ServiceM8 API',
          error: connectionTest.error,
        });
        return;
      }

      // Encrypt and store tokens
      const encryptedTokens = ServiceM8AuthService.encryptCredentials({
        clientSecret: credentials.clientSecret,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
      });

      // Update configuration with tokens
      await storage.updateServicem8Config(config.id, {
        accessTokenEncrypted: encryptedTokens.accessTokenEncrypted,
        refreshTokenEncrypted: encryptedTokens.refreshTokenEncrypted,
        tokenExpiresAt: tokenResponse.expiresAt,
        accountInfo: connectionTest.accountInfo,
        lastSyncAt: new Date(),
        syncEnabled: true,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        message: 'Successfully connected to ServiceM8!',
        data: {
          connected: true,
          expiresAt: tokenResponse.expiresAt,
          accountInfo: connectionTest.accountInfo,
        },
      });
    } catch (error) {
      console.error('ServiceM8 callback error:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid callback parameters',
          errors: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to process ServiceM8 authorization',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

  /**
   * Test ServiceM8 connection
   * POST /api/servicem8/test-connection
   */
  router.post('/test-connection', async (req, res) => {
    try {
      const config = await storage.getServicem8Config();
      
      if (!config || !config.accessTokenEncrypted) {
        res.status(400).json({
          success: false,
          message: 'ServiceM8 not connected. Please complete OAuth authorization first.',
        });
        return;
      }

      // Decrypt credentials
      const credentials = ServiceM8AuthService.decryptCredentials({
        clientSecretEncrypted: config.clientSecretEncrypted,
        accessTokenEncrypted: config.accessTokenEncrypted,
        refreshTokenEncrypted: config.refreshTokenEncrypted,
        encryptionKeyId: config.encryptionKeyId,
      });

      const authService = new ServiceM8AuthService({
        clientId: config.clientId,
        clientSecret: credentials.clientSecret,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: config.tokenExpiresAt || undefined,
      });

      // Check if token needs refresh
      if (config.tokenExpiresAt && ServiceM8AuthService.needsTokenRefresh(config.tokenExpiresAt)) {
        const refreshResponse = await authService.refreshAccessToken(credentials.refreshToken!);
        
        // Update tokens in storage
        const encryptedTokens = ServiceM8AuthService.encryptCredentials({
          clientSecret: credentials.clientSecret,
          accessToken: refreshResponse.accessToken,
          refreshToken: refreshResponse.refreshToken,
        });

        await storage.updateServicem8Config(config.id, {
          accessTokenEncrypted: encryptedTokens.accessTokenEncrypted,
          refreshTokenEncrypted: encryptedTokens.refreshTokenEncrypted,
          tokenExpiresAt: refreshResponse.expiresAt,
          updatedAt: new Date(),
        });

        credentials.accessToken = refreshResponse.accessToken;
      }

      // Test connection
      const connectionTest = await authService.testConnection(credentials.accessToken!);

      if (connectionTest.success) {
        // Update last sync time
        await storage.updateServicem8Config(config.id, {
          lastSyncAt: new Date(),
          accountInfo: connectionTest.accountInfo,
          updatedAt: new Date(),
        });

        res.json({
          success: true,
          message: 'ServiceM8 connection successful',
          data: connectionTest.accountInfo,
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'ServiceM8 connection failed',
          error: connectionTest.error,
        });
      }
    } catch (error) {
      console.error('ServiceM8 connection test error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test ServiceM8 connection',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Disconnect ServiceM8
   * DELETE /api/servicem8/disconnect
   */
  router.delete('/disconnect', async (req, res) => {
    try {
      const config = await storage.getServicem8Config();
      
      if (!config) {
        res.status(404).json({
          success: false,
          message: 'ServiceM8 not configured',
        });
        return;
      }

      // Update config to remove tokens
      await storage.updateServicem8Config(config.id, {
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        tokenExpiresAt: null,
        syncEnabled: false,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        message: 'ServiceM8 disconnected successfully',
        data: {
          connected: false,
          syncEnabled: false,
        },
      });
    } catch (error) {
      console.error('ServiceM8 disconnect error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect ServiceM8',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get OAuth configuration info
   * GET /api/servicem8/oauth-info
   */
  router.get('/oauth-info', (req, res) => {
    res.json({
      success: true,
      data: {
        authUrl: SERVICEM8_OAUTH_CONFIG.authUrl,
        scopes: SERVICEM8_OAUTH_CONFIG.scopes,
        redirectUri: SERVICEM8_OAUTH_CONFIG.redirectUri,
        apiUrl: SERVICEM8_OAUTH_CONFIG.apiUrl,
      },
    });
  });

  return router;
}

export { router as servicem8Router };