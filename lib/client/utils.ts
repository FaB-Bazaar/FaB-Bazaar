/**
 * Client-Side API Utilities
 *
 * Shared helper functions for client services.
 * These utilities ensure consistent query param building, response parsing, and error handling.
 */

import type { ApiResponse, ApiError } from './types';

/**
 * Build URLSearchParams from an object, filtering out undefined/null values
 *
 * @param params - Object with query parameters
 * @returns URLSearchParams instance
 *
 * @example
 * ```typescript
 * const params = buildQueryParams({
 *   page: 1,
 *   search: 'command',
 *   rarity: undefined  // This will be filtered out
 * });
 * // Result: "page=1&search=command"
 * ```
 */
export function buildQueryParams(
  params: Record<string, any>
): URLSearchParams {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      // Handle arrays (multi-value params)
      if (Array.isArray(value)) {
        value.forEach((item) => {
          searchParams.append(key, String(item));
        });
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  return searchParams;
}

/**
 * Parse and handle API response
 * Converts fetch Response to ApiResponse<T> format
 *
 * @param response - Fetch Response object
 * @returns Parsed ApiResponse
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/binders/123');
 * const result = await handleResponse<BinderDTO>(response);
 *
 * if (result.success) {
 *   console.log(result.data); // BinderDTO
 * } else {
 *   console.error(result.error); // Error message
 * }
 * ```
 */
export async function handleResponse<T>(
  response: Response
): Promise<ApiResponse<T>> {
  try {
    // Try to parse JSON body
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      // Extract error message from various possible formats
      const errorMessage =
        data?.error ||
        data?.message ||
        `HTTP ${response.status}: ${response.statusText}`;

      return {
        success: false,
        error: errorMessage,
        code: data?.code || `HTTP_${response.status}`,
      };
    }

    // Handle both { success: true, data: T } and direct T responses
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success === true && 'data' in data) {
        return { success: true, data: data.data };
      } else if (data.success === false) {
        return {
          success: false,
          error: data.error || 'Unknown error',
          code: data.code,
        };
      }
    }

    // Direct data response (legacy format)
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse response',
    };
  }
}

/**
 * Handle fetch errors (network errors, timeouts, etc.)
 *
 * @param error - Error object
 * @returns ApiResponse with error details
 *
 * @example
 * ```typescript
 * try {
 *   const response = await fetch('/api/...');
 *   return handleResponse(response);
 * } catch (error) {
 *   return handleError(error);
 * }
 * ```
 */
export function handleError<T>(error: unknown): ApiResponse<T> {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      success: false,
      error: 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      code: 'CLIENT_ERROR',
    };
  }

  return {
    success: false,
    error: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Create a standard API error object
 *
 * @param message - Error message
 * @param code - Optional error code
 * @param statusCode - Optional HTTP status code
 * @returns ApiError object
 */
export function createApiError(
  message: string,
  code?: string,
  statusCode?: number
): ApiError {
  return {
    message,
    code,
    statusCode,
  };
}

/**
 * Check if a value is an ApiResponse with success=true
 *
 * @param response - Value to check
 * @returns Type guard for successful ApiResponse
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is { success: true; data: T } {
  return response.success === true;
}

/**
 * Check if a value is an ApiResponse with success=false
 *
 * @param response - Value to check
 * @returns Type guard for error ApiResponse
 */
export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is { success: false; error: string; code?: string } {
  return response.success === false;
}
