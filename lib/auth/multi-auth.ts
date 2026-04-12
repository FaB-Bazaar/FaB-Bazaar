/**
 * Shared Multi-Auth Helper
 *
 * Provides a unified authentication interface for API routes that need to support
 * multiple authentication methods: session, Discord bot, MCP token, and OAuth.
 *
 * This eliminates ~100 lines of duplicated auth code per route file.
 *
 * NOTE: This file now uses the service layer - no direct MongoDB access.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { userService, authTokenService } from '@/lib/services';
import jwt from 'jsonwebtoken';

/**
 * Result of an authentication attempt
 */
export interface AuthResult {
  success: boolean;
  userId?: string;
  username?: string;
  discordId?: string;
  authMethod?: 'session' | 'discordId' | 'oauth';
  error?: string;
}

/**
 * Parameters extracted from request for authentication
 */
interface AuthParams {
  discordId?: string | null;
  discordBotToken?: string | null;
  oauthToken?: string | null;
}

/**
 * Extract authentication parameters from request
 * Checks query params, body, and headers
 */
export function extractAuthParams(req: NextRequest, body: any = {}): AuthParams {
  const authHeader = req.headers.get('Authorization') || '';

  return {
    // Discord ID from header (preferred for Discord bot) or body
    // X-Discord-User-Id header is the requester's Discord ID for bot auth
    discordId:
      req.headers.get('X-Discord-User-Id') ||
      body.discordId,

    // Discord bot token from header or body (query params removed for security - URL leak risk)
    discordBotToken:
      req.headers.get('X-Discord-Bot-Token') ||
      body.discordBotToken,

    // OAuth token from Authorization header (non-MCP Bearer tokens)
    oauthToken:
      authHeader.startsWith('Bearer ') && !authHeader.startsWith('Bearer mcp_')
        ? authHeader.substring(7)
        : null,
  };
}

/**
 * Verify a Discord bot token by checking against env and optionally validating with Discord API
 */
