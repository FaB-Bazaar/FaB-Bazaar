/**
 * MongoDB implementation of Hero Service
 *
 * Manages hero printing cards with filtering and search capabilities.
 */

import connectToDatabase from '@/lib/mongodb';
import HeroPrintingCard from '@/models/HeroPrintingCard';
import type {
  IHeroService,
  HeroPrintingDTO,
  HeroSearchFilters,
  HeroSearchResultDTO,
} from '../../contracts/IHeroService';
import type { AsyncResult } from '../../contracts/common';

export class MongoHeroService implements IHeroService {
  /**
   * Ensures database connection before operations
   */
  private async ensureConnection() {
    await connectToDatabase();
  }

  /**
   * Search for heroes with optional filters
   */
  async searchHeroes(filters?: HeroSearchFilters): AsyncResult<HeroSearchResultDTO> {
    try {
      await this.ensureConnection();

      // Build query
      const query: any = {};

      // Format filter: young vs adult
      if (filters?.format === 'young') {
        query.is_young = true;
      } else if (filters?.format === 'adult') {
        query.is_young = false;
      }

      // Class filter
      if (filters?.class) {
        query.classes = filters.class;
      }

      // Talent filter
      if (filters?.talent) {
        query.talents = filters.talent;
      }

      // Search by name
      if (filters?.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { display_name: { $regex: filters.search, $options: 'i' } },
        ];
      }

      // Fetch heroes
      const heroes = await HeroPrintingCard.find(query)
        .select('heroSlug name display_name health classes talents image_url is_young primary_printing_id')
        .sort({ name: 1 })
        .lean();

      // Convert _id to string for DTO
      const heroesDTO: HeroPrintingDTO[] = heroes.map((hero: any) => ({
        ...hero,
        _id: hero._id.toString(),
      }));

      return {
        success: true,
        data: {
          heroes: heroesDTO,
          count: heroesDTO.length,
        },
      };
    } catch (error) {
      console.error('[MongoHeroService] searchHeroes error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search heroes',
      };
    }
  }

  /**
   * Get a single hero by slug
   */
  async getHeroBySlug(heroSlug: string): AsyncResult<HeroPrintingDTO | null> {
    try {
      await this.ensureConnection();

      // Fetch hero with all printings
      const hero = await HeroPrintingCard.findOne({ heroSlug }).lean();

      if (!hero) {
        return {
          success: true,
          data: null,
        };
      }

      // Convert _id to string for DTO
      const heroDTO: HeroPrintingDTO = {
        ...(hero as any),
        _id: hero._id.toString(),
      };

      return {
        success: true,
        data: heroDTO,
      };
    } catch (error) {
      console.error('[MongoHeroService] getHeroBySlug error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get hero',
      };
    }
  }

  // ====================================
  // Hero Content Management (Added 2026-01-12 for database agnostic migration)
  // These methods handle Hero CMS content (guides), NOT HeroPrintingCard data
  // ====================================

  /**
   * Create or update hero content (guide/strategy page)
   */
  async upsertHeroContent(
    slug: string,
    data: {
      introduction?: string;
      generalStrategy?: string;
      featuredWeapons?: any[];
      [key: string]: any;
    }
  ): AsyncResult<any> {
    try {
      await this.ensureConnection();

      // Dynamic import to avoid circular dependencies
      const Hero = (await import('@/models/Hero')).default;

      const hero = await Hero.findOneAndUpdate(
        { heroSlug: slug },
        data,
        { upsert: true, new: true }
      );

      return { success: true, data: hero };
    } catch (error) {
      console.error('[MongoHeroService] upsertHeroContent error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upsert hero content',
      };
    }
  }

  /**
   * Get hero content (guide/strategy page) by slug
   */
  async getHeroContent(slug: string): AsyncResult<any | null> {
    try {
      await this.ensureConnection();

      // Dynamic import to avoid circular dependencies
      const Hero = (await import('@/models/Hero')).default;

      const hero = await Hero.findOne({ heroSlug: slug }).lean();

      return { success: true, data: hero };
    } catch (error) {
      console.error('[MongoHeroService] getHeroContent error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get hero content',
      };
    }
  }

  /**
   * Delete hero content (guide/strategy page)
   */
  async deleteHeroContent(slug: string): AsyncResult<void> {
    try {
      await this.ensureConnection();

      // Dynamic import to avoid circular dependencies
      const Hero = (await import('@/models/Hero')).default;

      await Hero.deleteOne({ heroSlug: slug });

      return { success: true, data: undefined };
    } catch (error) {
      console.error('[MongoHeroService] deleteHeroContent error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete hero content',
      };
    }
  }
}
