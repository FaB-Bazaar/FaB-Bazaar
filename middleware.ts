// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Initialize the Auth.js function with your config. This gives us the `auth` object.
const { auth } = NextAuth(authConfig);

// Define constants for the authentication logic
const protectedPaths = ["/create", "/agreements", "/agreement/create", "/profile"];
const authPages = ["/auth/login", "/auth/signup", "/login", "/signup"];

// Global circuit-breaker rate limiter (in-memory, per-instance).
// Trips only on clearly abusive traffic — humans never see it.
const requestTracker = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 1000;

function isRateLimited(req: NextRequest): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.ip || 'unknown';
  const now = Date.now();

  const requests = requestTracker.get(ip) || [];
  const recentRequests = requests.filter(time => now - time < RATE_WINDOW_MS);
  recentRequests.push(now);
  requestTracker.set(ip, recentRequests);

  if (requestTracker.size > 5000) {
    const oldestKey = requestTracker.keys().next().value;
    if (oldestKey) requestTracker.delete(oldestKey);
  }

  return recentRequests.length > RATE_MAX_REQUESTS;
}

// Export the default middleware function, wrapped by the `auth` helper.
// The `req` object passed to this function will automatically have an `req.auth` property if the user is logged in.
export default auth(async function middleware(req) {
  const startTime = Date.now();
  const { pathname } = req.nextUrl;
  const userAgent = req.headers.get('user-agent') || '';

  // Log middleware invocation (helps track optimization impact)
  const userAgentShort = userAgent || 'unknown';
  console.log(`[MW] ${req.method} ${pathname}`, {
    ua: userAgentShort.slice(0, 100), // First 100 chars of user agent
    ip: req.headers.get('x-forwarded-for')?.split(',')[0] || req.ip || 'unknown'
  });

  // Global rate-limit circuit breaker. Trips only on clearly abusive traffic.
  if (isRateLimited(req)) {
    const isApi = pathname.startsWith('/api/');
    console.log(`[RATE LIMIT] Blocked ${req.headers.get('x-forwarded-for')?.split(',')[0] || req.ip || 'unknown'} on ${pathname}`);
    return new NextResponse(
      isApi ? JSON.stringify({ error: 'Too many requests' }) : 'Too Many Requests',
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'Content-Type': isApi ? 'application/json' : 'text/plain',
        },
      }
    );
  }

  // ===================================================================
  // PART 1: Your custom Claude MCP Proxy Logic (Runs First)
  // This logic is highly specific and should take precedence.
  // If a request matches these conditions, it will be handled and a response
  // will be returned immediately, skipping the auth logic below.
  // ===================================================================
  if (pathname === '/' && userAgent.includes('Claude-User')) {
    const timestamp = new Date().toISOString();
    console.log(`🎯 [${timestamp}] CLAUDE MCP REQUEST INTERCEPTED`);
    
    // --- POST Method for MCP Server forwarding ---
    if (req.method === 'POST') {
      try {
        const body = await req.text();
        // (Your detailed logging here)
        
        const mcpUrl = new URL('/api/mcp/server', req.url);
        
        const forwardHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
        };
        const cookie = req.headers.get('cookie');
        if (cookie) forwardHeaders['Cookie'] = cookie;
        
        const forwardResponse = await fetch(mcpUrl.toString(), {
          method: 'POST',
          headers: forwardHeaders,
          body: body
        });
        
        const responseData = await forwardResponse.json();
        return new NextResponse(JSON.stringify(responseData), {
          status: forwardResponse.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (error) {
        console.error('❌ Middleware POST error:', error);
        return new NextResponse(JSON.stringify({ error: 'Middleware forward failed' }), { status: 500 });
      }
    }
    
    // --- GET Method for MCP Server status/SSE ---
    if (req.method === 'GET') {
      const accept = req.headers.get('accept') || '';
      if (accept.includes('text/event-stream')) {
        return new NextResponse('data: {"message":"FabBazaar MCP Server Connected"}\\n\\n', {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
        });
      }
      return new NextResponse('FabBazaar MCP Server', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    
    // --- OPTIONS Method for CORS ---
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie' }
      });
    }
  }

  // ===================================================================
  // PART 2: Forums Feature Flag (Block in Production)
  // Forums are in development - hide from production users for now
  // To enable forums in production: set ENABLE_FORUMS=true in your .env
  // ===================================================================
  const isDevelopment = process.env.NODE_ENV === 'development';
  const forumsEnabled = process.env.ENABLE_FORUMS === 'true';
  const isForumRoute = pathname.startsWith('/forums');

  // Block forums only in production when not explicitly enabled
  if (isForumRoute && !isDevelopment && !forumsEnabled) {
    // Redirect to 404 - forums not enabled in production yet
    return NextResponse.redirect(new URL('/404', req.url));
  }

  // ===================================================================
  // PART 3: Auth.js Authentication & Authorization Logic
  // This logic will run for ALL requests that were NOT handled by the
  // Claude MCP logic or forums block above.
  // Note: Discord bot authentication is handled by individual API routes
  // using authenticateRequest() from lib/auth/multi-auth.ts which properly
  // validates bot tokens via Discord API.
  // ===================================================================
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;

  // New user profile completion redirect
  const isNewUser = !!req.auth?.user?.isNewUser;
  const isCompletingProfile = nextUrl.pathname === "/auth/complete-profile";

  if (isNewUser && !isCompletingProfile) {
    const suggestedUsername = req.auth?.user?.username || "";
    const discordUsername = req.auth?.user?.discordUsername || "";
    return Response.redirect(new URL(`/auth/complete-profile?username=${suggestedUsername}&discord=${discordUsername}`, nextUrl));
  }

  // Protected route logic
  const isProtectedPath = protectedPaths.some(path => nextUrl.pathname.startsWith(path));
  if (isProtectedPath && !isLoggedIn) {
    const callbackUrl = nextUrl.pathname + nextUrl.search;
    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    return Response.redirect(new URL(`/auth/login?callbackUrl=${encodedCallbackUrl}`, nextUrl));
  }

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && authPages.includes(nextUrl.pathname)) {
    return Response.redirect(new URL("/discord", nextUrl));
  }

  // If none of the above conditions are met, allow the request to proceed.
  return;
});


// ===================================================================
// The Middleware Matcher Configuration
// Now also matches /api/* so the rate-limit circuit breaker covers them.
// The auth wrapper's session lookup is a fast no-op when no session
// cookie is present (token-authed API calls), so the added cost is negligible.
// ===================================================================
export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - /_next/static (static files)
     * - /_next/image (image optimization)
     * - Static files: manifest.json, robots.txt, ads.txt, sitemap.xml
     * - /.well-known/* (MCP manifest, etc.)
     * - Image files: *.png, *.svg, *.webp, *.jpg, *.jpeg, *.ico
     * - favicon files
     */
    '/((?!_next/static|_next/image|favicon|manifest\\.json|robots\\.txt|ads\\.txt|sitemap\\.xml|\\.well-known|.*\\.(?:png|svg|webp|jpg|jpeg|ico)).*)',
  ],
};
