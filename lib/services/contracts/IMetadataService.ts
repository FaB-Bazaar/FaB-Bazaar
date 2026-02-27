/**
 * Metadata Service Contract
 *
 * Database-agnostic interface for card metadata operations.
 * Provides access to sets, editions, foilings, rarities, and art variations.
 *
 * All operations are read-only and sorted for UI consistency.
 */

import type { AsyncResult } from './common';

// ====================================
// DTOs (Data Transfer Objects)
// ====================================

/**
 * Set DTO - Card set/expansion information
 */
export interface SetDTO {
  _id: string;
  code: string;
  name: string;
  releaseDate?: Date;
  isPromo: boolean;
  category: 'main' | 'blitz' | 'promo' | 'other';
  logoUrl?: string;
  outOfPrint: boolean;
}

/**
 * Edition DTO - Card edition information (e.g., First Edition, Unlimited)
 */
export interface EditionDTO {
  _id: string;
  code: string;
  name: string;
  displayClass: string;
}

/**
 * Foiling DTO - Card foiling type (e.g., Rainbow Foil, Cold Foil)
 */
export interface FoilingDTO {
  _id: string;
  code: string;
  name: string;
  abbreviation: string;
  displayClass: string;
}

/**
 * Rarity DTO - Card rarity (e.g., Common, Rare, Legendary)
 */
export interface RarityDTO {
  _id: string;
  code: string;
  name: string;
  abbreviation: string;
  displayClass: string;
}

/**
 * Art Variation DTO - Special art treatments
 */
export interface ArtVariationDTO {
  _id: string;
  code: string;
  name: string;
  displayClass: string;
}

/**
 * Complete metadata collection
 * Returned by getAllMetadata() for bulk fetching
 */
export interface MetadataCollectionDTO {
  sets: SetDTO[];
  editions: EditionDTO[];
  foilings: FoilingDTO[];
  rarities: RarityDTO[];
  artVariations: ArtVariationDTO[];
}

// ====================================
// Service Interface
// ====================================

/**
 * Metadata Service Interface
 *
 * All methods are read-only and return sorted results.
 */
export interface IMetadataService {
  /**
   * Fetch all metadata types in parallel
   *
   * Optimized for initial page load and client-side caching.
   *
   * @returns Result containing all metadata collections
   *
   * @example
   * ```typescript
   * const result = await metadataService.getAllMetadata();
   * if (result.success) {
   *   console.log(`Loaded ${result.data.sets.length} sets`);
   * }
   * ```
   */
  getAllMetadata(): AsyncResult<MetadataCollectionDTO>;

  /**
   * Fetch sets with optional category filter
   *
   * @param category - Optional filter: 'main', 'blitz', 'promo', or 'other'
   * @returns Result containing array of sets sorted by name
   *
   * @example
   * ```typescript
   * // All sets
   * const result = await metadataService.getSets();
   *
   * // Only main sets
   * const mainSets = await metadataService.getSets('main');
   * ```
   */
  getSets(category?: string): AsyncResult<SetDTO[]>;

  /**
   * Fetch all editions
   *
   * @returns Result containing array of editions sorted by code
   *
   * @example
   * ```typescript
   * const result = await metadataService.getEditions();
   * if (result.success) {
   *   console.log(result.data); // [{ code: 'F', name: 'First Edition', ... }]
   * }
   * ```
   */
  getEditions(): AsyncResult<EditionDTO[]>;

  /**
   * Fetch all foilings
   *
   * @returns Result containing array of foilings sorted by code
   *
   * @example
   * ```typescript
   * const result = await metadataService.getFoilings();
   * ```
   */
  getFoilings(): AsyncResult<FoilingDTO[]>;

  /**
   * Fetch all rarities
   *
   * @returns Result containing array of rarities sorted by code
   *
   * @example
   * ```typescript
   * const result = await metadataService.getRarities();
   * ```
   */
  getRarities(): AsyncResult<RarityDTO[]>;

  /**
   * Fetch all art variations
   *
   * @returns Result containing array of art variations sorted by code
   *
   * @example
   * ```typescript
   * const result = await metadataService.getArtVariations();
   * ```
   */
  getArtVariations(): AsyncResult<ArtVariationDTO[]>;
}
