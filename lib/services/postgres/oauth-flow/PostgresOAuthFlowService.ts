/**
 * PostgreSQL implementation of OAuth Flow Service
 *
 * SECURITY-CRITICAL: This service handles OAuth 2.1 protocol flows including:
 * - Authorization code generation and validation (single-use, time-limited)
 * - PKCE validation (SHA-256)
 * - Token generation (JWT)
 * - Client credentials grant
 * - Refresh token grant
 * - Dynamic client registration
 *
 * Migrated from MongoOAuthFlowService on 2026-02-15
 */

import { db } from '@/lib/postgres/db';
import {
  oauthClients,
  oauthAuthorizationCodes,
  oauthAccessTokens,
} from '@/lib/postgres/schema';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
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

export class PostgresOAuthFlowService implements IOAuthFlowService {
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
      const [client] = await db
        .select()
        .from(oauthClients)
        .where(eq(oauthClients.clientId, clientId));

      if (!client) {
        return { success: false, error: 'Client not found' };
      }

      // Validate client secret for confidential clients
      if (clientSecret !== undefined) {
        if (client.tokenEndpointAuthMethod !== 'none') {
          const secretValid = await bcrypt.compare(clientSecret, client.clientSecret);
          if (!secretValid) {
            return { success: false, error: 'Invalid client credentials' };
          }
        }
      }

      // Validate redirect URI if provided
      if (redirectUri) {
        if (client.redirectUris.length > 0 && !client.redirectUris.includes(redirectUri)) {
          return { success: false, error: 'Invalid redirect_uri' };
        }
      }

