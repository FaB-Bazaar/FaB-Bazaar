/**
 * Service Registry / Factory
 *
 * This file provides singleton instances of all services.
 * It acts as the central point for service dependency injection.
 *
 * Benefits:
 * - Single source of truth for service instances
 * - Easy to swap implementations (e.g., for testing or database migration)
 * - Lazy initialization (services created only when needed)
 */

// Existing service contracts
import type { IUserService } from './contracts/IUserService';
import type { IBinderService } from './contracts/IBinderService';
import type { IPrintingsService } from './contracts/IPrintingsService';
import type { IWantsService } from './contracts/IWantsService';
import type { IInventoryService } from './contracts/IInventoryService';
import type { IAuthService } from './contracts/IAuthService';

// New service contracts (Phase 0)
import type { IDeckService } from './contracts/IDeckService';
import type { IDenormalizationService } from './contracts/IDenormalizationService';
import type { IBinderStatsService } from './contracts/IBinderStatsService';
import type { IArticleService } from './contracts/IArticleService';
import type { IMatchingService } from './contracts/IMatchingService';
import type { IOAuthService } from './contracts/IOAuthService';
import type { IMetadataService } from './contracts/IMetadataService';
import type { ITradeMatchingService } from './contracts/ITradeMatchingService';
import type { ITradeAnalysisService } from './contracts/ITradeAnalysisService';
import type { IFeaturedCardsService } from './contracts/IFeaturedCardsService';
import type { IHeroService } from './contracts/IHeroService';
import type { ISystemStatsService } from './contracts/ISystemStatsService';
import type { IAuthTokenService } from './contracts/IAuthTokenService';
import type { IOAuthFlowService } from './contracts/IOAuthFlowService';

// ❌ MongoDB implementations - DEPRECATED (commented out to prevent loading)
// These are kept in the codebase as reference only, not functional
// import { MongoUserService } from './mongodb/user/MongoUserService';
// import { MongoBinderService } from './mongodb/binder/MongoBinderService';
// import { MongoPrintingsService } from './mongodb/printings/MongoPrintingsService';
// import { MongoWantsService } from './mongodb/wants/MongoWantsService';
// import { MongoInventoryService } from './mongodb/inventory/MongoInventoryService';
import { AuthService } from './auth/AuthService';

// PostgreSQL implementations
import { PostgresUserService } from './postgres/user/PostgresUserService';
import { PostgresBinderService } from './postgres/binder/PostgresBinderService';
import { PostgresPrintingsService } from './postgres/printings/PostgresPrintingsService';
import { PostgresWantsService } from './postgres/wants/PostgresWantsService';
import { PostgresInventoryService } from './postgres/inventory/PostgresInventoryService';
import { PostgresDeckService } from './postgres/deck/PostgresDeckService';
import { PostgresArticleService } from './postgres/article/PostgresArticleService';
import { PostgresOAuthService } from './postgres/oauth/PostgresOAuthService';
import { PostgresAuthTokenService } from './postgres/auth-token/PostgresAuthTokenService';
import { PostgresOAuthFlowService } from './postgres/oauth-flow/PostgresOAuthFlowService';

// ❌ MongoDB implementations - DEPRECATED (commented out to prevent loading)
// These are kept in the codebase as reference only, not functional
// Deprecated MongoDB service imports removed (2026-02-16)
// - MongoBinderStatsService → Use binderService.getUserBindersWithStats()
// - MongoHeroService → Use printingsService + fab-constants/heroes + articleService
// - MongoMetadataService → Use @/lib/fab-constants
// - Other deprecated services documented in lib/services/CLAUDE.md

/**
 * Service Factory
 *
 * Manages creation and caching of service instances.
 * Uses singleton pattern to ensure only one instance per service.
 *
 * Database Provider:
 * PostgreSQL is the only active database. MongoDB implementations are deprecated
 * and kept as reference code only.
 *
 * The DATABASE_PROVIDER env var exists for migration testing purposes only.
 * Production should always use 'postgres' (default).
 */
