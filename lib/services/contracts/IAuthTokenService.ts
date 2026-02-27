// lib/services/contracts/IAuthTokenService.ts

import { AsyncResult } from './common';

/**
 * MCP Token Data Transfer Object
 */
export interface McpTokenDTO {
  token: string;
  expiresAt: Date | null;
}

/**
 * Bearer Token Data Transfer Object
 */
export interface BearerTokenDTO {
  access_token: string;
  token_type: 'bearer';
  expires_at: string;
  created_at?: Date;
  message?: string;
}

/**
 * Validated User Data (from token validation)
 */
export interface ValidatedUserDTO {
  _id: string;
  username: string;
  email?: string;
  discordUsername?: string;
  roles?: string[];
  // Add other user fields as needed
}

/**
 * Token Validation Result
 */
export interface TokenValidationDTO {
  isValid: boolean;
  user?: ValidatedUserDTO | null;
  clientId?: string;
  scope?: string;
  error?: string;
}

/**
 * Auth Token Service
 *
 * Manages authentication tokens for multiple auth methods:
 * - MCP tokens (legacy Machine Client Protocol)
 * - Bearer tokens (simple random tokens)
 * - OAuth 2.1 tokens (JWT-based)
 *
 * Collections accessed:
 * - users (mcpToken, mcpTokenExpiry, bearerToken, bearerTokenExpiry)
 * - oauth_access_tokens (access_token, expires_at, user_id)
 *
 * Methods:
 * - MCP token operations (get, validate)
 * - Bearer token operations (generate, get, validate)
 * - OAuth token validation (JWT + database fallback)
 */
export interface IAuthTokenService {
  /**
   * Get MCP token for a user
   *
   * Retrieves the user's MCP token if it exists and is not expired.
   * Returns null if no valid token found.
   *
   * @param userId - User ID to lookup
   * @param username - Optional username for alternate lookup
   * @param discordUsername - Optional Discord username for alternate lookup
   * @returns MCP token data or null
   *
   * @example
   * ```typescript
   * const result = await authTokenService.getMcpToken(userId);
   * if (result.success && result.data) {
   *   console.log('Token expires:', result.data.expiresAt);
   * }
   * ```
   */
  getMcpToken(
    userId?: string,
    username?: string,
    discordUsername?: string
  ): AsyncResult<McpTokenDTO | null>;

  /**
   * Validate MCP token and return associated user
   *
   * Checks if token exists in database and is not expired.
   *
   * @param token - MCP token to validate
   * @returns Validated user data or null if invalid
   *
   * @example
   * ```typescript
   * const result = await authTokenService.validateMcpToken(token);
   * if (result.success && result.data) {
   *   console.log('Authenticated as:', result.data.username);
   * }
   * ```
   */
  validateMcpToken(token: string): AsyncResult<ValidatedUserDTO | null>;

  /**
   * Generate new bearer token for user
   *
   * Creates a simple bearer token (fab_[64 hex chars]) with 30-day expiry.
   * Stores in oauth_access_tokens collection.
   *
   * Token format: `fab_${crypto.randomBytes(32).toString('hex')}`
   *
   * @param userId - User ID to generate token for
   * @returns Bearer token data with secret (only time it's shown)
   *
   * @example
   * ```typescript
   * const result = await authTokenService.generateBearerToken(userId);
   * if (result.success) {
   *   console.log('Save this token:', result.data.access_token);
   * }
   * ```
   */
  generateBearerToken(userId: string): AsyncResult<BearerTokenDTO>;

  /**
   * Get most recent valid bearer token for user
   *
   * Returns the latest non-expired bearer token, or null if none exists.
   *
   * @param userId - User ID to lookup
   * @returns Bearer token data or null
   *
   * @example
   * ```typescript
   * const result = await authTokenService.getBearerToken(userId);
   * if (result.success && result.data) {
   *   console.log('Token expires:', result.data.expires_at);
   * }
   * ```
   */
  getBearerToken(userId: string): AsyncResult<BearerTokenDTO | null>;

  /**
   * Validate bearer token and return associated user
   *
   * Checks oauth_access_tokens collection and users.bearerToken field.
   * Returns user if token is valid and not expired.
   *
   * @param token - Bearer token to validate
   * @returns Validated user data or null if invalid
   *
   * @example
   * ```typescript
   * const result = await authTokenService.validateBearerToken(token);
   * if (result.success && result.data) {
   *   console.log('Authenticated as:', result.data.username);
   * }
   * ```
   */
  validateBearerToken(token: string): AsyncResult<ValidatedUserDTO | null>;

  /**
   * Validate OAuth 2.1 token (JWT or database lookup)
   *
   * Multi-step validation:
   * 1. Try JWT verification (for access tokens)
   * 2. Fall back to oauth_access_tokens collection lookup
   * 3. Fall back to users.bearerToken field
   *
   * Returns validation result with user data if valid.
   *
   * @param token - OAuth token to validate
   * @returns Validation result with user data or error
   *
   * @example
   * ```typescript
   * const result = await authTokenService.validateOAuthToken(token);
   * if (result.success && result.data.isValid) {
   *   console.log('User:', result.data.user?.username);
   * }
   * ```
   */
  validateOAuthToken(token: string): AsyncResult<TokenValidationDTO>;
}
