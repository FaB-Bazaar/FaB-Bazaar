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
import type { IFacetService } from './contracts/IFacetService';
import type { IWantsService } from './contracts/IWantsService';
import type { IInventoryService } from './contracts/IInventoryService';
import type { IAuthService } from './contracts/IAuthService';

// Additional service contracts
import type { ILocationService } from './contracts/ILocationService';
import type { IEventService } from './contracts/IEventService';
import type { IDeckService } from './contracts/IDeckService';
import type { IArticleService } from './contracts/IArticleService';
import type { IOAuthService } from './contracts/IOAuthService';
import type { IAuthTokenService } from './contracts/IAuthTokenService';
import type { IOAuthFlowService } from './contracts/IOAuthFlowService';
import type { ICuratedListService } from './contracts/ICuratedListService';
import type { ICuratorHeroAssignmentService } from './contracts/ICuratorHeroAssignmentService';
import type { ICustomTokenCardService } from './contracts/ICustomTokenCardService';
import type { IBannedCardsService } from './contracts/IBannedCardsService';
import type { IDailyMoversService } from './contracts/IDailyMoversService';
import type { ILeagueService } from './contracts/ILeagueService';
import type { ICollectibleService } from './contracts/ICollectibleService';

// Deprecated contracts (kept only because other files import their DTO types)
import type { IBinderStatsService } from './contracts/IBinderStatsService';
import type { IMetadataService } from './contracts/IMetadataService';

import { AuthService } from './auth/AuthService';