class ServiceFactory {
  // Database provider configuration (postgres is default and only supported option)
  private static _dbProvider: 'mongodb' | 'postgres' =
    (process.env.DATABASE_PROVIDER as 'mongodb' | 'postgres') || 'postgres';
  // Existing services
  private static _userService: IUserService | null = null;
  private static _binderService: IBinderService | null = null;
  private static _printingsService: IPrintingsService | null = null;
  private static _wantsService: IWantsService | null = null;
  private static _inventoryService: IInventoryService | null = null;
  private static _authService: IAuthService | null = null;

  // New services (Phase 0) - implementations will be added as they are created
  private static _deckService: IDeckService | null = null;
  private static _denormalizationService: IDenormalizationService | null = null;
  private static _articleService: IArticleService | null = null;
  private static _matchingService: IMatchingService | null = null;
  private static _oauthService: IOAuthService | null = null;
  private static _metadataService: IMetadataService | null = null;
  private static _tradeMatchingService: ITradeMatchingService | null = null;
  private static _tradeAnalysisService: ITradeAnalysisService | null = null;
  private static _featuredCardsService: IFeaturedCardsService | null = null;
  private static _systemStatsService: ISystemStatsService | null = null;
  private static _authTokenService: IAuthTokenService | null = null;
  private static _oauthFlowService: IOAuthFlowService | null = null;

  /**
   * Get the User Service instance
   *
   * Creates a new UserService on first call, then returns cached instance.
   * Uses PostgreSQL by default (MongoDB deprecated, reference only).
   */
  static get userService(): IUserService {
    if (!this._userService) {
      if (this._dbProvider === 'postgres') {
        this._userService = new PostgresUserService();
      } else {
        throw new Error('MongoDB is deprecated. Use DATABASE_PROVIDER=postgres');
      }
    }
    return this._userService;
  }

  /**
   * Get the Binder Service instance
   *
   * Creates a new BinderService on first call, then returns cached instance.
   * Uses PostgreSQL by default (MongoDB deprecated, reference only).
   */
  static get binderService(): IBinderService {
    if (!this._binderService) {
      if (this._dbProvider === 'postgres') {
        this._binderService = new PostgresBinderService();
      } else {
        throw new Error('MongoDB is deprecated. Use DATABASE_PROVIDER=postgres');
      }
    }
    return this._binderService;
  }

  /**
   * Set the User Service instance (for testing)
   *
   * Allows injection of mock services during tests.
   *
   * @example
   * ```typescript
   * // In test file:
   * ServiceFactory.setUserService(mockUserService);
   * ```
   */
  static setUserService(service: IUserService): void {
    this._userService = service;
  }

  /**
   * Set the Binder Service instance (for testing)
   *
   * Allows injection of mock services during tests.
   *
   * @example
   * ```typescript
   * // In test file:
   * ServiceFactory.setBinderService(mockBinderService);
   * ```
   */
  static setBinderService(service: IBinderService): void {
    this._binderService = service;
  }

  /**
   * Get the Printings Service instance
   *
   * Creates a new PrintingsService on first call, then returns cached instance.
   * Uses PostgreSQL by default (MongoDB deprecated, reference only).
   */
  static get printingsService(): IPrintingsService {
    if (!this._printingsService) {
      this._printingsService = this._dbProvider === 'postgres'
        ? new PostgresPrintingsService()
        : (() => { throw new Error("MongoDB is deprecated. Use DATABASE_PROVIDER=postgres"); })();
    }
    return this._printingsService;
  }


  /**
   * Set the Printings Service instance (for testing)
   *
   * Allows injection of mock services during tests.
   *
   * @example
   * ```typescript
   * // In test file:
   * ServiceFactory.setPrintingsService(mockPrintingsService);
   * ```
   */
  static setPrintingsService(service: IPrintingsService): void {
    this._printingsService = service;
  }