      return {
        success: true,
        data: {
          client_id: client.clientId,
          client_secret: client.clientSecret,
          client_name: client.clientName,
          client_uri: client.clientUri ?? undefined,
          redirect_uris: client.redirectUris,
          grant_types: client.grantTypes,
          response_types: client.responseTypes,
          token_endpoint_auth_method: client.tokenEndpointAuthMethod,
          scope: client.scope,
          user_id: client.userId ?? undefined,
          username: client.username ?? undefined,
          created_at: client.createdAt,
          client_id_issued_at: client.clientIdIssuedAt,
          last_used: client.lastUsed ?? undefined,
        },
      };
    } catch (error) {
      console.error('[PostgresOAuthFlowService] validateClient error:', error);
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
      await db
        .update(oauthClients)
        .set({ lastUsed: new Date() })
        .where(eq(oauthClients.clientId, clientId));

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[PostgresOAuthFlowService] updateClientLastUsed error:', error);
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
      // Generate cryptographically secure authorization code
      const authCode = `auth_${crypto.randomBytes(32).toString('base64url')}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const authCodeData = {
        id: nanoid(),
        code: authCode,
        clientId: input.clientId,
        userId: input.userId,
        redirectUri: input.redirectUri,
        scope: input.scope,
        codeChallenge: input.codeChallenge ?? null,
        codeChallengeMethod: input.codeChallengeMethod ?? null,
        expiresAt,
        used: false,
        usedAt: null,
        createdAt: new Date(),
      };

      await db.insert(oauthAuthorizationCodes).values(authCodeData);

      return {
        success: true,
        data: { code: authCode, expiresAt },
      };
    } catch (error) {
      console.error('[PostgresOAuthFlowService] createAuthorizationCode error:', error);
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
      // Validate client first
      const clientResult = await this.validateClient(input.clientId, input.redirectUri, input.clientSecret);
      if (!clientResult.success) {
        return { success: false, error: clientResult.error };
      }

      // Fetch auth code (single query)
      const [authCode] = await db
        .select()
        .from(oauthAuthorizationCodes)
        .where(
          and(
            eq(oauthAuthorizationCodes.code, input.code),
            eq(oauthAuthorizationCodes.clientId, input.clientId),
            eq(oauthAuthorizationCodes.used, false)
          )
        );

      if (!authCode) {
        return {
          success: false,
          error: 'Authorization code not found or already used',
        };
      }

      // Check expiration before consuming the code
      if (new Date() > authCode.expiresAt) {
        return {
          success: false,
          error: 'Authorization code expired',
        };
      }

      // Mark as used IMMEDIATELY (atomic operation)
      await db
        .update(oauthAuthorizationCodes)
        .set({ used: true, usedAt: new Date() })
        .where(eq(oauthAuthorizationCodes.id, authCode.id));

      // Validate redirect URI matches
      if (authCode.redirectUri !== input.redirectUri) {
        return {
          success: false,
          error: 'Redirect URI mismatch',
        };
      }

      // Validate PKCE if code_challenge was provided
      if (authCode.codeChallenge) {
        if (!input.codeVerifier) {
          return {
            success: false,
            error: 'code_verifier required for PKCE',
          };
        }

        if (!this.validatePKCE(input.codeVerifier, authCode.codeChallenge)) {
          return {
            success: false,
            error: 'Invalid code_verifier',
          };
        }
      }

      // Generate tokens
      const accessToken = this.generateAccessToken(authCode.userId, input.clientId, authCode.scope);
      const refreshToken = this.generateRefreshToken(authCode.userId, input.clientId, authCode.scope);

      // Store tokens
      await db.insert(oauthAccessTokens).values({
        id: nanoid(),
        accessToken,
        refreshToken,
        tokenType: 'bearer',
        clientId: input.clientId,
        userId: authCode.userId,
        scope: authCode.scope,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
        refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 days
        createdAt: new Date(),
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
      console.error('[PostgresOAuthFlowService] exchangeAuthorizationCode error:', error);
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
      // Fetch client by ID, then validate secret separately (bcrypt compare)
      const [client] = await db
        .select()
        .from(oauthClients)
        .where(eq(oauthClients.clientId, clientId));

      if (!client) {
        return {
          success: false,
          error: 'Invalid client credentials',
        };
      }

      const secretValid = await bcrypt.compare(clientSecret, client.clientSecret);
      if (!secretValid) {
        return {
          success: false,
          error: 'Invalid client credentials',
        };
      }

      // Determine userId (for personal clients)
      const userId = client.userId || clientId;

      // Generate access token (no refresh token for client_credentials)
      const accessToken = this.generateAccessToken(userId, clientId, scope);

      // Store token
      await db.insert(oauthAccessTokens).values({
        id: nanoid(),
        accessToken,
        tokenType: 'bearer',
        clientId,
        userId,
        scope,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
        refreshToken: null,
        refreshTokenExpiresAt: null,
        createdAt: new Date(),
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
      console.error('[PostgresOAuthFlowService] generateClientCredentialsToken error:', error);
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
      const [tokenRecord] = await db
        .select()
        .from(oauthAccessTokens)
        .where(
          and(
            eq(oauthAccessTokens.refreshToken, refreshToken),
            eq(oauthAccessTokens.clientId, clientId)
          )
        );

      if (!tokenRecord) {
        return {
          success: false,
          error: 'Refresh token not found',
        };
      }

      // Check refresh token expiration
      if (tokenRecord.refreshTokenExpiresAt && new Date() > tokenRecord.refreshTokenExpiresAt) {
        return {
          success: false,
          error: 'Refresh token expired',
        };
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(
        tokenRecord.userId,
        clientId,
        tokenRecord.scope
      );
      const newRefreshToken = this.generateRefreshToken(
        tokenRecord.userId,
        clientId,
        tokenRecord.scope
      );

      // Update token record
      await db
        .update(oauthAccessTokens)
        .set({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        })
        .where(eq(oauthAccessTokens.id, tokenRecord.id));

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
      console.error('[PostgresOAuthFlowService] refreshAccessToken error:', error);
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
      // Validate redirect URIs: HTTPS anywhere, or plain http only on loopback.
      // Loopback must include the IP literals (127.0.0.1 / [::1]) — RFC 8252 §7.3
      // native apps (LM Studio et al.) register those rather than "localhost".
      // Hostname is compared exactly (parsed URL), so "localhost.evil.com" fails.
      for (const uri of input.redirect_uris) {
        let url: URL;
        try {
          url = new URL(uri);
        } catch (error) {
          return {
            success: false,
            error: `Invalid redirect URI format: ${uri}`,
          };
        }
        const isLoopback =
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1' ||
          url.hostname === '[::1]' ||
          url.hostname === '::1';
        const allowed = url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback);
        if (!allowed) {
          return {
            success: false,
            error: `Redirect URI must use HTTPS or a loopback address (localhost, 127.0.0.1): ${uri}`,
          };
        }
      }

      // Generate client credentials
      const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;
      const authMethod = input.token_endpoint_auth_method || 'client_secret_post';

      // Generate secret only for confidential clients; store bcrypt hash, return raw
      let rawClientSecret: string | undefined;
      let clientSecretHash = '';
      if (authMethod !== 'none') {
        rawClientSecret = crypto.randomBytes(32).toString('base64url');
        clientSecretHash = await bcrypt.hash(rawClientSecret, 12);
      }

      const clientData = {
        id: nanoid(),
        clientId,
        clientSecret: clientSecretHash, // bcrypt hash stored; raw returned once below
        clientName: input.client_name,
        clientUri: input.client_uri ?? null,
        redirectUris: input.redirect_uris,
        grantTypes: input.grant_types || ['authorization_code'],
        responseTypes: input.response_types || ['code'],
        tokenEndpointAuthMethod: authMethod,
        scope: input.scope || 'read write',
        userId: null,
        username: null,
        createdAt: new Date(),
        clientIdIssuedAt: Math.floor(Date.now() / 1000),
        lastUsed: null,
      };

      await db.insert(oauthClients).values(clientData);

      return {
        success: true,
        data: {
          client_id: clientId,
          client_secret: rawClientSecret, // Raw secret returned ONCE; never stored in plain text
          client_id_issued_at: clientData.clientIdIssuedAt,
          client_name: input.client_name,
          redirect_uris: input.redirect_uris,
          grant_types: clientData.grantTypes,
          response_types: clientData.responseTypes,
          token_endpoint_auth_method: authMethod,
          scope: clientData.scope,
        },
      };
    } catch (error) {
      console.error('[PostgresOAuthFlowService] registerClient error:', error);
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
