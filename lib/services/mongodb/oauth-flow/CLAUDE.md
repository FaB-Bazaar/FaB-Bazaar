# OAuth Flow Service

**Added:** 2026-01-15
**Purpose:** OAuth 2.1 protocol implementation for authorization code flow, token exchange, and client registration
**Security:** CRITICAL - Handles authentication flows, PKCE validation, and token generation

> ⚠️ **Note**: This is the MongoDB reference implementation (deprecated). The active PostgreSQL implementation is at `lib/services/postgres/oauth-flow/PostgresOAuthFlowService.ts`.

---

## Overview

The `OAuthFlowService` implements the OAuth 2.1 authorization framework including:
- **Authorization Code Flow** with PKCE support
- **Client Credentials Grant** for server-to-server authentication
- **Refresh Token Grant** for token renewal
- **Dynamic Client Registration** (RFC 7591)

**Important:** This service is separate from `IOAuthService`, which handles user-scoped client CRUD operations.

---

## Architecture

```
Service Separation:
┌─────────────────────────────────────────┐
│ oauthService (IOAuthService)            │
│ - User's personal OAuth clients         │
│ - CRUD operations (list, create, revoke)│
│ - Similar to GitHub personal tokens     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ oauthFlowService (IOAuthFlowService)    │
│ - OAuth 2.1 protocol implementation     │
│ - Authorization code flow               │
│ - Token exchange & generation           │
│ - PKCE validation                       │
│ - Dynamic client registration           │
└─────────────────────────────────────────┘
```

---

## Service Interface

```typescript
import { oauthFlowService } from '@/lib/services';

// All methods return AsyncResult<T>
type AsyncResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

---

## Methods

See `lib/services/contracts/IOAuthFlowService.ts` for the full typed interface.

### `validateClient(clientId, redirectUri?, clientSecret?)`
Validates a client ID, optional redirect URI against the registered list, and optional secret for confidential clients.

### `createAuthorizationCode(input)`
Generates a single-use authorization code. Expires in 10 minutes. Stores PKCE challenge if provided.

### `exchangeAuthorizationCode(input)`
Exchanges an authorization code for access + refresh tokens. Enforces single-use atomically, validates PKCE if a challenge was stored, and checks redirect URI binding.

### `generateClientCredentialsToken(clientId, clientSecret, scope)`
Issues an access token for server-to-server flows. No refresh token is returned.

### `refreshAccessToken(refreshToken, clientId)`
Issues a new token pair given a valid refresh token. Validates JWT signature and DB record.

### `registerClient(input)`
Registers a new OAuth client (RFC 7591). Redirect URIs must use HTTPS or localhost. Client secret is returned once and never stored in plaintext.

### `validatePKCE(codeVerifier, codeChallenge)`
Verifies a PKCE code_verifier against a stored code_challenge using SHA-256.

---

## Security Properties

- Authorization codes are single-use and expire in 10 minutes
- Client secrets are stored as bcrypt hashes (never plaintext)
- PKCE is required for public clients (`token_endpoint_auth_method = 'none'`)
- Redirect URIs are validated against the registered list at both authorize and exchange steps
- Access tokens expire in 1 hour; refresh tokens expire in 30 days
- Dynamic registration requires HTTPS or localhost redirect URIs

---

## Routes Using This Service

| Route | Grant Type | Key Service Methods |
|-------|------------|---------------------|
| `/oauth/authorize` | Authorization Code | `validateClient`, `createAuthorizationCode` |
| `/oauth/token` (authorization_code) | Authorization Code | `exchangeAuthorizationCode` |
| `/oauth/token` (client_credentials) | Client Credentials | `generateClientCredentialsToken` |
| `/oauth/token` (refresh_token) | Refresh Token | `refreshAccessToken` |
| `/oauth/register` | N/A | `registerClient` |

---

## Testing

```typescript
import { ServiceFactory } from '@/lib/services';

const mockOAuthFlowService = {
  validateClient: jest.fn(),
  exchangeAuthorizationCode: jest.fn(),
};

ServiceFactory.setOAuthFlowService(mockOAuthFlowService);
```

---

## Related Documentation

- **OAuth Service** (user client CRUD): `lib/services/contracts/IOAuthService.ts`
- **Auth Token Service** (token validation): `lib/services/contracts/IAuthTokenService.ts`
- **Service Layer Architecture**: `lib/services/CLAUDE.md`
- **OAuth 2.1 Specification**: https://oauth.net/2.1/
