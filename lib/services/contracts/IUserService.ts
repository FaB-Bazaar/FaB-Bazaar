/**
 * User Service Contract
 *
 * This interface defines all user-related data access operations.
 * Implementations must handle database connections and error handling.
 *
 * This is a DATABASE-AGNOSTIC contract - no MongoDB-specific types should appear here.
 */

import type { AsyncResult } from './common';

/**
 * Basic user data transfer object
 */
export interface UserDTO {
  _id: string;
  username?: string;
  discordUsername?: string;
  discordId?: string;
  discordAvatar?: string;
  avatarUrl?: string;
  email?: string;
  countryCode?: string;
  isStore?: boolean;
  storeId?: string;
  createdAt?: string;
  updatedAt?: string;
  // Role fields
  roles?: UserRolesDTO;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isLocalGamingStore?: boolean;
  isMetafySupporter?: boolean;
  isShop?: boolean;
  isTcgSeller?: boolean;
  /** Hosted-chat supporter tier ('free' | 'paid'). Gates Volzar. */
  metafySupporterTier?: string;
  /** Manual Volzar grant, superadmin-toggled on /admin/user-access. */
  volzarAccess?: boolean;
}

/**
 * Minimal flags needed to gate Volzar access (see
 * lib/ai/volzar-access.canUseVolzar). Fetched fresh from the DB by the
 * server gates so a revoked supporter loses access without waiting for their
 * session token to refresh.
 */
export interface VolzarAccessDTO {
  isSuperAdmin: boolean;
  metafySupporterTier: 'free' | 'paid';
  /** Manual superadmin grant (non-Metafy comp path). */
  volzarAccess: boolean;
}

/**
 * Basic user info DTO (for display purposes without sensitive fields)
 */
export interface UserBasicInfoDTO {
  _id: string;
  username?: string;
  discordUsername?: string;
  discordId?: string;
  avatarUrl?: string;
  /** ISO country code (users.country_code) — the impl always returned these;
   *  the DTO just never declared them. */
  countryCode?: string;
  /** Volzar localization override (users.preferred_language); null/absent = auto. */
  preferredLanguage?: string;
  isStore?: boolean;
}

/**
 * User roles data transfer object
 */
export interface UserRolesDTO {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isContentCreator: boolean;
  canManageLocations: boolean;
  canImportCardCollections: boolean;
  canModerateForums: boolean;
}

/**
 * Full user profile for /auth/me
 */
export interface UserProfileDTO {
  _id: string;
  username: string;
  email: string; // Decrypted
  discordUsername?: string;
  discordId?: string;
  createdAt: Date;
  roles: UserRolesDTO;
  isMetafySupporter: boolean;
  isCurator: boolean;
  isShop: boolean;
  isTcgSeller: boolean;
  metafyId?: string;
  metafyUsername?: string;
  metafyPartner?: boolean;
  /** Self-set location (coarse: country + state only) */
  countryCode?: string;
  stateCode?: string;
  /** Volzar localization override (users.preferred_language). */
  preferredLanguage?: string;
}

/**
 * Data for user creation (signup)
 */
export interface CreateUserDTO {
  username: string;
  email: string;
  password: string;
  discordId?: string;
  discordUsername?: string;
  discordAvatar?: string;
  isPasswordPreHashed?: boolean;
}

/**
 * Minimal user response after creation
 */
export interface CreatedUserDTO {
  _id: string;
  username: string;
  email: string; // Original email (not encrypted)
  discordUsername?: string;
}

/**
 * Extended user DTO with auth-related fields
 */
export interface UserAuthDTO {
  _id: string;
  username?: string;
  discordUsername?: string;
  discordId?: string;
  /** Manual Volzar grant — carried into the JWT roles on token refresh. */
  volzarAccess?: boolean;
}

/**
 * Public user profile with aggregated stats
 * Used by /users/profile/[username] endpoint
 */
export interface UserProfileStatsDTO {
  _id: string;
  username: string;
  discordUsername?: string;
  discordId?: string;
  discordAvatar?: string;
  createdAt: Date;
  binderStats: {
    public: number;
    unlisted: number;
    private: number;
    total: number;
  };
  wantsCount: number;
}

/**
 * Data for updating user profile
 * Used by /user/complete-profile endpoint
 */
export interface UpdateProfileDTO {
  username?: string;
  discordUsername?: string;
  bio?: string;
  location?: string;
  /** ISO country code — persisted to users.country_code */
  country?: string;
  /** State/region code — persisted to users.state_code */
  state?: string;
  /** Volzar language override — persisted to users.preferred_language ('' clears). */
  preferredLanguage?: string;
}

