/**
 * MongoDB implementation of OAuth Service
 *
 * Handles OAuth 2.1 client management for user API access.
 * Extracted from /user/oauth-clients routes.
 */

import connectToDatabase from '@/lib/mongodb';
import { randomBytes } from 'crypto';
import { ObjectId } from 'mongodb';
import type {
  IOAuthService,
  OAuthClientDTO,
  OAuthClientWithSecretDTO,
} from '../../contracts/IOAuthService';
import type { AsyncResult } from '../../contracts/common';

export class MongoOAuthService implements IOAuthService {
  /**
   * Ensures database connection before operations
   */
  private async ensureConnection(): Promise<void> {
    await connectToDatabase();
  }

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
      await this.ensureConnection();
      const { db } = await connectToDatabase();

      // Get user's OAuth clients (only show non-sensitive info)
      const clients = await db
        .collection('oauth_clients')
        .find({
          user_id: new ObjectId(userId),
          token_endpoint_auth_method: 'client_secret_basic', // Only user-specific clients
        })
        .project({
          client_id: 1,
          client_name: 1,
          created_at: 1,
          last_used: 1,
          grant_types: 1,
          scope: 1,
          // Don't include client_secret in list view for security
        })
        .sort({ created_at: -1 })
        .toArray();

      const clientDTOs: OAuthClientDTO[] = clients.map((client: any) => ({
        client_id: client.client_id,
        client_name: client.client_name,
        created_at: client.created_at,
        last_used: client.last_used,
        grant_types: client.grant_types || ['client_credentials'],
        scope: client.scope || 'read write',
      }));

      return { success: true, data: clientDTOs };
    } catch (error) {
      console.error('[MongoOAuthService] listClients error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list OAuth clients',
      };
    }
  }

  /**
   * Create new OAuth client for user
   */
  async createClient(
    userId: string,
    clientName: string
  ): AsyncResult<OAuthClientWithSecretDTO> {
    try {
      await this.ensureConnection();
      const { db } = await connectToDatabase();

      // Check if user exists
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Generate user-specific OAuth client
      const clientId = this.generateClientId();
      const clientSecret = this.generateClientSecret();

      const clientData = {
        client_id: clientId,
        client_secret: clientSecret,
        client_name: clientName,
        user_id: new ObjectId(userId), // Link to specific user
        username: user.username, // For easier identification
        grant_types: ['client_credentials'],
        response_types: ['token'],
        token_endpoint_auth_method: 'client_secret_basic',
        scope: 'read write',
        created_at: new Date(),
        client_id_issued_at: Math.floor(Date.now() / 1000),
      };

      await db.collection('oauth_clients').insertOne(clientData);

      console.log(`✅ Personal OAuth client created for user: ${user.username} (${clientId})`);

      // Return the complete client data (including secret) for initial setup
      return {
        success: true,
        data: {
          client_id: clientId,
          client_secret: clientSecret,
          client_name: clientName,
          created_at: clientData.created_at,
          grant_types: clientData.grant_types,
          scope: clientData.scope,
        },
      };
    } catch (error) {
      console.error('[MongoOAuthService] createClient error:', error);
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
      await this.ensureConnection();
      const { db } = await connectToDatabase();

      // Delete OAuth client (with ownership check)
      const deleteResult = await db.collection('oauth_clients').deleteOne({
        client_id: clientId,
        user_id: new ObjectId(userId), // Ensure user owns this client
      });

      if (deleteResult.deletedCount === 0) {
        return {
          success: false,
          error: 'Client not found or you do not have permission to delete it',
        };
      }

      // Revoke all access tokens for this client
      await db.collection('oauth_access_tokens').deleteMany({
        client_id: clientId,
      });

      console.log(`✅ OAuth client revoked: ${clientId}`);

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[MongoOAuthService] revokeClient error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke OAuth client',
      };
    }
  }
}
