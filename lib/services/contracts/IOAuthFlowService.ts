/**
 * OAuth 2.1 Flow Service Contract
 *
 * This interface defines OAuth 2.1 protocol implementation for authorization code flow,
 * token exchange, client credentials, and refresh token grants.
 *
 * SECURITY-CRITICAL: This service handles OAuth security flows including PKCE validation,
 * authorization code one-time use, and token generation.
 *
 * Separate from IOAuthService which handles user-scoped client CRUD operations.
 *
 * Added 2026-01-15 for database-agnostic OAuth flow migration
 */

import type { AsyncResult } from './common';

// ============================================================================
// DTOs
// ============================================================================

/**
 * OAuth client data
 */
export interface OAuthClientDTO {
  client_id: string;
  client_secret?: string;
  client_name: string;
  client_uri?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string;
  user_id?: string; // For personal clients
  username?: string; // For display purposes
  created_at: Date;
  client_id_issued_at: number;
  last_used?: Date;
}

/**
 * Authorization code data
 */
export interface AuthorizationCodeDTO {
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge?: string;
  code_challenge_method?: string;
  expires_at: Date;
  used: boolean;
  used_at?: Date;
  created_at: Date;
}

/**
 * Token response (OAuth 2.1 standard format)
 */
export interface TokenResponseDTO {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * Access token data stored in database
 */
export interface AccessTokenDTO {
  access_token: string;
  refresh_token?: string;
  client_id: string;
  user_id?: string; // Null for client_credentials grant
  scope: string;
  expires_at: Date;
  created_at: Date;
  updated_at?: Date;
}

/**
 * Input for creating authorization code
 */
export interface CreateAuthCodeInput {
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

/**
 * Input for exchanging authorization code
 */
export interface ExchangeAuthCodeInput {
  code: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  codeVerifier?: string;
}

/**
 * Input for client registration (RFC 7591)
 */
export interface RegisterClientInput {
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method?: 'none' | 'client_secret_basic' | 'client_secret_post';
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  client_uri?: string;
}

/**
 * Result of client registration
 */
export interface RegisterClientResultDTO {
  client_id: string;
  client_secret?: string; // Only returned for confidential clients
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string;
}

// ============================================================================
// IOAuthFlowService Interface
// ============================================================================

/**
 * OAuth 2.1 Flow Service
 *
 * Handles the OAuth 2.1 protocol flows:
 * 1. Authorization Code Flow (with PKCE)
 * 2. Client Credentials Grant
 * 3. Refresh Token Grant
 * 4. Dynamic Client Registration (RFC 7591)
 */
export interface IOAuthFlowService {
  // ========================================
  // Client Validation
  // ========================================

  /**
   * Validate OAuth client credentials
   *
   * @param clientId - The client ID to validate
   * @param redirectUri - Optional redirect URI to validate against registered URIs
   * @param clientSecret - Optional client secret for confidential clients
   * @returns Client data if valid, or error
   *
   * @example
   * ```typescript
   * const result = await oauthFlowService.validateClient('mcp_abc123', 'https://example.com/callback');
   * if (result.success) {
   *   console.log(`Valid client: ${result.data.client_name}`);
   * }
   * ```
   */
  validateClient(
    clientId: string,
    redirectUri?: string,
    clientSecret?: string
  ): AsyncResult<OAuthClientDTO>;

  /**
   * Update client's last_used timestamp
   *
   * @param clientId - The client ID
   * @returns Success indicator
   */
  updateClientLastUsed(clientId: string): AsyncResult<void>;

  // ========================================
  // Authorization Code Flow
  // ========================================

  /**
   * Create and store an authorization code
   *
   * SECURITY: Authorization codes expire in 10 minutes and are single-use only
   *
   * @param input - Authorization code creation parameters
   * @returns Created authorization code and expiration
   *
   * @example
   * ```typescript
   * const result = await oauthFlowService.createAuthorizationCode({
   *   clientId: 'mcp_abc123',
   *   userId: 'user123',
   *   redirectUri: 'https://example.com/callback',
   *   scope: 'read write',
   *   codeChallenge: 'sha256hash',
   *   codeChallengeMethod: 'S256'
   * });
   * ```
   */
  createAuthorizationCode(
    input: CreateAuthCodeInput
  ): AsyncResult<{ code: string; expiresAt: Date }>;

