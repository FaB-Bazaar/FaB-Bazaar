/**
 * MongoDB implementation of OAuth Flow Service
 *
 * SECURITY-CRITICAL: This service handles OAuth 2.1 protocol flows including:
 * - Authorization code generation and validation (single-use, time-limited)
 * - PKCE validation (SHA-256)
 * - Token generation (JWT)
 * - Client credentials grant
 * - Refresh token grant
 * - Dynamic client registration
 *
 * Added 2026-01-15 for database-agnostic OAuth flow migration
 */

import connectToDatabase from '@/lib/mongodb';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type {
  IOAuthFlowService,
  OAuthClientDTO,
  AuthorizationCodeDTO,
  TokenResponseDTO,
  CreateAuthCodeInput,
  ExchangeAuthCodeInput,
  RegisterClientInput,
  RegisterClientResultDTO,
} from '../../contracts/IOAuthFlowService';
import type { AsyncResult } from '../../contracts/common';

const JWT_SECRET = process.env.JWT_SECRET!;

export class MongoOAuthFlowService implements IOAuthFlowService {
  /**
   * Ensure database connection
   */
  private async getDb() {
    const { db } = await connectToDatabase();
    return db;
  }

  // ========================================
  // Client Validation
  // ========================================

  /**
   * Validate OAuth client
   */
  async validateClient(
    clientId: string,
    redirectUri?: string,
    clientSecret?: string
  ): AsyncResult<OAuthClientDTO> {
    try {
      const db = await this.getDb();

      const client = await db.collection('oauth_clients').findOne({ client_id: clientId });

      if (!client) {
        return { success: false, error: 'Client not found' };
      }

      // Validate client secret for confidential clients
      if (clientSecret !== undefined) {
        if (client.token_endpoint_auth_method !== 'none' && client.client_secret !== clientSecret) {
          return { success: false, error: 'Invalid client credentials' };
        }
      }

      // Validate redirect URI if provided
      if (redirectUri) {
        if (client.redirect_uris.length > 0 && !client.redirect_uris.includes(redirectUri)) {
          return { success: false, error: 'Invalid redirect_uri' };
        }
      }

      return {
        success: true,
        data: {
          client_id: client.client_id,
          client_secret: client.client_secret,
          client_name: client.client_name,
          client_uri: client.client_uri,
          redirect_uris: client.redirect_uris,
          grant_types: client.grant_types,
          response_types: client.response_types,
          token_endpoint_auth_method: client.token_endpoint_auth_method,
          scope: client.scope,
          user_id: client.user_id?.toString(),
          username: client.username,
          created_at: client.created_at,
          client_id_issued_at: client.client_id_issued_at,
          last_used: client.last_used,
        },
      };
    } catch (error) {
      console.error('[MongoOAuthFlowService] validateClient error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate client',
      };
    }
  }