export interface MetafyCommunityDTO {
  communityId: string;
  title: string;
  tiers?: { id: string; name: string }[] | null;
}

/**
 * User Service Interface
 *
 * This contract defines the methods for user data access.
 * Any implementation (MongoDB, PostgreSQL, Supabase, etc.) must implement these methods.
 *
 * NOTE: Starting with just one method (getLocation) for the initial implementation.
 * More methods will be added as we migrate additional routes.
 */
export interface IUserService {
  /**
   * Find user by Discord username (case-insensitive)
   *
   * @param discordUsername - The Discord username to search for
   * @returns Result containing user data or null if not found
   *
   * @example
   * ```typescript
   * const result = await userService.findByDiscordUsername('SomeUser#1234');
   * if (result.success && result.data) {
   *   console.log(`Found user: ${result.data._id}`);
   * }
   * ```
   */
  findByDiscordUsername(discordUsername: string): AsyncResult<UserDTO | null>;

  /**
   * Find user by Discord ID
   *
   * @param discordId - The Discord user ID to search for
   * @returns Result containing user data or null if not found
   *
   * @example
   * ```typescript
   * const result = await userService.findByDiscordId('123456789012345678');
   * if (result.success && result.data) {
   *   console.log(`Found user: ${result.data._id}`);
   * }
   * ```
   */
  findByDiscordId(discordId: string): AsyncResult<UserDTO | null>;

  /**
   * Get full user profile by ID (for /auth/me)
   * Returns decrypted email
   *
   * @param userId - The ID of the user
   * @returns Result containing full user profile or null if not found
   *
   * @example
   * ```typescript
   * const result = await userService.getProfile('user123');
   * if (result.success && result.data) {
   *   console.log(`User email: ${result.data.email}`);
   * }
   * ```
   */
  getProfile(userId: string): AsyncResult<UserProfileDTO | null>;

  /**
   * Check if user exists by username or email hash
   *
   * @param username - The username to check (case-insensitive)
   * @param emailHash - SHA256 hash of the lowercase email
   * @returns Result containing true if user exists, false otherwise
   *
   * @example
   * ```typescript
   * const result = await userService.existsByUsernameOrEmail('john', 'abc123hash');
   * if (result.success && result.data) {
   *   console.log('User already exists');
   * }
   * ```
   */
  existsByUsernameOrEmail(
    username: string,
    emailHash: string
  ): AsyncResult<boolean>;

  /**
   * Create a new user
   * Handles password hashing and email encryption internally
   *
   * @param data - User creation data
   * @returns Result containing created user data
   *
   * @example
   * ```typescript
   * const result = await userService.create({
   *   username: 'john',
   *   email: 'john@example.com',
   *   password: 'securepassword',
   * });
   * if (result.success) {
   *   console.log(`Created user: ${result.data._id}`);
   * }
   * ```
   */
  create(data: CreateUserDTO): AsyncResult<CreatedUserDTO>;

  // ====================================
  // Auth-related methods (for multi-auth support)
  // ====================================

  /**
   * Find user by ID
   *
   * @param userId - The user's MongoDB ObjectId as string
   * @returns Result containing user data or null if not found
   */
  findById(userId: string): AsyncResult<UserAuthDTO | null>;
  findByMetafyId(metafyId: string): AsyncResult<{ id: string } | null>;

  /**
   * Find user by email hash
   *
   * @param emailHash - SHA256 hash of the lowercase email
   * @returns Result containing user data or null if not found
   */
  findByEmailHash(emailHash: string): AsyncResult<UserDTO | null>;

  /**
   * Get user roles
   *
   * @param userId - The user's ID
   * @returns Result containing user roles
   */
  getRoles(userId: string): AsyncResult<UserRolesDTO | null>;

  /**
   * Fetch the flags that gate Volzar access (superadmin + supporter tier)
   * in a single query. Returns null if the user does not exist.
   */
  getVolzarAccess(userId: string): AsyncResult<VolzarAccessDTO | null>;

  // ====================================
  // Update methods (for OAuth/auth flows)
  // ====================================

  /**
   * Update user's Discord info
   *
   * Used during OAuth login to update Discord ID and username.
   *
   * @param userId - The user's ID
   * @param discordId - The Discord user ID
   * @param discordUsername - The Discord username
   * @returns Result indicating success/failure
   */
  updateDiscordInfo(
    userId: string,
    discordId: string,
    discordUsername: string
  ): AsyncResult<void>;

  // ====================================
  // Display/API helper methods
  // ====================================

