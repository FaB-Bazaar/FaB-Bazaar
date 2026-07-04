/**
 * PostgreSQL implementation of OAuth Service
 *
 * Handles OAuth 2.1 client management for user API access.
 * Migrated from MongoOAuthService on 2026-02-15.
 */

import { db } from '@/lib/postgres/db';
import { users, oauthClients } from '@/lib/postgres/schema';
import { randomBytes } from 'crypto';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import { eq, and, desc } from 'drizzle-orm';
import type {
  IOAuthService,
  OAuthClientDTO,
  OAuthClientWithSecretDTO,
} from '../../contracts/IOAuthService';
import type { AsyncResult } from '../../contracts/common';

export class PostgresOAuthService implements IOAuthService {
  /**
   * Generate unique client ID with mcp_ prefix
   */
  private generateClientId(): string {
    return `mcp_${randomBytes(16).toString('hex')}`;
  }

  /**
   * Generate secure client secret
   */
  private generateClientSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * List all OAuth clients for a user
   */
  async listClients(userId: string): AsyncResult<OAuthClientDTO[]> {
    try {
      // Get user's OAuth clients (only show non-sensitive info)
      const clients = await db
        .select({
          client_id: oauthClients.clientId,
          client_name: oauthClients.clientName,
          created_at: oauthClients.createdAt,
          last_used: oauthClients.lastUsed,
          grant_types: oauthClients.grantTypes,
          scope: oauthClients.scope,
        })
        .from(oauthClients)
        .where(
          and(
            eq(oauthClients.userId, userId),
            eq(oauthClients.tokenEndpointAuthMethod, 'client_secret_basic') // Only user-specific clients
          )
        )
        .orderBy(desc(oauthClients.createdAt));

      const clientDTOs: OAuthClientDTO[] = clients.map((client) => ({
        client_id: client.client_id,
        client_name: client.client_name,
        created_at: client.created_at,
        last_used: client.last_used ?? undefined,
        grant_types: client.grant_types,
        scope: client.scope,
      }));

      return { success: true, data: clientDTOs };
    } catch (error) {
      console.error('[PostgresOAuthService] listClients error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list OAuth clients',
      };
    }
  }

  /**
   * Create new OAuth client for user
   *
   * NOTE: Automatically includes the callback URLs of known MCP chat clients
   * (Claude, Mistral Le Chat) in redirect_uris, so pasted credentials work in
   * any of them. /oauth/authorize exact-matches redirect_uri against this list.
   */
  async createClient(
    userId: string,
    clientName: string
  ): AsyncResult<OAuthClientWithSecretDTO> {
    try {
      // Check if user exists
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Generate user-specific OAuth client
      const clientId = this.generateClientId();
      const rawClientSecret = this.generateClientSecret();
      const clientSecretHash = await bcrypt.hash(rawClientSecret, 12);
      const id = nanoid();

      const clientData = {
        id,
        clientId,
        clientSecret: clientSecretHash, // Store bcrypt hash, not raw secret
        clientName,
        userId, // Link to specific user
        username: user.username, // For easier identification
        redirectUris: [
          'https://claude.ai/api/mcp/auth_callback',
          'https://callback.mistral.ai/v1/integrations_auth/oauth2_callback', // Mistral Le Chat
        ],
        grantTypes: ['client_credentials', 'authorization_code', 'refresh_token'],
        responseTypes: ['token', 'code'],
        tokenEndpointAuthMethod: 'client_secret_basic' as const,
        scope: 'read write',
        createdAt: new Date(),
        clientIdIssuedAt: Math.floor(Date.now() / 1000),
        lastUsed: null,
      };

      await db.insert(oauthClients).values(clientData);

      console.log(`✅ Personal OAuth client created for user: ${user.username} (${clientId})`);

      // Return raw secret ONLY on creation — it is never stored in plain text
      return {
        success: true,
        data: {
          client_id: clientId,
          client_secret: rawClientSecret,
          client_name: clientName,
          created_at: clientData.createdAt,
          grant_types: clientData.grantTypes,
          scope: clientData.scope,
        },
      };
    } catch (error) {
      console.error('[PostgresOAuthService] createClient error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create OAuth client',
      };
    }
  }

  /**
   * Revoke OAuth client and all associated tokens
   */
  async revokeClient(userId: string, clientId: string): AsyncResult<void> {
    try {
      // Verify user owns this client
      const [client] = await db
        .select()
        .from(oauthClients)
        .where(
          and(
            eq(oauthClients.clientId, clientId),
            eq(oauthClients.userId, userId)
          )
        );

      if (!client) {
        return { success: false, error: 'Client not found or unauthorized' };
      }

      // Delete the client (cascade will handle tokens)
      await db.delete(oauthClients).where(eq(oauthClients.id, client.id));

      console.log(`✅ OAuth client revoked: ${clientId} (user: ${userId})`);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[PostgresOAuthService] revokeClient error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke OAuth client',
      };
    }
  }
}
