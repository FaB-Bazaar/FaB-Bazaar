// NOTE: This file is dead code and does nothing.
// Next.js dropped support for route-level _middleware.ts files after v11.
// The underscore prefix causes Next.js to ignore this file entirely.
// CORS headers for MCP routes should be handled in the root middleware.ts
// or directly in the individual API route handlers if needed.
// Commented out 2026-02-22 — safe to delete if no issues arise.

// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';

// export function middleware(request: NextRequest) {
//   const response = NextResponse.next();
//   response.headers.set('Access-Control-Allow-Origin', 'https://claude.ai');
//   response.headers.set('Access-Control-Allow-Credentials', 'true');
//   response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
//   response.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
//   return response;
// }

// export const config = {
//   matcher: ['/api/mcp/:path*'],
// };