  /**
   * Get basic user info for display purposes
   *
   * Returns user info suitable for API responses (no sensitive fields).
   *
   * @param userId - The user's ID
   * @returns Result containing basic user info or null if not found
   */
  getBasicInfo(userId: string): AsyncResult<UserBasicInfoDTO | null>;

  // ====================================
  // User lookup and search methods
  // ====================================

  /**
   * Find user by username (case-insensitive)
   *
   * Used by /users/find endpoint for user lookup.
   *
   * @param username - The username to search for
   * @returns Result containing user data or null if not found
   *
   * @example
   * ```typescript
   * const result = await userService.findByUsername('johndoe');
   * if (result.success && result.data) {
   *   console.log(`Found user: ${result.data._id}`);
   * }
   * ```
   */
  findByUsername(username: string): AsyncResult<UserDTO | null>;

  /**
   * Search users by username (admin only)
   *
   * Returns up to `limit` users whose usernames match the query.
   * Used by /users/search endpoint for admin panel.
   *
   * @param query - The search query (partial username match)
   * @param limit - Maximum number of results (default: 10)
   * @returns Result containing array of matching users
   *
   * @example
   * ```typescript
   * const result = await userService.searchUsers('john', 10);
   * if (result.success) {
   *   console.log(`Found ${result.data.length} users`);
   * }
   * ```
   */
  searchUsers(query: string, limit?: number): AsyncResult<UserDTO[]>;

  /**
   * Get public user profile with aggregated stats
   *
   * Returns user info plus binder statistics and wants count.
   * Used by /users/profile/[username] endpoint.
   *
   * @param username - The username to look up
   * @returns Result containing profile with stats or null if not found
   *
   * @example
   * ```typescript
   * const result = await userService.getUserProfileWithStats('johndoe');
   * if (result.success && result.data) {
   *   console.log(`User has ${result.data.binderStats.total} binders`);
   * }
   * ```
   */
  getUserProfileWithStats(username: string): AsyncResult<UserProfileStatsDTO | null>;

  // ====================================
  // User update methods
  // ====================================

  /**
   * Update user profile fields
   *
   * Updates username, bio, location, country, state, etc.
   * Checks for duplicate username before updating.
   * Used by /user/complete-profile endpoint.
   *
   * @param userId - The user's ID
   * @param updates - The fields to update
   * @returns Result indicating success/failure
   *
   * @example
   * ```typescript
   * const result = await userService.updateProfile(userId, {
   *   username: 'newusername',
   *   country: 'US',
   *   state: 'CA'
   * });
   * if (!result.success) {
   *   console.error(result.error); // e.g., "Username already exists"
   * }
   * ```
   */
  updateProfile(userId: string, updates: UpdateProfileDTO): AsyncResult<void>;

  /**
   * Update Discord info with cascade to denormalized fields
   *
   * Updates user's Discord info AND cascades the change to:
   * - WantsItem collection (denormalized discordUsername)
   * - Binder collection (denormalized discordUsername)
   *
   * Used by /user/update-discord-cascade endpoint.
   *
   * @param userId - The user's ID
   * @param discordId - The Discord user ID
   * @param discordUsername - The Discord username
   * @returns Result indicating success/failure
   *
   * @example
   * ```typescript
   * const result = await userService.updateDiscordWithCascade(
   *   userId,
   *   '123456789',
   *   'NewDiscordName#1234'
   * );
   * ```
   */
  updateDiscordWithCascade(
    userId: string,
    discordId: string,
    discordUsername: string
  ): AsyncResult<void>;

  // ====================================
  // Account management
  // ====================================

  /**
   * Delete user account with cascading deletion (ACID transaction)
   *
   * Deletes all user data across collections:
   * - User account
   * - All binders
   * - All inventory items
   * - All decks
   * - All OAuth access tokens
   * - All MCP clients
   * - All hero pages
   *
   * Uses MongoDB transactions to ensure all-or-nothing deletion.
   * If any deletion fails, the entire operation rolls back.
   *
   * Used by /user/delete-account endpoint.
   *
   * @param userId - The user's ID
   * @returns Result indicating success/failure
   *
   * @example
   * ```typescript
   * const result = await userService.deleteAccountCascade(userId);
   * if (result.success) {
   *   console.log('Account and all data deleted successfully');
   * } else {
   *   console.error('Deletion failed, no data was deleted:', result.error);
   * }
   * ```
   */
  deleteAccountCascade(userId: string): AsyncResult<void>;

  // ====================================
  // Admin and Discord integration methods (Added 2026-01-12 for database agnostic migration)
  // ====================================

