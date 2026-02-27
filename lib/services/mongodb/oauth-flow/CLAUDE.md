# OAuth Flow Service

**Added:** 2026-01-15
**Purpose:** OAuth 2.1 protocol implementation for authorization code flow, token exchange, and client registration
**Security:** CRITICAL - Handles authentication flows, PKCE validation, and token generation

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

### 1. Client Validation

#### `validateClient(clientId, redirectUri?, clientSecret?)`

Validates OAuth client credentials and redirect URIs.

**Parameters:**
- `clientId` (string) - The client ID
- `redirectUri?` (string) - Optional redirect URI to validate
- `clientSecret?` (string) - Optional client secret for confidential clients

**Returns:** `AsyncResult<OAuthClientDTO>`

**Example:**
```typescript
const result = await oauthFlowService.validateClient(
  'mcp_abc123',
  'https://example.com/callback'
);

if (result.success) {
  console.log(`Valid client: ${result.data.client_name}`);
}
```

**Security Checks:**
- Client exists in database
- Client secret matches (if provided, for confidential clients)
- Redirect URI is in registered list (if provided)

---

### 2. Authorization Code Flow

#### `createAuthorizationCode(input)`

Generates and stores a single-use authorization code.

**Parameters:**
```typescript
{
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;     // For PKCE
  codeChallengeMethod?: string; // 'S256'
}
```

**Returns:** `AsyncResult<{ code: string; expiresAt: Date }>`

**Security:**
- Code expires in **10 minutes**
- Cryptographically secure random generation
- Stored with `used: false` flag

**Example:**
```typescript
const result = await oauthFlowService.createAuthorizationCode({
  clientId: 'mcp_abc123',
  userId: 'user_xyz',
  redirectUri: 'https://example.com/callback',
  scope: 'read write',
  codeChallenge: 'sha256_hash_of_verifier',
  codeChallengeMethod: 'S256'
});
```

---

#### `exchangeAuthorizationCode(input)`

Exchanges authorization code for access and refresh tokens.

**Parameters:**
```typescript
{
  code: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  codeVerifier?: string; // For PKCE
}
```

**Returns:** `AsyncResult<TokenResponseDTO>`

**TokenResponseDTO:**
```typescript
{
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;      // 3600 (1 hour)
  refresh_token?: string;
  scope?: string;
}
```

**Security (CRITICAL):**
1. **Atomic Code Consumption:** Uses `findOneAndUpdate` to mark code as used
2. **PKCE Validation:** If code_challenge exists, verifies code_verifier
3. **Expiration Check:** Rejects expired codes
4. **Redirect URI Match:** Validates redirect_uri matches authorization request
5. **Client Validation:** Verifies client credentials

**Example:**
```typescript
const result = await oauthFlowService.exchangeAuthorizationCode({
  code: 'auth_xyz123',
  clientId: 'mcp_abc123',
  redirectUri: 'https://example.com/callback',
  codeVerifier: 'random_verifier_43_to_128_chars'
});

if (result.success) {
  const { access_token, refresh_token } = result.data;
}
```

---

### 3. Client Credentials Grant

#### `generateClientCredentialsToken(clientId, clientSecret, scope)`

Generates access token for server-to-server authentication.

**Parameters:**
- `clientId` (string)
- `clientSecret` (string)
- `scope` (string)

**Returns:** `AsyncResult<TokenResponseDTO>` (no refresh_token)

**Use Cases:**
- Server-to-server API calls
- Automated scripts
- Personal clients (user context included in token)

**Example:**
```typescript
const result = await oauthFlowService.generateClientCredentialsToken(
  'mcp_abc123',
  'secret_xyz',
  'read write'
);

if (result.success) {
  console.log(`Access token: ${result.data.access_token}`);
}
```

**Personal Clients:**
If the client has a `user_id` field, the token includes user context:
```typescript
// Token payload for personal client
{
  sub: 'user_id',      // User's ID
  client_id: 'mcp_abc',
  scope: 'read write',
  type: 'access_token'
}
```

---

### 4. Refresh Token Grant

