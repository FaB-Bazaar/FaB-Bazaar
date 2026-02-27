// types/fab.ts - Core FAB card type definitions

export interface FABCard {
    _id?: { $oid: string };
    unique_id: string;
    name: string;
    pitch: string;
    cost: string;
    power: string;
    defense: string;
    health: string;
    intelligence: string;
    arcane: string;
    types: string[];
    card_keywords: string[];
    abilities_and_effects: string[];
    ability_and_effect_keywords: string[];
    granted_keywords: string[];
    removed_keywords: string[];
    interacts_with_keywords: string[];
    functional_text: string;
    functional_text_plain: string;
    type_text: string;
    played_horizontally: boolean;
    
    // Format legality
    blitz_legal: boolean;
    cc_legal: boolean;
    commoner_legal: boolean;
    ll_legal: boolean;
    
    // Living Legend status
    blitz_living_legend: boolean;
    cc_living_legend: boolean;
    
    // Ban status
    blitz_banned: boolean;
    cc_banned: boolean;
    commoner_banned: boolean;
    ll_banned: boolean;
    upf_banned: boolean;
    
    // Suspension status
    blitz_suspended: boolean;
    cc_suspended: boolean;
    commoner_suspended: boolean;
    
    // Restriction status
    ll_restricted: boolean;
    
    // Card properties
    color: string;
    traits: string[];
    printings: FABPrinting[];
  }
  
  export interface FABPrinting {
    unique_id: string;
    set_printing_unique_id: string;
    id: string; // Card number like "WTR191"
    set_id: string;
    edition: string; // A, F, U, N
    foiling: string; // S, R, C
    rarity: string; // C, R, S, M, L, F, T, B, V, P
    expansion_slot: boolean;
    artists: string[];
    art_variations: string[];
    flavor_text: string;
    flavor_text_plain: string;
    image_url: string;
    image_rotation_degrees: { $numberInt: string };
    tcgplayer_product_id?: string;
    tcgplayer_url?: string;
    tcgLow?: { $numberDouble: string } | number;
    tcgMid?: { $numberDouble: string } | number;
    tcgHigh?: { $numberDouble: string } | number;
    tcgMarket?: { $numberDouble: string } | number | null;
    tcgplayer_subTypeName?: string;
  }
  
  // Simplified printing interface for API responses
  export interface SimplifiedPrinting {
    unique_id: string;
    id: string;
    set_id: string;
    edition: string;
    foiling: string;
    rarity: string;
    artists: string[];
    tcgLow?: number;
    tcgMid?: number;
    tcgHigh?: number;
    tcgMarket?: number;
    image_url: string;
  }
  
  // Simplified card interface for API responses
  export interface SimplifiedCard {
    unique_id: string;
    name: string;
    types: string[];
    power?: string;
    cost?: string;
    defense?: string;
    functional_text_plain?: string;
    card_keywords?: string[];
    color?: string;
    printings: SimplifiedPrinting[];
  }
  
  export interface SearchFilters {
    // Text searches
    name?: string;
    text?: string; // Search in functional_text_plain
    keywords?: string[];
    
    // Card-level filters
    types?: string[];
    power?: string | string[];
    cost?: string | string[];
    defense?: string | string[];
    pitch?: string | string[];
    color?: string;
    traits?: string[];
    
    // Printing-level filters
    sets?: string[];
    editions?: string[];
    foilings?: string[];
    rarities?: string[];
    artists?: string[];
    
    // Price filters
    priceMin?: number;
    priceMax?: number;
    priceField?: 'tcgLow' | 'tcgMid' | 'tcgHigh' | 'tcgMarket';
    
    // Format legality
    format?: 'blitz' | 'cc' | 'commoner' | 'll';
    includeBanned?: boolean;
    includeSuspended?: boolean;
    
    // Advanced options
    exact?: boolean; // Exact name matching
    fuzzy?: boolean; // Enable fuzzy matching
    requireAllPrintings?: boolean; // If false, filter printings after search
  }
  
  export interface SearchOptions {
    limit?: number;
    page?: number;
    sortBy?: 'name' | 'power' | 'cost' | 'price' | 'relevance';
    sortOrder?: 'asc' | 'desc';
    includeFacets?: boolean;
    returnSimplified?: boolean; // Return simplified card/printing objects
  }
  
  export interface SearchResult {
    cards: FABCard[] | SimplifiedCard[];
    total: number;
    page: number;
    pages: number;
    facets?: SearchFacets;
    queryInfo: {
      parsed: ParsedQuery;
      pipeline: any[];
      executionTime: number;
    };
  }
  
  export interface SearchFacets {
    types: Array<{ value: string; count: number }>;
    sets: Array<{ value: string; count: number }>;
    rarities: Array<{ value: string; count: number }>;
    foilings: Array<{ value: string; count: number }>;
    colors: Array<{ value: string; count: number }>;
    priceRanges: Array<{ range: string; count: number }>;
  }
  
  export interface ParsedQuery {
    cardName?: string;
    foiling?: string;
    edition?: string;
    set?: string;
    rarity?: string;
    powerRange?: string[];
    costRange?: string[];
    defenseRange?: string[];
    priceRange?: { min?: number; max?: number };
    keywords?: string[];
    types?: string[];
    colors?: string[];
  }
  
  // Utility type for MongoDB price fields that can be either objects or numbers
  export type MongoPrice = { $numberDouble: string } | number | null;
  
  // Helper function to extract numeric price from MongoDB price field
  export function extractPrice(price: MongoPrice): number | null {
    if (price === null || price === undefined) return null;
    if (typeof price === 'number') return price;
    if (typeof price === 'object' && price.$numberDouble) {
      return parseFloat(price.$numberDouble);
    }
    return null;
  }
  
  // Helper function to simplify printing for API responses
  export function simplifyPrinting(printing: FABPrinting): SimplifiedPrinting {
    return {
      unique_id: printing.unique_id,
      id: printing.id,
      set_id: printing.set_id,
      edition: printing.edition,
      foiling: printing.foiling,
      rarity: printing.rarity,
      artists: printing.artists,
      tcgLow: extractPrice(printing.tcgLow),
      tcgMid: extractPrice(printing.tcgMid),
      tcgHigh: extractPrice(printing.tcgHigh),
      tcgMarket: extractPrice(printing.tcgMarket),
      image_url: printing.image_url
    };
  }
  
  // Helper function to simplify card for API responses
  export function simplifyCard(card: FABCard): SimplifiedCard {
    return {
      unique_id: card.unique_id,
      name: card.name,
      types: card.types,
      power: card.power || undefined,
      cost: card.cost || undefined,
      defense: card.defense || undefined,
      functional_text_plain: card.functional_text_plain || undefined,
      card_keywords: card.card_keywords?.length > 0 ? card.card_keywords : undefined,
      color: card.color || undefined,
      printings: card.printings.map(simplifyPrinting)
    };
  }