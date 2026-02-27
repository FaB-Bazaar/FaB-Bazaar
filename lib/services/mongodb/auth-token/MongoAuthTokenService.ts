// lib/services/mongodb/auth-token/MongoAuthTokenService.ts

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import connectToDatabase from '@/lib/mongodb';
import {
  IAuthTokenService,
  McpTokenDTO,
  BearerTokenDTO,
  ValidatedUserDTO,
  TokenValidationDTO,
} from '../../contracts/IAuthTokenService';
import { AsyncResult } from '../../contracts/common';

/**
 * MongoDB implementation of Auth Token Service
 *
 * Manages authentication tokens across multiple auth methods:
 * - MCP tokens (stored in users collection)
 * - Bearer tokens (stored in oauth_access_tokens collection)
 * - OAuth 2.1 tokens (JWT verification + database fallback)
 */
export class MongoAuthTokenService implements IAuthTokenService {
  /**
   * Get database connection
   */
  private async getDb() {
    const { db } = await connectToDatabase();
    return db;
  }

  /**
   * Get MCP token for a user
   *
   * Supports multiple lookup methods:
   * - By user ID
   * - By username
   * - By Discord username
   */
  async getMcpToken(
    userId?: string,
    username?: string,
    discordUsername?: string
  ): AsyncResult<McpTokenDTO | null> {
    try {
      const db = await this.getDb();

      // Build query based on provided identifiers
      const query: any[] = [];

      if (userId) {
        query.push({ _id: new ObjectId(userId) });
      }
      if (username) {
        query.push({ username });
      }
      if (discordUsername) {
        query.push({ discordUsername });
      }

      if (query.length === 0) {
        return {
          success: false,
          error: 'At least one identifier (userId, username, or discordUsername) is required',
        };
      }

      const user = await db.collection('users').findOne(
        { $or: query },
        { projection: { mcpToken: 1, mcpTokenExpiry: 1 } }
      );

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Check if token exists and is not expired
      if (
        user.mcpToken &&
        user.mcpTokenExpiry &&
        new Date() < new Date(user.mcpTokenExpiry)
      ) {
        return {
          success: true,
          data: {
            token: user.mcpToken,
            expiresAt: user.mcpTokenExpiry,
          },
        };
      }

      // No valid token found
      return {
        success: true,
        data: null,
      };
    } catch (error) {
      console.error('[MongoAuthTokenService] getMcpToken error:', error);
      return {
        success: false,
        error: 'Failed to fetch MCP token',
      };
    }
  }

  /**
   * Validate MCP token and return associated user
   */
  async validateMcpToken(
    token: string
  ): AsyncResult<ValidatedUserDTO | null> {
    try {
      const db = await this.getDb();

      const user = await db.collection('users').findOne({
        mcpToken: token,
      });

      if (!user) {
        return {
          success: true,
          data: null,
        };
      }

      // Check if token is expired
      if (user.mcpTokenExpiry && new Date() > new Date(user.mcpTokenExpiry)) {
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: {
          _id: user._id.toString(),
          username: user.username,
          email: user.email,
          discordUsername: user.discordUsername,
          roles: user.roles,
        },
      };
    } catch (error) {
      console.error('[MongoAuthTokenService] validateMcpToken error:', error);
      return {
        success: false,
        error: 'Failed to validate MCP token',
      };
    }
  }

