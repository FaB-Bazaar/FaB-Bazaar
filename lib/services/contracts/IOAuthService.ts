/**
 * OAuth Service Contract
 *
 * Manages user-specific OAuth 2.1 clients for API access.
 * Handles client creation, listing, and revocation with secure secret management.
 */

import type { AsyncResult } from './common';

/**
 * OAuth client for display (no secret)
 * Used when listing existing clients
 */
export interface OAuthClientDTO {
  client_id: string;
  client_name: string;
  created_at: Date;
  last_used?: Date;
  grant_types: string[];
  scope: string;
}

/**
 * OAuth client with secret (only returned on creation)
 * The client secret is only shown once during creation
 */
export interface OAuthClientWithSecretDTO extends OAuthClientDTO {
  client_secret: string;
}

/**
 * OAuth Service Interface
 *
 * Provides methods for managing user-specific OAuth clients.
 */
export interface IOAuthService {
  /**
   * List all OAuth clients for a user
   *
   * Only returns non-sensitive information (no secrets).
   * Filters to only show user-specific clients (not system clients).
   *
   * @param userId - The user's ID
   * @returns Array of OAuth clients without secrets
   *
   * @example
   * ```typescript
   * const result = await oauthService.listClients(userId);
   * if (result.success) {
   *   console.log(`User has ${result.data.length} OAuth clients`);
   * }
   * ```
   */
  listClients(userId: string): AsyncResult<OAuthClientDTO[]>;

  /**
   * Create new OAuth client for user
   *
   * Generates secure client_id and client_secret.
   * Returns full client data including secret (ONLY TIME IT'S SHOWN).
   *
   * Security:
   * - Client ID: mcp_[32 hex characters]
   * - Client secret: 32 bytes base64url encoded
   * - Linked to specific user (user_id field)
   * - Uses client_credentials grant type
   *
   * @param userId - The user's ID
   * @param clientName - Human-readable name for the client
   * @returns Complete client data including secret
   *
   * @example
   * ```typescript
   * const result = await oauthService.createClient(userId, 'My App');
   * if (result.success) {
   *   console.log('Save this secret:', result.data.client_secret);
   *   // Secret will never be shown again!
   * }
   * ```
   */
  createClient(
    userId: string,
    clientName: string
  ): AsyncResult<OAuthClientWithSecretDTO>;

  /**
   * Revoke OAuth client and all associated tokens
   *
   * Validates user ownership before deletion.
   * Cascades deletion to all access tokens using this client.
   *
   * @param userId - The user's ID (for ownership validation)
   * @param clientId - The client ID to revoke
   * @returns Result indicating success/failure
   *
   * @example
   * ```typescript
   * const result = await oauthService.revokeClient(userId, clientId);
   * if (result.success) {
   *   console.log('Client and all tokens revoked');
   * }
   * ```
   */
  revokeClient(
    userId: string,
    clientId: string
  ): AsyncResult<void>;
}