#### `refreshAccessToken(refreshToken, clientId)`

Generates new access and refresh tokens using an existing refresh token.

**Parameters:**
- `refreshToken` (string) - JWT refresh token
- `clientId` (string)

**Returns:** `AsyncResult<TokenResponseDTO>`

**Security:**
- Verifies JWT signature
- Checks token exists in database
- Validates client ID matches
- Generates new token pair
- Updates database atomically

**Example:**
```typescript
const result = await oauthFlowService.refreshAccessToken(
  'refresh_jwt_token',
  'mcp_abc123'
);
```

---

### 5. Dynamic Client Registration

#### `registerClient(input)`

Registers a new OAuth client dynamically (RFC 7591).

**Parameters:**
```typescript
{
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method?: 'none' | 'client_secret_post';
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  client_uri?: string;
}
```

**Returns:** `AsyncResult<RegisterClientResultDTO>`

**RegisterClientResultDTO:**
```typescript
{
  client_id: string;
  client_secret?: string;  // Only for confidential clients
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  scope: string;
}
```

**Security:**
- **HTTPS or localhost only** for redirect URIs
- Cryptographically secure credential generation
- `client_secret` only returned once (store it!)

**Example:**
```typescript
const result = await oauthFlowService.registerClient({
  client_name: 'My App',
  redirect_uris: ['https://myapp.com/callback'],
  token_endpoint_auth_method: 'client_secret_post'
});

if (result.success) {
  console.log(`Client ID: ${result.data.client_id}`);
  console.log(`Client Secret: ${result.data.client_secret}`);
  // SAVE THE SECRET - it won't be shown again!
}
```

---

### 6. Helper Methods

#### `validatePKCE(codeVerifier, codeChallenge)`

Validates PKCE code_verifier against code_challenge using SHA-256.

**Parameters:**
- `codeVerifier` (string) - 43-128 character random string
- `codeChallenge` (string) - base64url(sha256(codeVerifier))

**Returns:** `boolean`

**Example:**
```typescript
const isValid = oauthFlowService.validatePKCE(
  'random_verifier_string',
  'base64url_encoded_sha256_hash'
);
```

---

#### `generateAccessToken(userId, clientId, scope)`

Generates JWT access token (1 hour expiration).

**Parameters:**
- `userId` (string) - User ID or client ID for client_credentials
- `clientId` (string)
- `scope` (string)

**Returns:** `string` (JWT)

---

#### `generateRefreshToken(userId, clientId, scope)`

Generates JWT refresh token (30 day expiration).

---

## Security Best Practices

### 1. Authorization Code Flow
✅ **Always use PKCE** for public clients (mobile apps, SPAs)
✅ **Use client_secret** for confidential clients (server-side apps)
✅ **Validate redirect_uri** on both authorization and token requests
✅ **10-minute code expiration** prevents replay attacks
✅ **Single-use codes** enforced atomically

### 2. Token Storage
✅ **Store tokens in database** for revocation support
✅ **1-hour access token** expiration
✅ **30-day refresh token** expiration
✅ **Update last_used** timestamp for audit trails

### 3. Client Registration
✅ **HTTPS or localhost only** for redirect URIs
✅ **Cryptographically secure** client credentials
✅ **Client secret shown once** during registration

---

## Migration from Direct DB Access

### Before (app/oauth/token/route.ts)
```typescript
// ❌ Direct database access, manual validation
const authCode = await db.collection('oauth_authorization_codes').findOne({
  code: code,
  client_id: clientId,
  used: false
});

if (!authCode) { /* ... */ }
if (new Date() > authCode.expires_at) { /* ... */ }
if (authCode.code_challenge) {
  if (!validatePKCE(codeVerifier, authCode.code_challenge)) { /* ... */ }
}

await db.collection('oauth_authorization_codes').updateOne(
  { _id: authCode._id },
  { $set: { used: true, used_at: new Date() } }
);

const accessToken = generateAccessToken(/* ... */);
await db.collection('oauth_access_tokens').insertOne(/* ... */);
```

