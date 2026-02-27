// Core type definitions for the trade analysis system
// NOTE: This file is database-agnostic - no mongoose imports
export interface Card {
  // InventoryItem fields (much cleaner structure)
  printingId: string;
  name?: string;
  display_name?: string;
  set?: string;
  foiling?: string;
  edition?: string;
  rarity?: string;
  color?: string; // NEW: Color field from updated core collection
  quantity?: number;
  forTrade?: boolean;
  tcg_market?: number;
  tcg_low?: number;
  tcg_mid?: number;
  tcg_high?: number;
  image_url?: string;
  
  // Legacy fields for backward compatibility (from wants lists)
  printingDetails?: {
    printing_id?: string;
    printingId?: string;
    tcg_market?: number;
    tcgMarket?: number;
    image_url?: string;
    set_id?: string;
    foiling?: string;
    edition?: string;
    rarity?: string;
  };
  id?: string;
  priceInfo?: {
    tcgMarket?: number;
  };
}

// Simplified Binder interface - no longer used for card data
export interface Binder {
  userId: string;
  // Removed cards array - now handled by InventoryItem collection
  archived?: boolean;
  visibility?: {
    allowInMatching?: boolean;
    allowWhoHas?: boolean;
    level?: 'public' | 'private' | 'friends';
  };
  isPublic?: boolean; // Legacy field
}

export interface WantsList {
  userId: string;
  cards?: Card[];
}

export interface CardMatch {
  name: string;
  printingId: string;
  set?: string;
  foiling?: string;
  edition?: string;
  rarity?: string;
  color?: string; // NEW: Include color in match results
  quantity: number;
  unitValue: number;
  totalValue: number;
  image_url?: string;
}

export interface MatchMetrics {
  count: number;
  totalQuantity: number;
  totalValue: number;
  rate: number;
  cards?: CardMatch[];
}

export interface TradeAnalysisResult {
  youHaveTheirWants: MatchMetrics;
  theyHaveYourWants: MatchMetrics;
  compatibilityScore: number;
  tradePotential: 'high' | 'medium' | 'low';
  valueDifference: number;
  balanceStatus: 'you_ahead' | 'they_ahead' | 'balanced';
  totalMutualCards: number;
  hasMutualInterest: boolean;
}

export interface CompatibilityMetrics {
  youHaveRate: number;
  theyHaveRate: number;
  youHaveCount: number;
  theyHaveCount: number;
  totalMutualCards: number;
  valueBalance: number;
}
// import { Types } from 'mongoose';

// // Core type definitions for the trade analysis system
// export interface Card {
//   printingId?: string;
//   printingDetails?: {
//     printing_id?: string;
//     printingId?: string;
//     tcg_market?: number;
//     tcgMarket?: number;
//     image_url?: string;
//     set_id?: string;
//     foiling?: string;
//     edition?: string;
//     rarity?: string;
//   };
//   id?: string;
//   name?: string;
//   set?: string;
//   foiling?: string;
//   edition?: string;
//   rarity?: string;
//   quantity?: number;
//   forTrade?: boolean;
//   priceInfo?: {
//     tcgMarket?: number;
//   };
//   tcg_market?: number;
//   image_url?: string;
// }

// export interface Binder {
//   userId: string | Types.ObjectId;
//   cards?: Card[];
//   archived?: boolean;
//   visibility?: {
//     allowInMatching?: boolean;
//     level?: 'public' | 'private' | 'friends';
//   };
//   isPublic?: boolean; // Legacy field
// }

// export interface WantsList {
//   userId: string | Types.ObjectId;
//   cards?: Card[];
// }

// export interface CardMatch {
//   name: string;
//   printingId: string;
//   set?: string;
//   foiling?: string;
//   edition?: string;
//   rarity?: string;
//   quantity: number;
//   unitValue: number;
//   totalValue: number;
//   image_url?: string;
// }

// export interface MatchMetrics {
//   count: number;
//   totalQuantity: number;
//   totalValue: number;
//   rate: number;
//   cards?: CardMatch[];
// }

// export interface TradeAnalysisResult {
//   youHaveTheirWants: MatchMetrics;
//   theyHaveYourWants: MatchMetrics;
//   compatibilityScore: number;
//   tradePotential: 'high' | 'medium' | 'low';
//   valueDifference: number;
//   balanceStatus: 'you_ahead' | 'they_ahead' | 'balanced';
//   totalMutualCards: number;
//   hasMutualInterest: boolean;
// }

// export interface CompatibilityMetrics {
//   youHaveRate: number;
//   theyHaveRate: number;
//   youHaveCount: number;
//   theyHaveCount: number;
//   totalMutualCards: number;
//   valueBalance: number;
// }