  /**
   * Get the Wants Service instance
   *
   * Creates a new WantsService on first call, then returns cached instance.
   * Uses PostgreSQL by default (MongoDB deprecated, reference only).
   */
  static get wantsService(): IWantsService {
    if (!this._wantsService) {
      this._wantsService = this._dbProvider === 'postgres'
        ? new PostgresWantsService()
        : (() => { throw new Error("MongoDB is deprecated. Use DATABASE_PROVIDER=postgres"); })();
    }
    return this._wantsService;
  }

  /**
   * Set the Wants Service instance (for testing)
   *
   * Allows injection of mock services during tests.
   *
   * @example
   * ```typescript
   * // In test file:
   * ServiceFactory.setWantsService(mockWantsService);
   * ```
   */
  static setWantsService(service: IWantsService): void {
    this._wantsService = service;
  }

  /**
   * Get the Inventory Service instance
   *
   * Creates a new InventoryService on first call, then returns cached instance.
   * Uses PostgreSQL by default (MongoDB deprecated, reference only).
   */
  static get inventoryService(): IInventoryService {
    if (!this._inventoryService) {
      this._inventoryService = this._dbProvider === 'postgres'
        ? new PostgresInventoryService()
        : (() => { throw new Error("MongoDB is deprecated. Use DATABASE_PROVIDER=postgres"); })();
    }
    return this._inventoryService;
  }

  /**
   * Set the Inventory Service instance (for testing)
   *
   * Allows injection of mock services during tests.
   *
   * @example
   * ```typescript
   * // In test file:
   * ServiceFactory.setInventoryService(mockInventoryService);
   * ```
   */
  static setInventoryService(service: IInventoryService): void {
    this._inventoryService = service;
  }


  /**
   * Get the Auth Service instance
   *
   * Creates a new AuthService on first call, then returns cached instance.
   * Note: This is database-agnostic (handles JWT, hashing, etc.)
   */
  static get authService(): IAuthService {
    if (!this._authService) {
      this._authService = new AuthService();
    }
    return this._authService;
  }

  /**
   * Set the Auth Service instance (for testing)
   *
   * Allows injection of mock services during tests.
   *
   * @example
   * ```typescript
   * // In test file:
   * ServiceFactory.setAuthService(mockAuthService);
   * ```
   */
  static setAuthService(service: IAuthService): void {
    this._authService = service;
  }

  /**
   * Reset all services (for testing)
   *
   * Clears all cached service instances.
   */
  static reset(): void {
    // Existing services
    this._userService = null;
    this._binderService = null;
    this._printingsService = null;
    this._wantsService = null;
    this._inventoryService = null;
    this._authService = null;

    // New services
    this._deckService = null;
    this._denormalizationService = null;
    this._articleService = null;
    this._matchingService = null;
    this._oauthService = null;
    this._metadataService = null;
    this._tradeMatchingService = null;
    this._tradeAnalysisService = null;
    this._featuredCardsService = null;
    this._systemStatsService = null;
    this._authTokenService = null;
  }

  // ====================================
  // New Service Getters (Phase 0)
  // Implementations will be added as services are created
  // ====================================

  /**
   * Get the Deck Service instance
   *
   * Creates a new DeckService on first call, then returns cached instance.
   * Uses PostgreSQL by default (MongoDB deprecated, reference only).
   */
  static get deckService(): IDeckService {
    if (!this._deckService) {
      this._deckService = this._dbProvider === 'postgres'
        ? new PostgresDeckService()
        : (() => { throw new Error("MongoDB is deprecated. Use DATABASE_PROVIDER=postgres"); })();
    }
    return this._deckService;
  }

  static setDeckService(service: IDeckService): void {
    this._deckService = service;
  }


