// lib/trade-analysis/tests/analyzer.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradeAnalyzer } from '../analyzer';
import * as dataFetcher from '../data-fetcher';
import { calculateMatches } from '../card-matcher';
import { extractPrintingId, getCardValue } from '../utils';
import { Card, Binder, WantsList } from '../types';

// Mock the data fetcher
vi.mock('../data-fetcher');

describe('TradeAnalyzer - Real Data Tests', () => {
  const currentUserId = '680632e35e734e4206edeac2';
  const targetUserId = '68a73afa50ddcaff54c41eae';
  
  // ... (Card data is unchanged) ...
  const plagueHiveWant: Card = {
    id: "JF8f6QmfrWmdQHDhjkbdT",
    cardId: "GKWhbqnhnR6ztt9gCzmLw",
    name: "Plague Hive",
    quantity: 1,
    printingDetails: {
      printing_id: "JF8f6QmfrWmdQHDhjkbdT",
      tcg_market: 175.10
    }
  };
  
  const plagueHiveHave: Card = {
    id: "JF8f6QmfrWmdQHDhjkbdT",
    cardId: "GKWhbqnhnR6ztt9gCzmLw",
    name: "Plague Hive",
    quantity: 1,
    forTrade: true,
    printingDetails: {
      tcg_market: 175.10
    }
  };

  const callToTheGraveWant: Card = {
    id: "wPGzqhc6njMLWdt6zHMHD",
    cardId: "gDhFGHDrPKRwCP6qRF6zd",
    name: "Call to the Grave",
    quantity: 2,
    printingDetails: {
      printing_id: "wPGzqhc6njMLWdt6zHMHD",
      tcg_market: 20.77
    }
  };

  const callToTheGraveHave: Card = {
    id: "BrzqQJgq8Gp9w8ncKDcmF", // Different printing ID!
    cardId: "gDhFGHDrPKRwCP6qRF6zd", // Same card ID
    name: "Call to the Grave",
    quantity: 2,
    forTrade: true,
    printingDetails: {
      tcg_market: 44.44
    }
  };


  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ... (ID Extraction tests are unchanged) ...
  describe('ID Extraction', () => {
    it('should extract printing ID correctly', () => {
      expect(extractPrintingId(plagueHiveWant)).toBe('JF8f6QmfrWmdQHDhjkbdT');
      expect(extractPrintingId(callToTheGraveHave)).toBe('BrzqQJgq8Gp9w8ncKDcmF');
    });

    it('should extract price correctly from different formats', () => {
      expect(getCardValue(plagueHiveWant)).toBe(175.10);
      expect(getCardValue(callToTheGraveHave)).toBe(44.44);
    });
  });

  describe('Matching Logic', () => {
    it('should match cards with same printing ID', () => {
      const wants = [plagueHiveWant];
      const haves = [plagueHiveHave];
      
      // <-- UPDATE: The signature is now (wants, haves, matchOnPrintingId, includeCardDetails)
      const result = calculateMatches(wants, haves, true, false);
      
      expect(result.count).toBe(1);
      expect(result.totalQuantity).toBe(1);
      expect(result.totalValue).toBeCloseTo(175.10, 2);
    });

    it('should NOT match cards with different printing IDs even with same card ID', () => {
        const wants = [callToTheGraveWant];
        const haves = [callToTheGraveHave];
        
        // <-- UPDATE: The signature is now (wants, haves, matchOnPrintingId, includeCardDetails)
        const result = calculateMatches(wants, haves, true, false);
        
        expect(result.count).toBe(0);
        expect(result.totalQuantity).toBe(0);
    });
  });

  describe('Full Analysis', () => {
    it('should analyze complete trade compatibility with real data', async () => {
      const mockData = {
        // ... (mock data is unchanged) ...
        currentUserWantsLists: [{
          userId: currentUserId,
          cards: [plagueHiveWant, callToTheGraveWant]
        }] as WantsList[],
        currentUserBinders: [] as Binder[],
        targetUserBinders: [{
          userId: targetUserId,
          cards: [plagueHiveHave, callToTheGraveHave],
          visibility: { 
            allowInMatching: true, 
            level: 'public' as const 
          }
        }] as Binder[],
        targetWantsLists: [] as WantsList[]
      };
      
      (dataFetcher.fetchTradeData as vi.Mock).mockResolvedValue(mockData);
      
      // <-- UPDATE: The constructor now takes a 5th argument for matchOnPrintingId
      const analyzer = new TradeAnalyzer(
        currentUserId,
        targetUserId,
        true,    // includeCards
        'full',  // format
        true     // matchOnPrintingId
      );
      
      const result = await analyzer.analyze();
      
      expect(result.success).toBe(true);
      // NOTE: Your assertions are already correct for the expected outcome
      expect(result.match_summary.they_have_your_wants.count).toBe(1);
      expect(result.match_summary.they_have_your_wants.total_quantity).toBe(1);
      expect(result.quick_stats.has_mutual_interest).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle large collections efficiently', async () => {
      // ... (data generation is unchanged) ...
      const manyWants = Array.from({ length: 1000 }, (_, i) => ({
        id: `want-${i}`,
        cardId: `card-${i}`,
        name: `Card ${i}`,
        quantity: 1,
        // Added forTrade to be safe, though it's not used on wants
        forTrade: false, 
      }));
      
      const manyHaves = Array.from({ length: 1000 }, (_, i) => ({
        id: `have-${i}`,
        cardId: `card-${i % 100}`,
        name: `Card ${i % 100}`,
        quantity: 1,
        forTrade: true,
      }));
      
      const startTime = performance.now();
      // <-- UPDATE: The 1st `false` is for matchOnPrintingId, the 2nd is for includeCardDetails
      const result = calculateMatches(manyWants, manyHaves, false, false);
      const endTime = performance.now();
      
      expect(result.count).toBe(100);
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
