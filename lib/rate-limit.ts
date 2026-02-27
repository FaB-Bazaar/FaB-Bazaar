// lib/rate-limit.ts
// Simple in-memory rate limiting (for production, use Redis)

interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetTime?: number;
  }
  
  interface RateLimitOptions {
    key: string;
    limit: number;
    window: number; // in milliseconds
  }
  
  // In-memory store (use Redis for production/multi-instance deployments)
  const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
  
  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000); // Clean up every minute
  
  export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
    const { key, limit, window } = options;
    const now = Date.now();
    const resetTime = now + window;
    
    // Get or create rate limit entry
    const existing = rateLimitStore.get(key);
    
    if (!existing || now > existing.resetTime) {
      // First request or window expired - reset
      rateLimitStore.set(key, { count: 1, resetTime });
      return {
        success: true,
        remaining: limit - 1,
        resetTime
      };
    }
    
    // Check if limit exceeded
    if (existing.count >= limit) {
      return {
        success: false,
        remaining: 0,
        resetTime: existing.resetTime
      };
    }
    
    // Increment count
    existing.count++;
    rateLimitStore.set(key, existing);
    
    return {
      success: true,
      remaining: limit - existing.count,
      resetTime: existing.resetTime
    };
  }
  
  // Helper for getting rate limit info without incrementing
  export async function getRateLimitInfo(key: string): Promise<{ remaining: number; resetTime?: number }> {
    const existing = rateLimitStore.get(key);
    const now = Date.now();
    
    if (!existing || now > existing.resetTime) {
      return { remaining: 200 }; // Default limit
    }
    
    return {
      remaining: Math.max(0, 200 - existing.count),
      resetTime: existing.resetTime
    };
  }
  
  // For production with Redis:
  /*
  import Redis from 'ioredis';
  
  const redis = new Redis(process.env.REDIS_URL);
  
  export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
    const { key, limit, window } = options;
    const windowStart = Math.floor(Date.now() / window) * window;
    const redisKey = `rate_limit:${key}:${windowStart}`;
    
    try {
      const current = await redis.incr(redisKey);
      
      if (current === 1) {
        // First request in this window - set expiry
        await redis.expire(redisKey, Math.ceil(window / 1000));
      }
      
      if (current > limit) {
        return {
          success: false,
          remaining: 0,
          resetTime: windowStart + window
        };
      }
      
      return {
        success: true,
        remaining: limit - current,
        resetTime: windowStart + window
      };
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - allow request if Redis is down
      return {
        success: true,
        remaining: limit,
      };
    }
  }
  */