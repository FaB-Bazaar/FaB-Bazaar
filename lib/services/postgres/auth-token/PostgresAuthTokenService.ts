/**
 * PostgreSQL implementation of Auth Token Service
 *
 * Manages authentication tokens for multiple auth methods:
 * - MCP tokens (legacy Machine Client Protocol)
 * - Bearer tokens (simple random tokens)
 * - OAuth 2.1 tokens (JWT-based)
 *
 * Migrated from MongoAuthTokenService on 2026-02-15
 */

import { db } from '@/lib/postgres/db';
import { users, oauthAccessTokens } from '@/lib/postgres/schema';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { eq, or, and, gt, isNull } from 'drizzle-orm';
import type {
  IAuthTokenService,
  BearerTokenDTO,
  ValidatedUserDTO,
  TokenValidationDTO,
} from '../../contracts/IAuthTokenService';
import type { AsyncResult } from '../../contracts/common';

const JWT_SECRET = process.env.JWT_SECRET!;

export class PostgresAuthTokenService implements IAuthTokenService {
  // ========================================
  // Bearer Token Methods
  // ========================================

  /**
   * Generate new bearer token for user
   */
  async generateBearerToken(userId: string): AsyncResult<BearerTokenDTO> {
    try {
      // Check if user exists
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Generate bearer token
      const bearerToken = `fab_${randomBytes(32).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

      // Store in oauth_access_tokens
      await db.insert(oauthAccessTokens).values({
        id: nanoid(),
        accessToken: bearerToken,
        tokenType: 'bearer',
        clientId: `user_${userId}`,
        userId,
        scope: 'read write',
        expiresAt,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        createdAt: new Date(),
      });

      console.log(`✅ Bearer token generated for user: ${user.username}`);

      return {
        success: true,
        data: {
          access_token: bearerToken,
          token_type: 'bearer',
          expires_at: expiresAt.toISOString(),
          created_at: new Date(),
          message: 'Bearer token generated successfully. Save this token - it will not be shown again.',
        },
      };
    } catch (error) {
      console.error('[PostgresAuthTokenService] generateBearerToken error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate bearer token',
      };
    }
  }

  /**
   * Get most recent valid bearer token for user
   */
  async getBearerToken(userId: string): AsyncResult<BearerTokenDTO | null> {
    try {
      const [token] = await db
        .select({
          accessToken: oauthAccessTokens.accessToken,
          expiresAt: oauthAccessTokens.expiresAt,
          createdAt: oauthAccessTokens.createdAt,
        })
        .from(oauthAccessTokens)
        .where(
          and(
            eq(oauthAccessTokens.userId, userId),
            eq(oauthAccessTokens.tokenType, 'bearer'),
            or(
              gt(oauthAccessTokens.expiresAt, new Date()),
              isNull(oauthAccessTokens.expiresAt)
            )
          )
        )
        .orderBy(oauthAccessTokens.createdAt)
        .limit(1);

      if (!token) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          access_token: token.accessToken,
          token_type: 'bearer',
          expires_at: token.expiresAt.toISOString(),
          created_at: token.createdAt,
        },
      };
    } catch (error) {
      console.error('[PostgresAuthTokenService] getBearerToken error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get bearer token',
      };
    }
  }

  /**
   * Validate bearer token and return associated user
   */
  async validateBearerToken(token: string): AsyncResult<ValidatedUserDTO | null> {
    try {
      // Look up token in oauth_access_tokens
      const [tokenRecord] = await db
        .select({
          userId: oauthAccessTokens.userId,
          expiresAt: oauthAccessTokens.expiresAt,
        })
        .from(oauthAccessTokens)
        .where(
          and(
            eq(oauthAccessTokens.accessToken, token),
            eq(oauthAccessTokens.tokenType, 'bearer')
          )
        );

      if (!tokenRecord) {
        return { success: true, data: null };
      }

      // Check expiration
      if (new Date() > tokenRecord.expiresAt) {
        return { success: true, data: null };
      }

      // Get user data
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          discordUsername: users.discordUsername,
        })
        .from(users)
        .where(eq(users.id, tokenRecord.userId));

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          _id: user.id,
          username: user.username,
          email: user.email ?? undefined,
          discordUsername: user.discordUsername ?? undefined,
        },
      };
    } catch (error) {
      console.error('[PostgresAuthTokenService] validateBearerToken error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate bearer token',
      };
    }
  }

  // ========================================
  // OAuth Token Validation
  // ========================================

  /**
   * Validate OAuth 2.1 token (JWT or database lookup)
   *
   * Multi-step validation:
   * 1. Try JWT verification (for access tokens)
   * 2. Fall back to oauth_access_tokens collection lookup
   * 3. Return validation result
   */
  async validateOAuthToken(token: string): AsyncResult<TokenValidationDTO> {
    try {
      // Step 1: Try JWT verification
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);

        if (decoded.type === 'access_token') {
          // Get user data
          const [user] = await db
            .select({
              id: users.id,
              username: users.username,
              email: users.email,
              discordUsername: users.discordUsername,
            })
            .from(users)
            .where(eq(users.id, decoded.sub));

          if (user) {
            return {
              success: true,
              data: {
                isValid: true,
                user: {
                  _id: user.id,
                  username: user.username,
                  email: user.email ?? undefined,
                  discordUsername: user.discordUsername ?? undefined,
                },
                clientId: decoded.client_id,
                scope: decoded.scope,
              },
            };
          }
        }
      } catch (jwtError) {
        // JWT verification failed, continue to database lookup
      }

      // Step 2: Database lookup in oauth_access_tokens
      const [tokenRecord] = await db
        .select({
          userId: oauthAccessTokens.userId,
          clientId: oauthAccessTokens.clientId,
          scope: oauthAccessTokens.scope,
          expiresAt: oauthAccessTokens.expiresAt,
        })
        .from(oauthAccessTokens)
        .where(eq(oauthAccessTokens.accessToken, token));

      if (!tokenRecord) {
        return {
          success: true,
          data: {
            isValid: false,
            error: 'Token not found',
          },
        };
      }

      // Check expiration
      if (new Date() > tokenRecord.expiresAt) {
        return {
          success: true,
          data: {
            isValid: false,
            error: 'Token expired',
          },
        };
      }

      // Get user data
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          discordUsername: users.discordUsername,
        })
        .from(users)
        .where(eq(users.id, tokenRecord.userId));

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
            _id: user.id,
            username: user.username,
            email: user.email ?? undefined,
            discordUsername: user.discordUsername ?? undefined,
          },
          clientId: tokenRecord.clientId,
          scope: tokenRecord.scope,
        },
      };
    } catch (error) {
      console.error('[PostgresAuthTokenService] validateOAuthToken error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate OAuth token',
      };
    }
  }
}
