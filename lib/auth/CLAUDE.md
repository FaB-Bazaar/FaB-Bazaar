# Authentication

Multi-auth support. All auth methods handled by `authenticateRequest()` — see root CLAUDE.md for the priority table.

## Usage

```typescript
import { authenticateRequest, authenticateSession } from '@/lib/auth/multi-auth';

// Full multi-auth (API routes)
const authResult = await authenticateRequest(request, body);
// Returns: authResult.userId, authResult.username, authResult.authMethod

// Session-only (web routes)
const authResult = await authenticateSession();
```

## Key Functions

- `authenticateRequest()` — Full multi-auth chain
- `authenticateSession()` — NextAuth session only
- `validateMcpToken()` — MCP token validation
- `validateOAuthToken()` — OAuth 2.1 JWT validation