  /**
   * Update client last_used timestamp
   */
  async updateClientLastUsed(clientId: string): AsyncResult<void> {
    try {
      const db = await this.getDb();

      await db.collection('oauth_clients').updateOne(
        { client_id: clientId },
        { $set: { last_used: new Date() } }
      );

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[MongoOAuthFlowService] updateClientLastUsed error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update client',
      };
    }
  }

  // ========================================
  // Authorization Code Flow
  // ========================================

  /**
   * Create authorization code
   */
  async createAuthorizationCode(
    input: CreateAuthCodeInput
  ): AsyncResult<{ code: string; expiresAt: Date }> {
    try {
      const db = await this.getDb();

      // Generate cryptographically secure authorization code
      const authCode = `auth_${crypto.randomBytes(32).toString('base64url')}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const authCodeData = {
        code: authCode,
        client_id: input.clientId,
        user_id: input.userId,
        redirect_uri: input.redirectUri,
        scope: input.scope,
        code_challenge: input.codeChallenge,
        code_challenge_method: input.codeChallengeMethod,
        expires_at: expiresAt,
        used: false,
        created_at: new Date(),
      };

      await db.collection('oauth_authorization_codes').insertOne(authCodeData);

      return {
        success: true,
        data: { code: authCode, expiresAt },
      };
    } catch (error) {
      console.error('[MongoOAuthFlowService] createAuthorizationCode error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create authorization code',
      };
    }
  }

  /**
   * Exchange authorization code for tokens
   * SECURITY CRITICAL: Atomic code consumption, PKCE validation, expiration check
   */
  async exchangeAuthorizationCode(
    input: ExchangeAuthCodeInput
  ): AsyncResult<TokenResponseDTO> {
    try {
      const db = await this.getDb();

      // Validate client first
      const clientResult = await this.validateClient(input.clientId, input.redirectUri, input.clientSecret);
      if (!clientResult.success) {
        return { success: false, error: clientResult.error };
      }

      // SECURITY: Atomic fetch-and-mark-as-used to prevent reuse
      const authCode = await db.collection('oauth_authorization_codes').findOneAndUpdate(
        {
          code: input.code,
          client_id: input.clientId,
          used: false,
        },
        {
          $set: { used: true, used_at: new Date() },
        },
        { returnDocument: 'after' }
      );

      if (!authCode) {
        return {
          success: false,
          error: 'Authorization code not found or already used',
        };
      }

      // Check expiration
      if (new Date() > authCode.expires_at) {
        return {
          success: false,
          error: 'Authorization code expired',
        };
      }

      // Validate redirect URI matches
      if (authCode.redirect_uri !== input.redirectUri) {
        return {
          success: false,
          error: 'Redirect URI mismatch',
        };
      }

      // Validate PKCE if code_challenge was provided
      if (authCode.code_challenge) {
        if (!input.codeVerifier) {
          return {
            success: false,
            error: 'code_verifier required for PKCE',
          };
        }

        if (!this.validatePKCE(input.codeVerifier, authCode.code_challenge)) {
          return {
            success: false,
            error: 'Invalid code_verifier',
          };
        }
      }

      // Generate tokens
      const accessToken = this.generateAccessToken(authCode.user_id, input.clientId, authCode.scope);
      const refreshToken = this.generateRefreshToken(authCode.user_id, input.clientId, authCode.scope);

      // Store tokens
      await db.collection('oauth_access_tokens').insertOne({
        access_token: accessToken,
        refresh_token: refreshToken,
        client_id: input.clientId,
        user_id: authCode.user_id,
        scope: authCode.scope,
        expires_at: new Date(Date.now() + 3600 * 1000), // 1 hour
        created_at: new Date(),
      });

      // Update client last_used
      await this.updateClientLastUsed(input.clientId);

      return {
        success: true,
        data: {
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: refreshToken,
          scope: authCode.scope,
        },
      };
    } catch (error) {
      console.error('[MongoOAuthFlowService] exchangeAuthorizationCode error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to exchange authorization code',
      };
    }
  }

  // ========================================
  // Client Credentials Grant
  // ========================================

  /**
   * Generate token using client credentials
   */
  async generateClientCredentialsToken(
    clientId: string,
    clientSecret: string,
    scope: string
  ): AsyncResult<TokenResponseDTO> {
    try {
      const db = await this.getDb();

      // Validate client credentials
      const client = await db.collection('oauth_clients').findOne({
        client_id: clientId,
        client_secret: clientSecret,
      });

      if (!client) {
        return {
          success: false,
          error: 'Invalid client credentials',
        };
      }

      // Determine userId (for personal clients)
      let userId = null;
      if (client.user_id) {
        userId = client.user_id.toString();
      }

      // Generate access token (no refresh token for client_credentials)
      const accessToken = this.generateAccessToken(userId || clientId, clientId, scope);

      // Store token
      await db.collection('oauth_access_tokens').insertOne({
        access_token: accessToken,
        client_id: clientId,
        user_id: userId,
        scope: scope,
        expires_at: new Date(Date.now() + 3600 * 1000), // 1 hour
        created_at: new Date(),
      });

      // Update client last_used
      await this.updateClientLastUsed(clientId);

      return {
        success: true,
        data: {
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          scope: scope,
        },
      };
    } catch (error) {
      console.error('[MongoOAuthFlowService] generateClientCredentialsToken error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate token',
      };
    }
  }

  // ========================================
  // Refresh Token Grant
  // ========================================

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    refreshToken: string,
    clientId: string
  ): AsyncResult<TokenResponseDTO> {
    try {
      const db = await this.getDb();

      // Verify refresh token JWT
      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, JWT_SECRET);
      } catch (error) {
        return {
          success: false,
          error: 'Invalid refresh token',
        };
      }

      // Find token record in database
      const tokenRecord = await db.collection('oauth_access_tokens').findOne({
        refresh_token: refreshToken,
        client_id: clientId,
      });

      if (!tokenRecord) {
        return {
          success: false,
          error: 'Refresh token not found',
        };
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(
        tokenRecord.user_id,
        clientId,
        tokenRecord.scope
      );
      const newRefreshToken = this.generateRefreshToken(
        tokenRecord.user_id,
        clientId,
        tokenRecord.scope
      );

      // Update token record
      await db.collection('oauth_access_tokens').updateOne(
        { _id: tokenRecord._id },
        {
          $set: {
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
            expires_at: new Date(Date.now() + 3600 * 1000),
            updated_at: new Date(),
          },
        }
      );

      return {
        success: true,
        data: {
          access_token: newAccessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: newRefreshToken,
          scope: tokenRecord.scope,
        },
      };
    } catch (error) {
      console.error('[MongoOAuthFlowService] refreshAccessToken error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh token',
      };
    }
  }

  // ========================================
  // Dynamic Client Registration
  // ========================================

  /**
   * Register new OAuth client (RFC 7591)
   */
  async registerClient(input: RegisterClientInput): AsyncResult<RegisterClientResultDTO> {
    try {
      const db = await this.getDb();

      // Validate redirect URIs (HTTPS or localhost only)
      for (const uri of input.redirect_uris) {
        try {
          const url = new URL(uri);
          if (!/^https:\/\//.test(uri) && !/^http:\/\/localhost/.test(uri)) {
            return {
              success: false,
              error: `Redirect URI must use HTTPS or localhost: ${uri}`,
            };
          }
        } catch (error) {
          return {
            success: false,
            error: `Invalid redirect URI format: ${uri}`,
          };
        }
      }

      // Generate client credentials
      const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;
      const authMethod = input.token_endpoint_auth_method || 'client_secret_post';

      // Generate secret only for confidential clients
      let clientSecret: string | undefined;
      if (authMethod !== 'none') {
        clientSecret = crypto.randomBytes(32).toString('base64url');
      }

      const clientData = {
        client_id: clientId,
        client_secret: clientSecret,
        client_name: input.client_name,
        client_uri: input.client_uri,
        redirect_uris: input.redirect_uris,
        grant_types: input.grant_types || ['authorization_code'],
        response_types: input.response_types || ['code'],
        token_endpoint_auth_method: authMethod,
        scope: input.scope || 'read write',
        created_at: new Date(),
        client_id_issued_at: Math.floor(Date.now() / 1000),
      };

      await db.collection('oauth_clients').insertOne(clientData);

      return {
        success: true,
        data: {
          client_id: clientId,
          client_secret: clientSecret,
          client_id_issued_at: clientData.client_id_issued_at,
          client_name: input.client_name,
          redirect_uris: input.redirect_uris,
          grant_types: clientData.grant_types,
          response_types: clientData.response_types,
          token_endpoint_auth_method: authMethod,
          scope: clientData.scope,
        },
      };
    } catch (error) {
      console.error('[MongoOAuthFlowService] registerClient error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to register client',
      };
    }
  }

  // ========================================
  // Token Generation
  // ========================================

  /**
   * Generate JWT access token
   */
  generateAccessToken(userId: string, clientId: string, scope: string): string {
    return jwt.sign(
      {
        sub: userId,
        client_id: clientId,
        scope: scope,
        type: 'access_token',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(userId: string, clientId: string, scope: string): string {
    return jwt.sign(
      {
        sub: userId,
        client_id: clientId,
        scope: scope,
        type: 'refresh_token',
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
  }

  // ========================================
  // PKCE Validation
  // ========================================

  /**
   * Validate PKCE code_verifier against code_challenge
   * Uses SHA-256 as per RFC 7636
   */
  validatePKCE(codeVerifier: string, codeChallenge: string): boolean {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  }
}
