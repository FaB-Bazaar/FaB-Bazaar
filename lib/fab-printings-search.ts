// lib/fab-printings-search.ts - Optimized search utility for printings collection
//
// @deprecated This file uses direct MongoDB access.
// Prefer using printingsService from '@/lib/services' instead.
// This file is kept for reference during service layer migration testing.
// See: lib/services/mongodb/printings/MongoPrintingsService.ts

import connectToDatabase from './mongodb';
import { RESPONSE_PROJECTIONS } from './response-projections';
import { HERO_NICKNAMES, getHeroInfo } from './fab-constants';



// Types for the flattened printings collection (based on actual schema)
export interface PrintingDocument {
  _id?: string;
  printing_id: string;  // Maps to printing unique_id
  card_unique_id: string;
  
  // Core card info (normalized)
  name: string;
  text: string;
  type_text: string;
  color: string;
  
  // Arrays (normalized)
  types: string[];
  traits: string[];
  keywords: string[];
  abilities: string[];
  text_keywords: string[];
  searchable_text: string;
  
  // NEW: Classes & Talents System (separated from types)
  classes: string[];         // ["guardian", "necromancer"]
  talents: string[];         // ["elemental", "pirate"]
  
  // Stats (as numbers, some can be null)
  power?: number | null;
  cost?: number | null;
  defense?: number | null;
  pitch?: number | null;
  health?: number | null;
  intelligence?: number | null;
  
  // Original stat strings
  power_text: string;
  cost_text: string;
  defense_text: string;
  pitch_text: string;
  
  // Printing-specific data (normalized)
  printing_card_id: string;  // Like "WTR216"
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  artists: string[];
  
  // Pricing (as numbers)
  tcg_low?: number | null;
  tcg_mid?: number | null;
  tcg_high?: number | null;
  tcg_market?: number | null;
  price_updated_at?: Date;
  
  // Boolean flags for instant filtering
  // Type flags
  is_action: boolean;
  is_attack: boolean;
  is_defense_reaction: boolean;
  is_instant: boolean;
  is_equipment: boolean;
  is_weapon: boolean;
  is_hero: boolean;
  is_mentor: boolean;
  is_token: boolean;
  
  // NEW: Class Boolean Flags
  is_generic: boolean;
  is_brute: boolean;
  is_guardian: boolean;
  is_mechanologist: boolean;
  is_ranger: boolean;
  is_runeblade: boolean;
  is_assassin: boolean;
  is_warrior: boolean;
  is_ninja: boolean;
  is_wizard: boolean;
  is_merchant: boolean;
  is_bard: boolean;
  is_adjudicator: boolean;
  is_illusionist: boolean;
  is_thief: boolean;
  is_shapeshifter: boolean;
  is_necromancer: boolean;

  // NEW: Talent Boolean Flags (including essence system)
  has_chaos: boolean;
  has_light: boolean;        // Light essence
  has_royal: boolean;
  has_draconic: boolean;
  has_lightning: boolean;    // Lightning essence
  has_shadow: boolean;       // Shadow essence
  has_earth: boolean;        // Earth essence
  has_mystic: boolean;
  has_revered: boolean;
  has_ice: boolean;          // Ice essence
  has_reviled: boolean;
  has_pirate: boolean;
  has_elemental: boolean;    // Elemental talent

  // NEW: Combination Flags
  is_generic_only: boolean;        // Generic cards (all heroes can play)
  has_class_and_talent: boolean;   // e.g., "pirate necromancer" or "elemental guardian"
  has_class_only: boolean;         // e.g., just "necromancer"
  has_talent_only: boolean;        // e.g., just "pirate" or just "elemental"
  
  // Edition flags
  is_first_edition: boolean;
  is_unlimited: boolean;
  is_normal_edition: boolean;
  
  // Foiling flags
  is_normal_foil: boolean;
  is_rainbow_foil: boolean;
  is_cold_foil: boolean;
  
  // Rarity flags
  is_common: boolean;
  is_rare: boolean;
  is_super_rare: boolean;
  is_majestic: boolean;
  is_legendary: boolean;
  is_fabled: boolean;
  is_promo: boolean;
  
  // Price flags
  is_budget: boolean;
  is_under_5: boolean;
  is_under_10: boolean;
  is_under_25: boolean;
  is_under_50: boolean;
  is_under_100: boolean;
  is_expensive: boolean;
  is_premium: boolean;
  
  // Format legality
  blitz_legal: boolean;
  cc_legal: boolean;
  commoner_legal: boolean;
  ll_legal: boolean;
  
  // Format restrictions
  blitz_banned: boolean;
  cc_banned: boolean;
  commoner_banned: boolean;
  ll_banned: boolean;
  blitz_suspended: boolean;
  cc_suspended: boolean;
  commoner_suspended: boolean;
  ll_restricted: boolean;
  
  // Other fields
  played_horizontally: boolean;
  expansion_slot: boolean;
  flavor_text: string;
  image_url: string;
  tcgplayer_product_id?: string;
  tcgplayer_url?: string;
  created_at: Date;
  
  // Original printing data
  printing_data: any;
}

export interface PrintingsSearchFilters {
  // Text searches
  name?: string;
  text?: string;
  searchableText?: string; // Search across all text
  exact?: boolean;
  
  // Card attributes
  types?: string[];
  traits?: string[];
  keywords?: string[];
  textKeywords?: string[]; // Keywords extracted from text
  colors?: string[]; // Multiple colors (OR logic)
  cardUniqueId?: string;
  cardUniqueIds?: string[];
  
  // NEW: Classes & Talents System
  classes?: string[];       // Filter by specific classes
  talents?: string[];       // Filter by specific talents
  talentsAll?: string[];  // NEW: All specified talents must be present (AND logic)
  
  // Stats (can use ranges or exact values)
  power?: number | number[] | null;
  powerMin?: number;
  powerMax?: number;
  cost?: number | number[] | null;
  costMin?: number;
  costMax?: number;
  defense?: number | number[] | null;
  defenseMin?: number;
  defenseMax?: number;
  pitch?: number | number[] | null;
  
  // Printing attributes
  printingCardId?: string | string[]; // Like "WTR216" or array
  printingIds?: string[]; // Array of printing_id values for bulk lookup
  sets?: string[];
  editions?: string[];
  foilings?: string[];
  rarities?: string[];
  artists?: string[];
  
  // Price filters
  priceMin?: number;
  priceMax?: number;
  priceField?: 'tcg_low' | 'tcg_mid' | 'tcg_high' | 'tcg_market';

  // Enhanced talent filtering
  talents?: string[];       // Filter by specific talents (OR logic)
  talentsNot?: string[];    // Exclude specific talents (NEW)
  talentsAll?: string[];    // All specified talents must be present (AND logic) - you already have this
  
  
  // Boolean filters - Card Types
  isAction?: boolean;
  isAttack?: boolean;
  isDefenseReaction?: boolean;
  isInstant?: boolean;
  isEquipment?: boolean;
  isWeapon?: boolean;
  isHero?: boolean;
  isMentor?: boolean;
  isToken?: boolean;
  
  // NEW: Boolean filters - Classes
  isGeneric?: boolean;
  isBrute?: boolean;
  isGuardian?: boolean;
  isMechanologist?: boolean;
  isRanger?: boolean;
  isRuneblade?: boolean;
  isAssassin?: boolean;
  isWarrior?: boolean;
  isNinja?: boolean;
  isWizard?: boolean;
  isMerchant?: boolean;
  isBard?: boolean;
  isAdjudicator?: boolean;
  isIllusionist?: boolean;
  isThief?: boolean;
  isShapeshifter?: boolean;
  isNecromancer?: boolean;

  // NEW: Boolean filters - Talents/Essence
  hasChaos?: boolean;
  hasLight?: boolean;        // Light essence
  hasRoyal?: boolean;
  hasDraconic?: boolean;
  hasLightning?: boolean;    // Lightning essence
  hasShadow?: boolean;       // Shadow essence
  hasEarth?: boolean;        // Earth essence
  hasMystic?: boolean;
  hasRevered?: boolean;
  hasIce?: boolean;          // Ice essence
  hasReviled?: boolean;
  hasPirate?: boolean;
  hasElemental?: boolean;    // Elemental talent

  // NEW: Boolean filters - Combinations
  isGenericOnly?: boolean;        // Generic cards only
  hasClassAndTalent?: boolean;    // Class + talent combinations
  hasClassOnly?: boolean;         // Class only cards
  hasTalentOnly?: boolean;        // Talent only cards
  
  // Edition filters
  isFirstEdition?: boolean;
  isUnlimited?: boolean;
  isNormalEdition?: boolean;
  
