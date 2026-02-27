// lib/trade-analysis/card-matcher.ts
import { Card, CardMatch, MatchMetrics } from './types';
import { 
  extractPrintingId, 
  getCardQuantity, 
  getCardValue, 
  createCardMatch 
} from './utils';

/**
 * Creates an optimized map for O(1) card lookups.
 * Groups cards by either their printing ID or generic card ID.
 * Note: No longer needs to filter for forTrade since InventoryItem query handles this
 */
export function createCardMap(cards: Card[], matchOnPrintingId: boolean): Map<string, Card[]> {
    const cardMap = new Map<string, Card[]>();
    
    for (const card of cards) {
      // InventoryItem query already filters for forTrade: true, so we don't need this check anymore
      // if (card.forTrade === false) continue;

      // Use the flag to decide which ID to use as the key
      const key = matchOnPrintingId ? extractPrintingId(card) : card.cardId;
      
      if (!key) continue;
      
      const normalizedId = key.toLowerCase();
      
      if (!cardMap.has(normalizedId)) {
        cardMap.set(normalizedId, []);
      }
      
      cardMap.get(normalizedId)!.push(card);
    }
    
    return cardMap;
}

/**
 * Calculates match metrics between a list of wants and a list of haves.
 * Much more efficient now since haves come pre-filtered from InventoryItem collection
 */
export function calculateMatches(
  wantsCards: Card[],
  havesCards: Card[],
  matchOnPrintingId: boolean, 
  includeCardDetails: boolean = false 
): MatchMetrics {
  const havesMap = createCardMap(havesCards, matchOnPrintingId);
  
  let matchCount = 0;
  let totalMatchedQuantity = 0;
  let totalValue = 0;
  const matchedCards: CardMatch[] = [];
  
  for (const wantCard of wantsCards) {
    const wantKey = matchOnPrintingId ? extractPrintingId(wantCard) : wantCard.cardId;
    if (!wantKey) continue;
    
    const normalizedId = wantKey.toLowerCase();
    const matchingHaves = havesMap.get(normalizedId);
    
    if (matchingHaves && matchingHaves.length > 0) {
      matchCount++;
      
      const wantedQuantity = getCardQuantity(wantCard);
      const availableQuantity = matchingHaves.reduce(
        (sum, card) => sum + getCardQuantity(card), 
        0
      );
      
      const actualMatchedQuantity = Math.min(wantedQuantity, availableQuantity);
      totalMatchedQuantity += actualMatchedQuantity;
      
      const cardValue = getCardValue(matchingHaves[0]);
      totalValue += cardValue * actualMatchedQuantity;
      
      if (includeCardDetails) {
        matchedCards.push(createCardMatch(wantCard, matchingHaves, actualMatchedQuantity));
      }
    }
  }
  
  const totalWantsQuantity = wantsCards.reduce((sum, card) => sum + getCardQuantity(card), 0);
  const matchRate = totalWantsQuantity > 0 ? (totalMatchedQuantity / totalWantsQuantity) * 100 : 0;

  return {
    count: matchCount,
    totalQuantity: totalMatchedQuantity,
    totalValue: Math.round(totalValue * 100) / 100,
    rate: Math.round(matchRate * 10) / 10,
    cards: matchedCards
  };
}

/**
 * Performs bidirectional matching between two users.
 * Now much more efficient with pre-filtered InventoryItem data
 */
export function performBidirectionalMatch(
  currentUserWants: Card[],
  currentUserHaves: Card[], // Now comes directly from InventoryItem query
  targetUserWants: Card[],
  targetUserHaves: Card[],  // Now comes directly from InventoryItem query
  matchOnPrintingId: boolean,
  includeCardDetails: boolean = false
): {
  youHaveTheirWants: MatchMetrics;
  theyHaveYourWants: MatchMetrics;
} {
  const youHaveTheirWants = calculateMatches(
    targetUserWants,
    currentUserHaves,
    matchOnPrintingId,
    includeCardDetails
  );
  
  const theyHaveYourWants = calculateMatches(
    currentUserWants,
    targetUserHaves,
    matchOnPrintingId,
    includeCardDetails
  );
  
  return {
    youHaveTheirWants,
    theyHaveYourWants
  };
}
// // lib/trade-analysis/card-matcher.ts
// import { Card, CardMatch, MatchMetrics } from './types';
// import { 
//   extractPrintingId, 
//   getCardQuantity, 
//   getCardValue, 
//   createCardMatch 
// } from './utils';

