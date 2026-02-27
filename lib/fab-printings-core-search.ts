// lib/fab-printings-core-search.ts - Simple search utility for printings_core collection
//
// @deprecated This file uses direct MongoDB access.
// Prefer using printingsService from '@/lib/services' instead.
// This file is kept for reference during service layer migration testing.
// See: lib/services/mongodb/printings-core/MongoPrintingsCoreService.ts

import connectToDatabase from './mongodb';

// Types for the printings_core collection (simplified)
export interface PrintingCoreDocument {
  _id?: string;
  printing_id: string;
  card_unique_id: string;
  
  // Basic card info
  name: string;
  display_name: string;
  collector_number: string;
  
  // Printing attributes
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  is_extended_art: boolean;
  
  // Card type info
  type_text: string;
  type_text_display: string;
  
  // Pricing data
  tcg_low?: number | null;
  tcg_mid?: number | null;
  tcg_high?: number | null;
  tcg_market?: number | null;
  has_price: boolean;
  price_updated_at?: Date;
  tcgplayer_url?: string;
  
  // Visual
  image_url: string;
  
  // Timestamps
  created_at: Date;
  updated_at?: Date;
}

export interface PrintingCoreFilters {
  // Identifiers
  printingId?: string;
  printingIds?: string[];
  cardUniqueId?: string;
  cardUniqueIds?: string[];
  
  // Text searches
  name?: string;
  exact?: boolean;
  
  // Printing attributes
  sets?: string[];
  editions?: string[];
  foilings?: string[];
  rarities?: string[];
  isExtendedArt?: boolean;
  
  // Price filters
  priceMin?: number;
  priceMax?: number;
  priceField?: 'tcg_low' | 'tcg_mid' | 'tcg_high' | 'tcg_market';
  hasPricing?: boolean;
}

export interface PrintingCoreSearchOptions {
  limit?: number;
  page?: number;
  sortBy?: 'name' | 'price' | 'set' | 'rarity' | 'collector_number';
  sortOrder?: 'asc' | 'desc';
}

export interface PrintingCoreSearchResult {
  printings: PrintingCoreDocument[];
  total: number;
  page: number;
  pages: number;
  queryInfo: {
    query: any;
    executionTime: number;
    filters: PrintingCoreFilters;
  };
}

export class FABPrintingsCoreSearchUtility {
  
  /**
   * Build query for printings_core collection
   */
  buildPrintingsCoreQuery(filters: PrintingCoreFilters): any {
    const query: any = {};
    
    // =====================================
    // IDENTIFIERS
    // =====================================
    
    if (filters.printingId) {
      query.printing_id = filters.printingId;
    }
    
    if (filters.printingIds && filters.printingIds.length > 0) {
      query.printing_id = { $in: filters.printingIds };
    }
    
    if (filters.cardUniqueId) {
      query.card_unique_id = filters.cardUniqueId;
    }
    
    if (filters.cardUniqueIds && filters.cardUniqueIds.length > 0) {
      query.card_unique_id = { $in: filters.cardUniqueIds };
    }
    
    // =====================================
    // TEXT SEARCHES
    // =====================================
    
    if (filters.name) {
      const normalizedName = filters.name.replace(/[\u2018\u2019\u0027\u0060]/g, "'").toLowerCase();
      
      if (filters.exact) {
        query.name = normalizedName;
      } else {
        const escapedName = this.escapeRegex(normalizedName);
        query.name = { $regex: escapedName, $options: 'i' };
      }
    }
    
    // =====================================
    // PRINTING ATTRIBUTES
    // =====================================
    
    if (filters.sets?.length) {
      query.set = { $in: filters.sets.map(s => s.toLowerCase()) };
    }
    
    if (filters.editions?.length) {
      query.edition = { $in: filters.editions.map(e => e.toLowerCase()) };
    }
    
    if (filters.foilings?.length) {
      query.foiling = { $in: filters.foilings.map(f => f.toLowerCase()) };
    }
    
    if (filters.rarities?.length) {
      query.rarity = { $in: filters.rarities.map(r => r.toLowerCase()) };
    }
    
    if (filters.isExtendedArt !== undefined) {
      query.is_extended_art = filters.isExtendedArt;
    }
    
    // =====================================
    // PRICE FILTERS
    // =====================================

    const priceField = filters.priceField || 'tcg_low';
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      query[priceField] = { $ne: null, $gt: 0 };
      if (filters.priceMin !== undefined) {
        query[priceField] = { ...query[priceField], $gte: filters.priceMin };
      }
      if (filters.priceMax !== undefined) {
        query[priceField] = { ...query[priceField], $lte: filters.priceMax };
      }
    }
    
