/**
 * Hero Service Contract
 *
 * Database-agnostic interface for hero card operations.
 * Manages hero printings with filtering and search capabilities.
 */

import type { AsyncResult } from './common';

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Hero Printing DTO - Complete hero card data
 */
export interface HeroPrintingDTO {
  _id: string;
  heroSlug: string;
  name: string;
  display_name: string;
  health?: number;
  classes?: string[];
  talents?: string[];
  image_url?: string;
  is_young: boolean;
  primary_printing_id?: string;
  intellect?: number;
  printings?: Array<{
    printing_id: string;
    set?: string;
    edition?: string;
    foiling?: string;
    rarity?: string;
    image_url?: string;
    tcg_market?: number;
  }>;
}

/**
 * Hero search filters
 */
export interface HeroSearchFilters {
  /** Filter by format: 'young' or 'adult' */
  format?: 'young' | 'adult';
  /** Filter by class (e.g., 'Warrior', 'Ninja') */
  class?: string;
  /** Filter by talent (e.g., 'Light', 'Shadow') */
  talent?: string;
  /** Search by name (case-insensitive regex) */
  search?: string;
}

/**
 * Hero search result DTO
 */
export interface HeroSearchResultDTO {
  heroes: HeroPrintingDTO[];
  count: number;
}

// ====================================
// Service Interface
// ====================================

/**
 * Hero Service Interface
 *
 * Provides access to hero card data with filtering and search.
 */
export interface IHeroService {
  /**
   * Search for heroes with optional filters
   *
   * Supports filtering by format (young/adult), class, talent,
   * and name search. Returns heroes sorted by name.
   *
   * @param filters - Search filters
   * @returns List of matching heroes with count
   *
   * @example
   * ```typescript
   * // Get all young heroes
   * const result = await heroService.searchHeroes({ format: 'young' });
   *
   * // Search for warriors
   * const warriors = await heroService.searchHeroes({ class: 'Warrior' });
   *
   * // Search by name
   * const katsu = await heroService.searchHeroes({ search: 'Katsu' });
   * ```
   */
  searchHeroes(filters?: HeroSearchFilters): AsyncResult<HeroSearchResultDTO>;

  /**
   * Get a single hero by slug
   *
   * Returns complete hero data including all printings.
   *
   * @param heroSlug - The hero's unique slug identifier
   * @returns Hero data or null if not found
   *
   * @example
   * ```typescript
   * const result = await heroService.getHeroBySlug('katsu-the-wanderer');
   * if (result.success && result.data) {
   *   console.log(result.data.name); // "Katsu, the Wanderer"
   * }
   * ```
   */
  getHeroBySlug(heroSlug: string): AsyncResult<HeroPrintingDTO | null>;

  // ====================================
  // Hero Content Management (Added 2026-01-12 for database agnostic migration)
  // These methods handle Hero CMS content (guides), NOT HeroPrintingCard data
  // ====================================

  /**
   * Create or update hero content (guide/strategy page)
   *
   * Uses upsert to create if not exists, update if exists.
   * This is for CMS content like hero guides, not card data.
   *
   * @param slug - The hero slug identifier
   * @param data - Hero content data (introduction, strategy, weapons, etc.)
   * @returns Updated hero content
   *
   * @example
   * ```typescript
   * const result = await heroService.upsertHeroContent('katsu-the-wanderer', {
   *   introduction: 'Katsu is a Ninja warrior...',
   *   generalStrategy: 'Focus on combo attacks...',
   *   featuredWeapons: [...]
   * });
   * ```
   */
  upsertHeroContent(
    slug: string,
    data: {
      introduction?: string;
      generalStrategy?: string;
      featuredWeapons?: any[];
      [key: string]: any; // Allow any Hero model fields
    }
  ): AsyncResult<any>;

  /**
   * Get hero content (guide/strategy page) by slug
   *
   * Returns CMS content for hero guides, not card data.
   *
   * @param slug - The hero slug identifier
   * @returns Hero content or null if not found
   *
   * @example
   * ```typescript
   * const result = await heroService.getHeroContent('katsu-the-wanderer');
   * if (result.success && result.data) {
   *   console.log(result.data.introduction);
   * }
   * ```
   */
  getHeroContent(slug: string): AsyncResult<any | null>;

  /**
   * Delete hero content (guide/strategy page)
   *
   * Deletes CMS content for a hero guide.
   *
   * @param slug - The hero slug identifier
   * @returns Result indicating success/failure
   *
   * @example
   * ```typescript
   * const result = await heroService.deleteHeroContent('katsu-the-wanderer');
   * if (result.success) {
   *   console.log('Hero content deleted');
   * }
   * ```
   */
  deleteHeroContent(slug: string): AsyncResult<void>;
}
