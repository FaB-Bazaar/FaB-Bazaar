/**
 * MongoDB implementation of Metadata Service
 *
 * Provides read-only access to card metadata collections.
 * All operations use lean queries for optimal performance.
 */

import { Set, Edition, Foiling, Rarity, ArtVariation } from '@/models/CardMetadata';
import connectToDatabase from '@/lib/mongodb';
import type {
  IMetadataService,
  SetDTO,
  EditionDTO,
  FoilingDTO,
  RarityDTO,
  ArtVariationDTO,
  MetadataCollectionDTO,
} from '../../contracts/IMetadataService';
import type { AsyncResult } from '../../contracts/common';

export class MongoMetadataService implements IMetadataService {
  /**
   * Ensures database connection before operations
   */
  private async ensureConnection(): Promise<void> {
    await connectToDatabase();
  }

  /**
   * Convert Mongoose document to SetDTO
   */
  private toSetDTO(doc: any): SetDTO {
    return {
      _id: doc._id.toString(),
      code: doc.code,
      name: doc.name,
      releaseDate: doc.releaseDate,
      isPromo: doc.isPromo,
      category: doc.category,
      logoUrl: doc.logoUrl,
      outOfPrint: doc.outOfPrint,
    };
  }

  /**
   * Convert Mongoose document to EditionDTO
   */
  private toEditionDTO(doc: any): EditionDTO {
    return {
      _id: doc._id.toString(),
      code: doc.code,
      name: doc.name,
      displayClass: doc.displayClass,
    };
  }

  /**
   * Convert Mongoose document to FoilingDTO
   */
  private toFoilingDTO(doc: any): FoilingDTO {
    return {
      _id: doc._id.toString(),
      code: doc.code,
      name: doc.name,
      abbreviation: doc.abbreviation,
      displayClass: doc.displayClass,
    };
  }

  /**
   * Convert Mongoose document to RarityDTO
   */
  private toRarityDTO(doc: any): RarityDTO {
    return {
      _id: doc._id.toString(),
      code: doc.code,
      name: doc.name,
      abbreviation: doc.abbreviation,
      displayClass: doc.displayClass,
    };
  }

  /**
   * Convert Mongoose document to ArtVariationDTO
   */
  private toArtVariationDTO(doc: any): ArtVariationDTO {
    return {
      _id: doc._id.toString(),
      code: doc.code,
      name: doc.name,
      displayClass: doc.displayClass,
    };
  }

  /**
   * Fetch all metadata types in parallel
   */
  async getAllMetadata(): AsyncResult<MetadataCollectionDTO> {
    try {
      await this.ensureConnection();

      // Fetch all metadata in parallel (matches current API behavior)
      const [sets, editions, foilings, rarities, artVariations] = await Promise.all([
        Set.find({}).sort({ name: 1 }).lean(),
        Edition.find({}).sort({ code: 1 }).lean(),
        Foiling.find({}).sort({ code: 1 }).lean(),
        Rarity.find({}).sort({ code: 1 }).lean(),
        ArtVariation.find({}).sort({ code: 1 }).lean(),
      ]);

      return {
        success: true,
        data: {
          sets: sets.map((doc) => this.toSetDTO(doc)),
          editions: editions.map((doc) => this.toEditionDTO(doc)),
          foilings: foilings.map((doc) => this.toFoilingDTO(doc)),
          rarities: rarities.map((doc) => this.toRarityDTO(doc)),
          artVariations: artVariations.map((doc) => this.toArtVariationDTO(doc)),
        },
      };
    } catch (error) {
      console.error('[MongoMetadataService] getAllMetadata error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metadata',
      };
    }
  }

  /**
   * Fetch sets with optional category filter
   */
  async getSets(category?: string): AsyncResult<SetDTO[]> {
    try {
      await this.ensureConnection();

      // Build query
      const query: any = {};
      if (category) {
        query.category = category;
      }

      const sets = await Set.find(query).sort({ name: 1 }).lean();

      return {
        success: true,
        data: sets.map((doc) => this.toSetDTO(doc)),
      };
    } catch (error) {
      console.error('[MongoMetadataService] getSets error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch sets',
      };
    }
  }

  /**
   * Fetch all editions
   */
  async getEditions(): AsyncResult<EditionDTO[]> {
    try {
      await this.ensureConnection();

      const editions = await Edition.find({}).sort({ code: 1 }).lean();

      return {
        success: true,
        data: editions.map((doc) => this.toEditionDTO(doc)),
      };
    } catch (error) {
      console.error('[MongoMetadataService] getEditions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch editions',
      };
    }
  }

  /**
   * Fetch all foilings
   */
  async getFoilings(): AsyncResult<FoilingDTO[]> {
    try {
      await this.ensureConnection();

      const foilings = await Foiling.find({}).sort({ code: 1 }).lean();

      return {
        success: true,
        data: foilings.map((doc) => this.toFoilingDTO(doc)),
      };
    } catch (error) {
      console.error('[MongoMetadataService] getFoilings error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch foilings',
      };
    }
  }

  /**
   * Fetch all rarities
   */
  async getRarities(): AsyncResult<RarityDTO[]> {
    try {
      await this.ensureConnection();

      const rarities = await Rarity.find({}).sort({ code: 1 }).lean();

      return {
        success: true,
        data: rarities.map((doc) => this.toRarityDTO(doc)),
      };
    } catch (error) {
      console.error('[MongoMetadataService] getRarities error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rarities',
      };
    }
  }

  /**
   * Fetch all art variations
   */
  async getArtVariations(): AsyncResult<ArtVariationDTO[]> {
    try {
      await this.ensureConnection();

      const artVariations = await ArtVariation.find({}).sort({ code: 1 }).lean();

      return {
        success: true,
        data: artVariations.map((doc) => this.toArtVariationDTO(doc)),
      };
    } catch (error) {
      console.error('[MongoMetadataService] getArtVariations error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch art variations',
      };
    }
  }
}
