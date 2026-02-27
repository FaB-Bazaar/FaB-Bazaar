/**
 * Auth Service Contract
 *
 * This interface defines authentication-related operations that are database-agnostic.
 * Handles session/token creation and email hashing for duplicate checking.
 *
 * This is a DATABASE-AGNOSTIC contract - implementations should not depend on
 * any specific database technology.
 */

import type { AsyncResult } from './common';

/**
 * Auth Service Interface
 *
 * This contract defines methods for authentication operations.
 * These operations are intentionally database-agnostic.
 */
export interface IAuthService {
  /**
   * Hash an email for duplicate checking
   * Uses SHA256 on lowercase email
   *
   * @param email - The email to hash
   * @returns The SHA256 hash of the lowercase email
   *
   * @example
   * ```typescript
   * const hash = authService.hashEmail('User@Example.com');
   * // Returns same hash as for 'user@example.com'
   * ```
   */
  hashEmail(email: string): string;

  /**
   * Create a JWT token and set session cookie
   * Used for direct signup without NextAuth
   *
   * @param userId - The user's ID
   * @param username - The user's username
   * @returns Result containing the JWT token string
   *
   * @example
   * ```typescript
   * const result = await authService.createJWTSession('user123', 'johndoe');
   * if (result.success) {
   *   console.log('Session created');
   * }
   * ```
   */
  createJWTSession(userId: string, username: string): AsyncResult<string>;
}
