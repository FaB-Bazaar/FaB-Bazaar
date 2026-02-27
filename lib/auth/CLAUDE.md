# Authentication

This directory contains multi-auth support for the platform.

## Migration Status

`multi-auth.ts` has been migrated to use `userService` from the service layer for all user lookups.

## Authentication Methods (Priority Order)

| Priority | Method | Use Case |
|----------|--------|----------|
| 1 | NextAuth Session | Web browser clients |
| 2 | Discord Bot Token | Discord bot server-to-server |
| 3 | MCP Token | Machine Client Protocol (external tools) |
| 4 | OAuth 2.1 Bearer | Third-party integrations |

## Usage

```typescript
import { authenticateRequest, authenticateSession } from '@/lib/auth/multi-auth';

// Full multi-auth (API routes)
const authResult = await authenticateRequest(request, body);
if (!authResult.success) {
  return NextResponse.json({ error: authResult.error }, { status: 401 });
}
// Use: authResult.userId, authResult.username, authResult.authMethod

// Session-only (web routes)
const authResult = await authenticateSession();
```

## Key Functions

- `authenticateRequest()` - Full multi-auth chain
- `authenticateSession()` - NextAuth session only
- `validateMcpToken()` - MCP token validation
- `validateOAuthToken()` - OAuth 2.1 JWT validation

## Related Files

- `lib/authOptions.ts` - NextAuth configuration
- `lib/services/auth/AuthService.ts` - JWT/password utilities