  /**
   * Get multiple users by their IDs
   *
   * Useful for bulk lookups in Discord commands and admin panels.
   *
   * @param ids - Array of user IDs to fetch
   * @returns Result containing array of users (may be empty or partial if some IDs don't exist)
   *
   * @example
   * ```typescript
   * const result = await userService.getUsersByIds(['user1', 'user2', 'user3']);
   * if (result.success) {
   *   console.log(`Found ${result.data.length} users`);
   * }
   * ```
   */
  getUsersByIds(ids: string[]): AsyncResult<UserDTO[]>;

  /**
   * Get all users with optional filtering
   *
   * Used by admin panel for user management.
   * Supports filtering by roles and search term (username/email).
   *
   * @param filters - Optional filters for roles and search term
   * @returns Result containing array of users matching filters
   *
   * @example
   * ```typescript
   * // Get all super admins
   * const result = await userService.getAllUsers({
   *   roles: { isSuperAdmin: true }
   * });
   *
   * // Search for users by username
   * const result = await userService.getAllUsers({
   *   searchTerm: 'john'
   * });
   * ```
   */
  getAllUsers(filters?: {
    roles?: Partial<UserRolesDTO>;
    searchTerm?: string;
  }): AsyncResult<UserDTO[]>;

  /**
   * Check if a user has a specific role
   *
   * Used for authorization checks in admin pages and server actions.
   *
   * @param userId - The user's ID
   * @param role - The role to check (e.g., 'isSuperAdmin', 'isContentCreator')
   * @returns Result containing boolean indicating if user has the role
   *
   * @example
   * ```typescript
   * const result = await userService.hasRole(userId, 'isSuperAdmin');
   * if (result.success && result.data) {
   *   console.log('User is a super admin');
   * }
   * ```
   */
  hasRole(userId: string, role: keyof UserRolesDTO | 'isCurator'): AsyncResult<boolean>;

  /**
   * Link a Metafy account to a user
   */
  linkMetafyAccount(
    userId: string,
    data: {
      metafyId: string;
      metafyUsername: string;
      metafyAccessToken: string;
      metafyRefreshToken: string;
      metafyTokenExpiry: Date;
      metafyPartner?: boolean;
    }
  ): AsyncResult<void>;

  /**
   * Unlink a Metafy account from a user
   */
  unlinkMetafyAccount(userId: string): AsyncResult<void>;

  /**
   * Get raw (encrypted) Metafy tokens + expiry for a user
   */
  getMetafyTokens(userId: string): AsyncResult<{
    metafyId: string;
    metafyUsername: string;
    accessToken: string;
    accessTokenIv: string;
    refreshToken: string;
    refreshTokenIv: string;
    tokenExpiry: Date | null;
  } | null>;

  /**
   * Save (replace) the list of Metafy communities a user belongs to
   */
  saveMetafyCommunities(userId: string, communities: MetafyCommunityDTO[]): AsyncResult<void>;

  /**
   * Get the Metafy communities a user belongs to
   */
  getMetafyCommunities(userId: string): AsyncResult<MetafyCommunityDTO[]>;

  /**
   * Set the hosted-chat supporter tier ('free' | 'paid'). Derived from Metafy
   * community membership on link, or a manual superadmin override. Gates Volzar
   * Chat (see lib/ai/volzar-access).
   */
  setMetafySupporterTier(userId: string, tier: 'free' | 'paid'): AsyncResult<void>;

  /**
   * Context for the lazy supporter-tier refresh (see lib/metafy/sync-tier):
   * whether the user has a linked Metafy account and when their memberships
   * were last synced (the newest metafy_communities.synced_at, null if none).
   * Returns null if the user does not exist.
   */
  getSupporterSyncContext(
    userId: string,
  ): AsyncResult<{ linked: boolean; syncedAt: Date | null } | null>;

  /**
   * Update a specific user field (admin operation)
   *
   * Supports dot notation for nested fields like 'roles.isAdmin'.
   * Used by admin operations to update user flags.
   *
   * @param userId - The user ID to update
   * @param field - The field path (supports dot notation)
   * @param value - The new value
   * @returns Result indicating success/failure
   *
   * @example
   * ```typescript
   * // Update a role
   * const result = await userService.updateUserField(
   *   userId,
   *   'roles.isAdmin',
   *   true
   * );
   *
   * // Update a user type flag
   * const result2 = await userService.updateUserField(
   *   userId,
   *   'isMetafySupporter',
   *   false
   * );
   * ```
   */
  updateUserField(userId: string, field: string, value: any): AsyncResult<void>;
}