  // Foiling filters
  isNormalFoil?: boolean;
  isRainbowFoil?: boolean;
  isColdFoil?: boolean;
  isExtendedArt?: boolean; 
  
  // Rarity filters
  isCommon?: boolean;
  isRare?: boolean;
  isSuperRare?: boolean;
  isMajestic?: boolean;
  isLegendary?: boolean;
  isFabled?: boolean;
  isPromo?: boolean;
  
  // Price filters
  isBudget?: boolean;
  isUnder5?: boolean;
  isUnder10?: boolean;
  isUnder25?: boolean;
  isUnder50?: boolean;
  isUnder100?: boolean;
  isExpensive?: boolean;
  isPremium?: boolean;
  
  // Format legality
  format?: 'blitz' | 'cc' | 'commoner' | 'll';
  includeBanned?: boolean;
  includeSuspended?: boolean;
  
  // Pricing availability
  hasPricing?: boolean;
  hasProductId?: boolean;
  
  // ⭐ Hero-based filtering
  heroLegal?: string; // Hero name for legal filtering
  excludeClasses?: string[]; // Classes to exclude
  excludeTalents?: string[]; // Talents to exclude

  // Negation filters
  colorNot?: string[];
  raritiesNot?: string[];
  setsNot?: string[];
  foilingsNot?: string[];
  editionsNot?: string[];
  typesNot?: string[];
  keywordsNot?: string[];
  textNot?: string;
}

export type ResponseMode = 
  | 'all'           // Full data (default)
  | 'summary'       // Basic card info + key stats
  | 'gameplay'      // Game mechanics focused
  | 'identifiers'   // Just IDs and names
  | 'browse_bulk'; 

export interface PrintingsSearchOptions {
  limit?: number;
  page?: number;
  sortBy?: 'name' | 'price' | 'power' | 'cost' | 'defense' | 'set' | 'rarity' | 'printing_card_id' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  returnSimplified?: boolean;
  show?: ResponseMode;
  searchMode?: 'strict' | 'broad'; // strict = name only, broad = searchable_text
}

export interface PrintingsSearchResult {
  printings: PrintingDocument[];
  total: number;
  page: number;
  pages: number;
  queryInfo: {
    query: any;
    executionTime: number;
    filters: PrintingsSearchFilters;
  };
}


// Helper to detect if a search query looks like a collector number (e.g., "ARC123", "WTR216")
// FAB collector numbers follow patterns like: WTR216, ARC123, 1HP361, CRU-001
function isCollectorNumber(query: string): boolean {
  if (!query) return false;

  const trimmed = query.trim();

  // Pattern 1: Standard format - 2-4 uppercase letters + 1-4 digits (WTR216, ARC123, MON001)
  const standardPattern = /^[A-Za-z]{2,4}\d{1,4}$/;

  // Pattern 2: With separators - 2-4 letters + dash/space + digits (CRU-123, WTR 216)
  const separatorPattern = /^[A-Za-z]{2,4}[-\s]\d{1,4}$/;

  // Pattern 3: Special promos - digit + letters + digits (1HP361, 2HP123)
  const promoPattern = /^\d[A-Za-z]{2,3}\d{1,4}$/;

  return standardPattern.test(trimmed) ||
         separatorPattern.test(trimmed) ||
         promoPattern.test(trimmed);
}

export class FABPrintingsSearchUtility {
  