    if (filters.hasPricing !== undefined) {
      if (filters.hasPricing) {
        query.has_price = true;
      } else {
        query.has_price = false;
      }
    }
    
    return query;
  }
  
  /**
   * Search printings_core with filters and options
   */
  async searchPrintingsCore(filters: PrintingCoreFilters = {}, options: PrintingCoreSearchOptions = {}): Promise<PrintingCoreSearchResult> {
    const startTime = Date.now();

    try {
      const { db } = await connectToDatabase();
      // Use secondary read preference for card searches (offloads read traffic to replicas)
      const collection = db.collection('printings_core');

      // Build query
      const query = this.buildPrintingsCoreQuery(filters);

      // Pagination
      const page = options.page || 1;
      const limit = Math.min(options.limit || 50, 1000);
      const skip = (page - 1) * limit;

      // Sorting
      const sortBy = options.sortBy || 'name';
      const sortOrder = options.sortOrder || 'asc';
      const sortField = this.getSortField(sortBy);
      const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

      // Execute query
      const [printings, total] = await Promise.all([
        collection.find(query, { readPreference: 'secondaryPreferred' }).sort(sort).skip(skip).limit(limit).toArray(),
        collection.countDocuments(query, { readPreference: 'secondaryPreferred' })
      ]);
      
      const executionTime = Date.now() - startTime;
      
      return {
        printings: printings as PrintingCoreDocument[],
        total,
        page,
        pages: Math.ceil(total / limit),
        queryInfo: {
          query,
          executionTime,
          filters
        }
      };
    } catch (error) {
      console.error('PrintingsCore search error:', error);
      throw error;
    }
  }
  
  /**
   * Get a single printing by printing_id
   */
  async getPrintingCoreById(printingId: string): Promise<PrintingCoreDocument | null> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('printings_core');

      const printing = await collection.findOne(
        { printing_id: printingId },
        { readPreference: 'secondaryPreferred' }
      );
      return printing as PrintingCoreDocument | null;
    } catch (error) {
      console.error('Get printing core error:', error);
      throw error;
    }
  }
  
  /**
   * Get all printings for a specific card
   */
  async getPrintingsForCard(cardUniqueId: string, options: PrintingCoreSearchOptions = {}): Promise<PrintingCoreSearchResult> {
    return this.searchPrintingsCore({ cardUniqueId }, options);
  }
  
  /**
   * Get multiple printings by their printing_id values
   */
  async getPrintingsByIds(printingIds: string[], options: PrintingCoreSearchOptions = {}): Promise<PrintingCoreSearchResult> {
    return this.searchPrintingsCore({ printingIds }, options);
  }
  
  /**
   * Get available filter values for faceted search
   */
  async getFilterValues(): Promise<{
    sets: string[];
    editions: string[];
    foilings: string[];
    rarities: string[];
  }> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('printings_core');

      const [sets, editions, foilings, rarities] = await Promise.all([
        collection.distinct('set', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('edition', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('foiling', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('rarity', {}, { readPreference: 'secondaryPreferred' })
      ]);
      
      return {
        sets: sets.sort(),
        editions: editions.sort(),
        foilings: foilings.sort(),
        rarities: rarities.sort()
      };
    } catch (error) {
      console.error('Get filter values error:', error);
      throw error;
    }
  }
  
  private getSortField(sortBy: string): string {
    switch (sortBy) {
      case 'name': return 'name';
      case 'price': return 'tcg_market';
      case 'set': return 'set';
      case 'rarity': return 'rarity';
      case 'collector_number': return 'collector_number';
      default: return 'name';
    }
  }
  
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Export singleton instance
export const printingsCoreSearch = new FABPrintingsCoreSearchUtility();