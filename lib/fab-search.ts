// lib/fab-search.ts - Improved FAB card search utility
//
// @deprecated This file uses direct MongoDB access.
// Prefer using printingsService from '@/lib/services' instead.
// This file is kept for reference during service layer migration testing.
// See: lib/services/mongodb/printings/MongoPrintingsService.ts

import connectToDatabase from './mongodb';
import { 
  FABCard, 
  SimplifiedCard,
  SearchFilters, 
  SearchOptions, 
  SearchResult, 
  ParsedQuery,
  extractPrice,
  simplifyCard
} from '@/types/fab';
import {
  FOILING_MAP,
  EDITION_MAP, 
  SET_MAP,
  RARITY_MAP,
  CARD_NAME_ABBREVIATIONS,
  KEYWORDS,
  CARD_TYPES,
  COLORS
} from './fab-constants';

export class FABSearchUtility {
  /**
   * Parse natural language query into structured filters
   */
  parseNaturalLanguageQuery(query: string): ParsedQuery {
    const tokens = query.toLowerCase().trim().split(/\s+/);
    const parsed: ParsedQuery = {
      keywords: [],
      types: [],
      colors: []
    };

    let cardNameTokens: string[] = [];
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i];
      
      // Check foiling abbreviations (prioritize over rarity for 'r')
      if (FOILING_MAP[token as keyof typeof FOILING_MAP]) {
        parsed.foiling = FOILING_MAP[token as keyof typeof FOILING_MAP];
      }
      // Check edition abbreviations
      else if (EDITION_MAP[token as keyof typeof EDITION_MAP]) {
        parsed.edition = EDITION_MAP[token as keyof typeof EDITION_MAP];
      }
      // Check set abbreviations
      else if (SET_MAP[token as keyof typeof SET_MAP]) {
        parsed.set = SET_MAP[token as keyof typeof SET_MAP];
      }
      // Check rarity abbreviations (but skip 'r' if we haven't seen foiling context)
      else if (RARITY_MAP[token as keyof typeof RARITY_MAP] && token !== 'r') {
        parsed.rarity = RARITY_MAP[token as keyof typeof RARITY_MAP];
      }
      // Handle 'r' ambiguity: if we see it at the start or near a card name, assume Rainbow Foil
      else if (token === 'r' && (i === 0 || this.isLikelyFoilingContext(tokens, i))) {
        parsed.foiling = 'R';
      }
      // Handle 'r' as rarity if in context of other rarities
      else if (token === 'r' && this.isLikelyRarityContext(tokens, i)) {
        parsed.rarity = 'R';
      }
      // Price patterns: <50, >100, 50-100, $50, under50, over100
      else if (this.isPricePattern(token)) {
        parsed.priceRange = this.parsePricePattern(token);
      }
      // Power patterns: power6, p6, power6+, 6power, 6+
      else if (this.isPowerPattern(token)) {
        parsed.powerRange = this.parsePowerPattern(token);
      }
      // Cost patterns: cost2, c2, cost2+, 2cost
      else if (this.isCostPattern(token)) {
        parsed.costRange = this.parseCostPattern(token);
      }
      // Defense patterns: defense3, d3, def3
      else if (this.isDefensePattern(token)) {
        parsed.defenseRange = this.parseDefensePattern(token);
      }
      // Keywords
      else if (KEYWORDS.includes(token as any)) {
        parsed.keywords!.push(token);
      }
      // Card types
      else if (CARD_TYPES.includes(token as any)) {
        parsed.types!.push(token);
      }
      // Colors
      else if (COLORS.includes(token as any)) {
        parsed.colors!.push(token);
      }
      // Multi-word keywords (go again, blood debt, etc.)
      else if (i < tokens.length - 1) {
        const twoWordKeyword = `${token} ${tokens[i + 1]}`;
        if (KEYWORDS.includes(twoWordKeyword as any)) {
          parsed.keywords!.push(twoWordKeyword);
          i++; // Skip next token
        } else {
          cardNameTokens.push(token);
        }
      }
      // Everything else is part of card name
      else {
        cardNameTokens.push(token);
      }
      