export async function verifyDiscordBotToken(token: string): Promise<boolean> {
  const expectedBotToken = process.env.DISCORD_BOT_TOKEN;

  if (!expectedBotToken) {
    console.log('[MultiAuth] No DISCORD_BOT_TOKEN configured');
    return false;
  }

  if (token !== expectedBotToken) {
    console.log('[MultiAuth] Discord bot token mismatch');
    return false;
  }

  // Skip Discord API validation for performance and reliability
  // The token matching the env variable is sufficient for server-to-server auth
  console.log('[MultiAuth] Discord bot token matched environment variable');

  // Optionally validate with Discord API (disabled by default for performance)
  const validateWithDiscordApi = process.env.DISCORD_VALIDATE_TOKEN_WITH_API === 'true';
  if (validateWithDiscordApi) {
    try {
      console.log('[MultiAuth] Validating Discord bot token with API...');
      const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${token}` },
      });
      console.log('[MultiAuth] Discord API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[MultiAuth] Discord API returned non-OK status:', response.status, errorText);
        return false;
      }

      console.log('[MultiAuth] Discord bot token validated successfully with API');
    } catch (error) {
      console.error('[MultiAuth] Failed to validate bot token with Discord API:', error);
      return false;
    }
  }

  return true;
}

/**
 * Validate an OAuth 2.1 Bearer token (JWT)
 * Used by /api/wants/get for OAuth clients
 */
async function validateOAuthToken(
  token: string
): Promise<{ valid: boolean; user?: any }> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[MultiAuth] JWT_SECRET not configured for OAuth validation');
      return { valid: false };
    }

    // Verify JWT signature and decode payload
    const payload = jwt.verify(token, secret) as { sub?: string; exp?: number };

    if (!payload.sub) {
      return { valid: false };
    }

    // Look up user using service layer
    const result = await userService.findById(payload.sub);

    if (!result.success || !result.data) {
      return { valid: false };
    }

    return { valid: true, user: result.data };
  } catch (error) {
    // jwt.verify throws on invalid signature, expired token, malformed token, etc.
    if (error instanceof jwt.JsonWebTokenError) {
      console.log('[MultiAuth] JWT validation failed:', error.message);
    }
    return { valid: false };
  }
}

/**
 * Authenticate a request using multiple methods in priority order:
 * 1. NextAuth session (web client)
 * 2. Discord bot token + Discord ID (server-to-server from Discord bot)
 * 3. OAuth 2.1 Bearer token (optional, for wants/get)
 *
 * @param req - The Next.js request object
 * @param body - Optional parsed request body (for POST/PUT/PATCH requests)
 * @param options - Optional configuration
 * @returns AuthResult with success status and user info
 */
export async function authenticateRequest(
  req: NextRequest,
  body: any = {},
  options: { allowOAuth?: boolean } = {}
): Promise<AuthResult> {
  try {
    // 1. Try NextAuth session (web client)
    const session = await auth();
    if (session?.user?.id) {
      const result = await userService.findById(session.user.id);

      return {
        success: true,
        userId: session.user.id,
        username: result.data?.username || result.data?.discordUsername || 'Unknown',
        discordId: result.data?.discordId,
        authMethod: 'session',
      };
    }

    // Extract auth params from request
    const { discordId, discordBotToken, oauthToken } = extractAuthParams(req, body);

    // 2. Try Discord bot auth (server-to-server)
    if (discordId && discordBotToken) {
      console.log('[MultiAuth] Discord bot auth attempt - discordId:', discordId);
      const isValidBot = await verifyDiscordBotToken(discordBotToken);

      if (!isValidBot) {
        console.error('[MultiAuth] Discord bot token validation failed');
        return { success: false, error: 'Discord bot authentication failed' };
      }

      console.log('[MultiAuth] Discord bot token valid, looking up user...');
      const result = await userService.findByDiscordId(discordId);

      if (!result.success || !result.data) {
        console.error('[MultiAuth] User not found for Discord ID:', discordId);
        return { success: false, error: 'User not found for Discord ID' };
      }

      console.log('[MultiAuth] Discord bot auth successful for user:', result.data.username);
      return {
        success: true,
        userId: result.data._id,
        username: result.data.username || result.data.discordUsername,
        discordId: result.data.discordId,
        authMethod: 'discordId',
      };
    }

    // 3. Try OAuth token (if enabled)
    if (options.allowOAuth && oauthToken) {
      // fab_ prefix = opaque bearer token stored in DB (MCP/admin-generated)
      if (oauthToken.startsWith('fab_')) {
        const result = await authTokenService.validateBearerToken(oauthToken);
        if (!result.success || !result.data) {
          return { success: false, error: 'OAuth token invalid or expired' };
        }
        const user = result.data;
        return {
          success: true,
          userId: user._id,
          username: user.username || user.discordUsername,
          authMethod: 'oauth',
        };
      }

      // Otherwise treat as JWT OAuth token
      const { valid, user } = await validateOAuthToken(oauthToken);

      if (!valid || !user) {
        return { success: false, error: 'OAuth token invalid or expired' };
      }

      return {
        success: true,
        userId: user._id,
        username: user.username || user.discordUsername,
        discordId: user.discordId,
        authMethod: 'oauth',
      };
    }

    // No valid authentication found
    return { success: false, error: 'No valid authentication provided' };
  } catch (error) {
    console.error('[MultiAuth] Authentication error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
}

/**
 * Check if request has any auth params (without opening DB connection)
 * Use this to short-circuit auth for public endpoints
 */
export function hasAuthParams(req: NextRequest, body: any = {}): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  const cookieHeader = req.headers.get('Cookie') || '';

  // Check for session cookie (NextAuth)
  const hasSessionCookie = cookieHeader.includes('authjs.session-token') ||
                           cookieHeader.includes('__Secure-authjs.session-token');

  // Check for other auth params (query params removed for security - URL leak risk)
  const hasMcpToken = !!(authHeader.startsWith('Bearer mcp_'));
  const hasDiscordId = !!body.discordId;
  const hasDiscordBotToken = !!(req.headers.get('X-Discord-Bot-Token') || body.discordBotToken);
  const hasOAuthToken = authHeader.startsWith('Bearer ') && !authHeader.startsWith('Bearer mcp_');

  return hasSessionCookie || hasMcpToken || hasDiscordId || hasDiscordBotToken || hasOAuthToken;
}

/**
 * Simple session-only authentication for routes that don't need multi-auth
 */
export async function authenticateSession(): Promise<AuthResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const result = await userService.findById(session.user.id);

    return {
      success: true,
      userId: session.user.id,
      username: result.data?.username || result.data?.discordUsername || 'Unknown',
      discordId: result.data?.discordId,
      authMethod: 'session',
    };
  } catch (error) {
    console.error('[MultiAuth] Session authentication error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
}
