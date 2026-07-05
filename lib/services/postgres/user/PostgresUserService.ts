/**
 * PostgreSQL User Service Implementation
 *
 * Implements IUserService using PostgreSQL + Drizzle ORM
 * Clean, normalized queries with no denormalization
 */

import { eq, and, or, sql, inArray, desc } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, binders, wantsItems, metafyCommunities } from '@/lib/postgres/schema';
import { encryptMetafyTokens } from '@/lib/metafy/tokens';
import { decryptAddress } from '@/lib/encryption';
import type {
  IUserService,
  AsyncResult,
  UserDTO,
  UserBasicInfoDTO,
  CreateUserDTO,
  UpdateUserDTO,
  UserProfileDTO,
  UserRolesDTO,
  FabbyChatAccessDTO,
  UserProfileStatsDTO,
  UpdateProfileDTO,
  MetafyCommunityDTO,
} from '@/lib/services/contracts/IUserService';
import { v4 as uuidv4 } from 'uuid';

export class PostgresUserService implements IUserService {
  /**
   * Find user by ID
   */
  async findByMetafyId(metafyId: string): AsyncResult<{ id: string } | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.metafyId, metafyId),
        columns: { id: true },
      });
      return { success: true, data: user ? { id: user.id } : null };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to find user' };
    }
  }

  async findById(userId: string): AsyncResult<UserDTO | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: this.mapToUserDTO(user),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find user',
      };
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): AsyncResult<UserDTO | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.username, username),
      });

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: this.mapToUserDTO(user),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find user by username',
      };
    }
  }

  /**
   * Find user by Discord ID
   */
  async findByDiscordId(discordId: string): AsyncResult<UserDTO | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.discordId, discordId),
      });

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: this.mapToUserDTO(user),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find user by Discord ID',
      };
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): AsyncResult<UserDTO | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: this.mapToUserDTO(user),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find user by email',
      };
    }
  }

  /**
   * Create a new user
   */
  async createUser(data: CreateUserDTO): AsyncResult<UserDTO> {
    try {
      const userId = uuidv4();

      const [newUser] = await db.insert(users).values({
        id: userId,
        username: data.username,
        email: data.email,
        passwordHash: data.passwordHash,
        discordId: data.discordId,
        discordUsername: data.discordUsername,
        discordAvatar: data.discordAvatar,
        avatarUrl: data.avatarUrl,
        countryCode: data.countryCode,
      }).returning();

      return {
        success: true,
        data: this.mapToUserDTO(newUser),
      };
    } catch (error) {
      // Handle unique constraint violations
      if (error instanceof Error && error.message.includes('unique')) {
        return {
          success: false,
          error: 'Username, email, or Discord ID already exists',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      };
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: UpdateUserDTO): AsyncResult<UserDTO> {
    try {
      const [updatedUser] = await db.update(users)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        data: this.mapToUserDTO(updatedUser),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user',
      };
    }
  }

  /**
   * Update user's Discord info
   */
  async updateDiscordInfo(
    userId: string,
    discordId: string,
    discordUsername: string
  ): AsyncResult<void> {
    try {
      const result = await db
        .update(users)
        .set({
          discordId,
          discordUsername,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (result.length === 0) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[PostgresUserService] updateDiscordInfo error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Discord info',
      };
    }
  }

  /**
   * Delete user (and cascade delete related data)
   */
  async deleteUser(userId: string): AsyncResult<boolean> {
    try {
      await db.delete(users).where(eq(users.id, userId));

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user',
      };
    }
  }

  /**
   * Get basic user info (for public display)
   */
  async getBasicInfo(userId: string): AsyncResult<UserBasicInfoDTO | null> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          id: true,
          username: true,
          discordUsername: true,
          avatarUrl: true,
          countryCode: true,
          isStore: true,
        },
      });

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          _id: user.id,
          username: user.username,
          discordUsername: user.discordUsername || undefined,
          avatarUrl: user.avatarUrl || undefined,
          countryCode: user.countryCode || undefined,
          isStore: user.isStore || false,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get basic info',
      };
    }
  }

  /**
   * Search users by username (for matching)
   */
  async searchByUsername(query: string, limit = 10): AsyncResult<UserBasicInfoDTO[]> {
    try {
      const results = await db.select({
        id: users.id,
        username: users.username,
        discordUsername: users.discordUsername,
        avatarUrl: users.avatarUrl,
        countryCode: users.countryCode,
        isStore: users.isStore,
      })
      .from(users)
      .where(sql`${users.username} ILIKE ${`%${query}%`}`)
      .limit(limit);

      return {
        success: true,
        data: results.map(user => ({
          id: user.id,
          username: user.username,
          discordUsername: user.discordUsername || undefined,
          avatarUrl: user.avatarUrl || undefined,
          countryCode: user.countryCode || undefined,
          isStore: user.isStore || false,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search users',
      };
    }
  }

  /**
   * Find user by Discord username (case-insensitive)
   */
  async findByDiscordUsername(discordUsername: string): AsyncResult<UserDTO | null> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.discordUsername}) = LOWER(${discordUsername})`);

      if (!user) {
        return { success: true, data: null };
      }

      return { success: true, data: this.mapToUserDTO(user) };
    } catch (error) {
      console.error('[PostgresUserService] findByDiscordUsername error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find user by Discord username',
      };
    }
  }

  /**
   * Get full user profile by ID
   */
  async getProfile(userId: string): AsyncResult<UserProfileDTO | null> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return { success: true, data: null };
      }

      const roles: UserRolesDTO = {
        isAdmin: user.isAdmin || false,
        isSuperAdmin: user.isSuperAdmin || false,
        isContentCreator: user.isContentCreator || false,
        canManageLocations: user.canManageLocations || false,
        canImportCardCollections: user.canImportCardCollections || false,
        canModerateForums: user.canModerateForums || false,
      };

      return {
        success: true,
        data: {
          _id: user.id,
          username: user.username,
          email: user.email && user.emailIV
            ? decryptAddress({ encrypted: user.email, iv: user.emailIV, tag: '' })
            : undefined,
          discordUsername: user.discordUsername || undefined,
          discordId: user.discordId || undefined,
          createdAt: user.createdAt,
          roles,
          isMetafySupporter: user.isMetafySupporter || false,
          isCurator: user.isCurator || false,
          isShop: user.isShop || false,
          isTcgSeller: user.isTcgSeller || false,
          metafyId: user.metafyId || undefined,
          metafyUsername: user.metafyUsername || undefined,
          metafyPartner: user.metafyPartner ?? false,
          countryCode: user.countryCode || undefined,
          stateCode: user.stateCode || undefined,
        },
      };
    } catch (error) {
      console.error('[PostgresUserService] getProfile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user profile',
      };
    }
  }

  /**
   * Get user roles
   */
  async getRoles(userId: string): AsyncResult<UserRolesDTO | null> {
    try {
      const [user] = await db
        .select({
          isAdmin: users.isAdmin,
          isSuperAdmin: users.isSuperAdmin,
          isContentCreator: users.isContentCreator,
          canManageLocations: users.canManageLocations,
          canImportCardCollections: users.canImportCardCollections,
          canModerateForums: users.canModerateForums,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          isAdmin: user.isAdmin || false,
          isSuperAdmin: user.isSuperAdmin || false,
          isContentCreator: user.isContentCreator || false,
          canManageLocations: user.canManageLocations || false,
          canImportCardCollections: user.canImportCardCollections || false,
          canModerateForums: user.canModerateForums || false,
        },
      };
    } catch (error) {
      console.error('[PostgresUserService] getRoles error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user roles',
      };
    }
  }

  async getFabbyChatAccess(userId: string): AsyncResult<FabbyChatAccessDTO | null> {
    try {
      const [user] = await db
        .select({
          isSuperAdmin: users.isSuperAdmin,
          metafySupporterTier: users.metafySupporterTier,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          isSuperAdmin: user.isSuperAdmin || false,
          metafySupporterTier: user.metafySupporterTier === 'paid' ? 'paid' : 'free',
        },
      };
    } catch (error) {
      console.error('[PostgresUserService] getFabbyChatAccess error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Fabby Chat access',
      };
    }
  }

  /**
   * Search users (alias for searchByUsername for compatibility)
   */
  async searchUsers(query: string, limit: number = 10): AsyncResult<UserDTO[]> {
    try {
      const results = await db
        .select()
        .from(users)
        .where(sql`${users.username} ILIKE ${`%${query}%`}`)
        .limit(limit);

      return {
        success: true,
        data: results.map(user => this.mapToUserDTO(user)),
      };
    } catch (error) {
      console.error('[PostgresUserService] searchUsers error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search users',
      };
    }
  }

  /**
   * Get multiple users by their IDs in a single query
   */
  async getUsersByIds(ids: string[]): AsyncResult<UserDTO[]> {
    if (ids.length === 0) return { success: true, data: [] };
    try {
      const results = await db
        .select()
        .from(users)
        .where(inArray(users.id, ids));
      return { success: true, data: results.map(u => this.mapToUserDTO(u)) };
    } catch (error) {
      console.error('[PostgresUserService] getUsersByIds error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get users by IDs',
      };
    }
  }

  /**
   * Get public user profile with aggregated stats
   */
  async getUserProfileWithStats(username: string): AsyncResult<UserProfileStatsDTO | null> {
    try {
      // Find user by username (case-insensitive)
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          discordUsername: users.discordUsername,
          discordId: users.discordId,
          discordAvatar: users.discordAvatar,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(sql`LOWER(${users.username}) = LOWER(${username})`);

      if (!user) {
        return { success: true, data: null };
      }

      // Aggregate binder stats by visibility (using binders table)
      const binderStats = await db
        .select({
          visibilityLevel: binders.visibilityLevel,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(binders)
        .where(eq(binders.userId, user.id))
        .groupBy(binders.visibilityLevel);

      const stats = {
        public: 0,
        unlisted: 0,
        private: 0,
        total: 0,
      };

      binderStats.forEach((stat) => {
        const visibility = stat.visibilityLevel as 'public' | 'unlisted' | 'private';
        if (visibility) {
          stats[visibility] = stat.count;
          stats.total += stat.count;
        }
      });

      // Count wants items
      const [wantsResult] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(wantsItems)
        .where(eq(wantsItems.userId, user.id));

      return {
        success: true,
        data: {
          _id: user.id,
          username: user.username || '',
          discordUsername: user.discordUsername || undefined,
          discordId: user.discordId || undefined,
          discordAvatar: user.discordAvatar || undefined,
          createdAt: user.createdAt || new Date(),
          binderStats: stats,
          wantsCount: wantsResult?.count || 0,
        },
      };
    } catch (error) {
      console.error('[PostgresUserService] getUserProfileWithStats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user profile with stats',
      };
    }
  }

  /**
   * Update user profile fields
   */
  async updateProfile(userId: string, updates: UpdateProfileDTO): AsyncResult<void> {
    try {
      // If username is being updated, check for duplicates
      if (updates.username) {
        const [existing] = await db
          .select()
          .from(users)
          .where(
            and(
              sql`LOWER(${users.username}) = LOWER(${updates.username})`,
              sql`${users.id} != ${userId}`
            )
          );

        if (existing) {
          return { success: false, error: 'Username already exists' };
        }
      }

      // Whitelist DTO fields onto real columns. `country`/`state` keep their
      // MongoDB-era DTO names (the /api/user/complete-profile contract) but
      // live in country_code/state_code; legacy fields with no column
      // (city, location, bio) are deliberately ignored. Spreading the DTO
      // into .set() breaks drizzle on unknown keys — do not restore it.
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.username !== undefined) set.username = updates.username;
      if (updates.discordUsername !== undefined) set.discordUsername = updates.discordUsername;
      if (updates.country !== undefined) set.countryCode = updates.country || null;
      if (updates.state !== undefined) set.stateCode = updates.state || null;

      const result = await db
        .update(users)
        .set(set)
        .where(eq(users.id, userId))
        .returning();

      if (result.length === 0) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[PostgresUserService] updateProfile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update profile',
      };
    }
  }

  /**
   * Update Discord info with cascade to denormalized fields
   * NOTE: PostgreSQL schema is normalized, so no cascade needed
   */
  async updateDiscordWithCascade(
    userId: string,
    discordId: string,
    discordUsername: string
  ): AsyncResult<void> {
    // In PostgreSQL, we don't have denormalized Discord fields
    // Just update the user record
    return this.updateDiscordInfo(userId, discordId, discordUsername);
  }

  /**
   * Delete user account with cascading deletion
   */
  async deleteAccountCascade(userId: string): AsyncResult<void> {
    try {
      // PostgreSQL handles cascading deletes via foreign key constraints
      // defined in the schema (onDelete: 'cascade')
      await db.delete(users).where(eq(users.id, userId));

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[PostgresUserService] deleteAccountCascade error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete account',
      };
    }
  }

  /**
   * Get all users with optional filters
   */
  async getAllUsers(filters?: {
    roles?: Partial<UserRolesDTO>;
    searchTerm?: string;
  }): AsyncResult<UserDTO[]> {
    try {
      let query = db.select().from(users);

      const conditions = [];

      // Add role filters
      if (filters?.roles) {
        if (filters.roles.isAdmin !== undefined) {
          conditions.push(eq(users.isAdmin, filters.roles.isAdmin));
        }
        if (filters.roles.isSuperAdmin !== undefined) {
          conditions.push(eq(users.isSuperAdmin, filters.roles.isSuperAdmin));
        }
        if (filters.roles.isContentCreator !== undefined) {
          conditions.push(eq(users.isContentCreator, filters.roles.isContentCreator));
        }
        if (filters.roles.canManageLocations !== undefined) {
          conditions.push(eq(users.canManageLocations, filters.roles.canManageLocations));
        }
        if (filters.roles.canImportCardCollections !== undefined) {
          conditions.push(eq(users.canImportCardCollections, filters.roles.canImportCardCollections));
        }
        if (filters.roles.canModerateForums !== undefined) {
          conditions.push(eq(users.canModerateForums, filters.roles.canModerateForums));
        }
      }

      // Add search term filter
      if (filters?.searchTerm) {
        conditions.push(
          or(
            sql`${users.username} ILIKE ${`%${filters.searchTerm}%`}`,
            sql`${users.email} ILIKE ${`%${filters.searchTerm}%`}`
          )!
        );
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)!) as any;
      }

      const results = await query;

      return {
        success: true,
        data: results.map(user => this.mapToUserDTO(user)),
      };
    } catch (error) {
      console.error('[PostgresUserService] getAllUsers error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get all users',
      };
    }
  }

  /**
   * Check if a user has a specific role
   */
  async hasRole(userId: string, role: keyof UserRolesDTO | 'isCurator'): AsyncResult<boolean> {
    try {
      const [user] = await db
        .select({
          isAdmin: users.isAdmin,
          isSuperAdmin: users.isSuperAdmin,
          isContentCreator: users.isContentCreator,
          canManageLocations: users.canManageLocations,
          canImportCardCollections: users.canImportCardCollections,
          canModerateForums: users.canModerateForums,
          isCurator: users.isCurator,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const roleMap: Record<keyof UserRolesDTO | 'isCurator', boolean> = {
        isAdmin: user.isAdmin || false,
        isSuperAdmin: user.isSuperAdmin || false,
        isContentCreator: user.isContentCreator || false,
        canManageLocations: user.canManageLocations || false,
        canImportCardCollections: user.canImportCardCollections || false,
        canModerateForums: user.canModerateForums || false,
        isCurator: user.isCurator || false,
      };

      return { success: true, data: roleMap[role] };
    } catch (error) {
      console.error('[PostgresUserService] hasRole error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check user role',
      };
    }
  }

  /**
   * Update a specific user field (admin operation)
   */
  async updateUserField(userId: string, field: string, value: any): AsyncResult<void> {
    try {
      // Strip MongoDB-style dot notation (e.g. 'roles.isCurator' → 'isCurator')
      const columnKey = field.includes('.') ? field.split('.')[1] : field;
      const updateData: any = { [columnKey]: value, updatedAt: new Date() };

      const result = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      if (result.length === 0) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[PostgresUserService] updateUserField error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user field',
      };
    }
  }

  /**
   * Link a Metafy account to a user
   */
  async linkMetafyAccount(
    userId: string,
    data: {
      metafyId: string;
      metafyUsername: string;
      metafyAccessToken: string;
      metafyRefreshToken: string;
      metafyTokenExpiry: Date;
      metafyPartner?: boolean;
    }
  ): AsyncResult<void> {
    try {
      const encrypted = encryptMetafyTokens(data.metafyAccessToken, data.metafyRefreshToken);
      const updateData: any = {
        metafyId: data.metafyId,
        metafyUsername: data.metafyUsername,
        metafyAccessToken: encrypted.metafyAccessToken,
        metafyAccessTokenIv: encrypted.metafyAccessTokenIv,
        metafyRefreshToken: encrypted.metafyRefreshToken,
        metafyRefreshTokenIv: encrypted.metafyRefreshTokenIv,
        metafyTokenExpiry: data.metafyTokenExpiry,
        updatedAt: new Date(),
      };
      if (data.metafyPartner !== undefined) {
        updateData.metafyPartner = data.metafyPartner;
      }
      const result = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      if (result.length === 0) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[PostgresUserService] linkMetafyAccount error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to link Metafy account',
      };
    }
  }

  /**
   * Unlink a Metafy account from a user
   */
  async unlinkMetafyAccount(userId: string): AsyncResult<void> {
    try {
      const result = await db
        .update(users)
        .set({
          metafyId: null,
          metafyUsername: null,
          metafyAccessToken: null,
          metafyAccessTokenIv: null,
          metafyRefreshToken: null,
          metafyRefreshTokenIv: null,
          metafyTokenExpiry: null,
          // Losing the Metafy link revokes any supporter-derived access.
          metafySupporterTier: 'free',
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (result.length === 0) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[PostgresUserService] unlinkMetafyAccount error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unlink Metafy account',
      };
    }
  }

  /**
   * Get raw (encrypted) Metafy tokens + expiry for a user
   */
  async getMetafyTokens(userId: string): AsyncResult<{
    metafyId: string;
    metafyUsername: string;
    accessToken: string;
    accessTokenIv: string;
    refreshToken: string;
    refreshTokenIv: string;
    tokenExpiry: Date | null;
  } | null> {
    try {
      const [user] = await db
        .select({
          metafyId: users.metafyId,
          metafyUsername: users.metafyUsername,
          metafyAccessToken: users.metafyAccessToken,
          metafyAccessTokenIv: users.metafyAccessTokenIv,
          metafyRefreshToken: users.metafyRefreshToken,
          metafyRefreshTokenIv: users.metafyRefreshTokenIv,
          metafyTokenExpiry: users.metafyTokenExpiry,
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user || !user.metafyId) return { success: true, data: null };

      return {
        success: true,
        data: {
          metafyId: user.metafyId,
          metafyUsername: user.metafyUsername ?? '',
          accessToken: user.metafyAccessToken ?? '',
          accessTokenIv: user.metafyAccessTokenIv ?? '',
          refreshToken: user.metafyRefreshToken ?? '',
          refreshTokenIv: user.metafyRefreshTokenIv ?? '',
          tokenExpiry: user.metafyTokenExpiry ?? null,
        },
      };
    } catch (error) {
      console.error('[PostgresUserService] getMetafyTokens error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Metafy tokens',
      };
    }
  }

  /**
   * Save (replace) the list of Metafy communities a user belongs to
   */
  async saveMetafyCommunities(userId: string, communities: MetafyCommunityDTO[]): AsyncResult<void> {
    try {
      await db.transaction(async (tx) => {
        await tx.delete(metafyCommunities).where(eq(metafyCommunities.userId, userId));
        if (communities.length > 0) {
          await tx.insert(metafyCommunities).values(
            communities.map((c) => ({
              userId,
              communityId: c.communityId,
              title: c.title,
              tiers: c.tiers ?? null,
            }))
          );
        }
      });
      return { success: true, data: undefined };
    } catch (error) {
      console.error('[PostgresUserService] saveMetafyCommunities error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save Metafy communities',
      };
    }
  }

  async getSupporterSyncContext(
    userId: string,
  ): AsyncResult<{ linked: boolean; syncedAt: Date | null } | null> {
    try {
      const [user] = await db
        .select({ metafyId: users.metafyId })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return { success: true, data: null };
      }

      // Newest sync time via orderBy/limit (not max()) so Drizzle's date-mode
      // mapping returns a real Date, not a raw timestamp string.
      const [community] = await db
        .select({ syncedAt: metafyCommunities.syncedAt })
        .from(metafyCommunities)
        .where(eq(metafyCommunities.userId, userId))
        .orderBy(desc(metafyCommunities.syncedAt))
        .limit(1);

      return {
        success: true,
        data: { linked: !!user.metafyId, syncedAt: community?.syncedAt ?? null },
      };
    } catch (error) {
      console.error('[PostgresUserService] getSupporterSyncContext error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get supporter sync context',
      };
    }
  }

  async setMetafySupporterTier(userId: string, tier: 'free' | 'paid'): AsyncResult<void> {
    try {
      const result = await db
        .update(users)
        .set({ metafySupporterTier: tier, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning({ id: users.id });

      if (result.length === 0) {
        return { success: false, error: 'User not found' };
      }
      return { success: true, data: undefined };
    } catch (error) {
      console.error('[PostgresUserService] setMetafySupporterTier error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set Metafy supporter tier',
      };
    }
  }

  /**
   * Get the Metafy communities a user belongs to
   */
  async getMetafyCommunities(userId: string): AsyncResult<MetafyCommunityDTO[]> {
    try {
      const rows = await db
        .select()
        .from(metafyCommunities)
        .where(eq(metafyCommunities.userId, userId));

      return {
        success: true,
        data: rows.map((r) => ({
          communityId: r.communityId,
          title: r.title,
          tiers: r.tiers as MetafyCommunityDTO['tiers'],
        })),
      };
    } catch (error) {
      console.error('[PostgresUserService] getMetafyCommunities error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Metafy communities',
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Map database user to UserDTO
   */
  private mapToUserDTO(user: any): UserDTO {
    return {
      _id: user.id, // Map PostgreSQL 'id' to MongoDB-compatible '_id'
      username: user.username,
      email: user.email || undefined,
      discordId: user.discordId || undefined,
      discordUsername: user.discordUsername || undefined,
      discordAvatar: user.discordAvatar || undefined,
      avatarUrl: user.avatarUrl || undefined,
      countryCode: user.countryCode || undefined,
      isStore: user.isStore || false,
      storeId: user.storeId || undefined,
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString(),
      // Role fields
      roles: {
        isAdmin: user.isAdmin || false,
        isSuperAdmin: user.isSuperAdmin || false,
        isContentCreator: user.isContentCreator || false,
        canManageLocations: user.canManageLocations || false,
        canImportCardCollections: user.canImportCardCollections || false,
        canModerateForums: user.canModerateForums || false,
      },
      isAdmin: user.isAdmin || false,
      isSuperAdmin: user.isSuperAdmin || false,
      isLocalGamingStore: user.isLocalGamingStore || false,
      isMetafySupporter: user.isMetafySupporter || false,
      isShop: user.isShop || false,
      isTcgSeller: user.isTcgSeller || false,
      metafySupporterTier: user.metafySupporterTier || 'free',
    };
  }
}