      i++;
    }

    // Process card name
    if (cardNameTokens.length > 0) {
      const cardNameString = cardNameTokens.join(' ');
      // Check for abbreviations
      if (CARD_NAME_ABBREVIATIONS[cardNameString as keyof typeof CARD_NAME_ABBREVIATIONS]) {
        parsed.cardName = CARD_NAME_ABBREVIATIONS[cardNameString as keyof typeof CARD_NAME_ABBREVIATIONS];
      } else {
        parsed.cardName = cardNameString;
      }
    }

    return parsed;
  }

  private isLikelyFoilingContext(tokens: string[], index: number): boolean {
    return index === 0 || 
           (index < tokens.length - 1 && !RARITY_MAP[tokens[index + 1] as keyof typeof RARITY_MAP]);
  }

  private isLikelyRarityContext(tokens: string[], index: number): boolean {
    const prev = index > 0 ? tokens[index - 1] : '';
    const next = index < tokens.length - 1 ? tokens[index + 1] : '';
    return RARITY_MAP[prev as keyof typeof RARITY_MAP] || 
           RARITY_MAP[next as keyof typeof RARITY_MAP] ||
           SET_MAP[prev as keyof typeof SET_MAP];
  }

  private isPricePattern(token: string): boolean {
    return /^([<>$]?\d+(-\d+)?|under\d+|over\d+)$/.test(token);
  }

  private isPowerPattern(token: string): boolean {
    return /^(power|p)\d+(\+)?$/.test(token) || /^\d+(\+)?(power|p)$/.test(token);
  }

  private isCostPattern(token: string): boolean {
    return /^(cost|c)\d+(\+)?$/.test(token) || /^\d+(\+)?(cost|c)$/.test(token);
  }

  private isDefensePattern(token: string): boolean {
    return /^(defense|def|d)\d+(\+)?$/.test(token) || /^\d+(\+)?(defense|def|d)$/.test(token);
  }

  private parsePricePattern(token: string): { min?: number; max?: number } | undefined {
    token = token.replace('$', '');
    
    if (token.startsWith('<') || token.startsWith('under')) {
      const value = parseInt(token.replace(/[<under]/g, ''));
      return { max: value };
    } else if (token.startsWith('>') || token.startsWith('over')) {
      const value = parseInt(token.replace(/[>over]/g, ''));
      return { min: value };
    } else if (token.includes('-')) {
      const [min, max] = token.split('-').map(x => parseInt(x));
      return { min, max };
    }
    return undefined;
  }

  private parsePowerPattern(token: string): string[] {
    const match = token.match(/(\d+)(\+)?/) || [];
    const value = parseInt(match[1]);
    const hasPlus = match[2] === '+';
    
    if (hasPlus) {
      return Array.from({length: 7}, (_, i) => (value + i).toString());
    } else {
      return [value.toString()];
    }
  }

  private parseCostPattern(token: string): string[] {
    const match = token.match(/(\d+)(\+)?/) || [];
    const value = parseInt(match[1]);
    const hasPlus = match[2] === '+';
    
    if (hasPlus) {
      return Array.from({length: 7}, (_, i) => (value + i).toString());
    } else {
      return [value.toString()];
    }
  }

  private parseDefensePattern(token: string): string[] {
    const match = token.match(/(\d+)(\+)?/) || [];
    const value = parseInt(match[1]);
    const hasPlus = match[2] === '+';
    
    if (hasPlus) {
      return Array.from({length: 6}, (_, i) => (value + i).toString());
    } else {
      return [value.toString()];
    }
  }

  private toArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.includes(',')) return val.split(',').map(s => s.trim()).filter(Boolean);
    return [val.toString()];
  }

  private mergeFilters(parsed: ParsedQuery, filters: SearchFilters): SearchFilters {
    return {
      name: parsed.cardName || filters.name,
      foilings: parsed.foiling ? [parsed.foiling] : filters.foilings,
      editions: parsed.edition ? [parsed.edition] : filters.editions,
      sets: parsed.set ? [parsed.set] : filters.sets,
      rarities: parsed.rarity ? [parsed.rarity] : filters.rarities,
      power: parsed.powerRange || filters.power,
      cost: parsed.costRange || filters.cost,
      defense: parsed.defenseRange || filters.defense,
      priceMin: parsed.priceRange?.min || filters.priceMin,
      priceMax: parsed.priceRange?.max || filters.priceMax,
      keywords: [...(parsed.keywords || []), ...(filters.keywords || [])],
      types: [...(parsed.types || []), ...(filters.types || [])],
      color: parsed.colors?.[0] || filters.color,
      ...filters
    };
  }

  /**
   * Build simplified search pipeline - focusing on basic MongoDB queries first
   */
  buildSearchPipeline(
    naturalQuery: string | null, 
    filters: SearchFilters, 
    options: SearchOptions
  ): any[] {
    const pipeline: any[] = [];
    
    // Parse natural language query if provided
    const parsed = naturalQuery ? this.parseNaturalLanguageQuery(naturalQuery) : {};
    
    // Merge parsed query with explicit filters
    const mergedFilters = this.mergeFilters(parsed, filters);
    
    // Build basic match stage instead of Atlas Search for now
    const matchStage = this.buildMatchStage(mergedFilters);
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ "$match": matchStage });
    }
    
    // Add printing-specific filtering
    const printingFilters = this.buildPrintingFilters(mergedFilters);
    if (printingFilters.length > 0) {
      pipeline.push({
        "$addFields": {
          "filtered_printings": {
            "$filter": {
              "input": "$printings",
              "cond": printingFilters.length === 1 ? 
                printingFilters[0] : 
                { "$and": printingFilters }
            }
          }
        }
      });
      
      // Only keep cards with matching printings
      pipeline.push({
        "$match": { "filtered_printings": { "$ne": [] } }
      });
      
      // Replace printings with filtered ones
      pipeline.push({
        "$addFields": { "printings": "$filtered_printings" }
      });
      
      pipeline.push({
        "$project": { "filtered_printings": 0 }
      });
    }
    
    // Add sorting
    if (options.sortBy && options.sortBy !== 'relevance') {
      const sortField = this.getSortField(options.sortBy);
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      pipeline.push({ "$sort": { [sortField]: sortOrder } });
    }
    
    return pipeline;
  }

  /**
   * Build basic MongoDB match stage (fallback when Atlas Search isn't available)
   */
  private buildMatchStage(filters: SearchFilters): any {
    const match: any = {};
    
    // Name search - using regex for fuzzy matching
    if (filters.name) {
      if (filters.exact) {
        match.name = { "$regex": `^${this.escapeRegex(filters.name)}$`, "$options": "i" };
      } else {
        match.name = { "$regex": this.escapeRegex(filters.name), "$options": "i" };
      }
    }
    
    // Text search in functional text
    if (filters.text) {
      match.functional_text_plain = { "$regex": this.escapeRegex(filters.text), "$options": "i" };
    }
    
    // Keywords in functional text
    if (filters.keywords && filters.keywords.length > 0) {
      const keywordRegex = filters.keywords.map(k => this.escapeRegex(k)).join('|');
      match.functional_text_plain = { "$regex": keywordRegex, "$options": "i" };
    }
    
    // Card types
    if (filters.types && filters.types.length > 0) {
      match.types = { "$in": filters.types };
    }
    
    // Traits
    if (filters.traits && filters.traits.length > 0) {
      match.traits = { "$in": filters.traits };
    }
    
    // Stats - handle both string and number formats
    if (filters.power) {
      const powerValues = this.toArray(filters.power);
      if (powerValues.length === 1) {
        match.power = powerValues[0];
      } else {
        match.power = { "$in": powerValues };
      }
    }
    
    if (filters.cost) {
      const costValues = this.toArray(filters.cost);
      if (costValues.length === 1) {
        match.cost = costValues[0];
      } else {
        match.cost = { "$in": costValues };
      }
    }

    if (filters.defense) {
      const defenseValues = this.toArray(filters.defense);
      if (defenseValues.length === 1) {
        match.defense = defenseValues[0];
      } else {
        match.defense = { "$in": defenseValues };
      }
    }
    
    // Pitch
    if (filters.pitch) {
      const pitchValues = this.toArray(filters.pitch);
      match.pitch = pitchValues.length === 1 ? pitchValues[0] : { "$in": pitchValues };
    }
    
    // Color
    if (filters.color) {
      match.color = filters.color;
    }
    
    // Format legality
    if (filters.format) {
      const legalField = `${filters.format}_legal`;
      match[legalField] = true;
      
      if (!filters.includeBanned) {
        const bannedField = `${filters.format}_banned`;
        match[bannedField] = { "$ne": true };
      }

      if (!filters.includeSuspended) {
        const suspendedField = `${filters.format}_suspended`;
        match[suspendedField] = { "$ne": true };
      }
    }
    
    return match;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private buildPrintingFilters(filters: SearchFilters): any[] {
    const conditions: any[] = [];
    
    // Sets
    if (filters.sets && filters.sets.length > 0) {
      conditions.push({ "$in": ["$$this.set_id", filters.sets] });
    }
    
    // Editions
    if (filters.editions && filters.editions.length > 0) {
      conditions.push({ "$in": ["$$this.edition", filters.editions] });
    }
    
    // Foilings
    if (filters.foilings && filters.foilings.length > 0) {
      conditions.push({ "$in": ["$$this.foiling", filters.foilings] });
    }
    
    // Rarities
    if (filters.rarities && filters.rarities.length > 0) {
      conditions.push({ "$in": ["$$this.rarity", filters.rarities] });
    }
    
    // Artists
    if (filters.artists && filters.artists.length > 0) {
      conditions.push({
        "$gt": [
          { "$size": { "$setIntersection": ["$$this.artists", filters.artists] } },
          0
        ]
      });
    }
    
    // Price filters - simplified to handle various MongoDB number formats
    const priceField = filters.priceField || 'tcgLow';
    if (filters.priceMin !== undefined) {
      conditions.push({
        "$gte": [
          { "$toDouble": `$$this.${priceField}` },
          filters.priceMin
        ]
      });
    }
    if (filters.priceMax !== undefined) {
      conditions.push({
        "$lte": [
          { "$toDouble": `$$this.${priceField}` },
          filters.priceMax
        ]
      });
    }
    
    return conditions;
  }

  private getSortField(sortBy: string): string {
    switch (sortBy) {
      case 'name': return 'name';
      case 'power': return 'power';
      case 'cost': return 'cost';
      case 'price': return 'printings.tcgLow';
      default: return 'name';
    }
  }

  /**
   * Execute search with proper pagination
   */
  async executeSearch(
    naturalQuery: string | null = null,
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      // Connect to database
      const { db } = await connectToDatabase();
      const collection = db.collection('cards');
      
      // Build pipeline for counting total results
      const countPipeline = this.buildSearchPipeline(naturalQuery, filters, options);
      countPipeline.push({ "$count": "total" });
      
      // Build pipeline for actual results
      const resultPipeline = this.buildSearchPipeline(naturalQuery, filters, options);
      
      // Add pagination to result pipeline
      const limit = options.limit || 12;
      const page = options.page || 1;
      const skip = (page - 1) * limit;
      
      if (skip > 0) resultPipeline.push({ "$skip": skip });
      resultPipeline.push({ "$limit": limit });
      
      // Execute both pipelines
      const [countResult, cards] = await Promise.all([
        collection.aggregate(countPipeline).toArray(),
        collection.aggregate(resultPipeline).toArray()
      ]);
      
      const total = countResult.length > 0 ? countResult[0].total : 0;
      const pages = Math.ceil(total / limit);
      
      // Transform results if simplified format requested
      const resultCards = options.returnSimplified 
        ? cards.map(simplifyCard)
        : cards as FABCard[];
      
      const executionTime = Date.now() - startTime;
      
      return {
        cards: resultCards,
        total,
        page,
        pages,
        queryInfo: {
          parsed: naturalQuery ? this.parseNaturalLanguageQuery(naturalQuery) : {},
          pipeline: resultPipeline,
          executionTime
        }
      };
    } catch (error) {
      console.error('Search execution error:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convenience method for basic card name search
   */
  async searchByName(name: string, limit: number = 10): Promise<SearchResult> {
    return this.executeSearch(name, {}, { limit, returnSimplified: true });
  }

  /**
   * Convenience method for specific printing search
   */
  async searchSpecificPrinting(query: string, limit: number = 5): Promise<SearchResult> {
    return this.executeSearch(query, {}, { limit, returnSimplified: true });
  }

  /**
   * Convenience method for format-legal cards
   */
  async searchFormatLegal(
    format: 'blitz' | 'cc' | 'commoner' | 'll',
    query?: string,
    limit: number = 20
  ): Promise<SearchResult> {
    return this.executeSearch(query, { 
      format, 
      includeBanned: false,
      includeSuspended: false 
    }, { limit, returnSimplified: true });
  }

  /**
   * Convenience method for market/price searches
   */
  async searchByPriceRange(
    minPrice?: number,
    maxPrice?: number,
    additionalFilters: SearchFilters = {},
    limit: number = 20
  ): Promise<SearchResult> {
    return this.executeSearch(null, {
      ...additionalFilters,
      priceMin: minPrice,
      priceMax: maxPrice
    }, { 
      limit, 
      sortBy: 'price', 
      sortOrder: 'desc',
      returnSimplified: true 
    });
  }

  /**
   * Debug method to test basic connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string; sampleCount?: number }> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('cards');
      const count = await collection.countDocuments({});
      
      return {
        success: true,
        message: `Connected successfully`,
        sampleCount: count
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Export singleton instance
export const fabSearch = new FABSearchUtility();