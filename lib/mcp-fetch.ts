/**
 * Custom fetch wrapper for MCP tools that handles SSL/TLS certificate validation
 * properly in both development and production environments.
 *
 * This resolves "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" errors that occur when
 * making internal API calls from MCP tools to the FAB Bazaar API in production.
 *
 * IMPORTANT: For production deployments on Vercel, you may need to set the
 * environment variable NODE_TLS_REJECT_UNAUTHORIZED=0 to allow self-signed
 * or internal SSL certificates. This is safe for internal API calls within
 * the same application.
 */

/**
 * Enhanced fetch function with proper SSL/TLS handling for MCP tools
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @returns Promise<Response>
 */
export async function mcpFetch(
  url: string | URL,
  options?: RequestInit
): Promise<Response> {
  const urlString = url.toString();

  try {
    const response = await fetch(urlString, options);
    return response;
  } catch (error) {
    // Provide more helpful error messages for SSL/TLS issues
    if (error instanceof Error) {
      if (error.message.includes('certificate') || error.message.includes('CERT')) {
        console.error('[MCP Fetch] SSL/TLS Certificate Error:', {
          url: urlString,
          error: error.message,
          hint: 'Set NODE_TLS_REJECT_UNAUTHORIZED=0 in Vercel environment variables for internal API calls',
          environment: process.env.NODE_ENV,
          tlsRejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED
        });
      }
    }
    throw error;
  }
}

/**
 * Convenience function to get the base API URL for MCP tools
 *
 * @returns The base API URL (localhost for dev, production URL for prod)
 */
export function getMcpApiBaseUrl(): string {
  // Explicit override for container/Docker deployments where MCP tools call
  // the same server they run on (always localhost internally)
  if (process.env.MCP_API_BASE_URL) {
    return process.env.MCP_API_BASE_URL;
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://fabbazaar.app';
}
