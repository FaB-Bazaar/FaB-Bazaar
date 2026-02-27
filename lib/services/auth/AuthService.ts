/**
 * Auth Service Implementation
 *
 * This class implements the IAuthService contract.
 * It handles authentication operations that are database-agnostic,
 * such as JWT creation and email hashing.
 */

import * as crypto from 'crypto';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import type { IAuthService } from '../contracts/IAuthService';
import type { AsyncResult } from '../contracts/common';

export class AuthService implements IAuthService {
  /**
   * Hash an email for duplicate checking
   * Uses SHA256 on lowercase email
   *
   * @param email - The email to hash
   * @returns The SHA256 hash of the lowercase email
   */
  hashEmail(email: string): string {
    return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  }

  /**
   * Create a JWT token and set session cookie
   * Used for direct signup without NextAuth
   *
   * @param userId - The user's ID
   * @param username - The user's username
   * @returns Result containing the JWT token string
   */
  async createJWTSession(userId: string, username: string): AsyncResult<string> {
    try {
      const secretKey = process.env.JWT_SECRET;
      if (!secretKey) {
        return { success: false, error: 'JWT_SECRET not configured' };
      }

      const jwtKey = new TextEncoder().encode(secretKey);

      const token = await new SignJWT({ userId, username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(jwtKey);

      const cookieStore = await cookies();
      cookieStore.set('session', token, {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return { success: true, data: token };
    } catch (error) {
      console.error('[AuthService] createJWTSession error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create JWT session',
      };
    }
  }
}