  /**
   * Get the Denormalization Service instance
   * @deprecated For PostgreSQL, denormalization is not needed. Use JOINs instead.
   */
  static get denormalizationService(): IDenormalizationService {
    throw new Error('denormalizationService is deprecated for PostgreSQL. Use JOINs instead of denormalizing data.');
  }

  static setDenormalizationService(service: IDenormalizationService): void {
    this._denormalizationService = service;
  }


  /**
   * Get the Article Service instance
   *
   * Creates a new ArticleService on first call, then returns cached instance.
   * Uses PostgreSQL by default (MongoDB deprecated, reference only).
   */
  static get articleService(): IArticleService {
    if (!this._articleService) {
      this._articleService = this._dbProvider === 'postgres'
        ? new PostgresArticleService()
        : (() => { throw new Error("MongoDB is deprecated. Use DATABASE_PROVIDER=postgres"); })();
    }
    return this._articleService;
  }

  static setArticleService(service: IArticleService): void {
    this._articleService = service;
  }

  /**
   * Get the Matching Service instance
   * @deprecated This service has redundant functionality and is being removed.
   */
  static get matchingService(): IMatchingService {
    throw new Error('matchingService is deprecated. Redundant functionality - consider consolidating trade matching logic.');
  }

  static setMatchingService(service: IMatchingService): void {
    this._matchingService = service;
  }

  /**
   * Get the OAuth Service instance
   */
  /**
   * Get the OAuth Service instance
   *
   * Creates a new OAuthService on first call, then returns cached instance.
   * Uses PostgreSQL by default (MongoDB deprecated, reference only).
   */
  static get oauthService(): IOAuthService {
    if (!this._oauthService) {
      this._oauthService = this._dbProvider === 'postgres'
        ? new PostgresOAuthService()
        : (() => { throw new Error("MongoDB is deprecated. Use DATABASE_PROVIDER=postgres"); })();
    }
    return this._oauthService;
  }

  static setOAuthService(service: IOAuthService): void {
    this._oauthService = service;
  }

  /**
   * Get the Metadata Service instance
   * @deprecated Card metadata is now available as static constants. Use @/lib/fab-constants instead.
   */
  static get metadataService(): IMetadataService {
    throw new Error('metadataService is deprecated. Use @/lib/fab-constants (SET_MAP, FOILING_MAP, RARITY_MAP, etc.) instead of database calls.');
  }

  static setMetadataService(service: IMetadataService): void {
    this._metadataService = service;
  }

  /**
   * Get the Trade Matching Service instance
   * @deprecated This service has redundant functionality and is being removed.
   */
  static get tradeMatchingService(): ITradeMatchingService {
    throw new Error('tradeMatchingService is deprecated. Redundant functionality - consider consolidating trade matching logic.');
  }

  static setTradeMatchingService(service: ITradeMatchingService): void {
    this._tradeMatchingService = service;
  }

  /**
   * Get the Trade Analysis Service instance
   * @deprecated This service has redundant functionality and is being removed.
   */
  static get tradeAnalysisService(): ITradeAnalysisService {
    throw new Error('tradeAnalysisService is deprecated. Redundant functionality - consider consolidating trade matching logic.');
  }

  static setTradeAnalysisService(service: ITradeAnalysisService): void {
    this._tradeAnalysisService = service;
  }

  /**
   * Get the Featured Cards Service instance
   * @deprecated Consider using PostgreSQL materialized views or Redis for caching instead.
   */
  static get featuredCardsService(): IFeaturedCardsService {
    throw new Error('featuredCardsService is deprecated. Consider using PostgreSQL materialized views or Redis for featured card caching.');
  }

  static setFeaturedCardsService(service: IFeaturedCardsService): void {
    this._featuredCardsService = service;
  }


  /**
   * Get the System Stats Service instance
   * @deprecated Homepage vanity metrics (total users, total cards) are no longer needed.
   */
  static get systemStatsService(): ISystemStatsService {
    throw new Error('systemStatsService is deprecated. Homepage vanity metrics have been removed.');
  }