// PostgreSQL implementations
import { PostgresUserService } from './postgres/user/PostgresUserService';
import { PostgresBinderService } from './postgres/binder/PostgresBinderService';
import { PostgresPrintingsService } from './postgres/printings/PostgresPrintingsService';
import { PostgresFacetService } from './postgres/facets/PostgresFacetService';
import { PostgresWantsService } from './postgres/wants/PostgresWantsService';
import { PostgresInventoryService } from './postgres/inventory/PostgresInventoryService';
import { PostgresLocationService } from './postgres/location/PostgresLocationService';
import { PostgresEventService } from './postgres/event/PostgresEventService';
import { PostgresDeckService } from './postgres/deck/PostgresDeckService';
import { PostgresArticleService } from './postgres/article/PostgresArticleService';
import { PostgresOAuthService } from './postgres/oauth/PostgresOAuthService';
import { PostgresAuthTokenService } from './postgres/auth-token/PostgresAuthTokenService';
import { PostgresOAuthFlowService } from './postgres/oauth-flow/PostgresOAuthFlowService';
import { PostgresCuratedListService } from './postgres/curated-lists/PostgresCuratedListService';
import { PostgresCuratorHeroAssignmentService } from './postgres/curator-heroes/PostgresCuratorHeroAssignmentService';
import { PostgresCustomTokenCardService } from './postgres/custom-token-cards/PostgresCustomTokenCardService';
import { PostgresGameResultsService } from './postgres/gameResults/PostgresGameResultsService';
import { PostgresSiteSettingsService } from './postgres/site-settings/PostgresSiteSettingsService';
import { PostgresMcpUsageService } from './postgres/mcp-usage/PostgresMcpUsageService';
import { PostgresLlmUsageService } from './postgres/llm-usage/PostgresLlmUsageService';
import { PostgresSetsService } from './postgres/sets/PostgresSetsService';
import { PostgresBannedCardsService } from './postgres/banned-cards/PostgresBannedCardsService';
import { PostgresDailyMoversService } from './postgres/daily-movers/PostgresDailyMoversService';
import { PostgresLeagueService } from './postgres/league/PostgresLeagueService';
import { PostgresCollectibleService } from './postgres/collectibles/PostgresCollectibleService';


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
  private static _facetService: IFacetService | null = null;
  private static _wantsService: IWantsService | null = null;
  private static _inventoryService: IInventoryService | null = null;
  private static _authService: IAuthService | null = null;

  // Location & Event services
  private static _locationService: ILocationService | null = null;
  private static _eventService: IEventService | null = null;

  // Additional services
  private static _deckService: IDeckService | null = null;
  private static _articleService: IArticleService | null = null;
  private static _oauthService: IOAuthService | null = null;
  private static _authTokenService: IAuthTokenService | null = null;
  private static _oauthFlowService: IOAuthFlowService | null = null;
  private static _curatedListService: ICuratedListService | null = null;
  private static _curatorHeroAssignmentService: ICuratorHeroAssignmentService | null = null;
  private static _customTokenCardService: ICustomTokenCardService | null = null;
  private static _bannedCardsService: IBannedCardsService | null = null;
  private static _dailyMoversService: IDailyMoversService | null = null;
  private static _leagueService: ILeagueService | null = null;
  private static _collectibleService: ICollectibleService | null = null;

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

  /** Get the Facet (content-manager) Service instance. */
  static get facetService(): IFacetService {
    if (!this._facetService) {
      this._facetService = this._dbProvider === 'postgres'
        ? new PostgresFacetService()
        : (() => { throw new Error("MongoDB is deprecated. Use DATABASE_PROVIDER=postgres"); })();
    }
    return this._facetService;
  }

  /** Set the Facet Service instance (for testing). */
  static setFacetService(service: IFacetService): void {
    this._facetService = service;
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
    this._facetService = null;
    this._wantsService = null;
    this._inventoryService = null;
    this._authService = null;

    // Location & Event services
    this._locationService = null;
    this._eventService = null;

    // Additional services
    this._deckService = null;
    this._articleService = null;
    this._oauthService = null;
    this._authTokenService = null;
  }

  // ====================================
  // Location & Event Services
  // ====================================

  static get locationService(): ILocationService {
    if (!this._locationService) {
      this._locationService = new PostgresLocationService();
    }
    return this._locationService;
  }

  static setLocationService(service: ILocationService): void {
    this._locationService = service;
  }

  static get eventService(): IEventService {
    if (!this._eventService) {
      this._eventService = new PostgresEventService();
    }
    return this._eventService;
  }

  static setEventService(service: IEventService): void {
    this._eventService = service;
  }

  // ====================================
  // Additional Service Getters
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

  static get curatedListService(): ICuratedListService {
    if (!this._curatedListService) {
      this._curatedListService = new PostgresCuratedListService();
    }
    return this._curatedListService;
  }

  static setCuratedListService(service: ICuratedListService): void {
    this._curatedListService = service;
  }

  static get curatorHeroAssignmentService(): ICuratorHeroAssignmentService {
    if (!this._curatorHeroAssignmentService) {
      this._curatorHeroAssignmentService = new PostgresCuratorHeroAssignmentService();
    }
    return this._curatorHeroAssignmentService;
  }

  static setCuratorHeroAssignmentService(service: ICuratorHeroAssignmentService): void {
    this._curatorHeroAssignmentService = service;
  }

  static get customTokenCardService(): ICustomTokenCardService {
    if (!this._customTokenCardService) {
      this._customTokenCardService = new PostgresCustomTokenCardService();
    }
    return this._customTokenCardService;
  }

  static setCustomTokenCardService(service: ICustomTokenCardService): void {
    this._customTokenCardService = service;
  }

  static get bannedCardsService(): IBannedCardsService {
    if (!this._bannedCardsService) {
      this._bannedCardsService = new PostgresBannedCardsService();
    }
    return this._bannedCardsService;
  }

  static setBannedCardsService(service: IBannedCardsService): void {
    this._bannedCardsService = service;
  }

  static get dailyMoversService(): IDailyMoversService {
    if (!this._dailyMoversService) {
      this._dailyMoversService = new PostgresDailyMoversService();
    }
    return this._dailyMoversService;
  }

  static setDailyMoversService(service: IDailyMoversService): void {
    this._dailyMoversService = service;
  }

  static get leagueService(): ILeagueService {
    if (!this._leagueService) {
      this._leagueService = new PostgresLeagueService();
    }
    return this._leagueService;
  }

  static setLeagueService(service: ILeagueService): void {
    this._leagueService = service;
  }

  static get collectibleService(): ICollectibleService {
    if (!this._collectibleService) {
      this._collectibleService = new PostgresCollectibleService();
    }
    return this._collectibleService;
  }

  static setCollectibleService(service: ICollectibleService): void {
    this._collectibleService = service;
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
export const facetService = ServiceFactory.facetService;
export const wantsService = ServiceFactory.wantsService;
export const inventoryService = ServiceFactory.inventoryService;
export const authService = ServiceFactory.authService;

// Location & Event services
export const locationService = ServiceFactory.locationService;
export const eventService = ServiceFactory.eventService;

// New services (PostgreSQL implementations)
export const deckService = ServiceFactory.deckService;
export const articleService = ServiceFactory.articleService;
export const oauthService = ServiceFactory.oauthService;
export const authTokenService = ServiceFactory.authTokenService;
export const oauthFlowService = ServiceFactory.oauthFlowService;
export const curatedListService = ServiceFactory.curatedListService;
export const curatorHeroAssignmentService = ServiceFactory.curatorHeroAssignmentService;
export const customTokenCardService = ServiceFactory.customTokenCardService;
export const gameResultsService = new PostgresGameResultsService();
export const siteSettingsService = new PostgresSiteSettingsService();
export const mcpUsageService = new PostgresMcpUsageService();
export const llmUsageService = new PostgresLlmUsageService();
export const setsService = new PostgresSetsService();
export const bannedCardsService = ServiceFactory.bannedCardsService;
export const dailyMoversService = ServiceFactory.dailyMoversService;
export const leagueService = ServiceFactory.leagueService;
export const collectibleService = ServiceFactory.collectibleService;


/**
 * Export factory for advanced use cases (e.g., testing)
 */
export { ServiceFactory };