  /**
   * Exchange authorization code for access token
   *
   * SECURITY CRITICAL:
   * - Marks code as used atomically to prevent reuse
   * - Validates PKCE if code_challenge was provided
   * - Checks code expiration
   * - Validates redirect_uri matches
   *
   * @param input - Code exchange parameters
   * @returns Access token and optional refresh token
   *
   * @example
   * ```typescript
   * const result = await oauthFlowService.exchangeAuthorizationCode({
   *   code: 'auth_code_xyz',
   *   clientId: 'mcp_abc123',
   *   redirectUri: 'https://example.com/callback',
   *   codeVerifier: 'random_verifier_string'
   * });
   * if (result.success) {
   *   console.log(`Access token: ${result.data.access_token}`);
   * }
   * ```
   */
  exchangeAuthorizationCode(
    input: ExchangeAuthCodeInput
  ): AsyncResult<TokenResponseDTO>;

  // ========================================
  // Client Credentials Grant
  // ========================================

  /**
   * Generate access token using client credentials
   *
   * @param clientId - The client ID
   * @param clientSecret - The client secret
   * @param scope - Requested scope
   * @returns Access token (no refresh token for client_credentials)
   *
   * @example
   * ```typescript
   * const result = await oauthFlowService.generateClientCredentialsToken(
   *   'mcp_abc123',
   *   'secret_xyz',
   *   'read write'
   * );
   * ```
   */
  generateClientCredentialsToken(
    clientId: string,
    clientSecret: string,
    scope: string
  ): AsyncResult<TokenResponseDTO>;

  // ========================================
  // Refresh Token Grant
  // ========================================

  /**
   * Refresh an access token using a refresh token
   *
   * @param refreshToken - The refresh token JWT
   * @param clientId - The client ID (for validation)
   * @returns New access token and refresh token
   *
   * @example
   * ```typescript
   * const result = await oauthFlowService.refreshAccessToken('refresh_token_jwt', 'mcp_abc123');
   * ```
   */
  refreshAccessToken(
    refreshToken: string,
    clientId: string
  ): AsyncResult<TokenResponseDTO>;

  // ========================================
  // Dynamic Client Registration (RFC 7591)
  // ========================================

  /**
   * Register a new OAuth client dynamically
   *
   * SECURITY:
   * - Only HTTPS or localhost redirect URIs allowed
   * - Generates cryptographically secure client_id and client_secret
   *
   * @param input - Client registration parameters
   * @returns Registered client data (includes client_secret for confidential clients)
   *
   * @example
   * ```typescript
   * const result = await oauthFlowService.registerClient({
   *   client_name: 'My App',
   *   redirect_uris: ['https://myapp.com/callback'],
   *   token_endpoint_auth_method: 'client_secret_post'
   * });
   * if (result.success) {
   *   console.log(`Client ID: ${result.data.client_id}`);
   *   console.log(`Client Secret: ${result.data.client_secret}`); // Save this!
   * }
   * ```
   */
  registerClient(input: RegisterClientInput): AsyncResult<RegisterClientResultDTO>;

  // ========================================
  // Token Generation Helpers
  // ========================================

  /**
   * Generate JWT access token
   *
   * @param userId - The user ID (or clientId for client_credentials)
   * @param clientId - The client ID
   * @param scope - The granted scope
   * @returns Signed JWT token
   */
  generateAccessToken(userId: string, clientId: string, scope: string): string;

  /**
   * Generate JWT refresh token
   *
   * @param userId - The user ID
   * @param clientId - The client ID
   * @param scope - The granted scope
   * @returns Signed JWT token
   */
  generateRefreshToken(userId: string, clientId: string, scope: string): string;

  // ========================================
  // PKCE Validation
  // ========================================

  /**
   * Validate PKCE code_verifier against code_challenge
   *
   * SECURITY: Uses SHA-256 hashing as per RFC 7636
   *
   * @param codeVerifier - The code verifier from token request
   * @param codeChallenge - The code challenge from authorization request
   * @returns True if verifier matches challenge
   *
   * @example
   * ```typescript
   * const isValid = oauthFlowService.validatePKCE(
   *   'random_verifier_43_to_128_chars',
   *   'base64url_encoded_sha256_hash'
   * );
   * ```
   */
  validatePKCE(codeVerifier: string, codeChallenge: string): boolean;
}