  /**
 * Build optimized query for printings collection
 * Takes advantage of boolean flags and numeric fields
 */
buildPrintingsQuery(filters: PrintingsSearchFilters, options?: PrintingsSearchOptions): any {
  const query: any = {};
  const searchMode = options?.searchMode || 'broad'; // Default to broad for backwards compatibility
  
  // =====================================
  // TEXT SEARCHES (using normalized fields)
  // =====================================
  
  if (filters.name) {
    // Check if this looks like a collector number (e.g., "ARC123", "WTR216")
    if (isCollectorNumber(filters.name)) {
      // Search printing_card_id field (case-insensitive, exact match)
      const normalizedCollectorNumber = filters.name.toUpperCase().replace(/[-\s]/g, '');
      const escapedCollectorNumber = this.escapeRegex(normalizedCollectorNumber);
      query.printing_card_id = { $regex: `^${escapedCollectorNumber}$`, $options: 'i' };
    } else {
      // Regular name search
      // Normalize apostrophes before processing
      const normalizedName = filters.name
        .replace(/[\u2018\u2019\u0027\u0060]/g, "'")
        .toLowerCase()
        .trim();

      if (filters.exact) {
        query.name = normalizedName;
      } else {
        const escapedName = this.escapeRegex(normalizedName);
        query.name = { $regex: `^${escapedName}` };
      }
    }
  }
    
    // Use exact matching when both name and color are provided (leverages index)
  //   if (filters.exact || (filters.color !== undefined)) {
  //     query.name = normalizedName;
  //   } else {
  //     const escapedName = this.escapeRegex(normalizedName);
  //     query.name = { $regex: escapedName, $options: 'i' };
  //   }
  // }
  
  // // if (filters.text) {
  // //   console.log('🔍 Processing filters.text');
  // //   const textQuery = this.buildTextQuery(filters.text, filters.exact);
  // //   Object.assign(query, textQuery);
  // // }

  // if (filters.text) {
  //   console.log('🔍 Replacing text search with name search');
  //   const textQuery = this.buildTextQuery(filters.text, filters.exact, 'name');
  //   Object.assign(query, textQuery);
  // }
  
  
  // // if (filters.searchableText) {
  // //   console.log('🔍 Processing filters.searchableText');
  // //   const searchableQuery = this.buildTextQuery(filters.searchableText, filters.exact, 'searchable_text');
  // //   Object.assign(query, searchableQuery);
  // // }

  // if (filters.searchableText) {
  //   console.log('🔍 Replacing searchableText with name search');
  //   const searchableQuery = this.buildTextQuery(filters.searchableText, filters.exact, 'name');
  //   ...
  // }
  

  if (filters.text) {
    if (searchMode === 'strict') {
      // For card-search-dialog: search name field only
      console.log('🔍 Using strict mode: searching name field');
      const textQuery = this.buildTextQuery(filters.text, filters.exact, 'name');
      Object.assign(query, textQuery);
    } else {
      // For bulk import: search searchable_text (broader)
      console.log('🔍 Using broad mode: searching text field');
      const textQuery = this.buildTextQuery(filters.text, filters.exact, 'text');
      Object.assign(query, textQuery);
    }
  }

  if (filters.searchableText) {
    if (searchMode === 'strict') {
      // For card-search-dialog: search name field only
      console.log('🔍 Using strict mode: searching name field');
      const searchableQuery = this.buildTextQuery(filters.searchableText, filters.exact, 'name');
      Object.assign(query, searchableQuery);
    } else {
      // For bulk import: search searchable_text (broader)
      console.log('🔍 Using broad mode: searching searchable_text field');
      const searchableQuery = this.buildTextQuery(filters.searchableText, filters.exact, 'searchable_text');
      Object.assign(query, searchableQuery);
    }
  }
  
  
  // =====================================
  // PRINTING IDENTIFICATION
  // =====================================
  
  // Printing card ID (like "1HP361", "WTR216")
  if (filters.printingCardId) {
    if (Array.isArray(filters.printingCardId)) {
      query.printing_card_id = { $in: filters.printingCardId };
    } else {
      query.printing_card_id = filters.printingCardId;
    }
  }
  
  // Handle multiple printing_id values for bulk lookup (like "NGz8wFDFGQLf9TGTzJMPb")
  if (filters.printingIds && filters.printingIds.length > 0) {
    query.printing_id = { $in: filters.printingIds };
  }
  
  // Card unique IDs
  if (filters.cardUniqueIds && filters.cardUniqueIds.length > 0) {
    query.card_unique_id = { $in: filters.cardUniqueIds };
  } else if (filters.cardUniqueId) {
    query.card_unique_id = filters.cardUniqueId;
  }
  // =====================================
// HERO LEGAL & TYPE FILTERING - FIXED VERSION
// =====================================

// ⭐ ENHANCED: Hero legal filtering with proper talent/class exclusion
if (filters.heroLegal) {
  // Try new hero info system first
  const heroInfo = getHeroInfo(filters.heroLegal);

  if (heroInfo) {
    // Build proper hero-legal query respecting FaB deck building rules
    const heroQueries = [];

    // 1. Generic cards (always accessible to any hero)
    heroQueries.push({ is_generic_only: true });

    // 2. Hero's class cards WITHOUT any talent (e.g., Illusionist with no talent for Prism)
    if (heroInfo.classes && heroInfo.classes.length > 0) {
      heroInfo.classes.forEach(heroClass => {
        const classFlag = `is_${heroClass}`;
        // Only match cards that have this class AND no talent
        heroQueries.push({
          [classFlag]: true,
          has_class_only: true  // Ensures no talent is present
        });
      });
    }

    // 3. Hero's talent cards WITHOUT any class (e.g., Light with no class for Prism)
    if (heroInfo.talents && heroInfo.talents.length > 0) {
      heroInfo.talents.forEach(talent => {
        const talentFlag = `has_${talent}`;
        // Only match cards that have this talent AND no class
        heroQueries.push({
          [talentFlag]: true,
          has_talent_only: true  // Ensures no class is present
        });
      });
    }

    // 4. Cards that match BOTH hero's class AND talent (e.g., Light Illusionist for Prism)
    if (heroInfo.classes && heroInfo.classes.length > 0 && heroInfo.talents && heroInfo.talents.length > 0) {
      heroInfo.classes.forEach(heroClass => {
        heroInfo.talents.forEach(talent => {
          const classFlag = `is_${heroClass}`;
          const talentFlag = `has_${talent}`;
          // Match cards with both this specific class AND this specific talent
          heroQueries.push({
            [classFlag]: true,
            [talentFlag]: true,
            has_class_and_talent: true
          });
        });
      });
    }

    // 5. Essence cards for elemental heroes (e.g., earth/ice for Oldhim)
    if (heroInfo.essences && heroInfo.essences.length > 0) {
      heroInfo.essences.forEach(essence => {
        heroQueries.push({ [`has_${essence}`]: true });
      });
    }

    // Apply hero-legal query (this replaces normal type filtering)
    if (heroQueries.length > 0) {
      query.$or = heroQueries;
    }
  } else {
    // Fallback for unmapped heroes - previously used HERO_CLASS_EXCLUSIONS which was removed
    // All heroes should now be defined in lib/hero-data.ts
    // If a hero is not found, the query will just skip hero-specific filtering
    console.warn(`Hero "${filters.heroLegal}" not found in HERO_INFO. No hero-specific filtering applied.`);
  }

  // IMPORTANT: Apply additional type filtering even when heroLegal is active
  // This allows users to filter hero-legal cards by specific types (e.g., "show me only actions")
  if (filters.types?.length) {
    query.types = { $in: filters.types.map(t => t.toLowerCase()) };
  }
}
  // If no hero filter, handle manual type filtering
  else if (filters.types?.length || filters.excludeClasses?.length || filters.excludeTalents?.length) {
    const typeQuery: any = {};
    
    // Include required types
    if (filters.types?.length) {
      typeQuery.$in = filters.types.map(t => t.toLowerCase());
    }
    
    // Collect manual exclusions
    const allExclusions: string[] = [];
    
    if (filters.excludeClasses?.length) {
      allExclusions.push(...filters.excludeClasses.map(c => c.toLowerCase()));
    }
    
    if (filters.excludeTalents?.length) {
      allExclusions.push(...filters.excludeTalents.map(t => t.toLowerCase()));
    }
    
    // Add exclusions
    if (allExclusions.length > 0) {
      typeQuery.$nin = allExclusions;
    }
    
    // Apply types query
    if (Object.keys(typeQuery).length > 0) {
      query.types = typeQuery;
    }
  }
  
  // =====================================
  // CARD ATTRIBUTES
  // =====================================
  
  if (filters.traits?.length) {
    query.traits = { $in: filters.traits.map(t => t.toLowerCase()) };
  }
  
  if (filters.keywords?.length) {
    query.keywords = { $in: filters.keywords.map(k => k.toLowerCase()) };
  }
  
  if (filters.textKeywords?.length) {
    query.text_keywords = { $in: filters.textKeywords.map(k => k.toLowerCase()) };
  }
  
  // NEW: Classes & Talents filtering (direct array filtering)
  if (filters.classes?.length) {
    query.classes = { $in: filters.classes.map(c => c.toLowerCase()) };
  }
  
  // NEW: Enhanced Talents filtering (both array and boolean approaches)
  if (filters.talents?.length) {
    // Option A: Use boolean flags for better performance (RECOMMENDED)
    const talentQueries = filters.talents.map(talent => 
      this.mapTalentToBoolean(talent, true)
    );
    
    if (talentQueries.length === 1) {
      Object.assign(query, talentQueries[0]);
    } else {
      // Multiple talents - use OR logic
      query.$or = query.$or || [];
      query.$or.push(...talentQueries);
    }
  }
  
  // Color filtering (OR logic for multiple colors)
  if (filters.colors && filters.colors.length > 0) {
    if (filters.colors.length === 1) {
      query.color = filters.colors[0].toLowerCase();
    } else {
      query.color = { $in: filters.colors.map(c => c.toLowerCase()) };
    }
  }
  
  // =====================================
  // STATS (numeric ranges) - handle null values properly
  // =====================================
  
  // Power filtering
  if (filters.power !== undefined) {
    if (filters.power === null) {
      query.power = null;
    } else if (Array.isArray(filters.power)) {
      query.power = { $in: filters.power };
    } else {
      query.power = filters.power;
    }
  }
  
  if (filters.powerMin !== undefined || filters.powerMax !== undefined) {
    query.power = { $ne: null }; // Exclude null values for range queries
    if (filters.powerMin !== undefined) {
      query.power = { ...query.power, $gte: filters.powerMin };
    }
    if (filters.powerMax !== undefined) {
      query.power = { ...query.power, $lte: filters.powerMax };
    }
  }
  
  // Cost filtering
  if (filters.cost !== undefined) {
    if (filters.cost === null) {
      query.cost = null;
    } else if (Array.isArray(filters.cost)) {
      query.cost = { $in: filters.cost };
    } else {
      query.cost = filters.cost;
    }
  }

  // Support costs array (for UI checkboxes)
  if (filters.costs && filters.costs.length > 0) {
    query.cost = { $in: filters.costs };
  }

  if (filters.costMin !== undefined || filters.costMax !== undefined) {
    query.cost = { $ne: null };
    if (filters.costMin !== undefined) {
      query.cost = { ...query.cost, $gte: filters.costMin };
    }
    if (filters.costMax !== undefined) {
      query.cost = { ...query.cost, $lte: filters.costMax };
    }
  }
  
  // Defense filtering
  if (filters.defense !== undefined) {
    if (filters.defense === null) {
      query.defense = null;
    } else if (Array.isArray(filters.defense)) {
      query.defense = { $in: filters.defense };
    } else {
      query.defense = filters.defense;
    }
  }
  
  if (filters.defenseMin !== undefined || filters.defenseMax !== undefined) {
    query.defense = { $ne: null };
    if (filters.defenseMin !== undefined) {
      query.defense = { ...query.defense, $gte: filters.defenseMin };
    }
    if (filters.defenseMax !== undefined) {
      query.defense = { ...query.defense, $lte: filters.defenseMax };
    }
  }
  
  // Pitch filtering
  if (filters.pitch !== undefined) {
    if (filters.pitch === null) {
      query.pitch = null;
    } else if (Array.isArray(filters.pitch)) {
      query.pitch = { $in: filters.pitch };
    } else {
      query.pitch = filters.pitch;
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
  
  if (filters.artists?.length) {
    query.artists = { $in: filters.artists.map(a => a.toLowerCase()) };
  }

  // =====================================
  // NEGATION FILTERS (NOT operators)
  // =====================================
  
  // Handle color exclusions
  if (filters.colorNot && filters.colorNot.length > 0) {
    if (query.color) {
      // If there's already a color filter, merge with $nin
      if (typeof query.color === 'string') {
        // Convert single color to object
        query.color = { $eq: query.color, $nin: filters.colorNot.map(c => c.toLowerCase()) };
      } else {
        query.color = { ...query.color, $nin: filters.colorNot.map(c => c.toLowerCase()) };
      }
    } else {
      query.color = { $nin: filters.colorNot.map(c => c.toLowerCase()) };
    }
  }

  // Handle rarity exclusions
  if (filters.raritiesNot && filters.raritiesNot.length > 0) {
    if (query.rarity) {
      // Merge with existing rarity filter
      if (query.rarity.$in) {
        query.rarity.$nin = filters.raritiesNot.map(r => r.toLowerCase());
      } else {
        query.rarity = { ...query.rarity, $nin: filters.raritiesNot.map(r => r.toLowerCase()) };
      }
    } else {
      query.rarity = { $nin: filters.raritiesNot.map(r => r.toLowerCase()) };
    }
  }

  // Handle set exclusions
  if (filters.setsNot && filters.setsNot.length > 0) {
    if (query.set) {
      // Merge with existing set filter
      if (query.set.$in) {
        query.set.$nin = filters.setsNot.map(s => s.toLowerCase());
      } else {
        query.set = { ...query.set, $nin: filters.setsNot.map(s => s.toLowerCase()) };
      }
    } else {
      query.set = { $nin: filters.setsNot.map(s => s.toLowerCase()) };
    }
  }

  // Handle foiling exclusions
  if (filters.foilingsNot && filters.foilingsNot.length > 0) {
    if (query.foiling) {
      // Merge with existing foiling filter
      if (query.foiling.$in) {
        query.foiling.$nin = filters.foilingsNot.map(f => f.toLowerCase());
      } else {
        query.foiling = { ...query.foiling, $nin: filters.foilingsNot.map(f => f.toLowerCase()) };
      }
    } else {
      query.foiling = { $nin: filters.foilingsNot.map(f => f.toLowerCase()) };
    }
  }

  // Handle edition exclusions
  if (filters.editionsNot && filters.editionsNot.length > 0) {
    if (query.edition) {
      // Merge with existing edition filter
      if (query.edition.$in) {
        query.edition.$nin = filters.editionsNot.map(e => e.toLowerCase());
      } else {
        query.edition = { ...query.edition, $nin: filters.editionsNot.map(e => e.toLowerCase()) };
      }
    } else {
      query.edition = { $nin: filters.editionsNot.map(e => e.toLowerCase()) };
    }
  }

  // Handle type exclusions
  if (filters.typesNot && filters.typesNot.length > 0) {
    if (query.types) {
      // Merge with existing types filter
      if (query.types.$nin) {
        query.types.$nin.push(...filters.typesNot.map(t => t.toLowerCase()));
      } else {
        query.types = { ...query.types, $nin: filters.typesNot.map(t => t.toLowerCase()) };
      }
    } else {
      query.types = { $nin: filters.typesNot.map(t => t.toLowerCase()) };
    }
  }

  // Handle keyword exclusions
  if (filters.keywordsNot && filters.keywordsNot.length > 0) {
    if (query.keywords) {
      // Merge with existing keywords filter
      if (query.keywords.$nin) {
        query.keywords.$nin.push(...filters.keywordsNot.map(k => k.toLowerCase()));
      } else {
        query.keywords = { ...query.keywords, $nin: filters.keywordsNot.map(k => k.toLowerCase()) };
      }
    } else {
      query.keywords = { $nin: filters.keywordsNot.map(k => k.toLowerCase()) };
    }
  }

  // Handle text NOT search
  if (filters.textNot) {
    const textNotQuery = this.buildTextQuery(filters.textNot, true);
    // Negate the text query
    for (const [field, condition] of Object.entries(textNotQuery)) {
      if (typeof condition === 'object' && condition.$regex) {
        query[field] = { $not: condition };
      }
    }
  }




  // Handle talent exclusions with boolean flags
if (filters.talentsNot?.length) {
  filters.talentsNot.forEach(talent => {
    const booleanQuery = this.mapTalentToBoolean(talent, false);
    Object.assign(query, booleanQuery);
  });
}
  
  // =====================================
  // PRICE FILTERS
  // =====================================

  const priceField = filters.priceField || 'tcg_low';
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    query[priceField] = { $ne: null, $gt: 0 }; // Exclude null/zero prices
    if (filters.priceMin !== undefined) {
      query[priceField] = { ...query[priceField], $gte: filters.priceMin };
    }
    if (filters.priceMax !== undefined) {
      query[priceField] = { ...query[priceField], $lte: filters.priceMax };
    }
  }
  
  // Pricing/Product ID availability
  if (filters.hasPricing !== undefined) {
    if (filters.hasPricing) {
      query.tcg_market = { $ne: null, $gt: 0 };
    } else {
      query.$or = [
        { tcg_market: null },
        { tcg_market: { $exists: false } },
        { tcg_market: 0 }
      ];
    }
  }
  
  if (filters.hasProductId !== undefined) {
    if (filters.hasProductId) {
      query.tcgplayer_product_id = { $ne: null, $exists: true };
    } else {
      query.$or = [
        { tcgplayer_product_id: null },
        { tcgplayer_product_id: { $exists: false } }
      ];
    }
  }
  
  // =====================================
  // BOOLEAN FILTERS - Card Types
  // =====================================
  
  if (filters.isAction !== undefined) query.is_action = filters.isAction;
  if (filters.isAttack !== undefined) query.is_attack = filters.isAttack;
  if (filters.isDefenseReaction !== undefined) query.is_defense_reaction = filters.isDefenseReaction;
  if (filters.isInstant !== undefined) query.is_instant = filters.isInstant;
  if (filters.isEquipment !== undefined) query.is_equipment = filters.isEquipment;
  if (filters.isWeapon !== undefined) query.is_weapon = filters.isWeapon;
  if (filters.isHero !== undefined) query.is_hero = filters.isHero;
  if (filters.isMentor !== undefined) query.is_mentor = filters.isMentor;
  if (filters.isToken !== undefined) query.is_token = filters.isToken;
  
  // =====================================
  // BOOLEAN FILTERS - Classes
  // =====================================
  
  if (filters.isGeneric !== undefined) query.is_generic = filters.isGeneric;
  if (filters.isBrute !== undefined) query.is_brute = filters.isBrute;
  if (filters.isGuardian !== undefined) query.is_guardian = filters.isGuardian;
  if (filters.isMechanologist !== undefined) query.is_mechanologist = filters.isMechanologist;
  if (filters.isRanger !== undefined) query.is_ranger = filters.isRanger;
  if (filters.isRuneblade !== undefined) query.is_runeblade = filters.isRuneblade;
  if (filters.isAssassin !== undefined) query.is_assassin = filters.isAssassin;
  if (filters.isWarrior !== undefined) query.is_warrior = filters.isWarrior;
  if (filters.isNinja !== undefined) query.is_ninja = filters.isNinja;
  if (filters.isWizard !== undefined) query.is_wizard = filters.isWizard;
  if (filters.isMerchant !== undefined) query.is_merchant = filters.isMerchant;
  if (filters.isBard !== undefined) query.is_bard = filters.isBard;
  if (filters.isAdjudicator !== undefined) query.is_adjudicator = filters.isAdjudicator;
  if (filters.isIllusionist !== undefined) query.is_illusionist = filters.isIllusionist;
  if (filters.isThief !== undefined) query.is_thief = filters.isThief;
  if (filters.isShapeshifter !== undefined) query.is_shapeshifter = filters.isShapeshifter;
  if (filters.isNecromancer !== undefined) query.is_necromancer = filters.isNecromancer;
  
  // =====================================
  // BOOLEAN FILTERS - Talents/Essence
  // =====================================
  
  if (filters.hasChaos !== undefined) query.has_chaos = filters.hasChaos;
  if (filters.hasLight !== undefined) query.has_light = filters.hasLight;
  if (filters.hasRoyal !== undefined) query.has_royal = filters.hasRoyal;
  if (filters.hasDraconic !== undefined) query.has_draconic = filters.hasDraconic;
  if (filters.hasLightning !== undefined) query.has_lightning = filters.hasLightning;
  if (filters.hasShadow !== undefined) query.has_shadow = filters.hasShadow;
  if (filters.hasEarth !== undefined) query.has_earth = filters.hasEarth;
  if (filters.hasMystic !== undefined) query.has_mystic = filters.hasMystic;
  if (filters.hasRevered !== undefined) query.has_revered = filters.hasRevered;
  if (filters.hasIce !== undefined) query.has_ice = filters.hasIce;
  if (filters.hasReviled !== undefined) query.has_reviled = filters.hasReviled;
  if (filters.hasPirate !== undefined) query.has_pirate = filters.hasPirate;
  if (filters.hasElemental !== undefined) query.has_elemental = filters.hasElemental;
  
  // =====================================
  // TALENTS WITH AND LOGIC
  // =====================================
  
  // NEW: Talents filtering with AND logic (all specified talents must be present)
  if (filters.talentsAll?.length) {
    const talentConditions = filters.talentsAll.map(t => {
      const lowerTalent = t.toLowerCase();
      switch (lowerTalent) {
        case 'earth': return { has_earth: true };
        case 'ice': return { has_ice: true };
        case 'lightning': return { has_lightning: true };
        case 'light': return { has_light: true };
        case 'elemental': return { has_elemental: true };
        case 'pirate': return { has_pirate: true };
        case 'chaos': return { has_chaos: true };
        case 'royal': return { has_royal: true };
        case 'draconic': return { has_draconic: true };
        case 'shadow': return { has_shadow: true };
        case 'mystic': return { has_mystic: true };
        case 'revered': return { has_revered: true };
        case 'reviled': return { has_reviled: true };
        default: return { talents: lowerTalent };
      }
    });
    
    if (talentConditions.length > 0) {
      query.$and = query.$and || [];
      query.$and.push(...talentConditions);
    }
  }
  
  // =====================================
  // BOOLEAN FILTERS - Combinations
  // =====================================
  
  if (filters.isGenericOnly !== undefined) query.is_generic_only = filters.isGenericOnly;
  if (filters.hasClassAndTalent !== undefined) query.has_class_and_talent = filters.hasClassAndTalent;
  if (filters.hasClassOnly !== undefined) query.has_class_only = filters.hasClassOnly;
  if (filters.hasTalentOnly !== undefined) query.has_talent_only = filters.hasTalentOnly;
  
  // =====================================
  // BOOLEAN FILTERS - Editions
  // =====================================
  
  if (filters.isFirstEdition !== undefined) query.is_first_edition = filters.isFirstEdition;
  if (filters.isUnlimited !== undefined) query.is_unlimited = filters.isUnlimited;
  if (filters.isNormalEdition !== undefined) query.is_normal_edition = filters.isNormalEdition;
  
  // =====================================
  // BOOLEAN FILTERS - Foiling
  // =====================================
  
  if (filters.isNormalFoil !== undefined) query.is_normal_foil = filters.isNormalFoil;
  if (filters.isRainbowFoil !== undefined) query.is_rainbow_foil = filters.isRainbowFoil;
  if (filters.isColdFoil !== undefined) query.is_cold_foil = filters.isColdFoil;
  if (filters.isExtendedArt !== undefined) query.is_extended_art = filters.isExtendedArt;

  
  // =====================================
  // BOOLEAN FILTERS - Rarities
  // =====================================
  
  if (filters.isCommon !== undefined) query.is_common = filters.isCommon;
  if (filters.isRare !== undefined) query.is_rare = filters.isRare;
  if (filters.isSuperRare !== undefined) query.is_super_rare = filters.isSuperRare;
  if (filters.isMajestic !== undefined) query.is_majestic = filters.isMajestic;
  if (filters.isLegendary !== undefined) query.is_legendary = filters.isLegendary;
  if (filters.isFabled !== undefined) query.is_fabled = filters.isFabled;
  if (filters.isPromo !== undefined) query.is_promo = filters.isPromo;
  
  // =====================================
  // BOOLEAN FILTERS - Price Ranges
  // =====================================
  
  if (filters.isBudget !== undefined) query.is_budget = filters.isBudget;
  if (filters.isUnder5 !== undefined) query.is_under_5 = filters.isUnder5;
  if (filters.isUnder10 !== undefined) query.is_under_10 = filters.isUnder10;
  if (filters.isUnder25 !== undefined) query.is_under_25 = filters.isUnder25;
  if (filters.isUnder50 !== undefined) query.is_under_50 = filters.isUnder50;
  if (filters.isUnder100 !== undefined) query.is_under_100 = filters.isUnder100;
  if (filters.isExpensive !== undefined) query.is_expensive = filters.isExpensive;
  if (filters.isPremium !== undefined) query.is_premium = filters.isPremium;
  
  // =====================================
  // FORMAT LEGALITY
  // =====================================
  
  if (filters.format) {
    const legalField = `${filters.format}_legal`;
    query[legalField] = true;
    
    if (!filters.includeBanned) {
      const bannedField = `${filters.format}_banned`;
      query[bannedField] = { $ne: true };
    }
    
    if (!filters.includeSuspended) {
      const suspendedField = `${filters.format}_suspended`;
      query[suspendedField] = { $ne: true };
    }
  }



  
  // =====================================
  // GLOBAL EXCLUSIONS
  // =====================================
  
  // GLOBAL: Exclude event types by default (unless specifically searching for heroes or events)
  // if (!filters.types?.includes('event') && !filters.isHero && !filters.heroLegal) {
  //   if (query.types) {
  //     // Add to existing type query
  //     if (query.types.$nin) {
  //       query.types.$nin.push('event');
  //     } else {
  //       query.types.$nin = ['event'];
  //     }
  //   } else {
  //     // Create new type exclusion
  //     query.types = { $nin: ['event'] };
  //   }
  // }

  // 🔍 DEBUG LOGGING
  console.log('🔍 QUERY DEBUG:', {
    hasNameFilter: !!filters.name,
    nameFilterValue: filters.name,
    hasTextFilter: !!filters.text,
    textFilterValue: filters.text,
    generatedQuery: JSON.stringify(query, null, 2)
  });

  return query;
}

private mapTalentToBoolean(talent: string, value: boolean): object {
  const talentMap: { [key: string]: string } = {
    'light': 'has_light',
    'ice': 'has_ice', 
    'earth': 'has_earth',
    'lightning': 'has_lightning',
    'shadow': 'has_shadow',
    'draconic': 'has_draconic',
    'elemental': 'has_elemental',
    'pirate': 'has_pirate',
    'chaos': 'has_chaos',
    'royal': 'has_royal',
    'mystic': 'has_mystic'
  };
  
  const booleanField = talentMap[talent.toLowerCase()];
  if (booleanField) {
    return { [booleanField]: value };
  }
  
  // Fallback to array-based filtering
  return { talents: talent.toLowerCase() };
}
  
  /**
   * ⭐ OPTIMIZED: Build text query using prefix search for better index usage
   */
  private buildTextQuery(searchText: string, exact?: boolean, field: string = 'text'): any {
    const cleanText = searchText
      .replace(/[''`]/g, "'")
      .trim()
      .toLowerCase();

    if (!cleanText) return {};

    // Exact phrase search
    if (exact || (cleanText.startsWith('"') && cleanText.endsWith('"'))) {
      const phrase = cleanText.replace(/"/g, '');
      return { [field]: phrase };
    }

    // Prefix search - uses index efficiently
    const escapedText = this.escapeRegex(cleanText);
    return {
      [field]: { $regex: `^${escapedText}` }
    };
  }
  
  /**
   * Get projection object based on response mode
   */
  getProjection(mode: ResponseMode): object {
    if (mode === 'all') {
      return {}; // Empty projection returns all fields
    }
    
    return RESPONSE_PROJECTIONS[mode] || {};
  }


  /**
   * Atlas Search for simple name queries
   * Returns null if Atlas Search is not available or fails
   */
  private async atlasSearchByName(collection: any, searchText: string, limit: number, skip: number, sort: any, projection: any): Promise<{ printings: any[], total: number } | null> {
    try {
      const pipeline: any[] = [
        {
          $search: {
            index: "printings",
            text: {
              query: searchText,
              path: "name",
              fuzzy: {
                maxEdits: 1,
                prefixLength: 2
              }
            }
          }
        },
        {
          $addFields: {
            searchScore: { $meta: "searchScore" }
          }
        }
      ];

      // Add projection if specified
      if (projection && Object.keys(projection).length > 0) {
        pipeline.push({ $project: projection });
      }

      // Add sorting (use search score if sortBy is relevance)
      const sortStage = sort.relevance ? { searchScore: -1 } : sort;
      pipeline.push({ $sort: sortStage });

      // Add pagination
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      // Execute aggregation
      const printings = await collection.aggregate(pipeline).toArray();

      // Get total count (approximate for performance)
      const countPipeline = [
        {
          $search: {
            index: "printings",
            text: {
              query: searchText,
              path: "name",
              fuzzy: {
                maxEdits: 1,
                prefixLength: 2
              }
            }
          }
        },
        {
          $count: "total"
        }
      ];

      const countResult = await collection.aggregate(countPipeline).toArray();
      const total = countResult[0]?.total || 0;

      console.log('✅ Atlas Search used:', { searchText, total, results: printings.length });

      return { printings, total };
    } catch (error: any) {
      // Atlas Search not available or index not found - fall back to regex
      console.log('⚠️ Atlas Search unavailable, falling back to regex:', error.message);
      return null;
    }
  }


async searchPrintings(filters: PrintingsSearchFilters = {}, options: PrintingsSearchOptions = {}): Promise<PrintingsSearchResult> {
  const startTime = Date.now();

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('printings');

    // 🔍 DECIDE: Use regex-based search for:
    // 1. Bulk import with name+color filters
    // 2. ID-based searches (cardUniqueId, printingIds, etc.)
    // 3. Attribute filters (foiling, edition, rarity) - Atlas Search has issues with stringFacet compound filters
    // 4. Long queries (>15 chars) - Atlas Search autocomplete has maxGrams limitations
    // 5. Attribute-only filters (sets, colors, classes without name) - Atlas Search match-all doesn't work reliably
    // 6. Collector number searches (e.g., "ARC123", "WTR216") - Not indexed in Atlas Search
    const searchMode = options?.searchMode || 'broad';

    // Simplified routing: Text search vs Filter-only
    const hasTextSearch = !!(filters.name || filters.text || filters.searchableText);
    const hasFilterAttributes = !!(
      filters.types?.length ||
      filters.colors?.length ||
      filters.classes?.length ||
      filters.sets?.length ||
      filters.rarities?.length ||
      filters.foilings?.length ||
      filters.editions?.length ||
      filters.costs?.length ||
      filters.keywords?.length
    );

    const hasIdFilters = filters.cardUniqueId || filters.cardUniqueIds || filters.printingIds || filters.printingCardId;
    const hasHeroLegal = filters.heroLegal !== undefined; // Hero legal filter (uses MongoDB boolean flags)
    const hasNegationFilters = !!(filters.raritiesNot?.length || filters.colorNot?.length || filters.setsNot?.length || filters.foilingsNot?.length || filters.editionsNot?.length);
    const isCollectorNumberQuery = filters.name && isCollectorNumber(filters.name); // Collector number pattern detected
    const isLongQuery = filters.name && filters.name.length > 15; // Fallback for queries over 15 chars

    // Use MongoDB for: filter-only queries, ID filters, hero legal, negation filters, collector numbers, long queries
    const shouldUseRegex = (!hasTextSearch && hasFilterAttributes) || hasIdFilters || hasHeroLegal || hasNegationFilters || isCollectorNumberQuery || isLongQuery;

    if (shouldUseRegex) {
      if (hasIdFilters) {
        console.log('🔍 Using MongoDB query for ID-based search');
      } else if (isCollectorNumberQuery) {
        console.log('🔍 Using MongoDB query for collector number search:', filters.name);
      } else if (hasHeroLegal) {
        console.log('🔍 Using MongoDB query for hero-legal filtering:', filters.heroLegal);
      } else if (isLongQuery) {
        console.log('🔍 Using MongoDB query for long search query (>15 chars)');
      } else if (!hasTextSearch && hasFilterAttributes) {
        console.log('🔍 Using MongoDB query for filter-only search (types, colors, rarities, etc.)');
      } else {
        console.log('🔍 Using MongoDB query for search');
      }

      // Use traditional regex-based query
      const query = this.buildPrintingsQuery(filters, options);

      const page = options.page || 1;
      const limit = Math.min(options.limit || 12, 100);
      const skip = (page - 1) * limit;
      const sortBy = options.sortBy || 'name';
      const sortOrder = options.sortOrder || 'asc';
      const needsCustomSort = sortBy === 'color' || sortBy === 'foiling' || sortBy === 'rarity';

      // For custom sort (color/foiling), fetch more results and sort client-side
      // For regular sorts, use MongoDB sorting
      const sort = needsCustomSort ? { name: 1 } : { [this.getSortField(sortBy, filters.priceField)]: sortOrder === 'desc' ? -1 : 1 };
      const projection = this.getProjection(options.show || 'all');

      const [allResults, total] = await Promise.all([
        needsCustomSort
          ? collection.find(query, { projection, readPreference: 'secondaryPreferred' })
              .sort(sort)
              .toArray()
          : collection.find(query, { projection, readPreference: 'secondaryPreferred' })
              .sort(sort)
              .skip(skip)
              .limit(limit)
              .toArray(),
        collection.countDocuments(query, { readPreference: 'secondaryPreferred' })
      ]);

      // Apply custom sorting if needed and paginate
      let printings = allResults;
      if (needsCustomSort) {
        printings = this.applyCustomSort(allResults, sortBy, sortOrder).slice(skip, skip + limit);
      }

      const printingsWithExtras = printings.map((p: any) => ({
        ...p,
        tcgplayer_url: p.tcgplayer_url || p.printing_data?.tcgplayer_url || null,
        display_name: p.display_name || p.printing_data?.display_name || p.name,
      }));

      const executionTime = Date.now() - startTime;

      return {
        printings: printingsWithExtras as PrintingDocument[],
        total,
        page,
        pages: Math.ceil(total / limit),
        queryInfo: { query, executionTime, filters }
      };
    }

    // Otherwise, use Atlas Search
    console.log('🔍 Using Atlas Search');
    const searchStage = this.buildAtlasSearchStage(filters, options);

    if (!searchStage) {
      // Return empty result if no valid search filters were provided
      return {
        printings: [], total: 0, page: 1, pages: 1,
        queryInfo: { query: { info: "No valid search criteria provided" }, executionTime: Date.now() - startTime, filters }
      };
    }

    const page = options.page || 1;
    const limit = Math.min(options.limit || 12, 100);
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'name';
    const sortOrder = options.sortOrder || 'asc';
    const needsCustomSort = sortBy === 'color' || sortBy === 'foiling' || sortBy === 'rarity';
    const sort = needsCustomSort ? { name: 1 } : { [this.getSortField(sortBy, filters.priceField)]: sortOrder === 'desc' ? -1 : 1 };
    const projection = this.getProjection(options.show || 'all');

    // Build pagination pipeline
    // For custom sorts, we'll fetch all and sort client-side
    const paginationPipeline: any[] = needsCustomSort
      ? [{ $sort: sort }]
      : [
          { $sort: sort },
          { $skip: skip },
          { $limit: limit }
        ];

    // Only add $project if projection has fields (not empty for 'all' mode)
    if (Object.keys(projection).length > 0) {
      paginationPipeline.push({ $project: projection });
    }

    // Build $match stage for filters not supported in Atlas Search index
    const matchStage: any = {};
    // Rarity exclusions (e.g., Silver Age format restrictions)
    if (filters.raritiesNot && filters.raritiesNot.length > 0) {
      matchStage.rarity = { $nin: filters.raritiesNot.map(r => r.toLowerCase()) };
    }
    if (filters.isBudget !== undefined) matchStage.is_budget = filters.isBudget;
    if (filters.isUnder5 !== undefined) matchStage.is_under_5 = filters.isUnder5;
    if (filters.isUnder10 !== undefined) matchStage.is_under_10 = filters.isUnder10;
    if (filters.isUnder25 !== undefined) matchStage.is_under_25 = filters.isUnder25;
    if (filters.isUnder50 !== undefined) matchStage.is_under_50 = filters.isUnder50;
    if (filters.isUnder100 !== undefined) matchStage.is_under_100 = filters.isUnder100;
    if (filters.isExpensive !== undefined) matchStage.is_expensive = filters.isExpensive;
    if (filters.isPremium !== undefined) matchStage.is_premium = filters.isPremium;

    const pipeline: any[] = [
      { $search: searchStage }
    ];

    // Add $match stage if there are boolean price filters
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push({
      $facet: {
        paginatedResults: paginationPipeline,
        totalCount: [{ $count: 'count' }]
      }
    });

    const results = await collection.aggregate(pipeline, { readPreference: 'secondaryPreferred' }).toArray();
    let printings = results[0]?.paginatedResults || [];
    const total = results[0]?.totalCount[0]?.count || 0;

    // Apply custom sorting and pagination if needed
    if (needsCustomSort) {
      printings = this.applyCustomSort(printings, sortBy, sortOrder).slice(skip, skip + limit);
    }

    const printingsWithExtras = printings.map((p: any) => ({
      ...p,
      tcgplayer_url: p.tcgplayer_url || p.printing_data?.tcgplayer_url || null,
      display_name: p.display_name || p.printing_data?.display_name || p.name,
    }));

    const executionTime = Date.now() - startTime;

    return {
      printings: printingsWithExtras as PrintingDocument[],
      total,
      page,
      pages: Math.ceil(total / limit),
      queryInfo: { query: { atlasPipeline: pipeline }, executionTime, filters }
    };

  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

// ADD this new helper method inside the same class
private buildAtlasSearchStage(filters: PrintingsSearchFilters, options?: PrintingsSearchOptions): any | null {
  const must: any[] = [];
  const should: any[] = [];
  const filter: any[] = [];
  const searchMode = options?.searchMode || 'broad';

  // --- Text Search with Exact Match Boosting ---
  if (filters.name) {
    // Conditional fuzzy: Only use for queries >= 5 characters to prevent false matches
    const shouldUseFuzzy = filters.name.length >= 5;

    // HIGHEST PRIORITY: Exact string match using equals operator (token type)
    // Preserves special characters like colons, apostrophes, etc.
    should.push({
      equals: {
        path: 'name',
        value: filters.name.toLowerCase(),
        score: { boost: { value: 100 } }  // 100x boost for exact match
      }
    });

    should.push({
      equals: {
        path: 'display_name',
        value: filters.name.toLowerCase(),
        score: { boost: { value: 100 } }
      }
    });

    // HIGH PRIORITY: Phrase matching (preserves word order for partial matches)
    // Helps "art of the dragon" match "art of the dragon: blood"
    should.push({
      phrase: {
        query: filters.name,
        path: 'name',
        score: { boost: { value: 50 } }  // 50x boost for phrase match
      }
    });

    should.push({
      phrase: {
        query: filters.name,
        path: 'display_name',
        score: { boost: { value: 50 } }
      }
    });

    // High priority: Text match on name
    should.push({
      text: {
        query: filters.name,
        path: 'name',
        score: { boost: { value: 10 } }  // 10x boost for text match
      }
    });

    // High priority: Text match on display_name
    should.push({
      text: {
        query: filters.name,
        path: 'display_name',
        score: { boost: { value: 10 } }
      }
    });

    // Medium priority: Autocomplete on name (prefix matching with conditional fuzzy)
    const nameAutocomplete: any = {
      query: filters.name,
      path: 'name',
      tokenOrder: 'sequential',
      score: { boost: { value: 2 } }  // 2x boost for autocomplete
    };

    // Only add fuzzy for longer queries (>= 5 chars) with prefixLength safety
    if (shouldUseFuzzy) {
      nameAutocomplete.fuzzy = { maxEdits: 1, prefixLength: 3 };
    }

    should.push({ autocomplete: nameAutocomplete });

    // Medium priority: Autocomplete on display_name (prefix matching with conditional fuzzy)
    const displayNameAutocomplete: any = {
      query: filters.name,
      path: 'display_name',
      tokenOrder: 'sequential',
      score: { boost: { value: 2 } }
    };

    // Only add fuzzy for longer queries (>= 5 chars) with prefixLength safety
    if (shouldUseFuzzy) {
      displayNameAutocomplete.fuzzy = { maxEdits: 1, prefixLength: 3 };
    }

    should.push({ autocomplete: displayNameAutocomplete });
  }

  if (filters.text) {
    must.push({ text: { query: filters.text, path: 'type_text' } });
  }

  // --- Filtering (Fast, exact matches) ---
  if (filters.colors && filters.colors.length > 0) {
    if (filters.colors.length === 1) {
      filter.push({ text: { path: 'color', query: filters.colors[0] } });
    } else {
      // For multiple colors, use $in operator
      filter.push({ 'in': { path: 'color', value: filters.colors } });
    }
  }
  if (filters.sets?.length) {
    filter.push({ 'in': { path: 'set', value: filters.sets } });
  }
  if (filters.rarities?.length) {
    filter.push({ 'in': { path: 'rarity', value: filters.rarities } });
  }
  if (filters.editions?.length) {
    filter.push({ 'in': { path: 'edition', value: filters.editions } });
  }
  if (filters.foilings?.length) {
    filter.push({ 'in': { path: 'foiling', value: filters.foilings } });
  }
  // Add other array-based filters like 'types', 'classes', 'keywords' here if they exist in your data
  if (filters.types?.length) {
      // Assuming a field named 'types' as string array exists, otherwise adjust path
      filter.push({ 'in': { path: 'types', value: filters.types } });
  }

  // Cost filtering (array of specific costs)
  if (filters.costs?.length) {
      filter.push({ 'in': { path: 'cost', value: filters.costs } });
  }

  // --- Numeric Range Filtering ---
  const priceField = filters.priceField || 'tcg_low';
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    const rangeClause: any = { path: priceField };
    if (filters.priceMin !== undefined) rangeClause.gte = filters.priceMin;
    if (filters.priceMax !== undefined) rangeClause.lte = filters.priceMax;
    filter.push({ range: rangeClause });
  }

  // NOTE: Boolean price filters (is_expensive, is_under_5, etc.) are handled
  // via $match stage after $search in the aggregation pipeline, since these
  // fields are not indexed in the Atlas Search index

  // --- Assemble the final query ---
  if (must.length === 0 && should.length === 0 && filter.length === 0) {
    return null; // No search criteria
  }

  // If we only have filters but no text search, add a match-all query to make it valid
  // This allows filtering by color, set, rarity, etc. without a name search
  if (must.length === 0 && should.length === 0 && filter.length > 0) {
    // Use a simple text search that will match all documents
    must.push({
      text: {
        path: 'name',
        query: ' ',  // Space matches all documents with analyzed text
        score: { constant: { value: 1 } }
      }
    });
  }

  const compound: any = {};
  if (must.length > 0) compound.must = must;
  if (should.length > 0) {
    compound.should = should;
    compound.minimumShouldMatch = 1;
  }
  if (filter.length > 0) compound.filter = filter;

  const searchStage = {
    index: 'printings', // Change if your index has a different name
    compound: compound
  };

  console.log('🔍 Atlas Search Stage:', JSON.stringify(searchStage, null, 2));

  return searchStage;
}
  
  /**
   * Get a single printing by ID
   */
  async getPrintingById(printingId: string): Promise<PrintingDocument | null> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('printings');

      const printing = await collection.findOne(
        { printing_id: printingId },
        { readPreference: 'secondaryPreferred' }
      );
      return printing as PrintingDocument | null;
    } catch (error) {
      console.error('Get printing error:', error);
      throw error;
    }
  }
  
  /**
   * Get printings for a specific card
   */
  async getPrintingsForCard(cardId: string, options: PrintingsSearchOptions = {}): Promise<PrintingsSearchResult> {
    return this.searchPrintings({ name: cardId }, options);
  }

  /**
   * Get multiple printings by their printing_id values
   */
  async getPrintingsByIds(printingIds: string[], options: PrintingsSearchOptions = {}): Promise<PrintingsSearchResult> {
    return this.searchPrintings({ printingIds }, options);
  }
  
  /**
   * NEW: Get printings legal for a specific hero
   */
  async getPrintingsForHero(heroName: string, options: PrintingsSearchOptions = {}): Promise<PrintingsSearchResult> {
    // Use heroLegal filter to automatically handle class/talent exclusions
    return this.searchPrintings({ heroLegal: heroName }, options);
  }

  /**
   * NEW: Get elemental cards by essence type(s)
   */
  async getElementalCards(essenceTypes: string[], options: PrintingsSearchOptions = {}): Promise<PrintingsSearchResult> {
    const filters: PrintingsSearchFilters = {};
    
    // Convert essence types to boolean filters
    const essenceFilters: any = {};
    essenceTypes.forEach(essence => {
      switch (essence.toLowerCase()) {
        case 'earth':
          essenceFilters.hasEarth = true;
          break;
        case 'ice':
          essenceFilters.hasIce = true;
          break;
        case 'lightning':
          essenceFilters.hasLightning = true;
          break;
        case 'light':
          essenceFilters.hasLight = true;
          break;
      }
    });
    
    return this.searchPrintings(essenceFilters, options);
  }

  /**
   * NEW: Get cards by class and/or talent combination
   */
  async getCardsByClassTalent(classes?: string[], talents?: string[], options: PrintingsSearchOptions = {}): Promise<PrintingsSearchResult> {
    const filters: PrintingsSearchFilters = {};
    
    if (classes?.length) {
      filters.classes = classes;
    }
    
    if (talents?.length) {
      filters.talents = talents;
    }
    
    return this.searchPrintings(filters, options);
  }
  
  /**
   * Get available filter values for faceted search
   */
  async getFilterValues(): Promise<{
    sets: string[];
    editions: string[];
    foilings: string[];
    rarities: string[];
    artists: string[];
    types: string[];
    traits: string[];
    keywords: string[];
    colors: string[];
    classes: string[];      // NEW
    talents: string[];      // NEW
  }> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('printings');

      const [sets, editions, foilings, rarities, artists, types, traits, keywords, colors, classes, talents] = await Promise.all([
        collection.distinct('set', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('edition', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('foiling', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('rarity', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('artists', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('types', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('traits', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('keywords', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('color', {}, { readPreference: 'secondaryPreferred' }),
        collection.distinct('classes', {}, { readPreference: 'secondaryPreferred' }),     // NEW
        collection.distinct('talents', {}, { readPreference: 'secondaryPreferred' })      // NEW
      ]);
      
      return {
        sets: sets.sort(),
        editions: editions.sort(),
        foilings: foilings.sort(),
        rarities: rarities.sort(),
        artists: artists.sort(),
        types: types.sort(),
        traits: traits.sort(),
        keywords: keywords.sort(),
        colors: colors.sort(),
        classes: classes.sort(), 
        talents: talents.sort()  
      };
    } catch (error) {
      console.error('Get filter values error:', error);
      throw error;
    }
  }

  /**
   * NEW: Get essence statistics for deck building
   */
  async getEssenceStatistics(): Promise<{
    earth: number;
    ice: number;
    lightning: number;
    light: number;
    combinations: {
      'earth_ice': number;
      'earth_lightning': number;
      'ice_lightning': number;
      'earth_light': number;
      'ice_light': number;
      'lightning_light': number;
    };
  }> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('printings');

      const [earth, ice, lightning, light] = await Promise.all([
        collection.countDocuments({ has_earth: true }, { readPreference: 'secondaryPreferred' }),
        collection.countDocuments({ has_ice: true }, { readPreference: 'secondaryPreferred' }),
        collection.countDocuments({ has_lightning: true }, { readPreference: 'secondaryPreferred' }),
        collection.countDocuments({ has_light: true }, { readPreference: 'secondaryPreferred' })
      ]);

      const [earthIce, earthLightning, iceLightning, earthLight, iceLight, lightningLight] = await Promise.all([
        collection.countDocuments({ has_earth: true, has_ice: true }, { readPreference: 'secondaryPreferred' }),
        collection.countDocuments({ has_earth: true, has_lightning: true }, { readPreference: 'secondaryPreferred' }),
        collection.countDocuments({ has_ice: true, has_lightning: true }, { readPreference: 'secondaryPreferred' }),
        collection.countDocuments({ has_earth: true, has_light: true }, { readPreference: 'secondaryPreferred' }),
        collection.countDocuments({ has_ice: true, has_light: true }, { readPreference: 'secondaryPreferred' }),
        collection.countDocuments({ has_lightning: true, has_light: true }, { readPreference: 'secondaryPreferred' })
      ]);
      
      return {
        earth,
        ice,
        lightning,
        light,
        combinations: {
          'earth_ice': earthIce,
          'earth_lightning': earthLightning,
          'ice_lightning': iceLightning,
          'earth_light': earthLight,
          'ice_light': iceLight,
          'lightning_light': lightningLight
        }
      };
    } catch (error) {
      console.error('Get essence statistics error:', error);
      throw error;
    }
  }

  /**
   * NEW: Advanced deck building query for hero-specific card pools
   */
  async getDeckBuildingCards(heroName: string, additionalFilters: PrintingsSearchFilters = {}, options: PrintingsSearchOptions = {}): Promise<PrintingsSearchResult> {
    // Combine hero-based filtering with additional filters
    const combinedFilters: PrintingsSearchFilters = {
      ...additionalFilters,
      heroLegal: heroName,
      // Exclude heroes themselves from deck building results
      isHero: false
    };
    
    return this.searchPrintings(combinedFilters, options);
  }

  /**
   * NEW: Get price statistics for a set of filters
   */
  async getPriceStatistics(filters: PrintingsSearchFilters = {}): Promise<{
    count: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    totalValue: number;
    priceRanges: {
      budget: number;      // < $1
      under5: number;      // $1-5
      under10: number;     // $5-10
      under25: number;     // $10-25
      under50: number;     // $25-50
      under100: number;    // $50-100
      expensive: number;   // $100+
    };
  }> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection('printings');
      
      const query = this.buildPrintingsQuery(filters);
      
      // Add pricing requirement
      const pricedQuery = {
        ...query,
        tcg_market: { $ne: null, $gt: 0 }
      };
      
      const [stats, ranges] = await Promise.all([
        collection.aggregate([
          { $match: pricedQuery },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              avgPrice: { $avg: '$tcg_market' },
              minPrice: { $min: '$tcg_market' },
              maxPrice: { $max: '$tcg_market' },
              totalValue: { $sum: '$tcg_market' }
            }
          }
        ], { readPreference: 'secondaryPreferred' }).toArray(),
        Promise.all([
          collection.countDocuments({ ...pricedQuery, is_budget: true }, { readPreference: 'secondaryPreferred' }),
          collection.countDocuments({ ...pricedQuery, tcg_market: { $gte: 1, $lt: 5 } }, { readPreference: 'secondaryPreferred' }),
          collection.countDocuments({ ...pricedQuery, tcg_market: { $gte: 5, $lt: 10 } }, { readPreference: 'secondaryPreferred' }),
          collection.countDocuments({ ...pricedQuery, tcg_market: { $gte: 10, $lt: 25 } }, { readPreference: 'secondaryPreferred' }),
          collection.countDocuments({ ...pricedQuery, tcg_market: { $gte: 25, $lt: 50 } }, { readPreference: 'secondaryPreferred' }),
          collection.countDocuments({ ...pricedQuery, tcg_market: { $gte: 50, $lt: 100 } }, { readPreference: 'secondaryPreferred' }),
          collection.countDocuments({ ...pricedQuery, is_expensive: true }, { readPreference: 'secondaryPreferred' })
        ])
      ]);
      
      const result = stats[0] || {
        count: 0,
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        totalValue: 0
      };
      
      return {
        ...result,
        priceRanges: {
          budget: ranges[0],
          under5: ranges[1],
          under10: ranges[2],
          under25: ranges[3],
          under50: ranges[4],
          under100: ranges[5],
          expensive: ranges[6]
        }
      };
    } catch (error) {
      console.error('Get price statistics error:', error);
      throw error;
    }
  }
  
  private getSortField(sortBy: string, priceField?: string): string {
    switch (sortBy) {
      case 'name': return 'name';
      case 'price': return priceField || 'tcg_market';
      case 'power': return 'power';
      case 'cost': return 'cost';
      case 'defense': return 'defense';
      case 'set': return 'set';
      case 'rarity': return 'rarity';
      case 'printing_card_id': return 'printing_card_id';
      case 'edition': return 'edition';
      case 'color': return 'color';
      case 'foiling': return 'foiling';
      default: return 'name';
    }
  }

  /**
   * Get custom sort weight for color field (Red → Yellow → Blue → Generic)
   */
  private getColorSortWeight(color: string | undefined): number {
    const colorMap: { [key: string]: number } = {
      'red': 1,
      'yellow': 2,
      'blue': 3,
      'generic': 4,
      '': 4
    };
    return colorMap[color?.toLowerCase() || ''] || 4;
  }

  /**
   * Get custom sort weight for foiling field (Standard → Rainbow → Cold → Gold)
   */
  private getFoilingSortWeight(foiling: string | undefined): number {
    const foilingMap: { [key: string]: number } = {
      's': 1,
      'standard': 1,
      'r': 2,
      'rainbow': 2,
      'c': 3,
      'cold': 3,
      'g': 4,
      'gold': 4
    };
    return foilingMap[foiling?.toLowerCase() || ''] || 1;
  }

  /**
   * Get custom sort weight for rarity field (Promo → Fabled → Marvel → Legendary → Majestic → Super Rare → Rare → Common → Basic → Token)
   */
  private getRaritySortWeight(rarity: string | undefined): number {
    const rarityMap: { [key: string]: number } = {
      'p': 1,
      'promo': 1,
      'f': 2,
      'fabled': 2,
      'v': 3,
      'marvel': 3,
      'l': 4,
      'legendary': 4,
      'm': 5,
      'majestic': 5,
      's': 6,
      'super rare': 6,
      'r': 7,
      'rare': 7,
      'c': 8,
      'common': 8,
      'b': 9,
      'basic': 9,
      't': 10,
      'token': 10
    };
    return rarityMap[rarity?.toLowerCase() || ''] || 8; // Default to common
  }

  /**
   * Apply custom sorting for color, foiling, or rarity fields
   */
  private applyCustomSort(printings: any[], sortBy: string, sortOrder: string): any[] {
    if (sortBy === 'color') {
      return printings.sort((a, b) => {
        const weightA = this.getColorSortWeight(a.color);
        const weightB = this.getColorSortWeight(b.color);
        return sortOrder === 'desc' ? weightB - weightA : weightA - weightB;
      });
    } else if (sortBy === 'foiling') {
      return printings.sort((a, b) => {
        const weightA = this.getFoilingSortWeight(a.foiling);
        const weightB = this.getFoilingSortWeight(b.foiling);
        return sortOrder === 'desc' ? weightB - weightA : weightA - weightB;
      });
    } else if (sortBy === 'rarity') {
      return printings.sort((a, b) => {
        const weightA = this.getRaritySortWeight(a.rarity);
        const weightB = this.getRaritySortWeight(b.rarity);
        return sortOrder === 'desc' ? weightB - weightA : weightA - weightB;
      });
    }
    return printings;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
}