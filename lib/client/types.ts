/**
 * Client-Side API Types
 *
 * This file defines shared types used across all client services.
 * These types ensure consistent response handling and error management.
 */

/**
 * Standard API response wrapper
 * All client service methods return this format for consistent error handling
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * API error details
 */
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, any>;
}

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Common filter parameters
 */
export interface FilterParams {
  search?: string;
  [key: string]: any;
}