// /**
//  * Creates an optimized map for O(1) card lookups.
//  * Groups cards by either their printing ID or generic card ID.
//  */
// export function createCardMap(cards: Card[], matchOnPrintingId: boolean): Map<string, Card[]> {
//     const cardMap = new Map<string, Card[]>();
    
//     for (const card of cards) {
//       // Only map cards that are available for trade
//       if (card.forTrade === false) continue;

//       // Use the flag to decide which ID to use as the key
//       const key = matchOnPrintingId ? extractPrintingId(card) : card.cardId;
      
//       if (!key) continue;
      
//       const normalizedId = key.toLowerCase();
      
//       if (!cardMap.has(normalizedId)) {
//         cardMap.set(normalizedId, []);
//       }
      
//       cardMap.get(normalizedId)!.push(card);
//     }
    
//     return cardMap;
// }

// /**
//  * Calculates match metrics between a list of wants and a list of haves.
//  */
// export function calculateMatches(
//   wantsCards: Card[],
//   havesCards: Card[],
//   matchOnPrintingId: boolean, 
//   includeCardDetails: boolean = false 
// ): MatchMetrics {
//   const havesMap = createCardMap(havesCards, matchOnPrintingId);
  
//   let matchCount = 0;
//   let totalMatchedQuantity = 0;
//   let totalValue = 0;
//   const matchedCards: CardMatch[] = [];
  
//   for (const wantCard of wantsCards) {
//     const wantKey = matchOnPrintingId ? extractPrintingId(wantCard) : wantCard.cardId;
//     if (!wantKey) continue;
    
//     const normalizedId = wantKey.toLowerCase();
//     const matchingHaves = havesMap.get(normalizedId);
    
//     if (matchingHaves && matchingHaves.length > 0) {
//       matchCount++;
      
//       const wantedQuantity = getCardQuantity(wantCard);
//       const availableQuantity = matchingHaves.reduce(
//         (sum, card) => sum + getCardQuantity(card), 
//         0
//       );
      
//       const actualMatchedQuantity = Math.min(wantedQuantity, availableQuantity);
//       totalMatchedQuantity += actualMatchedQuantity;
      
//       const cardValue = getCardValue(matchingHaves[0]);
//       totalValue += cardValue * actualMatchedQuantity;
      
//       if (includeCardDetails) {
//         matchedCards.push(createCardMatch(wantCard, matchingHaves, actualMatchedQuantity));
//       }
//     }
//   }
  
//   const totalWantsQuantity = wantsCards.reduce((sum, card) => sum + getCardQuantity(card), 0);
//   const matchRate = totalWantsQuantity > 0 ? (totalMatchedQuantity / totalWantsQuantity) * 100 : 0;

//   return {
//     count: matchCount,
//     totalQuantity: totalMatchedQuantity,
//     totalValue: Math.round(totalValue * 100) / 100,
//     rate: Math.round(matchRate * 10) / 10,
//     cards: matchedCards
//   };
// }

// /**
//  * Performs bidirectional matching between two users.
//  */
// export function performBidirectionalMatch(
//   currentUserWants: Card[],
//   currentUserHaves: Card[],
//   targetUserWants: Card[],
//   targetUserHaves: Card[],
//   matchOnPrintingId: boolean,
//   includeCardDetails: boolean = false
// ): {
//   youHaveTheirWants: MatchMetrics;
//   theyHaveYourWants: MatchMetrics;
// } {
//   const youHaveTheirWants = calculateMatches(
//     targetUserWants,
//     currentUserHaves,
//     matchOnPrintingId,
//     includeCardDetails
//   );
  
//   const theyHaveYourWants = calculateMatches(
//     currentUserWants,
//     targetUserHaves,
//     matchOnPrintingId,
//     includeCardDetails
//   );
  
//   return {
//     youHaveTheirWants,
//     theyHaveYourWants
//   };
// }