import { 
    TradeAnalysisResult, 
    Card, 
    WantsList 
  } from './types';
  import { fetchTradeData, FetchedData } from './data-fetcher';
  import { performBidirectionalMatch } from './card-matcher';
  import { 
    calculateCompatibilityScore, 
    getTradePotential, 
    getBalanceStatus 
  } from './scoring';
  import { getCardQuantity } from './utils';
  import { formatResponse, ResponseFormat } from './response-formatter';
  
  /**
   * Main trade analysis class that orchestrates the entire analysis process
   * Updated to work with InventoryItem collection directly
   */
  export class TradeAnalyzer {
    private currentUserId: string;
    private targetUserId: string;
    private includeCards: boolean;
    private format: ResponseFormat;
    private matchOnPrintingId: boolean; 
  
    constructor(
      currentUserId: string,
      targetUserId: string,
      includeCards: boolean = false,
      format: ResponseFormat = 'full',
      matchOnPrintingId: boolean = true 
    ) {
      this.currentUserId = currentUserId;
      this.targetUserId = targetUserId;
      this.includeCards = includeCards;
      this.format = format;
      this.matchOnPrintingId = matchOnPrintingId; 
    }
  
    /**
     * Performs the complete trade analysis
     */
    async analyze(): Promise<any> {
      try {
        // Step 1: Fetch all required data (now much simpler!)
        const data = await fetchTradeData(this.currentUserId, this.targetUserId);
        
        // Step 2: Process and flatten data (much simpler now)
        const processedData = this.processData(data);
        
        // Step 3: Perform matching analysis
        const matchResults = performBidirectionalMatch(
            processedData.currentUserWantsCards,
            processedData.currentUserTradeableCards, // Direct from InventoryItem query
            processedData.targetUserWantsCards,
            processedData.targetUserTradeableCards,  // Direct from InventoryItem query
            this.matchOnPrintingId, 
            this.includeCards
          );
        
        // Step 4: Calculate metrics and scores
        const analysis = this.calculateAnalysis(
          matchResults,
          processedData
        );
        
        // Step 5: Format and return response
        return formatResponse(
          analysis,
          this.format,
          this.includeCards,
          {
            targetWantsTotalQuantity: processedData.targetWantsTotalQuantity,
            currentWantsTotalQuantity: processedData.currentWantsTotalQuantity,
            // These counts are now much simpler
            currentUserTradeableCards: processedData.currentUserTradeableCards.length,
            targetUserTradeableCards: processedData.targetUserTradeableCards.length
          }
        );
      } catch (error) {
        throw new Error(`Trade analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  
    /**
     * Processes raw data into a format suitable for analysis
     * Much simpler now that we get cards directly from InventoryItem queries
     */
    private processData(data: FetchedData) {
      // Extract and flatten wants lists (no change here)
      const targetUserWantsCards = this.extractCards(data.targetWantsLists);
      const currentUserWantsCards = this.extractCards(data.currentUserWantsLists);
      
      // Tradeable cards come directly from the data fetcher now!
      // No need to filter binders or extract embedded cards
      const currentUserTradeableCards = data.currentUserTradeableCards;
      const targetUserTradeableCards = data.targetUserTradeableCards;
      
      // Calculate total quantities
      const targetWantsTotalQuantity = this.calculateTotalQuantity(targetUserWantsCards);
      const currentWantsTotalQuantity = this.calculateTotalQuantity(currentUserWantsCards);
      
      return {
        targetUserWantsCards,
        currentUserWantsCards,
        currentUserTradeableCards,
        targetUserTradeableCards,
        targetWantsTotalQuantity,
        currentWantsTotalQuantity
      };
    }
  
    /**
     * Extracts all cards from wants lists
     */
    private extractCards(lists: WantsList[]): Card[] {
      return lists.flatMap(list => list.cards || []);
    }
  
    /**
     * Calculates total quantity across all cards
     */
    private calculateTotalQuantity(cards: Card[]): number {
      return cards.reduce((sum, card) => sum + getCardQuantity(card), 0);
    }
  
    /**
     * Calculates the complete analysis from match results
     */
    private calculateAnalysis(
      matchResults: {
        youHaveTheirWants: any;
        theyHaveYourWants: any;
      },
      processedData: any
    ): TradeAnalysisResult {
      const valueDifference = matchResults.youHaveTheirWants.totalValue - 
                             matchResults.theyHaveYourWants.totalValue;
      
      const compatibilityScore = calculateCompatibilityScore({
        youHaveRate: matchResults.youHaveTheirWants.rate,
        theyHaveRate: matchResults.theyHaveYourWants.rate,
        youHaveCount: matchResults.youHaveTheirWants.count,
        theyHaveCount: matchResults.theyHaveYourWants.count,
        totalMutualCards: matchResults.youHaveTheirWants.count + matchResults.theyHaveYourWants.count,
        valueBalance: Math.abs(valueDifference)
      });
      
      return {
        youHaveTheirWants: matchResults.youHaveTheirWants,
        theyHaveYourWants: matchResults.theyHaveYourWants,
        compatibilityScore,
        tradePotential: getTradePotential(compatibilityScore),
        valueDifference,
        balanceStatus: getBalanceStatus(valueDifference),
        totalMutualCards: matchResults.youHaveTheirWants.count + matchResults.theyHaveYourWants.count,
        hasMutualInterest: matchResults.youHaveTheirWants.count > 0 && 
                           matchResults.theyHaveYourWants.count > 0
      };
    }
  }
// import { 
//     TradeAnalysisResult, 
//     Card, 
//     Binder, 
//     WantsList 
//   } from './types';
//   import { fetchTradeData, FetchedData } from './data-fetcher';
//   import { filterBindersByVisibility } from './visibility-filter';
//   import { performBidirectionalMatch } from './card-matcher';
//   import { 
//     calculateCompatibilityScore, 
//     getTradePotential, 
//     getBalanceStatus 
//   } from './scoring';
//   import { getCardQuantity } from './utils';
//   import { formatResponse, ResponseFormat } from './response-formatter';
  
//   /**
//    * Main trade analysis class that orchestrates the entire analysis process
//    */
//   export class TradeAnalyzer {
//     private currentUserId: string;
//     private targetUserId: string;
//     private includeCards: boolean;
//     private format: ResponseFormat;
//     // ADD THIS PROPERTY
//     private matchOnPrintingId: boolean; 
  
//     constructor(
//       currentUserId: string,
//       targetUserId: string,
//       includeCards: boolean = false,
//       format: ResponseFormat = 'full',
//       // ADD THIS NEW PARAMETER (with a default value)
//       matchOnPrintingId: boolean = true 
//     ) {
//       this.currentUserId = currentUserId;
//       this.targetUserId = targetUserId;
//       this.includeCards = includeCards;
//       this.format = format;
//       // ADD THIS ASSIGNMENT
//       this.matchOnPrintingId = matchOnPrintingId; 
//     }
  
//     /**
//      * Performs the complete trade analysis
//      */
//     async analyze(): Promise<any> {
//       try {
//         // Step 1: Fetch all required data
//         const data = await fetchTradeData(this.currentUserId, this.targetUserId);
        
//         // Step 2: Process and filter data
//         const processedData = this.processData(data);
        
//         // Step 3: Perform matching analysis
//         const matchResults = performBidirectionalMatch(
//             processedData.currentUserWantsCards,
//             processedData.currentUserTradeableCards,
//             processedData.targetUserWantsCards,
//             processedData.targetUserTradeableCards,
//             this.matchOnPrintingId, 
//             this.includeCards
//           );
        
//         // Step 4: Calculate metrics and scores
//         const analysis = this.calculateAnalysis(
//           matchResults,
//           processedData
//         );
        
//         // Step 5: Format and return response
//         return formatResponse(
//           analysis,
//           this.format,
//           this.includeCards,
//           {
//             targetWantsTotalQuantity: processedData.targetWantsTotalQuantity,
//             currentWantsTotalQuantity: processedData.currentWantsTotalQuantity,
//             currentUserBindersCount: data.currentUserBinders.length,
//             targetUserBindersCount: processedData.filteredTargetBinders.length,
//             currentUserTradeableCards: processedData.currentUserTradeableCards.length,
//             targetUserTradeableCards: processedData.targetUserTradeableCards.length
//           }
//         );
//       } catch (error) {
//         throw new Error(`Trade analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//       }
//     }
  
//     /**
//      * Processes raw data into a format suitable for analysis
//      */
//     private processData(data: FetchedData) {
//       // Filter target binders based on visibility
//       const filteredTargetBinders = filterBindersByVisibility(data.targetUserBinders);
      
//       // Extract and flatten card lists
//       const targetUserWantsCards = this.extractCards(data.targetWantsLists);
//       const currentUserWantsCards = this.extractCards(data.currentUserWantsLists);
      
//       // Extract tradeable cards from binders
//       const currentUserTradeableCards = this.extractTradeableCards(data.currentUserBinders);
//       const targetUserTradeableCards = this.extractTradeableCards(filteredTargetBinders);
      
//       // Calculate total quantities
//       const targetWantsTotalQuantity = this.calculateTotalQuantity(targetUserWantsCards);
//       const currentWantsTotalQuantity = this.calculateTotalQuantity(currentUserWantsCards);
      
//       return {
//         filteredTargetBinders,
//         targetUserWantsCards,
//         currentUserWantsCards,
//         currentUserTradeableCards,
//         targetUserTradeableCards,
//         targetWantsTotalQuantity,
//         currentWantsTotalQuantity
//       };
//     }
  
//     /**
//      * Extracts all cards from wants lists
//      */
//     private extractCards(lists: WantsList[]): Card[] {
//       return lists.flatMap(list => list.cards || []);
//     }
  
//     /**
//      * Extracts tradeable cards from binders
//      */
//     private extractTradeableCards(binders: Binder[]): Card[] {
//       return binders.flatMap(binder => 
//         (binder.cards || []).filter(card => card.forTrade === true)
//       );
//     }
  
//     /**
//      * Calculates total quantity across all cards
//      */
//     private calculateTotalQuantity(cards: Card[]): number {
//       return cards.reduce((sum, card) => sum + getCardQuantity(card), 0);
//     }
  
//     /**
//      * Calculates the complete analysis from match results
//      */
//     private calculateAnalysis(
//       matchResults: {
//         youHaveTheirWants: any;
//         theyHaveYourWants: any;
//       },
//       processedData: any
//     ): TradeAnalysisResult {
//       const valueDifference = matchResults.youHaveTheirWants.totalValue - 
//                              matchResults.theyHaveYourWants.totalValue;
      
//       const compatibilityScore = calculateCompatibilityScore({
//         youHaveRate: matchResults.youHaveTheirWants.rate,
//         theyHaveRate: matchResults.theyHaveYourWants.rate,
//         youHaveCount: matchResults.youHaveTheirWants.count,
//         theyHaveCount: matchResults.theyHaveYourWants.count,
//         totalMutualCards: matchResults.youHaveTheirWants.count + matchResults.theyHaveYourWants.count,
//         valueBalance: Math.abs(valueDifference)
//       });
      
//       return {
//         youHaveTheirWants: matchResults.youHaveTheirWants,
//         theyHaveYourWants: matchResults.theyHaveYourWants,
//         compatibilityScore,
//         tradePotential: getTradePotential(compatibilityScore),
//         valueDifference,
//         balanceStatus: getBalanceStatus(valueDifference),
//         totalMutualCards: matchResults.youHaveTheirWants.count + matchResults.theyHaveYourWants.count,
//         hasMutualInterest: matchResults.youHaveTheirWants.count > 0 && 
//                            matchResults.theyHaveYourWants.count > 0
//       };
//     }
//   }