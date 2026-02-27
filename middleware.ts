// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Initialize the Auth.js function with your config. This gives us the `auth` object.
const { auth } = NextAuth(authConfig);

// Define constants for the authentication logic
const protectedPaths = ["/create", "/agreements", "/agreement/create", "/profile"];
const authPages = ["/auth/login", "/auth/signup", "/login", "/signup"];

// Simple in-memory rate limiter for bots
const botRequestTracker = new Map<string, number[]>();

function isAggressiveBot(req: NextRequest): boolean {
  const userAgent = (req.headers.get('user-agent') || '').toLowerCase();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.ip || 'unknown';
  const key = `${ip}-${userAgent.slice(0, 50)}`;

  const now = Date.now();
  const windowMs = 10000; // 10 second window
  const maxRequests = 150; // Max 150 requests per 10 seconds (Next.js fires many middleware invocations per page load)

  // Get recent requests for this IP/UA combo
  const requests = botRequestTracker.get(key) || [];
  const recentRequests = requests.filter(time => now - time < windowMs);

  // Add current request
  recentRequests.push(now);
  botRequestTracker.set(key, recentRequests);

  // Clean up old entries (memory management)
  if (botRequestTracker.size > 1000) {
    const oldestKey = Array.from(botRequestTracker.keys())[0];
    botRequestTracker.delete(oldestKey);
  }

  return recentRequests.length > maxRequests;
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

  // Rate limit aggressive bots
  if (isAggressiveBot(req)) {
    console.log(`[RATE LIMIT] Blocked aggressive bot: ${userAgentShort.slice(0, 50)}`);
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '60' }
    });
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
// Optimized to reduce unnecessary middleware invocations.
// Excludes static assets, API routes, and files that don't need auth.
// ===================================================================
export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - /api/* (API routes handle their own auth via authenticateRequest)
     * - /_next/static (static files)
     * - /_next/image (image optimization)
     * - Static files: manifest.json, robots.txt, ads.txt, sitemap.xml
     * - /.well-known/* (MCP manifest, etc.)
     * - Image files: *.png, *.svg, *.webp, *.jpg, *.jpeg, *.ico
     * - favicon files
     */
    '/((?!api|_next/static|_next/image|favicon|manifest\\.json|robots\\.txt|ads\\.txt|sitemap\\.xml|\\.well-known|.*\\.(?:png|svg|webp|jpg|jpeg|ico)).*)',
  ],
};
