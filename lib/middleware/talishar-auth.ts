// lib/middleware/talishar-auth.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limiting store (in-memory)
 * For production, use Redis or similar distributed cache
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,     // 100 requests per minute per API key
};

/**
 * Validates Talishar API request
 *
 * Checks:
 * 1. API key presence and validity
 * 2. User-Agent header (optional but recommended)
 * 3. Rate limiting
 * 4. Request logging
 *
 * @param request - Next.js request object
 * @returns Validation result with error response if invalid
 */
export async function validateTalisharRequest(
  request: NextRequest
): Promise<{ valid: true } | { valid: false; response: NextResponse }> {
  const url = new URL(request.url);

  // 1. Extract API key from header or query parameter
  const apiKey =
    request.headers.get('x-api-key') ||
    request.headers.get('x-talishar-key') ||
    url.searchParams.get('api_key');

  if (!apiKey) {
    console.warn('[Talishar API] Missing API key', {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      path: url.pathname,
    });

    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Missing API key. Include x-api-key header or api_key query parameter.'
        },
        { status: 401 }
      ),
    };
  }

  // 2. Validate API key against allowed keys
  const validKeys = [
    process.env.TALISHAR_API_KEY,
    process.env.TALISHAR_DEV_API_KEY,
    process.env.TALISHAR_STAGING_API_KEY,
  ].filter(Boolean);

  if (!validKeys.includes(apiKey)) {
    console.warn('[Talishar API] Invalid API key', {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      path: url.pathname,
      keyPrefix: apiKey.substring(0, 8) + '...',
    });

    return {
      valid: false,
      response: NextResponse.json(
        {
          success: false,
          error: 'Invalid API key'
        },
        { status: 403 }
      ),
    };
  }

  // 3. Optional: Validate User-Agent (helps identify legitimate Talishar requests)
  const userAgent = request.headers.get('user-agent') || '';
  const isTalisharClient = userAgent.toLowerCase().includes('talishar');

  if (!isTalisharClient && process.env.NODE_ENV === 'production') {
    console.warn('[Talishar API] Suspicious User-Agent', {
      userAgent,
      apiKey: apiKey.substring(0, 8) + '...',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });
  }

  // 4. Rate limiting
  const rateLimitKey = `${apiKey}:${request.headers.get('x-forwarded-for') || 'localhost'}`;
  const now = Date.now();

  let rateLimitData = rateLimitStore.get(rateLimitKey);

  if (!rateLimitData || rateLimitData.resetAt < now) {
    // Create new rate limit window
    rateLimitData = {
      count: 1,
      resetAt: now + RATE_LIMIT_CONFIG.windowMs,
    };
    rateLimitStore.set(rateLimitKey, rateLimitData);
  } else {
    // Increment count in current window
    rateLimitData.count++;

    if (rateLimitData.count > RATE_LIMIT_CONFIG.maxRequests) {
      console.warn('[Talishar API] Rate limit exceeded', {
        apiKey: apiKey.substring(0, 8) + '...',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        count: rateLimitData.count,
        limit: RATE_LIMIT_CONFIG.maxRequests,
      });

      const retryAfter = Math.ceil((rateLimitData.resetAt - now) / 1000);

      return {
        valid: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
            retryAfter
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': RATE_LIMIT_CONFIG.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': rateLimitData.resetAt.toString(),
            }
          }
        ),
      };
    }
  }

  // 5. Log successful request
  console.log('[Talishar API] Valid request', {
    apiKey: apiKey.substring(0, 8) + '...',
    path: url.pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: isTalisharClient ? 'Talishar' : userAgent,
    rateLimit: {
      count: rateLimitData.count,
      limit: RATE_LIMIT_CONFIG.maxRequests,
      remaining: RATE_LIMIT_CONFIG.maxRequests - rateLimitData.count,
    },
  });

  return { valid: true };
}

/**
 * Optional: Validate request origin for additional security
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // Allow requests from Talishar domains
  const allowedDomains = [
    'talishar.net',
    'www.talishar.net',
    'localhost', // For testing
  ];

  if (origin) {
    const originDomain = new URL(origin).hostname;
    return allowedDomains.some(domain => originDomain.includes(domain));
  }

  if (referer) {
    return allowedDomains.some(domain => referer.includes(domain));
  }

  // Allow requests without origin/referer (e.g., server-to-server)
  return true;
}
