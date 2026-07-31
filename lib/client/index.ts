/**
 * Client Services - Barrel Export
 *
 * This file provides a single import point for all client services.
 * Components should import from this file instead of individual service files.
 *
 * @example
 * ```typescript
 * import { bindersClient, wantsClient, decksClient } from '@/lib/client';
 *
 * const result = await bindersClient.getBinder(binderId);
 * ```
 */

// Re-export types and utilities
export * from './types';
export * from './utils';

// Re-export client services
export * as bindersClient from './binders-client';
export * as wantsClient from './wants-client';
export * as decksClient from './decks-client';
export * as searchClient from './search-client';
export * as usersClient from './users-client';
export * as heroesClient from './heroes-client';
export * as articlesClient from './articles-client';
export * as locationsClient from './locations-client';
export * as fabraryClient from './fabrary-client';
export * as customTokenCardsClient from './custom-token-cards-client';
export * as dailyClient from './daily-client';
export * as volzarClient from './volzar-client';
export * as collectiblesClient from './collectibles-client';

// Re-export specific types from search-client for convenience
export type {
  MarketplaceSearchOptions,
  BudgetCategory,
  BudgetSearchOptions,
  RarityType,
  RaritySearchOptions,
  PriceStatsDTO,
} from './search-client';
