/**
 * MongoDB implementation of User Service
 *
 * This class implements the IUserService contract using MongoDB/Mongoose.
 * All MongoDB-specific code is isolated here, making it easy to swap
 * databases by creating a different implementation (e.g., PostgresUserService).
 */

import User from '@/models/User';
import Binder from '@/models/Binder';
import WantsItem from '@/models/WantsItem';
import connectToDatabase from '@/lib/mongodb';
import mongoose from 'mongoose';
import type {
  IUserService,
  UserDTO,
  UserBasicInfoDTO,
  UserAuthDTO,
  UserProfileDTO,
  UserRolesDTO,
  CreateUserDTO,
  CreatedUserDTO,
  McpTokenValidationDTO,
  UserProfileStatsDTO,
  UpdateProfileDTO,
} from '../../contracts/IUserService';
import type { AsyncResult } from '../../contracts/common';

/**
 * Escape special regex characters in a string
 */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MongoUserService implements IUserService {
  /**
   * Ensures database connection before operations
   */
  private async ensureConnection(): Promise<void> {
    await connectToDatabase();
  }

  /**
   * Find user by Discord username (case-insensitive)
   *
   * @param discordUsername - The Discord username to search for
   * @returns Result containing user data or null if not found
   */
  async findByDiscordUsername(discordUsername: string): AsyncResult<UserDTO | null> {
    try {
      await this.ensureConnection();

      // Case-insensitive regex search for Discord username (escape special chars)
      const escaped = escapeRegex(discordUsername);
      const user = await User.findOne({
        discordUsername: { $regex: `^${escaped}$`, $options: 'i' },
      }).select('username discordUsername discordId email');

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          _id: user._id.toString(),
          username: user.username,
          discordUsername: user.discordUsername,
          discordId: user.discordId,
          email: user.email,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] findByDiscordUsername error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to find user by Discord username',
      };
    }
  }

  /**
   * Find user by Discord ID
   *
   * @param discordId - The Discord user ID to search for
   * @returns Result containing user data or null if not found
   */
  async findByDiscordId(discordId: string): AsyncResult<UserDTO | null> {
    try {
      await this.ensureConnection();

      const user = await User.findOne({ discordId }).select(
        'username discordUsername discordId email'
      );

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          _id: user._id.toString(),
          username: user.username,
          discordUsername: user.discordUsername,
          discordId: user.discordId,
          email: user.email,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] findByDiscordId error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to find user by Discord ID',
      };
    }
  }

  /**
   * Get full user profile by ID (for /auth/me)
   * Returns decrypted email
   *
   * @param userId - The ID of the user
   * @returns Result containing full user profile or null if not found
   */
  async getProfile(userId: string): AsyncResult<UserProfileDTO | null> {
    try {
      await this.ensureConnection();

      const user = await User.findById(userId).select('-password -clientHash');

      if (!user) {
        return { success: true, data: null };
      }

      // Decrypt email using model method
      const decryptedEmail = user.getDecryptedEmail();

      // Explicitly coerce to boolean to handle partial/legacy roles objects
      const roles: UserRolesDTO = {
        isAdmin: user.roles?.isAdmin === true,
        isSuperAdmin: user.roles?.isSuperAdmin === true,
        isContentCreator: user.roles?.isContentCreator === true,
        canManageLocations: user.roles?.canManageLocations === true,
        canImportCardCollections: user.roles?.canImportCardCollections === true,
        canModerateForums: user.roles?.canModerateForums === true,
      };

      return {
        success: true,
        data: {
          _id: user._id.toString(),
          username: user.username,
          email: decryptedEmail,
          discordUsername: user.discordUsername,
          discordId: user.discordId,
          createdAt: user.createdAt,
          roles,
          isPatreon: user.isPatreon || false,
          isShop: user.isShop || false,
          isTcgSeller: user.isTcgSeller || false,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] getProfile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user profile',
      };
    }
  }

  /**
   * Check if user exists by username or email hash
   *
   * @param username - The username to check (case-insensitive)
   * @param emailHash - SHA256 hash of the lowercase email
   * @returns Result containing true if user exists, false otherwise
   */
  async existsByUsernameOrEmail(
    username: string,
    emailHash: string
  ): AsyncResult<boolean> {
    try {
      await this.ensureConnection();

      const escaped = escapeRegex(username);
      const existing = await User.findOne({
        $or: [
          { username: new RegExp(`^${escaped}$`, 'i') },
          { emailHash },
        ],
      });

      return { success: true, data: !!existing };
    } catch (error) {
      console.error('[MongoUserService] existsByUsernameOrEmail error:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check user existence',
      };
    }
  }

  /**
   * Create a new user
   * Handles password hashing and email encryption internally via model hooks
   *
   * @param data - User creation data
   * @returns Result containing created user data
   */
  async create(data: CreateUserDTO): AsyncResult<CreatedUserDTO> {
    try {
      await this.ensureConnection();

      const user = new User({
        username: data.username,
        email: data.email,
        password: data.password,
        discordUsername: data.discordUsername,
        isPasswordPreHashed: data.isPasswordPreHashed,
        clientHash: data.isPasswordPreHashed ? data.password : null,
      });

      await user.save();

      return {
        success: true,
        data: {
          _id: user._id.toString(),
          username: user.username,
          email: data.email, // Return original, not encrypted
          discordUsername: user.discordUsername,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] create error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      };
    }
  }

  // ====================================
  // Auth-related methods (for multi-auth support)
  // ====================================

  /**
   * Find user by ID
   *
   * @param userId - The user's MongoDB ObjectId as string
   * @returns Result containing user auth data or null if not found
   */
  async findById(userId: string): AsyncResult<UserAuthDTO | null> {
    try {
      await this.ensureConnection();

      const user = await User.findById(userId).select(
        'username discordUsername discordId mcpToken mcpTokenExpiry'
      );

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          _id: user._id.toString(),
          username: user.username,
          discordUsername: user.discordUsername,
          discordId: user.discordId,
          mcpToken: user.mcpToken,
          mcpTokenExpiry: user.mcpTokenExpiry,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] findById error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find user by ID',
      };
    }
  }

  /**
   * Find user by MCP token
   *
   * @param mcpToken - The MCP token to search for
   * @returns Result containing user auth data or null if not found
   */
  async findByMcpToken(mcpToken: string): AsyncResult<UserAuthDTO | null> {
    try {
      await this.ensureConnection();

      const user = await User.findOne({ mcpToken }).select(
        'username discordUsername discordId mcpToken mcpTokenExpiry'
      );

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          _id: user._id.toString(),
          username: user.username,
          discordUsername: user.discordUsername,
          discordId: user.discordId,
          mcpToken: user.mcpToken,
          mcpTokenExpiry: user.mcpTokenExpiry,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] findByMcpToken error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find user by MCP token',
      };
    }
  }

  /**
   * Validate an MCP token and return the associated user
   *
   * Checks both token existence and expiry.
   *
   * @param mcpToken - The MCP token to validate
   * @returns Validation result with user data if valid
   */
  async validateMcpToken(mcpToken: string): AsyncResult<McpTokenValidationDTO> {
    try {
      await this.ensureConnection();

      const user = await User.findOne({ mcpToken }).select(
        'username discordUsername discordId mcpToken mcpTokenExpiry'
      );

      if (!user) {
        return { success: true, data: { valid: false } };
      }

      // Check expiry if set
      if (user.mcpTokenExpiry && new Date() > new Date(user.mcpTokenExpiry)) {
        return { success: true, data: { valid: false } };
      }

      return {
        success: true,
        data: {
          valid: true,
          user: {
            _id: user._id.toString(),
            username: user.username,
            discordUsername: user.discordUsername,
            discordId: user.discordId,
            mcpToken: user.mcpToken,
            mcpTokenExpiry: user.mcpTokenExpiry,
          },
        },
      };
    } catch (error) {
      console.error('[MongoUserService] validateMcpToken error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate MCP token',
      };
    }
  }

  /**
   * Find user by email hash
   *
   * @param emailHash - SHA256 hash of the lowercase email
   * @returns Result containing user data or null if not found
   */
  async findByEmailHash(emailHash: string): AsyncResult<UserDTO | null> {
    try {
      await this.ensureConnection();

      const user = await User.findOne({ emailHash }).select(
        'username discordUsername discordId email'
      );

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          _id: user._id.toString(),
          username: user.username,
          discordUsername: user.discordUsername,
          discordId: user.discordId,
          email: user.email,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] findByEmailHash error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find user by email hash',
      };
    }
  }

  /**
   * Get user roles
   *
   * @param userId - The user's ID
   * @returns Result containing user roles or null if not found
   */
  async getRoles(userId: string): AsyncResult<UserRolesDTO | null> {
    try {
      await this.ensureConnection();

      const user = await User.findById(userId).select('roles');

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          isAdmin: user.roles?.isAdmin === true,
          isSuperAdmin: user.roles?.isSuperAdmin === true,
          isContentCreator: user.roles?.isContentCreator === true,
          canManageLocations: user.roles?.canManageLocations === true,
          canImportCardCollections: user.roles?.canImportCardCollections === true,
          canModerateForums: user.roles?.canModerateForums === true,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] getRoles error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user roles',
      };
    }
  }

  // ====================================
  // Update methods (for OAuth/auth flows)
  // ====================================

  /**
   * Update user's MCP token and expiry
   *
   * @param userId - The user's ID
   * @param mcpToken - The new MCP token
   * @param expiryDate - When the token expires
   * @returns Result indicating success/failure
   */
  async updateMcpToken(
    userId: string,
    mcpToken: string,
    expiryDate: Date
  ): AsyncResult<void> {
    try {
      await this.ensureConnection();

      const result = await User.updateOne(
        { _id: userId },
        {
          $set: {
            mcpToken,
            mcpTokenExpiry: expiryDate,
          },
        }
      );

      if (result.matchedCount === 0) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[MongoUserService] updateMcpToken error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update MCP token',
      };
    }
  }

  /**
   * Update user's Discord info
   *
   * @param userId - The user's ID
   * @param discordId - The Discord user ID
   * @param discordUsername - The Discord username
   * @returns Result indicating success/failure
   */
  async updateDiscordInfo(
    userId: string,
    discordId: string,
    discordUsername: string
  ): AsyncResult<void> {
    try {
      await this.ensureConnection();

      const result = await User.updateOne(
        { _id: userId },
        {
          $set: {
            discordId,
            discordUsername,
          },
        }
      );

      if (result.matchedCount === 0) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[MongoUserService] updateDiscordInfo error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Discord info',
      };
    }
  }

  // ====================================
  // Display/API helper methods
  // ====================================

  /**
   * Get basic user info for display purposes
   *
   * @param userId - The user's ID
   * @returns Result containing basic user info or null if not found
   */
  async getBasicInfo(userId: string): AsyncResult<UserBasicInfoDTO | null> {
    try {
      await this.ensureConnection();

      const user = await User.findById(userId).select(
        'username discordUsername discordId'
      );

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          _id: user._id.toString(),
          username: user.username,
          discordUsername: user.discordUsername,
          discordId: user.discordId,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] getBasicInfo error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user info',
      };
    }
  }

  // ====================================
  // User lookup and search methods
  // ====================================

  /**
   * Find user by username (case-insensitive)
   */
  async findByUsername(username: string): AsyncResult<UserDTO | null> {
    try {
      await this.ensureConnection();

      const escaped = escapeRegex(username);
      const user = await User.findOne({
        username: { $regex: `^${escaped}$`, $options: 'i' },
      }).select('username discordUsername discordId email');

      if (!user) {
        return { success: true, data: null };
      }

      return {
        success: true,
        data: {
          _id: user._id.toString(),
          username: user.username,
          discordUsername: user.discordUsername,
          discordId: user.discordId,
          email: user.email,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] findByUsername error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find user by username',
      };
    }
  }

  /**
   * Search users by username (admin only)
   */
  async searchUsers(query: string, limit: number = 10): AsyncResult<UserDTO[]> {
    try {
      await this.ensureConnection();

      const escaped = escapeRegex(query);
      const users = await User.find({
        username: { $regex: escaped, $options: 'i' },
      })
        .select('username discordUsername discordId email')
        .limit(limit)
        .lean();

      return {
        success: true,
        data: users.map(user => ({
          _id: user._id.toString(),
          username: user.username,
          discordUsername: user.discordUsername,
          discordId: user.discordId,
          email: user.email,
        })),
      };
    } catch (error) {
      console.error('[MongoUserService] searchUsers error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search users',
      };
    }
  }

  /**
   * Get public user profile with aggregated stats
   */
  async getUserProfileWithStats(username: string): AsyncResult<UserProfileStatsDTO | null> {
    try {
      await this.ensureConnection();
      const { db } = await connectToDatabase();

      // Find user by username (case-insensitive)
      const escaped = escapeRegex(username);
      const user = await User.findOne({
        username: { $regex: `^${escaped}$`, $options: 'i' },
      }).select('username discordUsername discordId createdAt');

      if (!user) {
        return { success: true, data: null };
      }

      const userId = user._id;

      // Aggregate binder stats by visibility
      const binderStatsResult = await db
        .collection('binders')
        .aggregate([
          { $match: { userId } },
          {
            $group: {
              _id: '$visibility',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      // Convert array to object
      const binderStats = {
        public: 0,
        unlisted: 0,
        private: 0,
        total: 0,
      };

      binderStatsResult.forEach((stat: any) => {
        const visibility = stat._id as 'public' | 'unlisted' | 'private';
        binderStats[visibility] = stat.count;
        binderStats.total += stat.count;
      });

      // Count wants items
      const wantsCount = await db.collection('wantsitems').countDocuments({ userId });

      return {
        success: true,
        data: {
          _id: userId.toString(),
          username: user.username || '',
          discordUsername: user.discordUsername,
          discordId: user.discordId,
          createdAt: user.createdAt || new Date(),
          binderStats,
          wantsCount,
        },
      };
    } catch (error) {
      console.error('[MongoUserService] getUserProfileWithStats error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get user profile with stats',
      };
    }
  }

  // ====================================
  // User update methods
  // ====================================

  /**
   * Update user profile fields
   */
  async updateProfile(userId: string, updates: UpdateProfileDTO): AsyncResult<void> {
    try {
      await this.ensureConnection();

      // If username is being updated, check for duplicates
      if (updates.username) {
        const existingUser = await User.findOne({
          username: { $regex: `^${escapeRegex(updates.username)}$`, $options: 'i' },
          _id: { $ne: userId },
        });

        if (existingUser) {
          return { success: false, error: 'Username already exists' };
        }
      }

      // Update user
      const result = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true });

      if (!result) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[MongoUserService] updateProfile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update profile',
      };
    }
  }

  /**
   * Update Discord info with cascade to denormalized fields
   */
  async updateDiscordWithCascade(
    userId: string,
    discordId: string,
    discordUsername: string
  ): AsyncResult<void> {
    try {
      await this.ensureConnection();

      // Update user
      const userResult = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            discordId,
            discordUsername,
          },
        },
        { new: true }
      );

      if (!userResult) {
        return { success: false, error: 'User not found' };
      }

      // Cascade to WantsItem collection
      await WantsItem.updateMany(
        { userId: new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            discordUsername,
            discordId,
          },
        }
      );

      // Cascade to Binder collection
      await Binder.updateMany(
        { userId: new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            discordUsername,
            discordId,
          },
        }
      );

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[MongoUserService] updateDiscordWithCascade error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to update Discord with cascade',
      };
    }
  }

  // ====================================
  // Account management
  // ====================================

  /**
   * Delete user account with cascading deletion (ACID transaction)
   */
  async deleteAccountCascade(userId: string): AsyncResult<void> {
    let session: mongoose.mongo.ClientSession | null = null;

    try {
      await this.ensureConnection();
      const { db } = await connectToDatabase();

      // Start a transaction
      session = await mongoose.startSession();
      session.startTransaction();

      const userObjectId = new mongoose.Types.ObjectId(userId);

      // Delete all user data in order
      await Promise.all([
        // Delete user's binders
        Binder.deleteMany({ userId: userObjectId }, { session }),

        // Delete inventory items
        db.collection('inventory_items').deleteMany({ userId: userObjectId }, { session }),

        // Delete user's decks
        db.collection('decks').deleteMany({ userId: userObjectId }, { session }),

        // Delete OAuth tokens
        db
          .collection('oauth_access_tokens')
          .deleteMany({ userId: userObjectId }, { session }),

        // Delete MCP clients
        db.collection('mcp_clients').deleteMany({ userId: userObjectId }, { session }),

        // Delete hero pages
        db.collection('heropages').deleteMany({ userId: userObjectId }, { session }),

        // Delete wants items
        db.collection('wantsitems').deleteMany({ userId: userObjectId }, { session }),
      ]);

      // Finally, delete the user account itself
      await User.findByIdAndDelete(userId, { session });

      // Commit the transaction
      await session.commitTransaction();

      console.log(`[MongoUserService] Successfully deleted account: ${userId}`);
      return { success: true, data: undefined };
    } catch (error) {
      console.error('[MongoUserService] deleteAccountCascade error:', error);

      // Abort the transaction on error
      if (session) {
        await session.abortTransaction();
      }

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete account. No data was deleted.',
      };
    } finally {
      // End the session
      if (session) {
        await session.endSession();
      }
    }
  }

  // ====================================
  // Admin and Discord integration methods (Added 2026-01-12 for database agnostic migration)
  // ====================================

  /**
   * Get multiple users by their IDs
   */
  async getUsersByIds(ids: string[]): AsyncResult<UserDTO[]> {
    try {
      await this.ensureConnection();

      const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
      const users = await User.find({ _id: { $in: objectIds } }).lean();

      return { success: true, data: users };
    } catch (error) {
      console.error('[MongoUserService] getUsersByIds error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get users by IDs',
      };
    }
  }

  /**
   * Get all users with optional filtering
   */
  async getAllUsers(filters?: {
    roles?: Partial<UserRolesDTO>;
    searchTerm?: string;
  }): AsyncResult<UserDTO[]> {
    try {
      await this.ensureConnection();

      const query: any = {};

      // Add role filters
      if (filters?.roles) {
        Object.entries(filters.roles).forEach(([role, value]) => {
          query[`roles.${role}`] = value;
        });
      }

      // Add search term filter
      if (filters?.searchTerm) {
        const escapedSearch = escapeRegex(filters.searchTerm);
        query.$or = [
          { username: { $regex: escapedSearch, $options: 'i' } },
          { email: { $regex: escapedSearch, $options: 'i' } },
        ];
      }

      const users = await User.find(query)
        .select('_id username email roles isLocalGamingStore isPatreon isShop isTcgSeller')
        .sort({ username: 1 })
        .lean();

      return { success: true, data: users };
    } catch (error) {
      console.error('[MongoUserService] getAllUsers error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get all users',
      };
    }
  }

  /**
   * Check if a user has a specific role
   */
  async hasRole(userId: string, role: keyof UserRolesDTO): AsyncResult<boolean> {
    try {
      await this.ensureConnection();

      const user = await User.findById(userId).select('roles').lean();

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const hasRole = user.roles?.[role] === true;
      return { success: true, data: hasRole };
    } catch (error) {
      console.error('[MongoUserService] hasRole error:', error);
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
      await this.ensureConnection();

      // Using dynamic key with $set to support dot notation (e.g., 'roles.isAdmin')
      const updateResult = await User.updateOne(
        { _id: userId },
        { $set: { [field]: value } }
      );

      if (updateResult.modifiedCount === 0 && updateResult.matchedCount === 0) {
        return { success: false, error: 'User not found' };
      }

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[MongoUserService] updateUserField error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user field',
      };
    }
  }
}
