import crypto from 'crypto';
import { z } from 'zod';

// ServiceM8 OAuth Configuration
const SERVICEM8_OAUTH_CONFIG = {
  baseUrl: 'https://api.servicem8.com',
  authUrl: 'https://api.servicem8.com/oauth/authorize',
  tokenUrl: 'https://api.servicem8.com/oauth/access_token',
  apiUrl: 'https://api.servicem8.com/api_1.0',
  scopes: ['read_jobs', 'read_companies', 'read_quotes', 'read_materials', 'read_notes'],
  redirectUri: process.env.SERVICEM8_REDIRECT_URI || `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/api/servicem8/callback`,
} as const;

// Encryption service for OAuth credentials
class CredentialEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;

  // Generate encryption key from environment variable - REQUIRED
  private static getEncryptionKey(): Buffer {
    const key = process.env.SERVICEM8_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('SERVICEM8_ENCRYPTION_KEY environment variable is required for secure credential storage');
    }
    if (key.length < 32) {
      throw new Error('SERVICEM8_ENCRYPTION_KEY must be at least 32 characters long');
    }
    return crypto.scryptSync(key, 'servicem8-salt', this.KEY_LENGTH);
  }

  static encrypt(text: string): { encrypted: string; keyId: string } {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: IV (24 chars) + AuthTag (32 chars) + EncryptedData
    const result = iv.toString('hex') + authTag.toString('hex') + encrypted;
    
    return {
      encrypted: result,
      keyId: crypto.createHash('sha256').update(key).digest('hex').substring(0, 8), // Key fingerprint
    };
  }

  static decrypt(encryptedData: string, keyId: string): string {
    try {
      const key = this.getEncryptionKey();
      
      // Verify key fingerprint
      const expectedKeyId = crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
      if (keyId !== expectedKeyId) {
        throw new Error('Encryption key mismatch - cannot decrypt with current key');
      }
      
      // Extract IV (12 bytes = 24 hex chars), auth tag (16 bytes = 32 hex chars), and encrypted data
      const iv = Buffer.from(encryptedData.slice(0, this.IV_LENGTH * 2), 'hex');
      const authTag = Buffer.from(encryptedData.slice(this.IV_LENGTH * 2, (this.IV_LENGTH + this.TAG_LENGTH) * 2), 'hex');
      const encrypted = encryptedData.slice((this.IV_LENGTH + this.TAG_LENGTH) * 2);
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt credential data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// OAuth token validation schemas
const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
  scope: z.string(),
});

const RefreshTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  token_type: z.string(),
});

export interface ServiceM8Credentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface ServiceM8TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

// OAuth state management for CSRF protection
class OAuthStateManager {
  private static states = new Map<string, { createdAt: Date; userId?: string }>();
  private static readonly STATE_EXPIRY_MINUTES = 10;

  static generateState(userId?: string): string {
    const state = crypto.randomBytes(32).toString('hex');
    this.states.set(state, {
      createdAt: new Date(),
      userId,
    });
    
    // Clean up expired states
    this.cleanupExpiredStates();
    
    return state;
  }

  static validateState(state: string, userId?: string): boolean {
    const stateData = this.states.get(state);
    if (!stateData) {
      return false;
    }

    // Check if state has expired
    const expiryTime = new Date(stateData.createdAt.getTime() + (this.STATE_EXPIRY_MINUTES * 60 * 1000));
    if (new Date() > expiryTime) {
      this.states.delete(state);
      return false;
    }

    // Check if user ID matches (if provided)
    if (userId && stateData.userId && stateData.userId !== userId) {
      return false;
    }

    // Remove state after successful validation (one-time use)
    this.states.delete(state);
    return true;
  }

  private static cleanupExpiredStates(): void {
    const now = new Date();
    const expiryTime = this.STATE_EXPIRY_MINUTES * 60 * 1000;
    
    for (const [state, data] of this.states.entries()) {
      if (now.getTime() - data.createdAt.getTime() > expiryTime) {
        this.states.delete(state);
      }
    }
  }
}

export class ServiceM8AuthService {
  private credentials: ServiceM8Credentials | null = null;

  constructor(credentials?: ServiceM8Credentials) {
    this.credentials = credentials || null;
  }