  static setSystemStatsService(service: ISystemStatsService): void {
    this._systemStatsService = service;
  }

  /**
   * Get the Auth Token Service instance
   */
  /**
   * Get the Auth Token Service instance
   *
   * Creates a new AuthTokenService on first call, then returns cached instance.
   * Uses PostgreSQL by default (MongoDB deprecated, reference only).
   */
  static get authTokenService(): IAuthTokenService {
    if (!this._authTokenService) {
      this._authTokenService = this._dbProvider === 'postgres'
        ? new PostgresAuthTokenService()
        : (() => { throw new Error("MongoDB is deprecated. Use DATABASE_PROVIDER=postgres"); })();
    }
    return this._authTokenService;
  }

  static setAuthTokenService(service: IAuthTokenService): void {
    this._authTokenService = service;
  }

  /**
   * Get the OAuth Flow Service instance
   */
  /**
   * Get the OAuth Flow Service instance
   *
   * Creates a new OAuthFlowService on first call, then returns cached instance.
   * Uses PostgreSQL by default (MongoDB deprecated, reference only).
   */
  static get oauthFlowService(): IOAuthFlowService {
    if (!this._oauthFlowService) {
      this._oauthFlowService = this._dbProvider === 'postgres'
        ? new PostgresOAuthFlowService()
        : (() => { throw new Error("MongoDB is deprecated. Use DATABASE_PROVIDER=postgres"); })();
    }
    return this._oauthFlowService;
  }

  static setOAuthFlowService(service: IOAuthFlowService): void {
    this._oauthFlowService = service;
  }
}

/**
 * Exported service instances
 *
 * Import these in your route handlers:
 * ```typescript
 * import { userService, binderService, printingsService, wantsService, inventoryService } from '@/lib/services';
 * const result = await userService.getLocation(userId);
 * const binderResult = await binderService.getBinder(binderId);
 * const printingsResult = await printingsService.searchPrintings({ name: 'Art of War' });
 * const printingResult = await printingsService.getPrintingById('abc123');
 * const wantsResult = await wantsService.getUserWants(userId);
 * const inventoryResult = await inventoryService.getWhoHasPrintings(['printing1', 'printing2']);
 * ```
 */
// Existing services
export const userService = ServiceFactory.userService;
export const binderService = ServiceFactory.binderService;
export const printingsService = ServiceFactory.printingsService;
export const wantsService = ServiceFactory.wantsService;
export const inventoryService = ServiceFactory.inventoryService;
export const authService = ServiceFactory.authService;

// New services (PostgreSQL implementations)
export const deckService = ServiceFactory.deckService;
export const articleService = ServiceFactory.articleService;
export const oauthService = ServiceFactory.oauthService;
export const authTokenService = ServiceFactory.authTokenService;
export const oauthFlowService = ServiceFactory.oauthFlowService;

// ❌ Deprecated services - DO NOT USE (commented out to prevent module loading errors)
// export const denormalizationService = ServiceFactory.denormalizationService; // Use JOINs instead
// export const binderStatsService = ServiceFactory.binderStatsService; // Use binderService.getUserBindersWithStats()
// export const matchingService = ServiceFactory.matchingService; // Redundant functionality
// export const metadataService = ServiceFactory.metadataService; // Use @/lib/fab-constants
// export const tradeMatchingService = ServiceFactory.tradeMatchingService; // Redundant functionality
// export const tradeAnalysisService = ServiceFactory.tradeAnalysisService; // Redundant functionality
// export const featuredCardsService = ServiceFactory.featuredCardsService; // Use PostgreSQL views or Redis
// export const heroService = ServiceFactory.heroService; // Use printingsService + constants + articleService
// export const systemStatsService = ServiceFactory.systemStatsService; // Vanity metrics removed

/**
 * Export factory for advanced use cases (e.g., testing)
 */
export { ServiceFactory };
