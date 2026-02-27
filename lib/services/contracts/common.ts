/**
 * Common types used across all service contracts
 *
 * These types ensure consistent error handling and return values
 * across the entire service layer.
 */

/**
 * Result type for operations that can succeed or fail
 *
 * @example
 * ```typescript
 * const result: Result<User> = await userService.findById(id);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Async version of Result type for async operations
 */
export type AsyncResult<T> = Promise<Result<T>>;

/**
 * Options for database queries
 *
 * These options allow callers to customize query behavior
 * without exposing database-specific details.
 */
export interface QueryOptions {
  /**
   * Fields to include in the result
   * @example ['username', 'email', 'country']
   */
  select?: string[];

  /**
   * Relations to populate
   * @example 'local_stores' or ['local_stores', 'trading_stores']
   */
  populate?: string | string[];

  /**
   * Return plain objects instead of model instances
   */
  lean?: boolean;

  /**
   * Database transaction session
   * Used for atomic operations across multiple queries
   */
  session?: any; // Mongoose ClientSession or equivalent
}

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  /**
   * Number of records to skip
   */
  skip?: number;

  /**
   * Maximum number of records to return
   */
  limit?: number;

  /**
   * Sort order
   * @example { createdAt: -1, username: 1 }
   */
  sort?: Record<string, 1 | -1>;
}