  /**
   * Generate OAuth authorization URL for ServiceM8
   */
  generateAuthUrl(userId?: string): { authUrl: string; state: string } {
    if (!this.credentials?.clientId) {
      throw new Error('ServiceM8 client ID not configured');
    }

    const state = OAuthStateManager.generateState(userId);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.credentials.clientId,
      redirect_uri: SERVICEM8_OAUTH_CONFIG.redirectUri,
      scope: SERVICEM8_OAUTH_CONFIG.scopes.join(' '),
      state,
    });

    return {
      authUrl: `${SERVICEM8_OAUTH_CONFIG.authUrl}?${params.toString()}`,
      state,
    };
  }

  /**
   * Validate OAuth state parameter for CSRF protection
   */
  static validateOAuthState(state: string, userId?: string): boolean {
    return OAuthStateManager.validateState(state, userId);
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<ServiceM8TokenResponse> {
    if (!this.credentials?.clientId || !this.credentials?.clientSecret) {
      throw new Error('ServiceM8 credentials not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SERVICEM8_OAUTH_CONFIG.redirectUri,
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
    });

    try {
      const response = await fetch(SERVICEM8_OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Treemarkables-Dispatch/1.0',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ServiceM8 token exchange failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const tokenData = TokenResponseSchema.parse(data);

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        scope: tokenData.scope,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid token response from ServiceM8: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<ServiceM8TokenResponse> {
    if (!this.credentials?.clientId || !this.credentials?.clientSecret) {
      throw new Error('ServiceM8 credentials not configured');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
    });

    try {
      const response = await fetch(SERVICEM8_OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Treemarkables-Dispatch/1.0',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ServiceM8 token refresh failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const tokenData = RefreshTokenResponseSchema.parse(data);

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken, // Use existing if not provided
        expiresAt,
        scope: 'read_jobs read_companies read_quotes read_materials read_notes', // Default scope
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid refresh token response from ServiceM8: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Test API connection with current credentials
   */
  async testConnection(accessToken: string): Promise<{ success: boolean; accountInfo?: any; error?: string }> {
    try {
      const response = await fetch(`${SERVICEM8_OAUTH_CONFIG.apiUrl}/company.json?$limit=1`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Treemarkables-Dispatch/1.0',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `ServiceM8 API test failed: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        accountInfo: {
          connectionTested: true,
          apiVersion: '1.0',
          timestamp: new Date().toISOString(),
          firstCompany: data[0] || null,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `ServiceM8 API connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Encrypt credentials for secure storage
   */
  static encryptCredentials(credentials: {
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
  }): {
    clientSecretEncrypted: string;
    accessTokenEncrypted?: string;
    refreshTokenEncrypted?: string;
    encryptionKeyId: string;
  } {
    const clientSecretData = CredentialEncryption.encrypt(credentials.clientSecret);
    const result = {
      clientSecretEncrypted: clientSecretData.encrypted,
      encryptionKeyId: clientSecretData.keyId,
      accessTokenEncrypted: undefined as string | undefined,
      refreshTokenEncrypted: undefined as string | undefined,
    };

    if (credentials.accessToken) {
      const accessTokenData = CredentialEncryption.encrypt(credentials.accessToken);
      result.accessTokenEncrypted = accessTokenData.encrypted;
    }

    if (credentials.refreshToken) {
      const refreshTokenData = CredentialEncryption.encrypt(credentials.refreshToken);
      result.refreshTokenEncrypted = refreshTokenData.encrypted;
    }

    return result;
  }

  /**
   * Decrypt credentials from secure storage
   */
  static decryptCredentials(encryptedData: {
    clientSecretEncrypted: string;
    accessTokenEncrypted?: string | null;
    refreshTokenEncrypted?: string | null;
    encryptionKeyId: string;
  }): {
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
  } {
    const result = {
      clientSecret: CredentialEncryption.decrypt(encryptedData.clientSecretEncrypted, encryptedData.encryptionKeyId),
      accessToken: undefined as string | undefined,
      refreshToken: undefined as string | undefined,
    };

    if (encryptedData.accessTokenEncrypted) {
      result.accessToken = CredentialEncryption.decrypt(encryptedData.accessTokenEncrypted, encryptedData.encryptionKeyId);
    }

    if (encryptedData.refreshTokenEncrypted) {
      result.refreshToken = CredentialEncryption.decrypt(encryptedData.refreshTokenEncrypted, encryptedData.encryptionKeyId);
    }

    return result;
  }

  /**
   * Check if access token needs refreshing (expires within 5 minutes)
   */
  static needsTokenRefresh(expiresAt: Date): boolean {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    return expiresAt <= fiveMinutesFromNow;
  }
}

export { SERVICEM8_OAUTH_CONFIG };