  /**
   * Generate new bearer token for user
   *
   * Creates simple random token (fab_[64 hex]) with 30-day expiry
   */
  async generateBearerToken(userId: string): AsyncResult<BearerTokenDTO> {
    try {
      const db = await this.getDb();

      // Generate bearer token
      const bearerToken = `fab_${crypto.randomBytes(32).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Store in oauth_access_tokens collection
      await db.collection('oauth_access_tokens').insertOne({
        access_token: bearerToken,
        token_type: 'bearer_simple',
        client_id: 'bearer_token_client',
        user_id: userId,
        scope: 'read write',
        expires_at: expiresAt,
        created_at: new Date(),
        is_bearer_token: true,
      });

      return {
        success: true,
        data: {
          access_token: bearerToken,
          token_type: 'bearer',
          expires_at: expiresAt.toISOString(),
          message: 'Bearer token generated successfully',
        },
      };
    } catch (error) {
      console.error(
        '[MongoAuthTokenService] generateBearerToken error:',
        error
      );
      return {
        success: false,
        error: 'Failed to generate bearer token',
      };
    }
  }

  /**
   * Get most recent valid bearer token for user
   */
  async getBearerToken(userId: string): AsyncResult<BearerTokenDTO | null> {
    try {
      const db = await this.getDb();

      const tokenRecord = await db
        .collection('oauth_access_tokens')
        .findOne(
          {
            user_id: userId,
            is_bearer_token: true,
            expires_at: { $gt: new Date() },
          },
          { sort: { created_at: -1 } }
        );

      if (!tokenRecord) {
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: {
          access_token: tokenRecord.access_token,
          token_type: 'bearer',
          expires_at: tokenRecord.expires_at.toISOString(),
          created_at: tokenRecord.created_at,
        },
      };
    } catch (error) {
      console.error('[MongoAuthTokenService] getBearerToken error:', error);
      return {
        success: false,
        error: 'Failed to fetch bearer token',
      };
    }
  }

  /**
   * Validate bearer token and return associated user
   *
   * Checks both oauth_access_tokens and users.bearerToken
   */
  async validateBearerToken(
    token: string
  ): AsyncResult<ValidatedUserDTO | null> {
    try {
      const db = await this.getDb();

      // First try oauth_access_tokens collection
      const tokenRecord = await db.collection('oauth_access_tokens').findOne({
        access_token: token,
        is_bearer_token: true,
        expires_at: { $gt: new Date() },
      });

      if (tokenRecord) {
        const user = await db.collection('users').findOne({
          _id: new ObjectId(tokenRecord.user_id),
        });

        if (user) {
          return {
            success: true,
            data: {
              _id: user._id.toString(),
              username: user.username,
              email: user.email,
              discordUsername: user.discordUsername,
              roles: user.roles,
            },
          };
        }
      }

      // Fallback to users.bearerToken field
      const user = await db.collection('users').findOne({
        bearerToken: token,
        bearerTokenExpiry: { $gt: new Date() },
      });

      if (user) {
        return {
          success: true,
          data: {
            _id: user._id.toString(),
            username: user.username,
            email: user.email,
            discordUsername: user.discordUsername,
            roles: user.roles,
          },
        };
      }

      return {
        success: true,
        data: null,
      };
    } catch (error) {
      console.error(
        '[MongoAuthTokenService] validateBearerToken error:',
        error
      );
      return {
        success: false,
        error: 'Failed to validate bearer token',
      };
    }
  }

  /**
   * Validate OAuth 2.1 token (JWT or database lookup)
   *
   * Multi-step validation:
   * 1. Try JWT verification
   * 2. Check if user token vs client credentials
   * 3. Fall back to oauth_access_tokens collection
   * 4. Fall back to users.bearerToken field
   */
  async validateOAuthToken(token: string): AsyncResult<TokenValidationDTO> {
    if (!token) {
      return {
        success: true,
        data: {
          isValid: false,
          error: 'No token provided',
        },
      };
    }

    try {
      const secret = process.env.JWT_SECRET;

      if (!secret) {
        return {
          success: false,
          error: 'JWT_SECRET environment variable is required but not set',
        };
      }

      // Step 1: Try JWT validation
      try {
        const decoded = jwt.verify(token, secret) as any;

        // Validate token type
        if (decoded.type !== 'access_token') {
          return {
            success: true,
            data: {
              isValid: false,
              error: 'Invalid token type',
            },
          };
        }

        // Check expiration
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
          return {
            success: true,
            data: {
              isValid: false,
              error: 'Token expired',
            },
          };
        }

        // For user tokens (personal client credentials)
        if (decoded.user_id && decoded.user_id !== decoded.client_id) {
          const db = await this.getDb();
          const user = await db.collection('users').findOne({
            _id: new ObjectId(decoded.user_id),
          });

          if (!user) {
            return {
              success: true,
              data: {
                isValid: false,
                error: 'User not found',
              },
            };
          }

          return {
            success: true,
            data: {
              isValid: true,
              user: {
                _id: user._id.toString(),
                username: user.username,
                email: user.email,
                discordUsername: user.discordUsername,
                roles: user.roles,
              },
            },
          };
        }

        // For general client credentials tokens
        return {
          success: true,
          data: {
            isValid: true,
            user: null,
            clientId: decoded.client_id,
            scope: decoded.scope,
          },
        };
      } catch (jwtError) {
        // JWT validation failed, fall back to database lookup
        const db = await this.getDb();

        // Step 2: Try oauth_access_tokens collection
        const tokenRecord = await db.collection('oauth_access_tokens').findOne({
          access_token: token,
          is_bearer_token: true,
          expires_at: { $gt: new Date() },
        });

        if (tokenRecord) {
          const user = await db.collection('users').findOne({
            _id: new ObjectId(tokenRecord.user_id),
          });

          if (user) {
            return {
              success: true,
              data: {
                isValid: true,
                user: {
                  _id: user._id.toString(),
                  username: user.username,
                  email: user.email,
                  discordUsername: user.discordUsername,
                  roles: user.roles,
                },
              },
            };
          }
        }

        // Step 3: Fall back to users.bearerToken field
        const user = await db.collection('users').findOne({
          bearerToken: token,
          bearerTokenExpiry: { $gt: new Date() },
        });

        if (user) {
          return {
            success: true,
            data: {
              isValid: true,
              user: {
                _id: user._id.toString(),
                username: user.username,
                email: user.email,
                discordUsername: user.discordUsername,
                roles: user.roles,
              },
            },
          };
        }

        return {
          success: true,
          data: {
            isValid: false,
            error: 'Invalid token',
          },
        };
      }
    } catch (error) {
      console.error(
        '[MongoAuthTokenService] validateOAuthToken error:',
        error
      );
      return {
        success: false,
        error: 'Token validation error',
      };
    }
  }
}