### After (Service Layer)
```typescript
// ✅ Single service call, all security handled internally
const result = await oauthFlowService.exchangeAuthorizationCode({
  code,
  clientId,
  redirectUri,
  codeVerifier
});

if (result.success) {
  const { access_token, refresh_token } = result.data;
}
```

**Benefits:**
- **100+ lines → 10 lines**
- Security logic centralized and tested
- Atomic operations guaranteed
- Database-agnostic (ready for SQL migration)
- Easily mockable for testing

---

## Error Handling

All service methods return `AsyncResult<T>` with descriptive error messages:

```typescript
const result = await oauthFlowService.exchangeAuthorizationCode(input);

if (!result.success) {
  // Error messages map to OAuth error codes
  if (result.error.includes('expired')) {
    return { error: 'invalid_grant', error_description: result.error };
  }
  if (result.error.includes('credentials')) {
    return { error: 'invalid_client', error_description: result.error };
  }
}
```

**Common Error Messages:**
- `"Authorization code not found or already used"`
- `"Authorization code expired"`
- `"Invalid code_verifier"` (PKCE failure)
- `"Redirect URI mismatch"`
- `"Invalid client credentials"`
- `"Invalid refresh token"`
- `"Redirect URI must use HTTPS or localhost"`

---

## Collections Used

### `oauth_clients`
```typescript
{
  client_id: string;
  client_secret?: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
  scope: string;
  user_id?: ObjectId;    // For personal clients
  created_at: Date;
  last_used?: Date;
}
```

### `oauth_authorization_codes`
```typescript
{
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge?: string;
  code_challenge_method?: string;
  expires_at: Date;
  used: boolean;
  used_at?: Date;
  created_at: Date;
}
```

### `oauth_access_tokens`
```typescript
{
  access_token: string;
  refresh_token?: string;
  client_id: string;
  user_id?: string;
  scope: string;
  expires_at: Date;
  created_at: Date;
  updated_at?: Date;
}
```

---

## Routes Using This Service

| Route | Grant Type | Service Methods |
|-------|------------|-----------------|
| `/oauth/authorize` | Authorization Code | `validateClient`, `createAuthorizationCode` |
| `/oauth/token` (authorization_code) | Authorization Code | `exchangeAuthorizationCode` |
| `/oauth/token` (client_credentials) | Client Credentials | `generateClientCredentialsToken` |
| `/oauth/token` (refresh_token) | Refresh Token | `refreshAccessToken` |
| `/oauth/register` | N/A | `registerClient` |

---

## Testing

### Unit Testing with Mocks
```typescript
import { ServiceFactory } from '@/lib/services';

const mockOAuthFlowService = {
  validateClient: jest.fn(),
  exchangeAuthorizationCode: jest.fn(),
};

ServiceFactory.setOAuthFlowService(mockOAuthFlowService);

// Test authorization code exchange
mockOAuthFlowService.exchangeAuthorizationCode.mockResolvedValue({
  success: true,
  data: {
    access_token: 'test_token',
    token_type: 'Bearer',
    expires_in: 3600
  }
});
```

---

## Related Documentation

- **OAuth Service** (user client CRUD): `lib/services/contracts/IOAuthService.ts`
- **Auth Token Service** (token validation): `lib/services/contracts/IAuthTokenService.ts`
- **OAuth Routes**: `app/oauth/*/CLAUDE.md`
- **Service Layer Architecture**: `lib/services/CLAUDE.md`

---

## Key Takeaways

✅ **All OAuth 2.1 flows** implemented in one service
✅ **Security-critical logic** centralized and tested
✅ **PKCE support** for public clients
✅ **Atomic operations** prevent authorization code reuse
✅ **Database-agnostic** architecture
✅ **RFC 7591 compliant** dynamic client registration
✅ **JWT-based tokens** with configurable expiration
✅ **Ready for SQL migration** - just swap the implementation

---

**Questions?** Check the OAuth 2.1 specification at https://oauth.net/2.1/ or review the service contract at `lib/services/contracts/IOAuthFlowService.ts`.
